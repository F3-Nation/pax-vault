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

**Important**: Pax-vault queries run against `paxVault`, not `public` — no app query references `f3data.public` (each `lib/bq` / allowlist test asserts this). Anything the app needs from a base table gets added to a `pv_*` table's scheduled query first. The `pv_*` views in `paxVault` are built on top of the base tables in `public`.

## Views

| View          | Used by                                                                                                                                              | Purpose                                                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pv_regions`  | Region search, region page info                                                                                                                      | Region metadata (id, name, logo, sector, AOs, types, tags)                                                                                                                                                                        |
| `pv_events`   | Region page events/summary/leaders, event details                                                                                                    | Event data with attendance, types, tags arrays, plus the event-detail columns (see below)                                                                                                                                         |
| `pv_upcoming` | Region page upcoming section                                                                                                                         | Scheduled future events                                                                                                                                                                                                           |
| `pv_kotter`   | Region page kotter list                                                                                                                              | PAX activity/retention status                                                                                                                                                                                                     |
| `pv_pax`      | PAX search, sign-in allowlist (`isAuthorizedEmail`), signed-in identity lookup (`getPaxIdentityByEmail`), region admin check (`getRegionPermission`) | User metadata, incl. `email` (session email → PAX id + home region) and `roles` (every role grant, copied from `public.roles_x_users_x_org`). Refreshed every 6h by the "PaxVault PAX" scheduled query — `scripts/sql/pv_pax.sql` |
| `pv_aos`      | AO pages                                                                                                                                             | AO metadata                                                                                                                                                                                                                       |

### `pv_events` refresh + detail columns

`pv_events` is a real table (not a view), maintained by two BigQuery scheduled queries in `f3data` / `us-central1`:

| Scheduled query         | Cadence         | How                                                                                                   |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `PaxVault Event Import` | Daily 06:30 UTC | Full rebuild, `WRITE_TRUNCATE` into `paxVault.pv_events` — the table schema is whatever this SELECTs. |
| `PaxVault Events Merge` | Hourly          | Script: `MERGE` of events/attendance changed in the last 2h, plus orphan cleanup of hard deletes.     |

Both copy `description`, `preblast`, `backblast` (STRING) and `preblast_rich`, `backblast_rich`, `meta` (JSON) straight from `public.event_instances`. `getEventDetails()` in `src/lib/bq/events.ts` reads them from `pv_events`, so:

- Backblast/preblast edits surface within the hourly merge window, not instantly.
- Details only exist for events that are in `pv_events` (active, `pax_count` set, not `exclude_from_pax_vault`); anything else returns null.
- A column must be added to the **import first** (then run it) and the merge second — the merge fails on columns the table doesn't have yet, and the import's `WRITE_TRUNCATE` drops any column it doesn't select.
- `pv_events` is not clustered, so a `WHERE event_id = …` lookup scans the full selected columns (the detail columns are ~1 GB). Clustering by `event_id` would need the import converted to a `CREATE OR REPLACE TABLE … CLUSTER BY` script.

## App-owned tables (writable)

The service account is read-only across `f3data` except for a **table-level** `roles/bigquery.dataEditor` grant on each of these. Never grant at dataset level — that would open every `pv_*` view to writes.

| Table                    | Written by                  | Shape / notes                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pv_regions_preferences` | `src/lib/bq/preferences.ts` | One row per region, MERGE upsert. See `auth.md` → Region Preferences.                                                                                                                                                                                                                                                                                                   |
| `pv_pax_eight_box`       | `src/lib/bq/eightBox.ts`    | 8 Box boards (`json_content` = `{version, word, boxes:{<box>:{fields, items}}}`, sub-fields declared in `src/lib/eightBox.ts`): one `draft` row per PAX (MERGE keyed on `pax_id + status='draft'`) plus immutable `published` rows with a per-PAX `version`. DELETE is a hard delete. DDL + grant command in `scripts/sql/pv_pax_eight_box.sql`. See `auth.md` → 8 Box. |

Both tables are provisioned out of band (no migration runner). Writes go through `queryBigQuery()` as parameterized DML; DML-written rows are immediately UPDATE/DELETE-able (the streaming-buffer restriction applies only to streaming inserts). Timestamps are returned via `FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E3SZ', …)` so `new Date()` parses them the same on server and client.

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
