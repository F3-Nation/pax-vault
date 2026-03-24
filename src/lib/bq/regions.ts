import { queryBigQuery } from "@/lib/db";
import {
  RegionInfo,
  EventData,
  RegionSummary,
  Leaders,
  EventUpcoming,
  RegionKotterList,
  ChartData,
} from "@/lib/types";

/**
 * Common filter options for region event-based queries.
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
 * - aoIds uses IN / NOT IN.
 * - tagIds/typeIds use EXISTS / NOT EXISTS against the nested arrays.
 * - categories maps 1/2/3 to first_f_ind/second_f_ind/third_f_ind and combines with OR.
 */
function buildEventsFilterClauses(
  opts?: EventFilterOpts,
  alias?: string,
): string[] {
  const rangeDates = buildRangeDates(opts?.range);
  const startDate = opts?.startDate ?? rangeDates.startDate;
  const endDate = opts?.endDate ?? rangeDates.endDate;

  const aoMode = opts?.aoMode ?? "include";
  const tagMode = opts?.tagMode ?? "include";
  const typeMode = opts?.typeMode ?? "include";
  const categoryMode = opts?.categoryMode ?? "include";

  // Normalize lists.
  const aoList = cleanNumberList(opts?.aoIds);
  const tagList = cleanNumberList(opts?.tagIds);
  const typeList = cleanNumberList(opts?.typeIds);
  const categoryList = cleanNumberList(opts?.categoryIds).filter(
    (c) => c === 1 || c === 2 || c === 3,
  );

  const col = (name: string) => (alias ? `${alias}.${name}` : name);

  const clauses: string[] = [];

  // Date filters.
  if (startDate && endDate) {
    clauses.push(
      `${col("event_date")} BETWEEN DATE('${startDate}') AND DATE('${endDate}')`,
    );
  } else if (startDate) {
    clauses.push(`${col("event_date")} >= DATE('${startDate}')`);
  } else if (endDate) {
    clauses.push(`${col("event_date")} <= DATE('${endDate}')`);
  }

  // AO filters.
  // Special case: `0` is treated as a sentinel for "no AO" (NULL ao_org_id).
  if (aoList.length > 0) {
    const hasNullSentinel = aoList.includes(0);
    const aoListNoZero = aoList.filter((id) => id !== 0);
    const list = aoListNoZero.join(",");

    if (hasNullSentinel) {
      // INCLUDE mode: include selected AOs plus NULL.
      // EXCLUDE mode: exclude selected AOs and also exclude NULL.
      if (aoMode === "exclude") {
        if (aoListNoZero.length > 0) {
          clauses.push(
            `${col("ao_org_id")} IS NOT NULL AND ${col("ao_org_id")} NOT IN (${list})`,
          );
        } else {
          // Only 0 was provided => exclude NULLs.
          clauses.push(`${col("ao_org_id")} IS NOT NULL`);
        }
      } else {
        if (aoListNoZero.length > 0) {
          clauses.push(
            `(${col("ao_org_id")} IS NULL OR ${col("ao_org_id")} IN (${list}))`,
          );
        } else {
          // Only 0 was provided => only NULLs.
          clauses.push(`${col("ao_org_id")} IS NULL`);
        }
      }
    } else {
      // Normal case: no NULL sentinel.
      if (aoListNoZero.length > 0) {
        clauses.push(
          aoMode === "exclude"
            ? `${col("ao_org_id")} NOT IN (${list})`
            : `${col("ao_org_id")} IN (${list})`,
        );
      }
    }
  }

  // Tag filters: pv_events.tags is expected to be an array of objects with an `id` field.
  if (tagList.length > 0) {
    const list = tagList.join(",");
    clauses.push(
      tagMode === "exclude"
        ? `NOT EXISTS (SELECT 1 FROM UNNEST(${col("tags")}) t WHERE t.id IN (${list}))`
        : `EXISTS (SELECT 1 FROM UNNEST(${col("tags")}) t WHERE t.id IN (${list}))`,
    );
  }

  // Type filters: pv_events.types is expected to be an array of objects with an `id` field.
  if (typeList.length > 0) {
    const list = typeList.join(",");
    clauses.push(
      typeMode === "exclude"
        ? `NOT EXISTS (SELECT 1 FROM UNNEST(${col("types")}) ty WHERE ty.id IN (${list}))`
        : `EXISTS (SELECT 1 FROM UNNEST(${col("types")}) ty WHERE ty.id IN (${list}))`,
    );
  }

  // Category filters: 1 => first_f_ind, 2 => second_f_ind, 3 => third_f_ind.
  if (categoryList.length > 0) {
    const parts: string[] = [];
    if (categoryList.includes(1)) parts.push(`${col("first_f_ind")} = 1`);
    if (categoryList.includes(2)) parts.push(`${col("second_f_ind")} = 1`);
    if (categoryList.includes(3)) parts.push(`${col("third_f_ind")} = 1`);

    if (parts.length > 0) {
      const expr = parts.map((p) => `(${p})`).join(" OR ");
      clauses.push(categoryMode === "exclude" ? `NOT (${expr})` : `(${expr})`);
    }
  }

  return clauses;
}

