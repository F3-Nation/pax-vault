import { createHash } from "node:crypto";
import {
  DuckDbDataset,
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_SCHEMA_REGISTRY,
  DUCKDB_COMPATIBILITY_REGISTRY,
} from "./constants";
import { DuckDbReleaseError } from "./errors";

export interface Pointer {
  contractVersion: string;
  releaseId: string;
  prefix: string;
  manifestUri: string;
  manifestGeneration: string;
  manifestSha256: string;
  schemaVersion: string;
  createdAtUtc: string;
  producerRevision: string;
  releaseSequence: number;
}
export interface ReleaseIndex {
  contractVersion: string;
  releaseId: string;
  createdAtUtc: string;
  producerRevision: string;
  sourceSnapshot: string;
  sourceReadTimestampUtc: string;
  datasets: Record<
    DuckDbDataset,
    { manifestUri: string; manifestGeneration: string; schemaVersion: string }
  >;
}
export interface DatasetManifest {
  contractVersion: string;
  dataset: DuckDbDataset;
  schemaVersion: string;
  rowCount: number;
  totalSizeBytes: number;
  schemaFingerprintSha256: string;
  sourceSnapshot: string;
  sourceReadTimestampUtc: string;
  goldens: Array<{
    name: string;
    uri: string;
    generation: string;
    sizeBytes: number;
    query: string;
    canonicalization: string;
    sha256?: string;
    canonicalValue?: unknown;
  }>;
  objects: Array<{
    uri: string;
    generation: string;
    sizeBytes: number;
    crc32c: string;
    rowCount: number;
  }>;
}

const hex = /^[a-f0-9]{64}$/;
const safeId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DuckDbReleaseError(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function string(o: Record<string, unknown>, key: string): string {
  if (typeof o[key] !== "string" || !o[key])
    throw new DuckDbReleaseError(`${key} must be a non-empty string`);
  return o[key] as string;
}
function integer(o: Record<string, unknown>, key: string, min = 0): number {
  if (!Number.isSafeInteger(o[key]) || (o[key] as number) < min)
    throw new DuckDbReleaseError(`${key} must be an integer >= ${min}`);
  return o[key] as number;
}

export function canonicalJson(value: unknown): Buffer {
  const walk = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(walk)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as object)
              .sort()
              .map((k) => [k, walk((v as Record<string, unknown>)[k])]),
          )
        : v;
  return Buffer.from(JSON.stringify(walk(value)));
}
/** Shared rows-json-v1 encoding for producer and consumer DuckDB goldens. */
export function canonicalDuckDbRows(rows: unknown): Buffer {
  const normalize = (value: unknown): unknown => {
    if (value === null || value === undefined) return null;
    if (typeof value === "bigint") return { $bigint: value.toString() };
    if (value instanceof Date) return { $timestamp: value.toISOString() };
    if (Buffer.isBuffer(value)) return { $bytes: value.toString("base64") };
    if (Array.isArray(value)) return value.map(normalize);
    if (value instanceof Map)
      return [...value.entries()].map(([key, entry]) => [
        normalize(key),
        normalize(entry),
      ]);
    if (typeof value === "object")
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    return value;
  };
  return canonicalJson(normalize(rows));
}
export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function schemaFingerprint(dataset: DuckDbDataset): string {
  return sha256(canonicalJson(DUCKDB_SCHEMA_REGISTRY[dataset].columns));
}
export function parseJson(bytes: Buffer, label: string): unknown {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!Buffer.from(bytes).equals(canonicalJson(value)))
      throw new DuckDbReleaseError(`${label} is not canonical JSON`);
    return value;
  } catch (cause) {
    if (cause instanceof DuckDbReleaseError) throw cause;
    throw new DuckDbReleaseError(
      `${label} is not valid JSON: ${String(cause)}`,
    );
  }
}

