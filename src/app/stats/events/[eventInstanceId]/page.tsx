/****
 * Standalone event page.
 *
 * Renders a single event's details on its own shareable URL
 * (/stats/events/[id]) — the same view as the events modal, but as a real page
 * that can be linked to directly (issue #77).
 *
 * Responsibilities:
 * - Validate the event-instance id from the route param.
 * - Fetch the event's core data and rich details in parallel.
 * - 404 when the id is invalid or no matching event exists.
 */

import { notFound } from "next/navigation";
import { requireAuth, getSessionUser } from "@/lib/auth/server";
import { getEventById, getEventDetails } from "@/lib/bq/events";
import { cleanEventName } from "@/lib/utils";
import { parseRegionPreferences } from "@/lib/preferences";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import {
  EventDetailsHeader,
  EventDetailsBody,
} from "@/components/EventDetailsContent";

interface PageProps {
  params: Promise<{ eventInstanceId: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  await requireAuth();
  const user = await getSessionUser();
  if (!user) throw new Error("User should never be null after requireAuth");

  const { eventInstanceId: rawId } = await params;
  const eventId = Number(rawId);
  if (!rawId || !Number.isFinite(eventId) || eventId <= 0) {
    notFound();
  }

  const [event, details] = await Promise.all([
    getEventById(eventId, user.email),
    getEventDetails(eventId, user.email),
  ]);

  if (!event) {
    notFound();
  }

  const path = `/stats/events/${event.event_instance_id}`;
  const parent =
    event.ao_org_id && event.ao_name
      ? { label: event.ao_name, href: `/stats/ao/${event.ao_org_id}` }
      : event.region_org_id
        ? {
            label: event.region_name ?? "Region",
            href: `/stats/region/${event.region_org_id}`,
          }
        : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <Breadcrumb
          items={buildBreadcrumb({
            parent,
            current: cleanEventName(event.event_name),
          })}
        />

        <div className="rounded-lg border border-default-200 dark:border-default-300 bg-background/60 dark:bg-default-100/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <EventDetailsHeader event={event} />
            <div className="shrink-0">
              <CopyLinkButton path={path} />
            </div>
          </div>
        </div>

        <EventDetailsBody
          event={event}
          details={details}
          showFartsackGhost={
            parseRegionPreferences(event.preferencesJson).showFartsackGhostStats
          }
        />
      </div>
    </main>
  );
}
