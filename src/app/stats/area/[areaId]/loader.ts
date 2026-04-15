/**
 * Area stats data loader.
 *
 * Responsibilities:
 * - Call the BigQuery area data function.
 * - Normalize BigQuery response (unwrap value wrappers, convert bigints).
 * - Fail gracefully by returning null on error.
 */
import {
  AreaData,
  AreaInfo,
  AreaSummary,
  AreaRegionBreakdown,
  ChartData,
} from "@/lib/types";
import { getPageData } from "@/lib/bq/areas";

type AreaFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
};

export async function loadAreaData(
  areaId: number,
  userIdentifier?: string,
  filters?: AreaFilterOpts,
): Promise<AreaData | null> {
  try {
    const areaData = await getPageData(areaId, userIdentifier, filters);

    const mergedPlain = JSON.parse(
      JSON.stringify(areaData, (_k, v) => {
        if (v && typeof v === "object" && "value" in v) return v.value;
        if (typeof v === "bigint") return Number(v);
        return v;
      }),
    ) as AreaData;

    const mergedSafe: AreaData = {
      info: mergedPlain.info as AreaInfo,
      summary: mergedPlain.summary as AreaSummary,
      regionBreakdown: (mergedPlain.regionBreakdown ??
        []) as AreaRegionBreakdown[],
      charts: (mergedPlain.charts ?? []) as ChartData[],
    };

    return mergedSafe;
  } catch (err) {
    console.error(`Error fetching Area data (area=${areaId}):`, err);
  }

  return null;
}
