import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaylistCard } from '@/components/playlist/PlaylistCard';
import { VideoDurationBadge } from '@/components/video/VideoDurationBadge';
import { getVideoRoute } from '@/entities/video/video.routes';
import { useAuth } from '@/features/auth/useAuth';
import { useVideoAnalysisJobs } from '@/features/video-analysis/useVideoAnalysisJob';
import { usePlaylists } from '@/features/playlists/queries/usePlaylists';
import { useIsEditor } from '@/features/profile/queries/useProfile';
import { getReliableYouTubeThumbnailUrl } from '@/shared/lib/youtube';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ListVideo, Plus, Search, RefreshCw } from 'lucide-react';

const EditorialPortal = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isEditor, isLoading: roleLoading } = useIsEditor();
  const { data: playlists, isLoading: playlistsLoading, isError } = usePlaylists();
  const { data: analysisJobs, isLoading: analysisJobsLoading } = useVideoAnalysisJobs({ limit: 6 });
  const [query, setQuery] = useState('');
  type RecoveryItem = {
    youtube_id: string;
    status: string;
    patch?: { title?: string; channel_name?: string };
    updated?: { title?: string; channel_name?: string } | null;
    reason?: string;
  };
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryResults, setRecoveryResults] = useState<RecoveryItem[] | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryPreviewed, setRecoveryPreviewed] = useState(false);

  const runMetadataRecovery = async (dryRun: boolean) => {
    if (recoveryBusy) return;
    if (!dryRun && !recoveryPreviewed) {
      setRecoveryError('Execute primeiro a simulação para verificar os metadados.');
      return;
    }
    setRecoveryBusy(true);
    setRecoveryError(null);
    setRecoveryResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('recover-video-metadata', {
        body: { dry_run: dryRun, limit: 5 },
      });
      if (error) throw error;
      if (!data || !Array.isArray(data.results)) {
        throw new Error('Resposta inesperada do serviço de recuperação.');
      }
      setRecoveryResults(data.results as RecoveryItem[]);
      if (dryRun) setRecoveryPreviewed(true);
      else setRecoveryPreviewed(false);
    } catch (error) {
      setRecoveryPreviewed(false);
      setRecoveryError(error instanceof Error ? error.message : 'Não foi possível recuperar os metadados.');
    } finally {
      setRecoveryBusy(false);
    }
  };


  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  const facodiPlaylists = useMemo(() => {
    const all = playlists || [];
    const filteredByCode = all.filter((playlist) => playlist.course_code || playlist.unit_code);

    if (!query.trim()) return filteredByCode;

    const normalized = query.toLowerCase();
    return filteredByCode.filter((playlist) =>
      [playlist.name, playlist.description || '', playlist.course_code || '', playlist.unit_code || '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [playlists, query]);

  const pendingAnalysisCount = useMemo(
    () => (analysisJobs || []).filter((job) => ['pending', 'processing', 'recoverable_error'].includes(job.status)).length,
    [analysisJobs],
  );

  if (authLoading || roleLoading || playlistsLoading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-10 w-72 mb-4" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!isEditor) {
    return (
      <MainLayout>
        <div className="container py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">{t('editorialPortal.noAccessTitle')}</h1>
          <p className="text-muted-foreground mb-8">{t('editorialPortal.noAccessDescription')}</p>
          <Button onClick={() => navigate('/playlists')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('playlistDetails.backToPlaylists')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('editorialPortal.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('editorialPortal.description')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('editorialPortal.searchPlaceholder')}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => navigate('/editor/applications')}>
              {t('editorApplications.adminPage.title')}
            </Button>
            <Button onClick={() => navigate('/playlists/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('playlists.createPlaylist')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{t('editorialPortal.stats.editableTotal')}</p>
            <p className="text-2xl font-bold mt-1">{playlists?.length || 0}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{t('editorialPortal.stats.facodiTotal')}</p>
            <p className="text-2xl font-bold mt-1">{facodiPlaylists.length}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{t('editorialPortal.stats.withUnitCode')}</p>
            <p className="text-2xl font-bold mt-1">{facodiPlaylists.filter((p) => !!p.unit_code).length}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{t('editorialPortal.stats.analysisQueue')}</p>
            <p className="text-2xl font-bold mt-1">{pendingAnalysisCount}</p>
          </div>
        </div>

        <section aria-labelledby="metadata-recovery-heading" className="border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <h2 id="metadata-recovery-heading" className="text-xl font-bold">Recuperar metadados do YouTube</h2>
            <p className="text-sm text-muted-foreground">
              Recupera títulos e canais originais para vídeos com informações provisórias.
              Preserva alterações manuais. Executa até cinco vídeos por lote.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={recoveryBusy}
              onClick={() => void runMetadataRecovery(true)}>
              {recoveryBusy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simular lote
            </Button>
            <Button type="button" disabled={recoveryBusy || !recoveryPreviewed}
              onClick={() => void runMetadataRecovery(false)}>
              {recoveryBusy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Aplicar recuperação
            </Button>
          </div>
          {recoveryError && <p role="alert" className="text-sm text-destructive">{recoveryError}</p>}
          {recoveryResults && (
            <div aria-live="polite" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {recoveryResults.length} vídeo(s) verificado(s).
                {recoveryPreviewed ? ' Pré-visualização: nenhuma alteração aplicada.' : ' Operação concluída.'}
              </p>
              {recoveryResults.length === 0 && <p className="text-sm text-muted-foreground">Não foram encontrados vídeos elegíveis neste lote.</p>}
              {recoveryResults.map((item) => (
                <div key={item.youtube_id} className="flex flex-wrap items-center gap-2 border border-border p-2 text-sm">
                  <span className="font-mono">{item.youtube_id}</span>
                  <Badge variant="outline">{item.status}</Badge>
                  <span className="break-words">{item.patch?.title ?? item.updated?.title ?? item.reason ?? ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{t('editorialPortal.analysisQueue.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('editorialPortal.analysisQueue.description')}</p>
            </div>
          </div>
          {analysisJobsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : analysisJobs && analysisJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysisJobs.map((job) => (
                <div key={job.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    {job.video?.thumbnail_url ? (
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                        <img
                            src={getReliableYouTubeThumbnailUrl(job.video.thumbnail_url, '/placeholder.svg')}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <VideoDurationBadge durationSeconds={job.video.duration_seconds} className="bottom-1 right-1 min-w-9 px-1.5 py-0.5 text-[0.6rem]" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {t(`submitStatus.deepAnalysis.statusLabels.${job.status}`, { defaultValue: job.status })}
                        </Badge>
                        <Badge variant="outline">{job.provider}</Badge>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">
                        {job.video?.title || t('editorialPortal.analysisQueue.unknownVideo')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.video?.category?.name || t('common.none')}
                      </p>
                    </div>
                  </div>
                  {job.video_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate(job.video ? getVideoRoute(job.video) : `/videos/${job.video_id}`)}
                    >
                      {t('editorialPortal.analysisQueue.reviewVideo')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              {t('editorialPortal.analysisQueue.empty')}
            </div>
          )}
        </section>

        {isError ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">{t('playlists.loadingErrorTitle')}</p>
            <p>{t('playlists.loadingErrorDescription')}</p>
          </div>
        ) : facodiPlaylists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {facodiPlaylists.map((playlist, index) => (
              <PlaylistCard key={playlist.id} playlist={playlist} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <ListVideo className="w-16 h-16 mb-4 opacity-50 mx-auto" />
            <p className="text-lg font-medium mb-2">{t('editorialPortal.emptyTitle')}</p>
            <p className="mb-6">{t('editorialPortal.emptyDescription')}</p>
            <Button onClick={() => navigate('/playlists/new')}>{t('playlists.createFirstPlaylist')}</Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default EditorialPortal;
