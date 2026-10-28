import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowLeft,ArrowUpRight,BookOpen,CheckCircle2,Compass,GraduationCap,Layers3,Search,ShieldCheck,Unplug,Waypoints} from 'lucide-react';
import {MainLayout} from '@/components/layout/MainLayout';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {useFacodiCurriculum} from '@/features/curriculum/queries/useFacodiCurriculum';
import {useAuth} from '@/features/auth/useAuth';
import {usePrivateRouteMetadata} from '@/shared/hooks/usePrivateRouteMetadata';
import {classifyUnitCoverage,summarizeCurriculum} from '@/entities/curriculum/curriculum.health';
import type {CurriculumCoverage,CurriculumUnit} from '@/entities/curriculum/curriculum.types';

const coverageColors={covered:'bg-emerald-500',partial:'bg-amber-400',missing:'bg-muted-foreground/25'};

function CoveragePill({unitId,coverage}:{unitId:number;coverage:CurriculumCoverage[]}){
  const {t}=useTranslation();
  const status=classifyUnitCoverage(unitId,coverage);
  return <Badge variant="outline" className="gap-2 whitespace-nowrap border-border/80 px-3 py-1 text-foreground">
    <span className={`h-2 w-2 rounded-full ${coverageColors[status]}`}/>
    {t(`facodiKnowledge.coverage.${status}`)}
  </Badge>;
}

function EmptyDashboard({reason}:{reason:'empty'|'error'|'authentication';}){
  const {t}=useTranslation();
  return <Card className="border-dashed border-border bg-card/80"><CardContent className="flex flex-col items-center gap-5 px-7 py-16 text-center">
    {reason==='error'?<Unplug className="h-10 w-10 text-muted-foreground"/>:<BookOpen className="h-10 w-10 text-muted-foreground"/>}
    <div className="max-w-lg space-y-2"><h2 className="text-xl font-semibold">{t(`facodiKnowledge.${reason}.title`)}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{t(`facodiKnowledge.${reason}.description`)}</p></div>
    <div className="flex flex-wrap justify-center gap-3"><Button asChild variant="outline"><Link to="/facodi">{t('facodiKnowledge.back')}</Link></Button>
      {reason==='authentication'&&<Button asChild><Link to="/auth" onClick={()=>localStorage.setItem('redirectAfterLogin','/facodi/knowledge')}>{t('facodiKnowledge.signIn')}</Link></Button>}</div>
  </CardContent></Card>;
}

