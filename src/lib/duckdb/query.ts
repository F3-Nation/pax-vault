import { DuckDbDependencyError, DuckDbQueryError } from "./errors";
import { DuckDbLease, DuckDbQueryConnection } from "./runtime";
import { assertDuckDbServerRuntime } from "./server";

export type DuckDbParams = unknown[] | Record<string, unknown>;
export interface DuckDbLeaseProvider {
  acquire(): Promise<DuckDbLease>;
}
export interface DuckDbQueryOptions {
  reason?: string;
}

export type DuckDbCapability =
  | "search"
  | "events"
  | "stats_pax"
  | "stats_region"
  | "stats_area"
  | "stats_sector"
  | "stats_ao";

const capabilityFlags: Record<DuckDbCapability, string> = {
  search: "DUCKDB_SEARCH_ENABLED",
  events: "DUCKDB_EVENTS_ENABLED",
  stats_pax: "DUCKDB_STATS_PAX_ENABLED",
  stats_region: "DUCKDB_STATS_REGION_ENABLED",
  stats_area: "DUCKDB_STATS_AREA_ENABLED",
  stats_sector: "DUCKDB_STATS_SECTOR_ENABLED",
  stats_ao: "DUCKDB_STATS_AO_ENABLED",
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
  ): Promise<T[]> {
    let lease: DuckDbLease | undefined;
    try {
      lease = await this.provider.acquire();
      return await lease.withConnection(
        async (connection: DuckDbQueryConnection) => {
          await connection.query("SET TimeZone = 'UTC'");
          return normalizeDuckDbRows<T>(await connection.query(sql, params));
        },
      );
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

function boundedParityValue(
  value: unknown,
  state: { truncated: boolean },
  depth = 0,
): unknown {
  if (depth > 3) {
    state.truncated = true;
    return "<truncated>";
  }
  if (depth > 3 || value === null || typeof value !== "object") {
    return typeof value === "bigint" ? String(value) : value;
  }
  if (Array.isArray(value)) {
    if (value.length > 16) state.truncated = true;
    return {
      length: value.length,
      items: value
        .slice(0, 16)
        .map((item) => boundedParityValue(item, state, depth + 1)),
    };
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 16);
  if (Object.keys(value as object).length > 16) state.truncated = true;
  return Object.fromEntries(
    entries.map(([key, item]) => [
      key,
      boundedParityValue(item, state, depth + 1),
    ]),
  );
}

function parityValue(value: unknown): { value: string; truncated: boolean } {
  const state = { truncated: false };
  try {
    return {
      value: JSON.stringify(boundedParityValue(value, state)) ?? "undefined",
      truncated: state.truncated,
    };
  } catch {
    return { value: "<unserializable>", truncated: true };
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
    const actual = parityValue(result);
    const expected = parityValue(served);
    console.info(
      JSON.stringify({
        app: "pax-vault",
        level: "info",
        metric: "duckdb_shadow_parity",
        capability: selection.capability ?? "global",
        equal:
          !actual.truncated &&
          !expected.truncated &&
          actual.value === expected.value,
        inconclusive: actual.truncated || expected.truncated,
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
    env.DUCKDB_ENABLED === "true" &&
    shadowEnabled(env) &&
    Math.random() < shadowRate(env)
  ) {
    void runShadow(selection, env, result);
  }
  return result;
}
