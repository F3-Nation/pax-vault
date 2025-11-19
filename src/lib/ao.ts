// src/lib/region.ts
import { AOData, AOSummary, AOLeaders, AOEvents, AOQLineup } from "@/types/ao";
import pool from "@/lib/db";
import { toTitleCase, formatTime, formatDate } from "@/lib/utils";

export async function getAOSummary(id: number): Promise<AOSummary | null> {
  const { rows } = await pool.query(
    `
    SELECT
    -- First-ever workout date for this AO
    MIN(ei.start_date) AS first_start_time,

    -- Total workouts (unique instances)
    COUNT(DISTINCT ei.id) AS total_workouts,

    -- Unique PAX (distinct user IDs across all attendance records)
    COUNT(DISTINCT ae.user_id) AS unique_pax,

    -- Unique Qs (distinct user IDs that have q_ind = 1)
    COUNT(DISTINCT CASE WHEN ae.q_ind = 1 THEN ae.user_id END) AS unique_qs,

    -- Total FNGs (sum from unique instances)
    SUM(DISTINCT ei.fng_count) AS total_fngs,

    -- Average PAX Count (avg from unique instances)
    AVG(DISTINCT ei.pax_count) AS avg_pax_count,

    -- Peak PAX Count
    MAX(ei.pax_count) AS peak_pax_count

FROM attendance_expanded ae
JOIN event_instance_expanded ei
    ON ae.event_instance_id = ei.id
WHERE ei.ao_org_id = $1`,
    [id]
  );

  // If no rows found, return null
  if (rows.length === 0) {
    return null;
  }

  // Format the first_start_time to a readable date format
  if (rows[0].first_start_time) {
    rows[0].first_start_time = formatDate(new Date(rows[0].first_start_time), "M D Y");
  }

  // Round numeric fields to x.xx decimal places
  if (rows[0].avg_pax_count !== null) {
    rows[0].avg_pax_count = parseFloat(rows[0].avg_pax_count).toFixed(2);
  }

  return rows[0] as AOSummary;
  
}

export async function getAOLeaders(id: number): Promise<AOLeaders | null> {
  const { rows } = await pool.query(
    `
    SELECT
    ae.user_id,
    ae.f3_name,
    ae.q_ind,
    ae.avatar_url
    FROM attendance_expanded ae
    JOIN event_instance_expanded ei
        ON ae.event_instance_id = ei.id
    WHERE ei.ao_org_id = $1`,
    [id]
  );

    if (rows.length === 0) {
    return null;
  }

  if (!rows) {
    return null;
  }

  // Aggregate by unique user_id
  const leaders: Record<
    string,
    { user_id: string; f3_name: string; posts: number; qs: number; avatar_url: string | undefined }
  > = {};

  for (const row of rows) {
    const uid = row.user_id;

    if (!leaders[uid]) {
      leaders[uid] = {
        user_id: uid,
        f3_name: row.f3_name,
        posts: 0,
        qs: 0,
        avatar_url: row.avatar_url,
      };
    }

    // Count total appearances
    leaders[uid].posts += 1;

    // Count Q appearances
    if (row.q_ind == 1) {
      leaders[uid].qs += 1;
    }
  }
  
  return Object.values(leaders) as unknown as AOLeaders;
}

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

export async function getAOEvents(id: number): Promise<AOEvents[]> {
  const { rows } = await pool.query(
    `
  WITH pax_lists AS (
  SELECT 
    ae.event_instance_id,
    STRING_AGG(
      ae.user_id || '|||' || ae.f3_name || '|||' || COALESCE(ae.avatar_url, ''),
      '###'
    ) AS pax_list
  FROM attendance_expanded ae
  JOIN event_instance_expanded ei ON ae.event_instance_id = ei.id
  WHERE ei.ao_org_id = $1
  GROUP BY ae.event_instance_id
),

q_lists AS (
  SELECT 
    ae.event_instance_id,
    STRING_AGG(
      ae.user_id || '|||' || ae.f3_name || '|||' || COALESCE(ae.avatar_url, ''),
      '###'
    ) AS q_list
  FROM attendance_expanded ae
  JOIN event_instance_expanded ei ON ae.event_instance_id = ei.id
  WHERE ei.ao_org_id = $1
    AND ae.q_ind = 1
  GROUP BY ae.event_instance_id
)

SELECT 
  ei.*,              -- ONE ROW PER EVENT INSTANCE
  pl.pax_list,
  ql.q_list
FROM event_instance_expanded ei
LEFT JOIN pax_lists pl ON ei.id = pl.event_instance_id
LEFT JOIN q_lists ql ON ei.id = ql.event_instance_id
WHERE ei.ao_org_id = $1
ORDER BY ei.start_date DESC;
    `,
    [id]
  );
  return rows as AOEvents[];
}

export async function getAOQLineup(id: number): Promise<AOQLineup[]> {
  const { rows } = await pool.query(
    `
-- Upcoming Qs for a Region (Fixed for JSON Grouping Error)
SELECT
    ei.start_date,
    ei.start_time,
    ao.name AS ao_name,
    ao.id AS ao_org_id,
    l.name AS location_name,
    l.latitude,
    l.longitude,
    STRING_AGG(DISTINCT et.name, ', ') AS event_types,
    STRING_AGG(DISTINCT tag.name, ', ') AS event_tags,
    -- FIX: Wrap in MAX() and cast to text->json to avoid GROUP BY error
    COALESCE(MAX(q_data.q_details::text)::json, '[]'::json) AS q_list,
    COALESCE(MAX(q_data.q_names), null) AS q_who
FROM
    event_instances ei
    JOIN locations l ON ei.location_id = l.id
    JOIN orgs ao ON ei.org_id = ao.id AND ao.org_type = 'ao'
    LEFT JOIN event_instances_x_event_types eixet ON ei.id = eixet.event_instance_id
    LEFT JOIN event_types et ON eixet.event_type_id = et.id
    LEFT JOIN event_tags_x_event_instances etxei ON ei.id = etxei.event_instance_id
    LEFT JOIN event_tags tag ON etxei.event_tag_id = tag.id
    -- Join Q Data
    LEFT JOIN (
        SELECT
            a.event_instance_id,
            STRING_AGG(u.f3_name, ', ') AS q_names,
            -- Creates the JSON array of Q details
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'user_id', u.id,
                    'name', u.f3_name,
                    'avatar_url', u.avatar_url
                )
            ) AS q_details
        FROM
            attendance a
            JOIN attendance_x_attendance_types axat ON a.id = axat.attendance_id
            JOIN attendance_types at ON axat.attendance_type_id = at.id
            JOIN users u ON a.user_id = u.id
        WHERE
            at.type = 'Q'
        GROUP BY
            a.event_instance_id
    ) q_data ON ei.id = q_data.event_instance_id
WHERE
    ao.id = $1
    --l.org_id = 25174 -- Geneva Region ID
    AND ei.start_date >= CURRENT_DATE
GROUP BY
    ei.id,
    ei.start_date,
    ei.start_time,
    ao.name,
    ao.id,
    l.name,
    l.latitude,
    l.longitude
ORDER BY
    ei.start_date,
    ei.start_time;
    `,
    [id]
  );
  return rows as AOQLineup[];
}