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
  AOInfo,
  EventData,
  AOSummary,
  Leaders,
  EventUpcoming,
} from "@/lib/types";
import { StatsFilters, toFiniteNumbers } from "@/lib/filters";

type DuckDbExecutor = <T>(sql: string, params?: DuckDbParams) => Promise<T[]>;
let injectedDuckDbQuery: DuckDbExecutor | undefined;
export function setAoDuckDbQueryForTests(query?: DuckDbExecutor): void {
  injectedDuckDbQuery = query;
}
const executeDuckDb: DuckDbExecutor = async (sql, params) => {
  const adapter = injectedDuckDbQuery
    ? undefined
    : new DuckDbQueryAdapter(getDuckDbRuntime());
  return (injectedDuckDbQuery ?? adapter!.execute.bind(adapter))(sql, params);
};

function duckAoFilter(aoId: number, opts?: StatsFilters) {
  const clauses = ["ao_org_id = ?"],
    params: unknown[] = [aoId];
  const range = buildRangeDates(opts?.range),
    start = opts?.startDate ?? range.startDate,
    end = opts?.endDate ?? range.endDate;
  if (start) {
    clauses.push("event_date >= CAST(? AS DATE)");
    params.push(start);
  }
  if (end) {
    clauses.push("event_date <= CAST(? AS DATE)");
    params.push(end);
  }
  const add = (column: string, values: number[] | undefined, mode: string) => {
    const ids = toFiniteNumbers(values);
    if (!ids.length) return;
    clauses.push(
      `${mode === "exclude" ? "NOT " : ""}EXISTS (SELECT 1 FROM UNNEST(${column}) u WHERE u.unnest.id IN (${ids.map(() => "?").join(",")}))`,
    );
    params.push(...ids);
  };
  add("tags", opts?.tagIds, opts?.tagMode ?? "include");
  add("types", opts?.typeIds, opts?.typeMode ?? "include");
  const cats = toFiniteNumbers(opts?.categoryIds).filter(
    (x) => x >= 1 && x <= 3,
  );
  if (cats.length)
    clauses.push(
      `${opts?.categoryMode === "exclude" ? "NOT " : ""}(${cats.map((x) => `${["", "first_f_ind", "second_f_ind", "third_f_ind"][x]} = 1`).join(" OR ")})`,
    );
  return { where: clauses.join(" AND "), params };
}

async function getAoEventsDuckDb(
  aoId: number,
  opts?: StatsFilters & { limit?: number },
) {
  const f = duckAoFilter(aoId, opts);
  const limited = Number.isFinite(opts?.limit) && Number(opts?.limit) > 0;
  if (limited) {
    f.params.push(Number(opts!.limit));
  }
  return executeDuckDb<EventData>(
    `SELECT event_id AS event_instance_id, event_date, event_name, pax_count, fng_count, ao_org_id, ao_name, region_org_id, region_name, first_f_ind, second_f_ind, third_f_ind, types, tags, list_filter(attendance, x -> x.fartsack IS NOT TRUE) AS attendance, list_filter(attendance, x -> x.fartsack IS TRUE) AS fartsacks FROM pv_events WHERE ${f.where} ORDER BY event_date DESC, event_id DESC${limited ? " LIMIT ?" : ""}`,
    f.params,
  );
}

/**
 * Build a BigQuery WHERE clause for pv_events-based queries.
 *
 * Behavior:
 * - Always filters by `ao_org_id`.
 * - Date range filtering uses (start,end) if both provided, else >= start or <= end.
 * - tagIds/typeIds use EXISTS / NOT EXISTS against the nested arrays.
 * - categories maps 1/2/3 to first_f_ind/second_f_ind/third_f_ind and combines with OR.
 */
