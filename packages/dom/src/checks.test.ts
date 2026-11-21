// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { runCheck, type CheckEnv } from "./checks.ts";
import { safePath, urlMatches } from "./url.ts";

const env = (href = "https://app.example.com/records/123?ssn=123-45-6789#edit", clicked: string[] = []): CheckEnv => ({
  doc: document, href, clicked: (t) => clicked.includes(t.name ?? ""),
});

describe("url", () => {
  it("drops query strings and replaces ids", () => {
    expect(safePath("https://x.com/records/123/edit?ssn=123")).toBe("/records/*/edit");
    expect(safePath("https://x.com/p/3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("/p/*");
  });
  it("never matches against the query string", () => {
    expect(urlMatches("ssn", "https://x.com/records/1?ssn=1")).toBe(false);
    expect(urlMatches("^/records/[^/]+$", "https://x.com/records/1?x=1")).toBe(true);
  });
});

describe("runCheck", () => {
  it("evaluates each check type", () => {
    document.body.innerHTML = `<div role="dialog"><h2>Change Owner</h2><label for="d">Effective Date</label><input id="d" value="2026-01-01"></div><p>Change submitted</p>`;
    expect(runCheck({ type: "urlMatches", pattern: "^/records/[^/]+" }, env())).toBe(true);
    expect(runCheck({ type: "elementVisible", target: { role: "dialog", name: "Change Owner" } }, env())).toBe(true);
    expect(runCheck({ type: "elementGone", target: { role: "dialog", name: "Change Owner" } }, env())).toBe(false);
    expect(runCheck({ type: "textPresent", text: "Change submitted" }, env())).toBe(true);
    expect(runCheck({ type: "fieldValue", target: { label: "Effective Date" }, notEmpty: true }, env())).toBe(true);
    expect(runCheck({ type: "clicked", target: { role: "button", name: "Save" } }, env(undefined, ["Save"]))).toBe(true);
    expect(runCheck({ type: "all", checks: [{ type: "textPresent", text: "Change submitted" }, { type: "textPresent", text: "nope" }] }, env())).toBe(false);
    expect(runCheck({ type: "any", checks: [{ type: "textPresent", text: "Change submitted" }, { type: "textPresent", text: "nope" }] }, env())).toBe(true);
  });
});
