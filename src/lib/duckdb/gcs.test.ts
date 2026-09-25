import { describe, expect, it } from "vitest";
import {
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_SCHEMA_REGISTRY,
  DUCKDB_V2_CONTRACT_VERSION,
  DUCKDB_V2_DATASETS,
  schemaFor,
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

function v2Fixture() {
  const objects = new Map<string, { bytes: Buffer; generation: string }>();
  const releaseId = "r-v2";
  const root = `gs://bucket/releases/${releaseId}`;
  const sourceOrder = "2026-09-23T13:00:00Z";
  const datasets = Object.fromEntries(
    DUCKDB_V2_DATASETS.map((dataset, index) => {
      const schema = schemaFor(dataset, DUCKDB_V2_CONTRACT_VERSION);
      const parquet = Buffer.from(`parquet-${dataset}`);
      const timestamp = `2026-09-23T13:${String(index).padStart(2, "0")}:00Z`;
      const goldenBytes = canonicalJson([[1]]);
      const manifestUri = `${root}/${dataset}/manifest.json`;
      const goldenSpec = schema.goldenSpecifications[0];
      const manifest = {
        contractVersion: DUCKDB_V2_CONTRACT_VERSION,
        dataset,
        schemaVersion: schema.schemaVersion,
        rowCount: 1,
        totalSizeBytes: parquet.length,
        schemaFingerprintSha256: schemaFingerprint(
          dataset,
          DUCKDB_V2_CONTRACT_VERSION,
        ),
        columns: schema.columns,
        sourceReadTimestampUtc: timestamp,
        sourceOrder,
        sourceReadPolicy: "ordered-sequential-per-dataset",
        goldens: [
          {
            name: goldenSpec.name,
            uri: `${root}/${dataset}/goldens/candidate_transport_check.json`,
            generation: String(300 + index),
            sizeBytes: goldenBytes.length,
            query: goldenSpec.query,
            canonicalization: "rows-json-v1",
            sha256: sha256(goldenBytes),
            crc32c: crc32cBase64(goldenBytes),
          },
        ],
        objects: [
          {
            uri: `${root}/${dataset}/partitions/${dataset}-0.parquet`,
            generation: String(100 + index),
            sizeBytes: parquet.length,
            rowCount: 1,
            crc32c: crc32cBase64(parquet),
          },
        ],
      };
      objects.set(manifestUri, {
        bytes: canonicalJson(manifest),
        generation: String(200 + index),
      });
      objects.set(manifest.goldens[0].uri, {
        bytes: goldenBytes,
        generation: manifest.goldens[0].generation,
      });
      objects.set(manifest.objects[0].uri, {
        bytes: parquet,
        generation: manifest.objects[0].generation,
      });
      return [
        dataset,
        {
          manifestUri,
          manifestGeneration: String(200 + index),
          schemaVersion: schema.schemaVersion,
          sourceOrder,
          sourceReadPolicy: "ordered-sequential-per-dataset",
          sourceReadTimestampUtc: timestamp,
        },
      ];
    }),
  );
  const release = {
    contractVersion: DUCKDB_V2_CONTRACT_VERSION,
    releaseId,
    createdAtUtc: "2026-09-23T13:57:10Z",
    producerRevision: "synthetic-v2-test",
    sourceOrder,
    sourceReadPolicy: "ordered-sequential-per-dataset",
    datasets,
  };
  const releaseBytes = canonicalJson(release);
  const releaseUri = `${root}/release.json`;
  objects.set(releaseUri, { bytes: releaseBytes, generation: "900" });
  const pointer = {
    contractVersion: DUCKDB_V2_CONTRACT_VERSION,
    releaseId,
    prefix: `${root}/`,
    manifestUri: releaseUri,
    manifestGeneration: "900",
    manifestSha256: sha256(releaseBytes),
    schemaVersion: DUCKDB_V2_CONTRACT_VERSION,
    createdAtUtc: "2026-09-23T13:57:10Z",
    producerRevision: "synthetic-v2-test",
    releaseSequence: 2,
    sourceOrder,
    sourceHighWaterOrder: sourceOrder,
  };
  objects.set("gs://bucket/current.json", {
    bytes: canonicalJson(pointer),
    generation: "901",
  });
  return { objects, pointer };
}

function objectMapClient(objects: Map<string, { bytes: Buffer; generation: string }>): GcsClient {
  return {
    read: async (uri, generation) => {
      const value = objects.get(uri);
      if (!value) throw new Error(`missing test fixture object: ${uri}`);
      if (generation && generation !== value.generation)
        throw new Error("wrong generation");
      return value;
    },
  };
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
  it("rejects pointer/release contract-version mixing in a v2 artifact", async () => {
    const data = v2Fixture();
    const repository = new GcsReleaseRepository(
      objectMapClient(data.objects),
      config,
    );
    const current = await repository.readPointer();
    await expect(
      repository.downloadRelease(
        {
          ...current.pointer,
          contractVersion: DUCKDB_CONTRACT_VERSION,
          schemaVersion: DUCKDB_CONTRACT_VERSION,
        },
        current.generation,
      ),
    ).rejects.toThrow(/pointer\/release contractVersion mismatch/);
  });
  it("downloads a v2 release with a later pointer high-water order", async () => {
    const data = v2Fixture();
    const highWaterOrder = "2026-09-23T13:01:00Z";
    const pointer = { ...data.pointer, sourceHighWaterOrder: highWaterOrder };
    data.objects.set("gs://bucket/current.json", {
      bytes: canonicalJson(pointer),
      generation: "901",
    });
    const repository = new GcsReleaseRepository(
      objectMapClient(data.objects),
      config,
    );
    const current = await repository.readPointer();
    const files = await repository.downloadRelease(
      current.pointer,
      current.generation,
    );
    expect(files.manifests.size).toBe(DUCKDB_V2_DATASETS.length);
    expect(files.parquetPaths.size).toBe(DUCKDB_V2_DATASETS.length);
    expect(files.goldens.size).toBe(DUCKDB_V2_DATASETS.length);
    expect(current.pointer.sourceHighWaterOrder).toBe(highWaterOrder);
  });
  it("rejects a valid v1 manifest mixed into a v2 release", async () => {
    const data = v2Fixture();
    const dataset = "pv_regions";
    const root = `gs://bucket/releases/r-v2/${dataset}`;
    const manifestUri = `${root}/manifest.json`;
    const stored = data.objects.get(manifestUri)!;
    const manifest = JSON.parse(stored.bytes.toString("utf8"));
    const v1Schema = schemaFor(dataset, DUCKDB_CONTRACT_VERSION);
    const originalGoldenUri = manifest.goldens[0].uri;
    const v1GoldenUri = `${root}/goldens/${dataset}.basic.json`;
    const golden = data.objects.get(originalGoldenUri)!;
    data.objects.delete(originalGoldenUri);
    data.objects.set(v1GoldenUri, golden);
    manifest.contractVersion = DUCKDB_CONTRACT_VERSION;
    manifest.schemaVersion = v1Schema.schemaVersion;
    manifest.schemaFingerprintSha256 = schemaFingerprint(
      dataset,
      DUCKDB_CONTRACT_VERSION,
    );
    manifest.columns = v1Schema.columns;
    manifest.sourceSnapshot = "v1-snapshot";
    delete manifest.sourceOrder;
    delete manifest.sourceReadPolicy;
    manifest.goldens[0].name = `${dataset}.basic`;
    manifest.goldens[0].uri = v1GoldenUri;
    manifest.goldens[0].query = v1Schema.goldenSpecifications[0].query;
    data.objects.set(manifestUri, {
      ...stored,
      bytes: canonicalJson(manifest),
    });

    const repository = new GcsReleaseRepository(
      objectMapClient(data.objects),
      config,
    );
    const current = await repository.readPointer();
    await expect(
      repository.downloadRelease(current.pointer, current.generation),
    ).rejects.toThrow(/manifest\/release contractVersion mismatch/);
  });
  it("rejects v2 release-entry timestamp or order that disagrees with its manifest", async () => {
    for (const mismatch of ["timestamp", "order"] as const) {
      const data = v2Fixture();
      const dataset = "pv_events";
      const manifestUri = `gs://bucket/releases/r-v2/${dataset}/manifest.json`;
      const stored = data.objects.get(manifestUri)!;
      const manifest = JSON.parse(stored.bytes.toString("utf8"));
      if (mismatch === "timestamp")
        manifest.sourceReadTimestampUtc = "2026-09-24T00:00:00Z";
      else manifest.sourceOrder = "2026-09-24T00:00:00Z";
      data.objects.set(manifestUri, {
        ...stored,
        bytes: canonicalJson(manifest),
      });

      const repository = new GcsReleaseRepository(
        objectMapClient(data.objects),
        config,
      );
      const current = await repository.readPointer();
      await expect(
        repository.downloadRelease(current.pointer, current.generation),
      ).rejects.toThrow(/sequential source metadata mismatch/);
    }
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
  it("rejects a partition URI that escapes its exact dataset prefix", async () => {
    const fixtureData = fixture();
    const root = "gs://bucket/releases/r-1";
    const uri = `${root}/pv_pax/manifest.json`;
    const stored = fixtureData.objects.get(uri)!;
    const manifest = JSON.parse(stored.bytes.toString("utf8"));
    manifest.objects[0].uri = `${root}/pv_events/partitions/attack.parquet`;
    fixtureData.objects.set(uri, {
      ...stored,
      bytes: canonicalJson(manifest),
    });
    const client: GcsClient = {
      read: async (objectUri, generation) => {
        const value = fixtureData.objects.get(objectUri)!;
        if (generation && generation !== value.generation)
          throw new Error("wrong generation");
        return value;
      },
    };
    const repository = new GcsReleaseRepository(client, config);
    const current = await repository.readPointer();
    await expect(
      repository.downloadRelease(current.pointer, current.generation),
    ).rejects.toThrow(/exact dataset prefix/);
  });
  it("rejects a golden URI that escapes its exact dataset prefix", async () => {
    const fixtureData = fixture();
    const root = "gs://bucket/releases/r-1";
    const uri = `${root}/pv_pax/manifest.json`;
    const stored = fixtureData.objects.get(uri)!;
    const manifest = JSON.parse(stored.bytes.toString("utf8"));
    manifest.goldens[0].uri = `${root}/pv_events/goldens/attack.json`;
    fixtureData.objects.set(uri, {
      ...stored,
      bytes: canonicalJson(manifest),
    });
    const client: GcsClient = {
      read: async (objectUri, generation) => {
        const value = fixtureData.objects.get(objectUri)!;
        if (generation && generation !== value.generation)
          throw new Error("wrong generation");
        return value;
      },
    };
    const repository = new GcsReleaseRepository(client, config);
    const current = await repository.readPointer();
    await expect(
      repository.downloadRelease(current.pointer, current.generation),
    ).rejects.toThrow(/exact dataset prefix/);
  });
});
