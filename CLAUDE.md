# CLAUDE.md: Spark by Matchlight

Spark is a screen-aware coach in the browser side panel that teaches a company's own processes by doing them in the
real system, with help that fades as the person proves they can do it. Spark is a platform: companies use Studio to make their own coaches and deploy them to their people. Built by
Matchlight.
Read `docs/PRD.md` first; the other docs in `docs/` are the design.

## Non-negotiables

1. **Privacy is enforced in code.** The content script may read roles, accessible names, labels, headings, visibility,
   URL paths, and evaluate field checks locally (true/false only). It must never read or send field values, cell
   text, free page text, screenshots or keystrokes. Every change touching `packages/dom` or the extension's network
   code must keep the privacy suite (`e2e/privacy.spec.ts`) green. Never weaken it to make a test pass.
2. **The app decides, the AI talks.** Levels, outcomes, readiness and records are deterministic code
   (`packages/core`). AI output is structured, grounded only in the org's published content, and filtered
   server-side (step ids and source names must exist).
3. **One API origin.** The extension talks only to the Spark API. The build guard in `apps/extension/build.mjs`
   counts `fetch` call sites and checks `connect-src`; update the expected count deliberately, never bypass it.
4. **Tenant isolation.** Every table has `org_id` with RLS; every query runs with the request's org context. Add a
   cross-tenant test for every new data route.
5. **Spark is a platform, not a coach.** No customer's processes, branding or content live in this repo. Test
   processes and mock systems under `fixtures/` exist only to exercise the engine.

## Stack

- npm workspaces monorepo: `apps/extension` (MV3, esbuild, React side panel), `apps/web` (Next.js App Router on
  Vercel), `packages/{core,dom,adapters,ai}`, `e2e/` (Playwright), `fixtures/apps/` (mock systems for CI).
- Postgres (Neon via Vercel Marketplace) with Drizzle; Vercel Blob (private) for attachments; WorkOS for SSO/SCIM;
  Anthropic SDK default model `claude-sonnet-5-5` (override per org), adapters for a customer's own AI gateway (e.g. Azure OpenAI).
- TypeScript strict everywhere. Zod for API input and AI output schemas.

## Commands (create these in Phase 0)

- `npm run typecheck`, `npm test` (unit), `npm run e2e` (Playwright; loads the unpacked extension against fixture apps),
  `npm run e2e:privacy`, `npm run build:ext`, `npm run dev:web`, `npm run validate` (process files against schema).
- Playwright: Chromium is preinstalled in cloud sessions; pass `--trace off` unless debugging.

## Writing style for user-facing text

Plain words, coach's voice, second person. One instruction per step (≤ 200 chars), one line of why. No jargon in the
panel. Name buttons and fields exactly as the system shows them.

## Working rules

- Small, reviewable commits; each with tests. Keep `docs/API.md` and `docs/DATA-MODEL.md` in sync with code.
- When unsure about a product decision, check `docs/PRD.md` §13 (open questions) and ask.
