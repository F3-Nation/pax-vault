// src/lib/data/region.ts
import pool from '@/lib/db';
import { RegionList } from '@/types/region';

export async function getRegionList(): Promise<RegionList[]> {
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
    console.log(rows.length + ' Region rows fetched from database');
    return rows as RegionList[];
}