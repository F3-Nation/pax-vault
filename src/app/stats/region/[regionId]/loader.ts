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
import { getPageData } from "@/lib/bq/regions";
import { parseRegionPreferences } from "@/lib/preferences";
import { cacheStatsData } from "@/lib/cache";
import { StatsFilters } from "@/lib/filters";
import { normalizeDeep } from "@/lib/normalize";

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
  try {
    // Cache key is entity-scoped (region + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    return await cacheStatsData<RegionData>(
      async () => {
        const regionData = await getPageData(regionId, userIdentifier, filters);

        // Normalize BigQuery output into plain, serializable data so it can
        // be passed from this Server Component to Client Components.
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

        return mergedSafe;
      },
      ["region-page-data", String(regionId), JSON.stringify(filters ?? {})],
      [`region-${regionId}`],
    );
  } catch (err) {
    console.error(`Error fetching Region data (region=${regionId}):`, err);
    return null;
  }
}
