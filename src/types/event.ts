export interface EventDetail {
  id: number; // Unique identifier for the event
  org_id: number; // Identifier for the organizing body
  start_date: string; // Event start date in ISO format
  end_date: string; // Event end date in ISO format
  name: string; // Name of the event
  pax_count: number; // Number of attendees
  fng_count: number; // Number of first-time attendees
  backblast: string | null; // Backblast content for the event
  ao_org_id: number; // Identifier for the associated AO organization
  ao_name: string; // Name of the associated AO organization
  ao_website: string; // Website of the associated AO organization
  region_org_id: number; // Identifier for the region organization
  region_name: string; // Name of the region
  region_website: string; // Website of the region
  bootcamp_ind: boolean; // Indicates if the event is a bootcamp
  run_ind: boolean; // Indicates if the event is a run
  ruck_ind: boolean; // Indicates if the event is a ruck
  first_f_ind: boolean; // Indicates if the event is a first-finder event
  second_f_ind: boolean; // Indicates if the event is a second-finder event
  third_f_ind: boolean; // Indicates if the event is a third-finder event
}