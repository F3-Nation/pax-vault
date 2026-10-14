import { NextResponse } from "next/server";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { reportDuckDbRuntimeTelemetry } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Readiness probe for the optional DuckDB runtime. The first probe may perform
 * the runtime's normal lazy initialization; subsequent probes are read-only
 * apart from the runtime's permitted background refresh.
 */
export async function GET() {
  const startedAt = Date.now();
  const runtimeService = getDuckDbRuntime();
  const before = runtimeService.status();

  if (
    before.enabled &&
    (before.state === "unavailable" ||
      before.state === "refresh-failed" ||
      before.state === "stale")
  ) {
    try {
      // Explicitly await refresh rather than acquire(): acquire intentionally
      // preserves a stale LKG while a background refresh runs, which is not
      // sufficient for a readiness decision.
      await runtimeService.refresh();
    } catch {
      // Status below intentionally contains no exception details.
    }
  }

  const status = runtimeService.status();
  const ready = status.state === "disabled" || status.state === "ready";
  reportDuckDbRuntimeTelemetry({
    event: "duckdb_health",
    outcome: ready ? "success" : "failure",
    httpStatus: ready ? 200 : 503,
    queryLatencyMs: Date.now() - startedAt,
    releaseId: status.activeReleaseId,
    releaseSequence: status.activeReleaseSequence,
    generation: status.activePointerGeneration,
    leaseCount: status.leaseCount,
    waiterCount: status.refreshWaiterCount,
    lkgState: status.lkgState,
    rejectionCategory: status.lastRefreshRejectionCategory,
    error: !ready,
  });
  return NextResponse.json(
    { status: status.state, ready, duckdb: status },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
