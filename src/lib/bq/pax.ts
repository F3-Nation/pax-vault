import { queryBigQuery } from "@/lib/db";
import { EventData, PaxSummary, PAXInfo, PaxAOBreakdown } from "@/lib/types";
import { StatsFilters, toFiniteNumbers } from "@/lib/filters";

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
    const list = aoList.join(",");
    if (aoList.includes(0)) {
      aoList.splice(aoList.indexOf(0), 1); // Remove 0 for IN clause.
      whereClauses.push(
        aoMode === "exclude"
          ? `(ao_org_id NOT IN (${list}) OR ao_org_id IS NOT NULL)`
          : `(ao_org_id IN (${list}) OR ao_org_id IS NULL)`,
      );
    } else {
      whereClauses.push(
        aoMode === "exclude"
          ? `ao_org_id NOT IN (${list})`
          : `ao_org_id IN (${list})`,
      );
    }
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
 * Fetch events for a PAX with optional filtering.
 */
export async function getEvents(
  paxId: number,
  userIdentifier?: string,
  opts?: StatsFilters & {
    limit?: number;
  },
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

export async function getPaxIdByEmail(
  email: string,
  userIdentifier?: string,
): Promise<number | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const query = `-- PAX ID BY EMAIL
    SELECT id AS user_id
    FROM \`f3data.public.users\`
    WHERE email IS NOT NULL
      AND LOWER(email) = @email
    LIMIT 1
  `;
  const results = await queryBigQuery<{ user_id: number }>(
    query,
    userIdentifier,
    "lookup pax id by email",
    { email: normalizedEmail },
  );
  return results?.[0]?.user_id ?? null;
}

export async function searchUsersByName(
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
}> {
  // Build WHERE clause from common filters.
  const whereSql = buildEventsWhereSql(paxId, opts);
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
        []) AS ao_breakdown;
    `;

  const results = await queryBigQuery<{
    info: PAXInfo;
    events: EventData[];
    summary: PaxSummary;
    ao_breakdown: PaxAOBreakdown[];
  }>(query, userIdentifier, `fetch page data for PAX ${paxId}`);

  return {
    info: results?.[0]?.info || null,
    events: results?.[0]?.events || null,
    summary: results?.[0]?.summary || null,
    ao_breakdown: results?.[0]?.ao_breakdown || null,
  };
}
