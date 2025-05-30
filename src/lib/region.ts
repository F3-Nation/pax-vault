// src/lib/region.ts
import { getRegionData, RegionData } from './data/region';
import { cache } from 'react';

export const getCachedRegionData = cache(async (): Promise<RegionData[]> => {
  try {
    return await getRegionData();
  } catch (err) {
    console.error('Failed to load region data:', err);
    return [];
  }
});