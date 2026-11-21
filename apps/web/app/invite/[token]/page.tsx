import { redirect } from "next/navigation";
import { acceptInvite, createSession, inviteInfo } from "@spark/db";
import { setSessionCookie } from "../../../lib/session";

export const dynamic = "force-dynamic";

async function accept(form: FormData) {
  "use server";
  const token = String(form.get("token") ?? "");
  const r = await acceptInvite(token, String(form.get("name") ?? ""), String(form.get("password") ?? ""));
  if ("error" in r) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(r.error)}`);
  const s = await createSession(r.orgId, r.id, "web");
  await setSessionCookie(s.token, s.expiresAt);
  redirect(r.roles.some((x) => x === "author" || x === "admin") ? "/studio" : "/welcome");
}

export default async function Invite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const info = await inviteInfo(token);
  if (!info) return <main className="narrow"><h1>Invite expired</h1><p>This invite link has expired or was already used. Ask for a new one.</p></main>;
  return (
    <main className="narrow">
      <h1>Join {info.org_name} on Spark</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <form action={accept} className="card">
        <input type="hidden" name="token" value={token} />
        <p className="muted">Signing up as <strong>{info.email}</strong></p>
        <label htmlFor="name">Your name</label><input id="name" name="name" required autoComplete="name" />
        <label htmlFor="password">Choose a password</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
        <p className="muted">At least 10 characters.</p>
        <button className="primary">Join</button>
      </form>
    </main>
  );
}
