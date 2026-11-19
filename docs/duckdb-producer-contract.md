# `pv_*` DuckDB release producer contract

This is the handoff contract for the external producer of the immutable
DuckDB/Parquet releases consumed by Pax Vault. The consumer treats a release as
untrusted input: a successful upload is not a publication. Publication occurs
only when the producer has validated the complete release and atomically
advanced `current.json`.

The normative migration requirements are in
[`duckdb-migration-plan.md`](./duckdb-migration-plan.md). This document turns
those requirements into an implementable producer interface.

## 1. Current staging POC release and evidence boundary

The staging pointer has previously named release
`20261011T110818.964799Z-049e3ff018264f8eb14fd84cc84d1567` under
`pax-vault/releases`, with the legacy ten-dataset profile described below. The
consumer also accepts a split eleven-dataset profile; both retain contract
`pv-release.v2`. This remains a staging-only POC, not a production release or
production rollout. The checked-in local mirror
`.gcs/f3-analytics/pax-vault/current.json` is a historical nine-dataset sample,
not a valid current candidate and not evidence of live GCS generation/CAS.
Production remains on BigQuery. Compatibility is limited to the two exact
profiles below; neither permits an incomplete or mixed inventory. Production
compatibility/overlap gates later in this document remain rollout requirements.

The legacy ten-dataset profile includes exactly these datasets:
`pv_pax`, `pv_events`, `pv_regions`, `pv_areas`, `pv_sectors`, `pv_aos`,
`pv_upcoming`, `pv_kotter`, `pv_territories`, and `pv_attendance`. Schema
versions are `pv_pax.v3`, `pv_events.v2`, `pv_areas.v2`, `pv_sectors.v2`,
`pv_attendance.v1`, and v1 for `pv_regions`, `pv_aos`, `pv_upcoming`,
`pv_kotter`, and `pv_territories`.
`pv_attendance.v1` has ordered nullable columns: `refreshed_at TIMESTAMP WITH
TIME ZONE`, `id INTEGER`, `user_id INTEGER`, `event_instance_id INTEGER`,
`q_ind INTEGER`, `coq_ind INTEGER`, `start_date DATE`, `ao_org_id INTEGER`,
`region_org_id INTEGER`, `tags INTEGER[]`, `types INTEGER[]`, and
`categories VARCHAR[]`. `pv_pax.v3` appends nullable `lifetime_posts INTEGER`
and `lifetime_qs INTEGER` after `roles`; all other `pv_pax` columns retain the
v2 order. All listed columns are nullable.
V2 columns are ordered arrays; their order is part of the canonical fingerprint.
The release and entries record `sourceReadPolicy=ordered-sequential-per-dataset`
and `sourceOrder`; each entry and manifest records its own UTC
`sourceReadTimestampUtc`. V2 intentionally has no shared source snapshot or
release-level read timestamp. Sequential reads can observe cross-dataset drift.

The `candidate_transport_check` golden is a fixed row-count query and establishes
transport/count consistency only. It is not source-query parity evidence. The
local artifact records hashes, CRCs, canonical JSON, native schemas/rows, and
count goldens; it is not evidence of a production release. Both BigQuery and
DuckDB replicate upstream Postgres. Producer source parity/conflict checks and
freshness/lag targets are deferred to rollout, with no guarantee asserted here.
Live GCS CAS/readback and Cloud Run capacity remain operational validation items.

The split profile contains the same ten core datasets, but uses `pv_events.v3`
and adds mandatory `pv_event_details.v1`. `pv_events.v3` is the ordered
`pv_events.v2` schema with the following six nullable columns removed; all
remaining columns retain their original order: `description VARCHAR`,
`preblast VARCHAR`, `preblast_rich JSON`, `backblast VARCHAR`,
`backblast_rich JSON`, and `meta JSON`. The detail schema contains those fields plus `event_id INTEGER`
and `refreshed_at TIMESTAMP WITH TIME ZONE`, in this exact nullable column
order: `event_id`, `description`, `preblast`, `preblast_rich`, `backblast`,
`backblast_rich`, `meta`, `refreshed_at`. The split profile's detail dataset,
manifest, object declarations, and golden declaration are mandatory even
though the consumer defers downloading detail payloads until an authenticated
detail request.

## 2. Immutable layout and object set

Use one configured bucket and this layout:

