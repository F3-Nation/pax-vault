import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ isOwnPax: vi.fn() }));
vi.mock("@/lib/bq/eightBox", () => ({
  getEightBoxVersionPageData: vi.fn(),
  deleteEightBoxRecord: vi.fn(),
  setEightBoxShared: vi.fn(),
}));

import { PATCH, DELETE } from "./route";
import { getSessionUser } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import {
  deleteEightBoxRecord,
  getEightBoxVersionPageData,
  setEightBoxShared,
} from "@/lib/bq/eightBox";

const mockUser = getSessionUser as unknown as ReturnType<typeof vi.fn>;
const mockOwn = isOwnPax as unknown as ReturnType<typeof vi.fn>;
const mockRead = getEightBoxVersionPageData as unknown as ReturnType<
  typeof vi.fn
>;
const mockDelete = deleteEightBoxRecord as unknown as ReturnType<typeof vi.fn>;
const mockShare = setEightBoxShared as unknown as ReturnType<typeof vi.fn>;

const ID = "11111111-2222-4333-8444-555555555555";

function ctx(paxId: string, versionId: string) {
  return { params: Promise.resolve({ paxId, versionId }) };
}

function patch(paxId: string, versionId: string, body: unknown) {
  const req = new Request(
    `http://localhost/api/pax/${paxId}/8box/${versionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return PATCH(req, ctx(paxId, versionId));
}

function del(paxId: string, versionId: string) {
  const req = new Request(
    `http://localhost/api/pax/${paxId}/8box/${versionId}`,
    { method: "DELETE" },
  );
  return DELETE(req, ctx(paxId, versionId));
}

describe("/api/pax/[paxId]/8box/[versionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUser.mockResolvedValue({ email: "u@x.com", paxId: 42 });
    mockOwn.mockResolvedValue(true);
    mockRead.mockResolvedValue({
      info: null,
      record: { id: ID, status: "published" },
    });
    mockDelete.mockResolvedValue(undefined);
    mockShare.mockResolvedValue(undefined);
  });

  describe("PATCH (share toggle)", () => {
    it("returns 401 when unauthenticated", async () => {
      mockUser.mockResolvedValue(null);
      expect((await patch("42", ID, { shared: true })).status).toBe(401);
    });

    it("returns 400 for a non-UUID version id", async () => {
      expect((await patch("42", "not-a-uuid", { shared: true })).status).toBe(
        400,
      );
      expect(mockRead).not.toHaveBeenCalled();
    });

    it("returns 400 when shared is not a boolean", async () => {
      expect((await patch("42", ID, { shared: "yes" })).status).toBe(400);
    });

    it("returns 403 for someone else's PAX", async () => {
      mockOwn.mockResolvedValue(false);
      expect((await patch("42", ID, { shared: true })).status).toBe(403);
      expect(mockShare).not.toHaveBeenCalled();
    });

    it("returns 404 when the row is not this PAX's", async () => {
      mockRead.mockResolvedValue({ info: null, record: null });
      expect((await patch("42", ID, { shared: true })).status).toBe(404);
      expect(mockShare).not.toHaveBeenCalled();
    });

    it("returns 409 for a draft", async () => {
      mockRead.mockResolvedValue({
        info: null,
        record: { id: ID, status: "draft" },
      });
      expect((await patch("42", ID, { shared: true })).status).toBe(409);
      expect(mockShare).not.toHaveBeenCalled();
    });

    it("turns sharing on and off", async () => {
      const on = await patch("42", ID, { shared: true });
      expect(on.status).toBe(200);
      const onBody = await on.json();
      expect(onBody.shared).toBe(true);
      expect(typeof onBody.sharedAt).toBe("string");
      expect(mockShare).toHaveBeenCalledWith(42, ID, true, "u@x.com");

      const off = await patch("42", ID, { shared: false });
      expect((await off.json()).sharedAt).toBeNull();
      expect(mockShare).toHaveBeenLastCalledWith(42, ID, false, "u@x.com");
    });

    it("returns 500 with an errorId when the write throws", async () => {
      mockShare.mockRejectedValue(new Error("boom"));
      const res = await patch("42", ID, { shared: true });
      expect(res.status).toBe(500);
      expect(await res.json()).toHaveProperty("errorId");
    });
  });

  describe("DELETE", () => {
    it("returns 403 for someone else's PAX", async () => {
      mockOwn.mockResolvedValue(false);
      expect((await del("42", ID)).status).toBe(403);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("returns 404 when the row is not this PAX's", async () => {
      mockRead.mockResolvedValue({ info: null, record: null });
      expect((await del("42", ID)).status).toBe(404);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("deletes and reports what was deleted", async () => {
      const res = await del("42", ID);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        id: ID,
        deleted: true,
        status: "published",
      });
      expect(mockDelete).toHaveBeenCalledWith(42, ID, "u@x.com");
    });

    it("returns 500 with an errorId when the delete throws", async () => {
      mockDelete.mockRejectedValue(new Error("boom"));
      const res = await del("42", ID);
      expect(res.status).toBe(500);
      expect(await res.json()).toHaveProperty("errorId");
    });
  });
});
