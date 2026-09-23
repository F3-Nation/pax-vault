import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DuckDbConfig } from "./config";
import { ReleaseFiles } from "./gcs";
import { nativeCandidateOpener } from "./runtime";
import { DUCKDB_DATASETS, DUCKDB_SCHEMA_REGISTRY } from "./constants";

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
        const columns = Object.entries(DUCKDB_SCHEMA_REGISTRY[dataset].columns);
        const select = columns
          .map(([name, spec]) => {
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
                  : spec.logicalType.endsWith("[]")
                    ? `[]::${spec.logicalType}`
                    : `CAST(NULL AS ${spec.logicalType})`;
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
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
