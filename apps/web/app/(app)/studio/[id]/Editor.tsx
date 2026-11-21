"use client";
// The coach editor: every field of a Spark process without touching JSON (an Advanced view is there if needed).
import type { Callout, Check, Process, ScreenStep, Step, Target } from "@spark/core";
import { useState, useTransition } from "react";
import { publishAction, saveAction } from "../actions";

const ROLES = ["button", "link", "textbox", "combobox", "checkbox", "radio", "tab", "menuitem", "option", "dialog"];
const CHECKS: { v: string; label: string }[] = [
  { v: "", label: "Learner confirms (\"I did it\")" },
  { v: "urlMatches", label: "The page changes (URL path)" },
  { v: "elementVisible", label: "Something appears (e.g. a dialog)" },
  { v: "elementGone", label: "Something closes" },
  { v: "textPresent", label: "A confirmation message shows" },
  { v: "fieldValue", label: "A field is filled / set" },
  { v: "clicked", label: "The target is clicked" },
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function TargetFields({ t, onChange, idp }: { t: Target; onChange: (t: Target) => void; idp: string }) {
  const set = (k: keyof Target, v: string) => {
    const n: Target = { ...t };
    if (k === "context") { const arr = v.split(">").map((x) => x.trim()).filter(Boolean); if (arr.length) n.context = arr; else delete n.context; }
    else if (v) (n as Record<string, unknown>)[k] = k === "nth" ? Number(v) : v; else delete n[k];
    onChange(n);
  };
  return (
    <div className="grid2">
      <div><label htmlFor={`${idp}r`}>Kind of element</label>
        <select id={`${idp}r`} value={t.role ?? ""} onChange={(e) => set("role", e.target.value)}><option value="">(field by label)</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
      <div><label htmlFor={`${idp}n`}>Its name as shown (buttons, links)</label><input id={`${idp}n`} value={t.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
      <div><label htmlFor={`${idp}l`}>Field label (fields)</label><input id={`${idp}l`} value={t.label ?? ""} onChange={(e) => set("label", e.target.value)} /></div>
      <div><label htmlFor={`${idp}c`}>Inside section (use &gt; between levels)</label><input id={`${idp}c`} value={(t.context ?? []).join(" > ")} onChange={(e) => set("context", e.target.value)} placeholder="Managers > Edit" /></div>
    </div>
  );
}

function CheckFields({ check, target, onChange, idp }: { check: Check | undefined; target: Target; onChange: (c: Check | undefined) => void; idp: string }) {
  const kind = check?.type ?? "";
  const pick = (k: string) => {
    switch (k) {
      case "": return onChange(undefined);
      case "urlMatches": return onChange({ type: "urlMatches", pattern: "" });
      case "textPresent": return onChange({ type: "textPresent", text: "" });
      case "fieldValue": return onChange({ type: "fieldValue", target, notEmpty: true });
      case "elementVisible": case "elementGone": case "clicked": return onChange({ type: k, target });
    }
  };
  return (
    <>
      <label htmlFor={`${idp}k`}>How the coach knows it's done</label>
      <select id={`${idp}k`} value={kind === "all" || kind === "any" ? "" : kind} onChange={(e) => pick(e.target.value)}>{CHECKS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
      {check?.type === "urlMatches" && <><label htmlFor={`${idp}p`}>URL path pattern</label><input id={`${idp}p`} value={check.pattern} onChange={(e) => onChange({ ...check, pattern: e.target.value })} placeholder="^/records/[^/]+$" /><p className="muted">Matched against the path only, never the query string.</p></>}
      {check?.type === "textPresent" && <><label htmlFor={`${idp}t`}>Exact confirmation wording (no personal data)</label><input id={`${idp}t`} value={check.text} onChange={(e) => onChange({ ...check, text: e.target.value })} placeholder="Change submitted" /></>}
      {check?.type === "fieldValue" && (
        <div className="grid2">
          <div><label htmlFor={`${idp}fl`}>Field label</label><input id={`${idp}fl`} value={check.target.label ?? ""} onChange={(e) => onChange({ ...check, target: { ...check.target, label: e.target.value } })} /></div>
          <div><label htmlFor={`${idp}fv`}>Must equal (a fixed option, or blank for "filled in")</label>
            <input id={`${idp}fv`} value={check.equals ?? ""} onChange={(e) => { const { equals: _e, notEmpty: _n, matches: _m, ...rest } = check; onChange(e.target.value ? { ...rest, equals: e.target.value } : { ...rest, notEmpty: true }); }} /></div>
        </div>
      )}
      {(check?.type === "elementVisible" || check?.type === "elementGone" || check?.type === "clicked") && (
        <><p className="muted">Which element:</p><TargetFields t={check.target} onChange={(t) => onChange({ ...check, target: t })} idp={`${idp}ct`} /></>
      )}
      {(kind === "all" || kind === "any") && <p className="muted">This step uses a combined check. Edit it in Advanced.</p>}
    </>
  );
}

function StepCard({ step, i, n, update, move, remove }: { step: Step; i: number; n: number; update: (s: Step) => void; move: (d: -1 | 1) => void; remove: () => void }) {
  const idp = `s${i}`;
  const setType = (type: Step["type"]) => {
    const base = { id: step.id, title: step.title, instruction: step.instruction, ...(step.why ? { why: step.why } : {}) };
    if (type === "screen") update({ ...base, type, target: { role: "button", name: "" } });
    else if (type === "call") update({ ...base, type, contactRef: "", prep: { goal: "", opener: "" }, debrief: { rubricRef: "" } });
    else update({ ...base, type, confirm: "Done" });
  };
  const s = step as ScreenStep;
  return (
    <section className="step" aria-label={`Step ${i + 1}`}>
      <header>
        <strong>Step {i + 1}</strong>
        <select aria-label="Step type" value={step.type} onChange={(e) => setType(e.target.value as Step["type"])} style={{ width: "auto" }}>
          <option value="screen">On screen</option><option value="checkpoint">Stop and check</option><option value="offline">Off screen</option>
        </select>
        <button type="button" onClick={() => move(-1)} disabled={i === 0} aria-label="Move up">↑</button>
        <button type="button" onClick={() => move(1)} disabled={i === n - 1} aria-label="Move down">↓</button>
        <button type="button" className="danger" onClick={remove} aria-label="Delete step">✕</button>
      </header>
      <div className="grid2">
        <div><label htmlFor={`${idp}t`}>Title</label><input id={`${idp}t`} value={step.title} maxLength={120} onChange={(e) => update({ ...step, title: e.target.value })} /></div>
        <div><label htmlFor={`${idp}w`}>Why it matters</label><input id={`${idp}w`} value={step.why ?? ""} maxLength={300} onChange={(e) => update({ ...step, why: e.target.value || undefined } as Step)} /></div>
      </div>
      <label htmlFor={`${idp}i`}>Instruction ({step.instruction.length}/200)</label>
      <input id={`${idp}i`} value={step.instruction} maxLength={200} onChange={(e) => update({ ...step, instruction: e.target.value })} />
      {step.type === "screen" ? (
        <>
          <div className="grid2">
            <div><label htmlFor={`${idp}wh`}>Where to look</label><input id={`${idp}wh`} value={s.where ?? ""} onChange={(e) => update({ ...s, where: e.target.value || undefined })} /></div>
            <div><label htmlFor={`${idp}ex`}>What they see when it worked</label><input id={`${idp}ex`} value={s.expect ?? ""} onChange={(e) => update({ ...s, expect: e.target.value || undefined })} /></div>
          </div>
          <h3>What to highlight</h3>
          <TargetFields t={s.target} onChange={(t) => update({ ...s, target: t })} idp={`${idp}tg`} />
          <CheckFields check={s.check} target={s.target} onChange={(c) => { const { check: _c, ...rest } = s; update(c ? { ...rest, check: c } : rest); }} idp={`${idp}ck`} />
          <label htmlFor={`${idp}m`}>Common mistake: wrong button's name (optional)</label>
          <div className="grid2">
            <input id={`${idp}m`} value={s.commonMistakes?.[0]?.when.clicked.name ?? ""} placeholder="e.g. Edit Details"
              onChange={(e) => { const say = s.commonMistakes?.[0]?.say ?? ""; const { commonMistakes: _m, ...rest } = s; update(e.target.value ? { ...rest, commonMistakes: [{ when: { clicked: { role: "button", name: e.target.value } }, say }] } : rest); }} />
            <input aria-label="What the coach says" value={s.commonMistakes?.[0]?.say ?? ""} placeholder="What the coach says"
              disabled={!s.commonMistakes?.length} onChange={(e) => update({ ...s, commonMistakes: [{ ...s.commonMistakes![0]!, say: e.target.value }] })} />
          </div>
        </>
      ) : step.type === "checkpoint" || step.type === "offline" ? (
        <><label htmlFor={`${idp}cf`}>Confirm button label</label><input id={`${idp}cf`} value={step.confirm} onChange={(e) => update({ ...step, confirm: e.target.value })} /></>
      ) : <p className="muted">Conversation steps are edited in Advanced.</p>}
    </section>
  );
}

export function Editor({ id, initial, initialErrors, systems, status, version }: { id: string; initial: Process; initialErrors: string[]; systems: string[]; status: string; version: number }) {
  const [p, setP] = useState<Process>(initial);
  const [errors, setErrors] = useState<string[]>(initialErrors);
  const [note, setNote] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [raw, setRaw] = useState("");
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const change = (n: Process) => { setP(n); setDirty(true); setNote(null); };
  const updateStep = (i: number, s: Step) => change({ ...p, steps: p.steps.map((x, j) => (j === i ? s : x)) });
  const move = (i: number, d: -1 | 1) => { const steps = [...p.steps]; const [s] = steps.splice(i, 1); steps.splice(i + d, 0, s!); change({ ...p, steps }); };
  const addStep = () => {
    let sid = `step-${p.steps.length + 1}`; while (p.steps.some((s) => s.id === sid)) sid += "x";
    change({ ...p, steps: [...p.steps, { id: sid, type: "screen", title: "New step", instruction: "Click …", target: { role: "button", name: "" } }] });
  };
  // Step ids follow titles until the coach is first published (learner records refer to ids afterwards).
  const normalised = (): Process => version > 0 ? p : { ...p, steps: p.steps.map((s, i) => ({ ...s, id: slug(s.title) && !p.steps.slice(0, i).some((x) => slug(x.title) === slug(s.title)) ? slug(s.title) : s.id })) };
  const callouts = p.callouts ?? [];
  const setCallouts = (c: Callout[]) => change({ ...p, callouts: c.length ? c : undefined } as Process);

  const save = () => start(async () => { const r = await saveAction(id, normalised()); setErrors(r.errors); setDirty(false); setNote(r.errors.length ? null : "Saved."); });
  const pub = () => start(async () => { const r = await publishAction(id, normalised()); setErrors(r.errors); if (r.version) { setDirty(false); setNote(`Published v${r.version}. Learners get it on their next run.`); } });

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{p.title || "Untitled coach"}</h1>
        <span className={`pill ${status === "published" ? "live" : ""}`}>{status === "published" ? `Live v${version}` : "Draft"}</span>
      </div>
      <div className="row" style={{ position: "sticky", top: 0, background: "var(--surface)", padding: "10px 0", zIndex: 1 }}>
        <button onClick={save} disabled={pending}>{pending ? "Working…" : dirty ? "Save draft" : "Saved"}</button>
        <button className="primary" onClick={pub} disabled={pending}>Publish</button>
        <button onClick={() => { setAdvanced(!advanced); setRaw(JSON.stringify(p, null, 2)); }}>{advanced ? "Back to editor" : "Advanced (JSON)"}</button>
      </div>
      {note && <p className="ok" role="status">{note}</p>}
      {errors.length > 0 && <div className="error" role="alert"><strong>Fix these before publishing:</strong><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}

      {advanced ? (
        <div className="card">
          <textarea aria-label="Coach JSON" value={raw} rows={30} onChange={(e) => setRaw(e.target.value)} />
          <button onClick={() => { try { change(JSON.parse(raw)); setAdvanced(false); } catch { setErrors(["That isn't valid JSON."]); } }}>Apply</button>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="grid2">
              <div><label htmlFor="title">Title</label><input id="title" value={p.title} maxLength={120} onChange={(e) => change({ ...p, title: e.target.value })} /></div>
              <div><label htmlFor="dept">Department</label><input id="dept" value={p.department ?? ""} onChange={(e) => change({ ...p, department: e.target.value || undefined } as Process)} /></div>
            </div>
            <label htmlFor="goal">Goal: what the learner will be able to do</label><input id="goal" value={p.goal} maxLength={400} onChange={(e) => change({ ...p, goal: e.target.value })} />
            <div className="grid2">
              <div><label htmlFor="mins">Minutes it takes</label><input id="mins" type="number" min={1} max={600} value={p.estimatedMinutes ?? ""} onChange={(e) => change({ ...p, estimatedMinutes: e.target.value ? Number(e.target.value) : undefined } as Process)} /></div>
              <div><label htmlFor="start">Starts on page (URL path, optional)</label><input id="start" value={p.startUrl ?? ""} onChange={(e) => change({ ...p, startUrl: e.target.value || undefined } as Process)} /></div>
            </div>
            <label>Runs on</label>
            {systems.map((s) => (
              <label key={s} className="row" style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={p.systems.includes(s)} onChange={(e) => change({ ...p, systems: e.target.checked ? [...p.systems, s] : p.systems.filter((x) => x !== s) })} /> {s}
              </label>
            ))}
            {p.systems.filter((s) => !systems.includes(s)).map((s) => <p key={s} className="warn">{s} isn't an approved system for your company.</p>)}
          </div>

          <h2>Steps</h2>
          {p.steps.map((s, i) => <StepCard key={`${i}-${s.id}`} step={s} i={i} n={p.steps.length} update={(x) => updateStep(i, x)} move={(d) => move(i, d)} remove={() => change({ ...p, steps: p.steps.filter((_, j) => j !== i) })} />)}
          <button onClick={addStep}>+ Add a step</button>

          <h2>Rules and tips</h2>
          {callouts.map((c, i) => (
            <div key={c.id} className="card grid2">
              <div><label htmlFor={`c${i}k`}>Kind</label><select id={`c${i}k`} value={c.kind} onChange={(e) => setCallouts(callouts.map((x, j) => (j === i ? { ...x, kind: e.target.value as Callout["kind"] } : x)))}><option value="rule">Rule</option><option value="tip">Tip</option><option value="warning">Warning</option></select></div>
              <div><label htmlFor={`c${i}s`}>Show on step</label><select id={`c${i}s`} value={c.when.step ?? ""} onChange={(e) => setCallouts(callouts.map((x, j) => (j === i ? { ...x, when: { step: e.target.value } } : x)))}>{p.steps.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
              <div><label htmlFor={`c${i}t`}>Text</label><input id={`c${i}t`} value={c.say} onChange={(e) => setCallouts(callouts.map((x, j) => (j === i ? { ...x, say: e.target.value } : x)))} /></div>
              <div><label htmlFor={`c${i}r`}>Source (policy, job aid)</label><input id={`c${i}r`} value={c.source ?? ""} onChange={(e) => setCallouts(callouts.map((x, j) => (j === i ? { ...x, source: e.target.value || undefined } : x)))} /></div>
              <div><button className="danger" onClick={() => setCallouts(callouts.filter((_, j) => j !== i))}>Remove</button></div>
            </div>
          ))}
          <button onClick={() => setCallouts([...callouts, { id: `rule-${Date.now().toString(36)}`, kind: "rule", say: "", when: { step: p.steps[0]?.id ?? "" } }])}>+ Add a rule or tip</button>

          <h2>Recap</h2>
          <div className="card">
            <label htmlFor="sum">Summary shown at the end</label><input id="sum" value={p.recap.summary} onChange={(e) => change({ ...p, recap: { ...p.recap, summary: e.target.value } })} />
            <label htmlFor="next">Next steps (one per line)</label>
            <textarea id="next" rows={3} style={{ fontFamily: "inherit" }} value={(p.recap.nextSteps ?? []).join("\n")} onChange={(e) => { const lines = e.target.value.split("\n"); change({ ...p, recap: { ...p.recap, nextSteps: lines.some((l) => l.trim()) ? lines : undefined } as Process["recap"] }); }} />
          </div>
        </>
      )}
    </div>
  );
}
