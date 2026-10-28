import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkEdgeRateLimit } from '../_shared/rate-limit.ts';
import { errorResponse, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { CurriculumConnectorError, loadPublishedCurriculum, resolveOdooConnectorConfig } from './handler.ts';
import { facodiCorsOptions } from './cors.ts';
import { finalizeCurriculumResponse } from './observability.ts';
import type { CurriculumOutcome, CurriculumStage, CurriculumTelemetry } from './observability.ts';

Deno.serve(async (request: Request) => {
  // Preflight is handled by CORS and Supabase platform logs; do not create an
  // application metric for every OPTIONS request.
  if (request.method === 'OPTIONS') return optionsResponse(request, facodiCorsOptions);

  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const respond = (
    response: Response,
    outcome: CurriculumOutcome,
    stage: CurriculumStage,
    details: Partial<Pick<CurriculumTelemetry, 'reason' | 'upstreamStatus' | 'upstreamDurationMs' | 'counts'>> = {},
  ) => finalizeCurriculumResponse(response, {
    requestId, outcome, stage, durationMs: performance.now() - startedAt, ...details,
  });
  const unavailable = (code: string, status = 503) =>
    errorResponse(request, status, code, 'Curriculum data is temporarily unavailable', {}, facodiCorsOptions);

  if (request.method !== 'POST') {
    return respond(errorResponse(request, 405, 'method_not_allowed', 'POST required', {}, facodiCorsOptions),
      'method_not_allowed', 'request');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const odooConfig = resolveOdooConnectorConfig({
    ODOO_SECRET: Deno.env.get('ODOO_SECRET'),
    ODOO_URL: Deno.env.get('ODOO_URL'),
    ODOO_DB: Deno.env.get('ODOO_DB'),
  });
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !odooConfig.odooApiKey || !odooConfig.odooUrl) {
    return respond(unavailable('not_configured'), 'not_configured', 'configuration');
  }

  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>['user'];
  try {
    ({ user } = await getAuthenticatedUser(request, supabaseUrl, anonKey));
  } catch {
    return respond(unavailable('authentication_unavailable'), 'authentication_unavailable', 'authentication');
  }
  if (!user) {
    return respond(errorResponse(request, 401, 'authentication_required', 'Please sign in', {}, facodiCorsOptions),
      'authentication_required', 'authentication');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  try {
    const limit = await checkEdgeRateLimit(supabase, {
      functionName: 'facodi-curriculum', userId: user.id,
      windows: [{ windowSeconds: 60, maxRequests: 12 }],
    });
    if (!limit.allowed) {
      return respond(errorResponse(request, 429, 'rate_limited', 'Please try again later', {}, facodiCorsOptions),
        'rate_limited', 'rate_limit');
    }
  } catch {
    return respond(unavailable('rate_limit_unavailable'), 'rate_limit_unavailable', 'rate_limit');
  }

  const upstreamStartedAt = performance.now();
  try {
    const data = await loadPublishedCurriculum(odooConfig);
    return respond(jsonResponse(request, data, 200, facodiCorsOptions), 'ok', 'upstream', {
      upstreamDurationMs: performance.now() - upstreamStartedAt,
      counts: { references: data.references.length, units: data.units.length,
        courses: data.courses.length, coverage: data.coverage.length },
    });
  } catch (error) {
    // Never include the exception message, stack or upstream response body.
    const known = error instanceof CurriculumConnectorError ? error : null;
    return respond(unavailable('curriculum_unavailable', 502), 'curriculum_unavailable', known?.stage ?? 'upstream', {
      reason: known?.reason ?? 'unexpected_failure',
      upstreamStatus: known?.upstreamStatus,
      upstreamDurationMs: performance.now() - upstreamStartedAt,
    });
  }
});
