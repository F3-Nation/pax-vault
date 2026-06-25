/* =========================================================== */
/*                  TYPES USED ACROSS APP                      */
/* =========================================================== */

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
  attended: boolean | null; // Has an actual (is_planned=FALSE) record — physically there
  ghost: boolean | null; // Attended unannounced (actual record, no planned record)
  fartsack: boolean | null; // Signed up but no-showed — filtered out at the SQL source (bq/*.ts)
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

/* USED FOR EVENT DETAILS */
export interface EventDetails {
  id: number; // Unique identifier for the event instance
  description: string; // Description of the event
  preblast: string | null; // Preblast information for the event, can be null
  preblast_rich: string | null; // Rich preblast information for the event, can be null
  backblast: string | null; // Backblast information for the event, can be null
  backblast_rich: string | null; // Rich backblast information for the event, can be null
  meta: {
    file_ids: string[] | null;
    files: string[] | null;
    [key: string]: string | string[] | number | boolean | null | undefined;
  } | null; // Metadata associated with the event, can be null
}

/* USED FOR LEADERBOARDS */
export interface Leaders {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  posts: number; // Total number of posts (events attended) by the user at the AO
  qs: number; // Total number of Q appearances by the user at the AO
  all_posts?: number; // Total number of posts (events attended) by the user across all AOs
  all_qs?: number; // Total number of Q appearances by the user across all AOs
  avatar_url?: string; // Optional URL to the user's avatar image
}

/* USED FOR CHARTS */
export interface ChartData {
  date: string; // Date for the chart data point
  pax_count: number; // Number of participants (pax) for the chart data point
  fng_count: number; // Number of first-time participants (FNGs) for the chart data point
  q_count: number; // Number of Qs (leaders) for the chart data point
  unique_pax_count: number; // Number of unique participants (pax) for the chart data point
  unique_q_count: number; // Number of unique Qs (leaders) for the chart data point
}

/* =========================================================== */
/*                REGION-SPECIFIC TYPES BELOW                  */
/* =========================================================== */

// REGION DATA MODEL
export interface RegionData {
  info: RegionInfo | null; // Basic information about the region}
  summary: RegionSummary | null; // Summary statistics for the region
  leaders: Leaders[] | null; // Leaderboard data for the region
  events: EventData[] | null; // List of events held in the region
  upcoming: EventUpcoming[] | null; // List of upcoming events in the region
  kotter: RegionKotterList[] | null; // List of Kotter events in the region
  charts: ChartData[] | null; // List of chart data points for the region
  achievements: RegionAchievementPax[] | null; // PAX approaching milestones or with upcoming anniversaries
}

/* USED ONLY FOR REGION INFO */
export interface RegionInfo {
  region_id: number; // Unique identifier for the region
  region_name: string; // Name of the region
  area_id: number; // Unique identifier for the area, can be null
  area_name: string; // Name of the area
  logo_url: string | null; // URL to the region's logo, can be null
  is_active: boolean; // Indicates if the region is active
  aos: { ao_org_id: number; ao_name: string }[];
  types: { type_id: number; type_name: string }[];
  tags: { tag_id: number; tag_name: string }[];
}

/* USED ONLY FOR REGION SUMMARY STATS */
export interface RegionSummary {
  event_count: number; // Total number of events held in the region
  ao_count: number; // Total number of AOs (Areas of Operation) in the region
  active_pax: number; // Number of active participants (pax) in the region
  unique_pax: number; // Number of unique participants (pax) who have attended events in the region
  unique_qs: number; // Number of unique Qs (leaders) who have led events in the region
  fng_count: number; // Total number of first-time participants (FNGs) in the region
  pax_count_average: number; // Average number of participants (pax) per event in the region
  fartsack_king_user_id: number | null; // PAX with the most fartsacks (no-shows) in the region; null when none
  fartsack_king_f3_name: string | null; // F3 name of the Fart Sack King; null when none
  fartsack_king_count: number | null; // Number of fartsacks for the Fart Sack King; null when none
}

