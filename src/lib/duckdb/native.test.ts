import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DuckDbConfig } from "./config";
import { ReleaseFiles } from "./gcs";
import { nativeCandidateOpener } from "./runtime";
import {
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_DETAILS_DATASET,
  DUCKDB_DETAILS_PROFILE_DATASETS,
  DUCKDB_DETAILS_SCHEMA_REGISTRY,
  DUCKDB_SCHEMA_REGISTRY,
} from "./constants";
import { canonicalDuckDbRows, schemaFingerprint } from "./validation";

const config: DuckDbConfig = {
  enabled: true,
  bucket: "bucket",
  prefix: "releases",
  controlObject: "current.json",
  cacheDir: "/tmp",
  refreshTtlMs: 1000,
  maxLkgAgeMs: 1000,
  memoryLimit: "64MB",
  maxReleaseBytes: 1000000,
  maxObjectBytes: 100000,
};
const fixturePointer = {
  contractVersion: DUCKDB_CONTRACT_VERSION,
  releaseId: "native-fixture",
  prefix: "gs://bucket/releases/native-fixture/",
  manifestUri: "gs://bucket/releases/native-fixture/release.json",
  manifestGeneration: "1",
  manifestSha256: "a".repeat(64),
  schemaVersion: DUCKDB_CONTRACT_VERSION,
  createdAtUtc: "2026-01-01T00:00:00Z",
  producerRevision: "native-test",
  releaseSequence: 1,
};

