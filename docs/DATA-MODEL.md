# Spark data model

## 1. Entities

| Entity | Purpose | Key fields |
|---|---|---|
| **Org** | A customer | id, name, slug, approved_domains[], ai_provider, ai_model, ai_key_ref, retention_days, branding |
| **User** | A person in an org (from SSO/SCIM) | id, org_id, name, email, external_id, roles[], team_id, manager_id, active |
| **Team** | Grouping for managers and assignments | id, org_id, name, parent_id |
| **Contact** | Who to tell / call, by department | id, org_id, role_key, department, name, email, phone, notes |
| **Process** | An authored process (stable identity) | id, org_id, slug, title, department, owner_id, status |
| **ProcessVersion** | Immutable published content | id, process_id, version, content (JSON, `process.schema.json`), published_at, published_by |
| **Attachment** | Job aids/reference docs for Ask | id, org_id, process_id?, title, blob_path, text_extract, version |
| **Recording** | A Recorder session | id, org_id, process_id, author_id, system, started_at, steps (draft JSON) |
| **PartState** | Throttle state per learner/process/step | user_id, process_id, step_id, level (1–4), streak, updated_at |
| **Run** | One completed (or abandoned) run | id, user_id, process_id, version, started_at, finished_at, status, independence (0–100), misses |
| **StepResult** | Per step in a run | run_id, step_id, type, level, outcome (right/miss/done/skipped), seconds, hints, resolved (bool) |
| **Readiness** | Derived per user/process | user_id, process_id, ready (bool), since, runs_to_ready |
| **Assignment** (later) | "Learn this by…" | id, org_id, process_id, team_id/user_id, due_at |
| **TargetHealth** | Aggregated resolution stats | process_id, version, step_id, day, attempts, resolved, by_strategy |
| **AuditLog** | Admin/author actions | id, org_id, actor_id, action, subject, at |

All tables carry `org_id` and are protected by row-level security. No table stores page content or field values.

## 2. Postgres sketch

```sql
create table orgs (id uuid primary key, name text not null, slug text unique not null,
  approved_domains text[] not null default '{}', ai_provider text not null default 'anthropic',
  ai_model text, ai_key_ref text, retention_days int not null default 365, branding jsonb default '{}');

create table users (id uuid primary key, org_id uuid not null references orgs, name text not null,
  email citext not null, external_id text, roles text[] not null default '{learner}', team_id uuid, manager_id uuid,
  active boolean not null default true, unique (org_id, email));

create table processes (id uuid primary key, org_id uuid not null references orgs, slug text not null,
  title text not null, department text, owner_id uuid, status text not null default 'draft', unique (org_id, slug));

create table process_versions (id uuid primary key, org_id uuid not null, process_id uuid not null references processes,
  version int not null, content jsonb not null, published_at timestamptz, published_by uuid, unique (process_id, version));

create table part_states (org_id uuid not null, user_id uuid not null, process_id uuid not null, step_id text not null,
  level smallint not null check (level between 1 and 4), streak smallint not null default 0, updated_at timestamptz not null,
  primary key (user_id, process_id, step_id));

create table runs (id uuid primary key, org_id uuid not null, user_id uuid not null, process_id uuid not null,
  version int not null, started_at timestamptz not null, finished_at timestamptz, status text not null,
  independence smallint, misses smallint);

create table step_results (run_id uuid not null references runs on delete cascade, org_id uuid not null,
  step_id text not null, type text not null, level smallint, outcome text, seconds int, hints smallint, resolved boolean,
  primary key (run_id, step_id));
-- + readiness, contacts, attachments, recordings, target_health, audit_log, teams
-- RLS: alter table … enable row level security; create policy org_isolation on … using (org_id = current_setting('app.org_id')::uuid);
```

Retention job (daily): delete runs/step_results older than `orgs.retention_days`; recompute readiness.

## 3. Process content (`process.schema.json`)

A process version's `content`. Generalized from HCM Coach's `shared/lesson.schema.json`:

- Top level: `id`, `title`, `goal`, `department`, `systems[]` (approved domains it runs on), `estimatedMinutes`,
  `startUrl` (pattern), `steps[]`, `callouts[]` (rules/tips/warnings with `source`), `reminders[]`, `recap`.
- Step common: `id`, `type`, `title`, `instruction`, `why?`, `departments?` (branching), `hints?`.
- `screen` step: `where?`, `expect?`, `target`, `check`, `commonMistakes?`, `check` (completion), `quiz?` (authored
  how/why/next questions).
- `checkpoint`: `confirm` label. `offline`: `confirm`, `contactRef?`, `allowSkip?`. `call`: `contactRef`, `prep`,
  `debrief.rubricRef`.

See `process.schema.json` for the full schema. Validate on publish (Studio) and on load (extension).

## 4. Extension local storage

| Key | Contents |
|---|---|
| `spark.session` | token, org id, user id, name, email (from SSO), expires |
| `spark.content` | org content bundle (published versions the learner can run), version hash |
| `spark.levels` | cache of part states (server is the source of truth) |
| `spark.run` | the active run |
| `spark.queue` | unsent run summaries |
| `spark.prefs` | tour seen, UI prefs |
