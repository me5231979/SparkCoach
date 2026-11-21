# Spark API contract

Base: `https://<spark-api-origin>/api`. JSON in and out. All routes are org-scoped by the caller's token; the
server sets the Postgres RLS context from it. Errors: `{ error: "plain sentence" }` with 400/401/403/404/409/429/5xx.

## Auth

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/auth/extension/start?org=<slug>` | extension | Starts SSO (opens a tab); returns to `/auth/extension/done` |
| POST | `/auth/extension/token` | extension | Exchanges the one-time code for `{ token, expiresAt, user: { id, name, email, roles }, org: { id, name, approvedDomains, branding } }` |
| POST | `/auth/extension/refresh` | extension | New token before expiry |

Extension token: short-lived JWT (1 h) + refresh (30 d, rotating), audience `spark-extension`, claims `org`, `sub`, `roles`.
Web uses session cookies (WorkOS/Auth.js).

## Learner (extension)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/content?since=<hash>` | | `{ hash, processes: ProcessVersion[], contacts, rubrics }` or 304 |
| GET | `/me/levels` | | `{ [processId]: { [stepId]: { level, streak } } }` |
| POST | `/runs` | `{ runId, processId, version, startedAt, finishedAt, status, steps: [{ id, type, level?, outcome, seconds, hints, resolved? }] }` | `{ ok, levels, readiness }`. Idempotent on `runId`. Server applies the throttle (source of truth) and returns new levels |
| POST | `/ask` | `{ processId?, stepId?, question, history: [{ role, text }] }` (≤ 6 turns) | `{ found, text, sources: string[] }` |
| POST | `/coach` | `{ action: "explain"|"why"|"sayback", processId, stepId?, stepIds?, text? }` | `{ text }` or `{ text, covered, missed }` |
| POST | `/health` | `[{ processId, version, stepId, resolved, strategy, ms }]` (batched) | `{ ok }` |

Rate limits per user: Ask/coach 40 per 10 min; runs 120 per hour.

## Studio (web, author role)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/processes` | List / create |
| GET/PATCH | `/processes/:id` | Read / update draft |
| POST | `/processes/:id/publish` | Validate against `process.schema.json` and publish a new version |
| GET | `/processes/:id/versions` | History; `POST /processes/:id/versions/:v/restore` |
| POST | `/recordings` | Start a session `{ processId, system }` → `{ recordingId, recordToken }` (token used by the extension) |
| POST | `/recordings/:id/steps` | Extension posts captured draft steps (structure only) |
| POST | `/recordings/:id/draft` | AI drafts wording + checks from the recording and attachments → draft steps |
| POST | `/attachments` | Upload a job aid (PDF/DOCX/MD) → text extracted for Ask |
| GET | `/health/processes/:id` | Target resolution stats |

## Insight (manager/admin)

| Method | Path | Purpose |
|---|---|---|
| GET | `/insight/summary?team=&process=&from=&to=` | Totals, readiness counts |
| GET | `/insight/curves?…` | Independence per run per learner/process |
| GET | `/insight/levels?…` | Step counts by level per process |
| GET | `/insight/missed?…` | Most-missed steps |
| GET | `/insight/export.csv?…` | CSV |
| DELETE | `/insight/learners/:userId` | Delete a person's training record (admin) |

Managers see only their teams (enforced server-side).

## Admin

| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/admin/org` | Approved domains, retention, branding |
| PATCH | `/admin/ai` | Provider, model, key reference; `POST /admin/ai/test` runs a grounded test question |
| GET/POST | `/admin/users`, `/admin/teams` | Manual management (SCIM preferred) |
| GET | `/admin/audit` | Audit log |
