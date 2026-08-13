/**
 * AO stats data loader.
 *
 * Responsibilities:
 * - Resolve the correct base URL in both server and edge contexts.
 * - Fetch all AO-related datasets in parallel.
 * - Normalize filter query parameters for AO sub-requests.
 * - Fail gracefully by returning `null` when any critical fetch fails.
 */
import {
  EventData,
  AOData,
  AOInfo,
  AOSummary,
  EventUpcoming,
  Leaders,
} from "@/lib/types";
import { getPageData } from "@/lib/bq/aos";
import { parseRegionPreferences } from "@/lib/preferences";
import { cacheStatsData } from "@/lib/cache";
import { StatsFilters } from "@/lib/filters";
import { normalizeDeep } from "@/lib/normalize";

/**
 * Load all data required for the AO stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadAOData(
  aoId: number,
  userIdentifier?: string,
  filters?: StatsFilters,
): Promise<AOData | null> {
  try {
    // Cache key is entity-scoped (AO + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    return await cacheStatsData<AOData>(
      async () => {
        const aoData = await getPageData(aoId, userIdentifier, filters);

        // Normalize BigQuery output into plain, serializable data so it can
        // be passed from this Server Component to Client Components.
        const mergedPlain = normalizeDeep<AOData>(aoData);

        // Defensive: many UI components assume list fields are arrays and call `.map`.
        // Preserve the existing data shape from the old REST endpoints by defaulting missing lists to [].
        const mergedSafe: AOData = {
          info: mergedPlain.info as AOInfo,
          summary: mergedPlain.summary as AOSummary,
          leaders: (mergedPlain.leaders ?? []) as Leaders[],
          events: (mergedPlain.events ?? []) as EventData[],
          upcoming: (mergedPlain.upcoming ?? []) as EventUpcoming[],
          // Inherited from the parent region — an AO renders under whatever
          // its region configured. Defaults when the region never saved any.
          preferences: parseRegionPreferences(aoData.preferencesJson),
        };

        mergedSafe.events = (mergedSafe.events ?? []).map((e: EventData) => ({
          ...e,
          attendance: Array.isArray(e?.attendance) ? e.attendance : [],
          tags: Array.isArray(e?.tags) ? e.tags : [],
          types: Array.isArray(e?.types) ? e.types : [],
        })) as EventData[];

        return mergedSafe;
      },
      ["ao-page-data", String(aoId), JSON.stringify(filters ?? {})],
      [`ao-${aoId}`],
    );
  } catch (err) {
    console.error("Error fetching AO data:", err);
    return null;
  }
}
