# DuckDB Phase 3 operations runbook

This runbook is for the Phase-3 production cutover of the read-only `pv_*`
DuckDB release consumer. It complements
[`duckdb-migration-plan.md`](./duckdb-migration-plan.md) and the producer
contract in [`duckdb-producer-contract.md`](./duckdb-producer-contract.md).

**Owners:** platform/SRE owns deployment, IAM, SLOs, and alerts; the
data-access owner owns refresh, feature flags, and metrics; the release owner
owns producer publication and pointer rollback; the validation owner is the
parent orchestrator. Record the actual people and release IDs in the change
ticket. Do not replace placeholders in this document with guessed values.

## 1. Deployment prerequisites and gates

Before scheduling a rollout, the release owner and platform/SRE must attach
evidence that:

- [ ] The candidate producer release contains exactly the configured dataset
      allowlist, immutable generation-pinned objects, complete manifests,
      schema fingerprints, source snapshot/read timestamp, and required
      query-parity goldens.
- [ ] Every golden was generated from the **same BigQuery snapshot and UTC
      read timestamp** recorded in the release metadata. A live-view comparison
      is not sufficient.
- [ ] The candidate is supported by the compatibility registry of the new
      revision and every revision that remains rollback-eligible.
- [ ] The consumer has passed corruption, generation-change, pointer-race,
      failed-ADC, no-LKG, refresh-concurrency, and old/new revision overlap
      tests.
- [ ] Native DuckDB packaging and startup extraction have been tested in the
      deployed Node runtime; no Edge/runtime path imports the native adapter.
- [ ] The measured release/database footprint fits the selected Cloud Run
      memory and ephemeral-storage limits, with startup and refresh budgets
      recorded.
- [ ] BigQuery remains healthy for the capabilities that remain BQ-owned and
      is available as the explicitly controlled cutback target for migrated
      capabilities. This is not silent fallback behavior.
- [ ] The reversible per-capability flag names, owners, initial state, and
      change-ticket link are recorded. Use placeholders until assigned:
      `<FLAG_FOR_CAPABILITY>`, `<FLAG_OWNER>`, `<CHANGE_ID>`.

Do not begin App Hosting rollout until all boxes are checked and the parent
validation owner has accepted the evidence.

## 2. ADC and least-privilege IAM validation

The serving runtime uses ADC and the GCS SDK. It does not use HMAC keys,
DuckDB `httpfs`, embedded credentials, or request-time remote scans.

The platform/SRE owner must identify, without inventing values:

- project: `<GCP_PROJECT_ID>`;
- serving runtime service account: `<RUNTIME_SERVICE_ACCOUNT_EMAIL>`;
- configured release bucket: `<RELEASE_BUCKET>`; and
- staging and production deployment identities, if different:
  `<STAGING_DEPLOYER>`, `<PRODUCTION_DEPLOYER>`.

Grant the runtime identity only the permissions required to read the fixed
pointer and generation-pinned release objects in `<RELEASE_BUCKET>` (normally
the applicable bucket-level object-view permission, such as
`roles/storage.objectViewer`). Because a normal bucket-level object role is
not a path-prefix boundary, isolate release objects in the configured bucket
or use an equivalently reviewed custom/resource boundary if other bucket
objects must not be readable. Do not grant object creator/admin, bucket admin,
delete, or pointer-write permission to the serving runtime. The producer
identity owns publication and needs only the explicitly approved release
publication and `current.json` CAS duties; its effective scope must be
reviewed because GCS IAM roles are not generally granted to an object-name
prefix. Deployment identities must be separately reviewed; do not reuse
producer credentials in App Hosting.

Validation, performed by platform/SRE against both staging and production
identities:

1. Confirm the effective IAM policy at the intended bucket and project scope;
   record principal, role, scope, and reviewer.
2. From the deployed runtime (or an equivalent identity-faithful smoke job),
   read `<BUCKET>/current.json`, read its referenced manifest, and read one
   generation-pinned object from every required dataset. Record success and
   the object generations, but never record tokens or credentials.
