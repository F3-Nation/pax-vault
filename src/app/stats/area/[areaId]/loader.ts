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
import { cacheStatsData } from "@/lib/cache";
import { DateRangeFilters } from "@/lib/filters";
import { normalizeDeep } from "@/lib/normalize";

export async function loadAreaData(
  areaId: number,
  userIdentifier?: string,
  filters?: DateRangeFilters,
): Promise<AreaData | null> {
  try {
    // Cache key is entity-scoped (area + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    return await cacheStatsData<AreaData>(
      async () => {
        const areaData = await getPageData(areaId, userIdentifier, filters);

        const mergedPlain = normalizeDeep<AreaData>(areaData);

        const mergedSafe: AreaData = {
          info: mergedPlain.info as AreaInfo,
          summary: mergedPlain.summary as AreaSummary,
          regionBreakdown: (mergedPlain.regionBreakdown ??
            []) as AreaRegionBreakdown[],
          charts: (mergedPlain.charts ?? []) as ChartData[],
        };

        return mergedSafe;
      },
      ["area-page-data", String(areaId), JSON.stringify(filters ?? {})],
      [`area-${areaId}`],
    );
  } catch (err) {
    console.error(`Error fetching Area data (area=${areaId}):`, err);
    return null;
  }
}
