// Service worker: owns the run and the session. The only writer of run state and levels. The panel reads storage;
// the page gets only a TabView (which step to watch, spotlight on/off). Network: only via lib/api.ts, only to the
// Spark API, and only identity, coach content, run summaries (ids, levels, right/miss, times) and Ask questions.
import type { Levels, Process } from "@spark/core";
import { ApiError, call } from "./lib/api.ts";
import { fromCache, hostAllowed, patternFor, PLATFORM, type ContentCache } from "./lib/content.ts";
import type { Msg, TabView } from "./lib/messages.ts";
import * as R from "./lib/run.ts";
import { get, K, set, type Session, type Status } from "./lib/store.ts";
import { API_ORIGIN } from "./generated/content.ts";

chrome.runtime.onInstalled.addListener(() => { void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }); });
// Storage is closed to content scripts: nothing running in a web page's process can read results or levels.
void chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });

const ownOrigin = chrome.runtime.getURL("");
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const p = queue.then(fn, fn); queue = p.catch(() => undefined); return p; };

const status = async (s: Status) => set(K.status, { ...(await get<Status>(K.status, {})), ...s });

// ── Session ───────────────────────────────────────────────────────────────────────────────────────────────────

type TokenOut = { token: string; expiresAt: string; refresh: string; user: Session["user"]; org: Session["org"] };

async function signIn(code?: string): Promise<{ error?: string }> {
  if (!PLATFORM) return { error: "This build runs without a Spark server." };
  let c = code?.trim();
  if (!c) {
    const redirect = chrome.identity.getRedirectURL();
    const url = `${API_ORIGIN}/connect?redirect_uri=${encodeURIComponent(redirect)}`;
    let back: string | undefined;
    try { back = await chrome.identity.launchWebAuthFlow({ url, interactive: true }); } catch { return { error: "Sign-in was closed before it finished." }; }
    c = back ? new URL(back).searchParams.get("code") ?? undefined : undefined;
    if (!c) return { error: "Sign-in didn't finish. Try again." };
  }
  try {
    const t = await call<TokenOut>("/api/auth/extension/token", { method: "POST", body: { code: c } });
    await set(K.session, { token: t!.token, expiresAt: t!.expiresAt, refresh: t!.refresh, user: t!.user, org: t!.org } satisfies Session);
    await sync();
    return {};
  } catch (e) { return { error: e instanceof ApiError ? e.message : "Couldn't reach your company's Spark." }; }
}

/** A valid access token, refreshing when it's within 2 minutes of expiry. Null when signed out. */
async function token(): Promise<string | null> {
  const s = await get<Session | null>(K.session, null);
  if (!s) return null;
  if (Date.parse(s.expiresAt) - Date.now() > 120_000) return s.token;
  try {
    const t = await call<{ token: string; expiresAt: string; refresh: string }>("/api/auth/extension/refresh", { method: "POST", body: { refresh: s.refresh } });
    await set(K.session, { ...s, ...t! });
    return t!.token;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { await set(K.session, null); await status({ error: "Your session ended. Sign in again." }); }
    return null;
  }
}

async function authed<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T | null> {
  const t = await token();
  if (!t) throw new ApiError(401, "Sign in first.");
  return call<T>(path, { ...init, token: t });
}

// ── Content, levels and run sync ──────────────────────────────────────────────────────────────────────────────

async function sync(): Promise<void> {
  if (!PLATFORM) return;
  try {
    const cur = await get<ContentCache | null>(K.content, null);
    const fresh = await authed<Omit<ContentCache, "at">>(`/api/content${cur ? `?since=${cur.hash}` : ""}`);
    const run = await get<R.Run | null>(K.run, null);
    // New versions apply between runs, never mid-run.
    if (fresh && !(run && run.status === "active")) await set(K.content, { ...fresh, at: Date.now() });
    const levels = await authed<Levels>("/api/me/levels");
    if (levels) await set(K.levels, levels);
    await flushQueue();
    await registerContentScripts();
    await status({ error: undefined, syncedAt: Date.now() });
  } catch (e) {
    await status({ error: e instanceof ApiError ? e.message : "Offline. Using the coaches you already have." });
  }
}