3. Confirm a write/delete attempt by the serving identity is denied. Confirm a
   read outside the configured bucket is denied by IAM, and a read outside the
   configured release prefix is rejected by application validation (or by the
   separately reviewed resource boundary).
4. Confirm ADC resolution, region/project configuration, and failure logging
   on a deliberately invalid or unavailable credential in staging. The result
   must be an explicit refresh failure/LKG or stable-dependency 503, not a
   BigQuery fallback.

Attach the IAM policy export, successful read output, denied-operation output,
and identity-faithful smoke-test run to the change ticket.

## 3. Producer publication and snapshot-golden gate

The producer owner must provide a release handoff before application rollout:

- `<RELEASE_ID>`, `<RELEASE_SEQUENCE>`, `<POINTER_OBJECT_GENERATION>`,
  `<MANIFEST_SHA256>`;
- exact source snapshot identifier and `sourceReadTimestampUtc`;
- manifest/object generations, CRC32C values, sizes, row counts, schema
  fingerprints, and supported contract/schema versions; and
- the immutable URI, generation, query, canonicalization identifier, and
  digest for each required golden.

The producer snapshot and golden artifacts are a release requirement, not an
optional test convenience. Reject the release if any golden was computed from
a different snapshot/read timestamp, if a golden is missing, or if the
producer cannot reproduce the canonical artifact. Never mutate a published
prefix; an incomplete prefix is not a rollback target.

## 4. Feature-flag rollout and BigQuery cutback

The exact capability flags are `DUCKDB_SEARCH_ENABLED`,
`DUCKDB_EVENTS_ENABLED`, `DUCKDB_STATS_PAX_ENABLED`,
`DUCKDB_STATS_REGION_ENABLED`, `DUCKDB_STATS_AREA_ENABLED`,
`DUCKDB_STATS_SECTOR_ENABLED`, and `DUCKDB_STATS_AO_ENABLED`. An unset
capability flag inherits `DUCKDB_ENABLED`; an explicit `true` or `false`
overrides that default. `DUCKDB_ENABLED=false` is the global cutback and
always wins, including over per-capability `true`. There is no enabled-path
fallback: DuckDB errors are served as errors.

Shadow mode is controlled by `DUCKDB_SHADOW_ENABLED`,
`DUCKDB_SHADOW_SAMPLE_RATE`, and `DUCKDB_SHADOW_TIMEOUT_MS`. Before a
capability is enabled, BigQuery remains served while a bounded DuckDB read is
run asynchronously for comparison. It samples at most 10%, times out at 1
second, emits only capability/equality or error telemetry, never logs query
values, and never runs writes or changes the BigQuery response.

The data-access owner runs this sequence per migrated capability, recording
the flag state and observed release tag at each step:

1. **Off/shadow:** keep BigQuery serving. Reconcile and stage DuckDB, run
   generation-pinned validation, and compare DuckDB results with the matching
   BigQuery snapshot/goldens. Investigate every parity diff.
2. **Enable one capability:** enable `<FLAG_FOR_CAPABILITY>` only after the
   parity and readiness gates pass. Keep auth, permissions, preferences,
   eight-box, event-detail, and other BQ-owned boundaries on BigQuery as
   defined by the migration matrix.
3. **Observe:** watch readiness, refresh/activation errors, 503s, query
   latency/errors, release skew, LKG age, memory, ephemeral storage, and
   shadow parity for the agreed observation window `<OBSERVATION_WINDOW>`.
4. **Expand:** enable the next capability only after the release owner and
   SRE owner sign the previous capability's evidence.

**Cutback:** if correctness, readiness, skew, LKG, resource, or error gates
fail, the data-access owner disables the affected flag and records the exact
time and reason. BigQuery resumes for that capability only through this
explicit flag path. Confirm the BQ result path and alerts, then leave the
DuckDB release intact for diagnosis. Do not implement or document an
automatic silent BQ fallback. If the application revision is also suspect,
perform the App Hosting rollback in the next section.

