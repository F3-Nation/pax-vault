// src/lib/data/region.ts
import pool from '@/lib/db';

export interface AoData {
  id: number;
  name: string;
  email: string;
  website: string;
  logo: string | null;
  active: boolean;
}

export async function getAoData(): Promise<AoData[]> {
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
        org_type = 'ao' 
      ORDER BY 
        id DESC
    `);
    return rows as AoData[];
}
