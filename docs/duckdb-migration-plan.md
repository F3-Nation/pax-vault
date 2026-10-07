# DuckDB migration plan

## Boundary and decisions

The goal is to serve the read-only, release-backed `pv_*` datasets from DuckDB
1.5.5 and immutable Parquet in GCS. Auth allowlist, PAX identity, and region
permission reads use the v2 DuckDB release when `DUCKDB_ENABLED=true` and
`DUCKDB_AUTH_ENABLED` is unset or true; they use BigQuery when DuckDB auth is
disabled. A custom `AUTH_EMAIL_TABLE` is incompatible with DuckDB auth. Errors
do not silently fall back to BigQuery. Preferences, 8-box storage, and other
app-owned writable tables remain BigQuery-owned. Event detail reads use the v2
DuckDB release only when the events capability flag is enabled; BigQuery
remains the source when that flag is off. Auth errors fail closed without
silently falling back: OAuth allowlist errors redirect, and optional identity
lookups may retry according to their existing caller behavior. For DuckDB-backed
analytics APIs/pages, an unavailable or invalid release returns an explicit 503
(or the documented last-known-good result during refresh); this is not a
universal error-status guarantee for every caller.

The existing BigQuery adapter in `src/lib/db.ts` and all listed modules remain
operational throughout rollout. The following matrix is normative:

| Capability / source                                                                                                                          | Owner after migration | Treatment                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pv_pax`, `pv_events`, `pv_regions`, `pv_areas`, `pv_sectors`, `pv_aos`, `pv_upcoming`, `pv_kotter`, `pv_territories` analytical projections | DuckDB release        | V2 is the sole supported runtime release contract and contains nine datasets; reject v1 release contracts. Email/roles are private and never returned by analytical projections.                        |
| Auth allowlist (`src/lib/auth/allowlist.ts`)                                                                                                 | DuckDB / BigQuery     | Use v2 DuckDB when `DUCKDB_ENABLED=true` and `DUCKDB_AUTH_ENABLED` is unset/true; otherwise use BigQuery. Custom `AUTH_EMAIL_TABLE` is incompatible with DuckDB auth. Errors do not silently fall back. |
| Permissions (`src/lib/bq/permissions.ts`)                                                                                                    | DuckDB / BigQuery     | Region permission reads use v2 DuckDB under the same auth flags, otherwise BigQuery. Errors do not silently fall back.                                                                                  |
| Identity (`getPaxIdentityByEmail` in `src/lib/bq/pax.ts`)                                                                                    | DuckDB / BigQuery     | PAX identity lookup uses v2 DuckDB under the same auth flags, otherwise BigQuery; errors do not silently fall back.                                                                                     |
| Preferences (`src/lib/bq/preferences.ts`, `src/lib/preferences.ts`)                                                                          | BigQuery              | Reads and MERGE writes remain BigQuery and uncached for read-your-write behavior.                                                                                                                       |
| 8-box (`getEightBoxPageData`, `getEightBoxVersionPageData`, and all writes in `src/lib/bq/eightBox.ts`)                                      | BigQuery              | Keep `pv_pax_eight_box` storage and writes in BigQuery; owner-display lookups also remain BigQuery.                                                                                                     |
| Event detail content (`getEventDetails` in `src/lib/bq/events.ts`)                                                                           | DuckDB release        | Read detail content from the v2 DuckDB release when the events capability flag is enabled; use BigQuery when that flag is off.                                                                          |
| `getEventById` (`src/lib/bq/events.ts`)                                                                                                      | Split                 | Fetch event/attendance from DuckDB; fetch `pv_regions_preferences.json_config` from BigQuery and join in the adapter.                                                                                   |
| `getPageData` in `src/lib/bq/regions.ts` and `src/lib/bq/aos.ts`                                                                             | Split                 | Analytical page aggregates, events, leaders, upcoming, and kotter use DuckDB; `preferencesJson` remains a BigQuery point lookup.                                                                        |
| `getPageData` in `src/lib/bq/pax.ts`, `areas.ts`, and `sectors.ts`; their `getEvents` and search functions; `src/lib/bq/search.ts`           | DuckDB release        | Migrate the `pv_*` reads, preserving current result shapes and filters.                                                                                                                                 |
| `getRegionAOIds` (`src/lib/bq/regions.ts`)                                                                                                   | BigQuery              | This is a preference-cache invalidation lookup, not a region-permission read; keep it in BigQuery.                                                                                                      |
| Scheduled ETL inputs                                                                                                                         | BigQuery              | Producer continues reading `public.*` source tables; publication does not replace producer source access.                                                                                               |

Mixed functions must not issue an accidental cross-engine SQL query. Their
adapters explicitly name the source for each component and carry one
release-id/generation tag on DuckDB-derived values.

Direct preference reads and writes remain uncached BigQuery point operations,
so an editor sees its own write. When a stats page merges those preferences
into DuckDB-backed page data (`regions.ts` and `aos.ts`), the merged cache key
must include the current release tag and a preference revision/fingerprint;
preference writes invalidate the affected region and inherited AO page keys.

## Current pointer and release protocol

The checked-in local mirror contains a v2 pointer example for
`gs://f3-analytics-nonprod/pax-vault/current.json` (mirror:
`.gcs/f3-analytics/pax-vault/current.json`). The release prefix is
`pax-vault/releases`; the control object is `pax-vault/current.json`. This is
artifact evidence, not proof of a live GCS read/CAS or production deployment.
V2 is the sole supported runtime contract. No DuckDB production releases have
occurred; the local mirror is not evidence of a live release. Reject v1 release
contracts rather than treating them as an application rollback option.

