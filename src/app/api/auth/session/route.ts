import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth/session";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { getAdminAuth } from "@/lib/firebase/admin";
import { isAuthorizedEmail } from "@/lib/auth/allowlist";

export async function POST(request: Request) {
  let idToken: string | undefined;

  try {
    const body = (await request.json()) as { idToken?: string };
    idToken = body.idToken;
  } catch (_err) {
    idToken = undefined;
    console.error("Failed to parse request body", _err);
  }

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let decoded: { email?: string } | null = null;
  const adminAuth = getAdminAuth();

  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    console.error("Failed to verify ID token", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = decoded?.email;
  if (!email) {
    return NextResponse.json(
      { error: "Email not available on token" },
      { status: 400 },
    );
  }

  try {
    const allowed = await isAuthorizedEmail(email);
    if (!allowed) {
      return NextResponse.json(
        { error: "Email does not match a PAX member." },
        { status: 403 },
      );
    }
  } catch (err) {
    console.error("Failed to validate email allowlist", err);
    return NextResponse.json(
      { error: "Unable to validate email" },
      { status: 500 },
    );
  }

  try {
    const sessionCookie = await createSessionCookie(idToken);
    const response = NextResponse.json({ status: "ok" });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error("Failed to create session cookie", err);
    return NextResponse.json(
      { error: "Unable to create session" },
      { status: 500 },
    );
  }
}
