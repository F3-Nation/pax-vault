import { RegionData, RegionLeaders, RegionSummary } from "@/types/region";

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
