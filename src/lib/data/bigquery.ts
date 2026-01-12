import { BigQuery } from "@google-cloud/bigquery";
import type { DataSource } from "./index";
import type { PaxInfo, PaxEventData } from "@/types/pax";
import type { RegionDetails, RegionData, RegionUpcomingEvents } from "@/types/region";

const projectId = process.env.BIGQUERY_PROJECT_ID!;
const datasetId = process.env.BIGQUERY_DATASET!;
const clientEmail = process.env.BIGQUERY_CLIENT_EMAIL!;
const privateKey = process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Create a single BigQuery client per Lambda/Node process
const bigquery = new BigQuery({
  projectId,
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
});

type BigQueryRow = Record<string, unknown>;

// Generic row normalizer: makes data safe for Next.js serialization
function normalizeRow(row: BigQueryRow): BigQueryRow {
  const plain: BigQueryRow = { ...row };

  // Generic fix: if a property is an object with a `value` key, flatten it.
  for (const key of Object.keys(plain)) {
    const v = plain[key];
    if (
      v &&
      typeof v === "object" &&
      "value" in (v as Record<string, unknown>)
    ) {
      (plain as Record<string, unknown>)[key] = (v as { value: unknown }).value;
    }
  }

  return plain;
}

// Internal query function - exported for backward compatibility with db.ts
export async function query<T = BigQueryRow>(sql: string): Promise<T[]> {
  const [rawRows] = await bigquery.query({
    query: sql,
    defaultDataset: { datasetId, projectId },
  });

  const rows = (rawRows as BigQueryRow[]).map((row) =>
    normalizeRow(row),
  ) as T[];

  return rows;
}

// SQL query for getting pax list
const PAX_LIST_QUERY = `
  WITH earliest_regions AS (
    SELECT
      user_id,
      region_name,
      region_org_id
    FROM (
      SELECT
        ae.user_id,
        ei.region_name,
        ei.region_org_id,
        ROW_NUMBER() OVER (
          PARTITION BY ae.user_id
          ORDER BY ei.start_date ASC
        ) AS rn
      FROM
        attendance_expanded ae
      JOIN
        event_instance_expanded ei
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
    er.region_org_id AS region_default_id,
    us.avatar_url,
    us.status
  FROM
    users us
  LEFT JOIN
   orgs org
  ON
    us.home_region_id = org.id
  LEFT JOIN
    earliest_regions er
  ON
    us.id = er.user_id
  WHERE EXISTS (
    SELECT 1
    FROM attendance_expanded ae2
    WHERE ae2.user_id = us.id
  )
  AND us.email IS NOT NULL
  AND REGEXP_CONTAINS(
    us.email,
    r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
  ORDER BY
    us.id DESC;
`;

// SQL query for getting region list
const REGION_LIST_QUERY = `
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
      org_type = 'region' 
    ORDER BY 
      id DESC;
`;

// SQL query template for getting pax info by ID
function getPaxInfoQuery(id: number): string {
  return `
    WITH earliest_regions AS (
      SELECT
        user_id,
        region_name,
        region_org_id
      FROM (
        SELECT
          ae.user_id,
          ei.region_name,
          ei.region_org_id,
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
      er.region_org_id AS region_default_id,
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
      us.id = ${id};
  `;
}

// SQL query template for getting pax events by ID
function getPaxEventsQuery(id: number): string {
  return `
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
      ei.all_types,
      ei.all_tags,
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
}

// SQL query template for getting regional data by ID
function getRegionDataQuery(id: number): string {
  return `
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
      ei.all_types,
      ei.all_tags,
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
}

// SQL query template for getting upcoming events by region ID
function getUpcomingEventsQuery(id: number): string {
  return `
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
}

export class BigQueryDataSource implements DataSource {
  async getPaxList(): Promise<PaxInfo[]> {
    return query<PaxInfo>(PAX_LIST_QUERY);
  }

  async getRegionList(): Promise<RegionDetails[]> {
    return query<RegionDetails>(REGION_LIST_QUERY);
  }

  async getPaxInfo(id: number): Promise<PaxInfo | null> {
    const sql = getPaxInfoQuery(id);
    const results = await query<PaxInfo>(sql);
    return results[0] || null;
  }

  async getPaxEvents(id: number): Promise<PaxEventData[] | null> {
    const sql = getPaxEventsQuery(id);
    return query<PaxEventData>(sql);
  }

  async getRegionData(id: number): Promise<RegionData[] | null> {
    const sql = getRegionDataQuery(id);
    return query<RegionData>(sql);
  }

  async getUpcomingEvents(id: number): Promise<RegionUpcomingEvents[] | null> {
    const sql = getUpcomingEventsQuery(id);
    return query<RegionUpcomingEvents>(sql);
  }
}
