import { useEffect } from 'react';

/**
 * Client-side privacy metadata for an authenticated SPA route.
 * This is an SEO hint, NOT an access-control mechanism. A static Cloudflare
 * response must also be reviewed for X-Robots-Tag if pre-render crawlers matter.
 */
export function usePrivateRouteMetadata(title: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    const head = document.head;

    const canonicalLinks = Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
    const languageLinks = Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'));
    for (const link of [...canonicalLinks, ...languageLinks]) link.remove();

    const robots: Array<{ node: HTMLMetaElement; previous: string | null; created: boolean }> = [];
    for (const name of ['robots', 'googlebot'] as const) {
      const existing = head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const node = existing ?? document.createElement('meta');
      if (!existing) {
        node.name = name;
        head.appendChild(node);
      }
      robots.push({ node, previous: existing?.getAttribute('content') ?? null, created: !existing });
      node.content = 'noindex, nofollow, noarchive';
    }
    document.title = title;

    return () => {
      if (document.title === title) document.title = previousTitle;
      for (const { node, previous, created } of robots) {
        if (created) node.remove();
        else if (previous === null) node.removeAttribute('content');
        else node.setAttribute('content', previous);
      }
      // Restore metadata that belongs to the prior page. New route-specific
      // effects may update or replace it on the next navigation.
      for (const link of [...canonicalLinks, ...languageLinks]) {
        if (!link.isConnected) head.appendChild(link);
      }
    };
  }, [title]);
}
