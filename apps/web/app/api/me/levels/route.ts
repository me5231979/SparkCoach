import { levelsFor } from "@spark/db";
import { extUser, fail, json } from "../../../../lib/api";

export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return fail("Sign in again.", 401);
  return json(await levelsFor(u.orgId, u.id));
}
