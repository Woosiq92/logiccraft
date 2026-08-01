/* 난제도감 — 화면 로직 (zero-build 바닐라).
 * 라우팅: location.hash. #/today #/dex #/map #/lesson #/me #/p/<id> #/c/<collection>
 */
(function () {
  'use strict';

  var STORE_KEY = 'nanje-dogam/state';
  var P = window.PROBLEMS, M = window.META, IDX = window.INDEX_CORPUS;
  var state = load();
  if (!state.read) state.read = {};
  if (!state.fav) state.fav = {};
  if (!state.notes) state.notes = {};
  if (!state.filter) state.filter = { field: '', status: '', entry: '', q: '' };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('save 실패(용량?):', e.message); }
  }

  // ︎ = 텍스트 표현 선택자. 없으면 iOS 가 ☀·✎·☺ 를 컬러 이모지로 바꿔 버려서
  // 탭바만 원색으로 튄다(크롬에서는 재현되지 않아 시뮬레이터에서야 보였다).
  var TABS = [
    { id: 'today',  icon: '☀︎', label: '오늘' },
    { id: 'dex',    icon: '▦︎', label: '도감' },
    { id: 'map',    icon: '⁂︎', label: '지도' },
    { id: 'lesson', icon: '✎︎', label: '수업' },
    { id: 'me',     icon: '☺︎', label: '나' },
  ];

  // ── 유틸 ──
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function byId(id) { for (var i = 0; i < P.length; i++) if (P[i].id === id) return P[i]; return null; }
  function isOpen(p) { return p.status !== 'solved'; }
  function yearText(y) { return y < 0 ? '기원전 ' + (-y) + '년' : y + '년'; }
  function ageOf(p) {
    var end = p.status === 'solved' && p.solved ? p.solved : new Date().getFullYear();
    return end - p.posed;
  }
  function money(b) {
    if (!b) return '';
    if (b.cur === 'USD') return '$' + b.amount.toLocaleString('en-US');
    return b.amount.toLocaleString('ko-KR') + b.cur;
  }
  // 날짜 시드 — 서버 없이 모든 기기에서 같은 값 (메모리: 절차생성이면 날짜 시드로 충분)
  function daySeed(d) {
    d = d || new Date();
    var key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return (key % 2147483647 * 48271) % 2147483647;
  }
  function todayPick() {
    var pool = P.filter(isOpen);
    return pool[daySeed() % pool.length];
  }

  // ── 공통 조각 ──
  function statusChip(p) {
    var s = M.status[p.status];
    return '<span class="chip st-' + s.tone + '">' + esc(s.label) + '</span>';
  }
  function fieldChip(p) {
    var f = M.fields[p.field];
    return '<span class="chip fld" style="--c:' + f.color + '">' + f.icon + ' ' + esc(f.label) + '</span>';
  }
  function cards(list) { return '<div class="cardgrid">' + list.map(card).join('') + '</div>'; }

  function card(p) {
    var f = M.fields[p.field];
    var readMark = state.read[p.id] ? '<span class="readdot" title="읽음">●</span>' : '';
    return '<a class="pcard" href="#/p/' + p.id + '" style="--c:' + f.color + '">'
      + '<div class="pcard-top"><span class="pglyph">' + f.icon + '</span>' + statusChip(p) + readMark + '</div>'
      + '<h3>' + esc(p.ko) + '</h3>'
      + '<p>' + esc(p.oneline) + '</p>'
      // 해결된 문제는 제기 연도만 보여주면 "얼마나 버텼나"가 안 보인다. 목록에서 바로 읽히게 둘 다 적는다.
      + '<div class="pcard-foot">' + esc(f.label) + ' · ' + yearText(p.posed) + ' 제기'
      + (p.status === 'solved' && p.solved ? ' → ' + p.solved + '년 해결 <em>' + ageOf(p) + '년</em>' : '')
      + (p.bounty ? ' · <b>' + money(p.bounty) + '</b>' : '') + '</div>'
      + '</a>';
  }

  // ── 화면: 오늘 ──
  function screenToday() {
    var p = todayPick();
    var f = M.fields[p.field];
    var recent = P.filter(function (x) { return x.status === 'disputed'; });
    var h = '';

    h += '<section class="hero" style="--c:' + f.color + '">'
      + '<div class="hero-label">오늘의 난제</div>'
      + '<h2>' + esc(p.ko) + '</h2>'
      + '<p class="hero-one">' + esc(p.oneline) + '</p>'
      + '<div class="hero-meta">' + yearText(p.posed) + ' 제기 · ' + ageOf(p) + '년째 미해결</div>'
      + '<a class="btn" href="#/p/' + p.id + '">펼쳐 보기</a>'
      // 넓은 화면에서 히어로 오른쪽이 비어 보인다. 분야 기호를 워터마크로 깔아 채운다(장식 전용).
      + '<span class="hero-glyph" aria-hidden="true">' + f.icon + '</span>'
      + '</section>';

    h += '<h2 class="sec">컬렉션</h2><div class="colgrid">';
    M.collections.forEach(function (c) {
      var n = P.filter(function (x) { return (x.tags || []).indexOf(c.id) >= 0; }).length;
      if (!n) return;
      h += '<a class="ccard" href="#/c/' + c.id + '"><h3>' + esc(c.label) + '</h3>'
        + '<p>' + esc(c.sub) + '</p><span class="cnum">' + n + '</span></a>';
    });
    h += '</div>';

    if (recent.length) {
      h += '<h2 class="sec">검증이 진행 중인 주장</h2>'
        + '<p class="note">해결됐다는 발표가 나왔지만 학계 확인이 끝나지 않은 문제입니다. 결론이 뒤집힌 전례가 많아 따로 모아둡니다.</p>';
      h += cards(recent);
    }

    h += '<h2 class="sec">가장 오래 버티는 중</h2><div class="rankwrap">';
    h += P.filter(isOpen).sort(function (a, b) { return ageOf(b) - ageOf(a); }).slice(0, 3)
      .map(function (x) {
        return '<a class="rankrow" href="#/p/' + x.id + '"><b>' + ageOf(x) + '년</b>'
          + '<span>' + esc(x.ko) + '</span><em>' + yearText(x.posed) + '부터</em></a>';
      }).join('') + '</div>';

    return h;
  }

  // ── 화면: 도감 ──
  function screenDex() {
    var fl = state.filter;
    var list = P.filter(function (p) {
      if (fl.field && p.field !== fl.field) return false;
      if (fl.status === 'open' && !isOpen(p)) return false;
      if (fl.status === 'solved' && isOpen(p)) return false;
      if (fl.entry && p.entry > +fl.entry) return false;
      if (fl.q) {
        var q = fl.q.toLowerCase();
        if ((p.ko + ' ' + p.en + ' ' + p.oneline).toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });

    var h = '<div class="filters">';
    h += '<input class="search" id="q" type="search" placeholder="문제 이름으로 찾기" value="' + esc(fl.q) + '" />';
    h += '<div class="chiprow"><button class="fchip' + (fl.field ? '' : ' on') + '" data-f="">전체</button>';
    Object.keys(M.fields).forEach(function (k) {
      h += '<button class="fchip' + (fl.field === k ? ' on' : '') + '" data-f="' + k + '" style="--c:' + M.fields[k].color + '">' + esc(M.fields[k].label) + '</button>';
    });
    h += '</div>';
    h += '<div class="chiprow">'
      + '<button class="fchip' + (fl.status || fl.entry ? '' : ' on') + '" data-s="">상태 전체</button>'
      + '<button class="fchip' + (fl.status === 'open' ? ' on' : '') + '" data-s="open">미해결</button>'
      + '<button class="fchip' + (fl.status === 'solved' ? ' on' : '') + '" data-s="solved">해결됨</button>'
      + '<button class="fchip' + (fl.entry === '2' ? ' on' : '') + '" data-e="2">진술이 쉬운 것만</button>'
      + '</div></div>';

    h += '<p class="count">' + list.length + '개</p>';
    h += list.length ? cards(list) : '<p class="empty">조건에 맞는 문제가 없습니다.</p>';

    // 색인 코퍼스 — 정독 코퍼스와 층을 시각적으로 분리
    var ilist = IDX.filter(function (x) {
      if (fl.field && x.field !== fl.field) return false;
      if (fl.status === 'solved' || fl.entry) return false;
      if (fl.q && (x.ko + ' ' + x.en).toLowerCase().indexOf(fl.q.toLowerCase()) < 0) return false;
      return true;
    });
    if (ilist.length) {
      h += '<h2 class="sec">색인만 있는 문제 <span class="secn">' + ilist.length + '</span></h2>'
        + '<p class="note">아직 해설을 쓰지 않은 항목입니다. 이름과 분야만 있습니다.</p>'
        + '<div class="idxwrap">'
        + ilist.map(function (x) {
          return '<div class="idxrow"><b>' + esc(x.ko) + '</b><span>' + esc(x.en) + '</span>'
            + '<em>' + esc(M.fields[x.field].label) + '</em></div>';
        }).join('') + '</div>';
    }
    return h;
  }

  function bindDex() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () {
      state.filter.q = q.value; save();
      var keep = q.selectionStart;
      render();
      var q2 = document.getElementById('q');
      if (q2) { q2.focus(); try { q2.setSelectionRange(keep, keep); } catch (e) {} }
    });
    document.querySelectorAll('.fchip').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.hasAttribute('data-f')) state.filter.field = b.getAttribute('data-f');
        if (b.hasAttribute('data-s')) { state.filter.status = b.getAttribute('data-s'); state.filter.entry = ''; }
        if (b.hasAttribute('data-e')) {
          state.filter.entry = state.filter.entry === '2' ? '' : '2';
          state.filter.status = '';
        }
        save(); render();
      });
    });
  }

  // ── 화면: 상세 ──
  var RELLABEL = {
    implies:     { pre: '이 문제가 참이면 함께 풀린다', arrow: '→' },
    impliedby:   { pre: '이 문제가 풀리면 여기도 풀린다', arrow: '←' },
    generalizes: { pre: '이 문제를 일반화한 문제', arrow: '⊃' },
    special:     { pre: '이 문제의 특수한 경우', arrow: '⊂' },
    equiv:       { pre: '사실상 같은 문제', arrow: '=' },
    related:     { pre: '관련', arrow: '·' },
  };

  function screenProblem(id) {
    var p = byId(id);
    if (!p) return '<p class="empty">없는 문제입니다.</p>';
    var f = M.fields[p.field], s = M.status[p.status];
    var layer = state.layer || 'oneline';
    if (!state.read[p.id]) { state.read[p.id] = 1; save(); }

    /* 넓은 화면에서는 본문(이해 사다리·왜 어려운가)과 곁다리(연표·관계·출처)를 좌우로 나눈다.
       좁은 화면에서는 한 줄로 무너지고, 그때의 순서가 원래 읽던 순서와 같다. */
    var h = '<article class="detail" style="--c:' + f.color + '">';
    h += '<header class="dhead">';
    h += '<div class="dtop">' + fieldChip(p) + statusChip(p) + (p.bounty ? '<span class="chip bounty">' + money(p.bounty) + '</span>' : '') + '</div>';
    h += '<h2 class="dtitle">' + esc(p.ko) + '</h2>';
    h += '<p class="den">' + esc(p.en) + '</p>';
    h += '<p class="dmeta">' + yearText(p.posed) + ' · ' + esc(p.by)
      + (p.status === 'solved' && p.solved ? ' &nbsp;|&nbsp; ' + p.solved + '년 해결 · ' + esc(p.solvedBy) : '')
      + '</p>';
    h += '<p class="dstat">' + esc(s.desc) + '</p>';
    h += '</header><div class="dgrid"><div class="dmain">';

    /* 이해 사다리.
       좁은 화면에서는 탭으로 한 층씩 보여준다(세로 공간 절약).
       넓은 화면에서는 세 층을 전부 펼친다. 자리가 남는데 감출 이유가 없고,
       세 서술을 나란히 놓고 견주는 것이 이 앱의 본래 의도에 더 가깝다. CSS 가 어느 쪽인지 정한다. */
    var LAYERS = [
      { k: 'oneline', label: '한 줄' },
      { k: 'analogy', label: '비유' },
      { k: 'formal',  label: '정식 서술' },
    ];
    h += '<div class="seg" id="seg">' + LAYERS.map(function (L) {
      return '<button data-l="' + L.k + '"' + (layer === L.k ? ' class="on"' : '') + '>' + L.label + '</button>';
    }).join('') + '</div>';

    h += '<div class="ladder">';
    LAYERS.forEach(function (L) {
      h += '<section class="lblock' + (layer === L.k ? ' on' : '') + '" data-l="' + L.k + '">';
      h += '<h3 class="lbl">' + L.label + '</h3>';
      if (L.k === 'analogy') {
        h += '<p class="warn">아래는 비유입니다. 정확한 진술이 아니며 세부를 일부러 생략했습니다. 정식 서술과 함께 보세요.</p>';
      }
      h += '<div class="layer' + (L.k === 'formal' ? ' mono' : '') + '">' + esc(p[L.k]) + '</div>';
      h += '</section>';
    });
    h += '</div>';

    h += '<h3 class="dsec">왜 어려운가</h3><div class="layer">' + esc(p.whyHard) + '</div>';
    h += '</div><aside class="drail">';

    if (p.timeline && p.timeline.length) {
      h += '<h3 class="dsec">연표</h3><ol class="tl">';
      p.timeline.forEach(function (t) {
        h += '<li><b>' + yearText(t.y) + '</b><span>' + esc(t.e) + '</span></li>';
      });
      h += '</ol>';
      h += '<p class="note">진행률은 표시하지 않습니다. 수학에서 부분 결과가 절반쯤 왔다는 뜻은 아니기 때문입니다.</p>';
    }

    var rels = (p.rel || []).filter(function (r) { return byId(r.to); });
    if (rels.length) {
      h += '<h3 class="dsec">이어진 문제</h3><div class="rels">';
      rels.forEach(function (r) {
        var t = byId(r.to), L = RELLABEL[r.t] || RELLABEL.related;
        h += '<a class="rel" href="#/p/' + t.id + '"><span class="relk">' + L.arrow + ' ' + esc(L.pre) + '</span>'
          + '<b>' + esc(t.ko) + '</b></a>';
      });
      h += '</div><a class="btn ghost" href="#/map?focus=' + p.id + '">관계 지도에서 보기</a>';
    }

    if (p.src && p.src.length) {
      h += '<h3 class="dsec">출처</h3><ul class="srcs">';
      p.src.forEach(function (x) {
        h += '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a></li>';
      });
      h += '</ul>';
      h += '<p class="note">이 화면의 해설 문장은 직접 작성했습니다. 연도와 인명 같은 사실은 위 출처를 참조했습니다.</p>';
    }

    h += '<button class="btn ' + (state.fav[p.id] ? 'on' : 'ghost') + '" id="fav">'
      + (state.fav[p.id] ? '관심 해제' : '관심 표시') + '</button>';
    h += '</aside></div></article>';
    return h;
  }

  function bindProblem(id) {
    document.querySelectorAll('#seg button').forEach(function (b) {
      b.addEventListener('click', function () { state.layer = b.getAttribute('data-l'); save(); render(); });
    });
    var fav = document.getElementById('fav');
    if (fav) fav.addEventListener('click', function () {
      if (state.fav[id]) delete state.fav[id]; else state.fav[id] = 1;
      save(); render();
    });
  }

  // ── 화면: 컬렉션 ──
  function screenCollection(cid) {
    var c = null;
    M.collections.forEach(function (x) { if (x.id === cid) c = x; });
    if (!c) return '<p class="empty">없는 컬렉션입니다.</p>';
    var list = P.filter(function (p) { return (p.tags || []).indexOf(cid) >= 0; });
    var h = '<div class="chead"><h2>' + esc(c.label) + '</h2><p>' + esc(c.sub) + '</p>'
      + (c.note ? '<p class="cnote">' + esc(c.note) + '</p>' : '') + '</div>';
    return h + cards(list);
  }

  // ── 화면: 관계 지도 ──
  function screenMap() {
    var mf = state.mapField || '';
    var h = '<p class="note">문제 하나가 풀리면 함께 풀리는 문제가 있습니다. 선은 그 관계입니다. 목록으로는 보이지 않는 구조라서 따로 그렸습니다.</p>';
    h += '<div class="chiprow"><button class="fchip' + (mf ? '' : ' on') + '" data-mf="">전체</button>';
    Object.keys(M.fields).forEach(function (k) {
      h += '<button class="fchip' + (mf === k ? ' on' : '') + '" data-mf="' + k + '" style="--c:' + M.fields[k].color + '">'
        + esc(M.fields[k].label) + '</button>';
    });
    h += '</div>';
    h += '<div class="graphwrap"><canvas id="gcanvas"></canvas></div>'
      + '<div id="gsel" class="gsel"></div>';
    return h;
  }

  function bindMap() {
    document.querySelectorAll('[data-mf]').forEach(function (b) {
      b.addEventListener('click', function () { state.mapField = b.getAttribute('data-mf'); save(); render(); });
    });
  }

  // ── 화면: 수업 ──
  function screenLesson() {
    var L = M.lesson;
    var step = state.lessonStep || 0;
    var h = '<div class="lhead"><h2>' + esc(L.title) + '</h2><p>' + esc(L.grade) + '</p>'
      + '<p class="cnote">' + esc(L.goal) + '</p></div>';

    h += '<div class="lsteps">';
    L.steps.forEach(function (s, i) {
      h += '<button class="lstep' + (i === step ? ' on' : '') + '" data-i="' + i + '">'
        + '<b>' + s.min + '분</b><span>' + esc(s.title) + '</span></button>';
    });
    h += '</div>';

    var s = L.steps[step];
    h += '<div class="lbody"><h3>' + (step + 1) + '. ' + esc(s.title) + ' <em>' + s.min + '분</em></h3>'
      + '<p class="lteacher">' + esc(s.teacher) + '</p>'
      + (s.note ? '<p class="lnote">' + esc(s.note) + '</p>' : '');

    if (s.screen === 'worksheet') h += worksheet();
    else if (s.screen.indexOf('problem:') === 0) {
      var p = byId(s.screen.split(':')[1]);
      if (p) h += card(p);
    } else if (s.screen === 'hall') {
      h += cards(P.filter(function (x) { return (x.tags || []).indexOf('hall') >= 0; }).slice(0, 3));
    } else if (s.screen === 'dex') {
      h += '<a class="btn" href="#/dex">도감 열기</a>';
    }
    h += '</div>';

    h += '<div class="lnav">'
      + (step > 0 ? '<button class="btn ghost" data-go="' + (step - 1) + '">이전</button>' : '')
      + (step < L.steps.length - 1 ? '<button class="btn" data-go="' + (step + 1) + '">다음</button>' : '')
      + '</div>';
    return h;
  }

  function worksheet() {
    var pool = P.filter(function (p) { return isOpen(p) && p.entry <= 2; });
    var p = byId(state.wsPid) || pool[0];
    var note = state.notes[p.id] || '';
    var h = '<div class="ws">';
    h += '<label class="wslabel" for="wspick">문제 고르기</label><select id="wspick">';
    pool.forEach(function (x) {
      h += '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.ko) + '</option>';
    });
    h += '</select>';
    h += '<div class="wsbox"><b>한 줄</b><p>' + esc(p.oneline) + '</p></div>';
    h += '<div class="wsbox mono"><b>정식 서술</b><p>' + esc(p.formal) + '</p></div>';
    h += '<label class="wslabel" for="wsnote">우리 모둠의 비유</label>'
      + '<textarea id="wsnote" rows="6" placeholder="위 두 줄만 보고, 이 문제를 처음 듣는 사람에게 설명하는 문단을 써보세요.">' + esc(note) + '</textarea>';
    h += '<button class="btn ghost" id="wsreveal">' + (state.wsReveal ? '앱의 비유 접기' : '다 쓴 뒤 앱의 비유 열기') + '</button>';
    if (state.wsReveal) h += '<div class="wsbox reveal"><b>앱의 비유</b><p>' + esc(p.analogy) + '</p></div>';
    h += '</div>';
    return h;
  }

  function bindLesson() {
    document.querySelectorAll('.lstep').forEach(function (b) {
      b.addEventListener('click', function () { state.lessonStep = +b.getAttribute('data-i'); save(); render(); });
    });
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { state.lessonStep = +b.getAttribute('data-go'); save(); render(); });
    });
    var pick = document.getElementById('wspick');
    if (pick) pick.addEventListener('change', function () { state.wsPid = pick.value; state.wsReveal = false; save(); render(); });
    var rev = document.getElementById('wsreveal');
    if (rev) rev.addEventListener('click', function () { state.wsReveal = !state.wsReveal; save(); render(); });
    var ta = document.getElementById('wsnote');
    if (ta) ta.addEventListener('input', function () {
      var pid = pick ? pick.value : null;
      if (pid) { state.notes[pid] = ta.value; save(); }
    });
  }

  // ── 화면: 나 ──
  function screenMe() {
    var readN = Object.keys(state.read).length;
    var favN = Object.keys(state.fav).length;
    var h = '<div class="stats">'
      + '<div class="stat"><b>' + readN + '</b><span>펼쳐 본 문제</span></div>'
      + '<div class="stat"><b>' + P.length + '</b><span>해설이 있는 문제</span></div>'
      + '<div class="stat"><b>' + IDX.length + '</b><span>색인만 있는 문제</span></div>'
      + '</div>';

    h += '<h2 class="sec">분야별</h2><div class="bars">';
    Object.keys(M.fields).forEach(function (k) {
      var all = P.filter(function (p) { return p.field === k; });
      var got = all.filter(function (p) { return state.read[p.id]; }).length;
      if (!all.length) return;
      h += '<div class="bar"><span class="bl">' + esc(M.fields[k].label) + '</span>'
        + '<span class="btrack"><i style="width:' + Math.round(got / all.length * 100) + '%;background:' + M.fields[k].color + '"></i></span>'
        + '<span class="bn">' + got + '/' + all.length + '</span></div>';
    });
    h += '</div>';

    if (favN) {
      h += '<h2 class="sec">관심 표시</h2>';
      h += cards(P.filter(function (p) { return state.fav[p.id]; }));
    }

    h += '<h2 class="sec">이 도감에 대하여</h2>'
      + '<p class="note">"모든 난제"를 담는 것은 원리적으로 불가능합니다. 미해결 문제는 계속 늘어나고 확정된 전체 목록이 없습니다. '
      + '이 앱은 해설을 직접 쓴 문제 ' + P.length + '개를 정독 코퍼스로 두고, 나머지는 이름만 있는 색인으로 구분해 표시합니다. '
      + '해설 문장은 전부 직접 작성했으며 연도와 인명 같은 사실은 각 문제의 출처를 참조했습니다.</p>';

    h += '<p class="links"><a href="privacy.html">개인정보</a> · <a href="terms.html">약관</a></p>';
    h += '<button class="btn ghost" id="reset">기록 초기화</button>';
    return h;
  }

  function bindMe() {
    var r = document.getElementById('reset');
    if (r) r.addEventListener('click', function () {
      if (r.getAttribute('data-armed')) {
        state = { read: {}, fav: {}, notes: {}, filter: { field: '', status: '', entry: '', q: '' } };
        save(); location.hash = '#/today'; render();
      } else {
        r.setAttribute('data-armed', '1');
        r.textContent = '한 번 더 누르면 지워집니다';
      }
    });
  }

  /* 데스크톱 좌측 내비. 폰의 탭바와 같은 TABS 를 쓰되, 넓은 화면에서만 보인다.
     하단 탭바를 데스크톱까지 끌고 가면 브라우저에 폰을 욱여넣은 화면이 된다. */
  function sidebar(activeTab) {
    var open = P.filter(isOpen).length;
    var h = '<a class="sb-brand" href="#/today">'
      + '<img src="icon.svg" alt="" width="30" height="30" />'
      + '<span><b>난제도감</b><em>아직 풀리지 않은 수학 난제</em></span></a>';
    h += '<nav class="sb-nav">' + TABS.map(function (t) {
      return '<a class="sb-item' + (t.id === activeTab ? ' on' : '') + '" href="#/' + t.id + '">'
        + '<span class="sb-ico">' + t.icon + '</span>' + esc(t.label) + '</a>';
    }).join('') + '</nav>';
    h += '<div class="sb-stat"><b>' + open + '</b>개가 아직 열려 있습니다'
      + '<span>해설 ' + P.length + '편 · 색인 ' + IDX.length + '건</span></div>';
    h += '<div class="sb-foot"><a href="privacy.html">개인정보</a> · <a href="terms.html">약관</a>'
      + '<span>로직크래프트</span></div>';
    return h;
  }

  // ── 라우팅 ──
  function route() {
    var h = (location.hash || '#/today').slice(2);
    var qi = h.indexOf('?');
    var query = qi >= 0 ? h.slice(qi + 1) : '';
    if (qi >= 0) h = h.slice(0, qi);
    var seg = h.split('/');
    return { view: seg[0] || 'today', arg: seg[1] || '', query: query };
  }

  function titleOf(r) {
    if (r.view === 'p') { var p = byId(r.arg); return p ? p.ko : '난제'; }
    if (r.view === 'c') {
      var c = null;
      M.collections.forEach(function (x) { if (x.id === r.arg) c = x; });
      return c ? c.label : '컬렉션';
    }
    if (r.view === 'today') return '난제도감';
    var t = null;
    TABS.forEach(function (x) { if (x.id === r.view) t = x; });
    return t ? t.label : '난제도감';
  }

  function render() {
    var r = route();
    var body;
    if (r.view === 'p') body = screenProblem(r.arg);
    else if (r.view === 'c') body = screenCollection(r.arg);
    else if (r.view === 'dex') body = screenDex();
    else if (r.view === 'map') body = screenMap();
    else if (r.view === 'lesson') body = screenLesson();
    else if (r.view === 'me') body = screenMe();
    else body = screenToday();

    var title = titleOf(r);
    document.getElementById('screen-title').textContent = title;
    // 웹에서는 탭 제목이 곧 위치 표시이자 공유 시 미리보기 제목이 된다
    document.title = (r.view === 'today' ? '난제도감 — 아직 풀리지 않은 수학 난제' : title + ' · 난제도감');
    document.getElementById('app').innerHTML = body;
    window.scrollTo(0, 0);

    var back = document.getElementById('back');
    var deep = (r.view === 'p' || r.view === 'c');
    back.hidden = !deep;
    back.onclick = function () { history.back(); };

    var activeTab = deep ? '' : r.view;
    document.getElementById('tabbar').innerHTML = TABS.map(function (t) {
      return '<a class="tab' + (t.id === activeTab ? ' on' : '') + '" href="#/' + t.id + '">'
        + '<span class="ti">' + t.icon + '</span><span class="tl">' + esc(t.label) + '</span></a>';
    }).join('');
    document.getElementById('sidebar').innerHTML = sidebar(activeTab);

    if (r.view === 'dex') bindDex();
    if (r.view === 'p') bindProblem(r.arg);
    if (r.view === 'lesson') bindLesson();
    if (r.view === 'me') bindMe();
    if (r.view === 'map') {
      bindMap();
      var focus = /focus=(\w+)/.exec(r.query);
      // 특정 문제를 보러 들어왔으면 분야 필터를 풀어야 그 문제가 화면에 있다
      if (focus) state.mapField = '';
      window.NanjeGraph.mount(document.getElementById('gcanvas'),
        document.getElementById('gsel'), P, M, focus ? focus[1] : null, state.mapField);
    }
  }

  window.addEventListener('hashchange', render);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  render();
})();
