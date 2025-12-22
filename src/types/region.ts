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
  // location_id: number | null; // Unique identifier for the location of the event
  // location_name: string | null; // Name of the location of the event
  // location_latitude: number | null; // Latitude of the event location, can be null
  // location_longitude: number | null; // Longitude of the event location, can be null
  ao_org_id: number; // Unique identifier for the AO organization
  ao_name: string; // Name of the AO organization
  region_org_id: number; // Unique identifier for the region organization
  region_name: string; // Name of the region organization
  region_logo_url: string | null; // Logo URL of the region, can be null
  area_org_id: number | null; // Unique identifier for the area organization
  area_name: string | null; // Name of the area organization
  sector_org_id: number; // Unique identifier for the sector organization
  sector_name: string; // Name of the sector organization
  first_f_ind: string; // Indicates if the event is a 1st F
  second_f_ind: string; // Indicates if the event is a 2nd F
  third_f_ind: string; // Indicates if the event is a 3rd F
  // all_types: string[] | null; // List of all types/categories associated with the event
  // all_tags: string[] | null; // List of all tags associated with the event
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

export interface RegionKotterList {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  avatar_url?: string; // Optional URL to the user's avatar image
  kotter_status: string; // Kotter status of the user (e.g., "Active", "Inactive")
  days_since_last_event: number; // Number of days since the user's last event attendance
  total_events: number; // Total number of events attended by the user
  first_event_date: string; // Date of the user's first event attendance
  last_event_date: string; // Date of the user's last event attendance
  last_event_name: string; // Name of the event for the user's last event attendance
  last_event_ao_name: string; // Name of the AO for the user's last event attendance
  last_event_ao_org_id: number; // Unique identifier for the AO organization of the user's last event attendance
  bestie_list: [
    {
      user_id: number; // Unique identifier for the bestie (frequent workout partner)
      f3_name: string; // F3 name (nickname) of the bestie
      avatar_url?: string; // Optional URL to the bestie's avatar image
      co_attendance_count: number; // Number of events attended together with the bestie
    },
  ]; // List of besties (frequent workout partners) for the user
}

export interface RegionUpcomingEvents {
  start_date: string; // Start date of the upcoming event
  start_time: string; // Start time of the upcoming event
  ao_name: string; // Name of the AO (Area of Operation) hosting the event
  ao_org_id: number; // Unique identifier for the AO organization
  location_name: string; // Name of the location where the event will be held
  event_types: string; // Types/categories associated with the event
  event_tags: string | null; // Tags associated with the event
  event_category: string; // Category of the event
  q_list: [
    {
      user_id: number; // Unique identifier for the Q (leader)
      f3_name: string; // F3 name (nickname) of the Q
      avatar_url?: string; // Optional URL to the Q's avatar image
    },
  ]; // List of Qs (leaders) for the upcoming event
}

export interface RegionChartData {
  uniquePax: {
    itteration_type: "month" | "week" | "day" | ""; // Type of iteration (month, week, day, or none)
    data: {
      iteration: string; // e.g., month or week identifier
      count: number; // Number of unique pax in that month/week
      average: number; // Average pax count for that month/week
    }[];
  };
}
