# PAX-VAULT — CTO Review & Unified Go-Forward Plan

## Context

PAX-Vault is a Next.js 16 / React 19 analytics & observability dashboard for **F3 Nation** — a
decentralized volunteer fitness organization (Nation → Sectors/Areas → Regions → AOs → PAX). It
answers leadership questions ("are we growing?", "who's carrying the Q load?", "who's drifting?") by
querying a BigQuery warehouse and rendering server-side leaderboards, summaries, and charts. It is
**deployed and in active development** on Firebase App Hosting (Cloud Run), gated behind F3's OAuth.

This document is the deliverable: an evidence-based assessment plus one prioritized roadmap,
integrating three review lenses — **engineering (CTO), design (CDO), and application architecture
(senior engineer).** Every recommendation is calibrated to the real constraint — **a solo /
volunteer-driven team** — so the bar is not "best practice" but _"the smallest change that buys the
most reliability, cost, security, and felt-quality at once, with the least ongoing maintenance."_

### One-line verdict

The product is **well-built and roughly 80% of the way there.** The architecture is pragmatic, the
layering is disciplined, and the design is clean. The work ahead is **not building more — it's
hardening, caching, and sharpening what already exists.** Almost none of it is a rewrite.

---

## The strategic thesis: three pillars

All findings collapse into three moves. The roadmap below is ordered to deliver them.

1. **HARDEN** _(reliability + security)._ Today the team learns about incidents from users, not
   monitoring (both postmortems were user-reported); the unsafe query path (string interpolation) is
   the _easy_ one; and the known failure modes have no tests. Fix: error tracking, query parameters,
   and tests for the things that have already broken.
2. **CACHE** _(cost + scale + speed)._ Every authenticated page load runs a live BigQuery query with
   **zero caching.** BigQuery is an OLAP warehouse (per-query latency + cost), not a serving DB —
   using it as one is the root cause behind the incidents, the cost curve, and the latency. Fix:
   a thin Next.js caching layer in front of it. (Postgres/materialized serving tier stays a
   _documented-but-unbuilt_ "if it grows" option — too much maintenance for one person now.)
3. **SHARPEN** _(design + architecture, without over-abstracting)._ The UI _displays data instead of
   driving decisions_, and the same contracts (filters, normalization, empty-states, stat cards) are
   copy-pasted across five entity verticals. Fix: centralize the duplicated contracts and make a
   handful of high-impact UI changes (un-hide the already-built trend chart, fix the mobile-breaking
   heights, rank the leaderboard) — favoring shared _utilities_ over a clever factory.

---

## What's working (protect these — do not "improve" them)

- **Disciplined layering (verified).** `lib/db` is imported _only_ by `lib/bq/*` and `auth/allowlist`
  — no page or component reaches the database directly. A real, enforced data-access boundary.
- **Two data paths that share the DAL, not duplicate it.** The SSR loader (`getPageData`) and the
  client API route (`getEvents`) both sit on the same `lib/bq/regions.ts`. Correct SSR-first +
  client-interaction split. **Do not merge them.**
- **Pragmatic stack choices.** App Router + server-component loaders; one BQ query per page
  (cost-conscious by design); URL-based filter state (shareable, no Redux); HeroUI design system with
  real light/dark tokens. The team correctly _avoided_ Redux/React Query/a custom component lib.
- **Real engineering discipline already in CI** (`.github/workflows/pr.yaml`): strict TypeScript,
  ESLint `--max-warnings 0`, Prettier check, `tsc --noEmit`. No `ts-ignore`, no TODO litter.
- **Mature incident culture.** Two well-written postmortems in `.context/postmortems/` — the roadmap
  leans on them as a test spec.
- **Strong design fundamentals.** The region **migration empty-state** is genuinely excellent (use it
  as the template for all empty states); dual-mode leaderboard, fast client-side event search, and
  the mobile tooltip→popover swap are thoughtful.

---

## Setting the record straight (two findings were overstated)

Rigor matters in a review — these corrections prevent the roadmap from chasing false alarms:

