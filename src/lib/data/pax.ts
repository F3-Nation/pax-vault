// src/lib/data/region.ts
import pool from '@/lib/db';

export interface PaxData {
  id: number;
  f3_name: string;
  first_name: string;
  last_name: string;
  email: string;
  home_region_id: number;
  avatar_url: string;
  created: string;
  updated: string;
  status: string;
}

export async function getPaxData(): Promise<PaxData[]> {
    const { rows } = await pool.query(
        "SELECT id, f3_name, first_name, last_name, email, home_region_id, avatar_url, created, updated, status FROM users ORDER BY id DESC"
    );
    return rows as PaxData[];
}
