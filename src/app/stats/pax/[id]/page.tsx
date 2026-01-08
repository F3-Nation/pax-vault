import { PageHeader } from "@/components/pageHeader";
import { loadPaxStats } from "./loader";

import { PaxPageWrapper } from "@/components/pax/PageWrapper";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    categories: string | string[] | undefined;
    regionID: string | string[] | undefined;
    range: string | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    types: string | string[] | undefined;
    tags: string | string[] | undefined;
  }>;
}

export default async function PaxDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;
  const categories = searchParamsResolved?.categories; // e.g. "1st F", "2nd F", etc.
  const regionID = searchParamsResolved?.regionID; // e.g. "12345"
  const range = searchParamsResolved?.range; // e.g. "Last 90 Days"
  const startDate = searchParamsResolved?.startDate; // e.g. "2023-01-01"
  const endDate = searchParamsResolved?.endDate; // e.g. "2023-12-31"
  const types = searchParamsResolved?.types; // e.g. "type1", "type2", etc.
  const tags = searchParamsResolved?.tags; // e.g. "tag1", "tag2", etc.
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
          name={
            pax_data.info?.f3_name ??
            pax_data.info?.user_id.toString() ??
            "Unknown Pax"
          }
          link={
            pax_data.info.region_id
              ? `/stats/region/${pax_data.info.region_id}`
              : `/stats/region/${pax_data.info.region_default_id}`
          }
          linkName={
            pax_data.info?.region ||
            pax_data.info?.region_default ||
            "Unknown Region"
          }
        />
      </div>
      <PaxPageWrapper
        pax_data={pax_data}
        searchParams={{
          categories,
          regionID,
          range,
          startDate,
          endDate,
          types,
          tags,
        }}
      />
    </main>
  );
}
