# Spark by Matchlight: build kit

Everything needed to start building **Spark** in a new repository and deploy it on Vercel.

**Spark by Matchlight** is a screen-aware coach that sits beside a company's own systems and teaches its people
the company's **own processes**, by doing them in the real system, with help that fades as they prove they can do
the work. Matchlight builds it and delivers it to each customer for their unique processes, in any department and
on any web system (Oracle, UKG, Workday, ServiceNow, Salesforce, internal tools…).

> **Spark is not HCM Coach.** HCM Coach is a separate product: HCM-only, built for Vanderbilt's HCM Academy, and
> deliberately unable to see the screen. Spark reuses ideas and some proven code from it (listed in
> `REUSE-FROM-HCM-COACH.md`), but it is its own product, brand, repository, Vercel project and data.

## What's in this kit

| File | What it is |
|---|---|
| `PRD.md` | The product requirements: problem, users, positioning, features with acceptance criteria, scope, metrics, pricing |
| `COACHING-MODEL.md` | The learning engine: support levels, the throttle, how/why checks, say-back, and what the AI may and may not do |
| `SCREEN-AWARENESS.md` | How Spark sees the page across systems: targeting, step detection, the Recorder, system adapters, privacy filter |
| `ARCHITECTURE.md` | System design: extension, Studio web app, API, storage, AI, multi-tenancy, deployment on Vercel |
| `DATA-MODEL.md` | Entities, database tables and the process file format (`process.schema.json`) |
| `process.schema.json` | JSON Schema for a Spark process (the unit customers author) |
| `examples/change-manager.process.json` | A complete example process that validates against the schema (used by Phase 0's first e2e test) |
| `API.md` | API contract between the extension, Studio and the server |
| `SECURITY-PRIVACY.md` | What Spark reads and never reads, controls, tenant isolation, threat model, compliance path |
| `ROADMAP.md` | Phases, milestones, estimates, team, and the definition of done for each phase |
| `REUSE-FROM-HCM-COACH.md` | Which HCM Coach files and patterns to port, and what to leave behind |
| `CLAUDE.md` | Drop into the new repo root: conventions and rules for Claude Code in that repo |
| `KICKOFF-PROMPT.md` | Paste into the first message of the new thread to start the build |

## How to start

1. Create a new GitHub repository (suggested name: `matchlight-spark`). Copy this folder's files into `docs/` and
   move `CLAUDE.md` to the repo root.
2. Copy the HCM Coach source files listed in `REUSE-FROM-HCM-COACH.md` into `reference/hcm-coach/` (read-only
   reference, not built), or give the new session read access to the HCM Coach repo.
3. Create a **new** Vercel project for Spark (not `hcm-coach`, and see the naming note below).
4. Open a new Claude Code thread on the new repo and paste `KICKOFF-PROMPT.md`.

## Decisions to make before kickoff

- **Name collision.** The Matchlight Vercel team already has projects named `spark` and `matchlight`, and an
  earlier, unrelated "Spark" capture tool lives in the `productlearning-` repo. Decide whether the new Spark
  replaces that project (and whether any of its capture code is worth reusing for the Recorder), and pick a
  distinct project name such as `spark-app` to avoid confusion.
- **First two target systems** for the screen-aware pilot (recommended: Oracle Cloud HCM + UKG Pro, because a
  pilot customer can supply test tenants).
- **AI provider** for the first customer (Anthropic API directly, or the customer's own gateway such as
  Vanderbilt-style Amplify / Azure OpenAI). The architecture supports all three.
