import { redirect } from "next/navigation";
import { createSession, signIn } from "@spark/db";
import { limited } from "../../lib/api";
import { setSessionCookie } from "../../lib/session";

export const dynamic = "force-dynamic";

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/studio");

async function login(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "").trim();
  const next = safeNext(form.get("next"));
  if (limited(`login:${email.toLowerCase()}`, 10, 10 * 60_000)) redirect(`/login?error=${encodeURIComponent("Too many tries. Wait a few minutes.")}&next=${encodeURIComponent(next)}`);
  const u = await signIn(email, String(form.get("password") ?? ""));
  if (!u) redirect(`/login?error=${encodeURIComponent("That email and password don't match.")}&next=${encodeURIComponent(next)}`);
  const s = await createSession(u.orgId, u.id, "web");
  await setSessionCookie(s.token, s.expiresAt);
  redirect(next);
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="narrow">
      <h1>Sign in to Spark</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <form action={login} className="card">
        <input type="hidden" name="next" value={safeNext(next)} />
        <label htmlFor="email">Work email</label><input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" />
        <p><button className="primary">Sign in</button></p>
      </form>
      <p className="muted">No account? Ask your Spark admin for an invite link.</p>
    </main>
  );
}
