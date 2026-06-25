/* 매트릭스아이큐 — 앱 로직 (zero-build, 바닐라).
 * engine.js 가 문항을 만들고, 여기선 훈련/모의 세션 흐름·기록을 관리한다. */
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

  var current = state.tab || 'train';
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
  // 가중치대로 유형 목록을 정확한 비율로 만든다 (랜덤 편차 없이)
  function buildTypePlan(n, weights) {
    if (!weights) { var arr0 = []; for (var k = 0; k < n; k++) arr0.push('mixed'); return arr0; }
    var types = Object.keys(weights), plan = [];
    types.forEach(function (t) { var c = Math.round(weights[t] * n); for (var j = 0; j < c; j++) plan.push(t); });
    // 반올림 오차로 합이 안 맞으면 가장 큰 가중 유형으로 보정
    var top = types.reduce(function (a, b) { return weights[a] >= weights[b] ? a : b; });
    while (plan.length < n) plan.push(top);
    while (plan.length > n) plan.splice(plan.indexOf(top), 1);
    // 셔플
    for (var s = plan.length - 1; s > 0; s--) { var r = Math.floor(Math.random() * (s + 1)); var tmp = plan[s]; plan[s] = plan[r]; plan[r] = tmp; }
    return plan;
  }
  function startMock() {
    var m = DATA.mock, qs = [];
    var plan = buildTypePlan(m.count, m.weights);
    for (var i = 0; i < m.count; i++) qs.push(ENGINE.generate(plan[i], m.difficulty));
    session = { mode: 'mock', idx: 0, qs: qs, picks: new Array(m.count).fill(null),
      deadline: now() + m.seconds * 1000, done: false };
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
      // 모의 결과도 통계에 반영
      var st = state.stats[p.type]; st.seen++; if (ok) st.correct++;
    });
    var rec = { ts: now(), correct: correct, total: session.qs.length, per: per, sec: DATA.mock.seconds };
    state.history.unshift(rec); state.history = state.history.slice(0, 30);
    save();
    session.result = rec;
    render();
  }
  function bandLabel(p) {
    if (p < 40) return '워밍업 단계 — 유형 익히기부터';
    if (p < 60) return '감 잡는 중';
    if (p < 75) return '안정권';
    if (p < 90) return '상위권 연습';
    return '이 난이도는 충분 — 시간을 더 좁혀보세요';
  }

  // ─────────────────────────────────────────────
  //  렌더
  // ─────────────────────────────────────────────
  function optionGrid(p, cls) {
    return '<div class="opts ' + cls + '">' + p.options.map(function (o, i) {
      return '<button class="opt" data-opt="' + i + '">' + o + '</button>';
    }).join('') + '</div>';
  }

  function viewPractice() {
    var p = session.puzzle, title = '훈련 · Lv.' + state.diff[session.type];
    var html = '<div class="quiz">';
    html += '<div class="quiz-top"><button class="ghost" id="quit">← 나가기</button>' +
      '<span class="streak">🔥 연속 ' + session.streak + '</span></div>';
    html += '<div class="stem">' + p.stemHTML + '</div>';
    if (!session.answered) {
      html += optionGrid(p, p.type === 'matrix' ? 'opts-mx' : 'opts-num');
    } else {
      // 정답/오답 표시
      html += '<div class="opts ' + (p.type === 'matrix' ? 'opts-mx' : 'opts-num') + '">' +
        p.options.map(function (o, i) {
          var k = i === p.answer ? ' right' : (i === session.picked ? ' wrong' : '');
          return '<div class="opt locked' + k + '">' + o + '</div>';
        }).join('') + '</div>';
      var ok = session.picked === p.answer;
      html += '<div class="feedback ' + (ok ? 'ok' : 'no') + '">' +
        '<b>' + (ok ? '정답!' : '오답') + '</b><pre>' + esc(p.explain) + '</pre></div>';
      html += '<button class="primary" id="next">다음 문제 →</button>';
    }
    html += '</div>';
    setScreen(title, html);
    bind('#quit', function () { setTab('train'); });
    if (!session.answered) bindOpts(answerPractice);
    else bind('#next', nextPractice);
  }

  function viewMock() {
    if (session.result) return viewMockResult();
    var p = session.qs[session.idx];
    var html = '<div class="quiz">';
    html += '<div class="quiz-top"><span class="mock-prog">' + (session.idx + 1) + ' / ' + session.qs.length + '</span>' +
      '<span class="mock-clock">⏱️ <b id="mock-time">' + mmss((session.deadline - now()) / 1000) + '</b></span></div>';
    html += '<div class="stem">' + p.stemHTML + '</div>';
    html += optionGrid(p, p.type === 'matrix' ? 'opts-mx' : 'opts-num');
    html += '<button class="ghost wide" id="skip">건너뛰기 →</button>';
    html += '</div>';
    setScreen('모의고사', html);
    bindOpts(answerMock);
    bind('#skip', function () { answerMock(null); });
  }

  function viewMockResult() {
    var r = session.result, p = pct(r.correct, r.total);
    var html = '<div class="result">';
    html += '<div class="score-ring" style="--p:' + p + '%"><div class="score-num">' + r.correct + '<span>/' + r.total + '</span></div></div>';
    html += '<div class="band">' + esc(bandLabel(p)) + '</div>';
    html += '<p class="result-sub">정답률 ' + p + '%</p>';
    html += '<div class="per">' + ENGINE.types.map(function (t) {
      var d = r.per[t]; if (!d) return '';
      var lab = DATA.types.filter(function (x) { return x.id === t; })[0];
      return '<div class="per-row"><span>' + (lab ? lab.icon + ' ' + lab.label : t) + '</span>' +
        '<span>' + d.correct + '/' + d.seen + '</span></div>';
    }).join('') + '</div>';
    html += '<p class="disclaimer">' + esc(DATA.copy.disclaimer) + '</p>';
    html += '<button class="primary" id="again">다시 보기</button>';
    html += '<button class="ghost wide" id="home">기록 보기</button>';
    html += '</div>';
    setScreen('모의 결과', html);
    bind('#again', startMock);
    bind('#home', function () { setTab('stats'); });
  }

  function viewTrain() {
    var html = '<p class="lead">유형을 골라 훈련하세요. 맞히면 난이도가 오르고, 틀리면 내려갑니다.</p>';
    html += '<div class="type-list">' + DATA.types.map(function (t) {
      return '<button class="type-card" data-type="' + t.id + '">' +
        '<span class="tc-ic">' + t.icon + '</span>' +
        '<span class="tc-body"><b>' + esc(t.label) + '</b><small>' + esc(t.desc) + '</small></span>' +
        '<span class="tc-lv">Lv.' + state.diff[t.id] + '</span></button>';
    }).join('') + '</div>';
    setScreen('훈련', html);
    document.querySelectorAll('.type-card').forEach(function (b) {
      b.addEventListener('click', function () { startPractice(b.getAttribute('data-type')); });
    });
  }

  function viewMockIntro() {
    var m = DATA.mock;
    var html = '<div class="intro">';
    html += '<div class="intro-ic">⏱️</div>';
    html += '<h2>모의고사</h2>';
    html += '<p class="lead">' + m.count + '문항 · ' + (m.seconds / 60) + '분. 실제 시험처럼 한 번 시작하면 멈출 수 없고, 해설은 끝난 뒤에 나옵니다.</p>';
    html += '<ul class="intro-pts"><li>세 유형이 무작위로 섞여 나옵니다</li><li>건너뛴 문항은 오답 처리됩니다</li><li>시간 안에 최대한 많이 정확하게</li></ul>';
    html += '<button class="primary" id="start">시작하기</button>';
    html += '<p class="disclaimer">' + esc(DATA.copy.disclaimer) + '</p>';
    html += '</div>';
    setScreen('모의', html);
    bind('#start', startMock);
  }

  function viewStats() {
    var html = '';
    html += '<div class="stat-cards">' + ENGINE.types.map(function (t) {
      var st = state.stats[t], lab = DATA.types.filter(function (x) { return x.id === t; })[0];
      return '<div class="stat-card"><div class="sc-h">' + (lab ? lab.icon + ' ' + lab.label : t) + '</div>' +
        '<div class="sc-big">' + pct(st.correct, st.seen) + '<small>%</small></div>' +
        '<div class="sc-sub">' + st.correct + '/' + st.seen + ' · 최고연속 ' + (st.best || 0) + '</div></div>';
    }).join('') + '</div>';

    html += '<h3 class="sec">모의 기록</h3>';
    if (!state.history.length) html += '<p class="empty">아직 모의고사 기록이 없습니다.</p>';
    else html += '<div class="hist">' + state.history.map(function (r) {
      var dt = new Date(r.ts), md = (dt.getMonth() + 1) + '/' + dt.getDate();
      return '<div class="hist-row"><span>' + md + '</span><span><b>' + r.correct + '</b>/' + r.total + '</span>' +
        '<span>' + pct(r.correct, r.total) + '%</span></div>';
    }).join('') + '</div>';
    setScreen('기록', html);
  }

  function viewMe() {
    var html = '<div class="me">';
    html += '<p class="disclaimer">' + esc(DATA.copy.disclaimer) + '</p>';
    html += '<button class="ghost wide" id="reset">기록 초기화</button>';
    html += '<p class="links"><a href="privacy.html">개인정보</a> · <a href="terms.html">약관</a></p>';
    html += '<p class="ver">매트릭스아이큐 · LogicCraft</p>';
    html += '</div>';
    setScreen('나', html);
    bind('#reset', function () {
      if (confirm('모든 훈련 기록을 지울까요?')) {
        localStorage.removeItem(STORE_KEY);
        state = {}; state.diff = {}; state.stats = {}; state.history = [];
        DATA.types.forEach(function (t) { state.diff[t.id] = 2; });
        ENGINE.types.forEach(function (t) { state.stats[t] = { seen: 0, correct: 0, timeMs: 0, best: 0 }; });
        save(); setTab('stats');
      }
    });
  }

  // ── 공통 렌더 ──
  function setScreen(title, html) {
    document.getElementById('screen-title').textContent = title;
    document.getElementById('app').innerHTML = html;
    var tb = document.getElementById('tabbar');
    var hide = session && (session.mode === 'practice' || (session.mode === 'mock' && !session.result));
    tb.style.display = hide ? 'none' : 'flex';
    tb.innerHTML = DATA.tabs.map(function (t) {
      return '<button class="tab' + (t.id === current ? ' on' : '') + '" data-tab="' + t.id + '">' +
        '<span class="ti">' + t.icon + '</span><span class="tl">' + esc(t.label) + '</span></button>';
    }).join('');
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
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
    if (current === 'me') return viewMe();
    viewTrain();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  render();
})();
