import { describe, expect, it } from "vitest";
import {
  DUCKDB_V2_CONTRACT_VERSION,
  DUCKDB_V2_DATASETS,
  schemaFor,
  DUCKDB_DETAILS_PROFILE_DATASETS,
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
  return v2Fixture();
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

function detailsFixture() {
  const data = v2Fixture();
  const releaseUri = "gs://bucket/releases/r-v2/release.json";
  const releaseObject = data.objects.get(releaseUri)!;
  const release = JSON.parse(releaseObject.bytes.toString("utf8"));
  const eventUri = "gs://bucket/releases/r-v2/pv_events/manifest.json";
  const eventStored = data.objects.get(eventUri)!;
  const eventManifest = JSON.parse(eventStored.bytes.toString("utf8"));
  const eventSchema = schemaFor(
    "pv_events",
    DUCKDB_V2_CONTRACT_VERSION,
    "details",
  );
  eventManifest.schemaVersion = eventSchema.schemaVersion;
  eventManifest.columns = eventSchema.columns;
  eventManifest.schemaFingerprintSha256 = schemaFingerprint(
    "pv_events",
    DUCKDB_V2_CONTRACT_VERSION,
    "details",
  );
  data.objects.set(eventUri, {
    ...eventStored,
    bytes: canonicalJson(eventManifest),
  });
  release.datasets.pv_events.schemaVersion = eventSchema.schemaVersion;

  const dataset = "pv_event_details";
  const schema = schemaFor(dataset, DUCKDB_V2_CONTRACT_VERSION, "details");
  const root = `gs://bucket/releases/r-v2/${dataset}`;
  const parquet = Buffer.from("details-parquet");
  const goldenBytes = canonicalJson([[1]]);
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
      "details",
    ),
    columns: schema.columns,
    sourceReadTimestampUtc: "2026-09-23T13:10:00Z",
    sourceOrder: release.sourceOrder,
    sourceReadPolicy: "ordered-sequential-per-dataset",
    goldens: [
      {
        name: goldenSpec.name,
        uri: `${root}/goldens/candidate_transport_check.json`,
        generation: "410",
        sizeBytes: goldenBytes.length,
        query: goldenSpec.query,
        canonicalization: "rows-json-v1",
        sha256: sha256(goldenBytes),
        crc32c: crc32cBase64(goldenBytes),
      },
    ],
    objects: [
      {
        uri: `${root}/partitions/pv_event_details-0.parquet`,
        generation: "411",
        sizeBytes: parquet.length,
        rowCount: 1,
        crc32c: crc32cBase64(parquet),
      },
    ],
  };
  const manifestUri = `${root}/manifest.json`;
  data.objects.set(manifestUri, {
    bytes: canonicalJson(manifest),
    generation: "412",
  });
  data.objects.set(manifest.goldens[0].uri, {
    bytes: goldenBytes,
    generation: "410",
  });
  data.objects.set(manifest.objects[0].uri, {
    bytes: parquet,
    generation: "411",
  });
  release.datasets[dataset] = {
    manifestUri,
    manifestGeneration: "412",
    schemaVersion: schema.schemaVersion,
    sourceOrder: release.sourceOrder,
    sourceReadPolicy: "ordered-sequential-per-dataset",
    sourceReadTimestampUtc: manifest.sourceReadTimestampUtc,
  };
  const releaseBytes = canonicalJson(release);
  data.objects.set(releaseUri, { bytes: releaseBytes, generation: "900" });
  data.pointer.manifestSha256 = sha256(releaseBytes);
  data.pointer.manifestGeneration = "900";
  data.objects.set("gs://bucket/current.json", {
    bytes: canonicalJson(data.pointer),
    generation: "901",
  });
  expect(DUCKDB_DETAILS_PROFILE_DATASETS).toHaveLength(11);
  return data;
}

