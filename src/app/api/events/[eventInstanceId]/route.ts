/**
 * Event Details API Route
 *
 * Responsibilities:
 * - Validate and normalize the `eventInstanceId` route parameter.
 * - Delegate data access to the BigQuery events layer.
 * - Translate domain outcomes into clear HTTP responses.
 *
 * This route is intentionally thin and side-effect free.
 */
import { NextResponse } from "next/server";
import { getEventDetails } from "@/lib/bq/events";

export async function GET(
  _req: Request,
  context: { params: Promise<{ eventInstanceId?: string }> },
): Promise<NextResponse> {
  const { eventInstanceId: rawEventId } = await context.params;

  // Route params arrive as strings; normalize to a finite integer.
  const eventId = Number(rawEventId);

  // Reject missing, non-numeric, or non-positive ids early to avoid
  // unnecessary BigQuery calls and ambiguous downstream errors.
  if (!rawEventId || !Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  // Fetch event details from the BigQuery data layer.
  const event = await getEventDetails(eventId);

  // Valid id, but no matching event exists.
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event, { status: 200 });
}
