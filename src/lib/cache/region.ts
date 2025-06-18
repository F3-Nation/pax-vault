// src/lib/data/region.ts
import pool from '@/lib/db';
import { unstable_cache } from 'next/cache';
import { RegionList } from '@/types/region';

export async function getRegionListUncached(): Promise<RegionList[]> {
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
    return rows as RegionList[];
}

export const getRegionList = unstable_cache(
  async () => await getRegionListUncached(),
  ['region-list'],
  { revalidate: 900 } // 15 minutes
);