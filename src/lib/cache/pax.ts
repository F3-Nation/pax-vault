// src/lib/cache/pax.ts
import { getPaxList } from "@/lib/data";
import { PaxInfo } from "@/types/pax";
import { cache } from "react";
import { logger } from "@/lib/logger";

export const getCachedPaxList = cache(async (): Promise<PaxInfo[]> => {
  try {
    return await getPaxList();
  } catch (err) {
    logger.error("Failed to load PaxList into cache.", err);
    return [];
  }
});
