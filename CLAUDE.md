# PAX-VAULT

See `../.context/pax-vault.md` for architecture details.

## Postmortems

| File                                                    | Summary                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.context/postmortems/2026-02-06-issue60-search-500.md` | [#60](https://github.com/F3-Nation/pax-vault/issues/60) — Search 500s caused by missing `location` on BigQuery client. SDK defaulted to `us-central1` instead of `US` multi-region. Fix: `BIGQUERY_LOCATION` env var + try-catch on search routes. |
