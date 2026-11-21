import { describe, expect, it } from "vitest";
import process from "../../../fixtures/processes/demo-change-owner.process.json" with { type: "json" };
import { arrange, checksFor, howFor, levelNote, nextFor, outcomeOf, promptsFor, START, stepsFor, throttle, whyFor, type PartState } from "./coaching.ts";
import type { Process, ScreenStep } from "./types.ts";

const p = process as Process;
const screen = (id: string) => p.steps.find((s) => s.id === id) as ScreenStep;

describe("throttle", () => {
  it("starts at Guide", () => expect(START).toEqual({ level: 1, streak: 0 }));
  it("needs two right in a row to step down", () => {
    const one = throttle(START, "right");
    expect(one).toEqual({ level: 1, streak: 1 });
    expect(throttle(one, "right")).toEqual({ level: 2, streak: 0 });
  });
  it("a miss means more help and resets the streak", () => {
    expect(throttle({ level: 3, streak: 1 }, "miss")).toEqual({ level: 2, streak: 0 });
    expect(throttle(START, "miss")).toEqual(START);
  });
  it("less help applies now and stops at Off", () => {
    expect(throttle({ level: 2, streak: 1 }, "less")).toEqual({ level: 3, streak: 0 });
    expect(throttle({ level: 4, streak: 0 }, "less")).toEqual({ level: 4, streak: 0 });
  });
  it("stays at Off when right", () => {
    let s: PartState = { level: 4, streak: 0 };
    s = throttle(throttle(s, "right"), "right");
    expect(s.level).toBe(4);
  });
  it("walks from Guide to Off in six right answers", () => {
    let s = START;
    for (let i = 0; i < 6; i++) s = throttle(s, "right");
    expect(s.level).toBe(4);
  });
});

describe("levelNote", () => {
  it("names the new level", () => {
    expect(levelNote({ level: 1, streak: 1 }, { level: 2, streak: 0 })).toBe("Less help next time: Prompt");
    expect(levelNote({ level: 2, streak: 0 }, { level: 1, streak: 0 })).toBe("More help next time: Guide");
    expect(levelNote(START, { level: 1, streak: 1 })).toBeNull();
  });
});

describe("arrange", () => {
  it("is stable for a seed and keeps the right answer", () => {
    const a = arrange("right", ["x", "y", "z"], "seed");
    expect(a).toEqual(arrange("right", ["x", "y", "z"], "seed"));
    expect(a.options).toHaveLength(3);
    expect(a.options[a.answer]).toBe("right");
  });
  it("drops duplicates and the right answer from the others", () => {
    const a = arrange("r", ["r", "a", "a", ""], "s");
    expect(a.options.sort()).toEqual(["a", "r"]);
  });
});

describe("questions", () => {
  it("builds a how check from expect, with other steps' expects as distractors", () => {
    const q = howFor(p.steps, screen("start-edit"))!;
    expect(q.options[q.answer]).toBe("A Change Owner form opens.");
    for (const o of q.options) expect(p.steps.some((s) => s.type === "screen" && s.expect === o)).toBe(true);
  });
  it("builds a why check from other steps' whys", () => {
    const q = whyFor(p.steps, screen("reason"))!;
    expect(q.options[q.answer]).toBe(screen("reason").why);
  });
  it("authored quiz wins", () => {
    const step: ScreenStep = { ...screen("reason"), quiz: { how: { question: "Q?", options: ["a", "b"], answer: 1 } } };
    expect(howFor(p.steps, step)).toEqual({ question: "Q?", options: ["a", "b"], answer: 1, why: step.expect });
  });
  it("what comes next uses step titles", () => {
    const q = nextFor(p.steps, screen("submit"))!;
    expect(q.options[q.answer]).toBe("Submit the change");
  });
  it("Guide asks how then why; Prompt asks next then why", () => {
    expect(checksFor(p.steps, screen("submit")).map((q) => q.question)).toEqual(["What should you see on the screen now?", "Why does this step matter?"]);
    expect(promptsFor(p.steps, screen("submit")).map((q) => q.question)).toEqual(["What comes next?", "Why does this step matter?"]);
  });
});

describe("outcomes and branching", () => {
  it("Guide/Prompt: right only with no wrong answers", () => {
    expect(outcomeOf(1, { wrongAnswers: 0, askedHelp: false, mistakes: 0, retried: false })).toBe("right");
    expect(outcomeOf(2, { wrongAnswers: 1, askedHelp: false, mistakes: 0, retried: false })).toBe("miss");
  });
  it("On call/Off: asking for help or a known wrong click is a miss", () => {
    expect(outcomeOf(3, { wrongAnswers: 0, askedHelp: true, mistakes: 0, retried: false })).toBe("miss");
    expect(outcomeOf(4, { wrongAnswers: 0, askedHelp: false, mistakes: 1, retried: false })).toBe("miss");
    expect(outcomeOf(4, { wrongAnswers: 0, askedHelp: false, mistakes: 0, retried: false })).toBe("right");
  });
  it("a retried check is a miss at any level", () => {
    expect(outcomeOf(1, { wrongAnswers: 0, askedHelp: false, mistakes: 0, retried: true })).toBe("miss");
  });
  it("filters steps by department", () => {
    const branched: Process = { ...p, steps: [...p.steps, { id: "fin", type: "checkpoint", title: "t", instruction: "i", confirm: "ok", departments: ["Finance"] }] };
    expect(stepsFor(branched, "Operations").some((s) => s.id === "fin")).toBe(false);
    expect(stepsFor(branched, "Finance").some((s) => s.id === "fin")).toBe(true);
  });
});
