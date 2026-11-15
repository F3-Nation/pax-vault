import { createHash } from "node:crypto";
import {
  DuckDbDependencyError,
  DuckDbQueryError,
  DuckDbReleaseConflictError,
  DuckDbReleaseError,
} from "./errors";
import { DuckDbLease, DuckDbQueryConnection } from "./runtime";
import { assertDuckDbServerRuntime } from "./server";

export type DuckDbParams = unknown[] | Record<string, unknown>;
export interface DuckDbLeaseProvider {
  acquire(): Promise<DuckDbLease>;
}
export interface DuckDbQueryOptions {
  reason?: string;
  operation?: DuckDbQueryOperation;
}

/** Fixed low-cardinality labels safe for staging telemetry. */
export type DuckDbQueryOperation =
  | "region_info"
  | "region_events"
  | "region_upcoming"
  | "region_kotter"
  | "region_pax"
  | "region_career_attendance"
  | "region_leader_lifetime"
  | "region_leader_career";

export type DuckDbCapability =
  | "search"
  | "events"
  | "stats_pax"
  | "stats_region"
  | "stats_area"
  | "stats_sector"
  | "stats_ao"
  | "auth_allowlist"
  | "auth_identity"
  | "auth_region_permission";

const capabilityFlags: Record<DuckDbCapability, string> = {
  search: "DUCKDB_SEARCH_ENABLED",
  events: "DUCKDB_EVENTS_ENABLED",
  stats_pax: "DUCKDB_STATS_PAX_ENABLED",
  stats_region: "DUCKDB_STATS_REGION_ENABLED",
  stats_area: "DUCKDB_STATS_AREA_ENABLED",
  stats_sector: "DUCKDB_STATS_SECTOR_ENABLED",
  stats_ao: "DUCKDB_STATS_AO_ENABLED",
  auth_allowlist: "DUCKDB_AUTH_ENABLED",
  auth_identity: "DUCKDB_AUTH_ENABLED",
  auth_region_permission: "DUCKDB_AUTH_ENABLED",
};

/** Global false is an explicit cutback and always wins over capability flags. */
export function isDuckDbEnabled(
  env: NodeJS.ProcessEnv = process.env,
  capability?: DuckDbCapability,
): boolean {
  if (env.DUCKDB_ENABLED !== "true") return false;
  if (!capability) return true;
  const override = env[capabilityFlags[capability]];
  return override === undefined ? true : override === "true";
}

function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined)
    return value === undefined ? null : value;
  if (typeof value === "bigint")
    return value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : String(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Map)
    return Object.fromEntries(
      [...value.entries()].map(([k, v]) => [String(k), jsonSafe(v)]),
    );
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        jsonSafe(v),
      ]),
    );
  return value;
}

export function normalizeDuckDbRows<T = Record<string, unknown>>(
  rows: unknown[],
): T[] {
  return rows.map((row) => jsonSafe(row) as T);
}

export class DuckDbQueryAdapter {
  constructor(private readonly provider: DuckDbLeaseProvider) {
    assertDuckDbServerRuntime("DuckDbQueryAdapter");
  }

  async execute<T = Record<string, unknown>>(
    sql: string,
    params?: DuckDbParams,
    options?: DuckDbQueryOptions,
  ): Promise<T[]> {
    return (await this.executeWithRelease<T>(sql, params, options)).rows;
  }

  async executeWithRelease<T = Record<string, unknown>>(
    sql: string,
    params?: DuckDbParams,
    options?: DuckDbQueryOptions,
  ): Promise<{ rows: T[]; releaseId: string }> {
    const instrument = process.env.ENVIRONMENT === "staging";
    const startedAt = instrument ? performance.now() : 0;
    let acquireWaitMs: number | undefined;
    let timezoneMs: number | undefined;
    let queryMs: number | undefined;
    let normalizeMs: number | undefined;
    let withConnectionMs: number | undefined;
    let connectionStartedAt = 0;
    let outcome: "success" | "failure" = "failure";
    let rowCount: number | undefined;
    let lease: DuckDbLease | undefined;
    try {
      const acquireStartedAt = instrument ? performance.now() : 0;
      try {
        lease = await this.provider.acquire();
      } finally {
        if (instrument) acquireWaitMs = performance.now() - acquireStartedAt;
      }
      connectionStartedAt = instrument ? performance.now() : 0;
      const result = await lease.withConnection(
        async (connection: DuckDbQueryConnection) => {
          const timezoneStartedAt = instrument ? performance.now() : 0;
          try {
            await connection.query("SET TimeZone = 'UTC'");
          } finally {
            if (instrument) timezoneMs = performance.now() - timezoneStartedAt;
          }
          const queryStartedAt = instrument ? performance.now() : 0;
          let rows: unknown[];
          try {
            rows = await connection.query(sql, params);
            if (instrument) rowCount = rows.length;
          } finally {
            if (instrument) queryMs = performance.now() - queryStartedAt;
          }
          const normalizeStartedAt = instrument ? performance.now() : 0;
          try {
            return normalizeDuckDbRows<T>(rows);
          } finally {
            if (instrument)
              normalizeMs = performance.now() - normalizeStartedAt;
          }
        },
      );
      outcome = "success";
      return { rows: result, releaseId: lease.releaseId };
    } catch (cause) {
      if (
        cause instanceof DuckDbQueryError ||
        cause instanceof DuckDbDependencyError
      )
        throw cause;
      if (
        cause instanceof Error &&
        (cause as Error & { code?: string }).code === "DUCKDB_UNAVAILABLE"
      )
        throw new DuckDbDependencyError(undefined, { cause });
      throw new DuckDbQueryError(undefined, { cause });
    } finally {
      if (instrument && lease)
        withConnectionMs = performance.now() - connectionStartedAt;
      try {
        lease?.release();
      } finally {
        if (instrument) {
          console.info(
            JSON.stringify({
              app: "pax-vault",
              level: "info",
              metric: "duckdb_query_timing",
              operation: options?.operation,
              rowCount,
              acquireWaitMs,
              timezoneMs,
              queryMs,
              normalizeMs,
              withConnectionMs,
              totalMs: performance.now() - startedAt,
              outcome,
            }),
          );
        }
      }
    }
  }

