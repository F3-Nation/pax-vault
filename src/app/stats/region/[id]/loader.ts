import { RegionData } from "@/types/region";
import { queryBigQuery } from "@/lib/db";

async function getRegionalData(id: number): Promise<RegionData[] | null> {
    const query = `
    SELECT
      ei.id AS event_instance_id,
      ei.start_date AS event_date,
      ei.name AS event_name,
      ei.pax_count,
      ei.fng_count,
      ei.location_id,
      ei.location_name,
      ei.location_latitude,
      ei.location_longitude,
      ei.ao_org_id,
      ei.ao_name,
      ei.region_org_id,
      ei.region_name,
      ei.region_logo_url,
      ei.area_org_id,
      ei.area_name,
      ei.sector_org_id,
      ei.sector_name,
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
  
  const results = await queryBigQuery<RegionData>(query);
  
  return results || null;

}

export async function loadRegionStats(id: number) {
    let RegionData: RegionData[] | null = null;
  try {
    RegionData = await getRegionalData(id);
  } catch (err) {
    console.error("Error fetching cached Region info:", err);
  }

  return {
    region_data: RegionData as RegionData[] | null,
  };
}
