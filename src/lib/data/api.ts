import type { DataSource } from "./index";
import type { PaxInfo, PaxEventData } from "@/types/pax";
import type { RegionDetails, RegionData, RegionUpcomingEvents } from "@/types/region";

export class ApiDataSource implements DataSource {
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || "";
    this.apiKey = process.env.API_KEY;

    if (!this.baseUrl) {
      throw new Error("API_BASE_URL must be set when using API data source");
    }
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || data;
  }

  async getPaxList(): Promise<PaxInfo[]> {
    return this.request<PaxInfo[]>("/api/pax/list");
  }

  async getRegionList(): Promise<RegionDetails[]> {
    return this.request<RegionDetails[]>("/api/regions/list");
  }

  async getPaxInfo(id: number): Promise<PaxInfo | null> {
    return this.request<PaxInfo | null>("/api/pax/info", { id });
  }

  async getPaxEvents(id: number): Promise<PaxEventData[] | null> {
    return this.request<PaxEventData[] | null>("/api/pax/events", { id });
  }

  async getRegionData(id: number): Promise<RegionData[] | null> {
    return this.request<RegionData[] | null>("/api/regions/events", { id });
  }

  async getUpcomingEvents(id: number): Promise<RegionUpcomingEvents[] | null> {
    return this.request<RegionUpcomingEvents[] | null>(
      "/api/regions/upcoming-events",
      { id },
    );
  }
}
