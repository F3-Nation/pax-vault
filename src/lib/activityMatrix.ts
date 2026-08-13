/**
 * PAX activity matrix — pure shaping logic for the AO x week heatmap.
 *
 * Kept free of React and BigQuery imports so the bucketing rules (which carry
 * all the judgement) are unit-testable on their own.
 *
 * The BigQuery layer returns one row per (AO, week). This turns that into a
 * dense grid: a fixed run of week columns, one row per AO ranked by total
 * posts, with the long tail collapsed into a single "Other" row.
 *
 * Why collapse: across ~19k active PAX the median posts at 5 AOs and p90 at
 * 14, but the tail runs to 86. Rendering every AO would make the common case
 * fine and the tail unreadable.
 */
import type { PaxAOWeeklyActivity } from "@/lib/types";

/** Default number of week columns when no date filter is active. */
export const ACTIVITY_WEEKS = 52;

/** Hard cap on columns, so a multi-year custom filter can't render hundreds. */
export const ACTIVITY_MAX_WEEKS = 104;

/** AO rows shown before the remainder collapses into "Other". */
export const ACTIVITY_TOP_AOS = 10;

/** Sentinel ao_org_id for the collapsed "Other" row (never a real org id). */
export const OTHER_AO_ID = 0;

export interface ActivityMatrixRow {
  ao_org_id: number;
  ao_name: string;
  region_name: string | null;
  /** Post count per week, aligned to `weeks`; 0 where there was no activity. */
  counts: number[];
  /** Row total across the window. */
  total: number;
  /** True for the collapsed "Other" row. */
  isOther: boolean;
  /** How many AOs the "Other" row represents; 0 for real AO rows. */
  otherAoCount: number;
}

/** A run of consecutive week columns belonging to one calendar month. */
export interface MonthSpan {
  /** 'YYYY-MM' of the month. */
  key: string;
  /** Short label, e.g. "Aug". */
  label: string;
  /** How many week columns this month covers. */
  span: number;
}

export interface ActivityMatrix {
  /** Week keys (Monday, 'YYYY-MM-DD'), oldest first. */
  weeks: string[];
  /** Month header segments spanning the week columns, GitHub-style. */
  monthSpans: MonthSpan[];
  rows: ActivityMatrixRow[];
  /** Largest single cell value. */
  max: number;
  /**
   * Upper bound of ramp levels 1, 2 and 3 (level 4 is anything above).
   * Quartiles of the non-zero cells rather than fractions of `max`: a PAX with
   * one dominant AO would otherwise flatten every other AO into the faintest
   * shade.
   */
  thresholds: [number, number, number];
  /** Total posts represented by the matrix. */
  total: number;
  /** True when the PAX posted in more than one region, so rows label region. */
  multiRegion: boolean;
}

/** Format a Date as 'YYYY-MM-DD' in UTC. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Monday of the week containing `date`, in UTC.
 *
 * Monday-start matches `DATE_TRUNC(..., WEEK(MONDAY))` in the query and
 * `buildRangeDates` elsewhere in the app.
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/** Monday of the week containing an ISO 'YYYY-MM-DD' date, as ISO. */
export function startOfWeekISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(startOfWeek(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))));
}

/** Shift an ISO date by whole weeks (negative goes back). */
export function addWeeks(iso: string, weeks: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return isoDate(date);
}

/**
 * Build the trailing run of week keys (Mondays) ending with the week that
 * contains `endDate`.
 *
 * The window is generated, never derived from the data: some pv_events rows
 * carry typo'd dates centuries in the future, and deriving bounds from them
 * would stretch the axis to uselessness.
 */
export function buildWeekKeys(
  endDate: Date,
  count: number = ACTIVITY_WEEKS,
): string[] {
  const last = startOfWeek(endDate);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(isoDate(d));
  }
  return keys;
}

/**
 * Every Monday from `start` to `end` inclusive.
 *
 * Both bounds are snapped to Mondays first, so a caller passing a mid-week
 * filter date still gets aligned columns. Returns a single column when the
 * range inverts, rather than looping forever.
 */
export function buildWeekRange(start: string, end: string): string[] {
  const first = startOfWeekISO(start);
  const last = startOfWeekISO(end);
  if (first > last) return [last];

  const keys: string[] = [];
  let cursor = first;
  // Bounded so a malformed input can't spin.
  for (let i = 0; i < ACTIVITY_MAX_WEEKS && cursor <= last; i++) {
    keys.push(cursor);
    cursor = addWeeks(cursor, 1);
  }
  return keys;
}

/**
 * Collapse week columns into month header segments.
 *
 * A week belongs to the month its Monday falls in, so a month's label sits
 * above the first week that starts in it — the same rule GitHub uses. The
 * leading segment is usually partial and still gets a label.
 */
