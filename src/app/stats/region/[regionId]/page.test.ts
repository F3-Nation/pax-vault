import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./loader", () => ({
  loadRegionData: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
  requireAuth: vi.fn(),
}));

import { getSessionUser } from "@/lib/auth/server";
import { loadRegionData } from "./loader";
import { generateMetadata } from "./page";
import type { RegionData } from "@/lib/types";

describe("region page metadata auth gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback metadata and skips loading when unauthenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ regionId: "370" }),
    });

    expect(metadata.title).toBe("F3 Region Stats");
    expect(loadRegionData).not.toHaveBeenCalled();
  });

  it("loads region metadata when authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      sub: "user-1",
      email: "u@example.com",
      iat: 1,
    });
    vi.mocked(loadRegionData).mockResolvedValue({
      info: { region_name: "Nation" },
    } as RegionData);

    const metadata = await generateMetadata({
      params: Promise.resolve({ regionId: "370" }),
    });

    expect(loadRegionData).toHaveBeenCalledWith(370, "u@example.com");
    expect(metadata.title).toBe("F3 Nation");
  });
});
