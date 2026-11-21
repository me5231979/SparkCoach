import { listProcesses } from "@spark/db";
import { requireCtx } from "../../../lib/session";
import { createBlank } from "./actions";
import { NewFromNotes } from "./NewFromNotes";

// AI drafting from long documents and many screenshots can take a few minutes.
export const maxDuration = 300;

export default async function Studio({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const c = await requireCtx("author");
  const { error } = await searchParams;
  const list = await listProcesses(c.org.id);
  return (
    <>
      <h1>Studio</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <table>
        <thead><tr><th>Coach</th><th>Status</th><th>Version</th><th>Updated</th></tr></thead>
        <tbody>
          {list.length ? list.map((p) => (
            <tr key={p.id}>
              <td><a href={`/studio/${p.id}`}>{p.title}</a></td>
              <td><span className={`pill ${p.status === "published" ? "live" : ""}`}>{p.status === "published" ? "Live" : "Draft"}</span></td>
              <td>{p.latestVersion || "-"}</td>
              <td className="muted">{new Date(p.updatedAt).toLocaleDateString()}</td>
            </tr>
          )) : <tr><td colSpan={4} className="muted">No coaches yet. Draft one from your notes below.</td></tr>}
        </tbody>
      </table>
      <NewFromNotes systems={c.org.approvedDomains} orgId={c.org.id} />
      <form action={createBlank} className="card row">
        <label htmlFor="blank" style={{ margin: 0 }}>Or start blank</label>
        <input id="blank" name="title" placeholder="Process name" style={{ flex: 1 }} />
        <button>Create</button>
      </form>
    </>
  );
}
