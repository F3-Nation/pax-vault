import { queryBigQuery } from "@/lib/db";
import { EventData, EventDetails } from "@/lib/types";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { DuckDbQueryAdapter, selectDuckDbOrLegacy } from "@/lib/duckdb/query";

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
): Promise<(EventData & { preferencesJson: string | null }) | null> {
  return selectDuckDbOrLegacy({
    capability: "events",
    env: process.env,
    duckdb: async () => {
      const events = await new DuckDbQueryAdapter(
        getDuckDbRuntime(),
      ).execute<EventData>(
        `SELECT
        event_id AS event_instance_id, event_date, event_name, pax_count,
        fng_count, ao_org_id, ao_name, region_org_id, region_name,
        area_org_id, area_name, sector_org_id, sector_name,
        first_f_ind, second_f_ind, third_f_ind, types, tags,
        list_filter(attendance, x -> x.fartsack IS NOT TRUE) AS attendance,
        list_filter(attendance, x -> x.fartsack IS TRUE) AS fartsacks
       FROM pv_events
       WHERE event_id = ?
       LIMIT 1`,
        [eventInstanceId],
      );
      const event = events[0];
      if (!event) return null;

      // Preferences are intentionally still read from BigQuery: they are user
      // settings, not part of the DuckDB release.
      const preferences = await queryBigQuery<{
        preferencesJson: string | null;
      }>(
        `SELECT json_config AS preferencesJson
       FROM pv_regions_preferences
       WHERE region_id = @regionId
       LIMIT 1`,
        userIdentifier,
        `fetch preferences for event ${eventInstanceId}`,
        { regionId: event.region_org_id },
      );
      return {
        ...event,
        preferencesJson: preferences[0]?.preferencesJson ?? null,
      };
    },
    legacy: async () => {
      // Preferences come from a LEFT JOIN, not a scalar subquery: BigQuery rejects
      // a correlated subquery that references another table ("Correlated
      // subqueries that reference other tables are not supported unless they can
      // be de-correlated"). The join keeps it to one round trip, and LEFT means an
      // event whose region never saved preferences still returns its row, with
      // preferencesJson NULL so the caller applies defaults.
      const query = `-- EVENT BY ID
    SELECT
      e.event_id as event_instance_id,
      e.event_date,
      e.event_name,
      e.pax_count,
      e.fng_count,
      e.ao_org_id,
      e.ao_name,
      e.region_org_id,
      e.first_f_ind,
      e.second_f_ind,
      e.third_f_ind,
      e.types,
      e.tags,
      -- Exclude fartsack (signed-up no-show) PAX from the roster/count. See
      -- attendance flags note in pax.ts. 'fartsack IS NOT TRUE' keeps legacy
      -- rows (flag NULL/FALSE) and real attendees, drops only no-shows.
      ARRAY(SELECT a FROM UNNEST(e.attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance,
      -- Display-only roster of the no-shows for the UI chips.
      ARRAY(SELECT a FROM UNNEST(e.attendance) a WHERE a.fartsack IS TRUE) AS fartsacks,
      p.json_config AS preferencesJson
    FROM pv_events e
    LEFT JOIN pv_regions_preferences p
      ON p.region_id = e.region_org_id
    WHERE e.event_id = @eventInstanceId
    LIMIT 1;
  `;

      const results = await queryBigQuery<
        EventData & { preferencesJson: string | null }
      >(query, userIdentifier, `fetch event by id ${eventInstanceId}`, {
        eventInstanceId,
      });

      return results?.[0] || null;
    },
  });
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
    WHERE id = @eventInstanceId
    LIMIT 1
  `;

  const results = await queryBigQuery<EventDetails>(
    query,
    userIdentifier,
    `fetch details for event instance ${eventInstanceId}`,
    { eventInstanceId },
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
