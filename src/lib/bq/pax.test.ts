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
    executeWithRelease = async (...args: unknown[]) => ({
      rows: await duckQuery(...args),
      releaseId: "test-release",
    });
  },
  selectDuckDbOrLegacy: async (selection: {
    env?: NodeJS.ProcessEnv;
    capability?: string;
    duckdb: () => Promise<unknown>;
    legacy: () => Promise<unknown>;
  }) =>
    (() => {
      const env = selection.env ?? process.env;
      const flag =
        selection.capability === "events"
          ? env.DUCKDB_EVENTS_ENABLED
          : selection.capability === "stats_pax"
            ? env.DUCKDB_STATS_PAX_ENABLED
            : undefined;
      return env.DUCKDB_ENABLED === "true" && (flag ?? "true") === "true";
    })()
      ? selection.duckdb()
      : selection.legacy(),
  isDuckDbEnabled: (env: NodeJS.ProcessEnv, capability: string) => {
    const flag =
      capability === "events"
        ? env.DUCKDB_EVENTS_ENABLED
        : capability === "stats_pax"
          ? env.DUCKDB_STATS_PAX_ENABLED
          : undefined;
    return env.DUCKDB_ENABLED === "true" && (flag ?? "true") === "true";
  },
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
    delete process.env.DUCKDB_STATS_PAX_ENABLED;
    delete process.env.DUCKDB_EVENTS_ENABLED;
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

  it("uses the events capability independently from PAX aggregates", async () => {
    const statsEvent = { event_instance_id: 20, event_name: "stats" };
    const eventsEvent = {
      event_instance_id: 21,
      event_name: "events",
      attendance: [{ user_id: 7 }],
    };

    process.env.DUCKDB_ENABLED = "true";
    process.env.DUCKDB_STATS_PAX_ENABLED = "true";
    process.env.DUCKDB_EVENTS_ENABLED = "false";
    bigQuery.mockResolvedValue([{ event: "legacy-event" }]);
    duckQuery.mockResolvedValue([]);
    const duckStats = await getPaxPageData(7);
    expect(duckStats.events).toEqual([{ event: "legacy-event" }]);
    expect(duckQuery).toHaveBeenCalled();

    vi.clearAllMocks();
    process.env.DUCKDB_STATS_PAX_ENABLED = "false";
    process.env.DUCKDB_EVENTS_ENABLED = "true";
    bigQuery.mockResolvedValue([
      { events: [statsEvent], summary: { event_count: 20 } },
    ]);
    duckQuery.mockResolvedValue([eventsEvent]);
    const legacyStats = await getPaxPageData(7);
    expect(legacyStats.events).toMatchObject([eventsEvent]);
    expect(legacyStats.summary).toEqual({ event_count: 20 });
    expect(bigQuery).toHaveBeenCalledOnce();
  });

  it("builds a single outer WHERE for filtered legacy PAX events", async () => {
    bigQuery.mockResolvedValue([]);
    await getEvents(7);
    const defaultSql = String(bigQuery.mock.calls[0][0]);
    expect(defaultSql).toMatch(/FROM pv_events\s+WHERE EXISTS\s*\(/);
    expect(defaultSql).not.toMatch(/WHERE\s+WHERE/i);
    expect(defaultSql).toContain("a.fartsack IS NOT TRUE");

    await getEvents(7, undefined, {
      startDate: "2026-01-01",
      tagIds: [3],
      limit: 100,
    });
    const filteredSql = String(bigQuery.mock.calls[1][0]);
    expect(filteredSql).toMatch(/FROM pv_events\s+WHERE EXISTS\s*\(/);
    expect(filteredSql).not.toMatch(/WHERE\s+WHERE/i);
    expect(filteredSql).toContain("event_date >= DATE('2026-01-01')");
    expect(filteredSql).toContain("UNNEST(tags)");
    expect(filteredSql).toContain("ORDER BY event_date DESC, event_id DESC");
    expect(filteredSql).toContain("LIMIT 100");
  });

  it("executes the native service branches for every migrated export", async () => {
    process.env.DUCKDB_ENABLED = "true";
    duckQuery.mockResolvedValue([]);
    await expect(searchUsersByName("fixture")).resolves.toEqual([]);
    await expect(getEvents(7)).resolves.toEqual([]);
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
});
