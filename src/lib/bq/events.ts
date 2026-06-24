import { queryBigQuery } from "@/lib/db";
import { EventData, EventDetails } from "@/lib/types";

/**
 * Fetch a single event's core data (name, date, AO/region, types, tags, and
 * attendance) by its event-instance id. This mirrors the column set used by the
 * per-entity event lists so the result has the same shape the events UI already
 * consumes — used by the standalone /stats/events/[id] page, which (unlike the
 * modal) has only the id and must fetch this fresh.
 *
 * Returns null if no matching event exists.
 */
export async function getEventById(
  eventInstanceId: number,
  userIdentifier?: string,
): Promise<EventData | null> {
  const query = `-- EVENT BY ID
    SELECT
      event_id as event_instance_id,
      event_date,
      event_name,
      pax_count,
      fng_count,
      ao_org_id,
      ao_name,
      region_org_id,
      first_f_ind,
      second_f_ind,
      third_f_ind,
      types,
      tags,
      -- Exclude fartsack (signed-up no-show) PAX from the roster/count. See
      -- attendance flags note in pax.ts. 'fartsack IS NOT TRUE' keeps legacy
      -- rows (flag NULL/FALSE) and real attendees, drops only no-shows.
      ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance
    FROM pv_events
    WHERE event_id = ${eventInstanceId}
    LIMIT 1;
  `;

  const results = await queryBigQuery<EventData>(
    query,
    userIdentifier,
    `fetch event by id ${eventInstanceId}`,
  );

  return results?.[0] || null;
}

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
