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

/**
 * Parse a comma-separated query parameter into a finite number list.
 *
 * Invalid or non-numeric values are silently dropped.
 */
const parseNumberList = (
  key: string,
  searchParams: URLSearchParams,
): number[] | undefined => {
  const raw = searchParams.get(key);
  if (!raw) return undefined;
  return raw
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
};

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
    limit: Number.isFinite(Number(searchParams.get("limit")))
      ? Number(searchParams.get("limit"))
      : undefined,
    range: searchParams.get("range") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,

    aoIds: parseNumberList("aoIds", searchParams),
    aoMode: (searchParams.get("aoMode") as "include" | "exclude") || undefined,

    tagIds: parseNumberList("tagIds", searchParams),
    tagMode:
      (searchParams.get("tagMode") as "include" | "exclude") || undefined,

    typeIds: parseNumberList("typeIds", searchParams),
    typeMode:
      (searchParams.get("typeMode") as "include" | "exclude") || undefined,

    categoryIds: parseNumberList("categoryIds", searchParams),
    categoryMode:
      (searchParams.get("categoryMode") as "include" | "exclude") || undefined,
  };

  const events = await getEvents(aoId, opts);

  if (!events) {
    return NextResponse.json({ error: "AO not found" }, { status: 404 });
  }

  return NextResponse.json(events, { status: 200 });
}
