// Side panel. Reads the run and levels from storage and sends intents to the worker. All text is plain,
// second person, one instruction at a time. Content is rendered as text only (never as HTML).
import { LEVELS, meterLabel, partState, stepsFor, type Level, type Levels, type Process, type ScreenStep, type Step } from "@spark/core";
import { useEffect, useMemo, useState } from "react";
import { processes } from "../lib/content.ts";
import { send } from "../lib/messages.ts";
import { runIndependence, type Run } from "../lib/run.ts";
import { K } from "../lib/store.ts";

function useStored<T>(key: string, fallback: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    void chrome.storage.local.get(key).then((r) => setV((r[key] as T | undefined) ?? fallback));
    const on = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && key in changes) setV((changes[key]!.newValue as T | undefined) ?? fallback);
    };
    chrome.storage.onChanged.addListener(on);
    return () => chrome.storage.onChanged.removeListener(on);
  }, [key]);
  return v;
}

export function App() {
  const run = useStored<Run | null>(K.run, null);
  const levels = useStored<Levels>(K.levels, {});
  const process = run ? processes().find((p) => p.id === run.processId) : undefined;
  return (
    <div className="app">
      <header className="top"><span className="mark" aria-hidden>✦</span> Spark</header>
      {run && process && run.status === "active" ? <Coach run={run} process={process} />
        : run && process && run.status === "complete" ? <Recap run={run} process={process} />
        : <List levels={levels} />}
    </div>
  );
}

function Meter({ level }: { level: Level }) {
  return (
    <span className="meter" role="img" aria-label={`Help level: ${LEVELS[level].name}`}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= level ? "on" : ""} />)}
      <span className="meter-name">{LEVELS[level].name}</span>
    </span>
  );
}

