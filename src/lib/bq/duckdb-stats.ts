/**
 * Shared DuckDB SQL for the stats pages.
 *
 * The page builders aggregate inside DuckDB and return one small row, instead
 * of pulling every matching `pv_events` row (with its attendance array) into
 * the Node heap. Each builder composes the CTEs below over a single filtered
 * scan of `pv_events`.
 */
import type { ChartData, PaxLeader } from "@/lib/types";

export type ChartUnit = "month" | "week" | "day";

/** Today's UTC date as `YYYY-MM-DD`. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A SQL DATE literal for today's UTC date. Inlined rather than bound so the
 * shared CTEs do not depend on parameter order; the value never comes from
 * user input.
 */
export function utcTodaySql(): string {
  return `DATE '${utcToday()}'`;
}

/** Monthly buckets beyond a year, weekly beyond 180 days, otherwise daily. */
export function chartUnit(start?: string, end?: string): ChartUnit {
  const effectiveEnd = end ?? utcToday();
  const days = start
    ? (Date.parse(effectiveEnd) - Date.parse(start)) / 86_400_000
    : Infinity;
  return days > 365 ? "month" : days > 180 ? "week" : "day";
}

/** Columns every aggregate needs; deliberately excludes the wide text fields. */
const FILTERED_COLUMNS =
  "event_id, event_date, pax_count, fng_count, ao_org_id, ao_name, region_org_id, region_name, area_org_id, area_name, attendance";

/** Extra columns only the displayed event list needs. */
const DISPLAY_COLUMNS =
  "event_name, first_f_ind, second_f_ind, third_f_ind, types, tags";

/**
 * The newest events as shown on a page, from the same scan as the aggregates.
 * Requires `eventBaseCtes(where, true)`.
 */
export function displayEventsProjection(limit = 100): string {
  return `
  (SELECT list({
     'event_instance_id': event_id,
     'event_date': strftime(event_date, '%Y-%m-%d'),
     'event_name': event_name, 'pax_count': pax_count, 'fng_count': fng_count,
     'ao_org_id': ao_org_id, 'ao_name': ao_name,
     'region_org_id': region_org_id, 'region_name': region_name,
     'first_f_ind': first_f_ind, 'second_f_ind': second_f_ind,
     'third_f_ind': third_f_ind, 'types': types, 'tags': tags,
     'attendance': list_filter(
       attendance, a -> a.fartsack IS NOT TRUE AND a.user_id IS NOT NULL),
     'fartsacks': list_filter(attendance, a -> a.fartsack IS TRUE)
   } ORDER BY event_date DESC, event_id DESC)
     FROM (SELECT * FROM filtered
            ORDER BY event_date DESC, event_id DESC LIMIT ${Number(limit)})
  ) AS events`;
}

/**
 * Base CTEs over one filtered scan:
 * - `filtered`: the matching events.
 * - `att`: one row per attendance entry (no-shows included).
 * - `present`: one row per (event, PAX) who actually attended; a PAX listed
 *   twice on an event counts once and is a Q if any entry is.
 */
export function eventBaseCtes(
  where: string,
  withDisplayColumns = false,
): string {
  return `
    filtered AS MATERIALIZED (
      SELECT ${FILTERED_COLUMNS}${withDisplayColumns ? `, ${DISPLAY_COLUMNS}` : ""}
        FROM pv_events WHERE ${where}
    ),
    att AS MATERIALIZED (
      SELECT f.event_id, f.event_date, f.ao_org_id, f.region_org_id,
             f.area_org_id, a.user_id, a.f3_name, a.avatar_url, a.q_ind,
             a.fartsack, a.ghost
        FROM filtered f, UNNEST(f.attendance) AS u(a)
       WHERE a.user_id IS NOT NULL
    ),
    present AS MATERIALIZED (
      SELECT event_id, user_id,
             any_value(event_date) AS event_date,
             any_value(ao_org_id) AS ao_org_id,
             any_value(region_org_id) AS region_org_id,
             any_value(area_org_id) AS area_org_id,
             any_value(f3_name) AS f3_name,
             any_value(avatar_url) AS avatar_url,
             COALESCE(bool_or(q_ind = 1), FALSE) AS is_q
        FROM att
       WHERE fartsack IS NOT TRUE
       GROUP BY event_id, user_id
    )`;
}

