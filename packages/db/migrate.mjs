// node --experimental-strip-types packages/db/migrate.mjs: migrate DATABASE_URL_UNPOOLED (or DATABASE_URL).
// Skips quietly when no database is configured (e.g. local builds).
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.log("migrate: no DATABASE_URL, skipping"); process.exit(0); }
const { migrate } = await import("./src/migrate.ts");
const applied = await migrate(url, (s) => console.log("migrate:", s));
console.log(applied.length ? `migrate: ${applied.length} applied` : "migrate: up to date");
