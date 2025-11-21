import pool from "@/lib/db";
import { RegionData } from "@/types/region";

async function getRegionalData(id: number): Promise<RegionData[] | null> {
  const { rows } = await pool.query(
    `
    SELECT
    ei.id as event_instance_id,
    ei.start_date AS event_date,
    ei.name as event_name,
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
    COALESCE(ae_json.attendance, '[]') AS attendance
    FROM event_instance_expanded ei
    LEFT JOIN (
        SELECT
            ae.event_instance_id,
            json_agg(
                json_build_object(
                    'id', ae.id,
                    'user_id', ae.user_id,
                    'f3_name', ae.f3_name,
                    'q_ind', ae.q_ind,
                    'coq_ind', ae.coq_ind,
                    'avatar_url', ae.avatar_url
                )
            ) AS attendance
        FROM attendance_expanded ae
        GROUP BY ae.event_instance_id
    ) ae_json
      ON ei.id = ae_json.event_instance_id
    WHERE ei.region_org_id = $1
    ORDER BY ei.start_date;
    `,
    [id]
  );
  return rows.length > 0 ? rows as RegionData[] : null;

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
