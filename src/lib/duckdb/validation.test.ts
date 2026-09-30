import { describe, expect, it } from "vitest";
import {
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_V2_CONTRACT_VERSION,
  DUCKDB_V2_DATASETS,
  DUCKDB_V2_SCHEMA_REGISTRY,
  schemaFor,
} from "./constants";
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
  schemaFingerprint,
} from "./validation";

const base = {
  contractVersion: DUCKDB_CONTRACT_VERSION,
  releaseId: "r-1",
  prefix: "gs://bucket/releases/r-1/",
  manifestUri: "gs://bucket/releases/r-1/release.json",
  manifestGeneration: "1",
  manifestSha256: "a".repeat(64),
  schemaVersion: DUCKDB_CONTRACT_VERSION,
  createdAtUtc: "2026-01-01T00:00:00Z",
  producerRevision: "test",
  releaseSequence: 1,
  sourceOrder: "20260101T000000.000000Z",
  sourceHighWaterOrder: "20260101T000000.000000Z",
};
const datasetManifest = (dataset: (typeof DUCKDB_DATASETS)[number]) => {
  const schema = schemaFor(dataset, DUCKDB_CONTRACT_VERSION);
  const goldenBytes = canonicalJson([[1]]);
  return {
    contractVersion: DUCKDB_CONTRACT_VERSION,
    dataset,
    schemaVersion: schema.schemaVersion,
    rowCount: 1,
    totalSizeBytes: 3,
    schemaFingerprintSha256: schemaFingerprint(dataset),
    sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
    sourceReadPolicy: "ordered-sequential-per-dataset",
    sourceOrder: "20260101T000000.000000Z",
    columns: schema.columns,
    goldens: [
      {
        name: schema.goldenSpecifications[0].name,
        uri: "gs://bucket/golden.json",
        generation: "1",
        sizeBytes: goldenBytes.length,
        query: schema.goldenSpecifications[0].query,
        canonicalization: "rows-json-v1",
        sha256: sha256(goldenBytes),
        crc32c: crc32cBase64(goldenBytes),
      },
    ],
    objects: [
      {
        uri: `gs://bucket/releases/r-1/${dataset}/${dataset}.parquet`,
        generation: "2",
        sizeBytes: 3,
        crc32c: crc32cBase64(Buffer.from("abc")),
        rowCount: 1,
      },
    ],
  };
};

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
  it("requires exactly the nine current datasets", () => {
    const order = "20260101T000000.000000Z";
    const datasets = Object.fromEntries(
      DUCKDB_DATASETS.map((d) => [
        d,
        {
          manifestUri: `gs://bucket/releases/r-1/${d}/manifest.json`,
          manifestGeneration: "1",
          schemaVersion: schemaFor(d, DUCKDB_CONTRACT_VERSION).schemaVersion,
          sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
          sourceReadPolicy: "ordered-sequential-per-dataset",
          sourceOrder: order,
        },
      ]),
    );
    const release = {
      contractVersion: DUCKDB_CONTRACT_VERSION,
      releaseId: "r-1",
      createdAtUtc: "2026-01-01T00:00:00Z",
      producerRevision: "test",
      sourceReadPolicy: "ordered-sequential-per-dataset",
      sourceOrder: order,
      datasets,
    };
    expect(validateRelease(release).datasets.pv_pax.schemaVersion).toBe(
      "pv_pax.v2",
    );
    expect(() =>
      validateRelease({
        ...release,
        datasets: { ...datasets, pv_territories: datasets.pv_pax },
      }),
    ).toThrow();
    expect(() =>
      validateRelease({ ...release, contractVersion: "pv-release.v1" }),
    ).toThrow(/unsupported release contractVersion/);
    expect(() =>
      validatePointer({
        ...base,
        contractVersion: "pv-release.v1",
        schemaVersion: "pv-release.v1",
      }),
    ).toThrow(/unsupported pointer contractVersion/);
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
        { ...datasetManifest("pv_pax"), schemaVersion: "pv_pax.v1" },
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

  it("describes the sole supported nine-dataset v2 contract", () => {
    expect(DUCKDB_DATASETS).toHaveLength(9);
    expect(DUCKDB_V2_DATASETS).toHaveLength(9);
    expect(schemaFor("pv_pax", DUCKDB_V2_CONTRACT_VERSION).schemaVersion).toBe(
      "pv_pax.v2",
    );
    expect(() => schemaFor("pv_pax", "pv-release.v1")).toThrow(/unsupported/);
    expect(
      Object.entries(
        schemaFor("pv_events", DUCKDB_V2_CONTRACT_VERSION).columns,
      ).map(([name, column]) => ({ name, ...column })),
    ).toEqual(
      expect.arrayContaining([
        { name: "description", logicalType: "VARCHAR", nullable: true },
        { name: "preblast_rich", logicalType: "JSON", nullable: true },
        { name: "backblast_rich", logicalType: "JSON", nullable: true },
        { name: "meta", logicalType: "JSON", nullable: true },
      ]),
    );
    expect(schemaFingerprint("pv_pax", DUCKDB_V2_CONTRACT_VERSION)).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(
      DUCKDB_V2_SCHEMA_REGISTRY.pv_areas.goldenSpecifications[0].name,
    ).toBe("candidate_transport_check");
  });

  it("validates v2 sequential metadata, ordered columns and source order", () => {
    const order = "20260923T135502.435915Z";
    const times = DUCKDB_V2_DATASETS.map(
      (_, i) => `2026-09-23T13:55:${String(i).padStart(2, "0")}.000000Z`,
    );
    const datasets = Object.fromEntries(
      DUCKDB_V2_DATASETS.map((dataset, i) => [
        dataset,
        {
          manifestUri: `gs://bucket/releases/r-2/${dataset}/manifest.json`,
          manifestGeneration: "2",
          schemaVersion: schemaFor(dataset, DUCKDB_V2_CONTRACT_VERSION)
            .schemaVersion,
          sourceReadPolicy: "ordered-sequential-per-dataset",
          sourceReadTimestampUtc: times[i],
          sourceOrder: order,
        },
      ]),
    );
    const release = {
      contractVersion: DUCKDB_V2_CONTRACT_VERSION,
      releaseId: "r-2",
      createdAtUtc: "2026-09-23T13:57:10.752636Z",
      producerRevision: "test",
      sourceOrder: order,
      sourceReadPolicy: "ordered-sequential-per-dataset",
      datasets,
    };
    expect(validateRelease(release).datasets.pv_pax.schemaVersion).toBe(
      "pv_pax.v2",
    );
    expect(() =>
      validateRelease({
        ...release,
        datasets: {
          ...datasets,
          pv_pax: { ...datasets.pv_pax, sourceOrder: "wrong" },
        },
      }),
    ).toThrow(/sourceOrder/);
    expect(
      validateRelease({
        ...release,
        datasets: {
          ...datasets,
          pv_pax: {
            ...datasets.pv_pax,
            sourceReadTimestampUtc: times[1],
          },
        },
      }).datasets.pv_pax.sourceReadTimestampUtc,
    ).toBe(times[1]);
    expect(() =>
      validateRelease({ ...release, sourceOrder: "20260230T135502.435915Z" }),
    ).toThrow(/order/);
    expect(() =>
      validateRelease({
        ...release,
        datasets: {
          ...datasets,
          pv_pax: {
            ...datasets.pv_pax,
            sourceReadTimestampUtc: "2026-02-30T13:55:10Z",
          },
        },
      }),
    ).toThrow(/timestamp/);
    expect(() =>
      validateRelease({
        ...release,
        datasets: {
          ...datasets,
          pv_pax: {
            ...datasets.pv_pax,
            sourceReadTimestampUtc: "2026-09-23T13:55:10+01:00",
          },
        },
      }),
    ).toThrow(/timestamp/);

    const pointerV2 = {
      ...base,
      contractVersion: DUCKDB_V2_CONTRACT_VERSION,
      schemaVersion: DUCKDB_V2_CONTRACT_VERSION,
      sourceOrder: order,
      sourceHighWaterOrder: "20260923T135503.435915Z",
    };
    expect(validatePointer(pointerV2).sourceHighWaterOrder).toBe(
      "20260923T135503.435915Z",
    );
    expect(() =>
      validatePointer({
        ...pointerV2,
        sourceHighWaterOrder: "20260230T135503.435915Z",
      }),
    ).toThrow(/order/);
    expect(() =>
      validatePointer({ ...pointerV2, schemaVersion: "pv-release.v1" }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      validatePointer({
        ...pointerV2,
        contractVersion: DUCKDB_CONTRACT_VERSION,
        schemaVersion: "pv-release.v1",
      }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      validatePointer({ ...pointerV2, sourceOrder: "not-an-order" }),
    ).toThrow(/order/);
    expect(() =>
      validatePointer({ ...pointerV2, sourceOrder: "20260230T135502.435915Z" }),
    ).toThrow(/order/);

    const schema = schemaFor("pv_pax", DUCKDB_V2_CONTRACT_VERSION);
    const columns = schema.columns as Array<{
      name: string;
      logicalType: string;
      nullable: boolean;
    }>;
    const manifest = {
      contractVersion: DUCKDB_V2_CONTRACT_VERSION,
      dataset: "pv_pax",
      schemaVersion: schema.schemaVersion,
      rowCount: 0,
      totalSizeBytes: 0,
      schemaFingerprintSha256: schemaFingerprint(
        "pv_pax",
        DUCKDB_V2_CONTRACT_VERSION,
      ),
      columns,
      sourceSnapshot: "sequential source reads",
      sourceReadTimestampUtc: "2026-09-23T13:55:10.721532+00:00",
      sourceReadPolicy: "ordered-sequential-per-dataset",
      sourceOrder: order,
      goldens: [
        {
          name: "candidate_transport_check",
          uri: "gs://bucket/x.json",
          generation: "1",
          sizeBytes: 2,
          query: "SELECT COUNT(*) AS row_count FROM pv_pax",
          canonicalization: "rows-json-v1",
          sha256: "a".repeat(64),
          crc32c: "h8K13g==",
        },
      ],
      objects: [
        {
          uri: "gs://bucket/x.parquet",
          generation: "1",
          sizeBytes: 0,
          crc32c: "AAAAAA==",
          rowCount: 0,
        },
      ],
    };
    expect(validateManifest(manifest, "pv_pax").sourceOrder).toBe(order);
    expect(() =>
      validateManifest(
        { ...manifest, columns: [...columns, columns[0]] },
        "pv_pax",
      ),
    ).toThrow(/duplicate/);
    expect(() =>
      validateManifest({ ...manifest, sourceOrder: "not-an-order" }, "pv_pax"),
    ).toThrow(/order/);
    expect(() =>
      validateManifest(
        { ...manifest, sourceReadTimestampUtc: "not-a-time" },
        "pv_pax",
      ),
    ).toThrow(/timestamp/);
    expect(() =>
      validateManifest(
        { ...manifest, sourceReadTimestampUtc: "2026-02-30T13:55:10Z" },
        "pv_pax",
      ),
    ).toThrow(/timestamp/);
    expect(() =>
      validateManifest(
        { ...manifest, sourceReadTimestampUtc: "2026-09-23T13:55:10-01:00" },
        "pv_pax",
      ),
    ).toThrow(/timestamp/);
    expect(() =>
      validateManifest(
        {
          ...manifest,
          goldens: [{ ...manifest.goldens[0], sha256: undefined }],
        },
        "pv_pax",
      ),
    ).toThrow(/sha256/);
    expect(() =>
      validateManifest(
        {
          ...manifest,
          goldens: [{ ...manifest.goldens[0], crc32c: undefined }],
        },
        "pv_pax",
      ),
    ).toThrow(/crc32c/);
  });
});
