/* The DuckDB row adapter returns schema-dependent nested structs. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { queryBigQuery } from "@/lib/db";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import {
  DuckDbQueryAdapter,
  DuckDbParams,
  selectDuckDbOrLegacy,
} from "@/lib/duckdb/query";
import {
  RegionInfo,
  EventData,
  RegionSummary,
  Leaders,
  EventUpcoming,
  RegionKotterList,
  ChartData,
  RegionAchievementPax,
  RegionAOBreakdown,
} from "@/lib/types";
import { StatsFilters, toFiniteNumbers } from "@/lib/filters";

type DuckDbExecutor = <T>(sql: string, params?: DuckDbParams) => Promise<T[]>;
let injectedDuckDbQuery: DuckDbExecutor | undefined;
export function setRegionDuckDbQueryForTests(query?: DuckDbExecutor): void {
  injectedDuckDbQuery = query;
}
const executeDuckDb: DuckDbExecutor = async (sql, params) => {
  const adapter = injectedDuckDbQuery
    ? undefined
    : new DuckDbQueryAdapter(getDuckDbRuntime());
  return (injectedDuckDbQuery ?? adapter!.execute.bind(adapter))(sql, params);
};

function duckEventFilter(regionId: number | null, opts?: StatsFilters) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (regionId !== null) {
    clauses.push("region_org_id = ?");
    params.push(regionId);
  }
  const range = buildRangeDates(opts?.range);
  const start = opts?.startDate ?? range.startDate;
  const end = opts?.endDate ?? range.endDate;
  if (start) {
    clauses.push("event_date >= CAST(? AS DATE)");
    params.push(start);
  }
  if (end) {
    clauses.push("event_date <= CAST(? AS DATE)");
    params.push(end);
  }
  const aos = toFiniteNumbers(opts?.aoIds);
  if (aos.length) {
    const zero = aos.includes(0),
      ids = aos.filter((id) => id !== 0),
      marks = ids.map(() => "?").join(",");
    if (zero && ids.length)
      clauses.push(
        opts?.aoMode === "exclude"
          ? `(ao_org_id IS NOT NULL AND ao_org_id NOT IN (${marks}))`
          : `(ao_org_id IS NULL OR ao_org_id IN (${marks}))`,
      );
    else if (zero)
      clauses.push(
        opts?.aoMode === "exclude"
          ? "ao_org_id IS NOT NULL"
          : "ao_org_id IS NULL",
      );
    else
      clauses.push(
        `${opts?.aoMode === "exclude" ? "ao_org_id NOT IN" : "ao_org_id IN"} (${marks})`,
      );
    params.push(...ids);
  }
  const addList = (
    column: string,
    values: number[] | undefined,
    mode: string | undefined,
  ) => {
    const ids = toFiniteNumbers(values);
    if (!ids.length) return;
    const marks = ids.map(() => "?").join(",");
    clauses.push(
      `list_has(list_transform(${column}, x -> x.id), ${mode === "exclude" ? "" : ""}[${marks}])`,
    );
    // DuckDB's list_has accepts a scalar; use an EXISTS expression for lists.
    clauses[clauses.length - 1] =
      `${mode === "exclude" ? "NOT " : ""}EXISTS (SELECT 1 FROM UNNEST(${column}) u WHERE u.unnest.id IN (${marks}))`;
    params.push(...ids);
  };
  addList("tags", opts?.tagIds, opts?.tagMode ?? "include");
  addList("types", opts?.typeIds, opts?.typeMode ?? "include");
  const cats = toFiniteNumbers(opts?.categoryIds).filter(
    (x) => x === 1 || x === 2 || x === 3,
  );
  if (cats.length) {
    const expressions = cats.map(
      (x) => `${["", "first_f_ind", "second_f_ind", "third_f_ind"][x]} = 1`,
    );
    clauses.push(
      (opts?.categoryMode === "exclude" ? "NOT " : "") +
        `(${expressions.map((x) => `(${x})`).join(" OR ")})`,
    );
  }
  return { where: clauses.join(" AND "), params };
}

async function getRegionEventsDuckDb(
  regionId: number,
  opts?: StatsFilters & { limit?: number },
) {
  const f = duckEventFilter(regionId, opts);
  const limit =
    Number.isFinite(opts?.limit) && Number(opts?.limit) > 0 ? " LIMIT ?" : "";
  if (limit) f.params.push(Number(opts!.limit));
  return executeDuckDb<EventData>(
    `SELECT event_id AS event_instance_id, event_date, event_name,
      pax_count, fng_count, ao_org_id, ao_name, region_org_id, region_name,
      first_f_ind, second_f_ind, third_f_ind, types, tags,
      list_filter(attendance, x -> x.fartsack IS NOT TRUE) AS attendance,
      list_filter(attendance, x -> x.fartsack IS TRUE) AS fartsacks
    FROM pv_events WHERE ${f.where} ORDER BY event_date DESC, event_id DESC${limit}`,
    f.params,
  );
}

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
  opts?: StatsFilters,
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
  const aoList = toFiniteNumbers(opts?.aoIds);
  const tagList = toFiniteNumbers(opts?.tagIds);
  const typeList = toFiniteNumbers(opts?.typeIds);
  const categoryList = toFiniteNumbers(opts?.categoryIds).filter(
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
  opts?: StatsFilters,
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
function buildEventsAndSql(opts?: StatsFilters, alias?: string): string {
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
  opts?: StatsFilters & {
    limit?: number;
  },
): Promise<EventData[] | null> {
  return selectDuckDbOrLegacy({
    capability: "events",
    env: process.env,
    duckdb: () => getRegionEventsDuckDb(regionId, opts),
    legacy: async () => {
      // LIMIT is optional. Keep it numeric-only.
      const limit = Number.isFinite(opts?.limit)
        ? Number(opts!.limit)
        : undefined;
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
      region_name,
      first_f_ind,
      second_f_ind,
      third_f_ind,
      types,
      tags,
      ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance,
      ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS TRUE) AS fartsacks
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
    },
  });
}

/**
 * Fetch a single region's metadata.
 *
 * Deliberately lightweight — for pages that need to identify a region (name,
 * logo, parent area) without paying for the full `getPageData` roll-up.
 * Returns null when the id matches no region.
 */
