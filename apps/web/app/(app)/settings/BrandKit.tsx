"use client";
// White label: product name, logo, light color changes (with live preview and contrast check), and .md brand files.
import { checkBranding, contrast, themeOf, type Branding, type BrandDoc } from "@spark/core";
import { useState, useTransition } from "react";
import { removeDoc, saveBrand, saveDoc } from "./actions";

type Doc = BrandDoc & { id: string; updatedAt: string };
const KINDS: { v: BrandDoc["kind"]; label: string; hint: string }[] = [
  { v: "voice", label: "Voice & tone", hint: "How the coach sounds: warm, brief, formal…" },
  { v: "glossary", label: "Glossary", hint: "Your terms: \"associate\" not \"employee\", system names…" },
  { v: "style", label: "Writing style", hint: "Formatting and wording rules for every step." },
  { v: "reference", label: "Reference", hint: "Background the coach can quote in Ask (policies, FAQs)." },
];

export function BrandKit({ initial, docs }: { initial: Branding; docs: Doc[] }) {
  const [b, setB] = useState<Branding>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const t = themeOf(b);
  const check = checkBranding(b);

  const onLogo = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 200 * 1024) { setMsg({ error: "The logo must be 200 KB or smaller." }); return; }
    const url = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f); });
    setB({ ...b, logo: url });
  };

  return (
    <>
      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Look</h3>
          <label htmlFor="dn">Product name your people see</label>
          <input id="dn" value={b.displayName ?? ""} maxLength={40} placeholder="Spark" onChange={(e) => setB({ ...b, displayName: e.target.value })} />
          <label htmlFor="logo">Logo (PNG, SVG, WebP or JPEG, up to 200 KB)</label>
          <div className="row">
            <input id="logo" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} style={{ flex: 1 }} />
            {b.logo && <button type="button" onClick={() => { const { logo: _l, ...rest } = b; setB(rest); }}>Remove</button>}
          </div>
          <div className="grid2">
            <div><label htmlFor="ac">Accent color</label><div className="row"><input id="ac" type="color" value={t.accent} onChange={(e) => setB({ ...b, accent: e.target.value })} /><code>{t.accent}</code></div></div>
            <div><label htmlFor="ai">Text on accent</label><div className="row"><input id="ai" type="color" value={t.accentInk} onChange={(e) => setB({ ...b, accentInk: e.target.value })} /><code>{t.accentInk}</code></div></div>
            <div><label htmlFor="sf">Background tint</label><div className="row"><input id="sf" type="color" value={t.surface} onChange={(e) => setB({ ...b, surface: e.target.value })} /><code>{t.surface}</code></div></div>
            <div><label>Readability</label><p className="muted">Button text {contrast(t.accent, t.accentInk).toFixed(1)}:1 (needs 4.5)</p></div>
          </div>
          {!check.ok && <ul className="error">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {msg.error && <p className="error" role="alert">{msg.error}</p>}
          {msg.ok && <p className="ok" role="status">{msg.ok}</p>}
          <div className="row">
            <button className="primary" disabled={pending || !check.ok} onClick={() => start(async () => { const r = await saveBrand(b); setMsg(r.error ? { error: r.error } : { ok: "Brand saved. Studio and the extension use it now." }); })}>Save brand</button>
            <button type="button" onClick={() => setB({})}>Reset to Spark defaults</button>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Preview: the side panel</h3>
          <div className="preview" style={{ background: t.surface, color: "#14161c" }}>
            <div className="row" style={{ fontWeight: 700 }}>
              {t.logo ? <img src={t.logo} alt="" style={{ height: 24 }} /> : <span style={{ color: t.accent }}>✦</span>} {t.displayName}
            </div>
            <p style={{ margin: "10px 0 4px", fontSize: 13, color: "#5d6170" }}>Step 2 of 6 · Approve an invoice</p>
            <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Click Approve.</p>
            <span style={{ display: "inline-flex", gap: 3 }}>{[1, 2, 3, 4].map((n) => <i key={n} style={{ width: 14, height: 6, borderRadius: 3, background: n <= 2 ? t.accent : "#e2e4ea" }} />)}</span>
            <p><button style={{ background: t.accent, color: t.accentInk, borderColor: t.accent }}>Start the coach</button></p>
            <p style={{ fontSize: 12, color: "#5d6170", margin: 0 }}>The spotlight ring on the page uses the accent color too.</p>
          </div>
        </div>
      </div>
      <BrandDocs docs={docs} />
    </>
  );
}

function BrandDocs({ docs }: { docs: Doc[] }) {
  const [editing, setEditing] = useState<{ name: string; kind: BrandDoc["kind"]; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upload = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const body = await f.text();
      const lower = f.name.toLowerCase();
      const kind: BrandDoc["kind"] = lower.includes("gloss") ? "glossary" : lower.includes("voice") || lower.includes("tone") ? "voice" : lower.includes("style") ? "style" : "reference";
      start(async () => { const r = await saveDoc({ name: f.name, kind, body }); setError(r.error ?? null); });
    }
  };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Brand files (.md)</h3>
      <p className="muted">Upload Markdown files that tell the AI how to write for your company. They shape every coach the AI drafts in Studio and every answer in Ask. They can't override Spark's rules (grounding, privacy).</p>
      {error && <p className="error" role="alert">{error}</p>}
      <table>
        <thead><tr><th>File</th><th>Used as</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          {docs.length ? docs.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td><td>{KINDS.find((k) => k.v === d.kind)?.label}</td><td className="muted">{new Date(d.updatedAt).toLocaleDateString()}</td>
              <td className="row">
                <button onClick={() => setEditing({ name: d.name, kind: d.kind, body: d.body })}>Edit</button>
                <button onClick={() => { const blob = new Blob([d.body], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = d.name; a.click(); }}>Download</button>
                <button className="danger" onClick={() => start(() => removeDoc(d.id))}>Delete</button>
              </td>
            </tr>
          )) : <tr><td colSpan={4} className="muted">No brand files yet.</td></tr>}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="btn" style={{ margin: 0, fontWeight: 400 }}>Upload .md files<input type="file" accept=".md,.markdown,text/markdown" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
        <button onClick={() => setEditing({ name: "voice.md", kind: "voice", body: "# Voice and tone\n\n- Warm, direct, second person.\n- Short sentences.\n" })}>Write one here</button>
      </div>
      {editing && (
        <div className="card">
          <div className="grid2">
            <div><label htmlFor="bn">File name</label><input id="bn" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label htmlFor="bk">Used as</label><select id="bk" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as BrandDoc["kind"] })}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select>
              <p className="muted">{KINDS.find((k) => k.v === editing.kind)?.hint}</p></div>
          </div>
          <label htmlFor="bb">Markdown</label>
          <textarea id="bb" rows={14} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          <div className="row">
            <button className="primary" disabled={pending} onClick={() => start(async () => { const r = await saveDoc(editing); if (r.error) setError(r.error); else { setError(null); setEditing(null); } })}>Save file</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
