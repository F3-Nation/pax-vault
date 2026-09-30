import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DuckDbConfig } from "./config";
import { DuckDbUnavailableError, DuckDbReleaseError } from "./errors";
import { GcsReleaseRepository, ReleaseFiles } from "./gcs";
import { assertDuckDbServerRuntime } from "./server";
import { schemaFor } from "./constants";
import {
  canonicalDuckDbRows,
  canonicalJson,
  schemaFingerprint,
  sha256,
} from "./validation";
import { reportDuckDbRuntimeTelemetry } from "../observability";

export interface DuckDbHandle {
  close(): Promise<void> | void;
  connect(): Promise<DuckDbQueryConnection>;
}
export interface DuckDbQueryConnection {
  query<T = unknown>(
    sql: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T[]>;
  close(): void;
}
export interface CandidateOpener {
  open(
    dbPath: string,
    release: ReleaseFiles,
    config: DuckDbConfig,
  ): Promise<DuckDbHandle>;
}

export const nativeCandidateOpener: CandidateOpener = {
  async open(dbPath, release, config) {
    assertDuckDbServerRuntime("nativeCandidateOpener");
    // Dynamic import is intentional: disabled/config-invalid paths must not load
    // the native binding, and this module is server-only.
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const writable = await DuckDBInstance.create(dbPath, {
      memory_limit: config.memoryLimit,
    });
    try {
      const stagingConnection = await writable.connect();
      try {
        for (const [dataset, paths] of release.parquetPaths) {
          const schema = schemaFor(dataset, release.pointer.contractVersion);
          const columns = Array.isArray(schema.columns)
            ? schema.columns
            : Object.entries(schema.columns).map(([name, spec]) => ({
                name,
                ...spec,
              }));
          const files = paths
            .map((path) => `'${path.replaceAll("'", "''")}'`)
            .join(",");
          const expected = columns.map((column) => [
            column.name,
            column.logicalType,
            column.nullable ? "YES" : "NO",
          ]);
          for (const path of paths) {
            const physicalDescription = await stagingConnection.runAndReadAll(
              `DESCRIBE SELECT * FROM read_parquet('${path.replaceAll("'", "''")}')`,
            );
            await physicalDescription.readAll();
            const physical = physicalDescription
              .getRows()
              .map((row) => [String(row[0]), String(row[1]), String(row[2])]);
            if (JSON.stringify(physical) !== JSON.stringify(expected))
              throw new DuckDbReleaseError(
                `${dataset} Parquet partition physical schema does not match registry`,
              );
          }
          await stagingConnection.run(
            `CREATE VIEW "${dataset}" AS SELECT ${columns
              .map((column) => `"${column.name.replaceAll('"', '""')}"`)
              .join(", ")} FROM read_parquet([${files}])`,
          );
        }
      } finally {
        stagingConnection.closeSync();
      }
    } finally {
      writable.closeSync();
    }
    const instance = await DuckDBInstance.create(dbPath, {
      access_mode: "READ_ONLY",
      memory_limit: config.memoryLimit,
    });
    try {
      const connection = await instance.connect();
      try {
        for (const dataset of release.parquetPaths.keys()) {
          const schema = schemaFor(dataset, release.pointer.contractVersion);
          const columns = Array.isArray(schema.columns)
            ? schema.columns
            : Object.entries(schema.columns).map(([name, spec]) => ({
                name,
                ...spec,
              }));
          await connection.run(`SELECT * FROM "${dataset}" LIMIT 0`);
          const description = await connection.runAndReadAll(
            `DESCRIBE "${dataset}"`,
          );
          await description.readAll();
          const actual = description
            .getRows()
            .map((row) => [String(row[0]), String(row[1]), String(row[2])]);
          const expected = columns.map((column) => [
            column.name,
            column.logicalType,
            column.nullable ? "YES" : "NO",
          ]);
          if (JSON.stringify(actual) !== JSON.stringify(expected))
            throw new DuckDbReleaseError(
              `${dataset} Parquet schema does not match registry`,
            );
          const actualSchema = Array.isArray(schema.columns)
            ? actual.map(([name, logicalType, nullable]) => ({
                name,
                logicalType,
                nullable: nullable === "YES",
              }))
            : Object.fromEntries(
                actual.map(([name, logicalType, nullable]) => [
                  name,
                  { logicalType, nullable: nullable === "YES" },
                ]),
              );
          if (
            sha256(canonicalJson(actualSchema)) !==
            schemaFingerprint(dataset, release.pointer.contractVersion)
          )
            throw new DuckDbReleaseError(
              `${dataset} actual schema fingerprint mismatch`,
            );
          const manifest = release.manifests?.get(dataset);
          if (
            manifest &&
            manifest.schemaFingerprintSha256 !==
              sha256(canonicalJson(actualSchema))
          )
            throw new DuckDbReleaseError(
              `${dataset} manifest schema fingerprint mismatch`,
            );
          if (manifest) {
            const paths = release.parquetPaths.get(dataset) ?? [];
            let aggregateRows = 0;
            for (const [index, path] of paths.entries()) {
              const countReader = await connection.runAndReadAll(
                `SELECT COUNT(*) FROM read_parquet('${path.replaceAll("'", "''")}')`,
              );
              await countReader.readAll();
              const count = Number(countReader.getRows()[0]?.[0] ?? -1);
              if (count !== manifest.objects[index]?.rowCount)
                throw new DuckDbReleaseError(
                  `${dataset} partition row count mismatch`,
                );
              aggregateRows += count;
            }
            if (aggregateRows !== manifest.rowCount)
              throw new DuckDbReleaseError(
                `${dataset} aggregate row count mismatch`,
              );
            for (const specification of schema.goldenSpecifications) {
              const reader = await connection.runAndReadAll(
                specification.query,
              );
              await reader.readAll();
              const expectedGolden = release.goldens
                ?.get(dataset)
                ?.get(specification.name);
              if (
                !expectedGolden ||
                !canonicalDuckDbRows(reader.getRows()).equals(expectedGolden)
              )
                throw new DuckDbReleaseError(
                  `${dataset} verification golden mismatch`,
                );
            }
          }
        }
      } finally {
        connection.closeSync();
      }
      let closeRequested = false;
      let openConnections = 0;
      const finishClose = () => {
        if (closeRequested && openConnections === 0) instance.closeSync();
      };
      return {
        close: () => {
          closeRequested = true;
          finishClose();
        },
        connect: async () => {
          if (closeRequested) throw new DuckDbUnavailableError();
          openConnections++;
          let connection;
          try {
            connection = await instance.connect();
          } catch (cause) {
            openConnections--;
            throw cause;
          }
          let connectionClosed = false;
          return {
            query: async <T>(
              sql: string,
              params?: unknown[] | Record<string, unknown>,
            ) => {
              const reader = await connection.runAndReadAll(
                sql,
                params as never,
              );
              await reader.readAll();
              // The positional getRows() API loses column names at the service
              // boundary. Keep native DuckDB's keyed row representation so
              // nested structs/lists retain their shape.
              const rows = reader.getRowObjectsJS() as T[];
              // DuckDB's JS conversion represents DATE and TIMESTAMP as Date.
              // Preserve the legacy date-only wire format for native DATE while
              // leaving timestamp values as UTC ISO strings in query.ts.
              const dateColumns = reader
                .columnNames()
                .map((name, index) =>
                  reader.columnTypeId(index) === 13 ? name : undefined,
                )
                .filter((name): name is string => name !== undefined);
              if (dateColumns.length === 0) return rows;
              return rows.map((row) => {
                const copy = { ...(row as Record<string, unknown>) };
                for (const name of dateColumns) {
                  const value = copy[name];
                  if (value instanceof Date)
                    copy[name] = value.toISOString().slice(0, 10);
                }
                return copy as T;
              });
            },
            close: () => {
              if (connectionClosed) return;
              connectionClosed = true;
              connection.closeSync();
              openConnections--;
              finishClose();
            },
          };
        },
      };
    } catch (cause) {
      instance.closeSync();
      throw cause;
    }
  },
};

