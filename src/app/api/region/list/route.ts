/****
 * Region list search API route.
 *
 * Responsibilities:
 * - Parse and validate the search query parameter.
 * - Guard against overly-broad searches.
 * - Delegate region search to the cache/query layer.
 */
import { NextResponse } from "next/server";
import { searchRegionsByName } from "@/lib/cache/regions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const q = rawQuery.trim();

  // Guardrail: do not allow overly-broad or empty searches.
  if (q.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  const regions = await searchRegionsByName(q);

  return NextResponse.json(regions, { status: 200 });
}