- **"SESSION_SECRET is committed/exposed in the repo" — FALSE.** `.gitignore` excludes `.env*` (only
  `.env.example` is tracked) and `git ls-files` confirms `.env.firebase` is **not** in git. The
  secret lives only in a local file on the dev machine. → downgraded from "breach" to a **hygiene
  item** (P1-#7): production secrets shouldn't sit in plaintext on a laptop.
- **"SQL injection" — real pattern, low actual severity.** In `auth/allowlist.ts` the email is
  OAuth-sourced + quote-escaped and the table name is operator-controlled (env var), so it is not
  exploitable today. The defensible finding is _systemic_: `lib/db.ts` `queryBigQuery()` accepts only
  a raw SQL string — **no parameter support at all** — so every query is built by interpolation. A
  latent hazard to close cheaply, not an active vulnerability.
- **Design "brand = F" — tempered.** For a solo-maintained, auth-gated internal tool, "clean and
  generic" is acceptable; a rebrand is not worth scarce volunteer time. Demoted to P3.

---

## Unified roadmap

Ordered by leverage-per-effort and dependency. Tags: discipline **[Eng]/[Design]/[Arch]** ·
priorities served **[Rel]** reliability · **[Cost]** cost/scale · **[Sec]** security · **[UX]**
velocity/polish.

### P0 — Do first (days; biggest bang, smallest effort, low risk)

1. **Cache the page loaders.** [Eng][Cost·Rel·UX] Add a revalidate window —
   `export const revalidate = 3600` on `src/app/stats/**/page.tsx`, or wrap the loaders' BQ calls in
   `unstable_cache` with a per-entity tag. Workout data changes daily, not per-second, so this cuts
   BigQuery cost/bytes by ~1–2 orders of magnitude on repeat views, removes BQ from the hot path, and
   makes nav feel instant — with near-zero upkeep. _Files:_ `region/[regionId]/loader.ts` + the
   `ao/pax/area/sector` siblings.
2. ~~**Un-hide and finish the region trend chart.**~~ **RECLASSIFIED → see "Ship charts properly"
   in P2.** Initial assumption was that the region chart was _accidentally_ left hidden. On execution
   this proved **false**: region, area, AND sector pages all hide their charts with the same `hidden`
   class (`components/region/PageWrapper.tsx:143`, `app/stats/area/[areaId]/page.tsx:105`,
   `app/stats/sector/[sectorId]/page.tsx:94`) — a deliberate, site-wide disable, not a slip. P0-2 was
   implemented then reverted (commits `e2ca1cc` → `c44e72d`) to preserve production behavior. Showing
   charts is real feature work (consistent un-hide across all 3 entities + the chart-quality fixes
   noted by the design review), not a flag flip. Tracked under P2 #14-area below.
3. **Wire up error tracking (Sentry, free tier).** [Eng][Rel·Sec] `src/app/error.tsx` already
   references this as "future work." Lowest-maintenance way to stop hearing about incidents from
   users. Add to the global error boundary + API route catch blocks. ~1 hour.
4. **Add BQ query-parameter support, then convert the allowlist query.** [Eng][Sec] Extend
   `lib/db.ts` `queryBigQuery()` to accept an optional `params` object passed to
   `bigquery.query({ query, params })`; convert `auth/allowlist.ts` first. Makes the _safe_ path the
   _easy_ path for all future queries without a big migration.

### P1 — Lock in correctness (weeks; kill the known failure classes)

5. **Single filter contract.** [Arch][Rel·Sec] Create `lib/filters.ts` exporting `StatsFilters` (the
   type), `parseFilterParams()`, and `filtersToQueryString()`. Replace the **three** near-identical
   "comma-string → number[]" parsers (`region/[regionId]/page.tsx:40`, the events `route.ts:19`, and
   the bq modules) and the per-loader re-declared filter types. Both postmortems were this exact
   drift class — this is the highest-leverage structural fix.
6. **Tests for the two incidents that already happened.** [Eng][Rel] The postmortems name exactly
   what to test: assert the search routes (`/api/region/list`, `/api/search`) return HTTP **500 (not
   200 + `[]`)** when BQ throws, and that location/dataset are configured. Re-enable the BQ suite
   currently disabled in `vitest.config` ("DISABLING TESTS FOR NOW…"). Regression insurance, not
   coverage-chasing.
7. **Fix the four hardcoded card heights.** [Design][UX] A _pattern_, not a one-off:
   `AchievementsCard.tsx:346` `h-[1105px]`, `KotterCard.tsx:216` & `upcomingEvents.tsx:74` `h-[500px]`,
   `AOBreakdownCard.tsx:55` `h-[400px]`. On a phone the 1105px card swallows the viewport and traps
   scroll. Replace with `max-h-[60vh]` + `overflow-y-auto` (or first-N rows + "View all"). Pure bug-fix.
8. **One Playwright smoke test in CI.** [Eng][Rel] A single happy path (sign-in redirect → load a
   region page → search returns results) catches deploy-level breakage unit tests miss. Keep it to
   _one_ flow — a volunteer team shouldn't maintain a big E2E suite.
9. **Secret hygiene + ops alerts.** [Eng][Sec·Rel·Cost] Stop keeping prod secrets in `.env.firebase`
   on the laptop; pull from Google Secret Manager when needed, and rotate `SESSION_SECRET` once as
   hygiene. Add a free external uptime check + a GCP **BigQuery budget alert** (catches "site down"
   and "runaway query cost" with zero code).

### P2 — Maintainability & structural cleanup (when there's slack)

10. **Finish parameterizing `lib/bq/*`.** [Eng][Sec] Convert `search.ts`, `pax.ts`, `regions.ts`
    LIKE/ID interpolation onto the `params` path from P0-#4. Numeric-ID lists are already validated
    via `Number.isFinite`, so prioritize the string/LIKE clauses.
11. **Delete dead code & unused deps.** [Arch][UX] Remove the dead bq modules `aos.disable.ts`,
    `pax.disable.ts`, and `regions.desable.ts` (**note the typo** — which is why a `*.disable.ts`
    grep missed it); drop the unused `pg` dependency; refresh the stale `baseline-browser-mapping`.
12. **De-duplicate the entity verticals.** [Arch·Design][UX] Extract the shared primitives the five
    verticals copy-paste: a parameterized `<EntityDataUnavailable entity="Region" />` (the excellent
    60-line empty state, currently inline in each `page.tsx`), a shared `<StatRow>`/`SummaryCard` (the
    five near-duplicate variants), and a `buildBreadcrumb()` helper. Drops each `page.tsx` from ~229
    to ~40 lines and gives one place to change stat-row styling. _(Do NOT build a generic
    `createStatsPage` factory — see anti-recommendations.)_
13. **Centralize BQ→domain deserialization.** [Arch][Rel] Replace the per-loader
    `JSON.parse(JSON.stringify(..., replacer))` (slow; silently corrupts `Date`s) with one typed
    `normalizeDeep<T>()` in `lib/db.ts` handling `{value}`, `bigint`, and `DATE`. One place to fix
    serialization bugs.
14. **Reorder the dashboard to a decision pyramid.** [Design][UX] Today every card carries equal
    weight. Reorder toward how a leader thinks: **KPI/trend hero → leaders → drill-down
    (Achievements/Kotter) → event log.**
15. **Make the leaderboard active.** [Design][UX] Add rank numbers (`#1…#n`) and bold the metric in
    the primary color (today it's muted). Tiny change, outsized engagement lift.
16. **Collapse mobile event-card attendees.** [Design][UX] 20+ attendee chips become a wall on a
    phone — collapse to a count ("42 PAX") with tap-to-expand.
17. **Split the two oversized components.** [Design][UX] `components/events.tsx` (~36KB) and
    `pageFilter.tsx` (~39KB). Extract `EventList`/`EventModal` and the filter sections — but
    _opportunistically, when next editing them_, not as a standalone project.

### P3 — Polish & "if it grows" (backlog, not commitments)

18. **UX fit-and-finish.** [Design][UX] Search-modal loading spinner; active-filter chips below the
    page header; verify focus-visible rings on dark backgrounds; trend deltas (↑/↓ % vs rolling avg)
    and light "celebrate/flag" CTAs on the insight cards.
19. **Cheap brand equity.** [Design][UX] Drop a real F3 logo/glyph into the (currently text-only)
    navbar and warm up empty/celebration-state voice. Full palette/font/regional-color work stays
    out of scope until there's a designer.
20. **Tighten the server/client seam.** [Arch][Cost·UX] 35 `use client` files ship static cards as
    JS. Keep static cards as server components, push `use client` to interactive leaves — real
    bundle-size win, but do it _when next refactoring the dashboard_.
21. **Standardize file naming** (PascalCase components, camelCase utils) and give `nation/` the
    missing `loader`/`loading` for consistency. [Arch]
22. **Documented-but-unbuilt: Postgres/materialized serving tier** (one-page ADR) and **rate limiting**
    on `/api/*` — both only if traffic/cost data shows the need. [Eng][Cost·Rel·Sec]

---

## What I deliberately do NOT recommend (for a solo / volunteer team)

Common "CTO checklist" items that add maintenance without proportional payoff at this scale:

- ❌ **Standing up Postgres / a data pipeline now** — P0 caching solves the real problem far cheaper.
- ❌ **Merging the loader and API data paths** — the split is correct.
- ❌ **A generic `createStatsPage` loader/page factory** — factories over-abstract fast; ship the
  shared _utilities_ (filters, primitives, normalization) first and let the pattern emerge. Three
  small shared functions beat one magic factory for one maintainer.
- ❌ **A state-management lib or client data-fetching layer** to "fix" the searchParams blob — a
  single typed `filters` object (or `useSearchParams`) is enough.
- ❌ **A coverage-number chase or a large E2E suite** — test the _known_ failure modes only.
- ❌ **A design-system-and-rebrand project** — new font, regional color theming, custom HeroUI theme.
- ❌ **Heavy process** — ADR-for-everything, deployment approval gates, husky pre-commit hooks (CI
  already enforces the gates).
- ❌ **Replacing HeroUI, the state approach, or the monolith** (no microservices/GraphQL/service mesh).

---

## How to verify (end-to-end)

- **Caching (#1):** load a region page twice; in GCP BigQuery → Job History confirm the second load
  issues **no** new job within the revalidate window; repeat nav feels instant.
- **Trend chart (#2):** the un-hidden chart renders with correct title/labels and a proper
  empty/loading state.
- **Error tracking (#3):** throw a test error; confirm it lands in Sentry with the same error ID
  surfaced by `error.tsx`.
- **Query params (#4, #10):** sign in end-to-end (`npm run dev` on HTTPS :3001 → OAuth → callback →
  allowlist passes); the new `params` path is exercised under unit test.
- **Filter contract (#5):** all three old parsers are deleted; region SSR + client filter re-query +
  shareable URL still round-trip identically.
- **Incident tests (#6):** `npm run test` — search routes return 500 (not 200+`[]`) when BQ throws;
  re-enabled BQ suite passes.
- **Smoke test (#8):** Playwright green on sign-in → region → search in CI.
- **Full quality gate:** `npm run format:check && npm run lint && npm run typecheck && npm run build
&& npm run test` all pass (mirrors `.github/workflows/pr.yaml`).
- **Design (#7, #14–#16):** this review was code-based — before executing design items, do a **live
  device audit** (real iPhone + Android, portrait _and_ landscape) of the region dashboard, focusing
  on the four height-bug cards and the events list.

---

## Quick reference

| #   | Item                                                         | Tier | Disc.       | Serves       | Effort | Maint. |
| --- | ------------------------------------------------------------ | ---- | ----------- | ------------ | ------ | ------ |
| 1   | Cache page loaders (`revalidate`/`unstable_cache`)           | P0   | Eng         | Cost·Rel·UX  | S      | none   |
| 2   | ~~Un-hide region trend chart~~ → ship charts properly (P2)   | P2   | Design      | UX           | M      | low    |
| 3   | Sentry error tracking                                        | P0   | Eng         | Rel·Sec      | S      | none   |
| 4   | BQ param support + convert allowlist                         | P0   | Eng         | Sec          | S      | low    |
| 5   | `lib/filters.ts` — single filter contract                    | P1   | Arch        | Rel·Sec      | M      | low    |
| 6   | Tests for the two postmortem incidents                       | P1   | Eng         | Rel          | M      | low    |
| 7   | Fix 4 hardcoded card heights (mobile)                        | P1   | Design      | UX           | S      | none   |
| 8   | One Playwright smoke test in CI                              | P1   | Eng         | Rel          | M      | low    |
| 9   | Secret hygiene + uptime/BQ-budget alerts                     | P1   | Eng         | Sec·Rel·Cost | S      | none   |
| 10  | Finish parameterizing `lib/bq/*`                             | P2   | Eng         | Sec          | M      | low    |
| 11  | Delete dead `.disable`/`.desable`, drop `pg`                 | P2   | Arch        | UX           | S      | none   |
| 12  | De-dup entity verticals (empty-state, StatRow, breadcrumb)   | P2   | Arch·Design | UX           | M      | low    |
| 13  | Centralize `normalizeDeep<T>()` in `lib/db.ts`               | P2   | Arch        | Rel          | M      | low    |
| 14  | Reorder dashboard to a decision pyramid                      | P2   | Design      | UX           | M      | low    |
| 15  | Rank numbers + bold metric on leaderboard                    | P2   | Design      | UX           | S      | none   |
| 16  | Collapse mobile event-card attendees                         | P2   | Design      | UX           | S      | low    |
| 17  | Split `events.tsx` / `pageFilter.tsx`                        | P2   | Design      | UX           | M      | low    |
| 18  | UX fit-and-finish (spinner, chips, focus, trend deltas/CTAs) | P3   | Design      | UX           | M      | low    |
| 19  | Cheap brand equity (F3 logo in navbar, warmer copy)          | P3   | Design      | UX           | S      | low    |
| 20  | Tighten server/client seam (static cards → RSC)              | P3   | Arch        | Cost·UX      | L      | low    |
| 21  | Naming consistency + `nation/` loader parity                 | P3   | Arch        | UX           | S      | none   |
| 22  | ADR for Postgres serving tier; rate limiting (if needed)     | P3   | Eng         | Cost·Rel·Sec | M      | low    |

**Bottom line:** PAX-Vault is well-built and the team's instincts are sound. The single most valuable
sequence is **cache BigQuery, start hearing about your own errors, un-hide the chart you already
built, and centralize the filter contract that has already caused two outages.** Everything else is
refinement — and almost none of it is a rewrite.
