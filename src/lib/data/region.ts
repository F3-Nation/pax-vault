// src/lib/data/region.ts
import pool from '@/lib/db';

export interface RegionData {
  id: number;
  name: string;
  email: string;
  website: string;
  is_active: boolean;
}

export async function getRegionData(): Promise<RegionData[]> {
    const { rows } = await pool.query(
        "SELECT id, name, email, website, is_active FROM orgs WHERE org_type = 'region' ORDER BY id DESC"
    );
    return rows as RegionData[];
}
