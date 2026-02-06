// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function getClientIp(req: NextRequest): string | null {
  // Cloud Run usually forwards client IP via x-forwarded-for
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  // Some platforms provide this (not always)
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // CORS preflight for OAuth callback (auth provider redirect)
  if (pathname === "/api/auth/callback" && req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.AUTH_PROVIDER_URL || "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-");

  if (isPublicPath) return NextResponse.next();

  // Only guard expensive surfaces
  const isApiRoute = pathname.startsWith("/api/");

  const isExpensive =
    pathname.startsWith("/api/pax/") ||
    pathname.startsWith("/api/events/") ||
    pathname.startsWith("/api/ao/") ||
    pathname.startsWith("/api/region/") ||
    pathname.startsWith("/stats/");

  if (!isExpensive) return NextResponse.next();

  const ua = req.headers.get("user-agent") || "";
  const ip = getClientIp(req) || "";

  const looksLikeFetcher = ua === "Google" || ua.startsWith("Google ");
  const looksLikeGoogleIp = ip && inCidr(ip, "192.178.0.0/15");

  if (looksLikeFetcher && looksLikeGoogleIp) {
    // Keep it cheap. Pick one:
    // 1) 403 stops it from being treated as a valid response
    // 2) 404 can make it “go away” faster for some fetchers
    return new NextResponse("Forbidden", { status: 403 });
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    if (isApiRoute) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    const redirectPath = `${pathname}${req.nextUrl.search}`;
    redirectUrl.searchParams.set("redirect", redirectPath);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

// Limit middleware execution to the routes you care about
export const config = {
  matcher: ["/:path*"],
};
