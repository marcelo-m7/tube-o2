import type { CorsOptions } from '../_shared/http.ts';

// This allowlist is scoped to the curriculum connector. It preserves the
// existing Tube O2 CORS origins while supporting Marcelo's domain portfolio
// and preview Workers belonging to the marcelo-0d6 Cloudflare account only.
// Never use `https://*.workers.dev`: anyone can deploy an unrelated Worker.
export const facodiCorsOptions: CorsOptions = {
  additionalAllowedOrigins: [
    'https://marcelo-m7.com',
    'https://*.marcelo-m7.com',
    'https://marcelo-m7.me',
    'https://*.marcelo-m7.me',
    'https://facodi.com',
    'https://*.facodi.com',
    'https://*.marcelo-0d6.workers.dev',
  ],
};
