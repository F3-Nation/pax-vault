import { NextResponse } from "next/server";
import { isAuthorizedEmail } from "@/lib/auth/allowlist";

export async function POST(request: Request) {
  let email: string | undefined;

  try {
    const body = (await request.json()) as { email?: string };
    email = body.email;
  } catch (_err) {
    email = undefined;
    console.error("Failed to parse request body", _err);
  }

  const normalized = email?.trim();
  if (!normalized) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  try {
    const allowed = await isAuthorizedEmail(normalized);
    if (!allowed) {
      return NextResponse.json(
        { error: "Email does not match a PAX member." },
        { status: 404 },
      );
    }

    return NextResponse.json({ allowed: true }, { status: 200 });
  } catch (err) {
    console.error("Auth email check failed", err);
    return NextResponse.json(
      { error: "Unable to validate email" },
      { status: 500 },
    );
  }
}
