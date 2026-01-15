import {
  EventData,
  Leaders,
  AOSummary,
  AOChartData,
  AOChart_UniquePax,
  AOChart_WorkoutAOCount,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function getSummary(data: EventData[]): AOSummary | null {
  if (data.length === 0) {
    return null;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const event_count = data.length;
  const first_event_date =
    data.length > 0 ? formatDate(new Date(data[0].event_date)) : null;
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
    first_event_date,
    active_pax,
    unique_pax,
    unique_qs,
    fng_count,
    pax_count_average,
  };
}

export function getLeaderboards(data: EventData[]): Leaders[] | null {
  const counts = new Map<number, Leaders>();

  for (const { attendance } of data) {
    for (const att of attendance) {
      if (att.isBot) continue;
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

export function getChartData(
  data: EventData[],
  start_date?: string,
  end_date?: string,
): AOChartData | null {
  const uniquePax = getComboChartData(data, start_date, end_date);
  const workoutAOCount = getTreeChartData(data, start_date, end_date);

  return {
    uniquePax: uniquePax!,
    workoutAOCount: workoutAOCount!,
  };
}

function getComboChartData(
  data: EventData[],
  start_date?: string,
  end_date?: string,
): AOChart_UniquePax | null {
  if (!data || data.length === 0) return null;

  // Parse `YYYY-MM-DD` safely as UTC midnight to avoid timezone drift
  const parseDateUTC = (s: string) => new Date(`${s}T00:00:00Z`);

  const dayDiff = (a: Date, b: Date) =>
    Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

  // Determine timeframe bounds (prefer explicit start/end; else min/max from data)
  let minEvt = parseDateUTC(data[0].event_date);
  let maxEvt = minEvt;

  for (const evt of data) {
    const d = parseDateUTC(evt.event_date);
    if (d < minEvt) minEvt = d;
    if (d > maxEvt) maxEvt = d;
  }

  const start = start_date
    ? new Date(start_date).getTime() === new Date(0).getTime()
      ? minEvt
      : parseDateUTC(start_date)
    : minEvt;
  const end = end_date
    ? new Date(end_date).getTime() ===
      new Date(Date.UTC(2050, 11, 31)).getTime()
      ? maxEvt
      : parseDateUTC(end_date)
    : maxEvt;

  // Normalize if start/end reversed
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;

  // Filter events to the requested timeframe (inclusive)
  const inRange = data.filter((evt) => {
    const d = parseDateUTC(evt.event_date);
    return (
      d.getTime() >= rangeStart.getTime() && d.getTime() <= rangeEnd.getTime()
    );
  });

  const rangeDays = Math.max(0, dayDiff(rangeEnd, rangeStart));
  const useDaily = rangeDays < 60;
  const useWeekly = !useDaily && rangeDays < 365;

  // --- Bucket helpers ---
  const monthKeyUTC = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`; // e.g. 2025-12
  };

  const monthStartUTC = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

  const addMonthsUTC = (d: Date, n: number) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

  // Monday-start week key: ISO date (YYYY-MM-DD) of the Monday in UTC
  const weekStartMondayUTC = (d: Date) => {
    const dt = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const day = dt.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // Mon->0, Tue->1, ..., Sun->6
    dt.setUTCDate(dt.getUTCDate() - diffToMonday);
    return dt;
  };

  const weekKeyUTC = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`; // Monday date for the week
  };

  const addDaysUTC = (d: Date, n: number) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

  const dayKeyUTC = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`; // YYYY-MM-DD
  };

  // Map bucket -> unique user ids
  const bucketToUsers = new Map<string, Set<number>>();

  for (const evt of inRange) {
    const d = parseDateUTC(evt.event_date);
    const key = useDaily
      ? dayKeyUTC(d)
      : useWeekly
        ? weekKeyUTC(weekStartMondayUTC(d))
        : monthKeyUTC(d);

    let set = bucketToUsers.get(key);
    if (!set) {
      set = new Set<number>();
      bucketToUsers.set(key, set);
    }

    for (const att of evt.attendance ?? []) {
      set.add(att.user_id);
    }
  }

  // Build inclusive bucket list and fill empty buckets with 0
  const out: { iteration: string; count: number }[] = [];

  if (useDaily) {
    let cur = new Date(
      Date.UTC(
        rangeStart.getUTCFullYear(),
        rangeStart.getUTCMonth(),
        rangeStart.getUTCDate(),
      ),
    );
    const last = new Date(
      Date.UTC(
        rangeEnd.getUTCFullYear(),
        rangeEnd.getUTCMonth(),
        rangeEnd.getUTCDate(),
      ),
    );

    while (cur.getTime() <= last.getTime()) {
      const key = dayKeyUTC(cur);
      out.push({
        iteration: key,
        count: bucketToUsers.get(key)?.size ?? 0,
      });
      cur = addDaysUTC(cur, 1);
    }
  } else if (useWeekly) {
    let cur = weekStartMondayUTC(rangeStart);
    const last = weekStartMondayUTC(rangeEnd);

    while (cur.getTime() <= last.getTime()) {
      const key = weekKeyUTC(cur);
      out.push({
        iteration: key,
        count: bucketToUsers.get(key)?.size ?? 0,
      });
      cur = addDaysUTC(cur, 7);
    }
  } else {
    let cur = monthStartUTC(rangeStart);
    const last = monthStartUTC(rangeEnd);

    while (cur.getTime() <= last.getTime()) {
      const key = monthKeyUTC(cur);
      out.push({
        iteration: key,
        count: bucketToUsers.get(key)?.size ?? 0,
      });
      cur = addMonthsUTC(cur, 1);
    }
  }

  // Rolling average trend:
  // - Daily: 7-day rolling average
  // - Weekly: 9-week rolling average
  // - Monthly: 6-month rolling average
  const WINDOW = useDaily ? 7 : useWeekly ? 9 : 6;

  const withTrend = out.map((pt, idx) => {
    const startIdx = Math.max(0, idx - (WINDOW - 1));
    const slice = out.slice(startIdx, idx + 1);
    const avg =
      slice.reduce((sum, p) => sum + p.count, 0) / Math.max(1, slice.length);

    return {
      iteration: pt.iteration,
      count: pt.count,
      average: Number(avg.toFixed(2)),
    };
  });

  return {
    itteration_type: useDaily ? "day" : useWeekly ? "week" : "month",
    data: withTrend,
  };
}

function getTreeChartData(
  data: EventData[],
  start_date?: string,
  end_date?: string,
): AOChart_WorkoutAOCount[] | null {
  if (!data || data.length === 0) return null;
  const aoCountMap = new Map<string, number>();

  // Parse `YYYY-MM-DD` safely as UTC midnight to avoid timezone drift
  const parseDateUTC = (s: string) => new Date(`${s}T00:00:00Z`);

  // Determine timeframe bounds (prefer explicit start/end; else min/max from data)
  let minEvt = parseDateUTC(data[0].event_date);
  let maxEvt = minEvt;

  for (const evt of data) {
    const d = parseDateUTC(evt.event_date);
    if (d < minEvt) minEvt = d;
    if (d > maxEvt) maxEvt = d;
  }

  const start = start_date
    ? new Date(start_date).getTime() === new Date(0).getTime()
      ? minEvt
      : parseDateUTC(start_date)
    : minEvt;
  const end = end_date
    ? new Date(end_date).getTime() ===
      new Date(Date.UTC(2050, 11, 31)).getTime()
      ? maxEvt
      : parseDateUTC(end_date)
    : maxEvt;

  // Normalize if start/end reversed
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;

  // Filter events to the requested timeframe (inclusive)
  const inRange = data.filter((evt) => {
    const d = parseDateUTC(evt.event_date);
    return (
      d.getTime() >= rangeStart.getTime() && d.getTime() <= rangeEnd.getTime()
    );
  });

  for (const evt of inRange) {
    const aoName = evt.ao_name || "Unknown AO";
    aoCountMap.set(aoName, (aoCountMap.get(aoName) || 0) + 1);
  }

  const aoCounts: AOChart_WorkoutAOCount[] = Array.from(
    aoCountMap,
    ([aoName, count]) => ({
      aoName,
      count,
    }),
  );

  return aoCounts;
}
