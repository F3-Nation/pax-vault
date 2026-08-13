/**
 * Pax stats data loader.
 *
 * Responsibilities:
 * - Resolve the correct base URL in both server and edge contexts.
 * - Fetch all pax-related datasets in parallel.
 * - Normalize filter query parameters for pax sub-requests.
 * - Fail gracefully by returning `null` when any critical fetch fails.
 */
import {
  EventData,
  PaxData,
  PAXInfo,
  PaxSummary,
  PaxAOBreakdown,
  PaxAOWeeklyActivity,
} from "@/lib/types";
import { getPageData } from "@/lib/bq/pax";
import { cacheStatsData } from "@/lib/cache";
import { StatsFilters } from "@/lib/filters";
import { normalizeDeep } from "@/lib/normalize";

/**
 * Load all data required for the pax stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadPaxData(
  paxId: number,
  userIdentifier?: string,
  filters?: StatsFilters,
): Promise<PaxData | null> {
  try {
    // Cache key is entity-scoped (PAX + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    return await cacheStatsData<PaxData>(
      async () => {
        const paxData = await getPageData(paxId, userIdentifier, filters);

        // Normalize BigQuery output into plain, serializable data so it can
        // be passed from this Server Component to Client Components.
        const mergedPlain = normalizeDeep<PaxData>(paxData);

        // Defensive: many UI components assume list fields are arrays and call `.map`.
        // Preserve the existing data shape from the old REST endpoints by defaulting missing lists to [].
        const mergedSafe: PaxData = {
          info: mergedPlain.info as PAXInfo,
          summary: mergedPlain.summary as PaxSummary,
          events: (mergedPlain.events ?? []) as EventData[],
          ao_breakdown: (mergedPlain.ao_breakdown ?? []) as PaxAOBreakdown[],
          ao_weekly: (mergedPlain.ao_weekly ?? []) as PaxAOWeeklyActivity[],
          // Resolved server-side from the filters; the matrix renders exactly
          // these columns.
          activity_window: paxData.activity_window ?? null,
        };

        mergedSafe.events = (mergedSafe.events ?? []).map((e: EventData) => ({
          ...e,
          attendance: Array.isArray(e?.attendance) ? e.attendance : [],
          tags: Array.isArray(e?.tags) ? e.tags : [],
          types: Array.isArray(e?.types) ? e.types : [],
        })) as EventData[];

        return mergedSafe;
      },
      ["pax-page-data", String(paxId), JSON.stringify(filters ?? {})],
      [`pax-${paxId}`],
    );
  } catch (err) {
    console.error("Error fetching PAX data:", err);
    return null;
  }
}
