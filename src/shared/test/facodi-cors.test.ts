import { afterEach, describe, expect, it, vi } from 'vitest';
import { corsHeadersForRequest, optionsResponse } from '../../../supabase/functions/_shared/http';
import { facodiCorsOptions } from '../../../supabase/functions/facodi-curriculum/cors';

function preflight(origin: string) {
  return new Request('https://wvkjainfwsyiyfcmbtid.supabase.co/functions/v1/facodi-curriculum', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('FACODI CORS preview origins', () => {
  it.each([
    'https://feature-facodi-curriculum-frontend-tube-o2.marcelo-0d6.workers.dev',
    'https://other-preview.marcelo-0d6.workers.dev',
    'https://marcelo-m7.com',
    'https://app.marcelo-m7.com',
    'https://marcelo-m7.me',
    'https://edu.marcelo-m7.me',
    'https://facodi.com',
    'https://www.facodi.com',
  ])('allows the owned origin %s', (origin) => {
    vi.stubGlobal('Deno', { env: { get: () => 'https://tube.open2.tech' } });
    const response = optionsResponse(preflight(origin), facodiCorsOptions);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Vary')).toContain('Origin');
  });

  it.each([
    'https://someone-else.workers.dev',
    'https://marcelo-0d6.workers.dev.evil.com',
    'https://evil-marcelo-m7.com',
    'https://facodi.com.evil.com',
    'http://feature-facodi-curriculum-frontend-tube-o2.marcelo-0d6.workers.dev',
    'https://facodi.com:8443',
  ])('does not reflect the untrusted origin %s', (origin) => {
    vi.stubGlobal('Deno', { env: { get: () => 'https://tube.open2.tech' } });
    const headers = corsHeadersForRequest(preflight(origin), facodiCorsOptions);
    expect(headers['Access-Control-Allow-Origin']).not.toBe(origin);
  });

  it('keeps configured origins working after adding FACODI preview origins', () => {
    vi.stubGlobal('Deno', { env: { get: () => 'https://tube.open2.tech' } });
    const headers = corsHeadersForRequest(preflight('https://tube.open2.tech'), facodiCorsOptions);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://tube.open2.tech');
  });

  it('does not inherit a broad global wildcard for the authenticated curriculum function', () => {
    vi.stubGlobal('Deno', { env: { get: () => '*' } });
    const headers = corsHeadersForRequest(preflight('https://untrusted.example'), facodiCorsOptions);
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
    expect(headers['Access-Control-Allow-Origin']).not.toBe('https://untrusted.example');
  });
});
