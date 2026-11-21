import { learnerTable, mostMissed, totals } from "@spark/db";
import { requireCtx } from "../../../lib/session";

export default async function Insight() {
  const c = await requireCtx("manager");
  const [rows, missed, t] = await Promise.all([learnerTable(c.org.id), mostMissed(c.org.id), totals(c.org.id)]);
  const ready = rows.filter((r) => r.ready).length;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Insight</h1>
        <a className="btn" href="/insight-export">Download CSV</a>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[["People", t.learners], ["Live coaches", t.coaches], ["Runs", t.runs], ["Able to do it alone", ready]].map(([l, v]) => (
          <div key={String(l)} className="card"><div className="stat">{v}</div><div className="muted">{l}</div></div>
        ))}
      </div>
      <h2>Who can do what</h2>
      <p className="muted">Independence: Guide 0%, Prompt 33%, On call 67%, Off 100%, averaged over the coach's on-screen steps. "Able alone" means every step at Off for two runs in a row.</p>
      <table>
        <thead><tr><th>Person</th><th>Coach</th><th>Runs</th><th>Last independence</th><th>Able alone</th><th>Last run</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={`${r.userId}-${r.process}`}>
              <td>{r.name}</td><td>{r.process}</td><td>{r.runs}</td><td>{r.lastIndependence ?? "-"}%</td>
              <td>{r.ready ? <span className="pill live">Yes</span> : <span className="pill">Not yet</span>}</td>
              <td className="muted">{r.lastRun ? new Date(r.lastRun).toLocaleDateString() : "-"}</td>
            </tr>
          )) : <tr><td colSpan={6} className="muted">No runs yet. Once people use the coaches, their progress shows here.</td></tr>}
        </tbody>
      </table>
      <h2>Where people get stuck</h2>
      <table>
        <thead><tr><th>Coach</th><th>Step</th><th>Misses</th><th>Miss rate</th></tr></thead>
        <tbody>
          {missed.length ? missed.map((m) => <tr key={`${m.title}-${m.step_id}`}><td>{m.title}</td><td>{m.step_id}</td><td>{m.misses}</td><td>{Math.round((100 * m.misses) / m.total)}%</td></tr>)
            : <tr><td colSpan={4} className="muted">No missed steps yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
