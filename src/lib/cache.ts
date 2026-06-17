/**
 * Shared caching for stats-page data.
 *
 * Every stats page queries BigQuery (an OLAP warehouse) to render. Workout data
 * changes on a daily cadence, not per-second, so we cache the per-page result
 * with a time-based revalidate window. This keeps BigQuery off the hot path,
 * cuts query cost/latency by 1-2 orders of magnitude on repeat views, and
 * removes BQ as a per-request point of failure.
 */
import { unstable_cache } from "next/cache";

/** Revalidate window for cached stats-page data, in seconds (1 hour). */
export const STATS_REVALIDATE_SECONDS = 3600;

/**
 * Wrap a stats-page data fetch in a time-revalidated cache.
 *
 * The cache key is derived from `keyParts` only (entity + id + serialized
 * filters) — deliberately NOT from the requesting user, because stats data is
 * entity-scoped, not user-scoped. Two users viewing the same entity share one
 * cached result.
 *
 * Caching is bypassed outside production so local development always sees fresh
 * data. `tags` allow targeted invalidation via `revalidateTag` later if needed.
 */
export function cacheStatsData<T>(
  fetcher: () => Promise<T>,
  keyParts: string[],
  tags: string[] = [],
): Promise<T> {
  if (process.env.NODE_ENV !== "production") {
    return fetcher();
  }

  return unstable_cache(fetcher, keyParts, {
    revalidate: STATS_REVALIDATE_SECONDS,
    tags,
  })();
}
