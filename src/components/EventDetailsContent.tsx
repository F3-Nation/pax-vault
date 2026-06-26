"use client";

/**
 * EventDetailsContent
 *
 * Shared, presentational rendering of a single event's details — the Q/PAX
 * lists, image gallery, and pre/backblast. Extracted from the events modal so
 * the modal and the standalone /stats/events/[id] page render an identical view
 * from one source of truth (issue #77).
 *
 * Two pieces map cleanly onto the modal's header/body split:
 * - EventDetailsHeader: title, date, AO/region links, type/tag chips.
 * - EventDetailsBody: Q/PAX, images, preblast, backblast (+ a loading skeleton).
 */

import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Link } from "@heroui/link";
import { Image } from "@heroui/image";
import { EventData, EventDetails } from "@/lib/types";
import { formatDate, cleanEventName } from "@/lib/utils";

function sortAttendance(list: EventData["attendance"]) {
  return list
    .slice()
    .sort((a, b) =>
      (a.f3_name ?? a.user_id.toString()).localeCompare(
        b.f3_name ?? b.user_id.toString(),
      ),
    );
}

const getQList = (event: EventData) =>
  sortAttendance(event.attendance.filter((att) => att.q_ind));

const getPaxList = (event: EventData) => sortAttendance(event.attendance);

// No-shows (signed up but didn't post). Separate array, kept out of the
// attendance roster and counts.
const getFartsackList = (event: EventData) =>
  sortAttendance(event.fartsacks ?? []);

