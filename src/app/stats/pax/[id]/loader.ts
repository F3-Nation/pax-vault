// /stats/pax/[id]/loader.ts
import { getPaxDetail, getPaxEvents, calcPaxEvents, getAchievementData } from "@/lib/pax";
import { PaxDetail, PaxEvents, PaxEventsResults, PaxAchievements } from "@/types/pax";

export async function loadPaxStats(id: number) {
  let paxInfo: PaxDetail | null = null;
  try {
    paxInfo = await getPaxDetail(id);
  } catch (err) {
    console.error("Error fetching cached pax info:", err);
  }

  let eventsResult: {
    events: PaxEvents[];
    uniquePax: {
      total_unique_other_attendees: number;
      unique_attendees_when_q: number;
      most_attended_user_event_count?: number;
      most_attended_user_id?: number;
      most_attended_user_name?: string;
    };
  } = {
    events: [],
    uniquePax: {
      total_unique_other_attendees: 0,
      unique_attendees_when_q: 0,
      most_attended_user_event_count: 0,
      most_attended_user_id: undefined,
      most_attended_user_name: undefined,
    },
  };
  try {
    const rawEventsResult = await getPaxEvents(Number(id));
    // Convert nulls to undefined for optional fields
    eventsResult = {
      ...rawEventsResult,
      uniquePax: {
        ...rawEventsResult.uniquePax,
        most_attended_user_event_count:
          rawEventsResult.uniquePax.most_attended_user_event_count ?? undefined,
        most_attended_user_id:
          rawEventsResult.uniquePax.most_attended_user_id ?? undefined,
        most_attended_user_name:
          rawEventsResult.uniquePax.most_attended_user_name ?? undefined,
      },
    };
    // console.log(eventsResult, 'pax events fetched');
  } catch (err) {
    console.error("Error fetching cached pax events:", err);
  }

  let paxData: PaxEventsResults | null = null;

  try {
    paxData = await calcPaxEvents(eventsResult?.events ?? [], paxInfo?.region_id);
  } catch (err) {
    console.error("Error calculating pax events:", err);
  }

  const paxEvents: PaxEvents[] = eventsResult?.events.slice(0, 10) ?? [];

  let achievements: PaxAchievements[] = [];

  try {
    achievements = await getAchievementData(Number(id));
  } catch (err) {
    console.error("Error fetching achievement data:", err);
  }

  return { paxInfo, eventsResult, paxData, paxEvents, achievements };
}
