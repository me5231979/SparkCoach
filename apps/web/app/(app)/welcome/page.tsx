import { themeOf } from "@spark/core";
import { requireCtx } from "../../../lib/session";

export default async function Welcome() {
  const c = await requireCtx();
  const name = themeOf(c.org.branding).displayName;
  return (
    <>
      <h1>Get {name} in your browser</h1>
      <div className="card">
        <ol>
          <li>Install the Spark extension for Chrome or Edge (your IT team may have installed it already).</li>
          <li>Click the extension's icon to open the side panel, then <strong>Sign in</strong>. You'll come back here to confirm.</li>
          <li>Pick a process and click <strong>Start the coach</strong>. Do the work in your own system; the coach shows you where, checks you know why, and steps back as you learn.</li>
        </ol>
        <p className="muted">The coach reads labels and buttons to know where you are. It never reads what you type or what's on the record.</p>
      </div>
    </>
  );
}
