// Step-completion checks, evaluated in the page. Deterministic; only true/false is ever reported.
// Ported from HCM Coach extension/src/lib/checks.ts and extended with elementGone, clicked, matches and targets.
import type { Check, Target } from "@spark/core";
import { fieldMatches, isVisible, phraseVisible, resolve } from "./targeting.ts";
import { urlMatches } from "./url.ts";

export type CheckEnv = {
  doc: Document;
  href: string;
  /** Targets the learner activated since the step began (click / Enter / Space), resolved at click time. */
  clicked: (t: Target) => boolean;
};

export function runCheck(check: Check, env: CheckEnv): boolean {
  switch (check.type) {
    case "urlMatches": return urlMatches(check.pattern, env.href);
    case "elementVisible": { const r = resolve(check.target, env.doc); return !!r && isVisible(r.el); }
    case "elementGone": return resolve(check.target, env.doc) === null;
    case "textPresent": return phraseVisible(check.text, env.doc);
    case "fieldValue": {
      const r = resolve(check.target, env.doc);
      return !!r && fieldMatches(r.el, { ...(check.notEmpty ? { notEmpty: true as const } : {}), ...(check.equals !== undefined ? { equals: check.equals } : {}), ...(check.matches !== undefined ? { matches: check.matches } : {}) });
    }
    case "clicked": return env.clicked(check.target);
    case "all": return check.checks.every((c) => runCheck(c, env));
    case "any": return check.checks.some((c) => runCheck(c, env));
  }
}