/** Per-PAX no-show and ghost counts, and the PAX tied for the most of each. */
export function kingsCtes(): string {
  return `
    flag_counts AS (
      SELECT user_id, any_value(f3_name) AS f3_name,
             count(*) FILTER (WHERE fartsack IS TRUE) AS fartsack_count,
             count(*) FILTER (WHERE ghost IS TRUE) AS ghost_count
        FROM att
       WHERE fartsack IS TRUE OR ghost IS TRUE
       GROUP BY user_id
    ),
    fartsack_kings AS (
      SELECT user_id, f3_name, fartsack_count AS count FROM flag_counts
       WHERE fartsack_count > 0
         AND fartsack_count = (SELECT max(fartsack_count) FROM flag_counts)
    ),
    ghost_kings AS (
      SELECT user_id, f3_name, ghost_count AS count FROM flag_counts
       WHERE ghost_count > 0
         AND ghost_count = (SELECT max(ghost_count) FROM flag_counts)
    )`;
}

export const KINGS_PROJECTION = `
  (SELECT list({'user_id': user_id, 'f3_name': f3_name, 'count': count})
     FROM fartsack_kings) AS fartsack_kings,
  (SELECT list({'user_id': user_id, 'f3_name': f3_name, 'count': count})
     FROM ghost_kings) AS ghost_kings`;

/**
 * Event-level and attendance-level totals as two single-row CTEs.
 * "Active" means attended in the last 30 days, by UTC date.
 */
export function totalsCtes(): string {
  return `
    event_totals AS (
      SELECT count(*) AS event_count,
             count(DISTINCT ao_org_id) AS ao_count,
             count(DISTINCT region_org_id) AS region_count,
             count(DISTINCT area_org_id) AS area_count,
             COALESCE(sum(COALESCE(fng_count, 0)), 0) AS fng_count,
             COALESCE(
               sum(COALESCE(pax_count, 0))::DOUBLE / NULLIF(count(*), 0), 0
             ) AS pax_count_average,
             strftime(min(event_date), '%Y-%m-%d') AS first_event_date
        FROM filtered
    ),
    attendance_totals AS (
      SELECT ${attendanceAggregates()} FROM present
    )`;
}

/** The three distinct-PAX counts, reusable in grouped breakdowns. */
export function attendanceAggregates(): string {
  return `count(DISTINCT user_id) FILTER (
            WHERE event_date >= ${utcTodaySql()} - INTERVAL 30 DAY
          ) AS active_pax,
          count(DISTINCT user_id) AS unique_pax,
          count(DISTINCT user_id) FILTER (WHERE is_q) AS unique_qs`;
}

/** Period-bucketed chart rows with empty periods filled in between. */
export function chartCtes(unit: ChartUnit): string {
  const bucket =
    unit === "day"
      ? "event_date"
      : `CAST(date_trunc('${unit}', event_date) AS DATE)`;
  return `
    period_events AS (
      SELECT ${bucket} AS period,
             sum(COALESCE(pax_count, 0)) AS pax_count,
             sum(COALESCE(fng_count, 0)) AS fng_count
        FROM filtered GROUP BY 1
    ),
    period_attendance AS (
      SELECT ${bucket} AS period,
             count(*) FILTER (WHERE is_q) AS q_count,
             count(DISTINCT user_id) AS unique_pax_count,
             count(DISTINCT user_id) FILTER (WHERE is_q) AS unique_q_count
        FROM present GROUP BY 1
    ),
    spine AS (
      SELECT CAST(d AS DATE) AS period
        FROM generate_series(
          (SELECT min(period) FROM period_events),
          (SELECT max(period) FROM period_events),
          INTERVAL 1 ${unit.toUpperCase()}
        ) AS s(d)
    ),
    chart_rows AS (
      SELECT strftime(s.period, '%Y-%m-%d') AS date,
             COALESCE(pe.pax_count, 0) AS pax_count,
             COALESCE(pe.fng_count, 0) AS fng_count,
             COALESCE(pa.q_count, 0) AS q_count,
             COALESCE(pa.unique_pax_count, 0) AS unique_pax_count,
             COALESCE(pa.unique_q_count, 0) AS unique_q_count
        FROM spine s
        LEFT JOIN period_events pe ON pe.period = s.period
        LEFT JOIN period_attendance pa ON pa.period = s.period
    )`;
}

