# Spark roadmap

Assumes 2 engineers (one strong in extensions/DOM, one full-stack) plus a part-time designer and a Matchlight
delivery lead. Estimates are calendar weeks.

## Phase 0: Foundations (weeks 1–2)
- Monorepo, CI (typecheck, unit, Playwright), Vercel project + preview deploys, Neon Postgres, Blob, Sentry.
- `packages/core`: process schema + validator, types, **throttle and check generation** with
  their tests.
- Extension skeleton (side panel, SW, content script) with the build guard and CSP.
- Fixture apps: a mock "Oracle-like" and "UKG-like" web app for CI.
- **Done when:** a hard-coded process runs in the extension on a fixture app at Guide level, with tests green.

## Phase 1: Screen-aware coach (weeks 3–6)
- `packages/dom`: targeting (role/name/label/context/nth, shadow DOM, frames, fuzzy), checks incl. `fieldValue`
  evaluated locally, overlay/spotlight, wrong-click coaching.
- Coaching model end to end: four levels, throttle, how/why checks, prompt level, say-back, recap.
- Off-screen steps: checkpoint, offline with contacts, call prep/debrief.
- Privacy suite v1 (blocking).
- **Done when:** the example process (`examples/change-manager.process.json`) runs on the Oracle-like fixture with
  automatic step detection ≥ 95%, and the privacy suite passes.

## Phase 2: Platform (weeks 5–9, overlaps)
- Multi-tenant data model + RLS; SSO (WorkOS) for web and extension; roles; approved domains + optional permissions.
- `/api/content`, `/api/runs` (server-side throttle), `/api/me/levels`, offline queue.
- AI provider adapter (Anthropic default + customer gateway, e.g. Azure OpenAI), Ask and coach endpoints, eval harness.
- **Done when:** two demo orgs are isolated (cross-tenant tests), a learner signs in with SSO and her levels sync
  across two machines.

## Phase 3: Studio (weeks 8–13)
- Process list/editor (text, steps, targets with "pick on page", checks, callouts, mistakes, quiz), validation,
  preview mode, publish/versioning/rollback, review workflow.
- Recorder in the extension + `/api/recordings`; AI drafting; PII warnings on captured strings.
- Attachments for Ask (text extraction).
- Target health monitoring + "re-capture step".
- **Done when:** an author records a 10-step process on a fixture app and publishes it in < 45 minutes, and ≥ 90% of
  targets replay.

## Phase 4: Insight (weeks 11–14)
- Dashboard : independence curves, help levels, most-missed, readiness,
  filters (team/process/date), CSV; manager scoping; retention job; delete-person.
- **Done when:** a manager sees only her team; numbers reconcile with raw runs in tests.

## Phase 5: Real systems and pilot (weeks 13–18)
- Adapters + fixture suites for the pilot customer's first two systems, using their test tenants.
- Chrome Web Store (unlisted) + Edge Add-ons; enterprise install guide (force-install + runtime_allowed_hosts).
- Tour video + install job aid.
- Security one-pager, privacy policy, DPA, pen test.
- Pilot with 1 customer: 10 processes, 20–50 learners, success review at week 8 of pilot.
- **Done when:** pilot metrics in PRD §10 are measured, and a go/no-go for GA is made.

## Phase 6: GA and scale (after pilot)
- More adapters (Workday, ServiceNow, Salesforce), assignments and due dates, refreshers, xAPI/LMS export, SCIM,
  data residency, SOC 2 Type I → II, localization.

## Team and budget (indicative)
- 18 weeks to pilot-ready with 2 engineers + part-time design/delivery: roughly $150–250k fully loaded.
- Run cost target < $2 per active learner per month (hosting + AI with prompt caching).

## Definition of done (every feature)
- Typecheck, unit tests, Playwright e2e on fixture apps, privacy suite green.
- Accessibility: keyboard path and screen-reader labels checked.
- Docs: user-facing copy in plain words; API.md updated if routes change.
