import { supabase } from '@/shared/api/supabase/supabaseClient';
import type { CurriculumSnapshot } from './curriculum.types';

/**
 * FACODI academic data is maintained in the facodi schema.
 * Learning videos remain canonical in public.videos.
 * No Odoo service or Edge Function is used by this curriculum reader.
 */
export async function getFacodiCurriculum(): Promise<CurriculumSnapshot> {
  const facodi = supabase.schema('facodi');

  const [coursesResult, unitsResult, linksResult] = await Promise.all([
    facodi.from('courses')
      .select('id,code,title,institution,source_url,status,published')
      .order('code', { ascending: true }),
    facodi.from('curricular_units')
      .select('id,course_id,code,title,year,semester,ects,position,status,published')
      .order('course_id', { ascending: true })
      .order('year', { ascending: true })
      .order('semester', { ascending: true })
      .order('position', { ascending: true }),
    facodi.from('unit_videos')
      .select('id,curricular_unit_id,video_id')
      .order('position', { ascending: true }),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (unitsResult.error) throw unitsResult.error;
  if (linksResult.error) throw linksResult.error;

  const rows = coursesResult.data ?? [];
  const units = unitsResult.data ?? [];
  const links = linksResult.data ?? [];

  // The existing atlas view uses small numeric presentation IDs.
  // Keep UUIDs as the canonical database identifiers.
  const referenceIds = new Map(rows.map((row, index) => [row.id, index + 1]));
  const unitIds = new Map(units.map((row, index) => [row.id, index + 1]));

  const videoIds = [...new Set(links.map((link) => link.video_id))];
  const videoResult = videoIds.length
    ? await supabase.from('videos').select('id,title').in('id', videoIds)
    : null;
  if (videoResult?.error) throw videoResult.error;

  const videos = videoResult?.data ?? [];
  const videoPresentationIds = new Map(videos.map((video, index) => [video.id, index + 1]));

  return {
    references: rows.map((row, index) => ({
      id: index + 1,
      institution: row.institution ?? 'FACODI',
      programme: row.title,
      year: '',
      code: row.code ?? '',
      sourceUrl: row.source_url,
    })),
    units: units.flatMap((unit) => {
      const referenceId = referenceIds.get(unit.course_id);
      if (!referenceId) return [];
      return [{
        id: unitIds.get(unit.id)!,
        referenceId,
        name: unit.title,
        code: unit.code ?? '',
        year: unit.year ?? 1,
        period: unit.semester == null ? '' : String(unit.semester),
        credits: Number(unit.ects ?? 0),
      }];
    }),
    courses: videos.map((video) => ({
      id: videoPresentationIds.get(video.id)!,
      name: video.title,
      url: `/videos/${video.id}`,
    })),
    coverage: links.flatMap((link) => {
      const unitId = unitIds.get(link.curricular_unit_id);
      const courseId = videoPresentationIds.get(link.video_id);
      if (!unitId || !courseId) return [];
      return [{
        unitId,
        courseId,
        coverageType: 'covers' as const,
        confidence: 1,
      }];
    }),
  };
}
