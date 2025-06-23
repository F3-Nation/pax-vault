import { IdProps } from "@/types/props";
import { BioCard } from "@/components/pax/BioCard";
import { PAXSummaryCard } from "@/components/pax/PAXSummaryCard";
import { AOBreakdownCard } from "@/components/pax/AOBreakdownCard";
import { AchievementsCard } from "@/components/pax/AchievementsCard";
import { RecentEventsCard } from "@/components/pax/RecentEventsCard";
import { PAXInsightsCard } from "@/components/pax/PAXInsightsCard";
import { loadPaxStats } from "./loader";

export default async function PaxDetailPage({ params }: IdProps) {
  const { id } = await params;
  const {
    paxInfo,
    eventsResult,
    paxData,
    paxEvents,
    achievements,
    paxInsights,
  } = await loadPaxStats(Number(id));

  if (!paxInfo) {
    return <div className="p-8 text-center text-red-600">Pax not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Bio Card */}
        <BioCard paxInfo={paxInfo} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        {/* Workout Summary Card */}
        <PAXSummaryCard
          paxData={paxData}
          eventsResult={{
            ...eventsResult,
            uniquePax: {
              ...eventsResult.uniquePax,
              most_attended_user_event_count:
                eventsResult.uniquePax.most_attended_user_event_count ?? 0,
              most_attended_user_id: String(
                eventsResult.uniquePax.most_attended_user_id ?? ""
              ),
              most_attended_user_name: String(
                eventsResult.uniquePax.most_attended_user_name ?? ""
              ),
            },
          }}
        />
        {/* AO Stats Card */}
        <AOBreakdownCard paxData={paxData?.nation ?? null} />
      </div>
      {/* Insights Card */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        <PAXInsightsCard
          paxInsights={Array.isArray(paxInsights) ? paxInsights : [paxInsights]}
        />
      </div>
      {/* Achievements Card */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        <AchievementsCard achievements={achievements} />
      </div>
      {/* Backblasts Card */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        <RecentEventsCard paxEvents={paxEvents} />
      </div>
    </main>
  );
}
