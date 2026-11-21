import { describe, expect, it } from "vitest";
import { independence, isReady, meterLabel } from "./record.ts";

describe("training record", () => {
  it("independence maps Guide 0%, Prompt 33%, On call 67%, Off 100%", () => {
    expect(independence([1])).toBe(0);
    expect(independence([2])).toBe(33);
    expect(independence([3])).toBe(67);
    expect(independence([4])).toBe(100);
    expect(independence([1, 4])).toBe(50);
    expect(independence([])).toBe(0);
  });
  it("ready needs two consecutive completed runs at Off", () => {
    const off = { status: "completed" as const, levels: [4, 4] as (1 | 2 | 3 | 4)[] };
    expect(isReady([off])).toBe(false);
    expect(isReady([off, off])).toBe(true);
    expect(isReady([off, { status: "completed", levels: [4, 3] }])).toBe(false);
    expect(isReady([off, off, { status: "abandoned", levels: [1] }])).toBe(true);
  });
  it("meter labels", () => {
    expect(meterLabel([1, 1])).toBe("New: full support");
    expect(meterLabel([2, 2])).toBe("Learning: mostly Prompt");
    expect(meterLabel([4, 3])).toBe("Mostly on your own");
  });
});
