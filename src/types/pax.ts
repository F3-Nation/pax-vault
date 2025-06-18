export interface PaxList {
  id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname)   
  first_name: string; // First name of the user
  last_name: string; // Last name of the user
  email: string; // Email address of the user
  region: string; // Home region (if set)
  region_id: number; // ID of the home region
  region_default: string; // First-attended region
  region_default_id: number; // ID of the first-attended region
  avatar: string; // Avatar URL of the user
  created: string; // Timestamp when the user was created
  updated: string; // Timestamp when the user was last updated
  status: string; // Status of the user (e.g., active, inactive)
}

export interface PaxDetail {
  id: number; // Unique identifier for the user
  f3_name: string; // F3 name (nickname)   
  first_name: string; // First name of the user
  last_name: string; // Last name of the user
  email: string; // Email address of the user
  region: string; // Home region (if set)
  region_id: number; // ID of the home region
  region_default: string; // First-attended region
  region_default_id: number; // ID of the first-attended region
  avatar: string; // Avatar URL of the user
  created: string; // Timestamp when the user was created
  updated: string; // Timestamp when the user was last updated
  status: string; // Status of the user (e.g., active, inactive)
}

export interface PaxEvents {
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

export interface PaxEventsCalculations {
  totalEvents: number; // Total number of events attended by the user
  totalQ: number; // Total number of Qs (leadership roles) taken by the user
  firstBD: string; // Start date of the first event
  firstBDLocation: { id: number, name: string } | null; // Location of the first event
  lastBD: string; // Start date of the last event
  lastBDLocation: { id: number, name: string } | null; // Location of the last event
  firstQ: string; // Start date of the first Q event
  firstQLocation: { id: number, name: string } | null; // Location of the first Q event
  lastQ: string; // Start date of the last Q event
  lastQLocation: { id: number, name: string } | null; // Location of the last Q event
  aoNameCounts: { id: number, ao_name: string, count: number, region_name: string, region_org_id: number }[]; // Counts of events per AO
  aoNameQCounts: { id: number, ao_name: string, count: number, region_name: string, region_org_id: number }[]; // Counts of Qs per AO
}

export interface PaxEventsResults {
  nation: PaxEventsCalculations; // Calculations for all events nationwide
  region: PaxEventsCalculations; // Calculations for events in the user's home region
}

export interface PaxAchievements {
  achievement_id: number; // Unique identifier for the achievement
  user_id: number; // Unique identifier for the user
  date_awarded: string; // Date when the achievement was awarded
  name: string; // Name of the achievement
  description: string; // Description of the achievement
  verb: string; // Verb associated with the achievement
  image_url: string | null; // URL of the achievement image
  specific_org_id: number | null; // Specific organization ID if applicable
}