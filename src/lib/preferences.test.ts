import { describe, it, expect } from "vitest";
import {
  DEFAULT_REGION_PREFERENCES,
  REGION_PREFERENCES_VERSION,
  coerceRegionPreferences,
  parseRegionPreferences,
  serializeRegionPreferences,
} from "./preferences";

describe("parseRegionPreferences", () => {
  it("returns defaults for an unsaved region (null/empty config)", () => {
    expect(parseRegionPreferences(null)).toEqual(DEFAULT_REGION_PREFERENCES);
    expect(parseRegionPreferences(undefined)).toEqual(
      DEFAULT_REGION_PREFERENCES,
    );
    expect(parseRegionPreferences("")).toEqual(DEFAULT_REGION_PREFERENCES);
  });

  it("returns defaults rather than throwing on malformed JSON", () => {
    expect(parseRegionPreferences("{not json")).toEqual(
      DEFAULT_REGION_PREFERENCES,
    );
  });

  it("reads stored values", () => {
    expect(
      parseRegionPreferences('{"version":1,"showFartsackGhostStats":true}'),
    ).toEqual({ version: 1, showFartsackGhostStats: true });
  });

  it("fills in fields missing from an older stored config", () => {
    expect(parseRegionPreferences('{"version":1}')).toEqual({
      version: 1,
      showFartsackGhostStats: DEFAULT_REGION_PREFERENCES.showFartsackGhostStats,
    });
  });
});

describe("coerceRegionPreferences", () => {
  it("drops unknown keys instead of persisting them", () => {
    const result = coerceRegionPreferences({
      showFartsackGhostStats: true,
      injected: "should not survive",
    });
    expect(result).toEqual({
      version: REGION_PREFERENCES_VERSION,
      showFartsackGhostStats: true,
    });
    expect(result).not.toHaveProperty("injected");
  });

  it("falls back to the default when a field has the wrong type", () => {
    expect(coerceRegionPreferences({ showFartsackGhostStats: "yes" })).toEqual(
      DEFAULT_REGION_PREFERENCES,
    );
  });

  it("returns defaults for non-object input", () => {
    expect(coerceRegionPreferences(null)).toEqual(DEFAULT_REGION_PREFERENCES);
    expect(coerceRegionPreferences([])).toEqual(DEFAULT_REGION_PREFERENCES);
    expect(coerceRegionPreferences("nope")).toEqual(DEFAULT_REGION_PREFERENCES);
  });
});

describe("serializeRegionPreferences", () => {
  it("round-trips through parse", () => {
    const prefs = { version: 1, showFartsackGhostStats: true };
    expect(parseRegionPreferences(serializeRegionPreferences(prefs))).toEqual(
      prefs,
    );
  });

  it("stamps the current schema version even if the input is stale", () => {
    const serialized = serializeRegionPreferences({
      version: 0,
      showFartsackGhostStats: false,
    });
    expect(JSON.parse(serialized).version).toBe(REGION_PREFERENCES_VERSION);
  });
});