```text
gs://BUCKET/pax-vault/releases/<releaseId>/release.json
gs://BUCKET/pax-vault/releases/<releaseId>/pv_pax/manifest.json
gs://BUCKET/pax-vault/releases/<releaseId>/pv_pax/partitions/pv_pax-0.parquet
gs://BUCKET/pax-vault/releases/<releaseId>/pv_events/manifest.json
gs://BUCKET/pax-vault/releases/<releaseId>/pv_events/partitions/pv_events-0.parquet
... one directory for every allowlisted dataset ...
gs://BUCKET/pax-vault/current.json
```

`releaseId` is unique, immutable, and safe as a path component (for example,
`20260919T122348.105104Z-a9031809a896437ba37f6e32088e1c37`). Never overwrite
or delete an object in a published prefix. Every URI must remain beneath that
prefix; reject `..`, alternate buckets, absolute/path-escaped names, unknown
files, duplicate datasets, and duplicate object entries. `current.json` is the
only mutable object.

The legacy ten-dataset profile is:
`pv_pax`, `pv_events`, `pv_regions`, `pv_areas`, `pv_sectors`, `pv_aos`,
`pv_upcoming`, `pv_kotter`, `pv_territories`, and `pv_attendance`. It must
contain exactly these ten datasets with `pv_events.v2`. The split profile must
contain exactly these ten core datasets plus `pv_event_details` (11 total),
with `pv_events.v3` and `pv_event_details.v1`; do not mix profile schemas or
omit the detail dataset. The historical nine-dataset mirror is not a candidate.
Reject unsupported release contracts. Do not expose `pv_pax` email or roles through analytical
projections; use sensitive fields only through the explicitly defined auth and
identity paths.

## 3. Required release and dataset manifests

`release.json` is an immutable v2 release index. It identifies the release,
contract, and every dataset manifest. It carries sequential-read policy and
order, with read timestamps per dataset entry; it must not claim a shared
snapshot or release-level read timestamp. Unsupported v1 release contracts are
rejected.

```json
{
  "contractVersion": "pv-release.v2",
  "releaseId": "20260919T122348.105104Z-a9031809a896437ba37f6e32088e1c37",
  "createdAtUtc": "2026-09-19T12:24:54.714278Z",
  "producerRevision": "pipeline@abc123",
  "sourceReadPolicy": "ordered-sequential-per-dataset",
  "sourceOrder": "20260919T122348.191387Z",
  "datasets": {
    "pv_pax": {
      "manifestUri": "gs://BUCKET/pax-vault/releases/RELEASE/pv_pax/manifest.json",
      "manifestGeneration": "1789820643043457",
      "schemaVersion": "pv_pax.v3",
      "sourceReadPolicy": "ordered-sequential-per-dataset",
      "sourceReadTimestampUtc": "2026-09-19T12:23:48.191387Z",
      "sourceOrder": "20260919T122348.191387Z"
    }
  }
}
```

The example abbreviates the dataset map; production output must list every
allowlisted dataset and no others. `release.json` itself is not the pointer,
and it must not contain a self-referential hash.

V2 release metadata has this version-specific shape (dataset map abbreviated):

```json
{
  "contractVersion": "pv-release.v2",
  "releaseId": "RELEASE",
  "createdAtUtc": "2026-09-23T13:57:10.752636+00:00",
  "producerRevision": "gha-35868031634-1",
  "sourceReadPolicy": "ordered-sequential-per-dataset",
  "sourceOrder": "20260923T135502.435915Z",
  "datasets": {
    "pv_pax": {
      "manifestUri": "gs://BUCKET/pax-vault/releases/RELEASE/pv_pax/manifest.json",
      "manifestGeneration": "1790171725923504",
      "schemaVersion": "pv_pax.v3",
      "sourceReadPolicy": "ordered-sequential-per-dataset",
      "sourceReadTimestampUtc": "2026-09-23T13:55:10.721532+00:00",
      "sourceOrder": "20260923T135502.435915Z"
    }
  }
}
```

Every v2 dataset entry carries its own source read timestamp and the release
source order/policy. Do not require timestamps to be unique or infer that
registry traversal order is producer read order.

Each dataset must have `manifest.json`, with all object metadata required to
pin and validate reads. The following v2 example uses ordered column arrays;
object-shaped v1 release manifests are unsupported and rejected:

