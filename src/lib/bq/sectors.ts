import { queryBigQuery } from "@/lib/db";
import {
  SectorInfo,
  SectorSummary,
  SectorAreaBreakdown,
  ChartData,
} from "@/lib/types";
import { DateRangeFilters } from "@/lib/filters";

/**
 * Convert a named range into UTC YYYY-MM-DD start/end strings.
 */
function buildRangeDates(range: string | undefined): {
  startDate?: string;
  endDate?: string;
} {
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayOfWeek = todayUTC.getUTCDay();
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

  return {
    startDate: start?.toISOString().split("T")[0],
    endDate: end?.toISOString().split("T")[0],
  };
}

function buildDateFilterClauses(opts?: DateRangeFilters): string[] {
  const rangeDates = buildRangeDates(opts?.range);
  const startDate = opts?.startDate ?? rangeDates.startDate;
  const endDate = opts?.endDate ?? rangeDates.endDate;

  const clauses: string[] = [];

  if (startDate && endDate) {
    clauses.push(
      `event_date BETWEEN DATE('${startDate}') AND DATE('${endDate}')`,
    );
  } else if (startDate) {
    clauses.push(`event_date >= DATE('${startDate}')`);
  } else if (endDate) {
    clauses.push(`event_date <= DATE('${endDate}')`);
  }

  return clauses;
}

export async function searchSectorsByName(
  q: string,
  userIdentifier?: string,
  includeInactive = false,
): Promise<SectorInfo[]> {
  const term = (q || "").trim();
  if (term.length < 2) return [];

  const likePattern = `%${term.toLowerCase()}%`;

  const query = `-- SECTOR SEARCH
    SELECT
      sector_id,
      sector_name,
      logo_url,
      is_active
    FROM pv_sectors
    WHERE sector_name IS NOT NULL
      AND LOWER(sector_name) LIKE @term
      ${includeInactive ? "" : "AND is_active = TRUE"}
    ORDER BY sector_name
    LIMIT 50
  `;

  const results = await queryBigQuery<SectorInfo>(
    query,
    userIdentifier,
    `search sectors by name: ${q}`,
    { term: likePattern },
  );
  return results ?? [];
}

