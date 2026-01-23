import { queryBigQuery } from "@/lib/db";
import {
  AOInfo,
  EventData,
  AOSummary,
  Leaders,
  EventUpcoming,
} from "@/lib/types";

/**
 * Common filter options for AO event-based queries.
 *
 * Notes:
 * - All list filters are treated as numeric-only (non-finite values are dropped).
 * - Modes default to "include".
 * - `categoryIds` is restricted to 1/2/3 which map to first/second/third F flags.
 */
type EventFilterOpts = {
  range?: string;
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
  tagIds?: number[];
  tagMode?: "include" | "exclude";
  typeIds?: number[];
  typeMode?: "include" | "exclude";
  categoryIds?: number[];
  categoryMode?: "include" | "exclude";
};

/**
 * Keep only finite numeric values from a list.
 * This helps prevent accidental SQL injection through non-numeric input.
 */
const cleanNumberList = (vals?: number[]) =>
  (vals || []).filter((v) => Number.isFinite(v)).map((v) => Number(v));

/**
 * Build a BigQuery WHERE clause for pv_events-based queries.
 *
 * Behavior:
 * - Always filters by `ao_org_id`.
 * - Date range filtering uses (start,end) if both provided, else >= start or <= end.
 * - tagIds/typeIds use EXISTS / NOT EXISTS against the nested arrays.
 * - categories maps 1/2/3 to first_f_ind/second_f_ind/third_f_ind and combines with OR.
 */
function buildEventsWhereSql(aoId: number, opts?: EventFilterOpts): string {
  const rangeDates = buildRangeDates(opts?.range);
  const startDate = opts?.startDate ?? rangeDates.startDate;
  const endDate = opts?.endDate ?? rangeDates.endDate;

  const tagMode = opts?.tagMode ?? "include";
  const typeMode = opts?.typeMode ?? "include";
  const categoryMode = opts?.categoryMode ?? "include";

  // Normalize lists.
  const tagList = cleanNumberList(opts?.tagIds);
  const typeList = cleanNumberList(opts?.typeIds);
  const categoryList = cleanNumberList(opts?.categoryIds).filter(
    (c) => c === 1 || c === 2 || c === 3,
  );

  const whereClauses: string[] = [];
  whereClauses.push(`ao_org_id = ${aoId}`);

  // Date filters.
  if (startDate && endDate) {
    whereClauses.push(
      `event_date BETWEEN DATE('${startDate}') AND DATE('${endDate}')`,
    );
  } else if (startDate) {
    whereClauses.push(`event_date >= DATE('${startDate}')`);
  } else if (endDate) {
    whereClauses.push(`event_date <= DATE('${endDate}')`);
  }

  // Tag filters: pv_events.tags is expected to be an array of objects with an `id` field.
  if (tagList.length > 0) {
    const list = tagList.join(",");
    whereClauses.push(
      tagMode === "exclude"
        ? `NOT EXISTS (SELECT 1 FROM UNNEST(tags) t WHERE t.id IN (${list}))`
        : `EXISTS (SELECT 1 FROM UNNEST(tags) t WHERE t.id IN (${list}))`,
    );
  }

  // Type filters: pv_events.types is expected to be an array of objects with an `id` field.
  if (typeList.length > 0) {
    const list = typeList.join(",");
    whereClauses.push(
      typeMode === "exclude"
        ? `NOT EXISTS (SELECT 1 FROM UNNEST(types) ty WHERE ty.id IN (${list}))`
        : `EXISTS (SELECT 1 FROM UNNEST(types) ty WHERE ty.id IN (${list}))`,
    );
  }

  // Category filters: 1 => first_f_ind, 2 => second_f_ind, 3 => third_f_ind.
  if (categoryList.length > 0) {
    const parts: string[] = [];
    if (categoryList.includes(1)) parts.push(`first_f_ind = 1`);
    if (categoryList.includes(2)) parts.push(`second_f_ind = 1`);
    if (categoryList.includes(3)) parts.push(`third_f_ind = 1`);

    if (parts.length > 0) {
      const expr = parts.map((p) => `(${p})`).join(" OR ");
      whereClauses.push(
        categoryMode === "exclude" ? `NOT (${expr})` : `(${expr})`,
      );
    }
  }

  return whereClauses.length
    ? `WHERE ${whereClauses.join("\n      AND ")}`
    : "";
}

/**
 * Convert a named range (e.g., "This Week") into UTC `YYYY-MM-DD` start/end strings.
 *
 * Weeks are normalized to start on Monday.
 */
function buildRangeDates(range: string | undefined): {
  startDate?: string;
  endDate?: string;
} {
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // Normalize to week starting Monday
  const dayOfWeek = todayUTC.getUTCDay(); // 0 = Sunday, 1 = Monday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayThisWeek = new Date(
    todayUTC.getTime() + mondayOffset * 24 * 60 * 60 * 1000,
  );

  let start: Date | undefined;
  let end: Date | undefined;

  switch (range) {
    case "YTD":
      start = new Date(Date.UTC(todayUTC.getUTCFullYear(), 0, 1));
      break;
    case "This Week":
      start = mondayThisWeek;
      break;
    case "Last Week":
      start = new Date(mondayThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = new Date(mondayThisWeek.getTime() - 1 * 24 * 60 * 60 * 1000);
      break;
    case "This Month":
      start = new Date(
        Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1),
      );
      break;
    case "Last Month":
      start = new Date(
        Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1),
      );
      end = new Date(
        Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 0),
      );
      break;
    case "Last 90 Days":
      start = new Date(todayUTC.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "Last 180 Days":
      start = new Date(todayUTC.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case "Prior Year":
      start = new Date(Date.UTC(todayUTC.getUTCFullYear() - 1, 0, 1));
      end = new Date(Date.UTC(todayUTC.getUTCFullYear() - 1, 11, 31));
      break;
    default:
      break;
  }

  const startDate = start?.toISOString().split("T")[0];
  const endDate = end?.toISOString().split("T")[0];
  return { startDate, endDate };
}

