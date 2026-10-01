import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBigQuery } = vi.hoisted(() => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import {
  buildRegionAchievements,
  getRegionInfo,
  setRegionDuckDbQueryForTests,
} from "./regions";

type ReferencePax = {
  user_id: number | null;
  f3_name: string;
  avatar_url?: string | null;
  start_date_override?: string | null;
};
type ReferenceAttendance = {
  user_id: number | null;
  q_ind?: boolean | number | null;
  fartsack?: boolean | null;
};
type ReferenceEvent = {
  event_date: string | null;
  region_org_id: number;
  attendance?: ReferenceAttendance[] | null;
};

function referenceAchievements(
  pax: ReferencePax[],
  allEvents: ReferenceEvent[],
  regionId: number,
) {
  const thresholds = [
    25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
  ];
  const attended = (e: ReferenceEvent) =>
    (e.attendance ?? []).filter(
      (a) => a.fartsack !== true && a.user_id != null,
    );
  return pax
    .map((p) => {
      const mine = allEvents.filter(
        (e) =>
          p.user_id != null &&
          attended(e).some((a) => Number(a.user_id) === Number(p.user_id)),
      );
      const region = mine.filter((e) => Number(e.region_org_id) === regionId);
      const qs = (es: ReferenceEvent[]) =>
        es.reduce(
          (n, e) =>
            n +
            attended(e).filter(
              (a) =>
                p.user_id != null &&
                Number(a.user_id) === Number(p.user_id) &&
                a.q_ind,
            ).length,
          0,
        );
      const rp = region.length,
        ap = mine.length,
        rq = qs(region),
        aq = qs(mine);
      const next = (n: number) => thresholds.find((t) => t > n) ?? null;
      const first =
        p.start_date_override ??
        mine
          .filter((e) => e.event_date != null)
          .map((e) => String(e.event_date).slice(0, 10))
          .sort()[0] ??
        null;
      const last =
        region
          .filter((e) => e.event_date != null)
          .map((e) => String(e.event_date).slice(0, 10))
          .sort()
          .at(-1) ?? null;
      let anniversary: string | null = null;
      if (first) {
        const [, month, day] = first.slice(0, 10).split("-").map(Number),
          today = new Date();
        const isLeap = (year: number) =>
          year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const safeDay =
          month === 2 && day === 29 && !isLeap(today.getUTCFullYear())
            ? 28
            : day;
        anniversary = `${today.getUTCFullYear()}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
        if (anniversary < today.toISOString().slice(0, 10)) {
          const nextYear = today.getUTCFullYear() + 1;
          const nextDay =
            month === 2 && day === 29 && !isLeap(nextYear) ? 28 : day;
          anniversary = `${nextYear}-${String(month).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
        }
      }
      const days = anniversary
        ? Math.round(
            (Date.parse(`${anniversary}T00:00:00Z`) - Date.now()) / 86400000,
          )
        : null;
      const nextWithin = (n: number, limit: number) => {
        const milestone = next(n);
        return milestone !== null && milestone - n <= limit;
      };
      const lastTime = last ? Date.parse(`${last}T00:00:00Z`) : NaN;
      const active90 =
        Number.isFinite(lastTime) && lastTime >= Date.now() - 90 * 86400000;
      const active30 =
        Number.isFinite(lastTime) && lastTime >= Date.now() - 30 * 86400000;
      const qualifies =
        rp > 10 &&
        ((active90 &&
          (nextWithin(rp, 1) ||
            nextWithin(ap, 1) ||
            nextWithin(rq, 1) ||
            nextWithin(aq, 1) ||
            (active30 &&
              (nextWithin(rp, 5) ||
                nextWithin(ap, 5) ||
                nextWithin(rq, 3) ||
                nextWithin(aq, 3))))) ||
          (days !== null && days >= 0 && days <= 14 && rp >= 25));
      return {
        user_id: p.user_id,
        f3_name: p.f3_name,
        avatar_url: p.avatar_url ?? undefined,
        region_posts: rp,
        region_qs: rq,
        all_posts: ap,
        all_qs: aq,
        next_region_post_milestone: next(rp),
        next_nation_post_milestone: next(ap),
        next_region_q_milestone: next(rq),
        next_nation_q_milestone: next(aq),
        fng_date: first,
        next_anniversary_date: anniversary,
        days_until_anniversary: days,
        last_region_event_date: last,
        qualifies,
      };
    })
    .filter((p) => p.qualifies)
    .map((p) => ({
      user_id: p.user_id,
      f3_name: p.f3_name,
      avatar_url: p.avatar_url,
      region_posts: p.region_posts,
      region_qs: p.region_qs,
      all_posts: p.all_posts,
      all_qs: p.all_qs,
      next_region_post_milestone: p.next_region_post_milestone,
      next_nation_post_milestone: p.next_nation_post_milestone,
      next_region_q_milestone: p.next_region_q_milestone,
      next_nation_q_milestone: p.next_nation_q_milestone,
      fng_date: p.fng_date,
      next_anniversary_date: p.next_anniversary_date,
      days_until_anniversary: p.days_until_anniversary,
      last_region_event_date: p.last_region_event_date,
    }))
    .sort((a, b) => a.f3_name.localeCompare(b.f3_name));
}

describe("region DuckDB migration", () => {
  beforeEach(() => {
    queryBigQuery.mockReset();
    setRegionDuckDbQueryForTests(undefined);
    process.env.DUCKDB_ENABLED = "false";
  });

  it("preserves BigQuery behavior when disabled", async () => {
    queryBigQuery.mockResolvedValue([{ region_id: 1, region_name: "North" }]);
    await expect(getRegionInfo(1, "user@example.com")).resolves.toMatchObject({
      region_id: 1,
    });
    expect(queryBigQuery).toHaveBeenCalledOnce();
  });

  it("uses the injected DuckDB query without fallback", async () => {
    process.env.DUCKDB_ENABLED = "true";
    const query = vi
      .fn()
      .mockResolvedValue([{ region_id: 2, region_name: "South" }]);
    setRegionDuckDbQueryForTests(query);
    await expect(getRegionInfo(2)).resolves.toMatchObject({ region_id: 2 });
    expect(query).toHaveBeenCalledOnce();
    expect(queryBigQuery).not.toHaveBeenCalled();
  });

  it("propagates DuckDB failures", async () => {
    process.env.DUCKDB_ENABLED = "true";
    setRegionDuckDbQueryForTests(
      vi.fn().mockRejectedValue(new Error("duckdb failed")),
    );
    await expect(getRegionInfo(3)).rejects.toThrow("duckdb failed");
    expect(queryBigQuery).not.toHaveBeenCalled();
  });

  it("matches legacy achievement ordering and preserves leap-day rollover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
    const events = Array.from({ length: 49 }, (_, index) => ({
      event_date: index === 48 ? "2026-09-20" : "2026-08-01",
      region_org_id: 7,
      attendance: [
        { user_id: 1, q_ind: false, fartsack: false },
        { user_id: 2, q_ind: false, fartsack: false },
      ],
    }));
    const result = buildRegionAchievements(
      [
        {
          user_id: 1,
          f3_name: "Zulu",
          avatar_url: null,
          start_date_override: "2020-02-29",
        },
        {
          user_id: 2,
          f3_name: "Alpha",
          avatar_url: null,
          start_date_override: "2021-01-01",
        },
      ],
      events,
      7,
    );

    expect(result.map((p) => p.f3_name)).toEqual(["Alpha", "Zulu"]);
    expect(result.find((p) => p.f3_name === "Zulu")).toMatchObject({
      next_anniversary_date: "2027-02-28",
      region_posts: 49,
    });
    vi.useRealTimers();
  });

  it("matches the pre-optimization achievement algorithm for shared and duplicate attendance", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
    const events: ReferenceEvent[] = Array.from({ length: 24 }, (_, index) => ({
      event_date: index === 23 ? "2026-09-20" : "2026-09-10",
      region_org_id: 7,
      attendance: [
        { user_id: 1, q_ind: true, fartsack: false },
        { user_id: 1, q_ind: index === 0, fartsack: false },
        { user_id: 2, q_ind: false, fartsack: false },
        { user_id: 2, q_ind: true, fartsack: true },
      ],
    }));
    events.push({
      event_date: "2025-02-03",
      region_org_id: 99,
      attendance: [
        { user_id: 1, q_ind: true, fartsack: false },
        { user_id: 1, q_ind: true, fartsack: false },
        { user_id: 2, q_ind: false, fartsack: false },
        { user_id: 2, q_ind: true, fartsack: true },
      ],
    });
    const pax = [
      {
        user_id: 1,
        f3_name: "Ace",
        avatar_url: null,
        start_date_override: "2020-02-29",
      },
      {
        user_id: 2,
        f3_name: "Bravo",
        avatar_url: null,
        start_date_override: null,
      },
    ];

    expect(buildRegionAchievements(pax, events, 7)).toEqual(
      referenceAchievements(pax, events, 7),
    );
    expect(buildRegionAchievements(pax, events, 7)).toMatchObject([
      {
        user_id: 1,
        region_posts: 24,
        region_qs: 25,
        all_posts: 25,
        all_qs: 27,
        fng_date: "2020-02-29",
      },
      { user_id: 2, region_posts: 24, region_qs: 0, all_posts: 25, all_qs: 0 },
    ]);
    vi.useRealTimers();
  });

  it("keeps numeric zero distinct from null IDs and ignores null dates for dates only", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
    const events: ReferenceEvent[] = Array.from({ length: 24 }, (_, index) => ({
      event_date: index === 23 ? "2026-09-20" : "2026-09-10",
      region_org_id: 7,
      attendance: [
        { user_id: 0, q_ind: [0, null, 2, -1][index % 4], fartsack: false },
        ...(index === 0 ? [{ user_id: 0, q_ind: 2, fartsack: null }] : []),
        ...(index === 1 ? [{ user_id: 0, q_ind: -1, fartsack: true }] : []),
        { user_id: null, q_ind: -1, fartsack: false },
      ],
    }));
    events.push({
      event_date: null,
      region_org_id: 99,
      attendance: [
        { user_id: 0, q_ind: -1, fartsack: null },
        { user_id: null, q_ind: 2, fartsack: false },
      ],
    });
    const pax = [
      {
        user_id: 0,
        f3_name: "Zero",
        avatar_url: null,
        start_date_override: "2020-02-29",
      },
      {
        user_id: null,
        f3_name: "Null ID",
        avatar_url: null,
        start_date_override: null,
      },
    ];
    const result = buildRegionAchievements(pax, events, 7);

    expect(result).toEqual(referenceAchievements(pax, events, 7));
    expect(result).toMatchObject([
      {
        user_id: 0,
        region_posts: 24,
        region_qs: 13,
        all_posts: 25,
        all_qs: 14,
        fng_date: "2020-02-29",
        last_region_event_date: "2026-09-20",
      },
    ]);
    vi.useRealTimers();
  });
});
