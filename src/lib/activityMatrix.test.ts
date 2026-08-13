import { describe, it, expect } from "vitest";
import {
  activityLevel,
  buildActivityMatrix,
  addWeeks,
  buildMonthSpans,
  buildWeekKeys,
  buildWeekRange,
  computeLevelThresholds,
  monthLabel,
  startOfWeek,
  startOfWeekISO,
  weekLabel,
  OTHER_AO_ID,
} from "./activityMatrix";
import type { PaxAOWeeklyActivity } from "./types";

const END = new Date(Date.UTC(2026, 7, 13)); // Thu 2026-08-13
const WEEKS = buildWeekKeys(END); // the default trailing 52 weeks
const THIS_WEEK = "2026-08-10"; // the Monday of END's week
const OLDEST_WEEK = "2025-08-18"; // 51 weeks earlier

function row(
  ao_org_id: number,
  ao_name: string,
  week: string,
  posts: number,
  region_org_id = 1,
  region_name = "Northlake",
): PaxAOWeeklyActivity {
  return {
    ao_org_id,
    ao_name,
    region_org_id,
    region_name,
    week,
    posts,
  };
}

describe("startOfWeek", () => {
  it("snaps to the preceding Monday", () => {
    // Thu 2026-08-13 -> Mon 2026-08-10
    expect(startOfWeek(END).toISOString().slice(0, 10)).toBe("2026-08-10");
  });

  it("treats Sunday as the end of its week, not the start", () => {
    // Sun 2026-08-16 belongs to the week beginning Mon 2026-08-10.
    const sunday = new Date(Date.UTC(2026, 7, 16));
    expect(startOfWeek(sunday).toISOString().slice(0, 10)).toBe("2026-08-10");
  });

  it("is idempotent on a Monday", () => {
    const monday = new Date(Date.UTC(2026, 7, 10));
    expect(startOfWeek(monday).toISOString().slice(0, 10)).toBe("2026-08-10");
  });
});

describe("buildWeekKeys", () => {
  it("returns 52 Mondays ending with the current week, oldest first", () => {
    const keys = buildWeekKeys(END);
    expect(keys).toHaveLength(52);
    expect(keys[51]).toBe(THIS_WEEK);
    expect(keys[0]).toBe(OLDEST_WEEK);
  });

  it("steps back exactly 7 days per column", () => {
    const keys = buildWeekKeys(END, 3);
    expect(keys).toEqual(["2026-07-27", "2026-08-03", "2026-08-10"]);
  });

  it("crosses the year boundary correctly", () => {
    const keys = buildWeekKeys(new Date(Date.UTC(2026, 0, 5)), 3);
    expect(keys).toEqual(["2025-12-22", "2025-12-29", "2026-01-05"]);
  });
});

describe("buildMonthSpans", () => {
  it("groups consecutive weeks into one segment per month", () => {
    const spans = buildMonthSpans([
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
      "2026-08-03",
    ]);
    expect(spans).toEqual([
      { key: "2026-06", label: "Jun", span: 1 },
      { key: "2026-07", label: "Jul", span: 2 },
      { key: "2026-08", label: "Aug", span: 1 },
    ]);
  });

  it("spans cover every week column exactly once", () => {
    const weeks = buildWeekKeys(END);
    const spans = buildMonthSpans(weeks);
    expect(spans.reduce((n, s) => n + s.span, 0)).toBe(weeks.length);
  });

  it("returns nothing for no columns", () => {
    expect(buildMonthSpans([])).toEqual([]);
  });
});

