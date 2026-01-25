import { queryBigQuery } from "@/lib/db";
import { EventData, PaxSummary, PAXInfo, PaxAOBreakdown } from "@/lib/types";

/**
 * Common filter options for PAX event-based queries.
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
  aoIds?: number[];
  aoMode?: "include" | "exclude";
  regionIds?: number[];
  regionMode?: "include" | "exclude";
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
 * - Always filters by `region_org_id`.
 * - Date range filtering uses (start,end) if both provided, else >= start or <= end.
 * - regionIds uses IN / NOT IN.
 * - tagIds/typeIds use EXISTS / NOT EXISTS against the nested arrays.
 * - categories maps 1/2/3 to first_f_ind/second_f_ind/third_f_ind and combines with OR.
 */
function buildEventsWhereSql(paxId: number, opts?: EventFilterOpts): string {
  const rangeDates = buildRangeDates(opts?.range);
  const startDate = opts?.startDate ?? rangeDates.startDate;
  const endDate = opts?.endDate ?? rangeDates.endDate;

  const regionMode = opts?.regionMode ?? "include";
  const aoMode = opts?.aoMode ?? "include";
  const tagMode = opts?.tagMode ?? "include";
  const typeMode = opts?.typeMode ?? "include";
  const categoryMode = opts?.categoryMode ?? "include";

  // Normalize lists.
  const regionList = cleanNumberList(opts?.regionIds);
  const aoList = cleanNumberList(opts?.aoIds);
  const tagList = cleanNumberList(opts?.tagIds);
  const typeList = cleanNumberList(opts?.typeIds);
  const categoryList = cleanNumberList(opts?.categoryIds).filter(
    (c) => c === 1 || c === 2 || c === 3,
  );

  const whereClauses: string[] = [];
  // Attendance filter: only include events where the given PAX appears in the attendance array for that event.
  whereClauses.push(
    `EXISTS (
      SELECT 1
      FROM UNNEST(attendance) a
      WHERE a.user_id = ${paxId}
    )`,
  );

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

  // AO filters.
  if (aoList.length > 0) {
    const list = aoList.join(",");
    whereClauses.push(
      aoMode === "exclude"
        ? `ao_org_id NOT IN (${list})`
        : `ao_org_id IN (${list})`,
    );
  }

  // Region filters.
  if (regionList.length > 0) {
    const list = regionList.join(",");
    whereClauses.push(
      regionMode === "exclude"
        ? `region_org_id NOT IN (${list})`
        : `region_org_id IN (${list})`,
    );
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
 * Fetch a single PAX's metadata.
 */
export async function getPAXInfo(paxId: number): Promise<PAXInfo | null> {
  const query = `-- PAX INFO
    SELECT
      user_id,
      f3_name,
      home_region_id,
      home_region_name,
      avatar_url,
      status,
      aos,
      regions,
      types,
      tags
    FROM pv_pax
    WHERE user_id = ${paxId}
    LIMIT 1
  `;

  const results = await queryBigQuery<PAXInfo>(query);

  return results?.[0] || null;
}

/**
 * Fetch events for a PAX with optional filtering.
 */
export async function getEvents(
  paxId: number,
  opts?: EventFilterOpts & {
    limit?: number;
  },
): Promise<EventData[] | null> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(paxId, opts);

  // LIMIT is optional. Keep it numeric-only.
  const limit = Number.isFinite(opts?.limit) ? Number(opts!.limit) : undefined;
  const limitSql = limit ? `LIMIT ${limit}` : "";

  const query = `-- PAX EVENTS
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
 * Compute summary metrics for a PAX across the selected event set.
 */
export async function getSummary(
  paxId: number,
  opts?: EventFilterOpts,
): Promise<PaxSummary | null> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(paxId, opts);
  const query = `-- PAX SUMMARY
    WITH events AS (
      SELECT
        event_id,
        event_date,
        ao_org_id,
        ao_name,
        first_f_ind,
        second_f_ind,
        third_f_ind,
        attendance,
        tags,
        types
      FROM pv_events
      ${whereSql}
    ),

    attendance_flat AS (
        SELECT
            e.event_id,
            e.event_date,
            e.ao_org_id,
            e.ao_name,
            a.user_id,
            a.f3_name,
            a.q_ind
        FROM events e
        JOIN UNNEST(e.attendance) a
        ),

        self_attendance AS (
        SELECT *
        FROM attendance_flat
        WHERE user_id = ${paxId}
        ),

        q_events AS (
        SELECT *
        FROM self_attendance
        WHERE q_ind = 1
        ),

        event_bounds AS (
        SELECT
            MIN(event_date) AS first_event_date,
            MAX(event_date) AS last_event_date
        FROM self_attendance
        ),

        event_bounds_ao AS (
        SELECT
            FIRST_VALUE(ao_org_id) OVER w AS first_event_ao_id,
            FIRST_VALUE(ao_name) OVER w AS first_event_ao_name,
            LAST_VALUE(ao_org_id) OVER w AS last_event_ao_id,
            LAST_VALUE(ao_name) OVER w AS last_event_ao_name
        FROM self_attendance
        WINDOW w AS (
            ORDER BY event_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        )
        LIMIT 1
        ),

        q_bounds AS (
        SELECT
            MIN(event_date) AS first_q_date,
            MAX(event_date) AS last_q_date
        FROM q_events
        ),

        q_bounds_ao AS (
        SELECT
            FIRST_VALUE(ao_org_id) OVER w AS first_q_ao_id,
            FIRST_VALUE(ao_name) OVER w AS first_q_ao_name,
            LAST_VALUE(ao_org_id) OVER w AS last_q_ao_id,
            LAST_VALUE(ao_name) OVER w AS last_q_ao_name
        FROM q_events
        WINDOW w AS (
            ORDER BY event_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        )
        LIMIT 1
        ),

        co_attendance AS (
        SELECT
            a.user_id,
            a.f3_name,
            COUNT(*) AS met_count
        FROM attendance_flat a
        JOIN self_attendance s
            ON a.event_id = s.event_id
        WHERE a.user_id != ${paxId}
        GROUP BY a.user_id, a.f3_name
        ),

        bestie AS (
        SELECT
            user_id AS bestie_user_id,
            f3_name AS bestie_f3_name,
            met_count AS bestie_user_count
        FROM co_attendance
        ORDER BY met_count DESC
        LIMIT 1
        ),

        unique_users AS (
        SELECT COUNT(DISTINCT user_id) AS unique_users_met
        FROM co_attendance
        ),

        unique_q_users AS (
        SELECT COUNT(DISTINCT a.user_id) AS unique_pax_when_q
        FROM attendance_flat a
        JOIN q_events q
            ON a.event_id = q.event_id
        WHERE a.user_id != ${paxId}
        ),

        metrics AS (
        SELECT
            COUNT(*) AS event_count,
            SUM(CASE WHEN q_ind = 1 THEN 1 ELSE 0 END) AS q_count
        FROM self_attendance
        )

        SELECT
        m.event_count,
        m.q_count,
        eb.first_event_date,
        ebao.first_event_ao_id,
        ebao.first_event_ao_name,
        eb.last_event_date,
        ebao.last_event_ao_id,
        ebao.last_event_ao_name,
        b.bestie_user_id,
        b.bestie_f3_name,
        b.bestie_user_count,
        u.unique_users_met,
        uq.unique_pax_when_q,
        qb.first_q_date,
        qbao.first_q_ao_id,
        qbao.first_q_ao_name,
        qb.last_q_date,
        qbao.last_q_ao_id,
        qbao.last_q_ao_name,
        SAFE_DIVIDE(
            m.event_count,
            DATE_DIFF(COALESCE(CURRENT_DATE(), eb.last_event_date), eb.first_event_date, DAY)
        ) * 100 AS effective_percentage

        FROM metrics m
        CROSS JOIN event_bounds eb
        CROSS JOIN event_bounds_ao ebao
        CROSS JOIN q_bounds qb
        LEFT JOIN q_bounds_ao qbao ON TRUE
        LEFT JOIN bestie b ON TRUE
        LEFT JOIN unique_users u ON TRUE
        LEFT JOIN unique_q_users uq ON TRUE;
  `;

  const results = await queryBigQuery<PaxSummary>(query);

  return results?.[0] || null;
}

/**
 * Fetch a list of AO-level breakdown counts for a given PAX.
 *
 * Respects the common event filters (date ranges, AO/region include/exclude,
 * tags, types, categories) via `buildEventsWhereSql`.
 */
export async function getAOBreakdown(
  paxId: number,
  opts?: EventFilterOpts,
): Promise<PaxAOBreakdown[] | null> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(paxId, opts);

  const query = `-- PAX AO BREAKDOWN
    WITH events AS (
      SELECT
        event_id,
        ao_org_id,
        ao_name,
        region_org_id,
        region_name,
        attendance
      FROM pv_events
      ${whereSql}
    ),

    ao_events AS (
      SELECT
        event_id,
        COALESCE(ao_org_id, 0) AS ao_org_id,
        COALESCE(ANY_VALUE(ao_name), 'Unknown AO') AS ao_name,
        ANY_VALUE(region_org_id) AS region_org_id,
        ANY_VALUE(region_name) AS region_name,
        -- Did this pax Q this event?
        IF(
          EXISTS (
            SELECT 1
            FROM UNNEST(attendance) a
            WHERE a.user_id = ${paxId}
              AND a.q_ind = 1
          ),
          1,
          0
        ) AS is_q
      FROM events
      GROUP BY event_id, ao_org_id, attendance
    )

    SELECT
      ao_org_id,
      ao_name,
      region_org_id,
      region_name,
      COUNT(*) AS total_events,
      SUM(is_q) AS total_q_count
    FROM ao_events
    GROUP BY ao_org_id, ao_name, region_org_id, region_name
    ORDER BY total_events DESC, ao_name;
  `;

  const results = await queryBigQuery<PaxAOBreakdown>(query);
  return results || null;
}

export async function searchUsersByName(q: string): Promise<PAXInfo[]> {
  // Normalize and guard against overly-broad queries.
  const term = (q || "").trim();
  if (term.length < 2) return [];

  // Escape single quotes to prevent SQL injection via LIKE.
  const escapedTerm = term.replace(/'/g, "''").toLowerCase();

  // Simple prefix/contains search; ranking is handled client-side if needed.
  const query = `-- PAX SEARCH
    SELECT
      user_id,
      f3_name,
      home_region_id,
      home_region_name,
      avatar_url,
      status
    FROM pv_pax
    WHERE f3_name IS NOT NULL
      AND LOWER(f3_name) LIKE '%${escapedTerm}%'
    ORDER BY f3_name
    LIMIT 50
  `;

  const results = await queryBigQuery<PAXInfo>(query);
  return results ?? [];
}
