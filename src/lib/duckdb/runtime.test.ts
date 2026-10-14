import { describe, expect, it, vi } from "vitest";
import * as fsPromises from "node:fs/promises";
import { dirname } from "node:path";
import { DuckDbConfig } from "./config";
import { DuckDbUnavailableError, DuckDbReleaseError } from "./errors";
import { categorizeDuckDbRejection, DuckDbRuntime } from "./runtime";
import { ReleaseFiles } from "./gcs";
import {
  DUCKDB_CONTRACT_VERSION,
  DUCKDB_DATASETS,
  DUCKDB_DETAILS_DATASET,
} from "./constants";

const config: DuckDbConfig = {
  enabled: true,
  bucket: "bucket",
  prefix: "releases",
  controlObject: "current.json",
  cacheDir: "/tmp/pax-vault-test",
  // Keep lifecycle tests independent of wall-clock TTL refreshes. Tests that
  // need a refresh invoke runtime.refresh() explicitly.
  refreshTtlMs: 60_000,
  maxLkgAgeMs: 1000,
  memoryLimit: "64MB",
  maxReleaseBytes: 1000000,
  maxObjectBytes: 100000,
};
const release = (id: string, sequence: number) =>
  ({
    pointer: {
      releaseId: id,
      releaseSequence: sequence,
      contractVersion: DUCKDB_CONTRACT_VERSION,
    },
    release: {
      releaseId: id,
      contractVersion: DUCKDB_CONTRACT_VERSION,
      datasets: Object.fromEntries(
        DUCKDB_DATASETS.map((dataset) => [dataset, {}]),
      ),
    },
    manifests: new Map(),
    goldens: new Map(),
    parquetPaths: new Map(DUCKDB_DATASETS.map((dataset) => [dataset, []])),
    pointerGeneration: String(sequence),
  }) as unknown as ReleaseFiles;
const splitRelease = (id: string, sequence: number) => {
  const core = release(id, sequence);
  const entry = {
    manifestUri: `gs://bucket/releases/${id}/pv_event_details/manifest.json`,
    manifestGeneration: String(sequence),
    schemaVersion: "pv_event_details.v1",
    sourceReadTimestampUtc: "2026-01-01T00:00:00Z",
    sourceReadPolicy: "ordered-sequential-per-dataset",
    sourceOrder: "20260101T000000.000000Z",
  };
  return {
    ...core,
    release: {
      ...core.release,
      datasets: {
        ...core.release.datasets,
        [DUCKDB_DETAILS_DATASET]: entry,
        pv_events: {
          ...core.release.datasets.pv_events,
          schemaVersion: "pv_events.v3",
        },
      },
    },
    manifests: new Map([
      [DUCKDB_DETAILS_DATASET, { dataset: DUCKDB_DETAILS_DATASET }],
    ]),
  } as unknown as ReleaseFiles;
};
function fakeRepo() {
  let current = release("r-1", 1);
  return {
    repo: {
      readPointer: async () => ({
        pointer: current.pointer,
        generation: String(current.pointer.releaseSequence),
      }),
      isPointerCurrent: async () => true,
      downloadRelease: async () => current,
      downloadDeferredDetails: async () => ({
        parquetPaths: ["event-details.parquet"],
        goldens: new Map([["candidate_transport_check", Buffer.from("[]")]]),
      }),
    },
    set: (next: ReleaseFiles) => {
      current = next;
    },
  };
}
function opener(closes: string[] = []) {
  return {
    open: async (_path: string, release: ReleaseFiles) => ({
      close: () => {
        closes.push(release.pointer.releaseId);
      },
      connect: async () => ({ query: async () => [], close: () => undefined }),
    }),
  };
}

