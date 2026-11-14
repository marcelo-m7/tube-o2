# FACODI academic catalogue (Supabase only)

## Architectural boundary

- `public.videos` is the sole canonical video record; keep Tube video ingestion, thumbnails, counters, transcripts, and curation in `public`.
- `facodi.courses` and `facodi.curricular_units` own the academic catalogue.
- `facodi.unit_videos` maps a curricular unit directly to an existing `public.videos.id` (UUID foreign key). Reuse videos across courses by adding more links; do not clone video rows.
- `facodi.enrollments` and `facodi.video_progress` track learners, secured by per-user RLS.
- Supabase Auth remains in Supabase-managed `auth`. Editorial access uses the existing `facodi.is_facodi_editor()` RLS helper.
- **No FACODI-to-Odoo integration is required or called by the curriculum page.**

## Applied migrations (2026-11-14)

- `20261114140903_facodi_academic_catalog_and_public_video_links.sql`: added academic fields, copied 2 courses and 87 units from `public` (same UUIDs, left original rows intact), created 3 new tables and RLS.
- `20261114140944_facodi_remove_unused_odoo_schema.sql`: removed the 5 empty Odoo integration tables, 3 Odoo RPC functions, and Odoo-specific course/unit columns.

**Data quality:** all 87 legacy `public.units` rows are marked `metadata.source='mock_seed'`. Their FACODI copies are `draft` and `published=false`; do not present them as verified university curriculum. Verify source accuracy and rights before publishing. The original `public.courses` and `public.units` tables remain for legacy consumers.

**Do not delete** `public.videos`, `public.playlists`, `public.playlist_videos`, or any table needed by the Tube UI. The old public academic tables have foreign-key and view dependents, and should only be removed after all code paths are migrated and data checked.

## Application integration

The `/facodi/knowledge` page now reads through `src/entities/curriculum/curriculum.api.ts`: `supabase.schema('facodi')` for courses/units/video links, and `public.videos` for titles/links. Its existing React view uses numeric *presentation IDs*; those must never be stored as database IDs (canonical keys remain UUIDs).

The old `facodi-curriculum` Odoo Edge Function and historical runbooks remain in the repository, but the curriculum page no longer invokes that function. Retire the remote function only after confirming other clients do not depend on it. `/facodi` playlist and exhibition surfaces still use Tube's public playlist views, which is a separate video curation capability.

## Validation

After applying migrations, verify:

```sql
select count(*) from facodi.courses;          -- 2
select count(*) from facodi.curricular_units; -- 87
select count(*) from public.videos;           -- 794 at migration time
select count(*) from facodi.unit_videos;      -- 0 until curated
select count(*) from pg_tables
where schemaname='facodi' and tablename like 'odoo%'; -- 0
```

Check with three API roles: unauthenticated; authenticated learner; authenticated editor. Learners must not see private draft courses, another learner's enrolments/progress, or editor-only mappings. Editorial users should be able to read and manage unpublished catalogue entries. The absence of populated `unit_videos` means video associations have not yet been curated.

## Next controlled cleanup

1. Validate/replace the 87 `mock_seed` units before publication.
2. Map approved educational videos using `facodi.unit_videos` and build editorial controls.
3. Inventory clients still reading `public.courses`, `public.units`, and Odoo-era FACODI tables/functions. Migrate them before any further `DROP` operations.
4. Extend TypeScript schema types from Supabase's multi-schema generator; the current typed slice covers only the 3 FACODI tables read by the curriculum UI.