function buildEventsWhereSql(aoId: number, opts?: StatsFilters): string {
  const rangeDates = buildRangeDates(opts?.range);
  const startDate = opts?.startDate ?? rangeDates.startDate;
  const endDate = opts?.endDate ?? rangeDates.endDate;

  const tagMode = opts?.tagMode ?? "include";
  const typeMode = opts?.typeMode ?? "include";
  const categoryMode = opts?.categoryMode ?? "include";

  // Normalize lists.
  const tagList = toFiniteNumbers(opts?.tagIds);
  const typeList = toFiniteNumbers(opts?.typeIds);
  const categoryList = toFiniteNumbers(opts?.categoryIds).filter(
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
 * Fetch events for a AO with optional filtering.
 */
export async function getEvents(
  aoId: number,
  userIdentifier?: string,
  opts?: StatsFilters & {
    limit?: number;
  },
): Promise<EventData[] | null> {
  return selectDuckDbOrLegacy({
    capability: "events",
    env: process.env,
    duckdb: () => getAoEventsDuckDb(aoId, opts),
    legacy: async () => {
      // LIMIT is optional. Keep it numeric-only.
      const limit = Number.isFinite(opts?.limit)
        ? Number(opts!.limit)
        : undefined;
      const limitSql = limit ? `LIMIT ${limit}` : "";

      const query = `-- AO EVENTS
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
    WHERE ao_org_id = ${aoId}
    ORDER BY event_date DESC, event_id DESC
    ${limitSql};
  `;

      const results = await queryBigQuery<EventData>(
        query,
        userIdentifier,
        `fetch events for AO ${aoId}`,
      );
      return results || null;
    },
  });
}

export async function getPageData(
  aoId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<{
  info: AOInfo | null;
  events: EventData[] | null;
  summary: AOSummary | null;
  leaders: Leaders[] | null;
  upcoming: EventUpcoming[] | null;
  /** Raw `json_config` inherited from the parent region; null when unset. */
  preferencesJson: string | null;
}> {
  const page = await selectDuckDbOrLegacy({
    capability: "stats_ao",
    env: process.env,
    duckdb: () => getAoPageDuckDbParity(aoId, userIdentifier, opts),
    legacy: async () => {
      // Build WHERE clause from common filters.
      const whereSql = buildEventsWhereSql(aoId, opts);

      const preferenceProjection = `(SELECT p.json_config FROM pv_regions_preferences p WHERE p.region_id = (SELECT region_id FROM pv_aos WHERE ao_id = ${aoId} LIMIT 1) LIMIT 1) AS preferencesJson`;
      const query = `-- AO PAGE LOAD
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
          -- Strip fartsack (no-show) PAX once here so attendance_flat (and thus
          -- active_pax/unique_pax, the leaders' post counts) and the events list
          -- all exclude no-shows. 'fartsack IS NOT TRUE' keeps legacy rows
          -- (flag NULL/FALSE) + real attendees.
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
      -- unannounced posts (ghosts) at this AO. Both flags are counted from the
      -- raw pv_events table (same filters via whereSql): fartsacks are stripped
      -- from the events CTE above, and ghosts are counted the same way for
      -- consistency. All PAX tied at the top count are kept so the UI can
      -- surface ties; empty when nobody has any.
      flag_counts AS (
        SELECT
          a.user_id,
          ANY_VALUE(a.f3_name) AS f3_name,
          COUNTIF(a.fartsack IS TRUE) AS fartsack_count,
          COUNTIF(a.ghost IS TRUE) AS ghost_count
        FROM pv_events e, UNNEST(e.attendance) a
        ${whereSql ? `${whereSql}\n          AND (a.fartsack IS TRUE OR a.ghost IS TRUE)` : "WHERE (a.fartsack IS TRUE OR a.ghost IS TRUE)"}
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
      )

    SELECT
      -- AO info as a STRUCT
      (
        SELECT AS STRUCT
          ao_id, ao_name, region_id, region_name, logo_url, is_active, types, tags
        FROM pv_aos
        WHERE ao_id = ${aoId}
        LIMIT 1
      ) AS info,

      -- Preferences INHERITED from this AO's parent region: an AO has no
      -- preferences of its own, it renders under whatever its region set.
      -- Resolved here (rather than by a second query) to hold the
      -- single-query-per-page rule. NULL when the parent region has never
      -- saved preferences, in which case the loader applies defaults.
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
            LIMIT 100
        )
        FROM events
      ) AS events,

      -- Summary as a STRUCT
      (
        WITH
          event_metrics AS (
            SELECT
              COUNT(DISTINCT event_id) AS event_count,
              SUM(COALESCE(fng_count, 0)) AS fng_count,
              AVG(CAST(pax_count AS FLOAT64)) AS pax_count_average
            FROM events
          ),
          attendance_metrics AS (
            SELECT
              COUNT(DISTINCT IF(event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), user_id, NULL)) AS active_pax,
              COUNT(DISTINCT user_id) AS unique_pax,
              COUNT(DISTINCT IF(q_ind = 1, user_id, NULL)) AS unique_qs
            FROM attendance_flat
          )
        SELECT AS STRUCT
          em.event_count,
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

      -- Leaders as an ARRAY (fixed)
      (
        SELECT
          ARRAY_AGG(
            STRUCT(
              user_id,
              f3_name,
              posts,
              qs,
              avatar_url)
            ORDER BY posts DESC
            LIMIT 100)
        FROM
          (
            SELECT
              user_id,
              ANY_VALUE(f3_name) AS f3_name,
              COUNT(DISTINCT event_id) AS posts,
              COUNTIF(q_ind = 1) AS qs,
              ANY_VALUE(avatar_url) AS avatar_url
            FROM attendance_flat
            GROUP BY user_id
          )
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
        WHERE ao_org_id = ${aoId}
      ) AS upcoming
    `;

      const results = await queryBigQuery<{
        info: AOInfo;
        events: EventData[];
        summary: AOSummary;
        leaders: Leaders[];
        upcoming: EventUpcoming[];
        preferencesJson: string | null;
      }>(query, userIdentifier, `fetch page data for AO ${aoId}`);

      const preferencesJson = results?.[0]?.preferencesJson ?? null;
      return {
        info: results?.[0]?.info || null,
        events: results?.[0]?.events || null,
        summary: results?.[0]?.summary || null,
        leaders: results?.[0]?.leaders || null,
        upcoming: results?.[0]?.upcoming || null,
        preferencesJson,
      };
    },
  });
  if (page.preferencesJson !== null) return page;
  const preferences = await queryBigQuery<{ json_config: string | null }>(
    "SELECT p.json_config FROM pv_regions_preferences p WHERE p.region_id = (SELECT region_id FROM pv_aos WHERE ao_id = @aoId LIMIT 1) LIMIT 1",
    userIdentifier,
    `fetch preferences for AO ${aoId}`,
    { aoId },
  );
  return { ...page, preferencesJson: preferences[0]?.json_config ?? null };
}

export async function searchAOsByName(
  q: string,
  userIdentifier?: string,
  includeInactive = false,
): Promise<AOInfo[]> {
  const term = (q || "").trim();
  if (term.length < 2) return [];

  const likePattern = `%${term.toLowerCase()}%`;

  return selectDuckDbOrLegacy({
    capability: "search",
    env: process.env,
    duckdb: () =>
      executeDuckDb<AOInfo>(
        `SELECT ao_id, ao_name, region_id, region_name, logo_url, is_active FROM pv_aos WHERE ao_name IS NOT NULL AND lower(ao_name) LIKE ? ${includeInactive ? "" : "AND is_active = TRUE"} ORDER BY ao_name LIMIT 50`,
        [likePattern],
      ),
    legacy: async () => {
      const query = `-- AO SEARCH
    SELECT
      ao_id,
      ao_name,
      region_id,
      region_name,
      logo_url,
      is_active
    FROM pv_aos
    WHERE ao_name IS NOT NULL
      AND LOWER(ao_name) LIKE @term
      ${includeInactive ? "" : "AND is_active = TRUE"}
    ORDER BY ao_name
    LIMIT 50
  `;

      const results = await queryBigQuery<AOInfo>(
        query,
        userIdentifier,
        `search AOs by name: ${q}`,
        { term: likePattern },
      );
      return results ?? [];
    },
  });
}

type AOPageData = Awaited<ReturnType<typeof getPageData>>;

async function getAoPageDuckDbParity(
  aoId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<AOPageData> {
  const f = duckAoFilter(aoId, opts);
  const [info, raw, upcoming] = await Promise.all([
    executeDuckDb<AOInfo>(
      `SELECT ao_id, ao_name, region_id, region_name, logo_url, is_active, types, tags FROM pv_aos WHERE ao_id = ? LIMIT 1`,
      [aoId],
    ),
    executeDuckDb<any>(
      `SELECT event_id AS event_instance_id, event_date, event_name, pax_count, fng_count, ao_org_id, ao_name, region_org_id, region_name, first_f_ind, second_f_ind, third_f_ind, types, tags, attendance FROM pv_events WHERE ${f.where} ORDER BY event_date DESC, event_id DESC`,
      f.params,
    ),
    executeDuckDb<EventUpcoming>(
      `SELECT start_date, start_time, ao_name, ao_org_id, location_name, event_name, event_type, event_category, q_list FROM pv_upcoming WHERE ao_org_id = ? ORDER BY start_date, start_time, ao_name LIMIT 50`,
      [aoId],
    ),
  ]);
  const attended = (e: any) =>
    (e.attendance ?? []).filter(
      (a: any) => a.fartsack !== true && a.user_id != null,
    );
  const rows = raw.flatMap((e: any) => attended(e).map((a: any) => ({ e, a })));
  const users = new Set(rows.map((x: any) => Number(x.a.user_id))),
    qs = new Set(
      rows.filter((x: any) => x.a.q_ind).map((x: any) => Number(x.a.user_id)),
    );
  const active = new Set(
    rows
      .filter(
        (x: any) =>
          new Date(String(x.e.event_date)).getTime() >=
          Date.now() - 30 * 86400000,
      )
      .map((x: any) => Number(x.a.user_id)),
  );
  const leaders = new Map<number, Leaders>();
  for (const { a } of rows) {
    const id = Number(a.user_id);
    const x = leaders.get(id) ?? {
      user_id: id,
      f3_name: a.f3_name,
      posts: 0,
      qs: 0,
      avatar_url: a.avatar_url ?? undefined,
    };
    x.posts++;
    if (a.q_ind) x.qs++;
    leaders.set(id, x);
  }
  const kings = (flag: string) => {
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
  let fng = 0,
    pax = 0;
  for (const e of raw) {
    fng += Number(e.fng_count ?? 0);
    pax += Number(e.pax_count ?? 0);
  }
  const first =
    raw.map((e: any) => String(e.event_date).slice(0, 10)).sort()[0] ?? null;
  return {
    info: info[0] ?? null,
    events: raw.slice(0, 100).map((e: any) => ({
      ...e,
      attendance: attended(e),
      fartsacks: (e.attendance ?? []).filter((a: any) => a.fartsack === true),
    })),
    upcoming,
    leaders: [...leaders.values()]
      .sort((a, b) => b.posts - a.posts || b.qs - a.qs)
      .slice(0, 100),
    summary: {
      event_count: raw.length,
      first_event_date: first,
      active_pax: active.size,
      unique_pax: users.size,
      unique_qs: qs.size,
      fng_count: fng,
      pax_count_average: raw.length ? pax / raw.length : 0,
      fartsack_kings: kings("fartsack"),
      ghost_kings: kings("ghost"),
    },
    preferencesJson: null,
  };
}

async function getAoPageDuckDb(
  aoId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<AOPageData> {
  const [infoRows, events, upcoming] = await Promise.all([
    executeDuckDb<AOInfo>(
      `SELECT ao_id, ao_name, region_id, region_name, logo_url, is_active, types, tags FROM pv_aos WHERE ao_id = ? LIMIT 1`,
      [aoId],
    ),
    getAoEventsDuckDb(aoId, { ...opts, limit: 100 }),
    executeDuckDb<EventUpcoming>(
      `SELECT start_date, start_time, ao_name, ao_org_id, location_name, event_name, event_type, event_category, q_list FROM pv_upcoming WHERE ao_org_id = ? ORDER BY start_date, start_time, ao_name LIMIT 50`,
      [aoId],
    ),
  ]);
  const users = new Set<number>(),
    active = new Set<number>(),
    qs = new Set<number>();
  let fng = 0,
    pax = 0;
  const kings = (flag: "fartsack" | "ghost") => {
    const counts = new Map<
      number,
      { user_id: number; f3_name: string; count: number }
    >();
    for (const e of events)
      for (const a of e.attendance ?? [])
        if (a[flag]) {
          const x = counts.get(Number(a.user_id)) ?? {
            user_id: Number(a.user_id),
            f3_name: a.f3_name,
            count: 0,
          };
          x.count++;
          counts.set(x.user_id, x);
        }
    const max = Math.max(0, ...[...counts.values()].map((x) => x.count));
    return [...counts.values()]
      .filter((x) => x.count === max && max > 0)
      .sort((a, b) => a.f3_name.localeCompare(b.f3_name));
  };
  const leaderMap = new Map<number, Leaders>();
  for (const e of events) {
    fng += Number(e.fng_count ?? 0);
    pax += Number(e.pax_count ?? 0);
    for (const a of e.attendance ?? []) {
      const id = Number(a.user_id);
      users.add(id);
      if (a.q_ind) qs.add(id);
      if (
        new Date(String(e.event_date)).getTime() >=
        Date.now() - 30 * 86400000
      )
        active.add(id);
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
  }
  const firstEvent = events.reduce<string | null>((first, event) => {
    const date = String(event.event_date);
    return first === null || date < first ? date : first;
  }, null);
  return {
    info: infoRows[0] ?? null,
    events,
    upcoming,
    leaders: [...leaderMap.values()]
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 100),
    summary: {
      event_count: events.length,
      first_event_date: firstEvent,
      active_pax: active.size,
      unique_pax: users.size,
      unique_qs: qs.size,
      fng_count: fng,
      pax_count_average: events.length ? pax / events.length : 0,
      fartsack_kings: kings("fartsack"),
      ghost_kings: kings("ghost"),
    },
    // Preferences are BQ-owned and are intentionally absent from the pure
    // DuckDB shadow implementation.
    preferencesJson: null,
  };
}
