export interface AOData {
  id: number; // Unique identifier for the organization
  name: string; // Name of the organization
  region_id: number; // Identifier for the region the organization belongs to
  region_name: string; // Name of the region the organization belongs to
  description: string | null; // Description of the organization, can be null
  email: string; // Contact email for the organization
  website: string; // Website URL of the organization
  twitter: string | null; // Twitter handle of the organization, can be null
  facebook: string | null; // Facebook page of the organization, can be null
  instagram: string | null; // Instagram handle of the organization, can be null
  logo: string | null; // Logo URL of the organization, can be null
  active: boolean; // Indicates if the organization is active
  meta: Record<string, unknown> | null; // Additional metadata about the organization, can be null
  eventSchedule: {
    id: number; // Unique identifier for the event
    name: string; // Name of the event
    description: string | null; // Description of the event, can be null
    start_time: string; // Start time of the event
    end_time: string; // End time of the event
    day_of_week: string; // Day of the week the event occurs
    event_type: string; // Type of the event (e.g., meeting, training)
  }[];
}

export interface AODetail {
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
}

export interface AOSummary {
  first_start_time: string; // The earliest start time of any event associated with the AO, can be null
  total_workouts: number; // Total number of workout events associated with the AO
  unique_pax: number; // Number of unique participants (pax) who have attended events at the AO
  unique_qs: number; // Number of unique Qs (leaders) who have led events at the AO
  total_fngs: number; // Total number of first-time participants (FNGs) at the AO
  avg_pax_count: number; // Average number of participants (pax) per event at the AO
  peak_pax_count: number; // Highest number of participants (pax) recorded at a single event at the AO
}

export interface AOLeaders {
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  posts: number; // Total number of posts (events attended) by the user at the AO
  qs: number; // Total number of Q appearances by the user at the AO
  avatar_url?: string; // Optional URL to the user's avatar image
}

export interface AOEvents {
  id: number; // Unique identifier for the record
  user_id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname) of the user
  avatar: string | null; // Avatar URL of the user
  event_instance_id: number; // Unique identifier for the event instance
  name: string; // Name of the event
  start_date: string; // Start date of the event
  ao_name: string; // Name of the Area of Operation (AO)
  ao_org_id: number; // ID of the AO organization
  q_ind: string; // Indicates if the user held a Q (leadership role) for this event
  region_name: string; // Name of the region where the event took place
  region_org_id: number; // ID of the region organization
  pax_list: string; // Comma-separated list of PAX (participants) in the event
  pax_count: number; // Total number of PAX (participants) in the event
  q_list: string; // Comma-separated list of users who held a Q for the event
}

export interface AOQLineup {
  start_date: string; // Start date of the event
  start_time: string; // Start time of the event
  ao_name: string; // Name of the Area of Operation (AO)
  ao_org_id: number; // ID of the AO organization
  location_name: string; // Name of the event location
  latitude: number | null; // Latitude of the event location, can be null
  longitude: number | null; // Longitude of the event location, can be null
  event_types: string; // Type of the event (e.g., meeting, training)
  event_tags: string; // Tags associated with the event
  q_list: Array<{
    user_id: number;
    name: string;
    avatar_url: string;
  }> | null; // List of Qs (leaders) for the event with their details, can be null
  q_who: string | null; // Comma-separated list of users who held a Q for the event, can be null
}