describe("buildActivityMatrix", () => {
  it("returns an empty-but-valid grid for a PAX with no activity", () => {
    const m = buildActivityMatrix([], WEEKS);
    expect(m.weeks).toHaveLength(52);
    expect(m.rows).toEqual([]);
    expect(m.max).toBe(0);
    expect(m.total).toBe(0);
    expect(m.thresholds).toEqual([0, 0, 0]);
    expect(m.multiRegion).toBe(false);
  });

  it("tolerates null/undefined input", () => {
    expect(buildActivityMatrix(null, WEEKS).rows).toEqual([]);
    expect(buildActivityMatrix(undefined, WEEKS).rows).toEqual([]);
  });

  it("aligns counts to the right month column", () => {
    const m = buildActivityMatrix(
      [
        row(1, "The Reaper", THIS_WEEK, 4),
        row(1, "The Reaper", OLDEST_WEEK, 2),
      ],
      WEEKS,
    );
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].counts[51]).toBe(4); // current week is the last column
    expect(m.rows[0].counts[0]).toBe(2); // 51 weeks back is the first
    expect(m.rows[0].total).toBe(6);
    expect(m.max).toBe(4);
    expect(m.total).toBe(6);
  });

  it("drops weeks outside the window", () => {
    const m = buildActivityMatrix(
      [
        row(1, "The Reaper", "2024-01-01", 9),
        row(1, "The Reaper", THIS_WEEK, 1),
      ],
      WEEKS,
    );
    expect(m.total).toBe(1);
  });

  it("ranks rows by total posts, descending", () => {
    const m = buildActivityMatrix(
      [
        row(1, "Quiet AO", THIS_WEEK, 1),
        row(2, "Busy AO", THIS_WEEK, 9),
        row(3, "Middle AO", THIS_WEEK, 5),
      ],
      WEEKS,
    );
    expect(m.rows.map((r) => r.ao_name)).toEqual([
      "Busy AO",
      "Middle AO",
      "Quiet AO",
    ]);
  });

  it("breaks ties by AO name so ordering is stable", () => {
    const m = buildActivityMatrix(
      [row(2, "Zulu", THIS_WEEK, 3), row(1, "Alpha", THIS_WEEK, 3)],
      WEEKS,
    );
    expect(m.rows.map((r) => r.ao_name)).toEqual(["Alpha", "Zulu"]);
  });

  it("collapses the tail past topAos into a single Other row", () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      row(i + 1, `AO ${String(i).padStart(2, "0")}`, THIS_WEEK, 20 - i),
    );
    const m = buildActivityMatrix(rows, WEEKS);

    expect(m.rows).toHaveLength(11); // 10 AOs + Other
    const other = m.rows[m.rows.length - 1];
    expect(other.isOther).toBe(true);
    expect(other.ao_org_id).toBe(OTHER_AO_ID);
    expect(other.otherAoCount).toBe(4);
    // AOs 11..14 carry 10 + 9 + 8 + 7
    expect(other.total).toBe(34);
  });

  it("keeps Other last even when its total outranks real rows", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        row(i + 1, `Top ${i}`, THIS_WEEK, 5),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        row(100 + i, `Tail ${i}`, THIS_WEEK, 4),
      ),
    ];
    const m = buildActivityMatrix(rows, WEEKS);
    const last = m.rows[m.rows.length - 1];
    expect(last.isOther).toBe(true);
    expect(last.total).toBe(32); // beats every 5-post row above it
  });

  it("omits Other entirely when the PAX is within topAos", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(i + 1, `AO ${i}`, THIS_WEEK, 1),
    );
    const m = buildActivityMatrix(rows, WEEKS);
    expect(m.rows).toHaveLength(10);
    expect(m.rows.some((r) => r.isOther)).toBe(false);
  });

  it("sums repeated (AO, week) rows rather than overwriting", () => {
    const m = buildActivityMatrix(
      [row(1, "The Reaper", THIS_WEEK, 2), row(1, "The Reaper", THIS_WEEK, 3)],
      WEEKS,
    );
    expect(m.rows[0].total).toBe(5);
  });

  it("flags multiRegion only when more than one region is present", () => {
    const single = buildActivityMatrix(
      [row(1, "A", THIS_WEEK, 1, 10, "Northlake")],
      WEEKS,
    );
    expect(single.multiRegion).toBe(false);

    const multi = buildActivityMatrix(
      [
        row(1, "A", THIS_WEEK, 1, 10, "Northlake"),
        row(2, "B", THIS_WEEK, 1, 20, "NFW"),
      ],
      WEEKS,
    );
    expect(multi.multiRegion).toBe(true);
  });

  it("ignores zero and negative post counts", () => {
    const m = buildActivityMatrix(
      [row(1, "A", THIS_WEEK, 0), row(2, "B", THIS_WEEK, -3)],
      WEEKS,
    );
    expect(m.rows).toEqual([]);
  });
});

describe("startOfWeekISO / addWeeks", () => {
  it("snaps an ISO date to its Monday", () => {
    expect(startOfWeekISO("2026-08-13")).toBe("2026-08-10"); // Thu -> Mon
    expect(startOfWeekISO("2026-08-16")).toBe("2026-08-10"); // Sun -> same Mon
    expect(startOfWeekISO("2026-08-10")).toBe("2026-08-10"); // already Mon
  });

  it("shifts by whole weeks in both directions", () => {
    expect(addWeeks("2026-08-10", 1)).toBe("2026-08-17");
    expect(addWeeks("2026-08-10", -2)).toBe("2026-07-27");
    expect(addWeeks("2026-01-05", -1)).toBe("2025-12-29"); // across the year
  });
});

