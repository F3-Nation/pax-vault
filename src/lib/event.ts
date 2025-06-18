// src/lib/region.ts
import { EventDetail } from '@/types/event';
import pool from '@/lib/db';

export async function getEventData(id: number): Promise<EventDetail | null> {
    const { rows } = await pool.query(`
        SELECT 
            id,
            org_id,
            start_date,
            end_date,
            name,
            pax_count,
            fng_count,
            backblast,
            ao_org_id,
            ao_name,
            ao_website,
            region_org_id,
            region_name,
            region_website,
            bootcamp_ind,
            run_ind,
            ruck_ind,
            first_f_ind,
            second_f_ind,
            third_f_ind
        FROM 
            event_instance_expanded
        WHERE 
            id = $1 
        `,
        [id]
    );
    console.log('Event data fetched from database');
    
    if (!rows[0]) return null;

    // Replace region and region_id with defaults if null
    const event = rows[0];
    return event as EventDetail;
}