V2 contains exactly nine datasets: `pv_pax`, `pv_events`, `pv_regions`,
`pv_areas`, `pv_sectors`, `pv_aos`, `pv_upcoming`, `pv_kotter`, and
`pv_territories`. `pv_pax`, `pv_events`, `pv_areas`, and `pv_sectors` use v2
schemas; the remaining datasets use v1 schemas. V2 manifests encode ordered
column arrays and fingerprint those exact arrays; column order is contract
data. V2 describes ordered sequential per-dataset source reads, not a shared
source snapshot. Each dataset records its own UTC read timestamp; `sourceOrder`
is a producer ordering token, not evidence of a common snapshot or transaction.
Different sequential reads can observe cross-dataset drift. Both BigQuery and
DuckDB replicate upstream Postgres; source-query parity/conflict checks and
freshness/lag targets are rollout follow-ups, not prerequisites for this
implementation. No freshness or parity guarantee is asserted here. Count-only
`candidate_transport_check` goldens establish transport/count consistency only,
not source-query parity.

### Contract

The producer publishes immutable objects under
`gs://BUCKET/pax-vault/releases/<releaseId>/...`; a release prefix is never overwritten.
The current pointer is `gs://BUCKET/pax-vault/current.json` for this deployment
and is the only mutable object. It contains at least:
`contractVersion`, `releaseId`, immutable `prefix`, `manifestUri`,
`manifestGeneration` (the manifest object's GCS object generation),
`manifestSha256`, `schemaVersion`, `createdAtUtc`,
`producerRevision`, and monotonic logical `releaseSequence`. V2 additionally
records `sourceOrder` and `sourceHighWaterOrder`; validate both independently,
link pointer `sourceOrder` to release `sourceOrder`, and do not assume the
pointer orders must be equal. It does not
contain a `pointerSha256`; the pointer's content is protected by the GCS
object generation returned by the SDK. A GCS **object generation** identifies
the version of pointer content; GCS **metageneration** counts metadata updates
and is a different value, not `releaseSequence` and not a substitute for
content CAS. Hashes cover canonical manifest bytes, not parsed/re-serialized
JSON. V2 release and dataset entries carry ordered-read policy/order; each entry
and dataset manifest carries its own `sourceReadTimestampUtc`. V2 has no shared
release/manifest `sourceSnapshot` or release-level read timestamp. The manifest
contains allowlisted dataset/file names, byte sizes, object GCS generations,
CRC32C values, ordered columns/schema fingerprints, and total size.

The consumer accepts only a configured bucket and an allowlisted immutable
prefix matching `releaseId`; it rejects path traversal, unexpected files,
unknown schema versions, missing manifest entries, generation/hash mismatch,
duplicate datasets, and any dataset outside the allowlist. It verifies the
manifest and every object’s GCS generation and CRC32C before opening DuckDB,
then verifies table names, columns, logical types, nullability, and transport
goldens. Retrieval is pinned to the accepted `(releaseId, releaseSequence,
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
the source of truth. Keep the prior valid pointer and at least the prior v2
release for recovery and the retention window. Recovery is another validated
pointer CAS to that release, followed by the same consumer protocol; never
mutate a published prefix. This is data-release recovery, not compatibility
with a v1 runtime.

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

The checked-in release has about 328.61 MB of Parquet payload, including an
approximately 322.88 MB events object. Configure a 402,653,184-byte per-object
compressed limit and a 536,870,912-byte aggregate compressed release limit for
this deployment. These limits do not bound uncompressed DuckDB database size.
Measure peak memory and ephemeral storage with active and staging databases
present simultaneously, plus download buffers, native startup and revision
overlap. Before production, measure the local Parquet/DuckDB footprint against Cloud Run
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

Do not claim v2 reads share a BigQuery snapshot: the producer reads datasets
sequentially and records each dataset's UTC read timestamp. Existing
`candidate_transport_check` count goldens are transport checks only. Source-query
parity/conflict checks, bounded cross-dataset drift checks, and freshness/lag
targets are deferred to rollout; they are not prerequisites for this code task.
No parity or freshness guarantee is implied by transport/count checks. The test
matrix covers each entity (PAX, event,
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
normalization, implement the explicit split functions, and land query-contract
tests. Validate result shape/type/order and ensure auth allowlist, PAX identity,
and region permissions use the configured auth flag path with no silent
fallback; all mixed-source paths must be source-explicit. Producer-to-BigQuery
source parity/conflict checks are deferred to rollout, not prerequisites for
this implementation.

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
v2-only compatibility registry of supported pointer, manifest, and dataset
`schemaVersion` values for every serving revision. Publishing is blocked unless
the candidate schema is supported by every serving revision during overlap. If
that cannot hold, coordinate a revision rollout first, or perform a validated
v2 pointer recovery before rolling the application back. Additive fields require
consumer tolerance; renames/removals require a new contract version and a
coordinated rollout.
