// Finds elements the way a person describes them: role + accessible name, or field label, within a context
// ("the Save button in the Managers section"), with context, nth, open shadow roots, same-origin iframes and a
// fuzzy fallback.
//
// PRIVACY: this is the only module allowed to read element text, and only to compute names, labels and headings
// for matching. It never returns field values or free page text to callers; it returns elements and booleans.
import type { Target } from "@spark/core";

/** CSS.escape, with a fallback for environments that lack it. */
export const cssEscape = (s: string) =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/["\\\]\[]/g, "\\$&");

export const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
export const same = (a: string | null | undefined, b: string | null | undefined) => norm(a).toLowerCase() === norm(b).toLowerCase();

export type Strategy = "testId" | "roleNameContext" | "labelContext" | "roleName" | "label" | "selector" | "fuzzy";
export type Resolved = { el: Element; strategy: Strategy } | null;

// ── Walking the page: light DOM, open shadow roots, same-origin iframes ──────────────────────────────────────────

type Root = Document | ShadowRoot;

/** Every root reachable from `doc`: the document, open shadow roots inside it, and same-origin iframe documents. */
export function roots(doc: Document = document): Root[] {
  const out: Root[] = [];
  const visit = (root: Root) => {
    out.push(root);
    const walker = (root instanceof Document ? root : root.ownerDocument).createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n as Element;
      if (el.shadowRoot) visit(el.shadowRoot);
      if (el instanceof HTMLIFrameElement) {
        try { const d = el.contentDocument; if (d) visit(d); } catch { /* cross-origin: its own content script answers */ }
      }
    }
  };
  visit(doc);
  return out;
}

export function queryAll(selector: string, doc: Document = document): Element[] {
  const out: Element[] = [];
  for (const r of roots(doc)) {
    try { out.push(...r.querySelectorAll(selector)); } catch { return []; }
  }
  return out;
}

const docOf = (el: Element) => el.ownerDocument;
const winOf = (el: Element) => el.ownerDocument.defaultView ?? window;

export function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    // jsdom and some layouts report zero boxes; fall back to style and hidden attributes.
    if ((el as HTMLElement).hidden || el.closest("[hidden],[aria-hidden='true']")) return false;
  }
  const cs = winOf(el).getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none") return false;
  for (let p = el.parentElement; p; p = p.parentElement) {
    if ((p as HTMLElement).hidden || winOf(p).getComputedStyle(p).display === "none") return false;
  }
  return true;
}

// ── Roles and names ─────────────────────────────────────────────────────────────────────────────────────────────

const isField = (el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  el instanceof winOf(el).HTMLInputElement || el instanceof winOf(el).HTMLSelectElement || el instanceof winOf(el).HTMLTextAreaElement;

const ROLE_SELECTORS: Record<string, string> = {
  button: 'button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"],summary',
  link: 'a[href],[role="link"]',
  menuitem: '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]',
  textbox: 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="url"],input[type="date"],input[type="number"],input[type="password"],textarea,[role="textbox"],[contenteditable="true"]',
  combobox: 'select,[role="combobox"],[role="listbox"]',
  checkbox: 'input[type="checkbox"],[role="checkbox"],[role="switch"]',
  radio: 'input[type="radio"],[role="radio"]',
  tab: '[role="tab"]',
  option: 'option,[role="option"]',
  heading: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
  dialog: 'dialog,[role="dialog"],[role="alertdialog"]',
  row: 'tr,[role="row"]',
};
export const INTERACTIVE = 'button,a[href],input,select,textarea,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[role="option"],[role="checkbox"],[role="radio"],[role="switch"],[role="combobox"]';

export const selectorForRole = (role: string) => ROLE_SELECTORS[role] ?? `[role="${cssEscape(role)}"]`;

/** The element's role: explicit, else implicit from its tag. */
export function roleOf(el: Element): string | null {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit.split(/\s+/)[0] ?? null;
  for (const [role, sel] of Object.entries(ROLE_SELECTORS)) if (el.matches(sel)) return role;
  return null;
}

/** Label text without the text of any control nested inside the label. */
function labelText(label: HTMLLabelElement): string {
  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("input,select,textarea,button").forEach((n) => n.remove());
  return norm(clone.textContent);
}

/** A practical accessible-name calculation: aria-label, aria-labelledby, <label>, button value, alt, then text. */
export function accName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return norm(aria);
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const d = docOf(el);
    const root = el.getRootNode() as Document | ShadowRoot;
    const text = by.split(/\s+/).map((id) => (root.getElementById?.(id) ?? d.getElementById(id))?.textContent ?? "").join(" ");
    if (norm(text)) return norm(text);
  }
  if (isField(el)) {
    // Buttons made from inputs show their value as their name: that's app wording, not record data.
    if (el instanceof winOf(el).HTMLInputElement && ["button", "submit", "reset"].includes((el as HTMLInputElement).type)) return norm((el as HTMLInputElement).value);
    return fieldLabel(el);
  }
  if (el instanceof winOf(el).HTMLImageElement) return norm((el as HTMLImageElement).alt);
  if (el.matches(ROLE_SELECTORS.dialog!)) {
    const h = el.querySelector("h1,h2,h3,h4,[role='heading']");
    if (h) return norm(h.textContent);
  }
  return norm(el.textContent) || norm(el.getAttribute("title"));
}

