// Integration tests on a real Postgres (SPARK_TEST_DATABASE_URL, superuser). The app runs as a NON-superuser role,
// as on Neon, so row-level security applies. Skipped when no test database is configured.
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import demo from "../../../fixtures/processes/demo-change-owner.process.json" with { type: "json" };
import type { Process } from "@spark/core";
import * as A from "./auth.ts";
import { setClient, system, withOrg } from "./client.ts";
import { migrate } from "./migrate.ts";
import * as O from "./orgs.ts";
import * as P from "./processes.ts";
import * as R from "./runs.ts";
import * as I from "./insight.ts";

const ADMIN = process.env.SPARK_TEST_DATABASE_URL;
const d = ADMIN ? describe : describe.skip;

d("database", () => {
  let admin: postgres.Sql;
  const dbName = `spark_t_${Date.now()}`;
  let op: A.SessionUser, acme: O.Org, globex: O.Org, acmeAdmin: A.SessionUser, globexAdmin: A.SessionUser;

  beforeAll(async () => {
    admin = postgres(ADMIN!, { max: 1, onnotice: () => undefined });
    await admin.unsafe(`create database ${dbName}`);
    const url = new URL(ADMIN!); url.pathname = `/${dbName}`;
    await migrate(url.toString());
    const a2 = postgres(url.toString(), { max: 1, onnotice: () => undefined });
    await a2.unsafe(`do $$ begin if not exists (select from pg_roles where rolname = 'spark_app') then create role spark_app login password 'app'; end if; end $$;
      grant usage on schema public to spark_app; grant select, insert, update, delete on all tables in schema public to spark_app;
      grant usage, select on all sequences in schema public to spark_app;`);
    await a2.end();
    const app = new URL(url); app.username = "spark_app"; app.password = "app";
    setClient(postgres(app.toString(), { max: 3, prepare: false, onnotice: () => undefined }));

    const r = await A.setupPlatform({ orgName: "Matchlight", name: "Op Erator", email: "op@matchlight.test", password: "correct horse battery" });
    if ("error" in r) throw new Error(r.error);
    op = r;
    acme = (await O.createOrg(op.orgId, op.id, "Acme Corp")) as O.Org;
    globex = (await O.createOrg(op.orgId, op.id, "Globex")) as O.Org;
    const inviteAndAccept = async (org: O.Org, email: string) => {
      const inv = await A.createInvite(org.id, op.id, email, ["admin", "author", "manager"]);
      if ("error" in inv) throw new Error(inv.error);
      const u = await A.acceptInvite(inv.token, `Admin of ${org.name}`, "a long password here");
      if ("error" in u) throw new Error(u.error);
      return u;
    };
    acmeAdmin = await inviteAndAccept(acme, "admin@acme.test");
    globexAdmin = await inviteAndAccept(globex, "admin@globex.test");
    await O.setApprovedDomains(acme.id, acmeAdmin.id, ["localhost:4310"]);
  });

  afterAll(async () => {
    setClient(null);
    await admin?.unsafe(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${dbName}' and pid <> pg_backend_pid()`);
    await admin?.unsafe(`drop database if exists ${dbName}`);
    await admin?.end();
  });

  it("setup runs once", async () => {
    const again = await A.setupPlatform({ orgName: "X", name: "Y", email: "y@x.test", password: "another long one" });
    expect(again).toEqual({ error: "Spark is already set up. Sign in instead." });
  });

  it("signs in with the right password only, and sessions resolve", async () => {
    expect(await A.signIn("ADMIN@acme.test", "wrong password!!")).toBeNull();
    const u = await A.signIn("ADMIN@acme.test", "a long password here");
    expect(u?.org.name).toBe("Acme Corp");
    const s = await A.createSession(u!.orgId, u!.id, "web");
    expect((await A.sessionUser(s.token, "web"))?.email).toBe("admin@acme.test");
    expect(await A.sessionUser(s.token, "ext")).toBeNull(); // kind must match
    await A.endSession(s.token);
    expect(await A.sessionUser(s.token, "web")).toBeNull();
  });

  it("invites are single-use", async () => {
    const inv = await A.createInvite(acme.id, acmeAdmin.id, "learner@acme.test", ["learner"]);
    if ("error" in inv) throw new Error(inv.error);
    expect("error" in (await A.acceptInvite(inv.token, "Lee Learner", "a long password here"))).toBe(false);
    expect(await A.acceptInvite(inv.token, "Lee Again", "a long password here")).toMatchObject({ error: expect.stringMatching(/expired|used/) });
  });

  it("extension sign-in: one-time code, then refresh rotates", async () => {
    const code = await A.createExtCode(acmeAdmin);
    const t = await A.exchangeExtCode(code);
    expect(t?.user.orgId).toBe(acme.id);
    expect(await A.exchangeExtCode(code)).toBeNull();
    const t2 = await A.refreshExt(t!.refresh);
    expect(t2?.token).toBeTruthy();
    expect(await A.refreshExt(t!.refresh)).toBeNull(); // rotated
  });

  it("make → publish → bundle → run → levels → insight", async () => {
    const { id } = await P.createProcess(acme.id, acmeAdmin.id, demo as Process);
    const bad = await P.publish(acme.id, acmeAdmin.id, id, []);
    expect(bad).toMatchObject({ ok: false, errors: [expect.stringMatching(/approved system/)] });
    const pub = await P.publish(acme.id, acmeAdmin.id, id, ["localhost:4310"]);
    expect(pub).toEqual({ ok: true, version: 1 });
    const bundle = await P.publishedBundle(acme.id);
    expect(bundle.map((b) => b.slug)).toEqual(["demo-change-owner"]);

    const steps = (demo as Process).steps.map((s) => ({ id: s.id, type: s.type, ...(s.type === "screen" ? { level: 1 } : {}), outcome: (s.type === "screen" ? "right" : "done") as "right" | "done", seconds: 3, hints: 0 }));
    const run = { runId: crypto.randomUUID(), processId: "demo-change-owner", version: 1, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), status: "completed" as const, steps };
    const r1 = await R.recordRun(acme.id, acmeAdmin.id, run);
    expect(r1).toMatchObject({ ok: true, ready: false });
    if (!("ok" in r1)) throw new Error();
    expect(r1.levels["demo-change-owner"]!["open-record"]).toEqual({ level: 1, streak: 1 });
    const again = await R.recordRun(acme.id, acmeAdmin.id, run); // idempotent
    if (!("ok" in again)) throw new Error();
    expect(again.levels["demo-change-owner"]!["open-record"]).toEqual({ level: 1, streak: 1 });
    const r2 = await R.recordRun(acme.id, acmeAdmin.id, { ...run, runId: crypto.randomUUID() });
    if (!("ok" in r2)) throw new Error();
    expect(r2.levels["demo-change-owner"]!["open-record"]).toEqual({ level: 2, streak: 0 });

    const table = await I.learnerTable(acme.id);
    expect(table[0]).toMatchObject({ name: "Admin of Acme Corp", process: "Change a record's owner", runs: 2, lastIndependence: 0 });
    expect(await I.totals(acme.id)).toMatchObject({ runs: 2, coaches: 1 });
  });

  it("brand kit: validated colors, .md docs", async () => {
    expect(await O.setBranding(acme.id, acmeAdmin.id, { displayName: "Acme Coach", accent: "#0b6e4f" })).toMatchObject({ ok: true });
    expect(await O.setBranding(acme.id, acmeAdmin.id, { accent: "#ffff00" })).toMatchObject({ error: expect.stringMatching(/hard to read|stand out/) });
    expect(await O.saveBrandDoc(acme.id, acmeAdmin.id, { name: "voice", kind: "voice", body: "# Voice\nWarm and brief." })).toEqual({ ok: true });
    expect(await O.saveBrandDoc(acme.id, acmeAdmin.id, { name: "voice", kind: "voice", body: "# Voice\nWarmer." })).toEqual({ ok: true });
    const docs = await O.listBrandDocs(acme.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.body).toContain("Warmer");
    expect((await O.getOrg(acme.id))?.branding.displayName).toBe("Acme Coach");
  });

  // ── Tenant isolation: every data route gets a cross-tenant test (CLAUDE.md §4) ──────────────────────────────────
  it("Globex can't see or touch Acme's data", async () => {
    expect(await P.listProcesses(globex.id)).toEqual([]);
    expect(await P.publishedBundle(globex.id)).toEqual([]);
    expect(await O.listBrandDocs(globex.id)).toEqual([]);
    expect(await I.learnerTable(globex.id)).toEqual([]);
    expect((await O.listPeople(globex.id)).map((p) => p.email)).toEqual(["admin@globex.test"]);
    const acmeProc = (await P.listProcesses(acme.id))[0]!;
    expect(await P.getProcess(globex.id, acmeProc.id)).toBeNull();
    expect(await P.saveDraft(globex.id, globexAdmin.id, acmeProc.id, demo as Process)).toEqual({ error: "That coach no longer exists." });
    expect(await P.publish(globex.id, globexAdmin.id, acmeProc.id, ["localhost:4310"])).toMatchObject({ ok: false });
    expect(await O.getOrg(acme.id)).not.toBeNull();
    // A run for Acme's coach recorded under Globex finds nothing.
    expect(await R.recordRun(globex.id, globexAdmin.id, { runId: crypto.randomUUID(), processId: "demo-change-owner", version: 1, startedAt: new Date().toISOString(), status: "completed", steps: [] })).toEqual({ error: "Unknown coach or version." });
  });

  it("RLS blocks raw cross-org writes even if app code forgets a filter", async () => {
    await expect(withOrg(globex.id, (tx) => tx`insert into brand_docs (org_id, name, kind, body) values (${acme.id}, 'x.md', 'style', 'x')`)).rejects.toThrow(/row-level security/);
    const n = await withOrg(globex.id, async (tx) => (await tx`update processes set title = 'pwned' returning id`).length);
    expect(n).toBe(0);
    const seen = await withOrg(globex.id, async (tx) => (await tx`select id from orgs`).length);
    expect(seen).toBe(1);
    // No org context at all: nothing is visible.
    expect(await system(async () => 1)).toBe(1);
    const none = await (await import("./client.ts")).db().begin(async (tx) => (await tx`select id from processes`).length);
    expect(none).toBe(0);
  });
});
