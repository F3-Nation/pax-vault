export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.DUCKDB_ENABLED !== "true"
  ) {
    return;
  }

  // Pre-warm so a healthy instance serves its first request from a loaded
  // release. A failure must not block boot: BigQuery-only pages still work, and
  // DuckDB reads retry through `acquire()`.
  try {
    const { getDuckDbRuntime } = await import("./lib/duckdb/factory");
    await getDuckDbRuntime().refresh();
  } catch (error) {
    const { reportError } = await import("./lib/observability");
    reportError(error, { scope: "instrumentation/duckdb-prewarm" });
  }
}
