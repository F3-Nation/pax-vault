// src/lib/data/ao.ts
import pool from '@/lib/db';
import { unstable_cache } from 'next/cache';
import { AOData } from '@/types/ao';

export async function getAoDataUncached(): Promise<AOData[]> {
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
    console.log('Ao data fetched from database');
    return rows as AOData[];
}

export const getAoData = unstable_cache(
  async () => await getAoDataUncached(),
  ['ao-data'],
  { revalidate: 900 } // 15 minutes
);
