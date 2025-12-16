import { PaxData, PaxInfo, PaxEventData } from "@/types/pax";
import { queryBigQuery } from "@/lib/db";

async function getPaxInfo(id: number): Promise<PaxInfo | null> {
  const query = `
      WITH earliest_regions AS (
    SELECT
      user_id,
      region_name,
      org_id
    FROM (
      SELECT
        ae.user_id,
        ei.region_name,
        ei.org_id,
        ROW_NUMBER() OVER (
          PARTITION BY ae.user_id
          ORDER BY ei.start_date ASC
        ) AS rn
      FROM
      attendance_expanded AS ae
      JOIN
        event_instance_expanded AS ei
      ON
        ae.event_instance_id = ei.id
    )
    WHERE rn = 1
  )

  SELECT
    us.id AS user_id,
    us.f3_name,
    org.name AS region,
    org.id AS region_id,
    er.region_name AS region_default,
    er.org_id AS region_default_id,
    us.avatar_url,
    us.status
  FROM
    users AS us
  LEFT JOIN
    orgs AS org
  ON
    us.home_region_id = org.id
  LEFT JOIN
    earliest_regions AS er
  ON
    us.id = er.user_id
  WHERE
    us.id = ${id};`;

  const results = await queryBigQuery<PaxInfo>(query);

  return results[0] || null;
}

async function getPaxEvents(id: number): Promise<PaxEventData[] | null> {
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
          ae.id AS id,
          ae.user_id AS user_id,
          ae.f3_name AS f3_name,
          ae.q_ind AS q_ind,
          ae.coq_ind AS coq_ind,
          ae.avatar_url AS avatar_url
        )) AS attendance
      FROM
        attendance_expanded AS ae
      GROUP BY
        ae.event_instance_id
    ) AS ae_json
    ON
      ei.id = ae_json.event_instance_id
    WHERE EXISTS (
      SELECT 1
      FROM attendance_expanded AS ae_filter
      WHERE ae_filter.event_instance_id = ei.id
        AND ae_filter.user_id = ${id}
    )
    ORDER BY
      ei.start_date
  `;

  const results = await queryBigQuery<PaxEventData>(query);

  return results || null;
}

export async function loadPaxStats(id: number): Promise<PaxData> {
  let paxInfo: PaxInfo | null = null;
  let paxEvents: PaxEventData[] | null = null;
  try {
    paxInfo = await getPaxInfo(id);
    paxEvents = await getPaxEvents(id);
  } catch (err) {
    console.error("Error fetching cached Pax info:", err);
  }
  const paxData = {
    info: paxInfo!,
    events: paxEvents || [],
  };

  return paxData;
}
