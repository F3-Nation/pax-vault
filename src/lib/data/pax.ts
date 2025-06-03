// src/lib/data/region.ts
import pool from '@/lib/db';

export interface PaxData {
  id: number;
  f3_name: string;
  first_name: string;
  last_name: string;
  email: string;
  region: string;
  avatar: string;
  created: string;
  updated: string;
  status: string;
}

export async function getPaxData(): Promise<PaxData[]> {
    const { rows } = await pool.query(`
        SELECT 
            us.id,
            us.f3_name,
            us.first_name,
            us.last_name,
            us.email,
            org.name AS region,
            us.avatar_url as avatar,
            us.created,
            us.updated,
            us.status
        FROM 
            users us
        LEFT JOIN 
            orgs org ON us.home_region_id = org.id
        ORDER BY 
            us.id DESC;
    `);
    return rows as PaxData[];
}
