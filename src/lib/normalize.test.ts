import { describe, it, expect } from "vitest";
import { normalizeDeep } from "./normalize";

describe("normalizeDeep", () => {
  it("unwraps { value } wrappers, including nested ones", () => {
    expect(normalizeDeep({ date: { value: "2026-01-01" } })).toEqual({
      date: "2026-01-01",
    });
  });

  it("converts bigint to number", () => {
    expect(normalizeDeep({ count: 42n })).toEqual({ count: 42 });
  });

  it("converts Date to an ISO string (not {})", () => {
    const d = new Date("2026-02-03T04:05:06.000Z");
    expect(normalizeDeep({ when: d })).toEqual({
      when: "2026-02-03T04:05:06.000Z",
    });
  });

  it("recurses through arrays and nested objects", () => {
    const input = {
      events: [
        { id: { value: 1n }, tags: [{ name: { value: "ruck" } }] },
        { id: 2n, tags: [] },
      ],
    };
    expect(normalizeDeep(input)).toEqual({
      events: [
        { id: 1, tags: [{ name: "ruck" }] },
        { id: 2, tags: [] },
      ],
    });
  });

  it("passes primitives and null through unchanged", () => {
    expect(normalizeDeep(null)).toBeNull();
    expect(normalizeDeep("x")).toBe("x");
    expect(normalizeDeep(7)).toBe(7);
  });
});
