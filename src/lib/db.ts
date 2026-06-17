import { BigQuery } from "@google-cloud/bigquery";

const projectId = process.env.BIGQUERY_PROJECT_ID!;
const datasetId = process.env.BIGQUERY_DATASET!;
const clientEmail = process.env.BIGQUERY_CLIENT_EMAIL!;
const privateKey = process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, "\n");
const location = process.env.BIGQUERY_LOCATION || "us-central1";
const env = process.env.ENVIRONMENT || "unknown";

// Create a single BigQuery client per Lambda/Node process
const bigquery = new BigQuery({
  projectId,
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  location,
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
const sanitize = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .substring(0, 63);

export async function queryBigQuery<T = BigQueryRow>(
  sql: string,
  userIdentifier?: string,
  reason?: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  // Obfuscate and sanitize email for BigQuery label in one step
  const userLabel = (userIdentifier ?? "unknown")
    .replace(/^(.{1,3}).*(@.*)$/, (_, a, b) => a + "..." + b)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");

  console.log(
    JSON.stringify({
      env: env.toLowerCase(),
      app: "pax-vault",
      user: userLabel,
      reason: reason || "unspecified",
      message: "BigQuery fetch initiated",
    }),
  );

  const [rawRows] = await bigquery.query({
    query: sql,
    defaultDataset: { datasetId, projectId },
    location,
    labels: {
      env: sanitize(env),
      app: "pax-vault",
      user: sanitize(userLabel),
      reason: sanitize(reason || "unspecified"),
    },
    // Named query parameters (@name) — the safe path for user-supplied values.
    // Prefer this over string interpolation in all new/converted queries.
    ...(params ? { params } : {}),
  });

  const rows = (rawRows as BigQueryRow[]).map((row) =>
    normalizeRow(row),
  ) as T[];

  return rows;
}
