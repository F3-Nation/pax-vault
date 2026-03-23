/****
 * Region stats page.
 *
 * Responsibilities:
 * - Parse route params and query-string filters.
 * - Normalize filters into a shape understood by the data loader.
 * - Render either an empty-state message or the full region dashboard.
 */

import { loadPaxData } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { PAXPageWrapper } from "@/components/pax/PageWrapper";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import Link from "next/link";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paxId: string }>;
}): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "PAX Stats" };

  const { paxId } = await params;
  const data = await loadPaxData(Number(paxId), user.email);
  return { title: data?.info?.f3_name ?? "PAX Stats" };
}

interface PageProps {
  params: Promise<{ paxId: string }>;
  searchParams?: Promise<{
    categoryIds?: string | string[];
    categoryMode?: string;
    aoIds?: string | string[];
    aoMode?: string;
    regionIds?: string | string[];
    regionMode?: string;
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

export default async function PaxDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { paxId } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;

  const filters = {
    startDate: searchParamsResolved?.startDate,
    endDate: searchParamsResolved?.endDate,
    range: searchParamsResolved?.range,
    aoIds: parseIdList(searchParamsResolved?.aoIds),
    aoMode: searchParamsResolved?.aoMode as "include" | "exclude" | undefined,
    regionIds: parseIdList(searchParamsResolved?.regionIds),
    regionMode: searchParamsResolved?.regionMode as
      | "include"
      | "exclude"
      | undefined,
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
  const regionIds = searchParamsResolved?.regionIds;
  const regionMode = searchParamsResolved?.regionMode;
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
  const paxData = await loadPaxData(Number(paxId), user.email, { ...filters });

  const hasPaxData = !!paxData && Object.keys(paxData).length > 0;

  // Show empty state when pax data is missing or empty
  if (!hasPaxData) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 pt-10 pb-10 bg-gradient-to-b from-background to-default-50">
        <Card
          className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
          shadow="lg"
        >
          <CardHeader className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-center">
              PAX Data Not Available
            </h1>
            <p className="text-sm text-foreground/70 text-center max-w-xl mx-auto">
              This PAX exists, but no data is currently available to display.
            </p>
          </CardHeader>

          <CardBody className="space-y-4 text-sm text-foreground/80">
            <p>
              This usually means the PAX has not migrated to{" "}
              <strong>F3 Nation Data</strong> yet, or the migration process is
              currently in progress. Until that data is connected, PAX Vault has
              nothing to index or display.
            </p>

            <p>
              If your PAX has not migrated yet, moving to F3 Nation Data
              unlocks:
            </p>

            <ul className="list-disc list-inside space-y-1 text-foreground/70">
              <li>Reliable, centralized workout and attendance data</li>
              <li>Accurate PAX, AO, and PAX-level stats</li>
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
                PAXminer will be shut down on <strong>March 31st</strong>. PAX
                that have not migrated to F3 Nation Data by then will lose
                access to automated data feeds.
              </p>
            </div>
          </CardBody>

          <CardFooter className="text-[11px] text-foreground/50 text-center">
            Once your PAX&apos;s data is connected, refresh this page to view
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
          image={paxData.info?.avatar_url ?? undefined}
          name={paxData.info?.f3_name ?? undefined}
          link={`/stats/region/${paxData.info?.home_region_id ?? undefined}`}
          linkName={paxData.info?.home_region_name ?? undefined}
        />
        <PAXPageWrapper
          pax_id={Number(paxId)}
          pax_info={paxData.info}
          pax_summary={paxData.summary}
          pax_events={paxData.events || []}
          pax_ao_breakdown={paxData.ao_breakdown || []}
          searchParams={{
            categoryIds,
            categoryMode,
            regionIds,
            regionMode,
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
