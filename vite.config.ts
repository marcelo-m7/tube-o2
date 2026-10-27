import { defineConfig, loadEnv } from "vite";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Some shells export VITE_* as empty strings. Vite gives process env precedence
  // over .env files, so we only backfill when variables are missing/empty.
  if (!process.env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
  }

  if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY && env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      command === 'build' && (visualizer({
        open: false,
        brotliSize: true,
        filename: 'dist/stats.html',
      }) as PluginOption),
      VitePWA({
        registerType: 'autoUpdate',
        // Cloudflare Access preview origins require credentials for manifest reads.
        useCredentials: true,
        manifest: {
          name: 'Tube O2',
          short_name: 'Tube O2',
          description: 'Cultural video curation platform with human curators',
          theme_color: '#1a1a1a',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 3600,
                },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.(?:googleapis|google)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 86400,
                },
              },
            },
          ],
        },
      }),
    ].filter((plugin): plugin is PluginOption => Boolean(plugin)),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/src/i18n/locales/')) return 'i18n-locales';

            if (!id.includes('node_modules')) return undefined;

            if (id.includes('/react-dom/') || id.includes('/react/')) return 'react-core';
            if (id.includes('react-router') || id.includes('@remix-run/router')) return 'router';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('@supabase/')) return 'supabase';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@radix-ui')) return 'radix-ui';
            if (id.includes('zod')) return 'zod';

            return undefined;
          },
        },
      },
    },
  };
});
