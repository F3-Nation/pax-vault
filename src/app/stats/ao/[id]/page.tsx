import { IdProps } from "@/types/props";
import { loadAOStats } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { AOSummaryCard } from "@/components/ao/AOSummaryCard";
import { AOLeadersCard } from "@/components/ao/AOLeadersCard";

export default async function AODetailPage({ params }: IdProps) {
  const { id } = await params;
  const { AOInfo, AOSummary, AOLeaders } = await loadAOStats(Number(id));

  if (!AOInfo) {
    return <div className="p-8 text-center text-red-600">AO not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Page Header */}
        <PageHeader
          image={AOInfo.logo ? AOInfo.logo : "https://placehold.in/300x200.png"}
          name={AOInfo.name}
          link={`/stats/region/${AOInfo.region_id}`}
          linkName={AOInfo.region_name}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        {/* Workout Summary Card */}
        <AOSummaryCard summary={AOSummary!} />
        {/* Leaderboard Card */}
        <AOLeadersCard leaders={AOLeaders ? (Array.isArray(AOLeaders) ? AOLeaders : [AOLeaders]) : []} />
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Insights Card */}
        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="text-center font-semibold text-xl px-6">
            AO Insights
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <p className="italic text-center text-sm text-default">
              AO Insights coming soon...
            </p>
          </CardBody>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6">
        {/* Alt Chart Card */}
        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6">
            <div className="font-semibold text-xl">AO Charting</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <p className="italic text-center text-sm text-default">
              More Charting coming soon...
            </p>
          </CardBody>
        </Card>
        {/* Q Lineup Card */}
        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6">
            <div className="font-semibold text-xl">AO Q Lineup</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <p className="italic text-center text-sm text-default">
              Q Lineup coming soon...
            </p>
          </CardBody>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Recent Events Card */}
        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="text-center font-semibold text-xl px-6">
            Recent Events
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <p className="italic text-center text-sm text-default">
              Recent Events coming soon...
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