export function EventDetailsHeader({
  event,
  filters,
}: {
  event: EventData;
  filters?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xl font-semibold text-foreground">
        {cleanEventName(event.event_name)}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-default-500">
        <span>{formatDate(event.event_date)}</span>
        <span className="text-default-400">•</span>
        <Link
          href={
            event.ao_org_id
              ? `/stats/ao/${event.ao_org_id}${filters ? `?${filters}` : ""}`
              : `/stats/region/${event.region_org_id}${filters ? `?${filters}` : ""}`
          }
          className="text-default-500 hover:text-default-700"
        >
          {event.ao_name ?? event.region_name ?? "Unknown AO"}
        </Link>
        {event.region_name && (
          <>
            <span className="text-default-400">•</span>
            <Link
              href={`/stats/region/${event.region_org_id}${filters ? `?${filters}` : ""}`}
              className="text-default-500 hover:text-default-700"
            >
              {event.region_name}
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(event.types?.length ?? 0) > 0 &&
          event.types?.map((t, i) => (
            <Chip
              key={`type-${event.event_instance_id}-${i}`}
              size="sm"
              variant="flat"
              color="default"
            >
              {t.name}
            </Chip>
          ))}

        {(event.tags?.length ?? 0) > 0 &&
          event.tags?.map((t, i) => (
            <Chip
              key={`tag-${event.event_instance_id}-${i}`}
              size="sm"
              variant="flat"
              color="warning"
            >
              {t.name}
            </Chip>
          ))}
      </div>
    </div>
  );
}

export function EventDetailsBody({
  event,
  details,
  isLoadingDetails = false,
  filters,
}: {
  event: EventData;
  details: EventDetails | null;
  isLoadingDetails?: boolean;
  filters?: string;
}) {
  const hasEventImages = (details?.meta?.files?.length ?? 0) > 0;

  if (isLoadingDetails) {
    return (
      <div className="space-y-4">
        <div className="text-sm italic text-default-400">
          Loading event details…
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/2 rounded bg-default-200 dark:bg-default-300" />
          <div className="h-4 w-5/6 rounded bg-default-100 dark:bg-default-200" />
          <div className="h-4 w-2/3 rounded bg-default-100 dark:bg-default-200" />
        </div>
      </div>
    );
  }

  const qChips = (
    <div className="flex flex-wrap gap-2">
      {getQList(event).length === 0 ? (
        <Chip
          key={`q-unknown-${event.event_instance_id}`}
          avatar={<Avatar showFallback src={undefined} />}
          variant="bordered"
          color="secondary"
          size="sm"
        >
          Unknown Q
        </Chip>
      ) : (
        getQList(event).map((q, i) => (
          <Link
            key={`q-${event.event_instance_id}-${i}`}
            href={`/stats/pax/${q.user_id}${filters ? `?${filters}` : ""}`}
            className="text-default-100"
          >
            <Chip
              avatar={<Avatar showFallback src={q.avatar_url || undefined} />}
              variant="bordered"
              color="secondary"
              size="sm"
            >
              {q.f3_name ?? q.user_id.toString()}
            </Chip>
          </Link>
        ))
      )}
    </div>
  );

  const paxChips = (
    <div className="flex flex-wrap gap-2">
      {getPaxList(event).length === 0 ? (
        <span className="italic text-default-500">No attendees</span>
      ) : (
        getPaxList(event).map((pax, i) => (
          <Link
            key={`pax-${event.event_instance_id}-${i}`}
            href={`/stats/pax/${pax.user_id}${filters ? `?${filters}` : ""}`}
            className="text-default-100"
          >
            <Chip
              avatar={<Avatar showFallback src={pax.avatar_url || undefined} />}
              variant="bordered"
              color="default"
              size="sm"
              // Ghosts (attended unannounced) get muted text — they posted,
              // just off-plan.
              classNames={{ content: pax.ghost ? "text-default-400" : "" }}
            >
              {pax.f3_name ?? pax.user_id.toString()}
            </Chip>
          </Link>
        ))
      )}
    </div>
  );

  const paxCountLabel = (
    <div className="text-xs text-default-500">
      {getPaxList(event).length} attendee(s)
    </div>
  );

  // Fart Sacks: signed up but no-showed. Rendered as its own labeled, danger
  // section after the PAX chips; null when there are none.
  const fartsackChips =
    getFartsackList(event).length > 0 ? (
      <div className="mt-3">
        <div className="text-xs tracking-wide text-danger mb-2">
          Fart Sackers
        </div>
        <div className="flex flex-wrap gap-2">
          {getFartsackList(event).map((pax, i) => (
            <Link
              key={`fartsack-${event.event_instance_id}-${i}`}
              href={`/stats/pax/${pax.user_id}${filters ? `?${filters}` : ""}`}
              className="text-default-100"
            >
              <Chip
                avatar={
                  <Avatar showFallback src={pax.avatar_url || undefined} />
                }
                variant="bordered"
                color="danger"
                size="sm"
              >
                {pax.f3_name ?? pax.user_id.toString()}
              </Chip>
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {hasEventImages ? (
        <section className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Left: Q(s) + PAX (flexes to fill remaining width) */}
          <div className="flex-1 min-w-0 rounded-lg border border-default-200 dark:border-default-300 bg-background/60 dark:bg-default-100/50 p-4">
            <div className="space-y-5">
              <div>
                <div className="text-xs tracking-wide text-default-500 mb-2">
                  Qs
                </div>
                {qChips}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <div className="text-xs uppercase tracking-wide text-default-500 mb-2">
                    PAX
                  </div>
                  {paxCountLabel}
                </div>
                {paxChips}
                {fartsackChips}
              </div>
            </div>
          </div>

          {/* Right: Image (stretches to match left panel height on md+) */}
          <div className="w-full md:w-[360px] lg:w-[420px] shrink-0 rounded-lg border border-default-200 dark:border-default-300 bg-background/60 dark:bg-default-100/50 p-3">
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  Image
                </div>
                <div className="text-xs text-default-500">
                  {(details?.meta?.files?.length ?? 0) > 1
                    ? `${details?.meta?.files?.length ?? 0} files`
                    : `${details?.meta?.files?.length ?? 0} file`}
                </div>
              </div>

              {/* Hero image fills available height */}
              <div className="flex-1 min-h-[220px]">
                <a
                  href={(details?.meta?.files ?? [])[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-full"
                >
                  <Image
                    src={(details?.meta?.files ?? [])[0]}
                    alt="Event image"
                    className="h-full w-full object-cover rounded-md border border-default-200 dark:border-default-300"
                  />
                </a>
              </div>

              {/* Optional thumbnails when multiple images exist */}
              {(details?.meta?.files?.length ?? 0) > 1 && (
                <div className="flex flex-wrap gap-2">
                  {(details?.meta?.files ?? [])
                    .slice(1, 5)
                    .map((file, index) => (
                      <a
                        key={file}
                        href={file}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <Image
                          src={file}
                          alt={`Event thumbnail ${index + 2}`}
                          className="h-16 w-20 object-cover rounded-md border border-default-200 dark:border-default-300"
                        />
                      </a>
                    ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-default-200 dark:border-default-300 bg-background/60 dark:bg-default-100/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs tracking-wide text-default-500 mb-2">
                Qs
              </div>
              {qChips}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <div className="text-xs uppercase tracking-wide text-default-500 mb-2">
                  PAX
                </div>
                {paxCountLabel}
              </div>
              {paxChips}
              {fartsackChips}
            </div>
          </div>
        </section>
      )}

      {/* Preblast */}
      <section>
        <div className="text-xs uppercase tracking-wide text-default-500 mb-2">
          Preblast
        </div>
        <div className="rounded-lg border border-default-200 dark:border-default-300 bg-background/60 dark:bg-default-100/50 p-4 text-sm whitespace-pre-wrap">
          {details?.preblast ? (
            details.preblast
          ) : (
            <span className="italic text-default-500">
              No preblast provided.
            </span>
          )}
        </div>
      </section>

      {/* Backblast */}
      <section>
        <div className="text-xs uppercase tracking-wide text-default-500 mb-2">
          Backblast
        </div>
        <div className="rounded-lg border border-default-200 dark:border-default-300 bg-background/60 dark:bg-default-100/50 p-4 text-sm whitespace-pre-wrap">
          {details?.backblast ? (
            details.backblast
          ) : (
            <span className="italic text-default-500">
              No backblast provided.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
