// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Custom domain at root → no `base` needed.
export default defineConfig({
  site: 'https://logiccraft.co.kr',
  // 가족 로드맵으로 합친 옛 주소. /dadexam/ 과 /wedding-map/ 은 public 정적 폴더라 거기 넘김 페이지를 둔다.
  redirects: {
    '/guides/newborn-fever': '/family-roadmap/guides/newborn-fever',
    '/guides/labor-signs-hospital-timing': '/family-roadmap/guides/labor-signs-hospital-timing',
    '/guides/talk-with-young-kids': '/family-roadmap/guides/talk-with-young-kids',
    '/guides/weekend-detective-play': '/family-roadmap/guides/weekend-detective-play',
    '/apps/dadexam': '/apps/family-roadmap',
    '/apps/wedding-map': '/apps/family-roadmap',
  },
  // public/ 아래 정적 sub-app은 Astro가 스캔하지 않으므로 sitemap에 수동 등록
  integrations: [sitemap({
    customPages: [
      'https://logiccraft.co.kr/prompt-dojo/',
      'https://logiccraft.co.kr/goalcast/',
      'https://logiccraft.co.kr/rocket-lab/',
      'https://logiccraft.co.kr/semiconductor-lab/',
      'https://logiccraft.co.kr/school-os/',
      'https://logiccraft.co.kr/matrixiq-test/',
      'https://logiccraft.co.kr/escape-lab/',
    ],
  })],
});
