import { describe, it, expect } from "vitest";
import {
  buildActiveChips,
  filtersAfterRemoval,
  type ActiveChip,
} from "./ActiveFilterChips";

const lookups = {
  aos: [{ ao_org_id: 123, ao_name: "The Bully" }],
  regions: [{ region_org_id: 40, region_name: "Northlake" }],
  tags: [{ tag_id: 5, tag_name: "Ruck" }],
  types: [{ type_id: 7, type_name: "Bootcamp" }],
};

describe("buildActiveChips", () => {
  it("returns no chips for empty or all-history filters", () => {
    expect(buildActiveChips("", lookups)).toEqual([]);
    expect(buildActiveChips("range=All History", lookups)).toEqual([]);
  });

  it("builds a removable range chip", () => {
    expect(buildActiveChips("range=Last 90 Days", lookups)).toEqual([
      { label: "Last 90 Days", color: "primary", param: "range" },
    ]);
  });

  it("resolves ids to names and marks value chips removable", () => {
    const chips = buildActiveChips("aoIds=123&tagIds=5", lookups);
    expect(chips).toContainEqual({
      label: "The Bully",
      color: "secondary",
      param: "aoIds",
      value: "123",
      modeParam: "aoMode",
    });
    expect(chips).toContainEqual({
      label: "Ruck",
      color: "warning",
      param: "tagIds",
      value: "5",
      modeParam: "tagMode",
    });
  });

  it("adds a non-removable Exclude indicator in exclude mode", () => {
    const chips = buildActiveChips("aoIds=123&aoMode=exclude", lookups);
    expect(chips[0]).toEqual({ label: "Exclude", color: "secondary" });
    expect(chips[0].param).toBeUndefined();
  });

  it("labels the 0 sentinel as Unknown AO", () => {
    expect(buildActiveChips("aoIds=0", lookups)[0].label).toBe("Unknown AO");
  });
});

describe("filtersAfterRemoval", () => {
  const aoChip: ActiveChip = {
    label: "x",
    color: "secondary",
    param: "aoIds",
    value: "123",
    modeParam: "aoMode",
  };

  it("removes one id from a multi-value param, keeping the mode", () => {
    const sp = new URLSearchParams(
      filtersAfterRemoval("aoIds=123,456&aoMode=exclude", aoChip),
    );
    expect(sp.get("aoIds")).toBe("456");
    expect(sp.get("aoMode")).toBe("exclude");
  });

  it("deletes the param and its mode when the last id is removed", () => {
    const sp = new URLSearchParams(
      filtersAfterRemoval("aoIds=123&aoMode=exclude", aoChip),
    );
    expect(sp.get("aoIds")).toBeNull();
    expect(sp.get("aoMode")).toBeNull();
  });

  it("deletes a single-value param and preserves others", () => {
    const sp = new URLSearchParams(
      filtersAfterRemoval("range=YTD&aoIds=1", {
        label: "x",
        color: "primary",
        param: "range",
      }),
    );
    expect(sp.get("range")).toBeNull();
    expect(sp.get("aoIds")).toBe("1");
  });
});
