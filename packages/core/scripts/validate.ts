// npm run validate [files...]: validates process files against the schema and cross-references.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateProcess } from "../src/validate.ts";

const args = process.argv.slice(2);
const dir = "fixtures/processes";
const files = args.length ? args : readdirSync(dir).filter((f) => f.endsWith(".process.json")).map((f) => join(dir, f));
let bad = 0;
for (const f of files) {
  const r = validateProcess(JSON.parse(readFileSync(f, "utf8")));
  if (r.ok) console.log(`✔ ${f}`);
  else { bad++; console.error(`✖ ${f}\n  ${r.errors.join("\n  ")}`); }
}
process.exit(bad ? 1 : 0);
