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
import { cacheStatsData } from "@/lib/cache";

/**
 * Shared filter options passed through to AO API endpoints.
 */
type AOFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
  tagIds?: number[];
  tagMode?: "include" | "exclude";
  typeIds?: number[];
  typeMode?: "include" | "exclude";
  categoryIds?: number[];
  categoryMode?: "include" | "exclude";
};

/**
 * Load all data required for the AO stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadAOData(
  aoId: number,
  userIdentifier?: string,
  filters?: AOFilterOpts,
): Promise<AOData | null> {
  try {
    // Cache key is entity-scoped (AO + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    return await cacheStatsData<AOData>(
      async () => {
        const aoData = await getPageData(aoId, userIdentifier, filters);

        // Next.js can only pass plain JSON-serializable data from Server -> Client components.
        // BigQuery libraries sometimes return objects with custom / null prototypes (e.g., DATE wrappers).
        // Normalize to plain objects here to avoid: "Only plain objects ... can be passed to Client Components".

        const mergedPlain = JSON.parse(
          JSON.stringify(aoData, (_k, v) => {
            // Unwrap common BigQuery wrappers: { value: ... }
            if (v && typeof v === "object" && "value" in v) return v.value;
            if (typeof v === "bigint") return Number(v);
            return v;
          }),
        ) as AOData;

        // Defensive: many UI components assume list fields are arrays and call `.map`.
        // Preserve the existing data shape from the old REST endpoints by defaulting missing lists to [].
        const mergedSafe: AOData = {
          info: mergedPlain.info as AOInfo,
          summary: mergedPlain.summary as AOSummary,
          leaders: (mergedPlain.leaders ?? []) as Leaders[],
          events: (mergedPlain.events ?? []) as EventData[],
          upcoming: (mergedPlain.upcoming ?? []) as EventUpcoming[],
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
