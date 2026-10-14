import { describe, expect, it } from "vitest";
import { readDuckDbConfig } from "./config";

describe("DuckDB configuration", () => {
  it("is disabled without a bucket by default", () => {
    expect(
      readDuckDbConfig({ NODE_ENV: "test", DUCKDB_ENABLED: "false" }).enabled,
    ).toBe(false);
  });
  it("defaults download budgets to fit the current large v2 artifacts", () => {
    const config = readDuckDbConfig({ NODE_ENV: "test" });
    expect(config.maxObjectBytes).toBe(384 * 1024 * 1024);
    expect(config.maxReleaseBytes).toBe(512 * 1024 * 1024);
    expect(config.maxObjectBytes).toBeGreaterThan(322_875_432);
    expect(config.maxReleaseBytes).toBeGreaterThan(328_610_338);
  });
  it("rejects an enabled configuration without a safe bucket", () => {
    expect(() =>
      readDuckDbConfig({
        NODE_ENV: "test",
        DUCKDB_ENABLED: "true",
        DUCKDB_GCS_BUCKET: "../secret",
      }),
    ).toThrow();
  });
  it("rejects unsafe control paths and non-positive limits", () => {
    expect(() =>
      readDuckDbConfig({ NODE_ENV: "test", DUCKDB_GCS_PREFIX: "../releases" }),
    ).toThrow();
    expect(() =>
      readDuckDbConfig({ NODE_ENV: "test", DUCKDB_REFRESH_TTL_MS: "0" }),
    ).toThrow();
  });
});
