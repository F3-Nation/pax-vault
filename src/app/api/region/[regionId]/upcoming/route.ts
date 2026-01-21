/**
 * Region upcoming events API route.
 *
 * Responsibilities:
 * - Validate the region id from the route param.
 * - Delegate upcoming-event lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/bq/regions";

export async function GET(
  _req: Request,
  context: { params: Promise<{ regionId?: string }> },
) {
  const params = await context.params;
  const rawId = params?.regionId;
  const regionId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(regionId) || regionId <= 0) {
    return NextResponse.json({ error: "Invalid region id" }, { status: 400 });
  }

  const upcomingEvents = await getUpcomingEvents(regionId);

  if (!upcomingEvents) {
    return NextResponse.json(
      { error: "No upcoming events found" },
      { status: 404 },
    );
  }

  return NextResponse.json(upcomingEvents, { status: 200 });
}