function buildEventsWhereSql(
  regionId: number,
  opts?: EventFilterOpts,
  alias?: string,
): string {
  const whereClauses: string[] = [];
  const col = (name: string) => (alias ? `${alias}.${name}` : name);

  whereClauses.push(`${col("region_org_id")} = ${regionId}`);
  whereClauses.push(...buildEventsFilterClauses(opts, alias));

  return whereClauses.length
    ? `WHERE ${whereClauses.join("\n      AND ")}`
    : "";
}

// Convenience for appending filters to an existing WHERE clause (no region filter).
function buildEventsAndSql(opts?: EventFilterOpts, alias?: string): string {
  const clauses = buildEventsFilterClauses(opts, alias);
  return clauses.length
    ? `\n        AND ${clauses.join("\n        AND ")}`
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
 * Fetch events for a region with optional filtering.
 */
export async function getEvents(
  regionId: number,
  userIdentifier?: string,
  opts?: EventFilterOpts & {
    limit?: number;
  },
): Promise<EventData[] | null> {
  // LIMIT is optional. Keep it numeric-only.
  const limit = Number.isFinite(opts?.limit) ? Number(opts!.limit) : undefined;
  const limitSql = limit ? `LIMIT ${limit}` : "";

  const whereSql = buildEventsWhereSql(regionId, opts);

  const query = `-- REGION EVENTS
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

  const results = await queryBigQuery<EventData>(
    query,
    userIdentifier,
    `fetch events for region ${regionId}`,
  );
  return results || null;
}

export async function searchRegionsByName(
  q: string,
  userIdentifier?: string,
): Promise<RegionInfo[]> {
  // Normalize and guard against overly-broad queries.
  const term = (q || "").trim();
  if (term.length < 2) return [];

  // Escape single quotes to prevent SQL injection via LIKE.
  const escapedTerm = term.replace(/'/g, "''").toLowerCase();

  // Simple contains search; ordering is alphabetical for predictability.
  const query = `-- REGION SEARCH
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

  const results = await queryBigQuery<RegionInfo>(
    query,
    userIdentifier,
    `search regions by name: ${q}`,
  );
  return results ?? [];
}

export async function getPageData(
  regionId: number,
  userIdentifier?: string,
  opts?: EventFilterOpts,
): Promise<{
  info: RegionInfo | null;
  events: EventData[] | null;
  summary: RegionSummary | null;
  leaders: Leaders[] | null;
  upcoming: EventUpcoming[] | null;
  kotter: RegionKotterList[] | null;
  charts:
    | {
        date: string;
        pax_count: number;
        fng_count: number;
        q_count: number;
        unique_pax_count: number;
        unique_q_count: number;
      }[]
    | null;
}> {
  // Build WHERE clause from common filters (region-scoped).
  const whereSql = buildEventsWhereSql(regionId, opts);
  // Build non-region filters for re-use against aliased pv_events scans.
  const eventsFilterAndSql = buildEventsAndSql(opts, "e");

  // Determine chart granularity based on date range.
  const rangeDates = buildRangeDates(opts?.range);
  const effectiveStart = opts?.startDate ?? rangeDates.startDate;
  const effectiveEnd =
    opts?.endDate ??
    rangeDates.endDate ??
    new Date().toISOString().split("T")[0];
  const daysDiff = effectiveStart
    ? (new Date(effectiveEnd).getTime() - new Date(effectiveStart).getTime()) /
      86_400_000
    : Infinity;
  const chartGranularity =
    daysDiff > 365 ? "monthly" : daysDiff > 180 ? "weekly" : "daily";
  const truncUnit =
    chartGranularity === "monthly"
      ? "MONTH"
      : chartGranularity === "weekly"
        ? "WEEK(MONDAY)"
        : "DAY";
  const spineInterval =
    chartGranularity === "monthly"
      ? "INTERVAL 1 MONTH"
      : chartGranularity === "weekly"
        ? "INTERVAL 1 WEEK"
        : "INTERVAL 1 DAY";

  const query = `-- REGION PAGE LOAD
    WITH
      events AS (
        SELECT
          event_id,
          event_date,
          event_name,
          pax_count,
          fng_count,
          ao_org_id,
          ao_name,
          region_org_id,
          region_name,
          first_f_ind,
          second_f_ind,
          third_f_ind,
          types,
          tags,
          attendance
        FROM pv_events
        ${whereSql}
      ),
      attendance_flat AS (
        SELECT
          e.event_id,
          e.event_date,
          a.user_id,
          a.f3_name,
          a.q_ind,
          a.coq_ind,
          a.avatar_url
        FROM events e
        LEFT JOIN UNNEST(e.attendance) a
        WHERE a.user_id IS NOT NULL
      ),

      -- Leaders in-region (also used as the "who to include" list)
      leaders_region_dim AS (
        SELECT
          user_id,
          ANY_VALUE(f3_name) AS f3_name,
          ANY_VALUE(avatar_url) AS avatar_url
        FROM attendance_flat
        GROUP BY user_id
      ),
      leader_ids AS (
        SELECT user_id FROM leaders_region_dim
      ),

      -- Single pass over pv_events for ONLY those users; compute region + all in one rollup
      leaders_rollup AS (
        SELECT
          a.user_id,

          -- Region-scoped (distinct events)
          COUNT(DISTINCT IF(e.region_org_id = ${regionId}, e.event_id, NULL)) AS posts,
          COUNT(
            DISTINCT IF(e.region_org_id = ${regionId} AND a.q_ind = 1, e.event_id, NULL))
            AS qs,

          -- All-regions (distinct events)
          COUNT(DISTINCT e.event_id) AS all_posts,
          COUNT(DISTINCT IF(a.q_ind = 1, e.event_id, NULL)) AS all_qs
        FROM pv_events e
        JOIN UNNEST(e.attendance) a
        JOIN leader_ids li
          ON li.user_id = a.user_id
        WHERE a.user_id IS NOT NULL${eventsFilterAndSql}
        GROUP BY a.user_id
      )
    SELECT
      -- Region info as a STRUCT
      (
        SELECT AS STRUCT
          region_id, region_name, sector_name, logo_url, is_active, aos, types, tags
        FROM pv_regions
        WHERE region_id = ${regionId}
        LIMIT 1
      ) AS regionInfo,

      -- Events list as an ARRAY (limit it)
      (
        SELECT
          ARRAY_AGG(
            STRUCT(
              event_id AS event_instance_id,
              event_date,
              event_name,
              pax_count,
              fng_count,
              ao_org_id,
              ao_name,
              region_org_id,
              region_name,
              first_f_ind,
              second_f_ind,
              third_f_ind,
              types,
              tags,
              attendance
              -- omit attendance unless the UI truly needs it here
            )
            ORDER BY event_date DESC, event_id DESC
            LIMIT 100)
        FROM events
      ) AS events,

      -- Summary as a STRUCT
      (
        WITH
          event_metrics AS (
            SELECT
              COUNT(DISTINCT event_id) AS event_count,
              COUNT(DISTINCT ao_org_id) AS ao_count,
              SUM(COALESCE(fng_count, 0)) AS fng_count,
              AVG(CAST(pax_count AS FLOAT64)) AS pax_count_average
            FROM events
          ),
          attendance_metrics AS (
            SELECT
              COUNT(
                DISTINCT
                  IF(
                    event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY),
                    user_id,
                    NULL)) AS active_pax,
              COUNT(DISTINCT user_id) AS unique_pax,
              COUNT(DISTINCT IF(q_ind = 1, user_id, NULL)) AS unique_qs
            FROM attendance_flat
          )
        SELECT AS STRUCT
          em.event_count,
          em.ao_count,
          am.active_pax,
          am.unique_pax,
          am.unique_qs,
          em.fng_count,
          em.pax_count_average
        FROM event_metrics em
        CROSS JOIN attendance_metrics am
      ) AS summary,

      -- Leaders as an ARRAY (region + all-regions, Q-safe)
      (
        SELECT
          ARRAY_AGG(
            STRUCT(
              d.user_id,
              d.f3_name,
              r.posts,
              r.qs,
              r.all_posts,
              r.all_qs,
              d.avatar_url)
            ORDER BY r.posts DESC, r.qs DESC
            LIMIT 100)
        FROM leaders_region_dim d
        JOIN leaders_rollup r
          USING (user_id)
      ) AS leaders,

      -- Upcoming as an ARRAY
      (
        SELECT
          ARRAY_AGG(
            STRUCT(
              start_date,
              start_time,
              ao_name,
              ao_org_id,
              location_name,
              event_name,
              event_type,
              event_category,
              q_list)
            ORDER BY start_date ASC, start_time ASC, ao_name ASC
            LIMIT 50)
        FROM pv_upcoming
        WHERE region_org_id = ${regionId}
      ) AS upcoming,

      -- Kotters as an ARRAY
      (
        SELECT
          ARRAY_AGG(
            STRUCT(
              user_id,
              f3_name,
              avatar_url,
              kotter_status,
              total_events,
              first_event_date,
              days_since_last_event,
              last_event_date,
              last_event_name,
              last_event_ao_name,
              last_event_ao_org_id,
              bestie_list)
            ORDER BY days_since_last_event ASC, last_event_date ASC, f3_name ASC)
        FROM pv_kotter
        WHERE home_region_id = ${regionId}
      ) AS kotter,

      -- Charting: ${chartGranularity} aggregation with gap-filling
      (
        WITH
          period_event_agg AS (
            SELECT
              DATE_TRUNC(event_date, ${truncUnit}) AS period,
              SUM(pax_count) AS pax_count,
              SUM(fng_count) AS fng_count,
              SUM((SELECT COUNTIF(a.q_ind = 1) FROM UNNEST(attendance) a)) AS q_count
            FROM events
            GROUP BY period
          ),
          period_attendance_agg AS (
            SELECT
              DATE_TRUNC(event_date, ${truncUnit}) AS period,
              COUNT(DISTINCT user_id) AS unique_pax_count,
              COUNT(DISTINCT IF(q_ind = 1, user_id, NULL)) AS unique_q_count
            FROM attendance_flat
            GROUP BY period
          ),
          period_agg AS (
            SELECT
              ea.period,
              ea.pax_count,
              ea.fng_count,
              ea.q_count,
              COALESCE(aa.unique_pax_count, 0) AS unique_pax_count,
              COALESCE(aa.unique_q_count, 0) AS unique_q_count
            FROM period_event_agg ea
            LEFT JOIN period_attendance_agg aa USING (period)
          ),
          date_spine AS (
            SELECT d AS date
            FROM UNNEST(
              GENERATE_DATE_ARRAY(
                (SELECT MIN(period) FROM period_agg),
                (SELECT MAX(period) FROM period_agg),
                ${spineInterval}
              )
            ) AS d
          )
        SELECT
          ARRAY_AGG(
            STRUCT(
              ds.date AS date,
              COALESCE(pa.pax_count, 0) AS pax_count,
              COALESCE(pa.fng_count, 0) AS fng_count,
              COALESCE(pa.q_count, 0) AS q_count,
              COALESCE(pa.unique_pax_count, 0) AS unique_pax_count,
              COALESCE(pa.unique_q_count, 0) AS unique_q_count
            )
            ORDER BY ds.date ASC
          )
        FROM date_spine ds
        LEFT JOIN period_agg pa ON pa.period = ds.date
      ) AS charts;
    `;

  const results = await queryBigQuery<{
    regionInfo: RegionInfo;
    events: EventData[];
    summary: RegionSummary;
    leaders: Leaders[];
    upcoming: EventUpcoming[];
    kotter: RegionKotterList[];
    charts: ChartData[];
  }>(query, userIdentifier, `fetch region data for region ${regionId}`);

  return {
    info: results?.[0]?.regionInfo || null,
    events: results?.[0]?.events || null,
    summary: results?.[0]?.summary || null,
    leaders: results?.[0]?.leaders || null,
    upcoming: results?.[0]?.upcoming || null,
    kotter: results?.[0]?.kotter || null,
    charts: results?.[0]?.charts || null,
  };
}