```json
{
  "contractVersion": "pv-release.v2",
  "dataset": "pv_pax",
  "schemaVersion": "pv_pax.v3",
  "rowCount": 105026,
  "totalSizeBytes": 4397550,
  "schemaFingerprintSha256": "<sha256-of-canonical-schema-registry-columns>",
  "columns": [
    { "name": "user_id", "logicalType": "INTEGER", "nullable": true }
  ],
  "sourceReadPolicy": "ordered-sequential-per-dataset",
  "sourceOrder": "20260919T122348.191387Z",
  "sourceReadTimestampUtc": "2026-09-19T12:23:48.191387Z",
  "goldens": [
    {
      "name": "candidate_transport_check",
      "uri": "gs://BUCKET/pax-vault/releases/RELEASE/pv_pax/goldens/candidate_transport_check.json",
      "generation": "1789820642862753",
      "sizeBytes": 19,
      "query": "SELECT COUNT(*) AS row_count FROM pv_pax",
      "canonicalization": "rows-json-v1",
      "sha256": "<sha256-of-golden-bytes>",
      "crc32c": "<base64-crc32c-of-golden-bytes>"
    }
  ],
  "objects": [
    {
      "uri": "gs://BUCKET/pax-vault/releases/RELEASE/pv_pax/partitions/pv_pax-0.parquet",
      "generation": "1789820642862752",
      "sizeBytes": 4397550,
      "crc32c": "BpfXxg==",
      "rowCount": 105026
    }
  ]
}
```

Use the exact GCS object generation returned after each upload. Include all
Parquet files if a dataset is partitioned. Every object path must be unique,
under the dataset release prefix, and its `sizeBytes`/`rowCount` must sum to
the manifest's `totalSizeBytes`/`rowCount`. The manifest's ordered `columns`
array must exactly match the consumer's executable v2 registry (column names,
DuckDB logical types, and nullability); preserve array order when
computing `schemaFingerprintSha256`. V2 manifests carry `sourceReadPolicy`,
`sourceOrder`, and per-dataset `sourceReadTimestampUtc`, and omit
`sourceSnapshot`. `pv_pax.v3` includes email/roles. Legacy `pv_events.v2`
contains the six event-content fields; the split `pv_events.v3` moves them to
the required `pv_event_details.v1` sidecar. Never expose private PAX fields
through analytical projections. Each release dataset must have at least one
golden. A golden is not a name/hash assertion only: its immutable `uri` and
generation are downloaded generation-pinned by the consumer and it must carry
`sizeBytes`, the exact registry verification `query`, and an unambiguous
`canonicalization` identifier. Every v2 golden must include a valid SHA-256
and CRC32C for its immutable artifact bytes; `canonicalValue` may be included
only as an additional check, never as a substitute for SHA-256. `rows-json-v1`
means the ordered DuckDB
`getRows()` JSON array, recursively canonicalized with sorted object keys;
NULL/undefined becomes `null`, bigint becomes `{ "$bigint": "..." }`,
decimal values remain exact strings, dates/timestamps become tagged ISO values,
buffers become `{ "$bytes": "base64" }`, and nested structs/lists/maps are
recursively canonicalized deterministically. The consumer executes the query
after staging and compares its canonical result bytes to the artifact; when
`canonicalValue` is supplied, its canonical JSON bytes are also compared. Golden
artifacts are deterministic outputs of the registry's
verification queries and must be retained with the release.

Artifact classes are exact: the manifest is only
`<release>/<dataset>/manifest.json`; Parquet objects are only
`<release>/<dataset>/partitions/<safe-name>.parquet`; and golden artifacts are
only `<release>/<dataset>/goldens/<safe-name>.json`. No artifact may be reused
across classes or datasets.

The consumer registry is machine-readable and versioned. The staging consumer
accepts exactly the legacy ten-dataset profile or the split eleven-dataset
profile, under the v2 release contract and per-dataset schema versions above;
it rejects the historical nine-dataset profile. Production rollout must list each serving application
revision with its exact pointer schema, release contract, and per-dataset
schema versions. The registry also specifies columns,
types/nullability, non-negative row-count policy, and deterministic verification
query specifications. Unsupported v1 release contracts, unknown schema
versions, missing goldens, column/fingerprint mismatches, v2
release-entry/manifest per-dataset timestamp or order mismatches,
duplicate object paths, and aggregate size/count mismatches are rejected.

## 4. `current.json`, hashes, and canonical bytes

The fixed pointer must have at least this shape:

