/* 매트릭스아이큐 — 앱 로직 (zero-build, 바닐라).
 * engine.js 가 문항을 만들고, 여기선 훈련/모의 세션 흐름·기록을 관리한다.
 * 뷰는 PRECISION 스킨(시안 이식) — 셸만 교체, 엔진/저장 스키마 무변경. */
(function () {
  'use strict';

  var STORE_KEY = 'matrixiq/state';
  var state = load();

  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; return s; }
    catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('save 실패:', e.message); }
  }
  // 기본값 보강
  state.diff = state.diff || {};
  state.stats = state.stats || {};
  state.history = state.history || [];
  DATA.types.forEach(function (t) { if (state.diff[t.id] == null) state.diff[t.id] = 2; });
  ENGINE.types.forEach(function (t) { if (!state.stats[t]) state.stats[t] = { seen: 0, correct: 0, timeMs: 0, best: 0 }; });

  var TAB_IDS = { train: 1, mock: 1, stats: 1 };
  var current = state.tab && TAB_IDS[state.tab] ? state.tab : 'train';
  var session = null;     // 진행 중 세션
  var timer = null;       // 모의 타이머

  function setTab(id) {
    stopTimer();
    session = null;
    current = id; state.tab = id; save();
    render();
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // ── 유틸 ──
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function now() { return Date.now(); }
  function mmss(sec) { sec = Math.max(0, sec | 0); return (sec / 60 | 0) + ':' + ('0' + (sec % 60)).slice(-2); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function typeLabel(id) { var t = DATA.types.filter(function (x) { return x.id === id; })[0]; return t ? t.label : id; }
  function maxDiff() { return DATA.types.reduce(function (m, t) { return Math.max(m, state.diff[t.id] || 1); }, 1); }
  function maxBest() { return ENGINE.types.reduce(function (m, t) { return Math.max(m, state.stats[t].best || 0); }, 0); }

  var LBL = 'ABCDEFGH';

  // ─────────────────────────────────────────────
  //  훈련 (적응형, 무제한)
  // ─────────────────────────────────────────────
  function startPractice(type) {
    session = { mode: 'practice', type: type, streak: 0, answered: false, qStart: now() };
    nextPractice();
  }
  function nextPractice() {
    var t = session.type;
    session.puzzle = ENGINE.generate(t, state.diff[t]);
    session.answered = false;
    session.qStart = now();
    render();
  }
  function answerPractice(i) {
    if (session.answered) return;
    session.answered = true;
    var p = session.puzzle, ok = (i === p.answer), realType = p.type;
    session.picked = i;
    // 기록
    var st = state.stats[realType];
    st.seen++; if (ok) st.correct++; st.timeMs += (now() - session.qStart);
    // 적응형 난이도 (훈련 타입 키 기준)
    var key = session.type;
    if (ok) { session.streak++; if (session.streak % 2 === 0) state.diff[key] = Math.min(5, state.diff[key] + 1); }
    else { session.streak = 0; state.diff[key] = Math.max(1, state.diff[key] - 1); }
    if (session.streak > st.best) st.best = session.streak;
    save();
    render();
  }

  // ─────────────────────────────────────────────
  //  모의 (시간제한, 적응형 아님, 해설은 끝나고)
  // ─────────────────────────────────────────────
  function buildTypePlan(n, weights) {
    if (!weights) { var arr0 = []; for (var k = 0; k < n; k++) arr0.push('mixed'); return arr0; }
    var types = Object.keys(weights), plan = [];
    types.forEach(function (t) { var c = Math.round(weights[t] * n); for (var j = 0; j < c; j++) plan.push(t); });
    var top = types.reduce(function (a, b) { return weights[a] >= weights[b] ? a : b; });
    while (plan.length < n) plan.push(top);
    while (plan.length > n) plan.splice(plan.indexOf(top), 1);
    for (var s = plan.length - 1; s > 0; s--) { var r = Math.floor(Math.random() * (s + 1)); var tmp = plan[s]; plan[s] = plan[r]; plan[r] = tmp; }
    return plan;
  }
  function startMock() {
    var m = DATA.mock, qs = [];
    var plan = buildTypePlan(m.count, m.weights);
    for (var i = 0; i < m.count; i++) qs.push(ENGINE.generate(plan[i], m.difficulty));
    session = { mode: 'mock', idx: 0, qs: qs, picks: new Array(m.count).fill(null),
      startTs: now(), deadline: now() + m.seconds * 1000, done: false };
    stopTimer();
    timer = setInterval(function () {
      if (!session || session.mode !== 'mock' || session.done) { stopTimer(); return; }
      if (now() >= session.deadline) { finishMock(); return; }
      var el = document.getElementById('mock-time');
      if (el) el.textContent = mmss((session.deadline - now()) / 1000);
    }, 250);
    render();
  }
  function answerMock(i) {
    if (!session || session.done) return;
    session.picks[session.idx] = i;
    if (session.idx < session.qs.length - 1) { session.idx++; render(); }
    else finishMock();
  }
  function finishMock() {
    stopTimer();
    session.done = true;
    var correct = 0, per = {};
    session.qs.forEach(function (p, i) {
      per[p.type] = per[p.type] || { seen: 0, correct: 0 };
      per[p.type].seen++;
      var ok = session.picks[i] === p.answer;
      if (ok) { correct++; per[p.type].correct++; }
      var st = state.stats[p.type]; st.seen++; if (ok) st.correct++;
    });
    var usedSec = Math.min(DATA.mock.seconds, Math.round((now() - session.startTs) / 1000));
    var rec = { ts: now(), correct: correct, total: session.qs.length, per: per, sec: DATA.mock.seconds, usedSec: usedSec };
    state.history.unshift(rec); state.history = state.history.slice(0, 30);
    save();
    session.result = rec;
    render();
  }
  function bandLabel(p) {
    if (p < 40) return '워밍업 단계 — 유형 익히기부터 시작하세요.';
    if (p < 60) return '감을 잡는 중입니다. 같은 유형을 더 반복해 보세요.';
    if (p < 75) return '안정권입니다. 이제 푸는 속도를 좁혀 보세요.';
    if (p < 90) return '상위권 연습 단계입니다. 어려운 난이도로 올려 보세요.';
    return '이 난이도는 충분합니다 — 시간을 더 줄이는 데 집중하세요.';
  }

  // ─────────────────────────────────────────────
  //  SVG 셸 아이콘 (장식 — 시안 차용)
  // ─────────────────────────────────────────────
  function logoSvg() {
    var r = '';
    [1, 9.5, 18].forEach(function (y) { [1, 9.5, 18].forEach(function (x) {
      var last = (x === 18 && y === 18);
      r += '<rect x="' + x + '" y="' + y + '" width="7" height="7" rx="2" fill="' + (last ? '#5b6cff' : '#fff') + '"' + (last ? '' : ' stroke="#0e1330" stroke-width="1.5"') + '/>';
    }); });
    return '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' + r + '</svg>';
  }
  function tabIcon(id, on) {
    var c = on ? '#5b6cff' : '#9aa0bd';
    if (id === 'train') {
      var g = '';
      [2, 8.7, 15.5].forEach(function (y) { [2, 8.7, 15.5].forEach(function (x) {
        g += '<rect x="' + x + '" y="' + y + '" width="4.5" height="4.5" rx="1" fill="' + c + '"/>';
      }); });
      return '<svg width="22" height="22" viewBox="0 0 22 22">' + g + '</svg>';
    }
    if (id === 'mock') {
      return '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="' + c + '" stroke-width="1.8"><circle cx="11" cy="12.5" r="7"/><line x1="11" y1="12.5" x2="11" y2="8.5" stroke-linecap="round"/><line x1="8" y1="2.6" x2="14" y2="2.6" stroke-linecap="round"/></svg>';
    }
    return '<svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="12" width="3.5" height="7" rx="1" fill="' + c + '"/><rect x="9.25" y="6.5" width="3.5" height="12.5" rx="1" fill="' + c + '"/><rect x="15.5" y="9.5" width="3.5" height="9.5" rx="1" fill="' + c + '"/></svg>';
  }
  function thumbSvg(id) {
    var ink = '#2a3057', ind = '#5b6cff';
    if (id === 'matrix') {
      var r = '';
      [3, 18, 33].forEach(function (y) { [3, 18, 33].forEach(function (x) {
        var last = (x === 33 && y === 33);
        r += '<rect x="' + x + '" y="' + y + '" width="12" height="12" rx="3" fill="' + (last ? ind : '#fff') + '"' + (last ? '' : ' stroke="' + ink + '" stroke-width="2"') + '/>';
      }); });
      return '<svg class="tc-thumb" viewBox="0 0 48 48">' + r + '</svg>';
    }
    if (id === 'sequence') {
      return '<svg class="tc-thumb" viewBox="0 0 48 48" fill="none"><circle cx="9" cy="24" r="4" stroke="' + ink + '" stroke-width="2.4"/><circle cx="24" cy="24" r="6" stroke="' + ink + '" stroke-width="2.4"/><circle cx="40" cy="24" r="8" stroke="' + ind + '" stroke-width="2.4"/></svg>';
    }
    if (id === 'odd') {
      var o = '';
      [6, 15, 24, 33, 42].forEach(function (x, i) {
        o += (i === 2) ? '<rect x="' + (x - 4) + '" y="20" width="8" height="8" rx="1.5" fill="' + ind + '"/>'
                       : '<circle cx="' + x + '" cy="24" r="4" fill="none" stroke="' + ink + '" stroke-width="2.2"/>';
      });
      return '<svg class="tc-thumb" viewBox="0 0 48 48">' + o + '</svg>';
    }
    if (id === 'calc') {
      return '<svg class="tc-thumb" viewBox="0 0 48 48" fill="none"><rect x="11" y="6" width="26" height="36" rx="4" stroke="' + ink + '" stroke-width="2.4"/>' +
        '<rect x="16" y="11" width="16" height="7" rx="1.5" fill="' + ink + '" opacity="0.14"/>' +
        '<circle cx="18" cy="27" r="2" fill="' + ink + '"/><circle cx="24" cy="27" r="2" fill="' + ink + '"/><circle cx="30" cy="27" r="2" fill="' + ind + '"/>' +
        '<circle cx="18" cy="35" r="2" fill="' + ink + '"/><circle cx="24" cy="35" r="2" fill="' + ink + '"/><circle cx="30" cy="35" r="2" fill="' + ink + '"/></svg>';
    }
    if (id === 'verbal') {
      return '<svg class="tc-thumb" viewBox="0 0 48 48" fill="none"><rect x="10" y="7" width="28" height="34" rx="4" stroke="' + ink + '" stroke-width="2.4"/>' +
        '<line x1="16" y1="17" x2="32" y2="17" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<line x1="16" y1="24" x2="32" y2="24" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<line x1="16" y1="31" x2="26" y2="31" stroke="' + ind + '" stroke-width="2.4" stroke-linecap="round"/></svg>';
    }
    if (id === 'spatial') {
      return '<svg class="tc-thumb" viewBox="0 0 48 48" fill="none">' +
        '<rect x="9" y="11" width="11" height="11" rx="2" fill="#fff" stroke="' + ink + '" stroke-width="2.2"/>' +
        '<rect x="9" y="23" width="11" height="11" rx="2" fill="#fff" stroke="' + ink + '" stroke-width="2.2"/>' +
        '<rect x="21" y="23" width="11" height="11" rx="2" fill="' + ind + '"/>' +
        '<path d="M33 13 a9 9 0 0 1 5 8" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M34 9.5 l-1.5 4.5 4.6 -0.6" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    return '<svg class="tc-thumb" viewBox="0 0 48 48" fill="none"><circle cx="18" cy="28" r="9" stroke="' + ink + '" stroke-width="2.4"/><rect x="24" y="13" width="15" height="15" rx="2" stroke="' + ink + '" stroke-width="2.4"/><polygon points="33,30 41,44 25,44" fill="' + ind + '"/></svg>';
  }
  function barIcon(id) {
    var s = '#5a6080';
    if (id === 'matrix') return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.6"><rect x="2" y="2" width="10" height="10" rx="2"/></svg>';
    if (id === 'sequence') return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.6"><circle cx="7" cy="7" r="5"/></svg>';
    if (id === 'odd') return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.6"><polygon points="7,2 12,12 2,12" stroke-linejoin="round"/></svg>';
    if (id === 'calc') return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.6"><rect x="3" y="1.5" width="8" height="11" rx="1.5"/><line x1="5.2" y1="9" x2="8.8" y2="9"/></svg>';
    if (id === 'verbal') return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="4" x2="11" y2="4"/><line x1="3" y1="7" x2="11" y2="7"/><line x1="3" y1="10" x2="8" y2="10"/></svg>';
    if (id === 'spatial') return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.5"><rect x="2" y="2" width="5.5" height="5.5" rx="1"/><rect x="6.5" y="6.5" width="5.5" height="5.5" rx="1"/></svg>';
    return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="' + s + '" stroke-width="1.6"><rect x="7" y="1.5" width="7" height="7" rx="1.5" transform="rotate(45 7 7)"/></svg>';
  }
  var IC_BACK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0e1330" stroke-width="1.8"><path d="M10 3 5 8l5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_CLOCK_SM = '<svg width="13" height="13" viewBox="0 0 22 22" fill="none" stroke="#8b90ab" stroke-width="2"><circle cx="11" cy="12" r="8"/><line x1="11" y1="12" x2="11" y2="7.5" stroke-linecap="round"/></svg>';
  var IC_CLOCK_BIG = '<svg class="info-ic" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#5b6cff" stroke-width="1.8"><circle cx="11" cy="11" r="8.5"/><path d="M11 6.5V11l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_CHEV = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9aa0bd" stroke-width="1.8"><path d="M6 3l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function promptFor(type) {
    if (type === 'sequence') return '규칙을 찾아 다음에 올 수를 고르세요.';
    if (type === 'odd') return '규칙이 깨진 하나를 고르세요.';
    if (type === 'calc') return '문제를 읽고 알맞은 답을 고르세요.';
    if (type === 'verbal') return '문장을 읽고 논리적으로 옳은 것을 고르세요.';
    if (type === 'spatial') return '도형의 방향을 따져 알맞은 것을 고르세요.';
    return '빈칸에 들어갈 규칙에 맞는 도형을 고르세요.';
  }

  // ─────────────────────────────────────────────
  //  렌더 — 뷰
  // ─────────────────────────────────────────────
  function optsButtons(p) {
    if (p.type === 'verbal') {
      return '<div class="opts-text">' + p.options.map(function (o, i) {
        return '<button class="opt-row" data-opt="' + i + '"><span class="opt-rlab">' + LBL[i] + '</span><span class="opt-rtext">' + o + '</span></button>';
      }).join('') + '</div>';
    }
    return '<div class="opts">' + p.options.map(function (o, i) {
      return '<button class="opt" data-opt="' + i + '"><span class="opt-lab">' + LBL[i] + '</span>' + o + '</button>';
    }).join('') + '</div>';
  }
  function optsLocked(p, picked) {
    if (p.type === 'verbal') {
      return '<div class="opts-text">' + p.options.map(function (o, i) {
        var k = '', mk = LBL[i];
        if (i === p.answer) { k = ' right'; mk = '✓'; }
        else if (i === picked) { k = ' wrong'; mk = '✕'; }
        return '<div class="opt-row locked' + k + '"><span class="opt-rlab">' + mk + '</span><span class="opt-rtext">' + o + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="opts">' + p.options.map(function (o, i) {
      var k = '', mk = '';
      if (i === p.answer) { k = ' right'; mk = '<span class="opt-mark">✓</span>'; }
      else if (i === picked) { k = ' wrong'; mk = '<span class="opt-mark">✕</span>'; }
      return '<div class="opt locked' + k + '"><span class="opt-lab">' + LBL[i] + '</span>' + o + mk + '</div>';
    }).join('') + '</div>';
  }

  function viewTrain() {
    var html = '';
    html += '<div class="wordmark"><div class="wm-left">' + logoSvg() + '<span class="wm-name">매트릭스아이큐</span></div>' +
      '<span class="wm-ver">RULE-BASED</span></div>';
    html += '<div class="wm-tag">인적성 추론·수리 집중 훈련</div>';

    html += '<div class="hero">' +
      '<div class="hero-stats">' +
        '<div><div class="stat-k">적응 레벨</div><div class="stat-v">L' + maxDiff() + '</div></div>' +
        '<div style="text-align:right"><div class="stat-k">최고 연속</div><div class="stat-v">' + maxBest() + '</div></div>' +
      '</div>' +
      '<button class="primary" id="start-mixed">오늘 훈련 시작 <span class="arr">→</span></button>' +
      '<div class="hero-note">적응형 무제한 · 섞어풀기로 시작</div>' +
    '</div>';

    html += '<div class="sec-label">유형 선택</div>';
    html += '<div class="type-grid">' + DATA.types.map(function (t) {
      return '<button class="type-card" data-type="' + t.id + '">' +
        '<span class="tc-lv">L' + state.diff[t.id] + '</span>' +
        thumbSvg(t.id) +
        '<div class="tc-name">' + esc(t.label) + '</div>' +
        '<div class="tc-desc">' + esc(t.desc) + '</div>' +
        '<span class="tc-badge"><span class="tc-dot"></span>적응형 무제한</span>' +
      '</button>';
    }).join('') + '</div>';

    setScreen(html);
    bind('#start-mixed', function () { startPractice('mixed'); });
    document.querySelectorAll('.type-card').forEach(function (b) {
      b.addEventListener('click', function () { startPractice(b.getAttribute('data-type')); });
    });
  }

  function viewPractice() {
    var p = session.puzzle;
    var html = '<div class="q-head">' +
      '<div class="qh-row"><button class="qh-back" id="quit">' + IC_BACK + '</button>' +
        '<span class="qh-streak">🔥 연속 ' + session.streak + '</span></div>' +
      '<div class="qh-meta"><span class="qh-diff">난이도 L' + state.diff[session.type] + ' · ' + esc(typeLabel(p.type)) + '</span>' +
        '<span class="qh-pill">적응형</span></div>' +
    '</div>';

    html += '<p class="q-prompt">' + promptFor(p.type) + '</p>';
    html += '<div class="stem-card">' + p.stemHTML + '</div>';
    html += '<div class="opts-head"><span class="opts-head-k">보기</span>' +
      '<span class="opts-head-n">' + (session.answered ? '확인' : '선택 - / ' + p.options.length) + '</span></div>';

    if (!session.answered) {
      html += optsButtons(p);
    } else {
      html += optsLocked(p, session.picked);
      var ok = session.picked === p.answer;
      html += '<div class="feedback ' + (ok ? 'ok' : 'no') + '">' +
        '<b><span class="fb-mark">' + (ok ? '✓' : '✕') + '</span>' + (ok ? '정답입니다' : '오답입니다') + '</b>' +
        '<pre>' + esc(p.explain) + '</pre></div>';
      html += '<div class="q-foot"><button class="primary" id="next">다음 문제 <span class="arr">→</span></button></div>';
    }

    setScreen(html);
    bind('#quit', function () { setTab('train'); });
    if (!session.answered) bindOpts(answerPractice);
    else bind('#next', nextPractice);
  }

  function viewMock() {
    if (session.result) return viewMockResult();
    var p = session.qs[session.idx], n = session.qs.length, prog = Math.round((session.idx + 1) / n * 100);
    var html = '<div class="q-head">' +
      '<div class="qh-row"><button class="qh-back" id="quit">' + IC_BACK + '</button>' +
        '<span class="qh-prog">' + (session.idx + 1) + '&nbsp;/&nbsp;' + n + '</span>' +
        '<span class="qh-timer">' + IC_CLOCK_SM + '<b id="mock-time">' + mmss((session.deadline - now()) / 1000) + '</b></span></div>' +
      '<div class="qh-bar"><div class="qh-bar-fill" style="width:' + prog + '%"></div></div>' +
      '<div class="qh-meta"><span class="qh-diff">시간제한 모의 · 인적성 추론·수리</span>' +
        '<span class="qh-pill">시간제한</span></div>' +
    '</div>';

    html += '<p class="q-prompt">' + promptFor(p.type) + '</p>';
    html += '<div class="stem-card">' + p.stemHTML + '</div>';
    html += '<div class="opts-head"><span class="opts-head-k">보기</span>' +
      '<span class="opts-head-n">선택 - / ' + p.options.length + '</span></div>';
    html += optsButtons(p);
    html += '<div class="q-foot"><button class="ghost wide" id="skip">건너뛰기 →</button></div>';

    setScreen(html);
    bind('#quit', function () { if (confirm('모의를 끝내고 나갈까요? 진행 중인 답안은 사라집니다.')) setTab('mock'); });
    bindOpts(answerMock);
    bind('#skip', function () { answerMock(null); });
  }

  function viewMockResult() {
    var r = session.result, p = pct(r.correct, r.total);
    var html = '<div class="result">';
    html += '<div class="res-head"><div class="scr-klabel">시간제한 모의 · 인적성 추론·수리</div>' +
      '<h1 class="scr-title">모의 결과</h1></div>';

    html += '<div><div class="score-ring" style="--p:' + p + '">' +
      '<div class="score-inner"><div class="score-num">' + r.correct + '</div>' +
      '<div class="score-den">/ ' + r.total + ' 정답</div></div></div>' +
      '<div class="res-sub">정답률 ' + p + '% · 소요 ' + Math.round((r.usedSec || 0) / 60) + '분 / ' + (r.sec / 60) + '분</div></div>';

    html += '<div class="bars"><div class="sec-label">유형별 정답률</div>';
    html += ENGINE.types.map(function (t) {
      var d = r.per[t]; if (!d) return '';
      var pp = pct(d.correct, d.seen);
      return '<div class="bar-row"><div class="bar-head"><div class="bar-name">' + barIcon(t) +
        '<span>' + esc(typeLabel(t)) + '</span></div><span class="bar-pct">' + pp + '%</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pp + '%"></div></div></div>';
    }).join('') + '</div>';

    html += '<div class="info-card">' + IC_CLOCK_BIG +
      '<div><div class="info-k">시간 전략</div><div class="info-t">' + esc(bandLabel(p)) + '</div></div></div>';

    html += '<div class="note-card"><div class="note-i">i</div>' +
      '<div class="note-t">' + esc(DATA.copy.disclaimer) + '</div></div>';

    // 가장 약한 유형(정답률 최저) 찾아 바로 훈련 연결 — 루프 닫기
    var weak = null, weakP = 101;
    ENGINE.types.forEach(function (t) {
      var dd = r.per[t]; if (dd && dd.seen) { var wp = pct(dd.correct, dd.seen); if (wp < weakP) { weakP = wp; weak = t; } }
    });

    html += '<div class="q-foot">';
    if (weak) html += '<button class="primary" id="weak">약점 훈련하기 · ' + esc(typeLabel(weak)) + ' <span class="arr">→</span></button>';
    html += '<button class="ghost wide" id="again">모의 다시 보기</button>' +
      '<button class="ghost wide" id="home">기록 보기</button></div>';
    html += '</div>';

    setScreen(html);
    if (weak) bind('#weak', function () { startPractice(weak); });
    bind('#again', startMock);
    bind('#home', function () { setTab('stats'); });
  }

  function viewMockIntro() {
    var m = DATA.mock;
    var html = '<div class="intro">' +
      '<div class="intro-ic">' + tabIcon('mock', true) + '</div>' +
      '<h2>모의고사</h2>' +
      '<p class="lead">' + m.count + '문항 · ' + (m.seconds / 60) + '분. 실제 인적성처럼 한 번 시작하면 멈출 수 없고, 해설은 끝난 뒤에 나옵니다.</p>' +
      '<ul class="intro-pts"><li>유형이 가중치대로 섞여 나옵니다</li><li>건너뛴 문항은 오답 처리됩니다</li><li>시간 안에 최대한 정확하게</li></ul>' +
      '<button class="primary" id="start">시작하기 <span class="arr">→</span></button>' +
      '<div class="note-card" style="margin-top:16px;text-align:left"><div class="note-i">i</div>' +
      '<div class="note-t">' + esc(DATA.copy.disclaimer) + '</div></div>' +
    '</div>';
    setScreen(html);
    bind('#start', startMock);
  }

  function buildTrendSvg() {
    var acc = state.history.slice(0, 12).reverse().map(function (r) { return pct(r.correct, r.total); });
    if (acc.length < 2) return null;
    var W = 300, H = 118, pad = 10;
    var mn = Math.max(0, Math.min.apply(null, acc) - 8), mx = Math.min(100, Math.max.apply(null, acc) + 8);
    if (mx - mn < 20) { mx = Math.min(100, mn + 20); }
    var xs = function (i) { return pad + i * (W - 2 * pad) / (acc.length - 1); };
    var ys = function (v) { return pad + (1 - (v - mn) / (mx - mn)) * (H - 2 * pad); };
    var line = '';
    acc.forEach(function (v, i) { line += (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1) + ' '; });
    var area = line + 'L ' + xs(acc.length - 1).toFixed(1) + ' ' + (H - pad) + ' L ' + xs(0).toFixed(1) + ' ' + (H - pad) + ' Z';
    var dotCx = xs(acc.length - 1).toFixed(1), dotCy = ys(acc[acc.length - 1]).toFixed(1);
    return '<svg class="trend-svg" viewBox="0 0 300 118" height="118">' +
      '<line x1="10" y1="14" x2="290" y2="14" stroke="#f0f2f8" stroke-width="1"/>' +
      '<line x1="10" y1="60" x2="290" y2="60" stroke="#f0f2f8" stroke-width="1"/>' +
      '<line x1="10" y1="104" x2="290" y2="104" stroke="#f0f2f8" stroke-width="1"/>' +
      '<path d="' + area + '" fill="rgba(91,108,255,.09)" stroke="none"/>' +
      '<path d="' + line + '" fill="none" stroke="#5b6cff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + dotCx + '" cy="' + dotCy + '" r="4.5" fill="#5b6cff" stroke="#fff" stroke-width="2"/></svg>' +
      '<div class="trend-foot"><span>' + acc.length + '세션 전</span><span>' + acc[acc.length - 1] + '%</span></div>';
  }

  function viewStats() {
    var totSeen = ENGINE.types.reduce(function (a, t) { return a + state.stats[t].seen; }, 0);
    var totCor = ENGINE.types.reduce(function (a, t) { return a + state.stats[t].correct; }, 0);
    var html = '<h1 class="scr-title">기록</h1>';

    // 추이 차트
    var trend = buildTrendSvg();
    html += '<div class="trend-card" style="margin-top:14px"><div class="trend-head">' +
      '<span class="trend-title">평균 정답률 추이</span>' +
      '<span class="trend-sub">최근 ' + Math.min(12, state.history.length) + '세션</span></div>';
    html += trend || '<div class="trend-empty">모의를 보면 정답률 추이가 쌓입니다.</div>';
    html += '</div>';

    // 누적 통계
    html += '<div class="rec-grid" style="margin-top:14px">' +
      '<div class="rec-cell"><div class="rec-k">푼 문항</div><div class="rec-v">' + totSeen.toLocaleString() + '</div></div>' +
      '<div class="rec-cell"><div class="rec-k">평균 정답률</div><div class="rec-v">' + pct(totCor, totSeen) + '%</div></div>' +
      '<div class="rec-cell"><div class="rec-k">최고 연속</div><div class="rec-v">' + maxBest() + '</div></div>' +
      '<div class="rec-cell"><div class="rec-k">최고 레벨</div><div class="rec-v accent">L' + maxDiff() + '</div></div>' +
    '</div>';

    // 유형별 적응 레벨
    html += '<div class="level-card" style="margin-top:14px"><span class="sec-label">유형별 적응 레벨</span>';
    html += DATA.types.map(function (t, i) {
      var st = state.stats[t.id] || { seen: 0, correct: 0 };
      var sub = st.seen ? (pct(st.correct, st.seen) + '% · ' + st.seen + '문항') : '아직 기록 없음';
      return (i ? '<div class="level-div"></div>' : '') +
        '<div class="level-row"><div class="level-left"><span class="level-pill">L' + state.diff[t.id] + '</span>' +
        '<span class="level-name">' + esc(t.label) + '</span></div><span class="level-sub">' + sub + '</span></div>';
    }).join('') + '</div>';

    // 점수 해석 안내
    html += '<div class="note-link" id="disc" style="margin-top:14px"><div class="note-link-l">' +
      '<div class="note-i">i</div><span class="note-link-t">점수 해석 안내 — 추론·수리 영역 전용입니다</span></div>' + IC_CHEV + '</div>';

    // 설정 (구 '나' 탭 흡수)
    html += '<div class="settings"><button class="ghost wide" id="reset">기록 초기화</button>' +
      '<p class="links"><a href="privacy.html">개인정보</a> · <a href="terms.html">약관</a></p>' +
      '<p class="ver">매트릭스아이큐 · LogicCraft</p></div>';

    setScreen(html);
    bind('#disc', function () { alert(DATA.copy.disclaimer); });
    bind('#reset', function () {
      if (confirm('모든 훈련 기록을 지울까요?')) {
        localStorage.removeItem(STORE_KEY);
        state = {}; state.diff = {}; state.stats = {}; state.history = [];
        DATA.types.forEach(function (t) { state.diff[t.id] = 2; });
        ENGINE.types.forEach(function (t) { state.stats[t] = { seen: 0, correct: 0, timeMs: 0, best: 0 }; });
        save(); render();
      }
    });
  }

  // ── 공통 렌더 ──
  function setScreen(html) {
    document.getElementById('app').innerHTML = html;
    var tb = document.getElementById('tabbar');
    var hide = session && (session.mode === 'practice' || (session.mode === 'mock' && !session.result));
    tb.style.display = hide ? 'none' : 'flex';
    tb.innerHTML = DATA.tabs.map(function (t) {
      return '<button class="tab' + (t.id === current ? ' on' : '') + '" data-tab="' + t.id + '">' +
        tabIcon(t.id, t.id === current) +
        '<span class="tab-l">' + esc(t.label) + '</span><span class="tab-dot"></span></button>';
    }).join('');
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
    document.getElementById('app').scrollTop = 0;
    window.scrollTo(0, 0);
  }
  function bind(sel, fn) { var el = document.querySelector(sel); if (el) el.addEventListener('click', fn); }
  function bindOpts(fn) {
    document.querySelectorAll('.opt[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () { fn(parseInt(b.getAttribute('data-opt'), 10)); });
    });
  }

  function render() {
    if (session && session.mode === 'practice') return viewPractice();
    if (session && session.mode === 'mock') return viewMock();
    if (current === 'train') return viewTrain();
    if (current === 'mock') return viewMockIntro();
    if (current === 'stats') return viewStats();
    viewTrain();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  render();
})();
