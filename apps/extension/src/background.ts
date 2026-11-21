// Service worker: owns the run. The only writer of run state and levels. The panel reads storage; the page gets
// only a TabView (which step to watch, spotlight on/off). Nothing here talks to the network in Phase 0.
import type { Levels } from "@spark/core";
import { getProcess, hostAllowed } from "./lib/content.ts";
import type { Msg, TabView } from "./lib/messages.ts";
import * as R from "./lib/run.ts";
import { get, K, set } from "./lib/store.ts";

chrome.runtime.onInstalled.addListener(() => { void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }); });
// Storage is closed to content scripts: nothing running in a web page's process can read results or levels.
void chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });

const ownOrigin = chrome.runtime.getURL("");
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const p = queue.then(fn, fn); queue = p.catch(() => undefined); return p; };

const labels = ["", "Guide", "Prompt", "On call", "Off"];
function viewOf(run: R.Run | null): TabView {
  if (!run || run.status !== "active") return null;
  const process = getProcess(run.processId);
  const step = process && R.stepOf(run, process);
  if (!process || !step || step.type !== "screen") return null;
  return { runId: run.runId, processId: run.processId, systems: process.systems, index: run.index, step, spotlight: run.spotlight, label: `Step ${run.index + 1} · ${labels[run.level ?? 1]}` };
}

/** Tabs on the run's approved systems get the view; all others are told to stand down. */
async function broadcast(run: R.Run | null) {
  const view = viewOf(run);
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
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
  const run = await get<R.Run | null>(K.run, null);
  let levels = await get<Levels>(K.levels, {});

  if (msg.t === "hello") {
    if (!fromPage || !run || !sender.tab?.url) return { view: null };
    const view = viewOf(run);
    let host = "";
    try { host = new URL(sender.tab.url).host; } catch { /* ignore */ }
    return { view: view && hostAllowed(host, view.systems) ? view : null };
  }

  if (msg.t === "start") {
    if (fromPage) return;
    const process = getProcess(msg.processId);
    if (!process) return { error: "That process isn't available." };
    const fresh = R.newRun(process, levels, msg.department);
    await save(fresh);
    return { ok: true };
  }

  if (!run || run.status !== "active") return;
  const process = getProcess(run.processId);
  if (!process) return;
  const step = R.stepOf(run, process);

  switch (msg.t) {
    // From the page: only for the current step.
    case "passed":
      if (!fromPage || step?.id !== msg.stepId) return;
      levels = R.passed(run, process, levels).levels;
      break;
    case "click":
      if (!fromPage || step?.id !== msg.stepId) return;
      R.click(run, process, msg.mistake);
      break;
    case "target":
      if (!fromPage || step?.id !== msg.stepId) return;
      run.targetFound = msg.found;
      if (msg.found) run.resolved = true;
      break;
    // From the panel.
    case "confirm": if (fromPage) return; levels = R.passed(run, process, levels).levels; break;
    case "pick": if (fromPage) return; R.pick(run, msg.n); break;
    case "next": if (fromPage) return; levels = R.next(run, process, levels).levels; break;
    case "askHelp": if (fromPage) return; R.askHelp(run); break;
    case "lessHelp": if (fromPage) return; levels = R.lessHelp(run, process, levels); break;
    case "exit": if (fromPage) return; run.status = "exited"; run.spotlight = false; break;
  }
  await save(run, levels);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  serial(() => handle(msg, sender)).then(reply, () => reply(undefined));
  return true;
});

// A tab that navigates or loads on an approved system asks again via "hello"; nothing to do here.