```json
{
  "contractVersion": "pv-release.v2",
  "releaseId": "20260919T122348.105104Z-a9031809a896437ba37f6e32088e1c37",
  "prefix": "gs://BUCKET/pax-vault/releases/20260919T122348.105104Z-a9031809a896437ba37f6e32088e1c37/",
  "manifestUri": "gs://BUCKET/pax-vault/releases/RELEASE/release.json",
  "manifestGeneration": "1789820696000000",
  "manifestSha256": "<sha256-of-release-json-canonical-bytes>",
  "schemaVersion": "pv-release.v2",
  "createdAtUtc": "2026-09-19T12:24:54.714278Z",
  "producerRevision": "pipeline@abc123",
  "releaseSequence": 42
}
```

Here `manifestUri` refers to `release.json`; its generation and SHA-256 must
match the object actually read by the producer. The pointer has **no
`pointerSha256`**. The GCS object generation returned for `current.json` is
the pointer-content version and is the CAS/read pin. GCS metageneration is
metadata state, not `releaseSequence`, and is not a substitute for content
CAS. A v2 pointer also contains both `sourceOrder` and `sourceHighWaterOrder`;
validate both tokens, link pointer `sourceOrder` to release `sourceOrder`, and
do not assume the pointer orders must be equal. The checked-in pointer uses
`pv-release.v2`.

Canonical JSON means UTF-8, one JSON value, object keys sorted recursively by
Unicode code point, no insignificant whitespace, no BOM, and deterministic
number rendering (integers where the schema says integer; no NaN or Infinity).
Do not hash parsed then differently re-serialized JSON. Serialize once using a
canonical JSON implementation, hash those exact bytes with SHA-256, and upload
those exact bytes. Hashes are lowercase hexadecimal. Verify by downloading the
object and hashing the downloaded bytes. There is no self hash in any object.

## 5. Publish protocol and CAS

1. Allocate a new `releaseId` and write every Parquet object under its new
   prefix. Do not reuse a prefix after any failed attempt.
2. Read back every object and record generation, size, and CRC32C. Validate
   Parquet table names, columns, logical types, nullability, row counts, schema
   fingerprint, source metadata, and required contract-verification goldens.
3. Canonicalize and write `release.json` only after its dataset manifests are
   complete. Read it back, verify its generation, bytes, and SHA-256, then
   validate the complete candidate against the allowlists and registry.
4. Read `current.json` and record its GCS object generation. Update it with
   `ifGenerationMatch=<observed generation>`. For first creation, use
   `ifGenerationMatch=0` (create-only). This is content CAS; do not use
   metageneration for it.
5. Read `current.json` back and validate its content and returned GCS object
   generation. A failed precondition is not publication: re-read the pointer,
   choose the next sequence, and retry. Never overwrite a release prefix.

For the checked-in v2 contract, the fixed golden name is
`candidate_transport_check`, with query `SELECT COUNT(*) AS row_count FROM
<dataset>`. It validates expected row-count transport only; it is not a
source-query parity golden. V2 golden metadata requires SHA-256 and CRC32C.
Source parity/conflict checks and freshness/lag targets are rollout follow-ups,
not prerequisites for this implementation.

Consumers download the pointer, then the manifest and every Parquet object
with generation-pinned GCS reads. They stream objects directly into a unique
candidate directory and enforce configured maximum release and per-object byte
budgets before downloading. They validate every partition, aggregate, schema,
golden, and source timestamp, re-read the pointer immediately before
activation, and discard/restart if the pointer generation changed. This
prevents mixing releases during a concurrent update without retaining all
Parquet buffers in memory.

## 6. Compatibility, source parity, and registry

The staging registry requires an exact supported profile and its pointer,
manifest, and dataset schema versions; it rejects the historical nine-dataset
sample and all mixed/partial profiles. In the split profile, startup validates
all detail declarations but does not fetch detail Parquet or golden payloads.
The first authenticated detail request downloads those payloads generation-
pinned from the same immutable release, then validates the sidecar separately;
sidecar failure leaves the validated core available. For production rollout,
maintain a machine-readable registry for every serving revision and block
publication if any revision cannot read the candidate. Additive-field tolerance
and coordinated handling of breaking changes are production compatibility
gates, not guarantees made by the staging POC.

V2 releases must preserve the producer's ordered sequential read policy, shared
`sourceOrder` token and each dataset's own UTC read timestamp, without inventing
a common snapshot. Sequential reads can observe cross-dataset drift. Both
BigQuery and DuckDB replicate upstream Postgres; source parity/conflict checks,
bounded drift checks, and freshness/lag targets are deferred to rollout, not
prerequisites for this implementation. The fixed count golden establishes
transport/count consistency only, not source-query parity. Stronger query parity
checks may be developed during rollout; no parity or freshness guarantee is
implied here.

