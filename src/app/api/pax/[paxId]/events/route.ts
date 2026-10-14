/**
 * PAX events API route.
 *
 * Responsibilities:
 * - Validate the pax id from the route param.
 * - Parse and normalize query-string filters.
 * - Delegate event fetching to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getEvents } from "@/lib/bq/pax";
import { getSessionUser } from "@/lib/auth/server";
import { parseFilterSearchParams } from "@/lib/filters";
import { DuckDbDependencyError } from "@/lib/duckdb/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ paxId?: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const rawId = params?.paxId;
  const paxId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(paxId) || paxId <= 0) {
    return NextResponse.json({ error: "Invalid pax id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);

  // Normalize query-string filters into a single options object.
  const opts = {
    ...parseFilterSearchParams(searchParams),
    limit: Number.isFinite(Number(searchParams.get("limit")))
      ? Number(searchParams.get("limit"))
      : undefined,
  };

  let events;
  try {
    events = await getEvents(paxId, user.email, opts);
  } catch (error) {
    if (error instanceof DuckDbDependencyError)
      return NextResponse.json(
        { error: "PAX event data is temporarily unavailable." },
        { status: 503 },
      );
    return NextResponse.json(
      { error: "PAX event lookup failed." },
      { status: 500 },
    );
  }

  if (!events) {
    return NextResponse.json({ error: "Pax not found" }, { status: 404 });
  }

  return NextResponse.json(events, { status: 200 });
}