interface Active {
  handle: DuckDbHandle;
  releaseId: string;
  releaseSequence: number;
  activatedAt: number;
  lastPointerValidatedAt: number;
  leases: number;
  retired: boolean;
  directory: string;
  pointerGeneration: string;
}

export interface DuckDbRuntimeStatus {
  enabled: boolean;
  state: "disabled" | "ready" | "stale" | "unavailable" | "refresh-failed";
  activeReleaseId?: string;
  activeReleaseSequence?: number;
  activePointerGeneration?: string;
  lastPointerValidatedAt?: number;
  refreshFailureCount: number;
  lastRefreshFailureAt?: number;
  lastCleanupFailureAt?: number;
  pointerAgeMs?: number;
  lkgState: "none" | "ready" | "stale";
  lastRefreshDurationMs?: number;
  lastRefreshStageDurationsMs?: Record<string, number>;
  leaseCount?: number;
  refreshWaiterCount?: number;
  lastRefreshRejectionCategory?: string;
}

export interface DuckDbLease {
  readonly releaseId: string;
  readonly releaseSequence: number;
  release(): void;
  withConnection<T>(
    fn: (connection: DuckDbQueryConnection) => Promise<T>,
  ): Promise<T>;
}

export class DuckDbRuntime {
  private active: Active | undefined;
  private refreshFlight: Promise<void> | undefined;
  private lastAttempt = 0;
  private readonly opener: CandidateOpener;
  private closed = false;
  private refreshFailureCount = 0;
  private lastRefreshFailureAt?: number;
  private lastCleanupFailureAt?: number;
  private readonly reporter?: (
    error: unknown,
    telemetry?: Record<string, unknown>,
  ) => void;
  private lastRefreshDurationMs?: number;
  private lastRefreshStageDurationsMs?: Record<string, number>;
  private readonly retiredCleanup = new Set<Active>();
  private refreshWaiterCount = 0;
  private lastRefreshRejectionCategory?: string;

