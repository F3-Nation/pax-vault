import { getPaxList } from "@/lib/cache/pax";
import { PaxInfo } from "@/lib/types";
import { cache } from "react";

export const getCachedPaxList = cache(async (): Promise<PaxInfo[]> => {
  try {
    return await getPaxList();
  } catch (err) {
    console.error("Failed to load pax data:", err);
    return [];
  }
});
