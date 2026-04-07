/****
 * Region stats page.
 *
 * Responsibilities:
 * - Parse route params and query-string filters.
 * - Normalize filters into a shape understood by the data loader.
 * - Render either an empty-state message or the full region dashboard.
 */

import { loadRegionData } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { RegionalPageWrapper } from "@/components/region/PageWrapper";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import Link from "next/link";
import { getSessionUser, requireAuth } from "@/lib/auth/server";

interface PageProps {
  params: Promise<{ regionId: string }>;
  searchParams?: Promise<{
    categoryIds?: string | string[];
    categoryMode?: string;
    aoIds?: string | string[];
    aoMode?: string;
    range?: string;
    startDate?: string;
    endDate?: string;
    typeIds?: string | string[];
    typeMode?: string;
    tagIds?: string | string[];
    tagMode?: string;
    persist?: string;
  }>;
}

/**
 * Normalize a query param that may be a string or string[] into a number[]
 * or undefined when not present.
 */
function parseIdList(value?: string | string[]): number[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : value.split(",");
  const nums = list.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return nums.length ? nums : undefined;
}

export default async function RegionDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { regionId } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;

  const filters = {
    startDate: searchParamsResolved?.startDate,
    endDate: searchParamsResolved?.endDate,
    range: searchParamsResolved?.range,
    aoIds: parseIdList(searchParamsResolved?.aoIds),
    aoMode: searchParamsResolved?.aoMode as "include" | "exclude" | undefined,
    tagIds: parseIdList(searchParamsResolved?.tagIds),
    tagMode: searchParamsResolved?.tagMode as "include" | "exclude" | undefined,
    typeIds: parseIdList(searchParamsResolved?.typeIds),
    typeMode: searchParamsResolved?.typeMode as
      | "include"
      | "exclude"
      | undefined,
    categoryIds: parseIdList(searchParamsResolved?.categoryIds),
    categoryMode: searchParamsResolved?.categoryMode as
      | "include"
      | "exclude"
      | undefined,
    persist: searchParamsResolved?.persist,
  };

  // Preserve raw query params for downstream UI state (filters, toggles, etc.)
  const categoryIds = searchParamsResolved?.categoryIds;
  const categoryMode = searchParamsResolved?.categoryMode;
  const aoIds = searchParamsResolved?.aoIds;
  const aoMode = searchParamsResolved?.aoMode;
  const range = searchParamsResolved?.range;
  const startDate = searchParamsResolved?.startDate;
  const endDate = searchParamsResolved?.endDate;
  const typeIds = searchParamsResolved?.typeIds;
  const typeMode = searchParamsResolved?.typeMode;
  const tagIds = searchParamsResolved?.tagIds;
  const tagMode = searchParamsResolved?.tagMode;
  const persist = searchParamsResolved?.persist;
  const regionData = await loadRegionData(Number(regionId), user.email, {
    ...filters,
  });

  const hasRegionData = !!regionData && Object.keys(regionData).length > 0;

  // Show empty state when region data is missing or empty
  if (!hasRegionData) {
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
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Page Header */}
        <PageHeader
          image={regionData.info?.logo_url ?? undefined}
          name={`F3 ${regionData.info?.region_name}`}
          link={
            regionData.info?.area_id
              ? `/stats/area/${regionData.info.area_id}`
              : undefined
          }
          linkName={regionData.info?.area_name ?? undefined}
        />
        <RegionalPageWrapper
          region_id={Number(regionId)}
          region_info={regionData.info!}
          region_summary={regionData.summary}
          region_leaders={regionData.leaders}
          region_kotter={regionData.kotter || []}
          region_upcoming={regionData.upcoming || []}
          region_events={regionData.events || []}
          region_charts={regionData.charts || []}
          region_achievements={regionData.achievements || []}
          searchParams={{
            categoryIds,
            categoryMode,
            aoIds,
            aoMode,
            range,
            startDate,
            endDate,
            typeIds,
            typeMode,
            tagIds,
            tagMode,
            persist,
          }}
        />
      </div>
    </main>
  );
}
