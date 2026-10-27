// Restricted, read-only projection from the canonical FACODI Odoo 19 models.
// Never return the Odoo API key, raw evidence, private editor notes or model metadata.
export interface OdooConfig {
  odooUrl: string;
  odooApiKey: string;
  odooDatabase?: string;
}

export function resolveOdooConnectorConfig(env: Record<string, string | undefined>): OdooConfig {
  return {
    // The Odoo user API key is never interchangeable with the account password.
    odooApiKey: (env.ODOO_SECRET || '').trim(),
    odooUrl: (env.ODOO_URL || '').trim(),
    odooDatabase: (env.ODOO_DB || '').trim(),
  };
}

type OdooRecord = Record<string, unknown>;
type Relation = number | [number, string] | false | null;

function relationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0];
  return null;
}

function string(value: unknown): string { return typeof value === 'string' ? value : ''; }
function numeric(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}

export function checkOdooOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.origin !== 'https://facodi.com' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('invalid_odoo_origin');
  }
  return parsed.origin;
}

export function courseUrl(base: string, value: unknown): string | null {
  if (typeof value !== 'string' || (!value.startsWith('/') && !value.startsWith(`${base}/`))) return null;
  try {
    const result = new URL(value, base);
    return result.origin === base ? result.href : null;
  } catch { return null; }
}

export async function loadPublishedCurriculum(config: OdooConfig, fetcher: typeof fetch = fetch) {
  const base = checkOdooOrigin(config.odooUrl);
  if (!config.odooApiKey) throw new Error('missing_odoo_key');

  const search = async (model: string, fields: string[], domain: unknown[], limit: number): Promise<OdooRecord[]> => {
    const request = await fetcher(`${base}/json/2/${model}/search_read`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${config.odooApiKey}`,
        'Content-Type': 'application/json',
        ...(config.odooDatabase ? {'X-Odoo-Database': config.odooDatabase} : {}),
      },
      body: JSON.stringify({domain,fields,limit,order:'id asc'}),
      signal: AbortSignal.timeout(12_000),
    });
    if (!request.ok) throw new Error(`odoo_upstream_${request.status}`);
    const data: unknown = await request.json();
    if (!Array.isArray(data)) throw new Error('odoo_invalid_response');
    return data.filter((item): item is OdooRecord => item !== null && typeof item === 'object' && !Array.isArray(item));
  };

  const referencesRaw = await search('facodi.learning.curriculum.reference',
    ['id','institution','programme_name','academic_year','external_programme_code','source_url'],
    [['website_published','=',true]], 50);
  const references = referencesRaw.map(ref => ({
    id: numeric(ref.id), institution: string(ref.institution), programme: string(ref.programme_name),
    year: string(ref.academic_year), code: string(ref.external_programme_code), sourceUrl: safeSourceUrl(ref.source_url),
  })).filter(ref => ref.id > 0);
  if (!references.length) return {references:[],units:[],courses:[],coverage:[]};

  const referenceIds = references.map(ref => ref.id);
  const unitsRaw = await search('facodi.learning.curriculum.unit',
    ['id','reference_id','name','external_unit_code','curricular_year','period','credits'],
    [['reference_id','in',referenceIds]], 300);
  const units = unitsRaw.map(unit => ({
    id: numeric(unit.id), referenceId: relationId(unit.reference_id as Relation) ?? 0,
    name: string(unit.name), code: string(unit.external_unit_code), year: numeric(unit.curricular_year),
    period: string(unit.period), credits: numeric(unit.credits),
  })).filter(unit => unit.id > 0 && referenceIds.includes(unit.referenceId));
  if (!units.length) return {references,units:[],courses:[],coverage:[]};

  const unitIds = units.map(unit => unit.id);
  const coverageRaw = await search('facodi.learning.curriculum.coverage',
    ['id','curriculum_unit_id','channel_id','coverage_type','confidence'],
    [['state','=','approved'],['curriculum_unit_id','in',unitIds]], 500);
  const courseIds = [...new Set(coverageRaw.map(row => relationId(row.channel_id as Relation)).filter((id): id is number => id !== null))];
  if (!courseIds.length) return {references,units,courses:[],coverage:[]};

  const coursesRaw = await search('slide.channel', ['id','name','website_url'],
    [['website_published','=',true],['id','in',courseIds]], 300);
  const courses = coursesRaw.map(course => ({
    id:numeric(course.id),name:string(course.name),url:courseUrl(base,course.website_url),
  })).filter(course => course.id > 0);
  const publishedCourseIds = new Set(courses.map(course => course.id));
  const coverage = coverageRaw.map(item => ({
    unitId:relationId(item.curriculum_unit_id as Relation) ?? 0,
    courseId:relationId(item.channel_id as Relation) ?? 0,
    coverageType:string(item.coverage_type),confidence:Math.max(0,Math.min(1,numeric(item.confidence))),
  })).filter(row => unitIds.includes(row.unitId) && publishedCourseIds.has(row.courseId) &&
    ['covers','partial','supports','equivalent'].includes(row.coverageType));
  return {references,units,courses,coverage};
}
