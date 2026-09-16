/****
 * One published 8 Box version — the share-link target.
 *
 * Who can see it:
 * - the owner, always (with share + delete controls);
 * - any signed-in user, only while the version's share link is on.
 *
 * Anything else — an unknown id, a draft, an unshared version viewed by
 * someone else — is a 404, so the URL never confirms that a private board
 * exists. Anonymous visitors never get here: middleware bounces them to sign
 * in and returns them afterwards.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { PageHeader } from "@/components/pageHeader";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxVersionPageData } from "@/lib/bq/eightBox";
import {
  EightBoxBoard,
  eightBoxMetaLine,
} from "@/components/pax/eightbox/EightBoxBoard";
import { EightBoxDeleteButton } from "@/components/pax/eightbox/EightBoxDeleteButton";
import { EightBoxExportActions } from "@/components/pax/eightbox/EightBoxExportActions";
import { EightBoxShareToggle } from "@/components/pax/eightbox/EightBoxShareToggle";

interface PageProps {
  params: Promise<{ paxId: string; versionId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EightBoxVersionPage({ params }: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { paxId: rawPaxId, versionId: rawVersionId } = await params;
  const paxId = Number(rawPaxId);
  if (!Number.isInteger(paxId) || paxId <= 0 || !UUID_RE.test(rawVersionId)) {
    notFound();
  }
  const versionId = rawVersionId.toLowerCase();

  const [isOwner, data] = await Promise.all([
    isOwnPax(paxId),
    getEightBoxVersionPageData(paxId, versionId, user.email),
  ]);

  const record = data.record;
  if (!data.info || !record || record.status !== "published") {
    notFound();
  }
  if (!isOwner && record.sharedAt === null) {
    notFound();
  }

  const f3Name = data.info.f3_name;
  const overviewHref = `/stats/pax/${paxId}/8box`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <Breadcrumb
          items={buildBreadcrumb({
            includeNation: false,
            parent: isOwner
              ? { label: "8 Box", href: overviewHref }
              : { label: f3Name, href: `/stats/pax/${paxId}` },
            current: `${record.period} (v${record.version})`,
          })}
        />

        <PageHeader
          image={data.info.avatar_url ?? undefined}
          name={`${f3Name} — 8 Box · ${record.period}`}
          link={isOwner ? overviewHref : `/stats/pax/${paxId}`}
          linkName={isOwner ? "Back to 8 Box" : `Back to ${f3Name}`}
        />

        <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex flex-col items-start gap-1 px-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{record.period}</h2>
              <p className="text-sm text-foreground/60">
                {eightBoxMetaLine(
                  record.period,
                  record.version,
                  record.publishedAt,
                )}
                {!isOwner && " · shared with you by link"}
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <Link href={overviewHref} className="text-sm text-primary">
                  All versions
                </Link>
                <EightBoxDeleteButton
                  paxId={paxId}
                  versionId={record.id}
                  label={`version ${record.version} (${record.period})`}
                  kind="published"
                  redirectTo={overviewHref}
                />
              </div>
            )}
          </CardHeader>
          <Divider />
          <CardBody className="gap-5 px-6">
            <EightBoxBoard
              variant="screen"
              content={record.content}
              period={record.period}
              f3Name={f3Name}
              version={record.version}
              publishedAt={record.publishedAt}
            />
            <Divider />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <EightBoxExportActions
                content={record.content}
                period={record.period}
                f3Name={f3Name}
                version={record.version}
                publishedAt={record.publishedAt}
              />
              {isOwner && (
                <EightBoxShareToggle
                  paxId={paxId}
                  versionId={record.id}
                  sharedAt={record.sharedAt}
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