/** A field's label: <label for>, wrapping <label>, aria-label/labelledby, then placeholder or title. Never its value. */
export function fieldLabel(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return norm(aria);
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const text = by.split(/\s+/).map((id) => docOf(el).getElementById(id)?.textContent ?? "").join(" ");
    if (norm(text)) return norm(text);
  }
  const labels = (el as HTMLInputElement).labels;
  const first = labels?.[0];
  if (first) return labelText(first);
  return norm(el.getAttribute("placeholder") ?? el.getAttribute("title"));
}

// ── Context: nearest headings, landmarks and dialog titles ──────────────────────────────────────────────────────

const SECTION = 'section,article,form,fieldset,dialog,[role="dialog"],[role="alertdialog"],[role="region"],[role="group"],[role="tabpanel"],main,nav,aside';

function sectionTitle(sec: Element): string {
  const aria = sec.getAttribute("aria-label");
  if (aria) return norm(aria);
  const by = sec.getAttribute("aria-labelledby");
  if (by) { const t = norm(by.split(/\s+/).map((id) => docOf(sec).getElementById(id)?.textContent ?? "").join(" ")); if (t) return t; }
  const legend = sec.matches("fieldset") ? sec.querySelector(":scope > legend") : null;
  if (legend) return norm(legend.textContent);
  const h = sec.querySelector(":scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6,:scope > header h1,:scope > header h2,:scope > header h3,:scope > [role='heading']");
  return h ? norm(h.textContent) : "";
}

/** Titles of the sections around an element, outermost first. Crosses shadow roots. */
export function contextOf(el: Element): string[] {
  const titles: string[] = [];
  let n: Element | null = el;
  while (n) {
    const sec: Element | null = n.parentElement?.closest(SECTION) ?? null;
    if (sec) { const t = sectionTitle(sec); if (t) titles.unshift(t); n = sec; continue; }
    const host: Element | undefined = (n.getRootNode() as ShadowRoot).host;
    n = host ?? null;
  }
  return titles;
}

/** True when every wanted title appears in the element's context, in order. */
export function inContext(el: Element, wanted: string[] | undefined): boolean {
  if (!wanted?.length) return true;
  const have = contextOf(el).map((t) => t.toLowerCase());
  let i = 0;
  for (const w of wanted.map((x) => norm(x).toLowerCase())) {
    const at = have.indexOf(w, i);
    if (at < 0) return false;
    i = at + 1;
  }
  return true;
}

// ── Matching ────────────────────────────────────────────────────────────────────────────────────────────────────

function byRole(role: string, name: string, doc: Document): Element[] {
  return queryAll(selectorForRole(role), doc).filter((el) => isVisible(el) && same(accName(el), name));
}

function byLabel(label: string, doc: Document): Element[] {
  const sel = 'input:not([type="hidden"]),select,textarea,[role="textbox"],[role="combobox"],[contenteditable="true"]';
  return queryAll(sel, doc).filter((el) => isVisible(el) && same(fieldLabel(el), label));
}

const pick = (els: Element[], nth = 0) => els[nth] ?? null;

/** Similarity of two names in 0..1 (Dice coefficient on character bigrams, after normalising "&" to "and"). */
export function similarity(a: string, b: string): number {
  const clean = (s: string) => norm(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]/g, "");
  const x = clean(a), y = clean(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); } return m; };
  const gx = grams(x), gy = grams(y);
  let overlap = 0;
  for (const [g, c] of gx) overlap += Math.min(c, gy.get(g) ?? 0);
  return (2 * overlap) / (x.length - 1 + y.length - 1);
}

export const FUZZY_THRESHOLD = 0.85;

function safeQuery(selector: string, doc: Document): Element[] {
  try { return queryAll(selector, doc).filter(isVisible); } catch { return []; }
}

/**
 * Resolve a target. First unique visible match wins, in this order (SCREEN-AWARENESS §2):
 * testId → role+name in context → label in context → role+name anywhere → label anywhere → selector → fuzzy.
 * `nth` breaks ties among equal matches in document order.
 */
