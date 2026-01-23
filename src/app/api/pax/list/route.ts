/****
 * User list search API route.
 *
 * Responsibilities:
 * - Parse and validate the search query parameter.
 * - Guard against overly-broad searches.
 * - Delegate user search to the BigQuery layer.
 */
import { NextResponse } from "next/server";
import { searchUsersByName } from "@/lib/bq/pax";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const q = rawQuery.trim();

  // Guardrail: do not allow overly-broad or empty searches.
  if (q.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  const users = await searchUsersByName(q);

  return NextResponse.json(users, { status: 200 });
}
