# ADR 0001 — BigQuery as the serving layer (and when to add one)

- **Status:** Accepted (deferred build)
- **Date:** 2026-06-16
- **Roadmap ref:** P3-22 / the "documented-but-unbuilt serving tier" in
  [cto-review-roadmap.md](../cto-review-roadmap.md)

## Context

Stats pages read directly from **BigQuery**, an OLAP warehouse, on render.
BigQuery has per-query latency (hundreds of ms to seconds) and bills by bytes
scanned, so using it as an interactive app's serving database is, in principle,
the wrong shape — and was the root cause behind the two search postmortems.

**P0-1 mitigated this** by caching each stats page's query in front of BigQuery
(`lib/cache.ts`, `unstable_cache`, 1h revalidate). That removes BigQuery from
the hot path for repeat views and cuts cost/latency substantially.

**Known limit of the current cache:** Next's Data Cache on Cloud Run is
**per-instance** (in-memory + `.next/cache`), not shared across scaled-out
instances, and is lost on cold starts. Each instance still serves repeat loads
from cache within the revalidate window, but there is no single global cache.

## Decision

**Do not build a dedicated serving tier (Postgres / materialized views) now.**
For a solo/volunteer-maintained app at current traffic, the per-instance cache
is sufficient and a serving tier is maintenance the team shouldn't carry yet.
Revisit when the triggers below fire.

## Triggers to revisit (build the serving tier when any holds)

- BigQuery spend becomes material (watch the budget alert from the ops runbook).
- p95 page latency on cache misses is consistently user-visible, or cold
  starts / many instances make per-instance caching ineffective.
- Traffic grows enough that cache-miss query volume is a real cost or
  rate-limit concern.

## Sketch (if/when built)

- Keep **BigQuery as the source of truth** and the place heavy aggregation runs.
- Precompute the per-page aggregates the loaders need into a **serving store**
  (Postgres, already a removed dependency we'd re-add — see P2-11 — or a managed
  KV/edge cache) on a schedule (e.g. after the daily data refresh).
- Loaders read from the serving store; BigQuery is queried only by the
  precompute job. The `lib/cache.ts` seam stays in front for hot data.
- Alternatively, a shared Next `cacheHandler` (e.g. Redis) gives a global cache
  with far less work than a full serving tier — consider this first.

## Consequences

- Today: lowest maintenance; accept per-instance cache + occasional cache-miss
  BigQuery latency.
- Deferred: the migration is non-trivial (a precompute job + a store to operate),
  which is exactly why it waits for evidence that it's needed.
