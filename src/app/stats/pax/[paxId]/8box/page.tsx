/****
 * 8 Box overview page (owner-only).
 *
 * Responsibilities:
 * - Require a session (middleware already blocks anonymous /stats requests).
 * - Confirm the signed-in user IS this PAX before showing anything.
 * - Show the latest published board with export/share controls, a banner
 *   when an unpublished draft exists, and the version history.
 *
 * The gate here is for UX. Every 8 Box API route re-runs the same owner
 * check, so a user who reaches this page some other way still cannot write.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Alert } from "@heroui/alert";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { PageHeader } from "@/components/pageHeader";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxPageData } from "@/lib/bq/eightBox";
import {
  EightBoxBoard,
  eightBoxMetaLine,
  formatEightBoxDate,
} from "@/components/pax/eightbox/EightBoxBoard";
import { EightBoxButton } from "@/components/pax/eightbox/EightBoxButton";
import { EightBoxExportActions } from "@/components/pax/eightbox/EightBoxExportActions";
import { EightBoxHistory } from "@/components/pax/eightbox/EightBoxHistory";
import { EightBoxPrivate } from "@/components/pax/eightbox/EightBoxPrivate";
import { EightBoxShareToggle } from "@/components/pax/eightbox/EightBoxShareToggle";

interface PageProps {
  params: Promise<{ paxId: string }>;
}

const primaryLink =
  "inline-flex w-fit items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

export default async function EightBoxPage({ params }: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { paxId: rawPaxId } = await params;
  const paxId = Number(rawPaxId);
  if (!Number.isInteger(paxId) || paxId <= 0) {
    notFound();
  }

  const [isOwner, data] = await Promise.all([
    isOwnPax(paxId),
    getEightBoxPageData(paxId, user.email),
  ]);

  // A pax id that resolves to nothing is a 404, regardless of who asks.
  if (!data.info) {
    notFound();
  }

  const f3Name = data.info.f3_name;
  const latest = data.versions[0] ?? null;
  const draft = data.draft;
  const editHref = `/stats/pax/${paxId}/8box/edit`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <Breadcrumb
          items={buildBreadcrumb({
            includeNation: false,
            parent: { label: f3Name, href: `/stats/pax/${paxId}` },
            current: "8 Box",
          })}
        />

        <PageHeader
          image={data.info.avatar_url ?? undefined}
          name={`${f3Name} — 8 Box`}
          link={`/stats/pax/${paxId}`}
          linkName="Back to PAX page"
          action={
            isOwner ? (
              <EightBoxButton
                paxId={paxId}
                toEditor
                label={draft ? "Continue draft" : latest ? "Edit" : "Start"}
              />
            ) : undefined
          }
        />

        {!isOwner ? (
          <EightBoxPrivate paxId={paxId} f3Name={f3Name} />
        ) : (
          <>
            {draft && (
              <Alert
                color="warning"
                title="You have an unpublished draft"
                description={
                  formatEightBoxDate(draft.updatedAt)
                    ? `Last saved ${formatEightBoxDate(draft.updatedAt)}. Nobody else can see it until you publish.`
                    : "Nobody else can see it until you publish."
                }
                endContent={
                  <Link href={editHref} className={primaryLink}>
                    Continue draft
                  </Link>
                }
              />
            )}

            {latest ? (
              <>
                <Card
                  className="bg-background/60 dark:bg-default-100/50"
                  shadow="md"
                >
                  <CardHeader className="flex flex-col items-start gap-1 px-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Latest: {latest.period}
                      </h2>
                      <p className="text-sm text-foreground/60">
                        {eightBoxMetaLine(
                          latest.period,
                          latest.version,
                          latest.publishedAt,
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/stats/pax/${paxId}/8box/${latest.id}`}
                      className="text-sm text-primary"
                    >
                      Open this version
                    </Link>
                  </CardHeader>
                  <Divider />
                  <CardBody className="gap-5 px-6">
                    <EightBoxBoard
                      variant="screen"
                      content={latest.content}
                      period={latest.period}
                      f3Name={f3Name}
                      version={latest.version}
                      publishedAt={latest.publishedAt}
                    />
                    <Divider />
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <EightBoxExportActions
                        content={latest.content}
                        period={latest.period}
                        f3Name={f3Name}
                        version={latest.version}
                        publishedAt={latest.publishedAt}
                      />
                      <EightBoxShareToggle
                        paxId={paxId}
                        versionId={latest.id}
                        sharedAt={latest.sharedAt}
                      />
                    </div>
                  </CardBody>
                </Card>

                <EightBoxHistory paxId={paxId} versions={data.versions} />
              </>
            ) : (
              <Card
                className="bg-background/60 dark:bg-default-100/50"
                shadow="md"
              >
                <CardHeader className="px-6">
                  <h2 className="text-xl font-semibold">
                    {draft ? "Nothing published yet" : "No 8 Box yet"}
                  </h2>
                </CardHeader>
                <CardBody className="gap-4 px-6 text-sm text-foreground/70">
                  <p>
                    The 8 Box is the F3 vision board: Concentrica, the three Fs,
                    the Jester, Mental Sharpness, Date Night, and ALR. Fill it
                    in once a quarter, publish it, and share it with your shield
                    lock.
                  </p>
                  <p className="text-foreground/60">
                    Drafts are private. Published versions are private too until
                    you turn on a share link for one.
                  </p>
                  <Link href={editHref} className={primaryLink}>
                    {draft ? "Continue draft" : "Start your 8 Box"}
                  </Link>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}
