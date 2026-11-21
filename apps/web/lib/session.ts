// Who is signed in, and which org they're acting in. Operators (the company running Spark) can open any org.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOrg, sessionUser, type Org, type Role, type SessionUser } from "@spark/db";

export const SESSION_COOKIE = "spark_session";
export const ORG_COOKIE = "spark_org";

export type Ctx = { user: SessionUser; org: Org; acting: boolean; can: (r: Role) => boolean };

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return sessionUser(jar.get(SESSION_COOKIE)?.value, "web");
}

export async function ctx(): Promise<Ctx | null> {
  const user = await currentUser();
  if (!user) return null;
  const jar = await cookies();
  const wanted = jar.get(ORG_COOKIE)?.value;
  const operator = user.roles.includes("operator");
  const orgId = operator && wanted && /^[0-9a-f-]{36}$/.test(wanted) ? wanted : user.orgId;
  const org = await getOrg(orgId);
  if (!org) return null;
  const acting = orgId !== user.orgId;
  // An operator acting inside a customer org has admin rights there; everyone else has their own roles.
  const roles = new Set<Role>(acting ? ["admin", "author", "manager", "learner"] : user.roles);
  if (operator) roles.add("operator");
  return { user, org, acting, can: (r) => roles.has(r) || (r !== "operator" && roles.has("admin")) };
}

export async function requireCtx(role?: Role): Promise<Ctx> {
  const c = await ctx();
  if (!c) redirect("/login");
  if (role && !c.can(role)) redirect("/studio?error=" + encodeURIComponent("You don't have access to that page."));
  return c;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}
