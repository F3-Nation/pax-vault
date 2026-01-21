/**
 * Region info API route.
 *
 * Responsibilities:
 * - Validate the region id from the route param.
 * - Delegate region metadata lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getRegionInfo } from "@/lib/bq/regions";

export async function GET(
  _: Request,
  context: { params: Promise<{ regionId?: string }> },
) {
  const params = await context.params;
  const rawId = params?.regionId;
  const regionId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(regionId) || regionId <= 0) {
    return NextResponse.json({ error: "Invalid region id" }, { status: 400 });
  }

  const info = await getRegionInfo(regionId);

  if (!info) {
    return NextResponse.json({ error: "Region not found" }, { status: 404 });
  }

  return NextResponse.json(info, { status: 200 });
}
