import { BigQueryDataSource } from "./bigquery";
import { ApiDataSource } from "./api";
import { MockDataSource } from "./mock";
import type { PaxInfo, PaxEventData } from "@/types/pax";
import type { RegionDetails, RegionData, RegionUpcomingEvents } from "@/types/region";

// DataSource interface for abstracting data fetching
export interface DataSource {
  getPaxList(): Promise<PaxInfo[]>;
  getRegionList(): Promise<RegionDetails[]>;
  getPaxInfo(id: number): Promise<PaxInfo | null>;
  getPaxEvents(id: number): Promise<PaxEventData[] | null>;
  getRegionData(id: number): Promise<RegionData[] | null>;
  getUpcomingEvents(id: number): Promise<RegionUpcomingEvents[] | null>;
}

// Factory function to get the appropriate data source
function getDataSource(): DataSource {
  const dataSourceType = process.env.DATA_SOURCE_TYPE || "bigquery";

  if (dataSourceType === "mock") {
    return new MockDataSource();
  }

  if (dataSourceType === "api") {
    return new ApiDataSource();
  }

  // Default to BigQuery
  return new BigQueryDataSource();
}

// Singleton data source instance
const dataSource = getDataSource();

// Data fetching functions - transparently delegate to the configured data source

export async function getPaxList(): Promise<PaxInfo[]> {
  return dataSource.getPaxList();
}

export async function getRegionList(): Promise<RegionDetails[]> {
  return dataSource.getRegionList();
}

export async function getPaxInfo(id: number): Promise<PaxInfo | null> {
  return dataSource.getPaxInfo(id);
}

export async function getPaxEvents(id: number): Promise<PaxEventData[] | null> {
  return dataSource.getPaxEvents(id);
}

export async function getRegionData(
  id: number,
): Promise<RegionData[] | null> {
  return dataSource.getRegionData(id);
}

export async function getUpcomingEvents(
  id: number,
): Promise<RegionUpcomingEvents[] | null> {
  return dataSource.getUpcomingEvents(id);
}