export async function getRegionInfo(
  regionId: number,
  userIdentifier?: string,
): Promise<RegionInfo | null> {
  return selectDuckDbOrLegacy({
    capability: "stats_region",
    env: process.env,
    duckdb: async () => {
      const rows = await executeDuckDb<RegionInfo>(
        `SELECT region_id, region_name, area_id, area_name, logo_url, is_active, aos, types, tags
       FROM pv_regions WHERE region_id = ? LIMIT 1`,
        [regionId],
      );
      return rows[0] ?? null;
    },
    legacy: async () => {
      const query = `-- REGION INFO
    SELECT
      region_id,
      region_name,
      area_id,
      area_name,
      logo_url,
      is_active,
      aos,
      types,
      tags
    FROM pv_regions
    WHERE region_id = @regionId
    LIMIT 1
  `;

      const results = await queryBigQuery<RegionInfo>(
        query,
        userIdentifier,
        `fetch region info for region ${regionId}`,
        { regionId },
      );
      return results?.[0] ?? null;
    },
  });
}

/**
 * Fetch the AO org ids belonging to a region.
 *
 * Used when a region's preferences change: every AO page under that region
 * renders with the inherited preferences, so their caches must be invalidated
 * alongside the region's own.
 */
export async function getRegionAOIds(
  regionId: number,
  userIdentifier?: string,
): Promise<number[]> {
  const query = `-- REGION AO IDS
    SELECT ao.ao_org_id AS ao_id
    FROM pv_regions r, UNNEST(r.aos) ao
    WHERE r.region_id = @regionId
      AND ao.ao_org_id IS NOT NULL
  `;

  const results = await queryBigQuery<{ ao_id: number }>(
    query,
    userIdentifier,
    `fetch AO ids for region ${regionId}`,
    { regionId },
  );
  return (results ?? []).map((row) => row.ao_id).filter(Number.isFinite);
}

export async function searchRegionsByName(
  q: string,
  userIdentifier?: string,
  includeInactive = false,
): Promise<RegionInfo[]> {
  // Normalize and guard against overly-broad queries.
  const term = (q || "").trim();
  if (term.length < 2) return [];

  // Bound as a query parameter (@term) — no manual escaping needed.
  const likePattern = `%${term.toLowerCase()}%`;

  return selectDuckDbOrLegacy({
    capability: "search",
    env: process.env,
    duckdb: () =>
      executeDuckDb<RegionInfo>(
        `SELECT region_id, region_name, logo_url, is_active
      FROM pv_regions WHERE region_name IS NOT NULL AND lower(region_name) LIKE ?
      ${includeInactive ? "" : "AND is_active = TRUE"} ORDER BY region_name LIMIT 50`,
        [likePattern],
      ),
    legacy: async () => {
      // Simple contains search; ordering is alphabetical for predictability.
      const query = `-- REGION SEARCH
    SELECT
      region_id,
      region_name,
      logo_url,
      is_active
    FROM pv_regions
    WHERE region_name IS NOT NULL
      AND LOWER(region_name) LIKE @term
      ${includeInactive ? "" : "AND is_active = TRUE"}
    ORDER BY region_name
    LIMIT 50
  `;

      const results = await queryBigQuery<RegionInfo>(
        query,
        userIdentifier,
        `search regions by name: ${q}`,
        { term: likePattern },
      );
      return results ?? [];
    },
  });
}

