# PAX-VAULT AUTH

OAuth 2.0 authentication via f3-nation-auth, with HMAC-signed session cookies and a BigQuery email allowlist.

## Overview

Pax-vault does **not** run its own auth provider. It delegates authentication to `f3-nation-auth` (the central F3 Nation OAuth server at `https://auth.f3nation.com`) and manages its own session cookies locally.

## Auth Flow

```
User clicks "Sign in" → router.push("/#signin") → landing page "Sign in with F3 Nation" button →
  GET /api/auth/login?returnTo=/stats/nation →
  Sets oauth_csrf + oauth_code_verifier cookies →
  Redirect to AUTH_PROVIDER_URL/api/oauth/authorize (PKCE S256) →
  User authenticates on auth.f3nation.com (email → 6-digit code) →
  Redirect back to OAUTH_REDIRECT_URI (/api/auth/callback?code=...&state=...) →
  Validate CSRF + state timestamp (10 min) →
  Exchange code for access token (POST /api/oauth/token with code_verifier) →
  Fetch user info (GET /api/oauth/userinfo with Bearer token) →
  Check email against BigQuery allowlist (lib/auth/allowlist.ts) →
  Create HMAC-signed __session cookie (10-day TTL) →
  Redirect to returnTo path
```

## Session

- Cookie: `__session`, HMAC-signed with `SESSION_SECRET`, base64url-encoded JSON payload
- Payload: `{ sub, email, name, iat }`
- TTL: 10 days (`SESSION_COOKIE_DAYS` in `lib/auth/constants.ts`)
- Verification: `verifySessionValue()` checks HMAC signature + expiry via timing-safe comparison
- Server-side: `getSessionUser()` reads cookie, returns `SessionPayload | null`
- Server-side: `requireAuth()` calls `getSessionUser()`, redirects to `/` if null
- Client-side: `AuthProvider` calls `GET /api/auth/me` on mount, sets `user` state

## OAuth Env Vars

| Var                   | Local (`.env.local`)                       | Prod (`.env.firebase.production`)                  |
| --------------------- | ------------------------------------------ | -------------------------------------------------- |
| `OAUTH_CLIENT_ID`     | `local-client`                             | `pax-vault-prod`                                   |
| `OAUTH_CLIENT_SECRET` | (local-client secret)                      | (pax-vault-prod secret)                            |
| `OAUTH_REDIRECT_URI`  | `https://localhost:3001/api/auth/callback` | `https://pax-vault.f3nation.com/api/auth/callback` |
| `AUTH_PROVIDER_URL`   | `https://auth.f3nation.com`                | `https://auth.f3nation.com`                        |
| `SESSION_SECRET`      | (local secret)                             | (prod secret)                                      |

Both local and prod use the **same auth provider** (`https://auth.f3nation.com`). The difference is the OAuth client ID and redirect URI.

## OAuth Client Registration

The `local-client` is registered in the auth provider's database with:

- `allowed_origin`: `https://localhost:3001`
- `redirect_uris`: `["/callback", "/api/auth/callback"]`
- `scopes`: `openid profile email`

See `../.context/oauth-clients.md` for the full client registry.

## Auth-Gated Features

- **Search** (navbar region/pax autocomplete): Rendered only when `isAuthed` is true in `NavbarClient`
- **Stats pages** (`/stats/region/[id]`, `/stats/pax/[id]`, etc.): Server-side `requireAuth()` redirects to `/` if not authenticated
- **Search API routes** (`/api/region/list`, `/api/pax/list`): Return 401 if `getSessionUser()` returns null

## Source Files

| File                                 | Purpose                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `src/lib/auth/oauth.ts`              | OAuth config builder, token exchange, userinfo fetch (uses `f3-nation-auth-sdk`) |
| `src/lib/auth/session.ts`            | HMAC sign/verify for `__session` cookie                                          |
| `src/lib/auth/server.ts`             | `getSessionUser()`, `requireAuth()` (server components)                          |
| `src/lib/auth/AuthProvider.tsx`      | Client-side auth context (`useAuth()` hook)                                      |
| `src/lib/auth/constants.ts`          | Cookie name, TTL                                                                 |
| `src/lib/auth/allowlist.ts`          | BigQuery email allowlist check                                                   |
| `src/app/api/auth/login/route.ts`    | Builds OAuth authorize URL, sets CSRF + PKCE cookies, redirects                  |
| `src/app/api/auth/callback/route.ts` | Handles OAuth callback: validates state, exchanges code, creates session         |
| `src/app/api/auth/me/route.ts`       | Returns current user (client-side session check)                                 |
| `src/app/api/auth/logout/route.ts`   | Clears session cookie                                                            |

## Local Dev Setup

**Requirements**: HTTPS on port 3001. The dev script handles this automatically:

```bash
npm run dev   # starts https://localhost:3001 (--experimental-https --port 3001)
```

**No local auth provider needed.** Local dev uses the production auth provider (`https://auth.f3nation.com`) with the `local-client` OAuth client.

**First-time HTTPS**: The browser will warn about the self-signed cert on `https://localhost:3001`. Click "Advanced" and "Proceed to localhost".

**Sign-in flow**: Click "Sign in" on pax-vault. You'll be redirected to `https://auth.f3nation.com` to authenticate with your F3 email, then back to `https://localhost:3001/api/auth/callback`. Your email must be in the BigQuery allowlist.

## Gotchas

- **`secure: process.env.NODE_ENV === "production"`**: OAuth flow cookies (`oauth_csrf`, `oauth_code_verifier`) and the session cookie are only `secure` in production. In local dev (`NODE_ENV=development`), they work over HTTPS without the `secure` flag, which means they also work if you accidentally hit `http://localhost:3001` — but the OAuth redirect won't work without HTTPS because the redirect URI is registered as `https://`.
- **Cookie name `__session`**: Firebase App Hosting strips all cookies except those prefixed with `__`. This name is required for prod.
- **Allowlist**: Even after successful OAuth, the callback checks the user's email against a BigQuery allowlist. If you authenticate but get redirected to `/?error=not_authorized`, your email isn't in the allowlist.
- **State expiry**: The OAuth state parameter expires after 10 minutes. If you take too long on the auth provider login page, you'll get `expired_state` error on callback.
