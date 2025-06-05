// src/lib/data/region.ts
import pool from '@/lib/db';
import { unstable_cache } from 'next/cache';

export interface RegionList {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  email: string; // Contact email for the region
  website: string; // Website URL of the region
  logo: string | null; // Logo URL of the region, can be null
  active: boolean; // Indicates if the region is active
}

export interface AODetail {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  email: string | null; // Contact email for the region
  website: string | null; // Website URL of the region
  twitter: string | null; // Twitter handle of the region, can be null
  facebook: string | null; // Facebook page of the region, can be null
  instagram: string | null; // Instagram handle of the region, can be null
  created: string; // Creation date of the region
  updated: string; // Last update date of the regio
  logo: string | null; // Logo URL of the region, can be null
  ao_count: number; // Number of AOs (Areas of Operation) in the region
  active: boolean; // Indicates if the region is active
}

export interface RegionDetail {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  email: string | null; // Contact email for the region
  website: string | null; // Website URL of the region
  twitter: string | null; // Twitter handle of the region, can be null
  facebook: string | null; // Facebook page of the region, can be null
  instagram: string | null; // Instagram handle of the region, can be null
  created: string; // Creation date of the region
  updated: string; // Last update date of the regio
  logo: string | null; // Logo URL of the region, can be null
  ao_count: number; // Number of AOs (Areas of Operation) in the region
  active: boolean; // Indicates if the region is active
  aos: AODetail[]; // List of AOs associated with the region
}

export interface RegionDetailResponse {
  region: RegionDetail | null; // The region details or null if not found
}

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