/****
 * AO stats page.
 *
 * Responsibilities:
 * - Parse route params and query-string filters.
 * - Normalize filters into a shape understood by the data loader.
 * - Render either an empty-state message or the full AO dashboard.
 */

import { loadAOData } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { AOPageWrapper } from "@/components/ao/PageWrapper";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { parseFilterParams } from "@/lib/filters";
import { EntityDataUnavailable } from "@/components/EntityDataUnavailable";

interface PageProps {
  params: Promise<{ aoId: string }>;
  searchParams?: Promise<{
    categoryIds?: string | string[];
    categoryMode?: string;
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

export default async function AODetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { aoId } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;

  const filters = parseFilterParams(searchParamsResolved);

  // Preserve raw query params for downstream UI state (filters, toggles, etc.)
  const categoryIds = searchParamsResolved?.categoryIds;
  const categoryMode = searchParamsResolved?.categoryMode;
  const range = searchParamsResolved?.range;
  const startDate = searchParamsResolved?.startDate;
  const endDate = searchParamsResolved?.endDate;
  const typeIds = searchParamsResolved?.typeIds;
  const typeMode = searchParamsResolved?.typeMode;
  const tagIds = searchParamsResolved?.tagIds;
  const tagMode = searchParamsResolved?.tagMode;
  const persist = searchParamsResolved?.persist;
  const aoData = await loadAOData(Number(aoId), user.email, { ...filters });

  const hasAOData = !!aoData && Object.keys(aoData).length > 0;

  // Show empty state when AO data is missing or empty
  if (!hasAOData) {
    return <EntityDataUnavailable entity="AO" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Breadcrumb */}
        <Breadcrumb
          items={buildBreadcrumb({
            parent:
              aoData.info?.region_id && aoData.info?.region_name
                ? {
                    label: aoData.info.region_name,
                    href: `/stats/region/${aoData.info.region_id}`,
                  }
                : null,
            current: aoData.info?.ao_name ?? "AO",
          })}
        />

        {/* Page Header */}
        <PageHeader
          image={aoData.info?.logo_url ?? undefined}
          name={aoData.info?.ao_name}
          link={`/stats/region/${aoData.info?.region_id ?? undefined}`}
          linkName={aoData.info?.region_name ?? undefined}
        />
        <AOPageWrapper
          ao_id={Number(aoId)}
          ao_info={aoData.info}
          ao_summary={aoData.summary}
          ao_leaders={aoData.leaders}
          ao_upcoming={aoData.upcoming || []}
          ao_events={aoData.events || []}
          searchParams={{
            categoryIds,
            categoryMode,
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
