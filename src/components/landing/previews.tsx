/**
 * Landing-page preview visuals.
 *
 * These are *illustrative mockups* — static, dependency-free markup that shows
 * a signed-out visitor what PAX Vault looks like without hitting BigQuery or
 * exposing real PAX data. Numbers are invented; every component that shows one
 * carries a "Sample" marker so nobody mistakes it for live data.
 *
 * Conventions:
 * - Plain markup + Tailwind/HeroUI color tokens (no HeroUI components) so these
 *   stay cheap to render and obviously distinct from the real cards.
 * - Everything is presentational: no props, no state, no client JS.
 *
 * Color gotcha: `tailwind.config.ts` maps `primary`/`secondary`/`foreground` to
 * bare `var(--…)` values, so Tailwind cannot emit opacity modifiers for them —
 * `bg-primary/20` compiles to nothing. Brand tints therefore go through
 * `tint()` below, and muted text uses HeroUI's `default-*` scale (which does
 * support alpha) instead of `text-foreground/xx`.
 */

/** Build a translucent shade of a brand CSS variable. See the note above. */
function tint(cssVar: string, percent: number): string {
  return `color-mix(in srgb, var(${cssVar}) ${percent}%, transparent)`;
}

/** Small label used in the corner of each mock so it reads as a sample. */
function SampleTag() {
  return (
    <span className="rounded-full border border-default-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-default-500">
      Sample
    </span>
  );
}

/** Shared chrome for a mock: rounded surface + header row. */
function MockFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-xl border border-default-200 bg-content1 shadow-sm">
      <div className="flex items-center justify-between border-b border-default-200 px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        <SampleTag />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAX summary card                                                    */
/* ------------------------------------------------------------------ */

const PAX_STATS: ReadonlyArray<[label: string, value: string]> = [
  ["Total Events", "412"],
  ["Total Qs", "68"],
  ["Unique PAX Met", "289"],
  ["Bestie", "Splinter (137)"],
  ["FNG Date", "03/14/2021"],
];

/** Mock of the per-PAX summary card. */
export function PaxCardPreview() {
  return (
    <MockFrame title="PAX Summary">
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary"
          style={{ backgroundColor: tint("--primary", 18) }}
        >
          BB
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Bunker Buster</div>
          <div className="truncate text-xs text-default-500">
            The Ridge – Metro Region
          </div>
        </div>
      </div>

      <dl className="space-y-0.5 text-sm">
        {PAX_STATS.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-b border-default-200/60 py-1.5 last:border-b-0"
          >
            <dt className="text-primary">{label}:</dt>
            <dd className="text-default-700">{value}</dd>
          </div>
        ))}
      </dl>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

const LEADERS: ReadonlyArray<{
  name: string;
  posts: number;
  pct: number;
  crown?: string;
}> = [
  { name: "Sundial", posts: 148, pct: 100, crown: "Q King" },
  { name: "Chum Bucket", posts: 131, pct: 88 },
  { name: "Tin Cup", posts: 119, pct: 80 },
  { name: "Waffle House", posts: 104, pct: 70 },
  { name: "Pothole", posts: 92, pct: 62 },
];

