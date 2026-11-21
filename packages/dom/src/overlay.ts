// Spotlight (dimmed page with a cut-out and a pulsing ring) plus a small callout bubble ("Click Save").
// Rendered in a closed shadow root so page styles and scripts cannot touch it. Never blocks clicks on the page.
// Neutral tokens until the Spark brand is set.
const CSS_TEXT = `
:host { all: initial; }
.ring { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: 10px; opacity: 0;
  border: 2px solid var(--spark-accent, #3b5bdb); box-shadow: 0 0 0 3px rgba(59,91,219,.35), 0 6px 22px rgba(0,0,0,.18);
  transition: top .18s ease, left .18s ease, width .18s ease, height .18s ease, opacity .18s ease, box-shadow .18s ease; }
.ring.on { opacity: 1; }
.ring.spot { box-shadow: 0 0 0 4px rgba(59,91,219,.55), 0 0 0 9999px rgba(15,18,30,.45); animation: pulse 1.4s ease-in-out 3; }
.tip { position: fixed; z-index: 2147483647; pointer-events: none; opacity: 0; max-width: 280px;
  background: #11131a; color: #fff; border-radius: 8px; padding: 7px 11px 8px;
  font: 500 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.28);
  transition: top .18s ease, left .18s ease, opacity .18s ease; }
.tip.on { opacity: 1; }
.tip b { display: block; color: #9db0ff; font: 700 10px/1.2 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
@media (prefers-reduced-motion: reduce) { .ring, .tip { transition: none; } .ring.spot { animation: none; } }
`;

export const OVERLAY_TAG = "spark-coach-overlay";

export class Overlay {
  private host: HTMLElement | null = null;
  private ring!: HTMLDivElement;
  private tip!: HTMLDivElement;
  private target: Element | null = null;
  private timer: number | undefined;
  private readonly onMove = () => this.place();

  constructor(private readonly doc: Document = document) {}

  /** For tests: whether the spotlight is showing on an element. */
  get state() {
    return { target: this.target, on: !!this.host && this.ring.classList.contains("on"), spotlight: !!this.host && this.ring.classList.contains("spot") };
  }

  private mount() {
    if (this.host?.isConnected) return;
    this.host = this.doc.createElement(OVERLAY_TAG);
    this.host.setAttribute("data-spark", "overlay");
    const root = this.host.attachShadow({ mode: "closed" });
    const style = this.doc.createElement("style");
    style.textContent = CSS_TEXT;
    this.ring = this.doc.createElement("div"); this.ring.className = "ring";
    this.tip = this.doc.createElement("div"); this.tip.className = "tip"; this.tip.setAttribute("aria-hidden", "true");
    root.append(style, this.ring, this.tip);
    this.doc.documentElement.append(this.host);
    const win = this.doc.defaultView!;
    win.addEventListener("scroll", this.onMove, { capture: true, passive: true });
    win.addEventListener("resize", this.onMove, { passive: true });
  }

  show(target: Element | null, label: string, text: string, spotlight: boolean, accent?: string) {
    if (!target) { this.hide(); return; }
    this.mount();
    if (accent && /^#[0-9a-f]{6}$/i.test(accent)) this.host!.style.setProperty("--spark-accent", accent);
    const changed = target !== this.target;
    this.target = target;
    const b = this.doc.createElement("b"); b.textContent = label;
    this.tip.replaceChildren(b, this.doc.createTextNode(text));
    const wasSpot = this.ring.classList.contains("spot");
    this.ring.classList.toggle("spot", spotlight);
    if (spotlight && (!wasSpot || changed) && typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "center", behavior: "smooth" });
    this.place();
    this.ring.classList.add("on"); this.tip.classList.add("on");
    this.host!.setAttribute("data-on", "true");
    if (this.timer === undefined) this.timer = this.doc.defaultView!.setInterval(this.onMove, 250);
  }

  hide() {
    this.target = null;
    if (!this.host) return;
    this.ring.classList.remove("on", "spot"); this.tip.classList.remove("on");
    this.host.removeAttribute("data-on");
    if (this.timer !== undefined) { this.doc.defaultView!.clearInterval(this.timer); this.timer = undefined; }
  }

  destroy() {
    this.hide();
    const win = this.doc.defaultView;
    win?.removeEventListener("scroll", this.onMove, { capture: true });
    win?.removeEventListener("resize", this.onMove);
    this.host?.remove();
    this.host = null;
  }

  private place() {
    const t = this.target;
    if (!t || !t.isConnected) { if (this.host) { this.ring.classList.remove("on"); this.tip.classList.remove("on"); } return; }
    const r = t.getBoundingClientRect();
    const pad = 5;
    const win = this.doc.defaultView!;
    Object.assign(this.ring.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const tipH = this.tip.offsetHeight || 44, tipW = this.tip.offsetWidth || 200;
    const below = r.bottom + pad + 10 + tipH < win.innerHeight;
    const top = below ? r.bottom + pad + 10 : Math.max(8, r.top - pad - 10 - tipH);
    const left = Math.min(Math.max(8, r.left - pad), Math.max(8, win.innerWidth - tipW - 8));
    Object.assign(this.tip.style, { top: `${top}px`, left: `${left}px` });
  }
}