describe("native DuckDB candidate", () => {
  it("opens a generated Parquet fixture read-only and queries it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pax-duckdb-native-"));
    const dbPath = join(dir, "release.duckdb");
    try {
      const { DuckDBInstance } = await import("@duckdb/node-api");
      const writer = await DuckDBInstance.create(join(dir, "writer.duckdb"));
      const writeConnection = await writer.connect();
      const parquetPaths = new Map<string, string[]>();
      for (const dataset of DUCKDB_DATASETS) {
        const parquet = join(dir, `${dataset}-0.parquet`);
        const columns = DUCKDB_SCHEMA_REGISTRY[dataset].columns as readonly {
          name: string;
          logicalType: string;
        }[];
        const select = columns
          .map(({ name, logicalType }) => {
            const expression =
              name === "user_id" ||
              name === "event_id" ||
              name === "region_id" ||
              name === "area_id" ||
              name === "sector_id" ||
              name === "ao_id"
                ? "CAST(1 AS INTEGER)"
                : name === "f3_name" || name.endsWith("_name")
                  ? "'fixture'"
                  : logicalType.endsWith("[]")
                    ? `[]::${logicalType}`
                    : `CAST(NULL AS ${logicalType})`;
            return `${expression} AS "${name}"`;
          })
          .join(", ");
        await writeConnection.run(
          `COPY (SELECT ${select}) TO '${parquet.replaceAll("'", "''")}' (FORMAT PARQUET)`,
        );
        parquetPaths.set(dataset, [parquet]);
      }
      writeConnection.closeSync();
      writer.closeSync();
      const release = {
        pointer: fixturePointer,
        release: {
          contractVersion: DUCKDB_CONTRACT_VERSION,
          datasets: Object.fromEntries(
            DUCKDB_DATASETS.map((dataset) => [dataset, {}]),
          ),
        },
        parquetPaths,
      } as unknown as ReleaseFiles;
      const handle = await nativeCandidateOpener.open(dbPath, release, config);
      const connection = await handle.connect();
      const rows = await connection.query(
        `SELECT user_id, f3_name,
          STRUCT_PACK(label := 'nested', nums := [1, 2]) AS nested,
          DATE '2024-01-02' AS event_date,
          TIMESTAMP '2024-01-02 03:04:05' AS event_timestamp,
          CAST(12.50 AS DECIMAL(10,2)) AS amount,
          CAST(9223372036854775807 AS BIGINT) AS large_count
         FROM pv_pax`,
      );
      const attendanceRows = await connection.query(
        "SELECT id, event_instance_id, tags, types, categories FROM pv_attendance",
      );
      connection.close();
      await handle.close();
      expect(rows).toEqual([
        {
          user_id: 1,
          f3_name: "fixture",
          nested: { label: "nested", nums: [1, 2] },
          event_date: "2024-01-02",
          event_timestamp: new Date("2024-01-02T03:04:05.000Z"),
          amount: 12.5,
          large_count: 9223372036854775807n,
        },
      ]);
      expect(attendanceRows).toHaveLength(1);
      expect(attendanceRows[0]).toMatchObject({
        id: null,
        event_instance_id: null,
        tags: [],
        types: [],
        categories: [],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects physical Parquet columns hidden by the registry projection", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pax-duckdb-native-extra-"));
    const dbPath = join(dir, "release.duckdb");
    try {
      const { DuckDBInstance } = await import("@duckdb/node-api");
      const writer = await DuckDBInstance.create(join(dir, "writer.duckdb"));
      const connection = await writer.connect();
      const columns = DUCKDB_SCHEMA_REGISTRY.pv_pax.columns as readonly {
        name: string;
        logicalType: string;
      }[];
      const parquetPaths: string[] = [];
      for (const [index, hasExtraColumn] of [false, true].entries()) {
        const parquet = join(dir, `pv_pax-${index}.parquet`);
        const select = columns
          .map(({ name, logicalType }) => {
            const expression =
              name === "user_id"
                ? "CAST(1 AS INTEGER)"
                : name === "f3_name"
                  ? "'fixture'"
                  : logicalType.endsWith("[]")
                    ? `[]::${logicalType}`
                    : `CAST(NULL AS ${logicalType})`;
            return `${expression} AS "${name}"`;
          })
          .concat(hasExtraColumn ? [`'unexpected' AS hidden_field`] : [])
          .join(", ");
        await connection.run(
          `COPY (SELECT ${select}) TO '${parquet.replaceAll("'", "''")}' (FORMAT PARQUET)`,
        );
        parquetPaths.push(parquet);
      }
      connection.closeSync();
      writer.closeSync();

      const release = {
        pointer: fixturePointer,
        release: {
          contractVersion: DUCKDB_CONTRACT_VERSION,
          datasets: Object.fromEntries(
            DUCKDB_DATASETS.map((dataset) => [dataset, {}]),
          ),
        },
        parquetPaths: new Map(
          DUCKDB_DATASETS.map((dataset) => [
            dataset,
            dataset === "pv_pax" ? parquetPaths : [],
          ]),
        ),
      } as unknown as ReleaseFiles;
      await expect(
        nativeCandidateOpener.open(dbPath, release, config),
      ).rejects.toThrow(/physical schema does not match registry/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("opens and independently validates a split-profile details sidecar", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pax-duckdb-native-details-"));
    try {
      const { DuckDBInstance } = await import("@duckdb/node-api");
      const writer = await DuckDBInstance.create(join(dir, "writer.duckdb"));
      const connection = await writer.connect();
      const parquet = join(dir, "pv_event_details-0.parquet");
      const columns = DUCKDB_DETAILS_SCHEMA_REGISTRY.pv_event_details
        .columns as readonly { name: string; logicalType: string }[];
      const select = columns
        .map(({ name, logicalType }) => {
          const expression =
            name === "event_id"
              ? "CAST(7 AS INTEGER)"
              : logicalType.endsWith("[]")
                ? `[]::${logicalType}`
                : `CAST(NULL AS ${logicalType})`;
          return `${expression} AS "${name}"`;
        })
        .join(", ");
      await connection.run(
        `COPY (SELECT ${select}) TO '${parquet.replaceAll("'", "''")}' (FORMAT PARQUET)`,
      );
      connection.closeSync();
      writer.closeSync();

      const detailSchema = DUCKDB_DETAILS_SCHEMA_REGISTRY.pv_event_details;
      const golden = canonicalDuckDbRows([[1n]]);
      const manifest = {
        dataset: DUCKDB_DETAILS_DATASET,
        rowCount: 1,
        objects: [{ rowCount: 1 }],
        schemaFingerprintSha256: schemaFingerprint(
          DUCKDB_DETAILS_DATASET,
          DUCKDB_CONTRACT_VERSION,
          "details",
        ),
      };
      const release = {
        pointer: fixturePointer,
        release: {
          contractVersion: DUCKDB_CONTRACT_VERSION,
          datasets: Object.fromEntries(
            DUCKDB_DETAILS_PROFILE_DATASETS.map((dataset) => [dataset, {}]),
          ),
        },
        manifests: new Map([[DUCKDB_DETAILS_DATASET, manifest]]),
        goldens: new Map([
          [
            DUCKDB_DETAILS_DATASET,
            new Map([["candidate_transport_check", golden]]),
          ],
        ]),
        parquetPaths: new Map([[DUCKDB_DETAILS_DATASET, [parquet]]]),
      } as unknown as ReleaseFiles;
      const handle = await nativeCandidateOpener.open(
        join(dir, "details.duckdb"),
        release,
        config,
      );
      const query = await handle.connect();
      await expect(
        query.query("SELECT event_id FROM pv_event_details"),
      ).resolves.toEqual([{ event_id: 7 }]);
      query.close();
      await handle.close();

      const wrongSchemaPath = join(dir, "pv_event_details-extra.parquet");
      const badWriter = await DuckDBInstance.create(
        join(dir, "bad-writer.duckdb"),
      );
      const badWriteConnection = await badWriter.connect();
      await badWriteConnection.run(
        `COPY (SELECT ${select}, 'extra' AS hidden_field) TO '${wrongSchemaPath.replaceAll("'", "''")}' (FORMAT PARQUET)`,
      );
      badWriteConnection.closeSync();
      badWriter.closeSync();
      await expect(
        nativeCandidateOpener.open(
          join(dir, "bad-schema.duckdb"),
          {
            ...release,
            parquetPaths: new Map([
              [DUCKDB_DETAILS_DATASET, [wrongSchemaPath]],
            ]),
          },
          config,
        ),
      ).rejects.toThrow(/physical schema does not match registry/);

      const badCount = {
        ...release,
        manifests: new Map([
          [DUCKDB_DETAILS_DATASET, { ...manifest, objects: [{ rowCount: 2 }] }],
        ]),
      } as unknown as ReleaseFiles;
      await expect(
        nativeCandidateOpener.open(
          join(dir, "bad-count.duckdb"),
          badCount,
          config,
        ),
      ).rejects.toThrow(/partition row count mismatch/);
      const badGolden = {
        ...release,
        goldens: new Map([
          [
            DUCKDB_DETAILS_DATASET,
            new Map([
              ["candidate_transport_check", canonicalDuckDbRows([[2n]])],
            ]),
          ],
        ]),
      };
      await expect(
        nativeCandidateOpener.open(
          join(dir, "bad-golden.duckdb"),
          badGolden,
          config,
        ),
      ).rejects.toThrow(/verification golden mismatch/);

      await expect(
        nativeCandidateOpener.open(
          join(dir, "missing-core.duckdb"),
          {
            ...release,
            parquetPaths: new Map([["pv_pax", [parquet]]]),
          },
          config,
        ),
      ).rejects.toThrow(/materialized datasets/);
      expect(detailSchema.schemaVersion).toBe("pv_event_details.v1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
