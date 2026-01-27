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

/**
 * Shared filter options passed through to pax API endpoints.
 */
type PaxFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
  aoIds?: number[];
  aoMode?: "include" | "exclude";
  regionIds?: number[];
  regionMode?: "include" | "exclude";
  tagIds?: number[];
  tagMode?: "include" | "exclude";
  typeIds?: number[];
  typeMode?: "include" | "exclude";
  categoryIds?: number[];
  categoryMode?: "include" | "exclude";
};

/**
 * Load all data required for the pax stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadPaxData(
  paxId: number,
  filters?: PaxFilterOpts,
): Promise<PaxData | null> {
  try {
    const paxData = await getPageData(paxId, filters);

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
  } catch (err) {
    console.error("Error fetching PAX data:", err);
  }

  return null;
}
