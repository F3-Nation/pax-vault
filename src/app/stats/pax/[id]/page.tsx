import { IdProps } from "@/types/props";
import { PageHeader } from "@/components/pageHeader";
import { loadPaxStats } from "./loader";

import { PaxPageWrapper } from "@/components/pax/PageWrapper";

export default async function PaxDetailPage({ params }: IdProps) {
  const { id } = await params;
  const pax_data = await loadPaxStats(Number(id));

  if (!pax_data) {
    return <div className="p-8 text-center text-red-600">Pax not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Page Header */}
        <PageHeader
          image={pax_data.info?.avatar_url ?? undefined}
          name={pax_data.info?.f3_name ?? undefined}
          link={
            pax_data.info
              ? `/stats/region/${pax_data.info.region_id}`
              : undefined
          }
          linkName={
            pax_data.info?.region ||
            pax_data.info?.region_default ||
            "Unknown Region"
          }
        />
      </div>
      <PaxPageWrapper pax_data={pax_data} />
    </main>
  );
}
