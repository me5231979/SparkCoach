// npm run fixtures: serves every mock app used by CI.
import { start } from "./apps/records-app/server.mjs";
await start(4310);
console.log("Records fixture app → http://localhost:4310/records");
