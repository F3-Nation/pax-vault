import { getAOData } from "@/lib/ao";
import { AOData } from "@/types/ao";

export async function loadAOStats(id: number) {
  let AOInfo: AOData | null = null;
  try {
    AOInfo = await getAOData(id);
  } catch (err) {
    console.error("Error fetching cached AO info:", err);
  }
  return {
    AOInfo,
  };
}
