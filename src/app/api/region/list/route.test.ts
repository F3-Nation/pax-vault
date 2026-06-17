import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth + the BigQuery search function the route delegates to.
vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/bq/regions", () => ({ searchRegionsByName: vi.fn() }));

import { GET } from "./route";
import { getSessionUser } from "@/lib/auth/server";
import { searchRegionsByName } from "@/lib/bq/regions";

const mockUser = getSessionUser as unknown as ReturnType<typeof vi.fn>;
const mockSearch = searchRegionsByName as unknown as ReturnType<typeof vi.fn>;

const req = (url: string) => new Request(url);

describe("GET /api/region/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(req("http://localhost/api/region/list?q=north"));
    expect(res.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("short-circuits to [] for queries under 2 chars (no BQ call)", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    const res = await GET(req("http://localhost/api/region/list?q=a"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns results on success", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    mockSearch.mockResolvedValue([{ region_id: 1, region_name: "Northlake" }]);
    const res = await GET(req("http://localhost/api/region/list?q=north"));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  // POSTMORTEM REGRESSION (issue #60 / silent-failures):
  // a BigQuery failure must surface as HTTP 500, NOT 200 + [].
  it("returns 500 with an error body (not 200 + []) when BigQuery throws", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    mockSearch.mockRejectedValue(new Error("Table not found: pv_regions"));

    const res = await GET(req("http://localhost/api/region/list?q=north"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("errorId");
  });
});
