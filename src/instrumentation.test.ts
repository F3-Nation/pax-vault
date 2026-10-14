import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

const { getDuckDbRuntime, refresh } = vi.hoisted(() => ({
  getDuckDbRuntime: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./lib/duckdb/factory", () => ({
  getDuckDbRuntime,
}));

describe("register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDuckDbRuntime.mockReturnValue({ refresh });
    refresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { runtime: "nodejs", enabled: "false" },
    { runtime: "edge", enabled: "true" },
  ])(
    "does not load the DuckDB factory when runtime is $runtime and enabled is $enabled",
    async ({ runtime, enabled }) => {
      vi.stubEnv("NEXT_RUNTIME", runtime);
      vi.stubEnv("DUCKDB_ENABLED", enabled);

      await register();

      expect(getDuckDbRuntime).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it("waits for the initial refresh before resolving", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("DUCKDB_ENABLED", "true");

    let finishRefresh!: () => void;
    refresh.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
    );

    let registrationFinished = false;
    const registration = register().then(() => {
      registrationFinished = true;
    });

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(getDuckDbRuntime).toHaveBeenCalledOnce();
    expect(registrationFinished).toBe(false);

    finishRefresh();
    await registration;

    expect(registrationFinished).toBe(true);
  });

  it("propagates refresh failure so startup does not become ready", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("DUCKDB_ENABLED", "true");
    const failure = new Error("refresh failed");
    refresh.mockRejectedValue(failure);

    await expect(register()).rejects.toBe(failure);
  });
});