/** Mock of the region Leaders card — ranked PAX with relative-volume bars. */
export function LeaderboardPreview() {
  return (
    <MockFrame title="Leaders — Posts">
      <ul className="space-y-2.5">
        {LEADERS.map((leader, i) => (
          <li key={leader.name} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-right text-xs tabular-nums text-default-400">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {leader.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-default-500">
                  {leader.posts}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-default-200">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${leader.pct}%` }}
                />
              </div>
            </div>
            {leader.crown && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-warning"
                style={{ backgroundColor: tint("--warning", 18) }}
              >
                {leader.crown}
              </span>
            )}
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Trend chart                                                         */
/* ------------------------------------------------------------------ */

const UNIQUE_PAX = [42, 48, 45, 53, 61, 58, 66, 72, 69, 78, 85, 91];

const CHART_W = 300;
const CHART_H = 90;
const CHART_PAD = 10;

/** Map a series to an SVG polyline point list inside the chart viewBox. */
function toPoints(values: readonly number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = CHART_W / (values.length - 1);
  const usableH = CHART_H - CHART_PAD * 2;

  return values
    .map((value, i) => {
      const x = i * step;
      const y = CHART_H - CHART_PAD - ((value - min) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Mock of the "unique PAX over time" region chart. */
export function TrendChartPreview() {
  const points = toPoints(UNIQUE_PAX);

  return (
    <MockFrame title="Unique PAX over time">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">91</span>
        <span className="text-xs font-medium text-success">
          +117% vs. last year
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-24 w-full text-primary"
        preserveAspectRatio="none"
        role="img"
        aria-label="Sample line chart showing unique PAX rising over twelve months"
      >
        {/* Filled area under the line. */}
        <polygon
          points={`0,${CHART_H} ${points} ${CHART_W},${CHART_H}`}
          fill="currentColor"
          opacity="0.15"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-default-400">
        <span>Jan</span>
        <span>Jun</span>
        <span>Dec</span>
      </div>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* FNG acquisition                                                     */
/* ------------------------------------------------------------------ */

const FNGS = [3, 5, 2, 6, 4, 7, 5, 9, 6, 8, 11, 7];

/** Mock of the FNG-acquisition bar chart. */
export function FngChartPreview() {
  const max = Math.max(...FNGS);

  return (
    <MockFrame title="FNGs per month">
      <div className="flex h-24 items-end gap-1.5">
        {FNGS.map((count, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${(count / max) * 100}%`,
              backgroundColor: tint("--secondary", 75),
            }}
          />
        ))}
      </div>
      <div className="mt-2 text-xs text-default-500">
        <span className="font-semibold text-foreground">73 FNGs</span> in the
        last 12 months
      </div>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Day-of-week heatmap                                                 */
/* ------------------------------------------------------------------ */

const DAYS = ["M", "Tu", "W", "Th", "F", "Sa"];
const HEATMAP: ReadonlyArray<{ ao: string; values: number[] }> = [
  { ao: "The Ridge", values: [4, 0, 3, 0, 4, 5] },
  { ao: "Anvil", values: [2, 3, 0, 3, 2, 4] },
  { ao: "Gauntlet", values: [0, 4, 2, 4, 0, 3] },
  { ao: "Boneyard", values: [3, 1, 4, 0, 3, 5] },
  { ao: "Sawmill", values: [1, 2, 1, 2, 4, 2] },
];

/** Brand-tint strength per intensity bucket; 0 means "no workout that day". */
const HEAT_TINT = [0, 25, 45, 65, 82, 100];

/** Mock of the AO × day-of-week attendance heatmap. */
export function HeatmapPreview() {
  return (
    <MockFrame title="Attendance by day">
      <div className="space-y-1.5">
        {/* Column headers */}
        <div className="flex items-center gap-1.5">
          <span className="w-16 shrink-0" />
          {DAYS.map((day) => (
            <span
              key={day}
              className="flex-1 text-center text-[10px] text-default-400"
            >
              {day}
            </span>
          ))}
        </div>

        {HEATMAP.map((row) => (
          <div key={row.ao} className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 truncate text-[11px] text-default-600">
              {row.ao}
            </span>
            {row.values.map((value, i) =>
              value === 0 ? (
                <span
                  key={i}
                  className="h-5 flex-1 rounded-sm bg-default-200"
                />
              ) : (
                <span
                  key={i}
                  className="h-5 flex-1 rounded-sm"
                  style={{
                    backgroundColor: tint("--primary", HEAT_TINT[value]),
                  }}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Upcoming achievements                                               */
/* ------------------------------------------------------------------ */

const ACHIEVEMENTS: ReadonlyArray<{
  name: string;
  detail: string;
  tag: string;
  tone: "primary" | "secondary" | "success";
}> = [
  {
    name: "Tin Cup",
    detail: "3 posts from 500",
    tag: "Posts",
    tone: "primary",
  },
  { name: "Pothole", detail: "1 Q from 100", tag: "Qs", tone: "secondary" },
  {
    name: "Waffle House",
    detail: "5-year anniversary in 6 days",
    tag: "Anniversary",
    tone: "success",
  },
];

const TONE_TEXT = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
} as const;

const TONE_VAR = {
  primary: "--primary",
  secondary: "--secondary",
  success: "--success",
} as const;

/** Mock of the Upcoming Achievements card. */
export function AchievementsPreview() {
  return (
    <MockFrame title="Upcoming Achievements">
      <ul className="space-y-2">
        {ACHIEVEMENTS.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-2 rounded-lg bg-default-100 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.name}</div>
              <div className="truncate text-xs text-default-500">
                {item.detail}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_TEXT[item.tone]}`}
              style={{ backgroundColor: tint(TONE_VAR[item.tone], 18) }}
            >
              {item.tag}
            </span>
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

const SEARCH_RESULTS: ReadonlyArray<[group: string, label: string]> = [
  ["PAX", "Sundial — Metro Region"],
  ["PAX", "Sundial — Lake Region"],
  ["AO", "Sundial Park"],
  ["Region", "Sundown Valley"],
];

/** Mock of the command-palette-style unified search. */
export function SearchPreview() {
  return (
    <MockFrame title="Search">
      <div className="flex items-center gap-2 rounded-lg border border-default-200 bg-default-100 px-3 py-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-4 w-4 shrink-0 text-default-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="text-sm text-default-700">sund</span>
        <span className="h-4 w-px animate-pulse bg-primary" />
        <span className="ml-auto rounded border border-default-300 px-1.5 py-0.5 text-[10px] text-default-500">
          ⌘K
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {SEARCH_RESULTS.map(([group, label], i) => (
          <li
            key={label}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
            style={
              i === 0 ? { backgroundColor: tint("--primary", 12) } : undefined
            }
          >
            <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-default-400">
              {group}
            </span>
            <span className="truncate text-default-700">{label}</span>
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Active filters                                                      */
/* ------------------------------------------------------------------ */

const FILTERS = [
  "Last 12 months",
  "The Ridge",
  "Anvil",
  "Bootcamp",
  "Exclude: Unknown AO",
];

/** Mock of the active-filter chip row that sits under every page header. */
export function FiltersPreview() {
  return (
    <MockFrame title="Active filters">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <span
            key={filter}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-primary"
            style={{ backgroundColor: tint("--primary", 14) }}
          >
            {filter}
            <span aria-hidden="true" className="opacity-50">
              ×
            </span>
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-default-500">
        Filters follow you across drill-downs and survive a page reload.
      </p>
    </MockFrame>
  );
}
