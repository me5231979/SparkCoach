// The coaching rules: four support levels, the throttle that moves a step between them, and the questions the
// app asks. Everything here is built from the published process and decided by code. The AI never sets a level.
// Ported from HCM Coach extension/src/lib/coach.ts (tested behavior), adapted to Spark's process format.
import type { Process, Question, ScreenStep, Step } from "./types.ts";

export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Record<Level, { name: string; says: string }> = {
  1: { name: "Guide", says: "I show you the step, then check it with you." },
  2: { name: "Prompt", says: "You tell me what comes next." },
  3: { name: "On call", says: "I stay quiet unless you ask." },
  4: { name: "Off", says: "You do it on your own." },
};

/** Where one screen step of one process stands, for one learner. */
export type PartState = { level: Level; streak: number };
/** processId → stepId → state */
export type Levels = Record<string, Record<string, PartState>>;
export const START: PartState = { level: 1, streak: 0 };

export type Outcome = "right" | "miss" | "less";

/** The throttle: two right in a row means less help, a miss means more, and the learner can always ask for less. */
export function throttle(s: PartState, outcome: Outcome): PartState {
  if (outcome === "less") return { level: Math.min(4, s.level + 1) as Level, streak: 0 };
  if (outcome === "miss") return { level: Math.max(1, s.level - 1) as Level, streak: 0 };
  const streak = s.streak + 1;
  return streak >= 2 && s.level < 4 ? { level: (s.level + 1) as Level, streak: 0 } : { level: s.level, streak };
}

/** The note shown on advance when a level changes, or null when it stays the same. */
export function levelNote(before: PartState, after: PartState): string | null {
  if (after.level > before.level) return `Less help next time: ${LEVELS[after.level].name}`;
  if (after.level < before.level) return `More help next time: ${LEVELS[after.level].name}`;
  return null;
}

export const partState = (levels: Levels, processId: string, stepId: string): PartState =>
  levels[processId]?.[stepId] ?? START;

/** A question ready to show: the right answer's index and the line shown after answering. */
export type AskedQuestion = { question: string; options: string[]; answer: number; why: string };

export const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Put the right option among the others in a fixed, step-specific place, so it is not always first. */
export function arrange(right: string, others: string[], seed: string): { options: string[]; answer: number } {
  const picked = [...new Set(others.filter((o) => o && o !== right))].slice(0, 2);
  const at = hash(seed) % (picked.length + 1);
  const options = [...picked];
  options.splice(at, 0, right);
  return { options, answer: at };
}

const screens = (steps: Step[]) => steps.filter((s): s is ScreenStep => s.type === "screen");
/** Other steps of this process, starting after this one, so the wrong options are real steps too. */
const othersOf = <T extends Step>(steps: T[], step: Step): T[] => {
  const i = steps.indexOf(step as T);
  return [...steps.slice(i + 1), ...steps.slice(0, Math.max(0, i))].filter((s) => s !== step);
};
const asked = (q: Question, fallbackWhy: string): AskedQuestion => ({ ...q, why: q.why ?? fallbackWhy });

/** Guide level, after the step: "how do you know it worked?". Authored wins; otherwise built from `expect`. */
export function howFor(steps: Step[], step: ScreenStep): AskedQuestion | null {
  if (step.quiz?.how) return asked(step.quiz.how, step.expect ?? step.why ?? "");
  if (!step.expect) return null;
  const others = othersOf(screens(steps), step).map((s) => s.expect ?? "");
  if (!others.some(Boolean)) return null;
  const { options, answer } = arrange(step.expect, others, step.id);
  return { question: "What should you see on the screen now?", options, answer, why: `${step.expect} That is how you know it worked.` };
}

/** The why, checked: this step's reason among the reasons for other steps in the same process. */
export function whyFor(steps: Step[], step: Step): AskedQuestion | null {
  if (step.type === "screen" && step.quiz?.why) return asked(step.quiz.why, step.why ?? "");
  if (!step.why) return null;
  const others = othersOf(steps, step).map((s) => s.why ?? "").filter(Boolean);
  if (!others.length) return null;
  const { options, answer } = arrange(step.why, others, step.id + ":why");
  return { question: "Why does this step matter?", options, answer, why: step.why };
}

/** Prompt level, before the step: "what comes next?", with real steps from this process as the other options. */
export function nextFor(steps: Step[], step: Step): AskedQuestion | null {
  if (step.type === "screen" && step.quiz?.next) return asked(step.quiz.next, step.why ?? step.instruction);
  const others = othersOf(steps, step).map((s) => s.title);
  if (!others.length) return null;
  const { options, answer } = arrange(step.title, others, step.id + ":next");
  return { question: "What comes next?", options, answer, why: step.why ?? step.instruction };
}

const present = (qs: (AskedQuestion | null)[]) => qs.filter((q): q is AskedQuestion => !!q);

/** Guide level, after the learner does the step: first the how, then the why. */
export const checksFor = (steps: Step[], step: ScreenStep): AskedQuestion[] => present([howFor(steps, step), whyFor(steps, step)]);

/** Prompt level, before the learner does the step: what comes next, then why it matters. */
export const promptsFor = (steps: Step[], step: Step): AskedQuestion[] => present([nextFor(steps, step), whyFor(steps, step)]);

/** The first thing to watch for on a step: a known mistake, else the first hint. */
export const watchFor = (step: ScreenStep): string | undefined => step.commonMistakes?.[0]?.say ?? step.hints?.[0];

/** Steps this learner sees, given their department (branching). */
export const stepsFor = (process: Process, department?: string): Step[] =>
  process.steps.filter((s) => !s.departments?.length || (department !== undefined && s.departments.includes(department)));

/**
 * The outcome of one completed screen step (COACHING-MODEL §3).
 * Levels 1–2: right only if every question was answered right first time.
 * Levels 3–4: right only if done without asking for help and without a known wrong click.
 * Any level: a failed completion check that needed a retry is a miss.
 */
export function outcomeOf(level: Level, e: { wrongAnswers: number; askedHelp: boolean; mistakes: number; retried: boolean }): "right" | "miss" {
  if (e.retried) return "miss";
  if (level <= 2) return e.wrongAnswers === 0 ? "right" : "miss";
  return !e.askedHelp && e.mistakes === 0 ? "right" : "miss";
}
