/* 매트릭스아이큐 — 문항 생성 엔진 (룰베이스, AI 0, 저작권 0).
 * 멘사식 비언어 추론 문항을 규칙으로 무한 생성한다. 공식 문항을 베끼지 않고
 * 규칙만 차용해 자체 생성하므로 저작권 문제 없음.
 *
 * window.ENGINE.generate(type, difficulty) → 정규화된 문항 객체:
 *   { type, difficulty, stemHTML, options:[html...], answer:int, explain:string }
 *
 * 모든 문항은 "정답이 유일하게 결정되는" 규칙만 사용한다 (모호함 방지).
 */
(function () {
  'use strict';

  // ── 작은 유틸 ──
  function ri(n) { return Math.floor(Math.random() * n); }          // 0..n-1
  function pick(a) { return a[ri(a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = ri(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  // 받침 유무로 조사 선택 (예: josa('모양','이','가')='모양이', josa('개수','이','가')='개수가')
  function josa(w, a, b) { var c = w.charCodeAt(w.length - 1); var bat = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; return w + (bat ? a : b); }
  // ── i18n: 앱과 같은 언어. te(ko,en)=엔진 문자열 이중언어. ──
  var LANG = 'ko';
  function te(ko, en) { return (LANG === 'en' && en != null) ? en : ko; }

  // ─────────────────────────────────────────────────────────────
  //  도형 렌더 (SVG)
  // ─────────────────────────────────────────────────────────────
  var FEATS = {
    shape: ['circle', 'square', 'triangle', 'diamond', 'hexagon'],
    color: ['#2f63f4', '#e1473d', '#16a34a'],   // 파랑·빨강·초록
    fill:  [0, 0.5, 1],                          // 채움 = 불투명도
    count: [1, 2, 3],
    rot:   [0, 30, 60, 90],
    size:  [0.5, 0.7, 1.0],   // 인접 간격 40%+ — 크기만 다른 보기도 또렷이 구별
  };
  var FEAT_KR = { shape: '모양', color: '색', fill: '채움', count: '개수', rot: '회전', size: '크기' };
  var FEAT_EN = { shape: 'shape', color: 'color', fill: 'fill', count: 'count', rot: 'rotation', size: 'size' };
  function featL(f) { return (LANG === 'en' ? FEAT_EN : FEAT_KR)[f]; }
  var NAMES_EN = ['Alex', 'Beth', 'Chris', 'Dana', 'Evan', 'Faye', 'Grace', 'Henry', 'Iris', 'Jack'];   // 분석·언어논리 EN 이름
  var COUNT_POS = { 1: [[60, 60]], 2: [[40, 60], [80, 60]], 3: [[60, 40], [40, 82], [80, 82]] };

  function poly(pts, cx, cy, r) {
    return pts.map(function (p) {
      return (cx + p[0] * r).toFixed(1) + ',' + (cy + p[1] * r).toFixed(1);
    }).join(' ');
  }
  function geom(shape, cx, cy, r) {
    switch (shape) {
      case 'circle':   return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '"/>';
      case 'square':   return '<rect x="' + (cx - r).toFixed(1) + '" y="' + (cy - r).toFixed(1) +
                              '" width="' + (2 * r).toFixed(1) + '" height="' + (2 * r).toFixed(1) + '"/>';
      case 'triangle': return '<polygon points="' + poly([[0, -1], [0.87, 0.5], [-0.87, 0.5]], cx, cy, r) + '"/>';
      case 'diamond':  return '<polygon points="' + poly([[0, -1], [1, 0], [0, 1], [-1, 0]], cx, cy, r) + '"/>';
      case 'hexagon':  return '<polygon points="' + poly([[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]], cx, cy, r) + '"/>';
    }
    return '';
  }
  // 하나의 도형 그룹 (색·채움·회전 적용)
  function shapeG(v, cx, cy, r) {
    return '<g fill="' + v.color + '" fill-opacity="' + v.fill + '" stroke="' + v.color +
      '" stroke-width="3" transform="rotate(' + v.rot + ' ' + cx + ' ' + cy + ')">' +
      geom(v.shape, cx, cy, r) + '</g>';
  }
  // 셀 하나 = 특징벡터 v 를 SVG 로
  function cellSVG(v, px) {
    px = px || 120;
    var pos = COUNT_POS[v.count] || COUNT_POS[1];
    var r = (v.count === 1 ? 34 : 24) * v.size;
    var inner = pos.map(function (p) { return shapeG(v, p[0], p[1], r); }).join('');
    return '<svg viewBox="0 0 120 120" width="' + px + '" height="' + px + '" class="cellsvg" aria-hidden="true">' + inner + '</svg>';
  }
  function sig(v) { return [v.shape, v.color, v.fill, v.count, v.rot, v.size].join('|'); }
  // 시각 시그니처: 회전 대칭으로 보이지 않는 차이를 정규화 (원=회전 무의미 등) → 보기끼리 눈으로 구별되게
  function vsig(v) {
    var period = { circle: 1, square: 90, diamond: 90, hexagon: 60, triangle: 120 }[v.shape] || 360;
    var r = period <= 1 ? 0 : (v.rot % period);
    return [v.shape, v.color, v.fill, v.count, r, v.size].join('|');
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 1: 행렬추론 (3×3, affine 규칙)
  //  특징별로 값index = (off + a*row + b*col) mod 3 → 빈칸이 유일하게 결정됨.
  // ─────────────────────────────────────────────────────────────
  function genMatrix(d) {
    d = clamp(d, 1, 5);
    var numActive = clamp(Math.round(d / 1.3), 1, 4);  // d1→1 d2→2 d3→2 d4→3 d5→3~4
    if (d >= 5) numActive = 4;

    // 시각적으로 강한 특징 우선
    var order = shuffle(['shape', 'count', 'fill', 'rot', 'color', 'size']);
    var active = order.slice(0, numActive);
    // 회전이 변하는 특징이면 도형을 삼각형(회전이 또렷이 보이는 도형)으로 고정 — 원·사각 등 대칭도형서 회전 무의미 방지
    var rotActive = active.indexOf('rot') >= 0;
    if (rotActive) active = active.filter(function (f) { return f !== 'shape'; });

    // 각 특징의 후보 3값 + 규칙(a,b) 또는 상수
    var cand = {}, rule = {}, constVal = {};
    Object.keys(FEATS).forEach(function (f) {
      var c = shuffle(FEATS[f]).slice(0, 3);
      cand[f] = c;
      if (active.indexOf(f) >= 0) {
        // a,b ∈ {0,1,2}, 둘 다 0 금지. 낮은 난이도면 한 축만 변하게(한쪽 0).
        var a, b;
        do {
          a = ri(3); b = ri(3);
          if (d <= 2 && a !== 0 && b !== 0) { if (ri(2)) a = 0; else b = 0; }
        } while (a === 0 && b === 0);
        rule[f] = { a: a, b: b, off: ri(3) };
      } else {
        constVal[f] = (rotActive && f === 'shape') ? 'triangle' : c[ri(3)];
      }
    });

    // 3×3 격자 생성
    function vecAt(r, c) {
      var v = {};
      Object.keys(FEATS).forEach(function (f) {
        if (rule[f]) { var idx = ((rule[f].off + rule[f].a * r + rule[f].b * c) % 3 + 3) % 3; v[f] = cand[f][idx]; }
        else v[f] = constVal[f];
      });
      return v;
    }
    var grid = [];
    for (var r = 0; r < 3; r++) { grid[r] = []; for (var c = 0; c < 3; c++) grid[r][c] = vecAt(r, c); }
    var correct = grid[2][2];

    // 보기 만들기 (정답 1 + 오답 5)
    var distract = [];
    active.forEach(function (f) {
      cand[f].forEach(function (val) {
        if (val !== correct[f]) { var w = Object.assign({}, correct); w[f] = val; distract.push(w); }
      });
    });
    // 이웃 셀(흔한 오답): 같은 행/열의 다른 칸
    [grid[2][0], grid[2][1], grid[0][2], grid[1][2], grid[1][1]].forEach(function (w) { distract.push(w); });
    // 비활성 특징 흔들기로 보충
    Object.keys(constVal).forEach(function (f) {
      cand[f].forEach(function (val) {
        if (val !== correct[f]) { var w = Object.assign({}, correct); w[f] = val; distract.push(w); }
      });
    });

    // 정답과 시각적으로 같은 보기 제거 + 시각 중복 제거 (rot 대칭·동일외형 방지)
    var cs = vsig(correct), seen = {}; seen[cs] = true;
    var opts = [];
    shuffle(distract).forEach(function (w) {
      var s = vsig(w);
      if (!seen[s]) { seen[s] = true; opts.push(w); }
    });
    opts = opts.slice(0, 5);
    var all = shuffle(opts.concat([correct]));
    var answer = all.indexOf(correct);

    // 스템 HTML (3×3, 마지막 칸 ?)
    var cells = '';
    for (var rr = 0; rr < 3; rr++) for (var cc = 0; cc < 3; cc++) {
      if (rr === 2 && cc === 2) cells += '<div class="mx-cell mx-q">?</div>';
      else cells += '<div class="mx-cell">' + cellSVG(grid[rr][cc], 96) + '</div>';
    }
    var stemHTML = '<div class="mx-grid">' + cells + '</div>';
    var optHTML = all.map(function (v) { return cellSVG(v, 88); });

    // 해설
    var lines = active.map(function (f) {
      var rl = rule[f], how;
      if (rl.a === 0) how = te('왼쪽→오른쪽으로 바뀜 (각 행은 같은 흐름)', 'changes left→right (each row same flow)');
      else if (rl.b === 0) how = te('위→아래로 바뀜 (각 열은 같은 흐름)', 'changes top→bottom (each column same flow)');
      else how = te('각 가로줄·세로줄에 세 값이 한 번씩 (대각 규칙)', 'each row & column has all three once (diagonal)');
      return '· ' + featL(f) + ': ' + how;
    });
    var feats = active.map(function (f) { return featL(f); }).join('·');
    var explain = (LANG === 'en' ? ('Changing features (' + active.length + '): ' + feats + '\n') : ('변하는 규칙은 ' + feats + ' ' + active.length + '가지입니다.\n')) + lines.join('\n');

    return { type: 'matrix', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: 'v' + active.length, explain: explain };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 2: 수열추리 — 숫자수열 + 문자추리(가나다·알파벳). 같은 카드(수열추리).
  // ─────────────────────────────────────────────────────────────
  // 수열 모호성 검사: 흔한 솔버 규칙들이 shown에 맞을 때 next 가짓수. >1 이면 답이 둘이라 모호.
  function seqNexts(s) {
    var out = {}, m = s.length, d = [], i;
    for (i = 1; i < m; i++) d.push(s[i] - s[i - 1]);
    function add(x) { if (x === Math.round(x)) out[x] = 1; }
    if (d.every(function (x) { return x === d[0]; })) add(s[m - 1] + d[0]);                                    // 등차
    if (s.every(function (x) { return x !== 0; }) && Number.isInteger(s[1] / s[0]) && s.slice(1).every(function (x, j) { return x / s[j] === s[1] / s[0]; })) add(s[m - 1] * (s[1] / s[0])); // 등비
    if (m >= 3 && s.slice(2).every(function (x, j) { return x === s[j] + s[j + 1]; })) add(s[m - 1] + s[m - 2]); // 피보나치
    if (d.length >= 2) { var dd = []; for (i = 1; i < d.length; i++) dd.push(d[i] - d[i - 1]); if (dd.every(function (x) { return x === dd[0]; })) add(s[m - 1] + d[d.length - 1] + dd[0]); } // 차이 등차
    if (d.length >= 2 && d[0] !== 0 && d.every(function (x) { return x !== 0; }) && Number.isInteger(d[1] / d[0]) && d.slice(1).every(function (x, j) { return x / d[j] === d[1] / d[0]; })) add(s[m - 1] + d[d.length - 1] * (d[1] / d[0])); // 차이 ×k
    for (var base = 1; base <= 6; base++) for (var off = -2; off <= 5; off++) { if (s.every(function (x, j) { return x === (base + j) * (base + j) + off; })) add((base + m) * (base + m) + off); } // 제곱
    for (var k = 2; k <= 3; k++) { var c = s[1] - k * s[0]; if (s.slice(1).every(function (x, j) { return x === k * s[j] + c; })) add(k * s[m - 1] + c); } // ×k+c
    if (m >= 6) { var od = s.filter(function (_, j) { return j % 2 === 0; }), ev = s.filter(function (_, j) { return j % 2 === 1; });
      var oa = od.length >= 3 && od.slice(1).every(function (x, j) { return x - od[j] === od[1] - od[0]; }), ea = ev.length >= 3 && ev.slice(1).every(function (x, j) { return x - ev[j] === ev[1] - ev[0]; });
      if (oa && ea) { if (m % 2 === 0) add(od[od.length - 1] + (od[1] - od[0])); else add(ev[ev.length - 1] + (ev[1] - ev[0])); } } // 교차(부분수열 3항+ 일 때만 = 진짜 패턴)
    return Object.keys(out).length;
  }

  // 문자추리: 가나다/알파벳 순서에서 일정 칸씩 건너뛰기. 정답 유일(등차, wrap 없음).
  function genLetterSeq(d) {
    d = clamp(d, 1, 5);
    var ALPHAS = (LANG === 'en')
      ? [{ name: 'the alphabet', AL: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') }]
      : [{ name: '가나다 순서', AL: '가나다라마바사아자차카타파하'.split('') },
         { name: '알파벳 순서', AL: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') }];
    var a = pick(ALPHAS), AL = a.AL, N = AL.length, n = 5;
    var step = d <= 2 ? (1 + ri(2)) : (2 + ri(3));
    var maxStart = N - 1 - step * (n - 1);
    if (maxStart < 0) { step = 1; maxStart = N - 1 - step * (n - 1); }
    var a0 = ri(maxStart + 1), idx = [];
    for (var i = 0; i < n; i++) idx.push(a0 + step * i);
    var correct = idx[n - 1], shown = idx.slice(0, n - 1);
    var set = {}; set[correct] = true; var opts = [];
    [correct + 1, correct - 1, correct - step, correct + step, shown[n - 2] + 1].forEach(function (x) {
      if (x >= 0 && x < N && !set[x]) { set[x] = true; opts.push(x); }
    });
    var tries = 0;
    while (opts.length < 4 && tries++ < 40) { var g = correct + (ri(2) ? 1 : -1) * (1 + ri(3)); if (g >= 0 && g < N && !set[g]) { set[g] = true; opts.push(g); } }
    for (var j = 0; j < N && opts.length < 4; j++) { if (!set[j]) { set[j] = true; opts.push(j); } }   // 결정적 채움(무한루프 방지)
    opts = opts.slice(0, 4);
    var all = shuffle(opts.concat([correct])), answer = all.indexOf(correct);
    var stemHTML = '<div class="seq">' + shown.map(function (x) { return '<span class="seq-n">' + AL[x] + '</span>'; }).join('<span class="seq-c">,</span>') +
      '<span class="seq-c">,</span><span class="seq-n seq-q">?</span></div>';
    var optHTML = all.map(function (x) { return '<span class="opt-num">' + AL[x] + '</span>'; });
    return { type: 'sequence', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: 'letter',
      explain: (LANG === 'en'
        ? ('Rule: skip ' + step + ' in ' + a.name + '.\nNext letter is ' + AL[correct] + '.')
        : ('규칙: ' + a.name + '에서 ' + step + '칸씩 건너뜁니다.\n다음 글자는 ' + AL[correct] + ' 입니다.')) };
  }

  function genSequence(d) {
    d = clamp(d, 1, 5);
    if (ri(3) === 0) return genLetterSeq(d);   // 1/3 확률로 문자추리
    var n = d >= 4 ? 6 : 5;            // 보여줄 항 수 (마지막은 ?)
    var seq, desc, kind;

    function build() {
      var k, a0, i, t;
      if (d <= 1) kind = pick(['add']);
      else if (d === 2) kind = pick(['add', 'mul', 'add']);
      else if (d === 3) kind = pick(['growdiff', 'fib', 'mul']);
      else if (d === 4) kind = pick(['growdiff', 'interleave', 'square']);
      else kind = pick(['interleave', 'muladd', 'geomdiff']);

      seq = [];
      if (kind === 'add') {            // 등차
        k = 2 + ri(7); a0 = 1 + ri(9);
        for (i = 0; i < n; i++) seq.push(a0 + k * i);
        desc = te('+' + k + ' 씩 더해지는 등차수열', 'arithmetic, +' + k + ' each step');
      } else if (kind === 'mul') {     // 등비
        k = 2 + ri(2); a0 = 1 + ri(4);
        for (i = 0; i < n; i++) seq.push(a0 * Math.pow(k, i));
        desc = te('×' + k + ' 씩 곱해지는 등비수열', 'geometric, ×' + k + ' each step');
      } else if (kind === 'growdiff') {// 차이가 등차로 증가
        a0 = 1 + ri(5); var dd = 1 + ri(4), step = 1 + ri(3); t = a0;
        for (i = 0; i < n; i++) { seq.push(t); t += dd; dd += step; }
        desc = te('차이가 +' + step + ' 씩 커지는 수열', 'difference grows by +' + step);
      } else if (kind === 'fib') {     // 앞 두 항의 합
        var x = 1 + ri(3), y = x + ri(4); seq = [x, y];   // y>=x 오름차순 시작 → 규칙 인지 가능
        for (i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
        desc = te('앞의 두 항을 더한 수열', 'sum of the previous two');
      } else if (kind === 'square') {  // 제곱 + 오프셋
        var off = ri(4); var base = 1 + ri(3);
        for (i = 0; i < n; i++) seq.push((base + i) * (base + i) + off);
        desc = te('연속한 수의 제곱' + (off ? ' +' + off : '') + ' 수열', 'consecutive squares' + (off ? ' +' + off : ''));
      } else if (kind === 'interleave') { // 두 수열 교차
        var p = 1 + ri(6), q = 2 + ri(6), pk = 2 + ri(4), qk = 2 + ri(4);
        while (qk === pk) qk = 2 + ri(4);   // 두 부분수열 증가폭이 같으면 교차가 아니므로 다르게
        for (i = 0; i < n; i++) seq.push(i % 2 === 0 ? p + pk * (i / 2 | 0) : q + qk * (i / 2 | 0));
        desc = te('두 수열(홀수번째 +' + pk + ', 짝수번째 +' + qk + ')이 번갈아 나오는 수열', 'two interleaved series (odd +' + pk + ', even +' + qk + ')');
      } else if (kind === 'muladd') {  // ×k +m
        k = 2 + ri(2); var m = 1 + ri(4); t = 1 + ri(3);
        for (i = 0; i < n; i++) { seq.push(t); t = t * k + m; }
        desc = te('×' + k + ' 후 +' + m + ' 을 반복하는 수열', 'repeat ×' + k + ' then +' + m);
      } else {                          // geomdiff: 차이가 ×k
        a0 = 1 + ri(4); var gd = 1 + ri(3), gk = 2; t = a0;
        for (i = 0; i < n; i++) { seq.push(t); t += gd; gd *= gk; }
        desc = te('차이가 ×' + gk + ' 로 커지는 수열', 'difference multiplies by ×' + gk);
      }
    }

    var tries = 0;
    do { build(); tries++; }
    while (tries < 40 && (seq[seq.length - 1] > 9999 || seq.some(function (x) { return x !== Math.round(x); }) || seqNexts(seq.slice(0, n - 1)) > 1));

    var correct = seq[seq.length - 1];
    var shown = seq.slice(0, n - 1);

    // 오답: ±작은수 / 다른 규칙 결과
    var ds = {}; ds[correct] = true; var opts = [];
    [correct + 1, correct - 1, correct + 2, correct - 2,
     shown[shown.length - 1] + (shown[shown.length - 1] - shown[shown.length - 2]),
     correct + pick([3, 4, 5]), correct - pick([3, 4, 5]), Math.round(correct * 1.5)]
      .forEach(function (x) { if (x > 0 && x !== Math.round(x) === false && !ds[x]) { ds[x] = true; opts.push(x); } });
    opts = opts.filter(function (x) { return x > 0; }).slice(0, 4);
    while (opts.length < 4) { var g = correct + (ri(2) ? 1 : -1) * (3 + ri(8)); if (g > 0 && !ds[g]) { ds[g] = true; opts.push(g); } }

    var all = shuffle(opts.concat([correct]));
    var answer = all.indexOf(correct);
    var stemHTML = '<div class="seq">' + shown.map(function (x) { return '<span class="seq-n">' + x + '</span>'; }).join('<span class="seq-c">,</span>') +
      '<span class="seq-c">,</span><span class="seq-n seq-q">?</span></div>';
    var optHTML = all.map(function (x) { return '<span class="opt-num">' + x + '</span>'; });
    return { type: 'sequence', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: kind,
      explain: (LANG === 'en' ? ('Rule: ' + desc + '.\nNext number is ' + correct + '.') : ('규칙: ' + desc + '.\n다음 수는 ' + correct + ' 입니다.')) };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 3: 다른 하나 찾기 (odd one out)
  //  6개 도형 중 5개는 한 가지 특징을 공유, 1개만 깬다.
  // ─────────────────────────────────────────────────────────────
  function genOdd(d) {
    d = clamp(d, 1, 5);
    var ruleFeat = pick(['shape', 'count', 'fill']);   // rot 제외 — 원 등 대칭도형서 회전이 안 보여 정답칸이 안 튐
    var vals = shuffle(FEATS[ruleFeat]);
    var shared = vals[0], oddVal = vals[1];
    // 노이즈 특징 = 비규칙 특징 중 가시성 높은 것부터 (rot 제외 — 원 등 대칭도형서 안 보여 헛노이즈)
    var noisy = ['shape', 'color', 'count', 'fill', 'size'].filter(function (f) { return f !== ruleFeat; });
    var noiseFeats = noisy.slice(0, clamp(d, 2, 4));   // 노이즈 특징 2~4개 = d로 방해 강도↑ (최소 2 → 6칸 distinct 보장)

    var cells = [];
    for (var i = 0; i < 6; i++) {
      cells.push({ shape: 'circle', color: FEATS.color[0], fill: 1, count: 1, rot: 0, size: 1.0 });
      cells[i][ruleFeat] = shared;
    }
    // 앞 2개(가장 가시적인) 노이즈 특징으로 균형 그리드: 각 값 2회(싱글톤 없음→두번째 odd 방지)
    //  + 6개 (값,값) 조합이 모두 달라 6칸이 전부 시각적으로 구별됨.
    var grid = shuffle([[0, 0], [1, 1], [2, 2], [0, 1], [1, 2], [2, 0]]);
    var g0 = noiseFeats[0], g1 = noiseFeats[1];
    var gv0 = shuffle(FEATS[g0]).slice(0, 3), gv1 = shuffle(FEATS[g1]).slice(0, 3);
    cells.forEach(function (c, idx) { c[g0] = gv0[grid[idx][0]]; c[g1] = gv1[grid[idx][1]]; });
    // 추가 노이즈 특징은 균형 배치(각 값 2회 — 싱글톤 없음)
    noiseFeats.slice(2).forEach(function (f) {
      var pool = shuffle(FEATS[f]).slice(0, 3), arr = [];
      [2, 2, 2].forEach(function (cnt, ci) { for (var j = 0; j < cnt; j++) arr.push(pool[ci]); });
      arr = shuffle(arr);
      cells.forEach(function (c, idx) { c[f] = arr[idx]; });
    });
    var oddIdx = ri(6);
    cells[oddIdx][ruleFeat] = oddVal;

    var stemHTML = '<div class="odd-grid">' + cells.map(function (v, i) {
      return '<div class="odd-cell" data-i="' + i + '">' + cellSVG(v, 92) + '<span class="odd-lab">' + (i + 1) + '</span></div>';
    }).join('') + '</div>';
    var optHTML = cells.map(function (v, i) { return '<span class="opt-num">' + (i + 1) + '</span>'; });
    return { type: 'odd', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: oddIdx, tag: ruleFeat,
      explain: (LANG === 'en'
        ? ('The other five share the same ' + featL(ruleFeat) + '.\nOnly #' + (oddIdx + 1) + ' differs.')
        : ('나머지 다섯은 ' + josa(FEAT_KR[ruleFeat], '이', '가') + ' 모두 같습니다.\n' + (oddIdx + 1) + '번만 ' + josa(FEAT_KR[ruleFeat], '이', '가') + ' 다릅니다.')) };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 4: 응용수리 (계산) — 거리·농도·비율·경우의수 등. 정답=유일한 정수.
  //  모든 템플릿은 정수 답이 나오도록 파라미터를 제약한다 (모호함 0).
  // ─────────────────────────────────────────────────────────────
  // 자료해석 — 표(구성비/수치) 읽고 계산. 정답=정수 유일. 응용수리 카드에 흡수.
  function genDataTable(d) {
    d = clamp(d, 1, 5);
    var EN = (LANG === 'en');
    var labels = pick(EN ? [['A', 'B', 'C', 'D'], ['P', 'Q', 'R', 'S'], ['Jan', 'Feb', 'Mar', 'Apr'], ['North', 'South', 'East', 'West']]
      : [['A', 'B', 'C', 'D'], ['가', '나', '다', '라'], ['1월', '2월', '3월', '4월'], ['서울', '부산', '대구', '광주']]);
    var mode = pick(['comp', 'count']), vals, cap, q, ans, ds;
    if (mode === 'comp') {                       // 구성비(합 100%)
      vals = [20, 20, 20, 20]; for (var k = 0; k < 4; k++) vals[ri(4)] += 5;
      if (Math.max.apply(null, vals) === Math.min.apply(null, vals)) { vals[0] += 5; vals[1] -= 5; }   // 전부 동일이면 스프레드(합100 유지, 차이 답 0 방지)
      cap = te('항목별 구성비 (%)', 'Share by item (%)');
      var ck = pick(['pair', 'diff', 'max']);
      if (ck === 'pair') { var i = ri(4), j; do { j = ri(4); } while (j === i); ans = vals[i] + vals[j]; q = EN ? (labels[i] + ' and ' + labels[j] + ' — sum of their shares? (%)') : (josa(labels[i], '과', '와') + ' ' + labels[j] + ' 구성비의 합은? (%)'); ds = [Math.abs(vals[i] - vals[j]), vals[i], vals[j]]; }
      else if (ck === 'diff') { var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals); ans = mx - mn; q = te('구성비가 가장 높은 항목과 가장 낮은 항목의 차이는? (%p)', 'Difference between the highest and lowest share? (%p)'); ds = [mx, mn, mx + mn]; }
      else { ans = Math.max.apply(null, vals); q = te('구성비가 가장 높은 항목의 값은? (%)', 'What is the highest share? (%)'); ds = [Math.min.apply(null, vals), ans - 5, ans + 5]; }
    } else {                                     // 수치
      vals = []; for (var m = 0; m < 4; m++) vals.push(10 + ri(11) * 5);
      while (Math.max.apply(null, vals) === Math.min.apply(null, vals)) vals[ri(4)] += 5;   // 전부 동일 방지(차이 답 0)
      cap = pick([te('항목별 판매 건수 (건)', 'Sales by item (count)'), te('항목별 방문자 수 (명)', 'Visitors by item (people)'), te('항목별 생산량 (개)', 'Output by item (units)')]);
      var nk = pick(['sum', 'diff', 'pair', 'max']);
      if (nk === 'sum') { ans = vals.reduce(function (a, b) { return a + b; }, 0); q = te('네 항목의 합계는?', 'What is the total of all four items?'); ds = [ans - vals[ri(4)], Math.max.apply(null, vals), ans + 10]; }
      else if (nk === 'diff') { ans = Math.max.apply(null, vals) - Math.min.apply(null, vals); q = te('최댓값과 최솟값의 차이는?', 'Difference between the max and min?'); ds = [Math.max.apply(null, vals), Math.min.apply(null, vals), ans + 5]; }
      else if (nk === 'pair') { var p = ri(4), r; do { r = ri(4); } while (r === p); ans = vals[p] + vals[r]; q = EN ? (labels[p] + ' and ' + labels[r] + ' — what is their sum?') : (josa(labels[p], '과', '와') + ' ' + labels[r] + '의 합은?'); ds = [Math.abs(vals[p] - vals[r]), vals[p], vals[r]]; }
      else { ans = Math.max.apply(null, vals); q = te('가장 큰 값은?', 'What is the largest value?'); ds = [Math.min.apply(null, vals), ans - 5, ans + 5]; }
    }
    var set = {}; set[ans] = true; var opts = [];
    ds.forEach(function (x) { x = Math.round(x); if (x > 0 && !set[x]) { set[x] = true; opts.push(x); } });
    var tries = 0;
    while (opts.length < 4 && tries++ < 40) { var g = Math.round(ans + (ri(2) ? 1 : -1) * (5 + ri(3) * 5)); if (g > 0 && !set[g]) { set[g] = true; opts.push(g); } }
    while (opts.length < 4) { var f = ans + (opts.length + 1) * 5; if (!set[f]) { set[f] = true; opts.push(f); } else set[f] = true; }
    opts = opts.slice(0, 4);
    var all = shuffle(opts.concat([ans])), answer = all.indexOf(ans);
    var table = '<table class="dt"><thead><tr>' + labels.map(function (l) { return '<th>' + l + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody><tr>' + vals.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr></tbody></table>';
    var stemHTML = '<div class="dt-wrap"><div class="dt-cap">' + cap + '</div>' + table + '<div class="dt-q">' + q + '</div></div>';
    var optHTML = all.map(function (x) { return '<span class="opt-num">' + x + '</span>'; });
    return { type: 'calc', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: 'data', explain: te('정답은 ', 'The answer is ') + ans + te(' 입니다.', '.') };
  }

  function genCalc(d) {
    d = clamp(d, 1, 5);
    if (ri(3) === 0) return genDataTable(d);   // 1/3 확률로 자료해석
    var easy = ['speed', 'avg', 'ratio', 'discount'];
    var mid = ['conc', 'time', 'grow'];
    var hard = ['perm', 'conc', 'grow'];
    var pool = d <= 2 ? easy : d === 3 ? easy.concat(mid) : d === 4 ? mid : mid.concat(hard);
    var kind = pick(pool), q, ans, ds = [];

    var EN = (LANG === 'en');
    if (kind === 'speed') {                 // 거리 = 속력 × 시간
      var v = pick([20, 30, 40, 50, 60]), t = pick([2, 3, 4, 5]);
      ans = v * t; q = EN ? ('A car goes ' + v + ' km/h for ' + t + ' hours. How far does it travel? (km)') : ('시속 ' + v + 'km로 ' + t + '시간 동안 달린 거리는? (km)');
      ds = [v + t, v * (t + 1), v * (t - 1), v];
    } else if (kind === 'time') {            // 시간 = 거리 ÷ 속력
      var v2 = pick([20, 30, 40, 60]), t2 = pick([2, 3, 4, 5]), dist = v2 * t2;
      ans = t2; q = EN ? ('How long to cover ' + dist + ' km at ' + v2 + ' km/h? (hours)') : (dist + 'km 거리를 시속 ' + v2 + 'km로 갈 때 걸리는 시간은? (시간)');
      ds = [t2 + 1, t2 + 2, dist - v2, t2 * 2];
    } else if (kind === 'avg') {             // 평균
      var base = pick([12, 15, 18, 20, 24, 30]), g = pick([2, 3, 4]);
      ans = base; q = EN ? ('What is the average of ' + (base - g) + ', ' + base + ', ' + (base + g) + '?') : ((base - g) + ', ' + base + ', ' + (base + g) + ' 세 수의 평균은?');
      ds = [base + g, base - g, (base - g) + base + (base + g), base + 1];
    } else if (kind === 'ratio') {           // 비율(%)
      var whole = pick([200, 300, 400, 500]), r = pick([10, 20, 25, 30, 40]);
      ans = whole * r / 100; q = EN ? ('What is ' + r + '% of ' + whole + '? (people)') : (whole + '명의 ' + r + '%는 몇 명? (명)');
      ds = [whole - ans, ans + 10, r, ans * 2];
    } else if (kind === 'discount') {        // 할인가
      var p = pick([10000, 12000, 15000, 20000, 25000]), dr = pick([10, 20, 25, 30]);
      ans = p * (100 - dr) / 100; q = EN ? ('A ₩' + p + ' item is ' + dr + '% off. What is the sale price? (₩)') : ('정가 ' + p + '원인 상품을 ' + dr + '% 할인한 판매가는? (원)');
      ds = [p * dr / 100, ans - 1000, ans + 1000, p];
    } else if (kind === 'conc') {            // 농도 → 소금량
      var c = pick([5, 10, 15, 20, 25]), m = pick([200, 300, 400, 500]);
      ans = m * c / 100; q = EN ? ('How much salt is in ' + m + ' g of ' + c + '% salt water? (g)') : ('농도 ' + c + '%인 소금물 ' + m + 'g에 들어 있는 소금의 양은? (g)');
      ds = [c, m - ans, ans + 10, ans * 2];
    } else if (kind === 'perm') {            // 순열 nP2
      var nn = pick([4, 5, 6, 7]);
      ans = nn * (nn - 1); q = EN ? ('How many ways to arrange 2 of ' + nn + ' distinct items in order? (ways)') : ('서로 다른 ' + nn + '개에서 2개를 뽑아 순서대로 나열하는 경우의 수는? (가지)');
      ds = [nn * nn, nn * (nn - 1) / 2, nn + 2, nn * (nn - 1) * (nn - 2)];
    } else {                                 // grow: 증가율
      var a0 = pick([20, 40, 80, 100]), inc = pick([10, 20, 25, 50]), b0 = a0 * (100 + inc) / 100;
      ans = inc; q = EN ? ('If a value grows from ' + a0 + ' to ' + b0 + ', what is the growth rate? (%)') : (a0 + te('에서 ', ' in ') + b0 + '까지 늘었다면 증가율은? (%)');
      ds = [b0 - a0, inc + 5, inc + 10, b0 - inc];
    }

    var set = {}; set[ans] = true; var opts = [];
    ds.forEach(function (x) { x = Math.round(x); if (x > 0 && !set[x]) { set[x] = true; opts.push(x); } });
    while (opts.length < 4) {
      var sp = Math.max(2, Math.round(Math.abs(ans) * 0.2));
      var g2 = Math.round(ans + (ri(2) ? 1 : -1) * (1 + ri(sp)));
      if (g2 > 0 && !set[g2]) { set[g2] = true; opts.push(g2); }
    }
    opts = opts.slice(0, 4);
    var all = shuffle(opts.concat([ans])), answer = all.indexOf(ans);
    var stemHTML = '<div class="calc-q">' + q + '</div>';
    var optHTML = all.map(function (x) { return '<span class="opt-num">' + x + '</span>'; });
    return { type: 'calc', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: kind,
      explain: te('정답은 ', 'The answer is ') + ans + te(' 입니다.', '.') };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 5: 언어논리 (순서배열·삼단논법·대우) — 문장형. 정답=유일.
  //  조사(josa)로 한국어 정합. 옵션은 문장(텍스트).
  // ─────────────────────────────────────────────────────────────
  function genVerbal(d) {
    d = clamp(d, 1, 5);
    var kinds = d <= 1 ? ['order', 'contra'] : d === 2 ? ['order', 'contra', 'syllog']
      : d <= 4 ? ['order', 'syllog', 'contra'] : ['order', 'syllog', 'order'];
    var kind = pick(kinds), facts = [], ask = '', optList = [], ansVal;

    var EN = (LANG === 'en');
    if (kind === 'order') {                    // 순서배열
      var names = shuffle(EN ? NAMES_EN.slice() : ['민수', '지영', '현우', '수빈', '태호', '은지', '준서', '하늘', '서연', '도윤']);
      var N = clamp(d + 2, 3, 5), ord = names.slice(0, N);   // ord[0] = 최상위
      var rel = EN ? pick([
        { st: 'is taller than', big: 'tallest', small: 'shortest' },
        { st: 'is older than', big: 'oldest', small: 'youngest' },
        { st: 'scored higher than', big: 'highest scorer', small: 'lowest scorer' },
        { st: 'runs faster than', big: 'fastest', small: 'slowest' },
      ]) : pick([
        { st: '키가 크다', big: '키가 가장 큰', small: '키가 가장 작은' },
        { st: '나이가 많다', big: '나이가 가장 많은', small: '나이가 가장 적은' },
        { st: '점수가 높다', big: '점수가 가장 높은', small: '점수가 가장 낮은' },
        { st: '달리기가 빠르다', big: '달리기가 가장 빠른', small: '달리기가 가장 느린' },
      ]);
      var stmts = [];
      for (var i = 0; i < N - 1; i++) stmts.push(EN ? (ord[i] + ' ' + rel.st + ' ' + ord[i + 1] + '.') : (josa(ord[i], '은', '는') + ' ' + ord[i + 1] + '보다 ' + rel.st + '.'));
      facts = shuffle(stmts);
      var askMax = ri(2);
      ask = EN ? ('Who is the ' + (askMax ? rel.big : rel.small) + '?') : ('다음 중 ' + (askMax ? rel.big : rel.small) + ' 사람은?');
      ansVal = askMax ? ord[0] : ord[N - 1];
      optList = shuffle(ord);
    } else if (kind === 'syllog') {            // 삼단논법 (Barbara — 유효형만)
      var pool = shuffle(EN ? ['students', 'members', 'athletes', 'artists', 'citizens', 'staff', 'experts', 'readers', 'vegetarians', 'musicians']
        : ['학생', '회원', '운동선수', '예술가', '시민', '직원', '전문가', '독서가', '채식주의자', '음악가']);
      var A = pool[0], B = pool[1], C = pool[2];
      if (EN) {
        facts = ['All ' + A + ' are ' + B + '.', 'All ' + B + ' are ' + C + '.'];
        ask = 'If both statements are true, which must be true?';
        ansVal = 'All ' + A + ' are ' + C + '.';
        optList = shuffle([ansVal, 'All ' + C + ' are ' + A + '.', 'Some ' + A + ' are not ' + C + '.', 'All ' + B + ' are ' + A + '.']);
      } else {
        facts = ['모든 ' + josa(A, '은', '는') + ' ' + josa(B, '이다', '다') + '.',
                 '모든 ' + josa(B, '은', '는') + ' ' + josa(C, '이다', '다') + '.'];
        ask = '위 두 문장이 참일 때 반드시 참인 것은?';
        ansVal = '모든 ' + josa(A, '은', '는') + ' ' + josa(C, '이다', '다') + '.';
        optList = shuffle([ansVal,
          '모든 ' + josa(C, '은', '는') + ' ' + josa(A, '이다', '다') + '.',
          '어떤 ' + josa(A, '은', '는') + ' ' + josa(C, '이', '가') + ' 아니다.',
          '모든 ' + josa(B, '은', '는') + ' ' + josa(A, '이다', '다') + '.']);
      }
    } else {                                   // 대우
      var pr = pick(EN ? [
        { p: 'If it rains, the ground gets wet', dae: 'If the ground is not wet, it did not rain', yeok: 'If the ground is wet, it rained', i: 'If it does not rain, the ground stays dry', un: 'If it rains, the ground dries out' },
        { p: 'If you pass, you are happy', dae: 'If you are not happy, you did not pass', yeok: 'If you are happy, you passed', i: 'If you do not pass, you are not happy', un: 'If you pass, you are sad' },
        { p: 'If you exercise, you get healthy', dae: 'If you are not healthy, you did not exercise', yeok: 'If you are healthy, you exercised', i: 'If you do not exercise, you do not get healthy', un: 'If you exercise, you get tired' },
        { p: 'If it is Tuesday, there is a meeting', dae: 'If there is no meeting, it is not Tuesday', yeok: 'If there is a meeting, it is Tuesday', i: 'If it is not Tuesday, there is no meeting', un: 'If it is Tuesday, it is a day off' },
        { p: 'If it is metal, it conducts electricity', dae: 'If it does not conduct electricity, it is not metal', yeok: 'If it conducts electricity, it is metal', i: 'If it is not metal, it does not conduct electricity', un: 'If it is metal, it glows' },
      ] : [
        { p: '비가 오면 길이 젖는다', dae: '길이 젖지 않으면 비가 오지 않는다', yeok: '길이 젖으면 비가 온다', i: '비가 오지 않으면 길이 젖지 않는다', un: '비가 오면 길이 마른다' },
        { p: '합격하면 기뻐한다', dae: '기뻐하지 않으면 합격하지 않은 것이다', yeok: '기뻐하면 합격한 것이다', i: '합격하지 않으면 기뻐하지 않는다', un: '합격하면 슬퍼한다' },
        { p: '운동하면 건강해진다', dae: '건강해지지 않으면 운동하지 않은 것이다', yeok: '건강해지면 운동한 것이다', i: '운동하지 않으면 건강해지지 않는다', un: '운동하면 피곤해진다' },
        { p: '화요일이면 회의가 있다', dae: '회의가 없으면 화요일이 아니다', yeok: '회의가 있으면 화요일이다', i: '화요일이 아니면 회의가 없다', un: '화요일이면 쉬는 날이다' },
        { p: '금속이면 전기가 통한다', dae: '전기가 통하지 않으면 금속이 아니다', yeok: '전기가 통하면 금속이다', i: '금속이 아니면 전기가 통하지 않는다', un: '금속이면 빛을 낸다' },
      ]);
      facts = [EN ? ("Suppose '" + pr.p + "' is true.") : ("'" + pr.p + "' 가 참이라고 하자.")];
      ask = EN ? 'Which of the following must be true?' : '위 명제가 참일 때 반드시 참인 것은?';
      ansVal = pr.dae;
      optList = shuffle([pr.dae, pr.yeok, pr.i, pr.un]);
    }

    var answer = optList.indexOf(ansVal);
    var stemHTML = '<div class="verbal-q"><div class="vq-facts">' +
      facts.map(function (f) { return '<div>' + f + '</div>'; }).join('') +
      '</div><div class="vq-ask">' + ask + '</div></div>';
    return { type: 'verbal', difficulty: d, stemHTML: stemHTML, options: optList, answer: answer, tag: kind,
      explain: te('정답: ', 'Answer: ') + ansVal };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 6: 공간지각 (회전·대칭) — 비대칭 폴리오미노+마커.
  //  5방위(0·90·180·270·거울)가 모두 distinct하도록 보장 → 모호성 0.
  // ─────────────────────────────────────────────────────────────
  // 블록 개수(쌓기나무) — 2×2 바닥에 높이별 정육면체. 정답=총 개수. 공간지각에 흡수.
  function genBlocks(d) {
    d = clamp(d, 1, 5);
    var maxH = 2 + Math.floor((d - 1) / 2), H = [[0, 0], [0, 0]], total, occ;   // 최대 높이 2~4 = d로 개수↑
    do {
      total = 0; occ = 0;
      for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) { var h = ri(maxH + 1); H[r][c] = h; total += h; if (h) occ++; }
    } while (total < 3 || occ < 3);
    var S = 20, hS = 10, CH = 20, cx = 75, cy = 90, cubes = [];
    for (var r2 = 0; r2 < 2; r2++) for (var c2 = 0; c2 < 2; c2++) for (var z = 0; z < H[r2][c2]; z++) cubes.push({ c: c2, r: r2, z: z });
    cubes.sort(function (a, b) { return (a.c + a.r) - (b.c + b.r) || a.z - b.z; });
    var g = cubes.map(function (q) {
      var x = cx + (q.c - q.r) * S, y = cy + (q.c + q.r) * hS - q.z * CH;
      var top = x + ',' + (y - hS) + ' ' + (x + S) + ',' + y + ' ' + x + ',' + (y + hS) + ' ' + (x - S) + ',' + y;
      var lf = (x - S) + ',' + y + ' ' + x + ',' + (y + hS) + ' ' + x + ',' + (y + hS + CH) + ' ' + (x - S) + ',' + (y + CH);
      var rt = x + ',' + (y + hS) + ' ' + (x + S) + ',' + y + ' ' + (x + S) + ',' + (y + CH) + ' ' + x + ',' + (y + hS + CH);
      return '<polygon points="' + lf + '" fill="#c2c9ee" stroke="#5a6080" stroke-width="1"/>' +
        '<polygon points="' + rt + '" fill="#9aa0bd" stroke="#5a6080" stroke-width="1"/>' +
        '<polygon points="' + top + '" fill="#eef0ff" stroke="#5a6080" stroke-width="1"/>';
    }).join('');
    var stemHTML = '<div class="sp-q"><div class="sp-fig"><svg class="cellsvg" viewBox="0 0 150 150">' + g + '</svg></div>' +
      te('<div class="sp-ask">쌓인 블록(정육면체)은 모두 몇 개?</div></div>', '<div class="sp-ask">How many cubes are stacked in total?</div></div>');
    var set = {}; set[total] = true; var opts = [];
    [total + 1, total - 1, total + 2, total - 2].forEach(function (x) { if (x > 0 && !set[x]) { set[x] = true; opts.push(x); } });
    while (opts.length < 4) { var gg = total + (ri(2) ? 1 : -1) * (1 + ri(3)); if (gg > 0 && !set[gg]) { set[gg] = true; opts.push(gg); } }
    opts = opts.slice(0, 4);
    var all = shuffle(opts.concat([total])), answer = all.indexOf(total);
    var optHTML = all.map(function (x) { return '<span class="opt-num">' + x + '</span>'; });
    return { type: 'spatial', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: 'blocks',
      explain: te('칸별 높이를 모두 더하면 ', 'Adding the height of each column gives ') + total + te('개입니다.', ' cubes.') };
  }

  function genSpatial(d) {
    d = clamp(d, 1, 5);
    if (d >= 2 && ri(3) === 0) return genBlocks(d);   // 1/3 확률로 블록 개수
    var SHAPES = [
      [[0, 0], [1, 0], [2, 0], [2, 1]],            // L
      [[0, 0], [0, 1], [1, 1], [2, 1]],            // J
      [[0, 1], [1, 1], [1, 0], [2, 0]],            // S
      [[0, 0], [1, 0], [1, 1], [2, 1]],            // Z
      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],    // 큰 L (펜토미노)
      [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],    // 계단
      [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],    // ㄴ
    ];
    function nrm(cs) {
      var mx = Math.min.apply(null, cs.map(function (c) { return c[0]; })), my = Math.min.apply(null, cs.map(function (c) { return c[1]; }));
      return cs.map(function (c) { return [c[0] - mx, c[1] - my]; });
    }
    function rot(cs) { return nrm(cs.map(function (c) { return [c[1], -c[0]]; })); }   // 시계 90°
    function mir(cs) { return nrm(cs.map(function (c) { return [-c[0], c[1]]; })); }   // 좌우 반전
    function fkey(cs, mi) { return cs.map(function (c) { return c.join(','); }).sort().join(';') + '|' + cs[mi].join(','); }
    function svg(cs, mi) {
      var w = Math.max.apply(null, cs.map(function (c) { return c[0]; })) + 1;
      var h = Math.max.apply(null, cs.map(function (c) { return c[1]; })) + 1;
      var side = Math.max(w, h), S = 22, ox = (side - w) / 2, oy = (side - h) / 2, V = side * S, r = '';
      cs.forEach(function (c, i) {
        var x = (c[0] + ox) * S, y = (c[1] + oy) * S, mk = (i === mi);
        r += '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (S - 4) + '" height="' + (S - 4) + '" rx="3" fill="' + (mk ? '#5b6cff' : '#fff') + '" stroke="' + (mk ? '#5b6cff' : '#2a3057') + '" stroke-width="2"/>';
      });
      return '<svg class="cellsvg" viewBox="0 0 ' + V + ' ' + V + '">' + r + '</svg>';
    }

    // 도형 크기 = d로 난도↑ (저d 4칸 테트로미노, 고d 5칸 펜토미노 = 회전 추적 어려움)
    var shapePool = d <= 2 ? SHAPES.slice(0, 4) : d === 3 ? SHAPES : SHAPES.slice(4);
    var oris, mi, tries = 0;
    do {
      var sh = pick(shapePool).map(function (c) { return c.slice(); });
      mi = ri(sh.length);
      var ir = ri(4); for (var k = 0; k < ir; k++) sh = rot(sh);
      if (ri(2)) sh = mir(sh);
      oris = [sh, rot(sh), rot(rot(sh)), rot(rot(rot(sh))), mir(sh)];   // 0·90·180·270·거울
      tries++;
    } while (tries < 25 && (function () { var s = {}; for (var j = 0; j < 5; j++) s[fkey(oris[j], mi)] = 1; return Object.keys(s).length !== 5; })());

    var kind = d <= 2 ? 'rotate' : d >= 5 ? pick(['mirror', 'rotate', 'mirror']) : pick(['rotate', 'mirror', 'rotate']);
    var deg = pick([90, 180, 270]), correctOri, ask;
    if (kind === 'mirror') { correctOri = 4; ask = te('위 도형을 좌우로 뒤집으면(거울상)?', 'Mirror the figure left–right — which one?'); }
    else { correctOri = deg / 90; ask = te('위 도형을 시계 방향으로 ' + deg + '° 돌리면?', 'Rotate the figure ' + deg + '° clockwise — which one?'); }

    var order = shuffle([0, 1, 2, 3, 4]);
    var optHTML = order.map(function (i) { return svg(oris[i], mi); });
    var answer = order.indexOf(correctOri);
    var stemHTML = '<div class="sp-q"><div class="sp-fig">' + svg(oris[0], mi) + '</div><div class="sp-ask">' + ask + '</div></div>';
    return { type: 'spatial', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, tag: kind,
      explain: te('파란 칸의 위치로 방향을 추적하면 정답을 찾을 수 있습니다.', 'Track the blue cell to work out the orientation.') };
  }

  // ─────────────────────────────────────────────
  //  타입 7: 분석추론 (제약 논리 퍼즐)
  //  정답 순서를 먼저 정함 → 참인 조건들을 뽑아 유일해가 될 때까지 추가 →
  //  N! 완전탐색으로 해의 개수 ==1 을 강제 (모호성0 by construction).
  //  명시적 조건이라 "복수 규칙" 모호성이 없음. 조건은 텍스트, 보기도 텍스트.
  // ─────────────────────────────────────────────
  function permsOf(n) {
    var res = [], a = []; for (var i = 0; i < n; i++) a.push(i);
    (function rec(k) {
      if (k === n) { res.push(a.slice()); return; }
      for (var i = k; i < n; i++) { var t = a[k]; a[k] = a[i]; a[i] = t; rec(k + 1); t = a[k]; a[k] = a[i]; a[i] = t; }
    })(0);
    return res;
  }
  function iota(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function genAnalytic(d) {
    d = clamp(d, 1, 5);
    var N = clamp(3 + Math.round(d / 1.5), 4, 6);    // d1~2:4 d3:5 d4~5:6
    var ALLPERMS = permsOf(N);
    // 주어진 조건 집합의 해(배치) 개수. cand[pos]=entIdx, P[entIdx]=pos.
    function count(cons) {
      var c = 0;
      for (var i = 0; i < ALLPERMS.length; i++) {
        var cand = ALLPERMS[i], P = []; for (var p = 0; p < N; p++) P[cand[p]] = p;
        var ok = true; for (var j = 0; j < cons.length; j++) if (!cons[j].fn(P)) { ok = false; break; }
        if (ok && ++c > 1) break;
      }
      return c;
    }
    var EN = (LANG === 'en');
    var chosen = null, names, order;
    for (var tries = 0; tries < 25 && !chosen; tries++) {
      names = shuffle(EN ? NAMES_EN.slice() : ['민수', '지영', '현우', '수빈', '태호', '은지', '준서', '하늘', '서연', '도윤']).slice(0, N);
      order = shuffle(iota(N));                       // order[pos] = entIdx (1번=맨 왼쪽)
      var pos = []; for (var k = 0; k < N; k++) pos[order[k]] = k;   // pos[entIdx] = position
      var pool = [];
      function addC(text, fn, meta) { if (fn(pos)) pool.push(Object.assign({ text: text, fn: fn }, meta || {})); }
      // 모든 before 쌍 (전체 집합은 전순서 → 유일성 도달 보장)
      for (var a = 0; a < N; a++) for (var b = 0; b < N; b++) if (a !== b)
        (function (a, b) { addC(EN ? (names[a] + ' is to the left of ' + names[b] + '.') : (josa(names[a], '은', '는') + ' ' + names[b] + '보다 왼쪽에 있다.'), function (P) { return P[a] < P[b]; }); })(a, b);
      // 절대 위치 (1~2개만 — 너무 많으면 시시)
      shuffle(iota(N)).slice(0, d <= 2 ? 2 : 1).forEach(function (e) {
        (function (e) { addC(EN ? (names[e] + ' is in seat ' + (pos[e] + 1) + '.') : (josa(names[e], '은', '는') + ' ' + (pos[e] + 1) + '번 자리이다.'), function (P) { return P[e] === pos[e]; }, { absPos: pos[e] }); })(e);
      });
      // 이웃 / 바로 오른쪽 / 비이웃
      for (var a2 = 0; a2 < N; a2++) for (var b2 = a2 + 1; b2 < N; b2++) (function (a, b) {
        addC(EN ? (names[a] + ' and ' + names[b] + ' are next to each other.') : (josa(names[a], '과', '와') + ' ' + josa(names[b], '은', '는') + ' 바로 옆이다.'), function (P) { return Math.abs(P[a] - P[b]) === 1; });
        if (d >= 3) addC(EN ? (names[b] + ' is immediately to the right of ' + names[a] + '.') : (names[a] + ' 바로 오른쪽에 ' + josa(names[b], '이', '가') + ' 있다.'), function (P) { return P[a] + 1 === P[b]; });
        if (d >= 3) addC(EN ? (names[a] + ' is immediately to the right of ' + names[b] + '.') : (names[b] + ' 바로 오른쪽에 ' + josa(names[a], '이', '가') + ' 있다.'), function (P) { return P[b] + 1 === P[a]; });
        if (d >= 5) addC(EN ? (names[a] + ' and ' + names[b] + ' are not next to each other.') : (josa(names[a], '과', '와') + ' ' + josa(names[b], '은', '는') + ' 이웃이 아니다.'), function (P) { return Math.abs(P[a] - P[b]) !== 1; });
      })(a2, b2);
      // 사이 (난이도 3+)
      if (d >= 3) for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) for (var z = x + 1; z < N; z++) if (y !== x && y !== z)
        (function (x, y, z) { addC(EN ? (names[y] + ' is between ' + names[x] + ' and ' + names[z] + '.') : (josa(names[y], '은', '는') + ' ' + josa(names[x], '과', '와') + ' ' + names[z] + ' 사이에 있다.'), function (P) { return (P[x] < P[y] && P[y] < P[z]) || (P[z] < P[y] && P[y] < P[x]); }); })(x, y, z);
      // 그리디: 유일해 될 때까지 추가
      var sp = shuffle(pool), cur = [];
      for (var i = 0; i < sp.length; i++) { cur.push(sp[i]); if (count(cur) === 1) break; }
      if (count(cur) !== 1) continue;
      // prune: 빼도 유일하면 제거 (최소·깔끔)
      for (var i = cur.length - 1; i >= 0; i--) {
        var t = cur.slice(0, i).concat(cur.slice(i + 1));
        if (count(t) === 1) cur = t;
      }
      if (cur.length < 2 || cur.length > 6) continue;   // 시시함·가독성 컷
      chosen = cur;
    }
    if (!chosen) return genVerbal(d);                    // 극히 드문 실패 → 대체
    var orderStr = order.map(function (e) { return names[e]; }).join(' - ');
    var facts = [EN ? ('<b>' + N + '</b> people sit in a row, seats 1 to ' + N + '. (seat 1 is far left)') : ('<b>' + N + '명</b>이 한 줄로 1번부터 ' + N + '번 자리에 앉아 있다. (1번이 맨 왼쪽)')]
      .concat(chosen.map(function (c) { return c.text; }));
    var ask, optList, ansVal, explain;
    // 절대조건으로 이미 박힌 자리는 질문에서 제외(추론 없이 답 노출 = 시시함 방지)
    var pinned = {}; chosen.forEach(function (c) { if (c.absPos != null) pinned[c.absPos] = 1; });
    var freePos = []; for (var fp = 0; fp < N; fp++) if (!pinned[fp]) freePos.push(fp);
    if (ri(3) === 0 || !freePos.length) {
      ask = EN ? 'From seat 1 (far left), what is the correct order?' : '왼쪽(1번)부터 순서대로 바르게 나열한 것은?';
      ansVal = orderStr;
      var others = shuffle(ALLPERMS).filter(function (c) { return c.join(',') !== order.join(','); }).slice(0, 4)
        .map(function (c) { return c.map(function (e) { return names[e]; }).join(' - '); });
      optList = shuffle([ansVal].concat(others));
      explain = EN ? ('Combining the clues, the only arrangement is ' + orderStr + '.') : ('조건을 종합하면 유일한 배치는 ' + orderStr + ' 입니다.');
    } else {
      var qp = pick(freePos);
      ask = EN ? ('Who is in seat ' + (qp + 1) + '?') : ((qp + 1) + '번 자리에 앉은 사람은?');
      ansVal = names[order[qp]];
      optList = shuffle(names.slice());
      explain = EN ? ('The only arrangement is ' + orderStr + '. So seat ' + (qp + 1) + ' is ' + ansVal + '.') : ('유일한 배치는 ' + orderStr + '. 따라서 ' + (qp + 1) + '번은 ' + ansVal + ' 입니다.');
    }
    var stemHTML = '<div class="verbal-q"><div class="vq-facts">' +
      facts.map(function (f) { return '<div>' + f + '</div>'; }).join('') +
      '</div><div class="vq-ask">' + ask + '</div></div>';
    return { type: 'analytic', difficulty: d, stemHTML: stemHTML, options: optList, answer: optList.indexOf(ansVal), explain: explain, text: true, tag: 'seat' };
  }

  // ─────────────────────────────────────────────
  //  타입 8: 코딩-디코딩 (치환 암호)
  //  예시 둘에 맞는 규칙이 후보집합 중 정확히 1개일 때만 출제 → 규칙 모호성0.
  //  오답=다른 규칙을 target에 적용한 결과(틀린 규칙).
  // ─────────────────────────────────────────────
  function genCoding(d) {
    d = clamp(d, 1, 5);
    var AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function shift(w, k) { return w.replace(/[A-Z]/g, function (c) { return AL[(AL.indexOf(c) + k + 26) % 26]; }); }
    function rev(w) { return w.split('').reverse().join(''); }
    function mir(w) { return w.replace(/[A-Z]/g, function (c) { return AL[25 - AL.indexOf(c)]; }); }   // 거울 A↔Z
    var RULES = [function (w) { return shift(w, 1); }, function (w) { return shift(w, 2); }, function (w) { return shift(w, 3); }, function (w) { return shift(w, 4); },
      function (w) { return shift(w, -1); }, function (w) { return shift(w, -2); }, function (w) { return shift(w, -3); }, function (w) { return shift(w, -4); }, rev, mir];
    var L = d >= 4 ? 4 : 3;
    // 규칙 난도 게이트 (인덱스: 0~3 시프트+1~+4, 4~7 −1~−4, 8 뒤집기, 9 거울). 유일성 판정은 전체 RULES 유지.
    var CH = d <= 1 ? [0, 4] : d === 2 ? [0, 1, 4, 5] : d === 3 ? [0, 1, 2, 4, 5, 6]
      : d === 4 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    var WORDS = ['CAT', 'DOG', 'SUN', 'CAR', 'BOX', 'CUP', 'PEN', 'KEY', 'MAP', 'BAT', 'HAT', 'RUN', 'OWL', 'FOX', 'BEE', 'ANT', 'COW', 'PIG', 'BUS', 'FAN', 'NET', 'SKY', 'TOP', 'ARM', 'BAG', 'CAP', 'EAR', 'HEN', 'JOB', 'LIP', 'NUT', 'OIL', 'PIE', 'RAT', 'SEA', 'TOY', 'VAN', 'WAX',
      'BIRD', 'FISH', 'LION', 'STAR', 'MOON', 'TREE', 'BOOK', 'DOOR', 'LAMP', 'CAKE', 'FROG', 'GOLD', 'HAND', 'JUMP', 'KING', 'LEAF', 'MILK', 'NEST', 'PARK', 'RAIN', 'SHIP', 'WIND', 'WOLF', 'BEAR', 'CORN', 'DUCK', 'FIRE', 'GATE', 'HILL', 'KITE', 'LOCK', 'MASK', 'NOSE', 'ROSE', 'SALT', 'TANK', 'VASE', 'WAVE'];
    var pool = WORDS.filter(function (w) { return w.length === L; });
    function rw() { return pick(pool); }
    for (var tries = 0; tries < 60; tries++) {
      var R = RULES[pick(CH)], w1 = rw(), w2 = rw(), tg = rw();
      if (w1 === w2 || w1 === tg || w2 === tg) continue;
      var c1 = R(w1), c2 = R(w2), ans = R(tg);
      var fit = RULES.filter(function (r) { return r(w1) === c1 && r(w2) === c2; });
      if (fit.length !== 1) continue;                                   // 규칙 유일
      var seen = {}; seen[ans] = 1; var dl = [];
      RULES.forEach(function (r) { var x = r(tg); if (!seen[x]) { seen[x] = 1; dl.push(x); } });
      if (dl.length < 4) continue;
      var opts = shuffle([ans].concat(shuffle(dl).slice(0, 4)));
      var stemHTML = te('<div class="verbal-q"><div class="vq-facts"><div>같은 규칙으로 알파벳을 바꿉니다.</div>', '<div class="verbal-q"><div class="vq-facts"><div>The letters change by the same rule.</div>') +
        '<div class="code-ex">' + w1 + ' → ' + c1 + '</div><div class="code-ex">' + w2 + ' → ' + c2 + '</div>' +
        '</div><div class="vq-ask">' + te('그렇다면 ', 'Then ') + tg + ' → ?</div></div>';
      return { type: 'coding', difficulty: d, stemHTML: stemHTML, options: opts, answer: opts.indexOf(ans), explain: te('규칙을 ', 'Applying the rule to ') + tg + te('에 적용하면 ', ' gives ') + ans + te(' 입니다.', '.'), text: true, tag: (R === rev ? 'reverse' : R === mir ? 'cmirror' : 'shift') };
    }
    return genVerbal(d);
  }

  // ─────────────────────────────────────────────
  //  타입 9: 다이어그램/흐름 추론 (연산 체인)
  //  연산자가 명시적으로 주어지고 왼쪽부터 적용 → 결과 유일(모호성0). 추론=흐름 추적.
  // ─────────────────────────────────────────────
  function genDiagram(d) {
    d = clamp(d, 1, 5);
    var ops = [{ t: '+3', f: function (x) { return x + 3; } }, { t: '+5', f: function (x) { return x + 5; } },
      { t: '−2', f: function (x) { return x - 2; } }, { t: '×2', f: function (x) { return x * 2; } },
      { t: '×3', f: function (x) { return x * 3; } }, { t: '+10', f: function (x) { return x + 10; } },
      { t: '−4', f: function (x) { return x - 4; } }];
    var n = clamp(d + 1, 2, 5);   // 연산 개수 2~5 = d로 체인 길이↑
    // 중간·최종 결과가 0~99에 머물도록 재시도 (음수·세 자리 방지 → 암산 친화)
    var chain, input, ans, bad, t2 = 0;
    do {
      bad = false; chain = []; for (var i = 0; i < n; i++) chain.push(pick(ops));
      input = 2 + ri(8); var v = input;
      for (var j = 0; j < chain.length; j++) { v = chain[j].f(v); if (v < 0 || v > 99) bad = true; }
      ans = v;
    } while (bad && ++t2 < 120);   // 긴 체인은 0~99 유지 조합 찾기 어려워 재시도 여유↑
    var seen = {}; seen[ans] = 1; var dl = [];
    function add(x) { if (Number.isInteger(x) && !seen[x]) { seen[x] = 1; dl.push(x); } }
    var partial = input; for (var i = 0; i < chain.length - 1; i++) partial = chain[i].f(partial); add(partial);  // 마지막 빼먹기
    add(chain[0].f(input));                                                                                        // 첫 연산만
    [1, -1, 2, -2, 3, 4, -3, 5, -5, 6].forEach(function (k) { if (dl.length < 6) add(ans + k); });
    var optsNum = shuffle([ans].concat(shuffle(dl).slice(0, 4)));
    var stemHTML = te('<div class="verbal-q"><div class="vq-facts"><div>아래 연산을 왼쪽부터 차례로 적용합니다.</div>', '<div class="verbal-q"><div class="vq-facts"><div>Apply the operations below, left to right.</div>') +
      '<div class="diag-flow">' + input + ' → [' + chain.map(function (o) { return o.t; }).join('] → [') + '] → ?</div>' +
      te('</div><div class="vq-ask">최종 결과는?</div></div>', '</div><div class="vq-ask">What is the final result?</div></div>');
    return { type: 'diagram', difficulty: d, stemHTML: stemHTML, options: optsNum.map(String), answer: optsNum.indexOf(ans), tag: 'flow',
      explain: te('왼쪽부터 적용: ', 'Left to right: ') + input + ' → ' + chain.map(function (o) { return o.t; }).join(' → ') + ' = ' + ans, text: true };
  }

  // ─────────────────────────────────────────────
  //  타입 10: 도형 유추 (A:B :: C:?)
  //  A→B는 한 특징만 +1 스텝 변화(유일하게 추론 가능) → 같은 변화를 C에 적용 = 정답.
  //  보기는 vsig로 시각 distinct 보장. rot=0 고정으로 회전대칭 함정 회피.
  // ─────────────────────────────────────────────
  function genFigural(d) {
    d = clamp(d, 1, 5);
    var VALS = { shape: FEATS.shape, color: FEATS.color, fill: FEATS.fill, count: [1, 2, 3], size: FEATS.size };
    var tfs = ['shape', 'color', 'fill', 'count', 'size'];
    var FKR = { shape: '모양', color: '색', fill: '채움', count: '개수', size: '크기' };
    var nf = d <= 2 ? 1 : 2;       // 바꾸는 특징 수: 저d 1개, 고d 2개(둘 다 추적해야 함)
    var bigStep = d >= 5;          // 최고난도: 한 특징은 +2 스텝(변화량까지 읽어야 함)
    function randCell() { return { shape: pick(FEATS.shape), color: pick(FEATS.color), fill: pick(FEATS.fill), count: pick([1, 2, 3]), rot: 0, size: pick(FEATS.size) }; }
    for (var tries = 0; tries < 80; tries++) {
      // 바꿀 특징 선택 (+step 여유 있는 것만). 최고난도는 첫 특징을 +2로.
      var pool = shuffle(tfs.slice()), chosen = [];
      for (var pi = 0; pi < pool.length && chosen.length < nf; pi++) {
        var f = pool[pi], step = (bigStep && chosen.length === 0) ? 2 : 1;
        if (VALS[f].length >= step + 1) chosen.push({ f: f, step: step });
      }
      if (chosen.length < nf) continue;
      // A→B, C→D: 선택 특징을 각자 step 만큼 전진 (끝값 제외 → wrap 없음)
      var A = randCell(), C = randCell();
      chosen.forEach(function (ch) {
        var V = VALS[ch.f], ai = ri(V.length - ch.step), ci = ri(V.length - ch.step);
        A[ch.f] = V[ai]; C[ch.f] = V[ci]; ch.aTo = V[ai + ch.step]; ch.cTo = V[ci + ch.step];
      });
      var B = Object.assign({}, A), D = Object.assign({}, C);
      chosen.forEach(function (ch) { B[ch.f] = ch.aTo; D[ch.f] = ch.cTo; });
      if (vsig(A) === vsig(B)) continue;
      // 오답: 무변화 / 각 특징만 단독(부분 변화) / 틀린 변화량 / 다른 특징 +1
      var cands = [Object.assign({}, C)];
      chosen.forEach(function (ch) { var nc = Object.assign({}, C); nc[ch.f] = ch.cTo; cands.push(nc); });
      chosen.forEach(function (ch) { if (ch.step !== 1) { var V = VALS[ch.f], ci2 = V.indexOf(C[ch.f]); if (ci2 + 1 < V.length) { var nc = Object.assign({}, C); nc[ch.f] = V[ci2 + 1]; cands.push(nc); } } });
      tfs.filter(function (o) { return !chosen.some(function (ch) { return ch.f === o; }); }).forEach(function (o) {
        var W = VALS[o], wi = W.indexOf(C[o]), nc = Object.assign({}, C); nc[o] = W[(wi + 1) % W.length]; cands.push(nc);
      });
      var seen = {}; seen[vsig(D)] = 1; var distinct = [];
      shuffle(cands).forEach(function (c) { var s = vsig(c); if (!seen[s]) { seen[s] = 1; distinct.push(c); } });
      if (distinct.length < 4) continue;
      var opts = shuffle([D].concat(distinct.slice(0, 4)));
      var px = 64;
      var stemHTML = '<div class="ana-fig">' +
        '<div class="af-row"><div class="af-cell">' + cellSVG(A, px) + '</div><span class="af-arrow">→</span><div class="af-cell">' + cellSVG(B, px) + '</div></div>' +
        te('<div class="af-rel">같은 관계</div>', '<div class="af-rel">same relation</div>') +
        '<div class="af-row"><div class="af-cell">' + cellSVG(C, px) + '</div><span class="af-arrow">→</span><div class="af-cell af-q">?</div></div>' +
        '</div>';
      var changedKr = chosen.map(function (ch) { return LANG === 'en' ? FEAT_EN[ch.f] : FKR[ch.f]; }).join('·');
      return { type: 'figural', difficulty: d, stemHTML: stemHTML, options: opts.map(function (c) { return cellSVG(c, 88); }), answer: opts.indexOf(D), tag: chosen[0].f,
        explain: (LANG === 'en'
          ? ('The changed feature (' + changedKr + ') applied to C' + (bigStep ? ' by the same amount' : '') + ' is the answer.')
          : ('A→B에서 바뀐 특징(' + changedKr + ')' + (bigStep ? '을 같은 양만큼' : '을') + ' C에 똑같이 적용한 것이 정답입니다.')) };
    }
    return genMatrix(d);
  }

  // ── 디스패치 ──
  var GEN = { matrix: genMatrix, sequence: genSequence, odd: genOdd, calc: genCalc, verbal: genVerbal, spatial: genSpatial, analytic: genAnalytic, coding: genCoding, diagram: genDiagram, figural: genFigural };
  function generate(type, difficulty, pref) {
    if (type === 'mixed' || !GEN[type]) type = pick(Object.keys(GEN));
    var d = difficulty || 2, gen = GEN[type];
    if (pref) {   // 특정 세부패턴 집중 드릴: 요청 난이도 우선, 안 나오면 전 난이도 스윕(난이도에 막힌 패턴 대응)
      for (var i = 0; i < 80; i++) { var dd = i < 24 ? d : (1 + (i % 5)); var p = gen(dd); if (p.tag === pref) return p; }
    }
    return gen(d);
  }

  window.ENGINE = { generate: generate, setLang: function (l) { LANG = (l === 'en') ? 'en' : 'ko'; }, types: ['matrix', 'sequence', 'odd', 'calc', 'verbal', 'spatial', 'analytic', 'coding', 'diagram', 'figural'] };
})();
