/****
 * AO list search API route.
 *
 * Responsibilities:
 * - Parse and validate the search query parameter.
 * - Guard against overly-broad searches.
 * - Delegate AO search to the BigQuery layer.
 */
import { NextResponse } from "next/server";
import { searchAOsByName } from "@/lib/bq/aos";
import { getSessionUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const q = rawQuery.trim();
  const includeInactive = searchParams.get("includeInactive") === "true";

  // Guardrail: do not allow overly-broad or empty searches.
  if (q.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const aos = await searchAOsByName(q, user.email, includeInactive);
    return NextResponse.json(aos, { status: 200 });
  } catch (err) {
    console.error("AO search failed:", err);
    return NextResponse.json(
      { error: "AO search failed. Please try again." },
      { status: 500 },
    );
  }
}
