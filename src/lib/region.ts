// src/lib/region.ts
import { getRegionList, RegionList, RegionDetailResponse } from './data/region';
import { cache } from 'react';
import pool from '@/lib/db';

export const getCachedRegionList = cache(async (): Promise<RegionList[]> => {
  try {
    return await getRegionList();
  } catch (err) {
    console.error('Failed to load region data:', err);
    return [];
  }
});

export async function getRegionDetail(id: number): Promise<RegionDetailResponse | null> {
  const { rows } = await pool.query(`
    SELECT 
      json_build_object(
        'id', org.id,
        'name', org.name,
        'email', org.email,
        'website', org.website,
        'twitter', org.twitter,
        'facebook', org.facebook,
        'instagram', org.instagram,
        'created', org.created,
        'updated', org.updated,
        'logo', org.logo_url,
        'ao_count', org.ao_count,
        'active', org.is_active,
        'aos', COALESCE(
          json_agg(
            json_build_object(
              'id', ao.id,
              'name', ao.name,
              'email', ao.email,
              'website', ao.website,
              'twitter', ao.twitter,
              'facebook', ao.facebook,
              'instagram', ao.instagram,
              'created', ao.created,
              'updated', ao.updated,
              'logo', ao.logo_url,
              'ao_count', ao.ao_count,
              'active', ao.is_active
            )
          ) FILTER (WHERE ao.id IS NOT NULL),
          '[]'
        )
      ) AS region
    FROM orgs org
    LEFT JOIN orgs ao ON ao.parent_id = org.id AND ao.org_type = 'ao'
    WHERE org.id = $1
    GROUP BY org.id
    `,
    [id]
  );

  return rows[0] ?? { region: null };
}