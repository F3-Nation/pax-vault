import { IdProps } from "@/types/props";
import { loadAOStats } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { Tab, Tabs } from "@heroui/tabs";
import { Divider } from "@heroui/divider";

export default async function AODetailPage({ params }: IdProps) {
  const { id } = await params;
  const { AOInfo } = await loadAOStats(Number(id));

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
        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6">
            <div className="font-semibold text-xl">AO Summary</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">First Workout:</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Total Posts:</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Unique PAX:</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Unique Qs:</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">FNGs:</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Average PAX:</span>
              <span>TBD</span>
            </div>
            <div className="flex justify-between py-1 pb-2">
              <span className="text-primary">Peak PAX:</span>
              <span>TBD</span>
            </div>
          </CardBody>
        </Card>
        {/* Leaderboard Card */}
        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6">
            <div className="font-semibold text-xl">AO Leaderboards</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <ScrollShadow className="h-[260px]">
              <div className="space-y-1">
                <div
                  key="test1"
                  className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
                >
                  <div className="flex gap-2">
                    <Link color="primary" href={`/stats/pax/123`}>
                      PAX Name
                    </Link>
                  </div>
                  # Beatdowns
                </div>
              </div>
            </ScrollShadow>
          </CardBody>
        </Card>
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
