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
import { Breadcrumb } from "@/components/breadcrumb";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { parseFilterParams } from "@/lib/filters";
import { EntityDataUnavailable } from "@/components/EntityDataUnavailable";

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

export default async function PaxDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { paxId } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;

  const filters = parseFilterParams(searchParamsResolved);

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
    return <EntityDataUnavailable entity="PAX" entityPlural="PAX" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            ...(paxData.info?.home_region_id && paxData.info?.home_region_name
              ? [
                  {
                    label: paxData.info.home_region_name,
                    href: `/stats/region/${paxData.info.home_region_id}`,
                  },
                ]
              : []),
            { label: paxData.info?.f3_name ?? "PAX" },
          ]}
        />

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
