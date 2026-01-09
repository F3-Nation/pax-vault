import type { RegionData, RegionUpcomingEvents } from "@/types/region";
import { getRegionData, getUpcomingEvents } from "@/lib/data";
import { logger } from "@/lib/logger";

export async function loadRegionStats(id: number) {
  let regionData: RegionData[] | null = null;
  let upcomingEvents: RegionUpcomingEvents[] | null = null;
  try {
    regionData = await getRegionData(id);
    upcomingEvents = await getUpcomingEvents(id);
  } catch (err) {
    logger.error("Error fetching RegionData.", err);
  }

  return {
    region_data: regionData as RegionData[] | null,
    upcoming_events: upcomingEvents as RegionUpcomingEvents[] | null,
  };
}
