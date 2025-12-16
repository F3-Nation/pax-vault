import { AODetail } from "@/types/ao";

export interface RegionDetail {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  email: string | null; // Contact email for the region
  website: string | null; // Website URL of the region
  twitter: string | null; // Twitter handle of the region, can be null
  facebook: string | null; // Facebook page of the region, can be null
  instagram: string | null; // Instagram handle of the region, can be null
  created: string; // Creation date of the region
  updated: string; // Last update date of the regio
  logo: string | null; // Logo URL of the region, can be null
  ao_count: number; // Number of AOs (Areas of Operation) in the region
  active: boolean; // Indicates if the region is active
  aos: AODetail[]; // List of AOs associated with the region
}

export interface RegionDetailResponse {
  region: RegionDetail | null; // The region details or null if not found
}

export interface RegionList {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  email: string; // Contact email for the region
  website: string; // Website URL of the region
  logo: string | null; // Logo URL of the region, can be null
  active: boolean; // Indicates if the region is active
}

export interface RegionLeaders {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  posts: number; // Total number of posts (events attended) by the user at the AO
  qs: number; // Total number of Q appearances by the user at the AO
  avatar_url?: string; // Optional URL to the user's avatar image
}

export interface RegionData {
  event_instance_id: number; // Unique identifier for the event instance
  event_date: string; // Date of the workout event
  event_name: string; // Name of the workout event
  pax_count: number; // Number of participants (pax) who attended the event
  fng_count: number; // Number of first-time participants (FNGs) at the event
  location_id: number | null; // Unique identifier for the location of the event
  location_name: string | null; // Name of the location of the event
  location_latitude: number | null; // Latitude of the event location, can be null
  location_longitude: number | null; // Longitude of the event location, can be null
  ao_org_id: number; // Unique identifier for the AO organization
  ao_name: string; // Name of the AO organization
  region_org_id: number; // Unique identifier for the region organization
  region_name: string; // Name of the region organization
  region_logo_url: string | null; // Logo URL of the region, can be null
  sector_org_id: number; // Unique identifier for the sector organization
  sector_name: string; // Name of the sector organization
  all_types: string[] | null; // List of all types/categories associated with the event
  all_tags: string[] | null; // List of all tags associated with the event
  attendance: RegionAttendance[]; // List of attendance records for the event
}

export interface RegionAttendance {
  id: number; // Unique identifier for the attendance record
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  q_ind: boolean; // Indicates if the user was a Q (leader) for the event
  coq_ind: boolean; // Indicates if the user was a co-Q (co-leader) for the event
  avatar_url: string | null; // Optional URL to the user's avatar image
}

export interface RegionDetails {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  logo: string | null; // Logo URL of the region, can be null
  area_id: number; // Unique identifier for the area
  area_name: string; // Name of the area
}

export interface RegionSummary {
  event_count: number; // Total number of events held in the region
  ao_count: number; // Total number of AOs (Areas of Operation) in the region
  active_pax: number; // Number of active participants (pax) in the region
  unique_pax: number; // Number of unique participants (pax) who have attended events in the region
  unique_qs: number; // Number of unique Qs (leaders) who have led events in the region
  fng_count: number; // Total number of first-time participants (FNGs) in the region
  pax_count_average: number; // Average number of participants (pax) per event in the region
}
