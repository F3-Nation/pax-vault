/**
 * Public changelog data.
 *
 * Single source of truth for the /changelog page (and kept in sync with the
 * repo-root CHANGELOG.md). User-facing, plain-language entries only — internal
 * CI/deploy/refactor work is intentionally omitted. Newest release first.
 */

export type ChangeTag = "Added" | "Improved" | "Fixed";

export interface ChangelogSection {
  tag: ChangeTag;
  items: string[];
}

export interface ChangelogRelease {
  /** Human-readable period, e.g. "June 2026". */
  period: string;
  /** Short theme for the period. */
  title: string;
  sections: ChangelogSection[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    period: "August 2026",
    title: "A real front door",
    sections: [
      {
        tag: "Added",
        items: [
          "Redesigned home page — the page you land on before signing in now shows what PAX Vault actually does, with previews of the region leaderboards, the AO day-of-week attendance heatmap, FNG growth, upcoming achievements, search, and filter chips. (The previews use made-up names and numbers; real data still requires sign-in.)",
          "Drill-down map on the home page laying out the full Nation → Sector → Area → Region → AO → PAX hierarchy.",
          'F3 glossary on the home page — PAX, Post, Q, AO, FNG, Kotter, Bestie, and Region — plus a "who it\'s for" section for Site Qs, Nantans, and Weasel Shakers.',
        ],
      },
      {
        tag: "Improved",
        items: [
          'Signed-in visitors now get real entry points from the home page — "Your Region" and "Your Stats" buttons that go straight to your own home region and PAX page, plus the Nation dashboard and sample links — instead of generic marketing copy.',
          'The same "Your Region" and "Your Stats" shortcuts are in the navbar menu, so they\'re one tap away from any page.',
        ],
      },
      {
        tag: "Fixed",
        items: [
          'The home page\'s "Sample PAX" and "Sample Region" buttons no longer bounce signed-out visitors straight back to the home page. Those links now appear only once you\'re signed in, where they actually work.',
        ],
      },
    ],
  },
  {
    period: "June 2026",
    title: "Attendance accuracy",
    sections: [
      {
        tag: "Added",
        items: [
          'Ghost & Fart Sack stats on PAX pages — each PAX now shows how many events they "ghosted" (posted unannounced) and how many they "fart sacked" (signed up but no-showed).',
          "Fart Sack King & Ghost King — AO, Region, Area, and Sector pages crown the PAX with the most no-shows and the most unannounced posts. Ties are handled gracefully (tap to see everyone tied).",
          "Fart Sackers in event rosters — event details now list no-shows as their own labeled group, and roster sections are clearly labeled Qs / PAX / Fart Sackers. Ghost attendees are shown muted so no-shows stand out.",
        ],
      },
      {
        tag: "Improved",
        items: [
          'No-shows are now excluded from attendance counts, rosters, "Unique PAX Met," bestie, and leaderboards — so the numbers reflect who actually posted.',
          "Added helpful tooltips explaining the new Ghost and Fart Sack stats.",
        ],
      },
      {
        tag: "Fixed",
        items: [
          'Region names no longer show "Unknown" after using "Load all events."',
        ],
      },
    ],
  },
  {
    period: "May 2026",
    title: "Insights & leaderboards",
    sections: [
      {
        tag: "Added",
        items: [
          "AO intelligence charts on region pages: unique PAX over time, FNG acquisition, unique Qs per AO, Q-depth per AO, and a day-of-week attendance heatmap.",
          '"Q Rate" sorting mode on the region Leaders card.',
        ],
      },
    ],
  },
  {
    period: "April 2026",
    title: "Full hierarchy & smarter search",
    sections: [
      {
        tag: "Added",
        items: [
          "Area and Sector pages — completing the full Nation → Sector → Area → Region → AO drill-down.",
          "Breadcrumb navigation to move up and down the hierarchy.",
          '"Include Inactive" toggle in search to find retired regions, AOs, and PAX.',
          "Achievements card refinements (milestones and anniversaries).",
        ],
      },
      {
        tag: "Fixed",
        items: [
          'Corrected places where "Sectors" were mislabeled — they\'re now "Areas."',
        ],
      },
    ],
  },
  {
    period: "March 2026",
    title: "Search, achievements & polish",
    sections: [
      {
        tag: "Added",
        items: [
          "Unified search — one command-palette-style bar covering PAX, Regions, and AOs, with keyboard navigation. PAX results show home region to tell apart duplicate names.",
          "Upcoming Achievements card on region pages — PAX approaching post/Q milestones or FNG anniversaries.",
          "Co-Qs shown on event cards, color-coded (Q blue, Co-Q purple).",
        ],
      },
      {
        tag: "Improved",
        items: [
          'Clearer "where am I" context lines (PAX show "AO – Region," AO pages show Region, region pages list their AOs).',
          'Meaningful browser-tab titles like "[Name] | PAX Vault."',
          "After signing in, you land on your own PAX page.",
          "Roster and card tooltips explain what each stat means.",
        ],
      },
      {
        tag: "Fixed",
        items: [
          "PAX FNG date now falls back to the first event date when not set.",
        ],
      },
    ],
  },
  {
    period: "February 2026",
    title: "Sign-in & reliability",
    sections: [
      {
        tag: "Added",
        items: [
          "Sign in with F3 Nation (single sign-on).",
          "Installed app (PWA) now reopens to the exact page you were on, including your filters.",
        ],
      },
      {
        tag: "Fixed",
        items: [
          'Search no longer errors out or falsely reports "no results."',
          'Region and search pages no longer show "data not available" for valid entries.',
          "Resolved a sign-in outage shortly after launch.",
        ],
      },
    ],
  },
  {
    period: "January 2026",
    title: "Filters & a big speed-up",
    sections: [
      {
        tag: "Added",
        items: [
          "Filter drawer (mobile and desktop) for a cleaner filtering experience.",
          'Exclusion filters (filter options out) and an "Unknown AO" option.',
          "Active-filter chips under the page header so you can see — and now remove — what's applied.",
        ],
      },
      {
        tag: "Improved",
        items: [
          "Major performance work: page loads dropped from roughly 10–30 seconds to about 1–3 seconds.",
        ],
      },
      {
        tag: "Fixed",
        items: [
          "Repaired PAX search.",
          'Unassigned events now appear under "Unknown AO" instead of disappearing.',
          "Removed broken event links.",
        ],
      },
    ],
  },
  {
    period: "December 2025",
    title: "First release",
    sections: [
      {
        tag: "Added",
        items: [
          "Region stats pages with upcoming events and 1st/2nd/3rd-F (Kotter) breakdowns.",
          "Custom date-range filtering on PAX and region pages.",
        ],
      },
      {
        tag: "Fixed",
        items: [
          "PAX with no F3 name now show their ID instead of a blank, and PAX → region links work correctly.",
          "Upcoming Events handles missing AOs and locations.",
        ],
      },
    ],
  },
];
