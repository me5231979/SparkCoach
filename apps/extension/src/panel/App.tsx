// Side panel. Reads the run and levels from storage and sends intents to the worker. All text is plain,
// second person, one instruction at a time. Content is rendered as text only (never as HTML).
import { LEVELS, meterLabel, partState, stepsFor, type Level, type Levels, type Process, type ScreenStep, type Step } from "@spark/core";
import { useEffect, useMemo, useState } from "react";
import { fromCache, patternFor, PLATFORM, themeFrom, type ContentCache } from "../lib/content.ts";
import { send } from "../lib/messages.ts";
import { runIndependence, type Run } from "../lib/run.ts";
import { K, type Session, type Status } from "../lib/store.ts";

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
  const cache = useStored<ContentCache | null>(K.content, null);
  const session = useStored<Session | null>(K.session, null);
  const status = useStored<Status>(K.status, {});
  const all = fromCache(cache);
  const theme = themeFrom(cache);
  const process = run ? all.find((p) => p.id === run.processId) : undefined;
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", theme.accent); r.setProperty("--accent-ink", theme.accentInk); r.setProperty("--bg", theme.surface);
    document.title = theme.displayName;
  }, [theme.accent, theme.accentInk, theme.surface, theme.displayName]);
  useEffect(() => { if (PLATFORM && session) void send({ t: "sync" } as never); }, [session?.token]);
  return (
    <div className="app">
      <header className="top">
        {theme.logo ? <img src={theme.logo} alt="" className="logo" /> : <span className="mark" aria-hidden>✦</span>} {theme.displayName}
      </header>
      {PLATFORM && !session ? <SignIn status={status} />
        : run && process && run.status === "active" ? <Coach run={run} process={process} />
        : run && process && run.status === "complete" ? <Recap run={run} process={process} />
        : <>
            {PLATFORM && cache && <Systems domains={cache.approvedDomains} />}
            <List levels={levels} all={all} />
            {PLATFORM && session && <Footer session={session} status={status} />}
          </>}
      {PLATFORM && session && <Ask name={theme.displayName} />}
    </div>
  );
}

function SignIn({ status }: { status: Status }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (c?: string) => { setBusy(true); const r = await send<{ error?: string }>({ t: "signIn", ...(c ? { code: c } : {}) } as never); setBusy(false); setErr(r?.error ?? null); };
  return (
    <main>
      <p>Sign in with your work account to get your company's coaches.</p>
      {(err || status.error) && <p className="warn" role="alert">{err ?? status.error}</p>}
      <button className="primary" disabled={busy} onClick={() => go()}>Sign in</button>
      <details style={{ marginTop: 16 }}>
        <summary>Have a sign-in code?</summary>
        <label className="search"><span className="sr">Sign-in code</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code" /></label>
        <button disabled={busy || !code.trim()} onClick={() => go(code)} style={{ marginTop: 6 }}>Use code</button>
      </details>
    </main>
  );
}

/** Optional host permissions: the learner allows Spark on their company's approved systems (one click). */
function Systems({ domains }: { domains: string[] }) {
  const origins = [...new Set(domains.map(patternFor))];
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { void chrome.permissions.contains({ origins }).then(setOk); }, [origins.join()]);
  if (ok !== false || !origins.length) return null;
  return (
    <aside className="callout">
      <b>One more step.</b> Allow the coach to see labels and buttons on {domains.join(", ")}. It never reads what you type or what's on the record.
      <div className="row"><button className="primary" onClick={async () => { const g = await chrome.permissions.request({ origins }); setOk(g); if (g) void send({ t: "systemsGranted" } as never); }}>Allow</button></div>
    </aside>
  );
}

function Footer({ session, status }: { session: Session; status: Status }) {
  return (
    <footer className="actions" style={{ fontSize: 12 }}>
      <span className="facts" style={{ flex: 1 }}>{session.user.name} · {session.org.name}{status.queued ? ` · ${status.queued} run(s) waiting to sync` : ""}{status.error ? ` · ${status.error}` : ""}</span>
      <button className="ghost" onClick={() => void send({ t: "sync" } as never)}>Refresh</button>
      <button className="ghost" onClick={() => void send({ t: "signOut" } as never)}>Sign out</button>
    </footer>
  );
}

function Ask({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "assistant"; text: string; sources?: string[] }[]>([]);
  const ask = async () => {
    const question = q.trim(); if (!question) return;
    setQ(""); setBusy(true);
    const history = log.map(({ role, text }) => ({ role, text }));
    setLog((l) => [...l, { role: "user", text: question }]);
    const r = await send<{ text?: string; sources?: string[]; error?: string }>({ t: "ask", question, history } as never);
    setLog((l) => [...l, { role: "assistant", text: r?.error ?? r?.text ?? "I couldn't answer that.", sources: r?.sources ?? [] }]);
    setBusy(false);
  };
  if (!open) return <button className="ask-fab primary" onClick={() => setOpen(true)}>Ask {name}</button>;
  return (
    <section className="ask" aria-label={`Ask ${name}`}>
      <div className="row" style={{ justifyContent: "space-between" }}><b>Ask {name}</b><button className="ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
      <div className="ask-log" aria-live="polite">
        {log.length === 0 && <p className="facts">Ask about any of your company's processes. Answers come only from your company's coaches.</p>}
        {log.map((m, i) => <p key={i} className={m.role}>{m.text}{m.sources?.length ? <span className="source"> Source: {m.sources.join(", ")}</span> : null}</p>)}
        {busy && <p className="facts">Thinking…</p>}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question" aria-label="Your question" style={{ flex: 1 }} />
        <button className="primary" disabled={busy}>Ask</button>
      </form>
    </section>
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

function List({ levels, all }: { levels: Levels; all: Process[] }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<Record<string, string>>({});
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
      {!all.length && <p className="muted">No coaches published for you yet. Check back soon.</p>}
      {all.length > 0 && !shown.length && <p className="muted">No process matches that. Try other words.</p>}
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
