import { describe, expect, it } from "vitest";
import { readDuckDbConfig } from "./config";

describe("DuckDB configuration", () => {
  it("is disabled without a bucket by default", () => {
    expect(
      readDuckDbConfig({ NODE_ENV: "test", DUCKDB_ENABLED: "false" }).enabled,
    ).toBe(false);
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
