// src/lib/data/region.ts
import { RegionDetails } from "@/types/region";
import { queryBigQuery } from "../db";

export async function getRegionList(): Promise<RegionDetails[]> {
  const query = `
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

  const results = await queryBigQuery<RegionDetails>(query);

  return results;
}
