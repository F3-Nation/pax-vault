/**
 * Shared client-side sign-in helpers.
 *
 * Both the landing hero CTA and the AuthCard kick off the same OAuth flow, so
 * the redirect validation and login-URL construction live here.
 */

/**
 * Only allow same-origin, absolute-path redirects.
 *
 * Rejects anything that isn't a plain "/path" (in particular protocol-relative
 * "//evil.com" URLs, which a browser would treat as cross-origin).
 */
export function normalizeRedirect(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
}

/**
 * Navigate to the OAuth login route, preserving where the user was headed.
 *
 * Browser-only — reads `window.location`.
 */
export function startSignIn(redirectTo: string | null): void {
  const loginUrl = new URL("/api/auth/login", window.location.origin);
  if (redirectTo) {
    loginUrl.searchParams.set("returnTo", redirectTo);
  }
  window.location.href = loginUrl.toString();
}
