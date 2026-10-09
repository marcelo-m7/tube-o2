import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { errorResponse, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkEdgeRateLimit } from '../_shared/rate-limit.ts';
import {
  buildAutoAssociationDecision,
  loadAssociationCategories,
  loadAssociationPlaylists,
  persistAutoAssociation,
} from '../_shared/association.ts';

type ImportVideoBody = {
  youtubeUrl?: unknown;
  submissionId?: unknown;
  idempotencyKey?: unknown;
};

type SubmissionRow = {
  id: string;
  user_id: string;
  video_id: string | null;
  youtube_id: string;
  youtube_url: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  channel_name: string;
  category_id: string | null;
  language: string | null;
};

const IMPORT_VIDEO_RATE_LIMIT_WINDOWS = [
  { windowSeconds: 60, maxRequests: 10 },
  { windowSeconds: 24 * 60 * 60, maxRequests: 100 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function canonicalYoutubeUrl(youtubeId: string) {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

function parseBody(payload: unknown) {
  if (!isRecord(payload)) return null;

  const youtubeUrl = typeof payload.youtubeUrl === 'string' ? payload.youtubeUrl.trim() : '';
  const submissionId = typeof payload.submissionId === 'string' ? payload.submissionId.trim() : '';
  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey.trim() : '';

  if (!youtubeUrl || !submissionId || !idempotencyKey) {
    return null;
  }

  return { youtubeUrl, submissionId, idempotencyKey };
}

function metadataIdempotencyKey(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata.idempotencyKey !== 'string') {
    return null;
  }

  return metadata.idempotencyKey;
}

async function upsertOrGetVideo(params: {
  supabase: ReturnType<typeof createClient>;
  youtubeId: string;
  submittedBy: string;
}) {
  const { supabase, youtubeId, submittedBy } = params;

  const { error: upsertError } = await supabase
    .from('videos')
    .upsert(
      {
        youtube_id: youtubeId,
        slug: `youtube-${youtubeId.toLowerCase()}`,
        title: youtubeId,
        description: null,
        channel_name: 'YouTube',
        duration_seconds: null,
        thumbnail_url: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        language: 'und',
        submitted_by: submittedBy,
        view_count: 0,
        is_featured: false,
      },
      { onConflict: 'youtube_id', ignoreDuplicates: true },
    );

  if (upsertError) {
    throw new Error(`Failed to upsert video: ${upsertError.message}`);
  }

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id, title, description, channel_name, category_id, language')
    .eq('youtube_id', youtubeId)
    .single();

  if (videoError || !video) {
    throw new Error(`Failed to load video after upsert: ${videoError?.message ?? 'not found'}`);
  }

  return video as VideoRow;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed', { requestId });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(req, 500, 'MISSING_SUPABASE_ENV', 'Missing Supabase environment variables', { requestId });
  }

  const { user, error: authError } = await getAuthenticatedUser(req, supabaseUrl, anonKey);
  if (!user) {
    if (authError) console.warn(`[import-video] ${requestId} auth failed: ${authError}`);
    return errorResponse(req, 401, 'UNAUTHORIZED', 'Invalid or expired authorization token', { requestId });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const rateLimit = await checkEdgeRateLimit(supabase, {
      functionName: 'import-video',
      userId: user.id,
      windows: IMPORT_VIDEO_RATE_LIMIT_WINDOWS,
    });

    if (!rateLimit.allowed) {
      return errorResponse(req, 429, 'RATE_LIMITED', 'Too many video imports. Try again later.', {
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }
  } catch (error) {
    console.error(`[import-video] ${requestId} rate-limit check failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return errorResponse(req, 500, 'RATE_LIMIT_CHECK_FAILED', 'Could not start video import', { requestId });
  }

  let parsedBody: { youtubeUrl: string; submissionId: string; idempotencyKey: string } | null = null;
  try {
    parsedBody = parseBody(await req.json());
  } catch {
    return errorResponse(req, 400, 'INVALID_JSON', 'Invalid JSON body', { requestId });
  }

  if (!parsedBody) {
    return errorResponse(req, 400, 'INVALID_PAYLOAD', 'youtubeUrl, submissionId and idempotencyKey are required', { requestId });
  }

  const youtubeId = extractYouTubeId(parsedBody.youtubeUrl);
  if (!youtubeId) {
    return errorResponse(req, 400, 'INVALID_YOUTUBE_URL', 'youtubeUrl must be a valid YouTube video URL', { requestId });
  }

  const youtubeUrl = canonicalYoutubeUrl(youtubeId);

  const { data: existingById, error: existingByIdError } = await supabase
    .from('video_submissions')
    .select('id, user_id, video_id, youtube_id, youtube_url, status, metadata')
    .eq('id', parsedBody.submissionId)
    .maybeSingle();

  if (existingByIdError) {
    return errorResponse(req, 500, 'SUBMISSION_LOOKUP_FAILED', 'Could not check submission id', {
      requestId,
      details: existingByIdError.message,
    });
  }

  let submission = existingById as SubmissionRow | null;
  if (submission && submission.user_id !== user.id) {
    return errorResponse(req, 403, 'SUBMISSION_FORBIDDEN', 'Submission does not belong to authenticated user', { requestId });
  }

  if (submission && submission.youtube_id !== youtubeId) {
    return errorResponse(req, 409, 'YOUTUBE_ID_MISMATCH', 'Submission exists with different YouTube video', { requestId });
  }

  const { data: existingByYoutube, error: existingByYoutubeError } = await supabase
    .from('video_submissions')
    .select('id, user_id, video_id, youtube_id, youtube_url, status, metadata')
    .eq('user_id', user.id)
    .eq('youtube_id', youtubeId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (existingByYoutubeError) {
    return errorResponse(req, 500, 'SUBMISSION_LOOKUP_FAILED', 'Could not check existing imports', {
      requestId,
      details: existingByYoutubeError.message,
    });
  }

  const idemSubmission = (existingByYoutube ?? []).find((item) => {
    const metadata = isRecord(item.metadata) ? item.metadata : null;
    return metadataIdempotencyKey(metadata) === parsedBody?.idempotencyKey;
  }) as SubmissionRow | undefined;

  if (!submission && idemSubmission) {
    submission = idemSubmission;
  }

  const video = await upsertOrGetVideo({
    supabase,
    youtubeId,
    submittedBy: user.id,
  });

  if (!submission) {
    const { data: createdSubmission, error: createSubmissionError } = await supabase
      .from('video_submissions')
      .insert({
        id: parsedBody.submissionId,
        user_id: user.id,
        video_id: video.id,
        youtube_id: youtubeId,
        youtube_url: youtubeUrl,
        status: 'pending',
        metadata: {
          source: 'import_video',
          requestId,
          idempotencyKey: parsedBody.idempotencyKey,
          stage: 'queued',
          queuedAt: new Date().toISOString(),
        },
      })
      .select('id, user_id, video_id, youtube_id, youtube_url, status, metadata')
      .single();

    if (createSubmissionError) {
      const { data: racedSubmission } = await supabase
        .from('video_submissions')
        .select('id, user_id, video_id, youtube_id, youtube_url, status, metadata')
        .eq('id', parsedBody.submissionId)
        .maybeSingle();

      if (!racedSubmission) {
        return errorResponse(req, 500, 'SUBMISSION_CREATE_FAILED', 'Could not create submission', {
          requestId,
          details: createSubmissionError.message,
        });
      }

      submission = racedSubmission as SubmissionRow;
    } else {
      submission = createdSubmission as SubmissionRow;
    }
  }

  if (submission.video_id !== video.id) {
    const metadata = isRecord(submission.metadata) ? submission.metadata : {};
    const { data: updatedSubmission, error: submissionUpdateError } = await supabase
      .from('video_submissions')
      .update({
        video_id: video.id,
        youtube_url: youtubeUrl,
        metadata: {
          ...metadata,
          source: metadata.source ?? 'import_video',
          requestId,
          idempotencyKey: parsedBody.idempotencyKey,
          stage: 'queued',
          queuedAt: new Date().toISOString(),
        },
      })
      .eq('id', submission.id)
      .select('id, user_id, video_id, youtube_id, youtube_url, status, metadata')
      .single();

    if (submissionUpdateError) {
      return errorResponse(req, 500, 'SUBMISSION_UPDATE_FAILED', 'Could not update submission', {
        requestId,
        details: submissionUpdateError.message,
      });
    }

    submission = updatedSubmission as SubmissionRow;
  }

  let association = {
    assignedCategoryId: null as string | null,
    assignedPlaylistIds: [] as string[],
    confidence: 'low' as 'high' | 'low',
    fallbackUsed: true,
    reasons: [] as string[],
  };

  // An ID-only import is not evidence of any educational category.
  const metadataPending = video.title.trim().toLowerCase() === youtubeId.toLowerCase()
    && !video.description?.trim()
    && (!video.channel_name?.trim() || video.channel_name.trim().toLowerCase() === 'youtube');

  if (metadataPending) {
    const { data: uncategorized, error: categoryLookupError } = await supabase
      .from('categories').select('id').eq('slug', 'nao-classificados').maybeSingle();
    if (categoryLookupError) {
      console.warn('[import-video] Pending category unavailable:', categoryLookupError.message);
    }
    if (uncategorized?.id && !video.category_id) {
      const { error: categoryWriteError } = await supabase.from('videos')
        .update({ category_id: uncategorized.id })
        .eq('id', video.id).is('category_id', null);
      if (categoryWriteError) {
        console.warn('[import-video] Pending category assignment failed:', categoryWriteError.message);
      }
    }
    association.assignedCategoryId = video.category_id ?? uncategorized?.id ?? null;
    association.reasons = ['metadata_pending: await verified video content'];
  } else {
  try {
    const categories = await loadAssociationCategories(supabase);
    const playlists = await loadAssociationPlaylists(
      supabase,
      video.language ?? 'pt',
      video.description ?? video.title,
    );

    const decision = buildAutoAssociationDecision({
      videoId: video.id,
      categories,
      playlists,
      analysis: {
        title: video.title,
        description: video.description,
        channelName: video.channel_name,
        semanticTags: [],
        summaryDescription: null,
        shortSummary: null,
        language: video.language ?? 'pt',
        currentCategoryId: video.category_id,
      },
    });

    await persistAutoAssociation({
      supabaseServiceRole: supabase,
      videoId: video.id,
      userId: user.id,
      decision,
      currentCategoryId: video.category_id,
    });

    association = {
      assignedCategoryId: decision.assignedCategoryId,
      assignedPlaylistIds: decision.assignedPlaylistIds,
      confidence: decision.confidence,
      fallbackUsed: decision.fallbackUsed,
      reasons: decision.reasons,
    };
  } catch (associationError) {
    const errorMessage = associationError instanceof Error ? associationError.message : 'Association failed';
    association = {
      ...association,
      reasons: [`association_error:${errorMessage}`],
    };
  }

  }

  return jsonResponse(req, {
    status: 'processing',
    videoId: video.id,
    submissionId: submission.id,
    requestId,
    association,
  });
});