import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { SITE_URL } from './src/config/site';

export default defineConfig({
  site: SITE_URL,
  integrations: [
    mdx(),
    sitemap({
      // /experience is unfinished until recovery plan Step 6.
      filter: (page) => !page.includes('/experience'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Never inline small scripts into the HTML: the CSP (script-src 'self')
      // blocks inline scripts. scripts/check-bundle-size.ts enforces this.
      assetsInlineLimit: 0,
    },
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, './src'),
      },
    },
  },
});
