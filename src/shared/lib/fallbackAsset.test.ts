import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public image fallbacks', () => {
  it('ships an SVG at the URL used by video and playlist cards', () => {
    const fallbackPath = resolve(process.cwd(), 'public/placeholder.svg');
    const fallback = readFileSync(fallbackPath, 'utf8');

    expect(fallback).toMatch(/<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(fallback).toMatch(/<\/svg>\s*$/);
  });
});
