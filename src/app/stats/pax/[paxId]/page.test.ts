import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./loader", () => ({
  loadPaxData: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
  requireAuth: vi.fn(),
}));

import { getSessionUser } from "@/lib/auth/server";
import { loadPaxData } from "./loader";
import { generateMetadata } from "./page";

describe("pax page metadata auth gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback metadata and skips loading when unauthenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ paxId: "123" }),
    });

    expect(metadata.title).toBe("PAX Stats");
    expect(loadPaxData).not.toHaveBeenCalled();
  });

  it("loads pax metadata when authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      sub: "user-1",
      email: "u@example.com",
      iat: 1,
    });
    vi.mocked(loadPaxData).mockResolvedValue({
      info: { f3_name: "Alpha" },
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ paxId: "123" }),
    });

    expect(loadPaxData).toHaveBeenCalledWith(123);
    expect(metadata.title).toBe("Alpha");
  });
});
