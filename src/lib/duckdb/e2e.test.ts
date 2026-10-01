import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_SCHEMA_REGISTRY,
} from "./constants";
import { DuckDbConfig } from "./config";
import { GcsClient, GcsReleaseRepository } from "./gcs";
import { DuckDbRuntime } from "./runtime";
import {
  canonicalDuckDbRows,
  canonicalJson,
  crc32cBase64,
  schemaFingerprint,
  sha256,
} from "./validation";

const config = (dir: string): DuckDbConfig => ({
  enabled: true,
  bucket: "e2e-bucket",
  prefix: "releases",
  controlObject: "current.json",
  cacheDir: dir,
  refreshTtlMs: 1000,
  maxLkgAgeMs: 60000,
  memoryLimit: "384MB",
  maxReleaseBytes: 100000000,
  maxObjectBytes: 10000000,
});

describe("complete generation-pinned DuckDB release", () => {
  it("streams, validates, opens, and queries all nine real Parquet datasets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pax-duckdb-e2e-"));
    try {
      const { DuckDBInstance } = await import("@duckdb/node-api");
      const writer = await DuckDBInstance.create(join(dir, "writer.duckdb"));
      const connection = await writer.connect();
      const objects = new Map<string, { bytes: Buffer; generation: string }>();
      const releaseId = "e2e-release";
      const root = `gs://e2e-bucket/releases/${releaseId}`;
      const sourceOrder = "20260101T000000.000000Z";
      const datasets: Record<
        string,
        {
          manifestUri: string;
          manifestGeneration: string;
          schemaVersion: string;
          sourceReadTimestampUtc: string;
          sourceReadPolicy: string;
          sourceOrder: string;
        }
      > = {};
      for (const dataset of DUCKDB_DATASETS) {
        const parquetPath = join(dir, `${dataset}-0.parquet`);
        const select = (
          DUCKDB_SCHEMA_REGISTRY[dataset].columns as readonly {
            name: string;
            logicalType: string;
          }[]
        )
          .map(({ name, logicalType }) => {
            const expression =
              name === "user_id" || name.endsWith("_id")
                ? "CAST(1 AS INTEGER)"
                : name === "f3_name" || name.endsWith("_name")
                  ? "'fixture'"
                  : logicalType.endsWith("[]")
                    ? `[]::${logicalType}`
                    : `CAST(NULL AS ${logicalType})`;
            return `${expression} AS "${name}"`;
          })
          .join(", ");
        await connection.run(
          `COPY (SELECT ${select}) TO '${parquetPath}' (FORMAT PARQUET)`,
        );
        const bytes = await readFile(parquetPath);
        const generation = `${1000 + objects.size}`;
        const uri = `${root}/${dataset}/partitions/${dataset}-0.parquet`;
        objects.set(uri, { bytes, generation });
        const goldenBytes = canonicalDuckDbRows([[1n]]);
        const goldenUri = `${root}/${dataset}/goldens/candidate_transport_check.json`;
        objects.set(goldenUri, {
          bytes: goldenBytes,
          generation: `${2000 + objects.size}`,
        });
        datasets[dataset] = {
          manifestUri: `${root}/${dataset}/manifest.json`,
          manifestGeneration: `${3000 + objects.size}`,
          schemaVersion: DUCKDB_SCHEMA_REGISTRY[dataset].schemaVersion,
          sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
          sourceReadPolicy: "ordered-sequential-per-dataset",
          sourceOrder,
        };
        objects.set(datasets[dataset].manifestUri, {
          bytes: Buffer.alloc(0),
          generation: datasets[dataset].manifestGeneration as string,
        });
      }
      connection.closeSync();
      writer.closeSync();
      for (const dataset of DUCKDB_DATASETS) {
        const parquetUri = `${root}/${dataset}/partitions/${dataset}-0.parquet`;
        const parquet = objects.get(parquetUri)!;
        const goldenUri = `${root}/${dataset}/goldens/candidate_transport_check.json`;
        const schema = DUCKDB_SCHEMA_REGISTRY[dataset];
        const golden = objects.get(goldenUri)!;
        const manifest = {
          contractVersion: DUCKDB_CONTRACT_VERSION,
          dataset,
          schemaVersion: DUCKDB_SCHEMA_REGISTRY[dataset].schemaVersion,
          rowCount: 1,
          totalSizeBytes: parquet.bytes.length,
          schemaFingerprintSha256: schemaFingerprint(dataset),
          columns: DUCKDB_SCHEMA_REGISTRY[dataset].columns,
          sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
          sourceReadPolicy: "ordered-sequential-per-dataset",
          sourceOrder,
          goldens: [
            {
              name: schema.goldenSpecifications[0].name,
              uri: goldenUri,
              generation: golden.generation,
              sizeBytes: golden.bytes.length,
              sha256: sha256(golden.bytes),
              crc32c: crc32cBase64(golden.bytes),
              query: schema.goldenSpecifications[0].query,
              canonicalization: "rows-json-v1",
            },
          ],
          objects: [
            {
              uri: parquetUri,
              generation: parquet.generation,
              sizeBytes: parquet.bytes.length,
              crc32c: crc32cBase64(parquet.bytes),
              rowCount: 1,
            },
          ],
        };
        const entry = datasets[dataset];
        objects.set(entry.manifestUri, {
          bytes: canonicalJson(manifest),
          generation: entry.manifestGeneration,
        });
      }
      const release = {
        contractVersion: DUCKDB_CONTRACT_VERSION,
        releaseId,
        createdAtUtc: "2026-01-01T00:00:00Z",
        producerRevision: "e2e",
        sourceReadPolicy: "ordered-sequential-per-dataset",
        sourceOrder,
        datasets,
      };
      const releaseBytes = canonicalJson(release);
      const releaseUri = `${root}/release.json`;
      objects.set(releaseUri, { bytes: releaseBytes, generation: "9000" });
      const pointer = {
        contractVersion: DUCKDB_CONTRACT_VERSION,
        releaseId,
        prefix: `${root}/`,
        manifestUri: releaseUri,
        manifestGeneration: "9000",
        manifestSha256: sha256(releaseBytes),
        schemaVersion: DUCKDB_CONTRACT_VERSION,
        createdAtUtc: "2026-01-01T00:00:00Z",
        producerRevision: "e2e",
        releaseSequence: 1,
        sourceOrder,
        sourceHighWaterOrder: sourceOrder,
      };
      objects.set("gs://e2e-bucket/current.json", {
        bytes: canonicalJson(pointer),
        generation: "9999",
      });
      const client: GcsClient = {
        read: async (uri, generation) => {
          const object = objects.get(uri)!;
          if (generation && generation !== object.generation)
            throw new Error("generation mismatch");
          return object;
        },
        streamTo: async (uri, generation, destination, maxBytes) => {
          const object = objects.get(uri)!;
          if (
            object.generation !== generation ||
            object.bytes.length > (maxBytes ?? Infinity)
          )
            throw new Error("stream rejected");
          await writeFile(destination, object.bytes, { flag: "wx" });
          return {
            generation,
            sizeBytes: object.bytes.length,
            crc32c: crc32cBase64(object.bytes),
          };
        },
      };
      const repository = new GcsReleaseRepository(client, config(dir));
      const runtime = new DuckDbRuntime(repository, config(dir));
      const lease = await runtime.acquire();
      const rows = await lease.withConnection((query) =>
        query.query("SELECT COUNT(*) FROM pv_events"),
      );
      expect(rows).toEqual([{ "count_star()": 1n }]);
      lease.release();
      await runtime.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
