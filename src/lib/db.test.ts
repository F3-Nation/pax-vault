import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: class {
    query = query;
  },
}));

import { queryBigQuery } from "./db";

describe("queryBigQuery logging", () => {
  beforeEach(() => {
    query.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs sanitized completion timing and returns normalized rows", async () => {
    query.mockResolvedValue([[{ answer: { value: 42 } }]]);

    await expect(
      queryBigQuery(
        "SELECT @secret",
        "Alice.Example@example.com",
        "preferences lookup",
        {
          secret: "do-not-log",
        },
      ),
    ).resolves.toEqual([{ answer: 42 }]);

    const log = console.log as unknown as ReturnType<typeof vi.fn>;
    const completion = JSON.parse(String(log.mock.calls[1]?.[0]));
    expect(completion).toMatchObject({
      user: "ali----example-com",
      reason: "preferences_lookup",
      durationMs: expect.any(Number),
      message: "BigQuery fetch completed",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("SELECT");
    expect(JSON.stringify(log.mock.calls)).not.toContain("do-not-log");
  });

  it("logs failure timing without exposing the error and rethrows it", async () => {
    const error = new Error("sensitive backend detail");
    query.mockRejectedValue(error);

    await expect(
      queryBigQuery("SELECT secret", "user@example.com", "admin lookup"),
    ).rejects.toBe(error);

    const log = console.error as unknown as ReturnType<typeof vi.fn>;
    const failure = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(failure).toMatchObject({
      reason: "admin_lookup",
      durationMs: expect.any(Number),
      message: "BigQuery fetch failed",
    });
    expect(JSON.stringify(failure)).not.toContain("sensitive backend detail");
    expect(JSON.stringify(failure)).not.toContain("SELECT");
  });
});
