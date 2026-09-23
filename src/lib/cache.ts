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
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { isDuckDbEnabled } from "@/lib/duckdb/query";
import type { DuckDbCapability } from "@/lib/duckdb/query";
import { DuckDbDependencyError } from "@/lib/duckdb/errors";

/** Revalidate window for cached stats-page data, in seconds (1 hour). */
export const STATS_REVALIDATE_SECONDS = 3600;

/** The control-object generation and release together identify one dataset. */
export interface StatsReleaseIdentity {
  releaseId: string;
  generation: string;
}

/**
 * Read the identity currently serving DuckDB queries.  An unactivated runtime
 * is deliberately represented by undefined: callers must still run the query
 * so its normal unavailable error is not turned into an empty cache result.
 */
export function getStatsReleaseIdentity(
  capability: DuckDbCapability = "stats_region",
): StatsReleaseIdentity | undefined {
  if (!isDuckDbEnabled(process.env, capability)) return undefined;
  const status = getDuckDbRuntime().status();
  if (!status.activeReleaseId || !status.activePointerGeneration)
    return undefined;
  return {
    releaseId: status.activeReleaseId,
    generation: status.activePointerGeneration,
  };
}

export function statsReleaseCacheParts(identity: StatsReleaseIdentity): {
  key: string;
  tag: string;
} {
  const value = `${identity.releaseId}:${identity.generation}`;
  return { key: `duckdb-release:${value}`, tag: `duckdb-release-${value}` };
}

function assertStatsReleaseUnchanged(
  identity: StatsReleaseIdentity,
  capability: DuckDbCapability,
): void {
  const current = getStatsReleaseIdentity(capability);
  if (
    !current ||
    current.releaseId !== identity.releaseId ||
    current.generation !== identity.generation
  ) {
    throw new DuckDbDependencyError(
      "DuckDB release changed while loading stats data",
    );
  }
}

/**
 * Wrap a stats-page data fetch in a time-revalidated cache.
 *
 * The cache key is derived from `keyParts` (entity + id + serialized filters)
 * and, for DuckDB, the active release identity — deliberately NOT from the
 * requesting user, because stats data is entity-scoped, not user-scoped. Two
 * users viewing the same entity share one cached result.
 *
 * Caching is bypassed outside production so local development always sees fresh
 * data. `tags` allow targeted invalidation via `revalidateTag` later if needed.
 */
export function cacheStatsData<T>(
  fetcher: () => Promise<T>,
  keyParts: string[],
  tags: string[] = [],
  releaseIdentity?: StatsReleaseIdentity,
  capability: DuckDbCapability = "stats_region",
): Promise<T> {
  if (process.env.NODE_ENV !== "production") {
    return fetcher();
  }

  if (isDuckDbEnabled(process.env, capability) && !releaseIdentity) {
    // Do not manufacture a release-less cache entry. The fetcher is allowed to
    // produce the typed unavailable error (rather than hiding it as a miss).
    return fetcher();
  }

  const releaseParts = releaseIdentity
    ? statsReleaseCacheParts(releaseIdentity)
    : undefined;
  // Fence cache hits as well as misses. A key captured for the old release
  // must not be served after a refresh has completed before invocation.
  if (releaseIdentity) assertStatsReleaseUnchanged(releaseIdentity, capability);
  const cacheKey = releaseParts ? [...keyParts, releaseParts.key] : keyParts;
  const cacheTags = releaseParts ? [...tags, releaseParts.tag] : tags;

  return unstable_cache(
    async () => {
      const value = await fetcher();
      // A refresh may swap releases while a multi-query page is being built. Do
      // not publish a result under the identity captured before that query.
      if (releaseIdentity)
        assertStatsReleaseUnchanged(releaseIdentity, capability);
      return value;
    },
    cacheKey,
    {
      revalidate: STATS_REVALIDATE_SECONDS,
      tags: cacheTags,
    },
  )().then((value) => {
    // unstable_cache does not execute its producer on a hit, so the producer
    // fence above cannot protect that path. Check the operation boundary too.
    if (releaseIdentity)
      assertStatsReleaseUnchanged(releaseIdentity, capability);
    return value;
  });
}