  constructor(
    private readonly repository: GcsReleaseRepository,
    private readonly config: DuckDbConfig,
    opener: CandidateOpener = nativeCandidateOpener,
    reporter?: (error: unknown, telemetry?: Record<string, unknown>) => void,
  ) {
    assertDuckDbServerRuntime("DuckDbRuntime");
    this.opener = opener;
    this.reporter = reporter;
  }

  status(): DuckDbRuntimeStatus {
    const pointerAgeMs = this.active
      ? Math.max(0, Date.now() - this.active.lastPointerValidatedAt)
      : undefined;
    const lkgState = !this.active
      ? "none"
      : pointerAgeMs! > this.config.maxLkgAgeMs
        ? "stale"
        : "ready";
    return {
      enabled: true,
      state: !this.active
        ? this.refreshFailureCount > 0
          ? "refresh-failed"
          : "unavailable"
        : lkgState === "stale"
          ? "stale"
          : "ready",
      activeReleaseId: this.active?.releaseId,
      activeReleaseSequence: this.active?.releaseSequence,
      activePointerGeneration: this.active?.pointerGeneration,
      lastPointerValidatedAt: this.active?.lastPointerValidatedAt,
      refreshFailureCount: this.refreshFailureCount,
      lastRefreshFailureAt: this.lastRefreshFailureAt,
      lastCleanupFailureAt: this.lastCleanupFailureAt,
      pointerAgeMs,
      lkgState,
      lastRefreshDurationMs: this.lastRefreshDurationMs,
      lastRefreshStageDurationsMs: this.lastRefreshStageDurationsMs,
      leaseCount: this.active?.leases ?? 0,
      refreshWaiterCount: this.refreshWaiterCount,
      lastRefreshRejectionCategory: this.lastRefreshRejectionCategory,
    };
  }

