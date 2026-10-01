import { describe, expect, it } from "vitest";
import { DuckDbConfig } from "./config";
import { DuckDbUnavailableError, DuckDbReleaseError } from "./errors";
import { categorizeDuckDbRejection, DuckDbRuntime } from "./runtime";
import { ReleaseFiles } from "./gcs";

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
    pointer: { releaseId: id, releaseSequence: sequence },
    parquetPaths: new Map(),
  }) as unknown as ReleaseFiles;
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
  it("does not serve an expired LKG", async () => {
    const f = fakeRepo();
    const runtime = new DuckDbRuntime(
      f.repo as never,
      { ...config, maxLkgAgeMs: 1 },
      opener(),
    );
    await runtime.acquire();
    f.repo.downloadRelease = async () => {
      throw new Error("refresh unavailable");
    };
    await new Promise((r) => setTimeout(r, 5));
    await expect(runtime.acquire()).rejects.toBeInstanceOf(
      DuckDbUnavailableError,
    );
  });
});
