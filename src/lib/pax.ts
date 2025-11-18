// src/lib/region.ts
import {
  PaxList,
  PaxDetail,
  PaxEvents,
  PaxEventsCalculations,
  PaxEventsResults,
  PaxAchievements,
  PaxInsights,
} from "@/types/pax";
import { getPaxList } from "@/lib/cache/pax";

import { cache } from "react";
import { formatDate } from "@/lib/utils";
import pool from "@/lib/db";

export const getCachedPaxList = cache(async (): Promise<PaxList[]> => {
  try {
    return await getPaxList();
  } catch (err) {
    console.error("Failed to load pax data:", err);
    return [];
  }
});

export async function getPaxDetail(id: number): Promise<PaxDetail | null> {
  const { rows } = await pool.query(
    `
    SELECT 
      us.id,
      us.f3_name,
      us.first_name,
      us.last_name,
      us.email,
      org.name AS region,
      org.id AS region_id,
      er.region_name AS region_default,
      er.region_org_id AS region_default_id,
      us.avatar_url AS avatar,
      us.created,
      us.updated,
      us.status
    FROM users us
      LEFT JOIN orgs org ON us.home_region_id = org.id
      LEFT JOIN LATERAL (
        SELECT 
          ei.region_name,
          ei.region_org_id
        FROM attendance_expanded ae
        JOIN event_instance_expanded ei ON ae.event_instance_id = ei.id
        WHERE ae.user_id = us.id
        ORDER BY ei.start_date ASC
        LIMIT 1
      ) er ON true
    WHERE us.id = $1
    `,
    [id]
  );

  if (!rows[0]) return null;

  // Replace region and region_id with defaults if null
  const pax = rows[0];
  if (pax.region == null) pax.region = pax.region_default;
  if (pax.region_id == null) pax.region_id = pax.region_default_id;

  return pax;
}

export async function getAchievementData(
  id: number
): Promise<PaxAchievements[]> {
  const { rows } = await pool.query(
    `
    SELECT
      au.achievement_id,
      au.user_id,
      ach.name,
      ach.description,
      ach.image_url,
      ach.specific_org_id,
      au.date_awarded,
      au.award_year,
      au.award_period,
      COUNT(*) AS times
    FROM
      achievements_x_users au
      LEFT JOIN achievements ach ON ach.id = au.achievement_id
    WHERE
      au.user_id = $1
    GROUP BY
      au.achievement_id,
      au.user_id,
      au.date_awarded,
      au.award_year,
      au.award_period,
      ach.name,
      ach.description,
      ach.image_url,
      ach.specific_org_id
    ORDER BY
      MAX(au.date_awarded) DESC
    `,
    [id]
  );
  return rows as PaxAchievements[];
}

