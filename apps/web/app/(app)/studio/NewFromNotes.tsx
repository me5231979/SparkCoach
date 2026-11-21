"use client";
import { useActionState, useRef } from "react";
import { createFromNotes } from "./actions";

export function NewFromNotes({ systems }: { systems: string[] }) {
  const [state, action, pending] = useActionState(createFromNotes, null);
  const file = useRef<HTMLTextAreaElement>(null);
  return (
    <form action={action} className="card">
      <h2 style={{ marginTop: 0 }}>Draft a coach with AI</h2>
      <p className="muted">Paste your notes, a job aid or a .md file. The AI drafts the steps, why each one matters and how the coach knows it's done, in your brand voice. You review and edit before anything goes live.</p>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <div className="grid2">
        <div><label htmlFor="title">Process name (optional)</label><input id="title" name="title" placeholder="e.g. Approve a supplier invoice" /></div>
        <div>
          <label>Runs on</label>
          {systems.length ? systems.map((s) => <label key={s} className="row" style={{ fontWeight: 400 }}><input type="checkbox" name="systems" value={s} defaultChecked /> {s}</label>)
            : <p className="warn">No approved systems yet. An admin adds them under Settings.</p>}
        </div>
      </div>
      <label htmlFor="notes">Notes or job aid</label>
      <textarea ref={file} id="notes" name="notes" required rows={10} placeholder="1. Open the invoice from the Invoices list..." />
      <div className="row">
        <label className="btn" style={{ margin: 0, fontWeight: 400 }}>Load a .md or .txt file
          <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (f && file.current) file.current.value = await f.text();
          }} />
        </label>
        <button className="primary" disabled={pending || !systems.length}>{pending ? "Drafting… (about a minute)" : "Draft the coach"}</button>
      </div>
    </form>
  );
}
