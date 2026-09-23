import { describe, expect, it, afterEach } from "vitest";
import { getDuckDbRuntime, resetDuckDbRuntimeForTests } from "./factory";

describe("DuckDB composition root", () => {
  afterEach(async () => {
    await resetDuckDbRuntimeForTests();
  });
  it("remains disabled and unavailable without loading GCS/native state", async () => {
    const runtime = getDuckDbRuntime({
      NODE_ENV: "test",
      DUCKDB_ENABLED: "false",
    });
    await expect(runtime.acquire()).rejects.toMatchObject({
      code: "DUCKDB_UNAVAILABLE",
      message: "DuckDB release is unavailable",
    });
  });
  it("constructs the enabled runtime lazily without connecting or refreshing", async () => {
    const runtime = getDuckDbRuntime({
      NODE_ENV: "test",
      DUCKDB_ENABLED: "true",
      DUCKDB_GCS_BUCKET: "example-bucket",
    });
    expect(runtime.status().activeReleaseId).toBeUndefined();
    await runtime.close();
  });
});
