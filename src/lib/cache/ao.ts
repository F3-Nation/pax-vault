// src/lib/data/ao.ts
import pool from "@/lib/db";
import { AOData } from "@/types/ao";

export async function getAoData(): Promise<AOData[]> {
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
  console.log(rows.length + " Ao rows fetched from database");
  return rows as AOData[];
}
