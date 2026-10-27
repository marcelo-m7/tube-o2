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
    // This adapter is FACODI-specific: never send the privileged API key to
    // a deployment-provided URL. Pin the canonical, user-approved Odoo host.
    odooUrl: 'https://facodi.com',
    odooDatabase: (env.ODOO_DB || '').trim(),
  };
}

type OdooRecord = Record<string, unknown>;
type Relation = number | [number, string] | false | null;
export type CurriculumReadStage = 'configuration' | 'references' | 'units' | 'coverage' | 'courses';

export class CurriculumConnectorError extends Error {
  constructor(
    public readonly stage: CurriculumReadStage,
    public readonly reason: 'invalid_odoo_origin' | 'network_failure' | 'upstream_http_error' | 'invalid_response' | 'incomplete_snapshot',
    public readonly upstreamStatus: number | null = null,
  ) {
    // Never include the upstream response body, credentials or API-key account data.
    super(`curriculum_${reason}`);
    this.name = 'CurriculumConnectorError';
  }
}

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
  // Admin UI values may include a /json/2 suffix, or surrounding shell quotes.
  // Only the hostname matters: never use a supplied path to construct API URLs.
  const input = value.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  const parsed = new URL(input);
  if (parsed.protocol !== 'https:' || !['facodi.com','www.facodi.com'].includes(parsed.hostname) ||
      parsed.port || parsed.username || parsed.password) {
    throw new Error('invalid_odoo_origin');
  }
  return 'https://facodi.com';
}

export function courseUrl(base: string, value: unknown): string | null {
  if (typeof value !== 'string' || (!value.startsWith('/') && !value.startsWith(`${base}/`))) return null;
  try {
    const result = new URL(value, base);
    return result.origin === base ? result.href : null;
  } catch { return null; }
}

export async function loadPublishedCurriculum(config: OdooConfig, fetcher: typeof fetch = fetch) {
  let base: string;
  try { base = checkOdooOrigin(config.odooUrl); }
  catch { throw new CurriculumConnectorError('configuration','invalid_odoo_origin'); }
  if (!config.odooApiKey) throw new Error('missing_odoo_key');

  const search = async (model: string, fields: string[], domain: unknown[], stage: CurriculumReadStage): Promise<OdooRecord[]> => {
    const pageSize = 200;
    const maxRecords = 5000;
    const records: OdooRecord[] = [];
    for (let offset = 0; ; offset = records.length) {
      // Fetch one extra record at the cap to distinguish exactly-full from truncated.
      const limit = Math.min(pageSize, maxRecords - offset + 1);
      let request: Response;
      try { request = await fetcher(`${base}/json/2/${model}/search_read`, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${config.odooApiKey}`,
          'Content-Type': 'application/json',
          ...(config.odooDatabase ? {'X-Odoo-Database': config.odooDatabase} : {}),
        },
        body: JSON.stringify({domain,fields,limit,offset,order:'id asc'}),
        signal: AbortSignal.timeout(12_000),
      }); }
      catch { throw new CurriculumConnectorError(stage,'network_failure'); }
      if (!request.ok) throw new CurriculumConnectorError(stage, 'upstream_http_error', request.status);
      let data: unknown;
      try { data = await request.json(); }
      catch { throw new CurriculumConnectorError(stage, 'invalid_response'); }
      if (!Array.isArray(data) || data.some(item=>!item || typeof item!=='object' || Array.isArray(item))) {
        throw new CurriculumConnectorError(stage, 'invalid_response');
      }
      if (records.length + data.length > maxRecords) throw new CurriculumConnectorError(stage, 'incomplete_snapshot');
      records.push(...data as OdooRecord[]);
      if (data.length < limit) return records;
    }
  };

  const referencesRaw = await search('facodi.learning.curriculum.reference',
    ['id','institution','programme_name','academic_year','external_programme_code','source_url'],
    [['website_published','=',true]], 'references');
  const references = referencesRaw.map(ref => ({
    id: numeric(ref.id), institution: string(ref.institution), programme: string(ref.programme_name),
    year: string(ref.academic_year), code: string(ref.external_programme_code), sourceUrl: safeSourceUrl(ref.source_url),
  })).filter(ref => ref.id > 0);
  if (!references.length) return {references:[],units:[],courses:[],coverage:[]};

  const referenceIds = references.map(ref => ref.id);
  const unitsRaw = await search('facodi.learning.curriculum.unit',
    ['id','reference_id','name','external_unit_code','curricular_year','period','credits'],
    [['reference_id','in',referenceIds]], 'units');
  const units = unitsRaw.map(unit => ({
    id: numeric(unit.id), referenceId: relationId(unit.reference_id as Relation) ?? 0,
    name: string(unit.name), code: string(unit.external_unit_code), year: numeric(unit.curricular_year),
    period: string(unit.period), credits: numeric(unit.credits),
  })).filter(unit => unit.id > 0 && referenceIds.includes(unit.referenceId));
  if (!units.length) return {references,units:[],courses:[],coverage:[]};

  const unitIds = units.map(unit => unit.id);
  const coverageRaw = await search('facodi.learning.curriculum.coverage',
    ['id','curriculum_unit_id','channel_id','coverage_type','confidence'],
    [['state','=','approved'],['curriculum_unit_id','in',unitIds]], 'coverage');
  const courseIds = [...new Set(coverageRaw.map(row => relationId(row.channel_id as Relation)).filter((id): id is number => id !== null))];
  if (!courseIds.length) return {references,units,courses:[],coverage:[]};

  const coursesRaw = await search('slide.channel', ['id','name','website_url'],
    [['website_published','=',true],['id','in',courseIds]], 'courses');
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