/* USED FOR REGION UPCOMING ACHIEVEMENTS */
export interface RegionAchievementPax {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  avatar_url?: string; // Optional URL to the user's avatar image
  region_posts: number; // Total posts (events attended) in this region
  region_qs: number; // Total Qs led in this region
  all_posts: number; // Total posts across all regions
  all_qs: number; // Total Qs across all regions
  next_region_post_milestone: number | null; // Next post milestone in this region
  next_nation_post_milestone: number | null; // Next post milestone across all regions
  next_region_q_milestone: number | null; // Next Q milestone in this region
  next_nation_q_milestone: number | null; // Next Q milestone across all regions
  fng_date: string | null; // FNG/first-event date (ISO string)
  next_anniversary_date: string | null; // Date of next FNG anniversary (ISO string)
  days_until_anniversary: number | null; // Days until the next FNG anniversary
  last_region_event_date: string | null; // Date of most recent event attended in this region (ISO string)
}

/* USED ONLY FOR REGION KOTTER LISTING */
export interface RegionKotterList {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  avatar_url?: string; // Optional URL to the user's avatar image
  kotter_status: string; // Kotter status of the user (e.g., "Active", "Inactive")
  total_events: number; // Total number of events attended by the user
  days_since_last_event: number; // Number of days since the user's last event attendance
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

/* =========================================================== */
/*                 PAX TYPES USED ACROSS APP                   */
/* =========================================================== */

// PAX DATA MODEL
export interface PaxData {
  info: PAXInfo | null; // Information about the pax
  summary: PaxSummary | null; // Summary statistics for the pax
  ao_breakdown: PaxAOBreakdown[] | null; // Breakdown of events and Qs by AO
  events: EventData[] | null; // List of event data associated with the pax
}

/* USED FOR PAX INFO */
export interface PAXInfo {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  home_region_id: number; // Unique identifier for the user's home region
  home_region_name: string; // Name of the user's home region
  avatar_url: string | null; // URL to the user's avatar image, can be null
  status: string; // Status of the user (e.g., active, inactive)
  aos: { ao_org_id: number; ao_name: string }[];
  regions: { region_org_id: number; region_name: string }[];
  types: { type_id: number; type_name: string }[];
  tags: { tag_id: number; tag_name: string }[];
}

/* USED FOR PAX SUMMARY */
export interface PaxSummary {
  event_count: number; // Total number of events held in the region
  q_count: number; // Total number of Qs (leaders) across all events
  ghost_count: number; // Number of events the PAX attended unannounced (ghost)
  fartsack_count: number; // Number of events the PAX signed up for but no-showed (fartsack)
  fng_date: string | null; // Optional override for the user's start date, can be null
  first_event_date: string | null; // Date of the first event in the region
  first_event_ao_id: number | null; // ID of the first event in the region
  first_event_ao_name: string | null; // Name of the AO (Area of Operation) for the first event
  last_event_date: string | null; // Date of the last event in the region
  last_event_ao_id: number | null; // ID of the last event in the region
  last_event_ao_name: string | null; // Name of the AO (Area of Operation) for the last event
  bestie_user_id: number | null; // User ID of the bestie (most attended by the main user)
  bestie_user_count: number; // Number of events attended by the bestie
  bestie_f3_name: string | null; // F3 name of the bestie
  unique_users_met: number; // Number of unique users met by the main user
  first_q_date: string | null; // Date of the first event where the main user was a Q
  first_q_ao_id: number | null; // ID of the AO for the first Q event
  first_q_ao_name: string | null; // Name of the AO for the first Q event
  last_q_date: string | null; // Date of the last event where the main user was a Q
  last_q_ao_id: number | null; // ID of the AO for the last Q event
  last_q_ao_name: string | null; // Name of the AO for the last Q event
  unique_pax_when_q: number; // Number of unique pax who attended events when the main user was a Q
  effective_percentage: number | null; // "Efficiency" — posting consistency: posts / days since first post * 100 (see lib/bq/pax.ts)
}

/* USED FOR PAX AO BREAKDOWN */
export interface PaxAOBreakdown {
  ao_org_id: number; // Unique identifier for the AO organization
  ao_name: string; // Name of the AO organization
  region_org_id: number; // Unique identifier for the region organization
  region_name: string; // Name of the region organization
  total_events: number; // Number of events held by the AO
  total_q_count: number; // Number of Qs (leaders) held by the AO
}

/* =========================================================== */
/*               AREA-SPECIFIC TYPES BELOW                     */
/* =========================================================== */

// AREA DATA MODEL
export interface AreaData {
  info: AreaInfo | null;
  summary: AreaSummary | null;
  regionBreakdown: AreaRegionBreakdown[] | null;
  charts: ChartData[] | null;
}

/* USED ONLY FOR AREA INFO */
export interface AreaInfo {
  area_id: number;
  area_name: string;
  sector_id: number | null;
  sector_name: string | null;
  logo_url: string | null;
  is_active: boolean;
  regions: { region_id: number; region_name: string; is_active: boolean }[];
}

/* USED ONLY FOR AREA SUMMARY STATS */
export interface AreaSummary {
  event_count: number;
  region_count: number;
  ao_count: number;
  active_pax: number;
  unique_pax: number;
  unique_qs: number;
  fng_count: number;
  pax_count_average: number;
  fartsack_king_user_id: number | null; // PAX with the most fartsacks (no-shows) in the area; null when none
  fartsack_king_f3_name: string | null; // F3 name of the Fart Sack King; null when none
  fartsack_king_count: number | null; // Number of fartsacks for the Fart Sack King; null when none
}

/* USED FOR AREA REGION BREAKDOWN */
export interface AreaRegionBreakdown {
  region_id: number;
  region_name: string;
  event_count: number;
  ao_count: number;
  active_pax: number;
  unique_pax: number;
  unique_qs: number;
  fng_count: number;
  pax_count_average: number;
}

/* =========================================================== */
/*              SECTOR-SPECIFIC TYPES BELOW                    */
/* =========================================================== */

// SECTOR DATA MODEL
export interface SectorData {
  info: SectorInfo | null;
  summary: SectorSummary | null;
  areaBreakdown: SectorAreaBreakdown[] | null;
  charts: ChartData[] | null;
}

/* USED ONLY FOR SECTOR INFO */
export interface SectorInfo {
  sector_id: number;
  sector_name: string;
  logo_url: string | null;
  is_active: boolean;
  areas: { area_id: number; area_name: string; is_active: boolean }[];
}

/* USED ONLY FOR SECTOR SUMMARY STATS */
export interface SectorSummary {
  event_count: number;
  area_count: number;
  ao_count: number;
  active_pax: number;
  unique_pax: number;
  unique_qs: number;
  fng_count: number;
  pax_count_average: number;
  fartsack_king_user_id: number | null; // PAX with the most fartsacks (no-shows) in the sector; null when none
  fartsack_king_f3_name: string | null; // F3 name of the Fart Sack King; null when none
  fartsack_king_count: number | null; // Number of fartsacks for the Fart Sack King; null when none
}

/* USED FOR SECTOR AREA BREAKDOWN */
export interface SectorAreaBreakdown {
  area_id: number;
  area_name: string;
  event_count: number;
  ao_count: number;
  active_pax: number;
  unique_pax: number;
  unique_qs: number;
  fng_count: number;
  pax_count_average: number;
}

/* ========================================================== */
/*                  AO-SPECIFIC TYPES BELOW                    */
/* =========================================================== */

// AO DATA MODEL
export interface AOData {
  info: AOInfo | null; // Basic information about the AO}
  summary: AOSummary | null; // Summary statistics for the AO
  leaders: Leaders[] | null; // Leaderboard data for the AO
  events: EventData[] | null; // List of events held in the AO
  upcoming: EventUpcoming[] | null; // List of upcoming events in the AO
}

/* USED ONLY FOR AO INFO */
export interface AOInfo {
  ao_id: number; // Unique identifier for the AO
  ao_name: string; // Name of the AO
  region_id: number; // Unique identifier for the region the AO belongs to
  region_name: string; // Name of the region the AO belongs to
  logo_url: string | null; // URL to the AO's logo, can be null
  is_active: boolean; // Indicates if the AO is active
  types: { type_id: number; type_name: string }[];
  tags: { tag_id: number; tag_name: string }[];
}

/* USED ONLY FOR AO SUMMARY STATS */
export interface AOSummary {
  event_count: number; // Total number of events held in the AO
  first_event_date: string | null; // Date of the first event held in the AO
  active_pax: number; // Number of active participants (pax) in the AO
  unique_pax: number; // Number of unique participants (pax) who have attended events in the AO
  unique_qs: number; // Number of unique Qs (leaders) who have led events in the AO
  fng_count: number; // Total number of first-time participants (FNGs) in the AO
  pax_count_average: number; // Average number of participants (pax) per event in the AO
  fartsack_king_user_id: number | null; // PAX with the most fartsacks (no-shows) at the AO; null when none
  fartsack_king_f3_name: string | null; // F3 name of the Fart Sack King; null when none
  fartsack_king_count: number | null; // Number of fartsacks for the Fart Sack King; null when none
}
