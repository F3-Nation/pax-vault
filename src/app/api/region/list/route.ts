/****
 * Region list search API route.
 *
 * Responsibilities:
 * - Parse and validate the search query parameter.
 * - Guard against overly-broad searches.
 * - Delegate region search to the BigQuery layer.
 */
import { NextResponse } from "next/server";
import { searchRegionsByName } from "@/lib/bq/regions";
import { getSessionUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const q = rawQuery.trim();

  // Guardrail: do not allow overly-broad or empty searches.
  if (q.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const regions = await searchRegionsByName(q);
    return NextResponse.json(regions, { status: 200 });
  } catch (err) {
    console.error("Region search failed:", err);
    return NextResponse.json([], { status: 200 });
  }
}