export function resolve(t: Target, doc: Document = document): Resolved {
  const nth = t.nth ?? 0;
  if (t.testId) {
    const el = pick(safeQuery(`[data-testid="${cssEscape(t.testId)}"],[data-test-id="${cssEscape(t.testId)}"]`, doc), nth);
    if (el) return { el, strategy: "testId" };
  }
  if (t.role && t.name && t.context?.length) {
    const el = pick(byRole(t.role, t.name, doc).filter((e) => inContext(e, t.context)), nth);
    if (el) return { el, strategy: "roleNameContext" };
  }
  if (t.label && t.context?.length) {
    const el = pick(byLabel(t.label, doc).filter((e) => inContext(e, t.context)), nth);
    if (el) return { el, strategy: "labelContext" };
  }
  if (t.role && t.name) {
    const el = pick(byRole(t.role, t.name, doc), nth);
    if (el) return { el, strategy: "roleName" };
  }
  if (t.label) {
    const el = pick(byLabel(t.label, doc), nth);
    if (el) return { el, strategy: "label" };
  }
  if (t.selector) {
    const el = pick(safeQuery(t.selector, doc), nth);
    if (el) return { el, strategy: "selector" };
  }
  if (t.role && t.name) {
    const scored = queryAll(selectorForRole(t.role), doc)
      .filter((e) => isVisible(e) && inContext(e, t.context))
      .map((e) => ({ e, s: similarity(accName(e), t.name!) }))
      .filter((x) => x.s >= FUZZY_THRESHOLD)
      .sort((a, b) => b.s - a.s);
    if (scored[0]) return { el: scored[0].e, strategy: "fuzzy" };
  }
  return null;
}

/** Does this element match the target (used for click checks and wrong-click coaching)? */
export function matches(el: Element, t: Target, doc: Document = docOf(el)): boolean {
  const r = resolve(t, doc);
  return !!r && (r.el === el || r.el.contains(el));
}

export function closestInteractive(node: EventTarget | null): Element | null {
  if (!node || typeof (node as Element).closest !== "function") return null;
  return (node as Element).closest(INTERACTIVE);
}

/** Describe an element as a Target, for the Recorder. Structure only: role, name, label, context, nth, testId. */
export function describe(el: Element, doc: Document = docOf(el)): Target {
  const role = roleOf(el) ?? undefined;
  const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-test-id") ?? undefined;
  const context = contextOf(el);
  const isInput = isField(el) && !(el instanceof winOf(el).HTMLInputElement && ["button", "submit", "reset"].includes((el as HTMLInputElement).type));
  const t: Target = {};
  if (isInput) {
    const label = fieldLabel(el);
    if (label) t.label = label;
    if (role) t.role = role;
  } else {
    if (role) t.role = role;
    const name = accName(el);
    if (name) t.name = name;
  }
  if (context.length) t.context = context;
  if (testId) t.testId = testId;
  // nth among elements that resolve the same way, so replay picks this one.
  const probe: Target = { ...t, nth: 0 };
  delete probe.testId;
  const candidates = t.label ? byLabel(t.label, doc) : t.role && t.name ? byRole(t.role, t.name, doc) : [];
  const inCtx = candidates.filter((c) => inContext(c, probe.context));
  const i = inCtx.indexOf(el);
  if (i > 0) t.nth = i;
  return t;
}

// ── Local-only evaluations. These read values or page text and return ONLY a boolean. ────────────────────────────

/** Field value test, decided here. The value never leaves this function. */
export function fieldMatches(el: Element, cond: { notEmpty?: true; equals?: string; matches?: string }): boolean {
  const w = winOf(el);
  let values: string[];
  if (el instanceof w.HTMLSelectElement) {
    const opt = el.selectedOptions[0];
    values = opt && el.value !== "" ? [el.value, norm(opt.textContent)] : [""];
  } else if (el instanceof w.HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    values = [el.checked ? "true" : ""];
  } else if (isField(el)) {
    values = [el.value];
  } else if (el.getAttribute("aria-checked")) {
    values = [el.getAttribute("aria-checked") === "true" ? "true" : ""];
  } else {
    // Custom widgets (comboboxes): the shown selection. Static option labels only; compared, never returned.
    values = [norm(el.textContent)];
  }
  if (cond.notEmpty) return values.some((v) => norm(v) !== "");
  if (cond.equals !== undefined) return values.some((v) => same(v, cond.equals));
  if (cond.matches !== undefined) {
    let re: RegExp;
    try { re = new RegExp(cond.matches); } catch { return false; }
    return values.some((v) => re.test(norm(v)));
  }
  return false;
}

/** Is an authored phrase (fixed app wording, e.g. "Submitted") visible on the page? Returns only true/false. */
export function phraseVisible(text: string, doc: Document = document): boolean {
  const want = norm(text).toLowerCase();
  if (!want) return false;
  for (const r of roots(doc)) {
    const body = r instanceof Document ? r.body : r;
    if (!body) continue;
    const walker = (r instanceof Document ? r : r.ownerDocument).createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let acc = "";
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (!parent || !isVisible(parent)) continue;
      acc += " " + (n.nodeValue ?? "");
      if (norm(acc).toLowerCase().includes(want)) return true;
      if (acc.length > 4000) acc = acc.slice(-want.length * 2);
    }
  }
  return false;
}
