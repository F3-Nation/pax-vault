-- PAX roster + event-derived vocab (regions, aos, types, tags) + role grants
--
-- Scheduled query "PaxVault PAX": every 6 hours, WRITE_TRUNCATE into
-- f3data.paxVault.pv_pax. The table schema is whatever this SELECT returns,
-- so a new column here appears on the next run (no ALTER TABLE needed).

WITH
  -- ---------- Base PAX list ----------
  pax AS (
    SELECT
      us.id AS user_id,
      us.f3_name,
      us.home_region_id,
      org.name AS home_region_name,
      us.avatar_url,
      us.email,
      us.status,
      JSON_EXTRACT_SCALAR(us.meta, '$.start_date_override') as start_date_override
    FROM `f3data.public.users` AS us
    LEFT JOIN `f3data.public.orgs` AS org
      ON us.home_region_id = org.id
    WHERE
      us.email IS NOT NULL
      AND REGEXP_CONTAINS(
        us.email,
        r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
  ),

  -- ---------- Attendance + event context ----------
  pax_events AS (
    SELECT DISTINCT
      a.user_id,
      COALESCE(o1.id,   o2.id)   AS region_org_id,
      COALESCE(o1.name, o2.name) AS region_name,
      o0.id                      AS ao_org_id,
      o0.name                    AS ao_name,
      tc.all_type_ids,
      ta.all_tag_ids
    FROM `f3data.public.attendance` a
    JOIN `f3data.public.event_instances` ei
      ON ei.id = a.event_instance_id

    -- AO org
    LEFT JOIN `f3data.public.orgs` o0
      ON o0.id = ei.org_id
     AND o0.org_type = 'ao'

    -- Region org (direct)
    LEFT JOIN `f3data.public.orgs` o1
      ON o1.id = ei.org_id
     AND o1.org_type = 'region'

    -- Region org (via AO parent)
    LEFT JOIN `f3data.public.orgs` o2
      ON o2.id = o0.parent_id
     AND o2.org_type = 'region'

    -- Type IDs per event instance
    LEFT JOIN (
      SELECT
        x.event_instance_id,
        ARRAY_AGG(t.id) AS all_type_ids
      FROM `f3data.public.event_instances_x_event_types` x
      JOIN `f3data.public.event_types` t ON t.id = x.event_type_id
      GROUP BY x.event_instance_id
    ) tc ON tc.event_instance_id = ei.id

    -- Tag IDs per event instance
    LEFT JOIN (
      SELECT
        x.event_instance_id,
        ARRAY_AGG(t.id) AS all_tag_ids
      FROM `f3data.public.event_tags_x_event_instances` x
      JOIN `f3data.public.event_tags` t ON t.id = x.event_tag_id
      GROUP BY x.event_instance_id
    ) ta ON ta.event_instance_id = ei.id

    WHERE a.is_planned = false       -- key filter from attendance_expanded
      AND ei.pax_count IS NOT NULL   -- key filter from event_instance_expanded
      AND ei.is_active
      AND a.user_id IS NOT NULL
  ),

  -- ---------- Regions ----------
  regions AS (
    SELECT
      user_id,
      ARRAY_AGG(STRUCT(region_org_id, region_name) ORDER BY region_name) AS regions
    FROM (
      SELECT DISTINCT user_id, region_org_id, region_name
      FROM pax_events
      WHERE region_org_id IS NOT NULL
    )
    GROUP BY user_id
  ),

  -- ---------- AOs ----------
  aos AS (
    SELECT
      user_id,
      ARRAY_AGG(STRUCT(ao_org_id, ao_name) ORDER BY ao_name) AS aos
    FROM (
      SELECT DISTINCT user_id, ao_org_id, ao_name
      FROM pax_events
      WHERE ao_org_id IS NOT NULL
    )
    GROUP BY user_id
  ),

  -- ---------- Types ----------
  types AS (
    SELECT
      ti.user_id,
      ARRAY_AGG(
        STRUCT(
          ti.type_id,
          COALESCE(et.name, CAST(ti.type_id AS STRING)) AS type_name)
        ORDER BY COALESCE(et.name, CAST(ti.type_id AS STRING))) AS types
    FROM (
      SELECT DISTINCT user_id, type_id
      FROM pax_events, UNNEST(all_type_ids) AS type_id
      WHERE type_id IS NOT NULL
    ) ti
    LEFT JOIN `f3data.public.event_types` et ON et.id = ti.type_id
    GROUP BY ti.user_id
  ),

  -- ---------- Tags ----------
  event_tags AS (
    SELECT
      gi.user_id,
      ARRAY_AGG(
        STRUCT(
          gi.tag_id,
          COALESCE(tg.name, CAST(gi.tag_id AS STRING)) AS tag_name)
        ORDER BY COALESCE(tg.name, CAST(gi.tag_id AS STRING))) AS tags
    FROM (
      SELECT DISTINCT user_id, tag_id
      FROM pax_events, UNNEST(all_tag_ids) AS tag_id
      WHERE tag_id IS NOT NULL
    ) gi
    LEFT JOIN `f3data.public.event_tags` tg ON tg.id = gi.tag_id
    GROUP BY gi.user_id
  ),

  -- ---------- Roles ----------
  -- Every role grant the user holds, on whatever org it was granted (region,
  -- area, sector, nation). Deliberately unfiltered: the app decides which
  -- role/org combination satisfies a given check. Users with no grants get [].
  roles AS (
    SELECT
      rx.user_id,
      ARRAY_AGG(
        STRUCT(
          rx.role_id,
          COALESCE(ro.name, CAST(rx.role_id AS STRING)) AS role_name,
          rx.org_id,
          o.name AS org_name,
          o.org_type)
        ORDER BY rx.org_id, rx.role_id) AS roles
    FROM (
      -- DISTINCT guards against replicated duplicates in the link table.
      SELECT DISTINCT user_id, role_id, org_id
      FROM `f3data.public.roles_x_users_x_org`
      WHERE user_id IS NOT NULL
        AND role_id IS NOT NULL
        AND org_id IS NOT NULL
    ) rx
    LEFT JOIN `f3data.public.roles` ro ON ro.id = rx.role_id
    LEFT JOIN `f3data.public.orgs`  o  ON o.id  = rx.org_id
    GROUP BY rx.user_id
  )

SELECT
  CURRENT_TIMESTAMP() AS refreshed_at,
  p.user_id,
  p.f3_name,
  p.home_region_id,
  p.home_region_name,
  p.avatar_url,
  p.email,
  p.status,
  p.start_date_override,
  COALESCE(r.regions, []) AS regions,
  COALESCE(a.aos,     []) AS aos,
  COALESCE(t.types,   []) AS types,
  COALESCE(g.tags,    []) AS tags,
  COALESCE(ro.roles,  []) AS roles
FROM pax p
LEFT JOIN regions    r  ON r.user_id  = p.user_id
LEFT JOIN aos        a  ON a.user_id  = p.user_id
LEFT JOIN types      t  ON t.user_id  = p.user_id
LEFT JOIN event_tags g  ON g.user_id  = p.user_id
LEFT JOIN roles      ro ON ro.user_id = p.user_id
ORDER BY p.f3_name, p.user_id;
