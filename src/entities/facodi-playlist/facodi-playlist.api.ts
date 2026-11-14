import { supabase } from '@/shared/api/supabase/supabaseClient';
import { getEdgeFunctionErrorDetails, invokeEdgeFunction } from '@/shared/api/supabase/edgeFunctions';

export interface FacodiPlaylistSubmission {
  playlist_id: string;
  title: string;
  course_id: string;
  curricular_unit_id: string;
  review_status: string;
  import_status: string;
  playlist_video_count: number;
  linked_video_count: number;
  missing_video_count: number;
  reused_video_count: number;
  new_video_import_attempts: number;
  youtube_playlist_url: string;
}

export interface FacodiPlaylistSubmitInput {
  courseId: string;
  unitId: string;
  playlistUrl: string;
  title?: string;
  description?: string;
  language?: string;
  maxVideos?: number;
}

export async function listFacodiAcademicCourses() {
  const { data, error } = await supabase.schema('facodi').from('courses')
    .select('id,code,title,status,published').order('title');
  if (error) throw error;
  return data || [];
}

export async function listFacodiCourseUnits(courseId: string) {
  const { data, error } = await supabase.schema('facodi').from('curricular_units')
    .select('id,course_id,code,title,year,semester,status,published')
    .eq('course_id', courseId).order('year').order('semester').order('title');
  if (error) throw error;
  return data || [];
}

export async function submitFacodiPlaylist(input: FacodiPlaylistSubmitInput) {
  const { data, error } = await invokeEdgeFunction<FacodiPlaylistSubmission>(
    'facodi-submit-playlist', {
      body: {
        course_id: input.courseId,
        curricular_unit_id: input.unitId,
        playlist_url: input.playlistUrl,
        title: input.title || undefined,
        description: input.description || undefined,
        language: input.language || 'pt',
        max_videos: input.maxVideos ?? 50,
      },
    },
  );
  if (error) {
    const details = await getEdgeFunctionErrorDetails(error);
    throw new Error(details.message);
  }
  if (!data?.playlist_id) throw new Error('Playlist submission returned no ID');
  return data;
}

export async function listPendingFacodiPlaylists() {
  const { data, error } = await supabase.schema('facodi').from('playlists')
    .select('id,title,course_id,curricular_unit_id,submitted_by,source_url,import_status,submitted_at,status')
    .eq('status', 'pending').order('submitted_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getFacodiPlaylistItems(playlistId: string) {
  const { data, error } = await supabase.schema('facodi').from('playlist_items')
    .select('id,playlist_id,video_id,youtube_video_id,position,review_status')
    .eq('playlist_id', playlistId).order('position');
  if (error) throw error;
  const items = data || [];
  const ids = items.map((item) => item.video_id).filter((id): id is string => !!id);
  const { data: videos, error: videoError } = ids.length
    ? await supabase.from('videos')
      .select('id,title,thumbnail_url,youtube_id').in('id', ids)
    : { data: [], error: null };
  if (videoError) throw videoError;
  const videoMap = new Map((videos || []).map((v) => [v.id, v]));
  return items.map((item) => ({
    ...item,
    video: item.video_id ? videoMap.get(item.video_id) ?? null : null,
  }));
}

export async function reviewFacodiPlaylist(
  playlistId: string, decision: 'approved' | 'rejected', note?: string,
) {
  const { data, error } = await supabase.schema('facodi').rpc('review_playlist', {
    p_playlist_id: playlistId,
    p_decision: decision,
    p_review_note: note || null,
  });
  if (error) throw error;
  return data;
}
