/**
 * Region stats data loader.
 *
 * Responsibilities:
 * - Resolve the correct base URL in both server and edge contexts.
 * - Fetch all region-related datasets in parallel.
 * - Normalize filter query parameters for region sub-requests.
 * - Fail gracefully by returning `null` when any critical fetch fails.
 */
import {
  EventData,
  AOData,
  AOInfo,
  AOSummary,
  EventUpcoming,
  Leaders,
  PageFilters,
} from "@/lib/types";
import { headers } from "next/headers";

/**
 * Shared filter options passed through to AO API endpoints.
 */
type AOFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
  tagIds?: number[];
  tagMode?: "include" | "exclude";
  typeIds?: number[];
  typeMode?: "include" | "exclude";
  categoryIds?: number[];
  categoryMode?: "include" | "exclude";
};

/**
 * Resolve the request base URL from Next.js headers.
 *
 * Falls back gracefully when headers are unavailable.
 */
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return "";

  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Load all data required for the AO stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadAOData(
  aoId: number,
  filters?: AOFilterOpts,
): Promise<AOData | null> {
  try {
    const baseUrl = await getBaseUrl();

    const [info, summary, leaders, events, upcoming, pageFilters] =
      await Promise.all([
        getAOInfo(baseUrl, aoId),
        getAOSummary(baseUrl, aoId, filters),
        getAOLeaders(baseUrl, aoId, filters),
        getAOEvents(baseUrl, aoId, filters, 100),
        getAOUpcomingEvents(baseUrl, aoId),
        getAOFilters(baseUrl, aoId),
      ]);

    return {
      info,
      summary,
      leaders,
      events,
      upcoming,
      filters: pageFilters,
    };
  } catch (err) {
    console.error("Error fetching AO data:", err);
  }

  return null;
}

/**
 * Build URLSearchParams from AO filter options.
 */
function buildFilterParams(filters?: AOFilterOpts): URLSearchParams {
  const qp = new URLSearchParams();

  if (!filters) return qp;

  if (filters.range) qp.append("range", filters.range);
  if (filters.startDate) qp.append("startDate", filters.startDate);
  if (filters.endDate) qp.append("endDate", filters.endDate);
  if (filters.tagIds?.length) qp.append("tagIds", filters.tagIds.join(","));
  if (filters.tagMode) qp.append("tagMode", filters.tagMode);
  if (filters.typeIds?.length) qp.append("typeIds", filters.typeIds.join(","));
  if (filters.typeMode) qp.append("typeMode", filters.typeMode);
  if (filters.categoryIds?.length)
    qp.append("categoryIds", filters.categoryIds.join(","));
  if (filters.categoryMode) qp.append("categoryMode", filters.categoryMode);

  return qp;
}

/**
 * Fetch AO info data.
 */
async function getAOInfo(baseUrl: string, id: number): Promise<AOInfo | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/ao/" + id + "/info";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch AO summary data.
 */
async function getAOSummary(
  baseUrl: string,
  id: number,
  filters?: AOFilterOpts,
): Promise<AOSummary | null> {
  const qp = buildFilterParams(filters);

  const url =
    (baseUrl ? baseUrl : "") + "/api/ao/" + id + "/summary?" + qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch AO leaders data.
 */
async function getAOLeaders(
  baseUrl: string,
  id: number,
  filters?: AOFilterOpts,
): Promise<Leaders[] | null> {
  const qp = buildFilterParams(filters);

  const url =
    (baseUrl ? baseUrl : "") + "/api/ao/" + id + "/leaders?" + qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch AO events data.
 */
async function getAOEvents(
  baseUrl: string,
  id: number,
  filters?: AOFilterOpts,
  limit?: number,
): Promise<EventData[] | null> {
  const qp = buildFilterParams(filters);
  if (limit) qp.append("limit", String(limit));

  const url =
    (baseUrl ? baseUrl : "") + "/api/ao/" + id + "/events?" + qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const events = await res.json();
  return (
    events?.sort(
      (a: EventData, b: EventData) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
    ) || null
  );
}

/**
 * Fetch AO upcoming events data.
 */
async function getAOUpcomingEvents(
  baseUrl: string,
  id: number,
): Promise<EventUpcoming[] | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/ao/" + id + "/upcoming";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch AO page filters data.
 */
async function getAOFilters(
  baseUrl: string,
  id: number,
): Promise<PageFilters | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/ao/" + id + "/filters";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}
