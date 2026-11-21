// Insight: who can do which process alone, independence over runs, where people get stuck.
import { isReady, type Level } from "@spark/core";
import { withOrg } from "./client.ts";

export type LearnerRow = { userId: string; name: string; process: string; runs: number; lastIndependence: number | null; ready: boolean; lastRun: string | null };

export async function learnerTable(orgId: string): Promise<LearnerRow[]> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx<{ user_id: string; name: string; title: string; run_id: string; status: "completed" | "abandoned"; independence: number | null; finished_at: Date | null; levels: number[] }[]>`
      select r.user_id, u.name, p.title, r.id as run_id, r.status, r.independence, r.finished_at,
        coalesce(array_agg(sr.level) filter (where sr.level is not null), '{}') as levels
      from runs r join users u on u.id = r.user_id join processes p on p.id = r.process_id
      left join step_results sr on sr.run_id = r.id
      group by r.id, u.name, p.title order by u.name, p.title, r.finished_at nulls first`;
    type R = (typeof rows)[number];
    const by = new Map<string, R[]>();
    for (const r of rows) { const k = `${r.user_id}|${r.title}`; by.set(k, [...(by.get(k) ?? []), r]); }
    return [...by.values()].map((rs) => {
      const last = rs.at(-1)!;
      return { userId: last.user_id, name: last.name, process: last.title, runs: rs.length, lastIndependence: last.independence, ready: isReady(rs.map((r) => ({ status: r.status, levels: r.levels as Level[] }))), lastRun: last.finished_at?.toISOString() ?? null };
    });
  });
}

export const mostMissed = (orgId: string) => withOrg(orgId, async (tx) =>
  tx<{ title: string; step_id: string; misses: number; total: number }[]>`
    select p.title, sr.step_id, count(*) filter (where sr.outcome = 'miss')::int as misses, count(*)::int as total
    from step_results sr join runs r on r.id = sr.run_id join processes p on p.id = r.process_id
    where sr.type = 'screen' group by p.title, sr.step_id having count(*) filter (where sr.outcome = 'miss') > 0
    order by misses desc limit 10`);

export const totals = (orgId: string) => withOrg(orgId, async (tx) => (await tx<{ learners: number; runs: number; coaches: number }[]>`
  select (select count(*)::int from users) as learners, (select count(*)::int from runs) as runs,
         (select count(*)::int from processes where status = 'published') as coaches`)[0]!);