export const CHARTS_PROJECTION = `
  (SELECT list({
     'date': date, 'pax_count': pax_count, 'fng_count': fng_count,
     'q_count': q_count, 'unique_pax_count': unique_pax_count,
     'unique_q_count': unique_q_count
   } ORDER BY date) FROM chart_rows) AS charts`;

/** Tied kings are shown alphabetically; the list is at most a handful. */
export function sortKings(rows: PaxLeader[] | null | undefined): PaxLeader[] {
  return [...(rows ?? [])].sort((a, b) =>
    String(a.f3_name ?? "").localeCompare(String(b.f3_name ?? "")),
  );
}

export function chartRows(rows: ChartData[] | null | undefined): ChartData[] {
  return rows ?? [];
}

export interface RollupRow {
  event_count: number;
  region_count: number;
  area_count: number;
  ao_count: number;
  active_pax: number;
  unique_pax: number;
  unique_qs: number;
  fng_count: number;
  pax_count_average: number;
  fartsack_kings: PaxLeader[] | null;
  ghost_kings: PaxLeader[] | null;
  breakdown: RollupBreakdownRow[] | null;
  charts: ChartData[] | null;
}

export interface RollupBreakdownRow {
  id: number | null;
  name: string;
  event_count: number;
  ao_count: number;
  active_pax: number;
  unique_pax: number;
  unique_qs: number;
  fng_count: number;
  pax_count_average: number;
}

/**
 * One-row page query for the area and sector pages: summary totals, kings,
 * charts, and a breakdown by the child org (`region` for an area, `area` for
 * a sector).
 */
export function rollupPageSql(
  where: string,
  unit: ChartUnit,
  child: "region" | "area",
): string {
  const id = `${child}_org_id`;
  const name = `${child}_name`;
  return `
    WITH ${eventBaseCtes(where)},
    ${kingsCtes()},
    ${totalsCtes()},
    ${chartCtes(unit)},
    child_events AS (
      SELECT ${id} AS id,
             COALESCE(any_value(${name}), '') AS name,
             count(*) AS event_count,
             count(DISTINCT ao_org_id) AS ao_count,
             COALESCE(sum(COALESCE(fng_count, 0)), 0) AS fng_count,
             sum(COALESCE(pax_count, 0))::DOUBLE / count(*) AS pax_count_average
        FROM filtered GROUP BY 1
    ),
    child_attendance AS (
      SELECT ${id} AS id, ${attendanceAggregates()} FROM present GROUP BY 1
    )
    SELECT e.event_count, e.region_count, e.area_count, e.ao_count,
           a.active_pax, a.unique_pax, a.unique_qs,
           e.fng_count, e.pax_count_average,
           ${KINGS_PROJECTION},
           (SELECT list({
              'id': ce.id, 'name': ce.name, 'event_count': ce.event_count,
              'ao_count': ce.ao_count,
              'active_pax': COALESCE(ca.active_pax, 0),
              'unique_pax': COALESCE(ca.unique_pax, 0),
              'unique_qs': COALESCE(ca.unique_qs, 0),
              'fng_count': ce.fng_count,
              'pax_count_average': ce.pax_count_average
            } ORDER BY ce.event_count DESC, ce.id)
              FROM child_events ce
              LEFT JOIN child_attendance ca ON ca.id IS NOT DISTINCT FROM ce.id
           ) AS breakdown,
           ${CHARTS_PROJECTION}
      FROM event_totals e CROSS JOIN attendance_totals a`;
}

/** Shared summary fields, with zeros when the query returned no row. */
export function rollupSummary(row: RollupRow | undefined) {
  return {
    event_count: Number(row?.event_count ?? 0),
    ao_count: Number(row?.ao_count ?? 0),
    active_pax: Number(row?.active_pax ?? 0),
    unique_pax: Number(row?.unique_pax ?? 0),
    unique_qs: Number(row?.unique_qs ?? 0),
    fng_count: Number(row?.fng_count ?? 0),
    pax_count_average: Number(row?.pax_count_average ?? 0),
    fartsack_kings: sortKings(row?.fartsack_kings),
    ghost_kings: sortKings(row?.ghost_kings),
  };
}
