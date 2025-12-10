import { PaxAOBreakdown, PaxData, PaxSummary, PaxInsights } from "@/types/pax";
import { formatDate } from "@/lib/utils";

export function getSummary(data: PaxData, startDate?: string, endDate?: string): PaxSummary | null {

    const event_count = data.events.length;
    const q_count = data.events.reduce((acc, event) => {
        return acc + event.attendance.filter(att => att.user_id === data.info.user_id && att.q_ind).length;
    }, 0);
    const first_event_date = data.events.length > 0 ? formatDate(new Date(data.events[0].event_date)) : null;
    const first_event_ao_id = data.events.length > 0 ? data.events[0].event_instance_id : null;
    const first_event_ao_name = data.events.length > 0 ? data.events[0].ao_name : null;
    const last_event_date = data.events.length > 0 ? formatDate(new Date(data.events[data.events.length - 1].event_date)) : null;
    const last_event_ao_id = data.events.length > 0 ? data.events[data.events.length - 1].event_instance_id : null;
    const last_event_ao_name = data.events.length > 0 ? data.events[data.events.length - 1].ao_name : null;
    
    // ---------------------------
    // BESTIE CALCULATION HERE
    // ---------------------------
    const mainUserId = data.info.user_id;
    const counts = new Map<number, number>();

    for (const event of data.events) {
        for (const attendee of event.attendance) {
            if (attendee.user_id === mainUserId) continue;
            counts.set(attendee.user_id, (counts.get(attendee.user_id) || 0) + 1);
        }
    }

    // Determine the bestie
    let bestie_user_id: number | null = null;
    let bestie_count = 0;

    for (const [uid, cnt] of counts.entries()) {
        if (cnt > bestie_count) {
            bestie_count = cnt;
            bestie_user_id = uid;
        }
    }
    
    let bestie_f3_name: string | null = null;
    if (bestie_user_id !== null) {
        for (const event of data.events) {
            const match = event.attendance.find(att => att.user_id === bestie_user_id);
            if (match) {
                bestie_f3_name = match.f3_name;
                break;
            }
        }
    }
    // ---------------------------

    const unique_users_met = counts.size;

    let first_q_date: string | null = null;
    let first_q_ao_id: number | null = null;
    let first_q_ao_name: string | null = null;
    let last_q_date: string | null = null;
    let last_q_ao_id: number | null = null;
    let last_q_ao_name: string | null = null;
    const pax_when_q = new Set<number>();

    for (const event of data.events) {
        const isQ = event.attendance.some(
            att => att.user_id === mainUserId && att.q_ind
        );

        if (!isQ) continue;

        const eventDateFormatted = formatDate(new Date(event.event_date));

        if (first_q_date === null) {
            first_q_date = eventDateFormatted;
            first_q_ao_id = event.event_instance_id;
            first_q_ao_name = event.ao_name;
        }

        last_q_date = eventDateFormatted;
        last_q_ao_id = event.event_instance_id;
        last_q_ao_name = event.ao_name;

        for (const attendee of event.attendance) {
            if (attendee.user_id !== mainUserId) {
                pax_when_q.add(attendee.user_id);
            }
        }
    }

    const unique_pax_when_q = pax_when_q.size;

    let effective_percentage: number | null = null;

    let start: Date | null = null;
    let end: Date | null = null;

    if (data.events.length > 1) {
        const firstDate = new Date(data.events[0].event_date);
        start = new Date(firstDate);
        const today = new Date();
        end = new Date();
        if (endDate) {
            end = today < new Date(endDate) ? today : new Date(endDate);
        }

        const diffMs = end.getTime() - start.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays > 0) {
            effective_percentage = (data.events.length / diffDays) * 100;
        }
    }

  return {
    event_count,
    q_count,
    first_event_date,
    first_event_ao_id,
    first_event_ao_name,
    last_event_date,
    last_event_ao_id,
    last_event_ao_name,
    bestie_user_id,
    bestie_count,
    bestie_f3_name,
    unique_users_met,
    first_q_date,
    first_q_ao_id,
    first_q_ao_name,
    last_q_date,
    last_q_ao_id,
    last_q_ao_name,
    unique_pax_when_q,
    effective_percentage,
  };
  }

export function getAOBreakdown(data: PaxData): PaxAOBreakdown[] {
    const mainUserId = data.info.user_id;

    // Aggregate by AO (and implicitly region), while tracking counts by event type
    const aoMap = new Map<number, {
        ao_org_id: number;
        ao_name: string | null;
        region_org_id: number | null;
        region_name: string | null;
        total_events: number;
        total_q_count: number;
    }>();

    for (const event of data.events) {
        const aoId = event.ao_org_id;
        if (aoId == null) continue;

        // Only consider events the main user actually attended
        const attended = event.attendance.some(att => att.user_id === mainUserId);
        if (!attended) continue;

        let entry = aoMap.get(aoId);
        if (!entry) {
            entry = {
                ao_org_id: aoId,
                ao_name: event.ao_name ?? null,
                region_org_id: event.region_org_id ?? null,
                region_name: event.region_name ?? null,
                total_events: 0,
                total_q_count: 0,
            };
            aoMap.set(aoId, entry);
        }

        // Increment total events for this AO
        entry.total_events += 1;

        // If the user Q'd this event at this AO, increment Q count
        const userAsQ = event.attendance.some(
            att => att.user_id === mainUserId && att.q_ind
        );
        if (userAsQ) {
            entry.total_q_count += 1;
        }
    }

    // Convert the map into the expected array type
    return Array.from(aoMap.values()) as PaxAOBreakdown[];
}

export function getPaxCharting(data: PaxData): PaxInsights {

  // console.log("Pax Info:", data.info);
  // console.log("Pax Data Events Count:", data.events[0]);
  const summaryMap: Record<
    string,
    {
      month: string;
      events: number;
      qs: number;
    }
  > = {};

  // Reverse the order so the most recent events come first
  [...data.events].reverse().forEach((event) => {
    const date = new Date(event.event_date);
    const key = formatDate(date, "M Y");
    if (!summaryMap[key]) {
      summaryMap[key] = {
        month: key,
        events: 0,
        qs: 0,
      };
    }
    summaryMap[key].events += 1;
    const userAsQ = event.attendance.some(
      att => att.user_id === data.info.user_id && att.q_ind
    );
    if (userAsQ) {
      summaryMap[key].qs += 1;
    }
  });

  // Convert summaries to arrays of { month, events, qs, events_avg, qs_avg }
  const paxDataArray = Object.entries(summaryMap).map(([month, data]) => ({
    month,
    events: data.events,
    qs: data.qs,
  }));

  // Fill in missing months
  if (paxDataArray.length > 0) {
    const filled: typeof paxDataArray = [];
    const monthSet = new Set(paxDataArray.map((d) => d.month));

    // Find the earliest month in the data, not just the first element
    const firstDate = paxDataArray.reduce((min, d) => {
      const dt = new Date(d.month + " 1");
      return dt < min ? dt : min;
    }, new Date(paxDataArray[0].month + " 1"));

    const endDate = new Date();
    endDate.setDate(1);
    const current = new Date(firstDate);

    while (current <= endDate) {
      const key = formatDate(current, "M Y");
      if (monthSet.has(key)) {
        filled.push(paxDataArray.find((d) => d.month === key)!);
      } else {
        filled.push({ month: key, events: 0, qs: 0});
      }
      current.setMonth(current.getMonth() + 1);
    }

    paxDataArray.length = 0;
    paxDataArray.push(...filled);
  }

  paxDataArray.sort(
    (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
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
