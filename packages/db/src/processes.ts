// Coaches ("processes"): editable drafts and immutable published versions.
import type { Process } from "@spark/core";
import { validateProcess } from "@spark/core/validate";
import { withOrg } from "./client.ts";

export type ProcessSummary = { id: string; slug: string; title: string; status: string; latestVersion: number; updatedAt: string };
type Row = { id: string; slug: string; title: string; status: string; latest_version: number; updated_at: Date; draft: Process };
const toSummary = (r: Row): ProcessSummary => ({ id: r.id, slug: r.slug, title: r.title, status: r.status, latestVersion: r.latest_version, updatedAt: r.updated_at.toISOString() });

export const listProcesses = (orgId: string) => withOrg(orgId, async (tx) =>
  (await tx<Row[]>`select id, slug, title, status, latest_version, updated_at from processes where status <> 'archived' order by updated_at desc`).map(toSummary));

export const getProcess = (orgId: string, id: string) => withOrg(orgId, async (tx) => {
  const [r] = await tx<Row[]>`select * from processes where id = ${id}`;
  return r ? { ...toSummary(r), draft: r.draft } : null;
});

/** Create a draft. The process id (slug) is unique per org; a suffix is added if taken. */
export async function createProcess(orgId: string, actor: string, draft: Process): Promise<{ id: string }> {
  return withOrg(orgId, async (tx) => {
    let slug = draft.id;
    if ((await tx`select 1 from processes where slug = ${slug}`).length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const content = { ...draft, id: slug };
    const [r] = await tx<{ id: string }[]>`insert into processes (org_id, slug, title, draft, created_by) values (${orgId}, ${slug}, ${content.title}, ${tx.json(content as never)}, ${actor}) returning id`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'process.create', ${slug})`;
    return { id: r!.id };
  });
}

/** Save the draft. The slug never changes once created (learners' records refer to it). */
export async function saveDraft(orgId: string, actor: string, id: string, draft: Process) {
  return withOrg(orgId, async (tx) => {
    const [cur] = await tx<{ slug: string }[]>`select slug from processes where id = ${id}`;
    if (!cur) return { error: "That coach no longer exists." };
    const content = { ...draft, id: cur.slug };
    await tx`update processes set draft = ${tx.json(content as never)}, title = ${content.title || "Untitled"}, updated_at = now() where id = ${id}`;
    return { ok: true as const };
  });
}

/** Validate against the schema and the org's approved systems, then publish an immutable version. */
export async function publish(orgId: string, actor: string, id: string, approvedDomains: string[]): Promise<{ ok: true; version: number } | { ok: false; errors: string[] }> {
  return withOrg(orgId, async (tx) => {
    const [p] = await tx<Row[]>`select * from processes where id = ${id} for update`;
    if (!p) return { ok: false, errors: ["That coach no longer exists."] };
    const r = validateProcess(p.draft);
    if (!r.ok) return { ok: false, errors: r.errors };
    const off = r.process.systems.filter((s) => !approvedDomains.includes(s));
    if (off.length) return { ok: false, errors: [`Not an approved system for your company: ${off.join(", ")}. An admin can add it under Settings.`] };
    const version = p.latest_version + 1;
    await tx`insert into process_versions (org_id, process_id, version, content, published_by) values (${orgId}, ${id}, ${version}, ${tx.json(r.process as never)}, ${actor})`;
    await tx`update processes set latest_version = ${version}, status = 'published', updated_at = now() where id = ${id}`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'process.publish', ${`${p.slug} v${version}`})`;
    return { ok: true, version };
  });
}

export const versions = (orgId: string, id: string) => withOrg(orgId, async (tx) =>
  tx<{ version: number; published_at: Date; by: string | null }[]>`
    select v.version, v.published_at, u.name as by from process_versions v left join users u on u.id = v.published_by
    where v.process_id = ${id} order by v.version desc`);

export async function restoreVersion(orgId: string, actor: string, id: string, version: number) {
  return withOrg(orgId, async (tx) => {
    const [v] = await tx<{ content: Process }[]>`select content from process_versions where process_id = ${id} and version = ${version}`;
    if (!v) return { error: "No such version." };
    await tx`update processes set draft = ${tx.json(v.content as never)}, title = ${v.content.title}, updated_at = now() where id = ${id}`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'process.restore', ${`v${version}`})`;
    return { ok: true as const };
  });
}

export const archive = (orgId: string, actor: string, id: string) => withOrg(orgId, async (tx) => {
  await tx`update processes set status = 'archived', updated_at = now() where id = ${id}`;
  await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'process.archive', ${id})`;
});

/** What the extension downloads: the latest published version of each live coach. */
export const publishedBundle = (orgId: string) => withOrg(orgId, async (tx) =>
  tx<{ id: string; slug: string; version: number; content: Process }[]>`
    select p.id, p.slug, v.version, v.content from processes p
    join process_versions v on v.process_id = p.id and v.version = p.latest_version
    where p.status = 'published' order by p.title`);
