import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRegionPage, getAoPage, getPaxPage, runtimeStatus, cacheStore } =
  vi.hoisted(() => ({
    getRegionPage: vi.fn(),
    getAoPage: vi.fn(),
    getPaxPage: vi.fn(),
    runtimeStatus: {
      activeReleaseId: "release-1",
      activePointerGeneration: "1",
    },
    cacheStore: new Map<string, unknown>(),
  }));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keyParts: string[]) => {
    const key = JSON.stringify(keyParts);
    return async () => {
      if (!cacheStore.has(key)) cacheStore.set(key, await fn());
      return cacheStore.get(key);
    };
  },
}));
vi.mock("@/lib/duckdb/factory", () => ({
  getDuckDbRuntime: () => ({ status: () => runtimeStatus }),
}));
vi.mock("@/lib/bq/regions", () => ({ getPageData: getRegionPage }));
vi.mock("@/lib/bq/aos", () => ({ getPageData: getAoPage }));
vi.mock("@/lib/bq/pax", () => ({ getPageData: getPaxPage }));

import { loadRegionData } from "./region/[regionId]/loader";
import { loadAOData } from "./ao/[aoId]/loader";
import { loadPaxData } from "./pax/[paxId]/loader";

type Page = "region" | "ao" | "pax";

const getLoader = {
  region: loadRegionData,
  ao: loadAOData,
  pax: loadPaxData,
} satisfies Record<Page, (id: number) => Promise<unknown>>;

const getFetcher = {
  region: getRegionPage,
  ao: getAoPage,
  pax: getPaxPage,
} satisfies Record<Page, typeof getRegionPage>;

const statsFlag = {
  region: "DUCKDB_STATS_REGION_ENABLED",
  ao: "DUCKDB_STATS_AO_ENABLED",
  pax: "DUCKDB_STATS_PAX_ENABLED",
} satisfies Record<Page, string>;

function response(page: Page, token: number) {
  const base = {
    info: null,
    summary: null,
    events: [{ eventReleaseId: `events-${token}` }],
  };
  if (page === "region") return { ...base, preferencesJson: null };
  if (page === "ao") return { ...base, preferencesJson: null };
  return {
    ...base,
    ao_breakdown: [],
    ao_weekly: [],
    activity_window: null,
  };
}

describe.each(["region", "ao", "pax"] as const)(
  "%s stats loader cache isolation",
  (page) => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DUCKDB_ENABLED", "true");
      vi.stubEnv(statsFlag[page], "true");
      vi.stubEnv("DUCKDB_EVENTS_ENABLED", "true");
      cacheStore.clear();
      runtimeStatus.activeReleaseId = "release-1";
      runtimeStatus.activePointerGeneration = "1";
      vi.clearAllMocks();
    });

    it("bypasses cache for mixed flags and retains same-mode cache behavior", async () => {
      const fetcher = getFetcher[page];
      fetcher.mockImplementation(async () =>
        response(page, fetcher.mock.calls.length),
      );
      const load = getLoader[page];

      const cachedFirst = (await load(9)) as {
        events: { eventReleaseId: string }[];
      };
      const cachedAgain = (await load(9)) as {
        events: { eventReleaseId: string }[];
      };
      expect(cachedFirst.events[0].eventReleaseId).toBe("events-1");
      expect(cachedAgain.events[0].eventReleaseId).toBe("events-1");
      expect(fetcher).toHaveBeenCalledOnce();

      vi.stubEnv("DUCKDB_EVENTS_ENABLED", "false");
      const mixedFirst = (await load(9)) as {
        events: { eventReleaseId: string }[];
      };
      const mixedSecond = (await load(9)) as {
        events: { eventReleaseId: string }[];
      };
      expect(mixedFirst.events[0].eventReleaseId).toBe("events-2");
      expect(mixedSecond.events[0].eventReleaseId).toBe("events-3");

      vi.stubEnv("DUCKDB_EVENTS_ENABLED", "true");
      vi.stubEnv(statsFlag[page], "false");
      const otherMixed = (await load(9)) as {
        events: { eventReleaseId: string }[];
      };
      expect(otherMixed.events[0].eventReleaseId).toBe("events-4");
      expect(fetcher).toHaveBeenCalledTimes(4);
    });

    it("gets a fresh event release after a pointer change when stats use BigQuery", async () => {
      vi.stubEnv(statsFlag[page], "false");
      const fetcher = getFetcher[page];
      fetcher.mockImplementation(async () => ({
        ...response(page, 0),
        events: [{ eventReleaseId: runtimeStatus.activeReleaseId }],
      }));
      const load = getLoader[page];
      const before = (await load(9)) as {
        events: { eventReleaseId: string }[];
      };
      runtimeStatus.activeReleaseId = "release-2";
      runtimeStatus.activePointerGeneration = "2";
      const after = (await load(9)) as typeof before;
      expect(before.events[0].eventReleaseId).toBe("release-1");
      expect(after.events[0].eventReleaseId).toBe("release-2");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(cacheStore.size).toBe(0);
    });
  },
);
