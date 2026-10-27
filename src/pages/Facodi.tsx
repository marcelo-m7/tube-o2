import { ArrowRight, BookOpen, CheckCircle2, CircleDashed, Clock3, GraduationCap, ListChecks, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CategorySwatchCard, LearningPathRail, PlaylistShowcaseCard, SectionHeader } from '@/components/showcase';
import {
  groupFacodiPlaylistHealthBySemester,
  pickDefaultFacodiCourseCode,
  summarizeFacodiPlaylistHealth,
} from '@/entities/course/course.health';
import type { FacodiPlaylistHealthItem, FacodiPlaylistHealthStatus } from '@/entities/course/course.types';
import { useFacodiPlaylistHealth, useCoursePlaylistSummary } from '@/features/courses/queries/useCoursePlaylists';
import { useHomeExhibition } from '@/features/home/useHomeExhibition';
import { formatDuration } from '@/shared/lib/format';

const HEALTH_STATUS_ICON: Record<FacodiPlaylistHealthStatus, typeof CircleDashed> = {
  empty: CircleDashed,
  thin: Clock3,
  healthy: CheckCircle2,
  overloaded: ListChecks,
};

const HEALTH_STATUS_CLASS: Record<FacodiPlaylistHealthStatus, string> = {
  empty: 'border-border bg-background text-muted-foreground',
  thin: 'border-accent bg-accent/10 text-foreground',
  healthy: 'border-primary bg-primary text-primary-foreground',
  overloaded: 'border-destructive bg-destructive/10 text-destructive',
};

const HEALTH_STATUSES: FacodiPlaylistHealthStatus[] = ['empty', 'thin', 'healthy', 'overloaded'];

