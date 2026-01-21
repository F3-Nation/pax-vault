/**
 * PAX info API route.
 *
 * Responsibilities:
 * - Validate the PAX id from the route param.
 * - Delegate PAX metadata lookup to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getPAXInfo } from "@/lib/bq/pax";

export async function GET(
  _: Request,
  context: { params: Promise<{ paxId?: string }> },
) {
  const params = await context.params;
  const rawId = params?.paxId;
  const paxId = Number(rawId);

  // Reject missing, non-numeric, or non-positive ids.
  if (!rawId || !Number.isFinite(paxId) || paxId <= 0) {
    return NextResponse.json({ error: "Invalid pax id" }, { status: 400 });
  }

  const info = await getPAXInfo(paxId);

  if (!info) {
    return NextResponse.json({ error: "Pax not found" }, { status: 404 });
  }

  return NextResponse.json(info, { status: 200 });
}
