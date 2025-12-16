import {
  getAOData,
  getAOSummary,
  getAOLeaders,
  getAOEvents,
  getAOQLineup,
} from "@/lib/ao";
import { AOData, AOSummary, AOLeaders, AOEvents, AOQLineup } from "@/types/ao";

export async function loadAOStats(id: number) {
  let AOInfo: AOData | null = null;
  let AOSummary: AOSummary | null = null;
  let AOLeaders: AOLeaders | null = null;
  let AOEvents: AOEvents[] | null = null;
  let AOQLineup: AOQLineup[] | null = null;
  try {
    AOInfo = await getAOData(id);
    AOSummary = await getAOSummary(id);
    AOLeaders = await getAOLeaders(id);
    AOEvents = await getAOEvents(id);
    AOQLineup = await getAOQLineup(id);
  } catch (err) {
    console.error("Error fetching cached AO info:", err);
  }
  return {
    AOInfo,
    AOSummary,
    AOLeaders,
    AOEvents,
    AOQLineup,
  };
}