export default function FacodiKnowledge(){
  const {t}=useTranslation();
  usePrivateRouteMetadata(`${t('facodiKnowledge.title')} | Tube O2`);
  const {user,loading:authLoading}=useAuth();
  const {data,isPending,isError,refetch,isFetching}=useFacodiCurriculum();
  const [selected,setSelected]=useState<number|null>(null);
  const [query,setQuery]=useState('');
  const references=data?.references??[];
  const defaultReference=references.find(r=>r.institution.toLocaleLowerCase().includes('algarve'))??references[0];
  const activeReference=references.find(r=>r.id===selected)??defaultReference;
  const summary=data&&activeReference?summarizeCurriculum(data,activeReference.id):{total:0,covered:0,partial:0,missing:0};
  const filteredUnits=useMemo(()=>{
    if(!data||!activeReference)return [];
    const normalized=query.trim().toLocaleLowerCase();
    return data.units.filter(u=>u.referenceId===activeReference.id&&(!normalized||`${u.name} ${u.code}`.toLocaleLowerCase().includes(normalized)))
      .sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name));
  },[data,activeReference,query]);
  const mappedCourses=(unit:CurriculumUnit)=>data?.coverage.filter(row=>row.unitId===unit.id).map(row=>({
    ...row,course:data.courses.find(course=>course.id===row.courseId),
  })).filter(row=>row.course)??[];
  const percent=summary.total?Math.round(summary.covered/summary.total*100):0;

  return <MainLayout>
    <section className="relative overflow-hidden border-b-2 border-border bg-background">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full border-[60px] border-[#37BED2]/10"/>
      <div className="container relative space-y-8 py-12 md:py-16">
        <Link to="/facodi" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>{t('facodiKnowledge.back')}</Link>
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-4xl space-y-5">
            <Badge className="gap-2 rounded-none bg-[#EFFF00] px-3 py-1 font-bold uppercase tracking-widest text-[#142846] hover:bg-[#EFFF00]"><Compass className="h-3.5 w-3.5"/>{t('facodiKnowledge.eyebrow')}</Badge>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground md:text-6xl">{t('facodiKnowledge.title')}</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{t('facodiKnowledge.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 border-l-4 border-[#37BED2] bg-card p-5 shadow-sm">
            <ShieldCheck className="h-7 w-7 text-[#3979C8]"/><div className="space-y-1"><p className="text-xs font-bold uppercase tracking-wider">{t('facodiKnowledge.sourceLabel')}</p>
            <p className="text-sm text-muted-foreground">{t('facodiKnowledge.sourceDetail')}</p></div>
          </div>
        </div>
      </div>
    </section>

    <div className="container space-y-8 py-10 md:py-12">
      {authLoading?<div className="space-y-5" aria-label={t('common.loading')}><Skeleton className="h-28 w-full"/><Skeleton className="h-80 w-full"/></div>
      :!user?<EmptyDashboard reason="authentication"/>
      :isPending?<div className="space-y-5" aria-label={t('common.loading')}><Skeleton className="h-28 w-full"/><Skeleton className="h-80 w-full"/></div>
      :isError?<div className="space-y-4"><EmptyDashboard reason="error"/><Button onClick={()=>void refetch()} disabled={isFetching} variant="outline">{t('common.retry')}</Button></div>
      :!activeReference||!data?<EmptyDashboard reason="empty"/>
      :<>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('facodiKnowledge.programme')}>
            {references.map(ref=><Button key={ref.id} aria-pressed={ref.id===activeReference.id} variant={ref.id===activeReference.id?'default':'outline'} onClick={()=>{setSelected(ref.id);setQuery('');}} className="max-w-full truncate">{ref.programme} · {ref.year}</Button>)}
          </div>
          {activeReference.sourceUrl&&<a href={activeReference.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline">{t('facodiKnowledge.officialSource')}<ArrowUpRight className="h-4 w-4"/></a>}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {([
            {label:'units',count:summary.total,icon:GraduationCap},
            {label:'covered',count:summary.covered,icon:CheckCircle2},
            {label:'partial',count:summary.partial,icon:Waypoints},
            {label:'missing',count:summary.missing,icon:Layers3},
          ] as const).map(item=><Card key={item.label} className="rounded-none border-2 border-border shadow-none"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t(`facodiKnowledge.metric.${item.label}`)}</p><p className="mt-2 text-3xl font-black tabular-nums">{item.count}</p></div><item.icon className="h-7 w-7 text-muted-foreground"/></CardContent></Card>)}
        </div>

        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-5">
            <Card className="rounded-none border-2 border-border"><CardContent className="space-y-6 p-6">
              <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('facodiKnowledge.coverageTitle')}</p><p className="text-xl font-bold">{activeReference.programme}</p><p className="text-sm text-muted-foreground">{activeReference.institution}</p></div>
              <div role="img" aria-label={t('facodiKnowledge.coverageChartLabel',{percent})} className="mx-auto flex h-44 w-44 items-center justify-center rounded-full" style={{background:`conic-gradient(#37BED2 0% ${percent}%, #F0BC53 ${percent}% ${percent+(summary.total?summary.partial/summary.total*100:0)}%, hsl(var(--muted)) 0%)`}}>
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-card"><strong className="text-4xl tabular-nums">{percent}%</strong><span className="text-xs font-medium text-muted-foreground">{t('facodiKnowledge.directCoverage')}</span></div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{t('facodiKnowledge.disclaimer')}</p>
            </CardContent></Card>
          </aside>
          <section className="min-w-0 space-y-5" aria-label={t('facodiKnowledge.unitsTitle')}>
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#3979C8]">{t('facodiKnowledge.curriculumLabel')}</p><h2 className="mt-1 text-2xl font-bold">{t('facodiKnowledge.unitsTitle')}</h2></div>
              <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('facodiKnowledge.search')} aria-label={t('facodiKnowledge.search')}/></div></div>
            {!filteredUnits.length?<div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t('facodiKnowledge.noUnits')}</div>
            :<div className="space-y-3">{filteredUnits.map(unit=>{
              const mapped=mappedCourses(unit);
              return <Card key={unit.id} className="overflow-hidden rounded-none border-2 border-border/80 shadow-none transition-colors hover:border-primary/50"><CardContent className="space-y-4 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{unit.code} · {t('facodiKnowledge.year',{number:unit.year})}</p><h3 className="text-lg font-bold">{unit.name}</h3></div><CoveragePill unitId={unit.id} coverage={data.coverage}/></div>
                {mapped.length?<div className="space-y-2 border-t border-border/70 pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('facodiKnowledge.relatedCourses')}</p><div className="flex flex-wrap gap-2">{mapped.map(mapping=>mapping.course?.url?<a key={mapping.courseId} href={mapping.course.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70">{mapping.course.name}<ArrowUpRight className="h-3.5 w-3.5"/></a>:<span key={mapping.courseId} className="rounded-md bg-secondary px-3 py-2 text-sm">{mapping.course?.name}</span>)}</div></div>
                :<p className="border-t border-border/70 pt-4 text-sm text-muted-foreground">{t('facodiKnowledge.noCourse')}</p>}
              </CardContent></Card>;
            })}</div>}
          </section>
        </div>
      </>}
    </div>
  </MainLayout>;
}
