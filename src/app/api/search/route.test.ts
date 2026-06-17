import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/bq/search", () => ({ searchAll: vi.fn() }));

import { GET } from "./route";
import { getSessionUser } from "@/lib/auth/server";
import { searchAll } from "@/lib/bq/search";

const mockUser = getSessionUser as unknown as ReturnType<typeof vi.fn>;
const mockSearch = searchAll as unknown as ReturnType<typeof vi.fn>;

const req = (url: string) => new Request(url);

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(req("http://localhost/api/search?q=north"));
    expect(res.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("short-circuits to empty groups for queries under 2 chars", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    const res = await GET(req("http://localhost/api/search?q=a"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ regions: [], aos: [], pax: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns combined results on success", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    mockSearch.mockResolvedValue({
      regions: [{ region_id: 1 }],
      aos: [],
      pax: [],
    });
    const res = await GET(req("http://localhost/api/search?q=north"));
    expect(res.status).toBe(200);
    expect((await res.json()).regions).toHaveLength(1);
  });

  // POSTMORTEM REGRESSION: a BigQuery failure must surface as HTTP 500,
  // NOT a 200 with empty result groups that the UI reads as "no results".
  it("returns 500 (not 200 + empty groups) when BigQuery throws", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    mockSearch.mockRejectedValue(new Error("BigQuery location mismatch"));

    const res = await GET(req("http://localhost/api/search?q=north"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("errorId");
    expect(body).not.toHaveProperty("regions");
  });
});
