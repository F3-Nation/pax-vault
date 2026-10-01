import { DuckDbReleaseError } from "./errors";

/** Runtime guard for Node-only filesystem, native binding, and GCS entrypoints. */
export function assertDuckDbServerRuntime(entrypoint: string): void {
  if (
    typeof window !== "undefined" ||
    typeof process === "undefined" ||
    process.release?.name !== "node"
  ) {
    throw new DuckDbReleaseError(
      `${entrypoint} requires the Node server runtime`,
    );
  }
}
