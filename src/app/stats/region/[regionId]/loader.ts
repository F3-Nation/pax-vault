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
} from "@/lib/types";
import { getPageData } from "@/lib/bq/regions";

/**
 * Shared filter options passed through to region API endpoints.
 */
type RegionFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
  aoIds?: number[];
  aoMode?: "include" | "exclude";
  tagIds?: number[];
  tagMode?: "include" | "exclude";
  typeIds?: number[];
  typeMode?: "include" | "exclude";
  categoryIds?: number[];
  categoryMode?: "include" | "exclude";
};

/**
 * Load all data required for the region stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadRegionData(
  regionId: number,
  filters?: RegionFilterOpts,
): Promise<RegionData | null> {
  try {
    const regionData = await getPageData(regionId, filters);

    // Next.js can only pass plain JSON-serializable data from Server -> Client components.
    // BigQuery libraries sometimes return objects with custom / null prototypes (e.g., DATE wrappers).
    // Normalize to plain objects here to avoid: "Only plain objects ... can be passed to Client Components".

    const mergedPlain = JSON.parse(
      JSON.stringify(regionData, (_k, v) => {
        // Unwrap common BigQuery wrappers: { value: ... }
        if (v && typeof v === "object" && "value" in v) return v.value;
        if (typeof v === "bigint") return Number(v);
        return v;
      }),
    ) as RegionData;

    // Defensive: many UI components assume list fields are arrays and call `.map`.
    // Preserve the existing data shape from the old REST endpoints by defaulting missing lists to [].
    const mergedSafe: RegionData = {
      info: mergedPlain.info as RegionInfo,
      summary: mergedPlain.summary as RegionSummary,
      leaders: (mergedPlain.leaders ?? []) as Leaders[],
      events: (mergedPlain.events ?? []) as EventData[],
      upcoming: (mergedPlain.upcoming ?? []) as EventUpcoming[],
      kotter: (mergedPlain.kotter ?? []) as RegionKotterList[],
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
  } catch (err) {
    console.error(`Error fetching Region data (region=${regionId}):`, err);
  }

  return null;
}
