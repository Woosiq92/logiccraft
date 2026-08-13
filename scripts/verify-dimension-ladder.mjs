/* 차원 사다리 검증 — 실제 페이지를 띄워 네 막을 다 그려 보고, 앱이 화면에서 주장하는 것을
 * 같은 코드로 다시 재서 견준다. 손으로 짠 프로브가 아니라 실앱의 __dim 훅을 쓴다.
 *
 *   node scripts/verify-dimension-ladder.mjs [outDir]
 *
 * ⚠️ 포트를 고정하지 않는다 — 앞선 실행의 죽은 크롬에 붙어 옛 문서를 찍는다.
 * ⚠️ pkill 은 이 검증기 전용 프로필 경로로만 건다. 남의 크롬을 죽이면 다른 세션이 오탐한다.
 * ⚠️ 헤드리스는 rAF 를 연속으로 안 돌린다. 상태를 바꾼 뒤에는 draw 를 직접 부르고 한 장 찍어
 *    합성을 강제한다. 앱의 모든 draw*() 는 동기라서 이게 가능하다.
 */
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import net from 'node:net';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = new URL('../public', import.meta.url).pathname;
const OUT = process.argv[2] || '/tmp/dimladder-shots';
const PROFILE = '/tmp/dimladder-chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

mkdirSync(OUT, { recursive: true });
try { execSync(`pkill -f "${PROFILE}"`, { stdio: 'ignore' }); } catch { }
if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });

const APP_PORT = await freePort(), CDP = await freePort();
const errors = [], failed404 = [];
let server, chrome, ws;
const cleanup = () => {
  try { ws?.close(); } catch { }
  try { chrome?.kill(); } catch { }
  try { server?.close(); } catch { }
};

let pass = 0, fail = 0;
const t = (n, ok, extra) => {
  if (ok) { console.log('  ✓', n); pass++; }
  else { console.error('  ✗', n, extra == null ? '' : JSON.stringify(extra)); fail++; }
};

