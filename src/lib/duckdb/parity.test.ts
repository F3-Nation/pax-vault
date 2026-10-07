import { describe, expect, it } from "vitest";
import { assertParity, compareParity, parityGolden } from "./parity";

describe("DuckDB parity harness", () => {
  it("compares ordered nested, null, empty, date, and bigint values", () => {
    const rows = [
      {
        nil: null,
        empty: [],
        nested: { when: new Date("2024-01-01T00:00:00Z"), count: 2n },
      },
    ];
    expect(
      compareParity(rows, [
        {
          nil: null,
          empty: [],
          nested: { when: new Date("2024-01-01T00:00:00Z"), count: 2n },
        },
      ]).equal,
    ).toBe(true);
    expect(parityGolden([])).not.toEqual(parityGolden([{}]));
  });

  it("reports ordered parity mismatches", () => {
    const result = compareParity([{ id: 1 }], [{ id: 2 }]);
    expect(result.equal).toBe(false);
    expect(result.message).toContain("DuckDB parity mismatch");
    expect(() => assertParity([{ id: 1 }], [{ id: 2 }])).toThrow(
      "DuckDB parity mismatch",
    );
  });
});