  async acquire(): Promise<DuckDbLease> {
    assertDuckDbServerRuntime("DuckDbRuntime.acquire");
    await this.retryRetiredCleanup();
    if (this.closed) throw new DuckDbUnavailableError();
    if (!this.active) {
      try {
        await this.refresh();
      } catch (cause) {
        throw new DuckDbUnavailableError(undefined, { cause });
      }
    } else if (Date.now() - this.lastAttempt >= this.config.refreshTtlMs) {
      // Refresh is deliberately not awaited: LKG leases continue serving.
      void this.refresh().catch(() => undefined);
    }
    const active = this.active;
    if (!active)
      throw new DuckDbUnavailableError("DuckDB release is unavailable");
    if (Date.now() - active.lastPointerValidatedAt > this.config.maxLkgAgeMs)
      throw new DuckDbUnavailableError(
        "DuckDB last-known-good release has expired",
      );
    active.leases += 1;
    let released = false;
    let operations = 0;
    const finishLease = () => {
      if (!released || operations > 0) return;
      active.leases -= 1;
      void this.cleanup(active);
    };
    return {
      releaseId: active.releaseId,
      releaseSequence: active.releaseSequence,
      release: () => {
        if (released) return;
        released = true;
        finishLease();
      },
      withConnection: async <T>(
        fn: (connection: DuckDbQueryConnection) => Promise<T>,
      ) => {
        if (released) throw new DuckDbUnavailableError();
        // This synchronous increment is the operation guard. It happens before
        // the async native connection open, so release cannot retire the lease
        // in the gap between admission and connection creation.
        operations += 1;
        let connection: DuckDbQueryConnection | undefined;
        try {
          connection = await active.handle.connect();
          return await fn(connection);
        } finally {
          try {
            connection?.close();
          } finally {
            operations -= 1;
            finishLease();
          }
        }
      },
    };
  }

  async refresh(): Promise<void> {
    assertDuckDbServerRuntime("DuckDbRuntime.refresh");
    await this.retryRetiredCleanup();
    this.refreshWaiterCount++;
    if (this.refreshFlight) {
      try {
        await this.refreshFlight;
      } finally {
        this.refreshWaiterCount--;
      }
      return;
    }
    this.lastAttempt = Date.now();
    this.refreshFlight = this.performRefresh()
      .catch((cause) => {
        this.recordRefreshFailure(cause);
        throw cause;
      })
      .finally(() => {
        this.refreshFlight = undefined;
      });
    try {
      await this.refreshFlight;
    } finally {
      this.refreshWaiterCount--;
    }
  }

  private async performRefresh(): Promise<void> {
    const refreshStartedAt = Date.now();
    const stages: Record<string, number> = {};
    const stage = async <T>(name: string, operation: () => Promise<T>) => {
      const started = Date.now();
      try {
        return await operation();
      } finally {
        stages[name] = Date.now() - started;
      }
    };
    const candidateDir = join(
      this.config.cacheDir,
      `.candidate-${randomUUID()}`,
    );
    await mkdir(candidateDir, { recursive: true });
    try {
      const { pointer, generation } = await stage("read_pointer", () =>
        this.repository.readPointer(),
      );
      if (this.active?.pointerGeneration === generation) {
        this.active.lastPointerValidatedAt = Date.now();
        await rm(candidateDir, { recursive: true, force: true });
        this.recordRefreshTiming(refreshStartedAt, stages);
        return;
      }
      const release = await stage("download", () =>
        this.repository.downloadRelease(pointer, generation, candidateDir),
      ).catch((cause) => {
        if (cause instanceof DuckDbReleaseError) throw cause;
        throw new DuckDbReleaseError(
          "release repository failed",
          "repository-gcs",
          { cause },
        );
      });
      const dbPath = join(candidateDir, "release.duckdb");
      const candidate = await stage("open_validate", () =>
        this.opener.open(dbPath, release, this.config),
      );
      if (
        !(await stage("activation_check", () =>
          this.repository.isPointerCurrent(release.pointerGeneration),
        ))
      ) {
        await candidate.close();
        throw new DuckDbReleaseError(
          "pointer changed immediately before activation",
          "pointer-generation-race",
        );
      }
      const prior = this.active;
      this.active = {
        handle: candidate,
        releaseId: release.pointer.releaseId,
        releaseSequence: release.pointer.releaseSequence,
        activatedAt: Date.now(),
        lastPointerValidatedAt: Date.now(),
        leases: 0,
        retired: false,
        directory: candidateDir,
        pointerGeneration: release.pointerGeneration,
      };
      if (prior) {
        prior.retired = true;
        void this.cleanup(prior);
      }
      this.recordRefreshTiming(refreshStartedAt, stages, {
        releaseId: release.pointer.releaseId,
        generation: release.pointerGeneration,
      });
    } catch (cause) {
      this.recordRefreshTiming(refreshStartedAt, stages, {}, "failure");
      await rm(candidateDir, { recursive: true, force: true });
      if (
        cause instanceof DuckDbReleaseError ||
        cause instanceof DuckDbUnavailableError
      )
        throw cause;
      throw new DuckDbReleaseError(
        "candidate activation failed",
        "native-open",
        { cause },
      );
    }
  }

