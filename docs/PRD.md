# Spark by Matchlight: Product Requirements Document

| | |
|---|---|
| Product | Spark by Matchlight |
| Owner | Matchlight |
| Status | Draft v1, for build kickoff |
| Delivery | Chrome/Edge extension (learner) + Spark Studio web app (authors, admins) + Spark API, hosted on Vercel |

---

## 1. Summary

Spark is a coach that lives in the browser's side panel, next to the system a person works in. It teaches a
company's **own processes** by having people do them **in the real system**, and it **turns its help down as they
prove they can do the work**: from showing every step, to prompting, to standing by, to off. Unlike guidance tools
that give the same walkthrough forever, Spark's goal is a person who can do the process without it, and it
produces the evidence that they can.

Matchlight builds Spark and delivers it to each customer for their unique processes: HR, finance, IT service,
procurement, customer operations, anywhere people run multi-step processes across web systems.

## 2. Problem

- Important processes are **infrequent and high-stakes** (a pay change, a cost transfer, a vendor setup, an access
  request). People learn them from long job aids, forget them, and ask a colleague or guess.
- **Turnover** in operations roles means the same training is repeated constantly, by the same few experts.
- Real processes **cross systems** (Oracle for core HR, UKG for time, a ticketing tool, email to a manager). Single-
  vendor guidance (e.g. Oracle Guided Learning) stops at its own system's edge.
- Existing digital adoption platforms (WalkMe, Whatfix, Pendo) are built mainly for **task completion**, not
  capability: the help doesn't step back as people improve, and their analytics show usage, not whether someone
  can do the job on their own.
- Leaders in talent development have **no evidence** of who is actually able to perform a process, or which steps
  people struggle with, so they cannot target coaching or fix the guides.

## 3. Vision and principles

**Vision:** every person can do their processes on their own, quickly, and the organization can see it.

1. **Learn by doing, in the real system.** No separate course. The work is the lesson.
2. **Help fades as competence grows, per step.** Full support on what's new; none on what's mastered.
3. **Prove the how and the why.** Clicking isn't understanding. Spark checks both.
4. **The app decides; the AI talks.** Levels, scores and records are computed by deterministic code from the
   verified process. AI explains, answers and gives feedback, and only from the customer's own content.
5. **Private by design.** Spark reads the page's structure (labels, buttons, page state) to coach. It never collects
   what's typed into fields or what's on the record. These are build-time guarantees, not settings.
6. **Any web system, plus the off-screen work.** Calls, approvals and "tell the manager" steps are part of the process.
7. **Plain words.** Short steps, coach's voice, one thing at a time.

## 4. Users

| Persona | Who | Needs |
|---|---|---|
| **Learner** | Employee doing a process (HR specialist, AP clerk, service-desk analyst) | Get it right without hunting for a job aid; less hand-holding as they improve; quick answers when stuck |
| **Author** | Process owner or trainer at the customer, or a Matchlight consultant | Capture a process fast by doing it once; edit steps, rules and checks without code; keep it current |
| **Talent development lead / manager** | L&D, team leads, HR ops managers | See who can do which process on their own; where people get stuck; evidence for readiness, audits and onboarding |
| **Customer admin / IT** | Customer IT and security | Approve which systems Spark may run on; SSO; data residency; assurance it reads no sensitive data |
| **Matchlight operator** | Matchlight delivery team | Onboard customers, build their first processes, monitor health |

## 5. Positioning

| | WalkMe / Whatfix / Pendo | Oracle Guided Learning | **Spark** |
|---|---|---|---|
| Aim | Task completion, adoption | Oracle task completion | **Capability: people who can do it alone** |
| Help over time | Typically the same each time | Typically the same each time | **Fades per step; returns on a miss** |
| Understanding | Clicks | Clicks | **How + why checks, say-back** |
| Evidence | Click analytics | Completion | **Mastery record per person, per step** |
| Systems | Many, per-system builds | Oracle only | **Any web system + off-screen steps, in one process** |
| Data collected | Varies; page content often available | Page content | **Structure only; never field values (enforced in code)** |
| Authoring | Specialist builders | Specialist builders | **Record it once; AI drafts the words; plain editor** |

**Positioning line:** *Spark doesn't just get the task done. It makes your people able to do it, and shows you.*

Spark complements adoption tools rather than replacing them; buyers are Talent Development and Operations leaders
first, IT second.

## 6. Scope

### 6.1 MVP (pilot-ready)
1. Learner extension with screen-aware coaching on **two systems** (recommended Oracle Cloud HCM + UKG Pro).
2. Coaching model: four support levels, throttle, how/why checks, say-back, Ask (AI) from customer content only.
3. Off-screen steps: checkpoint, "tell someone" (with contact cards), call prep and debrief.
4. Spark Studio: Recorder, step editor, checks editor, publish/versioning, preview.
5. Tenancy: one customer = one org; SSO (OIDC/SAML via a provider); roles (learner, author, manager, admin).
6. Training records and the progress dashboard (independence over runs, help levels by process, most-missed steps,
   CSV export).
