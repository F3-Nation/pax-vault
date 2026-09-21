import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock BigQuery helper
vi.mock("@/lib/db", () => {
  return {
    queryBigQuery: vi.fn(),
  };
});

import { queryBigQuery } from "@/lib/db";
import { isAuthorizedEmail } from "./allowlist";

const mockQuery = queryBigQuery as unknown as ReturnType<typeof vi.fn>;

describe("auth/allowlist.ts isAuthorizedEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_EMAIL_TABLE", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("checks pv_pax by default, with the normalized email bound as a parameter", async () => {
    mockQuery.mockResolvedValue([{ ok: 1 }]);

    expect(await isAuthorizedEmail("  Dredd@Example.com ")).toBe(true);

    const q = String(mockQuery.mock.calls[0]?.[0] ?? "");
    expect(q).toContain("FROM `pv_pax`");
    expect(q).not.toContain("f3data.public");
    expect(q).toContain("LOWER(email) = @email");
    // The email is bound as a named parameter, never interpolated.
    expect(q).not.toContain("dredd@example.com");
    expect(mockQuery.mock.calls[0]?.[3]).toEqual({
      email: "dredd@example.com",
    });
  });

  it("rejects an email with no matching row", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await isAuthorizedEmail("nobody@example.com")).toBe(false);
  });

  it("rejects a blank email without querying BigQuery", async () => {
    expect(await isAuthorizedEmail("   ")).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("honors the AUTH_EMAIL_TABLE override", async () => {
    vi.stubEnv("AUTH_EMAIL_TABLE", "f3data.paxVault.some_other_table");
    mockQuery.mockResolvedValue([]);

    await isAuthorizedEmail("dredd@example.com");

    expect(String(mockQuery.mock.calls[0]?.[0])).toContain(
      "FROM `f3data.paxVault.some_other_table`",
    );
  });
});
