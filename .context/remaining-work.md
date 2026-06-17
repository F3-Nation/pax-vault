# Remaining Work — after the CTO roadmap pass

Status as of the `cto-review-roadmap` branch. The substantive roadmap
([cto-review-roadmap.md](cto-review-roadmap.md)) is executed; this tracks what
was **deliberately deferred**, **blocked on a decision**, or is an **operator
action**. Nothing here is a pressing code defect.

## Deferred by design (incremental / opportunistic / needs a visual pass)

- **#17 — finish the big-component splits.** The `pageFilter` accordion drawer
  (Region/AO/Tag/Type/Category sections, heavily `useState`-coupled) and
  `events.tsx` (~36KB). Do incrementally when next editing them. Note: HeroUI
  `<Accordion>` requires `<AccordionItem>` as direct children, so any section
  extraction must return `AccordionItem` directly (not wrap it in a component).
  _Already done:_ the active-filter chip subsystem was extracted to
  `ActiveFilterChips.tsx`.
- **#12 — finish the SummaryCard de-dup.** Unify the per-row markup into a
  shared `StatRow` (region rows use `text-sm`, area/sector don't — normalizing
  needs a visual check) and migrate the PAX `SummaryCard` (11 rows, structurally
  different). `renderStat` + `HelpHint` are already shared.
- **#20 — tighten the server/client seam.** Move static dashboard cards to
  Server Components, pushing `"use client"` to interactive leaves. Real
  bundle-size win, but a large refactor — do when next reworking the dashboard.
- **#21 — file-naming consistency.** PascalCase components / camelCase utils.
  Low value, churn-y; opportunistic only. (`nation/` needs no loader — it's a
  static page.)

## Blocked on a product decision

- **Charts (#2 / #18 trend deltas).** Charts are intentionally hidden site-wide
  (region/area/sector). "Ship charts properly" = un-hide all three consistently
  **and** fix the chart-quality issues (readable labels, color-encoding), then
  add trend deltas/CTAs. Real feature work — awaiting a go/no-go.
- **#19 — warmer empty/celebration copy.** Subjective; pair on it if wanted.

## Operator actions (not code — see [ops-runbook.md](ops-runbook.md))

- Rotate `SESSION_SECRET`; move prod secrets off the laptop to Secret Manager.
- Add an uptime check (public landing page) + a BigQuery billing budget alert.
- Pick an error-tracking provider and wire the single `TODO(P0-3)` hook in
  `src/lib/observability.ts` (set its DSN as a secret).
- Run `npm run test:e2e` (local smoke suite) in your workflow; it needs
  `npx playwright install chromium` once.

## Done (for reference)

P0–P3 executed: caching, error seam, full query parameterization, the filter
contract, postmortem regression tests, mobile/height fixes, local smoke test,
dead-code/dep cleanup, entity de-dup (empty-state / `renderStat` / `HelpHint` /
breadcrumb), `normalizeDeep`, dashboard reorder, leaderboard ranks, mobile
attendee collapse, focus-visible baseline, navbar F3 glyph, removable filter
chips, ops runbook, and the serving-tier ADR.
