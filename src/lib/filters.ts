/**
 * Single source of truth for stats-page filters.
 *
 * The same filter contract was previously re-implemented in three places
 * (stats pages, events API routes, and the BigQuery modules), each with its
 * own parser and its own re-declared option type. That drift is the class of
 * bug behind both search postmortems. This module centralizes:
 *   - the canonical filter types (`StatsFilters` / `DateRangeFilters`),
 *   - parsing from both Next.js page `searchParams` and `URLSearchParams`,
 *   - the numeric-id sanitizer used at the SQL boundary.
 *
 * Kept dependency-free so it is safe to import from server pages, API routes,
 * and the BigQuery layer alike.
 */

export type FilterMode = "include" | "exclude";

/** Date-range-only filters (used by area/sector pages). */
export type DateRangeFilters = {
  range?: string;
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
};

/**
 * Full stats-filter shape. A superset — each entity reads only the fields it
 * supports (e.g. AO ignores `aoIds`, region ignores `regionIds`).
 */
export type StatsFilters = DateRangeFilters & {
  aoIds?: number[];
  aoMode?: FilterMode;
  regionIds?: number[];
  regionMode?: FilterMode;
  tagIds?: number[];
  tagMode?: FilterMode;
  typeIds?: number[];
  typeMode?: FilterMode;
  categoryIds?: number[];
  categoryMode?: FilterMode;
};

/** Raw value as it arrives from a route param or search param. */
type RawParam = string | string[] | null | undefined;

/**
 * Parse a comma-separated string (or string[]) into a finite number[].
 * Returns `undefined` when nothing valid remains, so callers can treat
 * "absent" and "empty" identically.
 */
export function parseIdList(value: RawParam): number[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : value.split(",");
  const nums = list.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return nums.length ? nums : undefined;
}

/**
 * Keep only finite numeric values from a list. Defense-in-depth at the SQL
 * boundary against non-numeric input being interpolated into a query.
 */
export function toFiniteNumbers(vals?: number[]): number[] {
  return (vals || []).filter((v) => Number.isFinite(v)).map((v) => Number(v));
}

function firstString(value: RawParam): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toMode(value: RawParam): FilterMode | undefined {
  const v = firstString(value);
  return v === "include" || v === "exclude" ? v : undefined;
}

/**
 * Core parser shared by the page and URL adapters below. `get` returns the raw
 * value for a key from whichever source (page searchParams or URLSearchParams).
 */
function parseFilters(get: (key: string) => RawParam): StatsFilters {
  return {
    range: firstString(get("range")),
    startDate: firstString(get("startDate")),
    endDate: firstString(get("endDate")),
    aoIds: parseIdList(get("aoIds")),
    aoMode: toMode(get("aoMode")),
    regionIds: parseIdList(get("regionIds")),
    regionMode: toMode(get("regionMode")),
    tagIds: parseIdList(get("tagIds")),
    tagMode: toMode(get("tagMode")),
    typeIds: parseIdList(get("typeIds")),
    typeMode: toMode(get("typeMode")),
    categoryIds: parseIdList(get("categoryIds")),
    categoryMode: toMode(get("categoryMode")),
  };
}

/** Parse filters from a Next.js page `searchParams` object. */
export function parseFilterParams(
  params?: Record<string, string | string[] | undefined>,
): StatsFilters {
  return parseFilters((key) => params?.[key]);
}

/** Parse filters from a `URLSearchParams` (API route handlers). */
export function parseFilterSearchParams(
  searchParams: URLSearchParams,
): StatsFilters {
  return parseFilters((key) => searchParams.get(key));
}

/**
 * Serialize filters back into a query string. Inverse of the parsers above;
 * id lists are joined with commas, empty/absent fields are omitted.
 */
export function filtersToQueryString(filters: StatsFilters): string {
  const qp = new URLSearchParams();
  if (filters.range) qp.set("range", filters.range);
  if (filters.startDate) qp.set("startDate", filters.startDate);
  if (filters.endDate) qp.set("endDate", filters.endDate);

  const appendGroup = (
    key: string,
    ids?: number[],
    modeKey?: string,
    mode?: FilterMode,
  ) => {
    if (ids && ids.length) {
      qp.set(key, ids.join(","));
      if (modeKey && mode) qp.set(modeKey, mode);
    }
  };

  appendGroup("aoIds", filters.aoIds, "aoMode", filters.aoMode);
  appendGroup("regionIds", filters.regionIds, "regionMode", filters.regionMode);
  appendGroup("tagIds", filters.tagIds, "tagMode", filters.tagMode);
  appendGroup("typeIds", filters.typeIds, "typeMode", filters.typeMode);
  appendGroup(
    "categoryIds",
    filters.categoryIds,
    "categoryMode",
    filters.categoryMode,
  );

  return qp.toString();
}
