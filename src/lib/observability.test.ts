import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeErrorId, reportError } from "./observability";

describe("makeErrorId", () => {
  it("is stable for the same name:message", () => {
    const a = makeErrorId(new Error("boom"));
    const b = makeErrorId(new Error("boom"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("differs for different messages", () => {
    expect(makeErrorId(new Error("a"))).not.toBe(makeErrorId(new Error("b")));
  });

  it("handles non-Error values", () => {
    expect(makeErrorId("just a string")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("reportError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an id matching makeErrorId for the same error", () => {
    const err = new Error("kaboom");
    expect(reportError(err)).toBe(makeErrorId(err));
  });

  it("reuses a caller-supplied errorId", () => {
    expect(reportError(new Error("x"), { errorId: "deadbeef" })).toBe(
      "deadbeef",
    );
  });

  it("logs a structured line including scope and message", () => {
    const spy = console.error as unknown as ReturnType<typeof vi.fn>;
    reportError(new Error("explode"), { scope: "api/test", user: "u@x.com" });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.scope).toBe("api/test");
    expect(payload.user).toBeUndefined();
    expect(payload.userHash).toMatch(/^[0-9a-f]{8}$/);
    expect(payload.message).toBe("explode");
    expect(payload.level).toBe("error");
  });

  it("logs a safe summary of the cause chain without cause messages", () => {
    const spy = console.error as unknown as ReturnType<typeof vi.fn>;
    const native = new Error(
      "Out of Memory Error: failed to allocate 64MB reading /tmp/pax-vault-duckdb/x.parquet for John Doe",
    );
    const release = Object.assign(
      new Error("release repository failed", { cause: native }),
      {
        name: "DuckDbError",
        code: "DUCKDB_RELEASE",
        rejectionCategory: "repository-gcs",
      },
    );
    const top = new Error("DuckDB query failed", { cause: release });
    reportError(top, { scope: "api/events" });
    const line = String(spy.mock.calls[0]?.[0]);
    const payload = JSON.parse(line);
    expect(payload.causes).toEqual([
      {
        name: "DuckDbError",
        code: "DUCKDB_RELEASE",
        rejectionCategory: "repository-gcs",
      },
      { name: "Error", kind: "Out of Memory Error" },
    ]);
    expect(line).not.toContain("/tmp/pax-vault-duckdb");
    expect(line).not.toContain("John Doe");
  });

  it("omits causes when there are none and bounds a cyclic chain", () => {
    const spy = console.error as unknown as ReturnType<typeof vi.fn>;
    reportError(new Error("plain"));
    expect(JSON.parse(String(spy.mock.calls[0]?.[0])).causes).toBeUndefined();
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;
    reportError(a);
    expect(
      JSON.parse(String(spy.mock.calls[1]?.[0])).causes.length,
    ).toBeLessThanOrEqual(5);
  });

  it("ignores non-string codes and unrecognised message prefixes", () => {
    const spy = console.error as unknown as ReturnType<typeof vi.fn>;
    const cause = Object.assign(new Error("user@example.com: nope"), {
      code: 42,
    });
    reportError(new Error("top", { cause }));
    expect(JSON.parse(String(spy.mock.calls[0]?.[0])).causes).toEqual([
      { name: "Error" },
    ]);
  });

  it("logs durationMs from extra context", () => {
    const spy = console.error as unknown as ReturnType<typeof vi.fn>;
    reportError(new Error("slow"), { extra: { durationMs: 44123 } });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0])).context).toEqual({
      durationMs: 44123,
    });
  });
});
