import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEventDetails, getSessionUser, duckDbEnabled } = vi.hoisted(() => ({
  getEventDetails: vi.fn(),
  getSessionUser: vi.fn(),
  duckDbEnabled: vi.fn(),
}));

vi.mock("@/lib/bq/events", () => ({ getEventDetails }));
vi.mock("@/lib/auth/server", () => ({ getSessionUser }));
vi.mock("@/lib/duckdb/query", () => ({ isDuckDbEnabled: duckDbEnabled }));

import {
  DuckDbDependencyError,
  DuckDbReleaseConflictError,
} from "@/lib/duckdb/errors";
import { GET } from "./route";

const context = (eventInstanceId: string) => ({
  params: Promise.resolve({ eventInstanceId }),
});
const request = (search = "") =>
  new Request(`http://localhost/api/events/12${search}`);

describe("event details API release pinning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ email: "user@example.com" });
    duckDbEnabled.mockReturnValue(true);
  });

  it("maps release conflicts to a non-cacheable 409", async () => {
    getEventDetails.mockRejectedValue(new DuckDbReleaseConflictError());
    const response = await GET(request("?releaseId=release-1"), context("12"));
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("maps deferred detail failures to a non-cacheable 503", async () => {
    getEventDetails.mockRejectedValue(new DuckDbDependencyError());
    const response = await GET(request("?releaseId=release-1"), context("12"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("requires a token in DuckDB mode, and does not fetch details", async () => {
    const response = await GET(request(), context("12"));
    expect(response.status).toBe(409);
    expect(getEventDetails).not.toHaveBeenCalled();
  });

  it("treats an empty release token as missing", async () => {
    const response = await GET(request("?releaseId="), context("12"));
    expect(response.status).toBe(409);
    expect(getEventDetails).not.toHaveBeenCalled();
  });

  it("allows tokenless BigQuery details when the capability is off", async () => {
    duckDbEnabled.mockReturnValue(false);
    getEventDetails.mockResolvedValue({ id: 12 });
    const response = await GET(request(), context("12"));
    expect(response.status).toBe(200);
    expect(getEventDetails).toHaveBeenCalledWith(
      12,
      "user@example.com",
      undefined,
    );
  });

  it("does not serve live BigQuery details for a token when DuckDB is off", async () => {
    duckDbEnabled.mockReturnValue(false);
    getEventDetails.mockRejectedValue(new DuckDbReleaseConflictError());
    const response = await GET(
      request("?releaseId=old-release"),
      context("12"),
    );
    expect(response.status).toBe(409);
    expect(getEventDetails).toHaveBeenCalledWith(
      12,
      "user@example.com",
      "old-release",
    );
  });

  it("rejects fractional ids and malformed tokens", async () => {
    expect((await GET(request(), context("12.5"))).status).toBe(400);
    expect(
      (await GET(request("?releaseId=bad%2Ftoken"), context("12"))).status,
    ).toBe(400);
    expect(getEventDetails).not.toHaveBeenCalled();
  });
});