export function validatePointer(value: unknown): Pointer {
  const o = object(value, "pointer");
  const releaseId = string(o, "releaseId");
  if (!safeId.test(releaseId))
    throw new DuckDbReleaseError("pointer releaseId is unsafe");
  if (string(o, "contractVersion") !== DUCKDB_CONTRACT_VERSION)
    throw new DuckDbReleaseError("unsupported pointer contractVersion");
  if (
    !DUCKDB_COMPATIBILITY_REGISTRY.servingRevisions.some(
      (revision) =>
        revision.pointerSchemaVersion === string(o, "schemaVersion"),
    )
  )
    throw new DuckDbReleaseError("unsupported pointer schemaVersion");
  integer(o, "releaseSequence", 0);
  for (const key of [
    "prefix",
    "manifestUri",
    "manifestGeneration",
    "manifestSha256",
    "schemaVersion",
    "createdAtUtc",
    "producerRevision",
  ])
    string(o, key);
  if (!hex.test(o.manifestSha256 as string))
    throw new DuckDbReleaseError(
      "pointer manifestSha256 must be lowercase SHA-256",
    );
  if (o.pointerSha256 !== undefined)
    throw new DuckDbReleaseError("pointerSha256 is forbidden");
  return o as unknown as Pointer;
}

export function validateRelease(value: unknown): ReleaseIndex {
  const o = object(value, "release");
  if (
    string(o, "contractVersion") !== DUCKDB_CONTRACT_VERSION ||
    !DUCKDB_COMPATIBILITY_REGISTRY.servingRevisions.some(
      (revision) => revision.releaseContractVersion === o.contractVersion,
    )
  )
    throw new DuckDbReleaseError("unsupported release contractVersion");
  const releaseId = string(o, "releaseId");
  if (!safeId.test(releaseId))
    throw new DuckDbReleaseError("releaseId is unsafe");
  for (const k of [
    "createdAtUtc",
    "producerRevision",
    "sourceSnapshot",
    "sourceReadTimestampUtc",
  ])
    string(o, k);
  const datasets = object(o.datasets, "datasets");
  if (
    Object.keys(datasets).sort().join(",") !==
    [...DUCKDB_DATASETS].sort().join(",")
  )
    throw new DuckDbReleaseError(
      "release must contain exactly the eight supported datasets",
    );
  for (const dataset of DUCKDB_DATASETS) {
    const d = object(datasets[dataset], `${dataset} release entry`);
    string(d, "manifestUri");
    string(d, "manifestGeneration");
    string(d, "schemaVersion");
    if (d.schemaVersion !== DUCKDB_SCHEMA_REGISTRY[dataset].schemaVersion)
      throw new DuckDbReleaseError(
        `${dataset} has an unsupported schemaVersion`,
      );
  }
  return o as unknown as ReleaseIndex;
}

