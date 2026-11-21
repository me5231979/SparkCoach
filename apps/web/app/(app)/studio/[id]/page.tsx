import { notFound } from "next/navigation";
import { getProcess, versions } from "@spark/db";
import { validateProcess } from "@spark/core/validate";
import { requireCtx } from "../../../../lib/session";
import { archiveAction, restoreAction } from "../actions";
import { Editor } from "./Editor";

export default async function EditCoach({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ drafted?: string }> }) {
  const c = await requireCtx("author");
  const { id } = await params;
  const { drafted } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await getProcess(c.org.id, id);
  if (!p) notFound();
  const v = validateProcess(p.draft);
  const history = await versions(c.org.id, id);
  return (
    <>
      <p><a href="/studio">← All coaches</a></p>
      {drafted && <p className="ok" role="status">The AI drafted this coach. Check every step against the real system, fix names and checks, then publish.</p>}
      <Editor id={id} initial={p.draft} initialErrors={v.ok ? [] : v.errors} systems={c.org.approvedDomains} status={p.status} version={p.latestVersion} />
      <h2>Versions</h2>
      {history.length ? (
        <table><thead><tr><th>Version</th><th>Published</th><th>By</th><th></th></tr></thead><tbody>
          {history.map((h) => (
            <tr key={h.version}><td>v{h.version}</td><td className="muted">{h.published_at.toLocaleString()}</td><td>{h.by ?? "-"}</td>
              <td><form action={restoreAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={h.version} /><button>Load into draft</button></form></td></tr>
          ))}
        </tbody></table>
      ) : <p className="muted">Not published yet.</p>}
      <form action={archiveAction} style={{ marginTop: 24 }}><input type="hidden" name="id" value={id} /><button className="danger">Archive this coach</button></form>
    </>
  );
}
