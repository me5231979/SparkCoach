import { describe, expect, it } from "vitest";
import process from "../../../fixtures/processes/demo-change-owner.process.json" with { type: "json" };
import { targetsOf, validateProcess } from "./validate.ts";

const clone = () => structuredClone(process) as any;

describe("validateProcess", () => {
  it("accepts the demo process", () => {
    const r = validateProcess(process);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });
  it("rejects a screen step without a target", () => {
    const p = clone(); delete p.steps[0].target;
    expect(validateProcess(p).ok).toBe(false);
  });
  it("rejects a target with no usable locator", () => {
    const p = clone(); p.steps[0].target = { context: ["Records"] };
    expect(validateProcess(p).ok).toBe(false);
  });
  it("rejects instructions over 200 characters", () => {
    const p = clone(); p.steps[0].instruction = "x".repeat(201);
    expect(validateProcess(p).ok).toBe(false);
  });
  it("rejects unknown check types and wildcard systems", () => {
    const p = clone(); p.steps[0].check = { type: "screenshot" };
    expect(validateProcess(p).ok).toBe(false);
    const q = clone(); q.systems = ["*.example.com"];
    expect(validateProcess(q).ok).toBe(false);
  });
  it("finds duplicate step ids and dangling references", () => {
    const p = clone(); p.steps[1].id = p.steps[0].id; p.callouts[0].when.step = "nope";
    const r = validateProcess(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("duplicate step id"))).toBe(true);
      expect(r.errors.some((e) => e.includes('unknown step "nope"'))).toBe(true);
    }
  });
  it("checks contact references when contacts are known", () => {
    const p = clone(); p.steps[6].contactRef = "ghost";
    const r = validateProcess(p, { contacts: ["hr"] });
    expect(r.ok).toBe(false);
  });
  it("lists every target", () => {
    const t = targetsOf(process as any);
    expect(t.filter((x) => x.stepId === "start-edit")).toHaveLength(3);
  });
});
