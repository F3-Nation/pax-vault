export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.DUCKDB_ENABLED !== "true"
  ) {
    return;
  }

  const { getDuckDbRuntime } = await import("./lib/duckdb/factory");
  await getDuckDbRuntime().refresh();
}
