import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, ListVideo, Loader2, Send } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/useAuth';
import { usePrivateRouteMetadata } from '@/shared/hooks/usePrivateRouteMetadata';
import {
  listFacodiAcademicCourses,
  listFacodiCourseUnits,
  submitFacodiPlaylist,
  type FacodiPlaylistSubmission,
} from '@/entities/facodi-playlist/facodi-playlist.api';

type CourseRows = Awaited<ReturnType<typeof listFacodiAcademicCourses>>;
type UnitRows = Awaited<ReturnType<typeof listFacodiCourseUnits>>;

export default function FacodiPlaylistSubmit() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  usePrivateRouteMetadata(t('facodiPlaylistSubmit.title') + ' | FACODI');
  const [courses, setCourses] = useState<CourseRows>([]);
  const [units, setUnits] = useState<UnitRows>([]);
  const [courseId, setCourseId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxVideos, setMaxVideos] = useState('50');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FacodiPlaylistSubmission | null>(null);
  const isEditor = user && ['editor', 'admin'].includes(String(user.app_metadata?.role || ''));

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingCourses(true);
    listFacodiAcademicCourses().then((rows) => {
      if (active) setCourses(rows);
    }).catch(() => {
      if (active) setError(t('facodiPlaylistSubmit.loadError'));
    }).finally(() => { if (active) setLoadingCourses(false); });
    return () => { active = false; };
  }, [user, t]);

  useEffect(() => {
    if (!courseId) { setUnits([]); return; }
    let active = true;
    setLoadingUnits(true);
    listFacodiCourseUnits(courseId).then((rows) => {
      if (active) setUnits(rows);
    }).catch(() => {
      if (active) setError(t('facodiPlaylistSubmit.loadError'));
    }).finally(() => { if (active) setLoadingUnits(false); });
    return () => { active = false; };
  }, [courseId, t]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId || !unitId || !playlistUrl.trim()) {
      setError(t('facodiPlaylistSubmit.required'));
      return;
    }
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const response = await submitFacodiPlaylist({
        courseId, unitId, playlistUrl: playlistUrl.trim(),
        title: title.trim() || undefined, description: description.trim() || undefined,
        language: 'pt', maxVideos: Number(maxVideos),
      });
      setResult(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('facodiPlaylistSubmit.unknownError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <section className="border-b-2 border-border bg-background py-12">
        <div className="container max-w-4xl space-y-5">
          <Link to="/facodi" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline">
            <ArrowLeft className="h-4 w-4" />{t('facodiPlaylistSubmit.back')}
          </Link>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-10 w-10 text-[#3979C8]" />
            <h1 className="text-3xl font-black uppercase tracking-tight md:text-5xl">
              {t('facodiPlaylistSubmit.title')}
            </h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">{t('facodiPlaylistSubmit.description')}</p>
        </div>
      </section>
      <div className="container max-w-4xl py-10">
        {authLoading ? (
          <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin" />{t('common.loading')}</div>
        ) : !user ? (
          <Card><CardContent className="space-y-5 p-8 text-center">
            <p>{t('facodiPlaylistSubmit.loginRequired')}</p>
            <Button asChild><Link to="/auth" onClick={() => localStorage.setItem('redirectAfterLogin', '/facodi/playlists/submit')}>
              {t('facodiKnowledge.signIn')}
            </Link></Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-6">
            <Card className="border-2 border-border shadow-none">
              <CardContent className="p-6 md:p-8">
                <form onSubmit={submit} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facodi-course"><BookOpen className="mr-2 inline h-4 w-4" />{t('facodiPlaylistSubmit.course')} *</Label>
                      <select id="facodi-course" value={courseId} disabled={submitting || loadingCourses}
                        required onChange={(e) => { setCourseId(e.target.value); setUnitId(''); setResult(null); }}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">{t('facodiPlaylistSubmit.selectCourse')}</option>
                        {courses.map((course) => <option key={course.id} value={course.id}>
                          {course.code ? course.code + ' · ' : ''}{course.title}
                          {!course.published ? ' (' + t('facodiPlaylistSubmit.draft') + ')' : ''}
                        </option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facodi-unit">{t('facodiPlaylistSubmit.unit')} *</Label>
                      <select id="facodi-unit" value={unitId} disabled={!courseId || loadingUnits || submitting}
                        required onChange={(e) => { setUnitId(e.target.value); setResult(null); }}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">{t('facodiPlaylistSubmit.selectUnit')}</option>
                        {units.map((unit) => <option key={unit.id} value={unit.id}>
                          {unit.code ? unit.code + ' · ' : ''}{unit.title}
                        </option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facodi-playlist-url"><ListVideo className="mr-2 inline h-4 w-4" />
                      {t('facodiPlaylistSubmit.url')} *
                    </Label>
                    <Input id="facodi-playlist-url" type="url" required value={playlistUrl}
                      onChange={(e) => setPlaylistUrl(e.target.value)}
                      placeholder="https://www.youtube.com/playlist?list=PL..."
                      disabled={submitting} />
                    <p className="text-xs text-muted-foreground">{t('facodiPlaylistSubmit.urlHint')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facodi-playlist-title">{t('facodiPlaylistSubmit.optionalTitle')}</Label>
                    <Input id="facodi-playlist-title" maxLength={200} value={title}
                      onChange={(e) => setTitle(e.target.value)} disabled={submitting}
                      placeholder={t('facodiPlaylistSubmit.titleHint')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facodi-playlist-description">{t('facodiPlaylistSubmit.optionalDescription')}</Label>
                    <Textarea id="facodi-playlist-description" maxLength={2000} rows={3}
                      value={description} onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facodi-max-videos">{t('facodiPlaylistSubmit.maxVideos')}</Label>
                    <select id="facodi-max-videos" value={maxVideos} disabled={submitting}
                      onChange={(e) => setMaxVideos(e.target.value)}
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <p className="border-l-4 border-[#37BED2] bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    {t('facodiPlaylistSubmit.reviewNotice')}
                  </p>
                  {error && <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={submitting || loadingCourses || loadingUnits || !courses.length}
                    className="h-12 w-full gap-2 font-bold" size="lg">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting ? t('facodiPlaylistSubmit.submitting') : t('facodiPlaylistSubmit.submit')}
                  </Button>
                </form>
              </CardContent>
            </Card>
            {!loadingCourses && courses.length === 0 && !error &&
              <p className="text-sm text-muted-foreground">{t('facodiPlaylistSubmit.noCourses')}</p>}
            {result && <Card className="border-2 border-[#37BED2] shadow-none">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-7 w-7 text-[#3979C8]" />
                  <h2 className="text-xl font-bold">{t('facodiPlaylistSubmit.success')}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{t('facodiPlaylistSubmit.pending')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <p><strong>{result.playlist_video_count}</strong> {t('facodiPlaylistSubmit.found')}</p>
                  <p><strong>{result.linked_video_count}</strong> {t('facodiPlaylistSubmit.linked')}</p>
                  <p><strong>{result.missing_video_count}</strong> {t('facodiPlaylistSubmit.missing')}</p>
                </div>
                <p className="break-all text-xs text-muted-foreground">ID: {result.playlist_id}</p>
                {isEditor && <Button asChild variant="outline"><Link to="/facodi/playlists/review">
                  {t('facodiPlaylistSubmit.reviewLink')}
                </Link></Button>}
              </CardContent>
            </Card>}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
