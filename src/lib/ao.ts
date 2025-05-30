// src/lib/region.ts
import { getAoData, AoData } from './data/ao';
import { cache } from 'react';

export const getCachedAoData = cache(async (): Promise<AoData[]> => {
  try {
    return await getAoData();
  } catch (err) {
    console.error('Failed to load ao data:', err);
    return [];
  }
});