describe("buildWeekRange", () => {
  it("returns every Monday between the bounds, inclusive", () => {
    expect(buildWeekRange("2026-07-27", "2026-08-17")).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
  });

  it("snaps mid-week bounds to Mondays", () => {
    // A user's custom filter dates rarely land on a Monday.
    expect(buildWeekRange("2026-07-29", "2026-08-12")).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
    ]);
  });

  it("returns a single column for a range inside one week", () => {
    expect(buildWeekRange("2026-08-11", "2026-08-13")).toEqual(["2026-08-10"]);
  });

  it("collapses an inverted range instead of looping forever", () => {
    expect(buildWeekRange("2026-08-17", "2026-07-27")).toEqual(["2026-07-27"]);
  });

  it("caps an absurdly wide range", () => {
    const weeks = buildWeekRange("2000-01-03", "2026-08-10");
    expect(weeks.length).toBe(104);
  });
});

describe("buildActivityMatrix window", () => {
  it("renders exactly the week columns it is given", () => {
    const weeks = buildWeekRange("2026-07-27", "2026-08-10");
    const m = buildActivityMatrix(
      [row(1, "The Reaper", "2026-08-03", 2)],
      weeks,
    );
    expect(m.weeks).toEqual(weeks);
    expect(m.rows[0].counts).toEqual([0, 2, 0]);
  });

  it("drops rows outside a narrowed window", () => {
    const weeks = buildWeekRange("2026-08-10", "2026-08-10");
    const m = buildActivityMatrix(
      [
        row(1, "The Reaper", "2026-08-10", 3),
        row(1, "The Reaper", "2026-06-01", 9), // outside the filter
      ],
      weeks,
    );
    expect(m.total).toBe(3);
  });
});

describe("computeLevelThresholds", () => {
  it("returns zeros when there is no activity", () => {
    expect(computeLevelThresholds([])).toEqual([0, 0, 0]);
    expect(computeLevelThresholds([0, 0])).toEqual([0, 0, 0]);
  });

  it("ignores empty cells when deriving quartiles", () => {
    // Zeros dominate a sparse matrix; including them would drag every cut
    // point to 0 and flatten the ramp.
    const withZeros = computeLevelThresholds([0, 0, 0, 0, 1, 2, 3, 4]);
    const without = computeLevelThresholds([1, 2, 3, 4]);
    expect(withZeros).toEqual(without);
  });

  it("spreads levels across a skewed distribution", () => {
    // Jolt's real shape: many 1s, a few 2-3s, a tail of 8s at the home AO.
    const values = [
      ...Array(18).fill(1),
      ...Array(8).fill(2),
      ...Array(6).fill(3),
      5,
      6,
      6,
      6,
      7,
      7,
      7,
      8,
      8,
      8,
      8,
    ];
    const t = computeLevelThresholds(values);
    // Every level is reachable — the failure mode was 1s and 2s both landing
    // on the faintest shade because the ramp scaled to max (8).
    expect(activityLevel(1, t)).toBe(1);
    expect(activityLevel(2, t)).toBe(2);
    expect(activityLevel(3, t)).toBe(3);
    expect(activityLevel(8, t)).toBe(4);
  });

  it("leaves upper levels unused when every cell is identical", () => {
    const t = computeLevelThresholds([2, 2, 2, 2]);
    expect(t).toEqual([2, 2, 2]);
    expect(activityLevel(2, t)).toBe(1);
  });
});

describe("activityLevel", () => {
  it("returns 0 for empty cells regardless of thresholds", () => {
    expect(activityLevel(0, [1, 2, 3])).toBe(0);
    expect(activityLevel(-1, [1, 2, 3])).toBe(0);
  });

  it("maps values onto the ramp by threshold", () => {
    const t: [number, number, number] = [1, 2, 3];
    expect(activityLevel(1, t)).toBe(1);
    expect(activityLevel(2, t)).toBe(2);
    expect(activityLevel(3, t)).toBe(3);
    expect(activityLevel(4, t)).toBe(4);
    expect(activityLevel(99, t)).toBe(4);
  });
});

describe("weekLabel", () => {
  it("renders a readable week-of label", () => {
    expect(weekLabel("2025-09-01")).toBe("week of Sep 1, 2025");
  });

  it("passes through unparseable keys", () => {
    expect(weekLabel("nope")).toBe("nope");
  });
});

describe("monthLabel", () => {
  it("renders a short month name", () => {
    expect(monthLabel(THIS_WEEK)).toBe("Aug");
    expect(monthLabel("2026-01")).toBe("Jan");
  });

  it("passes through unparseable keys", () => {
    expect(monthLabel("nonsense")).toBe("nonsense");
  });
});
