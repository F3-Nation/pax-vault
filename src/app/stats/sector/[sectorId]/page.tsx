/****
 * Sector stats page.
 *
 * Responsibilities:
 * - Parse route params.
 * - Load sector data via the BQ loader.
 * - Render either an empty-state message or the full sector dashboard.
 */

import { loadSectorData } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { SectorSummaryCard } from "@/components/sector/SummaryCard";
import { AreaBreakdownCard } from "@/components/sector/AreaBreakdownCard";
import { SectorChartsCard } from "@/components/sector/ChartsCard";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { getSessionUser, requireAuth } from "@/lib/auth/server";

interface PageProps {
  params: Promise<{ sectorId: string }>;
}

export default async function SectorDetailPage({ params }: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { sectorId } = await params;
  const sectorData = await loadSectorData(Number(sectorId), user.email);

  if (!sectorData?.info) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 pt-10 pb-10 bg-gradient-to-b from-background to-default-50">
        <Card
          className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
          shadow="lg"
        >
          <CardHeader className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-center">
              Sector Data Not Available
            </h1>
            <p className="text-sm text-foreground/70 text-center max-w-xl mx-auto">
              This sector exists, but no data is currently available to display.
            </p>
          </CardHeader>
          <CardBody className="text-sm text-foreground/80">
            <p>
              This usually means the areas and regions within this sector have
              not yet migrated to <strong>F3 Nation Data</strong>.
            </p>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Page Header — links up to Nation */}
        <PageHeader
          image={sectorData.info.logo_url ?? undefined}
          name={`F3 ${sectorData.info.sector_name}`}
          link="/stats/nation"
          linkName="F3 Nation"
        />

        {/* Summary */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
          <SectorSummaryCard summary={sectorData.summary!} />
        </div>

        {/* Area breakdown */}
        <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
          <AreaBreakdownCard areas={sectorData.areaBreakdown || []} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 w-full max-w-6xl hidden">
          <SectorChartsCard charts={sectorData.charts || []} />
        </div>
      </div>
    </main>
  );
}
