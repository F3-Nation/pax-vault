// src/lib/region.ts
import { AOData } from "@/types/ao";
import pool from "@/lib/db";
import { toTitleCase, formatTime } from "@/lib/utils";

export async function getAOData(id: number): Promise<AOData | null> {
  const { rows } = await pool.query(
    `
      SELECT 
        orgs.id, 
        orgs.parent_id AS region_id,
        parent.name AS region_name,
        orgs.name,
        orgs.description, 
        orgs.email, 
        orgs.website,
        orgs.twitter,
        orgs.facebook,
        orgs.instagram,
        orgs.logo_url AS logo, 
        orgs.is_active AS active,
        orgs.meta,
        
        -- From joined event
        events.id AS event_id,
        events.name AS event_name,
        events.description as event_description,
        events.start_time,
        events.end_time,
        events.day_of_week,
        events.meta AS event_meta,

        -- From joined event_type
        event_types.id AS event_type_id,
        event_types.name AS event_type_name

      FROM 
        orgs
      LEFT JOIN orgs parent ON orgs.parent_id = parent.id
      LEFT JOIN events ON events.org_id = orgs.id
      LEFT JOIN event_types 
        ON (events.meta ->> 'eventTypeId')::int = event_types.id
      WHERE 
        orgs.id = $1
    `,
    [id]
  );

  // Loop through rows and add event data to an array
  interface EventSchedule {
    id: number;
    name: string;
    description: string;
    start_time: string;
    end_time: string;
    day_of_week: string;
    event_type: string;
  }

  const eventSchedules: Array<EventSchedule | null> = [];
  let schedule: EventSchedule | null = null;

  rows.forEach((row) => {
    if (row.event_id) {
      schedule = {
        id: row.event_id,
        name: row.event_name,
        description: row.event_description,
        start_time: formatTime(row.start_time), // Format time to HH:MM AM/PM
        end_time: formatTime(row.end_time), // Format time to HH:MM AM/
        day_of_week: toTitleCase(row.day_of_week), // Convert to title case
        event_type: row.event_type_name,
      };
    } else {
      schedule = null;
    }
    eventSchedules.push(schedule);
  });

  // sort eventSchedules by days of the week
  eventSchedules.sort((a, b) => {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", ];
    if (!a || !b) return 0;
    const dayA = daysOfWeek.indexOf(a.day_of_week);
    const dayB = daysOfWeek.indexOf(b.day_of_week);
    return dayA - dayB;
  });
  
  // If no rows found, return null
  if (rows.length === 0) {
    return null;
  }

  // Add eventSchedules
  rows[0].eventSchedule = eventSchedules.filter((event) => event !== null);

  return rows[0] as AOData;
}
