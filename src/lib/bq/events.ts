import { queryBigQuery } from "@/lib/db";
import { EventDetails } from "@/lib/types";

/**
 * Fetch detailed content for a single event instance.
 *
 * Notes:
 * - `meta` is stored as JSON in BigQuery and parsed into an object here.
 * - Returns null if the event does not exist.
 */
export async function getEventDetails(
  eventInstanceId: number,
  userIdentifier?: string,
): Promise<EventDetails | null> {
  // Intentionally selecting rich + plain text variants; consumers decide which to render.
  const query = `-- EVENT DETAILS
    SELECT
      id, 
      description, 
      preblast, 
      preblast_rich, 
      backblast, 
      backblast_rich, 
      JSON_QUERY(meta, '$') as meta
    FROM f3data.public.event_instances
    WHERE id = ${eventInstanceId}
    LIMIT 1
  `;

  const results = await queryBigQuery<EventDetails>(
    query,
    userIdentifier,
    `fetch details for event instance ${eventInstanceId}`,
  );

  // Parse JSON meta safely if present.
  if (results?.[0]?.meta) {
    try {
      results[0].meta = JSON.parse(results[0].meta as unknown as string);
    } catch {
      // If parsing fails, leave meta as-is rather than throwing.
    }
  }

  return results?.[0] || null;
}
