// src/lib/data/region.ts
import pool from '@/lib/db';
import { unstable_cache } from 'next/cache';

export interface RegionData {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  email: string; // Contact email for the region
  website: string; // Website URL of the region
  logo: string | null; // Logo URL of the region, can be null
  active: boolean; // Indicates if the region is active
}

export async function getRegionDataUncached(): Promise<RegionData[]> {
    const { rows } = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        website,
        logo_url as logo, 
        is_active as active 
      FROM 
        orgs
      WHERE 
        org_type = 'region' 
      ORDER BY 
        id DESC
    `);
    console.log('Region data fetched from database');
    return rows as RegionData[];
}

export const getRegionData = unstable_cache(
  async () => await getRegionDataUncached(),
  ['region-data'],
  { revalidate: 900 } // 15 minutes
);