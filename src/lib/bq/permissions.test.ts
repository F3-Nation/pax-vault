import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock BigQuery helper
vi.mock("@/lib/db", () => {
  return {
    queryBigQuery: vi.fn(),
  };
});

import { queryBigQuery } from "@/lib/db";
import { ADMIN_ROLE_ID, getRegionPermission } from "./permissions";

const mockQuery = queryBigQuery as unknown as ReturnType<typeof vi.fn>;

describe("bq/permissions.ts getRegionPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads role grants from pv_pax only, with every value bound as a parameter", async () => {
    mockQuery.mockResolvedValue([{ user_id: 318, is_admin: true }]);

    await getRegionPermission("  Dredd@Example.com ", 40364);

    const q = String(mockQuery.mock.calls[0]?.[0] ?? "");
    expect(q).toContain("FROM pv_pax");
    expect(q).toContain("FROM UNNEST(roles) r");
    expect(q).not.toContain("f3data.public");
    expect(q).toContain("r.org_id = @regionId");
    expect(q).toContain("r.role_id = @adminRoleId");
    expect(q).toContain("LOWER(email) = @email");
    // Values are bound as named parameters, never interpolated.
    expect(q).not.toContain("dredd@example.com");
    expect(q).not.toContain("40364");
    expect(mockQuery.mock.calls[0]?.[3]).toEqual({
      email: "dredd@example.com",
      regionId: 40364,
      adminRoleId: ADMIN_ROLE_ID,
    });
  });

  it("maps the row to userId / isAdmin", async () => {
    mockQuery.mockResolvedValue([{ user_id: 318, is_admin: true }]);

    expect(await getRegionPermission("dredd@example.com", 40364)).toEqual({
      userId: 318,
      isAdmin: true,
    });
  });

  it("treats an unmatched email as no user and not admin", async () => {
    mockQuery.mockResolvedValue([{ user_id: null, is_admin: false }]);

    expect(await getRegionPermission("nobody@example.com", 40364)).toEqual({
      userId: null,
      isAdmin: false,
    });
  });

  it("only accepts a literal true for isAdmin", async () => {
    mockQuery.mockResolvedValue([{ user_id: 318, is_admin: null }]);

    expect((await getRegionPermission("dredd@example.com", 1)).isAdmin).toBe(
      false,
    );
  });

  it("skips BigQuery for a blank email or an invalid region id", async () => {
    expect(await getRegionPermission("   ", 40364)).toEqual({
      userId: null,
      isAdmin: false,
    });
    expect(await getRegionPermission("dredd@example.com", 0)).toEqual({
      userId: null,
      isAdmin: false,
    });
    expect(await getRegionPermission("dredd@example.com", 1.5)).toEqual({
      userId: null,
      isAdmin: false,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
