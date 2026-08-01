/* 언어 — 번역을 원문 바로 옆에 둔다.
 *
 * 사전에 모아 두고 렌더된 HTML 을 사후 치환하는 방식은, 통문장 키가 하나 빠지면
 * 문장 안에서 짧은 키만 바뀌어 한/영이 섞인 문장을 만든다. 여기서는
 * tr('한글', 'English') 로 두 언어를 같은 자리에 두어 그 사고가 구조적으로 안 생기게 한다.
 *
 * ★ tr() 은 호출 시점의 언어로 값을 돌려준다. 모듈이 읽힐 때 한 번만 평가되는 자리
 *   (LESSONS·GUIDE·LEARN 같은 상수 배열)에 쓰면 그때의 언어로 굳어 토글이 안 먹는다.
 *   그런 자리는 L('한글','English') 로 짝만 만들어 두고 그리는 시점에 dl() 로 푼다.
 *
 * ★ 번역 함수를 t 로 지으면 콜백의 반복 변수 t 와 겹쳐 조용히 깨진다. 이름은 tr.
 */
(function (global) {
  'use strict';

  var FM = global.FirstMix = global.FirstMix || {};
  var KEY = 'firstmix/lang';

  function initial() {
    // ?lang=en 은 저장값보다 먼저다. 검증이 기계 로케일에 휘둘리지 않으려면 이게 필요하다.
    var q = /[?&]lang=(ko|en)(&|$)/.exec((global.location && global.location.search) || '');
    if (q) return q[1];
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (e) {}
    var nav = (global.navigator && (navigator.language || navigator.userLanguage)) || 'en';
    return /^ko/i.test(nav) ? 'ko' : 'en';
  }

  FM.lang = initial();

  FM.tr = function (ko, en) { return FM.lang === 'en' ? en : ko; };

  /* 상수 배열에 넣어 두는 두 언어 짝. 그리는 시점에 dl() 로 푼다. */
  FM.L = function (ko, en) { return { ko: ko, en: en }; };

  /* 짝이면 지금 언어로, 아니면 그대로. 섞여 있어도 안전하게 통과시킨다. */
  FM.dl = function (v) {
    if (v && typeof v === 'object' && typeof v.ko === 'string') {
      return typeof v[FM.lang] === 'string' ? v[FM.lang] : v.ko;
    }
    return v;
  };

  var APP_NAME = { ko: '첫믹스', en: 'FirstMix' };

  /* index.html 에 직접 적힌 부분. 스크립트가 body 끝에 있어 이 시점에 게이트가 이미 있다. */
  function localizeStatic() {
    var name = FM.dl(APP_NAME);
    document.documentElement.lang = FM.lang;
    document.title = name;

    var title = document.getElementById('screen-title');
    if (title && !FM.state) title.textContent = name;

    var set = function (sel, text) {
      var n = document.querySelector(sel);
      if (n) n.textContent = text;
    };
    set('.gate-logo', name);
    set('.gate-lead', FM.tr('폰 하나로 시작하는 디제잉', 'DJing that starts with just a phone'));
    set('#gate-btn', FM.tr('소리 켜고 시작', 'Turn on sound and start'));

    var note = document.querySelector('.gate-note');
    if (note) {
      note.textContent = '';
      if (FM.lang === 'en') {
        note.append('Wired earphones are recommended.', document.createElement('br'),
          'Bluetooth delivers sound late, which throws your sense of timing off.');
      } else {
        var b = document.createElement('b');
        b.textContent = '유선';
        note.append('이어폰은 ', b, '을 권합니다.', document.createElement('br'),
          '블루투스는 소리가 늦게 도착해서 박자 감각이 어긋납니다.');
      }
    }
  }

  FM.setLang = function (lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    if (lang === FM.lang) return;
    FM.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    localizeStatic();
    paintGateLang();
    // 앱이 이미 떠 있으면 현재 화면을 다시 그린다. 게이트 단계면 그릴 화면이 없다.
    if (FM.state && FM.go) FM.go(FM.state.tab);
  };

  /* ── 언어 고르기 한 줄 ────────────────────────────────
   * 나 화면과 게이트가 같은 부품을 쓴다. 게이트에 없으면 한국어를 못 읽는 사람이
   * 첫 화면에서 막힌다 — 자동 감지가 빗나갔을 때 되돌릴 곳이 필요하다. */
  FM.langRow = function () {
    var row = document.createElement('div');
    row.className = 'langrow';
    [['ko', '한국어'], ['en', 'English']].forEach(function (pair) {
      var b = document.createElement('button');
      b.className = 'btn btn-lang' + (FM.lang === pair[0] ? ' on' : '');
      b.textContent = pair[1];
      b.dataset.lang = pair[0];
      b.addEventListener('click', function () { FM.setLang(pair[0]); });
      row.appendChild(b);
    });
    return row;
  };

  function paintGateLang() {
    var row = document.querySelector('.gate .langrow');
    if (!row) return;
    [].forEach.call(row.children, function (b) {
      b.classList.toggle('on', b.dataset.lang === FM.lang);
    });
  }

  localizeStatic();
  var card = document.querySelector('.gate-card');
  if (card) card.appendChild(FM.langRow());
})(typeof window !== 'undefined' ? window : this);
