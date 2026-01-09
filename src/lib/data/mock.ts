import type { DataSource } from "./index";
import type { PaxInfo, PaxEventData } from "@/types/pax";
import type {
  RegionDetails,
  RegionData,
  RegionUpcomingEvents,
} from "@/types/region";

// Mock data for local development without a real data source

// Mock Pax (users) data
export const MOCK_PAX_LIST: PaxInfo[] = [
  {
    user_id: 1,
    f3_name: "Andy Taylor",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 2,
    f3_name: "Barney Fife",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 3,
    f3_name: "Opie Taylor",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 4,
    f3_name: "Gomer Pyle",
    region: null,
    region_id: null,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 5,
    f3_name: "Otis Campbell",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "inactive",
  },
  {
    user_id: 6,
    f3_name: "Floyd Lawson",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 7,
    f3_name: "Aunt Bee",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 8,
    f3_name: "Ellie Walker",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 9,
    f3_name: "Thelma Lou",
    region: "Mayberry",
    region_id: 101,
    region_default: "Mayberry",
    region_default_id: 101,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 10,
    f3_name: "Goober Pyle",
    region: "Mount Pilot",
    region_id: 102,
    region_default: "Mount Pilot",
    region_default_id: 102,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 11,
    f3_name: "Howard Sprague",
    region: "Mount Pilot",
    region_id: 102,
    region_default: "Mount Pilot",
    region_default_id: 102,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 12,
    f3_name: "Helen Crump",
    region: "Mount Pilot",
    region_id: 102,
    region_default: "Mount Pilot",
    region_default_id: 102,
    avatar_url: null,
    status: "active",
  },
  {
    user_id: 13,
    f3_name: "Clara Edwards",
    region: "Siler's City",
    region_id: 103,
    region_default: "Siler's City",
    region_default_id: 103,
    avatar_url: null,
    status: "active",
  },
];

// Mock Region data
export const MOCK_REGION_LIST: RegionDetails[] = [
  {
    id: 101,
    name: "Mayberry",
    logo: null,
    area_id: 1,
    area_name: "North Carolina",
  },
  {
    id: 102,
    name: "Mount Pilot",
    logo: null,
    area_id: 1,
    area_name: "North Carolina",
  },
  {
    id: 103,
    name: "Siler's City",
    logo: null,
    area_id: 1,
    area_name: "North Carolina",
  },
];

