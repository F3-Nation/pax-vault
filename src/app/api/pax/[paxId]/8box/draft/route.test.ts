import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ queryBigQuery: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ isOwnPax: vi.fn() }));
vi.mock("@/lib/bq/eightBox", () => ({
  getEightBoxPageData: vi.fn(),
  saveEightBoxDraft: vi.fn(),
}));

import { PUT } from "./route";
import { getSessionUser } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxPageData, saveEightBoxDraft } from "@/lib/bq/eightBox";

const mockUser = getSessionUser as unknown as ReturnType<typeof vi.fn>;
const mockOwn = isOwnPax as unknown as ReturnType<typeof vi.fn>;
const mockRead = getEightBoxPageData as unknown as ReturnType<typeof vi.fn>;
const mockSave = saveEightBoxDraft as unknown as ReturnType<typeof vi.fn>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function put(paxId: string, body: unknown) {
  const req = new Request(`http://localhost/api/pax/${paxId}/8box/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ paxId }) });
}

describe("PUT /api/pax/[paxId]/8box/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUser.mockResolvedValue({ email: "u@x.com", paxId: 42 });
    mockOwn.mockResolvedValue(true);
    mockRead.mockResolvedValue({ info: null, draft: null, versions: [] });
    mockSave.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await put("42", { boxes: {} });
    expect(res.status).toBe(401);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad pax id", async () => {
    const res = await put("abc", { boxes: {} });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await put("42", "{not json");
    expect(res.status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user is not this PAX", async () => {
    mockOwn.mockResolvedValue(false);
    const res = await put("42", { boxes: { jester: "x" } });
    expect(res.status).toBe(403);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("accepts an all-blank draft and mints an id on first save", async () => {
    const res = await put("42", { boxes: {} });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toMatch(UUID_RE);
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: body.id, paxId: 42 }),
      "u@x.com",
    );
  });

  it("reuses the existing draft id and drops injected keys", async () => {
    mockRead.mockResolvedValue({
      info: null,
      draft: { id: "11111111-2222-4333-8444-555555555555" },
      versions: [],
    });
    const res = await put("42", {
      period: "2026-Q3",
      word: " Steady ",
      boxes: {
        jester: {
          fields: { discussWith: " Tackle ", evil: "x" },
          items: [{ what: "snooze", answer: "", evil: "y" }],
        },
        evil: "x",
      },
      paxId: 999,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("11111111-2222-4333-8444-555555555555");
    const write = mockSave.mock.calls[0][0];
    expect(write.paxId).toBe(42);
    expect(write.content.word).toBe("Steady");
    expect(write.content.boxes.jester.fields.discussWith).toBe("Tackle");
    expect(write.content.boxes.jester.items).toEqual([
      { what: "snooze", answer: "" },
    ]);
    expect("evil" in write.content.boxes.jester.fields).toBe(false);
    expect("evil" in write.content.boxes).toBe(false);
  });

  it("returns 400 with the validation message for an over-long field", async () => {
    const res = await put("42", {
      boxes: { alr: { fields: { mentor: "x".repeat(81) } } },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too long/);
    expect(mockSave).not.toHaveBeenCalled();
  });

  // POSTMORTEM REGRESSION: a BigQuery failure must surface as HTTP 500 with
  // an error body — never a 200 the UI would read as "saved".
  it("returns 500 (not 200) when the write throws", async () => {
    mockSave.mockRejectedValue(new Error("BigQuery location mismatch"));
    const res = await put("42", { boxes: { alr: "x" } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("errorId");
    expect(body).not.toHaveProperty("id");
  });

  it("returns 500 when the owner lookup itself fails (failure is not denial)", async () => {
    mockOwn.mockRejectedValue(new Error("BigQuery down"));
    const res = await put("42", { boxes: { alr: "x" } });
    expect(res.status).toBe(500);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns an actionable 503 when the service account lacks write access", async () => {
    mockSave.mockRejectedValue(
      new Error(
        "Access Denied: Table f3data:paxVault.pv_pax_eight_box: Permission bigquery.tables.updateData denied",
      ),
    );
    const res = await put("42", { boxes: { alr: "x" } });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/pv_pax_eight_box/);
  });
});
