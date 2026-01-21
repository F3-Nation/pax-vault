/**
 * AO upcoming events API route.
 *
 * Responsibilities:
 * - Validate the AO id from the route param.
 * - Delegate upcoming-event lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/bq/aos";

export async function GET(
  _req: Request,
  context: { params: Promise<{ aoId?: string }> },
) {
  const params = await context.params;
  const rawId = params?.aoId;
  const aoId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(aoId) || aoId <= 0) {
    return NextResponse.json({ error: "Invalid AO id" }, { status: 400 });
  }

  const upcomingEvents = await getUpcomingEvents(aoId);

  if (!upcomingEvents) {
    return NextResponse.json(
      { error: "No upcoming events found" },
      { status: 404 },
    );
  }

  return NextResponse.json(upcomingEvents, { status: 200 });
}
