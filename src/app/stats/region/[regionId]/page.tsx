/****
 * Region stats page.
 *
 * Responsibilities:
 * - Parse route params and query-string filters.
 * - Normalize filters into a shape understood by the data loader.
 * - Render either an empty-state message or the full region dashboard.
 */

import { loadRegionData } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { RegionalPageWrapper } from "@/components/region/PageWrapper";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { getRegionPermissionForSession } from "@/lib/auth/permissions";
import { parseFilterParams } from "@/lib/filters";
import { EntityDataUnavailable } from "@/components/EntityDataUnavailable";
import { PreferencesButton } from "@/components/region/PreferencesButton";
import { reportError } from "@/lib/observability";

interface PageProps {
  params: Promise<{ regionId: string }>;
  searchParams?: Promise<{
    categoryIds?: string | string[];
    categoryMode?: string;
    aoIds?: string | string[];
    aoMode?: string;
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

export default async function RegionDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { regionId } = await params;
  const searchParamsResolved = searchParams ? await searchParams : undefined;

  const filters = parseFilterParams(searchParamsResolved);

  // Preserve raw query params for downstream UI state (filters, toggles, etc.)
  const categoryIds = searchParamsResolved?.categoryIds;
  const categoryMode = searchParamsResolved?.categoryMode;
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
  const regionData = await loadRegionData(Number(regionId), user.email, {
    ...filters,
  });

  // Region admins (role_id 3 on this region's org) get an entry point to the
  // preferences editor. The button is optional chrome, so a failed permission
  // lookup hides it rather than taking the whole dashboard down — the
  // preferences page and its API re-check the role either way.
  let canEditPreferences = false;
  try {
    const permission = await getRegionPermissionForSession(Number(regionId));
    canEditPreferences = permission.isAdmin;
  } catch (err) {
    reportError(err, {
      scope: "stats/region:permission",
      user: user.email,
      extra: { regionId },
    });
  }

  const hasRegionData = !!regionData && Object.keys(regionData).length > 0;

  // Show empty state when region data is missing or empty
  if (!hasRegionData) {
    return <EntityDataUnavailable entity="Region" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Breadcrumb */}
        <Breadcrumb
          items={buildBreadcrumb({
            parent:
              regionData.info?.area_id && regionData.info?.area_name
                ? {
                    label: regionData.info.area_name,
                    href: `/stats/area/${regionData.info.area_id}`,
                  }
                : null,
            current: regionData.info?.region_name ?? "Region",
          })}
        />

        {/* Page Header */}
        <PageHeader
          image={regionData.info?.logo_url ?? undefined}
          name={`F3 ${regionData.info?.region_name}`}
          link={
            regionData.info?.area_id
              ? `/stats/area/${regionData.info.area_id}`
              : undefined
          }
          linkName={regionData.info?.area_name ?? undefined}
          action={
            canEditPreferences ? (
              <PreferencesButton regionId={Number(regionId)} />
            ) : undefined
          }
        />
        <RegionalPageWrapper
          region_id={Number(regionId)}
          region_info={regionData.info!}
          region_summary={regionData.summary}
          region_leaders={regionData.leaders}
          region_kotter={regionData.kotter || []}
          region_upcoming={regionData.upcoming || []}
          region_events={regionData.events || []}
          region_charts={regionData.charts || []}
          region_achievements={regionData.achievements || []}
          region_ao_breakdown={regionData.aoBreakdown || []}
          region_preferences={regionData.preferences}
          searchParams={{
            categoryIds,
            categoryMode,
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
