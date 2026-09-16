import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/bq/permissions", () => ({ getRegionPermission: vi.fn() }));
vi.mock("@/lib/bq/pax", () => ({ getPaxIdentityByEmail: vi.fn() }));

import { getOwnPaxIdForSession, isOwnPax } from "./permissions";
import { getSessionUser } from "@/lib/auth/server";
import { getPaxIdentityByEmail } from "@/lib/bq/pax";

const mockUser = getSessionUser as unknown as ReturnType<typeof vi.fn>;
const mockIdentity = getPaxIdentityByEmail as unknown as ReturnType<
  typeof vi.fn
>;

describe("getOwnPaxIdForSession / isOwnPax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is null without a session and never touches BigQuery", async () => {
    mockUser.mockResolvedValue(null);
    expect(await getOwnPaxIdForSession()).toBeNull();
    expect(await isOwnPax(42)).toBe(false);
    expect(mockIdentity).not.toHaveBeenCalled();
  });

  it("uses the session paxId without a lookup", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com", paxId: 42 });
    expect(await getOwnPaxIdForSession()).toBe(42);
    expect(await isOwnPax(42)).toBe(true);
    expect(await isOwnPax(43)).toBe(false);
    expect(mockIdentity).not.toHaveBeenCalled();
  });

  it("falls back to the email lookup for sessions without paxId", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    mockIdentity.mockResolvedValue({ paxId: 7, homeRegionId: null });
    expect(await getOwnPaxIdForSession()).toBe(7);
    expect(mockIdentity).toHaveBeenCalledWith("u@x.com", "u@x.com");
  });

  it("treats paxLookedUp with no paxId as a definitive null", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com", paxLookedUp: true });
    expect(await getOwnPaxIdForSession()).toBeNull();
    expect(mockIdentity).not.toHaveBeenCalled();
  });

  it("rejects invalid pax ids without a lookup", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    expect(await isOwnPax(0)).toBe(false);
    expect(await isOwnPax(1.5)).toBe(false);
    expect(mockIdentity).not.toHaveBeenCalled();
  });

  // Lookup failure is not denial: the error must propagate so the caller can
  // return a 500, rather than silently treating the user as a stranger.
  it("propagates a failing lookup instead of returning false", async () => {
    mockUser.mockResolvedValue({ email: "u@x.com" });
    mockIdentity.mockRejectedValue(new Error("BigQuery down"));
    await expect(isOwnPax(7)).rejects.toThrow("BigQuery down");
  });
});