try {
  server = createServer(async (req, res) => {
    const p = normalize(decodeURIComponent(req.url.split('?')[0]));
    const f = join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
    if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const b = await readFile(f);
      res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }).end(b);
    } catch { failed404.push(req.url); res.writeHead(404).end('nope'); }
  });
  await new Promise((r) => server.listen(APP_PORT, '127.0.0.1', r));

  chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' });

  await sleep(600);
  let tabs = null;
  for (let i = 0; i < 40 && !tabs; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); } catch { await sleep(400); }
  }
  if (!tabs) throw new Error('CDP 가 열리지 않았다');
  ws = new WebSocket(tabs.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));

  let id = 0; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push(m.params.args.map((a) => a.value).join(' '));
  });
  const send = (method, params) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval 실패');
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const b = Buffer.from(r.result.data, 'base64');
    writeFileSync(join(OUT, name + '.png'), b);
    return b.length;
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/dimension-ladder/` });
  for (let i = 0; i < 50; i++) { if (await ev('!!window.__dim')) break; await sleep(200); }

  console.log('차원 사다리 — 검증\n');
  t('앱이 떴다', await ev('!!window.__dim'));

  /* ── 1. 엔진: 초입방체를 실제로 만들어 세고, 공식과 양쪽에서 견준다.
     개수를 검증기에 박지 않는다 — 생성기와 공식이 서로를 검사하게 둔다. */
  const eng = JSON.parse(await ev(`(()=>{const D=window.__dim,o=[];
    for(let n=0;n<=4;n++){const c=D.hypercube(n);
      o.push({n, v:c.V.length, e:c.E.length, fv:D.nVerts(n), fe:D.nEdges(n), fp:D.nPlanes(n),
              uniq:new Set(c.V.map(p=>p.join(','))).size,
              deg:c.V.length?Math.min(...c.V.map((_,i)=>c.E.filter(e=>e[0]===i||e[1]===i).length)):0});}
    return JSON.stringify(o);})()`));
  t('생성한 꼭짓점 수와 2ⁿ 이 일치한다', eng.every(r => r.v === r.fv), eng.map(r => [r.v, r.fv]));
  t('생성한 모서리 수와 n·2ⁿ⁻¹ 이 일치한다', eng.every(r => r.e === r.fe), eng.map(r => [r.e, r.fe]));
  t('꼭짓점에 중복이 없다', eng.every(r => r.uniq === r.v));
  t('모든 꼭짓점의 차수가 n 이다', eng.every(r => r.n === 0 || r.deg === r.n), eng.map(r => [r.n, r.deg]));
  t('4차원 회전평면은 6, 3차원은 3', eng[4].fp === 6 && eng[3].fp === 3, [eng[3].fp, eng[4].fp]);

  /* ── 2. 1막과 3막의 유추가 실제로 닫히는가.
     짝지은 3차원·4차원 물체는 같은 높이에서 같은 크기의 단면을 줘야 한다.
     여기가 어긋나면 3막이 "1막과 같은 자리"라고 말해 놓고 다른 것을 보여 준다. */
  const mirror = JSON.parse(await ev(`(()=>{const D=window.__dim,bad=[];
    for(let i=0;i<D.SOLIDS3.length;i++){
      const a=D.SOLIDS3[i], b=D.SOLIDS4[i];
      if(b.pair!==a.n) bad.push({i,why:'짝 이름 불일치',a:a.n,b:b.pair});
      for(let k=-20;k<=20;k++){const hh=k/12;
        const x=a.sec(hh), y=b.sec(hh);
        if(!!x!==!!y){bad.push({i,hh,why:'존재 구간이 다름'});break;}
        if(x&&Math.abs(x.r-y.r)>1e-9){bad.push({i,hh,why:'단면 크기가 다름',r3:x.r,r4:y.r});break;}}}
    return JSON.stringify({n:D.SOLIDS3.length, m:D.SOLIDS4.length, bad});})()`));
  t('3차원·4차원 물체가 같은 개수로 짝이다', mirror.n === mirror.m, mirror);
  t('짝지은 물체의 단면 크기 곡선이 완전히 같다', mirror.bad.length === 0, mirror.bad.slice(0, 3));

  /* ── 3. 4막이 화면에서 주장하는 것을 그대로 재본다.
     ⚠️ 탐침 하나로 "막혔다"고 적지 않는다. 전 구간을 훑어 최솟값을 본다. */
  /* 표본 수를 앱 기본값(320)보다 올려 잡는다. 성기게 재면 실제 교차를 지나쳐
     "안 겹친다"는 오탐이 난다 — 주장 자체를 검사하는 자리라 여기서는 정밀하게 본다. */
  const knot = JSON.parse(await ev(`(()=>{const D=window.__dim, N=400;
    let n0=Infinity, n1=Infinity, s0=0;
    for(let k=0;k<=100;k++){const s=k/100;
      const a=D.knotMinDist(s,0,N), b=D.knotMinDist(s,D.K.KA,N);
      if(a<n0){n0=a;s0=s;} if(b<n1)n1=b;}
    return JSON.stringify({n0,n1,s0,K:D.K});})()`));
  t('들어 올리지 않으면 밧줄이 자신을 통과한다 (3차원에서 불가능)', knot.n0 < 0.05, knot.n0.toFixed(4));
  t('한 가닥을 w 로 빼면 전 구간에서 안 겹친다', knot.n1 > 0.3, knot.n1.toFixed(4));
  t('풀림 경로의 양 끝은 w 가 0 이다 (우리 공간으로 돌아온다)',
    Math.abs(await ev('window.__dim.knotPt(window.__dim.K.KT0,0,5)[3]')) < 1e-9 &&
    Math.abs(await ev('window.__dim.knotPt(window.__dim.K.KT0,1,5)[3]')) < 1e-9);

  /* ── 4. 네 막이 실제로 그려지는가. 빈 화면 대비 바이트로 견준다.
     숫자를 손으로 박으면 폰트·창 크기가 바뀔 때마다 검증만 깨진다. */
  await send('Page.navigate', { url: 'about:blank' }); await sleep(250);
  const blank = await shot('00-blank');
  await send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/dimension-ladder/` });
  for (let i = 0; i < 50; i++) { if (await ev('!!window.__dim')) break; await sleep(200); }

  const scenes = [];
  // 1막 — 단면이 가장 큰 자리로 세워 두고 정답까지 눌러 3차원 진실 화면을 연다
  await ev(`window.__dim.go('act1')`);
  await ev(`(()=>{const r=document.getElementById('r1h');r.value=0;r.dispatchEvent(new Event('input'));})()`);
  scenes.push(['01-act1-단면', await shot('01-act1')]);
  await ev(`(()=>{const k=window.__dim.state().act1.obj;
    [...document.querySelectorAll('#o1 .opt')].find(b=>b.dataset.k===k).click();})()`);
  await sleep(300);
  /* ⚠️ 화면에 붙었다고 찍히는 것은 아니다. 처음엔 진실 카드가 뷰포트 아래에 있어
     검사는 통과하는데 컷에는 안 나왔다 — 눈으로 볼 컷이라 스크롤을 시킨 뒤 찍는다. */
  await ev(`document.getElementById('truth1').scrollIntoView({block:'center'})`);
  await sleep(250);
  scenes.push(['02-act1-정답과 진실', await shot('02-act1-truth')]);
  t('정답을 고르면 3차원 진실 화면이 열린다', await ev(`document.getElementById('truth1').style.display==='block'`));
  t('진실 카드가 실제로 뷰포트 안에 들어온다', await ev(`(()=>{const r=document.getElementById('c1t').getBoundingClientRect();
    return r.top>=0 && r.bottom<=innerHeight && r.height>50;})()`));
  t('맞힌 것이 기록에 남는다', await ev(`Object.keys(window.__dim.rec().sec).length>0`));

  // 2막 — 테서랙트까지 올려 6평면 토글이 서는지
  await ev(`window.__dim.go('act2'); window.__dim.setDim(4)`);
  await sleep(200);
  /* ⚠️ 밀기 전에는 정육면체 두 벌이 완전히 겹쳐 화면에는 정육면체가 그려진다.
     바이트 크기만 보면 이 상태도 통과한다 — 실제로 그렇게 찍혔다. 찍힌 점을 세서 가른다. */
  const collapsed = await ev(`window.__dim.drawnVerts()`);
  t('밀기 전에는 두 벌이 겹쳐 절반만 찍힌다', collapsed === 8, collapsed);
  scenes.push(['03a-act2-겹친 상태', await shot('03a-act2-collapsed')]);
  await ev(`window.__dim.setPush(1)`); await sleep(120);
  const opened = await ev(`window.__dim.drawnVerts()`);
  t('밀고 나면 꼭짓점 16 자리가 전부 따로 찍힌다', opened === 16, opened);
  scenes.push(['03-act2-테서랙트', await shot('03-act2')]);
  const pl = await ev(`document.querySelectorAll('#pl2 .pl').length`);
  t('4차원 칸에서 회전 평면 여섯이 뜬다', pl === 6, pl);
  t('w 를 무는 회전 셋이 보라로 갈린다', await ev(`document.querySelectorAll('#pl2 .pl.w').length`) === 3);
  /* w 축 모서리는 어디서나 보라다. 색 규약이 실제 픽셀에 나오는지 캔버스를 읽어 센다. */
  const purple = await ev(`(()=>{const c=document.getElementById('c2'),g=c.getContext('2d');
    const d=g.getImageData(0,0,c.width,c.height).data; let p=0;
    for(let i=0;i<d.length;i+=4){ if(d[i]>110 && d[i+2]>150 && d[i]-d[i+1]>28 && d[i+2]-d[i+1]>28) p++; }
    return p;})()`);
  t('w 축 모서리가 실제 픽셀에서 보라로 그려진다', purple > 200, purple);

  // 3막 — 4차원 물체의 3차원 단면
  await ev(`window.__dim.go('act3')`);
  await ev(`(()=>{const r=document.getElementById('r3w');r.value=0;r.dispatchEvent(new Event('input'));})()`);
  await sleep(200);
  scenes.push(['04-act3-4차원 단면', await shot('04-act3')]);
  t('단면 지름이 화면에 숫자로 나온다', parseFloat(await ev(`document.getElementById('v3d').textContent`)) > 0);

  // 4막 가 — 평면에서 들어 올리기
  await ev(`window.__dim.go('act4'); window.__dim.setStep4('a')`);
  await ev(`(()=>{const r=document.getElementById('r4z');r.value=100;r.dispatchEvent(new Event('input'));})()`);
  await sleep(200);
  scenes.push(['05-act4-평면 탈출', await shot('05-act4a')]);
  t('들어 올리면 탈출 판정이 뜬다', await ev(`document.getElementById('k4').classList.contains('show')`));

  // 4막 나 — w 없이 밀면 경고, w 를 켜면 풀림
  await ev(`window.__dim.setStep4('b'); window.__dim.set4(${knot.s0},0)`);
  await sleep(150);
  scenes.push(['06-act4-자기통과', await shot('06-act4-hit')]);
  t('w 없이 미는 자리에서 붉은 경고가 뜬다', await ev(`document.getElementById('w4').classList.contains('show')`));
  await ev(`window.__dim.set4(1,1)`);
  await sleep(150);
  scenes.push(['07-act4-풀림', await shot('07-act4-solved')]);
  t('w 로 빼내 끝까지 밀면 풀림 판정이 뜬다', await ev(`document.getElementById('k4').classList.contains('show')`));
  t('경고와 풀림이 동시에 뜨지 않는다',
    !(await ev(`document.getElementById('w4').classList.contains('show')&&document.getElementById('k4').classList.contains('show')`)));

  // 기록
  await ev(`window.__dim.go('act5')`); await sleep(200);
  scenes.push(['08-기록', await shot('08-record')]);
  const rows = await ev(`document.querySelectorAll('#t5 tr').length`);
  t('기록표가 물체 전부를 싣는다', rows === mirror.n + mirror.m, { rows, want: mirror.n + mirror.m });

  scenes.forEach(([n, b]) => t(`${n} 화면이 실제로 그려졌다`, b > blank * 1.6, { bytes: b, blank }));

  /* ── 5. 한국어 렌더 함정 — 줄바꿈 규약이 실제 계산값에 반영됐는지 */
  const wb = await ev(`(()=>{const s=getComputedStyle(document.body);
    return JSON.stringify({wb:s.wordBreak, ow:s.overflowWrap});})()`);
  t('본문에 keep-all 이 실제로 걸려 있다', /keep-all/.test(wb), wb);

  /* ── 6. 가로 스크롤 · 콘솔 */
  const oflow = JSON.parse(await ev(`JSON.stringify({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth})`));
  t('가로로 넘치지 않는다', oflow.sw <= oflow.cw + 1, oflow);
  /* ── 7. 좁은 화면. 캔버스는 clientWidth 로 자기 크기를 잡으므로 한 칸 배치로 접히면
     폭이 확 줄어든다. 여기서 캔버스가 0 폭이 되거나 가로로 넘치는 일이 잦다. */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  await ev(`window.__dim.go('act1'); window.dispatchEvent(new Event('resize'))`);
  await sleep(300);
  scenes.push(['09-좁은 화면 1막', await shot('09-narrow-act1')]);
  /* ⚠️ 숨은 막의 캔버스를 재면 clientWidth 가 0 이고 백킹 크기는 데스크톱 값이 남아 있다.
     사용자가 실제로 밟는 경로대로 막을 하나씩 열어 놓고 재야 진짜 폭이 나온다. */
  const narrow = JSON.parse(await ev(`(async()=>{
    const map={act1:['c1w','c1e'],act2:['c2'],act3:['c3'],act4:['c4']};
    const o={sw:0, cw:document.documentElement.clientWidth, cv:{}};
    for(const [act,ids] of Object.entries(map)){
      window.__dim.go(act);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      o.sw=Math.max(o.sw, document.documentElement.scrollWidth);
      ids.forEach(i=>{const c=document.getElementById(i); o.cv[i]=[Math.round(c.clientWidth), c.width];});
    }
    return JSON.stringify(o);})()`));
  t('좁은 화면에서 어느 막도 가로로 안 넘친다', narrow.sw <= narrow.cw + 1, narrow);
  t('좁은 화면에서 캔버스가 폭을 잃지 않는다',
    Object.values(narrow.cv).every(([css, px]) => css > 200 && px > 200), narrow.cv);
  /* 캔버스를 여러 번 다시 맞춰도 백킹 높이가 안 불어나는지. cv.height 대입이 height 속성을
     덮어쓰기 때문에, 여기를 안 보면 레티나에서만 캔버스가 죽는 버그를 놓친다. */
  const grow = JSON.parse(await ev(`(()=>{const c=document.getElementById('c1w');
    window.__dim.go('act1');
    const before=c.height;
    for(let i=0;i<6;i++) window.dispatchEvent(new Event('resize'));
    return JSON.stringify({before, after:c.height, css:Math.round(c.getBoundingClientRect().height)});})()`));
  t('다시 그려도 캔버스 백킹 크기가 안 불어난다', grow.before === grow.after && grow.css < 600, grow);
  await ev(`window.__dim.go('act4'); window.__dim.setStep4('b'); window.__dim.set4(1,1)`);
  await sleep(300);
  scenes.push(['10-좁은 화면 4막', await shot('10-narrow-act4')]);
  await send('Emulation.clearDeviceMetricsOverride');

  const real = errors.filter((e) => !/favicon/i.test(e));
  t('콘솔 오류가 없다', real.length === 0, real.slice(0, 3));
  t('404 가 없다', failed404.length === 0, failed404.slice(0, 3));

  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  console.log(`컷: ${OUT}`);
  if (fail) process.exitCode = 1;
} catch (e) {
  console.error('검증 자체가 죽었다:', e.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