export async function getPaxEvents(id: number): Promise<{
  events: PaxEvents[];
  uniquePax: {
    total_unique_other_attendees: number;
    unique_attendees_when_q: number;
    most_attended_user_id: number | null;
    most_attended_user_name: string | null;
    most_attended_user_event_count: number | null;
  };
}> {
  const { rows } = await pool.query(
    `
  WITH user_events AS (
  SELECT ae.*
  FROM attendance_expanded ae
  WHERE ae.user_id = $1
),
param_user AS (
  SELECT $1::int AS user_id
),
pax_lists AS (
  SELECT 
    ae.event_instance_id,
    STRING_AGG(
      ae.user_id || '|||' || ae.f3_name || '|||' || COALESCE(ae.avatar_url, ''), 
      '###'
    ) AS pax_list
  FROM attendance_expanded ae
  JOIN param_user pu ON ae.user_id != pu.user_id
  GROUP BY ae.event_instance_id
),
q_lists AS (
  SELECT 
    ae.event_instance_id,
    STRING_AGG(
      ae.user_id || '|||' || ae.f3_name || '|||' || COALESCE(ae.avatar_url, ''), 
      '###'
    ) AS q_list
  FROM attendance_expanded ae
  JOIN param_user pu ON ae.user_id != pu.user_id AND ae.q_ind = 1
  GROUP BY ae.event_instance_id
)
SELECT 
  ue.*,
  ei.*,
  pl.pax_list,
  ql.q_list
FROM user_events ue
JOIN event_instance_expanded ei ON ue.event_instance_id = ei.id
LEFT JOIN pax_lists pl ON ue.event_instance_id = pl.event_instance_id
LEFT JOIN q_lists ql ON ue.event_instance_id = ql.event_instance_id
ORDER BY ei.start_date DESC;
    `,
    [id]
  );
  const { rows: uniquePax } = await pool.query(
    `
    SELECT
      (
        SELECT COUNT(DISTINCT ae2.user_id)
        FROM attendance_expanded ae
        JOIN attendance_expanded ae2
          ON ae.event_instance_id = ae2.event_instance_id
        WHERE ae.user_id = $1
          AND ae2.user_id != $1
      ) AS total_unique_other_attendees,

      (
        SELECT COUNT(DISTINCT ae2.user_id)
        FROM attendance_expanded ae
        JOIN attendance_expanded ae2
          ON ae.event_instance_id = ae2.event_instance_id
        WHERE ae.user_id = $1
          AND ae.q_ind = '1'
          AND ae2.user_id != $1
      ) AS unique_attendees_when_q,

      (
        SELECT ae2.user_id
        FROM attendance_expanded ae
        JOIN attendance_expanded ae2
          ON ae.event_instance_id = ae2.event_instance_id
        WHERE ae.user_id = $1
          AND ae2.user_id != $1
        GROUP BY ae2.user_id
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS most_attended_user_id,

      (
        SELECT us.f3_name
        FROM users us
        WHERE us.id = (
          SELECT ae2.user_id
          FROM attendance_expanded ae
          JOIN attendance_expanded ae2
            ON ae.event_instance_id = ae2.event_instance_id
          WHERE ae.user_id = $1
            AND ae2.user_id != $1
          GROUP BY ae2.user_id
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
      ) AS most_attended_user_name,

      (
        SELECT COUNT(*)
        FROM attendance_expanded ae
        JOIN attendance_expanded ae2
          ON ae.event_instance_id = ae2.event_instance_id
        WHERE ae.user_id = $1
          AND ae2.user_id = (
            SELECT ae2.user_id
            FROM attendance_expanded ae
            JOIN attendance_expanded ae2
              ON ae.event_instance_id = ae2.event_instance_id
            WHERE ae.user_id = $1
              AND ae2.user_id != $1
            GROUP BY ae2.user_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
      ) AS most_attended_user_event_count
    `,
    [id]
  );
  return { events: rows as PaxEvents[], uniquePax: uniquePax[0] };
}

export async function calcPaxInsights(
  paxEvents: PaxEvents[]
): Promise<PaxInsights> {
  const summaryMap: Record<
    string,
    {
      date: string;
      events: number;
      qs: number;
    }
  > = {};

  // Reverse the order so the most recent events come first
  [...paxEvents].reverse().forEach((event) => {
    const date = new Date(event.start_date);
    const key = formatDate(date, "M Y");
    if (!summaryMap[key]) {
      summaryMap[key] = {
        date: key,
        events: 0,
        qs: 0,
      };
    }
    summaryMap[key].events += 1;
    if (event.q_ind === "1") {
      summaryMap[key].qs += 1;
    }
  });

  // Convert summaries to arrays of { date, events, qs, events_avg, qs_avg }
  const paxDataArray = Object.entries(summaryMap).map(([date, data]) => ({
    date,
    events: data.events,
    qs: data.qs,
  }));

  // Fill in missing months
  if (paxDataArray.length > 0) {
    const filled: typeof paxDataArray = [];
    const monthSet = new Set(paxDataArray.map((d) => d.date));
    const firstDate = new Date(paxDataArray[0].date + " 1");
    const endDate = new Date();
    endDate.setDate(1);
    const current = new Date(firstDate);

    while (current <= endDate) {
      const key = formatDate(current, "M Y");
      if (monthSet.has(key)) {
        filled.push(paxDataArray.find((d) => d.date === key)!);
      } else {
        filled.push({ date: key, events: 0, qs: 0});
      }
      current.setMonth(current.getMonth() + 1);
    }

    paxDataArray.length = 0;
    paxDataArray.push(...filled);
  }

  paxDataArray.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let eventsChange: number | null = null;
  let qsChange: number | null = null;

  if (paxDataArray.length > 3) {
    const len = paxDataArray.length;
    const current = paxDataArray[len - 1];
    const previous = paxDataArray[len - 2];

    if (previous.events > 0) {
      eventsChange =
        ((current.events - previous.events) / previous.events) * 100;
    }

    if (previous.qs > 0) {
      qsChange = ((current.qs - previous.qs) / previous.qs) * 100;
    }
  }
  return {
    paxData: paxDataArray,
    eventsChange: eventsChange ?? 0,
    qsChange: qsChange ?? 0,
  };
}

