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

  // ─────────────────────────────────────────────────────────────
  //  도형 렌더 (SVG)
  // ─────────────────────────────────────────────────────────────
  var FEATS = {
    shape: ['circle', 'square', 'triangle', 'diamond', 'hexagon'],
    color: ['#2f63f4', '#e1473d', '#16a34a'],   // 파랑·빨강·초록
    fill:  [0, 0.5, 1],                          // 채움 = 불투명도
    count: [1, 2, 3],
    rot:   [0, 30, 60, 90],
    size:  [0.7, 0.85, 1.0],
  };
  var FEAT_KR = { shape: '모양', color: '색', fill: '채움', count: '개수', rot: '회전', size: '크기' };
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
        constVal[f] = c[ri(3)];
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

    // 정답과 같은 시그니처 제거 + 중복 제거
    var cs = sig(correct), seen = {}; seen[cs] = true;
    var opts = [];
    shuffle(distract).forEach(function (w) {
      var s = sig(w);
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
      if (rl.a === 0) how = '왼쪽→오른쪽으로 바뀜 (각 행은 같은 흐름)';
      else if (rl.b === 0) how = '위→아래로 바뀜 (각 열은 같은 흐름)';
      else how = '각 가로줄·세로줄에 세 값이 한 번씩 (대각 규칙)';
      return '· ' + FEAT_KR[f] + ': ' + how;
    });
    var explain = '변하는 규칙은 ' + active.map(function (f) { return FEAT_KR[f]; }).join('·') +
      ' ' + active.length + '가지입니다.\n' + lines.join('\n');

    return { type: 'matrix', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer, explain: explain };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 2: 수열추리 (숫자)
  // ─────────────────────────────────────────────────────────────
  function genSequence(d) {
    d = clamp(d, 1, 5);
    var n = d >= 4 ? 6 : 5;            // 보여줄 항 수 (마지막은 ?)
    var seq, desc;

    function build() {
      var k, a0, i, t;
      var kind;
      if (d <= 1) kind = pick(['add']);
      else if (d === 2) kind = pick(['add', 'mul', 'add']);
      else if (d === 3) kind = pick(['growdiff', 'fib', 'mul']);
      else if (d === 4) kind = pick(['growdiff', 'interleave', 'square']);
      else kind = pick(['interleave', 'muladd', 'geomdiff']);

      seq = [];
      if (kind === 'add') {            // 등차
        k = 2 + ri(7); a0 = 1 + ri(9);
        for (i = 0; i < n; i++) seq.push(a0 + k * i);
        desc = '+' + k + ' 씩 더해지는 등차수열';
      } else if (kind === 'mul') {     // 등비
        k = 2 + ri(2); a0 = 1 + ri(4);
        for (i = 0; i < n; i++) seq.push(a0 * Math.pow(k, i));
        desc = '×' + k + ' 씩 곱해지는 등비수열';
      } else if (kind === 'growdiff') {// 차이가 등차로 증가
        a0 = 1 + ri(5); var dd = 1 + ri(4), step = 1 + ri(3); t = a0;
        for (i = 0; i < n; i++) { seq.push(t); t += dd; dd += step; }
        desc = '차이가 +' + step + ' 씩 커지는 수열';
      } else if (kind === 'fib') {     // 앞 두 항의 합
        var x = 1 + ri(4), y = 1 + ri(5); seq = [x, y];
        for (i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
        desc = '앞의 두 항을 더한 수열';
      } else if (kind === 'square') {  // 제곱 + 오프셋
        var off = ri(4); var base = 1 + ri(3);
        for (i = 0; i < n; i++) seq.push((base + i) * (base + i) + off);
        desc = '연속한 수의 제곱' + (off ? ' +' + off : '') + ' 수열';
      } else if (kind === 'interleave') { // 두 수열 교차
        var p = 1 + ri(6), q = 2 + ri(6), pk = 2 + ri(4), qk = 2 + ri(4);
        for (i = 0; i < n; i++) seq.push(i % 2 === 0 ? p + pk * (i / 2 | 0) : q + qk * (i / 2 | 0));
        desc = '두 수열(홀수번째 +' + pk + ', 짝수번째 +' + qk + ')이 번갈아 나오는 수열';
      } else if (kind === 'muladd') {  // ×k +m
        k = 2 + ri(2); var m = 1 + ri(4); t = 1 + ri(3);
        for (i = 0; i < n; i++) { seq.push(t); t = t * k + m; }
        desc = '×' + k + ' 후 +' + m + ' 을 반복하는 수열';
      } else {                          // geomdiff: 차이가 ×k
        a0 = 1 + ri(4); var gd = 1 + ri(3), gk = 2; t = a0;
        for (i = 0; i < n; i++) { seq.push(t); t += gd; gd *= gk; }
        desc = '차이가 ×' + gk + ' 로 커지는 수열';
      }
    }

    var tries = 0;
    do { build(); tries++; }
    while (tries < 30 && (seq[seq.length - 1] > 9999 || seq.some(function (x) { return x !== Math.round(x); })));

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
    return { type: 'sequence', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer,
      explain: '규칙: ' + desc + '.\n다음 수는 ' + correct + ' 입니다.' };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 3: 다른 하나 찾기 (odd one out)
  //  6개 도형 중 5개는 한 가지 특징을 공유, 1개만 깬다.
  // ─────────────────────────────────────────────────────────────
  function genOdd(d) {
    d = clamp(d, 1, 5);
    var ruleFeat = pick(['shape', 'count', 'fill', 'rot']);
    var vals = shuffle(FEATS[ruleFeat]);
    var shared = vals[0], oddVal = vals[1];
    var noisy = shuffle(['shape', 'color', 'fill', 'count', 'rot', 'size'].filter(function (f) { return f !== ruleFeat; }));
    // 저난이도일수록 노이즈(헷갈림) 적게
    var noiseCount = clamp(d - 1, 0, 3);
    var noiseFeats = noisy.slice(0, noiseCount);

    var cells = [];
    for (var i = 0; i < 6; i++) {
      cells.push({ shape: 'circle', color: FEATS.color[0], fill: 1, count: 1, rot: 0, size: 1.0 });
      cells[i][ruleFeat] = shared;
    }
    // 노이즈 특징은 "모든 값이 2번 이상" 으로 균형 배치한다 → 노이즈가 혼자 튀는 셀을
    //  만들지 않으므로, 규칙을 깨는 칸은 oddIdx 하나뿐 (모호함 0).
    noiseFeats.forEach(function (f) {
      var pool = shuffle(FEATS[f]);
      var counts = (pool.length >= 3 && ri(2)) ? [2, 2, 2] : [3, 3];
      var arr = [];
      counts.forEach(function (cnt, ci) { for (var j = 0; j < cnt; j++) arr.push(pool[ci]); });
      arr = shuffle(arr);
      cells.forEach(function (c, idx) { c[f] = arr[idx]; });
    });
    var oddIdx = ri(6);
    cells[oddIdx][ruleFeat] = oddVal;

    var stemHTML = '<div class="odd-grid">' + cells.map(function (v, i) {
      return '<div class="odd-cell" data-i="' + i + '">' + cellSVG(v, 92) + '<span class="odd-lab">' + (i + 1) + '</span></div>';
    }).join('') + '</div>';
    var optHTML = cells.map(function (v, i) { return '<span class="opt-num">' + (i + 1) + '</span>'; });
    return { type: 'odd', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: oddIdx,
      explain: '나머지 다섯은 ' + FEAT_KR[ruleFeat] + '이(가) 모두 같습니다.\n' + (oddIdx + 1) + '번만 ' + FEAT_KR[ruleFeat] + '이(가) 다릅니다.' };
  }

  // ── 디스패치 ──
  var GEN = { matrix: genMatrix, sequence: genSequence, odd: genOdd };
  function generate(type, difficulty) {
    if (type === 'mixed' || !GEN[type]) type = pick(['matrix', 'sequence', 'odd']);
    return GEN[type](difficulty || 2);
  }

  window.ENGINE = { generate: generate, types: ['matrix', 'sequence', 'odd'] };
})();
