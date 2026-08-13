/****
 * Region preferences page.
 *
 * Responsibilities:
 * - Require a session (middleware already blocks anonymous /stats requests).
 * - Confirm the signed-in user holds the admin role (role_id 3) on this
 *   region's org before rendering the editor.
 * - Load current preferences and hand them to the client form.
 *
 * The gate here is for UX. `PUT /api/region/[regionId]/preferences` re-checks
 * the same permission, so a user who reaches this page some other way still
 * cannot write.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { PageHeader } from "@/components/pageHeader";
import { PreferencesForm } from "@/components/region/PreferencesForm";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { getRegionPermissionForSession } from "@/lib/auth/permissions";
import { getRegionPreferences } from "@/lib/bq/preferences";
import { getRegionInfo } from "@/lib/bq/regions";

interface PageProps {
  params: Promise<{ regionId: string }>;
}

/** Shown when a signed-in user lacks the admin role on this region. */
function NotAuthorized({
  regionId,
  regionName,
}: {
  regionId: number;
  regionName: string | null;
}) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="px-6">
        <h2 className="text-xl font-semibold">Preferences not available</h2>
      </CardHeader>
      <CardBody className="gap-4 px-6 text-sm text-foreground/70">
        <p>
          Editing preferences for{" "}
          <strong>{regionName ? `F3 ${regionName}` : "this region"}</strong>{" "}
          requires the region admin role in F3 Nation Data. Your account
          doesn&apos;t have it.
        </p>
        <p className="text-foreground/60">
          If that looks wrong, the role is managed in F3 Nation Data, not in PAX
          Vault — ask whoever administers your region to grant it there.
        </p>
        <Link
          href={`/stats/region/${regionId}`}
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Back to region
        </Link>
      </CardBody>
    </Card>
  );
}

export default async function RegionPreferencesPage({ params }: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { regionId: rawRegionId } = await params;
  const regionId = Number(rawRegionId);
  if (!Number.isInteger(regionId) || regionId <= 0) {
    notFound();
  }

  const [permission, regionInfo] = await Promise.all([
    getRegionPermissionForSession(regionId),
    getRegionInfo(regionId, user.email),
  ]);

  // A region id that resolves to nothing is a 404, regardless of role.
  if (!regionInfo) {
    notFound();
  }

  const regionName = regionInfo.region_name ?? null;

  // Preferences are only read once the user is known to be an admin — no
  // point paying for the query otherwise.
  const record = permission.isAdmin
    ? await getRegionPreferences(regionId, user.email)
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-3xl pb-6 px-4">
        <Breadcrumb
          items={buildBreadcrumb({
            parent: {
              label: regionName ? `F3 ${regionName}` : "Region",
              href: `/stats/region/${regionId}`,
            },
            current: "Preferences",
          })}
        />

        <PageHeader
          image={regionInfo.logo_url ?? undefined}
          name={`F3 ${regionName ?? "Region"} Preferences`}
          link={`/stats/region/${regionId}`}
          linkName="Back to region"
        />

        {permission.isAdmin && record ? (
          <PreferencesForm
            regionId={regionId}
            initialPreferences={record.preferences}
            updatedAt={record.updatedAt}
          />
        ) : (
          <NotAuthorized regionId={regionId} regionName={regionName} />
        )}
      </div>
    </main>
  );
}
