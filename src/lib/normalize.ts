/**
 * Recursively normalize a BigQuery result into plain, JSON-serializable data
 * that is safe to pass from Server to Client Components.
 *
 * - Unwraps BigQuery value-wrappers (`{ value: ... }`, e.g. DATE / TIMESTAMP /
 *   numeric wrappers), recursing into the wrapped value.
 * - Converts `bigint` to `number`.
 * - Converts `Date` to an ISO string.
 *
 * Replaces the per-loader `JSON.parse(JSON.stringify(data, replacer))` dance,
 * which made two passes and could silently turn a real `Date` into `{}`.
 */
export function normalizeDeep<T>(value: unknown): T {
  return normalizeValue(value) as T;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Unwrap BigQuery value-wrappers, e.g. { value: '2026-01-01' }.
    if ("value" in obj) return normalizeValue(obj.value);

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = normalizeValue(obj[key]);
    }
    return out;
  }

  return value;
}
