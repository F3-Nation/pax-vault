/**
 * AO filters API route.
 *
 * Responsibilities:
 * - Validate the AO id from the route param.
 * - Delegate filter lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getFilters } from "@/lib/bq/aos";

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

  const filters = await getFilters(aoId);

  if (!filters) {
    return NextResponse.json(
      { error: "AO filters not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(filters, { status: 200 });
}
