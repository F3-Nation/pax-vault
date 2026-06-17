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

/**
 * Report an error and return its id. Single choke point for error tracking.
 */
export function reportError(
  error: unknown,
  context: ErrorContext = {},
): string {
  const errorId = context.errorId ?? makeErrorId(error);
  const isError = error instanceof Error;

  console.error(
    JSON.stringify({
      app: "pax-vault",
      level: "error",
      errorId,
      scope: context.scope ?? "unknown",
      user: context.user,
      name: isError ? error.name : "Error",
      message: isError ? error.message : String(error),
      stack: isError ? error.stack : undefined,
      ...context.extra,
    }),
  );

  // TODO(P0-3): when an error-tracking provider is configured, forward here.
  // e.g. Sentry.captureException(error, { tags: { scope }, user: { id: user } });

  return errorId;
}
