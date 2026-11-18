import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDuckDbRuntime, reportDuckDbRuntimeTelemetry } = vi.hoisted(() => ({
  getDuckDbRuntime: vi.fn(),
  reportDuckDbRuntimeTelemetry: vi.fn(),
}));

vi.mock("@/lib/duckdb/factory", () => ({ getDuckDbRuntime }));
vi.mock("@/lib/observability", () => ({ reportDuckDbRuntimeTelemetry }));

import { POST } from "./route";

const TOKEN = "test-refresh-token";
const request = (authorization?: string) =>
  new Request("http://localhost/api/internal/duckdb/refresh", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });

function fakeRuntime(
  overrides: {
    enabled?: boolean;
    detailsDataset?: "pv_events" | "pv_event_details";
  } = {},
) {
  const query = vi.fn().mockResolvedValue([{ 1: 1 }]);
  const lease = {
    releaseId: "release-45",
    releaseSequence: 45,
    detailsDataset: overrides.detailsDataset ?? "pv_event_details",
    release: vi.fn(),
    withConnection: vi.fn(),
    withDetailsConnection: vi.fn(
      async (fn: (c: { query: typeof query }) => Promise<unknown>) =>
        fn({ query }),
    ),
  };
  const runtime = {
    refresh: vi.fn().mockResolvedValue(undefined),
    acquire: vi.fn().mockResolvedValue(lease),
    close: vi.fn(),
    status: vi.fn(() => ({
      enabled: overrides.enabled ?? true,
      state: "ready",
      activeReleaseSequence: 45,
      lkgState: "ready",
      refreshFailureCount: 0,
    })),
  };
  getDuckDbRuntime.mockReturnValue(runtime);
  return { runtime, lease, query };
}

describe("POST /api/internal/duckdb/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DUCKDB_REFRESH_TOKEN", TOKEN);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is disabled (404) when no token is configured", async () => {
    vi.stubEnv("DUCKDB_REFRESH_TOKEN", "");
    const { runtime } = fakeRuntime();
    const response = await POST(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(404);
    expect(runtime.refresh).not.toHaveBeenCalled();
  });

  it.each([undefined, "Bearer wrong", TOKEN, "Bearer "])(
    "rejects authorization %s without refreshing",
    async (authorization) => {
      const { runtime } = fakeRuntime();
      const response = await POST(request(authorization));
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(runtime.refresh).not.toHaveBeenCalled();
    },
  );

  it("awaits the refresh, warms event details, and releases the lease", async () => {
    const { runtime, lease, query } = fakeRuntime();
    const response = await POST(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      releaseSequence: 45,
      detailsWarmed: true,
    });
    expect(runtime.refresh).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith("SELECT 1");
    expect(lease.release).toHaveBeenCalledOnce();
    expect(reportDuckDbRuntimeTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "duckdb_scheduled_refresh",
        outcome: "success",
      }),
    );
  });

  it("skips the details warm-up for legacy releases", async () => {
    const { lease } = fakeRuntime({ detailsDataset: "pv_events" });
    const response = await POST(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(200);
    expect((await response.json()).detailsWarmed).toBe(false);
    expect(lease.withDetailsConnection).not.toHaveBeenCalled();
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it("returns 503 without error details when the refresh fails", async () => {
    const { runtime } = fakeRuntime();
    runtime.refresh.mockRejectedValue(new Error("gs://secret/path broke"));
    const response = await POST(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.failedStage).toBe("refresh");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(runtime.acquire).not.toHaveBeenCalled();
  });

  it("returns 503 and still releases the lease when details fail", async () => {
    const { lease } = fakeRuntime();
    lease.withDetailsConnection.mockRejectedValue(new Error("download"));
    const response = await POST(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(503);
    expect((await response.json()).failedStage).toBe("details");
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it("reports disabled without touching the runtime", async () => {
    const { runtime } = fakeRuntime({ enabled: false });
    const response = await POST(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("disabled");
    expect(runtime.refresh).not.toHaveBeenCalled();
  });
});
