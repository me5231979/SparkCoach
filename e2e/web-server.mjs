// Starts the Spark web app for the platform e2e: a fresh Postgres database, migrations, then `next start`.
// Needs SPARK_TEST_DATABASE_URL (superuser) and a prior `next build` in apps/web.
import { spawn } from "node:child_process";
import postgres from "postgres";

const admin = process.env.SPARK_TEST_DATABASE_URL;
if (!admin) { console.error("SPARK_TEST_DATABASE_URL is required for the platform e2e"); process.exit(1); }
const name = "spark_e2e";
const sql = postgres(admin, { max: 1, onnotice: () => undefined });
await sql.unsafe(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`);
await sql.unsafe(`drop database if exists ${name}`);
await sql.unsafe(`create database ${name}`);
await sql.end();
const url = new URL(admin); url.pathname = `/${name}`;
const { migrate } = await import("../packages/db/src/migrate.ts");
await migrate(url.toString());

const child = spawn("npx", ["next", "start", "-p", "3100"], {
  cwd: "apps/web", stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url.toString(), SPARK_SETUP_CODE: "e2e-setup-code", SPARK_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"), NODE_ENV: "production" },
});
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { child.kill(); process.exit(0); });
