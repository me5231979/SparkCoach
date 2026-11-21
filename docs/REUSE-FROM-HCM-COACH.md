# What to reuse from HCM Coach

HCM Coach (`me5231979/HCM_Coach`) is a separate, HCM-only product for Vanderbilt. Spark may **copy** proven code
from it into the new repo (Matchlight owns both), then evolve it. Do not import from the HCM Coach repo at runtime,
and never point Spark at HCM Coach's server, Vercel project, Blob store or access codes.

## Port (copy, then adapt)

| HCM Coach file | Spark destination | Notes |
|---|---|---|
| `extension/src/lib/coach.ts` | `packages/core/coaching.ts` | Levels, throttle, check/prompt generation (`checksFor`, `promptsFor`, `whyFor`, `arrange`). Keep tests |
| `extension/src/lib/dom.ts` | `packages/dom/targeting.ts` | `accName`, `findByRole`, `findField`; extend with context, nth, shadow DOM, frames, fuzzy |
| `extension/src/lib/checks.ts` | `packages/dom/checks.ts` | Add `elementGone`, `clicked`, `matches`; target-based checks |
| `extension/src/lib/overlay.ts` | `packages/dom/overlay.ts` | Spotlight + callout; closed shadow root |
| `extension/src/content.ts` | `apps/extension/src/content.ts` | Message protocol pattern (passed / click / idle / target found) |
| `extension/src/background.ts` | `apps/extension/src/background.ts` | Run state machine: enterStep, advance, confirm/pick/next/askHelp/lessHelp, say-back, reminders. Move throttle authority to the server |
| `extension/src/sidepanel/Guided.tsx` | `apps/extension/src/panel/Guided.tsx` | Level UIs, Meter, Options, Facts, SayBack |
| `extension/src/sidepanel/Coach.tsx`, `Recap.tsx`, `ui.tsx` (Icon, StepTitle, STEP_KIND) | `apps/extension/src/panel/*` | Step card, kind icons, toasts, recap |
| `extension/src/sidepanel/Search.tsx` | `apps/extension/src/panel/Ask.tsx` | Pop-up chat UI; local quote fallback when offline |
| `extension/src/sidepanel/App.tsx` (Tour, Setup patterns) | `apps/extension/src/panel/App.tsx` | Tour video modal; replace Setup with SSO |
| `extension/build.mjs` | `apps/extension/build.mjs` | **Network-call guard**, CSP, manifest generation, build modes |
| `web/app/api/coach/route.ts` | `apps/web/app/api/{ask,coach}/route.ts` + `packages/ai` | Grounded prompts, structured outputs, Anthropic + **Amplify** providers, source filtering, rate limit, redact |
| `web/app/api/progress/route.ts` | `apps/web/app/api/runs` (Postgres instead of Blob) | Record shape, history, independence score, retention |
| `web/app/progress/page.tsx`, `charts.tsx` | `apps/web/app/insight/*` | Dashboard and validated chart palette (dark) |
| `shared/lesson.schema.json`, `shared/types.ts` | `packages/core/process.schema.json` | Already generalized in this kit's `process.schema.json` |
| `scripts/validate-content.mjs` | `packages/core/validate.ts` | Schema + cross-reference validation |
| `scripts/e2e-*.mjs` | `e2e/*.spec.ts` | Patterns: load unpacked extension in Playwright, stand-in model server, privacy assertions |
| `scripts/check-amplify.mjs` | `packages/ai/test/amplify.test.ts` | Stand-in Amplify server |
| `scripts/tour-shots.mjs`, `tour-video.mjs`, `promo-video.mjs` | `tools/video/*` | Narrated tour + promo pipeline (ElevenLabs voice, Runway music, ffmpeg) |

## Leave behind

- HCM Academy guides, contacts and job aids (`web/guides`, `web/knowledge`, `web/contacts`): Vanderbilt content.
- The practice Oracle web app (`web/app/practice`): use it only as inspiration for Spark's fixture apps.
- Vanderbilt branding (lockup, gold palette, Caslon/Antonio fonts), the shared access-code model, the
  "cannot see the page" Guide build, and Blob-file progress storage (Spark uses Postgres).

## Proven behaviors to keep (tested in HCM Coach)

- Two right in a row → less help; a miss → more; "Less help" any time; meter on every step and process card.
- Guide shows → she does it → how check → why check. Prompt asks next → why → do.
- Chat answers only from loaded content, names sources, says "not in…" otherwise, sends history for follow-ups.
- AI never sets levels; server filters returned step ids and source names to real ones.
- Content updates apply between runs, never mid-run; offline uses the last good download.
