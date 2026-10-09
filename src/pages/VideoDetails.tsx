import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useDeleteVideo, useUpdateVideo, useVideoById, useRelatedVideos } from '@/features/videos/queries/useVideos';
import { useCategories } from '@/features/categories/queries/useCategories';
import { useLatestVideoAnalysisJob } from '@/features/video-analysis/useVideoAnalysisJob';
import { formatDuration, formatViewCount } from '@/shared/lib/format';
import { useAuth } from '@/features/auth/useAuth';
import { useIsFavorited, useAddFavorite, useRemoveFavorite } from '@/features/favorites/queries/useFavorites';
import { useProfileById } from '@/features/profile/queries/useProfile';
import { getYouTubeEmbedUrl } from '@/shared/lib/youtube';
import { useMetaTags } from '@/shared/hooks/useMetaTags';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VideoCard } from '@/components/video/VideoCard';
import { getVideoRoute } from '@/entities/video/video.routes';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge'; // Import Badge component
import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock3, FileText, Sparkles } from 'lucide-react';
import { CulturalRelevanceBadge } from '@/components/video/CulturalRelevanceBadge';
import { SemanticTagBadge } from '@/components/video/SemanticTagBadge';
import { Eye, Clock, Folder, ArrowLeft, Heart as HeartIcon, Loader2, Edit, Trash2, Languages, ListVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { notify } from '@/shared/lib/notify';
import { useTranslation } from 'react-i18next';
import { CommentsSection } from '@/components/comment/CommentsSection'; // Import CommentsSection

function getLanguageLabelKey(language?: string | null) {
  if (!language || language === 'und') {
    return 'videoDetails.detectingLanguage';
  }

  if (['pt', 'en', 'es', 'fr', 'other'].includes(language)) {
    return `common.language.${language}`;
  }

  return null;
}

const VideoDetails = () => {
  const { t } = useTranslation();
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: video, isLoading, isError } = useVideoById(videoId);
  const { data: analysisJob } = useLatestVideoAnalysisJob({ videoId: video?.id });
  const { data: categories } = useCategories();
  const { data: profile } = useProfileById(video?.submitted_by);
  const { data: relatedVideos, isLoading: relatedLoading } = useRelatedVideos(
    video?.id || '', 
    video?.category_id || null
  );

  const { data: isFavorited, isLoading: isFavoritedLoading } = useIsFavorited(video?.id);
  const addFavoriteMutation = useAddFavorite();
  const removeFavoriteMutation = useRemoveFavorite();
  const updateVideoMutation = useUpdateVideo();
  const deleteVideoMutation = useDeleteVideo();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('none');
  const [editLanguage, setEditLanguage] = useState('pt');

  useEffect(() => {
    if (!video || !videoId || !video.slug || videoId === video.slug) return;

    navigate(`${getVideoRoute(video)}${location.search}`, { replace: true });
  }, [location.search, navigate, video, videoId]);

  const trimDescription = (text?: string | null, maxLength = 160) => {
    const value = (text ?? '').trim();
    if (!value) return '';
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
  };

  const metaDescription =
    video?.enrichment?.short_summary?.trim() ||
    trimDescription(video?.description) ||
    t('videoDetails.metaFallbackDescription');

  const metaTitle = video?.title
    ? `${video.title.trim()} | Tube O2`
    : 'Tube O2';

  // Set dynamic meta tags for social media sharing
  useMetaTags({
    title: metaTitle,
    description: metaDescription,
    image: video?.thumbnail_url || 'https://tube.open2.tech/opengraph-image-tube-o2.png',
    type: 'video.other',
    siteName: 'Tube O2',
    twitterImageAlt: video?.title || t('videoDetails.metaImageAlt'),
    imageWidth: 1280,
    imageHeight: 720,
    imageType: 'image/jpeg',
  });

  const handleFavoriteToggle = async () => {
    if (!user) {
      notify.info(t('videoDetails.favoriteInfo'), {
        action: {
          label: t('videoDetails.loginAction'),
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    if (!video?.id) return;

    if (isFavorited) {
      await removeFavoriteMutation.mutateAsync(video.id);
    } else {
      await addFavoriteMutation.mutateAsync(video.id);
    }
  };

  const isOwner = !!user && !!video?.submitted_by && video.submitted_by === user.id;
  const isLegacyFastSummary = video?.enrichment?.cultural_relevance === 'Curadoria rapida sem analise externa';
  const summarySourceKey = analysisJob?.status === 'completed'
    ? 'videoDetails.summarySource.deep'
    : isLegacyFastSummary
      ? 'videoDetails.summarySource.fast'
      : 'videoDetails.summarySource.editorial';

  const openEditDialog = () => {
    if (!video) return;
    setEditTitle(video.title);
    setEditDescription(video.description || '');
    setEditCategoryId(video.category_id || 'none');
    setEditLanguage(video.language && video.language !== 'und' ? video.language : video.enrichment?.language || 'pt');
    setEditDialogOpen(true);
  };

  const handleUpdateVideo = async () => {
    if (!video || !editTitle.trim()) return;

    await updateVideoMutation.mutateAsync({
      id: video.id,
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      category_id: editCategoryId === 'none' ? null : editCategoryId,
      language: editLanguage,
    });
    setEditDialogOpen(false);
  };

  const handleDeleteVideo = async () => {
    if (!video) return;
    await deleteVideoMutation.mutateAsync(video.id);
    navigate('/videos');
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <Skeleton className="h-10 w-48 mb-6" /> {/* Added skeleton for back button */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-xl font-bold">{t('videoDetails.relatedVideosTitle')}</h2>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="w-24 h-16 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !video) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">{t('videoDetails.videoNotFoundTitle')}</h1>
          <p className="text-muted-foreground mb-8">
            {t('videoDetails.videoNotFoundDescription')}
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.backToHome')}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const languageLabelKey = getLanguageLabelKey(video.language);
  const languageLabel = languageLabelKey ? t(languageLabelKey) : video.language;
  const hasDetectedLanguage = !!video.enrichment?.language && video.enrichment.language === video.language && video.language !== 'und';
  const assignedPlaylists = [...(video.assignedPlaylists ?? [])].sort((left, right) => {
    const leftIsLearningPath = left.is_ordered || !!left.course_code || !!left.unit_code;
    const rightIsLearningPath = right.is_ordered || !!right.course_code || !!right.unit_code;
    if (leftIsLearningPath !== rightIsLearningPath) {
      return leftIsLearningPath ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)} // Navigates back to the previous page
          className="text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Video Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <AspectRatio ratio={16 / 9} className="overflow-hidden border-2 border-border bg-muted shadow-[10px_10px_0_#000]">
              <iframe
                className="w-full h-full"
                src={getYouTubeEmbedUrl(video.youtube_id)}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </AspectRatio>

            {/* Video Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{video.title}</h1>
                <div className="flex shrink-0 items-center gap-1">
                  {isOwner && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={openEditDialog}
                        disabled={updateVideoMutation.isPending || deleteVideoMutation.isPending}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t('videoDetails.management.editVideo')}
                      >
                        <Edit className="w-5 h-5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deleteVideoMutation.isPending}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={t('videoDetails.management.deleteVideo')}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('videoDetails.management.confirmDeleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('videoDetails.management.confirmDeleteDescription', { title: video.title })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteVideo} disabled={deleteVideoMutation.isPending}>
                              {deleteVideoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              {t('common.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFavoriteToggle}
                    disabled={isFavoritedLoading || addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {isFavoritedLoading || addFavoriteMutation.isPending || removeFavoriteMutation.isPending ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <HeartIcon className={`w-6 h-6 ${isFavorited ? 'fill-primary text-primary' : ''}`} />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-lg text-muted-foreground">{video.channel_name}</p>
              <p className="text-sm text-muted-foreground">
                {t('videoDetails.addedBy')}{' '}
                {profile?.username ? (
                  <Link to={`/profile/${profile.username}`} className="text-primary hover:underline">
                    @{profile.username}
                  </Link>
                ) : (
                  t('videoDetails.anonymousAuthor')
                )}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{formatViewCount(video.view_count)} {t('videoDetails.viewsLabel')}</span>
                </div>
                {video.duration_seconds && video.duration_seconds > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(video.duration_seconds)}</span>
                  </div>
                )}
                {(!video.duration_seconds || video.duration_seconds <= 0) && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{t('videoDetails.durationProcessing')}</span>
                  </div>
                )}
                {video.category && (
                  <Badge 
                    variant="outline" 
                    className="text-sm px-2.5 py-1 flex items-center gap-1"
                    style={{ borderColor: video.category.color, color: video.category.color }}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {video.category.name}
                  </Badge>
                )}
                {video.language && (
                  <Badge variant="outline" className="text-sm px-2.5 py-1 flex items-center gap-1">
                    <Languages className="w-3.5 h-3.5" />
                    <span>{t('videoDetails.languageLabel')}: {languageLabel}</span>
                    {hasDetectedLanguage && (
                      <span className="text-muted-foreground">({t('videoDetails.detectedAutomatically')})</span>
                    )}
                  </Badge>
                )}
              </div>
              {assignedPlaylists.length > 0 && (
                <section aria-labelledby="assigned-playlists-heading" className="border-2 border-border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <ListVideo className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h2 id="assigned-playlists-heading" className="text-sm font-semibold">
                        {t('videoDetails.assignedPlaylistsTitle')}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('videoDetails.assignedPlaylistsDescription')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignedPlaylists.map((playlist) => {
                      const isLearningPath = playlist.is_ordered || !!playlist.course_code || !!playlist.unit_code;
                      return (
                        <Link key={playlist.id} to={`/playlists/${playlist.id}`}>
                          <Badge
                            variant="outline"
                            className="max-w-full gap-1.5 px-2.5 py-1 text-sm hover:bg-muted"
                          >
                            <span className="truncate">{playlist.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {isLearningPath ? t('playlists.learningPath') : t('playlists.collection')}
                            </span>
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Description */}
            <div className="border-t border-border/50 pt-6 mt-6">
              <h2 className="text-xl font-bold mb-3">{t('videoDetails.descriptionTitle')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {video.description || t('videoDetails.noDescription')}
              </p>
            </div>

              {/* AI-generated summary */}
              {video.enrichment && (
                <Card className="border-2 border-primary/30 bg-card p-6">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary p-2 flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{t('videoDetails.aiSummaryTitle')}</h3>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Badge variant="secondary" className="gap-1.5 bg-muted text-foreground border-border">
                            {analysisJob?.status === 'completed' ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Clock3 className="h-3 w-3" />
                            )}
                            {t(summarySourceKey)}
                          </Badge>
                          <CulturalRelevanceBadge relevance={video.enrichment.cultural_relevance} />
                        </div>
                      </div>
                      {analysisJob?.status && (
                        <p className="text-xs text-muted-foreground">
                          {t('videoDetails.deepAnalysisStatus')}: {t(`submitStatus.deepAnalysis.statusLabels.${analysisJob.status}`, { defaultValue: analysisJob.status })}
                        </p>
                      )}
                    
                      {video.enrichment.short_summary && (
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {video.enrichment.short_summary}
                        </p>
                      )}
                    
                      {video.enrichment.summary_description && video.enrichment.summary_description !== video.enrichment.short_summary && (
                        <details className="group">
                          <summary className="text-sm font-semibold text-foreground underline underline-offset-4 cursor-pointer hover:text-foreground/80">
                            {t('videoDetails.readFullSummary')}
                          </summary>
                          <p className="text-sm text-foreground/90 mt-2 leading-relaxed">
                            {video.enrichment.summary_description}
                          </p>
                        </details>
                      )}
                    
                      {video.enrichment.semantic_tags && video.enrichment.semantic_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {video.enrichment.semantic_tags.map((tag, index) => (
                            <SemanticTagBadge key={`${tag}-${index}`} tag={tag} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {video.transcriptStatus === 'completed' && video.transcriptSummary && (
                <Card className="border-2 border-border bg-card p-6">
                  <div className="flex items-start gap-3">
                    <div className="bg-muted p-2 flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-lg font-semibold">{t('videoDetails.transcriptSummaryTitle')}</h3>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {video.transcriptSummary}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

            {/* Comments Section */}
            {video.id && (
              <div className="border-t border-border/50 pt-6 mt-6">
                <CommentsSection videoId={video.id} />
              </div>
            )}
          </div>

          {/* Related Videos Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-bold">{t('videoDetails.relatedVideosTitle')}</h2>
            {relatedLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="w-24 h-16 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : relatedVideos && relatedVideos.length > 0 ? (
              <div className="space-y-4">
                {relatedVideos.map((relatedVideo) => (
                  <VideoCard 
                    key={relatedVideo.id} 
                    video={relatedVideo} 
                    variant="compact" 
                    onClick={() => navigate(getVideoRoute(relatedVideo))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('videoDetails.noRelatedVideos')}</p>
            )}
          </div>
        </div>
      </main>
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('videoDetails.management.editVideo')}</DialogTitle>
            <DialogDescription>{t('videoDetails.management.editDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-title">{t('videoDetails.management.titleLabel')}</Label>
              <Input
                id="video-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                maxLength={120}
                aria-invalid={!editTitle.trim()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-description">{t('videoDetails.management.descriptionLabel')}</Label>
              <Textarea
                id="video-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{editDescription.length}/500</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('videoDetails.management.categoryLabel')}</Label>
                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('common.none')}</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('videoDetails.management.languageLabel')}</Label>
                <Select value={editLanguage} onValueChange={setEditLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">{t('common.language.pt')}</SelectItem>
                    <SelectItem value="en">{t('common.language.en')}</SelectItem>
                    <SelectItem value="es">{t('common.language.es')}</SelectItem>
                    <SelectItem value="fr">{t('common.language.fr')}</SelectItem>
                    <SelectItem value="other">{t('common.language.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateVideo} disabled={updateVideoMutation.isPending || !editTitle.trim()}>
              {updateVideoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('videoDetails.management.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default VideoDetails;
