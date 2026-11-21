// Customer orgs, people, approved systems and the brand kit.
import { checkBrandDoc, checkBranding, type BrandDoc, type Branding } from "@spark/core";
import { slugify, type Role } from "./auth.ts";
import { system, withOrg } from "./client.ts";

export type Org = { id: string; name: string; slug: string; approvedDomains: string[]; branding: Branding; retentionDays: number; isOperator: boolean; plan: string; features: Features; aiKeyHint: string | null };
type OrgRow = { id: string; name: string; slug: string; approved_domains: string[]; branding: Branding; retention_days: number; is_operator: boolean; plan: string; features: Features; ai_key_hint: string | null };
const toOrg = (r: OrgRow): Org => ({ id: r.id, name: r.name, slug: r.slug, approvedDomains: r.approved_domains, branding: r.branding ?? {}, retentionDays: r.retention_days, isOperator: r.is_operator, plan: r.plan, features: r.features ?? {}, aiKeyHint: r.ai_key_hint });

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

// ── AI: bring your own key, plans and add-ons ───────────────────────────────────────────────────────────────────

export type Features = { managedAi?: boolean; reports?: boolean; whiteLabel?: boolean };
export type AiSettings = { provider: string; model: string | null; keyHint: string | null; plan: string; features: Features };

export const aiSettings = (orgId: string) => withOrg(orgId, async (tx) => {
  const [r] = await tx<{ ai_provider: string; ai_model: string | null; ai_key_hint: string | null; plan: string; features: Features }[]>`
    select ai_provider, ai_model, ai_key_hint, plan, features from orgs where id = ${orgId}`;
  return r ? { provider: r.ai_provider, model: r.ai_model, keyHint: r.ai_key_hint, plan: r.plan, features: r.features ?? {} } as AiSettings : null;
});

const MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"];
export const AI_MODELS = MODELS;

/** Save the customer's own AI key (encrypted) and model choice. Pass key "" to keep the current one, null to remove. */
export async function setAiSettings(orgId: string, actor: string, s: { model?: string; key?: string | null }): Promise<{ ok: true } | { error: string }> {
  const { seal, hint } = await import("./secrets.ts");
  if (s.model && !MODELS.includes(s.model)) return { error: "Pick a model from the list." };
  if (typeof s.key === "string" && s.key && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(s.key.trim())) return { error: "That doesn't look like an Anthropic API key (it starts with sk-ant-)." };
  await system(async (tx) => {
    if (s.model !== undefined) await tx`update orgs set ai_model = ${s.model || null} where id = ${orgId}`;
    if (s.key === null) await tx`update orgs set ai_key_enc = null, ai_key_hint = null where id = ${orgId}`;
    else if (s.key) await tx`update orgs set ai_key_enc = ${seal(s.key.trim(), orgId)}, ai_key_hint = ${hint(s.key.trim())} where id = ${orgId}`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${actor}, 'org.ai', ${s.key === null ? "key removed" : s.key ? "key set" : "model"})`;
  });
  return { ok: true };
}

/**
 * The credentials an AI call for this org uses: the customer's own key first. The platform key only when the
 * operator switched on the Managed AI add-on for them (and for the operator's own org). Otherwise null: AI features say how to add a key.
 */
export async function aiCredentials(orgId: string, platformKey: string | undefined): Promise<{ apiKey: string; model: string | null; source: "customer" | "managed" } | null> {
  const { open } = await import("./secrets.ts");
  const r = await system(async (tx) => (await tx<{ ai_key_enc: string | null; ai_model: string | null; features: Features; is_operator: boolean }[]>`
    select ai_key_enc, ai_model, features, is_operator from orgs where id = ${orgId}`)[0]);
  if (!r) return null;
  if (r.ai_key_enc) return { apiKey: open(r.ai_key_enc, orgId), model: r.ai_model, source: "customer" };
  // The operator's own org (the company running Spark) and customers with Managed AI use the platform key.
  if ((r.features?.managedAi || r.is_operator) && platformKey) return { apiKey: platformKey, model: r.ai_model, source: "managed" };
  return null;
}

/** Operator only: plan and add-on SKUs for a customer. */
export async function setPlan(orgId: string, actorOrg: string, actor: string, plan: string, features: Features) {
  await system(async (tx) => {
    await tx`update orgs set plan = ${plan}, features = ${tx.json(features as never)} where id = ${orgId}`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${actorOrg}, ${actor}, 'org.plan', ${`${orgId} ${plan} ${JSON.stringify(features)}`})`;
  });
}
