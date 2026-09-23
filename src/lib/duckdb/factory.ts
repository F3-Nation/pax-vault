import { readDuckDbConfig, DuckDbConfig } from "./config";
import { DuckDbUnavailableError } from "./errors";
import { GoogleCloudStorageClient, GcsReleaseRepository } from "./gcs";
import { DuckDbLease, DuckDbRuntime, DuckDbRuntimeStatus } from "./runtime";
import { assertDuckDbServerRuntime } from "./server";
import { reportError } from "../observability";

export interface DuckDbRuntimeService {
  acquire(): Promise<DuckDbLease>;
  refresh(): Promise<void>;
  close(): Promise<void>;
  status(): DuckDbRuntimeStatus;
}

class DisabledDuckDbRuntime implements DuckDbRuntimeService {
  async acquire(): Promise<DuckDbLease> {
    throw new DuckDbUnavailableError();
  }
  async refresh(): Promise<void> {
    throw new DuckDbUnavailableError();
  }
  async close(): Promise<void> {
    return undefined;
  }
  status(): DuckDbRuntimeStatus {
    return {
      enabled: false,
      state: "disabled",
      lkgState: "none",
      refreshFailureCount: 0,
      leaseCount: 0,
      refreshWaiterCount: 0,
    };
  }
}

let singleton: DuckDbRuntimeService | undefined;
/** Test-only runtime seam. Reset with resetDuckDbRuntimeForTests(). */
export function setDuckDbRuntimeForTests(runtime?: DuckDbRuntimeService): void {
  singleton = runtime;
}
export function getDuckDbRuntime(
  env?: NodeJS.ProcessEnv,
): DuckDbRuntimeService {
  assertDuckDbServerRuntime("getDuckDbRuntime");
  if (singleton) return singleton;
  const config: DuckDbConfig = readDuckDbConfig(env);
  if (!config.enabled) {
    singleton = new DisabledDuckDbRuntime();
    return singleton;
  }
  const repository = new GcsReleaseRepository(
    new GoogleCloudStorageClient(),
    config,
  );
  singleton = new DuckDbRuntime(
    repository,
    config,
    undefined,
    (_error: unknown, telemetry?: Record<string, unknown>) => {
      // Repository/native errors may contain object paths or other sensitive
      // details. Runtime telemetry already carries the safe rejection category.
      reportError(new Error("DuckDB runtime failure"), {
        scope: "duckdb/runtime",
        extra: telemetry,
      });
    },
  );
  return singleton;
}

export async function resetDuckDbRuntimeForTests(): Promise<void> {
  const previous = singleton;
  singleton = undefined;
  await previous?.close();
}
