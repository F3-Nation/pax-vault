import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBigQuery } = vi.hoisted(() => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import { searchAOsByName, setAoDuckDbQueryForTests } from "./aos";

describe("AO DuckDB migration", () => {
  beforeEach(() => {
    queryBigQuery.mockReset();
    setAoDuckDbQueryForTests(undefined);
    process.env.DUCKDB_ENABLED = "false";
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
});