/**
 * Fetch a single region's metadata.
 */
export async function getAOInfo(aoId: number): Promise<AOInfo | null> {
  const query = `
    SELECT
      ao_id,
      ao_name,
      region_id,
      region_name,
      logo_url,
      is_active,
      types,
      tags
    FROM pv_aos
    WHERE ao_id = ${aoId}
    LIMIT 1
  `;

  const results = await queryBigQuery<AOInfo>(query);
  return results?.[0] || null;
}

/**
 * Fetch events for a AO with optional filtering.
 */
export async function getEvents(
  aoId: number,
  opts?: EventFilterOpts & {
    limit?: number;
  },
): Promise<EventData[] | null> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(aoId, opts);

  // LIMIT is optional. Keep it numeric-only.
  const limit = Number.isFinite(opts?.limit) ? Number(opts!.limit) : undefined;
  const limitSql = limit ? `LIMIT ${limit}` : "";

  const query = `
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
      attendance
    FROM pv_events
    ${whereSql}
    ORDER BY event_date DESC, event_id DESC
    ${limitSql};
  `;

  const results = await queryBigQuery<EventData>(query);
  return results || null;
}

/**
 * Compute summary metrics for a region across the selected event set.
 */
export async function getSummary(
  aoId: number,
  opts?: EventFilterOpts,
): Promise<AOSummary | null> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(aoId, opts);

  const query = `
    WITH events AS (
      SELECT
        event_id,
        event_date,
        pax_count,
        fng_count,
        ao_org_id,
        first_f_ind,
        second_f_ind,
        third_f_ind,
        attendance,
        tags,
        types
      FROM pv_events
      ${whereSql}
    ),

    event_metrics AS (
      SELECT
        COUNT(DISTINCT event_id) AS event_count,
        SUM(COALESCE(fng_count, 0)) AS fng_count,
        AVG(CAST(pax_count AS FLOAT64)) AS pax_count_average
      FROM events
    ),

    attendance_flat AS (
      SELECT
        e.event_date,
        a.user_id,
        a.q_ind
      FROM events e
      LEFT JOIN UNNEST(e.attendance) AS a
    ),

    attendance_metrics AS (
      SELECT
        COUNT(DISTINCT IF(event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), user_id, NULL)) AS active_pax,
        COUNT(DISTINCT user_id) AS unique_pax,
        COUNT(DISTINCT IF(q_ind = 1, user_id, NULL)) AS unique_qs
      FROM attendance_flat
    )

    SELECT
      em.event_count,
      am.active_pax,
      am.unique_pax,
      am.unique_qs,
      em.fng_count,
      em.pax_count_average
    FROM event_metrics em
    CROSS JOIN attendance_metrics am;
  `;

  const results = await queryBigQuery<AOSummary>(query);

  return results?.[0] || null;
}

/**
 * Compute per-user leaderboards (posts/qs) from attendance for the selected event set.
 */
export async function getLeaders(
  aoId: number,
  opts?: EventFilterOpts,
): Promise<Leaders[] | null> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(aoId, opts);
  const query = `
    WITH events AS (
      SELECT
        event_id,
        event_date,
        ao_org_id,
        first_f_ind,
        second_f_ind,
        third_f_ind,
        tags,
        types,
        attendance
      FROM pv_events
      ${whereSql}
    ),

    attendance_flat AS (
      SELECT
        e.event_id,
        a.user_id,
        a.f3_name,
        a.q_ind,
        a.avatar_url
      FROM events e
      LEFT JOIN UNNEST(e.attendance) AS a
      WHERE a.user_id IS NOT NULL
    )

    SELECT
      user_id,
      ANY_VALUE(f3_name) AS f3_name,
      COUNT(DISTINCT event_id) AS posts,
      COUNTIF(q_ind = 1) AS qs,
      ANY_VALUE(avatar_url) AS avatar_url
    FROM attendance_flat
    GROUP BY user_id
    ORDER BY posts DESC, qs DESC, f3_name;
  `;

  const results = await queryBigQuery<Leaders>(query);
  return results || null;
}

/**
 * Fetch the next ~50 upcoming events for a region.
 */
export async function getUpcomingEvents(
  aoId: number,
): Promise<EventUpcoming[] | null> {
  const query = `
    SELECT
      start_date,
      start_time,
      ao_name,
      ao_org_id,
      location_name,
      event_name,
      event_type,
      event_category,
      q_list
    FROM pv_upcoming
    WHERE ao_org_id = ${aoId}
    ORDER BY start_date ASC, start_time ASC, ao_name ASC
    LIMIT 50;
  `;

  const results = await queryBigQuery<EventUpcoming>(query);

  return results || null;
}
