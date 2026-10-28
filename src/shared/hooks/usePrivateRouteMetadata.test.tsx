import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { usePrivateRouteMetadata } from './usePrivateRouteMetadata';

function PrivatePage({ title = 'Atlas Curricular | Tube O2' }: { title?: string }) {
  usePrivateRouteMetadata(title);
  return null;
}

let savedHead = '';
let savedTitle = '';

beforeEach(() => {
  savedHead = document.head.innerHTML;
  savedTitle = document.title;
  document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[name="robots"], meta[name="googlebot"]').forEach(node => node.remove());
  document.title = 'Tube O2 home';
});

afterEach(() => {
  document.head.innerHTML = savedHead;
  document.title = savedTitle;
});

describe('private Atlas route metadata', () => {
  it('removes the public canonical/hreflang and marks the current route noindex', () => {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://tube.open2.tech/';
    document.head.appendChild(canonical);
    const alternate = document.createElement('link');
    alternate.rel = 'alternate';
    alternate.hreflang = 'pt-PT';
    alternate.href = 'https://tube.open2.tech/';
    document.head.appendChild(alternate);

    const view = render(<PrivatePage />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow, noarchive');
    expect(document.querySelector('meta[name="googlebot"]')?.getAttribute('content')).toBe('noindex, nofollow, noarchive');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('link[rel="alternate"][hreflang]')).toBeNull();
    expect(document.title).toBe('Atlas Curricular | Tube O2');

    view.unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelector('meta[name="googlebot"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBe(canonical);
    expect(document.querySelector('link[rel="alternate"][hreflang]')).toBe(alternate);
    expect(document.title).toBe('Tube O2 home');
  });

  it('restores pre-existing robots metadata on navigation away', () => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'index, follow';
    document.head.appendChild(robots);

    const view = render(<PrivatePage />);
    expect(robots.content).toContain('noindex');
    view.unmount();

    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(robots.content).toBe('index, follow');
  });

  it('updates translated page titles without leaving stale noindex tags', () => {
    const view = render(<PrivatePage title="Atlas Curricular | Tube O2" />);
    view.rerender(<PrivatePage title="Curriculum Atlas | Tube O2" />);
    expect(document.title).toBe('Curriculum Atlas | Tube O2');
    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    view.unmount();
    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(0);
  });
});