type Summary = { runId: string; processId: string; version: number; startedAt: string; finishedAt?: string; status: "completed" | "abandoned"; steps: R.StepResult[] };
const summaryOf = (run: R.Run, version: number): Summary => ({
  runId: run.runId, processId: run.processId, version, startedAt: new Date(run.startedAt).toISOString(),
  ...(run.finishedAt ? { finishedAt: new Date(run.finishedAt).toISOString() } : {}),
  status: run.status === "complete" ? "completed" : "abandoned",
  // Only ids, levels, outcomes, times and counts. No page data exists in a run to begin with.
  steps: run.results.map((r) => ({ id: r.id, type: r.type, ...(r.level ? { level: r.level } : {}), outcome: r.outcome, seconds: r.seconds, hints: r.hints, ...(r.resolved !== undefined ? { resolved: r.resolved } : {}), ...(r.less ? { less: true } : {}) })) as R.StepResult[],
});

async function flushQueue() {
  const q = await get<Summary[]>(K.queue, []);
  const left: Summary[] = [];
  for (const s of q) {
    try {
      const r = await authed<{ levels: Levels }>("/api/runs", { method: "POST", body: s });
      if (r?.levels) await set(K.levels, r.levels); // the server is the source of truth for levels
    } catch (e) { if (!(e instanceof ApiError) || e.status >= 500 || e.status === 401 || e.status === 0) left.push(s); }
  }
  await set(K.queue, left);
  await status({ queued: left.length });
}

async function finishRun(run: R.Run, process: Process & { version?: number }) {
  if (!PLATFORM || run.results.length === 0) return;
  await set(K.queue, [...(await get<Summary[]>(K.queue, [])), summaryOf(run, process.version ?? 1)]);
  await flushQueue().catch(() => undefined);
}

/** Inject the content script on the org's approved systems that the learner granted (optional host permissions). */
async function registerContentScripts() {
  if (!PLATFORM || !chrome.scripting) return;
  const c = await get<ContentCache | null>(K.content, null);
  const all = await chrome.permissions.getAll();
  const granted = (c?.approvedDomains ?? []).map(patternFor).filter((p) => all.origins?.includes(p) || all.origins?.some((o) => o === p));
  const matches = [...new Set(granted)];
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ["spark"] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: ["spark"] });
  if (matches.length) await chrome.scripting.registerContentScripts([{ id: "spark", matches, js: ["content.js"], runAt: "document_idle", allFrames: true, persistAcrossSessions: true }]);
}

chrome.alarms?.create("spark-sync", { periodInMinutes: 30 });
chrome.alarms?.onAlarm.addListener((a) => { if (a.name === "spark-sync") void serial(sync); });
chrome.runtime.onStartup?.addListener(() => void serial(sync));

// ── The run ───────────────────────────────────────────────────────────────────────────────────────────────────

const labels = ["", "Guide", "Prompt", "On call", "Off"];
async function processes() { return fromCache(await get<ContentCache | null>(K.content, null)); }

async function viewOf(run: R.Run | null): Promise<TabView> {
  if (!run || run.status !== "active") return null;
  const cache = await get<ContentCache | null>(K.content, null);
  const process = fromCache(cache).find((p) => p.id === run.processId);
  const step = process && R.stepOf(run, process);
  if (!process || !step || step.type !== "screen") return null;
  return { runId: run.runId, processId: run.processId, systems: process.systems, index: run.index, step, spotlight: run.spotlight, label: `Step ${run.index + 1} · ${labels[run.level ?? 1]}`, ...(cache?.theme ? { accent: cache.theme.accent } : {}) };
}

