# Spark screen awareness

How Spark knows where the learner is, what to highlight, and when a step is done, on any web system, while never
collecting what's on the record.

## 1. Principles

1. **Describe elements the way a person would**: role + visible name, or field label, plus where it sits ("the
   Save button in the Managers section"). Never rely on generated CSS classes or ids alone.
2. **Read structure, not content.** The content script may read: roles, accessible names, labels, headings,
   landmark/section titles, button text, URL path pattern, presence/visibility, and *whether* a field is filled
   or matches an authored pattern. It may **not** read or send field values, table cell text, or free page text.
3. **Decide locally.** Field-value checks run inside the content script; only the boolean result leaves the page.
4. **Only on approved domains.** Host permissions = the customer's approved list. Nothing runs elsewhere.

## 2. Target model

```jsonc
"target": {
  "role": "button",               // ARIA role (implicit or explicit)
  "name": "Save",                 // accessible name (aria-label, labelledby, <label>, text)
  "label": "Effective Date",      // for fields: the field's label
  "context": ["Managers", "Edit"],// nearest headings/landmarks/dialog titles, outermost first
  "nth": 0,                       // tie-breaker among equal matches, in document order
  "testId": "…",                  // optional, if the app exposes stable test ids
  "selector": "…",                // optional last resort, author-verified
  "frame": "…"                    // optional iframe URL pattern when the target lives in an iframe
}
```

**Resolution order** (first unique visible match wins; scored when several):
1. `testId`
2. `role` + `name` within `context`
3. `label` within `context` (fields)
4. `role` + `name` anywhere
5. `label` anywhere
6. `selector`
7. **Fuzzy fallback** (local, no AI): normalized name similarity ≥ 0.85 among elements of the same role within
   context, e.g. "Save and Close" vs "Save & Close".

If no match: the panel says "I can't find this on the page you're on", and the miss is logged (id only) for health
monitoring (Studio S6).

**Traversal:** walks open shadow roots and same-origin iframes; cross-origin iframes need the frame's domain on the
approved list (the content script runs there too and answers via messaging). Implemented in `packages/dom/src/targeting.ts`.

## 3. Step completion checks

Deterministic checks evaluated in the content script (`packages/dom/src/checks.ts`):

| Check | Passes when |
|---|---|
| `urlMatches { pattern }` | path+hash matches (query string ignored) |
| `elementVisible { target }` | target resolves and is visible |
| `elementGone { target }` | target no longer present (dialog closed) |
| `textPresent { text }` | an authored confirmation phrase is visible (e.g. "Submitted") |
| `fieldValue { target, notEmpty / equals / matches }` | evaluated locally; only true/false leaves the page |
| `clicked { target }` | the learner activated the target (click/Enter/Space) |
| `all [...]`, `any [...]` | composition |

Evaluation runs on `MutationObserver` changes (debounced 150 ms), navigation events, and target interactions. A step
completes when its check passes; the next step's target is then resolved.

## 4. Wrong-click coaching

Authored `commonMistakes: [{ when: { clicked: target }, say }]`. A click on a matching element shows the line in
the panel and records a miss at On call/Off levels.

## 5. The overlay

A spotlight (dimmed page with a cut-out and a pulsing ring) plus a small callout bubble ("Click Save"). Rendered in a
closed shadow root to avoid style collisions; repositions on scroll/resize; never blocks clicks on the target.
Hidden at On call/Off unless the learner asks for help. Implemented in `packages/dom/src/overlay.ts`.

## 6. The Recorder (Studio S1)

Author flow: Studio → *New process* → *Record* → the extension enters record mode on the approved domain → author
performs the process → *Stop* → draft steps appear in Studio.

Per interaction the recorder captures:
- `target` built from the element (role, accessible name, label, context path, nth among equals, testId if present).
- Page signature: URL path pattern (ids replaced by `*`), page heading.
- Inferred `check`: navigation → `urlMatches`; dialog appears/closes → `elementVisible`/`elementGone`; field filled →
  `fieldValue notEmpty` (never the value); confirmation banner → `textPresent` with the banner's fixed wording
  (author confirms it contains no personal data).
- Coalescing: typing in one field = one step; consecutive dropdown opens/selects = one step.

**Privacy in recording:** the recorder never stores values typed or selected. For dropdown choices that matter
("Reason: Change Line Manager"), the author marks the option text as a **static choice** (an option label from the
app, not personal data), which is then stored. Free-text inputs never are.

After recording, AI drafting (Studio S2) turns the steps into plain-language titles/instructions/whys and proposes
how/why checks; the author edits and approves.

## 7. System adapters

Most systems work with the generic engine. An **adapter** is a small per-system module for known quirks:

| Concern | Adapter provides |
|---|---|
| Single-page navigation | which events/URL changes mean "new page" |
| Custom widgets | how to read a combobox/date picker's label and filled state |
| Shadow DOM / iframes | where content lives |
| Busy states | spinners/overlays to wait for before resolving targets |
| Confirmation patterns | standard success banners |

Pilot adapters: **Oracle Cloud (Redwood + classic ADF)** and **UKG Pro**. Then Workday, ServiceNow, Salesforce
Lightning. Each adapter ships with a fixture test suite (saved DOM snapshots with personal data removed) so
regressions are caught without a live tenant.

## 8. Health monitoring

The extension reports, per step run: `{ processId, stepId, version, resolved: bool, strategy, ms }`, never DOM
content. Studio flags steps whose resolution rate dropped below 90% in 7 days, with "Re-capture this step" to
re-record just that target.

## 9. Test matrix (required for each adapter)

- Fixture tests: every target in the pilot processes resolves on saved snapshots.
- Live smoke (weekly, test tenant): record → replay → complete a full process end to end.
- Privacy tests: a page seeded with known personal data (fake SSNs, names, salaries) is run through a full process;
  assert none of those strings appear in any network payload or storage.