export async function getPageData(
  regionId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
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
  achievements: RegionAchievementPax[] | null;
  aoBreakdown: RegionAOBreakdown[] | null;
  /** Raw `json_config` for this region; null when never saved. */
  preferencesJson: string | null;
}> {
  return selectDuckDbOrLegacy({
    capability: "stats_region",
    env: process.env,
    duckdb: () => getRegionPageDuckDbParity(regionId, userIdentifier, opts),
    legacy: async () => {
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
        ? (new Date(effectiveEnd).getTime() -
            new Date(effectiveStart).getTime()) /
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

      const preferenceProjection = `(SELECT json_config FROM pv_regions_preferences WHERE region_id = ${regionId} LIMIT 1) AS preferencesJson`;
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
          -- Strip fartsack (no-show) PAX once here so attendance_flat, the events
          -- list, the summary counts, and the charts all exclude no-shows.
          -- 'fartsack IS NOT TRUE' keeps legacy rows (flag NULL/FALSE) + attendees.
          ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance,
          -- Display-only roster of the no-shows for the UI chips; not consumed
          -- by any aggregate CTE.
          ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS TRUE) AS fartsacks
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

      -- Fart Sack King / Ghost King: PAX with the most no-shows (fartsacks) /
      -- unannounced posts (ghosts) in this region, counted from the raw
      -- pv_events table (same region + filters) since the events CTE strips
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
        WHERE e.region_org_id = ${regionId}
          AND (a.fartsack IS TRUE OR a.ghost IS TRUE)${eventsFilterAndSql}
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
        -- Exclude fartsack (no-show) rows so posts/all_posts count real
        -- attendance only; the q_ind-based counts are unaffected (a no-show Q
        -- reads q_ind = 0).
        WHERE a.user_id IS NOT NULL AND a.fartsack IS NOT TRUE${eventsFilterAndSql}
        GROUP BY a.user_id
      ),

      -- ── Achievements ────────────────────────────────────────────────────────
      -- Milestone thresholds shared across posts and Qs
      achievement_thresholds AS (
        SELECT t FROM UNNEST([25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) AS t
      ),

      -- All home-region PAX from pv_pax (source of truth for membership + FNG override)
      achievement_pax_base AS (
        SELECT user_id, f3_name, avatar_url, start_date_override
        FROM pv_pax
        WHERE home_region_id = ${regionId}
      ),

      -- Single pass over pv_events for all four count dimensions + first_event_date
      -- (all-time, no date filter so milestones reflect career totals)
      achievement_event_counts AS (
        SELECT
          a.user_id,
          COUNT(DISTINCT IF(e.region_org_id = ${regionId}, e.event_id, NULL)) AS region_posts,
          COUNT(DISTINCT IF(e.region_org_id = ${regionId} AND a.q_ind = 1, e.event_id, NULL)) AS region_qs,
          COUNT(DISTINCT e.event_id) AS all_posts,
          COUNT(DISTINCT IF(a.q_ind = 1, e.event_id, NULL)) AS all_qs,
          MIN(e.event_date) AS first_event_date,
          MAX(IF(e.region_org_id = ${regionId}, e.event_date, NULL)) AS last_region_event_date
        FROM pv_events e
        JOIN UNNEST(e.attendance) a ON TRUE
        JOIN achievement_pax_base pb ON pb.user_id = a.user_id
        -- Exclude fartsack (no-show) rows so post milestones reflect real
        -- attendance; q_ind-based Q milestones are unaffected.
        WHERE a.fartsack IS NOT TRUE
        GROUP BY a.user_id
      ),

      -- Combine pv_pax fields with computed counts; resolve fng_date using override.
      -- Mirrors pax.ts: IFNULL(CAST(start_date_override AS STRING), CAST(first_event_date AS STRING))
      -- fng_date is kept as STRING so DATE(fng_date) can be used for anniversary math.
      achievement_pax AS (
        SELECT
          pb.user_id,
          pb.f3_name,
          pb.avatar_url,
          COALESCE(ec.region_posts, 0) AS region_posts,
          COALESCE(ec.region_qs, 0) AS region_qs,
          COALESCE(ec.all_posts, 0) AS all_posts,
          COALESCE(ec.all_qs, 0) AS all_qs,
          IFNULL(
            CAST(pb.start_date_override AS STRING),
            CAST(ec.first_event_date AS STRING)
          ) AS fng_date,
          ec.last_region_event_date
        FROM achievement_pax_base pb
        LEFT JOIN achievement_event_counts ec ON ec.user_id = pb.user_id
      ),

      -- Cross with thresholds to find next milestone per count dimension.
      -- Also computes next_anniversary_date correctly:
      --   use this year's month/day; if already past, use next year.
      -- This avoids DATE_DIFF(YEAR) which counts calendar boundaries, not completed anniversaries.
      achievement_pax_milestones AS (
        SELECT
          p.user_id, p.f3_name, p.avatar_url,
          p.region_posts, p.region_qs, p.all_posts, p.all_qs, p.fng_date, p.last_region_event_date,
          MIN(CASE WHEN t.t > p.region_posts THEN t.t END) AS next_region_post_milestone,
          MIN(CASE WHEN t.t > p.all_posts    THEN t.t END) AS next_nation_post_milestone,
          MIN(CASE WHEN t.t > p.region_qs   THEN t.t END) AS next_region_q_milestone,
          MIN(CASE WHEN t.t > p.all_qs      THEN t.t END) AS next_nation_q_milestone,
          -- Use DATE_ADD (not EXTRACT) so leap-year FNG dates (Feb 29) roll safely to Feb 28.
          -- year_diff = calendar years between FNG year and today's year.
          -- "this year's anniversary" = DATE_ADD(fng_date, INTERVAL year_diff YEAR).
          -- If that date has already passed, add one more year.
          IF(p.fng_date IS NOT NULL,
            CASE
              WHEN DATE_ADD(DATE(p.fng_date), INTERVAL (EXTRACT(YEAR FROM CURRENT_DATE()) - EXTRACT(YEAR FROM DATE(p.fng_date))) YEAR) >= CURRENT_DATE()
              THEN DATE_ADD(DATE(p.fng_date), INTERVAL (EXTRACT(YEAR FROM CURRENT_DATE()) - EXTRACT(YEAR FROM DATE(p.fng_date))) YEAR)
              ELSE DATE_ADD(DATE(p.fng_date), INTERVAL (EXTRACT(YEAR FROM CURRENT_DATE()) - EXTRACT(YEAR FROM DATE(p.fng_date)) + 1) YEAR)
            END,
            NULL
          ) AS next_anniversary_date
        FROM achievement_pax p
        CROSS JOIN achievement_thresholds t
        GROUP BY p.user_id, p.f3_name, p.avatar_url,
                 p.region_posts, p.region_qs, p.all_posts, p.all_qs, p.fng_date, p.last_region_event_date
      )
    SELECT
      -- Region info as a STRUCT
      (
        SELECT AS STRUCT
          region_id, region_name, area_id, area_name, logo_url, is_active, aos, types, tags
        FROM pv_regions
        WHERE region_id = ${regionId}
        LIMIT 1
      ) AS regionInfo,

      -- Region preferences, as the raw json_config string (parsed by the
      -- loader). Folded into this query rather than fetched separately to hold
      -- the single-query-per-page rule. NULL when the region has never saved
      -- preferences, in which case the loader applies defaults.
      ${preferenceProjection},

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
              attendance,
              fartsacks
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

      -- AO breakdown: beatdown (workout) count per AO.
      -- Built from the shared events CTE so it honours the page filters the
      -- same way the summary and leaders do.
      --
      -- Region-level events with no AO are kept as a single ao_id = 0 row
      -- labelled "(No AO)", reusing the same 0 sentinel the AO filter uses for
      -- "no AO". Without it the breakdown total would silently disagree with
      -- the Total Events stat in the summary card directly above it.
      (
        SELECT
          ARRAY_AGG(
            STRUCT(ao_id, ao_name, beatdowns)
            ORDER BY beatdowns DESC, ao_name ASC
          )
        FROM (
          SELECT
            IFNULL(ao_org_id, 0) AS ao_id,
            IFNULL(ANY_VALUE(ao_name), '(No AO)') AS ao_name,
            COUNT(DISTINCT event_id) AS beatdowns
          FROM events
          GROUP BY ao_org_id
        )
      ) AS aoBreakdown,

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

      -- Achievements: PAX approaching post/Q milestones or with upcoming anniversaries
      (
        SELECT ARRAY_AGG(
          STRUCT(
            user_id, f3_name, avatar_url,
            region_posts, region_qs, all_posts, all_qs,
            next_region_post_milestone,
            next_nation_post_milestone,
            next_region_q_milestone,
            next_nation_q_milestone,
            fng_date,
            CAST(last_region_event_date AS STRING) AS last_region_event_date,
            CAST(next_anniversary_date AS STRING) AS next_anniversary_date,
            IF(next_anniversary_date IS NOT NULL,
              DATE_DIFF(next_anniversary_date, CURRENT_DATE(), DAY),
              NULL
            ) AS days_until_anniversary
          )
          ORDER BY f3_name ASC
        )
        FROM achievement_pax_milestones
        WHERE
          (
            -- Post/Q milestones are hidden once a PAX is inactive >90 days (issue #119).
            -- The 90-day window mirrors the Kotter fall-off; anniversaries below are exempt.
            (
              last_region_event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
              AND (
                -- 1 away from any milestone
                (next_region_post_milestone IS NOT NULL AND next_region_post_milestone - region_posts = 1)
                OR (next_nation_post_milestone IS NOT NULL AND next_nation_post_milestone - all_posts = 1)
                OR (next_region_q_milestone IS NOT NULL AND next_region_q_milestone - region_qs = 1)
                OR (next_nation_q_milestone IS NOT NULL AND next_nation_q_milestone - all_qs = 1)
                -- Within milestone range and active in the last 30 days
                OR (
                  last_region_event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
                  AND (
                    (next_region_post_milestone IS NOT NULL AND next_region_post_milestone - region_posts <= 5)
                    OR (next_nation_post_milestone IS NOT NULL AND next_nation_post_milestone - all_posts <= 5)
                    OR (next_region_q_milestone IS NOT NULL AND next_region_q_milestone - region_qs <= 3)
                    OR (next_nation_q_milestone IS NOT NULL AND next_nation_q_milestone - all_qs <= 3)
                  )
                )
              )
            )
            -- Upcoming anniversary / Manniversary (no activity gate, but min 25 region posts) — always shown per #119
            OR (next_anniversary_date IS NOT NULL AND DATE_DIFF(next_anniversary_date, CURRENT_DATE(), DAY) BETWEEN 0 AND 14 AND region_posts >= 25)
          )
          AND (region_posts > 10) -- Filter out very new PAX with no significant activity
      ) AS achievements,

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
        achievements: RegionAchievementPax[];
        aoBreakdown: RegionAOBreakdown[];
        preferencesJson: string | null;
      }>(query, userIdentifier, `fetch region data for region ${regionId}`);

      const preferencesJson = results?.[0]?.preferencesJson ?? null;
      return {
        info: results?.[0]?.regionInfo || null,
        events: results?.[0]?.events || null,
        summary: results?.[0]?.summary || null,
        leaders: results?.[0]?.leaders || null,
        upcoming: results?.[0]?.upcoming || null,
        kotter: results?.[0]?.kotter || null,
        charts: results?.[0]?.charts || null,
        achievements: results?.[0]?.achievements || null,
        aoBreakdown: results?.[0]?.aoBreakdown || null,
        preferencesJson,
      };
    },
  });
}

