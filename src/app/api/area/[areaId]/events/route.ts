/**
 * Area events API route.
 *
 * Responsibilities:
 * - Validate the area id from the route param.
 * - Parse and normalize query-string date filters.
 * - Delegate data fetching to the BigQuery layer.
 * - Translate invalid input and not-found states into HTTP responses.
 */
import { NextResponse } from "next/server";
import { getPageData } from "@/lib/bq/areas";
import { getSessionUser } from "@/lib/auth/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ areaId?: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const rawId = params?.areaId;
  const areaId = Number(rawId);

  if (!rawId || !Number.isFinite(areaId) || areaId <= 0) {
    return NextResponse.json({ error: "Invalid area id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);

  const opts = {
    range: searchParams.get("range") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  };

  const data = await getPageData(areaId, user.email, opts);

  if (!data.info) {
    return NextResponse.json({ error: "Area not found" }, { status: 404 });
  }

  return NextResponse.json(data, { status: 200 });
}
