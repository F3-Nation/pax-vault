import { describe, expect, it, vi } from "vitest";
import { DuckDbQueryError, DuckDbUnavailableError } from "./errors";
import {
  DuckDbQueryAdapter,
  isDuckDbEnabled,
  selectDuckDbOrLegacy,
} from "./query";
import type { DuckDbLease, DuckDbQueryConnection } from "./runtime";

const lease = (
  query: (
    sql: string,
    params?: unknown[] | Record<string, unknown>,
  ) => Promise<unknown[]>,
): DuckDbLease => ({
  release: vi.fn(),
  releaseId: "r",
  releaseSequence: 1,
  withConnection: async <T>(
    fn: (connection: DuckDbQueryConnection) => Promise<T>,
  ) =>
    fn({
      query: async <R = unknown>(
        sql: string,
        params?: unknown[] | Record<string, unknown>,
      ) => query(sql, params).then((rows) => rows as unknown as R[]),
      close: vi.fn(),
    }),
});

describe("DuckDB query adapter", () => {
  it("does not initialize a runtime when the feature is off", async () => {
    const duckdb = vi.fn();
    const legacy = vi.fn().mockResolvedValue(["legacy"]);
    const env = { DUCKDB_ENABLED: "false" } as unknown as NodeJS.ProcessEnv;
    expect(isDuckDbEnabled(env)).toBe(false);
    await expect(
      selectDuckDbOrLegacy({ env, duckdb, legacy }),
    ).resolves.toEqual(["legacy"]);
    expect(duckdb).not.toHaveBeenCalled();
  });

  it("layers capability flags over the global default", async () => {
    const duckdb = vi.fn().mockResolvedValue(["duck"]);
    const legacy = vi.fn().mockResolvedValue(["bq"]);
    const env = {
      DUCKDB_ENABLED: "true",
      DUCKDB_SEARCH_ENABLED: "false",
      DUCKDB_EVENTS_ENABLED: "true",
    } as unknown as NodeJS.ProcessEnv;
    await expect(
      selectDuckDbOrLegacy({ env, capability: "search", duckdb, legacy }),
    ).resolves.toEqual(["bq"]);
    await expect(
      selectDuckDbOrLegacy({ env, capability: "events", duckdb, legacy }),
    ).resolves.toEqual(["duck"]);
    expect(duckdb).toHaveBeenCalledOnce();
  });

  it("lets the global cutback override an enabled capability", async () => {
    const duckdb = vi.fn().mockResolvedValue(["duck"]);
    const legacy = vi.fn().mockResolvedValue(["bq"]);
    await expect(
      selectDuckDbOrLegacy({
        env: {
          DUCKDB_ENABLED: "false",
          DUCKDB_SEARCH_ENABLED: "true",
        } as unknown as NodeJS.ProcessEnv,
        capability: "search",
        duckdb,
        legacy,
      }),
    ).resolves.toEqual(["bq"]);
    expect(duckdb).not.toHaveBeenCalled();
  });

  it("contains shadow errors and never changes the served result", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const duckdb = vi
      .fn()
      .mockRejectedValue(new Error("duck value must not log"));
    const legacy = vi.fn().mockResolvedValue([{ safe: "bq" }]);
    const env = {
      DUCKDB_ENABLED: "true",
      DUCKDB_SEARCH_ENABLED: "false",
      DUCKDB_SHADOW_ENABLED: "true",
      DUCKDB_SHADOW_SAMPLE_RATE: "1",
    } as unknown as NodeJS.ProcessEnv;
    await expect(
      selectDuckDbOrLegacy({ env, capability: "search", duckdb, legacy }),
    ).resolves.toEqual([{ safe: "bq" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(legacy).toHaveBeenCalledOnce();
    expect(duckdb).toHaveBeenCalledOnce();
    expect(info.mock.calls.join(" ")).not.toContain("duck value");
    info.mockRestore();
    vi.restoreAllMocks();
  });

  it("marks truncated shadow comparisons inconclusive", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const large = Array.from({ length: 20 }, (_, index) => ({ index }));
    const env = {
      DUCKDB_ENABLED: "true",
      DUCKDB_EVENTS_ENABLED: "false",
      DUCKDB_SHADOW_ENABLED: "true",
      DUCKDB_SHADOW_SAMPLE_RATE: "1",
    } as unknown as NodeJS.ProcessEnv;
    await expect(
      selectDuckDbOrLegacy({
        env,
        capability: "events",
        legacy: async () => large,
        duckdb: async () => large,
      }),
    ).resolves.toBe(large);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(info.mock.calls.join(" ")).toContain('"equal":false');
    expect(info.mock.calls.join(" ")).toContain('"inconclusive":true');
    vi.restoreAllMocks();
  });

  it("uses UTC and named bindings, normalizing nested values", async () => {
    const calls: unknown[][] = [];
    const adapter = new DuckDbQueryAdapter({
      acquire: async () =>
        lease(async (sql, params) => {
          calls.push([sql, params]);
          return sql.startsWith("SET")
            ? []
            : [
                {
                  value: 1n,
                  when: new Date("2020-01-01T00:00:00Z"),
                  nested: { empty: [], nil: null },
                },
              ];
        }),
    });
    await expect(
      adapter.execute("SELECT $name", { name: "x" }),
    ).resolves.toEqual([
      {
        value: 1,
        when: "2020-01-01T00:00:00.000Z",
        nested: { empty: [], nil: null },
      },
    ]);
    expect(calls).toEqual([
      ["SET TimeZone = 'UTC'", undefined],
      ["SELECT $name", { name: "x" }],
    ]);
  });

  it("releases the acquired lease after successful and failed queries", async () => {
    const release = vi.fn();
    const successful = new DuckDbQueryAdapter({
      acquire: async () => ({
        ...lease(async (sql) => (sql.startsWith("SET") ? [] : [{ ok: true }])),
        release,
      }),
    });
    await successful.execute("SELECT 1");
    expect(release).toHaveBeenCalledTimes(1);

    const failedRelease = vi.fn();
    const failed = new DuckDbQueryAdapter({
      acquire: async () => ({
        ...lease(async (sql) => {
          if (sql.startsWith("SET")) return [];
          throw new Error("query failed");
        }),
        release: failedRelease,
      }),
    });
    await expect(failed.execute("SELECT 1")).rejects.toBeInstanceOf(
      DuckDbQueryError,
    );
    expect(failedRelease).toHaveBeenCalledTimes(1);
  });

  it("does not fall back when DuckDB fails and types the error", async () => {
    const adapter = new DuckDbQueryAdapter({
      acquire: async () =>
        lease(async () => {
          throw new Error("syntax");
        }),
    });
    await expect(adapter.execute("bad")).rejects.toBeInstanceOf(
      DuckDbQueryError,
    );
    const legacy = vi.fn();
    await expect(
      selectDuckDbOrLegacy({
        env: { DUCKDB_ENABLED: "true" } as unknown as NodeJS.ProcessEnv,
        duckdb: () => adapter.execute("bad"),
        legacy,
      }),
    ).rejects.toBeInstanceOf(DuckDbQueryError);
    expect(legacy).not.toHaveBeenCalled();
  });

  it("types unavailable dependencies", async () => {
    const adapter = new DuckDbQueryAdapter({
      acquire: async () => {
        throw new DuckDbUnavailableError();
      },
    });
    await expect(adapter.execute("SELECT 1")).rejects.toMatchObject({
      code: "DUCKDB_DEPENDENCY",
    });
  });
});
