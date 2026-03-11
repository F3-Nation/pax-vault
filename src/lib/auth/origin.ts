import type { NextRequest } from "next/server";

/**
 * Set of allowed public origins, populated from ALLOWED_PUBLIC_ORIGINS env var
 * (comma-separated list, e.g. "https://example.com,https://staging.example.com").
 * When empty, the allowlist check is skipped and the derived origin is used as-is.
 */
const ALLOWED_PUBLIC_ORIGINS = new Set(
  (process.env.ALLOWED_PUBLIC_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => {
      if (origin.length === 0) return false;
      if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
        console.warn(
          `[origin] ALLOWED_PUBLIC_ORIGINS entry "${origin}" is not a valid URL (must start with http:// or https://) — skipping`,
        );
        return false;
      }
      return true;
    }),
);

/**
 * Derive the public origin from forwarded headers (Cloud Run / Firebase).
 *
 * Handles comma-separated header values (multiple proxies) by taking the
 * first entry. When ALLOWED_PUBLIC_ORIGINS is set, the derived origin is
 * validated against the allowlist to prevent header-spoofing attacks.
 */
export function getPublicOrigin(request: NextRequest): string {
  const rawProto = request.headers.get("x-forwarded-proto");
  const rawHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  const proto = rawProto ? rawProto.split(",")[0].trim() : "https";
  const host = rawHost ? rawHost.split(",")[0].trim() : null;

  if (host) {
    const originFromForwarded = `${proto}://${host}`;
    if (ALLOWED_PUBLIC_ORIGINS.size === 0) {
      return originFromForwarded;
    }
    if (ALLOWED_PUBLIC_ORIGINS.has(originFromForwarded)) {
      return originFromForwarded;
    }
    console.warn(
      `[origin] Derived origin "${originFromForwarded}" is not in ALLOWED_PUBLIC_ORIGINS — falling back to nextUrl.origin`,
    );
  }

  return request.nextUrl.origin;
}
