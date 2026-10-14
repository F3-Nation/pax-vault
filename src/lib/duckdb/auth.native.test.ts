import { afterEach, describe, expect, it, vi } from "vitest";

const { queryBigQuery } = vi.hoisted(() => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import { isAuthorizedEmail } from "@/lib/auth/allowlist";
import { getPaxIdentityByEmail } from "@/lib/bq/pax";
import { getRegionPermission } from "@/lib/bq/permissions";
import { setDuckDbRuntimeForTests } from "./factory";
import type { DuckDbLease, DuckDbQueryConnection } from "./runtime";

describe("native DuckDB auth lookups", () => {
  afterEach(() => {
    setDuckDbRuntimeForTests(undefined);
    delete process.env.DUCKDB_ENABLED;
    delete process.env.DUCKDB_AUTH_ENABLED;
    delete process.env.AUTH_EMAIL_TABLE;
    vi.clearAllMocks();
  });

  it("runs allowlist, identity, and region permission against typed v2 roles", async () => {
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    await connection.run(`CREATE TABLE pv_pax (
      user_id INTEGER,
      email VARCHAR,
      home_region_id INTEGER,
      roles STRUCT(role_id INTEGER, role_name VARCHAR, org_id INTEGER, org_name VARCHAR, org_type VARCHAR)[]
    )`);
    await connection.run(`INSERT INTO pv_pax VALUES
      (2, 'same@example.com', 20, [{role_id: 1, role_name: 'member', org_id: 40364, org_name: 'Target', org_type: 'region'}]),
      (7, 'same@example.com', 70, [{role_id: 3, role_name: 'admin', org_id: 40364, org_name: 'Target', org_type: 'region'}]),
      (9, 'same@example.com', 90, [{role_id: 3, role_name: 'admin', org_id: 999, org_name: 'Other', org_type: 'region'}]),
      (11, 'nullroles@example.com', 110, NULL),
      (12, 'lower@example.com', 120, [])`);

    const nativeConnection: DuckDbQueryConnection = {
      query: async <T>(
        sql: string,
        params?: unknown[] | Record<string, unknown>,
      ) => {
        const reader = await connection.runAndReadAll(sql, params as never);
        await reader.readAll();
        return reader.getRowObjectsJS() as T[];
      },
      close: () => undefined,
    };
    const lease: DuckDbLease = {
      releaseId: "auth-native-fixture",
      releaseSequence: 1,
      release: () => undefined,
      withConnection: (fn) => fn(nativeConnection),
    };
    setDuckDbRuntimeForTests({
      acquire: async () => lease,
      refresh: async () => undefined,
      close: async () => undefined,
      status: () => ({
        enabled: true,
        state: "ready",
        lkgState: "ready",
        refreshFailureCount: 0,
      }),
    });
    process.env.DUCKDB_ENABLED = "true";
    process.env.DUCKDB_AUTH_ENABLED = "true";

    try {
      await expect(isAuthorizedEmail(" SAME@Example.com ")).resolves.toBe(true);
      await expect(
        getPaxIdentityByEmail(" SAME@Example.com "),
      ).resolves.toEqual({
        paxId: 2,
        homeRegionId: 20,
      });
      // Admin duplicate wins identity selection, but the selected id is the
      // lowest among admin matches; grants for another org do not count.
      await expect(
        getRegionPermission(" SAME@Example.com ", 40364),
      ).resolves.toEqual({
        userId: 7,
        isAdmin: true,
      });
      await expect(
        getRegionPermission(" SAME@Example.com ", 999),
      ).resolves.toEqual({
        userId: 9,
        isAdmin: true,
      });
      await expect(
        getRegionPermission(" NULLROLES@example.com ", 40364),
      ).resolves.toEqual({
        userId: 11,
        isAdmin: false,
      });
      expect(queryBigQuery).not.toHaveBeenCalled();
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });

  it("propagates DuckDB dependency failures without consulting BigQuery", async () => {
    setDuckDbRuntimeForTests({
      acquire: async () => {
        throw new Error("native dependency failure");
      },
      refresh: async () => undefined,
      close: async () => undefined,
      status: () => ({
        enabled: true,
        state: "unavailable",
        lkgState: "none",
        refreshFailureCount: 0,
      }),
    });
    process.env.DUCKDB_ENABLED = "true";
    process.env.DUCKDB_AUTH_ENABLED = "true";

    await expect(
      isAuthorizedEmail("allowed@example.com"),
    ).rejects.toMatchObject({
      code: "DUCKDB_QUERY",
    });
    expect(queryBigQuery).not.toHaveBeenCalled();
  });
});
