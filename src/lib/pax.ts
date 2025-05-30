// src/lib/region.ts
import { getPaxData, PaxData } from './data/pax';
import { cache } from 'react';

export const getCachedPaxData = cache(async (): Promise<PaxData[]> => {
  try {
    return await getPaxData();
  } catch (err) {
    console.error('Failed to load pax data:', err);
    return [];
  }
});