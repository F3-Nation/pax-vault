import { describe, expect, it } from "vitest";
import { DuckDbDependencyError, DuckDbQueryError } from "@/lib/duckdb/errors";
import { DuckDbUnavailable } from "./DuckDbUnavailable";

describe("DuckDB SSR unavailable boundary", () => {
  it("renders an alert that does not claim an HTTP status", () => {
    const element = DuckDbUnavailable();
    expect(element.props["data-state"]).toBe("data-unavailable");
    expect(element.props.role).toBe("alert");
    expect(JSON.stringify(element)).not.toContain("503");
  });

  it("only treats dependency errors as unavailable", () => {
    expect(new DuckDbDependencyError().code).toBe("DUCKDB_DEPENDENCY");
    expect(new DuckDbQueryError().code).not.toBe("DUCKDB_DEPENDENCY");
  });
});
