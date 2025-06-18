// src/lib/region.ts
import { AOData } from '@/types/ao';
import pool from '@/lib/db';

export async function getAOData(): Promise<AOData[]> {
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