## 5. Firebase App Hosting all-traffic rollout and rollback

Firebase App Hosting promotes one verified backend build to **all traffic**;
it is not a percentage-split or regional-canary control. The platform/SRE
owner must therefore complete staging smoke tests and the flag/shadow gate
before production promotion.

### Rollout

1. Record the verified build/revision `<VERIFIED_BUILD_ID>`, source commit,
   image digest if available, contract-registry version, flags, and config
   references in the change ticket.
2. Deploy through the approved App Hosting workflow. Do not claim that a
   percentage split exists unless a separately owned deployment explicitly
   provides one.
3. Confirm all-traffic health, readiness, native boot, ADC reads, active
   release ID/sequence, and the manual smoke tests below.
4. Keep the prior container and its compatible release in the rollback window.
   Do not garbage-collect a release while any serving revision can still be
   rolled back to it.

### Rollback

For an application/runtime failure, use the documented App Hosting instant
rollback to `<PRIOR_VERIFIED_BUILD_ID>`. If that build is unavailable or
incompatible, rebuild and deploy the last known-good application revision.
Immediately disable affected DuckDB flags if the BQ cutback is safer.

For a data-release failure, do **not** edit Parquet or the published prefix;
use the validated `current.json` CAS procedure below, then allow consumers to
reconcile. App rollback and data rollback are separate actions and may both be
needed. After either rollback, repeat readiness, production smoke, and
evidence capture.

## 6. Current-pointer CAS data rollback

The release owner performs this operation; a second operator reviews it.

1. Identify `<TARGET_RETAINED_RELEASE_ID>` and verify it is complete,
   previously valid, within retention, and supported by every serving and
   rollback-eligible revision.
2. Read `<RELEASE_BUCKET>/current.json` and record its **GCS object
   generation** `<OBSERVED_POINTER_GENERATION>`. Do not use metageneration or
   `releaseSequence` as the CAS token.
3. Validate the target pointer content, manifest SHA-256, manifest generation,
   object generations/CRC32C, schema registry, required goldens, and source
   metadata using generation-pinned reads.
4. Write the rollback pointer with the target release metadata using
   `ifGenerationMatch=<OBSERVED_POINTER_GENERATION>`. Never overwrite a
   release prefix. If precondition fails, stop, reread the pointer, and obtain
   a fresh approval; do not force the update.
5. Read the pointer back, record the new pointer generation and content, and
   verify it names exactly the target release.
6. Wait for consumer reconciliation; confirm every instance converges within
   the max-skew SLO, or page SRE. Confirm active/LKG metrics and smoke tests.

This is a normal validated pointer publication. It is not a bucket restore,
object mutation, or application-level cache edit.

## 7. Readiness, metrics, skew, LKG, and alert response

The data-access owner must expose dashboards and SRE must page on thresholds
approved for the service. At minimum record and alert on:

- pointer reads and CAS failures; accepted release ID/sequence and pointer,
  manifest, and object generations;
- bootstrap/refresh duration, single-flight waiters, validation rejection
  reason, CRC/size mismatch, activation failures, cleanup failures, and lease
  counts;
- active versus LKG state, LKG age, stable-dependency 503 count/rate, query
  latency/errors, and shadow parity diffs;
- release-skew age across instances, with the Phase-3 target of **15 minutes**
  unless the approved production SLO says otherwise; and
- memory, CPU, ephemeral storage, startup, and native-load failures.

Readiness is false on cold start without a valid release, after the configured
hard LKG maximum age, or when validation cannot establish a complete pinned
release. During a refresh, a valid LKG may continue serving. After hard LKG
expiry, return the explicit stable-dependency 503 and page; never serve stale
data indefinitely or silently query BigQuery.

On alert: freeze producer promotion, capture release/pointer generations and
logs without credentials or raw user identifiers, disable the affected flag,
and decide between App Hosting rollback, pointer CAS rollback, or continued
LKG service. Re-run the relevant smoke tests before closing the incident.

