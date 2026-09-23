import { Storage } from "@google-cloud/storage";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { DuckDbConfig } from "./config";
import { DuckDbReleaseError } from "./errors";
import {
  DatasetManifest,
  canonicalJson,
  parseJson,
  Pointer,
  ReleaseIndex,
  sha256,
  validateIntegrity,
  validateManifest,
  validatePointer,
  validatePointerLayout,
  validateRelease,
  validateUri,
  crc32cFinish,
  crc32cUpdate,
} from "./validation";
import { DUCKDB_DATASETS, DuckDbDataset } from "./constants";
import { assertDuckDbServerRuntime } from "./server";

export interface GcsObject {
  bytes: Buffer;
  generation: string;
}
export interface GcsStreamResult {
  generation: string;
  sizeBytes: number;
  crc32c: string;
}
export interface GcsClient {
  read(uri: string, generation?: string, maxBytes?: number): Promise<GcsObject>;
  streamTo?(
    uri: string,
    generation: string,
    destination: string,
    maxBytes?: number,
  ): Promise<GcsStreamResult>;
}

export class GoogleCloudStorageClient implements GcsClient {
  private readonly storage: Storage;
  constructor() {
    assertDuckDbServerRuntime("GoogleCloudStorageClient");
    this.storage = new Storage();
  }
  async read(
    uri: string,
    generation?: string,
    maxBytes = Number.MAX_SAFE_INTEGER,
  ): Promise<GcsObject> {
    assertDuckDbServerRuntime("GoogleCloudStorageClient.read");
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
    if (!match)
      throw new DuckDbReleaseError("Invalid GCS URI", "repository-gcs");
    try {
      const bucket = this.storage.bucket(match[1]);
      let pinnedGeneration = generation;
      if (!pinnedGeneration) {
        const metadata = (await bucket.file(match[2]).getMetadata())[0];
        pinnedGeneration = String(metadata.generation);
      }
      const file = bucket.file(match[2], { generation: pinnedGeneration });
      const before = (await file.getMetadata())[0];
      if (String(before.generation) !== pinnedGeneration)
        throw new DuckDbReleaseError(
          "GCS generation changed before download",
          "pointer-generation-race",
        );
      const chunks: Buffer[] = [];
      let readBytes = 0;
      for await (const chunk of file.createReadStream()) {
        const bytes = Buffer.from(chunk as Uint8Array);
        readBytes += bytes.length;
        if (readBytes > maxBytes)
          throw new DuckDbReleaseError(
            "DuckDB JSON/golden byte budget exceeded",
          );
        chunks.push(bytes);
      }
      const bytes = Buffer.concat(chunks, readBytes);
      const after = (await file.getMetadata())[0];
      if (String(after.generation) !== pinnedGeneration)
        throw new DuckDbReleaseError(
          "GCS generation changed after download",
          "pointer-generation-race",
        );
      return { bytes, generation: pinnedGeneration };
    } catch (cause) {
      if (cause instanceof DuckDbReleaseError) throw cause;
      throw new DuckDbReleaseError(
        "generation-pinned GCS read failed",
        "repository-gcs",
        { cause },
      );
    }
  }
  async streamTo(
    uri: string,
    generation: string,
    destination: string,
    maxBytes = Number.MAX_SAFE_INTEGER,
  ): Promise<GcsStreamResult> {
    assertDuckDbServerRuntime("GoogleCloudStorageClient.streamTo");
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
    if (!match)
      throw new DuckDbReleaseError("Invalid GCS URI", "repository-gcs");
    try {
      const file = this.storage.bucket(match[1]).file(match[2], { generation });
      const metadata = (await file.getMetadata())[0];
      if (String(metadata.generation) !== generation)
        throw new DuckDbReleaseError(
          "GCS generation mismatch",
          "pointer-generation-race",
        );
      const output = createWriteStream(destination, { flags: "wx" });
      let crc = 0xffffffff;
      let sizeBytes = 0;
      try {
        for await (const chunk of file.createReadStream()) {
          const bytes = Buffer.from(chunk as Uint8Array);
          crc = crc32cUpdate(crc, bytes);
          sizeBytes += bytes.length;
          if (sizeBytes > maxBytes)
            throw new DuckDbReleaseError(
              "DuckDB streaming byte budget exceeded",
            );
          if (!output.write(bytes)) await once(output, "drain");
        }
        output.end();
        await once(output, "close");
      } catch (cause) {
        output.destroy();
        throw cause;
      }
      const after = (await file.getMetadata())[0];
      if (String(after.generation) !== generation)
        throw new DuckDbReleaseError(
          "GCS generation changed after stream",
          "pointer-generation-race",
        );
      return { generation, sizeBytes, crc32c: crc32cFinish(crc) };
    } catch (cause) {
      if (cause instanceof DuckDbReleaseError) throw cause;
      throw new DuckDbReleaseError(
        "generation-pinned GCS stream failed",
        "repository-gcs",
        { cause },
      );
    }
  }
}

