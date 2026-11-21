# Spark security and privacy

Spark sees the screen, so trust is the product. These are design rules, enforced by code and tests, not settings.

## 1. What Spark reads on a page

Only on customer-approved domains, only while a process is running or recording:
- Element **roles**, **accessible names**, **labels**, headings/landmark/dialog titles (for targeting and context).
- **Presence and visibility** of targets; **URL path** (query strings dropped; numeric/UUID segments replaced with `*`).
- **Whether** a field is filled, matches an authored format, or equals an authored static option label: computed
  in the page, only `true/false` leaves it.
- That a target was **clicked**.

## 2. What Spark never reads or sends

- Field values, table cells, free page text, record data (names, IDs, pay, SSNs, addresses, notes).
- Screenshots, screen recordings, keystrokes, clipboard, cookies, other tabs, browsing history.
- Anything on domains not on the org's approved list.

Exceptions are explicit and author-confirmed: fixed **app wording** used in checks (e.g. a "Submitted" banner) and
**static option labels** (e.g. "Change Line Manager"). Studio warns if a captured string looks like personal data
(name/number patterns) and blocks publish until the author confirms or removes it.

## 3. What Spark stores (server)

| Data | Purpose | Retention |
|---|---|---|
| Name, email, team, roles (from SSO/SCIM) | Identify the learner | While active + retention |
| Process/step IDs, levels, right/miss, timestamps, durations | Coaching + training record | Org setting (default 12 months) |
| Ask questions, say-backs, "why" answers | Sent to the AI provider to answer; stored only if the org enables conversation history | Org setting (default: not stored) |
| Target health stats (no DOM content) | Detect broken targets | 90 days |
| Published processes, attachments | Content | Until deleted |

## 4. Controls

- **Build guard (CI):** network calls only to the Spark API origin; fixed number of `fetch` call sites; no remote
  code; content script uses an **allowlisted DOM API surface** (lint rule bans `.value`, `innerText`,
  `textContent` outside the targeting module, which only returns names/labels).
- **Privacy test suite (CI, blocking):** fixture pages seeded with fake personal data; full runs and recordings;
  assert none of the seeded strings appear in any request body, header, URL or storage.
- **Permissions:** optional host permissions requested per approved domain; enterprise policy can pre-grant/deny.
- **Tenant isolation:** Postgres RLS on every table; per-org Blob prefixes with signed URLs; per-org AI keys by
  reference.
- **AuthN/Z:** SSO (OIDC/SAML), SCIM deprovisioning, short-lived extension tokens, role checks server-side,
  managers scoped to their teams.
- **AI:** grounded prompts; learner text treated as data; structured outputs; source filtering; per-org provider
  choice (customer's own gateway supported, so data can stay within their AI agreement); zero-retention options
  where the provider supports them.
- **Transport/storage:** TLS 1.2+; encryption at rest (provider-managed); secrets in Vercel env / secrets manager.
- **Audit log** of admin and author actions.

## 5. Threat model (abridged)

| Threat | Mitigation |
|---|---|
| Content script leaks record data | Allowlisted DOM surface + privacy suite + code review rule |
| Malicious process content (XSS in panel) | Content rendered as text only; schema validation; CSP `script-src 'self'` |
| Cross-tenant data access | RLS + token org claim + tests that attempt cross-org reads |
| Prompt injection via learner text or attachments | Delimited data, system rules, structured outputs, no tools/actions available to the model |
| Stolen extension token | 1 h expiry, rotating refresh, revoke on SCIM deprovision |
| Publisher compromise (bad process pushed) | Review/approve workflow, versioning + rollback, audit log |
| Supply chain | Lockfile, pinned deps, Dependabot, extension built in CI only |

## 6. Compliance path

1. Before first paid customer: security one-pager, privacy policy,
   DPA template, sub-processor list (Vercel, Neon, AI provider, WorkOS, Sentry), pen test of extension + API.
2. Within 6–9 months: SOC 2 Type I, then Type II. Accessibility conformance report (VPAT) for WCAG 2.2 AA.
3. Data residency option (US/EU) via region-pinned Vercel functions + database.