function objectMapClient(
  objects: Map<string, { bytes: Buffer; generation: string }>,
): GcsClient {
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
  it("rejects a non-positive control-object generation", async () => {
    const data = v2Fixture();
    const client: GcsClient = {
      read: async (uri) => ({
        ...data.objects.get(uri)!,
        generation: "0",
      }),
    };
    const repository = new GcsReleaseRepository(client, config);
    await expect(repository.readPointer()).rejects.toMatchObject({
      message: "pointer validation failed",
      cause: expect.objectContaining({
        message: expect.stringMatching(/positive decimal generation/),
      }),
    });
  });
  it("accepts a complete synthetic ten-dataset release", async () => {
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
    expect(files.manifests.size).toBe(DUCKDB_V2_DATASETS.length);
    expect(files.parquetPaths.size).toBe(DUCKDB_V2_DATASETS.length);
  });
  it("validates the eleven-dataset profile without reading detail data until requested", async () => {
    const data = detailsFixture();
    const reads: string[] = [];
    let deferredGoldenMaxBytes = 0;
    const client: GcsClient = {
      read: async (uri, generation, maxBytes) => {
        reads.push(uri);
        if (uri.includes("pv_event_details/goldens/"))
          deferredGoldenMaxBytes = maxBytes ?? 0;
        const value = data.objects.get(uri)!;
        if (generation && generation !== value.generation)
          throw new Error("wrong generation");
        return value;
      },
      streamTo: async (uri, generation) => {
        const value = data.objects.get(uri)!;
        if (generation !== value.generation)
          throw new Error("wrong generation");
        return {
          generation,
          sizeBytes: value.bytes.length,
          crc32c: crc32cBase64(value.bytes),
        };
      },
    };
    const repository = new GcsReleaseRepository(client, config);
    const current = await repository.readPointer();
    const files = await repository.downloadRelease(
      current.pointer,
      current.generation,
    );
    const startupPointerReadCount = reads.filter(
      (uri) => uri === "gs://bucket/current.json",
    ).length;
    expect(files.manifests.size).toBe(11);
    expect(files.parquetPaths.has("pv_event_details")).toBe(false);
    expect(files.parquetPaths.size).toBe(10);
    expect(reads).not.toContain(
      "gs://bucket/releases/r-v2/pv_event_details/partitions/pv_event_details-0.parquet",
    );
    expect(reads).not.toContain(
      "gs://bucket/releases/r-v2/pv_event_details/goldens/candidate_transport_check.json",
    );

    const deferred = await repository.downloadDeferredDetails(files, "/stage");
    expect(deferred.parquetPaths).toEqual([
      "/stage/pv_event_details-0.parquet",
    ]);
    expect(deferred.goldens.size).toBe(1);
    expect(deferredGoldenMaxBytes).toBe(
      data.objects.get(
        "gs://bucket/releases/r-v2/pv_event_details/goldens/candidate_transport_check.json",
      )!.bytes.length,
    );
    expect(
      reads.filter((uri) => uri === "gs://bucket/current.json"),
    ).toHaveLength(startupPointerReadCount);
  });
  it("stages core files at the exact combined artifact budget without accessing missing details", async () => {
    const data = detailsFixture();
    const detailParquet =
      "gs://bucket/releases/r-v2/pv_event_details/partitions/pv_event_details-0.parquet";
    const detailGolden =
      "gs://bucket/releases/r-v2/pv_event_details/goldens/candidate_transport_check.json";
    data.objects.delete(detailParquet);
    data.objects.delete(detailGolden);
    const detailSizes = JSON.parse(
      data.objects
        .get("gs://bucket/releases/r-v2/pv_event_details/manifest.json")!
        .bytes.toString("utf8"),
    );
    const totalDeclaredBytes =
      detailSizes.totalSizeBytes +
      detailSizes.goldens.reduce(
        (total: number, golden: { sizeBytes: number }) =>
          total + golden.sizeBytes,
        0,
      ) +
      [...data.objects.entries()]
        .filter(([uri]) =>
          /\/(pv_pax|pv_events|pv_regions|pv_areas|pv_sectors|pv_aos|pv_upcoming|pv_kotter|pv_territories|pv_attendance)\/manifest\.json$/.test(
            uri,
          ),
        )
        .reduce((total, [, stored]) => {
          const manifest = JSON.parse(stored.bytes.toString("utf8"));
          return (
            total +
            manifest.totalSizeBytes +
            manifest.goldens.reduce(
              (sum: number, golden: { sizeBytes: number }) =>
                sum + golden.sizeBytes,
              0,
            )
          );
        }, 0);
    const detailDeclaredBytes =
      detailSizes.totalSizeBytes +
      detailSizes.goldens.reduce(
        (total: number, golden: { sizeBytes: number }) =>
          total + golden.sizeBytes,
        0,
      );
    const coreDeclaredBytes = totalDeclaredBytes - detailDeclaredBytes;
    const reads: string[] = [];
    const streams: string[] = [];
    const client: GcsClient = {
      read: async (uri, generation, maxBytes) => {
        reads.push(uri);
        const value = data.objects.get(uri);
        if (!value) throw new Error("missing fixture object");
        if (generation && generation !== value.generation)
          throw new Error("wrong generation");
        if (maxBytes !== undefined && value.bytes.length > maxBytes)
          throw new Error("declared read budget exceeded");
        return value;
      },
      streamTo: async (uri, generation) => {
        streams.push(uri);
        const value = data.objects.get(uri)!;
        return {
          generation,
          sizeBytes: value.bytes.length,
          crc32c: crc32cBase64(value.bytes),
        };
      },
    };
    const exactRepository = new GcsReleaseRepository(client, {
      ...config,
      maxReleaseBytes: totalDeclaredBytes,
    });
    const current = await exactRepository.readPointer();
    await exactRepository.downloadRelease(
      current.pointer,
      current.generation,
      "/stage",
    );
    expect(reads).not.toContain(detailParquet);
    expect(reads).not.toContain(detailGolden);
    expect(streams).not.toContain(detailParquet);
    expect(streams).toHaveLength(10);

    const underBudgetRepository = new GcsReleaseRepository(client, {
      ...config,
      maxReleaseBytes: totalDeclaredBytes - 1,
    });
    await expect(
      underBudgetRepository.downloadRelease(
        current.pointer,
        current.generation,
        "/stage",
      ),
    ).rejects.toThrow(/download budget|golden budget/);

    const coreOnlyBudgetRepository = new GcsReleaseRepository(client, {
      ...config,
      maxReleaseBytes: coreDeclaredBytes,
    });
    await expect(
      coreOnlyBudgetRepository.downloadRelease(
        current.pointer,
        current.generation,
        "/stage",
      ),
    ).rejects.toThrow(/download budget|golden budget/);
  });
  it("rejects invalid deferred detail declarations and charges them to release budget", async () => {
    const invalid = detailsFixture();
    const manifestUri =
      "gs://bucket/releases/r-v2/pv_event_details/manifest.json";
    const stored = invalid.objects.get(manifestUri)!;
    const manifest = JSON.parse(stored.bytes.toString("utf8"));
    manifest.columns[1].logicalType = "BLOB";
    invalid.objects.set(manifestUri, {
      ...stored,
      bytes: canonicalJson(manifest),
    });
    const badRepository = new GcsReleaseRepository(
      objectMapClient(invalid.objects),
      config,
    );
    const current = await badRepository.readPointer();
    await expect(
      badRepository.downloadRelease(current.pointer, current.generation),
    ).rejects.toThrow(/columns do not match/);

    const oversized = detailsFixture();
    const tightConfig = { ...config, maxReleaseBytes: 100 };
    const budgetRepository = new GcsReleaseRepository(
      objectMapClient(oversized.objects),
      tightConfig,
    );
    const pointer = await budgetRepository.readPointer();
    await expect(
      budgetRepository.downloadRelease(pointer.pointer, pointer.generation),
    ).rejects.toThrow(/download budget|golden budget/);
  });
  it.each(["generation", "crc"] as const)(
    "rejects invalid detail object %s metadata before payload I/O",
    async (invalidField) => {
      const data = detailsFixture();
      const manifestUri =
        "gs://bucket/releases/r-v2/pv_event_details/manifest.json";
      const stored = data.objects.get(manifestUri)!;
      const manifest = JSON.parse(stored.bytes.toString("utf8"));
      if (invalidField === "generation") manifest.objects[0].generation = "0";
      else manifest.objects[0].crc32c = "invalid";
      data.objects.set(manifestUri, {
        ...stored,
        bytes: canonicalJson(manifest),
      });
      const reads: string[] = [];
      const streams: string[] = [];
      const client: GcsClient = {
        ...objectMapClient(data.objects),
        read: async (uri, generation, maxBytes) => {
          reads.push(uri);
          return objectMapClient(data.objects).read(uri, generation, maxBytes);
        },
        streamTo: async (uri, generation) => {
          streams.push(uri);
          const value = await objectMapClient(data.objects).read(
            uri,
            generation,
          );
          return {
            generation: value.generation,
            sizeBytes: value.bytes.length,
            crc32c: crc32cBase64(value.bytes),
          };
        },
      };
      const repository = new GcsReleaseRepository(client, config);
      const current = await repository.readPointer();
      await expect(
        repository.downloadRelease(
          current.pointer,
          current.generation,
          "/stage",
        ),
      ).rejects.toThrow();
      expect(reads).not.toContain(
        "gs://bucket/releases/r-v2/pv_event_details/partitions/pv_event_details-0.parquet",
      );
      expect(reads).not.toContain(
        "gs://bucket/releases/r-v2/pv_event_details/goldens/candidate_transport_check.json",
      );
      expect(streams).not.toContain(
        "gs://bucket/releases/r-v2/pv_event_details/partitions/pv_event_details-0.parquet",
      );
    },
  );
  it.each(["generation", "size", "crc"] as const)(
    "checks deferred detail %s independently on demand and bounds by declared size",
    async (invalidField) => {
      const data = detailsFixture();
      const declared = JSON.parse(
        data.objects
          .get("gs://bucket/releases/r-v2/pv_event_details/manifest.json")!
          .bytes.toString("utf8"),
      ).objects[0];
      let streamMaxBytes = 0;
      const client: GcsClient = {
        ...objectMapClient(data.objects),
        streamTo: async (_uri, generation, _destination, maxBytes) => {
          streamMaxBytes = maxBytes ?? 0;
          return {
            generation:
              invalidField === "generation"
                ? `${generation}-wrong`
                : generation,
            sizeBytes:
              invalidField === "size"
                ? declared.sizeBytes - 1
                : declared.sizeBytes,
            crc32c: invalidField === "crc" ? "AAAAAA==" : declared.crc32c,
          };
        },
      };
      const repository = new GcsReleaseRepository(client, config);
      const current = await repository.readPointer();
      const files = await repository.downloadRelease(
        current.pointer,
        current.generation,
      );
      await expect(
        repository.downloadDeferredDetails(files, "/stage"),
      ).rejects.toThrow(/integrity mismatch/);
      expect(streamMaxBytes).toBe(declared.sizeBytes);
    },
  );
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
          contractVersion: "pv-release.v1",
          schemaVersion: "pv-release.v1",
        },
        current.generation,
      ),
    ).rejects.toThrow(/pointer\/release contractVersion mismatch/);
  });
  it("rejects a v1 pointer as an unsupported contract", async () => {
    const data = v2Fixture();
    data.objects.set("gs://bucket/current.json", {
      bytes: canonicalJson({
        ...data.pointer,
        contractVersion: "pv-release.v1",
        schemaVersion: "pv-release.v1",
      }),
      generation: "902",
    });
    const repository = new GcsReleaseRepository(
      objectMapClient(data.objects),
      config,
    );

    await expect(repository.readPointer()).rejects.toMatchObject({
      message: "pointer validation failed",
      cause: expect.objectContaining({
        message: "unsupported pointer contractVersion",
      }),
    });
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
    manifest.contractVersion = "pv-release.v1";
    manifest.schemaVersion = "pv_regions.v1";
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
    ).rejects.toThrow(/manifest identity is invalid/);
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
    const root = "gs://bucket/releases/r-v2";
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
    const root = "gs://bucket/releases/r-v2";
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
