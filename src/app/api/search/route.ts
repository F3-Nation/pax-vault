import { NextResponse } from "next/server";
import { searchAll } from "@/lib/bq/search";
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

  if (q.length < 2) {
    return NextResponse.json(
      { regions: [], aos: [], pax: [] },
      { status: 200 },
    );
  }

  try {
    const results = await searchAll(q, user.email, includeInactive);
    return NextResponse.json(results, { status: 200 });
  } catch (err) {
    console.error("Search failed:", err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}
