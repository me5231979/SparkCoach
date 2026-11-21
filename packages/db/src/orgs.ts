// Customer orgs, people, approved systems and the brand kit.
import { checkBrandDoc, checkBranding, type BrandDoc, type Branding } from "@spark/core";
import { slugify, type Role } from "./auth.ts";
import { system, withOrg } from "./client.ts";

export type Org = { id: string; name: string; slug: string; approvedDomains: string[]; branding: Branding; retentionDays: number; isOperator: boolean };
type OrgRow = { id: string; name: string; slug: string; approved_domains: string[]; branding: Branding; retention_days: number; is_operator: boolean };
const toOrg = (r: OrgRow): Org => ({ id: r.id, name: r.name, slug: r.slug, approvedDomains: r.approved_domains, branding: r.branding ?? {}, retentionDays: r.retention_days, isOperator: r.is_operator });

/** Operator only: every customer org. */
export const listOrgs = () => system(async (tx) => (await tx<OrgRow[]>`select * from orgs order by is_operator desc, name`).map(toOrg));

export async function createOrg(actorOrg: string, actor: string, name: string): Promise<Org | { error: string }> {
  if (!name?.trim()) return { error: "Enter the company name." };
  return system(async (tx) => {
    let slug = slugify(name);
    if ((await tx`select 1 from orgs where slug = ${slug}`).length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const [r] = await tx<OrgRow[]>`insert into orgs (name, slug) values (${name.trim()}, ${slug}) returning *`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${actorOrg}, ${actor}, 'org.create', ${name.trim()})`;
    return toOrg(r!);
  });
}

export const getOrg = (orgId: string) => withOrg(orgId, async (tx) => { const [r] = await tx<OrgRow[]>`select * from orgs where id = ${orgId}`; return r ? toOrg(r) : null; });

const HOST = /^(localhost|[a-z0-9-]+(\.[a-z0-9-]+)+)(:[0-9]+)?$/;
export async function setApprovedDomains(orgId: string, actor: string, domains: string[]): Promise<{ ok: true } | { error: string }> {
  const clean = [...new Set(domains.map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean))];
  const bad = clean.filter((d) => !HOST.test(d));
  if (bad.length) return { error: `Not a valid hostname: ${bad.join(", ")}. Use exact hosts like hr.example.com (no wildcards).` };
  await system(async (tx) => {
    await tx`update orgs set approved_domains = ${clean} where id = ${orgId}`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'org.domains', ${clean.join(",")})`;
  });
  return { ok: true };
}

export async function setBranding(orgId: string, actor: string, b: Branding): Promise<{ ok: true; branding: Branding } | { error: string }> {
  const r = checkBranding(b);
  if (!r.ok) return { error: r.errors.join(" ") };
  await system(async (tx) => {
    await tx`update orgs set branding = ${tx.json(r.branding as never)} where id = ${orgId}`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'org.branding', null)`;
  });
  return { ok: true, branding: r.branding };
}

// ── Brand docs ──────────────────────────────────────────────────────────────────────────────────────────────────

export type StoredBrandDoc = BrandDoc & { id: string; updatedAt: string };
export const listBrandDocs = (orgId: string) => withOrg(orgId, async (tx) =>
  (await tx<{ id: string; name: string; kind: BrandDoc["kind"]; body: string; updated_at: Date }[]>`select id, name, kind, body, updated_at from brand_docs order by kind, name`)
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, body: r.body, updatedAt: r.updated_at.toISOString() })));

export async function saveBrandDoc(orgId: string, actor: string, d: { name: string; kind?: string; body: string }): Promise<{ ok: true } | { error: string }> {
  const r = checkBrandDoc(d);
  if (!r.ok) return { error: r.error };
  await withOrg(orgId, async (tx) => {
    await tx`insert into brand_docs (org_id, name, kind, body, updated_by) values (${orgId}, ${r.doc.name}, ${r.doc.kind}, ${r.doc.body}, ${actor})
      on conflict (org_id, name) do update set kind = excluded.kind, body = excluded.body, updated_by = excluded.updated_by, updated_at = now()`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'brand.doc.save', ${r.doc.name})`;
  });
  return { ok: true };
}

export const deleteBrandDoc = (orgId: string, actor: string, id: string) => withOrg(orgId, async (tx) => {
  const [d] = await tx<{ name: string }[]>`delete from brand_docs where id = ${id} returning name`;
  if (d) await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'brand.doc.delete', ${d.name})`;
});

// ── People ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type Person = { id: string; name: string; email: string; roles: Role[]; active: boolean };
export const listPeople = (orgId: string) => withOrg(orgId, async (tx) =>
  tx<Person[]>`select id, name, email, roles, active from users order by name`);
export const pendingInvites = (orgId: string) => withOrg(orgId, async (tx) =>
  tx<{ email: string; roles: Role[]; expires_at: Date }[]>`select email, roles, expires_at from invites where used_at is null and expires_at > now() order by expires_at desc`);
