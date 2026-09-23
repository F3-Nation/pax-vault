/** SSR boundary for an expected DuckDB dependency outage. */
export function DuckDbUnavailable() {
  return (
    <main role="alert" data-status="503">
      <h1>503 — Data temporarily unavailable</h1>
      <p>
        The stats data service is temporarily unavailable. Please try again
        later.
      </p>
    </main>
  );
}
