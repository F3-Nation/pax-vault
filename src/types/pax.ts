export interface PaxData {
    info: PaxInfo; // Information about the pax
    events: PaxEventData[]; // List of event data associated with the pax
}

export interface PaxInfo {
    user_id: number; // Unique identifier for the user
    f3_name: string; // F3 name (nickname) of the user
    region: string | null; // Unique identifier for the user's home region
    region_id: number | null; // Unique identifier for the user's home region
    region_default: string | null; // Default region name associated with the user
    region_default_id: number | null; // Default region ID associated with the user
    avatar_url: string | null; // URL to the user's avatar image, can be null
    status: string; // Status of the user (e.g., active, inactive)
}

export interface PaxEventData {
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
  first_f_ind: string; // Indicates if the event is a 1st F
  second_f_ind: string; // Indicates if the event is a 2nd F
  third_f_ind: string; // Indicates if the event is a 3rd F
  all_types: string[] | null; // List of all types/categories associated with the event
  all_tags: string[] | null; // List of all tags associated with the event
  attendance: PaxAttendance[]; // List of attendance records for the event
}

export interface PaxAttendance {
  id: number; // Unique identifier for the attendance record
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  q_ind: boolean; // Indicates if the user was a Q (leader) for the event
  coq_ind: boolean; // Indicates if the user was a co-Q (co-leader) for the event
  avatar_url: string | null; // Optional URL to the user's avatar image
}

export interface PaxSummary {
  event_count: number; // Total number of events held in the region
  q_count: number; // Total number of Qs (leaders) across all events
  first_event_date: string | null; // Date of the first event in the region
  first_event_ao_id: number | null; // ID of the first event in the region
  first_event_ao_name: string | null; // Name of the AO (Area of Operation) for the first event
  last_event_date: string | null; // Date of the last event in the region
  last_event_ao_id: number | null; // ID of the last event in the region
  last_event_ao_name: string | null; // Name of the AO (Area of Operation) for the last event
  bestie_user_id: number | null; // User ID of the bestie (most attended by the main user)
  bestie_count: number; // Number of events attended by the bestie
  bestie_f3_name: string | null; // F3 name of the bestie
  unique_users_met: number; // Number of unique users met by the main user
  first_q_date: string | null; // Date of the first event where the main user was a Q
  first_q_ao_id: number | null; // ID of the AO for the first Q event
  first_q_ao_name: string | null; // Name of the AO for the first Q event
  last_q_date: string | null; // Date of the last event where the main user was a Q
  last_q_ao_id: number | null; // ID of the AO for the last Q event
  last_q_ao_name: string | null; // Name of the AO for the last Q event
  unique_pax_when_q: number; // Number of unique pax who attended events when the main user was a Q
  effective_percentage: number | null; // Percentage of events where the main user was an effective Q
}

export interface PaxAOBreakdown {
  ao_org_id: number; // Unique identifier for the AO organization
  ao_name: string; // Name of the AO organization
  region_org_id: number; // Unique identifier for the region organization
  region_name: string; // Name of the region organization
  total_events: number; // Number of events held by the AO
  total_q_count: number; // Number of Qs (leaders) held by the AO
}

export interface PaxInsights {
  paxData: {
    month: string; // Month in 'YYYY-MM' format
    events: number; // Number of events in that month
    qs: number; // Number of Qs (leaders) in that month
  }[];
  eventsChange: number; // Percentage change in events compared to the previous period
  qsChange: number; // Percentage change in Qs compared to the previous period
}