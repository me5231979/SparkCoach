import { recordRun, type RunIn } from "@spark/db";
import { body, extUser, fail, json, limited } from "../../../lib/api";

export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return fail("Sign in again.", 401);
  if (limited(`runs:${u.id}`, 120, 3600_000)) return fail("Too many runs. Try again later.", 429);
  const b = await body<RunIn>(req);
  if (!b || typeof b.processId !== "string" || typeof b.version !== "number") return fail("Bad run.");
  const r = await recordRun(u.orgId, u.id, b);
  return "error" in r ? fail(r.error) : json(r);
}