/** Tabs on the run's approved systems get the view; all others are told to stand down. */
async function broadcast(run: R.Run | null) {
  const view = await viewOf(run);
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id === undefined || !tab.url) continue;
    let host = "";
    try { host = new URL(tab.url).host; } catch { continue; }
    const mine = view && hostAllowed(host, view.systems);
    chrome.tabs.sendMessage(tab.id, { t: "view", view: mine ? view : null }).catch(() => undefined);
  }
}

async function save(run: R.Run | null, levels?: Levels) {
  await set(K.run, run);
  if (levels) await set(K.levels, levels);
  await broadcast(run);
}

async function handle(msg: Msg, sender: chrome.runtime.MessageSender): Promise<unknown> {
  // Extension pages (the panel, even when opened in a tab) have our own origin; anything else is a web page.
  const fromPage = !(sender.url ?? "").startsWith(ownOrigin);

  if (msg.t === "hello") {
    const run = await get<R.Run | null>(K.run, null);
    if (!fromPage || !run || !sender.tab?.url) return { view: null };
    const view = await viewOf(run);
    let host = "";
    try { host = new URL(sender.tab.url).host; } catch { /* ignore */ }
    return { view: view && hostAllowed(host, view.systems) ? view : null };
  }

  if (!fromPage) {
    switch (msg.t) {
      case "signIn": return signIn(msg.code);
      case "signOut": await set(K.session, null); await set(K.content, null); await set(K.levels, {}); await set(K.run, null); await broadcast(null); return {};
      case "sync": await sync(); return {};
      case "systemsGranted": await registerContentScripts(); return {};
      case "ask": {
        const run = await get<R.Run | null>(K.run, null);
        try {
          return await authed("/api/ask", { method: "POST", body: { question: msg.question, history: msg.history, ...(run?.status === "active" ? { processId: run.processId, stepId: run.stepIds[run.index] } : {}) } });
        } catch (e) { return { error: e instanceof ApiError ? e.message : "Ask needs a connection to your company's Spark." }; }
      }
    }
  }

  const run = await get<R.Run | null>(K.run, null);
  let levels = await get<Levels>(K.levels, {});

  if (msg.t === "start") {
    if (fromPage) return;
    const process = (await processes()).find((p) => p.id === msg.processId);
    if (!process) return { error: "That process isn't available." };
    await save(R.newRun(process, levels, msg.department));
    return { ok: true };
  }

  if (!run || run.status !== "active") return;
  const process = (await processes()).find((p) => p.id === run.processId);
  if (!process) return;
  const step = R.stepOf(run, process);

  switch (msg.t) {
    // From the page: only for the current step.
    case "passed": if (!fromPage || step?.id !== msg.stepId) return; levels = R.passed(run, process, levels).levels; break;
    case "click": if (!fromPage || step?.id !== msg.stepId) return; R.click(run, process, msg.mistake); break;
    case "target": if (!fromPage || step?.id !== msg.stepId) return; run.targetFound = msg.found; if (msg.found) run.resolved = true; break;
    // From the panel.
    case "confirm": if (fromPage) return; levels = R.passed(run, process, levels).levels; break;
    case "pick": if (fromPage) return; R.pick(run, msg.n); break;
    case "next": if (fromPage) return; levels = R.next(run, process, levels).levels; break;
    case "askHelp": if (fromPage) return; R.askHelp(run); break;
    case "lessHelp": if (fromPage) return; levels = R.lessHelp(run, process, levels); break;
    case "exit": if (fromPage) return; run.status = "exited"; run.spotlight = false; run.finishedAt = Date.now(); break;
    default: return;
  }
  await save(run, levels);
  const ended = (run.status as R.Run["status"]) !== "active"; // the handlers above may have finished the run
  if (ended) await finishRun(run, process);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  serial(() => handle(msg, sender)).then(reply, () => reply(undefined));
  return true;
});
