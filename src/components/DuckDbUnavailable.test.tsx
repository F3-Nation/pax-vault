import { describe, expect, it } from "vitest";
import { DuckDbDependencyError, DuckDbQueryError } from "@/lib/duckdb/errors";
import { DuckDbUnavailable } from "./DuckDbUnavailable";

describe("DuckDB SSR unavailable boundary", () => {
  it("renders an explicit 503 boundary", () => {
    const element = DuckDbUnavailable();
    expect(element.props["data-status"]).toBe("503");
    expect(element.props.role).toBe("alert");
  });

  it("only treats dependency errors as unavailable", () => {
    expect(new DuckDbDependencyError().code).toBe("DUCKDB_DEPENDENCY");
    expect(new DuckDbQueryError().code).not.toBe("DUCKDB_DEPENDENCY");
  });
});
