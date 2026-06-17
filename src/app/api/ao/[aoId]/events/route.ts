/**
 * AO events API route.
 *
 * Responsibilities:
 * - Validate the AO id from the route param.
 * - Parse and normalize query-string filters.
 * - Delegate event fetching to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getEvents } from "@/lib/bq/aos";
import { getSessionUser } from "@/lib/auth/server";
import { parseFilterSearchParams } from "@/lib/filters";

export async function GET(
  request: Request,
  context: { params: Promise<{ aoId?: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const rawId = params?.aoId;
  const aoId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(aoId) || aoId <= 0) {
    return NextResponse.json({ error: "Invalid AO id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);

  // Normalize query-string filters into a single options object.
  const opts = {
    ...parseFilterSearchParams(searchParams),
    limit: Number.isFinite(Number(searchParams.get("limit")))
      ? Number(searchParams.get("limit"))
      : undefined,
  };

  const events = await getEvents(aoId, user?.email, opts);

  if (!events) {
    return NextResponse.json({ error: "AO not found" }, { status: 404 });
  }

  return NextResponse.json(events, { status: 200 });
}
