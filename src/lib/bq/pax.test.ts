import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock BigQuery helper
vi.mock("@/lib/db", () => {
  return {
    queryBigQuery: vi.fn(),
  };
});

import { queryBigQuery } from "@/lib/db";
import { getPaxIdentityByEmail } from "./pax";

const mockQuery = queryBigQuery as unknown as ReturnType<typeof vi.fn>;

describe("bq/pax.ts getPaxIdentityByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries pv_pax only, with the normalized email bound as a parameter", async () => {
    mockQuery.mockResolvedValue([]);

    await getPaxIdentityByEmail("  Dredd@Example.com ");

    const q = String(mockQuery.mock.calls[0]?.[0] ?? "");
    expect(q).toContain("FROM pv_pax");
    expect(q).not.toContain("f3data.public");
    expect(q).toContain("LOWER(email) = @email");
    expect(q).toContain("ORDER BY user_id");
    expect(q).toContain("LIMIT 1");
    // The email is bound as a named parameter, never interpolated.
    expect(q).not.toContain("dredd@example.com");
    expect(mockQuery.mock.calls[0]?.[3]).toEqual({
      email: "dredd@example.com",
    });
  });

  it("returns null when the email has no pv_pax row", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getPaxIdentityByEmail("nobody@example.com")).toBeNull();
  });

  it("maps the row to numbers and keeps a null home region", async () => {
    mockQuery.mockResolvedValue([{ pax_id: "318", home_region_id: null }]);

    expect(await getPaxIdentityByEmail("dredd@example.com")).toEqual({
      paxId: 318,
      homeRegionId: null,
    });
  });
});
