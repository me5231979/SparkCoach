import { describe, expect, it } from "vitest";
import type { Levels, Process } from "@spark/core";
import demo from "../../../../fixtures/processes/demo-change-owner.process.json" with { type: "json" };
import * as R from "./run.ts";

const p = demo as Process;
const at = (levels: Levels, stepId: string, level: 1 | 2 | 3 | 4): Levels => ({ ...levels, [p.id]: { ...levels[p.id], [stepId]: { level, streak: 0 } } });

describe("run state machine", () => {
  it("Guide: spotlight, then how + why checks after the step, then advance", () => {
    let levels: Levels = {};
    const run = R.newRun(p, levels, "Operations", "r1");
    expect(run).toMatchObject({ index: 0, level: 1, phase: "do", spotlight: true });
    levels = R.passed(run, p, levels).levels;
    expect(run.phase).toBe("check");
    expect(run.questions.map((q) => q.question)).toEqual(["What should you see on the screen now?", "Why does this step matter?"]);
    R.pick(run, run.questions[0]!.answer); levels = R.next(run, p, levels).levels;
    R.pick(run, run.questions[1]!.answer); levels = R.next(run, p, levels).levels;
    expect(run.index).toBe(1);
    expect(run.results[0]).toMatchObject({ id: "open-record", level: 1, outcome: "right" });
    expect(levels[p.id]!["open-record"]).toEqual({ level: 1, streak: 1 });
  });

  it("a wrong answer is a miss", () => {
    let levels: Levels = {};
    const run = R.newRun(p, levels, undefined, "r2");
    levels = R.passed(run, p, levels).levels;
    const q = run.questions[0]!;
    R.pick(run, (q.answer + 1) % q.options.length); levels = R.next(run, p, levels).levels;
    R.pick(run, run.questions[1]!.answer); levels = R.next(run, p, levels).levels;
    expect(run.results[0]!.outcome).toBe("miss");
  });

  it("Prompt: asks what comes next before the step, then spotlights", () => {
    let levels = at({}, "open-record", 2);
    const run = R.newRun(p, levels, undefined, "r3");
    expect(run).toMatchObject({ level: 2, phase: "prompt", spotlight: false });
    expect(run.questions[0]!.question).toBe("What comes next?");
    for (const q of [...run.questions]) { R.pick(run, q.answer); levels = R.next(run, p, levels).levels; }
    expect(run).toMatchObject({ phase: "do", spotlight: true });
    levels = R.passed(run, p, levels).levels;
    expect(run.index).toBe(1);
  });

  it("On call: no spotlight until asked; asking is a miss", () => {
    let levels = at({}, "open-record", 3);
    const run = R.newRun(p, levels, undefined, "r4");
    expect(run.spotlight).toBe(false);
    R.askHelp(run);
    expect(run.spotlight).toBe(true);
    levels = R.passed(run, p, levels).levels;
    expect(run.results[0]).toMatchObject({ level: 3, outcome: "miss" });
    expect(levels[p.id]!["open-record"]!.level).toBe(2);
  });

  it("Off: a known wrong click is a miss and shows the coaching line", () => {
    let levels = at(at({}, "open-record", 4), "start-edit", 4);
    const run = R.newRun(p, levels, undefined, "r5");
    levels = R.passed(run, p, levels).levels;
    expect(run.results[0]!.outcome).toBe("right");
    R.click(run, p, 0);
    expect(run.feed[0]!.say).toContain("Edit Details");
    levels = R.passed(run, p, levels).levels;
    expect(run.results[1]).toMatchObject({ id: "start-edit", outcome: "miss" });
  });

  it("Less help applies now", () => {
    const levels = R.lessHelp(R.newRun(p, {}, undefined, "r6"), p, {});
    expect(levels[p.id]!["open-record"]!.level).toBe(2);
  });

  it("off-screen steps confirm and the run completes", () => {
    let levels: Levels = {};
    for (const s of p.steps) if (s.type === "screen") levels = at(levels, s.id, 4);
    const run = R.newRun(p, levels, undefined, "r7");
    while (run.status === "active") levels = R.passed(run, p, levels).levels;
    expect(run.results.at(-1)).toMatchObject({ id: "tell-owner", type: "offline", outcome: "done" });
    expect(R.runIndependence(run)).toBe(100);
  });
});
