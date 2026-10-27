# FACODI curriculum frontend (isolated pilot)

The new `/facodi/knowledge` route belongs to the existing Tube O2 React SPA. It is **not** a replacement for `/facodi`, the current playlist experience, or the FACODI Odoo Learning add-on. This feature is isolated on a branch originating from `facodi` and must not be merged/deployed to `marcelo-m7.com` or Tube O2 production without separate regression and operational approval.

## Source of truth and permissions

- **Odoo 19 Community (`https://facodi.com`)** remains canonical. `facodi.learning.curriculum.reference`, `.unit`, `.coverage`, and `slide.channel` are consumed without modifying any record.
- **Supabase project `wvkjainfwsyiyfcmbtid`** hosts the `facodi-curriculum` read-only Edge Function. The current frontend uses the repository's existing Supabase client and authenticated sessions.
- The Odoo user API key is stored as **`ODOO_API_KEY` only in Supabase Edge Function secrets**, never in a `VITE_` variable, the Git repository, or a browser request. The function uses the Odoo 19 JSON-2 API (`/json/2/<model>/search_read`) with `Authorization: bearer ...`.
- Requests require a valid Supabase user JWT and pass the existing per-user rate limiter. The response contains **only** approved coverage, published references and published courses, projected to a small explicit field allowlist. It never includes internal editor reviews, full evidence JSON or personal information.
- Curriculum `equivalent` means an **editorial** comparison only, not legal equivalence, ECTS or university recognition.

## Configuration (administrator)

1. Verify that the Odoo 19 deployment supports the JSON-2 API and that its user-key account has minimal **read-only** ACLs for the four whitelisted models. Do not use an Odoo administrator key for this frontend.
2. In Supabase project `wvkjainfwsyiyfcmbtid`, configure secrets `ODOO_API_KEY`, `ODOO_BASE_URL=https://facodi.com`, `ODOO_DB=facodi`.
3. Confirm that `ALLOWED_ORIGIN` includes the **intended frontend host** (for example `https://marcelo-m7.com` if this preview is hosted there) while preserving existing Tube O2 origins. Never replace it with `*`.
4. Deploy only `facodi-curriculum`; **do not push the entire Supabase config**. The local function declares `verify_jwt=true` and requires the shared `check_edge_rate_limit` RPC.
5. Publish and validate the intended UAlg/LESTI curriculum in `facodi_learning` (`website_published=true`) and approve actual coverage to published `slide.channel` records. Do not seed fictitious mappings into a production database.

Without configured secrets or published Odoo records, the frontend reports an unavailable or empty state; it does not substitute local mock content.

## Contract and smoke test

`POST /functions/v1/facodi-curriculum` requires Supabase Auth bearer and project apikey headers; its success response is:

```json
{
  "references": [{"id": 1, "institution": "Universidade do Algarve", "programme": "LESTI", "year": "2026/27", "code": "LESTI", "sourceUrl": null}],
  "units": [{"id": 2, "referenceId": 1, "name": "Análise Matemática I", "code": "AM1", "year": 1, "period": "1", "credits": 6}],
  "courses": [],
  "coverage": []
}
```

This is a **shape example**, not live data. An anonymous request must be rejected, a valid signed-in user can receive published/approved data only, and unsupported Odoo APIs return a sanitized 502. All requests are server-to-server; no Odoo key is visible in browser DevTools.

## Acceptance checklist

- `bun run typecheck`, `bun run test`, `bun run build` pass.
- Existing `/`, `/facodi`, `/videos` and `/playlists` behave as before.
- `/facodi/knowledge` handles login requirements, no published references, no mapped courses, error states and valid data.
- Check responsive layout, keyboard navigation, locale strings (pt/en/es/fr), contrast and links to canonical Odoo course pages.
- Exercise Odoo JSON-2 live read against a least-privileged API-key user, then inspect the response for private data.
- Do not merge into `facodi` or `main` before the deploy target and the `marcelo-m7.com` preservation strategy are confirmed.
