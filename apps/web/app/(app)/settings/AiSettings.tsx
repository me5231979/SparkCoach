"use client";
import { useState, useTransition } from "react";
import { saveAi, testAi } from "./actions";

export function AiSettings({ keyHint, model, models, managed, encryption }: { keyHint: string | null; model: string | null; models: string[]; managed: boolean; encryption: boolean }) {
  const [key, setKey] = useState("");
  const [m, setM] = useState(model ?? models[0]!);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <p className="muted">Spark uses your company's own AI account, so AI usage is billed to you by the AI provider. Your key is encrypted and never shown again.
        {managed && " Your plan includes Managed AI: until you add a key, Spark uses the AI account of the team that runs it."}</p>
      {!encryption && <p className="error">This Spark can't store keys yet (SPARK_ENCRYPTION_KEY isn't set). Ask the people who run it.</p>}
      <div className="grid2">
        <div><label htmlFor="ak">Anthropic API key {keyHint && <span className="muted">(current: {keyHint})</span>}</label>
          <input id="ak" type="password" autoComplete="off" value={key} placeholder={keyHint ? "Leave blank to keep the current key" : "sk-ant-…"} onChange={(e) => setKey(e.target.value)} /></div>
        <div><label htmlFor="am">Model</label><select id="am" value={m} onChange={(e) => setM(e.target.value)}>{models.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      {msg.error && <p className="error" role="alert">{msg.error}</p>}
      {msg.ok && <p className="ok" role="status">{msg.ok}</p>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" disabled={pending || !encryption} onClick={() => start(async () => { const r = await saveAi({ key, model: m }); setMsg(r.error ? { error: r.error } : { ok: "Saved." }); if (!r.error) setKey(""); })}>Save</button>
        <button disabled={pending} onClick={() => start(async () => { const r = await testAi(); setMsg(r.error ? { error: r.error } : { ok: "The key works." }); })}>Test</button>
        {keyHint && <button className="danger" disabled={pending} onClick={() => start(async () => { const r = await saveAi({ key: null }); setMsg(r.error ? { error: r.error } : { ok: "Key removed." }); })}>Remove key</button>}
      </div>
    </div>
  );
}
