import { describe, it, expect } from "vitest";
import {
  parseIdList,
  toFiniteNumbers,
  parseFilterParams,
  parseFilterSearchParams,
  filtersToQueryString,
} from "./filters";

describe("parseIdList", () => {
  it("parses a comma-separated string into numbers", () => {
    expect(parseIdList("1,2,3")).toEqual([1, 2, 3]);
  });

  it("parses a string[] into numbers", () => {
    expect(parseIdList(["4", "5"])).toEqual([4, 5]);
  });

  it("drops non-numeric values", () => {
    expect(parseIdList("1,abc,3")).toEqual([1, 3]);
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(parseIdList(null)).toBeUndefined();
    expect(parseIdList(undefined)).toBeUndefined();
    expect(parseIdList("")).toBeUndefined();
  });

  it("returns undefined when nothing valid remains", () => {
    expect(parseIdList("abc,def")).toBeUndefined();
  });

  it("preserves the 0 sentinel (used for the 'no AO' case)", () => {
    expect(parseIdList("0,5")).toEqual([0, 5]);
  });
});

describe("toFiniteNumbers", () => {
  it("keeps only finite numbers", () => {
    expect(toFiniteNumbers([1, NaN, 2, Infinity, 3])).toEqual([1, 2, 3]);
  });

  it("returns [] for undefined", () => {
    expect(toFiniteNumbers(undefined)).toEqual([]);
  });
});

describe("parseFilterParams", () => {
  it("returns all-undefined for empty input", () => {
    expect(parseFilterParams(undefined)).toEqual({
      range: undefined,
      startDate: undefined,
      endDate: undefined,
      aoIds: undefined,
      aoMode: undefined,
      regionIds: undefined,
      regionMode: undefined,
      tagIds: undefined,
      tagMode: undefined,
      typeIds: undefined,
      typeMode: undefined,
      categoryIds: undefined,
      categoryMode: undefined,
    });
  });

  it("parses dates, id lists, and modes", () => {
    const f = parseFilterParams({
      range: "Last 90 Days",
      startDate: "2026-01-01",
      endDate: "2026-03-01",
      aoIds: "10,20",
      aoMode: "exclude",
      tagIds: ["1", "2"],
      tagMode: "include",
    });
    expect(f.range).toBe("Last 90 Days");
    expect(f.startDate).toBe("2026-01-01");
    expect(f.endDate).toBe("2026-03-01");
    expect(f.aoIds).toEqual([10, 20]);
    expect(f.aoMode).toBe("exclude");
    expect(f.tagIds).toEqual([1, 2]);
    expect(f.tagMode).toBe("include");
  });

  it("rejects invalid modes (returns undefined, not the raw value)", () => {
    expect(parseFilterParams({ aoMode: "bogus" }).aoMode).toBeUndefined();
  });

  it("takes the first value when a param arrives as an array", () => {
    expect(parseFilterParams({ range: ["A", "B"] }).range).toBe("A");
  });
});

describe("parseFilterSearchParams", () => {
  it("parses from URLSearchParams identically to the page parser", () => {
    const sp = new URLSearchParams(
      "range=YTD&aoIds=1,2&aoMode=include&regionIds=99&categoryMode=exclude",
    );
    const f = parseFilterSearchParams(sp);
    expect(f.range).toBe("YTD");
    expect(f.aoIds).toEqual([1, 2]);
    expect(f.aoMode).toBe("include");
    expect(f.regionIds).toEqual([99]);
    expect(f.categoryMode).toBe("exclude");
  });
});

describe("filtersToQueryString", () => {
  it("omits absent and empty fields", () => {
    expect(filtersToQueryString({})).toBe("");
  });

  it("serializes id lists and only includes a mode when its ids are present", () => {
    const qs = filtersToQueryString({
      range: "YTD",
      aoIds: [1, 2],
      aoMode: "exclude",
      tagMode: "include", // no tagIds -> mode dropped
    });
    const sp = new URLSearchParams(qs);
    expect(sp.get("range")).toBe("YTD");
    expect(sp.get("aoIds")).toBe("1,2");
    expect(sp.get("aoMode")).toBe("exclude");
    expect(sp.get("tagMode")).toBeNull();
  });

  it("round-trips through the parser", () => {
    const original = {
      range: "Last Month",
      startDate: "2026-02-01",
      aoIds: [3, 4],
      aoMode: "include" as const,
      typeIds: [7],
      typeMode: "exclude" as const,
    };
    const reparsed = parseFilterSearchParams(
      new URLSearchParams(filtersToQueryString(original)),
    );
    expect(reparsed.range).toBe("Last Month");
    expect(reparsed.startDate).toBe("2026-02-01");
    expect(reparsed.aoIds).toEqual([3, 4]);
    expect(reparsed.aoMode).toBe("include");
    expect(reparsed.typeIds).toEqual([7]);
    expect(reparsed.typeMode).toBe("exclude");
  });
});