export function buildMonthSpans(weekKeys: string[]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  for (const key of weekKeys) {
    const monthKey = key.slice(0, 7);
    const last = spans[spans.length - 1];
    if (last && last.key === monthKey) {
      last.span += 1;
    } else {
      spans.push({ key: monthKey, label: monthLabel(monthKey), span: 1 });
    }
  }
  return spans;
}

/**
 * Shape raw (AO, week) rows into a dense matrix.
 *
 * Rows are ranked by total posts in the window, ties broken by AO name so the
 * order is stable between renders. Anything past `topAos` is summed into a
 * single "Other" row, which always sorts last regardless of its total.
 */
export function buildActivityMatrix(
  rows: PaxAOWeeklyActivity[] | null | undefined,
  weeks: string[],
  opts?: { topAos?: number },
): ActivityMatrix {
  const weekIndex = new Map(weeks.map((w, i) => [w, i]));
  const safeRows = Array.isArray(rows) ? rows : [];

  // Group by AO, dropping anything outside the window (defensive: the query
  // already clamps, but a stale cache entry could straddle a week rollover).
  const byAo = new Map<
    number,
    { name: string; region: string | null; counts: number[]; total: number }
  >();

  for (const row of safeRows) {
    const idx = weekIndex.get(row.week);
    if (idx === undefined) continue;

    const posts = Number(row.posts) || 0;
    if (posts <= 0) continue;

    let entry = byAo.get(row.ao_org_id);
    if (!entry) {
      entry = {
        name: row.ao_name ?? "Unknown AO",
        region: row.region_name ?? null,
        counts: new Array(weeks.length).fill(0),
        total: 0,
      };
      byAo.set(row.ao_org_id, entry);
    }
    entry.counts[idx] += posts;
    entry.total += posts;
  }

  const ranked = [...byAo.entries()]
    .map(([ao_org_id, e]) => ({
      ao_org_id,
      ao_name: e.name,
      region_name: e.region,
      counts: e.counts,
      total: e.total,
      isOther: false,
      otherAoCount: 0,
    }))
    .sort((a, b) => b.total - a.total || a.ao_name.localeCompare(b.ao_name));

  const topAos = opts?.topAos ?? ACTIVITY_TOP_AOS;
  const kept = ranked.slice(0, topAos);
  const tail = ranked.slice(topAos);

  if (tail.length > 0) {
    const counts = new Array(weeks.length).fill(0);
    let total = 0;
    for (const row of tail) {
      row.counts.forEach((n, i) => (counts[i] += n));
      total += row.total;
    }
    kept.push({
      ao_org_id: OTHER_AO_ID,
      ao_name: "Other",
      region_name: null,
      counts,
      total,
      isOther: true,
      otherAoCount: tail.length,
    });
  }

  let max = 0;
  let total = 0;
  const cells: number[] = [];
  for (const row of kept) {
    for (const n of row.counts) {
      if (n > max) max = n;
      total += n;
      cells.push(n);
    }
  }

  const regions = new Set(
    safeRows.map((r) => r.region_org_id).filter((id) => id != null),
  );

  return {
    weeks,
    monthSpans: buildMonthSpans(weeks),
    rows: kept,
    max,
    total,
    thresholds: computeLevelThresholds(cells),
    multiRegion: regions.size > 1,
  };
}

/** Nearest-rank quantile of a pre-sorted ascending array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) * q)];
}

/**
 * Derive ramp cut points from the non-zero cells.
 *
 * Quartiles, not fractions of the maximum. A PAX who posts 8x/month at their
 * home AO and 1-3x elsewhere has a max of 8, so max-scaling would push every
 * "elsewhere" cell to the faintest shade and hide the very pattern the matrix
 * exists to show. Quartiles spread the levels across the values that actually
 * occur.
 *
 * Thresholds may repeat (a PAX who always posts exactly twice), which simply
 * leaves upper levels unused — correct, since there is no variation to show.
 */
export function computeLevelThresholds(
  values: number[],
): [number, number, number] {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [0, 0, 0];
  return [
    quantile(nonZero, 0.25),
    quantile(nonZero, 0.5),
    quantile(nonZero, 0.75),
  ];
}

/** Map a cell value to one of five ramp steps (0 = empty). */
export function activityLevel(
  value: number,
  thresholds: [number, number, number],
): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value <= thresholds[0]) return 1;
  if (value <= thresholds[1]) return 2;
  if (value <= thresholds[2]) return 3;
  return 4;
}

/** Short label for a 'YYYY-MM' key, e.g. "Aug". */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/** Tooltip label for a week key, e.g. "week of Sep 1, 2025". */
export function weekLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  const formatted = new Date(Date.UTC(year, month - 1, day)).toLocaleString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  return `week of ${formatted}`;
}