  private async cleanup(active: Active): Promise<void> {
    if (!active.retired || active.leases > 0) return;
    try {
      await active.handle.close();
      await rm(active.directory, { recursive: true, force: true });
      this.retiredCleanup.delete(active);
    } catch (cause) {
      this.retiredCleanup.add(active);
      this.lastCleanupFailureAt = Date.now();
      this.reporter?.(cause);
      reportDuckDbRuntimeTelemetry({
        event: "duckdb_cleanup",
        outcome: "failure",
        releaseId: active.releaseId,
        generation: active.pointerGeneration,
        pointerAgeMs: Math.max(0, Date.now() - active.lastPointerValidatedAt),
        lkgState: this.status().lkgState,
      });
    }
  }
  private async retryRetiredCleanup(): Promise<void> {
    for (const active of [...this.retiredCleanup]) await this.cleanup(active);
  }
  private recordRefreshFailure(cause: unknown): void {
    this.refreshFailureCount++;
    this.lastRefreshFailureAt = Date.now();
    this.lastRefreshRejectionCategory = categorizeDuckDbRejection(cause);
    this.reporter?.(cause, {
      event: "duckdb_refresh",
      outcome: "failure",
      refreshFailureCount: this.refreshFailureCount,
      rejectionCategory: this.lastRefreshRejectionCategory,
    });
    const status = this.status();
    reportDuckDbRuntimeTelemetry({
      event: "duckdb_refresh",
      outcome: "failure",
      releaseId: status.activeReleaseId,
      releaseSequence: status.activeReleaseSequence,
      generation: status.activePointerGeneration,
      refreshFailureCount: status.refreshFailureCount,
      leaseCount: status.leaseCount,
      waiterCount: status.refreshWaiterCount,
      rejectionCategory: this.lastRefreshRejectionCategory,
      refreshDurationMs: this.lastRefreshDurationMs,
      stageDurationsMs: this.lastRefreshStageDurationsMs,
      lkgState: status.lkgState,
    });
  }
  private recordRefreshTiming(
    startedAt: number,
    stages: Record<string, number>,
    identity: { releaseId?: string; generation?: string } = {},
    outcome: "success" | "failure" = "success",
  ): void {
    this.lastRefreshDurationMs = Date.now() - startedAt;
    this.lastRefreshStageDurationsMs = { ...stages };
    if (outcome === "success")
      reportDuckDbRuntimeTelemetry({
        event: "duckdb_refresh",
        outcome,
        ...identity,
        refreshDurationMs: this.lastRefreshDurationMs,
        stageDurationsMs: this.lastRefreshStageDurationsMs,
        refreshFailureCount: this.refreshFailureCount,
        releaseSequence: this.active?.releaseSequence,
        leaseCount: this.active?.leases ?? 0,
        waiterCount: this.refreshWaiterCount,
        lkgState: this.status().lkgState,
        pointerAgeMs: this.status().pointerAgeMs,
      });
  }
  async close(): Promise<void> {
    this.closed = true;
    if (this.refreshFlight) await this.refreshFlight.catch(() => undefined);
    if (this.active) {
      this.active.retired = true;
      await this.cleanup(this.active);
    }
    await this.retryRetiredCleanup();
  }
}

export function categorizeDuckDbRejection(error: unknown): string {
  if (error instanceof DuckDbUnavailableError) return "unavailable";
  if (error instanceof DuckDbReleaseError) return error.rejectionCategory;
  return "native-open";
}
