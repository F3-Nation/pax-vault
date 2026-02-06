# 500 err in search

https://github.com/F3-Nation/pax-vault/issues/60

@taterhead247 reported this bug in slack https://f3nation-dev.slack.com/archives/C09SR5EJNDV/p1770388029062719

> I am getting a 500 when I search for region or pax …

![Image](https://github.com/user-attachments/assets/02a37133-6706-41dd-a85d-f3dd25d37699)

## Prod logs analysis

Raw logs: `./logs.json` (~635KB, Cloud Run prod logs from build `pax-vault-build-2026-02-06-002`)

### Root cause

BQ views `pv_events` and `pv_regions` not found in `us-central1`. The `/api/region/list` search endpoint queries `pv_regions` which doesn't exist at the expected location.

### Error pattern

- 3x HTTP 500 on `/api/region/list?q=<term>` (queries: "Princeton" x2, "jocoga" x1)
- Each search request with trailing slash (`/api/region/list/?q=...`) returns 308 redirect → then the non-trailing-slash request hits 500
- Latency on 500s: 323-422ms (time spent before BQ returns "not found")
- All errors from same instance, same revision (`pax-vault-build-2026-02-06-002`)

### Error messages

1. `Error fetching Region data: Error: Not found: Table f3data:public.pv_events was not found in location us-central1` (14:40:47Z)
2. `Error: Not found: Table f3data:public.pv_regions was not found in location us-central1` (14:44:45Z, 14:44:56Z, 14:46:15Z)
   - Stack: `.next/server/chunks/541.js` → `parseHttpRespBody` → `handleResp`

### Key observations

- The region search endpoint references both `pv_events` and `pv_regions` views
- Views may have been dropped/renamed or the BQ dataset location changed from `us-central1`
- Non-search traffic (pax pages, event pages) returned 200s during the same window — suggests those use different views or different dataset location
- Error is in the BQ table lookup, not auth or app logic
