// src/lib/cache/region.ts
import { getRegionList } from "@/lib/data";
import { RegionDetails } from "@/types/region";
import { cache } from "react";
import { logger } from "@/lib/logger";

export const getCachedRegionList = cache(async (): Promise<RegionDetails[]> => {
  try {
    return await getRegionList();
  } catch (err) {
    logger.error("Failed to load RegionList into cache.", err);
    return [];
  }
});
