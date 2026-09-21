import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock BigQuery helper
vi.mock("@/lib/db", () => {
  return {
    queryBigQuery: vi.fn(),
  };
});

import { queryBigQuery } from "@/lib/db";
import { getEventDetails } from "./events";

function lastQuery(): string {
  const calls = (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mock
    .calls;
  if (!calls.length)
    throw new Error("Expected queryBigQuery to have been called");
  return String(calls[calls.length - 1]?.[0] ?? "");
}

describe("bq/events.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a query against pv_events with a parameterized id filter and limit", async () => {
    const mock = queryBigQuery as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValue([]);

    await getEventDetails(999);

    const q = lastQuery();
    expect(q).toContain("FROM pv_events");
    expect(q).not.toContain("f3data.public");
    expect(q).toContain("WHERE event_id = @eventInstanceId");
    expect(q).toContain("LIMIT 1");
    // The id is bound as a named parameter, never interpolated.
    expect(q).not.toContain("999");
    expect(mock.mock.calls[0]?.[3]).toEqual({ eventInstanceId: 999 });
  });

  it("returns null when no event is found", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    const res = await getEventDetails(123);

    expect(res).toBeNull();
  });

  it("returns event details when found", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 123,
        description: "Test description",
        preblast: null,
        preblast_rich: null,
        backblast: null,
        backblast_rich: null,
        meta: null,
      },
    ]);

    const res = await getEventDetails(123);

    expect(res).toEqual({
      id: 123,
      description: "Test description",
      preblast: null,
      preblast_rich: null,
      backblast: null,
      backblast_rich: null,
      meta: null,
    });
  });

  it("parses JSON meta when meta is present", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 456,
        description: "With meta",
        preblast: null,
        preblast_rich: null,
        backblast: null,
        backblast_rich: null,
        meta: '{"files":["a.txt"],"flag":true}',
      },
    ]);

    const res = await getEventDetails(456);

    expect(res?.meta).toEqual({
      files: ["a.txt"],
      flag: true,
    });
  });

  it("does not throw when meta JSON is invalid", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 789,
        description: "Bad meta",
        preblast: null,
        preblast_rich: null,
        backblast: null,
        backblast_rich: null,
        meta: "{not-valid-json",
      },
    ]);

    const res = await getEventDetails(789);

    // Meta should be returned as-is when parsing fails
    expect(res?.meta).toBe("{not-valid-json");
  });
});
