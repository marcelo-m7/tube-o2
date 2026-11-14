import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, ExternalLink, GraduationCap, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/useAuth';
import { usePrivateRouteMetadata } from '@/shared/hooks/usePrivateRouteMetadata';
import {
  listPendingFacodiPlaylists,
  listFacodiAcademicCourses,
  listFacodiCourseUnits,
  getFacodiPlaylistItems,
  reviewFacodiPlaylist,
} from '@/entities/facodi-playlist/facodi-playlist.api';

type Pending = Awaited<ReturnType<typeof listPendingFacodiPlaylists>>;
type VideoItems = Awaited<ReturnType<typeof getFacodiPlaylistItems>>;

export default function FacodiPlaylistReview() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  usePrivateRouteMetadata(t('facodiPlaylistReview.title') + ' | FACODI');
  const editor = user && ['editor', 'admin'].includes(String(user.app_metadata?.role || ''));
  const [playlists, setPlaylists] = useState<Pending>([]);
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});
  const [unitNames, setUnitNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState('');
  const [items, setItems] = useState<VideoItems>([]);
  const [note, setNote] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    setLoadingList(true);
    try {
      const [pending, courses] = await Promise.all([
        listPendingFacodiPlaylists(),
        listFacodiAcademicCourses(),
      ]);
      setPlaylists(pending);
      setCourseNames(Object.fromEntries(courses.map((c) => [c.id, c.title])));
      const allUnits = await Promise.all(courses.map((c) => listFacodiCourseUnits(c.id)));
      setUnitNames(Object.fromEntries(allUnits.flat().map((u) => [
        u.id, (u.code ? u.code + ' · ' : '') + u.title,
      ])));
      setSelectedId((prev) => pending.some((p) => p.id === prev) ? prev : pending[0]?.id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('facodiPlaylistReview.loadError'));
    } finally {
      setLoadingList(false);
    }
  }, [t]);

  useEffect(() => {
    if (editor) void reload();
  }, [editor, reload]);

  useEffect(() => {
    if (!selectedId) { setItems([]); return; }
    let active = true;
    setLoadingItems(true);
    getFacodiPlaylistItems(selectedId).then((rows) => {
      if (active) setItems(rows);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : t('facodiPlaylistReview.loadError'));
    }).finally(() => { if (active) setLoadingItems(false); });
    return () => { active = false; };
  }, [selectedId, t]);

  const selected = useMemo(
    () => playlists.find((p) => p.id === selectedId), [playlists, selectedId],
  );
  const unresolved = items.filter((item) => !item.video_id).length;
  const eligible = items.filter((item) => item.review_status !== 'rejected');
  const canApprove = !loadingItems && eligible.length > 0 &&
    eligible.every((item) => !!item.video_id);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selected || saving) return;
    if (decision === 'approved' && !canApprove) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await reviewFacodiPlaylist(selected.id, decision, note);
      setSuccess(t(decision === 'approved'
        ? 'facodiPlaylistReview.approved' : 'facodiPlaylistReview.rejected'));
      setNote('');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('facodiPlaylistReview.loadError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <section className="border-b-2 border-border py-12">
        <div className="container max-w-6xl space-y-5">
          <Link to="/facodi" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline">
            <ArrowLeft className="h-4 w-4" />{t('facodiPlaylistSubmit.back')}
          </Link>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-[#3979C8]" />
            <h1 className="text-3xl font-black uppercase tracking-tight md:text-5xl">
              {t('facodiPlaylistReview.title')}
            </h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">{t('facodiPlaylistReview.subtitle')}</p>
        </div>
      </section>
      <div className="container max-w-6xl py-10">
        {authLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : !editor ? (
          <Card><CardContent className="space-y-4 p-8">
            <p>{t('facodiPlaylistReview.editorOnly')}</p>
            <Button asChild variant="outline"><Link to="/facodi">{t('facodiPlaylistSubmit.back')}</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">{t('facodiPlaylistReview.pending')} ({playlists.length})</h2>
                <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loadingList}>
                  {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : t('facodiPlaylistReview.refresh')}
                </Button>
              </div>
              {playlists.map((p) => (
                <button key={p.id} type="button" onClick={() => { setSelectedId(p.id); setSuccess(null); }}
                  className={'w-full border-2 p-4 text-left hover:bg-muted/50 ' +
                    (selectedId === p.id ? 'border-[#37BED2] bg-muted/50' : 'border-border')}>
                  <p className="font-bold">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{courseNames[p.course_id] || p.course_id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{unitNames[p.curricular_unit_id] || p.curricular_unit_id}</p>
                </button>
              ))}
              {!loadingList && playlists.length === 0 &&
                <p className="text-sm text-muted-foreground">{t('facodiPlaylistReview.empty')}</p>}
            </aside>
            <div className="space-y-5">
              {error && <p role="alert" className="border border-destructive p-4 text-sm text-destructive">{error}</p>}
              {success && <p role="status" className="border border-[#37BED2] p-4 text-sm">{success}</p>}
              {selected && <Card className="border-2 border-border shadow-none">
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      <GraduationCap className="mr-2 inline h-4 w-4" />
                      {courseNames[selected.course_id]} · {unitNames[selected.curricular_unit_id]}
                    </p>
                    <a href={selected.source_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
                      {t('facodiPlaylistReview.source')} <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div>
                    <h3 className="mb-3 font-semibold">{t('facodiPlaylistReview.videos')} ({items.length})</h3>
                    {loadingItems ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <div className="max-h-[500px] space-y-2 overflow-y-auto">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 border border-border p-3">
                            <span className="w-8 text-xs text-muted-foreground">{item.position + 1}</span>
                            {item.video?.thumbnail_url &&
                              <img src={item.video.thumbnail_url} alt="" loading="lazy"
                                className="h-14 w-24 shrink-0 object-cover" />}
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold">
                                {item.video?.title || item.youtube_video_id}
                              </p>
                              {!item.video_id && <p className="text-xs text-destructive">
                                {t('facodiPlaylistReview.videoMissing')}
                              </p>}
                            </div>
                            {item.video_id && <CheckCircle2 className="h-4 w-4 text-[#3979C8]" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {unresolved > 0 && <p className="mt-3 text-sm text-destructive">
                      {t('facodiPlaylistReview.missingWarning', { count: unresolved })}
                    </p>}
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="facodi-review-note" className="text-sm font-medium">
                      {t('facodiPlaylistReview.note')}
                    </label>
                    <Textarea id="facodi-review-note" rows={3} maxLength={2000}
                      value={note} onChange={(event) => setNote(event.target.value)} />
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" disabled={saving || !canApprove}
                        onClick={() => void decide('approved')} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <CheckCircle2 className="h-4 w-4" />}
                        {t('facodiPlaylistReview.approve')}
                      </Button>
                      <Button type="button" disabled={saving} variant="destructive" className="gap-2"
                        onClick={() => void decide('rejected')}>
                        <XCircle className="h-4 w-4" />{t('facodiPlaylistReview.reject')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('facodiPlaylistReview.publicationNotice')}</p>
                  </div>
                </CardContent>
              </Card>}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
