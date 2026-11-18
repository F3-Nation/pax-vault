import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { reportDuckDbRuntimeTelemetry } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function authorized(req: Request, token: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  // Compare fixed-length digests so neither length nor content leaks timing.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return (
    presented.length > 0 && timingSafeEqual(digest(presented), digest(token))
  );
}

/**
 * Scheduled refresh-and-warm hook, called by Cloud Scheduler.
 *
 * Cloud Run (request-based billing) throttles CPU outside requests, so the
 * runtime's background refresh can take minutes to download a new release.
 * Awaiting the refresh inside this request keeps CPU allocated until the
 * download, validation and open finish. If a throttled background refresh is
 * already in flight, `refresh()` joins it, and this request speeds it up.
 *
 * The request then opens the deferred event-details sidecar, so the first
 * user to open an event on this release doesn't wait for that download.
 *
 * Cloud Run routes each call to one instance; with `minInstances: 1` that is
 * usually the long-lived instance. Scale-out instances still refresh in the
 * background.
 *
 * Disabled (404) unless DUCKDB_REFRESH_TOKEN is set; requires
 * `Authorization: Bearer <token>`.
 */
export async function POST(req: Request) {
  const token = process.env.DUCKDB_REFRESH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: NO_STORE },
    );
  }
  if (!authorized(req, token)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const startedAt = Date.now();
  const runtimeService = getDuckDbRuntime();
  if (!runtimeService.status().enabled) {
    return NextResponse.json(
      { status: "disabled" },
      { status: 200, headers: NO_STORE },
    );
  }

  let stage: "refresh" | "details" = "refresh";
  let detailsWarmed = false;
  try {
    await runtimeService.refresh();
    stage = "details";
    const lease = await runtimeService.acquire();
    try {
      if (lease.detailsDataset === "pv_event_details") {
        await lease.withDetailsConnection((connection) =>
          connection.query("SELECT 1"),
        );
        detailsWarmed = true;
      }
    } finally {
      lease.release();
    }
  } catch {
    // Exception details stay out of the response and telemetry; the runtime
    // already records refresh failures with a safe rejection category.
    return respond(503, stage, detailsWarmed);
  }
  return respond(200, undefined, detailsWarmed);

  function respond(
    httpStatus: number,
    failedStage: string | undefined,
    warmed: boolean,
  ) {
    const status = runtimeService.status();
    reportDuckDbRuntimeTelemetry({
      event: "duckdb_scheduled_refresh",
      outcome: httpStatus === 200 ? "success" : "failure",
      httpStatus,
      queryLatencyMs: Date.now() - startedAt,
      releaseId: status.activeReleaseId,
      releaseSequence: status.activeReleaseSequence,
      generation: status.activePointerGeneration,
      lkgState: status.lkgState,
      rejectionCategory: failedStage,
      error: httpStatus !== 200,
    });
    return NextResponse.json(
      {
        status: status.state,
        releaseSequence: status.activeReleaseSequence,
        detailsWarmed: warmed,
        ...(failedStage ? { failedStage } : {}),
      },
      { status: httpStatus, headers: NO_STORE },
    );
  }
}
