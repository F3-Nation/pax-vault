/**
 * PAX filters API route.
 *
 * Responsibilities:
 * - Validate the pax id from the route param.
 * - Delegate filter lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getFilters } from "@/lib/bq/pax";

export async function GET(
  _req: Request,
  context: { params: Promise<{ paxId?: string }> },
) {
  const params = await context.params;
  const rawId = params?.paxId;
  const paxId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(paxId) || paxId <= 0) {
    return NextResponse.json({ error: "Invalid pax id" }, { status: 400 });
  }

  const filters = await getFilters(paxId);

  if (!filters) {
    return NextResponse.json({ error: "Filters not found" }, { status: 404 });
  }

  return NextResponse.json(filters, { status: 200 });
}
