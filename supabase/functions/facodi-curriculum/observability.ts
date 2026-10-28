// Structured, low-cardinality operational diagnostics for FACODI's read-only connector.
// Logs intentionally exclude user IDs, origins, request bodies, Odoo data, and credentials.
const outcomes = new Set([
  'ok', 'method_not_allowed', 'not_configured', 'authentication_required',
  'authentication_unavailable', 'rate_limited', 'rate_limit_unavailable', 'curriculum_unavailable',
]);
const stages = new Set([
  'request', 'configuration', 'authentication', 'rate_limit', 'references',
  'units', 'coverage', 'courses', 'upstream',
]);
const reasons = new Set([
  'invalid_odoo_origin', 'network_failure', 'upstream_http_error',
  'invalid_response', 'incomplete_snapshot', 'unexpected_failure',
]);

export type CurriculumOutcome =
  | 'ok' | 'method_not_allowed' | 'not_configured' | 'authentication_required'
  | 'authentication_unavailable' | 'rate_limited' | 'rate_limit_unavailable' | 'curriculum_unavailable';
export type CurriculumStage =
  | 'request' | 'configuration' | 'authentication' | 'rate_limit'
  | 'references' | 'units' | 'coverage' | 'courses' | 'upstream';

export interface CurriculumTelemetry {
  requestId: string;
  outcome: CurriculumOutcome;
  stage: CurriculumStage;
  durationMs: number;
  reason?: string;
  upstreamStatus?: number | null;
  upstreamDurationMs?: number;
  counts?: { references: number; units: number; courses: number; coverage: number };
}

function safeDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(600_000, Math.round(value))) : 0;
}
function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.max(0, Math.min(5_000, value)) : 0;
}

export function finalizeCurriculumResponse(
  response: Response,
  telemetry: CurriculumTelemetry,
  write: (line: string) => void = console.info,
): Response {
  // IDs are generated on the server, never taken from client-supplied headers.
  // Validate again to ensure even a programming mistake cannot inject log content.
  const requestId = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(telemetry.requestId)
    ? telemetry.requestId : 'invalid';
  const event: Record<string, unknown> = {
    event: 'facodi_curriculum_request',
    request_id: requestId,
    status: response.status,
    outcome: outcomes.has(telemetry.outcome) ? telemetry.outcome : 'curriculum_unavailable',
    stage: stages.has(telemetry.stage) ? telemetry.stage : 'upstream',
    duration_ms: safeDuration(telemetry.durationMs),
  };
  if (telemetry.reason) {
    event.reason = reasons.has(telemetry.reason) ? telemetry.reason : 'unexpected_failure';
  }
  if (telemetry.upstreamStatus != null && Number.isInteger(telemetry.upstreamStatus)
      && telemetry.upstreamStatus >= 100 && telemetry.upstreamStatus <= 599) {
    event.upstream_status = telemetry.upstreamStatus;
  }
  if (telemetry.upstreamDurationMs !== undefined) {
    event.upstream_duration_ms = safeDuration(telemetry.upstreamDurationMs);
  }
  if (telemetry.counts) {
    event.counts = {
      references: safeCount(telemetry.counts.references),
      units: safeCount(telemetry.counts.units),
      courses: safeCount(telemetry.counts.courses),
      coverage: safeCount(telemetry.counts.coverage),
    };
  }
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('Access-Control-Expose-Headers', 'X-Request-Id');
  response.headers.set('Cache-Control', 'private, no-store');
  write(JSON.stringify(event));
  return response;
}
