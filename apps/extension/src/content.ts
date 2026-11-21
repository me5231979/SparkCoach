// Content script. Inert unless the worker sends a view for this tab, and the tab is on one of the run's approved
// systems. It resolves the step's target, draws the spotlight, evaluates the completion check, and reports only
// step ids and booleans. It never reads field values or page text itself: that happens inside @spark/dom, which
// returns booleans.
import type { Target } from "@spark/core";
import { Overlay, closestInteractive, matches, resolve, runCheck } from "@spark/dom";
import { hostAllowed } from "./lib/content.ts";
import { send, type TabView, type WorkerMsg } from "./lib/messages.ts";

const overlay = new Overlay();
let view: TabView = null;
let stepKey = "";
let passedKey = "";
let lastFound: boolean | null = null;
let missingTimer: number | undefined;
let evalTimer: number | undefined;
let observer: MutationObserver | null = null;
/** Targets activated during the current step, kept as the step's own target objects (no page data). */
let clicked: Target[] = [];

const active = () => !!view && hostAllowed(location.host, view.systems);

function evaluate() {
  if (!active()) { stop(); return; }
  listen();
  const v = view!;
  const key = `${v.runId}:${v.step.id}`;
  if (key !== stepKey) { stepKey = key; lastFound = null; clicked = []; clearTimeout(missingTimer); missingTimer = undefined; }

  const found = resolve(v.step.target, document);
  if (v.spotlight && found) overlay.show(found.el, v.label, v.step.instruction, true);
  else overlay.hide();
  reportFound(v.step.id, found?.strategy);

  if (v.step.check && passedKey !== key) {
    const ok = runCheck(v.step.check, { doc: document, href: location.href, clicked: (t) => clicked.some((c) => JSON.stringify(c) === JSON.stringify(t)) });
    if (ok) { passedKey = key; void send({ t: "passed", stepId: v.step.id }); }
  }
}

/** "Found" is reported at once; "not on this page" waits so page transitions don't flicker. */
function reportFound(stepId: string, strategy: string | undefined) {
  if (strategy) {
    clearTimeout(missingTimer); missingTimer = undefined;
    if (lastFound !== true) { lastFound = true; void send({ t: "target", stepId, found: true, strategy }); }
  } else if (lastFound !== false && missingTimer === undefined) {
    missingTimer = window.setTimeout(() => { missingTimer = undefined; lastFound = false; void send({ t: "target", stepId, found: false }); }, 1500);
  }
}

const schedule = (ms: number) => { clearTimeout(evalTimer); evalTimer = window.setTimeout(evaluate, ms); };

/** Click, Enter or Space on an interactive element: is it the target, or a known mistake? */
function onActivate(e: Event) {
  if (!active()) return;
  if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
  const v = view!;
  const el = closestInteractive(e.composedPath()[0] ?? e.target);
  if (el) {
    const isTarget = matches(el, v.step.target, document);
    const mistake = (v.step.commonMistakes ?? []).findIndex((m) => matches(el, m.when.clicked, document));
    // Remember which authored targets were activated, for `clicked` checks.
    for (const t of collectTargets(v)) if (matches(el, t, document)) clicked.push(t);
    void send({ t: "click", stepId: v.step.id, isTarget, mistake });
  }
  schedule(60);
}

function collectTargets(v: NonNullable<TabView>): Target[] {
  const out: Target[] = [v.step.target];
  const walk = (c: NonNullable<typeof v.step.check>) => {
    if (c.type === "clicked") out.push(c.target);
    if (c.type === "all" || c.type === "any") c.checks.forEach(walk);
  };
  if (v.step.check) walk(v.step.check);
  return out;
}

const onChange = () => schedule(120);
const onNav = () => schedule(60);

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  addEventListener("click", onActivate, true);
  addEventListener("keydown", onActivate, true);
  addEventListener("input", onChange, true);
  addEventListener("change", onChange, true);
  addEventListener("popstate", onNav);
  addEventListener("hashchange", onNav);
  let mut: number | undefined;
  observer = new MutationObserver(() => { mut ??= window.setTimeout(() => { mut = undefined; evaluate(); }, 150); });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
}

function stop() {
  overlay.hide();
  stepKey = ""; lastFound = null; clicked = [];
  clearTimeout(missingTimer); clearTimeout(evalTimer); missingTimer = undefined;
  if (!listening) return;
  listening = false;
  removeEventListener("click", onActivate, true);
  removeEventListener("keydown", onActivate, true);
  removeEventListener("input", onChange, true);
  removeEventListener("change", onChange, true);
  removeEventListener("popstate", onNav);
  removeEventListener("hashchange", onNav);
  observer?.disconnect(); observer = null;
}

chrome.runtime.onMessage.addListener((msg: WorkerMsg, sender) => {
  if (sender.id !== chrome.runtime.id || sender.tab || msg?.t !== "view") return;
  view = msg.view;
  evaluate();
});

void send<{ view: TabView }>({ t: "hello" }).then((r) => { view = r?.view ?? view; evaluate(); });
