/****
 * 8 Box editor page (owner-only).
 *
 * Loads the PAX's existing draft — or, failing that, prefills from the
 * latest published version — and hands it to the client form. The gate here
 * is for UX; the draft/publish/delete routes re-check ownership.
 */

import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { PageHeader } from "@/components/pageHeader";
import { getSessionUser, requireAuth } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxPageData } from "@/lib/bq/eightBox";
import { currentQuarterLabel, emptyEightBox } from "@/lib/eightBox";
import { EightBoxForm } from "@/components/pax/eightbox/EightBoxForm";
import { EightBoxPrivate } from "@/components/pax/eightbox/EightBoxPrivate";

interface PageProps {
  params: Promise<{ paxId: string }>;
}

export default async function EightBoxEditPage({ params }: PageProps) {
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

  if (!data.info) {
    notFound();
  }

  const f3Name = data.info.f3_name;
  const draft = data.draft;
  const latest = data.versions[0] ?? null;
  const source = draft ?? latest;
  const nextVersion = (latest?.version ?? 0) + 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-4xl pb-6 px-4">
        <Breadcrumb
          items={buildBreadcrumb({
            includeNation: false,
            parent: { label: "8 Box", href: `/stats/pax/${paxId}/8box` },
            current: draft ? "Draft" : "New version",
          })}
        />

        <PageHeader
          image={data.info.avatar_url ?? undefined}
          name={`${f3Name} — 8 Box`}
          link={`/stats/pax/${paxId}/8box`}
          linkName="Back to 8 Box"
        />

        {isOwner ? (
          <EightBoxForm
            paxId={paxId}
            draftId={draft?.id ?? null}
            initialContent={source?.content ?? emptyEightBox()}
            // A draft keeps its own label; a fresh version defaults to the
            // current quarter rather than inheriting last quarter's.
            initialPeriod={draft?.period ?? currentQuarterLabel()}
            nextVersion={nextVersion}
            draftUpdatedAt={draft?.updatedAt ?? null}
            prefilledFromPublished={!draft && latest !== null}
            f3Name={f3Name}
          />
        ) : (
          <EightBoxPrivate paxId={paxId} f3Name={f3Name} />
        )}
      </div>
    </main>
  );
}
