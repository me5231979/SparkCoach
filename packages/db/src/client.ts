// Postgres access. Every query runs inside a transaction that sets the org context, so row-level security
// scopes it to one customer. `system()` is for the few paths that must look across orgs (sign-in, session
// lookup, operator tools) and is used deliberately and sparingly.
import postgres from "postgres";

export type Tx = postgres.TransactionSql;
let client: postgres.Sql | null = null;

export function db(): postgres.Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare: false works with Neon's pooled (transaction-mode) connections.
  client = postgres(url, { max: 5, idle_timeout: 20, prepare: false, onnotice: () => undefined });
  return client;
}

/** For tests: point at another database. */
export function setClient(sql: postgres.Sql | null) { client = sql; }

export function withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`set local role spark_rls`;
    await tx`select set_config('app.org_id', ${orgId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

export function system<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`set local role spark_rls`;
    await tx`select set_config('app.bypass', 'on', true)`;
    return fn(tx);
  }) as Promise<T>;
}
