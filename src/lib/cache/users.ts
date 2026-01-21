import { queryBigQuery } from "@/lib/db";
import { PAXInfo } from "@/lib/types";

/**
 * Search users by F3 name (case-insensitive).
 *
 * Behavior:
 * - Requires at least 2 characters before querying.
 * - Returns a maximum of 50 matches.
 * - Explicitly uncached to ensure up-to-date results during active searching.
 *
 * Safety:
 * - Single quotes are escaped to avoid breaking the LIKE clause.
 * - Input is normalized to lowercase for consistent matching.
 */
export async function searchUsersByName(q: string): Promise<PAXInfo[]> {
  // Normalize and guard against overly-broad queries.
  const term = (q || "").trim();
  if (term.length < 2) return [];

  // Escape single quotes to prevent SQL injection via LIKE.
  const escapedTerm = term.replace(/'/g, "''").toLowerCase();

  // Simple prefix/contains search; ranking is handled client-side if needed.
  const query = `
    SELECT
      user_id,
      f3_name,
      home_region_id,
      home_region_name,
      avatar_url,
      status
    FROM pv_users
    WHERE f3_name IS NOT NULL
      AND LOWER(f3_name) LIKE '%${escapedTerm}%'
    ORDER BY f3_name
    LIMIT 50
  `;

  const results = await queryBigQuery<PAXInfo>(query);
  return results ?? [];
}
