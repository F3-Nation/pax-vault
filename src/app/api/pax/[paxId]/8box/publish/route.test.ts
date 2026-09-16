import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ isOwnPax: vi.fn() }));
vi.mock("@/lib/bq/eightBox", () => ({
  getEightBoxPageData: vi.fn(),
  publishEightBox: vi.fn(),
}));

import { POST } from "./route";
import { getSessionUser } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxPageData, publishEightBox } from "@/lib/bq/eightBox";

const mockUser = getSessionUser as unknown as ReturnType<typeof vi.fn>;
const mockOwn = isOwnPax as unknown as ReturnType<typeof vi.fn>;
const mockRead = getEightBoxPageData as unknown as ReturnType<typeof vi.fn>;
const mockPublish = publishEightBox as unknown as ReturnType<typeof vi.fn>;

const DRAFT_ID = "11111111-2222-4333-8444-555555555555";

function post(paxId: string, body: unknown) {
  const req = new Request(`http://localhost/api/pax/${paxId}/8box/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ paxId }) });
}

describe("POST /api/pax/[paxId]/8box/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUser.mockResolvedValue({ email: "u@x.com", paxId: 42 });
    mockOwn.mockResolvedValue(true);
    mockRead.mockResolvedValue({ info: null, draft: null, versions: [] });
    mockPublish.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    expect((await post("42", { boxes: { alr: "x" } })).status).toBe(401);
  });

  it("returns 403 for someone else's PAX", async () => {
    mockOwn.mockResolvedValue(false);
    expect((await post("42", { boxes: { alr: "x" } })).status).toBe(403);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("refuses to publish an all-blank board", async () => {
    const res = await post("42", { boxes: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one box/i);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("publishes version 1 when there is no history", async () => {
    const res = await post("42", { period: "2026-Q3", boxes: { alr: "x" } });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.period).toBe("2026-Q3");
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ id: body.id, paxId: 42, version: 1 }),
      "u@x.com",
    );
  });

  it("assigns max + 1 (gaps from deletes do not renumber) and reuses the draft id", async () => {
    mockRead.mockResolvedValue({
      info: null,
      draft: { id: DRAFT_ID },
      versions: [{ version: 5 }, { version: 2 }],
    });
    const res = await post("42", { boxes: { alr: "x" } });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(DRAFT_ID);
    expect(body.version).toBe(6);
  });

  // POSTMORTEM REGRESSION
  it("returns 500 with an errorId when the write throws", async () => {
    mockPublish.mockRejectedValue(new Error("boom"));
    const res = await post("42", { boxes: { alr: "x" } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("errorId");
    expect(body).not.toHaveProperty("id");
  });

  it("returns 503 when the service account lacks write access", async () => {
    mockPublish.mockRejectedValue(
      new Error("Access Denied: ... bigquery.tables.updateData denied"),
    );
    expect((await post("42", { boxes: { alr: "x" } })).status).toBe(503);
  });
});
