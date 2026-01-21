/**
 * Pax stats data loader.
 *
 * Responsibilities:
 * - Resolve the correct base URL in both server and edge contexts.
 * - Fetch all pax-related datasets in parallel.
 * - Normalize filter query parameters for pax sub-requests.
 * - Fail gracefully by returning `null` when any critical fetch fails.
 */
import {
  EventData,
  PaxData,
  PAXInfo,
  PaxSummary,
  PageFilters,
  PaxAOBreakdown,
} from "@/lib/types";
import { headers } from "next/headers";

/**
 * Shared filter options passed through to pax API endpoints.
 */
type PaxFilterOpts = {
  range?: string;
  startDate?: string;
  endDate?: string;
  aoIds?: number[];
  aoMode?: "include" | "exclude";
  regionIds?: number[];
  regionMode?: "include" | "exclude";
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
 * Load all data required for the pax stats page.
 *
 * All requests are executed in parallel for performance.
 */
export async function loadPaxData(
  paxId: number,
  filters?: PaxFilterOpts,
): Promise<PaxData | null> {
  try {
    const baseUrl = await getBaseUrl();

    const [info, summary, ao_breakdown, events, pageFilters] =
      await Promise.all([
        getPaxInfo(baseUrl, paxId),
        getPaxSummary(baseUrl, paxId, filters),
        getAOBreakdown(baseUrl, paxId, filters),
        getPaxEvents(baseUrl, paxId, filters, 100),
        getPaxFilters(baseUrl, paxId),
      ]);

    return {
      info,
      summary,
      ao_breakdown,
      events,
      filters: pageFilters,
    };
  } catch (err) {
    console.error("Error fetching Pax data:", err);
  }

  return null;
}

/**
 * Build URLSearchParams from pax filter options.
 */
function buildFilterParams(filters?: PaxFilterOpts): URLSearchParams {
  const qp = new URLSearchParams();

  if (!filters) return qp;

  if (filters.range) qp.append("range", filters.range);
  if (filters.startDate) qp.append("startDate", filters.startDate);
  if (filters.endDate) qp.append("endDate", filters.endDate);
  if (filters.regionIds?.length)
    qp.append("regionIds", filters.regionIds.join(","));
  if (filters.regionMode) qp.append("regionMode", filters.regionMode);
  if (filters.tagIds?.length) qp.append("tagIds", filters.tagIds.join(","));
  if (filters.tagMode) qp.append("tagMode", filters.tagMode);
  if (filters.typeIds?.length) qp.append("typeIds", filters.typeIds.join(","));
  if (filters.typeMode) qp.append("typeMode", filters.typeMode);
  if (filters.aoIds?.length) qp.append("aoIds", filters.aoIds.join(","));
  if (filters.aoMode) qp.append("aoMode", filters.aoMode);
  if (filters.categoryIds?.length)
    qp.append("categoryIds", filters.categoryIds.join(","));
  if (filters.categoryMode) qp.append("categoryMode", filters.categoryMode);

  return qp;
}

/**
 * Fetch pax info data.
 */
async function getPaxInfo(
  baseUrl: string,
  id: number,
): Promise<PAXInfo | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/pax/" + id + "/info";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch pax summary data.
 */
async function getPaxSummary(
  baseUrl: string,
  id: number,
  filters?: PaxFilterOpts,
): Promise<PaxSummary | null> {
  const qp = buildFilterParams(filters);

  const url =
    (baseUrl ? baseUrl : "") + "/api/pax/" + id + "/summary?" + qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch ao breakdown data.
 */
async function getAOBreakdown(
  baseUrl: string,
  id: number,
  filters?: PaxFilterOpts,
): Promise<PaxAOBreakdown[] | null> {
  const qp = buildFilterParams(filters);

  const url =
    (baseUrl ? baseUrl : "") +
    "/api/pax/" +
    id +
    "/ao-breakdown?" +
    qp.toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const aos = await res.json();
  return (
    aos?.sort(
      (a: PaxAOBreakdown, b: PaxAOBreakdown) =>
        new Date(b.total_events).getTime() - new Date(a.total_events).getTime(),
    ) || null
  );
}

/**
 * Fetch pax events data.
 */
async function getPaxEvents(
  baseUrl: string,
  id: number,
  filters?: PaxFilterOpts,
  limit?: number,
): Promise<EventData[] | null> {
  const qp = buildFilterParams(filters);
  if (limit) qp.append("limit", String(limit));

  const url =
    (baseUrl ? baseUrl : "") + "/api/pax/" + id + "/events?" + qp.toString();
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
 * Fetch pax page filters data.
 */
async function getPaxFilters(
  baseUrl: string,
  id: number,
): Promise<PageFilters | null> {
  const url = (baseUrl ? baseUrl : "") + "/api/pax/" + id + "/filters";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}
