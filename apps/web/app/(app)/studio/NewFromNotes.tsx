"use client";
// Draft a coach from anything the author has: notes, .md/.txt, captions, PDFs, Word, PowerPoint, screenshots and
// screen recordings. Videos are sampled into still frames in the browser (the video itself is never uploaded);
// add a captions file (.vtt/.srt) for the narration. Other files go straight to private storage, are converted
// on the server for the AI, then deleted.
import { upload } from "@vercel/blob/client";
import { useActionState, useRef, useState } from "react";
import { createFromNotes } from "./actions";

type Item = { id: string; name: string; kind: "text" | "upload" | "video"; status: string; file: File };
type Uploaded = { pathname: string; name: string; contentType: string };

const TEXT = /\.(md|markdown|txt|csv|vtt|srt)$/i;
const VIDEO = /\.(mp4|m4v|mov|webm)$/i;
const DOC: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
};
const ACCEPT = ".md,.markdown,.txt,.csv,.vtt,.srt,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,.gif,.mp4,.m4v,.mov,.webm";
const MAX_FRAMES = 24;

const ext = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Sample evenly spaced frames from a screen recording, as JPEGs (max 1280px wide). Runs in the browser. */
async function videoFrames(file: File, onProgress: (s: string) => void): Promise<{ blob: Blob; at: number }[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise<void>((ok, bad) => { v.onloadedmetadata = () => ok(); v.onerror = () => bad(new Error("This browser can't read that video. Try an MP4.")); });
    const d = v.duration;
    if (!isFinite(d) || d <= 0) throw new Error("That video has no length.");
    const n = Math.min(MAX_FRAMES, Math.max(4, Math.ceil(d / 5)));
    const scale = Math.min(1, 1280 / (v.videoWidth || 1280));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((v.videoWidth || 1280) * scale); canvas.height = Math.round((v.videoHeight || 720) * scale);
    const g = canvas.getContext("2d")!;
    const out: { blob: Blob; at: number }[] = [];
    for (let i = 0; i < n; i++) {
      const at = Math.min(d - 0.1, (d * (i + 0.5)) / n);
      await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = at; });
      g.drawImage(v, 0, 0, canvas.width, canvas.height);
      out.push({ blob: await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", 0.8)), at });
      onProgress(`frames ${i + 1}/${n}`);
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

export function NewFromNotes({ systems, orgId }: { systems: string[]; orgId: string }) {
  const [state, action, pending] = useActionState(createFromNotes, null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const uploadedRef = useRef<HTMLInputElement>(null);
  const textsRef = useRef<HTMLInputElement>(null);
  const prepared = useRef(false); // set once files are uploaded, so the re-submit goes straight to the server

  const add = (files: FileList | File[]) => {
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      const kind = TEXT.test(f.name) ? "text" : VIDEO.test(f.name) ? "video" : DOC[ext(f.name)] ? "upload" : null;
      if (!kind) { setErr(`${f.name}: that file type isn't supported. Use PDF, Word, PowerPoint, images, video, .md or .txt.`); continue; }
      if (kind === "upload" && f.size > 30 * 1024 * 1024) { setErr(`${f.name} is over 30 MB. Split it or export a smaller copy.`); continue; }
      next.push({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, kind, status: "ready", file: f });
    }
    setItems((cur) => [...cur, ...next]);
  };
  const setStatus = (id: string, status: string) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, status } : x)));

  /** Upload/convert everything, then submit the draft request with references and text. */
  const prepareAndSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (prepared.current) { prepared.current = false; return; } // files done: submit to the server action
    if (!items.length) return; // nothing to prepare: let the form submit as-is
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const uploaded: Uploaded[] = [];
      const texts: { name: string; text: string }[] = [];
      for (const it of items) {
        if (it.kind === "text") { texts.push({ name: it.name, text: await it.file.text() }); setStatus(it.id, "read"); continue; }
        if (it.kind === "upload") {
          setStatus(it.id, "uploading…");
          const ct = DOC[ext(it.name)]!;
          const b = await upload(`orgs/${orgId}/sources/${it.name.replace(/[^\w.-]+/g, "_")}`, it.file, { access: "private", handleUploadUrl: "/api/studio/upload", contentType: ct });
          uploaded.push({ pathname: b.pathname, name: it.name, contentType: ct });
          setStatus(it.id, "uploaded"); continue;
        }
        const frames = await videoFrames(it.file, (s) => setStatus(it.id, s));
        for (const [i, f] of frames.entries()) {
          const b = await upload(`orgs/${orgId}/sources/${it.name.replace(/[^\w.-]+/g, "_")}-frame${i + 1}.jpg`, f.blob, { access: "private", handleUploadUrl: "/api/studio/upload", contentType: "image/jpeg" });
          uploaded.push({ pathname: b.pathname, name: `${it.name} at ${mmss(f.at)}`, contentType: "image/jpeg" });
          setStatus(it.id, `uploaded ${i + 1}/${frames.length} frames`);
        }
      }
      uploadedRef.current!.value = JSON.stringify(uploaded);
      textsRef.current!.value = JSON.stringify(texts);
      setBusy(false);
      prepared.current = true;
      formRef.current!.requestSubmit(); // goes to the server action, now without the files
      setItems([]);
    } catch (x) {
      setBusy(false);
      setErr(x instanceof Error ? x.message : "An upload failed. Try again.");
    }
  };

  const working = busy || pending;
  return (
    <form ref={formRef} action={action} onSubmit={prepareAndSubmit} className="card">
      <h2 style={{ marginTop: 0 }}>Draft a coach with AI</h2>
      <p className="muted">Add whatever you have: notes, a job aid, slides, a PDF, screenshots or a screen recording. The AI drafts the steps, why each one matters and how the coach knows it's done, in your brand voice. You review and edit before anything goes live.</p>
      {(err || state?.error) && <p className="error" role="alert">{err ?? state?.error}</p>}
      <input ref={uploadedRef} type="hidden" name="uploaded" defaultValue="[]" />
      <input ref={textsRef} type="hidden" name="texts" defaultValue="[]" />
      <div className="grid2">
        <div><label htmlFor="title">Process name (optional)</label><input id="title" name="title" placeholder="e.g. Approve a supplier invoice" /></div>
        <div>
          <label>Runs on</label>
          {systems.length ? systems.map((s) => <label key={s} className="row" style={{ fontWeight: 400 }}><input type="checkbox" name="systems" value={s} defaultChecked /> {s}</label>)
            : <p className="warn">No approved systems yet. An admin adds them under <a href="/settings">Settings</a>.</p>}
        </div>
      </div>

      <label>Files</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        style={{ border: `2px dashed ${drag ? "var(--accent)" : "var(--line)"}`, borderRadius: 10, padding: 16, textAlign: "center", background: drag ? "var(--surface)" : "transparent" }}>
        <p style={{ margin: "0 0 8px" }}>Drop files here, or</p>
        <label className="btn" style={{ margin: 0, fontWeight: 400 }}>Choose files
          <input type="file" multiple accept={ACCEPT} hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="muted" style={{ margin: "8px 0 0" }}>PDF, Word, PowerPoint, screenshots (PNG/JPG), screen recordings (MP4/MOV/WebM), .md, .txt, captions (.vtt/.srt). Up to 30 MB each.
          Videos: Spark takes still frames in your browser and never uploads the video; add its captions file for the narration.</p>
      </div>
      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((it) => (
            <li key={it.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <span>{it.kind === "video" ? "🎬" : it.kind === "text" ? "📝" : "📄"} {it.name}</span>
              <span className="row"><span className="muted">{it.status}</span>{!working && <button type="button" aria-label={`Remove ${it.name}`} onClick={() => setItems(items.filter((x) => x.id !== it.id))}>✕</button>}</span>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor="notes">Notes (optional if you added files)</label>
      <textarea id="notes" name="notes" rows={6} placeholder="Anything else the AI should know: who does this, rules to follow, common mistakes…" />
      <p><button className="primary" disabled={working || !systems.length}>{busy ? "Preparing files…" : pending ? "Drafting… (a minute or two)" : "Draft the coach"}</button></p>
    </form>
  );
}
