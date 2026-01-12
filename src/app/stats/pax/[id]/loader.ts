import { PaxData, PaxInfo, PaxEventData } from "@/types/pax";
import { getPaxInfo, getPaxEvents } from "@/lib/data";
import { logger } from "@/lib/logger";

export async function loadPaxStats(id: number): Promise<PaxData> {
  // Fetch in parallel instead of sequentially for better performance
  const [paxInfo, paxEvents] = await Promise.all([
    getPaxInfo(id),
    getPaxEvents(id),
  ]).catch((err) => {
    logger.error("Error fetching PaxInfo.", err);
    return [null, null];
  });

  const paxData = {
    info: paxInfo!,
    events: paxEvents || [],
  };

  return paxData;
}
