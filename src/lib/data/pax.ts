// src/lib/data/pax.ts
import pool from '@/lib/db';
import { unstable_cache } from 'next/cache';

export interface PaxData {
  id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname)   
  first_name: string; // First name of the user
  last_name: string; // Last name of the user
  email: string; // Email address of the user
  region: string; // Home region (if set)
  region_id: number; // ID of the home region
  region_default: string; // First-attended region
  region_default_id: number; // ID of the first-attended region
  avatar: string; // Avatar URL of the user
  created: string; // Timestamp when the user was created
  updated: string; // Timestamp when the user was last updated
  status: string; // Status of the user (e.g., active, inactive)
}

export async function getPaxDataUncached(): Promise<PaxData[]> {
    const { rows } = await pool.query(`
        WITH earliest_regions AS (
            SELECT DISTINCT ON (ae.user_id)
                ae.user_id,
                ei.region_name,
                ei.org_id
            FROM attendance_expanded ae
            JOIN event_instance_expanded ei ON ae.event_instance_id = ei.id
            ORDER BY ae.user_id, ei.start_date ASC
            )

            SELECT 
                us.id,
                us.f3_name,
                us.first_name,
                us.last_name,
                us.email,
                org.name AS region,
                org.id AS region_id,
                er.region_name AS region_default,
                er.org_id AS region_default_id,
                us.avatar_url AS avatar,
                us.created,
                us.updated,
                us.status
            FROM users us
            LEFT JOIN orgs org ON us.home_region_id = org.id
            LEFT JOIN earliest_regions er ON us.id = er.user_id
            ORDER BY us.id DESC;
        `);
    console.log('Pax data fetched from database');
    return rows as PaxData[];
}

export const getPaxData = unstable_cache(
  async () => await getPaxDataUncached(),
  ['pax-data'],
  { revalidate: 900 } // 15 minutes
);
