# Spark architecture

## 1. Components

```
┌─────────────────────────── Browser (learner / author) ───────────────────────────┐
│  Spark extension (MV3, Chrome + Edge)                                             │
│   • Side panel (React): coach, Ask, recap, setup/SSO, Recorder controls          │
│   • Content script (approved domains only): targeting, checks, overlay, recorder │
│   • Service worker: run state, throttle, sync queue, auth token, content cache   │
└──────────────┬────────────────────────────────────────────────────────────────────┘
               │ HTTPS, one origin (api.spark…), bearer token from SSO
┌──────────────▼──────────────── Vercel ───────────────────────────────────────────┐
│  Spark web (Next.js App Router)                                                   │
│   • /studio        authoring: processes, Recorder review, AI drafting, publish   │
│   • /insight       dashboard, readiness, exports                                 │
│   • /admin         org settings: SSO, approved domains, AI provider, retention   │
│   • /api/*         extension + Studio API (see API.md)                           │
│  Data: Postgres (Neon via Vercel Marketplace) with row-level security per org    │
│        Vercel Blob (private) for attachments: job aids, recordings' metadata     │
│  AI:   provider adapter → Anthropic API (default) | customer gateway (Azure      │
│        OpenAI, Amplify-style proxies); prompt caching for org content            │
│  Auth: WorkOS (or Auth.js + SAML jackson) for SSO/SCIM; sessions for web         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Repository layout (monorepo, npm workspaces)

```
matchlight-spark/
  apps/
    extension/        # MV3 extension (esbuild), side panel React, content script, SW
    web/              # Next.js: studio, insight, admin, api
  packages/
    core/             # shared types, process schema, coaching model (throttle, checks generation), validators
    dom/              # targeting engine, checks, overlay, recorder (runs in content script; unit-tested in jsdom/playwright)
    adapters/         # per-system adapters + DOM fixtures
    ai/               # provider adapter, prompts, structured outputs, eval harness
  docs/               # this kit
  e2e/                # Playwright suites: extension on fixture apps, studio flows, privacy suite
  fixtures/apps/      # small mock web apps that mimic Oracle/UKG patterns for CI
```

## 3. Key flows

**Learner run**
1. SW loads the org content bundle (published processes for the learner's groups) and the learner's part states.
2. Learner starts a process. SW sets the run; content script resolves the step target and evaluates its check.
3. Check passes → SW records outcome → throttle → next step. Off-screen steps complete from the panel.
4. Run complete → SW posts the run summary (`/api/runs`) → server updates the training record and readiness.
5. Offline: runs queue in `chrome.storage.local` and sync later.

**Ask**
Panel → `/api/ask { processId?, stepId?, question, history }` → server builds grounded prompt from published content
(cached per org+version) → provider → `{ found, text, sources }` → sources filtered to real content.

**Recording**
Studio creates a recording session → extension enters record mode on the approved domain → events captured as
draft steps (structure only) → posted to `/api/recordings/:id/steps` → Studio shows drafts → AI drafting → author
edits → publish creates an immutable process version.

## 4. Multi-tenancy

- Every table has `org_id`; Postgres RLS policies enforce `org_id = current_setting('app.org_id')`.
- The extension token carries `org_id`, `user_id`, roles; the API sets the RLS context per request.
- Blob paths are `orgs/<org_id>/…`, private, served through signed, short-lived URLs.
- Per-org config: approved domains, AI provider + model + key reference (keys in Vercel env or a secrets manager,
  never in the DB in plain text), retention days, branding (logo, accent color).

## 5. Extension delivery and permissions

- One public build. `host_permissions` are **optional**; on sign-in the extension requests permission for the org's
  approved domains (`chrome.permissions.request`). Enterprises can pre-grant via managed policy
  (`ExtensionSettings` → `runtime_allowed_hosts`) and force-install.
- Build-time guard (port from HCM Coach `extension/build.mjs`): exactly the expected `fetch` call sites, only the
  Spark API origin in `connect-src`, no `eval`, no remote code. CI fails otherwise.

## 6. AI provider adapter

```ts
interface Provider { parse<T>(req: { system: Block[]; messages: Msg[]; schema: ZodType<T>; maxTokens: number }): Promise<{ data: T | null; refused: boolean }>; }
```
Implementations: `anthropic` (structured outputs, prompt caching), `amplify` (Bearer key, `/chat`, JSON in text),
`azure-openai`. Port the Anthropic + Amplify implementations from HCM Coach `web/app/api/coach/route.ts`.

## 7. Observability

- Structured logs (`[api] route status ms org`), no content.
- Metrics: target resolution rate per adapter/process, AI latency/error rate, sync queue depth.
- Error tracking (Sentry) with PII scrubbing.

## 8. Environments

`development` (local, fixture apps, local Blob via `PROGRESS_LOCAL_DIR`-style file store), `preview` (per-PR Vercel
deploy with seeded demo org), `production`. Secrets: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `WORKOS_*`,
`ANTHROPIC_API_KEY` (Matchlight-managed default), per-org provider keys by reference.
