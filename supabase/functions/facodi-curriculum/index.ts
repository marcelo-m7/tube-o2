import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkEdgeRateLimit } from '../_shared/rate-limit.ts';
import { errorResponse, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { loadPublishedCurriculum, resolveOdooConnectorConfig } from './handler.ts';
import { facodiCorsOptions } from './cors.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request, facodiCorsOptions);
  if (request.method !== 'POST') return errorResponse(request, 405, 'method_not_allowed', 'POST required', {}, facodiCorsOptions);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const odooConfig = resolveOdooConnectorConfig({
    ODOO_SECRET: Deno.env.get('ODOO_SECRET'),
    ODOO_URL: Deno.env.get('ODOO_URL'),
    ODOO_DB: Deno.env.get('ODOO_DB'),
  });
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !odooConfig.odooApiKey || !odooConfig.odooUrl) {
    return errorResponse(request, 503, 'not_configured', 'Curriculum connector is not yet configured', {}, facodiCorsOptions);
  }

  const { user } = await getAuthenticatedUser(request, supabaseUrl, anonKey);
  if (!user) return errorResponse(request, 401, 'authentication_required', 'Please sign in', {}, facodiCorsOptions);

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {auth:{persistSession:false}});
    const limit = await checkEdgeRateLimit(supabase, {
      functionName:'facodi-curriculum',userId:user.id,
      windows:[{windowSeconds:60,maxRequests:12}],
    });
    if (!limit.allowed) return errorResponse(request, 429, 'rate_limited', 'Please try again later', {}, facodiCorsOptions);
    const data = await loadPublishedCurriculum(odooConfig);
    const response = jsonResponse(request, data, 200, facodiCorsOptions);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    // The upstream exception may contain sensitive administrative information.
    console.error('facodi-curriculum: upstream read failed', error instanceof Error ? error.name : 'unknown');
    return errorResponse(request, 502, 'curriculum_unavailable', 'Curriculum data is temporarily unavailable', {}, facodiCorsOptions);
  }
});
