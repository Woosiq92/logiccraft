// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Custom domain at root → no `base` needed.
export default defineConfig({
  site: 'https://logiccraft.co.kr',
  // public/ 아래 정적 sub-app은 Astro가 스캔하지 않으므로 sitemap에 수동 등록
  integrations: [sitemap({
    customPages: [
      'https://logiccraft.co.kr/prompt-dojo/',
      'https://logiccraft.co.kr/wedding-map/',
      'https://logiccraft.co.kr/goalcast/',
      'https://logiccraft.co.kr/rocket-lab/',
      'https://logiccraft.co.kr/semiconductor-lab/',
      'https://logiccraft.co.kr/school-os/',
    ],
  })],
});