export function validateManifest(
  value: unknown,
  dataset: DuckDbDataset,
): DatasetManifest {
  const o = object(value, `${dataset} manifest`);
  if (
    string(o, "contractVersion") !== DUCKDB_CONTRACT_VERSION ||
    o.dataset !== dataset
  )
    throw new DuckDbReleaseError(`${dataset} manifest identity is invalid`);
  for (const k of [
    "schemaVersion",
    "schemaFingerprintSha256",
    "sourceSnapshot",
    "sourceReadTimestampUtc",
  ])
    string(o, k);
  if (o.schemaVersion !== DUCKDB_SCHEMA_REGISTRY[dataset].schemaVersion)
    throw new DuckDbReleaseError(
      `${dataset} manifest has an unsupported schemaVersion`,
    );
  const columns = object(o.columns, `${dataset} columns`);
  if (
    !canonicalJson(columns).equals(
      canonicalJson(DUCKDB_SCHEMA_REGISTRY[dataset].columns),
    )
  )
    throw new DuckDbReleaseError(
      `${dataset} columns do not match the consumer registry`,
    );
  if (o.schemaFingerprintSha256 !== schemaFingerprint(dataset))
    throw new DuckDbReleaseError(`${dataset} schema fingerprint mismatch`);
  integer(o, "rowCount");
  integer(o, "totalSizeBytes");
  if (!hex.test(o.schemaFingerprintSha256 as string))
    throw new DuckDbReleaseError(`${dataset} schema fingerprint is invalid`);
  if (!Array.isArray(o.objects) || o.objects.length === 0)
    throw new DuckDbReleaseError(`${dataset} must contain objects`);
  const paths = new Set<string>();
  let totalSize = 0;
  let totalRows = 0;
  for (const raw of o.objects) {
    const x = object(raw, `${dataset} object`);
    for (const k of ["uri", "generation", "crc32c"]) string(x, k);
    integer(x, "sizeBytes");
    integer(x, "rowCount");
    if (paths.has(x.uri as string))
      throw new DuckDbReleaseError(`${dataset} has duplicate object paths`);
    paths.add(x.uri as string);
    totalSize += x.sizeBytes as number;
    totalRows += x.rowCount as number;
  }
  if (totalSize !== o.totalSizeBytes || totalRows !== o.rowCount)
    throw new DuckDbReleaseError(`${dataset} aggregate size/count mismatch`);
  if (!Array.isArray(o.goldens) || o.goldens.length === 0)
    throw new DuckDbReleaseError(`${dataset} requires at least one golden`);
  for (const raw of o.goldens) {
    const golden = object(raw, `${dataset} golden`);
    string(golden, "name");
    string(golden, "uri");
    string(golden, "generation");
    integer(golden, "sizeBytes");
    string(golden, "query");
    if (string(golden, "canonicalization") !== "rows-json-v1")
      throw new DuckDbReleaseError(
        `${dataset} golden canonicalization is unsupported`,
      );
    if (golden.sha256 === undefined && golden.canonicalValue === undefined)
      throw new DuckDbReleaseError(
        `${dataset} golden needs sha256 or canonicalValue`,
      );
    if (
      golden.sha256 !== undefined &&
      (typeof golden.sha256 !== "string" || !hex.test(golden.sha256))
    )
      throw new DuckDbReleaseError(`${dataset} golden sha256 is invalid`);
  }
  const expectedGoldens = DUCKDB_SCHEMA_REGISTRY[dataset].goldenSpecifications
    .map((golden) => golden.name)
    .sort();
  const actualGoldens = (o.goldens as unknown[])
    .map((golden) => (golden as Record<string, unknown>).name)
    .sort();
  if (JSON.stringify(expectedGoldens) !== JSON.stringify(actualGoldens))
    throw new DuckDbReleaseError(
      `${dataset} golden specifications do not match the consumer registry`,
    );
  for (const spec of DUCKDB_SCHEMA_REGISTRY[dataset].goldenSpecifications) {
    const golden = (o.goldens as Array<Record<string, unknown>>).find(
      (item) => item.name === spec.name,
    );
    if (!golden || golden.query !== spec.query)
      throw new DuckDbReleaseError(
        `${dataset} golden query does not match the consumer registry`,
      );
  }
  return o as unknown as DatasetManifest;
}

export function validateUri(
  uri: string,
  bucket: string,
  prefix: string,
  expectedPrefix: string,
): string {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (
    !match ||
    match[1] !== bucket ||
    match[2].includes("..") ||
    !match[2].startsWith(`${expectedPrefix}/`)
  )
    throw new DuckDbReleaseError(
      `URI is outside configured bucket/prefix: ${uri}`,
    );
  return match[2];
}

export function validatePointerLayout(
  pointer: Pointer,
  bucket: string,
  prefix: string,
): void {
  const expectedPrefix = `gs://${bucket}/${prefix}/${pointer.releaseId}/`;
  if (pointer.prefix !== expectedPrefix)
    throw new DuckDbReleaseError(
      "pointer prefix does not match configured release layout",
    );
  if (pointer.manifestUri !== `${expectedPrefix}release.json`)
    throw new DuckDbReleaseError(
      "pointer manifestUri must be release.json under pointer.prefix",
    );
}

export function validateIntegrity(
  bytes: Buffer,
  expectedSize: number,
  expectedCrc32c: string,
  label: string,
): void {
  if (bytes.length !== expectedSize)
    throw new DuckDbReleaseError(`${label} size mismatch`);
  if (crc32cBase64(bytes) !== expectedCrc32c)
    throw new DuckDbReleaseError(`${label} CRC32C mismatch`);
}

export function crc32cBase64(bytes: Buffer): string {
  return crc32cFinish(crc32cUpdate(0xffffffff, bytes));
}
export function crc32cUpdate(crc: number, bytes: Buffer): number {
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0x82f63b78 : 0);
  }
  return crc;
}
export function crc32cFinish(crc: number): string {
  const out = Buffer.alloc(4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return out.toString("base64");
}
