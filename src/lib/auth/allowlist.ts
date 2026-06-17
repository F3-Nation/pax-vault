import { queryBigQuery } from "@/lib/db";

const DEFAULT_AUTH_TABLE = "f3data.public.users";

function getAuthTable() {
  const raw = process.env.AUTH_EMAIL_TABLE?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_AUTH_TABLE;
}

export async function isAuthorizedEmail(rawEmail: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return false;

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
