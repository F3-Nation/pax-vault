/**
 * Provider-agnostic error-reporting seam.
 *
 * Today this emits a single structured JSON log line (consistent with the
 * BigQuery logs in `db.ts`) and returns a stable error id that can be shown to
 * users for support correlation. When an error-tracking provider is adopted
 * (e.g. Sentry), forward from the single TODO hook below — call sites do not
 * need to change.
 *
 * Kept free of server-only imports so it is safe to use in both server code
 * (API routes, loaders) and client components (the error boundary).
 */

/**
 * Generate a short, stable-ish id for an error instance. Useful for support
 * screenshots and for correlating a user-visible id with server logs, without
 * exposing stack traces.
 */
export function makeErrorId(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  const src = `${name}:${message}`;
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    hash = (hash * 31 + src.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export type ErrorContext = {
  /** Where the error occurred, e.g. "api/region/list" or "client/error-boundary". */
  scope?: string;
  /** Caller-supplied identifier (e.g. obfuscated email) for correlation. */
  user?: string;
  /** Reuse an already-computed id so logs and UI agree. */
  errorId?: string;
  /** Any additional structured context to attach. */
  extra?: Record<string, unknown>;
};

function hashIdentifier(value: string): string {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeExtra(
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!extra) return {};
  const allowed = new Set([
    "regionId",
    "areaId",
    "sectorId",
    "paxId",
    "eventInstanceId",
    "event",
    "outcome",
    "rejectionCategory",
    "refreshFailureCount",
  ]);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (!allowed.has(key)) continue;
    result[key] =
      /id$/i.test(key) && typeof value === "string"
        ? hashIdentifier(value)
        : value;
  }
  return result;
}

/**
 * Report an error and return its id. Single choke point for error tracking.
 */
export function reportError(
  error: unknown,
  context: ErrorContext = {},
): string {
  const errorId = context.errorId ?? makeErrorId(error);
  const isError = error instanceof Error;
  const message = isError ? error.message : String(error);

  console.error(
    JSON.stringify({
      app: "pax-vault",
      level: "error",
      errorId,
      scope: context.scope ?? "unknown",
      userHash: context.user ? hashIdentifier(context.user) : undefined,
      name: isError ? error.name : "Error",
      message: message.replace(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        "[redacted-user]",
      ),
      context: safeExtra(context.extra),
    }),
  );

  // TODO(P0-3): when an error-tracking provider is configured, forward here.
  // e.g. Sentry.captureException(error, { tags: { scope }, user: { id: user } });

  return errorId;
}

/** Structured, deliberately non-sensitive runtime telemetry. */
export type DuckDbRuntimeTelemetry = {
  event: "duckdb_refresh" | "duckdb_cleanup" | "duckdb_health";
  outcome: "success" | "failure";
  releaseId?: string;
  generation?: string;
  pointerAgeMs?: number;
  refreshFailureCount?: number;
  lkgState?: "none" | "ready" | "stale";
  refreshDurationMs?: number;
  stageDurationsMs?: Record<string, number>;
  releaseSequence?: number;
  leaseCount?: number;
  waiterCount?: number;
  rejectionCategory?: string;
  httpStatus?: number;
  queryLatencyMs?: number;
  error?: boolean;
};

export function reportDuckDbRuntimeTelemetry(
  telemetry: DuckDbRuntimeTelemetry,
): void {
  // Do not attach the exception or arbitrary error context here: repository
  // errors can contain object names, paths, or credentials.
  console.info(
    JSON.stringify({
      app: "pax-vault",
      level: "info",
      metric: "duckdb_runtime",
      ...telemetry,
    }),
  );
}
