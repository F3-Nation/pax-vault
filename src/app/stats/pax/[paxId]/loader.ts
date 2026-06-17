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
} from "@/lib/types";
import { getPageData } from "@/lib/bq/pax";
import { cacheStatsData } from "@/lib/cache";
import { StatsFilters } from "@/lib/filters";

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

        // Next.js can only pass plain JSON-serializable data from Server -> Client components.
        // BigQuery libraries sometimes return objects with custom / null prototypes (e.g., DATE wrappers).
        // Normalize to plain objects here to avoid: "Only plain objects ... can be passed to Client Components".

        const mergedPlain = JSON.parse(
          JSON.stringify(paxData, (_k, v) => {
            // Unwrap common BigQuery wrappers: { value: ... }
            if (v && typeof v === "object" && "value" in v) return v.value;
            if (typeof v === "bigint") return Number(v);
            return v;
          }),
        ) as PaxData;

        // Defensive: many UI components assume list fields are arrays and call `.map`.
        // Preserve the existing data shape from the old REST endpoints by defaulting missing lists to [].
        const mergedSafe: PaxData = {
          info: mergedPlain.info as PAXInfo,
          summary: mergedPlain.summary as PaxSummary,
          events: (mergedPlain.events ?? []) as EventData[],
          ao_breakdown: (mergedPlain.ao_breakdown ?? []) as PaxAOBreakdown[],
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
