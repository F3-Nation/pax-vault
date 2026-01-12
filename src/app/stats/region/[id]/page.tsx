import { PageHeader } from "@/components/pageHeader";
import { loadRegionStats } from "./loader";

import { RegionalPageWrapper } from "@/components/region/PageWrapper";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    categoryID: string | string[] | undefined;
    aoID: string | string[] | undefined;
    range: string | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    typeID: string | string[] | undefined;
    tagID: string | string[] | undefined;
  }>;
}

export default async function RegionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;
  const categoryID = searchParamsResolved?.categoryID; // e.g. "1st F", "2nd F", etc.
  const aoID = searchParamsResolved?.aoID; // e.g. "12345"
  const range = searchParamsResolved?.range; // e.g. "Last 90 Days"
  const startDate = searchParamsResolved?.startDate; // e.g. "2023-01-01"
  const endDate = searchParamsResolved?.endDate; // e.g. "2023-12-31"
  const typeID = searchParamsResolved?.typeID; // e.g. "type1", "type2", etc.
  const tagID = searchParamsResolved?.tagID; // e.g. "tag1", "tag2", etc.
  const { region_data, upcoming_events } = await loadRegionStats(Number(id));
  const region_ready = region_data && region_data.length > 0;

  if (!region_ready) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 pt-10 pb-10 bg-gradient-to-b from-background to-default-50">
        <Card
          className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
          shadow="lg"
        >
          <CardHeader className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-center">
              Region Data Not Available
            </h1>
            <p className="text-sm text-foreground/70 text-center max-w-xl mx-auto">
              This region exists, but no data is currently available to display.
            </p>
          </CardHeader>

          <CardBody className="space-y-4 text-sm text-foreground/80">
            <p>
              This usually means the region has not migrated to{" "}
              <strong>F3 Nation Data</strong> yet, or the migration process is
              currently in progress. Until that data is connected, PAX Vault has
              nothing to index or display.
            </p>

            <p>
              If your region has not migrated yet, moving to F3 Nation Data
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
                href="https://docs.google.com/document/d/1e7tmuY3irKDt9oy1URQVcxPwxyet1ZY_bVZhGvhESEw/edit?usp=drivesdk"
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
                PAXminer will be shut down on <strong>March 31st</strong>.
                Regions that have not migrated to F3 Nation Data by then will
                lose access to automated data feeds.
              </p>
            </div>
          </CardBody>

          <CardFooter className="text-[11px] text-foreground/50 text-center">
            Once your region&apos;s data is connected, refresh this page to view
            the full dashboard.
          </CardFooter>
        </Card>
      </main>
    );
  } else {
    return (
      <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
        <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
          {/* Page Header */}
          <PageHeader
            image={region_data[0].region_logo_url ?? undefined}
            name={region_data[0].region_name}
            link={undefined}
            linkName={region_data[0].sector_name}
          />
        </div>
        <RegionalPageWrapper
          region_data={region_data}
          upcoming_events={upcoming_events ?? []}
          searchParams={{
            categoryID,
            aoID,
            range,
            startDate,
            endDate,
            typeID,
            tagID,
          }}
        />
      </main>
    );
  }
}
