// Training records. The server is the source of truth for levels: it re-applies the throttle from each run's
// step outcomes (COACHING-MODEL §4). Idempotent on the client's runId.
import { independence, isReady, throttle, START, type Level, type Levels, type PartState } from "@spark/core";
import { withOrg } from "./client.ts";

export type RunIn = {
  runId: string; processId: string; version: number; startedAt: string; finishedAt?: string; status: "completed" | "abandoned";
  steps: { id: string; type: string; level?: number; outcome: "right" | "miss" | "done" | "skipped"; seconds: number; hints: number; resolved?: boolean; less?: boolean }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function levelsFor(orgId: string, userId: string): Promise<Levels> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx<{ slug: string; step_id: string; level: number; streak: number }[]>`
      select p.slug, s.step_id, s.level, s.streak from part_states s join processes p on p.id = s.process_id where s.user_id = ${userId}`;
    const out: Levels = {};
    for (const r of rows) (out[r.slug] ??= {})[r.step_id] = { level: r.level as Level, streak: r.streak };
    return out;
  });
}

export async function recordRun(orgId: string, userId: string, run: RunIn): Promise<{ ok: true; levels: Levels; ready: boolean } | { error: string }> {
  if (!UUID.test(run.runId)) return { error: "Bad run id." };
  if (!Array.isArray(run.steps) || run.steps.length > 500) return { error: "Bad steps." };
  const result = await withOrg(orgId, async (tx) => {
    const [p] = await tx<{ id: string; content: { steps: { id: string; type: string }[] } }[]>`
      select p.id, v.content from processes p join process_versions v on v.process_id = p.id and v.version = ${run.version} where p.slug = ${run.processId}`;
    if (!p) return { error: "Unknown coach or version." };
    const known = new Map(p.content.steps.map((s) => [s.id, s.type]));
    const steps = run.steps.filter((s) => known.has(s.id));
    const inserted = await tx`insert into runs (id, org_id, user_id, process_id, version, started_at, finished_at, status, independence, misses)
      values (${run.runId}, ${orgId}, ${userId}, ${p.id}, ${run.version}, ${new Date(run.startedAt)}, ${run.finishedAt ? new Date(run.finishedAt) : null}, ${run.status},
        ${independence(steps.filter((s) => s.level).map((s) => s.level as Level))}, ${steps.filter((s) => s.outcome === "miss").length})
      on conflict (id) do nothing returning id`;
    if (inserted.length) {
      for (const s of steps) {
        await tx`insert into step_results (run_id, org_id, step_id, type, level, outcome, seconds, hints, resolved)
          values (${run.runId}, ${orgId}, ${s.id}, ${known.get(s.id)!}, ${s.level ?? null}, ${s.outcome}, ${Math.max(0, Math.min(86400, s.seconds | 0))}, ${Math.max(0, Math.min(99, s.hints | 0))}, ${s.resolved ?? null})`;
        if (known.get(s.id) !== "screen" || (s.outcome !== "right" && s.outcome !== "miss")) continue;
        const [cur] = await tx<{ level: number; streak: number }[]>`select level, streak from part_states where user_id = ${userId} and process_id = ${p.id} and step_id = ${s.id} for update`;
        let state: PartState = cur ? { level: cur.level as Level, streak: cur.streak } : START;
        if (s.less) state = throttle(state, "less");
        state = throttle(state, s.outcome);
        await tx`insert into part_states (org_id, user_id, process_id, step_id, level, streak, updated_at) values (${orgId}, ${userId}, ${p.id}, ${s.id}, ${state.level}, ${state.streak}, now())
          on conflict (user_id, process_id, step_id) do update set level = excluded.level, streak = excluded.streak, updated_at = now()`;
      }
    }
    const recent = await tx<{ status: "completed" | "abandoned"; levels: number[] }[]>`
      select r.status, coalesce(array_agg(sr.level) filter (where sr.level is not null), '{}') as levels
      from runs r left join step_results sr on sr.run_id = r.id
      where r.user_id = ${userId} and r.process_id = ${p.id} group by r.id order by r.finished_at nulls first, r.started_at`;
    return { ok: true as const, ready: isReady(recent.map((r) => ({ status: r.status, levels: r.levels as Level[] }))) };
  });
  if ("error" in result && result.error) return { error: result.error };
  return { ok: true, ready: !!result.ready, levels: await levelsFor(orgId, userId) };
}
