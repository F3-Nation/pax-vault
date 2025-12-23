import { RegionData, RegionUpcomingEvents } from "@/types/region";
import { queryBigQuery } from "@/lib/db";

async function getRegionalData(id: number): Promise<RegionData[] | null> {
  const query = `
    SELECT
      ei.id AS event_instance_id,
      ei.start_date AS event_date,
      ei.name AS event_name,
      ei.pax_count,
      ei.fng_count,
      ei.ao_org_id,
      ei.ao_name,
      ei.region_org_id,
      ei.region_name,
      ei.region_logo_url,
      ei.area_org_id,
      ei.area_name,
      ei.sector_org_id,
      ei.sector_name,
      ei.first_f_ind,
      ei.second_f_ind,
      ei.third_f_ind,      
      COALESCE(ae_json.attendance, []) AS attendance
    FROM
      event_instance_expanded AS ei
    LEFT JOIN (
      SELECT
        ae.event_instance_id,
        ARRAY_AGG(STRUCT(
          ae.id        AS id,
          ae.user_id   AS user_id,
          ae.f3_name   AS f3_name,
          ae.q_ind     AS q_ind,
          ae.coq_ind   AS coq_ind,
          ae.avatar_url AS avatar_url
        )) AS attendance
      FROM
        attendance_expanded AS ae
      GROUP BY
        ae.event_instance_id
    ) AS ae_json
      ON ei.id = ae_json.event_instance_id
    WHERE
      ei.region_org_id = ${id}
    ORDER BY
      ei.start_date
  `;

  const results = await queryBigQuery<RegionData>(query);

  return results || null;
}

async function getUpcomingEvents(
  id: number,
): Promise<RegionUpcomingEvents[] | null> {
  const query = `
  -- Upcoming Events with Q List (BigQuery Standard SQL)
SELECT
  ei.start_date,
  ei.start_time,
  ao.name AS ao_name,
  ao.id AS ao_org_id,
  l.name AS location_name,
  COALESCE(ei.name, e.name) AS event_name,
  STRING_AGG(DISTINCT et.name, ', ') AS event_type,
  et.event_category,
  IFNULL(q_data.q_details, []) AS q_list
FROM event_instances ei
LEFT JOIN events e
  ON ei.series_id = e.id
LEFT JOIN locations l
  ON ei.location_id = l.id
LEFT JOIN orgs ao
  ON ei.org_id = ao.id
LEFT JOIN event_instances_x_event_types eixet
  ON ei.id = eixet.event_instance_id
LEFT JOIN event_types et
  ON eixet.event_type_id = et.id
LEFT JOIN (
  SELECT
    a.event_instance_id,
    ARRAY_AGG(
      STRUCT(
        u.id        AS user_id,
        u.f3_name   AS f3_name,
        u.avatar_url AS avatar_url
      )
      ORDER BY u.f3_name
    ) AS q_details
  FROM attendance a
  JOIN attendance_x_attendance_types axat
    ON a.id = axat.attendance_id
  JOIN attendance_types att
    ON axat.attendance_type_id = att.id
  JOIN users u
    ON a.user_id = u.id
  WHERE att.type = 'Q'
  GROUP BY a.event_instance_id
) q_data
  ON ei.id = q_data.event_instance_id
WHERE
  ao.parent_id = ${id}
  AND ei.start_date > CURRENT_DATE()
  AND ei.is_active = TRUE
GROUP BY
  ei.id,
  ei.start_date,
  ei.start_time,
  ao.name,
  ao.id,
  l.name,
  ei.name,
  e.name,
  et.event_category,
  q_data.q_details
ORDER BY
  ei.start_date,
  ei.start_time;
  `;

  const results = await queryBigQuery<RegionUpcomingEvents>(query);

  return results || null;
}

export async function loadRegionStats(id: number) {
  let regionData: RegionData[] | null = null;
  let upcomingEvents: RegionUpcomingEvents[] | null = null;
  try {
    regionData = await getRegionalData(id);
    upcomingEvents = await getUpcomingEvents(id);
  } catch (err) {
    console.error("Error fetching cached Region info:", err);
  }

  return {
    region_data: regionData as RegionData[] | null,
    upcoming_events: upcomingEvents as RegionUpcomingEvents[] | null,
  };
}
