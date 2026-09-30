import { describe, it, expect, vi, beforeEach } from "vitest";

const { bigQueryMock, duckQueryMock } = vi.hoisted(() => ({
  bigQueryMock: vi.fn(),
  duckQueryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ queryBigQuery: bigQueryMock }));
vi.mock("@/lib/duckdb/factory", () => ({
  getDuckDbRuntime: vi.fn(() => ({})),
}));
vi.mock("@/lib/duckdb/query", () => ({
  DuckDbQueryAdapter: class {
    execute = duckQueryMock;
  },
  selectDuckDbOrLegacy: async (selection: {
    env?: NodeJS.ProcessEnv;
    duckdb: () => Promise<unknown>;
    legacy: () => Promise<unknown>;
  }) =>
    selection.env?.DUCKDB_ENABLED === "true" &&
    selection.env?.DUCKDB_EVENTS_ENABLED !== "false"
      ? selection.duckdb()
      : selection.legacy(),
}));

import { queryBigQuery } from "@/lib/db";
import { getEventDetails } from "./events";

function lastCall(): [
  string,
  string | undefined,
  string | undefined,
  Record<string, unknown> | undefined,
] {
  const calls = (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mock
    .calls;
  if (!calls.length)
    throw new Error("Expected queryBigQuery to have been called");
  return calls[calls.length - 1] as [
    string,
    string | undefined,
    string | undefined,
    Record<string, unknown> | undefined,
  ];
}

describe("bq/events.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DUCKDB_ENABLED;
    delete process.env.DUCKDB_EVENTS_ENABLED;
  });

  it("builds a query against pv_events with a parameterized id filter and limit", async () => {
    const mock = queryBigQuery as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValue([]);

    await getEventDetails(999);

    const [q, , , params] = lastCall();
    expect(q).toContain("FROM pv_events");
    expect(q).not.toContain("f3data.public");
    expect(q).toContain("WHERE event_id = @eventInstanceId");
    expect(q).toContain("LIMIT 1");
    expect(params).toEqual({ eventInstanceId: 999 });
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

  it("uses DuckDB for event details when the events capability is enabled", async () => {
    process.env.DUCKDB_ENABLED = "true";
    duckQueryMock.mockResolvedValue([
      {
        id: 321,
        description: "DuckDB event",
        preblast: null,
        preblast_rich: '{"blocks":[{"type":"paragraph"}]}',
        backblast: "Plain backblast",
        backblast_rich: null,
        meta: '{"files":["photo.jpg"],"flag":true}',
      },
    ]);

    await expect(getEventDetails(321, "ignored@example.com")).resolves.toEqual({
      id: 321,
      description: "DuckDB event",
      preblast: null,
      preblast_rich: '{"blocks":[{"type":"paragraph"}]}',
      backblast: "Plain backblast",
      backblast_rich: null,
      meta: { files: ["photo.jpg"], flag: true },
    });
    expect(duckQueryMock).toHaveBeenCalledOnce();
    const [sql, params] = duckQueryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("FROM pv_events");
    expect(sql).toContain("WHERE event_id = ?");
    expect(sql).toContain("preblast_rich");
    expect(sql).toContain("backblast_rich");
    expect(sql).not.toContain("@eventInstanceId");
    expect(params).toEqual([321]);
    expect(bigQueryMock).not.toHaveBeenCalled();
  });

  it("keeps BigQuery for event details when the events capability is disabled", async () => {
    process.env.DUCKDB_ENABLED = "true";
    process.env.DUCKDB_EVENTS_ENABLED = "false";
    bigQueryMock.mockResolvedValue([]);

    await expect(getEventDetails(654)).resolves.toBeNull();

    expect(bigQueryMock).toHaveBeenCalledOnce();
    expect(duckQueryMock).not.toHaveBeenCalled();
    expect(lastCall()[3]).toEqual({ eventInstanceId: 654 });
  });

  it("returns null for a missing DuckDB detail row", async () => {
    process.env.DUCKDB_ENABLED = "true";
    duckQueryMock.mockResolvedValue([]);

    await expect(getEventDetails(999)).resolves.toBeNull();
    expect(bigQueryMock).not.toHaveBeenCalled();
  });

  it("preserves null metadata and propagates DuckDB errors without BQ fallback", async () => {
    process.env.DUCKDB_ENABLED = "true";
    duckQueryMock.mockResolvedValueOnce([
      {
        id: 111,
        description: "No metadata",
        preblast: null,
        preblast_rich: null,
        backblast: null,
        backblast_rich: null,
        meta: null,
      },
    ]);
    const details = await getEventDetails(111);
    expect(details?.meta).toBeNull();

    const error = new Error("DuckDB detail query failed");
    duckQueryMock.mockRejectedValueOnce(error);
    await expect(getEventDetails(112)).rejects.toBe(error);
    expect(bigQueryMock).not.toHaveBeenCalled();
  });
});
