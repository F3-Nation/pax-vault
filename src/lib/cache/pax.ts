// src/lib/data/pax.ts
import { PaxInfo } from "@/types/pax";
import { queryBigQuery } from "../db";

export async function getPaxList(): Promise<PaxInfo[]> {
  const query = `
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
    ORDER BY
      us.id DESC;
  `;

  const results = await queryBigQuery<PaxInfo>(query);

  return results;
}
