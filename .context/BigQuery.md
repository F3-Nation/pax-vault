# PAX-VAULT BIGQUERY

## Connection

| Setting         | Value                                                    | Source                  |
| --------------- | -------------------------------------------------------- | ----------------------- |
| Project         | `f3data`                                                 | `BIGQUERY_PROJECT_ID`   |
| Dataset         | `paxVault`                                               | `BIGQUERY_DATASET`      |
| Location        | `us-central1`                                            | `BIGQUERY_LOCATION`     |
| Service account | `pax-vault-bigquery-prod@f3data.iam.gserviceaccount.com` | `BIGQUERY_CLIENT_EMAIL` |

All env vars are pulled from Google Cloud Secret Manager in prod (via `apphosting.yaml`). Local dev uses `.env.local`.

The `@google-cloud/bigquery` SDK (v8.x) is initialized in `src/lib/db.ts`. The `location` must be passed both to the `BigQuery` constructor AND to each `query()` call — the constructor's `location` does **not** propagate to `query()` in SDK 8.x.

## Datasets

The `f3data` project has three datasets, all in `us-central1`:

| Dataset     | Contents                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `paxVault`  | `pv_*` views used by pax-vault (pv_regions, pv_events, pv_upcoming, pv_kotter, pv_pax, pv_aos) |
| `public`    | Base tables (orgs, events, event_instances, users, attendance, etc.)                           |
| `analytics` | Analytics data                                                                                 |

**Important**: Pax-vault queries run against `paxVault`, not `public`. The `pv_*` views in `paxVault` are built on top of the base tables in `public`.

## Views

| View          | Used by                            | Purpose                                                    |
| ------------- | ---------------------------------- | ---------------------------------------------------------- |
| `pv_regions`  | Region search, region page info    | Region metadata (id, name, logo, sector, AOs, types, tags) |
| `pv_events`   | Region page events/summary/leaders | Event data with attendance, types, tags arrays             |
| `pv_upcoming` | Region page upcoming section       | Scheduled future events                                    |
| `pv_kotter`   | Region page kotter list            | PAX activity/retention status                              |
| `pv_pax`      | PAX search                         | User metadata                                              |
| `pv_aos`      | AO pages                           | AO metadata                                                |

## Query Pattern

Pax-vault uses a single-query-per-page pattern. Each page makes one BQ query with CTEs that returns STRUCTs and ARRAYs. Never split into multiple queries.

Flow: `page.tsx` → `loader.ts` → `lib/bq/<entity>.ts` → `queryBigQuery()` → `pv_*` views

BigQuery returns `{value: N}` wrappers and `bigint` values. The loaders normalize these via `JSON.parse(JSON.stringify(...))` with a replacer that unwraps `{value}` objects and converts bigints to numbers. Null arrays are defaulted to `[]`.

## Source Files

| File                    | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `src/lib/db.ts`         | BigQuery client initialization and `queryBigQuery()` |
| `src/lib/bq/regions.ts` | Region queries (search, page data with CTEs)         |
| `src/lib/bq/pax.ts`     | PAX queries (search, page data)                      |
| `src/lib/bq/events.ts`  | Event queries                                        |

## Gotchas

- **Dataset is `paxVault`, not `public`**: The `pv_*` views live in the `paxVault` dataset. The `public` dataset has base tables only. Using the wrong dataset produces "Table not found" errors.
- **Location must be explicit**: The dataset is in `us-central1`. The SDK's `BigQuery` constructor `location` param does NOT propagate to `query()` calls in v8.x. Both must set `location` explicitly, or queries fail with "Table not found in us-central1" (misleading — it's actually a job routing issue).
- **Location default was wrong**: The original code defaulted to `"US"` (multi-region), but the dataset is in `us-central1` (single region). The `"US"` default happened not to break prod because the constructor `location` doesn't propagate to `query()`, so the SDK auto-detected. But it caused confusing error messages when debugging.
- **Service account permissions**: The `pax-vault-bigquery-prod` service account has read access to all three datasets. Use it for both local and prod.
