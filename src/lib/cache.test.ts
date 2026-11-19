import { beforeEach, describe, expect, it, vi } from "vitest";

const { unstableCache, status, enabled } = vi.hoisted(() => ({
  unstableCache: vi.fn((fn: () => Promise<unknown>) => fn),
  status: vi.fn(),
  enabled: vi.fn(),
}));

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("@/lib/duckdb/factory", () => ({
  getDuckDbRuntime: () => ({ status }),
}));
vi.mock("@/lib/duckdb/query", () => ({
  isDuckDbEnabled: (_env: unknown, capability: unknown) => enabled(capability),
}));

import {
  cacheStatsData,
  getStatsReleaseIdentity,
  statsReleaseCacheParts,
} from "./cache";

describe("stats release cache identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unstableCache.mockImplementation((fn) => fn);
    vi.stubEnv("NODE_ENV", "production");
  });

  it("changes cache key and tag when the active release changes", () => {
    expect(
      statsReleaseCacheParts({ releaseId: "r-1", generation: "10" }),
    ).toEqual({
      key: "duckdb-release:r-1:10",
      tag: "duckdb-release-r-1:10",
    });
    expect(
      statsReleaseCacheParts({ releaseId: "r-2", generation: "11" }),
    ).not.toEqual(
      statsReleaseCacheParts({ releaseId: "r-1", generation: "10" }),
    );
  });

  it("adds release identity without removing entity invalidation tags", async () => {
    enabled.mockReturnValue(true);
    status.mockReturnValue({
      activeReleaseId: "r-1",
      activePointerGeneration: "10",
    });
    await cacheStatsData(
      async () => "value",
      ["region-page-data", "3"],
      ["region-3"],
      getStatsReleaseIdentity(),
    );
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["region-page-data", "3", "duckdb-release:r-1:10"],
      expect.objectContaining({ tags: ["region-3", "duckdb-release-r-1:10"] }),
    );
  });

  it("bypasses release identity logic when DuckDB is disabled", async () => {
    enabled.mockReturnValue(false);
    const fetcher = vi.fn(async () => "legacy");
    await cacheStatsData(fetcher, ["region-page-data", "3"], ["region-3"]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(getStatsReleaseIdentity()).toBeUndefined();
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["region-page-data", "3"],
      expect.objectContaining({ tags: ["region-3"] }),
    );
  });

  it("keeps a cut-back capability on the legacy cache identity", async () => {
    enabled.mockImplementation(
      (capability?: string) => capability !== "stats_ao",
    );
    status.mockReturnValue({
      activeReleaseId: "r-1",
      activePointerGeneration: "10",
    });
    expect(getStatsReleaseIdentity("stats_ao")).toBeUndefined();
    await cacheStatsData(
      async () => "legacy",
      ["ao-page-data", "3"],
      ["ao-3"],
      undefined,
      "stats_ao",
    );
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["ao-page-data", "3"],
      expect.objectContaining({ tags: ["ao-3"] }),
    );
  });

  it("rejects a miss when the release swaps during the fetch", async () => {
    enabled.mockReturnValue(true);
    status.mockReturnValue({
      activeReleaseId: "r-1",
      activePointerGeneration: "10",
    });
    const identity = getStatsReleaseIdentity();
    const fetcher = vi.fn(async () => {
      status.mockReturnValue({
        activeReleaseId: "r-2",
        activePointerGeneration: "11",
      });
      return "stale";
    });

    await expect(
      cacheStatsData(fetcher, ["region-page-data", "3"], [], identity),
    ).rejects.toThrow("release changed");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects a cache hit when the release swaps during invocation", async () => {
    enabled.mockReturnValue(true);
    status.mockReturnValue({
      activeReleaseId: "r-1",
      activePointerGeneration: "10",
    });
    const identity = getStatsReleaseIdentity();
    unstableCache.mockImplementationOnce(() => async () => {
      status.mockReturnValue({
        activeReleaseId: "r-2",
        activePointerGeneration: "11",
      });
      return "stale-hit";
    });

    await expect(
      cacheStatsData(
        async () => "unused",
        ["region-page-data", "3"],
        [],
        identity,
      ),
    ).rejects.toThrow("release changed");
  });

  it("does not publish when the active release becomes unavailable", async () => {
    enabled.mockReturnValue(true);
    status.mockReturnValue({
      activeReleaseId: "r-1",
      activePointerGeneration: "10",
    });
    const identity = getStatsReleaseIdentity();
    const result = cacheStatsData(
      async () => "value",
      ["region-page-data"],
      [],
      identity,
    );
    status.mockReturnValue({});
    await expect(result).rejects.toThrow("release changed");
  });
});
