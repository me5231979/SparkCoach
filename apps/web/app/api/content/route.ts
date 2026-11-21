// The org's published coaches + theme, for the extension. Changes apply between runs (the extension decides).
import { createHash } from "node:crypto";
import { themeOf } from "@spark/core";
import { getOrg, publishedBundle } from "@spark/db";
import { extUser, fail, json } from "../../../lib/api";

export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return fail("Sign in again.", 401);
  const [org, bundle] = await Promise.all([getOrg(u.orgId), publishedBundle(u.orgId)]);
  const payload = { processes: bundle.map((b) => ({ ...b.content, version: b.version })), approvedDomains: org!.approvedDomains, theme: themeOf(org!.branding) };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("base64url").slice(0, 22);
  if (new URL(req.url).searchParams.get("since") === hash) return new Response(null, { status: 304 });
  return json({ hash, ...payload });
}
