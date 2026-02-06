# PAX-VAULT

See `../.context/pax-vault.md` for architecture details.

## Context Files

| File                   | When                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `.context/auth.md`     | Auth flow, OAuth setup, session handling, local dev sign-in |
| `.context/bigquery.md` | BQ connection, datasets, views, SDK gotchas                 |

## Postmortems

| File                                                        | Summary                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.context/postmortems/2026-02-06-issue60-search-500.md`     | [#60](https://github.com/F3-Nation/pax-vault/issues/60) — Search 500s caused by missing `location` on BigQuery client. SDK defaulted to `us-central1` instead of `US` multi-region. Fix: `BIGQUERY_LOCATION` env var + try-catch on search routes. |
| `.context/postmortems/2026-02-06-search-silent-failures.md` | PR #61 fix for #60 swallowed BQ errors — catch blocks returned `[]` with HTTP 200, masking failures as "no results." Fix: return 500 + error body so UI error display activates.                                                                   |