7. Privacy guarantees enforced in code and tests (§9).
8. Delivery: Chrome Web Store unlisted listing + enterprise force-install policy instructions; Edge support.

### 6.2 Later
- Additional adapters (Workday, ServiceNow, Salesforce, SAP SuccessFactors, ADP).
- Authoring in the customer's language; translated guides.
- LMS/LRS export (xAPI), HRIS sync of org structure, manager assignments ("learn this by Friday").
- Desktop-app support (outside the browser): out of scope; Spark is browser-first.
- Spaced refreshers: a process not run for N weeks steps back up a level.

### 6.3 Non-goals
- Doing the task for the user (no autofill, no agentic clicking). Spark builds capability.
- Recording screens or keystrokes. Session replay. Productivity monitoring.

## 7. Features and requirements

Each requirement has an ID for tracking. **Acceptance** lines are testable.

### 7.1 Learner experience (extension)

**L1. Install and sign-in.** Installed by IT (force-install) or from the store link. On first open: a 60-second
narrated tour, then sign-in with the company's SSO.
- Acceptance: first launch shows the tour once; replay link on the process list; after SSO the learner's name and
  email come from the identity provider (no typing).

**L2. Find a process.** Search by words in the title, goal or steps; filter chips by department/topic; each card
shows time, number of on-screen and off-screen steps, and the learner's current support meter.
- Acceptance: typing a word inside a step finds its process; meter label reads "New: full support", "Learning:
  mostly Prompt", or "Mostly on your own".

