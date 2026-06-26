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
        var x = 1 + ri(3), y = x + ri(4); seq = [x, y];   // y>=x 오름차순 시작 → 규칙 인지 가능
        for (i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
        desc = '앞의 두 항을 더한 수열';
      } else if (kind === 'square') {  // 제곱 + 오프셋
        var off = ri(4); var base = 1 + ri(3);
        for (i = 0; i < n; i++) seq.push((base + i) * (base + i) + off);
        desc = '연속한 수의 제곱' + (off ? ' +' + off : '') + ' 수열';
      } else if (kind === 'interleave') { // 두 수열 교차
        var p = 1 + ri(6), q = 2 + ri(6), pk = 2 + ri(4), qk = 2 + ri(4);
        while (qk === pk) qk = 2 + ri(4);   // 두 부분수열 증가폭이 같으면 교차가 아니므로 다르게
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
      explain: '나머지 다섯은 ' + josa(FEAT_KR[ruleFeat], '이', '가') + ' 모두 같습니다.\n' + (oddIdx + 1) + '번만 ' + josa(FEAT_KR[ruleFeat], '이', '가') + ' 다릅니다.' };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 4: 응용수리 (계산) — 거리·농도·비율·경우의수 등. 정답=유일한 정수.
  //  모든 템플릿은 정수 답이 나오도록 파라미터를 제약한다 (모호함 0).
  // ─────────────────────────────────────────────────────────────
  function genCalc(d) {
    d = clamp(d, 1, 5);
    var easy = ['speed', 'avg', 'ratio', 'discount'];
    var mid = ['conc', 'time', 'grow'];
    var hard = ['perm', 'conc', 'grow'];
    var pool = d <= 2 ? easy : d === 3 ? easy.concat(mid) : d === 4 ? mid : mid.concat(hard);
    var kind = pick(pool), q, ans, ds = [];

    if (kind === 'speed') {                 // 거리 = 속력 × 시간
      var v = pick([20, 30, 40, 50, 60]), t = pick([2, 3, 4, 5]);
      ans = v * t; q = '시속 ' + v + 'km로 ' + t + '시간 동안 달린 거리는? (km)';
      ds = [v + t, v * (t + 1), v * (t - 1), v];
    } else if (kind === 'time') {            // 시간 = 거리 ÷ 속력
      var v2 = pick([20, 30, 40, 60]), t2 = pick([2, 3, 4, 5]), dist = v2 * t2;
      ans = t2; q = dist + 'km 거리를 시속 ' + v2 + 'km로 갈 때 걸리는 시간은? (시간)';
      ds = [t2 + 1, t2 + 2, dist - v2, t2 * 2];
    } else if (kind === 'avg') {             // 평균
      var base = pick([12, 15, 18, 20, 24, 30]), g = pick([2, 3, 4]);
      ans = base; q = (base - g) + ', ' + base + ', ' + (base + g) + ' 세 수의 평균은?';
      ds = [base + g, base - g, (base - g) + base + (base + g), base + 1];
    } else if (kind === 'ratio') {           // 비율(%)
      var whole = pick([200, 300, 400, 500]), r = pick([10, 20, 25, 30, 40]);
      ans = whole * r / 100; q = whole + '명의 ' + r + '%는 몇 명? (명)';
      ds = [whole - ans, ans + 10, r, ans * 2];
    } else if (kind === 'discount') {        // 할인가
      var p = pick([10000, 12000, 15000, 20000, 25000]), dr = pick([10, 20, 25, 30]);
      ans = p * (100 - dr) / 100; q = '정가 ' + p + '원인 상품을 ' + dr + '% 할인한 판매가는? (원)';
      ds = [p * dr / 100, ans - 1000, ans + 1000, p];
    } else if (kind === 'conc') {            // 농도 → 소금량
      var c = pick([5, 10, 15, 20, 25]), m = pick([200, 300, 400, 500]);
      ans = m * c / 100; q = '농도 ' + c + '%인 소금물 ' + m + 'g에 들어 있는 소금의 양은? (g)';
      ds = [c, m - ans, ans + 10, ans * 2];
    } else if (kind === 'perm') {            // 순열 nP2
      var nn = pick([4, 5, 6, 7]);
      ans = nn * (nn - 1); q = '서로 다른 ' + nn + '개에서 2개를 뽑아 순서대로 나열하는 경우의 수는? (가지)';
      ds = [nn * nn, nn * (nn - 1) / 2, nn + 2, nn * (nn - 1) * (nn - 2)];
    } else {                                 // grow: 증가율
      var a0 = pick([20, 40, 80, 100]), inc = pick([10, 20, 25, 50]), b0 = a0 * (100 + inc) / 100;
      ans = inc; q = a0 + '에서 ' + b0 + '까지 늘었다면 증가율은? (%)';
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
    return { type: 'calc', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer,
      explain: '정답은 ' + ans + ' 입니다.' };
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

    if (kind === 'order') {                    // 순서배열
      var names = shuffle(['민수', '지영', '현우', '수빈', '태호', '은지', '준서', '하늘', '서연', '도윤']);
      var N = clamp(d + 2, 3, 5), ord = names.slice(0, N);   // ord[0] = 최상위
      var rel = pick([
        { st: '키가 크다', big: '키가 가장 큰', small: '키가 가장 작은' },
        { st: '나이가 많다', big: '나이가 가장 많은', small: '나이가 가장 적은' },
        { st: '점수가 높다', big: '점수가 가장 높은', small: '점수가 가장 낮은' },
        { st: '달리기가 빠르다', big: '달리기가 가장 빠른', small: '달리기가 가장 느린' },
      ]);
      var stmts = [];
      for (var i = 0; i < N - 1; i++) stmts.push(josa(ord[i], '은', '는') + ' ' + ord[i + 1] + '보다 ' + rel.st + '.');
      facts = shuffle(stmts);
      var askMax = ri(2);
      ask = '다음 중 ' + (askMax ? rel.big : rel.small) + ' 사람은?';
      ansVal = askMax ? ord[0] : ord[N - 1];
      optList = shuffle(ord);
    } else if (kind === 'syllog') {            // 삼단논법 (Barbara — 유효형만)
      var pool = shuffle(['학생', '회원', '운동선수', '예술가', '시민', '직원', '전문가', '독서가', '채식주의자', '음악가']);
      var A = pool[0], B = pool[1], C = pool[2];
      facts = ['모든 ' + josa(A, '은', '는') + ' ' + josa(B, '이다', '다') + '.',
               '모든 ' + josa(B, '은', '는') + ' ' + josa(C, '이다', '다') + '.'];
      ask = '위 두 문장이 참일 때 반드시 참인 것은?';
      ansVal = '모든 ' + josa(A, '은', '는') + ' ' + josa(C, '이다', '다') + '.';
      optList = shuffle([ansVal,
        '모든 ' + josa(C, '은', '는') + ' ' + josa(A, '이다', '다') + '.',
        '어떤 ' + josa(A, '은', '는') + ' ' + josa(C, '이', '가') + ' 아니다.',
        '모든 ' + josa(B, '은', '는') + ' ' + josa(A, '이다', '다') + '.']);
    } else {                                   // 대우
      var pr = pick([
        { p: '비가 오면 길이 젖는다', dae: '길이 젖지 않으면 비가 오지 않는다', yeok: '길이 젖으면 비가 온다', i: '비가 오지 않으면 길이 젖지 않는다', un: '비가 오면 길이 마른다' },
        { p: '합격하면 기뻐한다', dae: '기뻐하지 않으면 합격하지 않은 것이다', yeok: '기뻐하면 합격한 것이다', i: '합격하지 않으면 기뻐하지 않는다', un: '합격하면 슬퍼한다' },
        { p: '운동하면 건강해진다', dae: '건강해지지 않으면 운동하지 않은 것이다', yeok: '건강해지면 운동한 것이다', i: '운동하지 않으면 건강해지지 않는다', un: '운동하면 피곤해진다' },
        { p: '화요일이면 회의가 있다', dae: '회의가 없으면 화요일이 아니다', yeok: '회의가 있으면 화요일이다', i: '화요일이 아니면 회의가 없다', un: '화요일이면 쉬는 날이다' },
        { p: '금속이면 전기가 통한다', dae: '전기가 통하지 않으면 금속이 아니다', yeok: '전기가 통하면 금속이다', i: '금속이 아니면 전기가 통하지 않는다', un: '금속이면 빛을 낸다' },
      ]);
      facts = ["'" + pr.p + "' 가 참이라고 하자."];
      ask = '위 명제가 참일 때 반드시 참인 것은?';
      ansVal = pr.dae;
      optList = shuffle([pr.dae, pr.yeok, pr.i, pr.un]);
    }

    var answer = optList.indexOf(ansVal);
    var stemHTML = '<div class="verbal-q"><div class="vq-facts">' +
      facts.map(function (f) { return '<div>' + f + '</div>'; }).join('') +
      '</div><div class="vq-ask">' + ask + '</div></div>';
    return { type: 'verbal', difficulty: d, stemHTML: stemHTML, options: optList, answer: answer,
      explain: '정답: ' + ansVal };
  }

  // ─────────────────────────────────────────────────────────────
  //  타입 6: 공간지각 (회전·대칭) — 비대칭 폴리오미노+마커.
  //  5방위(0·90·180·270·거울)가 모두 distinct하도록 보장 → 모호성 0.
  // ─────────────────────────────────────────────────────────────
  function genSpatial(d) {
    d = clamp(d, 1, 5);
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

    var oris, mi, tries = 0;
    do {
      var sh = pick(SHAPES).map(function (c) { return c.slice(); });
      mi = ri(sh.length);
      var ir = ri(4); for (var k = 0; k < ir; k++) sh = rot(sh);
      if (ri(2)) sh = mir(sh);
      oris = [sh, rot(sh), rot(rot(sh)), rot(rot(rot(sh))), mir(sh)];   // 0·90·180·270·거울
      tries++;
    } while (tries < 25 && (function () { var s = {}; for (var j = 0; j < 5; j++) s[fkey(oris[j], mi)] = 1; return Object.keys(s).length !== 5; })());

    var kind = d <= 2 ? 'rotate' : pick(['rotate', 'mirror', 'rotate']);
    var deg = pick([90, 180, 270]), correctOri, ask;
    if (kind === 'mirror') { correctOri = 4; ask = '위 도형을 좌우로 뒤집으면(거울상)?'; }
    else { correctOri = deg / 90; ask = '위 도형을 시계 방향으로 ' + deg + '° 돌리면?'; }

    var order = shuffle([0, 1, 2, 3, 4]);
    var optHTML = order.map(function (i) { return svg(oris[i], mi); });
    var answer = order.indexOf(correctOri);
    var stemHTML = '<div class="sp-q"><div class="sp-fig">' + svg(oris[0], mi) + '</div><div class="sp-ask">' + ask + '</div></div>';
    return { type: 'spatial', difficulty: d, stemHTML: stemHTML, options: optHTML, answer: answer,
      explain: '파란 칸의 위치로 방향을 추적하면 정답을 찾을 수 있습니다.' };
  }

  // ── 디스패치 ──
  var GEN = { matrix: genMatrix, sequence: genSequence, odd: genOdd, calc: genCalc, verbal: genVerbal, spatial: genSpatial };
  function generate(type, difficulty) {
    if (type === 'mixed' || !GEN[type]) type = pick(Object.keys(GEN));
    return GEN[type](difficulty || 2);
  }

  window.ENGINE = { generate: generate, types: ['matrix', 'sequence', 'odd', 'calc', 'verbal', 'spatial'] };
})();
