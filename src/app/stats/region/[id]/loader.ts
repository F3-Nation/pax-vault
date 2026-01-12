import type { RegionData, RegionUpcomingEvents } from "@/types/region";
import { getRegionData, getUpcomingEvents } from "@/lib/data";
import { logger } from "@/lib/logger";

export async function loadRegionStats(id: number) {
  // Fetch in parallel instead of sequentially for better performance
  const [regionData, upcomingEvents] = await Promise.all([
    getRegionData(id),
    getUpcomingEvents(id),
  ]).catch((err) => {
    logger.error("Error fetching RegionData.", err);
    return [null, null];
  });

  return {
    region_data: regionData as RegionData[] | null,
    upcoming_events: upcomingEvents as RegionUpcomingEvents[] | null,
  };
}
