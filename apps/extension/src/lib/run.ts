// The run state machine, as pure functions over plain data so it can be unit-tested without Chrome.
// The service worker is the only caller and the only writer of the stored run.
import {
  checksFor, levelNote, outcomeOf, partState, promptsFor, stepsFor, throttle, independence,
  type AskedQuestion, type Level, type Levels, type Process, type Step,
} from "@spark/core";

export type Phase = "prompt" | "do" | "check" | "confirm";
export type StepResult = { id: string; type: Step["type"]; level?: Level; outcome: "right" | "miss" | "done" | "skipped"; seconds: number; hints: number; resolved?: boolean; note?: string | null };

export type Run = {
  runId: string;
  processId: string;
  department?: string;
  stepIds: string[];
  index: number;
  status: "active" | "complete" | "exited";
  startedAt: number;
  stepStartedAt: number;
  finishedAt?: number;
  // current step
  level?: Level;
  phase?: Phase;
  questions: AskedQuestion[];
  qi: number;
  picked?: number;
  wrongAnswers: number;
  askedHelp: boolean;
  mistakes: number;
  hints: number;
  spotlight: boolean;
  targetFound: boolean | null;
  resolved: boolean;
  feed: { kind: "mistake" | "note"; say: string }[];
  results: StepResult[];
  lastNote: string | null;
};

const now = () => Date.now();

export function newRun(process: Process, levels: Levels, department?: string, id: string = crypto.randomUUID()): Run {
  const steps = stepsFor(process, department);
  const run: Run = {
    runId: id, processId: process.id, ...(department ? { department } : {}), stepIds: steps.map((s) => s.id),
    index: 0, status: "active", startedAt: now(), stepStartedAt: now(),
    questions: [], qi: 0, wrongAnswers: 0, askedHelp: false, mistakes: 0, hints: 0,
    spotlight: false, targetFound: null, resolved: false, feed: [], results: [], lastNote: null,
  };
  enterStep(run, process, levels);
  return run;
}

export const stepOf = (run: Run, process: Process): Step | undefined => process.steps.find((s) => s.id === run.stepIds[run.index]);
const stepsOfRun = (run: Run, process: Process) => run.stepIds.map((id) => process.steps.find((s) => s.id === id)!).filter(Boolean);

export function enterStep(run: Run, process: Process, levels: Levels) {
  const step = stepOf(run, process);
  Object.assign(run, { stepStartedAt: now(), questions: [], qi: 0, picked: undefined, wrongAnswers: 0, askedHelp: false, mistakes: 0, hints: 0, feed: [], targetFound: null, resolved: false });
  if (!step) return;
  if (step.type !== "screen") { Object.assign(run, { level: undefined, phase: "confirm", spotlight: false }); return; }
  const level = partState(levels, process.id, step.id).level;
  run.level = level;
  if (level === 2) {
    run.questions = promptsFor(stepsOfRun(run, process), step);
    run.phase = run.questions.length ? "prompt" : "do";
  } else run.phase = "do";
  run.spotlight = level === 1 || (level === 2 && run.phase === "do");
}

/** The learner picked an answer. Returns true when the pick was right. */
export function pick(run: Run, n: number): boolean {
  const q = run.questions[run.qi];
  if (!q || run.picked !== undefined) return false;
  run.picked = n;
  const right = n === q.answer;
  if (!right) run.wrongAnswers += 1;
  return right;
}

/** Continue after an answer was shown. Moves to the next question, or on to the step / next step. */
export function next(run: Run, process: Process, levels: Levels): { advanced: boolean; levels: Levels } {
  if (run.picked === undefined) return { advanced: false, levels };
  run.picked = undefined;
  run.qi += 1;
  if (run.qi < run.questions.length) return { advanced: false, levels };
  if (run.phase === "prompt") { run.phase = "do"; run.spotlight = true; run.questions = []; run.qi = 0; return { advanced: false, levels }; }
  if (run.phase === "check") return { advanced: true, ...advance(run, process, levels) };
  return { advanced: false, levels };
}

/** The page check passed (or the learner confirmed "I did it"). */
export function passed(run: Run, process: Process, levels: Levels): { levels: Levels } {
  const step = stepOf(run, process);
  if (!step || run.status !== "active") return { levels };
  if (step.type !== "screen") return advance(run, process, levels);
  if (run.phase !== "do") return { levels };
  if (run.level === 1) {
    run.questions = checksFor(stepsOfRun(run, process), step);
    if (run.questions.length) { run.phase = "check"; run.qi = 0; run.spotlight = false; return { levels }; }
  }
  return advance(run, process, levels);
}

export function askHelp(run: Run) {
  if (run.phase !== "do") return;
  run.askedHelp = true;
  run.hints += 1;
  run.spotlight = true;
}

export function click(run: Run, process: Process, mistake: number) {
  const step = stepOf(run, process);
  if (!step || step.type !== "screen" || mistake < 0) return;
  const m = step.commonMistakes?.[mistake];
  if (!m) return;
  run.mistakes += 1;
  run.feed.push({ kind: "mistake", say: m.say });
}

/** "Less help": applies now, to this step. */
export function lessHelp(run: Run, process: Process, levels: Levels): Levels {
  const step = stepOf(run, process);
  if (!step || step.type !== "screen") return levels;
  const after = throttle(partState(levels, process.id, step.id), "less");
  const out: Levels = { ...levels, [process.id]: { ...levels[process.id], [step.id]: after } };
  run.level = after.level;
  run.questions = []; run.qi = 0; run.picked = undefined; run.phase = "do";
  run.spotlight = after.level <= 2;
  run.feed.push({ kind: "note", say: `Less help now: ${["", "Guide", "Prompt", "On call", "Off"][after.level]}` });
  return out;
}

export function advance(run: Run, process: Process, levels: Levels): { levels: Levels } {
  const step = stepOf(run, process);
  if (!step) return { levels };
  const seconds = Math.round((now() - run.stepStartedAt) / 1000);
  let out = levels;
  let note: string | null = null;
  if (step.type === "screen") {
    const level = run.level ?? 1;
    const outcome = outcomeOf(level, { wrongAnswers: run.wrongAnswers, askedHelp: run.askedHelp, mistakes: run.mistakes, retried: false });
    const before = partState(levels, process.id, step.id);
    const after = throttle(before, outcome);
    note = levelNote(before, after);
    out = { ...levels, [process.id]: { ...levels[process.id], [step.id]: after } };
    run.results.push({ id: step.id, type: "screen", level, outcome, seconds, hints: run.hints, resolved: run.resolved, note });
  } else {
    run.results.push({ id: step.id, type: step.type, outcome: "done", seconds, hints: 0 });
  }
  run.lastNote = note;
  run.index += 1;
  if (run.index >= run.stepIds.length) {
    run.status = "complete"; run.finishedAt = now(); run.spotlight = false; run.phase = undefined; run.questions = [];
  } else enterStep(run, process, out);
  return { levels: out };
}

/** Independence for the finished run: levels each screen step was run at. */
export const runIndependence = (run: Run) => independence(run.results.filter((r) => r.level).map((r) => r.level!));
