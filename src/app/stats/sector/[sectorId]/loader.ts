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
import { cacheStatsData } from "@/lib/cache";
import { DateRangeFilters } from "@/lib/filters";
import { normalizeDeep } from "@/lib/normalize";

export async function loadSectorData(
  sectorId: number,
  userIdentifier?: string,
  filters?: DateRangeFilters,
): Promise<SectorData | null> {
  try {
    // Cache key is entity-scoped (sector + filters), NOT user-scoped — the
    // normalization runs inside the cache so the cached value is plain JSON.
    return await cacheStatsData<SectorData>(
      async () => {
        const sectorData = await getPageData(sectorId, userIdentifier, filters);

        const mergedPlain = normalizeDeep<SectorData>(sectorData);

        const mergedSafe: SectorData = {
          info: mergedPlain.info as SectorInfo,
          summary: mergedPlain.summary as SectorSummary,
          areaBreakdown: (mergedPlain.areaBreakdown ??
            []) as SectorAreaBreakdown[],
          charts: (mergedPlain.charts ?? []) as ChartData[],
        };

        return mergedSafe;
      },
      ["sector-page-data", String(sectorId), JSON.stringify(filters ?? {})],
      [`sector-${sectorId}`],
    );
  } catch (err) {
    console.error(`Error fetching Sector data (sector=${sectorId}):`, err);
    return null;
  }
}
