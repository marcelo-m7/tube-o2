import { describe, expect, it, vi } from 'vitest';
import { finalizeCurriculumResponse } from '../../../supabase/functions/facodi-curriculum/observability';

const id = 'c0fe1234-5678-4abc-8def-0123456789ab';

describe('FACODI curriculum operational metrics', () => {
  it('emits one structured, PII-free completion event with a browser-readable request ID', () => {
    const log = vi.fn();
    const response = finalizeCurriculumResponse(new Response('ok', { status: 200 }), {
      requestId: id, outcome: 'ok', stage: 'upstream', durationMs: 123.7,
      upstreamDurationMs: 100.3, counts: { references: 4, units: 122, courses: 8, coverage: 24 },
    }, log);
    expect(response.headers.get('X-Request-Id')).toBe(id);
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Request-Id');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      event: 'facodi_curriculum_request', request_id: id, status: 200,
      outcome: 'ok', stage: 'upstream', duration_ms: 124, upstream_duration_ms: 100,
      counts: { references: 4, units: 122, courses: 8, coverage: 24 },
    });
  });

  it('logs stage and upstream status, never the Odoo error body or credentials', () => {
    const log = vi.fn();
    finalizeCurriculumResponse(new Response('temporarily unavailable', { status: 502 }), {
      requestId: id, outcome: 'curriculum_unavailable', stage: 'coverage',
      reason: 'upstream_http_error', upstreamStatus: 403, durationMs: 15,
    }, log);
    const event = JSON.parse(log.mock.calls[0][0]);
    expect(event).toMatchObject({ status: 502, stage: 'coverage', reason: 'upstream_http_error', upstream_status: 403 });
    expect(log.mock.calls[0][0]).not.toMatch(/authorization|bearer|password|monynha@facodi|odoo_secret/i);
  });

  it('never interpolates unexpected upstream text or forged request IDs into logs or headers', () => {
    const log = vi.fn();
    const dangerous = 'Bearer SECRET monynha@facodi.com?token=very-private';
    const response = finalizeCurriculumResponse(new Response(null, { status: 502 }), {
      requestId: dangerous, outcome: 'curriculum_unavailable', stage: dangerous as never,
      reason: dangerous, upstreamStatus: 999, durationMs: Number.POSITIVE_INFINITY,
      upstreamDurationMs: -500,
      counts: { references: -20, units: Number.NaN, courses: 99999, coverage: 4.8 },
    }, log);
    expect(log.mock.calls[0][0]).not.toContain(dangerous);
    expect(response.headers.get('X-Request-Id')).toBe('invalid');
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      stage: 'upstream', reason: 'unexpected_failure', duration_ms: 0, upstream_duration_ms: 0,
      counts: { references: 0, units: 0, courses: 5000, coverage: 0 },
    });
    expect(JSON.parse(log.mock.calls[0][0])).not.toHaveProperty('upstream_status');
  });

  it('preserves status and reports rejected unauthenticated requests without identifiers', () => {
    const log = vi.fn();
    const response = finalizeCurriculumResponse(new Response('{}', { status: 401 }), {
      requestId: id, outcome: 'authentication_required', stage: 'authentication', durationMs: 5,
    }, log);
    expect(response.status).toBe(401);
    expect(JSON.parse(log.mock.calls[0][0])).not.toHaveProperty('user_id');
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ status: 401, outcome: 'authentication_required' });
  });
});
