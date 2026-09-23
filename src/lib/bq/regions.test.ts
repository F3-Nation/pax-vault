import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBigQuery } = vi.hoisted(() => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import {
  buildRegionAchievements,
  getRegionInfo,
  setRegionDuckDbQueryForTests,
} from "./regions";

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
});
