// Validates a process: the JSON schema first, then cross-references the schema cannot express.
// Used by Studio on publish, by the server on every write, and by `npm run validate`.
import { Ajv } from "ajv";
import schema from "../process.schema.json" with { type: "json" };
import type { Check, Process, Target } from "./types.ts";

export { schema };

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

export type ValidationResult = { ok: true; process: Process } | { ok: false; errors: string[] };

export function validateProcess(data: unknown, known: { contacts?: string[]; rubrics?: string[] } = {}): ValidationResult {
  if (!validateSchema(data)) {
    const errors = (validateSchema.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
    return { ok: false, errors: [...new Set(errors)] };
  }
  const p = data as Process;
  const errors = crossCheck(p, known);
  return errors.length ? { ok: false, errors } : { ok: true, process: p };
}

function crossCheck(p: Process, known: { contacts?: string[]; rubrics?: string[] }): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const s of p.steps) {
    if (ids.has(s.id)) errors.push(`steps: duplicate step id "${s.id}"`);
    ids.add(s.id);
  }
  const depts = new Set(p.departments ?? []);
  for (const s of p.steps) {
    for (const d of s.departments ?? []) if (!depts.has(d)) errors.push(`steps/${s.id}: department "${d}" is not in the process's departments`);
    if (s.type === "screen") {
      for (const [k, q] of Object.entries(s.quiz ?? {})) {
        if (q && q.answer >= q.options.length) errors.push(`steps/${s.id}: quiz.${k} answer ${q.answer} is out of range`);
      }
      if (s.check) checkPatterns(s.check, `steps/${s.id}/check`, errors);
    }
    if ((s.type === "offline" || s.type === "call") && s.contactRef && known.contacts && !known.contacts.includes(s.contactRef))
      errors.push(`steps/${s.id}: unknown contact "${s.contactRef}"`);
    if (s.type === "call" && known.rubrics && !known.rubrics.includes(s.debrief.rubricRef))
      errors.push(`steps/${s.id}: unknown rubric "${s.debrief.rubricRef}"`);
  }
  const seen = new Set<string>();
  for (const c of p.callouts ?? []) {
    if (seen.has(c.id)) errors.push(`callouts: duplicate id "${c.id}"`);
    seen.add(c.id);
    for (const ref of [c.when.step, c.when.afterStep]) if (ref && !ids.has(ref)) errors.push(`callouts/${c.id}: unknown step "${ref}"`);
    if (c.when.department && !depts.has(c.when.department)) errors.push(`callouts/${c.id}: unknown department "${c.when.department}"`);
  }
  for (const r of p.reminders ?? []) if (!ids.has(r.afterStep)) errors.push(`reminders/${r.id}: unknown step "${r.afterStep}"`);
  return errors;
}

function checkPatterns(c: Check, at: string, errors: string[]) {
  const tryRe = (re: string, where: string) => { try { new RegExp(re); } catch { errors.push(`${where}: "${re}" is not a valid pattern`); } };
  if (c.type === "fieldValue" && c.matches) tryRe(c.matches, at);
  if (c.type === "all" || c.type === "any") c.checks.forEach((x, i) => checkPatterns(x, `${at}/checks/${i}`, errors));
}

/** Every target a process refers to, for health monitoring and the Studio target list. */
export function targetsOf(p: Process): { stepId: string; target: Target }[] {
  const out: { stepId: string; target: Target }[] = [];
  const fromCheck = (stepId: string, c: Check) => {
    if ("target" in c) out.push({ stepId, target: c.target });
    if (c.type === "all" || c.type === "any") c.checks.forEach((x) => fromCheck(stepId, x));
  };
  for (const s of p.steps) {
    if (s.type !== "screen") continue;
    out.push({ stepId: s.id, target: s.target });
    if (s.check) fromCheck(s.id, s.check);
    for (const m of s.commonMistakes ?? []) out.push({ stepId: s.id, target: m.when.clicked });
  }
  return out;
}
