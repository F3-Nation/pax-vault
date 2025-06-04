// src/lib/data/ao.ts
import pool from '@/lib/db';
import { unstable_cache } from 'next/cache';

export interface AoData {
  id: number; // Unique identifier for the organization
  name: string; // Name of the organization
  email: string; // Contact email for the organization
  website: string; // Website URL of the organization
  logo: string | null; // Logo URL of the organization, can be null
  active: boolean; // Indicates if the organization is active
}

export async function getAoDataUncached(): Promise<AoData[]> {
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
    return rows as AoData[];
}

export const getAoData = unstable_cache(
  async () => await getAoDataUncached(),
  ['ao-data'],
  { revalidate: 900 } // 15 minutes
);