## 8. Retention and garbage collection

The release owner retains the current release, prior valid release, and every
object needed by the configured retention window and rollback-eligible
revisions. Garbage collection is generation-aware and must not delete the
current or rollback target. Failed/incomplete prefixes are marked abandoned
and removed only after the producer safety window. Record retention duration
as `<RELEASE_RETENTION_WINDOW>`; do not infer a bucket lifecycle value.

## 9. Manual production and staging smoke tests

Platform/SRE runs these tests as the deployed runtime identity in both
`<STAGING_APP_HOSTING_BACKEND>` and `<PRODUCTION_APP_HOSTING_BACKEND>` and
records HTTP status, request ID, active release ID/sequence, latency, and
timestamp. Use test identities and non-sensitive queries.

### Native/resource checks

- [ ] Server boot loads the pinned native DuckDB binding; no Edge import or
      remote `httpfs` scan occurs.
- [ ] ADC reads the current pointer and generation-pinned objects.
- [ ] A refresh stages and validates a candidate, swaps only after validation,
      and cleans it after leases drain.
- [ ] Concurrent refresh requests single-flight rather than downloading
      multiple databases.
- [ ] Memory and ephemeral-storage remain below approved limits during cold
      boot, refresh, and revision overlap; record peak values.
- [ ] An invalid/corrupt candidate leaves the prior LKG active and produces
      the expected metric; no mixed-release data is served.

### Resource/query checks

- [ ] Authenticated PAX, region, area, sector, AO, event, and search paths
      return expected shape/order for the enabled capability.
- [ ] Mixed paths obtain BQ-owned preferences/identity/detail data from
      BigQuery and DuckDB-owned analytical data from the pinned release.
- [ ] Empty, malformed, boundary-date, NULL/list, and filter/limit cases
      match the approved snapshot goldens.
- [ ] A forced refresh failure serves LKG within age and returns stable-
      dependency 503 after expiry; it never silently falls back to BQ.
- [ ] Flag disable returns the capability to BigQuery and is visible in
      metrics/logs.

### Visual-only SSR limitation

Screenshots or browser checks can establish visual SSR/rendering behavior only.
They do **not** prove native DuckDB loading, ADC/IAM, generation pinning,
pointer CAS, release skew, LKG expiry, parity, or resource limits. Treat visual
SSR evidence as supplementary and keep the native/resource and data checks
above as separate evidence.

## 10. Exact manual evidence checklist

Attach all items below to `<CHANGE_ID>`; a checkbox without an artifact,
timestamp, owner, and environment is incomplete.

- [ ] Approval record naming platform/SRE, data-access, release, and parent
      validation owners.
- [ ] Candidate release ID/sequence, pointer generation before/after, manifest
      SHA-256, contract/schema registry version, and retention decision.
- [ ] Producer snapshot ID, UTC read timestamp, complete dataset manifest
      inventory, object generations/CRC32C, and snapshot-matched golden list
      with digests.
- [ ] Staging native boot, ADC read/deny, refresh/LKG, resource peak, query,
      and flag cutback results with timestamps and request IDs.
- [ ] Production equivalents, including active release ID/sequence and
      release-skew observation.
- [ ] Effective IAM policy export and reviewer; successful reads and denied
      write/delete/out-of-scope checks. Redact credentials and user data.
- [ ] Dashboard links or exported metrics for readiness, refresh/activation,
      503, skew, LKG age, parity, latency/errors, memory, and storage.
- [ ] App Hosting verified build ID, all-traffic rollout result, and prior
      rollback build ID retained.
- [ ] Feature-flag state before/after, observation window, parity decision,
      and explicit BigQuery cutback result (if exercised).
- [ ] If data rollback occurred: target retained release, reviewer, observed
      pointer generation, CAS result, post-CAS pointer generation/content,
      convergence evidence, and post-rollback smoke results.
- [ ] Incident/alert links for any failed gate and the final release decision.

**Validation owner: parent.**
