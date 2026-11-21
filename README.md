# Spark by Matchlight

A platform for building screen-aware coaches. Companies use Spark to turn their own processes into a coach that sits
in the browser side panel beside their real systems, teaches by doing, and steps back as people prove they can do the
work. Design docs live in [`docs/`](docs/) (start with `docs/PRD.md`); conventions are in [`CLAUDE.md`](CLAUDE.md).

## Layout

| Path | What |
|---|---|
| `packages/core` | Process schema + validator, coaching engine (levels, throttle, questions), record math |
| `packages/dom` | Page engine: targeting, completion checks, spotlight overlay, Recorder capture. Privacy-guarded |
| `apps/extension` | Chrome/Edge MV3 extension: side panel, service worker, content script; network + privacy build guards |
| `apps/web` | Next.js on Vercel (`spark-app`): API, and later Studio, Insight, Admin |
| `fixtures/` | Mock systems and test processes for CI (not product content) |
| `e2e/` | Playwright: extension on fixture apps, privacy suite |

## Commands

```bash
npm ci
npm run typecheck      # all workspaces
npm test               # unit tests
npm run validate       # process files against the schema
npm run build:ext      # extension → apps/extension/dist (fails on network/privacy guard)
npm run e2e            # Playwright, incl. the privacy suite
npm run dev:web        # Next.js on :3000
npm run fixtures       # mock Records app on :4310
```

Load `apps/extension/dist` as an unpacked extension in Chrome to try it against `npm run fixtures`.
