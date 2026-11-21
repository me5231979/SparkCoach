// Training-record math. Deterministic, shared by the extension (display) and the server (source of truth).
import type { Level } from "./coaching.ts";

/** Independence for one run: mean over screen steps of (level − 1) / 3, as a whole percentage. */
export function independence(levels: Level[]): number {
  if (!levels.length) return 0;
  const mean = levels.reduce((sum, l) => sum + (l - 1) / 3, 0) / levels.length;
  return Math.round(mean * 100);
}

/** Ready = every screen step at Off for two consecutive completed runs. Runs are oldest first. */
export function isReady(runs: { status: "completed" | "abandoned"; levels: Level[] }[]): boolean {
  const done = runs.filter((r) => r.status === "completed");
  const lastTwo = done.slice(-2);
  return lastTwo.length === 2 && lastTwo.every((r) => r.levels.length > 0 && r.levels.every((l) => l === 4));
}

/** The support meter label on a process card (PRD L2). */
export function meterLabel(levels: Level[]): string {
  if (!levels.length || levels.every((l) => l === 1)) return "New: full support";
  const mean = levels.reduce<number>((a, b) => a + b, 0) / levels.length;
  return mean >= 3 ? "Mostly on your own" : "Learning: mostly Prompt";
}