function List({ levels }: { levels: Levels }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<Record<string, string>>({});
  const all = processes();
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((p) => {
      const hay = [p.title, p.goal, ...p.steps.flatMap((s) => [s.title, s.instruction])].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [q, all]);
  return (
    <main>
      <label className="search">
        <span className="sr">Find a process</span>
        <input type="search" placeholder="Find a process" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {!shown.length && <p className="muted">No process matches that. Try other words.</p>}
      <ul className="cards">
        {shown.map((p) => {
          const steps = stepsFor(p, dept[p.id] ?? p.departments?.[0]);
          const screens = steps.filter((s): s is ScreenStep => s.type === "screen");
          const lv = screens.map((s) => partState(levels, p.id, s.id).level);
          return (
            <li key={p.id} className="card">
              <h2>{p.title}</h2>
              <p>{p.goal}</p>
              <p className="facts">
                {p.estimatedMinutes ? `${p.estimatedMinutes} min · ` : ""}{screens.length} on screen · {steps.length - screens.length} off screen
              </p>
              <p className="facts">{meterLabel(lv)}</p>
              {p.departments && p.departments.length > 1 && (
                <label className="dept">Your department{" "}
                  <select value={dept[p.id] ?? p.departments[0]} onChange={(e) => setDept({ ...dept, [p.id]: e.target.value })}>
                    {p.departments.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
              )}
              <button className="primary" onClick={() => void send({ t: "start", processId: p.id, ...(dept[p.id] ?? p.departments?.[0] ? { department: dept[p.id] ?? p.departments![0]! } : {}) })}>
                Start the coach
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

const KIND: Record<Step["type"], { icon: string; name: string }> = {
  screen: { icon: "▣", name: "On screen" }, checkpoint: { icon: "✓", name: "Stop and check" },
  offline: { icon: "✉", name: "Off screen" }, call: { icon: "☎", name: "Conversation" },
};

function Coach({ run, process }: { run: Run; process: Process }) {
  const step = process.steps.find((s) => s.id === run.stepIds[run.index]);
  if (!step) return null;
  const total = run.stepIds.length;
  const callouts = (process.callouts ?? []).filter((c) => c.when.step === step.id && (!c.when.department || c.when.department === run.department));
  return (
    <main className="coach">
      <p className="progress">Step {run.index + 1} of {total} · {process.title}</p>
      <h2 className="step-title"><span aria-hidden className="kind">{KIND[step.type].icon}</span> {step.title}</h2>
      {run.level && <Meter level={run.level} />}
      {run.lastNote && run.index > 0 && <p className="note" role="status">{run.lastNote}</p>}

      {step.type === "screen" ? <ScreenStepView run={run} step={step} /> : <OffScreen step={step} />}

      {callouts.map((c) => (
        <aside key={c.id} className={`callout ${c.kind}`}>
          <b>{c.kind === "rule" ? "Rule" : c.kind === "tip" ? "Tip" : "Watch out"}</b> {c.say}
          {c.source && <span className="source"> Source: {c.source}</span>}
        </aside>
      ))}
      {run.feed.map((f, i) => <p key={i} className={`feed ${f.kind}`} role="status">{f.say}</p>)}

      <footer className="actions">
        {step.type === "screen" && run.level && run.level < 4 && <button onClick={() => void send({ t: "lessHelp" })}>Less help</button>}
        <button className="ghost" onClick={() => void send({ t: "exit" })}>Stop</button>
      </footer>
    </main>
  );
}

function Questions({ run }: { run: Run }) {
  const q = run.questions[run.qi];
  if (!q) return null;
  const answered = run.picked !== undefined;
  const right = answered && run.picked === q.answer;
  return (
    <section className="question" aria-live="polite">
      <h3>{q.question}</h3>
      <div className="options">
        {q.options.map((o, i) => (
          <button key={i} disabled={answered}
            className={answered ? (i === q.answer ? "right" : i === run.picked ? "wrong" : "") : ""}
            onClick={() => void send({ t: "pick", n: i })}>{o}</button>
        ))}
      </div>
      {answered && (
        <>
          <p className={right ? "good" : "bad"}>{right ? "Right. " : "Not quite. "}{q.why}</p>
          <button className="primary" onClick={() => void send({ t: "next" })}>Continue</button>
        </>
      )}
    </section>
  );
}

function ScreenStepView({ run, step }: { run: Run; step: ScreenStep }) {
  const missing = run.targetFound === false;
  if (run.phase === "prompt" || run.phase === "check") return <Questions run={run} />;
  return (
    <section>
      {run.level === 1 || run.level === 2 || (run.level === 3 && run.askedHelp) ? (
        <>
          <p className="instruction">{step.instruction}</p>
          {step.where && <p className="facts"><b>Where:</b> {step.where}</p>}
          {run.level === 1 && step.why && <p className="facts"><b>Why:</b> {step.why}</p>}
          {run.level === 1 && step.commonMistakes?.[0] && <p className="facts"><b>Watch for:</b> {step.commonMistakes[0].say}</p>}
        </>
      ) : run.level === 3 ? (
        <p className="instruction">Do this one yourself. I'm here if you need me.</p>
      ) : (
        <p className="instruction">Your turn: {step.title}</p>
      )}
      {missing && <p className="warn" role="status">I can't find this on the page you're on. Go back to the page where you left off.</p>}
      <div className="row">
        {run.level === 3 && !run.askedHelp && <button onClick={() => void send({ t: "askHelp" })}>Show me</button>}
        {!step.check && <button className="primary" onClick={() => void send({ t: "confirm" })}>I did it</button>}
      </div>
    </section>
  );
}

function OffScreen({ step }: { step: Exclude<Step, ScreenStep> }) {
  return (
    <section>
      <p className="instruction">{step.instruction}</p>
      {step.why && <p className="facts"><b>Why:</b> {step.why}</p>}
      {step.type === "call" && (
        <div className="prep">
          <p><b>Goal:</b> {step.prep.goal}</p>
          <p><b>Open with:</b> {step.prep.opener}</p>
          {step.prep.pushbacks?.map((p, i) => <p key={i}><b>If they say</b> {p.if} <b>try</b> {p.try}</p>)}
        </div>
      )}
      <button className="primary" onClick={() => void send({ t: "confirm" })}>
        {step.type === "call" ? "I had the conversation" : step.confirm}
      </button>
    </section>
  );
}

function Recap({ run, process }: { run: Run; process: Process }) {
  const screens = run.results.filter((r) => r.type === "screen");
  const right = screens.filter((r) => r.outcome === "right").length;
  return (
    <main className="recap">
      <h2>Done: {process.title}</h2>
      <p>{process.recap.summary}</p>
      <p className="facts">{right} of {screens.length} on-screen steps right first time · independence {runIndependence(run)}%</p>
      {process.recap.nextSteps?.length ? <><h3>Next</h3><ul>{process.recap.nextSteps.map((n) => <li key={n}>{n}</li>)}</ul></> : null}
      <button className="primary" onClick={() => void chrome.storage.local.set({ [K.run]: null })}>Back to processes</button>
    </main>
  );
}
