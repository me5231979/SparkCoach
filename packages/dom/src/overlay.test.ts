// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { OVERLAY_TAG, Overlay } from "./overlay.ts";

describe("Overlay", () => {
  it("shows a spotlight in a closed shadow root and hides it", () => {
    document.body.innerHTML = `<button>Save</button>`;
    const o = new Overlay();
    const btn = document.querySelector("button")!;
    o.show(btn, "Step 1", "Click Save", true);
    const host = document.querySelector(OVERLAY_TAG)!;
    expect(host).not.toBeNull();
    expect(host.shadowRoot).toBeNull(); // closed: page scripts can't reach in
    expect(o.state).toMatchObject({ target: btn, on: true, spotlight: true });
    o.hide();
    expect(o.state.on).toBe(false);
    o.destroy();
    expect(document.querySelector(OVERLAY_TAG)).toBeNull();
  });
});
