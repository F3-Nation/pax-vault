import { describe, expect, it, afterEach, vi } from "vitest";
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
  it("shares one runtime across separately bundled copies of the module", async () => {
    // Next.js bundles instrumentation.ts apart from route handlers, so each
    // bundle evaluates this module on its own. The pre-warmed runtime must be
    // the one requests use, or every instance downloads the release twice.
    const env = {
      NODE_ENV: "test",
      DUCKDB_ENABLED: "true",
      DUCKDB_GCS_BUCKET: "example-bucket",
    } as const;
    const prewarmed = getDuckDbRuntime(env);
    vi.resetModules();
    const requestBundle = await import("./factory");
    expect(requestBundle.getDuckDbRuntime).not.toBe(getDuckDbRuntime);
    expect(requestBundle.getDuckDbRuntime(env)).toBe(prewarmed);
    await requestBundle.resetDuckDbRuntimeForTests();
    expect(getDuckDbRuntime(env)).not.toBe(prewarmed);
  });
});
