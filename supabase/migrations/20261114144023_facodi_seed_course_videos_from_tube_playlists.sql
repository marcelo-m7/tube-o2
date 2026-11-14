-- Populate FACODI educational units from existing Tube playlist/video relationships.
-- No new videos are created; public.videos remains canonical.
-- Original playlists are curation candidates, NOT approved curriculum.
-- LDC playlist code maps to academic course LDCOM.
-- Idempotent: repeat executions do not overwrite reviewed links.

alter policy facodi_public_view_published_unit_videos on facodi.unit_videos
using (
  (metadata ->> 'review_status') = 'approved'
  and exists (
    select 1 from facodi.curricular_units u
    join facodi.courses c on c.id = u.course_id
    where u.id = curricular_unit_id
      and u.published is true and u.status = 'active'
      and c.published is true and c.status = 'active'
  )
);

with candidates as (
  select distinct on (u.id, pv.video_id)
    u.id as curricular_unit_id,
    pv.video_id,
    p.id as source_playlist_id,
    p.course_code as source_course_code,
    p.unit_code as source_unit_code,
    pv.id as source_link_id,
    pv.position as source_position,
    pv.created_at as source_created_at
  from public.playlists p
  join facodi.courses c
    on c.code = case when p.course_code = 'LDC' then 'LDCOM' else p.course_code end
  join facodi.curricular_units u
    on u.course_id = c.id and u.code = p.unit_code
  join public.playlist_videos pv on pv.playlist_id = p.id
  where p.is_public is true
  order by u.id, pv.video_id, pv.position nulls last, pv.id
), ranked as (
  select *,
    (row_number() over (
      partition by curricular_unit_id
      order by source_position nulls last, source_created_at nulls last, source_link_id
    ) - 1)::integer as target_position
  from candidates
)
insert into facodi.unit_videos
  (curricular_unit_id, video_id, position, metadata)
select
  curricular_unit_id, video_id, target_position,
  jsonb_build_object(
    'source', 'public.playlist_videos',
    'source_playlist_id', source_playlist_id,
    'source_link_id', source_link_id,
    'source_course_code', source_course_code,
    'source_unit_code', source_unit_code,
    'review_status', 'pending_review',
    'import_strategy', 'existing_public_playlist_mapping'
  )
from ranked
on conflict (curricular_unit_id, video_id) do nothing;
