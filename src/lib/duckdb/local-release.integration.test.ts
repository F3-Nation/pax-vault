import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";
const { queryBigQuery } = vi.hoisted(() => ({
  queryBigQuery: vi.fn(async () => [
    { preferencesJson: '{"localReleaseIntegration":true}' },
  ]),
}));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import { DuckDbConfig } from "./config";
import { GcsClient, GcsObject, GcsReleaseRepository } from "./gcs";
import { DuckDbReleaseError } from "./errors";
import { DuckDbQueryConnection, DuckDbRuntime } from "./runtime";
import { setDuckDbRuntimeForTests } from "./factory";
import { getEventById } from "../bq/events";
import {
  getEvents as getRegionEvents,
  getPageData as getRegionPageData,
} from "../bq/regions";
import {
  getEvents as getPaxEvents,
  getPageData as getPaxPageData,
  searchUsersByName,
} from "../bq/pax";
import { searchAll } from "../bq/search";
import {
  DatasetManifest,
  Pointer,
  ReleaseIndex,
  crc32cFinish,
  crc32cUpdate,
} from "./validation";

const optedIn = process.env.DUCKDB_TEST_LOCAL_RELEASE === "true";
const benchmarkOptedIn = optedIn && process.env.DUCKDB_BENCH_PAX === "true";
const sourceRoot = resolve(process.cwd(), ".gcs/f3-analytics");
const controlUri = "gs://f3-analytics-nonprod/pax-vault/current.json";

function expectOwnProperty(
  value: object | null | undefined,
  key: string,
  expected: boolean,
): void {
  expect(
    value !== null && value !== undefined && Object.hasOwn(value, key),
  ).toBe(expected);
}

class LocalArtifactGcsClient implements GcsClient {
  private readonly generations = new Map<string, string>();

  constructor(
    private readonly root: string,
    private readonly pointer: Pointer,
    private readonly release: ReleaseIndex,
    private readonly manifests: Map<string, DatasetManifest>,
  ) {
    this.generations.set(controlUri, "local-pointer-generation-1");
    this.generations.set(pointer.manifestUri, pointer.manifestGeneration);
    for (const [dataset, entry] of Object.entries(release.datasets)) {
      this.generations.set(entry.manifestUri, entry.manifestGeneration);
      const manifest = manifests.get(dataset);
      if (!manifest)
        throw new DuckDbReleaseError(
          `Local release is missing ${dataset} manifest`,
        );
      for (const artifact of [...manifest.objects, ...manifest.goldens])
        this.generations.set(artifact.uri, artifact.generation);
    }
  }

  private resolveUri(uri: string): string {
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
    if (
      !match ||
      match[1] !== "f3-analytics-nonprod" ||
      !match[2].startsWith("pax-vault/") ||
      match[2].split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new DuckDbReleaseError(`Local artifact URI is not mapped: ${uri}`);
    const path = resolve(this.root, ...match[2].split("/"));
    if (!path.startsWith(`${this.root}${sep}`))
      throw new DuckDbReleaseError(
        `Local artifact URI escapes mirror root: ${uri}`,
      );
    return path;
  }

  private assertGeneration(uri: string, generation?: string): string {
    const expected = this.generations.get(uri);
    if (!expected)
      throw new DuckDbReleaseError(`No local generation reference for ${uri}`);
    if (generation !== undefined && generation !== expected)
      throw new DuckDbReleaseError(`Local generation mismatch for ${uri}`);
    return expected;
  }

  async read(
    uri: string,
    generation?: string,
    maxBytes = Number.MAX_SAFE_INTEGER,
  ): Promise<GcsObject> {
    const pinned = this.assertGeneration(uri, generation);
    if (uri.endsWith(".parquet"))
      throw new DuckDbReleaseError(
        "Parquet artifacts must use disk-backed streaming",
      );
    const path = this.resolveUri(uri);
    let metadata;
    try {
      metadata = await stat(path);
    } catch (cause) {
      throw new DuckDbReleaseError(
        `Missing local release artifact: ${path}`,
        "repository-gcs",
        { cause },
      );
    }
    if (metadata.size > maxBytes)
      throw new DuckDbReleaseError(
        `Local artifact exceeds read byte limit: ${uri}`,
      );
    const bytes = await readFile(path);
    return { bytes, generation: pinned };
  }

  async streamTo(
    uri: string,
    generation: string,
    destination: string,
    maxBytes = Number.MAX_SAFE_INTEGER,
  ): Promise<{ generation: string; sizeBytes: number; crc32c: string }> {
    const pinned = this.assertGeneration(uri, generation);
    const source = this.resolveUri(uri);
    let metadata;
    try {
      metadata = await stat(source);
    } catch (cause) {
      throw new DuckDbReleaseError(
        `Missing local release artifact: ${source}`,
        "repository-gcs",
        { cause },
      );
    }
    if (metadata.size > maxBytes)
      throw new DuckDbReleaseError(
        `Local artifact exceeds stream byte limit: ${uri}`,
      );
    let sizeBytes = 0;
    let crc = 0xffffffff;
    const check = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        const bytes = Buffer.from(chunk);
        sizeBytes += bytes.length;
        if (sizeBytes > maxBytes) {
          callback(
            new DuckDbReleaseError(
              `Local artifact exceeds stream byte limit: ${uri}`,
            ),
          );
          return;
        }
        crc = crc32cUpdate(crc, bytes);
        callback(null, bytes);
      },
    });
    await pipeline(
      createReadStream(source),
      check,
      createWriteStream(destination, { flags: "wx" }),
    );
    if (this.assertGeneration(uri, generation) !== pinned)
      throw new DuckDbReleaseError(
        `Local generation changed while streaming ${uri}`,
      );
    return { generation: pinned, sizeBytes, crc32c: crc32cFinish(crc) };
  }
}

