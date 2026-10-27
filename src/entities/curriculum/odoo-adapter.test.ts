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
});
