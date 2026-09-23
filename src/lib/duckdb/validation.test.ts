import { describe, expect, it } from "vitest";
import { DUCKDB_CONTRACT_VERSION, DUCKDB_DATASETS } from "./constants";
import { DuckDbReleaseError } from "./errors";
import {
  canonicalJson,
  crc32cBase64,
  sha256,
  parseJson,
  validateIntegrity,
  validateManifest,
  validatePointer,
  validatePointerLayout,
  validateRelease,
  validateUri,
} from "./validation";

const base = {
  contractVersion: DUCKDB_CONTRACT_VERSION,
  releaseId: "r-1",
  prefix: "gs://bucket/releases/r-1/",
  manifestUri: "gs://bucket/releases/r-1/release.json",
  manifestGeneration: "1",
  manifestSha256: "a".repeat(64),
  schemaVersion: "pv-release.v1",
  createdAtUtc: "2026-01-01T00:00:00Z",
  producerRevision: "test",
  releaseSequence: 1,
};
const datasetManifest = (dataset: (typeof DUCKDB_DATASETS)[number]) => ({
  contractVersion: DUCKDB_CONTRACT_VERSION,
  dataset,
  schemaVersion: `${dataset}.v1`,
  rowCount: 1,
  totalSizeBytes: 3,
  schemaFingerprintSha256: "b".repeat(64),
  sourceSnapshot: "snapshot",
  sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
  goldens: [],
  objects: [
    {
      uri: `gs://bucket/releases/r-1/${dataset}/${dataset}.parquet`,
      generation: "2",
      sizeBytes: 3,
      crc32c: crc32cBase64(Buffer.from("abc")),
    },
  ],
});

describe("DuckDB release validation", () => {
  it("accepts a pointer without a self hash and rejects one with it", () => {
    expect(validatePointer(base).releaseSequence).toBe(1);
    expect(() => validatePointer({ ...base, pointerSha256: "bad" })).toThrow(
      DuckDbReleaseError,
    );
    expect(() =>
      validatePointerLayout(
        { ...base, prefix: "gs://bucket/releases/r-1/evil/" },
        "bucket",
        "releases",
      ),
    ).toThrow();
    expect(() =>
      validatePointerLayout(
        { ...base, manifestUri: "gs://bucket/releases/r-1/other.json" },
        "bucket",
        "releases",
      ),
    ).toThrow();
  });
  it("requires exactly the eight current datasets", () => {
    const datasets = Object.fromEntries(
      DUCKDB_DATASETS.map((d) => [
        d,
        {
          manifestUri: `gs://bucket/releases/r-1/${d}/manifest.json`,
          manifestGeneration: "1",
          schemaVersion: `${d}.v1`,
        },
      ]),
    );
    const release = {
      contractVersion: DUCKDB_CONTRACT_VERSION,
      releaseId: "r-1",
      createdAtUtc: "2026-01-01T00:00:00Z",
      producerRevision: "test",
      sourceSnapshot: "snapshot",
      sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
      datasets,
    };
    expect(validateRelease(release).datasets.pv_pax.schemaVersion).toBe(
      "pv_pax.v1",
    );
    expect(() =>
      validateRelease({
        ...release,
        datasets: { ...datasets, pv_territories: datasets.pv_pax },
      }),
    ).toThrow();
  });
  it("rejects unsafe paths and validates size plus CRC32C", () => {
    expect(() =>
      validateUri(
        "gs://other/releases/r-1/x",
        "bucket",
        "releases",
        "releases/r-1",
      ),
    ).toThrow();
    expect(() =>
      validateUri(
        "gs://bucket/releases/r-1/../x",
        "bucket",
        "releases",
        "releases/r-1",
      ),
    ).toThrow();
    expect(() =>
      validateIntegrity(
        Buffer.from("bad"),
        3,
        crc32cBase64(Buffer.from("abc")),
        "file",
      ),
    ).toThrow();
    expect(() =>
      validateManifest({ ...datasetManifest("pv_pax"), objects: [] }, "pv_pax"),
    ).toThrow();
    expect(() =>
      validateManifest(
        { ...datasetManifest("pv_pax"), schemaVersion: "pv_pax.v2" },
        "pv_pax",
      ),
    ).toThrow(/schemaVersion/);
  });
  it("canonicalizes deterministically", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } }).toString()).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
    expect(sha256(Buffer.from("abc"))).toHaveLength(64);
    expect(() => parseJson(Buffer.from('{"b":1,"a":2}'), "test")).toThrow(
      /canonical/,
    );
  });
});
