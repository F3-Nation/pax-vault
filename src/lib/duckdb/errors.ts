export type DuckDbRejectionCategory =
  | "pointer-generation-race"
  | "pointer-validation"
  | "repository-gcs"
  | "integrity-schema"
  | "native-open"
  | "unavailable";

export class DuckDbError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DuckDbError";
  }
}

export class DuckDbConfigError extends DuckDbError {
  constructor(message: string) {
    super(message, "DUCKDB_CONFIG");
  }
}

export class DuckDbReleaseError extends DuckDbError {
  constructor(
    message: string,
    public readonly rejectionCategory: DuckDbRejectionCategory = "integrity-schema",
    options?: ErrorOptions,
  ) {
    super(message, "DUCKDB_RELEASE", options);
  }
}

export class DuckDbUnavailableError extends DuckDbError {
  constructor(
    message = "DuckDB release is unavailable",
    options?: ErrorOptions,
  ) {
    super(message, "DUCKDB_UNAVAILABLE", options);
  }
}

export class DuckDbQueryError extends DuckDbError {
  constructor(message = "DuckDB query failed", options?: ErrorOptions) {
    super(message, "DUCKDB_QUERY", options);
  }
}

export class DuckDbReleaseConflictError extends DuckDbError {
  constructor() {
    super(
      "Event details release does not match the requested event release",
      "DUCKDB_RELEASE_CONFLICT",
    );
  }
}

export class DuckDbDependencyError extends DuckDbError {
  constructor(
    message = "DuckDB dependency unavailable",
    options?: ErrorOptions,
  ) {
    super(message, "DUCKDB_DEPENDENCY", options);
  }
}
