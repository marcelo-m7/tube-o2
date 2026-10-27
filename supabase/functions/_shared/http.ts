export type JsonBody = Record<string, unknown> | Array<unknown>;
export type CorsOptions = { additionalAllowedOrigins?: readonly string[] };

const defaultAllowedOrigins = [
  'https://tube.open2.tech',
  'https://facodi.com',
  'https://facodi.pt',
  'https://open2.tech',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function configuredAllowedOrigins() {
  const configured = Deno.env.get('ALLOWED_ORIGIN') || Deno.env.get('ALLOWED_ORIGINS');
  if (!configured) {
    return defaultAllowedOrigins;
  }

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function matchesAllowedOrigin(origin: string, allowed: string): boolean {
  if (origin === allowed) return true;
  if (!allowed.startsWith('https://*.')) return false;

  try {
    const url = new URL(origin);
    const domain = allowed.slice('https://*.'.length);
    return url.protocol === 'https:'
      && url.origin === origin
      && !url.port
      && url.hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

export function corsHeadersForRequest(req: Request, options: CorsOptions = {}): Record<string, string> {
  const allowedOrigins = [...configuredAllowedOrigins(), ...(options.additionalAllowedOrigins ?? [])];
  const requestOrigin = req.headers.get('origin');
  // Privileged functions with an explicit scoped allowlist must never return '*'.
  const allowAll = !options.additionalAllowedOrigins?.length && allowedOrigins.includes('*');
  const allowedOrigin = allowAll
    ? '*'
    : requestOrigin && allowedOrigins.some((allowed) => matchesAllowedOrigin(requestOrigin, allowed))
      ? requestOrigin
      : allowedOrigins.find((allowed) => allowed !== '*') ?? 'https://tube.open2.tech';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(req: Request, body: JsonBody, status = 200, corsOptions: CorsOptions = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(req, corsOptions),
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(
  req: Request,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
  corsOptions: CorsOptions = {},
) {
  return jsonResponse(req, {
    error: {
      code,
      message,
      ...details,
    },
  }, status, corsOptions);
}

export function optionsResponse(req: Request, corsOptions: CorsOptions = {}) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersForRequest(req, corsOptions),
  });
}
