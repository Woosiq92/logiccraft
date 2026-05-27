// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Custom domain at root → no `base` needed.
export default defineConfig({
  site: 'https://logiccraft.co.kr',
  integrations: [sitemap()],
});
