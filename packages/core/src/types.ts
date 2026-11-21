// Types for a Spark process: the unit a customer authors in Studio and a learner runs in the extension.
// Mirrors process.schema.json. Spark is a platform: these types say nothing about any one customer's process.

/** How Spark finds an element: the way a person would describe it, never by generated classes alone. */
export type Target = {
  /** ARIA role (implicit or explicit), e.g. "button", "textbox", "combobox". */
  role?: string;
  /** Accessible name: aria-label, aria-labelledby, <label>, or visible text. */
  name?: string;
  /** For fields: the field's visible label. */
  label?: string;
  /** Nearest headings / landmarks / dialog titles, outermost first. */
  context?: string[];
  /** Tie-breaker among equal matches, in document order. */
  nth?: number;
  /** A stable test id, if the system exposes one. */
  testId?: string;
  /** Last resort, author-verified CSS selector. */
  selector?: string;
  /** URL pattern of the iframe the target lives in, if any. */
  frame?: string;
};

/** Deterministic step-completion checks, evaluated on the page. Only true/false ever leaves the page. */
export type Check =
  | { type: "urlMatches"; pattern: string }
  | { type: "elementVisible"; target: Target }
  | { type: "elementGone"; target: Target }
  | { type: "textPresent"; text: string }
  | { type: "fieldValue"; target: Target; notEmpty?: true; equals?: string; matches?: string }
  | { type: "clicked"; target: Target }
  | { type: "all" | "any"; checks: Check[] };

/** An authored multiple-choice question. `answer` is the index of the right option. */
export type Question = { question: string; options: string[]; answer: number; why?: string };

export type CommonMistake = { when: { clicked: Target }; say: string };

type StepBase = {
  id: string;
  title: string;
  /** One instruction, plain words, at most 200 characters. */
  instruction: string;
  /** One line on why the step matters. */
  why?: string;
  /** Only show this step to learners in these departments (branching). */
  departments?: string[];
  hints?: string[];
};

export type ScreenStep = StepBase & {
  type: "screen";
  /** Where to look, in words ("In the Managers section"). */
  where?: string;
  /** What the learner should see once the step worked. Feeds the generated "how" check. */
  expect?: string;
  target: Target;
  /** How Spark knows the step is done. Without one, the learner confirms with "I did it". */
  check?: Check;
  commonMistakes?: CommonMistake[];
  /** Authored questions. They win over generated ones. */
  quiz?: { how?: Question; why?: Question; next?: Question };
};

export type CheckpointStep = StepBase & { type: "checkpoint"; confirm: string };

export type OfflineStep = StepBase & {
  type: "offline";
  confirm: string;
  contactRef?: string;
  allowSkip?: { label: string };
};

export type CallStep = StepBase & {
  type: "call";
  contactRef: string;
  prep: { goal: string; opener: string; pushbacks?: { if: string; try: string }[]; doThis?: string[] };
  debrief: { rubricRef: string };
};

export type Step = ScreenStep | CheckpointStep | OfflineStep | CallStep;
export type StepType = Step["type"];

export type Callout = {
  id: string;
  kind: "rule" | "tip" | "warning";
  say: string;
  /** Where the rule comes from (policy name, job aid). Shown to the learner. */
  source?: string;
  when: { step?: string; afterStep?: string; department?: string };
};

export type Reminder = { id: string; afterStep: string; delay: string; say: string; contactRef?: string };

export type Process = {
  id: string;
  title: string;
  goal: string;
  department?: string;
  /** Departments a learner can pick from when steps branch. */
  departments?: string[];
  /** Approved hostnames this process runs on. */
  systems: string[];
  estimatedMinutes?: number;
  /** URL path pattern the process starts on (for context launch). */
  startUrl?: string;
  steps: Step[];
  callouts?: Callout[];
  reminders?: Reminder[];
  recap: { summary: string; nextSteps?: string[] };
};
