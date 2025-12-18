import { IdProps } from "@/types/props";
import { PageHeader } from "@/components/pageHeader";
import { loadRegionStats } from "./loader";

import { RegionalPageWrapper } from "@/components/region/PageWrapper";

export default async function RegionDetailPage({ params }: IdProps) {
  const { id } = await params;
  const { region_data, upcoming_events } = await loadRegionStats(Number(id));

  if (!region_data) {
    return <div className="p-8 text-center text-red-600">Region not found</div>;
  }

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
      />
    </main>
  );
}
