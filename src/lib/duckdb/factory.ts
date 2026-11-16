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

// The runtime lives on globalThis, not in module scope: Next.js bundles
// instrumentation.ts separately from route handlers, so module state is
// duplicated per bundle. A module-level singleton made the instrumentation
// pre-warm populate one runtime while requests used another, downloading every
// release twice per instance.
const RUNTIME_KEY = Symbol.for("pax-vault.duckdb.runtime");
type RuntimeHolder = { [RUNTIME_KEY]?: DuckDbRuntimeService };
const holder = globalThis as RuntimeHolder;

/** Test-only runtime seam. Reset with resetDuckDbRuntimeForTests(). */
export function setDuckDbRuntimeForTests(runtime?: DuckDbRuntimeService): void {
  holder[RUNTIME_KEY] = runtime;
}
export function getDuckDbRuntime(
  env?: NodeJS.ProcessEnv,
): DuckDbRuntimeService {
  assertDuckDbServerRuntime("getDuckDbRuntime");
  const existing = holder[RUNTIME_KEY];
  if (existing) return existing;
  const config: DuckDbConfig = readDuckDbConfig(env);
  if (!config.enabled) {
    return (holder[RUNTIME_KEY] = new DisabledDuckDbRuntime());
  }
  const repository = new GcsReleaseRepository(
    new GoogleCloudStorageClient(),
    config,
  );
  return (holder[RUNTIME_KEY] = new DuckDbRuntime(
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
  ));
}

export async function resetDuckDbRuntimeForTests(): Promise<void> {
  const previous = holder[RUNTIME_KEY];
  holder[RUNTIME_KEY] = undefined;
  await previous?.close();
}