export interface ReleaseFiles {
  release: ReleaseIndex;
  manifests: Map<DuckDbDataset, DatasetManifest>;
  parquetPaths: Map<DuckDbDataset, string[]>;
  goldens: Map<DuckDbDataset, Map<string, Buffer>>;
  pointer: Pointer;
  pointerGeneration: string;
}

export class GcsReleaseRepository {
  constructor(
    private readonly client: GcsClient,
    private readonly config: DuckDbConfig,
  ) {
    assertDuckDbServerRuntime("GcsReleaseRepository");
  }
  async readPointer(): Promise<{ pointer: Pointer; generation: string }> {
    assertDuckDbServerRuntime("GcsReleaseRepository.readPointer");
    const uri = `gs://${this.config.bucket}/${this.config.controlObject}`;
    const object = await this.client.read(uri, undefined, 1024 * 1024);
    try {
      return {
        pointer: validatePointer(parseJson(object.bytes, "pointer")),
        generation: object.generation,
      };
    } catch (cause) {
      throw new DuckDbReleaseError(
        "pointer validation failed",
        "pointer-validation",
        { cause },
      );
    }
  }
  async isPointerCurrent(generation: string): Promise<boolean> {
    assertDuckDbServerRuntime("GcsReleaseRepository.isPointerCurrent");
    return (await this.readPointer()).generation === generation;
  }
  async downloadRelease(
    pointer: Pointer,
    expectedPointerGeneration: string,
    stagingDir?: string,
  ): Promise<ReleaseFiles> {
    assertDuckDbServerRuntime("GcsReleaseRepository.downloadRelease");
    const current = await this.readPointer();
    if (current.generation !== expectedPointerGeneration)
      throw new DuckDbReleaseError(
        "pointer changed before release download",
        "pointer-generation-race",
      );
    try {
      validatePointerLayout(pointer, this.config.bucket, this.config.prefix);
    } catch (cause) {
      throw new DuckDbReleaseError(
        "pointer layout validation failed",
        "pointer-validation",
        { cause },
      );
    }
    const releaseObject = await this.client.read(
      pointer.manifestUri,
      pointer.manifestGeneration,
      1024 * 1024,
    );
    if (releaseObject.generation !== pointer.manifestGeneration)
      throw new DuckDbReleaseError(
        "release manifest generation changed",
        "pointer-generation-race",
      );
    if (sha256(releaseObject.bytes) !== pointer.manifestSha256)
      throw new DuckDbReleaseError("release manifest SHA-256 mismatch");
    const release = validateRelease(
      parseJson(releaseObject.bytes, "release.json"),
    );
    if (release.releaseId !== pointer.releaseId)
      throw new DuckDbReleaseError("pointer/release id mismatch");
    const manifests = new Map<DuckDbDataset, DatasetManifest>();
    const parquetPaths = new Map<DuckDbDataset, string[]>();
    const goldens = new Map<DuckDbDataset, Map<string, Buffer>>();
    let totalBytes = 0;
    const releasePaths = new Set<string>();
    for (const dataset of DUCKDB_DATASETS) {
      const entry = release.datasets[dataset];
      const datasetPrefix = `gs://${this.config.bucket}/${this.config.prefix}/${pointer.releaseId}/${dataset}/`;
      if (entry.manifestUri !== `${datasetPrefix}manifest.json`)
        throw new DuckDbReleaseError(
          `${dataset} manifest URI must be exactly dataset/manifest.json`,
        );
      validateUri(
        entry.manifestUri,
        this.config.bucket,
        this.config.prefix,
        `${this.config.prefix}/${pointer.releaseId}`,
      );
      const manifestObject = await this.client.read(
        entry.manifestUri,
        entry.manifestGeneration,
        1024 * 1024,
      );
      const manifest = validateManifest(
        parseJson(manifestObject.bytes, `${dataset} manifest`),
        dataset,
      );
      if (manifest.schemaVersion !== entry.schemaVersion)
        throw new DuckDbReleaseError(
          `${dataset} release and manifest schemaVersion mismatch`,
        );
      if (manifestObject.generation !== entry.manifestGeneration)
        throw new DuckDbReleaseError(
          `${dataset} manifest generation changed`,
          "pointer-generation-race",
        );
      if (
        manifest.sourceSnapshot !== release.sourceSnapshot ||
        manifest.sourceReadTimestampUtc !== release.sourceReadTimestampUtc
      )
        throw new DuckDbReleaseError(
          `${dataset} source snapshot metadata mismatch`,
        );
      const outputPaths: string[] = [];
      for (const [index, file] of manifest.objects.entries()) {
        validateUri(
          file.uri,
          this.config.bucket,
          this.config.prefix,
          `${this.config.prefix}/${pointer.releaseId}`,
        );
        const partitionPath = file.uri.slice(datasetPrefix.length);
        if (
          !partitionPath.startsWith("partitions/") ||
          !/^[A-Za-z0-9._-]+\.parquet$/.test(
            partitionPath.slice("partitions/".length),
          )
        )
          throw new DuckDbReleaseError(
            `${dataset} object is not an allowed partition artifact`,
          );
        if (releasePaths.has(file.uri))
          throw new DuckDbReleaseError(
            `${dataset} has a duplicate release object path`,
          );
        releasePaths.add(file.uri);
        if (
          file.sizeBytes > this.config.maxObjectBytes ||
          totalBytes + file.sizeBytes > this.config.maxReleaseBytes
        )
          throw new DuckDbReleaseError(
            "DuckDB release exceeds configured download budget",
          );
        totalBytes += file.sizeBytes;
        const output = `${stagingDir ?? ""}/${dataset}-${index}.parquet`;
        outputPaths.push(output);
        if (stagingDir && !this.client.streamTo)
          throw new DuckDbReleaseError(
            "staged release download requires generation-pinned streaming support",
          );
        if (this.client.streamTo && stagingDir) {
          const streamed = await this.client.streamTo(
            file.uri,
            file.generation,
            output,
            Math.min(
              this.config.maxObjectBytes,
              this.config.maxReleaseBytes - (totalBytes - file.sizeBytes),
            ),
          );
          if (
            streamed.generation !== file.generation ||
            streamed.sizeBytes !== file.sizeBytes ||
            streamed.crc32c !== file.crc32c
          )
            throw new DuckDbReleaseError(
              `${dataset} streamed integrity mismatch`,
            );
        } else {
          const parquetObject = await this.client.read(
            file.uri,
            file.generation,
          );
          if (parquetObject.generation !== file.generation)
            throw new DuckDbReleaseError(
              `${dataset} Parquet generation changed`,
              "pointer-generation-race",
            );
          validateIntegrity(
            parquetObject.bytes,
            file.sizeBytes,
            file.crc32c,
            dataset,
          );
          if (stagingDir) {
            const { writeFile } = await import("node:fs/promises");
            await writeFile(output, parquetObject.bytes, { flag: "wx" });
          }
        }
      }
      const datasetGoldens = new Map<string, Buffer>();
      for (const golden of manifest.goldens) {
        validateUri(
          golden.uri,
          this.config.bucket,
          this.config.prefix,
          `${this.config.prefix}/${pointer.releaseId}`,
        );
        const goldenPath = golden.uri.slice(datasetPrefix.length);
        if (
          !goldenPath.startsWith("goldens/") ||
          !/^[A-Za-z0-9._-]+\.json$/.test(goldenPath.slice("goldens/".length))
        )
          throw new DuckDbReleaseError(
            `${dataset} golden is not an allowed golden artifact`,
          );
        if (releasePaths.has(golden.uri))
          throw new DuckDbReleaseError(
            `${dataset} has a duplicate golden path`,
          );
        releasePaths.add(golden.uri);
        const goldenObject = await this.client.read(
          golden.uri,
          golden.generation,
          Math.min(
            this.config.maxObjectBytes,
            this.config.maxReleaseBytes - totalBytes,
          ),
        );
        if (goldenObject.generation !== golden.generation)
          throw new DuckDbReleaseError(
            `${dataset} golden generation changed`,
            "pointer-generation-race",
          );
        if (goldenObject.bytes.length !== golden.sizeBytes)
          throw new DuckDbReleaseError(`${dataset} golden size mismatch`);
        if (
          golden.sizeBytes > this.config.maxObjectBytes ||
          totalBytes + golden.sizeBytes > this.config.maxReleaseBytes
        )
          throw new DuckDbReleaseError(
            "DuckDB release exceeds configured golden budget",
          );
        totalBytes += golden.sizeBytes;
        if (golden.sha256 && sha256(goldenObject.bytes) !== golden.sha256)
          throw new DuckDbReleaseError(`${dataset} golden hash mismatch`);
        if (
          golden.canonicalValue !== undefined &&
          !canonicalJson(
            parseJson(goldenObject.bytes, `${dataset} golden`),
          ).equals(canonicalJson(golden.canonicalValue))
        )
          throw new DuckDbReleaseError(`${dataset} golden value mismatch`);
        datasetGoldens.set(golden.name, goldenObject.bytes);
      }
      parquetPaths.set(dataset, outputPaths);
      manifests.set(dataset, manifest);
      goldens.set(dataset, datasetGoldens);
    }
    const after = await this.readPointer();
    if (after.generation !== expectedPointerGeneration)
      throw new DuckDbReleaseError(
        "pointer changed before activation",
        "pointer-generation-race",
      );
    return {
      release,
      manifests,
      parquetPaths,
      goldens,
      pointer,
      pointerGeneration: expectedPointerGeneration,
    };
  }
}
