/**
 * @deprecated This file is deprecated. Please use the DataSource abstraction from `@/lib/data` instead.
 *
 * This file is kept for backward compatibility with upstream repositories that may still import from it.
 * It now delegates to the new DataSource system under the hood.
 *
 * Migration guide:
 * - Instead of `import { queryBigQuery } from '@/lib/db'`
 * - Use: `import { getPaxList, getRegionList, ... } from '@/lib/data'`
 * - Or use the DataSource interface directly for custom queries
 */

import { query } from "./data/bigquery";

type BigQueryRow = Record<string, unknown>;

/**
 * @deprecated Use the DataSource abstraction from `@/lib/data` instead.
 *
 * This function is kept for backward compatibility and now delegates to the new DataSource system.
 *
 * @param sql - SQL query string
 * @returns Promise resolving to array of query results
 */
export async function queryBigQuery<T = BigQueryRow>(
  sql: string
): Promise<T[]> {
  // Delegate to the new DataSource system's query function
  // This ensures we use the same BigQuery client and configuration
  return query<T>(sql);
}