export async function processPaxData(
  paxData: PaxEvents[]
): Promise<PaxEventsCalculations> {
  const totalEvents = paxData.length;
  const totalQ = paxData.filter((pax: PaxEvents) => pax.q_ind === "1").length;

  // Find the oldest event by start_date
  const oldestBD = paxData.reduce((min, curr) => {
    return new Date(curr.start_date) < new Date(min.start_date) ? curr : min;
  }, paxData[0]);
  const firstBD = oldestBD?.start_date ? formatDate(oldestBD?.start_date) : "";
  const firstBDLocation =
    oldestBD?.ao_org_id && oldestBD?.ao_name
      ? { id: oldestBD?.ao_org_id, name: oldestBD?.ao_name }
      : null;

  // Find the newest event by start_date
  const newestBD = paxData.reduce((max, curr) => {
    return new Date(curr.start_date) > new Date(max.start_date) ? curr : max;
  }, paxData[0]);
  const lastBD = newestBD?.start_date ? formatDate(newestBD?.start_date) : "";
  const lastBDLocation =
    newestBD?.ao_org_id && newestBD?.ao_name
      ? { id: newestBD?.ao_org_id, name: newestBD?.ao_name }
      : null;

  // Find the oldest and newest Q event by start_date, only considering events where q_ind === "1"
  const qEvents = paxData.filter((p) => p.q_ind === "1");
  const oldestQ =
    qEvents.length > 0
      ? qEvents.reduce((min, curr) => {
          return new Date(curr.start_date) < new Date(min.start_date)
            ? curr
            : min;
        }, qEvents[0])
      : null;
  const firstQ = oldestQ?.start_date ? formatDate(oldestQ?.start_date) : "";
  const firstQLocation =
    oldestQ?.ao_org_id && oldestQ?.ao_name
      ? { id: oldestQ?.ao_org_id, name: oldestQ?.ao_name }
      : null;

  const newestQ =
    qEvents.length > 0
      ? qEvents.reduce((max, curr) => {
          return new Date(curr.start_date) > new Date(max.start_date)
            ? curr
            : max;
        }, qEvents[0])
      : null;
  const lastQ = newestQ?.start_date ? formatDate(newestQ?.start_date) : "";
  const lastQLocation =
    newestQ?.ao_org_id && newestQ?.ao_name
      ? { id: newestQ?.ao_org_id, name: newestQ?.ao_name }
      : null;

  // Count occurrences of each ao_org_id and store ao_name
  const aoCounts: Record<
    number,
    {
      ao_name: string;
      count: number;
      region_name: string;
      region_org_id: number;
    }
  > = {};
  paxData.forEach((pax) => {
    const aoID = pax.ao_org_id || pax.region_org_id;
    const aoName = pax.ao_name || "Unknown AO";

      if (!aoCounts[aoID]) {
        aoCounts[aoID] = {
          ao_name: aoName,
          count: 1,
          region_name: pax.region_name,
          region_org_id: pax.region_org_id,
        };
      } else {
        aoCounts[aoID].count += 1;
      }
    }
  );

  // Convert to sorted array
  const aoNameCounts = Object.entries(aoCounts)
    .map(([id, { ao_name, count, region_name, region_org_id }]) => ({
      id: Number(id),
      ao_name,
      count,
      region_name,
      region_org_id,
    }))
    .sort((a, b) => b.count - a.count);

  // Count occurrences of each ao_org_id where the user was Q
  const aoQCounts: Record<
    number,
    {
      ao_name: string;
      count: number;
      region_name: string;
      region_org_id: number;
    }
  > = {};
  paxData
    .filter((p) => p.q_ind === "1")
    .forEach((pax) => {
      const aoID = pax.ao_org_id || pax.region_org_id;
      const aoName = pax.ao_name || "Unknown AO";
        if (!aoQCounts[aoID]) {
          aoQCounts[aoID] = {
            ao_name: aoName,
            count: 1,
            region_name: pax.region_name,
            region_org_id: pax.region_org_id,
          };
        } else {
          aoQCounts[aoID].count += 1;
        }
      }
    );

  // Convert to sorted array
  const aoNameQCounts = Object.entries(aoQCounts)
    .map(([id, { ao_name, count, region_name, region_org_id }]) => ({
      id: Number(id),
      ao_name,
      count,
      region_name,
      region_org_id,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEvents,
    totalQ,
    firstBD,
    firstBDLocation,
    lastBD,
    lastBDLocation,
    firstQ,
    firstQLocation,
    lastQ,
    lastQLocation,
    aoNameCounts,
    aoNameQCounts,
  };
}

export async function calcPaxEvents(
  paxData: PaxEvents[],
  region_id?: number
): Promise<PaxEventsResults> {
  const paxDataFiltered = region_id
    ? paxData.filter((pax: PaxEvents) => pax.region_org_id === region_id)
    : paxData;
  const nation_paxEvents = await processPaxData(paxData);
  const region_paxEvents = await processPaxData(paxDataFiltered);

  return { nation: nation_paxEvents, region: region_paxEvents };
}