/** Native DuckDB page read.  This is intentionally separate from the legacy
 * BigQuery statement: DuckDB does not implement BigQuery STRUCT/UNNEST
 * syntax, and keeping the two dialects mixed was the source of the old
 * fallback bug. */
type RegionPageData = Awaited<ReturnType<typeof getPageData>>;

/** DuckDB implementation deliberately works from raw, unbounded events. */
async function getRegionPageDuckDbParity(
  regionId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<RegionPageData> {
  const f = duckEventFilter(regionId, opts);
  const [info, raw, upcoming, kotter, all, career, pax] = await Promise.all([
    executeDuckDb<RegionInfo>(
      `SELECT region_id, region_name, area_id, area_name, logo_url, is_active, aos, types, tags FROM pv_regions WHERE region_id = ? LIMIT 1`,
      [regionId],
    ),
    executeDuckDb<any>(
      `SELECT event_id AS event_instance_id, event_date, event_name, pax_count, fng_count, ao_org_id, ao_name, region_org_id, region_name, first_f_ind, second_f_ind, third_f_ind, types, tags, attendance FROM pv_events WHERE ${f.where} ORDER BY event_date DESC, event_id DESC`,
      f.params,
    ),
    executeDuckDb<EventUpcoming>(
      `SELECT start_date, start_time, ao_name, ao_org_id, location_name, event_name, event_type, event_category, q_list FROM pv_upcoming WHERE region_org_id = ? ORDER BY start_date, start_time, ao_name LIMIT 50`,
      [regionId],
    ),
    executeDuckDb<RegionKotterList>(
      `SELECT user_id, f3_name, avatar_url, kotter_status, total_events, first_event_date, days_since_last_event, last_event_date, last_event_name, last_event_ao_name, last_event_ao_org_id, bestie_list FROM pv_kotter WHERE home_region_id = ? ORDER BY days_since_last_event, last_event_date, f3_name`,
      [regionId],
    ),
    executeDuckDb<any>(
      `SELECT event_id AS event_instance_id, event_date, region_org_id, attendance FROM pv_events WHERE ${duckEventFilter(null, opts).where}`,
      duckEventFilter(null, opts).params,
    ),
    executeDuckDb<any>(
      `SELECT event_id AS event_instance_id, event_date, region_org_id, attendance FROM pv_events`,
    ),
    executeDuckDb<any>(
      `SELECT user_id, f3_name, avatar_url, start_date_override FROM pv_pax WHERE home_region_id = ?`,
      [regionId],
    ),
  ]);
  const display = raw.slice(0, 100).map((e: any) => ({
    ...e,
    attendance: (e.attendance ?? []).filter((a: any) => a.fartsack !== true),
    fartsacks: (e.attendance ?? []).filter((a: any) => a.fartsack === true),
  })) as EventData[];
  const attended = (e: any) =>
    (e.attendance ?? []).filter(
      (a: any) => a.fartsack !== true && a.user_id != null,
    );
  const rows = raw.flatMap((e: any) => attended(e).map((a: any) => ({ e, a })));
  const ids = (field: (a: any) => boolean) =>
    new Set(
      rows.filter((x: any) => field(x.a)).map((x: any) => Number(x.a.user_id)),
    );
  const countFlags = (flag: string) => {
    const m = new Map<number, any>();
    for (const e of raw)
      for (const a of e.attendance ?? [])
        if (a[flag] === true) {
          const id = Number(a.user_id);
          const x = m.get(id) ?? { user_id: id, f3_name: a.f3_name, count: 0 };
          x.count++;
          m.set(id, x);
        }
    const max = Math.max(0, ...[...m.values()].map((x) => x.count));
    return [...m.values()]
      .filter((x) => max > 0 && x.count === max)
      .sort((a, b) => String(a.f3_name).localeCompare(String(b.f3_name)));
  };
  const breakdown = new Map<number, RegionAOBreakdown>();
  for (const e of raw) {
    const id = Number(e.ao_org_id ?? 0);
    const x = breakdown.get(id) ?? {
      ao_id: id,
      ao_name: e.ao_name ?? "(No AO)",
      beatdowns: 0,
    };
    x.beatdowns++;
    breakdown.set(id, x);
  }
  const leaderMap = new Map<number, Leaders>();
  for (const { e, a } of rows) {
    const id = Number(a.user_id);
    const x = leaderMap.get(id) ?? {
      user_id: id,
      f3_name: a.f3_name,
      posts: 0,
      qs: 0,
      avatar_url: a.avatar_url ?? undefined,
      all_posts: 0,
      all_qs: 0,
    };
    x.posts++;
    if (a.q_ind) x.qs++;
    leaderMap.set(id, x);
  }
  for (const x of leaderMap.values())
    for (const e of all)
      for (const a of attended(e))
        if (Number(a.user_id) === x.user_id) {
          x.all_posts!++;
          if (a.q_ind) x.all_qs!++;
        }
  const now = Date.now(),
    active = new Set<number>();
  for (const { e, a } of rows)
    if (new Date(String(e.event_date)).getTime() >= now - 30 * 86400000)
      active.add(Number(a.user_id));
  let paxCount = 0,
    fngCount = 0;
  for (const e of raw) {
    paxCount += Number(e.pax_count ?? 0);
    fngCount += Number(e.fng_count ?? 0);
  }
  const summary: RegionSummary = {
    event_count: raw.length,
    ao_count: new Set(
      raw
        .filter((e: any) => e.ao_org_id != null)
        .map((e: any) => Number(e.ao_org_id)),
    ).size,
    active_pax: active.size,
    unique_pax: ids(() => true).size,
    unique_qs: ids((a) => !!a.q_ind).size,
    fng_count: fngCount,
    pax_count_average: raw.length ? paxCount / raw.length : 0,
    fartsack_kings: countFlags("fartsack"),
    ghost_kings: countFlags("ghost"),
  };
  const range = buildRangeDates(opts?.range),
    start = opts?.startDate ?? range.startDate,
    end =
      opts?.endDate ?? range.endDate ?? new Date().toISOString().slice(0, 10);
  const days = start
      ? (Date.parse(end) - Date.parse(start)) / 86400000
      : Infinity,
    unit = days > 365 ? "month" : days > 180 ? "week" : "day";
  const bucket = (s: string) => {
    const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
    if (unit === "month") return `${s.slice(0, 7)}-01`;
    if (unit === "week") {
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    }
    return d.toISOString().slice(0, 10);
  };
  const charts = new Map<string, ChartData>();
  const chartPax = new Map<string, Set<number>>(),
    chartQs = new Map<string, Set<number>>();
  for (const e of raw) {
    const date = bucket(String(e.event_date));
    const x = charts.get(date) ?? {
      date,
      pax_count: 0,
      fng_count: 0,
      q_count: 0,
      unique_pax_count: 0,
      unique_q_count: 0,
    };
    const as = attended(e);
    x.pax_count += Number(e.pax_count ?? 0);
    x.fng_count += Number(e.fng_count ?? 0);
    x.q_count += as.filter((a: any) => !!a.q_ind).length;
    x.unique_pax_count += new Set(as.map((a: any) => Number(a.user_id))).size;
    x.unique_q_count += new Set(
      as.filter((a: any) => !!a.q_ind).map((a: any) => Number(a.user_id)),
    ).size;
    charts.set(date, x);
  }
  for (const e of raw) {
    const date = bucket(String(e.event_date));
    const as = attended(e);
    const p = chartPax.get(date) ?? new Set<number>(),
      q = chartQs.get(date) ?? new Set<number>();
    for (const a of as) {
      p.add(Number(a.user_id));
      if (a.q_ind) q.add(Number(a.user_id));
    }
    chartPax.set(date, p);
    chartQs.set(date, q);
  }
  for (const [date, x] of charts) {
    x.unique_pax_count = chartPax.get(date)?.size ?? 0;
    x.unique_q_count = chartQs.get(date)?.size ?? 0;
  }
  const chartList = [...charts.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (chartList.length > 1) {
    const filled = new Map(charts),
      cursor = new Date(`${chartList[0].date}T00:00:00Z`),
      last = new Date(`${chartList.at(-1)!.date}T00:00:00Z`);
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      if (!filled.has(key))
        filled.set(key, {
          date: key,
          pax_count: 0,
          fng_count: 0,
          q_count: 0,
          unique_pax_count: 0,
          unique_q_count: 0,
        });
      if (unit === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + (unit === "week" ? 7 : 1));
    }
    charts.clear();
    for (const [key, value] of filled) charts.set(key, value);
  }
  const prefs = await queryBigQuery<{ json_config: string | null }>(
    "SELECT json_config FROM pv_regions_preferences WHERE region_id = @regionId LIMIT 1",
    userIdentifier,
    `fetch preferences for region ${regionId}`,
    { regionId },
  );
  return {
    info: info[0] ?? null,
    events: display,
    summary,
    leaders: [...leaderMap.values()]
      .sort((a, b) => b.posts - a.posts || b.qs - a.qs)
      .slice(0, 100),
    upcoming,
    kotter,
    charts: [...charts.values()].sort((a, b) => a.date.localeCompare(b.date)),
    achievements: buildRegionAchievements(pax, career, regionId),
    aoBreakdown: [...breakdown.values()].sort(
      (a, b) => b.beatdowns - a.beatdowns || a.ao_name.localeCompare(b.ao_name),
    ),
    preferencesJson: prefs[0]?.json_config ?? null,
  };
}

export function buildRegionAchievements(
  pax: any[],
  allEvents: any[],
  regionId: number,
): RegionAchievementPax[] {
  const thresholds = [
    25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
  ];
  const attended = (e: any) =>
    (e.attendance ?? []).filter((a: any) => a.fartsack !== true);
  return pax
    .map((p) => {
      const mine = allEvents.filter((e) =>
        attended(e).some((a: any) => Number(a.user_id) === Number(p.user_id)),
      );
      const region = mine.filter((e) => Number(e.region_org_id) === regionId);
      const qs = (es: any[]) =>
        es.reduce(
          (n, e) =>
            n +
            attended(e).filter(
              (a: any) => Number(a.user_id) === Number(p.user_id) && a.q_ind,
            ).length,
          0,
        );
      const posts = (es: any[]) => es.length;
      const rp = posts(region),
        ap = posts(mine),
        rq = qs(region),
        aq = qs(mine);
      const next = (n: number) => thresholds.find((t) => t > n) ?? null;
      const first =
        p.start_date_override ??
        mine.map((e) => String(e.event_date).slice(0, 10)).sort()[0] ??
        null;
      const last =
        region
          .map((e) => String(e.event_date).slice(0, 10))
          .sort()
          .at(-1) ?? null;
      let anniversary: string | null = null;
      if (first) {
        const [, month, day] = first.slice(0, 10).split("-").map(Number),
          today = new Date();
        const isLeap = (year: number) =>
          year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const safeDay =
          month === 2 && day === 29 && !isLeap(today.getUTCFullYear())
            ? 28
            : day;
        anniversary = `${today.getUTCFullYear()}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
        if (anniversary < today.toISOString().slice(0, 10)) {
          const nextYear = today.getUTCFullYear() + 1;
          const nextDay =
            month === 2 && day === 29 && !isLeap(nextYear) ? 28 : day;
          anniversary = `${nextYear}-${String(month).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
        }
      }
      const days = anniversary
        ? Math.round(
            (Date.parse(`${anniversary}T00:00:00Z`) - Date.now()) / 86400000,
          )
        : null;
      const nextWithin = (n: number, limit: number) => {
        const milestone = next(n);
        return milestone !== null && milestone - n <= limit;
      };
      const lastTime = last ? Date.parse(`${last}T00:00:00Z`) : NaN;
      const active90 =
        Number.isFinite(lastTime) && lastTime >= Date.now() - 90 * 86400000;
      const active30 =
        Number.isFinite(lastTime) && lastTime >= Date.now() - 30 * 86400000;
      const qualifies =
        rp > 10 &&
        ((active90 &&
          (nextWithin(rp, 1) ||
            nextWithin(ap, 1) ||
            nextWithin(rq, 1) ||
            nextWithin(aq, 1) ||
            (active30 &&
              (nextWithin(rp, 5) ||
                nextWithin(ap, 5) ||
                nextWithin(rq, 3) ||
                nextWithin(aq, 3))))) ||
          (days !== null && days >= 0 && days <= 14 && rp >= 25));
      return {
        user_id: p.user_id,
        f3_name: p.f3_name,
        avatar_url: p.avatar_url ?? undefined,
        region_posts: rp,
        region_qs: rq,
        all_posts: ap,
        all_qs: aq,
        next_region_post_milestone: next(rp),
        next_nation_post_milestone: next(ap),
        next_region_q_milestone: next(rq),
        next_nation_q_milestone: next(aq),
        fng_date: first,
        next_anniversary_date: anniversary,
        days_until_anniversary: days,
        last_region_event_date: last,
        qualifies,
      };
    })
    .filter((p) => p.qualifies)
    .map(({ qualifies: _qualifies, ...p }) => p)
    .sort((a, b) => a.f3_name.localeCompare(b.f3_name));
}

async function getRegionPageDuckDb(
  regionId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<RegionPageData> {
  const [infoRows, events, upcoming, kotter] = await Promise.all([
    executeDuckDb<RegionInfo>(
      `SELECT region_id, region_name, area_id, area_name, logo_url, is_active, aos, types, tags FROM pv_regions WHERE region_id = ? LIMIT 1`,
      [regionId],
    ),
    getRegionEventsDuckDb(regionId, { ...opts, limit: 100 }),
    executeDuckDb<EventUpcoming>(
      `SELECT start_date, start_time, ao_name, ao_org_id, location_name, event_name, event_type, event_category, q_list FROM pv_upcoming WHERE region_org_id = ? ORDER BY start_date, start_time, ao_name LIMIT 50`,
      [regionId],
    ),
    executeDuckDb<RegionKotterList>(
      `SELECT user_id, f3_name, avatar_url, kotter_status, total_events, first_event_date, days_since_last_event, last_event_date, last_event_name, last_event_ao_name, last_event_ao_org_id, bestie_list FROM pv_kotter WHERE home_region_id = ? ORDER BY days_since_last_event, last_event_date, f3_name`,
      [regionId],
    ),
  ]);
  const active = new Set<number>(),
    users = new Set<number>(),
    qs = new Set<number>();
  const farts = new Map<
    number,
    { user_id: number; f3_name: string; count: number }
  >();
  const ghosts = new Map<
    number,
    { user_id: number; f3_name: string; count: number }
  >();
  let fng = 0,
    pax = 0;
  const breakdown = new Map<
    number,
    { ao_id: number; ao_name: string; beatdowns: number }
  >();
  for (const event of events) {
    fng += Number(event.fng_count ?? 0);
    pax += Number(event.pax_count ?? 0);
    const ao = Number(event.ao_org_id ?? 0);
    const key = ao;
    const b = breakdown.get(key) ?? {
      ao_id: key,
      ao_name: event.ao_name ?? "(No AO)",
      beatdowns: 0,
    };
    b.beatdowns++;
    breakdown.set(key, b);
    for (const a of event.attendance ?? []) {
      const id = Number(a.user_id);
      if (!Number.isFinite(id)) continue;
      users.add(id);
      if (a.q_ind) qs.add(id);
      if (
        new Date(String(event.event_date)).getTime() >=
        Date.now() - 30 * 86400000
      )
        active.add(id);
      if (a.fartsack) {
        const x = farts.get(id) ?? {
          user_id: id,
          f3_name: a.f3_name,
          count: 0,
        };
        x.count++;
        farts.set(id, x);
      }
      if (a.ghost) {
        const x = ghosts.get(id) ?? {
          user_id: id,
          f3_name: a.f3_name,
          count: 0,
        };
        x.count++;
        ghosts.set(id, x);
      }
    }
  }
  const kings = (m: typeof farts) => {
    const max = Math.max(0, ...[...m.values()].map((x) => x.count));
    return [...m.values()]
      .filter((x) => x.count === max && max > 0)
      .sort((a, b) => a.f3_name.localeCompare(b.f3_name));
  };
  const leaderMap = new Map<number, Leaders>();
  for (const e of events)
    for (const a of e.attendance ?? []) {
      const id = Number(a.user_id);
      const l = leaderMap.get(id) ?? {
        user_id: id,
        f3_name: a.f3_name,
        posts: 0,
        qs: 0,
        avatar_url: a.avatar_url ?? undefined,
      };
      l.posts++;
      if (a.q_ind) l.qs++;
      leaderMap.set(id, l);
    }
  const summary: RegionSummary = {
    event_count: events.length,
    ao_count: breakdown.size,
    active_pax: active.size,
    unique_pax: users.size,
    unique_qs: qs.size,
    fng_count: fng,
    pax_count_average: events.length ? pax / events.length : 0,
    fartsack_kings: kings(farts),
    ghost_kings: kings(ghosts),
  };
  const leaders = [...leaderMap.values()]
    .sort((a, b) => b.posts - a.posts || b.qs - a.qs)
    .slice(0, 100);
  const chartMap = new Map<string, ChartData>();
  for (const e of events) {
    const date = String(e.event_date).slice(0, 10);
    const c = chartMap.get(date) ?? {
      date,
      pax_count: 0,
      fng_count: 0,
      q_count: 0,
      unique_pax_count: 0,
      unique_q_count: 0,
    };
    c.pax_count += Number(e.pax_count ?? 0);
    c.fng_count += Number(e.fng_count ?? 0);
    const ids = new Set<number>(),
      qids = new Set<number>();
    for (const a of e.attendance ?? []) {
      ids.add(Number(a.user_id));
      if (a.q_ind) qids.add(Number(a.user_id));
    }
    c.q_count += qids.size;
    c.unique_pax_count += ids.size;
    c.unique_q_count += qids.size;
    chartMap.set(date, c);
  }
  return {
    info: infoRows[0] ?? null,
    events,
    summary,
    leaders,
    upcoming,
    kotter,
    charts: [...chartMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    achievements: [],
    aoBreakdown: [...breakdown.values()].sort(
      (a, b) => b.beatdowns - a.beatdowns || a.ao_name.localeCompare(b.ao_name),
    ),
    preferencesJson: null,
  };
}
