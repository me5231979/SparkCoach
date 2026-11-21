import { refreshExt } from "@spark/db";
import { body, fail, json } from "../../../../../lib/api";

export async function POST(req: Request) {
  const b = await body<{ refresh?: string }>(req, 2000);
  if (!b?.refresh) return fail("Missing refresh token.");
  const t = await refreshExt(b.refresh);
  if (!t) return fail("Your session ended. Sign in again.", 401);
  return json({ token: t.token, expiresAt: t.expiresAt, refresh: t.refresh });
}
