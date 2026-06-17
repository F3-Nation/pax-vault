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
    expect(payload.user).toBe("u@x.com");
    expect(payload.message).toBe("explode");
    expect(payload.level).toBe("error");
  });
});
