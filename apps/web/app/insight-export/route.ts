import { learnerTable } from "@spark/db";
import { ctx } from "../../lib/session";

const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

export async function GET() {
  const c = await ctx();
  if (!c || !c.can("manager")) return new Response("Sign in as a manager.", { status: 401 });
  const rows = await learnerTable(c.org.id);
  const csv = [["person", "coach", "runs", "last_independence", "able_alone", "last_run"], ...rows.map((r) => [r.name, r.process, r.runs, r.lastIndependence, r.ready ? "yes" : "no", r.lastRun])].map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="spark-insight.csv"`, "cache-control": "no-store" } });
}
