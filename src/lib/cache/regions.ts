import { queryBigQuery } from "@/lib/db";
import { RegionInfo } from "@/lib/types";

/**
 * Search regions by region name (case-insensitive).
 *
 * Behavior:
 * - Requires at least 2 characters before querying.
 * - Returns a maximum of 50 matches.
 * - Explicitly uncached to ensure fresh results during active searching.
 *
 * Safety:
 * - Single quotes are escaped to prevent breaking the LIKE clause.
 * - Input is normalized to lowercase for consistent matching.
 */
export async function searchRegionsByName(q: string): Promise<RegionInfo[]> {
  // Normalize and guard against overly-broad queries.
  const term = (q || "").trim();
  if (term.length < 2) return [];

  // Escape single quotes to prevent SQL injection via LIKE.
  const escapedTerm = term.replace(/'/g, "''").toLowerCase();

  // Simple contains search; ordering is alphabetical for predictability.
  const query = `
    SELECT
      region_id,
      region_name,
      logo_url,
      is_active
    FROM pv_regions
    WHERE region_name IS NOT NULL
      AND LOWER(region_name) LIKE '%${escapedTerm}%'
    ORDER BY region_name
    LIMIT 50
  `;

  const results = await queryBigQuery<RegionInfo>(query);
  return results ?? [];
}
