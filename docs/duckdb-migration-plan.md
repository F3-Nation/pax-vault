# DuckDB migration plan

## Boundary and decisions

The goal is to serve the read-only, release-backed `pv_*` analytical datasets
from DuckDB 1.5.5 and immutable Parquet in GCS. This is **not** a migration of
authentication, authorization, identity, preferences, 8-box data, event-detail
content, or any app-owned writable table. There is no silent BigQuery fallback:
an unavailable or invalid DuckDB release is an explicit 503 for a DuckDB-owned
operation (or the documented last-known-good result during refresh).

The existing BigQuery adapter in `src/lib/db.ts` and all listed modules remain
operational throughout rollout. The following matrix is normative:

| Capability / source                                                                                                                | Owner after migration | Treatment                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pv_pax`, `pv_events`, `pv_regions`, `pv_areas`, `pv_sectors`, `pv_aos`, `pv_upcoming`, `pv_kotter` analytical reads               | DuckDB release        | Migrate only after schema/type parity is proven.                                                                                     |
| Auth allowlist (`src/lib/auth/allowlist.ts`)                                                                                       | BigQuery              | Keep `f3data.public.users` and named parameter `@email`.                                                                             |
| Permissions (`src/lib/bq/permissions.ts`)                                                                                          | BigQuery              | Keep users and `roles_x_users_x_org`; no authorization fallback.                                                                     |
| Identity (`getPaxIdentityByEmail` in `src/lib/bq/pax.ts`)                                                                          | BigQuery              | Keep both `users.id` and `pv_pax.home_region_id` in the BigQuery-owned lookup; identity remains available from the existing adapter. |
| Preferences (`src/lib/bq/preferences.ts`, `src/lib/preferences.ts`)                                                                | BigQuery              | Reads and MERGE writes remain BigQuery and uncached for read-your-write behavior.                                                    |
| 8-box (`getEightBoxPageData`, `getEightBoxVersionPageData`, and all writes in `src/lib/bq/eightBox.ts`)                            | BigQuery              | Keep both writable `pv_pax_eight_box` operations and their `pv_pax` owner lookups in BigQuery.                                       |
| Event detail content (`getEventDetails` in `src/lib/bq/events.ts`)                                                                 | BigQuery              | Keep `f3data.public.event_instances`, including JSON `meta` parsing.                                                                 |
| `getEventById` (`src/lib/bq/events.ts`)                                                                                            | Split                 | Fetch event/attendance from DuckDB; fetch `pv_regions_preferences.json_config` from BigQuery and join in the adapter.                |
| `getPageData` in `src/lib/bq/regions.ts` and `src/lib/bq/aos.ts`                                                                   | Split                 | Analytical page aggregates, events, leaders, upcoming, and kotter use DuckDB; `preferencesJson` remains a BigQuery point lookup.     |
| `getPageData` in `src/lib/bq/pax.ts`, `areas.ts`, and `sectors.ts`; their `getEvents` and search functions; `src/lib/bq/search.ts` | DuckDB release        | Migrate the `pv_*` reads, preserving current result shapes and filters.                                                              |
| `getRegionAOIds` (`src/lib/bq/regions.ts`)                                                                                         | BigQuery initially    | Keep BQ while it is used for preference invalidation; split only with an independently reviewed invalidation contract.               |

Mixed functions must not issue an accidental cross-engine SQL query. Their
adapters explicitly name the source for each component and carry one
release-id/generation tag on DuckDB-derived values.

Direct preference reads and writes remain uncached BigQuery point operations,
so an editor sees its own write. When a stats page merges those preferences
into DuckDB-backed page data (`regions.ts` and `aos.ts`), the merged cache key
must include the current release tag and a preference revision/fingerprint;
preference writes invalidate the affected region and inherited AO page keys.

## Current pointer and release protocol

### Contract

The producer publishes immutable objects under
`gs://BUCKET/releases/<releaseId>/...`; a release prefix is never overwritten.
The current pointer is a small, versioned object at a fixed control path (for
example `current.json`) and is the only mutable object. It contains at least:
`contractVersion`, `releaseId`, immutable `prefix`, `manifestUri`,
`manifestGeneration` (the manifest object's GCS object generation),
`manifestSha256`, `schemaVersion`, `createdAtUtc`,
`producerRevision`, and monotonic logical `releaseSequence`. It does not
contain a `pointerSha256`; the pointer's content is protected by the GCS
object generation returned by the SDK. A GCS **object generation** identifies
the version of pointer content; GCS **metageneration** counts metadata updates
and is a different value, not `releaseSequence` and not a substitute for
content CAS. Hashes cover canonical manifest bytes, not parsed/re-serialized
JSON. The manifest contains the allowlisted dataset/file names, byte sizes,
object GCS generations, CRC32C values, row/schema fingerprints, and total size.

The consumer accepts only a configured bucket and an allowlisted immutable
prefix matching `releaseId`; it rejects path traversal, unexpected files,
unknown schema versions, missing manifest entries, generation/hash mismatch,
duplicate datasets, and any dataset outside the allowlist. It verifies the
manifest and every object’s GCS generation and CRC32C before opening DuckDB,
then verifies table names, columns, logical types, nullability, and row/golden
checks. Retrieval is pinned to the accepted `(releaseId, releaseSequence,
manifestSha256)` and uses the SDK object-generation precondition; it must not
mix files from releases.

### Producer and consumer ordering

1. Producer writes all Parquet objects below a new unique immutable prefix.
2. Producer writes the manifest, reads it back, and validates object
   generations, CRC32C, sizes, schema, row counts, and required goldens.
3. Producer validates the complete candidate against the contract, observes
   the current pointer's GCS object generation, then writes the new pointer
   content with `ifGenerationMatch=<observed GCS object generation>`. If the
   pointer does not yet exist, the first create uses `ifGenerationMatch=0`.
   This is content CAS; metageneration is tracked separately only when a
   metadata CAS is needed.
4. Producer reads the pointer back and validates its content and returned GCS
   object generation. A failed CAS is not a publish; it is retried from a
   fresh read.
5. Consumer reads the pointer, validates the pointer and manifest, downloads
   only the allowlisted generation-pinned objects, and validates them before
   activation. It re-reads the pointer immediately before swap and compares the
   newly observed pointer GCS object generation with the generation observed
   before staging; if it changed, discard the candidate and restart. The swap
   is pinned to the pointer content actually validated.

Fleet convergence is bounded eventual consistency: every instance reconciles at
startup and on each request when its opportunistic TTL has expired. Define and
page on a maximum release-skew SLO (target: 15 minutes, subject to production
load testing); Pub/Sub notification is only a best-effort accelerator, never
the source of truth. Keep the prior valid pointer and at least the prior
release for rollback and the retention window. Rollback is another validated
pointer CAS to that release, followed by the same consumer protocol; never
mutate a published prefix.

## Instance lifecycle and Cloud Run contract

Each Cloud Run instance owns a local DuckDB file and one in-process active
handle. Bootstrap and refresh are single-flight: concurrent requests await one
operation rather than downloading/building multiple copies. A refresh stages a
uniquely named candidate file, uses Google Cloud Storage SDK calls with
Application Default Credentials (ADC), and does **not** use DuckDB `httpfs`,
HMAC keys, or request-time remote scans.

Validation completes before activation. The active handle is immutable to
readers and has a lease/reference count; swap installs the candidate only after
new readers can acquire the new handle, then closes the old handle after its
leases drain. During refresh, requests continue acquiring leases from the LKG;
only cold bootstrap with no active handle waits for the single-flight load.
On failed refresh, retain the LKG and record the failure. Define a configured,
finite hard LKG maximum age; while it is within that age, continue serving it, but after it
expires return an explicit stable-dependency 503 rather than stale data or a
BigQuery fallback. On cold startup with no valid LKG, return the same 503.
Clean up staged files, abandoned candidates, and retired files after leases
drain, while retaining enough local state for diagnostics and LKG policy.

Cloud Run refresh is opportunistic on request TTL, not a timer assumption.
Pub/Sub may trigger an early reconciliation and must tolerate loss, duplicate
delivery, and reordering. Cache keys for stats include `releaseId` (or an
equivalent generation tag) derived from the same lease used for query
execution; cache invalidation on swap must prevent old data from being
returned under a new release. Validate the maximum release-skew SLO and hard
LKG expiry under min-instances=1, scale-out, concurrent refresh, and revision
overlap.

Before production, measure the local Parquet/DuckDB footprint against Cloud Run
memory and ephemeral-storage limits, pin and test the native DuckDB binding,
verify build packaging and startup extraction, and fail CI if any Edge runtime
imports the native/server adapter. Confirm the deployed Node runtime, CPU/memory
class, writable filesystem path, ADC/IAM access, and graceful shutdown.

## SQL and type parity inventory

The translation inventory is the SQL in `src/lib/bq/pax.ts`, `areas.ts`,
`regions.ts`, `sectors.ts`, `aos.ts`, `search.ts`, and `events.ts`. It includes
BigQuery `STRUCT`/array fields (`attendance`, `fartsacks`, `types`, `tags`),
`UNNEST`, `ARRAY_AGG ... ORDER BY/LIMIT`, `ANY_VALUE`, `COUNTIF`, conditional
distinct counts, `SAFE_DIVIDE`, date spines, `DATE_TRUNC(... WEEK(MONDAY))`,
current-date windows, NULL AO sentinel `0`, and JSON `meta`/preferences
boundaries. Inventory each field as DuckDB type, nullability, and serialized
TypeScript type; explicitly test INT64-to-number behavior and nested list/struct
normalization.

All date arithmetic and persisted date/time output is UTC. Preserve the
Monday-week semantics and ISO strings currently constructed in these modules;
do not depend on process timezone. Every user value uses real DuckDB parameter
binding (never SQL string interpolation); identifiers and filter operators come
only from validated allowlists.

Create query goldens from the exact BigQuery source snapshot/read timestamp
that produced each Parquet release; capture that snapshot identifier and read
timestamp with the release metadata. Do not compare against changing live
views, because that can turn source drift into a false parity failure. Goldens
cover rows, ordering, NULLs, empty arrays, JSON parsing, aggregates, date
boundaries, filters, limits, and error behavior. The test matrix covers each entity (PAX, event,
AO, region, area, sector), each `getPageData`/`getEvents`/search path, mixed
source joins, empty and malformed input, UTC boundary dates, schema revisions,
pointer races, CRC/size corruption, generation changes, failed ADC, no LKG,
refresh concurrency, old/new Cloud Run revisions, and feature-flag on/off.

## Phased implementation

### Phase 1 — release contract and runtime foundation

**Owners:** data-pipeline owner (producer/pointer), platform owner (GCS/Cloud
Run/ADC), data-access owner (DuckDB adapter), security owner (allowlist and
permissions boundary). Define the manifest/pointer schemas, allowlists,
retention/CAS rollback, local lifecycle, metrics, and schema-compatibility
rules. Implement and test the adapter without changing callers; preserve the
BigQuery modules listed in the matrix. Gate on reproducible publish/validate,
corruption rejection, no-Edge/native build validation, ADC-only access, and
503/LKG behavior. The reason for the gate is that a bad release or credential
path is a data-integrity/security incident, not a query-parity bug.

### Phase 2 — query parity and split adapters

**Owners:** data-access owner, with domain owners for PAX/stats and auth/data
owners for mixed functions. Translate the inventory, add true bindings and UTC
normalization, implement the explicit split functions, and land BigQuery-vs-
DuckDB goldens and contract tests. Gate on exact result-shape/type/order parity,
authorization remaining BQ, all mixed-source paths being source-explicit, and
zero silent fallback. The reason is that aggregate drift or a mixed-source
authorization mistake can be presented as valid user data.

### Phase 3 — refresh, operations, and cutover

**Owners:** platform/SRE (rollout, SLO, alerts), data-access owner (refresh and
metrics), release owner (producer/rollback). Add request-TTL reconciliation,
optional Pub/Sub acceleration, lease swap/cleanup, release-tagged caches,
skew/error/CRC/activation metrics, dashboards, and runbooks. Roll out behind a
per-capability feature flag for shadow comparisons and an explicit enable/disable
decision. Firebase App Hosting promotes one verified backend build to all
traffic; it is not a percentage-split or regional-canary workflow control.
Use the documented App Hosting instant rollback to the prior container, or
rebuild-and-rollback when needed, while keeping the flag reversible and BQ
operational for the boundary in the matrix. Direct Cloud Run traffic-splitting
controls are out of scope unless a separate deployment explicitly introduces
and owns them; do not imply they are available through App Hosting.
Gate on the max-skew SLO, no silent fallback, successful rollback, concurrent
revision overlap, explicit 503 rate, memory/startup budgets, and zero
authorization regressions. The reason is that fleet convergence and revision
skew are production correctness properties, not unit-test properties.

After implementation and validation, request exactly one Oracle gate for each
phase (three total); a re-review is warranted only when remediation materially
changes reviewed risk. Each gate must inspect evidence for its phase, and the
parent orchestrator owns the Oracle request/review. No phase is considered
complete merely because the code builds.

## Observability and compatibility

Emit structured metrics/logs for pointer reads/CAS failures, accepted release,
releaseSequence, and pointer/object generations, release skew age, bootstrap/refresh duration, single-flight
waiters, validation rejection reason, CRC/size mismatch, active/LKG state,
503s, lease counts, cleanup failures, query latency/errors, and shadow parity
diffs. Never log credentials or raw user identifiers. Define a machine-readable
compatibility registry of supported pointer, manifest, and dataset
`schemaVersion` values for every serving revision, including which revisions
remain rollback-eligible. Publishing is blocked unless the candidate schema is
supported by every serving and rollback-eligible revision during overlap. If
that cannot hold, coordinate a revision rollout first, or perform a validated
pointer rollback before rolling the application back. Additive fields require
consumer tolerance; renames/removals require a new contract version and a
coordinated rollout.