describe("DuckDB local lifecycle", () => {
  it("categorizes typed refresh rejections without inspecting messages", () => {
    expect(
      categorizeDuckDbRejection(
        new DuckDbReleaseError("anything", "pointer-generation-race"),
      ),
    ).toBe("pointer-generation-race");
    expect(
      categorizeDuckDbRejection(
        new DuckDbReleaseError("anything", "pointer-validation"),
      ),
    ).toBe("pointer-validation");
    expect(
      categorizeDuckDbRejection(
        new DuckDbReleaseError("anything", "repository-gcs"),
      ),
    ).toBe("repository-gcs");
    expect(
      categorizeDuckDbRejection(
        new DuckDbReleaseError("anything", "integrity-schema"),
      ),
    ).toBe("integrity-schema");
    expect(
      categorizeDuckDbRejection(
        new DuckDbReleaseError("anything", "native-open"),
      ),
    ).toBe("native-open");
  });
  it("categorizes the immediate pre-activation pointer race", async () => {
    const f = fakeRepo();
    const telemetry: Record<string, unknown>[] = [];
    f.repo.isPointerCurrent = async () => false;
    const runtime = new DuckDbRuntime(
      f.repo as never,
      config,
      opener(),
      (_error, fields) => {
        if (fields) telemetry.push(fields);
      },
    );

    await expect(runtime.refresh()).rejects.toBeInstanceOf(DuckDbReleaseError);
    expect(runtime.status().lastRefreshRejectionCategory).toBe(
      "pointer-generation-race",
    );
    expect(telemetry.at(-1)?.rejectionCategory).toBe("pointer-generation-race");
  });
  it("closes an opened candidate if the pointer check throws", async () => {
    const f = fakeRepo();
    f.repo.isPointerCurrent = async () => {
      throw new Error("pointer check failed");
    };
    const closed: string[] = [];
    const runtime = new DuckDbRuntime(f.repo as never, config, opener(closed));
    await expect(runtime.refresh()).rejects.toBeInstanceOf(DuckDbReleaseError);
    expect(closed).toEqual(["r-1"]);
    await runtime.close();
  });
  it("retains an unpublished handle when close fails and retries cleanup", async () => {
    const f = fakeRepo();
    f.repo.isPointerCurrent = async () => false;
    const paths: string[] = [];
    let closeAttempts = 0;
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async (path) => {
        paths.push(dirname(path));
        return {
          close: () => {
            closeAttempts++;
            if (closeAttempts === 1) throw new Error("one close failure");
          },
          connect: async () => ({
            query: async () => [],
            close: () => undefined,
          }),
        };
      },
    });
    await expect(runtime.refresh()).rejects.toBeInstanceOf(DuckDbReleaseError);
    await expect(fsPromises.access(paths[0])).resolves.toBeUndefined();
    await expect(runtime.refresh()).rejects.toBeInstanceOf(DuckDbReleaseError);
    await expect(fsPromises.access(paths[0])).rejects.toThrow();
    expect(closeAttempts).toBe(3);
    await runtime.close();
  });
  it("retains a directory when removal fails and retries it at a later boundary", async () => {
    const f = fakeRepo();
    f.repo.isPointerCurrent = async () => false;
    const paths: string[] = [];
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async (path) => {
        paths.push(dirname(path));
        return {
          close: () => undefined,
          connect: async () => ({
            query: async () => [],
            close: () => undefined,
          }),
        };
      },
    });
    const originalRm = fsPromises.rm.bind(fsPromises);
    let failOnce = true;
    const runtimeInternals = runtime as unknown as {
      removeDirectory: (
        path: string,
        options: { recursive: boolean; force: boolean },
      ) => Promise<void>;
    };
    runtimeInternals.removeDirectory = async (path, options) => {
      if (failOnce) {
        failOnce = false;
        throw new Error("one remove failure");
      }
      await originalRm(path, options);
    };
    try {
      await expect(runtime.refresh()).rejects.toBeInstanceOf(
        DuckDbReleaseError,
      );
      await expect(fsPromises.access(paths[0])).resolves.toBeUndefined();
      await expect(runtime.refresh()).rejects.toBeInstanceOf(
        DuckDbReleaseError,
      );
      await expect(fsPromises.access(paths[0])).rejects.toThrow();
    } finally {
      runtimeInternals.removeDirectory = originalRm;
      await runtime.close();
    }
  });
  it("does not register a refresh that was admitted before close but resumes afterward", async () => {
    const f = fakeRepo();
    const runtime = new DuckDbRuntime(f.repo as never, config, opener());
    let finish!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => (entered = resolve));
    const original = runtime["retryRetiredCleanup"].bind(runtime);
    let retryCalls = 0;
    (
      runtime as unknown as { retryRetiredCleanup: () => Promise<void> }
    ).retryRetiredCleanup = async () => {
      retryCalls++;
      if (retryCalls === 1) {
        entered();
        await new Promise<void>((resolve) => (finish = resolve));
      } else {
        await original();
      }
    };
    const refresh = runtime.refresh();
    await enteredPromise;
    await runtime.close();
    finish();
    await expect(refresh).rejects.toBeInstanceOf(DuckDbUnavailableError);
    await expect(runtime.refresh()).rejects.toBeInstanceOf(
      DuckDbUnavailableError,
    );
    await expect(runtime.acquire()).rejects.toBeInstanceOf(
      DuckDbUnavailableError,
    );
  });
  it("waits for a blocked opener during close and does not lease its candidate", async () => {
    const f = fakeRepo();
    let finishOpen!: () => void;
    let openStarted!: () => void;
    const openStartedPromise = new Promise<void>(
      (resolve) => (openStarted = resolve),
    );
    const closed: string[] = [];
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async () => {
        openStarted();
        await new Promise<void>((resolve) => (finishOpen = resolve));
        return {
          close: () => {
            closed.push("candidate");
          },
          connect: async () => ({
            query: async () => [],
            close: () => undefined,
          }),
        };
      },
    });
    const acquisition = runtime.acquire();
    await openStartedPromise;
    const closing = runtime.close();
    finishOpen();
    await closing;
    await expect(acquisition).rejects.toBeInstanceOf(DuckDbUnavailableError);
    expect(closed).toEqual(["candidate"]);
    expect(runtime.status().activeReleaseId).toBeUndefined();
  });
  it("throws a typed unavailable error without an LKG", async () => {
    const f = fakeRepo();
    f.repo.downloadRelease = async () => {
      throw new Error("network");
    };
    await expect(
      new DuckDbRuntime(f.repo as never, config, opener()).acquire(),
    ).rejects.toBeInstanceOf(DuckDbUnavailableError);
  });
  it("activates a candidate and drains retired leases before close", async () => {
    const closed: string[] = [];
    const f = fakeRepo();
    const runtime = new DuckDbRuntime(f.repo as never, config, opener(closed));
    const first = await runtime.acquire();
    f.set(release("r-2", 2));
    await runtime.refresh();
    expect(first.releaseId).toBe("r-1");
    expect(closed).toEqual([]);
    first.release();
    await new Promise((r) => setTimeout(r, 10));
    expect(closed).toEqual(["r-1"]);
  });
  it("serves the LKG while a refresh is in flight", async () => {
    const f = fakeRepo();
    const runtime = new DuckDbRuntime(f.repo as never, config, opener());
    await runtime.acquire();
    f.set(release("r-2", 2));
    let resolve!: () => void;
    f.repo.downloadRelease = () =>
      new Promise<ReleaseFiles>((r) => {
        resolve = () => r(release("r-2", 2));
      });
    const refresh = runtime.refresh();
    const lease = await runtime.acquire();
    await new Promise((r) => setTimeout(r, 10));
    expect(lease.releaseId).toBe("r-1");
    lease.release();
    resolve();
    await refresh;
  });
  it("accounts operations per lease across swap and retirement", async () => {
    const closed: string[] = [];
    const f = fakeRepo();
    const runtime = new DuckDbRuntime(f.repo as never, config, opener(closed));
    const leaseA = await runtime.acquire();
    const leaseB = await runtime.acquire();
    f.set(release("r-2", 2));
    let unblock!: () => void;
    const operation = leaseB.withConnection(
      async () =>
        new Promise<void>((resolve) => {
          unblock = resolve;
        }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    await runtime.refresh();
    leaseA.release();
    leaseB.release();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(closed).toEqual([]);
    expect(runtime.status().activeReleaseId).toBe("r-2");
    unblock();
    await operation;
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(closed).toEqual(["r-1"]);
    await runtime.close();
  });
  it("single-flights split details initialization and keeps core queries ready", async () => {
    const f = fakeRepo();
    f.set(splitRelease("r-split", 1));
    let finish!: () => void;
    const download = vi.fn(
      () =>
        new Promise<{ parquetPaths: string[]; goldens: Map<string, Buffer> }>(
          (resolve) => {
            finish = () =>
              resolve({
                parquetPaths: ["details.parquet"],
                goldens: new Map([
                  ["candidate_transport_check", Buffer.from("[]")],
                ]),
              });
          },
        ),
    );
    f.repo.downloadDeferredDetails = download as never;
    const opened: string[][] = [];
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async (_path, files) => {
        opened.push([...files.parquetPaths.keys()]);
        return {
          close: () => undefined,
          connect: async () => ({
            query: async <T>() => ["details"] as T[],
            close: () => undefined,
          }),
        };
      },
    });
    const lease = await runtime.acquire();
    opened.length = 0;
    const detail1 = lease.withDetailsConnection((connection) =>
      connection.query("SELECT * FROM pv_event_details"),
    );
    const detail2 = lease.withDetailsConnection((connection) =>
      connection.query("SELECT * FROM pv_event_details"),
    );
    await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
    await expect(
      lease.withConnection((connection) => connection.query("SELECT 1")),
    ).resolves.toEqual(["details"]);
    expect(runtime.status().state).toBe("ready");
    finish();
    await expect(Promise.all([detail1, detail2])).resolves.toEqual([
      ["details"],
      ["details"],
    ]);
    expect(opened).toEqual([["pv_event_details"]]);
    lease.release();
    await runtime.close();
  });
  it("routes legacy details queries through the core handle without deferred downloads", async () => {
    const f = fakeRepo();
    const deferred = vi.fn(f.repo.downloadDeferredDetails);
    f.repo.downloadDeferredDetails = deferred;
    const runtime = new DuckDbRuntime(f.repo as never, config, opener());
    const lease = await runtime.acquire();
    await expect(
      lease.withDetailsConnection((connection) => connection.query("SELECT 1")),
    ).resolves.toEqual([]);
    expect(deferred).not.toHaveBeenCalled();
    lease.release();
    await runtime.close();
  });
  it("releases the lease operation guard when connection opening fails", async () => {
    const f = fakeRepo();
    let connections = 0;
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async () => ({
        close: () => undefined,
        connect: async () => {
          connections++;
          if (connections === 1) throw new Error("open failed");
          return {
            query: async <T>() => [1] as T[],
            close: () => undefined,
          };
        },
      }),
    });
    const lease = await runtime.acquire();
    await expect(
      lease.withConnection((connection) => connection.query("SELECT 1")),
    ).rejects.toThrow("open failed");
    await expect(
      lease.withConnection((connection) => connection.query("SELECT 1")),
    ).resolves.toEqual([1]);
    lease.release();
    await runtime.close();
  });
  it("keeps a retired split release alive while its details initializer is pending after early lease release", async () => {
    const f = fakeRepo();
    f.set(splitRelease("r-old-split", 1));
    let finish!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => (started = resolve));
    let downloads = 0;
    f.repo.downloadDeferredDetails = async () => {
      downloads++;
      if (downloads > 1)
        return { parquetPaths: ["new-details.parquet"], goldens: new Map() };
      started();
      return new Promise((resolve) => {
        finish = () =>
          resolve({
            parquetPaths: ["details.parquet"],
            goldens: new Map(),
          });
      });
    };
    const closed: string[] = [];
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async (_path, releaseFiles) => ({
        close: () => {
          closed.push(releaseFiles.pointer.releaseId);
        },
        connect: async () => ({
          query: async <T>() =>
            [{ releaseId: releaseFiles.pointer.releaseId }] as T[],
          close: () => undefined,
        }),
      }),
    });
    const lease = await runtime.acquire();
    const operation = lease.withDetailsConnection((connection) =>
      connection.query("SELECT release_id"),
    );
    await startedPromise;
    f.set(splitRelease("r-new", 2));
    await runtime.refresh();
    const newLease = await runtime.acquire();
    await expect(
      newLease.withDetailsConnection(
        async () => "must be denied while old details are pinned",
      ),
    ).rejects.toBeInstanceOf(DuckDbUnavailableError);
    expect(downloads).toBe(1);
    lease.release();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(closed).toEqual([]);
    finish();
    await expect(operation).resolves.toEqual([{ releaseId: "r-old-split" }]);
    await vi.waitFor(() =>
      expect(closed.filter((id) => id === "r-old-split")).toHaveLength(2),
    );
    await vi.waitFor(() =>
      expect(
        (runtime as unknown as { detailsOwner?: unknown }).detailsOwner,
      ).toBeUndefined(),
    );
    expect(closed.filter((id) => id === "r-old-split")).toHaveLength(2);
    await expect(
      newLease.withDetailsConnection((connection) =>
        connection.query("SELECT release_id"),
      ),
    ).resolves.toEqual([{ releaseId: "r-new" }]);
    expect(downloads).toBe(2);
    newLease.release();
    await runtime.close();
  });
  it("holds the process-wide sidecar slot until a loaded release drains", async () => {
    const f = fakeRepo();
    f.set(splitRelease("r-loaded-old", 1));
    let downloads = 0;
    f.repo.downloadDeferredDetails = async () => {
      downloads++;
      return {
        parquetPaths: [`details-${downloads}.parquet`],
        goldens: new Map(),
      };
    };
    const opened: string[] = [];
    const runtime = new DuckDbRuntime(f.repo as never, config, {
      open: async (_path, releaseFiles) => {
        opened.push(releaseFiles.pointer.releaseId);
        return {
          close: () => undefined,
          connect: async () => ({
            query: async () => [],
            close: () => undefined,
          }),
        };
      },
    });
    const oldLease = await runtime.acquire();
    await oldLease.withDetailsConnection(async () => undefined);
    f.set(splitRelease("r-loaded-new", 2));
    await runtime.refresh();
    const newLease = await runtime.acquire();
    await expect(
      newLease.withDetailsConnection(async () => undefined),
    ).rejects.toBeInstanceOf(DuckDbUnavailableError);
    expect(downloads).toBe(1);
    oldLease.release();
    await vi.waitFor(() =>
      expect(
        (runtime as unknown as { detailsOwner?: unknown }).detailsOwner,
      ).toBeUndefined(),
    );
    await expect(
      newLease.withDetailsConnection(async () => undefined),
    ).resolves.toBeUndefined();
    expect(downloads).toBe(2);
    expect(opened).toEqual([
      "r-loaded-old",
      "r-loaded-old",
      "r-loaded-new",
      "r-loaded-new",
    ]);
    newLease.release();
    await runtime.close();
  });
  it("retains core readiness and retries deferred failures after cooldown", async () => {
    const f = fakeRepo();
    f.set(splitRelease("r-failure", 1));
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let attempts = 0;
    f.repo.downloadDeferredDetails = async () => {
      attempts++;
      if (attempts === 1) throw new Error("private path failure");
      return { parquetPaths: ["details.parquet"], goldens: new Map() };
    };
    const runtime = new DuckDbRuntime(f.repo as never, config, opener());
    try {
      const lease = await runtime.acquire();
      await expect(
        lease.withDetailsConnection(async () => undefined),
      ).rejects.toThrow("deferred detail initialization failed");
      await expect(
        lease.withConnection((connection) => connection.query("SELECT 1")),
      ).resolves.toEqual([]);
      await expect(
        lease.withDetailsConnection(async () => undefined),
      ).rejects.toThrow(/cooling down/);
      expect(attempts).toBe(1);
      now += 5_001;
      await expect(
        lease.withDetailsConnection(async () => "loaded"),
      ).resolves.toBe("loaded");
      expect(attempts).toBe(2);
      lease.release();
      await runtime.close();
    } finally {
      vi.restoreAllMocks();
    }
  });
  it("keeps cooldown after detail attempt removal fails and retries cleanup separately", async () => {
    const f = fakeRepo();
    f.set(splitRelease("r-detail-rm", 1));
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let downloads = 0;
    f.repo.downloadDeferredDetails = async () => {
      downloads++;
      if (downloads === 1) throw new Error("sensitive deferred path");
      return { parquetPaths: ["details.parquet"], goldens: new Map() };
    };
    const originalRm = fsPromises.rm.bind(fsPromises);
    let failRemoval = true;
    const errors: string[] = [];
    const runtime = new DuckDbRuntime(
      f.repo as never,
      { ...config, maxLkgAgeMs: 60_000 },
      opener(),
      (error) => errors.push(String(error)),
    );
    const runtimeInternals = runtime as unknown as {
      removeDirectory: typeof fsPromises.rm;
    };
    runtimeInternals.removeDirectory = async (path, options) => {
      if (failRemoval && String(path).includes(".details-")) {
        throw new Error("remove failed");
      }
      await originalRm(path, options);
    };
    try {
      const lease = await runtime.acquire();
      await expect(
        lease.withDetailsConnection(async () => undefined),
      ).rejects.toThrow("deferred detail initialization failed");
      await expect(
        lease.withDetailsConnection(async () => undefined),
      ).rejects.toThrow(/cleanup is still pending/);
      expect(downloads).toBe(1);
      expect(errors.join(" ")).not.toContain("sensitive deferred path");

      now += 5_001;
      const freshLease = await runtime.acquire();
      await expect(
        lease.withDetailsConnection(async () => undefined),
      ).rejects.toThrow(/cleanup is still pending/);
      await expect(
        freshLease.withDetailsConnection(async () => undefined),
      ).rejects.toThrow(/cleanup is still pending/);
      expect(downloads).toBe(1);
      failRemoval = false;
      await runtime.refresh();
      await expect(
        Promise.all([
          lease.withDetailsConnection(async () => "retry-old-owner"),
          freshLease.withDetailsConnection(async () => "retry-fresh-lease"),
        ]),
      ).resolves.toEqual(["retry-old-owner", "retry-fresh-lease"]);
      expect(downloads).toBe(2);
      expect(
        (runtime as unknown as { detailsOwner?: unknown }).detailsOwner,
      ).toBe((runtime as unknown as { active?: unknown }).active);
      lease.release();
      freshLease.release();
      await runtime.close();
    } finally {
      runtimeInternals.removeDirectory = originalRm;
      vi.restoreAllMocks();
    }
  });
  it("does not start details loading after shutdown and drains an in-flight attempt", async () => {
    const f = fakeRepo();
    f.set(splitRelease("r-shutdown", 1));
    let finish!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => (started = resolve));
    const download = vi.fn(
      () =>
        new Promise<{ parquetPaths: string[]; goldens: Map<string, Buffer> }>(
          (resolve) => {
            finish = () =>
              resolve({
                parquetPaths: ["details.parquet"],
                goldens: new Map(),
              });
            started();
          },
        ),
    );
    f.repo.downloadDeferredDetails = download as never;
    const runtime = new DuckDbRuntime(f.repo as never, config, opener());
    const lease = await runtime.acquire();
    const pending = lease.withDetailsConnection(async () => "should not run");
    await startedPromise;
    await runtime.close();
    await expect(
      lease.withDetailsConnection(async () => "post-shutdown"),
    ).rejects.toBeInstanceOf(DuckDbUnavailableError);
    expect(download).toHaveBeenCalledOnce();
    lease.release();
    finish();
    await expect(pending).rejects.toThrow(
      "deferred detail initialization failed",
    );
  });
  it("does not serve an expired LKG", async () => {
    const f = fakeRepo();
    const runtime = new DuckDbRuntime(
      f.repo as never,
      { ...config, maxLkgAgeMs: 1 },
      opener(),
    );
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      const lease = await runtime.acquire();
      lease.release();
      f.repo.downloadRelease = async () => {
        throw new Error("refresh unavailable");
      };
      now += 5;
      await expect(runtime.acquire()).rejects.toBeInstanceOf(
        DuckDbUnavailableError,
      );
    } finally {
      vi.restoreAllMocks();
    }
  });
});
