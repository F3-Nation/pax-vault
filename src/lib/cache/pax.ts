// src/lib/data/pax.ts
import pool from '@/lib/db';
import { PaxList } from '@/types/pax';

export async function getPaxList(): Promise<PaxList[]> {
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
    console.log(rows.length + ' Pax rows fetched from database');
    return rows as PaxList[];

}
