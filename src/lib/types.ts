/* =========================================================== */
/*                  TYPES USED ACROSS APP                      */
/* =========================================================== */

/* USED FOR LEADERBOARDS */
export interface Leaders {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  posts: number; // Total number of posts (events attended) by the user at the AO
  qs: number; // Total number of Q appearances by the user at the AO
  avatar_url?: string; // Optional URL to the user's avatar image
}

/* USED FOR ALL EVENT DATA */
export interface EventData {
  event_instance_id: number; // Unique identifier for the event instance
  event_date: string; // Date of the workout event
  event_name: string; // Name of the workout event
  pax_count: number; // Number of participants (pax) who attended the event
  fng_count: number; // Number of first-time participants (FNGs) at the event
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
  types:
    | {
        id: number;
        name: string;
        description: string;
        event_category: string;
      }[]
    | null; // List of all types/categories associated with the event
  tags: { id: number; name: string; description: string }[] | null; // List of all tags associated with the event
  attendance: EventAttendance[]; // List of attendance records for the event
}

/* USED FOR EVENT ATTENDANCE RECORDS */
export interface EventAttendance {
  id: number; // Unique identifier for the attendance record
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  home_region_id: number; // Unique identifier for the user's home region
  q_ind: boolean; // Indicates if the user was a Q (leader) for the event
  coq_ind: boolean; // Indicates if the user was a co-Q (co-leader) for the event
  avatar_url: string | null; // Optional URL to the user's avatar image
  isBot: boolean; // Indicates if the user is a bot
}

/* USED FOR UPCOMING EVENTS */
export interface EventUpcoming {
  start_date: string; // Start date of the upcoming event
  start_time: string; // Start time of the upcoming event
  ao_name: string; // Name of the AO (Area of Operation) hosting the event
  ao_org_id: number; // Unique identifier for the AO organization
  location_name: string; // Name of the location where the event will be held
  event_name: string; // Name of the upcoming event
  event_type: string; // Types/categories associated with the event
  event_category: string; // Category of the event
  q_list: [
    {
      user_id: number; // Unique identifier for the Q (leader)
      f3_name: string; // F3 name (nickname) of the Q
      avatar_url?: string; // Optional URL to the Q's avatar image
    },
  ]; // List of Qs (leaders) for the upcoming event
}

/* =========================================================== */
/*                REGION-SPECIFIC TYPES BELOW                  */
/* =========================================================== */

// USED ONLY FOR REGION LISTING AND SELECTION
export interface RegionDetails {
  id: number; // Unique identifier for the region
  name: string; // Name of the region
  logo: string | null; // Logo URL of the region, can be null
  area_id: number; // Unique identifier for the area
  area_name: string; // Name of the area
}

// USED ONLY FOR REGION SUMMARY STATS
export interface RegionSummary {
  event_count: number; // Total number of events held in the region
  ao_count: number; // Total number of AOs (Areas of Operation) in the region
  active_pax: number; // Number of active participants (pax) in the region
  unique_pax: number; // Number of unique participants (pax) who have attended events in the region
  unique_qs: number; // Number of unique Qs (leaders) who have led events in the region
  fng_count: number; // Total number of first-time participants (FNGs) in the region
  pax_count_average: number; // Average number of participants (pax) per event in the region
}

// USED ONLY FOR REGION KOTTER LISTING
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

// USED ONLY FOR REGION CHART DATA
export interface RegionChartData {
  uniquePax: RegionChart_UniquePax;
  workoutAOCount: RegionChart_WorkoutAOCount[];
}

export interface RegionChart_UniquePax {
  itteration_type: "month" | "week" | "day" | ""; // Type of iteration (month, week, day, or none)
  data: {
    iteration: string; // e.g., month or week identifier
    count: number; // Number of unique pax in that month/week
    average: number; // Average pax count for that month/week
  }[];
}

export interface RegionChart_WorkoutAOCount {
  aoName: string; // Name of the AO
  count: number; // Number of workouts held at the AO
}

/* =========================================================== */
/*                 PAX TYPES USED ACROSS APP                   */
/* =========================================================== */

export interface PaxData {
  info: PaxInfo; // Information about the pax
  events: EventData[]; // List of event data associated with the pax
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

/* ========================================================== */
/*                  AO-SPECIFIC TYPES BELOW                    */
/* =========================================================== */

// USED ONLY FOR AO SUMMARY STATS
export interface AOSummary {
  event_count: number; // Total number of events held in the AO
  first_event_date: string | null; // Date of the first event held in the AO
  active_pax: number; // Number of active participants (pax) in the AO
  unique_pax: number; // Number of unique participants (pax) who have attended events in the AO
  unique_qs: number; // Number of unique Qs (leaders) who have led events in the AO
  fng_count: number; // Total number of first-time participants (FNGs) in the AO
  pax_count_average: number; // Average number of participants (pax) per event in the AO
}

// USED ONLY FOR AO CHART DATA
export interface AOChartData {
  uniquePax: AOChart_UniquePax;
  workoutAOCount: AOChart_WorkoutAOCount[];
}

export interface AOChart_UniquePax {
  itteration_type: "month" | "week" | "day" | ""; // Type of iteration (month, week, day, or none)
  data: {
    iteration: string; // e.g., month or week identifier
    count: number; // Number of unique pax in that month/week
    average: number; // Average pax count for that month/week
  }[];
}

export interface AOChart_WorkoutAOCount {
  aoName: string; // Name of the AO
  count: number; // Number of workouts held at the AO
}