**L3. Context launch.** When the learner opens a page that a process starts on, Spark offers it ("Change a
manager? Start the coach").
- Acceptance: launch suggestions only on customer-approved domains; never auto-starts.

**L4. Guided step (Guide level).** The panel shows the step title with its kind icon, a one-line instruction, where
to look, why it matters, the rule that applies (with its source), and what to watch for. **On the page**, the target
field or button is highlighted with a spotlight.
- Acceptance: highlight appears within 500 ms of the target being present; if the target is not found, the panel
  says "I can't find this on the page you're on" with a hint to go back.

**L5. Step verification.** Spark detects the step happening from page state (see SCREEN-AWARENESS.md) and advances.
"I did it" is the fallback where detection isn't possible.
- Acceptance: for steps with a defined check, completion is detected without a click on "I did it" in ≥ 95% of runs
  on the pilot systems.

**L6. How and why checks.** After a step at Guide level, two quick questions: how you know it worked, and why the step
matters. Authored questions win; otherwise built from the verified step (expected result vs other steps' results;
this step's reason vs others').
- Acceptance: right answers confirmed with the reason; wrong answers show the right one and why; both outcomes are
  recorded.

**L7. Prompt level.** Before the step: "What comes next?" then "Why does it matter?". A wrong answer gets a hint
(where to look), not the answer.

**L8. On call and Off.** On call: the panel is quiet ("I'm here if you need me") and the highlight is hidden unless
asked. Off: the learner does it alone; Spark only verifies. Asking for help counts as needing help.

**L9. The throttle.** Per process, per step: every step starts at Guide; two right in a row moves it down a level;
a miss moves it back up; the learner can choose "Less help" any time. Shown as a four-notch meter on every step and
a level-change note ("Less help next time: Prompt").

**L10. Wrong-click coaching.** If the learner clicks a known wrong option (authored common mistakes), Spark explains
the difference in one line.

**L11. Off-screen steps.** Checkpoint ("Stop and check"), Tell someone (contact card resolved by department),
Conversation (prep: goal, opener, likely pushback; then a short self-rated debrief with tips).

**L12. Say-back.** At the end, the learner says back what they did and why; AI compares it to the process and lists
steps covered and missed.

**L13. Ask.** A pop-up chat on every screen. The AI answers in real time only from the customer's published
processes and attached reference documents, names its source, and says "Not in Spark" when the content doesn't cover
the question. It never sees the page or field values.

**L14. Recap.** Summary, next steps, follow-up reminders (e.g. "check tomorrow that costing shows").

### 7.2 Studio (authors)

**S1. Recorder.** The author clicks *Record*, performs the process once in the real system, and Spark captures each
interaction as a draft step: target (role + accessible name + label + context path, never values), the page/URL
pattern, and a completion check inferred from what changed. Off-screen steps are inserted manually.
- Acceptance: recording a 10-step process produces 10 draft steps with targets that re-find their elements on replay
  in ≥ 90% of cases on the pilot systems.

**S2. AI drafting.** From the recording plus any uploaded job aid, AI drafts each step's title, instruction, why,
watch-for and how/why checks in plain, short, coach's voice. Authors approve or edit; nothing publishes unapproved.

**S3. Step editor.** Edit text, reorder, branch by department, set targets (with a "pick on page" tool), set checks,
add rules with sources, add common mistakes, mark the step type.

**S4. Validate and preview.** Schema validation; a live preview runs the process in the real system in a test mode
that records nothing.

**S5. Publish and version.** Draft → review → published. Learners get new versions between runs, never mid-run.
Version history and rollback.

**S6. Health.** Daily target health per process: which steps' targets weren't found in the last 7 days (the vendor
changed a screen). Alerts to the author.

### 7.3 Insight (managers, talent development)

**I1. Dashboard.** Totals; independence over runs per learner and process (Guide 0%, Prompt 33%, On call 67%,
Off 100%, averaged over steps); help levels by process; most-missed steps; where people are (table); filters by
team, process and date range.

**I2. Readiness.** "Able to do it alone" status per person per process: all steps at Off for two consecutive runs.

**I3. Exports.** CSV; later xAPI to the customer's LRS/LMS.

**I4. Records.** Retention period set per customer (default 12 months); deletion per person on request.

### 7.4 Admin

**A1. Approved systems.** Admin lists the domains Spark may run on; the extension's host permissions are limited to
those (managed policy or per-org config).

**A2. SSO and roles.** OIDC/SAML; roles learner, author, manager, admin; managers see their teams only.

**A3. AI settings.** Provider (Matchlight-managed Anthropic, or the customer's gateway: Azure OpenAI, Amplify-style
proxies), model, data-retention statement.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Panel interactive < 1 s; target highlight < 500 ms; AI answers p50 < 4 s (stream) |
| Reliability | 99.9% API availability; extension works offline from the last downloaded content (no Ask, records queue and retry) |
| Accessibility | WCAG 2.2 AA in panel, Studio and dashboard; keyboard-only operation; screen-reader labels |
| Compatibility | Chrome and Edge (current and previous two); MV3 |
| Localization | UI strings externalized from day one |
| Scale (MVP) | 50 orgs, 20k learners, 2k processes |

## 9. Privacy and security (summary; full detail in SECURITY-PRIVACY.md)

- **Never collected:** field values, page text beyond labels/headings needed for targeting, screenshots, keystrokes,
  URLs' query strings with identifiers (stripped), anything outside approved domains.
- **Collected:** learner identity (from SSO), process/step IDs, support levels, right/miss, timestamps, what the
  learner types into Ask/say-back (sent to the AI provider; retention per customer setting).
- Guarantees enforced by: content-script allowlist of DOM properties, a build-time network guard (only the Spark API
  origin), and automated privacy tests that fail the build.
- Tenant isolation at the database (row-level security) and storage (per-org prefixes, signed access).

## 10. Success metrics

| Metric | Target (pilot) |
|---|---|
| Time to independence (runs until all steps at Off) | −50% vs. job-aid baseline |
| First-time-right rate on processes | +30% |
| Weekly active learners / enrolled | ≥ 60% |
| Author time to publish a 10-step process | < 45 minutes with Recorder |
| Target detection success | ≥ 95% on pilot systems |
| Ask answers marked helpful | ≥ 80%; "Not in Spark" rate tracked as a content-gap signal |

## 11. Pricing and packaging (working assumptions; validate with pilots)

| Package | Price (indicative) | Includes |
|---|---|---|
| **Pilot** | Fixed fee, 8–12 weeks | 1 department, up to 10 processes built by Matchlight, dashboard, success review |
| **Team** | ~$12 / learner / month (annual) | Studio, 2 systems, dashboard, SSO |
| **Enterprise** | ~$18–20 / learner / month or platform fee | Unlimited systems, xAPI/LMS, customer AI gateway, data residency, premium support |
| **Process build services** | Per process or per bundle | Matchlight authors and maintains processes for the customer |

Annual minimum around $10–15k. Running cost target: < $2 per active learner per month.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vendor UI changes break targets | Resilient targeting (role/name/label, context path), multiple fallbacks, daily health checks, Recorder re-capture |
| Security reviews block screen access | Structure-only reading, domain allowlist, published privacy test suite, SOC 2 |
| AI says something not in the process | Grounded prompts, source citation, "Not in Spark" behavior, refusal on off-topic, eval suite |
| Authoring cost too high | Recorder + AI drafting; Matchlight build services |
| Competing on adoption features | Position on capability + evidence; integrate rather than replace |
| Shadow DOM / iframes / canvas UIs | Adapter layer per system; test tenants for each supported system |

## 13. Open questions

1. Pilot customer and its two systems (and test tenants).
2. Relationship to the earlier Spark capture tool and the existing `spark`/`matchlight` Vercel projects.
3. Default AI provider and data-processing terms.
4. Whether Spark may offer an optional "show me" mode that plays the step on a sandbox copy (not the live record).
5. Brand system for Spark (colors, type, logo). This kit uses neutral tokens until it's provided.