export async function getPageData(
  sectorId: number,
  userIdentifier?: string,
  opts?: DateRangeFilters,
): Promise<{
  info: SectorInfo | null;
  summary: SectorSummary | null;
  areaBreakdown: SectorAreaBreakdown[] | null;
  charts: ChartData[] | null;
}> {
  const dateFilterClauses = buildDateFilterClauses(opts);
  const dateFilterSql = dateFilterClauses.length
    ? `AND ${dateFilterClauses.join("\n      AND ")}`
    : "";

  // Determine chart granularity.
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

  const query = `-- SECTOR PAGE LOAD
    WITH
      events AS (
        SELECT
          event_id,
          event_date,
          pax_count,
          fng_count,
          ao_org_id,
          area_org_id,
          area_name,
          -- Strip fartsack (no-show) PAX once here so attendance_flat and every
          -- downstream count (unique_pax, active_pax) exclude no-shows.
          -- 'fartsack IS NOT TRUE' keeps legacy rows (flag NULL/FALSE) + attendees.
          ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance
        FROM pv_events
        WHERE sector_org_id = ${sectorId}
          ${dateFilterSql}
      ),
      attendance_flat AS (
        SELECT
          e.event_id,
          e.event_date,
          e.area_org_id,
          a.user_id,
          a.q_ind
        FROM events e
        LEFT JOIN UNNEST(e.attendance) a
        WHERE a.user_id IS NOT NULL
      ),

      -- Fart Sack King / Ghost King: PAX with the most no-shows (fartsacks) /
      -- unannounced posts (ghosts) in this sector, counted from the raw
      -- pv_events table (same sector + date filters) since the events CTE strips
      -- fartsacks. All PAX tied at the top count are kept so the UI can surface
      -- ties; empty when nobody has any.
      flag_counts AS (
        SELECT
          a.user_id,
          ANY_VALUE(a.f3_name) AS f3_name,
          COUNTIF(a.fartsack IS TRUE) AS fartsack_count,
          COUNTIF(a.ghost IS TRUE) AS ghost_count
        FROM pv_events e
        JOIN UNNEST(e.attendance) a
        WHERE e.sector_org_id = ${sectorId}
          AND (a.fartsack IS TRUE OR a.ghost IS TRUE)
          ${dateFilterSql}
        GROUP BY a.user_id
      ),
      fartsack_kings AS (
        SELECT user_id, f3_name, fartsack_count AS count
        FROM flag_counts
        WHERE fartsack_count > 0
          AND fartsack_count = (SELECT MAX(fartsack_count) FROM flag_counts)
      ),
      ghost_kings AS (
        SELECT user_id, f3_name, ghost_count AS count
        FROM flag_counts
        WHERE ghost_count > 0
          AND ghost_count = (SELECT MAX(ghost_count) FROM flag_counts)
      ),

      -- Area-level event aggregates
      area_event_stats AS (
        SELECT
          area_org_id,
          ANY_VALUE(area_name) AS area_name,
          COUNT(DISTINCT event_id) AS event_count,
          COUNT(DISTINCT ao_org_id) AS ao_count,
          SUM(COALESCE(fng_count, 0)) AS fng_count,
          AVG(CAST(pax_count AS FLOAT64)) AS pax_count_average
        FROM events
        GROUP BY area_org_id
      ),
      -- Area-level attendance aggregates
      area_attendance_stats AS (
        SELECT
          area_org_id,
          COUNT(
            DISTINCT IF(
              event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY),
              user_id,
              NULL)) AS active_pax,
          COUNT(DISTINCT user_id) AS unique_pax,
          COUNT(DISTINCT IF(q_ind = 1, user_id, NULL)) AS unique_qs
        FROM attendance_flat
        GROUP BY area_org_id
      ),

      -- Sector-level aggregates
      sector_event_metrics AS (
        SELECT
          COUNT(DISTINCT event_id) AS event_count,
          COUNT(DISTINCT area_org_id) AS area_count,
          COUNT(DISTINCT ao_org_id) AS ao_count,
          SUM(COALESCE(fng_count, 0)) AS fng_count,
          AVG(CAST(pax_count AS FLOAT64)) AS pax_count_average
        FROM events
      ),
      sector_attendance_metrics AS (
        SELECT
          COUNT(
            DISTINCT IF(
              event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY),
              user_id,
              NULL)) AS active_pax,
          COUNT(DISTINCT user_id) AS unique_pax,
          COUNT(DISTINCT IF(q_ind = 1, user_id, NULL)) AS unique_qs
        FROM attendance_flat
      ),

      -- Chart aggregation
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
      -- Sector info
      (
        SELECT AS STRUCT
          sector_id, sector_name, logo_url, is_active, areas
        FROM pv_sectors
        WHERE sector_id = ${sectorId}
        LIMIT 1
      ) AS sectorInfo,

      -- Sector-level summary
      (
        SELECT AS STRUCT
          em.event_count,
          em.area_count,
          em.ao_count,
          am.active_pax,
          am.unique_pax,
          am.unique_qs,
          em.fng_count,
          em.pax_count_average,
          ARRAY(
            SELECT AS STRUCT user_id, f3_name, count
            FROM fartsack_kings
            ORDER BY f3_name
          ) AS fartsack_kings,
          ARRAY(
            SELECT AS STRUCT user_id, f3_name, count
            FROM ghost_kings
            ORDER BY f3_name
          ) AS ghost_kings
        FROM sector_event_metrics em
        CROSS JOIN sector_attendance_metrics am
      ) AS summary,

      -- Area breakdown
      (
        SELECT
          ARRAY_AGG(
            STRUCT(
              aes.area_org_id AS area_id,
              aes.area_name,
              aes.event_count,
              aes.ao_count,
              COALESCE(aas.active_pax, 0) AS active_pax,
              COALESCE(aas.unique_pax, 0) AS unique_pax,
              COALESCE(aas.unique_qs, 0) AS unique_qs,
              aes.fng_count,
              aes.pax_count_average
            )
            ORDER BY aes.event_count DESC
          )
        FROM area_event_stats aes
        LEFT JOIN area_attendance_stats aas USING (area_org_id)
      ) AS areaBreakdown,

      -- Charts with gap-filling
      (
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
    sectorInfo: SectorInfo;
    summary: SectorSummary;
    areaBreakdown: SectorAreaBreakdown[];
    charts: ChartData[];
  }>(query, userIdentifier, `fetch sector data for sector ${sectorId}`);

  return {
    info: results?.[0]?.sectorInfo || null,
    summary: results?.[0]?.summary || null,
    areaBreakdown: results?.[0]?.areaBreakdown || null,
    charts: results?.[0]?.charts || null,
  };
}
