import { describe, expect, it } from "vitest";
import {
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_SCHEMA_REGISTRY,
} from "./constants";
import { DuckDbConfig } from "./config";
import {
  GcsClient,
  GcsReleaseRepository,
  GoogleCloudStorageClient,
} from "./gcs";
import { DuckDbReleaseError } from "./errors";
import {
  canonicalJson,
  crc32cBase64,
  schemaFingerprint,
  sha256,
} from "./validation";

const config: DuckDbConfig = {
  enabled: true,
  bucket: "bucket",
  prefix: "releases",
  controlObject: "current.json",
  cacheDir: "/tmp",
  refreshTtlMs: 1,
  maxLkgAgeMs: 1000,
  memoryLimit: "64MB",
  maxReleaseBytes: 1000000,
  maxObjectBytes: 100000,
};
function fixture() {
  const objects = new Map<string, { bytes: Buffer; generation: string }>();
  const releaseId = "r-1";
  const root = `gs://bucket/releases/${releaseId}`;
  const datasets = Object.fromEntries(
    DUCKDB_DATASETS.map((dataset, i) => {
      const parquet = Buffer.from(dataset);
      const manifestUri = `${root}/${dataset}/manifest.json`;
      const manifest = {
        contractVersion: DUCKDB_CONTRACT_VERSION,
        dataset,
        schemaVersion: DUCKDB_SCHEMA_REGISTRY[dataset].schemaVersion,
        rowCount: 1,
        totalSizeBytes: parquet.length,
        schemaFingerprintSha256: schemaFingerprint(dataset),
        columns: DUCKDB_SCHEMA_REGISTRY[dataset].columns,
        sourceSnapshot: "snapshot",
        sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
        goldens: [
          {
            name: `${dataset}.basic`,
            uri: `${root}/${dataset}/goldens/basic.json`,
            generation: String(300 + i),
            sizeBytes: canonicalJson([[1]]).length,
            query: `SELECT COUNT(*) AS row_count FROM ${dataset}`,
            canonicalization: "rows-json-v1",
            sha256: sha256(canonicalJson([[1]])),
          },
        ],
        objects: [
          {
            uri: `${root}/${dataset}/partitions/${dataset}-0.parquet`,
            generation: String(100 + i),
            sizeBytes: parquet.length,
            rowCount: 1,
            crc32c: crc32cBase64(parquet),
          },
        ],
      };
      objects.set(manifestUri, {
        bytes: canonicalJson(manifest),
        generation: String(200 + i),
      });
      objects.set(`${root}/${dataset}/goldens/basic.json`, {
        bytes: canonicalJson([[1]]),
        generation: String(300 + i),
      });
      objects.set(`${root}/${dataset}/partitions/${dataset}-0.parquet`, {
        bytes: parquet,
        generation: String(100 + i),
      });
      return [
        dataset,
        {
          manifestUri,
          manifestGeneration: String(200 + i),
          schemaVersion: DUCKDB_SCHEMA_REGISTRY[dataset].schemaVersion,
        },
      ];
    }),
  );
  const release = {
    contractVersion: DUCKDB_CONTRACT_VERSION,
    releaseId,
    createdAtUtc: "2026-01-01T00:00:00Z",
    producerRevision: "test",
    sourceSnapshot: "snapshot",
    sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
    datasets,
  };
  const releaseBytes = canonicalJson(release);
  const releaseUri = `${root}/release.json`;
  objects.set(releaseUri, { bytes: releaseBytes, generation: "300" });
  const pointer = {
    contractVersion: DUCKDB_CONTRACT_VERSION,
    releaseId,
    prefix: `${root}/`,
    manifestUri: releaseUri,
    manifestGeneration: "300",
    manifestSha256: sha256(releaseBytes),
    schemaVersion: DUCKDB_CONTRACT_VERSION,
    createdAtUtc: "2026-01-01T00:00:00Z",
    producerRevision: "test",
    releaseSequence: 1,
  };
  objects.set("gs://bucket/current.json", {
    bytes: canonicalJson(pointer),
    generation: "400",
  });
  return { objects, pointer };
}

describe("GCS release repository", () => {
  it("pins bytes and metadata to one generation", async () => {
    const client = Object.create(
      GoogleCloudStorageClient.prototype,
    ) as GoogleCloudStorageClient;
    let pinned = false;
    (client as unknown as { storage: unknown }).storage = {
      bucket: () => ({
        file: (_name: string, options?: { generation?: string }) => {
          pinned = Boolean(options?.generation);
          return {
            getMetadata: async () => [
              { generation: options?.generation ?? "7" },
            ],
            createReadStream: () =>
              (async function* () {
                yield Buffer.from("generation-7");
              })(),
          };
        },
      }),
    };
    await expect(client.read("gs://bucket/current.json")).resolves.toEqual({
      bytes: Buffer.from("generation-7"),
      generation: "7",
    });
    expect(pinned).toBe(true);
  });
  it("turns a generation mismatch into a typed release error", async () => {
    const client = Object.create(
      GoogleCloudStorageClient.prototype,
    ) as GoogleCloudStorageClient;
    (client as unknown as { storage: unknown }).storage = {
      bucket: () => ({
        file: () => ({
          getMetadata: async () => [{ generation: "9" }],
          createReadStream: () =>
            (async function* () {
              yield Buffer.from("x");
            })(),
        }),
      }),
    };
    await expect(
      client.read("gs://bucket/current.json", "8"),
    ).rejects.toBeInstanceOf(DuckDbReleaseError);
  });
  it("accepts a complete synthetic eight-dataset release", async () => {
    const fixtureData = fixture();
    const client: GcsClient = {
      read: async (uri, generation) => {
        const value = fixtureData.objects.get(uri)!;
        if (generation && generation !== value.generation)
          throw new Error("wrong generation");
        return value;
      },
    };
    const repository = new GcsReleaseRepository(client, config);
    const current = await repository.readPointer();
    const files = await repository.downloadRelease(
      current.pointer,
      current.generation,
    );
    expect(files.manifests.size).toBe(8);
    expect(files.parquetPaths.size).toBe(8);
  });
  it("rejects a pointer generation race before activation", async () => {
    const fixtureData = fixture();
    let pointerReads = 0;
    const client: GcsClient = {
      read: async (uri, generation) => {
        const value = fixtureData.objects.get(uri)!;
        if (uri === "gs://bucket/current.json" && !generation)
          pointerReads += 1;
        if (uri === "gs://bucket/current.json" && pointerReads > 1)
          return { ...value, generation: "401" };
        return value;
      },
    };
    const repository = new GcsReleaseRepository(client, config);
    const current = await repository.readPointer();
    await expect(
      repository.downloadRelease(current.pointer, current.generation),
    ).rejects.toBeInstanceOf(DuckDbReleaseError);
  });
  it("refuses staging when the repository cannot stream", async () => {
    const fixtureData = fixture();
    const client: GcsClient = {
      read: async (uri, generation) => {
        const value = fixtureData.objects.get(uri)!;
        if (generation && generation !== value.generation)
          throw new Error("wrong generation");
        return value;
      },
    };
    const repository = new GcsReleaseRepository(client, config);
    const current = await repository.readPointer();
    await expect(
      repository.downloadRelease(
        current.pointer,
        current.generation,
        "/tmp/duckdb-staging-test",
      ),
    ).rejects.toThrow(/streaming/);
  });
});
