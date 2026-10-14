import { DuckDbConfigError } from "./errors";

export interface DuckDbConfig {
  enabled: boolean;
  bucket: string;
  prefix: string;
  controlObject: string;
  cacheDir: string;
  refreshTtlMs: number;
  maxLkgAgeMs: number;
  memoryLimit: string;
  maxReleaseBytes: number;
  maxObjectBytes: number;
}

function positive(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new DuckDbConfigError(`${name} must be a positive number`);
  return n;
}

export function readDuckDbConfig(
  env: NodeJS.ProcessEnv = process.env,
): DuckDbConfig {
  const enabled = env.DUCKDB_ENABLED === "true";
  const bucket = env.DUCKDB_GCS_BUCKET?.trim() ?? "";
  if (enabled && !/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new DuckDbConfigError(
      "DUCKDB_GCS_BUCKET is required and must be a valid bucket name",
    );
  }
  const prefix = (env.DUCKDB_GCS_PREFIX ?? "releases")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const controlObject = (
    env.DUCKDB_GCS_CONTROL_OBJECT ?? "current.json"
  ).trim();
  if (
    !prefix ||
    !controlObject ||
    prefix.includes("..") ||
    controlObject.includes("..")
  ) {
    throw new DuckDbConfigError(
      "DuckDB GCS prefix and control object must be safe relative paths",
    );
  }
  return {
    enabled,
    bucket,
    prefix,
    controlObject,
    cacheDir: env.DUCKDB_CACHE_DIR?.trim() || "/tmp/pax-vault-duckdb",
    refreshTtlMs: positive(
      "DUCKDB_REFRESH_TTL_MS",
      env.DUCKDB_REFRESH_TTL_MS,
      300_000,
    ),
    maxLkgAgeMs: positive(
      "DUCKDB_MAX_LKG_AGE_MS",
      env.DUCKDB_MAX_LKG_AGE_MS,
      3_600_000,
    ),
    memoryLimit: env.DUCKDB_MEMORY_LIMIT?.trim() || "384MB",
    maxReleaseBytes: positive(
      "DUCKDB_MAX_RELEASE_BYTES",
      env.DUCKDB_MAX_RELEASE_BYTES,
      512 * 1024 * 1024,
    ),
    maxObjectBytes: positive(
      "DUCKDB_MAX_OBJECT_BYTES",
      env.DUCKDB_MAX_OBJECT_BYTES,
      384 * 1024 * 1024,
    ),
  };
}
