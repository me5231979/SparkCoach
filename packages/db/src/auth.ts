// Accounts and sessions. Passwords: scrypt. Tokens: 32 random bytes, stored only as SHA-256 hashes.
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { system, withOrg } from "./client.ts";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type Role = "learner" | "author" | "manager" | "admin" | "operator";
export type SessionUser = { id: string; orgId: string; email: string; name: string; roles: Role[]; org: { id: string; name: string; slug: string; isOperator: boolean } };

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, s, k] = stored.split("$");
  const key = await scrypt(pw, Buffer.from(s!, "base64url"), 32);
  const want = Buffer.from(k!, "base64url");
  return want.length === key.length && timingSafeEqual(want, key);
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("base64url");
export const newToken = () => { const token = randomBytes(32).toString("base64url"); return { token, hash: sha256(token) }; };

export const PASSWORD_RULE = "Use at least 10 characters.";
export const passwordOk = (pw: string) => typeof pw === "string" && pw.length >= 10 && pw.length <= 200;
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

const TTL = { web: 12 * 3600, ext: 3600, ext_refresh: 30 * 86400 } as const;

type Row = { id: string; org_id: string; email: string; name: string; roles: Role[]; org_name: string; slug: string; is_operator: boolean };
const toUser = (r: Row): SessionUser => ({ id: r.id, orgId: r.org_id, email: r.email, name: r.name, roles: r.roles, org: { id: r.org_id, name: r.org_name, slug: r.slug, isOperator: r.is_operator } });

export async function createSession(orgId: string, userId: string, kind: keyof typeof TTL): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + TTL[kind] * 1000);
  await withOrg(orgId, (tx) => tx`insert into sessions (org_id, user_id, token_hash, kind, expires_at) values (${orgId}, ${userId}, ${hash}, ${kind}, ${expiresAt})`);
  return { token, expiresAt };
}

export async function sessionUser(token: string | undefined, kind: keyof typeof TTL): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  return system(async (tx) => {
    const rows = await tx<Row[]>`
      select u.id, u.org_id, u.email, u.name, u.roles, o.name as org_name, o.slug, o.is_operator
      from sessions s join users u on u.id = s.user_id join orgs o on o.id = u.org_id
      where s.token_hash = ${sha256(token)} and s.kind = ${kind} and s.expires_at > now() and u.active`;
    return rows[0] ? toUser(rows[0]) : null;
  });
}

export async function endSession(token: string | undefined) {
  if (!token) return;
  await system((tx) => tx`delete from sessions where token_hash = ${sha256(token)}`);
}

