import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import Link from "next/link";

const MIGRATION_GUIDE_URL =
  "https://docs.google.com/document/d/1e7tmuY3irKDt9oy1URQVcxPwxyet1ZY_bVZhGvhESEw/edit?usp=drivesdk";

type EntityDataUnavailableProps = {
  /** Display noun for the entity, e.g. "Region", "AO", "PAX". */
  entity: string;
  /** Plural form used in the shutdown notice; defaults to `${entity}s`. */
  entityPlural?: string;
};

/**
 * Shared empty state shown when a stats entity exists but has no data yet
 * (typically because it hasn't migrated to F3 Nation Data). Replaces the
 * near-identical ~60-line block previously inlined in each entity page.
 */
export function EntityDataUnavailable({
  entity,
  entityPlural = `${entity}s`,
}: EntityDataUnavailableProps) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-10 pb-10 bg-gradient-to-b from-background to-default-50">
      <Card
        className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
        shadow="lg"
      >
        <CardHeader className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-center">
            {entity} Data Not Available
          </h1>
          <p className="text-sm text-foreground/70 text-center max-w-xl mx-auto">
            This {entity} exists, but no data is currently available to display.
          </p>
        </CardHeader>

        <CardBody className="space-y-4 text-sm text-foreground/80">
          <p>
            This usually means it has not migrated to{" "}
            <strong>F3 Nation Data</strong> yet, or the migration process is
            currently in progress. Until that data is connected, PAX Vault has
            nothing to index or display.
          </p>

          <p>
            If migration hasn&apos;t happened yet, moving to F3 Nation Data
            unlocks:
          </p>

          <ul className="list-disc list-inside space-y-1 text-foreground/70">
            <li>Reliable, centralized workout and attendance data</li>
            <li>Accurate PAX, AO, and region-level stats</li>
            <li>Direct compatibility with tools like PAX Vault</li>
            <li>Less manual work for Site Qs and Data Qs</li>
          </ul>

          <p>
            To get started, follow the official migration instructions here:
          </p>

          <div className="flex justify-center pt-2">
            <Link
              href={MIGRATION_GUIDE_URL}
              target="_blank"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              View F3 Nation Data Migration Guide
            </Link>
          </div>

          <div className="rounded-md border-2 border-danger bg-danger/15 p-4 text-danger-foreground shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              ⚠️ PAXminer Shutdown Notice
            </div>
            <p className="mt-1">
              PAXminer will be shut down on <strong>March 31st</strong>.{" "}
              {entityPlural} that have not migrated to F3 Nation Data by then
              will lose access to automated data feeds.
            </p>
          </div>
        </CardBody>

        <CardFooter className="text-[11px] text-foreground/50 text-center">
          Once the data is connected, refresh this page to view the full
          dashboard.
        </CardFooter>
      </Card>
    </main>
  );
}
