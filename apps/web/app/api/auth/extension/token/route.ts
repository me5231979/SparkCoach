import { exchangeExtCode, getOrg } from "@spark/db";
import { themeOf } from "@spark/core";
import { body, fail, json } from "../../../../../lib/api";

export async function POST(req: Request) {
  const b = await body<{ code?: string }>(req, 2000);
  if (!b?.code) return fail("Missing code.");
  const t = await exchangeExtCode(b.code);
  if (!t) return fail("That sign-in code has expired. Sign in again.", 401);
  const org = await getOrg(t.user.orgId);
  return json({ token: t.token, expiresAt: t.expiresAt, refresh: t.refresh,
    user: { id: t.user.id, name: t.user.name, email: t.user.email, roles: t.user.roles },
    org: { id: org!.id, name: org!.name, approvedDomains: org!.approvedDomains, theme: themeOf(org!.branding) } });
}
