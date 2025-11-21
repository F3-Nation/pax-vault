// src/lib/region.ts
import { getRegionList } from '@/lib/cache/region';
import { RegionList} from '@/types/region';
import { cache } from 'react';

export const getCachedRegionList = cache(async (): Promise<RegionList[]> => {
  try {
    return await getRegionList();
  } catch (err) {
    console.error('Failed to load region data:', err);
    return [];
  }
});