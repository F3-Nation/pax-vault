import { queryBigQuery } from "@/lib/db";

const DEFAULT_AUTH_TABLE = "f3data.public.users";

function getAuthTable() {
  const raw = process.env.AUTH_EMAIL_TABLE?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_AUTH_TABLE;
}

export async function isAuthorizedEmail(rawEmail: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return false;

  const escaped = email.replace(/'/g, "''");
  const table = getAuthTable();
  const tableRef = table.startsWith("`") ? table : `\`${table}\``;

  const query = `-- AUTH EMAIL CHECK
    SELECT 1 AS ok
    FROM ${tableRef}
    WHERE email IS NOT NULL
      AND LOWER(email) = '${escaped}'
    LIMIT 1
  `;

  const results = await queryBigQuery<{ ok: number }>(query);
  return Array.isArray(results) && results.length > 0;
}