## 7. Retention, rollback, and incomplete releases

Keep the current release, the prior valid release, and all objects required by
the configured retention window. Garbage collection must never delete the
current or retained recovery-target prefix and must be generation-aware. A failed or
incomplete prefix is never referenced by `current.json`; mark it abandoned in
producer bookkeeping and clean it only after the safety window. Consumers must
continue using their last-known-good release on refresh failure, subject to
their configured maximum age; they must not fall back silently to BigQuery.

Data recovery may point to a retained, previously valid v2 release using the
same validated pointer CAS as forward publication. Never mutate a published
prefix. Application rollback to an unsupported v1 runtime/release combination
is not supported.

Pub/Sub may emit a “release available” event to accelerate reconciliation, but
it is optional and is not the source of truth. Events may be lost, duplicated,
or reordered; consumers always reconcile from `current.json`.

## 8. Producer implementation checklist

- [ ] Use the configured bucket and exact immutable prefix layout.
- [ ] Publish exactly one supported profile: legacy ten datasets with
      `pv_events.v2`, or the same ten core datasets plus required
      `pv_event_details.v1` with `pv_events.v3`. Never omit details from a split
      release or mix profile schemas. Do not use the historical nine-dataset
      mirror as a candidate.
- [ ] Generate complete per-dataset manifests and `release.json`.
- [ ] Record object generations, CRC32C, byte sizes, row counts, schema
      fingerprints, contract-appropriate source metadata, and goldens. V2
      records per-dataset read timestamps/order; do not claim a shared snapshot.
- [ ] For the PAX deployment, enforce 402,653,184-byte maximum compressed
      object and 536,870,912-byte maximum compressed release limits; measure
      active-plus-staging database memory/storage separately.
- [ ] Canonicalize JSON and compute SHA-256 over the exact uploaded bytes.
- [ ] Validate all objects and manifests by generation-pinned read before CAS.
- [ ] Accept only the v2 pointer/manifest contract and one exact supported
      dataset profile; reject v1 release contracts and mixed/partial profiles.
- [ ] Use create-only `ifGenerationMatch=0` for first `current.json` creation.
- [ ] Use observed-generation `ifGenerationMatch` for every pointer update.
- [ ] Read back and validate the pointer after a successful CAS.
- [ ] Preserve prior v2 releases for retention and validated recovery.
- [ ] Never publish incomplete prefixes, mutate published objects, or rely on
      Pub/Sub delivery.

## 9. Acceptance tests

The producer handoff is accepted only when these tests pass against a GCS
test bucket (or an equivalent generation-faithful emulator):

1. A complete release is reproducibly generated twice from a repeatable source
   input; canonical manifest bytes and SHA-256 are identical. For v2, preserve
   per-dataset read metadata and do not assert a shared source snapshot.
2. The historical nine-dataset mirror and mixed/partial profiles are rejected;
   a candidate is also rejected when it lacks pointer metadata,
   manifest SHA-256/schema fingerprints/goldens, has an extra dataset, or uses
   an unsupported release contract. Both profiles include `pv_attendance` and
   `pv_territories`; the split profile also requires `pv_event_details.v1` and
   `pv_events.v3` with their validated declarations.
3. Missing dataset, extra file, duplicate dataset, path traversal, wrong
   bucket, unknown schema version, and malformed canonical JSON are rejected.
4. Changing a Parquet byte, size, CRC32C, generation, row count, schema, or
   manifest byte after manifest creation is detected before publication.
5. Two publishers racing on `current.json` yield exactly one successful CAS;
   the loser retries from a fresh pointer and never claims publication.
6. First creation succeeds only with `ifGenerationMatch=0`; an existing
   pointer causes creation to fail rather than overwrite it.
7. A pointer generation change during staging causes consumer activation to
   discard the candidate; all reads remain pinned to one release.
8. A valid retained release can be rolled back by the same pointer CAS, while
   an incomplete or deleted release cannot be referenced.
9. Production-rollout registry tests reject unsupported contracts and
   candidates unsupported by a serving revision, and accept only declared
   additive-compatible changes. This overlap gate is not a staging POC
   backward-compatibility promise.
10. V2 policy/order and per-dataset entry/manifest timestamps are valid and
    consistent. Source parity/conflict checks, bounded cross-dataset drift, and
    freshness/lag targets are rollout follow-ups, not asserted by this test.

Validation owner: parent.
