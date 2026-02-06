# Postmortem: Search Returns No Results Due to Silent Error Swallowing

**Date**: 2026-02-06
**Duration**: Introduced by PR #61 fix for issue #60, caught same day
**Severity**: P2 — Search silently broken (returns empty results instead of errors)
**Status**: Resolved
**GitHub**: Follow-up to [#60](https://github.com/F3-Nation/pax-vault/issues/60), reported by @f3-jolt

## Summary

After merging PR #61 ("Fix 500 Err on Search"), the search API routes no longer returned HTTP 500 — but they also never returned real errors. The try-catch blocks added in PR #61 returned `[]` with HTTP 200 on any BigQuery failure, masking errors as "no results." The navbar UI checks `!res.ok` to display errors, so it never triggered. Region pages had a similar pattern (catch returning `null` → "Region Data Not Available" with no context in logs).

## Impact

- Region and pax search silently returned empty results on BQ errors instead of showing an error message
- Region page loader swallowed errors without logging the regionId, making debugging harder
- Users saw "no results" or "Region Data Not Available" with no indication of a backend failure
- No data loss or security exposure

## Root Cause

**Primary**: `.env.local` had `BIGQUERY_DATASET=public`, but the `pv_*` views (pv_regions, pv_events, etc.) live in the `paxVault` dataset. All BQ queries failed with "Table not found." Prod works because Secret Manager has the correct dataset value; the `.env.local` and `.env.firebase` files were out of sync with the deployed secrets.

**Secondary**: The PR #61 fix masked this by swallowing errors. The catch blocks in both search routes returned `[]` with `{ status: 200 }`, which the client treated as a successful empty response. The region page loader similarly caught errors and returned `null` → "Region Data Not Available." The existing UI error handling (`!res.ok` check in `useDebouncedApiSearch`) was correct but never activated because the API always returned 200.

**Tertiary**: `db.ts` defaulted `BIGQUERY_LOCATION` to `"US"` (multi-region), but the dataset is in `us-central1` (single region). This happened not to matter because the `@google-cloud/bigquery` SDK v8.x doesn't propagate the constructor's `location` to `query()` calls — the SDK auto-detected correctly. But it caused confusing error messages during debugging ("Table not found in us-central1" vs "Dataset not found in US" depending on where location was set). Fixed by: setting the default to `us-central1`, explicitly passing `location` in the `query()` call, and adding `BIGQUERY_LOCATION=us-central1` to env files.

## Resolution

### 1. Search routes: return 500 with error message (not 200 with empty array)

Both `/api/region/list/route.ts` and `/api/pax/list/route.ts` catch blocks now return `{ error: "<descriptive message>" }` with HTTP 500. This re-enables the existing `!res.ok` error path in the UI.

### 2. Navbar: parse error body from API response

`useDebouncedApiSearch` in `navbar.tsx` now reads the JSON body from non-200 responses to extract the `error` field. The UI displays "Region search failed. Please try again." instead of the raw "Request failed: 500 Internal Server Error".

### 3. Region page loader: include regionId in error log

The catch block in `loader.ts` now logs `Error fetching Region data (region=<id>)` so failed region loads can be traced to a specific region in prod logs.

### 4. Dev server: add HTTPS + port 3001 to `npm run dev`

The `dev` script in `package.json` was `next dev --turbopack` (plain HTTP, default port 3000). The OAuth client `local-client` is registered with `allowed_origin: https://localhost:3001` and `redirect_uri: https://localhost:3001/api/auth/callback`. Without HTTPS + port 3001, the OAuth flow fails with `ERR_SSL_PROTOCOL_ERROR`.

Updated to `next dev --turbopack --experimental-https --port 3001`.

### 5. Fix AUTH_PROVIDER_URL to use production auth provider

`.env.local` had `AUTH_PROVIDER_URL=https://localhost:3000`, which required running the f3-nation-auth provider locally. This was unnecessary — the `local-client` OAuth client is registered in the production auth provider's database. Local dev should use `AUTH_PROVIDER_URL=https://auth.f3nation.com` (same as prod), just with a different client ID and redirect URI.

Updated `.env.local` from `https://localhost:3000` to `https://auth.f3nation.com`.

### 6. Fix BIGQUERY_DATASET and BIGQUERY_LOCATION in env files

`.env.local` and `.env.firebase` had `BIGQUERY_DATASET=public`. The `pv_*` views are in the `paxVault` dataset (the `public` dataset only has base tables). Updated both files to `BIGQUERY_DATASET=paxVault`. Also added `BIGQUERY_LOCATION=us-central1` explicitly.

### 7. Fix db.ts: pass location to query() and correct default

The `@google-cloud/bigquery` SDK v8.x does not propagate the `BigQuery` constructor's `location` parameter to `query()` calls. Added explicit `location` to the `query()` options in `queryBigQuery()`. Also changed the default from `"US"` to `"us-central1"` to match the actual dataset location.

## Local QA Setup

Testing the search fix locally requires OAuth sign-in (search fields are auth-gated). Only one server is needed:

```bash
cd pax-vault && npm run dev   # https://localhost:3001
```

**No local auth provider needed.** The `local-client` OAuth client is registered in the production auth provider (`https://auth.f3nation.com`) with `allowed_origin: https://localhost:3001`. Sign-in redirects to the prod auth provider, which redirects back to `https://localhost:3001/api/auth/callback`.

On first run, accept the self-signed cert warning for `https://localhost:3001` in the browser. See `.context/auth.md` for full auth details.

## Lessons Learned

### What went wrong

1. **Error handling traded one failure mode for another**: Catching errors and returning 200 eliminated the 500s but made failures invisible. The catch blocks should have returned 500 with a structured error from the start.

2. **No integration test for error path**: The UI had error display code (`regionApiError` / `paxApiError` state rendered as `text-danger-500`), but the API never exercised that path because it always returned 200.

3. **Catch-and-swallow is an anti-pattern for API routes**: Returning a success status on failure prevents callers from distinguishing "no results" from "query broke." Try-catch should preserve the error semantics — catch to log and format, not to hide.

4. **Dev script didn't match OAuth config**: The `npm run dev` script used plain HTTP on the default port, but the `local-client` OAuth registration requires `https://localhost:3001`. This made local QA impossible without manually passing flags, and wasn't documented.

5. **AUTH_PROVIDER_URL pointed to localhost:3000**: `.env.local` had `AUTH_PROVIDER_URL=https://localhost:3000`, requiring the auth provider to be running locally. But the auth provider env files weren't set up in the workspace, and there was no need — the `local-client` is registered in the prod auth DB. This wasted time debugging a non-existent local auth setup.

6. **Wrong BIGQUERY_DATASET in env files**: `.env.local` and `.env.firebase` had `BIGQUERY_DATASET=public`, but the `pv_*` views are in the `paxVault` dataset. Prod worked because Secret Manager had the correct value — the local env files were never updated when the views were moved/created in the `paxVault` dataset.

7. **BQ SDK location doesn't propagate**: The `BigQuery` constructor's `location` parameter does not propagate to `query()` calls in SDK v8.x. This made the `BIGQUERY_LOCATION` env var fix in PR #61 ineffective — it set the constructor `location` but queries still auto-detected. The auto-detection happened to work (finding `us-central1`), but the explicit `location` should have been passed to `query()` too.

### What went right

1. @f3-jolt caught the second-order bug quickly after PR #61 merged
2. The UI already had error display wiring — only the API response needed fixing
3. Direct BQ diagnostic scripts confirmed root cause quickly (wrong dataset, not wrong location)

## Files Changed

| File                                        | Change                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/region/list/route.ts`          | Catch block: return 500 + `{ error }` instead of 200 + `[]`                                                             |
| `src/app/api/pax/list/route.ts`             | Catch block: return 500 + `{ error }` instead of 200 + `[]`                                                             |
| `src/components/navbar.tsx`                 | Parse JSON error body from non-200 responses in `useDebouncedApiSearch`                                                 |
| `src/app/stats/region/[regionId]/loader.ts` | Include regionId in error log message                                                                                   |
| `package.json`                              | Dev script: add `--experimental-https --port 3001`                                                                      |
| `.env.local`                                | `AUTH_PROVIDER_URL` → `https://auth.f3nation.com`, `BIGQUERY_DATASET` → `paxVault`, add `BIGQUERY_LOCATION=us-central1` |
| `.env.firebase`                             | `BIGQUERY_DATASET` → `paxVault`, add `BIGQUERY_LOCATION=us-central1`                                                    |
| `src/lib/db.ts`                             | Pass `location` in `query()` options; default `us-central1` instead of `US`                                             |

## Related Files

- `pax-vault/.context/postmortems/2026-02-06-issue60-search-500.md` — Original issue #60 postmortem (PR #61 introduced this bug)
- `pax-vault/.context/auth.md` — Full auth flow, OAuth setup, local dev sign-in workflow
- `pax-vault/.context/bigquery.md` — BQ connection, datasets, views, SDK gotchas
- `.context/oauth-clients.md` — OAuth client registry (`local-client` → `https://localhost:3001`)
