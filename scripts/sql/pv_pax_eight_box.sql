-- 8 Box storage for pax-vault.
--
-- Run ONCE per environment, out of band (there is no migration runner):
--
--   bq query --use_legacy_sql=false --location=us-central1 < scripts/sql/pv_pax_eight_box.sql
--
-- Then grant the app's service account write access on THIS TABLE ONLY.
-- The account is read-only across f3data otherwise; a dataset-level grant
-- would open every pv_* view to writes (see .context/auth.md).
--
--   bq add-iam-policy-binding --table=true \
--     --member='serviceAccount:pax-vault-bigquery-prod@f3data.iam.gserviceaccount.com' \
--     --role='roles/bigquery.dataEditor' \
--     f3data:paxVault.pv_pax_eight_box
--
-- Until the grant exists, every save fails with the actionable 503 produced
-- by `isWritePermissionError()` in src/lib/bq/preferences.ts.
--
-- Lifecycle (enforced by the app, see src/lib/bq/eightBox.ts):
--   * at most ONE row per pax_id with status = 'draft' (MERGE keyed on it)
--   * publishing flips that row to status = 'published', assigns `version`
--     (per-PAX sequence) and `published_at`; the row is then immutable
--   * deletes are hard DELETEs — BigQuery time travel (7 days) is the safety net

CREATE TABLE IF NOT EXISTS `f3data.paxVault.pv_pax_eight_box` (
  id           STRING    NOT NULL OPTIONS (description = "UUID v4 minted by pax-vault; appears in share URLs"),
  pax_id       INT64     NOT NULL OPTIONS (description = "f3data.public.users.id of the owner"),
  status       STRING    NOT NULL OPTIONS (description = "'draft' | 'published'. At most one draft per pax_id (enforced by the app)"),
  version      INT64              OPTIONS (description = "1-based per-PAX sequence, assigned at publish; NULL while draft"),
  period       STRING    NOT NULL OPTIONS (description = "User-editable label, default current quarter e.g. 2026-Q3"),
  json_content STRING    NOT NULL OPTIONS (description = "{version:2, word, boxes:{<box>:{fields:{...}, items:[...]}}} — shape and per-box sub-fields in src/lib/eightBox.ts (v1 rows held one string per box)"),
  shared_at    TIMESTAMP          OPTIONS (description = "Non-null while the share link is enabled (published rows only)"),
  created_at   TIMESTAMP NOT NULL,
  updated_at   TIMESTAMP NOT NULL,
  published_at TIMESTAMP          OPTIONS (description = "Set when the draft was published; NULL while draft")
)
CLUSTER BY pax_id
OPTIONS (
  description = "F3 8 Box vision boards: one editable draft plus immutable published versions per PAX, written by pax-vault via DML."
);
