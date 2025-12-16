import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // set in .env.local
});

export default pool;

import { BigQuery } from "@google-cloud/bigquery";

const projectId = process.env.BIGQUERY_PROJECT_ID!;
const datasetId = process.env.BIGQUERY_DATASET!;
const clientEmail = process.env.BIGQUERY_CLIENT_EMAIL!;
const privateKey = process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Create a single BigQuery client per Lambda/Node process
const bigquery = new BigQuery({
  projectId,
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
});

type BigQueryRow = Record<string, unknown>;

// Generic row normalizer: makes data safe for Next.js serialization
function normalizeRow(row: BigQueryRow): BigQueryRow {
  const plain: BigQueryRow = { ...row };

  // Generic fix: if a property is an object with a `value` key, flatten it.
  for (const key of Object.keys(plain)) {
    const v = plain[key];
    if (
      v &&
      typeof v === "object" &&
      "value" in (v as Record<string, unknown>)
    ) {
      (plain as Record<string, unknown>)[key] = (v as { value: unknown }).value;
    }
  }

  return plain;
}

export async function queryBigQuery<T = BigQueryRow>(
  sql: string,
): Promise<T[]> {
  const [rawRows] = await bigquery.query({
    query: sql,
    defaultDataset: { datasetId, projectId },
  });

  const rows = (rawRows as BigQueryRow[]).map((row) =>
    normalizeRow(row),
  ) as T[];

  return rows;
}
