import { getAOData, getAOSummary, getAOLeaders } from "@/lib/ao";
import { AOData, AOSummary, AOLeaders } from "@/types/ao";

export async function loadAOStats(id: number) {
  let AOInfo: AOData | null = null;
  let AOSummary: AOSummary | null = null;
  let AOLeaders: AOLeaders | null = null;
  try {
    AOInfo = await getAOData(id);
    AOSummary = await getAOSummary(id);
    AOLeaders = await getAOLeaders(id);
  } catch (err) {
    console.error("Error fetching cached AO info:", err);
  }
  return {
    AOInfo,
    AOSummary,
    AOLeaders,
  };
}
