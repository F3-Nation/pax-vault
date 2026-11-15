/**
 * SSR boundary for an expected DuckDB dependency outage.
 *
 * A server component cannot change the response status once rendering has
 * started, so the page itself is still served as HTTP 200; the copy therefore
 * describes the outage without claiming a status code.
 */
export function DuckDbUnavailable() {
  return (
    <main
      role="alert"
      data-state="data-unavailable"
      className="min-h-screen flex items-center justify-center px-6 py-16 bg-gradient-to-b from-background to-default-50"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-default-200 bg-background/80 backdrop-blur p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Stats are temporarily unavailable
        </h1>
        <p className="mt-2 text-default-600">
          We couldn&apos;t load the stats data just now. Please try again in a
          few minutes.
        </p>
      </div>
    </main>
  );
}
