export interface AOData {
  id: number; // Unique identifier for the organization
  name: string; // Name of the organization
  email: string; // Contact email for the organization
  website: string; // Website URL of the organization
  logo: string | null; // Logo URL of the organization, can be null
  active: boolean; // Indicates if the organization is active
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