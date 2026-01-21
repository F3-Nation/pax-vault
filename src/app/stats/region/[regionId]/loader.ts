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
  RegionData,
  RegionInfo,
  RegionSummary,
  EventUpcoming,
  Leaders,
  RegionKotterList,
  PageFilters,
} from "@/lib/types";
import { headers } from "next/headers";

/**
 * Shared filter options passed through to region API endpoints.
 */
type RegionFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
  aoIds?: number[];
  aoMode?: "include" | "exclude";
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
 * Load all data required for the region stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadRegionData(
  regionId: number,
  filters?: RegionFilterOpts,
): Promise<RegionData | null> {
  try {
    const baseUrl = await getBaseUrl();

    const [info, summary, leaders, events, upcoming, kotter, pageFilters] =
      await Promise.all([
        getRegionInfo(baseUrl, regionId),
        getRegionSummary(baseUrl, regionId, filters),
        getRegionLeaders(baseUrl, regionId, filters),
        getRegionEvents(baseUrl, regionId, filters, 100),
        getRegionUpcomingEvents(baseUrl, regionId),
        getRegionKotters(baseUrl, regionId),
        getRegionFilters(baseUrl, regionId),
      ]);

    return {
      info,
      summary,
      leaders,
      events,
      upcoming,
      kotter,
      filters: pageFilters,
    };
  } catch (err) {
    console.error("Error fetching Region data:", err);
  }

  return null;
}

/**
 * Build URLSearchParams from region filter options.
 */
function buildFilterParams(filters?: RegionFilterOpts): URLSearchParams {
  const qp = new URLSearchParams();

  if (!filters) return qp;

  if (filters.range) qp.append("range", filters.range);
  if (filters.startDate) qp.append("startDate", filters.startDate);
  if (filters.endDate) qp.append("endDate", filters.endDate);
  if (filters.aoIds?.length) qp.append("aoIds", filters.aoIds.join(","));
  if (filters.aoMode) qp.append("aoMode", filters.aoMode);
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
 * Fetch region info data.
 */
async function getRegionInfo(
  baseUrl: string,
  id: number,
): Promise<RegionInfo | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/region/" + id + "/info";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch region summary data.
 */
async function getRegionSummary(
  baseUrl: string,
  id: number,
  filters?: RegionFilterOpts,
): Promise<RegionSummary | null> {
  const qp = buildFilterParams(filters);

  const url =
    (baseUrl ? baseUrl : "") +
    "/api/region/" +
    id +
    "/summary?" +
    qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch region leaders data.
 */
async function getRegionLeaders(
  baseUrl: string,
  id: number,
  filters?: RegionFilterOpts,
): Promise<Leaders[] | null> {
  const qp = buildFilterParams(filters);

  const url =
    (baseUrl ? baseUrl : "") +
    "/api/region/" +
    id +
    "/leaders?" +
    qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch region events data.
 */
async function getRegionEvents(
  baseUrl: string,
  id: number,
  filters?: RegionFilterOpts,
  limit?: number,
): Promise<EventData[] | null> {
  const qp = buildFilterParams(filters);
  if (limit) qp.append("limit", String(limit));

  const url =
    (baseUrl ? baseUrl : "") + "/api/region/" + id + "/events?" + qp.toString();
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
 * Fetch region upcoming events data.
 */
async function getRegionUpcomingEvents(
  baseUrl: string,
  id: number,
): Promise<EventUpcoming[] | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/region/" + id + "/upcoming";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch region kotter list data.
 */
async function getRegionKotters(
  baseUrl: string,
  id: number,
): Promise<RegionKotterList[] | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/region/" + id + "/kotter";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch region page filters data.
 */
async function getRegionFilters(
  baseUrl: string,
  id: number,
): Promise<PageFilters | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/region/" + id + "/filters";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}