export async function signIn(email: string, password: string): Promise<SessionUser | null> {
  const rows = await system((tx) => tx<(Row & { password_hash: string | null })[]>`
    select u.id, u.org_id, u.email, u.name, u.roles, u.password_hash, o.name as org_name, o.slug, o.is_operator
    from users u join orgs o on o.id = u.org_id where lower(u.email) = lower(${email}) and u.active`);
  const r = rows[0];
  const ok = await verifyPassword(password, r?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  return r && ok ? toUser(r) : null;
}

/** First run only: create the operator org (the company running Spark) and its first admin. */
export async function setupPlatform(input: { orgName: string; name: string; email: string; password: string }): Promise<SessionUser | { error: string }> {
  if (!input.orgName?.trim() || !input.name?.trim()) return { error: "Fill in every field." };
  if (!emailOk(input.email)) return { error: "Enter a valid email." };
  if (!passwordOk(input.password)) return { error: PASSWORD_RULE };
  const hash = await hashPassword(input.password);
  return system(async (tx) => {
    const n = (await tx<{ n: number }[]>`select count(*)::int as n from orgs`)[0]?.n ?? 0;
    if (n > 0) return { error: "Spark is already set up. Sign in instead." };
    const [org] = await tx<{ id: string }[]>`insert into orgs (name, slug, is_operator) values (${input.orgName.trim()}, ${slugify(input.orgName)}, true) returning id`;
    const [u] = await tx<{ id: string }[]>`insert into users (org_id, email, name, password_hash, roles) values (${org!.id}, ${input.email.trim()}, ${input.name.trim()}, ${hash}, ${["operator", "admin", "author", "manager", "learner"]}) returning id`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${org!.id}, ${u!.id}, 'platform.setup', ${input.orgName})`;
    return { id: u!.id, orgId: org!.id, email: input.email.trim(), name: input.name.trim(), roles: ["operator", "admin", "author", "manager", "learner"], org: { id: org!.id, name: input.orgName.trim(), slug: slugify(input.orgName), isOperator: true } };
  });
}

export const isSetUp = () => system(async (tx) => (await tx<{ n: number }[]>`select count(*)::int as n from orgs`)[0]!.n > 0);

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "org";
}

// ── Invites ─────────────────────────────────────────────────────────────────────────────────────────────────────

export async function createInvite(orgId: string, by: string, email: string, roles: Role[]): Promise<{ token: string } | { error: string }> {
  if (!emailOk(email)) return { error: "Enter a valid email." };
  const allowed: Role[] = ["learner", "author", "manager", "admin"];
  const clean = [...new Set(roles.filter((r) => allowed.includes(r)))];
  if (!clean.length) clean.push("learner");
  if (!clean.includes("learner")) clean.push("learner");
  const { token, hash } = newToken();
  const taken = await system(async (tx) => (await tx`select 1 from users where lower(email) = lower(${email})`).length > 0);
  if (taken) return { error: "Someone already uses that email." };
  await withOrg(orgId, async (tx) => {
    await tx`insert into invites (org_id, token_hash, email, roles, created_by, expires_at) values (${orgId}, ${hash}, ${email.trim()}, ${clean}, ${by}, now() + interval '14 days')`;
    await tx`insert into audit_log (org_id, actor_id, action, subject) values (${orgId}, ${by}, 'invite.create', ${email.trim()})`;
  });
  return { token };
}

export async function inviteInfo(token: string) {
  return system(async (tx) => (await tx<{ email: string; org_name: string }[]>`
    select i.email, o.name as org_name from invites i join orgs o on o.id = i.org_id
    where i.token_hash = ${sha256(token)} and i.used_at is null and i.expires_at > now()`)[0] ?? null);
}

export async function acceptInvite(token: string, name: string, password: string): Promise<SessionUser | { error: string }> {
  if (!name?.trim()) return { error: "Enter your name." };
  if (!passwordOk(password)) return { error: PASSWORD_RULE };
  const hash = await hashPassword(password);
  return system(async (tx) => {
    const [inv] = await tx<{ id: string; org_id: string; email: string; roles: Role[] }[]>`
      select id, org_id, email, roles from invites where token_hash = ${sha256(token)} and used_at is null and expires_at > now() for update`;
    if (!inv) return { error: "This invite link has expired or was already used. Ask for a new one." };
    const [u] = await tx<{ id: string }[]>`insert into users (org_id, email, name, password_hash, roles) values (${inv.org_id}, ${inv.email}, ${name.trim()}, ${hash}, ${inv.roles}) returning id`;
    await tx`update invites set used_at = now() where id = ${inv.id}`;
    const [o] = await tx<{ name: string; slug: string; is_operator: boolean }[]>`select name, slug, is_operator from orgs where id = ${inv.org_id}`;
    return { id: u!.id, orgId: inv.org_id, email: inv.email, name: name.trim(), roles: inv.roles, org: { id: inv.org_id, name: o!.name, slug: o!.slug, isOperator: o!.is_operator } };
  });
}

// ── Extension sign-in: one-time code → short access token + rotating refresh token ──────────────────────────────

export async function createExtCode(user: SessionUser): Promise<string> {
  const { token, hash } = newToken();
  await withOrg(user.orgId, (tx) => tx`insert into ext_codes (code_hash, org_id, user_id, expires_at) values (${hash}, ${user.orgId}, ${user.id}, now() + interval '2 minutes')`);
  return token;
}

export async function exchangeExtCode(code: string) {
  const row = await system(async (tx) => (await tx<{ org_id: string; user_id: string }[]>`
    update ext_codes set used_at = now() where code_hash = ${sha256(code)} and used_at is null and expires_at > now() returning org_id, user_id`)[0]);
  if (!row) return null;
  return issueExtTokens(row.org_id, row.user_id);
}

export async function refreshExt(refresh: string) {
  const row = await system(async (tx) => (await tx<{ org_id: string; user_id: string }[]>`
    delete from sessions where token_hash = ${sha256(refresh)} and kind = 'ext_refresh' and expires_at > now() returning org_id, user_id`)[0]);
  if (!row) return null;
  return issueExtTokens(row.org_id, row.user_id);
}

async function issueExtTokens(orgId: string, userId: string) {
  const access = await createSession(orgId, userId, "ext");
  const refresh = await createSession(orgId, userId, "ext_refresh");
  const user = await sessionUser(access.token, "ext");
  return { token: access.token, expiresAt: access.expiresAt.toISOString(), refresh: refresh.token, user: user! };
}
