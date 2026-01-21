/**
 * AO info API route.
 *
 * Responsibilities:
 * - Validate the AO id from the route param.
 * - Delegate AO metadata lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getAOInfo } from "@/lib/bq/aos";

export async function GET(
  _: Request,
  context: { params: Promise<{ aoId?: string }> },
) {
  const params = await context.params;
  const rawId = params?.aoId;
  const aoId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(aoId) || aoId <= 0) {
    return NextResponse.json({ error: "Invalid AO id" }, { status: 400 });
  }

  const info = await getAOInfo(aoId);

  if (!info) {
    return NextResponse.json({ error: "AO not found" }, { status: 404 });
  }

  return NextResponse.json(info, { status: 200 });
}