  async executeDetailsForRelease<T = Record<string, unknown>>(
    sqlForDataset: (dataset: DuckDbLease["detailsDataset"]) => string,
    params: DuckDbParams,
    expectedReleaseId: string,
  ): Promise<T[]> {
    let lease: DuckDbLease | undefined;
    try {
      lease = await this.provider.acquire();
      if (lease.releaseId !== expectedReleaseId)
        throw new DuckDbReleaseConflictError();
      const sql = sqlForDataset(lease.detailsDataset);
      return await lease.withDetailsConnection(async (connection) => {
        await connection.query("SET TimeZone = 'UTC'");
        const rows = await connection.query(sql, params);
        return normalizeDuckDbRows<T>(rows);
      });
    } catch (cause) {
      if (
        cause instanceof DuckDbQueryError ||
        cause instanceof DuckDbDependencyError ||
        cause instanceof DuckDbReleaseConflictError
      )
        throw cause;
      if (cause instanceof DuckDbReleaseError)
        throw new DuckDbDependencyError(undefined, { cause });
      if (
        cause instanceof Error &&
        (cause as Error & { code?: string }).code === "DUCKDB_UNAVAILABLE"
      )
        throw new DuckDbDependencyError(undefined, { cause });
      throw new DuckDbQueryError(undefined, { cause });
    } finally {
      lease?.release();
    }
  }
}

export interface BackendSelection<T> {
  duckdb: () => Promise<T>;
  legacy: () => Promise<T>;
  capability?: DuckDbCapability;
  env?: NodeJS.ProcessEnv;
}

function shadowEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.DUCKDB_SHADOW_ENABLED === "true";
}

function shadowRate(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DUCKDB_SHADOW_SAMPLE_RATE ?? "0");
  return Number.isFinite(parsed) ? Math.max(0, Math.min(0.1, parsed)) : 0;
}

function shadowTimeoutMs(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DUCKDB_SHADOW_TIMEOUT_MS ?? "500");
  return Number.isFinite(parsed) ? Math.max(1, Math.min(1000, parsed)) : 500;
}

const shadowSlots = { active: 0 };
const SHADOW_MAX_CONCURRENCY = 2;

/** Fields only the DuckDB path adds; they can never match BigQuery. */
const RELEASE_ONLY_PARITY_KEYS = new Set(["eventReleaseId"]);

function canonicalParityValue(value: unknown): unknown {
  if (typeof value === "bigint") return String(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalParityValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, item]) =>
          item !== undefined && !RELEASE_ONLY_PARITY_KEYS.has(key),
      )
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, canonicalParityValue(item)]),
  );
}

/**
 * Digest of the whole normalized value. Hashing keeps the comparison complete
 * for page-sized payloads without retaining or logging any row content.
 */
export function shadowParityDigest(value: unknown): string | undefined {
  try {
    return createHash("sha256")
      .update(JSON.stringify(canonicalParityValue(value)) ?? "undefined")
      .digest("hex");
  } catch {
    return undefined;
  }
}

async function runShadow<T>(
  selection: BackendSelection<T>,
  env: NodeJS.ProcessEnv,
  served: T,
): Promise<void> {
  if (shadowSlots.active >= SHADOW_MAX_CONCURRENCY) return;
  shadowSlots.active += 1;
  let work: Promise<T> | undefined;
  try {
    work = selection.duckdb();
    const result = await Promise.race([
      work,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("shadow_timeout")),
          shadowTimeoutMs(env),
        ),
      ),
    ]);
    // Only the boolean result is emitted. Never log query parameters or rows.
    const actual = shadowParityDigest(result);
    const expected = shadowParityDigest(served);
    const inconclusive = actual === undefined || expected === undefined;
    console.info(
      JSON.stringify({
        app: "pax-vault",
        level: "info",
        metric: "duckdb_shadow_parity",
        capability: selection.capability ?? "global",
        equal: !inconclusive && actual === expected,
        inconclusive,
      }),
    );
  } catch {
    // A timeout only bounds waiting. Keep the slot until the native query has
    // actually settled so concurrent shadow work cannot grow without bound.
    await work?.catch(() => undefined);
    console.info(
      JSON.stringify({
        app: "pax-vault",
        level: "info",
        metric: "duckdb_shadow_parity",
        capability: selection.capability ?? "global",
        outcome: "error",
      }),
    );
  } finally {
    shadowSlots.active -= 1;
  }
}

export async function selectDuckDbOrLegacy<T>(
  selection: BackendSelection<T>,
): Promise<T> {
  assertDuckDbServerRuntime("selectDuckDbOrLegacy");
  const env = selection.env ?? process.env;
  if (isDuckDbEnabled(env, selection.capability)) {
    return selection.duckdb();
  }
  const result = await selection.legacy();
  // Shadow is a pre-enable comparison: BigQuery remains the served response.
  if (
    !selection.capability?.startsWith("auth_") &&
    env.DUCKDB_ENABLED === "true" &&
    shadowEnabled(env) &&
    Math.random() < shadowRate(env)
  ) {
    void runShadow(selection, env, result);
  }
  return result;
}
