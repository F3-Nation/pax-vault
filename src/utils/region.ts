import {
  RegionData,
  RegionLeaders,
  RegionSummary,
  RegionKotterList,
} from "@/types/region";

export function getSummary(data: RegionData[]): RegionSummary | null {
  if (data.length === 0) {
    return null;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const event_count = data.length;
  const ao_count = new Set(data.map((d) => d.ao_org_id)).size;
  const active_pax = new Set(
    data
      .filter((d) => new Date(d.event_date) >= thirtyDaysAgo)
      .flatMap((d) => d.attendance.map((att) => att.user_id)),
  ).size;
  const unique_pax = new Set(
    data.flatMap((d) => d.attendance.map((att) => att.user_id)),
  ).size;
  const unique_qs = new Set(
    data.flatMap((d) =>
      d.attendance.filter((att) => att.q_ind).map((att) => att.user_id),
    ),
  ).size;
  const fng_count = data.reduce((sum, d) => sum + d.fng_count, 0);
  const pax_count_average =
    data.reduce((sum, d) => sum + d.pax_count, 0) / event_count;

  return {
    event_count,
    ao_count,
    active_pax,
    unique_pax,
    unique_qs,
    fng_count,
    pax_count_average,
  };
}

export function getLeaderboards(data: RegionData[]): RegionLeaders[] | null {
  const counts = new Map<number, RegionLeaders>();

  for (const { attendance } of data) {
    for (const att of attendance) {
      const current = counts.get(att.user_id) ?? {
        user_id: att.user_id,
        f3_name: att.f3_name,
        avatar_url: att.avatar_url ?? undefined,
        posts: 0,
        qs: 0,
      };

      current.posts += 1;
      if (att.q_ind) current.qs += 1;
      counts.set(att.user_id, current);
    }
  }

  const leaders = Array.from(counts.values());
  return leaders.sort((a, b) => b.posts - a.posts);
}

export function getKotterList(data: RegionData[]): RegionKotterList[] | null {
  if (!data || data.length === 0) return null;

  // "Kotter" here = folks who haven't posted recently.
  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };

  const minWindow = 14;
  const maxWindow = 90;
  const cutoff30 = daysAgo(30);
  const cutoff90 = daysAgo(90);

  type EventMeta = {
    event_name?: string;
    name?: string;
    ao_name?: string;
    ao?: string;
    ao_org_id?: number;
  };

  const asEventMeta = (e: RegionData): EventMeta => e as unknown as EventMeta;

  type Acc = {
    user_id: number;
    f3_name: string;
    avatar_url?: string;
    total_posts: number;
    posts_last_30: number;
    posts_last_90: number;
    aos_last_90: Set<number>;
    first_post_date: Date;
    last_post_date: Date;
    last_event_name: string;
    last_event_ao_name: string;
    last_event_ao_org_id: number;
  };

  const byUser = new Map<number, Acc>();

  // For bestie calculation: user -> (otherUser -> count)
  const coAttendance = new Map<number, Map<number, number>>();

  // Keep the latest identity info we see for any user_id
  const identity = new Map<number, { f3_name: string; avatar_url?: string }>();

  for (const evt of data) {
    const evtDate = new Date(evt.event_date);

    // Bestie counting: for all attendees in this event, increment co-attendance
    const attendees = evt.attendance;
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      for (let j = 0; j < attendees.length; j++) {
        if (i === j) continue;
        const b = attendees[j];

        const inner = coAttendance.get(a.user_id) ?? new Map<number, number>();
        inner.set(b.user_id, (inner.get(b.user_id) ?? 0) + 1);
        coAttendance.set(a.user_id, inner);

        // Update identity cache for both sides as we see them
        if (a.f3_name) {
          identity.set(a.user_id, {
            f3_name: a.f3_name,
            avatar_url: a.avatar_url ?? undefined,
          });
        }
        if (b.f3_name) {
          identity.set(b.user_id, {
            f3_name: b.f3_name,
            avatar_url: b.avatar_url ?? undefined,
          });
        }
      }
    }

    for (const att of evt.attendance) {
      const current = byUser.get(att.user_id) ?? {
        user_id: att.user_id,
        f3_name: att.f3_name ?? "",
        avatar_url: att.avatar_url ?? undefined,
        total_posts: 0,
        posts_last_30: 0,
        posts_last_90: 0,
        aos_last_90: new Set<number>(),
        // initialize with something very new/old so min/max work
        first_post_date: new Date(8640000000000000),
        last_post_date: new Date(0),
        last_event_name: "",
        last_event_ao_name: "",
        last_event_ao_org_id: 0,
      };

      current.total_posts += 1;
      if (evtDate < current.first_post_date) {
        current.first_post_date = evtDate;
      }
      if (evtDate >= cutoff30) current.posts_last_30 += 1;

      if (evtDate >= cutoff90) {
        current.posts_last_90 += 1;
        const aoId = asEventMeta(evt).ao_org_id ?? 0;
        if (aoId) current.aos_last_90.add(aoId);
      }

      if (evtDate > current.last_post_date) {
        current.last_post_date = evtDate;
        // RegionData varies a bit across queries; try common field names safely.
        const meta = asEventMeta(evt);
        current.last_event_name = meta.event_name ?? meta.name ?? "";
        current.last_event_ao_name = meta.ao_name ?? meta.ao ?? "";
        current.last_event_ao_org_id = meta.ao_org_id ?? 0;
      }

      // Keep latest name/avatar if present
      if (att.f3_name) current.f3_name = att.f3_name;
      if (att.avatar_url) current.avatar_url = att.avatar_url;

      // Track latest identity info for this user_id
      if (current.f3_name) {
        identity.set(current.user_id, {
          f3_name: current.f3_name,
          avatar_url: current.avatar_url,
        });
      }

      byUser.set(att.user_id, current);
    }
  }

  const dayDiff = (a: Date, b: Date) => {
    const ms = a.getTime() - b.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const avgPerMonth = (events: number, days: number) =>
    events / Math.max(1, days / 30);

  const classifyKotterStatus = (u: {
    days_since_last_event: number;
    days_since_first_event: number;
    total_events: number;
    events_last_90: number;
    unique_aos_last_90: number;
  }) => {
    const dLast = u.days_since_last_event;
    const dFirst = u.days_since_first_event;
    const total = u.total_events;

    const avgLifetime = avgPerMonth(total, dFirst);
    const avgLast90 = u.events_last_90 / 3; // 90 days ~= 3 months

    if (total <= 6 && dLast >= 14 && dFirst <= 90) return "New PAX Drop";
    if (total >= 100 && avgLifetime >= 4 && dLast >= 21) return "Veteran Drift";

    if (
      total >= 50 &&
      avgLifetime >= 2 &&
      avgLast90 <= 0.5 &&
      dLast >= 30 &&
      dLast <= 120 &&
      u.unique_aos_last_90 <= 2
    ) {
      return "Seasonal";
    }

    if (total >= 7 && total <= 99 && dLast >= 21 && dLast <= 45)
      return "Soft Drift";
    if (dLast < 14) return "Active";
    return "Inactive";
  };

  // Build a list for anyone whose last post is older than 30 days.
  // If your RegionKotterList type differs, this is intentionally shaped
  // with the most commonly-needed fields; we cast at the end.
  const kotters = Array.from(byUser.values())
    .map((u) => {
      const days_since_last_event = dayDiff(now, u.last_post_date);

      const days_since_first_event = dayDiff(now, u.first_post_date);

      const unique_aos_last_90 = u.aos_last_90?.size ?? 0;

      const kotter_status = classifyKotterStatus({
        days_since_last_event,
        days_since_first_event,
        total_events: u.total_posts,
        events_last_90: u.posts_last_90,
        unique_aos_last_90,
      });

      // Besties list (co-attendance counts), sorted most-together first
      const mates = coAttendance.get(u.user_id);
      const besties = mates
        ? Array.from(mates.entries())
            .map(([otherId, cnt]) => {
              const other = identity.get(otherId);
              return {
                user_id: otherId,
                f3_name: other?.f3_name ?? otherId.toString(),
                avatar_url: other?.avatar_url ?? undefined,
                co_attendance_count: cnt,
              };
            })
            .sort((a, b) => b.co_attendance_count - a.co_attendance_count)
        : [];

      return {
        user_id: u.user_id,
        f3_name: u.f3_name ?? u.user_id.toString(),
        avatar_url: u.avatar_url,

        kotter_status,

        total_events: u.total_posts,
        first_event_date: u.first_post_date
          ? u.first_post_date.toISOString().slice(0, 10)
          : null,

        days_since_last_event: days_since_last_event,
        last_event_date: u.last_post_date.toISOString().slice(0, 10),
        last_event_name: u.last_event_name,
        last_event_ao_name: u.last_event_ao_name,
        last_event_ao_org_id: u.last_event_ao_org_id,

        bestie_list: besties.slice(0, 3), // top 3 besties
      };
    })
    .filter(
      (u) =>
        u.days_since_last_event >= minWindow &&
        u.days_since_last_event <= maxWindow,
    )
    .sort((a, b) => a.days_since_last_event - b.days_since_last_event);

  // Cast to your RegionKotterList shape.
  return kotters as unknown as RegionKotterList[];
}
