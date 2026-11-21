import { describe, expect, it } from "vitest";
import { validateProcess } from "@spark/core/validate";
import { toProcess, type DraftOut } from "./draft.ts";

const t = (o: Partial<{ role: any; name: string | null; label: string | null; context: string[] }>) => ({ role: null, name: null, label: null, context: [], ...o });
const sample: DraftOut = {
  title: "Approve an invoice", goal: "Approve a supplier invoice correctly.", department: "Finance", estimated_minutes: 5,
  steps: [
    { type: "screen", title: "Open the invoice", instruction: "Click Open on the invoice.", why: "You approve from the invoice page.", where: "Invoices list", expect: "The invoice opens.",
      target: t({ role: "button", name: "Open", context: ["Invoices"] }), done_when: { kind: "page_changes", url_path_pattern: "^/invoices/[^/]+$", text: null, target: null }, confirm: null,
      common_mistake: { wrong_button_name: "Reject", say: "Reject sends it back. Use Approve." } },
    { type: "screen", title: "Set the cost center", instruction: "Fill in Cost Center.", why: "Costs land in the right budget.", where: null, expect: "Cost Center is filled.",
      target: t({ label: "Cost Center" }), done_when: { kind: "field_filled", url_path_pattern: null, text: null, target: t({ label: "Cost Center" }) }, confirm: null, common_mistake: null },
    { type: "screen", title: "Approve it", instruction: "Click Approve.", why: "Nothing is paid until you approve.", where: null, expect: "A banner says Approved.",
      target: null, done_when: null, confirm: null, common_mistake: null },
    { type: "offline", title: "Tell the requester", instruction: "Email the requester.", why: "They're waiting.", where: null, expect: null, target: null, done_when: null, confirm: "I emailed them", common_mistake: null },
  ],
  rules: [{ step_index: 1, kind: "rule", say: "Use the requester's cost center.", source: "Finance policy" }, { step_index: 9, kind: "tip", say: "x", source: null }],
  recap: { summary: "You approved an invoice.", next_steps: [] },
};

describe("toProcess", () => {
  it("converts a model draft into a valid Spark process", () => {
    const p = toProcess(sample, ["erp.example.com"]);
    const r = validateProcess(p);
    expect(r.ok ? [] : r.errors).toEqual([]);
    expect(p.steps.map((s) => s.type)).toEqual(["screen", "screen", "checkpoint", "offline"]); // no target → checkpoint
    expect(p.steps[0]).toMatchObject({ check: { type: "urlMatches" }, commonMistakes: [{ say: expect.stringContaining("Approve") }] });
    expect(p.steps[1]).toMatchObject({ check: { type: "fieldValue", notEmpty: true } });
    expect(p.callouts).toHaveLength(1); // out-of-range step index dropped
    expect(p.systems).toEqual(["erp.example.com"]);
  });
  it("clamps long text and de-duplicates step ids", () => {
    const long = { ...sample, steps: [sample.steps[3]!, { ...sample.steps[3]!, instruction: "y".repeat(400) }] };
    const p = toProcess(long, ["erp.example.com"]);
    expect(new Set(p.steps.map((s) => s.id)).size).toBe(2);
    expect(p.steps[1]!.instruction.length).toBe(200);
    expect(validateProcess(p).ok).toBe(true);
  });
});
