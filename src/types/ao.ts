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
  }[]
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