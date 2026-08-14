# PAX Vault — Changelog

PAX Vault is the F3 Nation stats site. This changelog highlights the
user-facing changes — new pages, search, filters, stats, and fixes — in plain
language. Entries are grouped by month, newest first.

A few terms used below: **PAX** (a participant), **Q** (workout leader),
**AO** (workout location), **FNG** (first-timer), **ghost** (posted without
signing up), **fartsack** (signed up but didn't show).

---

## August 2026 — A real front door

**Added**

- **Redesigned home page** — the page you land on before signing in now shows
  what PAX Vault actually does, with previews of the region leaderboards, the
  AO day-of-week attendance heatmap, FNG growth, upcoming achievements,
  search, and filter chips. (The previews use made-up names and numbers; real
  data still requires sign-in.)
- **Drill-down map** on the home page laying out the full Nation → Sector →
  Area → Region → AO → PAX hierarchy.
- **F3 glossary** on the home page — PAX, Post, Q, AO, FNG, Kotter, Bestie,
  and Region — plus a "who it's for" section for Site Qs, Nantans, and
  Weasel Shakers.

**Improved**

- Signed-in visitors now get real entry points from the home page — **"Your
  Region"** and **"Your Stats"** buttons that go straight to your own home
  region and PAX page, plus the Nation dashboard and sample links — instead of
  generic marketing copy.
- The same **"Your Region"** and **"Your Stats"** shortcuts are in the navbar
  menu, so they're one tap away from any page.

**Fixed**

- The home page's "Sample PAX" and "Sample Region" buttons no longer bounce
  signed-out visitors straight back to the home page. Those links now appear
  only once you're signed in, where they actually work.

## June 2026 — Attendance accuracy

**Added**

- **Ghost & Fart Sack stats on PAX pages** — each PAX now shows how many events
  they "ghosted" (posted unannounced) and how many they "fart sacked" (signed
  up but no-showed).
- **Fart Sack King & Ghost King** — AO, Region, Area, and Sector pages crown the
  PAX with the most no-shows and the most unannounced posts. Ties are handled
  gracefully (tap to see everyone tied).
- **Fart Sackers in event rosters** — event details now list no-shows as their
  own labeled group, and roster sections are clearly labeled **Qs / PAX /
  Fart Sackers**. Ghost attendees are shown muted so no-shows stand out.

**Improved**

- No-shows are now excluded from attendance counts, rosters, "Unique PAX Met,"
  bestie, and leaderboards — so the numbers reflect who actually posted.
- Added helpful tooltips explaining the new Ghost and Fart Sack stats.

**Fixed**

- Region names no longer show "Unknown" after using **Load all events**.

## May 2026 — Insights & leaderboards

**Added**

- **AO intelligence charts** on region pages: unique PAX over time, FNG
  acquisition, unique Qs per AO, Q-depth per AO, and a day-of-week attendance
  heatmap.
- **"Q Rate"** sorting mode on the region Leaders card.

## April 2026 — Full hierarchy & smarter search

**Added**

- **Area and Sector pages** — completing the full Nation → Sector → Area →
  Region → AO drill-down.
- **Breadcrumb navigation** to move up and down the hierarchy.
- **"Include Inactive"** toggle in search to find retired regions, AOs, and PAX.
- Achievements card refinements (milestones and anniversaries).

**Fixed**

- Corrected places where **"Sectors"** were mislabeled — they're now **"Areas."**

## March 2026 — Search, achievements & polish

**Added**

- **Unified search** — one command-palette-style bar covering PAX, Regions, and
  AOs, with keyboard navigation. PAX results show home region to tell apart
  duplicate names.
- **Upcoming Achievements card** on region pages — PAX approaching post/Q
  milestones or FNG anniversaries.
- **Co-Qs** shown on event cards, color-coded (Q blue, Co-Q purple).

**Improved**

- Clearer "where am I" context lines (PAX show "AO – Region," AO pages show
  Region, region pages list their AOs).
- Meaningful browser-tab titles like "[Name] | PAX Vault."
- After signing in, you land on **your own PAX page**.
- Roster and card tooltips explain what each stat means.

**Fixed**

- PAX FNG date now falls back to the first event date when not set.

## February 2026 — Sign-in & reliability

**Added**

- **Sign in with F3 Nation** (single sign-on).
- Installed app (PWA) now reopens to the exact page you were on, including your
  filters.

**Fixed**

- Search no longer errors out or falsely reports "no results."
- Region and search pages no longer show "data not available" for valid
  entries.
- Resolved a sign-in outage shortly after launch.

## January 2026 — Filters & a big speed-up

**Added**

- **Filter drawer** (mobile and desktop) for a cleaner filtering experience.
- **Exclusion filters** (filter options _out_) and an **"Unknown AO"** option.
- **Active-filter chips** under the page header so you can see — and now remove —
  what's applied.

**Improved**

- Major performance work: page loads dropped from roughly **10–30 seconds to
  about 1–3 seconds**.

**Fixed**

- Repaired PAX search.
- Unassigned events now appear under "Unknown AO" instead of disappearing.
- Removed broken event links.

## December 2025 — First release

**Added**

- **Region stats pages** with upcoming events and 1st/2nd/3rd-F (Kotter)
  breakdowns.
- **Custom date-range filtering** on PAX and region pages.

**Fixed**

- PAX with no F3 name now show their ID instead of a blank, and PAX → region
  links work correctly.
- Upcoming Events handles missing AOs and locations.

---

_Internal changes — CI, deployment, caching, cost/observability, and pure
refactors — are omitted here. See the pull request history for the complete
technical record._
