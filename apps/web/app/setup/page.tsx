// First run: create the operator org (the company running this Spark) and its first admin.
// Guarded by SPARK_SETUP_CODE so nobody else can claim a fresh deployment.
import { redirect } from "next/navigation";
import { createSession, isSetUp, setupPlatform } from "@spark/db";
import { setSessionCookie } from "../../lib/session";

export const dynamic = "force-dynamic";

async function setup(form: FormData) {
  "use server";
  const code = process.env.SPARK_SETUP_CODE;
  if (!code) redirect("/setup?error=" + encodeURIComponent("Set SPARK_SETUP_CODE in the environment first."));
  if (String(form.get("code") ?? "") !== code) redirect("/setup?error=" + encodeURIComponent("That setup code isn't right."));
  const r = await setupPlatform({ orgName: String(form.get("orgName") ?? ""), name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
  if ("error" in r) redirect("/setup?error=" + encodeURIComponent(r.error));
  const s = await createSession(r.orgId, r.id, "web");
  await setSessionCookie(s.token, s.expiresAt);
  redirect("/operator");
}

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isSetUp()) redirect("/login");
  const { error } = await searchParams;
  return (
    <main className="narrow">
      <h1>Set up Spark</h1>
      <p className="muted">Create the account for the company that runs this Spark. You'll add customer companies next.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form action={setup} className="card">
        <label htmlFor="code">Setup code</label><input id="code" name="code" type="password" required autoComplete="off" />
        <label htmlFor="orgName">Your company</label><input id="orgName" name="orgName" required defaultValue="Matchlight" />
        <label htmlFor="name">Your name</label><input id="name" name="name" required autoComplete="name" />
        <label htmlFor="email">Work email</label><input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
        <p className="muted">At least 10 characters.</p>
        <button className="primary">Create and sign in</button>
      </form>
    </main>
  );
}
