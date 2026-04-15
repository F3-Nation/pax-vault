/****
 * Area stats page.
 *
 * Responsibilities:
 * - Parse route params.
 * - Load area data via the BQ loader.
 * - Render either an empty-state message or the full area dashboard.
 */

import { loadAreaData } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { AreaSummaryCard } from "@/components/area/SummaryCard";
import { RegionBreakdownCard } from "@/components/area/RegionBreakdownCard";
import { AreaChartsCard } from "@/components/area/ChartsCard";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { Breadcrumb } from "@/components/breadcrumb";

interface PageProps {
  params: Promise<{ areaId: string }>;
}

export default async function AreaDetailPage({ params }: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { areaId } = await params;
  const areaData = await loadAreaData(Number(areaId), user.email);

  if (!areaData?.info) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 pt-10 pb-10 bg-gradient-to-b from-background to-default-50">
        <Card
          className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
          shadow="lg"
        >
          <CardHeader className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-center">
              Area Data Not Available
            </h1>
            <p className="text-sm text-foreground/70 text-center max-w-xl mx-auto">
              This area exists, but no data is currently available to display.
            </p>
          </CardHeader>
          <CardBody className="text-sm text-foreground/80">
            <p>
              This usually means the regions within this area have not yet
              migrated to <strong>F3 Nation Data</strong>.
            </p>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Nation", href: "/stats/nation" },
            ...(areaData.info.sector_id && areaData.info.sector_name
              ? [
                  {
                    label: areaData.info.sector_name,
                    href: `/stats/sector/${areaData.info.sector_id}`,
                  },
                ]
              : []),
            { label: areaData.info.area_name },
          ]}
        />

        {/* Page Header */}
        <PageHeader
          image={areaData.info.logo_url ?? undefined}
          name={`F3 ${areaData.info.area_name}`}
          link={
            areaData.info.sector_id
              ? `/stats/sector/${areaData.info.sector_id}`
              : undefined
          }
          linkName={areaData.info.sector_name ?? undefined}
        />

        {/* WIP disclaimer */}
        <div className="w-full rounded-lg border border-warning-300 bg-warning-50 dark:bg-warning-900/20 px-4 py-3 text-sm text-warning-800 dark:text-warning-300">
          <strong>Work in progress:</strong> This page is not the final version.
          Data and layout are subject to change.
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
          <AreaSummaryCard summary={areaData.summary!} />
        </div>
        {/* Region breakdown */}
        <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
          <RegionBreakdownCard regions={areaData.regionBreakdown || []} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 w-full max-w-6xl hidden">
          <AreaChartsCard charts={areaData.charts || []} />
        </div>
      </div>
    </main>
  );
}
