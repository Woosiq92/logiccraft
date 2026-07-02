// 앱별 OG 카드(카톡·트위터 공유 미리보기) 생성 파이프라인.
// products.js를 단일 소스로 읽어 앱마다 1200×630 PNG를 public/og/<icon>.png 로 순차 생성한다.
// 렌더는 시스템 Chrome 헤드리스 --screenshot 사용(별도 의존성 없음).
//   node scripts/gen-og.mjs            → 전체
//   node scripts/gen-og.mjs sedolal    → 특정 아이콘 키만
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { products } from '../src/data/products.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ICONS = resolve(ROOT, 'public/icons');
const OUT = resolve(ROOT, 'public/og');
const TMP = resolve(ROOT, '.og-tmp');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Synergeion 시리즈 앱은 products.js에 카운트용으로만 있어(icon/desc 없음) 별도 보강.
const EXTRA = [
  { icon: 'wonder', name: 'Synergeion Wonder', chip: '유아 사고력', type: 'app',
    ios: 'x', play: 'x',
    desc: "3~6세 아이와 부모가 매일 한 가지 생각 놀이를 함께 나누는 앱. 정답이 아니라 좋은 질문을 나눠요." },
  { icon: 'build', name: 'Synergeion Build', chip: '아동 사고력', type: 'app',
    ios: 'x', play: 'x',
    desc: "6~9세 아이가 매일 '정말 그래?'를 스스로 묻고 직접 확인해 보는 부모-아이 사고력 놀이." },
];

const only = process.argv[2];
const CLAY = '#cf8350';
const BLUE = '#2f63f4';

const platform = (p) => {
  if (p.type === 'web') return '웹 · 설치 없이';
  const both = p.ios && p.play;
  if (both) return 'iOS · Android';
  if (p.ios) return 'iOS';
  if (p.play) return 'Android';
  return '출시 예정';
};

const card = (p) => {
  const accent = p.warm ? CLAY : BLUE;
  const iconPath = 'file://' + resolve(ICONS, `${p.icon}.png`);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; }
  body {
    font-family:'Pretendard Variable',sans-serif;
    background:
      radial-gradient(900px 500px at 88% -10%, ${accent}22, transparent 60%),
      linear-gradient(135deg, #f7f6f2 0%, #f1efe8 100%);
    color:#11183a; position:relative; overflow:hidden;
    padding:88px 96px; display:flex; flex-direction:column; justify-content:space-between;
  }
  .brand { font-family:'IBM Plex Mono',monospace; font-size:22px; letter-spacing:.06em; color:#6a7392; }
  .brand b { color:${accent}; font-weight:600; }
  .main { display:flex; align-items:center; gap:56px; }
  .icon { width:216px; height:216px; border-radius:48px; box-shadow:0 24px 60px rgba(17,24,58,.18); flex-shrink:0; }
  .chip {
    display:inline-block; padding:9px 20px; border-radius:999px; font-size:24px; font-weight:700;
    color:${accent}; background:${accent}1a; margin-bottom:20px;
  }
  .name { font-size:74px; font-weight:800; line-height:1.12; letter-spacing:-.02em; }
  .foot { display:flex; align-items:center; justify-content:space-between; }
  .desc { font-size:29px; line-height:1.5; color:#34406b; max-width:760px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .plat { font-family:'IBM Plex Mono',monospace; font-size:24px; font-weight:500; color:#fff;
    background:#11183a; padding:12px 26px; border-radius:999px; white-space:nowrap; flex-shrink:0; margin-left:32px; }
</style></head><body>
  <div class="brand">logiccraft<b>.co.kr</b></div>
  <div class="main">
    <img class="icon" src="${iconPath}" alt="">
    <div>
      <span class="chip">${p.chip}</span>
      <div class="name">${p.name}</div>
    </div>
  </div>
  <div class="foot">
    <div class="desc">${p.desc}</div>
    <div class="plat">${platform(p)}</div>
  </div>
</body></html>`;
};

const targets = [...products, ...EXTRA].filter((p) => p.icon && (!only || p.icon === only));
console.log(`OG 생성 대상 ${targets.length}개\n`);

for (const p of targets) {
  const html = resolve(TMP, `${p.icon}.html`);
  const out = resolve(OUT, `${p.icon}.png`);
  writeFileSync(html, card(p));
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--screenshot=${out}`, '--window-size=1200,630',
    '--virtual-time-budget=1500',
    `file://${html}`,
  ], { stdio: 'ignore' });
  console.log(`  ✓ ${p.icon}.png  (${p.name})`);
}

console.log(`\n완료 → public/og/`);
