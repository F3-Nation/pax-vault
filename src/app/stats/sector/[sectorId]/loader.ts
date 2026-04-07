/**
 * Sector stats data loader.
 *
 * Responsibilities:
 * - Call the BigQuery sector data function.
 * - Normalize BigQuery response (unwrap value wrappers, convert bigints).
 * - Fail gracefully by returning null on error.
 */
import {
  SectorData,
  SectorInfo,
  SectorSummary,
  SectorAreaBreakdown,
  ChartData,
} from "@/lib/types";
import { getPageData } from "@/lib/bq/sectors";

type SectorFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
};

export async function loadSectorData(
  sectorId: number,
  userIdentifier?: string,
  filters?: SectorFilterOpts,
): Promise<SectorData | null> {
  try {
    const sectorData = await getPageData(sectorId, userIdentifier, filters);

    const mergedPlain = JSON.parse(
      JSON.stringify(sectorData, (_k, v) => {
        if (v && typeof v === "object" && "value" in v) return v.value;
        if (typeof v === "bigint") return Number(v);
        return v;
      }),
    ) as SectorData;

    const mergedSafe: SectorData = {
      info: mergedPlain.info as SectorInfo,
      summary: mergedPlain.summary as SectorSummary,
      areaBreakdown: (mergedPlain.areaBreakdown ?? []) as SectorAreaBreakdown[],
      charts: (mergedPlain.charts ?? []) as ChartData[],
    };

    return mergedSafe;
  } catch (err) {
    console.error(`Error fetching Sector data (sector=${sectorId}):`, err);
  }

  return null;
}
