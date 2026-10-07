import { beforeEach, describe, expect, it, vi } from "vitest";

const { bigQuery, duckQuery } = vi.hoisted(() => ({
  bigQuery: vi.fn(),
  duckQuery: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ queryBigQuery: bigQuery }));
vi.mock("@/lib/duckdb/factory", () => ({
  getDuckDbRuntime: vi.fn(() => ({})),
}));
vi.mock("@/lib/duckdb/query", () => ({
  DuckDbQueryAdapter: class {
    execute = duckQuery;
  },
  selectDuckDbOrLegacy: async (selection: {
    env?: NodeJS.ProcessEnv;
    duckdb: () => Promise<unknown>;
    legacy: () => Promise<unknown>;
  }) =>
    selection.env?.DUCKDB_ENABLED === "true" &&
    (!selection.env?.DUCKDB_AUTH_ENABLED ||
      selection.env.DUCKDB_AUTH_ENABLED === "true")
      ? selection.duckdb()
      : selection.legacy(),
}));

import {
  getEvents,
  getPageData as getPaxPageData,
  getPaxIdentityByEmail,
  searchUsersByName,
} from "./pax";
import { getPageData as getAreaPageData, searchAreasByName } from "./areas";
import {
  getPageData as getSectorPageData,
  searchSectorsByName,
} from "./sectors";

describe("PAX backend selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DUCKDB_ENABLED;
  });

  it("keeps BigQuery as the disabled default", async () => {
    bigQuery.mockResolvedValue([{ user_id: 1, f3_name: "Fixture" }]);
    await expect(searchUsersByName("fix")).resolves.toEqual([
      { user_id: 1, f3_name: "Fixture" },
    ]);
    expect(bigQuery).toHaveBeenCalledOnce();
    expect(duckQuery).not.toHaveBeenCalled();
  });

  it("does not fall back when DuckDB is enabled and fails", async () => {
    process.env.DUCKDB_ENABLED = "true";
    const error = new Error("fixture DuckDB failure");
    duckQuery.mockRejectedValue(error);
    await expect(searchUsersByName("fix")).rejects.toBe(error);
    expect(bigQuery).not.toHaveBeenCalled();
  });

  it("executes the native service branches for every migrated export", async () => {
    process.env.DUCKDB_ENABLED = "true";
    duckQuery.mockResolvedValue([]);
    await expect(searchUsersByName("fixture")).resolves.toEqual([]);
    await expect(getEvents(7)).resolves.toBeNull();
    await expect(getPaxPageData(7)).resolves.toMatchObject({
      info: null,
      summary: null,
    });
    await expect(searchAreasByName("fixture")).resolves.toEqual([]);
    await expect(getAreaPageData(7)).resolves.toMatchObject({
      info: null,
      summary: expect.any(Object),
    });
    await expect(searchSectorsByName("fixture")).resolves.toEqual([]);
    await expect(getSectorPageData(7)).resolves.toMatchObject({
      info: null,
      summary: expect.any(Object),
    });

    // Auth identity follows the independent auth capability flag.
    process.env.DUCKDB_AUTH_ENABLED = "true";
    await expect(
      getPaxIdentityByEmail("fixture@example.com"),
    ).resolves.toBeNull();
    expect(duckQuery).toHaveBeenCalled();
  });

  it("goldens native PAX null-AO, fartsack, and FNG semantics", async () => {
    process.env.DUCKDB_ENABLED = "true";
    duckQuery
      .mockResolvedValueOnce([
        { user_id: 7, f3_name: "Fixture", start_date_override: null },
      ])
      .mockResolvedValueOnce([
        {
          event_instance_id: 2,
          event_date: "2026-01-02",
          ao_org_id: null,
          ao_name: null,
          attendance: [
            { user_id: 7, f3_name: "Fixture", q_ind: 1, fartsack: false },
          ],
          fartsacks: [],
        },
        {
          event_instance_id: 1,
          event_date: "2026-01-01",
          ao_org_id: null,
          ao_name: null,
          attendance: [],
          fartsacks: [{ user_id: 7, fartsack: true }],
        },
      ]);

    const result = await getPaxPageData(7);
    expect(result.summary).toMatchObject({
      event_count: 1,
      q_count: 1,
      fartsack_count: 1,
      fng_date: "2026-01-02",
    });
    expect(result.ao_breakdown).toMatchObject([
      { ao_org_id: 0, ao_name: "Unknown AO", total_events: 1 },
    ]);
  });

  it("goldens native area and sector COUNT DISTINCT null exclusion", async () => {
    process.env.DUCKDB_ENABLED = "true";
    const events = [
      {
        event_id: 1,
        event_date: "2026-01-01",
        pax_count: 2,
        fng_count: 0,
        region_org_id: null,
        ao_org_id: null,
        area_org_id: null,
        attendance: [{ user_id: 7, q_ind: 1, fartsack: false }],
      },
    ];
    duckQuery.mockResolvedValueOnce([]).mockResolvedValueOnce(events);
    const area = await getAreaPageData(7);
    expect(area.summary).toMatchObject({ region_count: 0, ao_count: 0 });
    expect(area.regionBreakdown).toMatchObject([
      { region_id: null, event_count: 1, ao_count: 0 },
    ]);

    duckQuery.mockResolvedValueOnce([]).mockResolvedValueOnce(events);
    const sector = await getSectorPageData(7);
    expect(sector.summary).toMatchObject({ area_count: 0, ao_count: 0 });
    expect(sector.areaBreakdown).toMatchObject([
      { area_id: null, event_count: 1, ao_count: 0 },
    ]);
  });
});
