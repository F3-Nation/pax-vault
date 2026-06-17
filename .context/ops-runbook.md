# PAX-Vault Ops Runbook

Operator checklist for the reliability/security items that live outside the
codebase (GCP console, billing, secret management). These are **manual actions**
— there is no code to deploy for them. Roadmap ref: P1-9.

## 1. Secret hygiene

**Problem:** production secrets currently sit in plaintext in `.env.firebase`
on a developer laptop. That file is correctly git-ignored (not in the repo), but
a laptop copy is still an exposure.

- [ ] Treat **Google Secret Manager** as the source of truth for production
      secrets (it already backs `apphosting.yaml`). Delete `.env.firebase` from
      the laptop once confirmed; pull values on demand with
      `gcloud secrets versions access` rather than keeping a local copy.
- [ ] Keep `.env.local` (dev-only values) on the laptop — that's expected.
- [ ] Confirm `.gitignore` still excludes `.env*` except `.env.example`
      (it does today).

### Rotate `SESSION_SECRET` (hygiene, ~quarterly or on suspicion)

Rotating invalidates the HMAC on every existing `__session` cookie, so **all
users are logged out and must sign in again** (low impact for this app).

1. Generate a new secret: `openssl rand -hex 32`
2. Add it as a new version in Secret Manager for the `SESSION_SECRET` secret.
3. Trigger a rollout so App Hosting picks up the new version
   (`npm run firebase:deploy`).
4. Verify sign-in end-to-end after the rollout.

## 2. Uptime check (catch "site is down")

Use either option — both have free tiers. Target the **public** landing page
(`/`) so the check doesn't need auth.

- **Google Cloud Monitoring** → Uptime checks → Create:
  - Protocol HTTPS, host `pax-vault.f3nation.com`, path `/`, check every 5 min.
  - Alert policy → notify your email/Slack on failure.
- **or UptimeRobot** (external): HTTPS monitor on the same URL, 5-min interval.

## 3. BigQuery cost guardrail (catch "runaway query cost")

Two complementary controls:

- [ ] **Billing budget alert** (Cloud Billing → Budgets & alerts → Create
      budget): scope to the `f3data` project (or the BigQuery service), set a
      monthly amount, and alerts at 50/90/100%. This notifies; it does not cap.
- [ ] **Custom query quota** (optional hard cap) — IAM & Admin → Quotas →
      filter "BigQuery API: Query usage per day", set a per-day bytes ceiling so
      a pathological query/loop can't run up an unbounded bill.

> Pairs with the P0 caching work: cached page loads no longer issue BigQuery
> jobs, so steady-state cost should be low and a sudden spike is a real signal.

## 4. Error tracking (cross-ref P0-3)

The provider-agnostic seam is already wired (`src/lib/observability.ts`,
`reportError`). When you adopt a provider (e.g. Sentry), forward from the single
`TODO(P0-3)` hook there and set its DSN as a Secret Manager secret — no call
sites change.
