import { queryBigQuery } from "@/lib/db";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { DuckDbQueryAdapter, selectDuckDbOrLegacy } from "@/lib/duckdb/query";

// Unqualified: `queryBigQuery` binds `paxVault` as the default dataset. pv_pax
// holds one row per `public.users` row with a non-null, well-formed email (see
// scripts/sql/pv_pax.sql), refreshed every 6 hours — so a brand-new F3 user can
// sign in only after the next refresh.
const DEFAULT_AUTH_TABLE = "pv_pax";

function getAuthTable() {
  const raw = process.env.AUTH_EMAIL_TABLE?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_AUTH_TABLE;
}

export async function isAuthorizedEmail(rawEmail: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return false;

  return selectDuckDbOrLegacy({
    capability: "auth_allowlist",
    env: process.env,
    duckdb: async () => {
      const override = process.env.AUTH_EMAIL_TABLE?.trim();
      if (override && override.replaceAll("`", "") !== DEFAULT_AUTH_TABLE) {
        throw new Error(
          "AUTH_EMAIL_TABLE is only supported by BigQuery; DuckDB auth requires pv_pax",
        );
      }
      const adapter = new DuckDbQueryAdapter(getDuckDbRuntime());
      const rows = await adapter.execute<{ ok: number }>(
        "SELECT 1 AS ok FROM pv_pax WHERE email IS NOT NULL AND LOWER(email) = ? LIMIT 1",
        [email],
      );
      return rows.length > 0;
    },
    legacy: async () => isAuthorizedEmailBigQuery(email),
  });
}

async function isAuthorizedEmailBigQuery(email: string): Promise<boolean> {
  // Table name is operator-controlled (env var), not user input, so it stays
  // interpolated — BigQuery cannot parameterize identifiers. The user-supplied
  // email is bound as a named parameter (@email) instead of interpolated.
  const table = getAuthTable();
  const tableRef = table.startsWith("`") ? table : `\`${table}\``;

  const query = `-- AUTH EMAIL CHECK
    SELECT 1 AS ok
    FROM ${tableRef}
    WHERE email IS NOT NULL
      AND LOWER(email) = @email
    LIMIT 1
  `;

  const results = await queryBigQuery<{ ok: number }>(
    query,
    email,
    "email allowlist check",
    { email },
  );
  return Array.isArray(results) && results.length > 0;
}
