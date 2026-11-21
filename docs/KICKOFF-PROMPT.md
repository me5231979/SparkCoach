# Kickoff prompt for the new Spark thread

Paste the text below as the first message in a new Claude Code session on the new `matchlight-spark` repository
(after copying this kit into `docs/` and `CLAUDE.md` into the repo root).

---

We're building **Spark by Matchlight**, a screen-aware coach that lives in the browser side panel and teaches a
company's own processes by having people do them in the real system, with help that fades as they prove they can do
the work. The full spec is in `docs/` (start with `docs/PRD.md`, then `docs/COACHING-MODEL.md`,
`docs/SCREEN-AWARENESS.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/process.schema.json`, `docs/API.md`,
`docs/SECURITY-PRIVACY.md`, `docs/ROADMAP.md`). Follow `CLAUDE.md`.

Much of the coaching engine is proven in a sibling product, HCM Coach (repo `me5231979/HCM_Coach`, HCM-only and
separate). `docs/REUSE-FROM-HCM-COACH.md` lists exactly which files to copy and adapt. Attach that repo read-only if
you can; otherwise I'll paste files on request.

Please do **Phase 0** from `docs/ROADMAP.md`:
1. Set up the npm-workspaces monorepo (`apps/extension`, `apps/web`, `packages/core`, `packages/dom`,
   `packages/ai`, `packages/adapters`, `e2e`, `fixtures/apps`) with TypeScript strict, CI scripts and Playwright.
2. `packages/core`: `process.schema.json` + a validator; port the coaching model (levels, throttle, how/why/next
   question generation) from HCM Coach `extension/src/lib/coach.ts` with unit tests.
3. `apps/extension`: MV3 skeleton (side panel React, service worker, content script on fixture domains), with the
   network-call build guard and CSP ported from HCM Coach `extension/build.mjs`.
4. `fixtures/apps/oracle-like`: a small mock web app with the screens needed by
   `docs/examples/change-manager.process.json`.
5. An e2e test that loads the extension, runs that example process at Guide level on the fixture, and checks the
   spotlight appears on the first target.
6. A Vercel project for `apps/web` (Next.js) with a health route; tell me what environment variables and storage to
   add in Vercel.

Before writing code, confirm the plan and list anything in `docs/PRD.md` §13 you need me to decide first.
