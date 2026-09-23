import { queryBigQuery } from "@/lib/db";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { DuckDbQueryAdapter, selectDuckDbOrLegacy } from "@/lib/duckdb/query";
import {
  ActivityWindow,
  EventData,
  PaxSummary,
  PAXInfo,
  PaxAOBreakdown,
  PaxAOWeeklyActivity,
} from "@/lib/types";
import { StatsFilters, toFiniteNumbers } from "@/lib/filters";
import {
  ACTIVITY_MAX_WEEKS,
  ACTIVITY_WEEKS,
  addWeeks,
  startOfWeekISO,
} from "@/lib/activityMatrix";

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
function buildEventsWhereSql(
  paxId: number,
  opts?: StatsFilters,
  // Predicate applied to the PAX's attendance row inside the EXISTS gate.
  // Defaults to "physically posted" (no-shows excluded). Pass
  // `a.fartsack IS TRUE` to instead select events the PAX signed up for but
  // no-showed — those rows are otherwise stripped at the events CTE.
  attendancePredicate: string = "a.fartsack IS NOT TRUE",
): string {
  const rangeDates = buildRangeDates(opts?.range);
  const startDate = opts?.startDate ?? rangeDates.startDate;
  const endDate = opts?.endDate ?? rangeDates.endDate;

  const regionMode = opts?.regionMode ?? "include";
  const aoMode = opts?.aoMode ?? "include";
  const tagMode = opts?.tagMode ?? "include";
  const typeMode = opts?.typeMode ?? "include";
  const categoryMode = opts?.categoryMode ?? "include";

  // Normalize lists.
  const regionList = toFiniteNumbers(opts?.regionIds);
  const aoList = toFiniteNumbers(opts?.aoIds);
  const tagList = toFiniteNumbers(opts?.tagIds);
  const typeList = toFiniteNumbers(opts?.typeIds);
  const categoryList = toFiniteNumbers(opts?.categoryIds).filter(
    (c) => c === 1 || c === 2 || c === 3,
  );

  const whereClauses: string[] = [];
  // Attendance filter: only include events where the given PAX actually attended.
  // `a.fartsack IS NOT TRUE` excludes events the PAX signed up for but no-showed
  // (and keeps legacy rows where the flag is NULL/FALSE).
  whereClauses.push(
    `EXISTS (
      SELECT 1
      FROM UNNEST(attendance) a
      WHERE a.user_id = ${paxId}
        AND ${attendancePredicate}
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
    const includesNull = aoList.includes(0);
    const ids = aoList.filter((id) => id !== 0);
    const nonNull = ids.length ? `ao_org_id IN (${ids.join(",")})` : "FALSE";
    whereClauses.push(
      aoMode === "exclude"
        ? `(ao_org_id IS NOT NULL AND ${ids.length ? `ao_org_id NOT IN (${ids.join(",")})` : "TRUE"})`
        : `(${includesNull ? "ao_org_id IS NULL" : "FALSE"}${ids.length ? ` OR ${nonNull}` : ""})`,
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
 * Resolve the week window the activity matrix should span.
 *
 * - No date filter: the trailing `ACTIVITY_WEEKS` weeks, so the card has a
 *   sensible default instead of stretching across a PAX's whole career.
 * - Date filter set: exactly that range, so the matrix agrees with every other
 *   card on the page — capped at `ACTIVITY_MAX_WEEKS` columns, because a
 *   multi-year custom range would otherwise render hundreds of columns.
 *
 * Both bounds are snapped to Mondays to line up with the WEEK(MONDAY) buckets.
 */
function buildActivityWindow(opts?: StatsFilters): ActivityWindow {
  const rangeDates = buildRangeDates(opts?.range);
  const filterStart = opts?.startDate ?? rangeDates.startDate;
  const filterEnd = opts?.endDate ?? rangeDates.endDate;

  const today = new Date().toISOString().split("T")[0];
  const end = startOfWeekISO(filterEnd ?? today);

  let start = filterStart
    ? startOfWeekISO(filterStart)
    : addWeeks(end, -(ACTIVITY_WEEKS - 1));

  // Guard against an absurdly wide custom range.
  const capStart = addWeeks(end, -(ACTIVITY_MAX_WEEKS - 1));
  if (start < capStart) start = capStart;
  // A start after the end (nonsense filter) collapses to a single week.
  if (start > end) start = end;

  return { start, end, isDefault: !filterStart && !filterEnd };
}

/**
 * Fetch events for a PAX with optional filtering.
 */
export async function getEvents(
  paxId: number,
  userIdentifier?: string,
  opts?: StatsFilters & {
    limit?: number;
  },
): Promise<EventData[] | null> {
  return selectDuckDbOrLegacy({
    capability: "events",
    env: process.env,
    duckdb: async () => {
      const limit = Number.isFinite(opts?.limit)
        ? Number(opts!.limit)
        : undefined;
      const adapter = new DuckDbQueryAdapter(getDuckDbRuntime());
      const clauses = [
        `EXISTS (SELECT 1 FROM UNNEST(attendance) AS u(a)
                 WHERE a.user_id = ? AND a.fartsack IS NOT TRUE)`,
      ];
      const params: unknown[] = [paxId];
      const ranges = buildRangeDates(opts?.range);
      const start = opts?.startDate ?? ranges.startDate;
      const end = opts?.endDate ?? ranges.endDate;
      if (start) {
        clauses.push("event_date >= CAST(? AS DATE)");
        params.push(start);
      }
      if (end) {
        clauses.push("event_date <= CAST(? AS DATE)");
        params.push(end);
      }
      const add = (
        column: string,
        values: number[] | undefined,
        mode = "include",
      ) => {
        const ids = toFiniteNumbers(values);
        if (!ids.length) return;
        clauses.push(
          `${column} ${mode === "exclude" ? "NOT IN" : "IN"} (${ids.map(() => "?").join(",")})`,
        );
        params.push(...ids);
      };
      const aoIds = toFiniteNumbers(opts?.aoIds);
      if (aoIds.length) {
        const includesNull = aoIds.includes(0);
        const ids = aoIds.filter((id) => id !== 0);
        clauses.push(
          opts?.aoMode === "exclude"
            ? `(ao_org_id IS NOT NULL AND ${ids.length ? `ao_org_id NOT IN (${ids.map(() => "?").join(",")})` : "TRUE"})`
            : `(${includesNull ? "ao_org_id IS NULL" : "FALSE"}${ids.length ? ` OR ao_org_id IN (${ids.map(() => "?").join(",")})` : ""})`,
        );
        params.push(...ids);
      }
      // AO filters are handled above because 0 is the NULL-AO sentinel.
      add("region_org_id", opts?.regionIds, opts?.regionMode);
      const nested = (
        column: string,
        values: number[] | undefined,
        mode = "include",
      ) => {
        const ids = toFiniteNumbers(values);
        if (!ids.length) return;
        const exists = `EXISTS (SELECT 1 FROM UNNEST(${column}) AS u(x) WHERE x.id IN (${ids.map(() => "?").join(",")}))`;
        clauses.push(mode === "exclude" ? `NOT (${exists})` : exists);
        params.push(...ids);
      };
      nested("tags", opts?.tagIds, opts?.tagMode);
      nested("types", opts?.typeIds, opts?.typeMode);
      const categories = toFiniteNumbers(opts?.categoryIds).filter((x) =>
        [1, 2, 3].includes(x),
      );
      if (categories.length)
        clauses.push(
          `${opts?.categoryMode === "exclude" ? "NOT " : ""}(${categories.map((x) => `${["", "first_f_ind", "second_f_ind", "third_f_ind"][x]} = 1`).join(" OR ")})`,
        );
      const rows = await adapter.execute<EventData>(
        `SELECT event_id AS event_instance_id, event_date, event_name, pax_count,
          fng_count, ao_org_id, ao_name, region_org_id, region_name,
          first_f_ind, second_f_ind, third_f_ind, types, tags,
          list_filter(attendance, a -> a.fartsack IS NOT TRUE) AS attendance,
          list_filter(attendance, a -> a.fartsack IS TRUE) AS fartsacks
         FROM pv_events
         WHERE ${clauses.join(" AND ")}
         ORDER BY event_date DESC, event_id DESC${limit === undefined ? "" : " LIMIT ?"}`,
        limit === undefined ? params : [...params, limit],
      );
      const attendedRows = rows.filter((event) =>
        (event.attendance ?? []).some((a) => Number(a.user_id) === paxId),
      );
      return attendedRows.length ? attendedRows : null;
    },
    legacy: async () => getEventsLegacy(paxId, userIdentifier, opts),
  });
}

async function getEventsLegacy(
  paxId: number,
  userIdentifier?: string,
  opts?: StatsFilters & { limit?: number },
): Promise<EventData[] | null> {
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
      region_name,
      first_f_ind,
      second_f_ind,
      third_f_ind,
      types,
      tags,
      ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance,
      ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS TRUE) AS fartsacks
    FROM pv_events
    WHERE EXISTS (
      SELECT 1
      FROM UNNEST(attendance) a
      WHERE a.user_id = ${paxId}
        AND a.fartsack IS NOT TRUE
    )
    ORDER BY event_date DESC, event_id DESC
    ${limitSql};
  `;

  const results = await queryBigQuery<EventData>(
    query,
    userIdentifier,
    `fetch events for PAX ${paxId}`,
  );
  return results || null;
}

/** The signed-in user's own PAX record, as far as we can resolve it. */
export type PaxIdentity = {
  paxId: number;
  /** Null when the PAX has no pv_pax row yet, or no home region set. */
  homeRegionId: number | null;
};

/**
 * Resolve a signed-in email to that person's own PAX id and home region.
 *
 * Powers the "Your Stats" / "Your Region" shortcuts: the email lives in the
 * auth system, the PAX id in `users`, and the home region in `pv_pax`. The
 * LEFT JOIN keeps the PAX id usable even when there's no pv_pax row.
 */
export async function getPaxIdentityByEmail(
  email: string,
  userIdentifier?: string,
): Promise<PaxIdentity | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const query = `-- PAX IDENTITY BY EMAIL
    SELECT
      u.id AS pax_id,
      p.home_region_id AS home_region_id
    FROM \`f3data.public.users\` u
    LEFT JOIN pv_pax p ON p.user_id = u.id
    WHERE u.email IS NOT NULL
      AND LOWER(u.email) = @email
    -- Duplicate user rows sharing an email resolve to the lowest id, matching
    -- the MIN(id) rule in lib/bq/permissions.ts, so the answer is stable
    -- across requests (the 8 Box owner check depends on that).
    ORDER BY u.id
    LIMIT 1
  `;
  const results = await queryBigQuery<{
    pax_id: number;
    home_region_id: number | null;
  }>(query, userIdentifier, "lookup pax identity by email", {
    email: normalizedEmail,
  });

  const row = results?.[0];
  if (!row || row.pax_id == null) return null;

  return {
    paxId: Number(row.pax_id),
    homeRegionId:
      row.home_region_id == null ? null : Number(row.home_region_id),
  };
}

