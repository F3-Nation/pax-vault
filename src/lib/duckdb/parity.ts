import { canonicalDuckDbRows } from "./validation";

export interface ParityResult {
  equal: boolean;
  expected: Buffer;
  actual: Buffer;
  message?: string;
}
export function parityGolden(rows: unknown[]): Buffer {
  return canonicalDuckDbRows(rows);
}
export function compareParity(
  actual: unknown[],
  expected: unknown[],
): ParityResult {
  const actualBytes = parityGolden(actual);
  const expectedBytes = parityGolden(expected);
  const equal = actualBytes.equals(expectedBytes);
  return {
    equal,
    actual: actualBytes,
    expected: expectedBytes,
    message: equal
      ? undefined
      : `DuckDB parity mismatch: expected ${expectedBytes.toString("utf8")}, got ${actualBytes.toString("utf8")}`,
  };
}
export function assertParity(actual: unknown[], expected: unknown[]): void {
  const result = compareParity(actual, expected);
  if (!result.equal) throw new Error(result.message);
}