describe("local producer release integration", () => {
  it("uses boolean-only diagnostics for sensitive own fields", () => {
    const sentinel = {
      displayName: "synthetic-private-sentinel",
      email: "sentinel@example.invalid",
      roles: ["synthetic-role"],
    };
    expectOwnProperty(sentinel, "email", true);
    expectOwnProperty(sentinel, "roles", true);
    expectOwnProperty(sentinel, "missing", false);
  });

  it.skipIf(!optedIn)(
    "activates and queries the unchanged local pv-release.v2 artifact",
    async () => {
      const pointerPath = join(sourceRoot, "pax-vault/current.json");
      await access(pointerPath).catch((cause) => {
        throw new Error(
          `DUCKDB_TEST_LOCAL_RELEASE=true but the local producer pointer is missing: ${pointerPath}`,
          { cause },
        );
      });
      const pointer = JSON.parse(
        await readFile(pointerPath, "utf8"),
      ) as Pointer;
      const mapUri = (uri: string) => {
        const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
        if (!match || match[1] !== "f3-analytics-nonprod")
          throw new Error(`Unexpected producer artifact URI: ${uri}`);
        return join(sourceRoot, match[2]);
      };
      const releasePath = mapUri(pointer.manifestUri);
      await access(releasePath).catch((cause) => {
        throw new Error(
          `Local producer release manifest is missing: ${releasePath}`,
          { cause },
        );
      });
      const release = JSON.parse(
        await readFile(releasePath, "utf8"),
      ) as ReleaseIndex;
      const manifests = new Map<string, DatasetManifest>();
      for (const entry of Object.values(release.datasets)) {
        const path = mapUri(entry.manifestUri);
        await access(path).catch((cause) => {
          throw new Error(`Local producer manifest is missing: ${path}`, {
            cause,
          });
        });
        const manifest = JSON.parse(
          await readFile(path, "utf8"),
        ) as DatasetManifest;
        manifests.set(manifest.dataset, manifest);
        for (const artifact of [...manifest.objects, ...manifest.goldens]) {
          const artifactPath = mapUri(artifact.uri);
          await access(artifactPath).catch((cause) => {
            throw new Error(
              `Local producer artifact is missing: ${artifactPath}`,
              { cause },
            );
          });
        }
      }

      const localClient = new LocalArtifactGcsClient(
        sourceRoot,
        pointer,
        release,
        manifests,
      );
      const config: DuckDbConfig = {
        enabled: true,
        bucket: "f3-analytics-nonprod",
        prefix: "pax-vault/releases",
        controlObject: "pax-vault/current.json",
        cacheDir: await mkdtemp(join(tmpdir(), "pax-duckdb-local-release-")),
        refreshTtlMs: 60_000,
        maxLkgAgeMs: 60_000,
        memoryLimit: "384MB",
        maxReleaseBytes: 512 * 1024 * 1024,
        maxObjectBytes: 384 * 1024 * 1024,
      };
      const repository = new GcsReleaseRepository(localClient, config);
      const runtime = new DuckDbRuntime(repository, config);
      const previousDuckDbEnabled = process.env.DUCKDB_ENABLED;
      process.env.DUCKDB_ENABLED = "true";
      setDuckDbRuntimeForTests(runtime);
      queryBigQuery.mockClear();
      try {
        const lease = await runtime.acquire();
        try {
          expect(lease.releaseId).toBe(pointer.releaseId);
          expect(manifests.size).toBe(9);

          await lease.withConnection(async (connection) => {
            for (const dataset of [
              "pv_pax",
              "pv_events",
              "pv_territories",
            ] as const) {
              const rows = await connection.query<{
                row_count: number | bigint;
              }>(`SELECT COUNT(*) AS row_count FROM ${dataset}`);
              expect(Number(rows[0]?.row_count)).toBe(
                manifests.get(dataset)?.rowCount,
              );
            }

            const pax = await connection.query<Record<string, unknown>>(
              "SELECT user_id, f3_name, regions, aos FROM pv_pax WHERE len(regions) > 0 LIMIT 1",
            );
            expect(pax.length).toBe(1);
            expect(Array.isArray(pax[0].regions)).toBe(true);
            expect(Array.isArray(pax[0].aos)).toBe(true);
            expectOwnProperty(pax[0], "email", false);
            expectOwnProperty(pax[0], "roles", false);

            const event = await connection.query<Record<string, unknown>>(
              `SELECT event_id, event_name, description, preblast, preblast_rich,
                      backblast, backblast_rich, meta, attendance
                 FROM pv_events WHERE event_id IS NOT NULL LIMIT 1`,
            );
            expect(event.length === 1).toBe(true);
            for (const field of [
              "event_id",
              "event_name",
              "description",
              "preblast",
              "preblast_rich",
              "backblast",
              "backblast_rich",
              "meta",
              "attendance",
            ])
              expectOwnProperty(event[0], field, true);

            const analyticalPax = await connection.query<
              Record<string, unknown>
            >(
              `SELECT user_id, f3_name, home_region_id, home_region_name,
                      avatar_url, status FROM pv_pax LIMIT 1`,
            );
            expect(analyticalPax.length === 1).toBe(true);
            expectOwnProperty(analyticalPax[0], "email", false);
            expectOwnProperty(analyticalPax[0], "roles", false);
          });

          // Pick representative records in memory. Diagnostics below report
          // only booleans, counts, or deterministic field names, never records.
          const serviceSample = await lease.withConnection(
            async (connection) => {
              const rows = await connection.query<{
                event_id: number | bigint;
                region_org_id: number | bigint;
                event_date: string;
                user_id: number | bigint;
              }>(
                `SELECT e.event_id, e.region_org_id,
                      CAST(e.event_date AS VARCHAR) AS event_date, a.user_id
                 FROM pv_events e, UNNEST(e.attendance) AS u(a)
                WHERE e.event_id IS NOT NULL AND e.region_org_id IS NOT NULL
                  AND e.event_date IS NOT NULL AND a.user_id IS NOT NULL
                  AND a.fartsack IS NOT TRUE
                LIMIT 1`,
              );
              return rows[0];
            },
          );
          expect(serviceSample !== undefined).toBe(true);
          const eventId = Number(serviceSample!.event_id);
          const regionId = Number(serviceSample!.region_org_id);
          const paxId = Number(serviceSample!.user_id);
          const eventDay = serviceSample!.event_date.slice(0, 10);

          const eventResult = await getEventById(eventId);
          expect(eventResult !== null).toBe(true);
          expect(eventResult?.event_instance_id === eventId).toBe(true);
          expect(
            eventResult?.preferencesJson === '{"localReleaseIntegration":true}',
          ).toBe(true);
          expectOwnProperty(eventResult, "event_name", true);
          expectOwnProperty(eventResult, "attendance", true);
          expectOwnProperty(eventResult, "fartsacks", true);
          expectOwnProperty(eventResult, "email", false);
          expectOwnProperty(eventResult, "roles", false);
          expect(queryBigQuery.mock.calls.length).toBe(1);

          const regionEvents = await getRegionEvents(regionId, undefined, {
            startDate: eventDay,
            endDate: eventDay,
            limit: 3,
          });
          expect(regionEvents?.length).toBeGreaterThan(0);
          expect(
            regionEvents?.some(
              (row) => Number(row.event_instance_id) === eventId,
            ),
          ).toBe(true);
          expectOwnProperty(regionEvents?.[0], "event_name", true);

          const paxEvents = await getPaxEvents(paxId, undefined, {
            startDate: eventDay,
            endDate: eventDay,
            limit: 3,
          });
          expect(paxEvents?.length).toBeGreaterThan(0);
          expectOwnProperty(paxEvents?.[0], "attendance", true);
          expectOwnProperty(paxEvents?.[0], "email", false);
          expectOwnProperty(paxEvents?.[0], "roles", false);

          const person = await lease.withConnection(async (connection) => {
            const rows = await connection.query<{
              f3_name: string;
              home_region_id: number | bigint | null;
            }>(
              "SELECT f3_name, home_region_id FROM pv_pax WHERE user_id = ? LIMIT 1",
              [paxId],
            );
            return rows[0];
          });
          expect(
            typeof person?.f3_name === "string" && person.f3_name.length > 0,
          ).toBe(true);
          const searchTerm = person!.f3_name.slice(0, 3);
          const matchingUsers = await searchUsersByName(
            searchTerm,
            undefined,
            person!.home_region_id == null
              ? undefined
              : Number(person!.home_region_id),
          );
          expect(matchingUsers.length).toBeGreaterThan(0);
          expectOwnProperty(matchingUsers[0], "user_id", true);
          expectOwnProperty(matchingUsers[0], "f3_name", true);
          expectOwnProperty(matchingUsers[0], "email", false);
          expectOwnProperty(matchingUsers[0], "roles", false);

          const combinedSearch = await searchAll(searchTerm);
          expectOwnProperty(combinedSearch, "regions", true);
          expectOwnProperty(combinedSearch, "aos", true);
          expectOwnProperty(combinedSearch, "pax", true);
          expect(combinedSearch.pax.length).toBeGreaterThan(0);
          expectOwnProperty(combinedSearch.pax[0], "email", false);
          expectOwnProperty(combinedSearch.pax[0], "roles", false);

          const page = await getRegionPageData(regionId, undefined, {
            startDate: eventDay,
            endDate: eventDay,
          });
          expectOwnProperty(page, "info", true);
          expectOwnProperty(page, "events", true);
          expectOwnProperty(page, "summary", true);
          expect(Boolean(page.summary)).toBe(true);
          expect(queryBigQuery.mock.calls.length).toBe(2);

          if (benchmarkOptedIn) {
            const repetitions = 5;
            const timings = {
              total: [] as number[],
              info: [] as number[],
              events: [] as number[],
              remaining: [] as number[],
              eventRows: [] as number[],
            };
            setDuckDbRuntimeForTests({
              acquire: async () => {
                const lease = await runtime.acquire();
                return {
                  releaseId: lease.releaseId,
                  releaseSequence: lease.releaseSequence,
                  release: () => lease.release(),
                  withConnection: <T>(
                    callback: (connection: DuckDbQueryConnection) => Promise<T>,
                  ) =>
                    lease.withConnection((connection) =>
                      callback({
                        close: () => connection.close(),
                        query: async <R = unknown>(
                          sql: string,
                          params?: unknown[] | Record<string, unknown>,
                        ): Promise<R[]> => {
                          const startedAt = performance.now();
                          const rows = await connection.query<R>(sql, params);
                          const elapsedMs = performance.now() - startedAt;
                          if (sql.startsWith("SELECT user_id, f3_name"))
                            timings.info.push(elapsedMs);
                          else if (
                            sql.startsWith(
                              "SELECT event_id AS event_instance_id",
                            )
                          ) {
                            timings.events.push(elapsedMs);
                            timings.eventRows.push(rows.length);
                          }
                          return rows;
                        },
                      }),
                    ),
                };
              },
              refresh: () => runtime.refresh(),
              close: () => runtime.close(),
              status: () => runtime.status(),
            });
            try {
              for (let repetition = 0; repetition < repetitions; repetition++) {
                const startedAt = performance.now();
                const result = await getPaxPageData(paxId);
                const totalMs = performance.now() - startedAt;
                timings.total.push(totalMs);
                timings.remaining.push(
                  totalMs -
                    (timings.info.at(-1) ?? 0) -
                    (timings.events.at(-1) ?? 0),
                );
                expect(result.info !== null).toBe(true);
              }
            } finally {
              setDuckDbRuntimeForTests(runtime);
            }
            const median = (values: number[]) => {
              const sorted = [...values].sort((left, right) => left - right);
              return Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
            };
            console.info(
              `[duckdb-pax-benchmark] ${JSON.stringify({
                repetitions,
                medianMs: {
                  infoSelect: median(timings.info),
                  eventSelect: median(timings.events),
                  remaining: median(timings.remaining),
                  total: median(timings.total),
                },
                medianReturnedEventRows: median(timings.eventRows),
              })}`,
            );
          }
        } finally {
          lease.release();
        }
      } finally {
        try {
          await runtime.close();
        } finally {
          setDuckDbRuntimeForTests();
          if (previousDuckDbEnabled === undefined)
            delete process.env.DUCKDB_ENABLED;
          else process.env.DUCKDB_ENABLED = previousDuckDbEnabled;
          queryBigQuery.mockClear();
          await rm(config.cacheDir, { recursive: true, force: true });
        }
      }
    },
    300_000,
  );
});
