// src/lib/region.ts
import { getPaxList, PaxList, PaxDetail } from './data/pax';
import { cache } from 'react';
import pool from '@/lib/db';

export const getCachedPaxList = cache(async (): Promise<PaxList[]> => {
  try {
    return await getPaxList();
  } catch (err) {
    console.error('Failed to load pax data:', err);
    return [];
  }
});

export async function getPaxDetail(id: number): Promise<PaxDetail | null> {
  const { rows } = await pool.query(`
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
      LEFT JOIN LATERAL (
        SELECT 
          ei.region_name,
          ei.org_id
        FROM attendance_expanded ae
        JOIN event_instance_expanded ei ON ae.event_instance_id = ei.id
        WHERE ae.user_id = us.id
        ORDER BY ei.start_date ASC
        LIMIT 1
      ) er ON true
    WHERE us.id = $1
    `,
    [id]
  );
  return rows[0] ?? null;
}