export default function Facodi() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const { data: home, isLoading } = useHomeExhibition();
  const { data: courseSummaries = [], isLoading: isCourseSummaryLoading } = useCoursePlaylistSummary();
  const [selectedCourseCode, setSelectedCourseCode] = useState('LESTI');
  const formatNumber = useMemo(() => new Intl.NumberFormat(i18n.language || 'pt-PT').format, [i18n.language]);
  const facodi = home?.facodi_highlights ?? [];
  const categories = home?.categories ?? [];
  const availableCourseSummaries = useMemo(
    () => courseSummaries.filter((summary) => summary.public_playlists_total > 0),
    [courseSummaries],
  );
  const defaultCourseCode = useMemo(
    () => pickDefaultFacodiCourseCode(availableCourseSummaries),
    [availableCourseSummaries],
  );
  const activeCourseCode = selectedCourseCode || defaultCourseCode;
  const activeCourseSummary = availableCourseSummaries.find((summary) => summary.course_code === activeCourseCode);
  const {
    data: playlistHealth = [],
    isLoading: isPlaylistHealthLoading,
    isError: isPlaylistHealthError,
  } = useFacodiPlaylistHealth({
    courseCode: activeCourseCode,
    enabled: Boolean(activeCourseCode),
  });
  const healthSummary = useMemo(() => summarizeFacodiPlaylistHealth(playlistHealth), [playlistHealth]);
  const healthGroups = useMemo(
    () => groupFacodiPlaylistHealthBySemester(playlistHealth, t('facodiPage.curriculum.fallbackSemester')),
    [playlistHealth, t],
  );

  const rails = [
    {
      key: 'facodi',
      label: 'FACODI',
      accent: 'facodi' as const,
      title: t('facodiPage.rails.facodi.title'),
      description: t('facodiPage.rails.facodi.description'),
      playlists: facodi.slice(0, 4),
    },
    {
      key: 'lesti',
      label: 'LESTI',
      accent: 'lesti' as const,
      title: t('facodiPage.rails.lesti.title'),
      description: t('facodiPage.rails.lesti.description'),
      playlists: facodi.slice(4, 8).length ? facodi.slice(4, 8) : facodi.slice(0, 4),
    },
  ].filter((rail) => rail.playlists.length > 0);

  useEffect(() => {
    if (!defaultCourseCode) return;
    const selectedExists = availableCourseSummaries.some((summary) => summary.course_code === selectedCourseCode);
    if (!selectedExists) {
      setSelectedCourseCode(defaultCourseCode);
    }
  }, [availableCourseSummaries, defaultCourseCode, selectedCourseCode]);

  const handlePlaylistAction = (item: FacodiPlaylistHealthItem) => {
    if (item.video_count > 0) {
      navigate(`/playlists/${item.playlist_id}`);
      return;
    }

    navigate('/submit');
  };

  return (
    <MainLayout>
      <section className="border-b-2 border-border bg-background py-14 md:py-20">
        <div className="container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="space-y-8">
            <GraduationCap className="h-12 w-12" />
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black uppercase leading-none md:text-7xl">
                {t('facodiPage.hero.title')}
              </h1>
              <p className="max-w-2xl text-lg font-medium leading-8 text-muted-foreground">
                {t('facodiPage.hero.description')}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="xl" className="h-14 justify-between px-6" onClick={() => navigate('/playlists?course=LESTI')}>
                {t('facodiPage.hero.primaryCta')}
                <BookOpen className="h-5 w-5" />
              </Button>
              <Button size="xl" variant="outline" className="h-14 justify-between px-6" onClick={() => navigate('/submit')}>
                {t('facodiPage.hero.secondaryCta')}
                <Send className="h-5 w-5" />
              </Button>
              {import.meta.env.VITE_ENABLE_FACODI_KNOWLEDGE === 'true' && (
                <Button size="xl" variant="outline" className="h-14 justify-between px-6" onClick={() => navigate('/facodi/knowledge')}>
                  {t('facodiKnowledge.openAtlas')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-4 border-2 border-border bg-card p-4 text-card-foreground shadow-[12px_12px_0_#efff00] sm:grid-cols-3">
            <div>
              <p className="text-4xl font-black leading-none">{formatNumber(home?.metrics.curricular_playlists ?? 0)}</p>
              <p className="mt-3 text-[0.65rem] font-black uppercase text-card-foreground/70">{t('facodiPage.metrics.curricular')}</p>
            </div>
            <div>
              <p className="text-4xl font-black leading-none">{formatNumber(home?.metrics.public_non_empty_playlists ?? 0)}</p>
              <p className="mt-3 text-[0.65rem] font-black uppercase text-card-foreground/70">{t('facodiPage.metrics.publicPaths')}</p>
            </div>
            <div>
              <p className="text-4xl font-black leading-none">{formatNumber(home?.metrics.videos_total ?? 0)}</p>
              <p className="mt-3 text-[0.65rem] font-black uppercase text-card-foreground/70">{t('facodiPage.metrics.videos')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 md:py-20">
        <div className="container space-y-5">
          <SectionHeader title={t('facodiPage.rails.title')} description={t('facodiPage.rails.description')} />
          {isLoading ? (
            <div className="grid gap-5">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-72 border-2 border-border" />
              ))}
            </div>
          ) : rails.length ? (
            rails.map((rail) => (
              <LearningPathRail
                key={rail.key}
                label={rail.label}
                title={rail.title}
                description={rail.description}
                accent={rail.accent}
                playlists={rail.playlists}
              />
            ))
          ) : (
            <div className="border-2 border-border p-8 text-muted-foreground">{t('homeExhibition.empty.facodi')}</div>
          )}
        </div>
      </section>

      <section className="border-y-2 border-border bg-muted/30 py-16 md:py-20">
        <div className="container space-y-8">
          <SectionHeader
            title={t('facodiPage.curriculum.title')}
            description={t('facodiPage.curriculum.description')}
            action={
              activeCourseSummary ? (
                <div className="border-2 border-border bg-background px-4 py-3 text-sm font-black uppercase">
                  {t('facodiPage.curriculum.focus', { course: activeCourseSummary.course_code })}
                </div>
              ) : undefined
            }
          />

          <div className="flex flex-wrap gap-2" aria-label={t('facodiPage.curriculum.courseSelectorLabel')}>
            {isCourseSummaryLoading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-28 border-2 border-border" />)
            ) : (
              availableCourseSummaries.map((summary) => (
                <Button
                  key={summary.course_code}
                  type="button"
                  variant={summary.course_code === activeCourseCode ? 'default' : 'outline'}
                  className="h-12 px-4"
                  title={summary.course_name}
                  onClick={() => setSelectedCourseCode(summary.course_code)}
                >
                  {summary.course_code}
                  <span className="text-[0.65rem] opacity-70">
                    {t('facodiPage.curriculum.playlistCount', { count: summary.playlists_total })}
                  </span>
                </Button>
              ))
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HEALTH_STATUSES.map((status) => {
              const Icon = HEALTH_STATUS_ICON[status];
              return (
                <div key={status} className="border-2 border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-3xl font-black leading-none">{formatNumber(healthSummary[status])}</p>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-[0.65rem] font-black uppercase text-muted-foreground">
                    {t(`facodiPage.curriculum.status.${status}`)}
                  </p>
                </div>
              );
            })}
          </div>

          {isPlaylistHealthLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 border-2 border-border" />
              ))}
            </div>
          ) : isPlaylistHealthError ? (
            <div className="border-2 border-destructive bg-background p-6 font-medium text-destructive">
              {t('facodiPage.curriculum.loadError')}
            </div>
          ) : healthGroups.length ? (
            <div className="space-y-8">
              {healthGroups.map((group) => (
                <div key={group.semesterLabel} className="space-y-3">
                  <div className="flex flex-col gap-2 border-b-2 border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-black leading-none">{group.semesterLabel}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t('facodiPage.curriculum.groupSummary', {
                          units: group.items.length,
                          videos: group.videoCount,
                          duration: formatDuration(group.durationSeconds),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {group.items.map((item) => {
                      const Icon = HEALTH_STATUS_ICON[item.health_status];
                      return (
                        <article
                          key={item.playlist_id}
                          className="grid gap-4 border-2 border-border bg-card p-4 text-card-foreground md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                        >
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={HEALTH_STATUS_CLASS[item.health_status]} variant="outline">
                                <Icon className="mr-1 h-3.5 w-3.5" />
                                {t(`facodiPage.curriculum.status.${item.health_status}`)}
                              </Badge>
                              {item.unit_code && (
                                <span className="text-[0.65rem] font-black uppercase text-muted-foreground">
                                  {t('facodiPage.curriculum.unitCode', { code: item.unit_code })}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <h4 className="break-words text-lg font-black leading-tight">{item.playlist_name}</h4>
                              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                {t(`facodiPage.curriculum.statusDescription.${item.health_status}`)}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs font-black uppercase text-muted-foreground">
                              <span>{t('facodiPage.curriculum.videoCount', { count: item.video_count })}</span>
                              {item.total_duration_seconds > 0 && (
                                <span>{t('facodiPage.curriculum.durationLabel', { duration: formatDuration(item.total_duration_seconds) })}</span>
                              )}
                              {item.is_ordered && <span>{t('facodiPage.curriculum.ordered')}</span>}
                            </div>
                          </div>

                          <Button
                            variant={item.video_count > 0 ? 'default' : 'outline'}
                            className="w-full md:w-auto"
                            onClick={() => handlePlaylistAction(item)}
                          >
                            {item.video_count > 0 ? t('facodiPage.curriculum.openPlaylist') : t('facodiPage.curriculum.submitVideo')}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-border bg-background p-8 text-muted-foreground">{t('facodiPage.curriculum.empty')}</div>
          )}
        </div>
      </section>

      <section className="border-y-2 border-border bg-secondary py-16 text-secondary-foreground md:py-20">
        <div className="container">
          <SectionHeader
            title={t('facodiPage.featured.title')}
            description={t('facodiPage.featured.description')}
            action={
              <Button variant="outline" className="border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground" onClick={() => navigate('/playlists')}>
                {t('homeExhibition.actions.viewAllPlaylists')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <div className="grid gap-5 md:grid-cols-3">
            {(home?.featured_playlists ?? []).slice(0, 6).map((playlist) => (
              <PlaylistShowcaseCard key={playlist.id} playlist={playlist} className="border-border bg-card text-card-foreground hover:border-primary" />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-16 md:py-20">
        <div className="container">
          <SectionHeader title={t('facodiPage.categories.title')} description={t('facodiPage.categories.description')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <CategorySwatchCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
