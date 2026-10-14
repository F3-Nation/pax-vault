import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBigQuery } = vi.hoisted(() => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import {
  getPageData,
  searchAOsByName,
  setAoDuckDbQueryForTests,
} from "./aos";

describe("AO DuckDB migration", () => {
  beforeEach(() => {
    queryBigQuery.mockReset();
    setAoDuckDbQueryForTests(undefined);
    process.env.DUCKDB_ENABLED = "false";
    delete process.env.DUCKDB_STATS_AO_ENABLED;
    delete process.env.DUCKDB_EVENTS_ENABLED;
  });

  it("keeps the legacy path feature-off", async () => {
    queryBigQuery.mockResolvedValue([{ ao_id: 4, ao_name: "AO" }]);
    await expect(searchAOsByName("AO")).resolves.toMatchObject([{ ao_id: 4 }]);
    expect(queryBigQuery).toHaveBeenCalledOnce();
  });

  it("propagates an enabled DuckDB failure", async () => {
    process.env.DUCKDB_ENABLED = "true";
    setAoDuckDbQueryForTests(
      vi.fn().mockRejectedValue(new Error("query failed")),
    );
    await expect(searchAOsByName("AO")).rejects.toThrow("query failed");
    expect(queryBigQuery).not.toHaveBeenCalled();
  });

  it("selects AO page events independently in both mixed modes", async () => {
    process.env.DUCKDB_ENABLED = "true";
    process.env.DUCKDB_STATS_AO_ENABLED = "false";
    process.env.DUCKDB_EVENTS_ENABLED = "true";
    queryBigQuery.mockResolvedValue([
      { events: [{ event_instance_id: 1 }], preferencesJson: "{}" },
    ]);
    setAoDuckDbQueryForTests(
      vi.fn().mockResolvedValue([{ event_instance_id: 2 }]),
    );
    const duckEventsPage = await getPageData(4);
    expect(duckEventsPage.events).toMatchObject([{ event_instance_id: 2 }]);
    expect(duckEventsPage.events).not.toMatchObject([
      { event_instance_id: 1 },
    ]);

    process.env.DUCKDB_STATS_AO_ENABLED = "true";
    process.env.DUCKDB_EVENTS_ENABLED = "false";
    queryBigQuery.mockReset().mockResolvedValue([
      { event_instance_id: 3 },
    ]);
    setAoDuckDbQueryForTests(vi.fn().mockResolvedValue([]));
    const bigQueryEventsPage = await getPageData(4);
    expect(bigQueryEventsPage.events).toMatchObject([
      { event_instance_id: 3 },
    ]);
    expect(queryBigQuery).toHaveBeenCalled();
  });
});
