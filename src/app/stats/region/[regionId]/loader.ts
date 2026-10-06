/**
 * Region stats data loader.
 *
 * Responsibilities:
 * - Resolve the correct base URL in both server and edge contexts.
 * - Fetch all region-related datasets in parallel.
 * - Normalize filter query parameters for region sub-requests.
 * - Fail gracefully by returning `null` when any critical fetch fails.
 */
import {
  EventData,
  RegionData,
  RegionInfo,
  RegionSummary,
  EventUpcoming,
  Leaders,
  RegionKotterList,
  ChartData,
  RegionAchievementPax,
  RegionAOBreakdown,
} from "@/lib/types";
import { DuckDbDependencyError, DuckDbQueryError } from "@/lib/duckdb/errors";
import { getPageData } from "@/lib/bq/regions";
import { parseRegionPreferences } from "@/lib/preferences";
import { cacheStatsData, getStatsReleaseIdentity } from "@/lib/cache";
import { StatsFilters } from "@/lib/filters";
import { normalizeDeep } from "@/lib/normalize";

function logRegionTiming(
  operation: string,
  regionId: number,
  durationMs: number,
  outcome: "success" | "failure",
  extra: Record<string, unknown> = {},
): void {
  if (process.env.ENVIRONMENT !== "staging") return;
  console.info(
    JSON.stringify({
      app: "pax-vault",
      level: "info",
      metric: "stats_region_timing",
      operation,
      regionId,
      durationMs,
      outcome,
      ...extra,
    }),
  );
}

/**
 * Load all data required for the region stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadRegionData(
  regionId: number,
  userIdentifier?: string,
  filters?: StatsFilters,
): Promise<RegionData | null> {
  const cacheStartedAt = Date.now();
  let cacheComputed = false;
  let cacheOutcome: "success" | "failure" = "failure";
  try {
    const releaseIdentity = getStatsReleaseIdentity("stats_region");
    // Cache key is entity-scoped (region + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    const result = await cacheStatsData<RegionData>(
      async () => {
        cacheComputed = true;
        const fetchStartedAt = Date.now();
        let fetchOutcome: "success" | "failure" = "failure";
        let regionData;
        try {
          regionData = await getPageData(regionId, userIdentifier, filters);
          fetchOutcome = "success";
        } finally {
          logRegionTiming(
            "getPageData",
            regionId,
            Date.now() - fetchStartedAt,
            fetchOutcome,
          );
        }

        // Normalize BigQuery output into plain, serializable data so it can
        // be passed from this Server Component to Client Components.
        const normalizationStartedAt = Date.now();
        let normalizationOutcome: "success" | "failure" = "failure";
        try {
          const mergedPlain = normalizeDeep<RegionData>(regionData);

          // Defensive: many UI components assume list fields are arrays and call `.map`.
          // Preserve the existing data shape from the old REST endpoints by defaulting missing lists to [].
          const mergedSafe: RegionData = {
            info: mergedPlain.info as RegionInfo,
            summary: mergedPlain.summary as RegionSummary,
            leaders: (mergedPlain.leaders ?? []) as Leaders[],
            events: (mergedPlain.events ?? []) as EventData[],
            upcoming: (mergedPlain.upcoming ?? []) as EventUpcoming[],
            kotter: (mergedPlain.kotter ?? []) as RegionKotterList[],
            charts: (mergedPlain.charts ?? []) as ChartData[],
            achievements: (mergedPlain.achievements ??
              []) as RegionAchievementPax[],
            aoBreakdown: (mergedPlain.aoBreakdown ?? []) as RegionAOBreakdown[],
            // Parsed from the raw json_config the page query returned. Defaults
            // are applied when the region has never saved preferences.
            preferences: parseRegionPreferences(regionData.preferencesJson),
          };

          mergedSafe.events = (mergedSafe.events ?? []).map((e: EventData) => ({
            ...e,
            attendance: Array.isArray(e?.attendance) ? e.attendance : [],
            tags: Array.isArray(e?.tags) ? e.tags : [],
            types: Array.isArray(e?.types) ? e.types : [],
          })) as EventData[];

          mergedSafe.kotter = (mergedSafe.kotter ?? []).map(
            (k: RegionKotterList) => ({
              ...k,
              bestie_list: Array.isArray(k?.bestie_list) ? k.bestie_list : [],
            }),
          ) as RegionKotterList[];

          normalizationOutcome = "success";
          return mergedSafe;
        } finally {
          logRegionTiming(
            "normalizeRegionData",
            regionId,
            Date.now() - normalizationStartedAt,
            normalizationOutcome,
          );
        }
      },
      ["region-page-data", String(regionId), JSON.stringify(filters ?? {})],
      [`region-${regionId}`],
      releaseIdentity,
      "stats_region",
    );
    cacheOutcome = "success";
    return result;
  } catch (err) {
    if (err instanceof DuckDbDependencyError) throw err;
    console.error(`Error fetching Region data (region=${regionId}):`, err);
    // A failed DuckDB query is not an empty region. Surface the error rather
    // than rendering the unavailable state; streamed responses may already be 200.
    if (err instanceof DuckDbQueryError) throw err;
    return null;
  } finally {
    logRegionTiming(
      "cacheStatsData",
      regionId,
      Date.now() - cacheStartedAt,
      cacheOutcome,
      { cacheComputed },
    );
  }
}
