# Spark by Matchlight: product docs

**Spark is a platform for making and deploying AI coaches.** A company uses Spark to turn its own processes into a
coach that sits in the browser side panel beside the systems its people already use (any web system: ERP, HR, CRM,
ticketing, internal tools). The coach teaches by having people do the real work, checks they understand the how and
the why, and turns its help down as they prove they can do it alone. Spark is the builder and the runtime; each
customer's coaches are their own content, made in Spark Studio and published to their people.

| Part | Who uses it | What it does |
|---|---|---|
| **Studio** (web) | Authors at the customer, or Matchlight | Make a coach: record a process once, AI drafts the words, edit steps and checks, preview, publish |
| **Spark extension** | The customer's people | Runs the published coaches on approved systems: spotlight, step detection, fading help, Ask |
| **Insight** (web) | Managers, talent development | Who can do which process alone, where people get stuck, exports |
| **Admin** (web) | Customer IT | Approved systems, sign-in, AI provider, data retention |

## Docs

| File | What it is |
|---|---|
| `PRD.md` | Product requirements: problem, users, positioning, features with acceptance criteria, scope, metrics, pricing |
| `COACHING-MODEL.md` | The learning engine: support levels, the throttle, how/why checks, say-back, what the AI may and may not do |
| `SCREEN-AWARENESS.md` | How Spark sees the page across systems: targeting, step detection, the Recorder, adapters, privacy filter |
| `ARCHITECTURE.md` | System design: extension, web app, API, storage, AI, multi-tenancy, Vercel |
| `DATA-MODEL.md` | Entities, tables and the process format (`packages/core/process.schema.json`) |
| `API.md` | API contract between the extension, Studio and the server |
| `SECURITY-PRIVACY.md` | What Spark reads and never reads, controls, tenant isolation, threat model, compliance path |
| `ROADMAP.md` | Phases, milestones and the definition of done |

## Open decisions

- **First pilot customer** and its first two systems (with test tenants).
- **Default AI provider** per customer: Anthropic (Matchlight-managed) or the customer's own gateway.
- **Brand**: colors, type and logo (neutral tokens until then).
