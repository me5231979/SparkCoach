// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { accName, contextOf, describe as describeEl, fieldLabel, fieldMatches, phraseVisible, resolve, similarity } from "./targeting.ts";

const html = (s: string) => { document.body.innerHTML = s; };
const $ = (sel: string) => document.querySelector(sel)!;

beforeEach(() => html(""));

describe("names and labels", () => {
  it("computes accessible names", () => {
    html(`<button aria-label="Close dialog">x</button><button>  Save  and Close </button>
      <span id="l">Effective Date</span><input id="d" aria-labelledby="l"><input type="submit" value="Submit">`);
    const [a, b] = document.querySelectorAll("button");
    expect(accName(a!)).toBe("Close dialog");
    expect(accName(b!)).toBe("Save and Close");
    expect(accName($("#d"))).toBe("Effective Date");
    expect(accName($("input[type=submit]"))).toBe("Submit");
  });
  it("never uses a field's value as its name", () => {
    html(`<label for="n">Employee Name</label><input id="n" value="Jane Q. Public">`);
    expect(fieldLabel($("#n"))).toBe("Employee Name");
    expect(accName($("#n"))).toBe("Employee Name");
  });
  it("strips nested controls from label text", () => {
    html(`<label>Reason <select><option>Reassignment</option></select></label>`);
    expect(fieldLabel($("select"))).toBe("Reason");
  });
});

describe("context", () => {
  it("lists section titles outermost first", () => {
    html(`<main aria-label="Records"><section><h2>Owner</h2><div><button>Change Owner</button></div></section></main>`);
    expect(contextOf($("button"))).toEqual(["Records", "Owner"]);
  });
});

describe("resolve", () => {
  it("prefers role + name within context and honours nth", () => {
    html(`<section><h2>Managers</h2><button>Save</button></section><section><h2>Address</h2><button>Save</button><button>Save</button></section>`);
    const all = document.querySelectorAll("button");
    expect(resolve({ role: "button", name: "Save", context: ["Address"] })?.el).toBe(all[1]);
    expect(resolve({ role: "button", name: "Save", context: ["Address"], nth: 1 })?.el).toBe(all[2]);
    expect(resolve({ role: "button", name: "Save", context: ["Address"] })?.strategy).toBe("roleNameContext");
  });
  it("falls back to anywhere when the context has changed", () => {
    html(`<section><h2>Renamed</h2><button>Save</button></section>`);
    expect(resolve({ role: "button", name: "Save", context: ["Managers"] })?.strategy).toBe("roleName");
  });
  it("finds fields by label", () => {
    html(`<form aria-label="Change Owner"><label for="e">Effective Date</label><input id="e" type="date"></form>`);
    expect(resolve({ label: "Effective Date", context: ["Change Owner"] })?.el).toBe($("#e"));
  });
  it("uses testId first", () => {
    html(`<button>Save</button><button data-testid="save-main">Save</button>`);
    expect(resolve({ testId: "save-main", role: "button", name: "Save" })?.el).toBe(document.querySelectorAll("button")[1]);
  });
  it("skips hidden elements", () => {
    html(`<div hidden><button>Save</button></div><button style="display:none">Save</button>`);
    expect(resolve({ role: "button", name: "Save" })).toBeNull();
  });
  it("fuzzy-matches small wording changes, not different buttons", () => {
    html(`<button>Save &amp; Close</button>`);
    expect(resolve({ role: "button", name: "Save and Close" })?.strategy).toBe("fuzzy");
    expect(resolve({ role: "button", name: "Cancel" })).toBeNull();
    expect(similarity("Save and Close", "Save & Close")).toBe(1);
  });
  it("walks open shadow roots", () => {
    html(`<div id="host"></div>`);
    const root = $("#host").attachShadow({ mode: "open" });
    root.innerHTML = `<section><h2>Owner</h2><button>Change Owner</button></section>`;
    const r = resolve({ role: "button", name: "Change Owner", context: ["Owner"] });
    expect(r?.el.textContent).toBe("Change Owner");
  });
  it("finds dialogs by their title", () => {
    html(`<div role="dialog"><h2>Change Owner</h2></div>`);
    expect(resolve({ role: "dialog", name: "Change Owner" })).not.toBeNull();
  });
});

describe("local-only checks", () => {
  it("fieldMatches returns a boolean for notEmpty / equals / matches", () => {
    html(`<input id="a" value=""><input id="b" value="2026-01-01"><select id="c"><option value="">Pick</option><option value="R" selected>Reassignment</option></select>`);
    expect(fieldMatches($("#a"), { notEmpty: true })).toBe(false);
    expect(fieldMatches($("#b"), { notEmpty: true })).toBe(true);
    expect(fieldMatches($("#b"), { matches: "^\\d{4}-\\d{2}-\\d{2}$" })).toBe(true);
    expect(fieldMatches($("#c"), { equals: "Reassignment" })).toBe(true);
    expect(fieldMatches($("#c"), { equals: "Other" })).toBe(false);
  });
  it("phraseVisible sees visible text only", () => {
    html(`<div role="status">Change submitted</div><div hidden>Secret banner</div>`);
    expect(phraseVisible("change submitted")).toBe(true);
    expect(phraseVisible("Secret banner")).toBe(false);
  });
});

describe("Recorder describe()", () => {
  it("captures structure, never values", () => {
    html(`<section><h2>Change Owner</h2><label for="o">New Owner</label><input id="o" value="Jane Q. Public" data-testid="owner"></section>`);
    const t = describeEl($("#o"));
    expect(t).toEqual({ label: "New Owner", role: "textbox", context: ["Change Owner"], testId: "owner" });
    expect(JSON.stringify(t)).not.toContain("Jane");
  });
  it("adds nth when needed to replay the same element", () => {
    html(`<section><h2>Rows</h2><button>View</button><button>View</button></section>`);
    const second = document.querySelectorAll("button")[1]!;
    const t = describeEl(second);
    expect(t.nth).toBe(1);
    expect(resolve(t)?.el).toBe(second);
  });
});
