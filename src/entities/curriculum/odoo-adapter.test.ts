import { describe, expect, it, vi } from 'vitest';
import { loadPublishedCurriculum, resolveOdooConnectorConfig } from '../../../supabase/functions/facodi-curriculum/handler';

const fixtures: Record<string, unknown[]> = {
  'facodi.learning.curriculum.reference': [
    { id: 3, institution: 'Universidade do Algarve', programme_name: 'LESTI', academic_year: '2026/27', external_programme_code: 'LESTI', source_url: 'https://ualg.pt' },
  ],
  'facodi.learning.curriculum.unit': [
    { id: 9, reference_id: [3, 'LESTI'], name: 'Análise Matemática I', external_unit_code: 'AM1', curricular_year: 1, period: '1', credits: 6 },
  ],
  'facodi.learning.curriculum.coverage': [
    { id: 14, curriculum_unit_id: [9, 'AM1'], channel_id: [31, 'Pré-Cálculo'], coverage_type: 'supports', confidence: 0.75 },
  ],
  'slide.channel': [{ id: 31, name: 'Pré-Cálculo', website_url: '/slides/pre-calculo-41' }],
};

describe('public FACODI curriculum projection', () => {
  it('uses the configured Odoo user API key without falling back to the account password', () => {
    expect(resolveOdooConnectorConfig({ODOO_SECRET:'user-api-key',ODOO_URL:'https://facodi.com',ODOO_DB:'facodi',ODOO_USER:'monynha@facodi.com',ODOO_PASSWORD:'not-for-api'}))
      .toEqual({odooApiKey:'user-api-key',odooUrl:'https://facodi.com',odooDatabase:'facodi'});
    expect(resolveOdooConnectorConfig({ODOO_PASSWORD:'password-only'}).odooApiKey).toBe('');
  });
  it('returns only explicitly published curriculum and approved coverage', async () => {
    const requests: {model:string; body:Record<string, unknown>}[] = [];
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const model = new URL(url).pathname.split('/')[3];
      const body = JSON.parse(String(init.body));
      requests.push({ model, body });
      expect(init.headers).toMatchObject({ Authorization: 'bearer secret' });
      return new Response(JSON.stringify(fixtures[model] ?? []), { status: 200 });
    });
    const result = await loadPublishedCurriculum({odooUrl:'https://facodi.com',odooApiKey:'secret',odooDatabase:'facodi'}, fetcher);
    expect(result.references).toHaveLength(1);
    expect(result.units[0].id).toBe(9);
    expect(result.coverage[0]).toMatchObject({unitId:9,courseId:31,coverageType:'supports'});
    expect(result.courses[0].url).toBe('https://facodi.com/slides/pre-calculo-41');
    expect(requests[0].body.domain).toEqual([['website_published','=',true]]);
    expect(requests[2].body.domain).toContainEqual(['state','=','approved']);
    expect(requests[3].body.domain).toContainEqual(['website_published','=',true]);
  });

  it('does not query coverage when no curricular unit is published', async () => {
    const fetcher = vi.fn(async () => new Response('[]', {status:200}));
    const result = await loadPublishedCurriculum({odooUrl:'https://facodi.com',odooApiKey:'secret'}, fetcher);
    expect(result).toEqual({references:[],units:[],courses:[],coverage:[]});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe backend configuration', async () => {
    await expect(loadPublishedCurriculum({odooUrl:'http://facodi.com',odooApiKey:'secret'}, vi.fn())).rejects.toThrow('invalid_odoo_origin');
  });

  it('reports the failing Odoo phase and status without exposing an upstream error body or key', async () => {
    const fetcher = vi.fn(async () => new Response('{"message":"API key secret leaked"}', {status:403}));
    const outcome = loadPublishedCurriculum({odooUrl:'https://facodi.com',odooApiKey:'secret'}, fetcher);
    await expect(outcome).rejects.toMatchObject({stage:'references',upstreamStatus:403});
    await expect(outcome).rejects.not.toThrow(/secret leaked/);
  });

  it('paginates all units and coverage instead of silently reporting truncated programme statistics', async () => {
    const references = [3,4].map(id=>({...fixtures['facodi.learning.curriculum.reference'][0] as Record<string,unknown>,id}));
    const units = Array.from({length:400},(_,i)=>({id:i+1,reference_id:[i<200?3:4,'LESTI'],name:`Unit ${i}`,external_unit_code:`U${i}`,curricular_year:1,period:'1',credits:6}));
    const coverage = Array.from({length:550},(_,i)=>({id:i+1,curriculum_unit_id:[i%400+1,'Unit'],channel_id:[31,'Pré-Cálculo'],coverage_type:'supports',confidence:0.5}));
    const datasets:Record<string,unknown[]>={...fixtures,'facodi.learning.curriculum.reference':references,'facodi.learning.curriculum.unit':units,'facodi.learning.curriculum.coverage':coverage};
    const fetcher=vi.fn(async (url:string,init:RequestInit)=>{
      const model=new URL(url).pathname.split('/')[3];
      const {offset=0,limit=200}=JSON.parse(String(init.body));
      return new Response(JSON.stringify((datasets[model]??[]).slice(offset,offset+limit)),{status:200});
    });
    const result=await loadPublishedCurriculum({odooUrl:'https://facodi.com',odooApiKey:'secret'},fetcher);
    expect(result.references).toHaveLength(2);
    expect(result.units).toHaveLength(400);
    expect(result.units.filter(u=>u.referenceId===4)).toHaveLength(200);
    expect(result.coverage).toHaveLength(550);
    expect(fetcher.mock.calls.some(([url,init])=>new URL(url).pathname.includes('curriculum.unit')&&JSON.parse(String(init.body)).offset>0)).toBe(true);
  });

  it('rejects a snapshot at its safety cap instead of returning incomplete statistics', async () => {
    const fetcher=vi.fn(async (url:string)=>{
      const model=new URL(url).pathname.split('/')[3];
      if(model==='facodi.learning.curriculum.reference')return new Response(JSON.stringify(fixtures[model]),{status:200});
      return new Response(JSON.stringify(Array.from({length:200},(_,i)=>({id:i+1,reference_id:[3,'LESTI'],name:'Unit',external_unit_code:'U',curricular_year:1,period:'1',credits:6}))),{status:200});
    });
    await expect(loadPublishedCurriculum({odooUrl:'https://facodi.com',odooApiKey:'secret'},fetcher)).rejects.toMatchObject({stage:'units',reason:'incomplete_snapshot'});
    expect(fetcher.mock.calls.length).toBeLessThan(55);
  });
});
