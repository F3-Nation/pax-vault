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

  const users = await searchUsersByName(q);

  return NextResponse.json(users, { status: 200 });
}
