import { cookies } from "next/headers";
import { endSession } from "@spark/db";
import { ORG_COOKIE, SESSION_COOKIE } from "../../lib/session";

export async function POST(req: Request) {
  const jar = await cookies();
  await endSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  jar.delete(ORG_COOKIE);
  return Response.redirect(new URL("/login", req.url), 303);
}