export async function searchUsersByName(
  q: string,
  userIdentifier?: string,
  regionId?: number,
): Promise<PAXInfo[]> {
  return selectDuckDbOrLegacy({
    capability: "search",
    env: process.env,
    duckdb: async () => {
      const term = (q || "").trim();
      if (term.length < 2) return [];
      const adapter = new DuckDbQueryAdapter(getDuckDbRuntime());
      return adapter.execute<PAXInfo>(
        `SELECT user_id, f3_name, home_region_id, home_region_name,
                avatar_url, status
           FROM pv_pax
          WHERE f3_name IS NOT NULL AND lower(f3_name) LIKE ?
            ${Number.isFinite(regionId) && regionId !== undefined ? "AND home_region_id = ?" : ""}
          ORDER BY f3_name LIMIT 50`,
        Number.isFinite(regionId) && regionId !== undefined
          ? [`%${term.toLowerCase()}%`, Number(regionId)]
          : [`%${term.toLowerCase()}%`],
      );
    },
    legacy: async () => searchUsersByNameLegacy(q, userIdentifier, regionId),
  });
}

async function searchUsersByNameLegacy(
  q: string,
  userIdentifier?: string,
  regionId?: number,
): Promise<PAXInfo[]> {
  // Normalize and guard against overly-broad queries.
  const term = (q || "").trim();
  if (term.length < 2) return [];

  // Bound as a query parameter (@term) — no manual escaping needed.
  const likePattern = `%${term.toLowerCase()}%`;

  // Optional region filter: only include PAX whose home region matches.
  const regionFilter =
    Number.isFinite(regionId) && regionId !== undefined
      ? `AND home_region_id = ${Number(regionId)}`
      : "";

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
      AND LOWER(f3_name) LIKE @term
      ${regionFilter}
    ORDER BY f3_name
    LIMIT 50
  `;

  const results = await queryBigQuery<PAXInfo>(
    query,
    userIdentifier,
    `search users by name: ${q}`,
    { term: likePattern },
  );
  return results ?? [];
}

export async function getPageData(
  paxId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<{
  info: PAXInfo | null;
  events: EventData[] | null;
  summary: PaxSummary | null;
  ao_breakdown: PaxAOBreakdown[] | null;
  ao_weekly: PaxAOWeeklyActivity[] | null;
  activity_window: ActivityWindow;
}> {
  return selectDuckDbOrLegacy({
    capability: "stats_pax",
    env: process.env,
    duckdb: () => getPaxPageDataDuckDb(paxId, opts),
    legacy: () => getPaxPageDataLegacy(paxId, userIdentifier, opts),
  });
}

async function getPaxPageDataLegacy(
  paxId: number,
  userIdentifier?: string,
  opts?: StatsFilters,
): Promise<Awaited<ReturnType<typeof getPageData>>> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(paxId, opts);

  // Window for the activity matrix. Its columns are weeks, so the active date
  // filter has to decide how many columns there are — not just which cells are
  // populated. Resolved from the same inputs as the WHERE clause above so the
  // axis can never disagree with the data plotted on it.
  const activityWindow = buildActivityWindow(opts);
  // Fartsacks (signed up, no-showed) are stripped from the events CTE, so count
  // them straight from pv_events using the same filters but the inverse
  // attendance gate.
  const fartsackWhereSql = buildEventsWhereSql(
    paxId,
    opts,
    "a.fartsack IS TRUE",
  );

  const query = `-- PAX PAGE LOAD
    WITH
      -- -----------------------
      -- PAX info
      -- -----------------------
      pax_info AS (
        SELECT
          user_id,
          f3_name,
          home_region_id,
          home_region_name,
          avatar_url,
          status,
          start_date_override,
          aos,
          regions,
          types,
          tags
        FROM pv_pax
        WHERE user_id = ${paxId}
        LIMIT 1
      ),

      -- -----------------------
      -- Events this PAX attended
      -- -----------------------
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
          -- Strip fartsack (no-show) PAX once here so every downstream CTE that
          -- unnests e.attendance (attendance_flat, co_attendance, ao_events) and
          -- the final events array all exclude no-shows. 'fartsack IS NOT TRUE'
          -- preserves legacy rows (flag NULL/FALSE) and real attendees.
          ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS NOT TRUE) AS attendance,
          -- Display-only roster of the no-shows; never consumed by any aggregate
          -- CTE, only surfaced on the final events struct for the UI chips.
          ARRAY(SELECT a FROM UNNEST(attendance) a WHERE a.fartsack IS TRUE) AS fartsacks
        FROM pv_events
        ${whereSql}
      ),

      -- -----------------------
      -- Attendance flattened
      -- -----------------------
      attendance_flat AS (
        SELECT
          e.event_id,
          e.event_date,
          e.ao_org_id,
          e.ao_name,
          a.user_id,
          a.f3_name,
          a.q_ind,
          a.coq_ind,
          a.ghost
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

      -- -----------------------
      -- Event bounds
      -- -----------------------
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
        WINDOW
          w AS (
            ORDER BY event_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
          )
        LIMIT 1
      ),

      -- -----------------------
      -- Q bounds
      -- -----------------------
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
        WINDOW
          w AS (
            ORDER BY event_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
          )
        LIMIT 1
      ),

      -- -----------------------
      -- Co-attendance
      -- -----------------------
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
          SUM(CASE WHEN q_ind = 1 THEN 1 ELSE 0 END) AS q_count,
          -- Ghost rows (attended unannounced) survive the fartsack filter, so
          -- they're already in self_attendance.
          SUM(CASE WHEN ghost IS TRUE THEN 1 ELSE 0 END) AS ghost_count
        FROM self_attendance
      ),
      -- Fartsacks are stripped upstream; count them from the raw events table.
      fartsack_metrics AS (
        SELECT COUNT(*) AS fartsack_count
        FROM pv_events
        ${fartsackWhereSql}
      ),

      -- -----------------------
      -- Summary
      -- -----------------------
      pax_summary AS (
        SELECT
          m.event_count,
          m.q_count,
          m.ghost_count,
          fs.fartsack_count,
          pi.start_date_override,
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
          -- "Efficiency" (UI label): posting consistency, not Q effectiveness.
          -- posts / days since the PAX's first post * 100. Both event_count and
          -- first_event_date respect the active date/tag/type filters; the
          -- denominator runs to CURRENT_DATE().
          SAFE_DIVIDE(
            m.event_count,
            DATE_DIFF(CURRENT_DATE(), eb.first_event_date, DAY))
            * 100 AS effective_percentage
        FROM metrics m
        CROSS JOIN fartsack_metrics fs
        CROSS JOIN event_bounds eb
        LEFT JOIN event_bounds_ao ebao
          ON TRUE
        CROSS JOIN q_bounds qb
        LEFT JOIN q_bounds_ao qbao
          ON TRUE
        LEFT JOIN bestie b
          ON TRUE
        LEFT JOIN unique_users u
          ON TRUE
        LEFT JOIN unique_q_users uq
          ON TRUE
        LEFT JOIN pax_info pi
          ON TRUE
      ),

      -- -----------------------
      -- AO breakdown
      -- -----------------------
      ao_events AS (
        SELECT
          event_id,
           COALESCE(ao_org_id, 0) AS ao_org_id,
           COALESCE(ANY_VALUE(ao_name), 'Unknown AO') AS ao_name,
          ANY_VALUE(region_org_id) AS region_org_id,
          ANY_VALUE(region_name) AS region_name,
          IF(
            EXISTS(
              SELECT 1
              FROM UNNEST(attendance) a
              WHERE
                a.user_id = ${paxId}
                AND a.q_ind = 1
            ),
            1,
            0) AS is_q
        FROM events
        GROUP BY event_id, ao_org_id, attendance
      ),
      ao_breakdown AS (
        SELECT
          ao_org_id,
          ao_name,
          region_org_id,
          region_name,
          COUNT(*) AS total_events,
          SUM(is_q) AS total_q_count
        FROM ao_events
        GROUP BY ao_org_id, ao_name, region_org_id, region_name
      )

    -- ============================
    -- Final shape (single row)
    -- ============================
    SELECT
      (
        SELECT AS STRUCT
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
        FROM pax_info
      ) AS info,
      (
        SELECT AS STRUCT
          event_count,
          q_count,
          ghost_count,
          fartsack_count,
          IFNULL(CAST(start_date_override AS STRING), CAST(first_event_date AS STRING)) AS fng_date,
          CAST(first_event_date AS STRING) AS first_event_date,
          first_event_ao_id,
          first_event_ao_name,
          CAST(last_event_date AS STRING) AS last_event_date,
          last_event_ao_id,
          last_event_ao_name,
          bestie_user_id,
          bestie_f3_name,
          bestie_user_count,
          unique_users_met,
          unique_pax_when_q,
          CAST(first_q_date AS STRING) AS first_q_date,
          first_q_ao_id,
          first_q_ao_name,
          CAST(last_q_date AS STRING) AS last_q_date,
          last_q_ao_id,
          last_q_ao_name,
          effective_percentage
        FROM pax_summary
      ) AS summary,
      IFNULL(
        (
          SELECT
            ARRAY_AGG(
              STRUCT(
                e.event_id AS event_instance_id,
                CAST(e.event_date AS STRING) AS event_date,
                e.event_name,
                e.pax_count,
                e.fng_count,
                e.ao_org_id,
                e.ao_name,
                e.region_org_id,
                e.region_name,
                e.first_f_ind,
                e.second_f_ind,
                e.third_f_ind,
                e.types,
                e.tags,
                e.attendance,
                e.fartsacks)
              ORDER BY e.event_date DESC, e.event_id DESC)
          FROM events e
          LIMIT 100
        ),
        []) AS events,
      IFNULL(
        (
          SELECT
            ARRAY_AGG(
              STRUCT(
                ao_org_id,
                ao_name,
                region_org_id,
                region_name,
                total_events,
                total_q_count)
              ORDER BY total_events DESC, ao_name)
          FROM ao_breakdown
        ),
        []) AS ao_breakdown,

      -- AO x week activity for the activity matrix.
      --
      -- The week window is bounded in TS (see buildActivityWindow) rather than
      -- derived from the data: a handful of pv_events rows carry typo'd dates
      -- centuries out (max is 3034-03-08), which would otherwise stretch the
      -- axis to uselessness.
      --
      -- Rows are per AO per month; the top-N/"Other" bucketing happens in the
      -- component so it stays a pure, testable transform.
      IFNULL(
        (
          SELECT
            ARRAY_AGG(
              STRUCT(ao_org_id, ao_name, region_org_id, region_name, week, posts)
              ORDER BY week, ao_name)
          FROM (
            SELECT
              e.ao_org_id,
              ANY_VALUE(e.ao_name) AS ao_name,
              e.region_org_id,
              ANY_VALUE(e.region_name) AS region_name,
              -- Weeks start Monday, matching buildRangeDates and the charts.
              FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(e.event_date, WEEK(MONDAY))) AS week,
              COUNT(DISTINCT e.event_id) AS posts
            -- Derived from the shared, already-filtered events CTE, so the
            -- matrix honours every page filter (AO, region, type, tag,
            -- category, date) exactly as the rest of the page does. That CTE
            -- has also stripped fartsacks already.
            FROM events e, UNNEST(e.attendance) a
            WHERE a.user_id = ${paxId}
              AND e.ao_org_id IS NOT NULL
              -- The window bounds are Mondays (they are column keys), so the
              -- end must extend to that week's Sunday or posts later in the
              -- final partial week get dropped — including today's, in the
              -- default view. The events CTE still caps at the user's own
              -- filter end, so this cannot over-include.
              AND e.event_date
                BETWEEN DATE('${activityWindow.start}')
                AND DATE_ADD(DATE('${activityWindow.end}'), INTERVAL 6 DAY)
            GROUP BY e.ao_org_id, e.region_org_id, week
          )
        ),
        []) AS ao_weekly;
    `;

  const results = await queryBigQuery<{
    info: PAXInfo;
    events: EventData[];
    summary: PaxSummary;
    ao_breakdown: PaxAOBreakdown[];
    ao_weekly: PaxAOWeeklyActivity[];
  }>(query, userIdentifier, `fetch page data for PAX ${paxId}`);

  return {
    info: results?.[0]?.info || null,
    events: results?.[0]?.events || null,
    summary: results?.[0]?.summary || null,
    ao_breakdown: results?.[0]?.ao_breakdown || null,
    ao_weekly: results?.[0]?.ao_weekly || null,
    activity_window: activityWindow,
  };
}

/** DuckDB-owned PAX read path.  Keep the identity lookup above deliberately
 * untouched: it is an authorization-adjacent BigQuery lookup. */
async function getPaxPageDataDuckDb(
  paxId: number,
  opts?: StatsFilters,
): Promise<Awaited<ReturnType<typeof getPageData>>> {
  const adapter = new DuckDbQueryAdapter(getDuckDbRuntime());
  const infoRows = await adapter.execute<
    PAXInfo & { start_date_override?: string }
  >(
    `SELECT user_id, f3_name, home_region_id, home_region_name, avatar_url,
            status, start_date_override, aos, regions, types, tags
       FROM pv_pax WHERE user_id = ? LIMIT 1`,
    [paxId],
  );
  const dates = buildRangeDates(opts?.range);
  const start = opts?.startDate ?? dates.startDate;
  const end = opts?.endDate ?? dates.endDate;
  const clauses = [
    `(EXISTS (SELECT 1 FROM UNNEST(attendance) AS u(a)
             WHERE a.user_id = ? AND a.fartsack IS NOT TRUE)
      OR EXISTS (SELECT 1 FROM UNNEST(attendance) AS u(a)
             WHERE a.user_id = ? AND a.fartsack IS TRUE))`,
  ];
  const params: unknown[] = [paxId, paxId];
  if (start) {
    clauses.push("event_date >= CAST(? AS DATE)");
    params.push(start);
  }
  if (end) {
    clauses.push("event_date <= CAST(? AS DATE)");
    params.push(end);
  }
  const addIds = (
    column: string,
    values: number[] | undefined,
    mode = "include",
  ) => {
    const ids = toFiniteNumbers(values);
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    clauses.push(
      `${column} ${mode === "exclude" ? "NOT IN" : "IN"} (${placeholders})`,
    );
    params.push(...ids);
  };
  const aoIds = toFiniteNumbers(opts?.aoIds);
  if (aoIds.length) {
    const includesNull = aoIds.includes(0);
    const ids = aoIds.filter((id) => id !== 0);
    clauses.push(
      opts?.aoMode === "exclude"
        ? `(ao_org_id IS NOT NULL AND ${ids.length ? `ao_org_id NOT IN (${ids.map(() => "?").join(",")})` : "TRUE"})`
        : `(${includesNull ? "ao_org_id IS NULL" : "FALSE"}${ids.length ? ` OR ao_org_id IN (${ids.map(() => "?").join(",")})` : ""})`,
    );
    params.push(...ids);
  }
  addIds("region_org_id", opts?.regionIds, opts?.regionMode);
  const addNested = (
    column: string,
    field: string,
    values: number[] | undefined,
    mode = "include",
  ) => {
    const ids = toFiniteNumbers(values);
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    const exists = `EXISTS (SELECT 1 FROM UNNEST(${column}) AS n(x) WHERE x.${field} IN (${placeholders}))`;
    clauses.push(mode === "exclude" ? `NOT (${exists})` : exists);
    params.push(...ids);
  };
  addNested("tags", "id", opts?.tagIds, opts?.tagMode);
  addNested("types", "id", opts?.typeIds, opts?.typeMode);
  const categories = toFiniteNumbers(opts?.categoryIds).filter((x) =>
    [1, 2, 3].includes(x),
  );
  if (categories.length) {
    const parts = categories.map(
      (c) =>
        `${c === 1 ? "first_f_ind" : c === 2 ? "second_f_ind" : "third_f_ind"} = 1`,
    );
    clauses.push(
      opts?.categoryMode === "exclude"
        ? `NOT (${parts.join(" OR ")})`
        : `(${parts.join(" OR ")})`,
    );
  }
  const queriedEvents = await adapter.execute<EventData>(
    `SELECT event_id AS event_instance_id, event_date, event_name, pax_count,
            fng_count, ao_org_id, ao_name, region_org_id, region_name,
            first_f_ind, second_f_ind, third_f_ind, types, tags,
            list_filter(attendance, a -> a.fartsack IS NOT TRUE) AS attendance,
            list_filter(attendance, a -> a.fartsack IS TRUE) AS fartsacks
       FROM pv_events WHERE ${clauses.join(" AND ")}
       ORDER BY event_date DESC, event_id DESC`,
    params,
  );
  // Fetch fartsack-only rows so their counts participate, but keep them out of
  // the attended event stream and its Q/efficiency metrics.
  const events = queriedEvents.filter((event) =>
    (event.attendance ?? []).some((a) => Number(a.user_id) === paxId),
  );
  const attended = events.flatMap((event) => event.attendance ?? []);
  const self = attended.filter((a) => Number(a.user_id) === paxId);
  const isTrue = (value: unknown) =>
    value === true || value === 1 || value === "1";
  const qEvents = self.filter((a) => isTrue(a.q_ind));
  const fartsacks = queriedEvents
    .flatMap((event) => event.fartsacks ?? [])
    .filter((a) => Number(a.user_id) === paxId).length;
  const summary: PaxSummary | null = queriedEvents.length
    ? {
        event_count: events.length,
        q_count: qEvents.length,
        ghost_count: self.filter((a) => isTrue(a.ghost)).length,
        fartsack_count: fartsacks,
        fng_date:
          infoRows[0]?.start_date_override ??
          (String(events.at(-1)?.event_date ?? "").slice(0, 10) || null),
        first_event_date:
          String(events.at(-1)?.event_date ?? "").slice(0, 10) || null,
        first_event_ao_id: events.at(-1)?.ao_org_id ?? null,
        first_event_ao_name: events.at(-1)?.ao_name ?? null,
        last_event_date:
          String(events[0]?.event_date ?? "").slice(0, 10) || null,
        last_event_ao_id: events[0]?.ao_org_id ?? null,
        last_event_ao_name: events[0]?.ao_name ?? null,
        bestie_user_id: null,
        bestie_user_count: 0,
        bestie_f3_name: null,
        unique_users_met: new Set(
          attended
            .filter((a) => Number(a.user_id) !== paxId)
            .map((a) => a.user_id),
        ).size,
        first_q_date: null,
        first_q_ao_id: null,
        first_q_ao_name: null,
        last_q_date: null,
        last_q_ao_id: null,
        last_q_ao_name: null,
        unique_pax_when_q: 0,
        effective_percentage: null,
      }
    : null;
  if (summary) {
    const qRows = events.filter((event) =>
      (event.attendance ?? []).some(
        (a) => Number(a.user_id) === paxId && isTrue(a.q_ind),
      ),
    );
    const qPeople = new Set<number>();
    const coAttendance = new Map<
      number,
      { name: string | null; count: number }
    >();
    for (const event of events) {
      const present = (event.attendance ?? []).filter(
        (a) => Number(a.user_id) !== paxId,
      );
      const selfPresent = (event.attendance ?? []).some(
        (a) => Number(a.user_id) === paxId,
      );
      if (selfPresent)
        for (const person of present) {
          const prior = coAttendance.get(Number(person.user_id)) ?? {
            name: person.f3_name ?? null,
            count: 0,
          };
          prior.count++;
          coAttendance.set(Number(person.user_id), prior);
        }
    }
    for (const event of qRows)
      for (const person of event.attendance ?? [])
        if (Number(person.user_id) !== paxId)
          qPeople.add(Number(person.user_id));
    const bestie = [...coAttendance.entries()].sort(
      (a, b) =>
        b[1].count - a[1].count ||
        (a[1].name ?? "").localeCompare(b[1].name ?? ""),
    )[0];
    if (bestie) {
      summary.bestie_user_id = bestie[0];
      summary.bestie_user_count = bestie[1].count;
      summary.bestie_f3_name = bestie[1].name;
    }
    const first = events.at(-1);
    const firstQ = qRows.at(-1);
    const lastQ = qRows[0];
    summary.first_q_date = firstQ
      ? String(firstQ.event_date).slice(0, 10)
      : null;
    summary.first_q_ao_id = firstQ?.ao_org_id ?? null;
    summary.first_q_ao_name = firstQ?.ao_name ?? null;
    summary.last_q_date = lastQ ? String(lastQ.event_date).slice(0, 10) : null;
    summary.last_q_ao_id = lastQ?.ao_org_id ?? null;
    summary.last_q_ao_name = lastQ?.ao_name ?? null;
    summary.unique_pax_when_q = qPeople.size;
    const firstDate = first
      ? Date.parse(`${String(first.event_date).slice(0, 10)}T00:00:00Z`)
      : NaN;
    const today = Date.parse(
      `${new Date().toISOString().slice(0, 10)}T00:00:00Z`,
    );
    const days = (today - firstDate) / 86400000;
    summary.effective_percentage =
      days > 0 ? (summary.event_count / days) * 100 : null;
  }
  const breakdownMap = new Map<number | null, PaxAOBreakdown>();
  const weeklyMap = new Map<string, PaxAOWeeklyActivity>();
  for (const event of events) {
    const mine = (event.attendance ?? []).some(
      (a) => Number(a.user_id) === paxId,
    );
    if (!mine) continue;
    const ao = event.ao_org_id == null ? null : Number(event.ao_org_id);
    const current = breakdownMap.get(ao) ?? {
      ao_org_id: ao ?? 0,
      ao_name: event.ao_name ?? "Unknown AO",
      region_org_id: event.region_org_id,
      region_name: event.region_name,
      total_events: 0,
      total_q_count: 0,
    };
    current.total_events++;
    if (
      (event.attendance ?? []).some(
        (a) => Number(a.user_id) === paxId && isTrue(a.q_ind),
      )
    )
      current.total_q_count++;
    breakdownMap.set(ao, current);
    if (event.ao_org_id != null) {
      const date = new Date(
        `${String(event.event_date).slice(0, 10)}T00:00:00Z`,
      );
      const monday = new Date(
        date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000,
      );
      const week = monday.toISOString().slice(0, 10);
      const activityWindow = buildActivityWindow(opts);
      if (week < activityWindow.start || week > activityWindow.end) continue;
      const key = `${ao}:${week}`;
      const row = weeklyMap.get(key) ?? {
        ao_org_id: ao as number,
        ao_name: event.ao_name ?? "Unknown AO",
        region_org_id: event.region_org_id,
        region_name: event.region_name,
        week,
        posts: 0,
      };
      row.posts++;
      weeklyMap.set(key, row);
    }
  }
  return {
    info: infoRows[0] ?? null,
    events: events.length ? events : null,
    summary,
    ao_breakdown: [...breakdownMap.values()].sort(
      (a, b) =>
        b.total_events - a.total_events ||
        (a.ao_name ?? "").localeCompare(b.ao_name ?? ""),
    ),
    ao_weekly: [...weeklyMap.values()].sort(
      (a, b) =>
        a.week.localeCompare(b.week) || a.ao_name.localeCompare(b.ao_name),
    ),
    activity_window: buildActivityWindow(opts),
  };
}
