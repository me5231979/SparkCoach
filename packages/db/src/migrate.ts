// Applies migrations/*.sql in order, once each, inside a lock. Run at build time on Vercel and in tests.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function migrate(url: string, log: (s: string) => void = () => undefined): Promise<string[]> {
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const dir = join(import.meta.dirname, "../migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(4210)`;
      await tx`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
      const done = new Set((await tx<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
      for (const f of files) {
        if (done.has(f)) continue;
        await tx.unsafe(readFileSync(join(dir, f), "utf8"));
        await tx`insert into schema_migrations (name) values (${f})`;
        applied.push(f);
        log(`applied ${f}`);
      }
    });
  } finally {
    await sql.end();
  }
  return applied;
}
