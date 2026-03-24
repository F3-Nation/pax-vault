import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./loader", () => ({
  loadAOData: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
  requireAuth: vi.fn(),
}));

import { getSessionUser } from "@/lib/auth/server";
import { loadAOData } from "./loader";
import { generateMetadata } from "./page";
import type { AOData } from "@/lib/types";

describe("ao page metadata auth gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback metadata and skips loading when unauthenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ aoId: "321" }),
    });

    expect(metadata.title).toBe("AO Stats");
    expect(loadAOData).not.toHaveBeenCalled();
  });

  it("loads ao metadata when authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      sub: "user-1",
      email: "u@example.com",
      iat: 1,
    });
    vi.mocked(loadAOData).mockResolvedValue({
      info: { ao_name: "The Pit" },
    } as AOData);

    const metadata = await generateMetadata({
      params: Promise.resolve({ aoId: "321" }),
    });

    expect(loadAOData).toHaveBeenCalledWith(321, "u@example.com");
    expect(metadata.title).toBe("The Pit");
  });
});
