/**
 * Region preferences — shared schema, defaults, and (de)serialization.
 *
 * Preferences are persisted as a single JSON string in
 * `paxVault.pv_regions_preferences.json_config`. Keeping the shape here, free
 * of server-only imports, lets the BigQuery layer, the API route, and the
 * client form all agree on one definition.
 *
 * ── Adding a real preference ────────────────────────────────────────────────
 * 1. Add the field to `RegionPreferences`.
 * 2. Give it a value in `DEFAULT_REGION_PREFERENCES`.
 * 3. Read it in `coerceRegionPreferences` (use the `bool`/`str` helpers).
 * 4. Add a control to `PreferencesForm`.
 *
 * Stored rows written before a field existed keep working: coercion always
 * layers whatever is stored on top of the defaults, and unknown keys are
 * dropped rather than persisted.
 */

/** Schema version stamped into every write. Bump when a migration is needed. */
export const REGION_PREFERENCES_VERSION = 1;

export interface RegionPreferences {
  /** Schema version of the stored config; lets future migrations branch. */
  version: number;
  /**
   * Show Fart Sack King / Ghost King stats, the per-event Fart Sacker roster,
   * and ghost chip styling on this region's pages and its AOs' pages.
   *
   * **Opt-out by default** (`false`): these stats were hidden from public view
   * in #128 and stay hidden until a region admin deliberately turns them on.
   * Never applies to PAX pages — see the inheritance table in
   * `.context/auth.md`.
   */
  showFartsackGhostStats: boolean;
}

export const DEFAULT_REGION_PREFERENCES: RegionPreferences = {
  version: REGION_PREFERENCES_VERSION,
  // Opt-out by default: off unless a region admin turns it on.
  showFartsackGhostStats: false,
};

/** Read a boolean field, falling back when the stored value isn't a boolean. */
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Narrow an untrusted value (a parsed `json_config`, or an API request body)
 * into a fully-populated preferences object.
 *
 * Never throws. Anything unrecognized — wrong type, null, an array, a missing
 * field — degrades to the default for that field, so neither a malformed row
 * nor a hostile request body can break the region page.
 */
export function coerceRegionPreferences(input: unknown): RegionPreferences {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_REGION_PREFERENCES };
  }

  const obj = input as Record<string, unknown>;

  return {
    version:
      typeof obj.version === "number" && Number.isFinite(obj.version)
        ? obj.version
        : REGION_PREFERENCES_VERSION,
    showFartsackGhostStats: bool(
      obj.showFartsackGhostStats,
      DEFAULT_REGION_PREFERENCES.showFartsackGhostStats,
    ),
  };
}

/**
 * Parse a stored `json_config` string into a preferences object.
 * Invalid JSON degrades to defaults rather than throwing.
 */
export function parseRegionPreferences(
  raw: string | null | undefined,
): RegionPreferences {
  if (!raw) return { ...DEFAULT_REGION_PREFERENCES };

  try {
    return coerceRegionPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_REGION_PREFERENCES };
  }
}

/**
 * Serialize preferences for storage. Always stamps the current schema version
 * so the persisted row records the shape it was written with.
 */
export function serializeRegionPreferences(prefs: RegionPreferences): string {
  return JSON.stringify({ ...prefs, version: REGION_PREFERENCES_VERSION });
}