// Mock event data for pax
export const MOCK_PAX_EVENTS: Record<number, PaxEventData[]> = {
  1: [
    {
      event_instance_id: 1001,
      event_date: "2024-01-15",
      event_name: "The Murph",
      pax_count: 12,
      fng_count: 2,
      ao_org_id: 201,
      ao_name: "The Courthouse",
      region_org_id: 101,
      region_name: "Mayberry",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "N",
      all_types: ["Workout"],
      all_tags: ["Hero WOD", "CrossFit"],
      attendance: [
        {
          id: 1,
          user_id: 1,
          f3_name: "Andy Taylor",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 2,
          user_id: 2,
          f3_name: "Barney Fife",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
    {
      event_instance_id: 1002,
      event_date: "2024-01-22",
      event_name: "Bootcamp",
      pax_count: 15,
      fng_count: 1,
      ao_org_id: 202,
      ao_name: "Wally's Filling Station",
      region_org_id: 101,
      region_name: "Mayberry",
      first_f_ind: "Y",
      second_f_ind: "N",
      third_f_ind: "N",
      all_types: ["Bootcamp"],
      all_tags: ["Cardio", "Bodyweight"],
      attendance: [
        {
          id: 3,
          user_id: 1,
          f3_name: "Andy Taylor",
          q_ind: false,
          coq_ind: true,
          avatar_url: null,
        },
      ],
    },
  ],
  2: [
    {
      event_instance_id: 1003,
      event_date: "2024-01-18",
      event_name: "Ruck",
      pax_count: 8,
      fng_count: 0,
      ao_org_id: 203,
      ao_name: "Myers Lake",
      region_org_id: 101,
      region_name: "Mayberry",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "Y",
      all_types: ["Ruck"],
      all_tags: ["Endurance", "Ruck"],
      attendance: [
        {
          id: 4,
          user_id: 2,
          f3_name: "Barney Fife",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
  6: [
    // Floyd Lawson - last event 25 days ago (within KotterList range: 14-90 days)
    {
      event_instance_id: 1004,
      event_date: "2024-05-21",
      event_name: "Morning Workout",
      pax_count: 10,
      fng_count: 1,
      ao_org_id: 201,
      ao_name: "The Courthouse",
      region_org_id: 101,
      region_name: "Mayberry",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "N",
      all_types: ["Workout"],
      all_tags: ["Strength"],
      attendance: [
        {
          id: 5,
          user_id: 6,
          f3_name: "Floyd Lawson",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
  7: [
    // Aunt Bee - last event 30 days ago (within KotterList range)
    {
      event_instance_id: 1005,
      event_date: "2024-05-16",
      event_name: "Bootcamp",
      pax_count: 12,
      fng_count: 0,
      ao_org_id: 202,
      ao_name: "Wally's Filling Station",
      region_org_id: 101,
      region_name: "Mayberry",
      first_f_ind: "Y",
      second_f_ind: "N",
      third_f_ind: "N",
      all_types: ["Bootcamp"],
      all_tags: ["Cardio"],
      attendance: [
        {
          id: 6,
          user_id: 7,
          f3_name: "Aunt Bee",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
  10: [
    // Goober Pyle - Mount Pilot, last event 5 days ago (too recent for KotterList)
    {
      event_instance_id: 1006,
      event_date: "2024-06-10",
      event_name: "Ruck",
      pax_count: 9,
      fng_count: 0,
      ao_org_id: 301,
      ao_name: "Main Street",
      region_org_id: 102,
      region_name: "Mount Pilot",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "Y",
      all_types: ["Ruck"],
      all_tags: ["Endurance"],
      attendance: [
        {
          id: 7,
          user_id: 10,
          f3_name: "Goober Pyle",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
  11: [
    // Howard Sprague - Mount Pilot, last event 100 days ago (too old for KotterList)
    {
      event_instance_id: 1007,
      event_date: "2024-03-06",
      event_name: "Workout",
      pax_count: 8,
      fng_count: 1,
      ao_org_id: 301,
      ao_name: "Main Street",
      region_org_id: 102,
      region_name: "Mount Pilot",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "N",
      all_types: ["Workout"],
      all_tags: ["Strength"],
      attendance: [
        {
          id: 8,
          user_id: 11,
          f3_name: "Howard Sprague",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
};

// Mock region event data
export const MOCK_REGION_EVENTS: Record<number, RegionData[]> = {
  101: [
    {
      event_instance_id: 1001,
      event_date: "2024-01-15",
      event_name: "The Murph",
      pax_count: 12,
      fng_count: 2,
      ao_org_id: 201,
      ao_name: "The Courthouse",
      region_org_id: 101,
      region_name: "Mayberry",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "N",
      all_types: ["Workout"],
      all_tags: ["Hero WOD", "CrossFit"],
      attendance: [
        {
          id: 1,
          user_id: 1,
          f3_name: "Andy Taylor",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 2,
          user_id: 2,
          f3_name: "Barney Fife",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 3,
          user_id: 3,
          f3_name: "Opie Taylor",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
    {
      event_instance_id: 1002,
      event_date: "2024-01-22",
      event_name: "Bootcamp",
      pax_count: 15,
      fng_count: 1,
      ao_org_id: 202,
      ao_name: "Wally's Filling Station",
      region_org_id: 101,
      region_name: "Mayberry",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "N",
      third_f_ind: "N",
      all_types: ["Bootcamp"],
      all_tags: ["Cardio", "Bodyweight"],
      attendance: [
        {
          id: 4,
          user_id: 1,
          f3_name: "Andy Taylor",
          q_ind: false,
          coq_ind: true,
          avatar_url: null,
        },
        {
          id: 5,
          user_id: 2,
          f3_name: "Barney Fife",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
    // Floyd Lawson - last event 25 days ago (within KotterList range: 14-90 days)
    // Current date in tests: 2024-06-15, so event on 2024-05-21 is 25 days ago
    {
      event_instance_id: 1004,
      event_date: "2024-05-21",
      event_name: "Morning Workout",
      pax_count: 10,
      fng_count: 1,
      ao_org_id: 201,
      ao_name: "The Courthouse",
      region_org_id: 101,
      region_name: "Mayberry",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "N",
      all_types: ["Workout"],
      all_tags: ["Strength"],
      attendance: [
        {
          id: 5,
          user_id: 6,
          f3_name: "Floyd Lawson",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 6,
          user_id: 8,
          f3_name: "Ellie Walker",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
    // Aunt Bee - last event 30 days ago (within KotterList range)
    {
      event_instance_id: 1005,
      event_date: "2024-05-16",
      event_name: "Bootcamp",
      pax_count: 12,
      fng_count: 0,
      ao_org_id: 202,
      ao_name: "Wally's Filling Station",
      region_org_id: 101,
      region_name: "Mayberry",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "N",
      third_f_ind: "N",
      all_types: ["Bootcamp"],
      all_tags: ["Cardio"],
      attendance: [
        {
          id: 7,
          user_id: 7,
          f3_name: "Aunt Bee",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 8,
          user_id: 9,
          f3_name: "Thelma Lou",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
  102: [
    // Mount Pilot - events that won't result in KotterList entries
    // Goober Pyle - last event 5 days ago (too recent, within 14 days)
    {
      event_instance_id: 1006,
      event_date: "2024-06-10",
      event_name: "Ruck",
      pax_count: 9,
      fng_count: 0,
      ao_org_id: 301,
      ao_name: "Main Street",
      region_org_id: 102,
      region_name: "Mount Pilot",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "Y",
      all_types: ["Ruck"],
      all_tags: ["Endurance"],
      attendance: [
        {
          id: 9,
          user_id: 10,
          f3_name: "Goober Pyle",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 10,
          user_id: 11,
          f3_name: "Howard Sprague",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
    // Howard Sprague - last event 100 days ago (too old, more than 90 days)
    {
      event_instance_id: 1007,
      event_date: "2024-03-06",
      event_name: "Workout",
      pax_count: 8,
      fng_count: 1,
      ao_org_id: 301,
      ao_name: "Main Street",
      region_org_id: 102,
      region_name: "Mount Pilot",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "Y",
      third_f_ind: "N",
      all_types: ["Workout"],
      all_tags: ["Strength"],
      attendance: [
        {
          id: 11,
          user_id: 11,
          f3_name: "Howard Sprague",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
        {
          id: 12,
          user_id: 12,
          f3_name: "Helen Crump",
          q_ind: true,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
    // Helen Crump - last event 3 days ago (too recent)
    {
      event_instance_id: 1008,
      event_date: "2024-06-12",
      event_name: "Bootcamp",
      pax_count: 11,
      fng_count: 0,
      ao_org_id: 301,
      ao_name: "Main Street",
      region_org_id: 102,
      region_name: "Mount Pilot",
      region_logo_url: null,
      area_org_id: 1,
      area_name: "North Carolina",
      sector_org_id: 1,
      sector_name: "Central",
      first_f_ind: "Y",
      second_f_ind: "N",
      third_f_ind: "N",
      all_types: ["Bootcamp"],
      all_tags: ["Cardio"],
      attendance: [
        {
          id: 13,
          user_id: 12,
          f3_name: "Helen Crump",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ],
    },
  ],
};

// Mock upcoming events (type assertion used in getUpcomingEvents due to tuple type definition)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_UPCOMING_EVENTS: Record<number, any[]> = {
  101: [
    {
      start_date: "2024-02-01",
      start_time: "0530",
      ao_name: "The Courthouse",
      ao_org_id: 201,
      location_name: "Floyd's Barber Shop",
      event_name: "Morning Bootcamp",
      event_type: "Bootcamp, CrossFit",
      event_category: "Workout",
      q_list: [
        {
          user_id: 1,
          f3_name: "Andy Taylor",
        },
      ],
    },
    {
      start_date: "2024-02-03",
      start_time: "0600",
      ao_name: "Wally's Filling Station",
      ao_org_id: 202,
      location_name: "Myers Lake",
      event_name: "Weekend Ruck",
      event_type: "Ruck",
      event_category: "Ruck",
      q_list: [
        {
          user_id: 2,
          f3_name: "Barney Fife",
        },
        {
          user_id: 3,
          f3_name: "Opie Taylor",
        },
      ],
    },
  ],
};

// Simulate async delay for more realistic behavior
function delay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockDataSource implements DataSource {
  async getPaxList(): Promise<PaxInfo[]> {
    await delay();
    return [...MOCK_PAX_LIST];
  }

  async getRegionList(): Promise<RegionDetails[]> {
    await delay();
    return [...MOCK_REGION_LIST];
  }

  async getPaxInfo(id: number): Promise<PaxInfo | null> {
    await delay();
    return MOCK_PAX_LIST.find((pax) => pax.user_id === id) || null;
  }

  async getPaxEvents(id: number): Promise<PaxEventData[] | null> {
    await delay();
    return MOCK_PAX_EVENTS[id] || [];
  }

  async getRegionData(id: number): Promise<RegionData[] | null> {
    await delay();
    return MOCK_REGION_EVENTS[id] || [];
  }

  async getUpcomingEvents(id: number): Promise<RegionUpcomingEvents[] | null> {
    await delay();
    const events = MOCK_UPCOMING_EVENTS[id];
    if (!events) return null;
    // Type assertion needed due to TypeScript tuple type definition in RegionUpcomingEvents
    return events as unknown as RegionUpcomingEvents[];
  }
}
