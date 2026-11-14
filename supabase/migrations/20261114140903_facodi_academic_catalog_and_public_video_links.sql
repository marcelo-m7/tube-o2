-- FACODI academic records are in facodi, Tube video records remain in public.
-- Existing public academic tables are preserved for old clients during migration.
alter table facodi.courses
  add column if not exists institution text,
  add column if not exists ects_total numeric(7,2),
  add column if not exists duration_semesters smallint;

insert into facodi.courses
 (id,code,slug,title,normalized_title,summary,degree_type,language,school,
  institution,ects_total,duration_semesters,source_url,status,published,
  external_source,metadata,created_at,updated_at)
select c.id,c.code,lower(c.code),c.title,lower(c.title),c.description,
       c.degree_type,c.language_code,c.school,c.institution,c.ects_total,
       c.duration_semesters,c.website_url,'draft',false,'legacy_public',
       (coalesce(c.metadata,'{}'::jsonb)-'odoo_channel_name') ||
       jsonb_build_object('import_source','public.courses','source_quality','unverified_seed'),
       c.created_at,c.updated_at
from public.courses c on conflict(id) do nothing;

insert into facodi.curricular_units
 (id,course_id,code,slug,title,normalized_title,summary,description_html,
  year,semester,ects,position,language,source_url,plan_url,status,published,
  external_source,metadata,created_at,updated_at)
select u.id,u.course_id,u.code,lower(u.code),u.name,lower(u.name),u.summary,u.content,
       u.year,u.semester,u.ects,u.position,'pt',coalesce(u.source_url,u.website_url),
       u.syllabus_url,'draft',false,'legacy_public',
       (coalesce(u.metadata,'{}'::jsonb)-'odoo_unit_code') ||
       jsonb_build_object('import_source','public.units','source_quality','unverified_seed'),
       u.created_at,u.updated_at
from public.units u
where exists (select 1 from facodi.courses c where c.id=u.course_id)
on conflict(id) do nothing;

create table if not exists facodi.unit_videos (
 id uuid primary key default gen_random_uuid(),
 curricular_unit_id uuid not null references facodi.curricular_units(id) on delete cascade,
 video_id uuid not null references public.videos(id) on delete restrict,
 position integer not null default 0 check(position>=0),
 title_override text,
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(curricular_unit_id,video_id)
);
create index if not exists facodi_unit_videos_unit_position_idx
 on facodi.unit_videos(curricular_unit_id,position);

create table if not exists facodi.enrollments (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references facodi.courses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 enrolled_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(course_id,user_id)
);
create index if not exists facodi_enrollments_user_idx
 on facodi.enrollments(user_id);

create table if not exists facodi.video_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 unit_video_id uuid not null references facodi.unit_videos(id) on delete cascade,
 last_position_seconds integer not null default 0 check(last_position_seconds>=0),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,unit_video_id)
);

alter table facodi.unit_videos enable row level security;
alter table facodi.enrollments enable row level security;
alter table facodi.video_progress enable row level security;
revoke all on facodi.unit_videos,facodi.enrollments,facodi.video_progress from anon,authenticated;
grant select on facodi.unit_videos to anon;
grant select,insert,update,delete on facodi.unit_videos to authenticated;
grant select,insert,update on facodi.enrollments to authenticated;
grant select,insert,update,delete on facodi.video_progress to authenticated;

create policy "facodi_public_view_published_unit_videos" on facodi.unit_videos
for select to anon,authenticated using (
 exists(select 1 from facodi.curricular_units u
 join facodi.courses c on c.id=u.course_id
 where u.id=curricular_unit_id and u.published=true and u.status='active'
 and c.published=true and c.status='active')
);
create policy "facodi_editor_manage_unit_videos" on facodi.unit_videos
for all to authenticated
using((select facodi.is_facodi_editor()))
with check((select facodi.is_facodi_editor()));

create policy "facodi_user_read_own_enrollments" on facodi.enrollments
for select to authenticated using(user_id=(select auth.uid()));
create policy "facodi_user_enroll_published_courses" on facodi.enrollments
for insert to authenticated with check (
 user_id=(select auth.uid()) and status='active'
 and exists(select 1 from facodi.courses c
 where c.id=course_id and c.published=true and c.status='active')
);
create policy "facodi_user_update_own_enrollment" on facodi.enrollments
for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()));

create policy "facodi_user_read_own_video_progress" on facodi.video_progress
for select to authenticated using(user_id=(select auth.uid()));
create policy "facodi_user_insert_own_video_progress" on facodi.video_progress
for insert to authenticated with check (
 user_id=(select auth.uid())
 and exists(select 1 from facodi.unit_videos uv
 join facodi.curricular_units u on u.id=uv.curricular_unit_id
 join facodi.enrollments e on e.course_id=u.course_id
 and e.user_id=(select auth.uid()) and e.status='active'
 where uv.id=unit_video_id)
);
create policy "facodi_user_update_own_video_progress" on facodi.video_progress
for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()));
