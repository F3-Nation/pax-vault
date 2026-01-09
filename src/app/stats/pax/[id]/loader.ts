import { PaxData, PaxInfo, PaxEventData } from "@/types/pax";
import { getPaxInfo, getPaxEvents } from "@/lib/data";
import { logger } from "@/lib/logger";

export async function loadPaxStats(id: number): Promise<PaxData> {
  let paxInfo: PaxInfo | null = null;
  let paxEvents: PaxEventData[] | null = null;
  try {
    paxInfo = await getPaxInfo(id);
    paxEvents = await getPaxEvents(id);
  } catch (err) {
    logger.error("Error fetching PaxInfo.", err);
  }
  const paxData = {
    info: paxInfo!,
    events: paxEvents || [],
  };

  return paxData;
}
