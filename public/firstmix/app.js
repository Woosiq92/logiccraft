/* 첫믹스 — 화면 셸, 믹스 화면, 렌더 루프.
 * zero-build: 전역 FirstMix 네임스페이스를 <script> 로 이어 붙인다. */
(function () {
  'use strict';

  var FM = window.FirstMix;
  var el = FM.el, tr = FM.tr, dl = FM.dl;

  var state = {
    mixer: null,
    picked: { A: 0, B: 2 },
    tab: 'train',
    panels: null,
    raf: 0,
    myTracks: [],         // 보관함 목록 (Blob 제외)
    myMixes: [],          // 녹음한 세트 (Blob 제외)
    channelMeters: [],    // 매 프레임 다시 그리는 레벨 미터들
    onDeck: {},           // 덱에 올라간 트랙 메타 — 보정할 때 어느 덱을 갱신할지 알려면 필요
    progress: loadProgress(),
    settings: loadSettings()
  };
  FM.state = state;

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem('firstmix/progress') || '{}'); }
    catch (e) { return {}; }
  }
  FM.saveProgress = function () {
    try { localStorage.setItem('firstmix/progress', JSON.stringify(state.progress)); } catch (e) {}
  };

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem('firstmix/settings') || '{}'); }
    catch (e) { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem('firstmix/settings', JSON.stringify(state.settings)); } catch (e) {}
  }

  /* 스플릿 출력 켜고 끄기. 끄면 덱에 켜져 있던 미리듣기도 같이 내린다. */
  FM.setSplit = function (on) {
    state.settings.split = !!on;
    saveSettings();
    state.mixer.setSplitOutput(!!on);
    document.body.classList.toggle('split', !!on);
    if (state.panels) { state.panels.a.syncTransport(); state.panels.b.syncTransport(); }
  };

  /* ── 트랙 로딩 ─────────────────────────────────────── */
  FM.loadTrack = function (deck, track) {
    /* 버퍼를 캐시하지 않는다.
     * 편곡이 들어가면서 곡 하나가 50초·20MB 가 됐다. 여섯 곡을 다 들고 있으면 116MB 다.
     * 대신 합성이 11ms 라 매번 다시 만들어도 즉각적이다. 내 음악(디코드)은 원래부터 캐시 안 한다. */
    var p = track.user
      ? FM.Library.decode(track.id, state.mixer.ctx)
      : FM.renderTrack(track, state.mixer.ctx.sampleRate);
    return p.then(function (buf) {
      deck.load(buf, track.bpm, track.beatOffset || 0);
      state.onDeck[deck.id] = track;
      return buf;
    });
  };

  /* 레슨과 오늘의 도전은 메인 섹션만 돌린다.
   * 브레이크에서 킥이 빠지면 박을 셀 수가 없어 판정이 통째로 깨진다.
   * 자유 믹스에서는 편곡 전체를 그대로 듣는다. */
  FM.practiceLoop = function (deck, track, offsetSec) {
    if (!track || track.user || !FM.practiceRegion) return;
    var r = FM.practiceRegion(track);
    deck.seek(r.startSec + (offsetSec || 0));
    deck.setLoop(r.bars * 4);
  };

  /* ── 믹스 화면의 두 얼굴 ───────────────────────────────
   * 레슨 4단계에서는 손잡이가 셋이었는데 믹스 화면에는 서른 개다. 그 절벽이 실재한다.
   * 그렇다고 쉬운 화면을 탭으로 따로 두면 훈련 탭과 하는 일이 겹치고,
   * 무엇보다 초보가 "어느 탭이 내 것인지"를 스스로 골라야 한다 — 초보일수록 못 하는 판단이다.
   *
   * 그래서 한 화면 한 스위치로 둔다(카메라의 Auto/Manual 과 같은 자리).
   * 간단 모드가 감추는 것은 EQ 열·마스터 줄·핫큐·CUE 다. 남는 것은 레슨이 가르친 그대로 —
   * 재생, 곡 고르기, 템포, 밀기, 루프, 크로스페이더, 가운데 바늘.
   *
   * ★ 추상화는 "빼기"여야 하고 "바꾸기"면 안 된다. 손잡이를 다른 은유로 대체하면
   *   컨트롤러 앞에 앉았을 때 손이 안 움직인다. 이 앱이 파는 게 그 전이(轉移)다. */
  FM.mixMode = function () {
    if (state.settings.mixMode === 'simple' || state.settings.mixMode === 'full') return state.settings.mixMode;
    // 안 고른 사람은 진도가 정한다. 7단계까지 지났으면 다 열어 준다.
    return state.progress.l7 ? 'full' : 'simple';
  };
  function applyMixMode() {
    document.body.classList.toggle('mix-simple', FM.mixMode() === 'simple');
  }
  FM.setMixMode = function (mode) {
    state.settings.mixMode = mode;
    saveSettings();
    applyMixMode();
    if (state.tab === 'mix') FM.go('mix');
  };

  function modeSwitch() {
    var wrap = el('div', 'modesw');
    [['simple', tr('간단', 'Simple')], ['full', tr('전체', 'Full')]].forEach(function (pair) {
      var b = el('button', 'modesw-btn' + (FM.mixMode() === pair[0] ? ' on' : ''), pair[1]);
      b.dataset.mode = pair[0];
      b.addEventListener('click', function () { FM.setMixMode(pair[0]); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* ── 믹스 화면 ─────────────────────────────────────── */
  /* 레벨 미터 한 칸. 캔버스 하나에 피크 막대와 클립 표시를 그린다. */
  function meterBar(read) {
    var c = el('canvas', 'meter');
    var peakHold = 0, clipUntil = 0;
    return {
      el: c,
      update: function () {
        var w = c.clientWidth, h = c.clientHeight;
        if (!w || !h) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        var ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#06060b';
        ctx.fillRect(0, 0, w, h);

        var v = read();
        // 피크는 천천히 떨어뜨린다. 즉시 떨어지면 눈이 못 따라간다.
        peakHold = v > peakHold ? v : peakHold * 0.93;
        if (v >= 0.99) clipUntil = performance.now() + 900;

        /* dB 로 그린다. 선형으로 그리면 쓰는 구간(-20dB 위)이 오른쪽 끝에 몰린다. */
        var db = peakHold > 0 ? 20 * Math.log10(peakHold) : -60;
        var x = Math.max(0, Math.min(1, (db + 48) / 48));
        var grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, '#22c55e');
        grad.addColorStop(0.72, '#a3e635');
        grad.addColorStop(0.88, '#f59e0b');
        grad.addColorStop(1, '#ef4444');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w * x, h);
        // -6dB 자리에 눈금 하나. 여기 언저리에 두는 게 게인 스테이징의 목표다.
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(w * ((-6 + 48) / 48), 0, 1, h);
        if (performance.now() < clipUntil) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(w - 3, 0, 3, h);
        }
      }
    };
  }

  function eqColumn(deck) {
    var col = el('div', 'eqcol');
    col.style.setProperty('--accent', FM.DECK_COLOR[deck.id]);
    var tagRow = el('div', 'eqcol-head');
    tagRow.appendChild(el('div', 'eqcol-tag', deck.id));
    var m = meterBar(function () { return deck.level(); });
    tagRow.appendChild(m.el);
    col.appendChild(tagRow);
    state.channelMeters.push(m);
    // 트림은 EQ 앞에 둔다. 실제 믹서의 순서이고, 곡마다 다른 녹음 레벨을 여기서 맞춘다.
    var trimSl = FM.slider('TRIM', 0, 1, 0.01, deck.getTrim(), function (v) { deck.setTrim(v); });
    trimSl.classList.add('sl-trim');
    col.appendChild(trimSl);
    [['high', 'HI'], ['mid', 'MID'], ['low', 'LOW']].forEach(function (pair) {
      col.appendChild(FM.slider(pair[1], 0, 1, 0.01, 0.5, function (v) { deck.setEq(pair[0], v); }));
    });
    // 필터는 현대 컨트롤러에서 가장 많이 쓰는 손잡이다. 가운데가 통과.
    col.appendChild(FM.slider('FILTER', 0, 1, 0.01, 0.5, function (v) { deck.setFilter(v); }));
    col.appendChild(FM.slider('ECHO', 0, 1, 0.01, 0, function (v) { deck.setEcho(v); }));
    col.appendChild(FM.slider('VOL', 0, 1, 0.01, 1, function (v) { deck.setVolume(v); }));
    return col;
  }

  /* 바닥에서 올라오는 시트. 내용은 넘겨받은 함수가 채운다. */
  function openSheet(fill) {
    var back = el('div', 'sheet-back');
    var sheet = el('div', 'sheet');
    function close() { back.remove(); }
    fill(sheet, close);
    var cancel = el('button', 'btn btn-ghost', tr('닫기', 'Close'));
    cancel.addEventListener('click', close);
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.body.appendChild(back);
    return { el: sheet, close: close };
  }

  var MAX_MINUTES = 10;   // 디코드된 오디오는 분당 20MB 를 넘는다. 폰이 버틸 선을 그어 둔다.

  /* 감지된 BPM·첫박을 손으로 고친다. 자동 감지는 틀릴 수 있고,
   * 틀렸을 때 고칠 방법이 없으면 그 곡은 영영 못 쓴다. */
  function correctSheet(meta, onChange) {
    openSheet(function (sheet, close) {
      sheet.appendChild(el('h2', 'sheet-title', dl(meta.name)));
      var readout = el('div', 'correct-readout');
      var bpmVal = el('span', 'correct-big');
      var offVal = el('span', 'correct-sub');
      var note = el('span', 'correct-note');
      readout.append(bpmVal, offVal, note);
      sheet.appendChild(readout);

      function paint() {
        bpmVal.textContent = meta.bpm.toFixed(1) + ' BPM';
        offVal.textContent = tr('첫 박 ', 'First beat ') + Math.round(meta.beatOffset * 1000) + 'ms';
      }
      /* 범위를 벗어나면 잘라 붙이지 않고 되돌린다.
       * 127.8 에서 ×2 를 눌렀을 때 조용히 220 이 되면, 고치려던 사람이 더 헤맨다. */
      function apply(fn) {
        var prevBpm = meta.bpm, prevOff = meta.beatOffset;
        fn();
        meta.bpm = Math.round(meta.bpm * 10) / 10;
        if (!(meta.bpm >= 60 && meta.bpm <= 200)) {
          meta.bpm = prevBpm; meta.beatOffset = prevOff;
          note.textContent = tr('60~200 BPM 안에서만 바꿀 수 있습니다', 'Only 60 to 200 BPM can be set');
          paint();
          return;
        }
        if (meta.beatOffset < 0) meta.beatOffset = 0;
        note.textContent = '';
        paint();
        onChange(meta);
      }

      var rows = [
        [tr('빠르기', 'Speed'), [['÷2', function () { meta.bpm /= 2; }], ['−0.1', function () { meta.bpm -= 0.1; }],
                    ['+0.1', function () { meta.bpm += 0.1; }], ['×2', function () { meta.bpm *= 2; }]]],
        [tr('첫 박', 'First beat'), [['−50ms', function () { meta.beatOffset -= 0.05; }], ['−10ms', function () { meta.beatOffset -= 0.01; }],
                   ['+10ms', function () { meta.beatOffset += 0.01; }], ['+50ms', function () { meta.beatOffset += 0.05; }]]]
      ];
      rows.forEach(function (pair) {
        var row = el('div', 'correct-row');
        row.appendChild(el('span', 'correct-label', pair[0]));
        pair[1].forEach(function (b) {
          var btn = el('button', 'btn correct-btn', b[0]);
          btn.addEventListener('click', function () { apply(b[1]); });
          row.appendChild(btn);
        });
        sheet.appendChild(row);
      });
      paint();

      var del = el('button', 'btn btn-danger', tr('보관함에서 지우기', 'Remove from library'));
      del.addEventListener('click', function () {
        FM.Library.remove(meta.id).then(function () {
          state.myTracks = state.myTracks.filter(function (t) { return t.id !== meta.id; });
          close();
          if (state.tab === 'me') FM.go('me');
        });
      });
      sheet.appendChild(del);
    });
  }

  /* ── 트랙 시트 ─────────────────────────────────────────
   * 한 줄 목록은 서른 곡을 넘기면 라이브에서 못 쓴다. 검색·정렬·크레이트를 붙인다.
   * 크레이트는 실제 DJ 가 세트 전에 하는 준비 그 자체다. */
  function crates() {
    if (!Array.isArray(state.settings.crates)) state.settings.crates = [];
    return state.settings.crates;
  }
  function crateOf(id) { return crates().filter(function (c) { return c.id === id; })[0]; }

  function trackSheet(deck, panel) {
    openSheet(function (sheet, close) {
      sheet.appendChild(el('h2', 'sheet-title', 'DECK ' + deck.id + tr(' 트랙', ' track')));

      var view = state.settings.sheetView || (state.settings.sheetView = { q: '', sort: 'name', crate: '' });
      var listBox = el('div', 'sheet-list');

      function pick(t) {
        FM.loadTrack(deck, t).then(function () { panel.setTrack(t); panel.syncTransport(); });
        close();
      }

      /* 검색 */
      var search = el('input', 'sheet-search');
      search.type = 'search';
      search.placeholder = tr('곡 이름으로 찾기', 'Search by name');
      search.value = view.q;
      search.addEventListener('input', function () { view.q = search.value; paint(); });
      sheet.appendChild(search);

      /* 크레이트 줄 */
      var crateRow = el('div', 'crate-row');
      var adding = el('div', 'crate-add');
      var addInput = el('input', 'crate-input');
      addInput.placeholder = tr('크레이트 이름', 'Crate name');
      var addOk = el('button', 'btn crate-ok', tr('만들기', 'Create'));
      addOk.addEventListener('click', function () {
        var name = addInput.value.trim();
        if (!name) return;
        var c = { id: 'c' + Date.now().toString(36), name: name, ids: [] };
        crates().push(c);
        view.crate = c.id;
        saveSettings();
        adding.classList.remove('on');
        addInput.value = '';
        paintCrates();
        paint();
      });
      adding.append(addInput, addOk);

      function paintCrates() {
        crateRow.textContent = '';
        var all = el('button', 'crate' + (view.crate ? '' : ' on'), tr('전체', 'All'));
        all.addEventListener('click', function () { view.crate = ''; saveSettings(); paintCrates(); paint(); });
        crateRow.appendChild(all);
        crates().forEach(function (c) {
          var b = el('button', 'crate' + (view.crate === c.id ? ' on' : ''), c.name + ' ' + c.ids.length);
          b.addEventListener('click', function () {
            // 켜져 있는 걸 다시 누르면 지운다. 지울 자리를 따로 만들면 줄이 길어진다.
            if (view.crate === c.id) {
              state.settings.crates = crates().filter(function (x) { return x.id !== c.id; });
              view.crate = '';
            } else { view.crate = c.id; }
            saveSettings(); paintCrates(); paint();
          });
          crateRow.appendChild(b);
        });
        var plus = el('button', 'crate crate-new', '+');
        plus.addEventListener('click', function () {
          adding.classList.toggle('on');
          if (adding.classList.contains('on')) addInput.focus();
        });
        crateRow.appendChild(plus);
      }
      paintCrates();
      sheet.append(crateRow, adding);

      /* 정렬 */
      var sortRow = el('div', 'sort-row');
      [['name', tr('이름', 'Name')], ['bpm', 'BPM']].forEach(function (pair) {
        var b = el('button', 'sortbtn' + (view.sort === pair[0] ? ' on' : ''), pair[1]);
        b.addEventListener('click', function () {
          view.sort = pair[0];
          saveSettings();
          [].forEach.call(sortRow.children, function (n) { n.classList.remove('on'); });
          b.classList.add('on');
          paint();
        });
        sortRow.appendChild(b);
      });
      sheet.appendChild(sortRow);
      sheet.appendChild(listBox);

      function matches(t) {
        var q = (view.q || '').trim().toLowerCase();
        if (q && dl(t.name).toLowerCase().indexOf(q) < 0) return false;
        if (view.crate) {
          var c = crateOf(view.crate);
          if (!c || c.ids.indexOf(t.id) < 0) return false;
        }
        return true;
      }
      function sorted(arr) {
        return arr.slice().sort(function (a, b) {
          if (view.sort === 'bpm') return a.bpm - b.bpm;
          return dl(a.name).localeCompare(dl(b.name));
        });
      }

      /* 크레이트가 켜져 있으면 담고 빼는 단추가 줄마다 붙는다.
       * 전체 보기에서는 안 붙인다 — 어디에 담을지가 정해지지 않았기 때문. */
      function crateToggle(t) {
        var c = crateOf(view.crate);
        if (!c) return null;
        var inIt = c.ids.indexOf(t.id) >= 0;
        var b = el('button', 'sheet-crate' + (inIt ? ' on' : ''), inIt ? '−' : '+');
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (inIt) c.ids = c.ids.filter(function (x) { return x !== t.id; });
          else c.ids.push(t.id);
          saveSettings();
          paintCrates();
          paint();
        });
        return b;
      }

      function row(t, isUser) {
        var wrap = el('div', 'sheet-row' + (isUser ? ' sheet-row-user' : ''));
        wrap.style.setProperty('--accent', t.color);
        var main = el('button', 'sheet-main');
        main.append(el('span', 'sheet-dot'), el('span', 'sheet-name', dl(t.name)),
          el('span', 'sheet-bpm', (isUser ? t.bpm.toFixed(1) : t.bpm) + ' BPM'));
        main.addEventListener('click', function () { pick(t); });
        wrap.appendChild(main);
        var ct = crateToggle(t);
        if (ct) wrap.appendChild(ct);
        if (isUser) {
          var edit = el('button', 'sheet-edit', tr('조정', 'Adjust'));
          edit.addEventListener('click', function () { close(); correctSheet(t, applyCorrection); });
          wrap.appendChild(edit);
        }
        return wrap;
      }

      function paint() {
        listBox.textContent = '';
        var built = sorted(FM.TRACKS.filter(matches));
        var mine = sorted(state.myTracks.filter(matches));
        if (!built.length && !mine.length) {
          listBox.appendChild(el('p', 'sheet-empty', tr('찾는 곡이 없습니다.', 'Nothing matches.')));
          return;
        }
        if (built.length) {
          listBox.appendChild(el('h3', 'sheet-sub', tr('기본 트랙 ', 'Built in ') + built.length));
          built.forEach(function (t) { listBox.appendChild(row(t, false)); });
        }
        listBox.appendChild(el('h3', 'sheet-sub', tr('내 음악 ', 'My music ') + mine.length));
        if (!state.myTracks.length) {
          listBox.appendChild(el('p', 'sheet-empty', tr('기기에 있는 음악 파일을 넣으면 여기에 쌓입니다.',
            'Music files from your device collect here.')));
        }
        mine.forEach(function (t) { listBox.appendChild(row(t, true)); });
      }
      paint();

      var status = el('p', 'sheet-status');
      var input = el('input', 'hidden-file');
      input.type = 'file';
      input.accept = 'audio/*';
      var add = el('button', 'btn btn-primary sheet-add', tr('기기에서 불러오기', 'Load from device'));
      add.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        add.disabled = true;
        status.textContent = tr('파일을 읽는 중…', 'Reading the file…');
        FM.Library.add(file, state.mixer.ctx, function (stage) {
          status.textContent = {
            decode: tr('소리로 푸는 중…', 'Decoding…'),
            analyze: tr('박자를 재는 중…', 'Measuring the beat…'),
            save: tr('보관하는 중…', 'Saving…')
          }[stage] || '';
        }).then(function (res) {
          if (res.buffer.duration > MAX_MINUTES * 60) {
            return FM.Library.remove(res.meta.id).then(function () {
              throw new Error(tr(MAX_MINUTES + '분이 넘는 곡은 폰 메모리가 감당하지 못합니다.',
                'Tracks longer than ' + MAX_MINUTES + ' minutes are more than phone memory can hold.'));
            });
          }
          state.myTracks.unshift(res.meta);
          close();
          deck.load(res.buffer, res.meta.bpm, res.meta.beatOffset);
          state.onDeck[deck.id] = res.meta;
          panel.setTrack(res.meta);
          panel.syncTransport();
          if (res.meta.confidence < 0.5) correctSheet(res.meta, applyCorrection);
        }).catch(function (e) {
          add.disabled = false;
          status.className = 'sheet-status bad';
          status.textContent = e && /EncodingError|Unable to decode/i.test(String(e.message))
            ? tr('이 파일은 열 수 없습니다. mp3·m4a·wav 를 넣어 주세요.',
                 'This file cannot be opened. Use mp3, m4a or wav.')
            : (e && e.message) || tr('불러오지 못했습니다.', 'Could not load it.');
        });
      });
      sheet.append(add, input, status);
    });
  }

  /* 보정값을 보관함과 (올라가 있다면) 덱에 같이 반영한다. */
  function applyCorrection(meta) {
    FM.Library.get(meta.id).then(function (rec) {
      if (!rec) return;
      rec.bpm = meta.bpm; rec.beatOffset = meta.beatOffset;
      return FM.Library.put(rec);
    });
    ['A', 'B'].forEach(function (id) {
      var onIt = state.onDeck[id];
      if (onIt && onIt.id === meta.id) {
        var deck = state.mixer[id.toLowerCase()];
        deck.bpm = meta.bpm;
        deck.beatOffset = meta.beatOffset;
      }
    });
  }

  function renderMix(root) {
    var mix = state.mixer;
    var tA = FM.TRACKS[state.picked.A], tB = FM.TRACKS[state.picked.B];

    var panelA = FM.createDeckPanel(mix.a, {
      color: tA.color, trackName: dl(tA.name),
      onPickTrack: function (d) { trackSheet(d, panelA); },
      onPfl: function (on) { return mix.setCue('A', on); }
    });
    var meter = FM.createPhaseMeter(mix.a, mix.b);
    var panelB = FM.createDeckPanel(mix.b, {
      color: tB.color, trackName: dl(tB.name),
      onPickTrack: function (d) { trackSheet(d, panelB); },
      onPfl: function (on) { return mix.setCue('B', on); }
    });

    var mixer = el('section', 'mixer');
    var eqs = el('div', 'eqs');
    state.channelMeters = [];
    eqs.append(eqColumn(mix.a), eqColumn(mix.b));

    /* 마스터 줄 — 나가는 레벨과 녹음. 리미터 뒤라 실제로 나가는 소리다. */
    var masterRow = el('div', 'masterrow');
    masterRow.appendChild(el('span', 'masterrow-tag', tr('마스터', 'MASTER')));
    var mm = meterBar(function () { return mix.level(); });
    state.channelMeters.push(mm);
    masterRow.appendChild(mm.el);
    mixer.append(eqs, masterRow, FM.crossfader(mix, mix.getCrossfade()));

    root.append(panelA.el, meter.el, panelB.el, mixer);
    state.panels = { a: panelA, b: panelB, meter: meter };
    applyMixMode();

    /* EQ 드릴을 통과했는데 아직 간단 모드면, 넘어갈 때가 됐다고 한 줄 알려 준다.
     * 스위치가 눈에 안 띄면 있으나 마나라서 — 이게 탭이 아닌 것의 유일한 약점이다. */
    if (FM.mixMode() === 'full') {
      root.appendChild(el('p', 'mix-syncnote', tr(
        'SYNC 버튼은 넣지 않았습니다. 맞추는 일을 기계가 대신하면 그 감각이 늘지 않아서요. 나머지는 실제 기기와 같은 구성입니다.',
        'There is no SYNC button. If the machine does the matching, the feel never develops. Everything else matches what real gear gives you.')));
    }
    if (FM.mixMode() === 'simple' && state.progress.l6) {
      var nudge = el('p', 'mix-nextnote', tr(
        'EQ 를 써 볼 준비가 됐습니다. 위의 전체로 넘기면 저음 손잡이가 나옵니다.',
        'You are ready for EQ. Switch to Full at the top and the low-end controls appear.'));
      root.appendChild(nudge);
    }

    FM.loadTrack(mix.a, tA).then(function () { panelA.setTrack(tA); panelA.syncTransport(); });
    FM.loadTrack(mix.b, tB).then(function () { panelB.setTrack(tB); panelB.syncTransport(); });
  }

  /* ── 세트 녹음 ─────────────────────────────────────────
   * 나가는 소리를 그대로 받는다. 연습을 되들어 보는 게 실력을 올리는 가장 싼 방법이고,
   * 그건 지금까지 이 앱에서 못 하던 일이었다. */
  function recButton() {
    var btn = el('button', 'btn btn-rec');
    var mix = state.mixer;
    function paint() {
      var on = mix.isRecording();
      btn.classList.toggle('on', on);
      btn.textContent = on ? mmssShort(mix.recordingSeconds()) : tr('녹음', 'REC');
    }
    if (!mix.canRecord()) {
      btn.disabled = true;
      btn.textContent = tr('녹음', 'REC');
      return btn;
    }
    btn.addEventListener('click', function () {
      if (!mix.isRecording()) { mix.startRecording(); paint(); return; }
      btn.disabled = true;
      mix.stopRecording().then(function (r) {
        btn.disabled = false;
        paint();
        if (!r || r.seconds < 1) return;
        return FM.Library.addMix(r.blob, r.seconds, r.mime).then(function (meta) {
          state.myMixes.unshift(meta);
        });
      });
    });
    state.recPaint = paint;
    paint();
    return btn;
  }
  function mmssShort(sec) {
    var t = Math.max(0, Math.floor(sec));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  /* ── 나 ────────────────────────────────────────────── */
  function renderMe(root) {
    var guide = el('button', 'card card-guide');
    guide.append(el('span', 'card-guide-title', tr('사용 안내', 'Guide')),
      el('span', 'card-guide-sub', tr('용어, 화면 읽는 법, 자주 막히는 곳', 'Terms, reading the screen, common snags')),
      el('span', 'card-guide-go', tr('열기 ›', 'Open ›')));
    guide.addEventListener('click', function () { FM.openGuide(); });
    root.appendChild(guide);

    var lessons = FM.LESSONS || [];
    var done = lessons.filter(function (l) { return state.progress[l.id]; }).length;

    var card = el('section', 'card');
    card.appendChild(el('h2', 'card-title', tr('진도', 'Progress')));
    /* 숫자를 문장에 섞으면 안 읽힌다. 계기처럼 세 칸으로 세운다. */
    var stats = el('div', 'stats');
    function stat(label, value) {
      var s = el('div', 'stat');
      s.append(el('span', 'stat-value', value), el('span', 'stat-label', label));
      return s;
    }
    var streak = FM.dailyStreak ? FM.dailyStreak(state.progress.daily || {}, FM.dayKey()) : 0;
    stats.append(
      stat(tr('레슨', 'Lessons'), done + ' / ' + lessons.length),
      stat(tr('배우기', 'Learn'), FM.learnReadCount() + ' / ' + (FM.LEARN ? FM.LEARN.length : 0)),
      stat(tr('연속', 'Streak'), streak + tr('일', streak === 1 ? ' day' : ' days'))
    );
    card.appendChild(stats);
    if (lessons.length && done >= lessons.length) {
      card.appendChild(el('p', 'card-body', tr('여기까지 왔으면 컨트롤러를 사도 헤매지 않습니다.',
        'Get this far and a controller will not confuse you.')));
    }
    root.appendChild(card);

    var lib = el('section', 'card');
    lib.appendChild(el('h2', 'card-title', tr('내 음악', 'My music')));
    if (!state.myTracks.length) {
      lib.appendChild(el('p', 'card-body', tr('아직 없습니다. 믹스 화면에서 트랙 이름을 눌러 불러올 수 있습니다.',
        'Nothing yet. Tap a track name on the Mix screen to load one.')));
    } else {
      var bytes = state.myTracks.reduce(function (s, t) { return s + (t.size || 0); }, 0);
      lib.appendChild(el('p', 'card-body', tr(
        state.myTracks.length + '곡 · ' + (bytes / 1048576).toFixed(1) + 'MB 를 이 기기에 보관 중입니다.',
        state.myTracks.length + ' track' + (state.myTracks.length === 1 ? '' : 's') + ' · ' +
          (bytes / 1048576).toFixed(1) + 'MB stored on this device.')));
      state.myTracks.forEach(function (t) {
        var row = el('button', 'libitem');
        row.append(el('span', 'libitem-name', dl(t.name)),
                   el('span', 'libitem-bpm', t.bpm.toFixed(1) + ' BPM'));
        row.addEventListener('click', function () { correctSheet(t, applyCorrection); });
        lib.appendChild(row);
      });
    }
    root.appendChild(lib);

    /* 녹음한 세트 */
    var mixes = el('section', 'card');
    mixes.appendChild(el('h2', 'card-title', tr('녹음한 세트', 'Recorded sets')));
    if (!state.myMixes.length) {
      mixes.appendChild(el('p', 'card-body', tr(
        '아직 없습니다. 믹스 화면의 녹음 단추를 누르면 나가는 소리가 그대로 남습니다.',
        'Nothing yet. The record button on the Mix screen keeps exactly what goes out.')));
    } else {
      state.myMixes.forEach(function (m) {
        var row = el('div', 'mixitem');
        var d = new Date(m.at);
        var when = FM.lang === 'en'
          ? (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
          : (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        row.append(el('span', 'mixitem-when', when),
          el('span', 'mixitem-len', mmssShort(m.seconds) + ' · ' + (m.size / 1048576).toFixed(1) + 'MB'));

        var play = el('button', 'btn mixitem-btn', '▶');
        var audio = null;
        play.addEventListener('click', function () {
          if (audio) { audio.pause(); audio = null; play.textContent = '▶'; return; }
          FM.Library.getMix(m.id).then(function (rec) {
            if (!rec) return;
            audio = new Audio(URL.createObjectURL(rec.blob));
            audio.onended = function () { audio = null; play.textContent = '▶'; };
            audio.play();
            play.textContent = '❚❚';
          });
        });

        /* 내보내기 — 기기가 공유를 지원하면 공유 시트로, 아니면 내려받기로. */
        var out = el('button', 'btn mixitem-btn', tr('내보내기', 'Export'));
        out.addEventListener('click', function () {
          FM.Library.getMix(m.id).then(function (rec) {
            if (!rec) return;
            var ext = /mp4/.test(rec.mime) ? 'm4a' : 'webm';
            var file = new File([rec.blob], 'firstmix-' + m.id + '.' + ext, { type: rec.mime });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({ files: [file] }).catch(function () {});
              return;
            }
            var a = document.createElement('a');
            a.href = URL.createObjectURL(rec.blob);
            a.download = file.name;
            a.click();
          });
        });

        var del = el('button', 'btn mixitem-btn mixitem-del', '×');
        del.addEventListener('click', function () {
          FM.Library.removeMix(m.id).then(function () {
            state.myMixes = state.myMixes.filter(function (x) { return x.id !== m.id; });
            FM.go('me');
          });
        });
        row.append(play, out, del);
        mixes.appendChild(row);
      });
    }
    root.appendChild(mixes);

    /* 키락 */
    var kl = el('section', 'card');
    kl.appendChild(el('h2', 'card-title', tr('키락 (마스터 템포)', 'Key lock')));
    kl.appendChild(el('p', 'card-body', tr(
      '켜면 빠르기를 당겨도 음정이 그대로 있습니다. 끄면 실제 턴테이블처럼 음정이 같이 움직입니다.',
      'With it on, pulling the tempo leaves the pitch where it was. With it off, pitch moves with speed like a real turntable.')));
    kl.appendChild(el('p', 'card-note', tr(
      '크게 당길수록 소리에 일렁임이 생깁니다. ±8% 안에서는 거의 티가 안 납니다. 재생 중에 바꾸면 한 번 끊깁니다.',
      'The further you pull, the more it warbles. Inside ±8% it is barely noticeable. Changing it mid-playback causes one break in the sound.')));
    var klSw = el('button', 'btn switch switch-keylock' + (state.settings.keylock ? ' on' : ''),
      state.settings.keylock ? tr('켜짐', 'On') : tr('꺼짐', 'Off'));
    klSw.addEventListener('click', function () {
      var want = !state.settings.keylock;
      klSw.disabled = true;
      state.mixer.setKeylock(want).then(function (ok) {
        state.settings.keylock = ok;
        saveSettings();
        klSw.disabled = false;
        klSw.classList.toggle('on', ok);
        klSw.textContent = ok ? tr('켜짐', 'On') : tr('꺼짐', 'Off');
        if (want && !ok) klSw.textContent = tr('이 기기에서는 안 됩니다', 'Not available here');
      });
    });
    kl.appendChild(klSw);
    root.appendChild(kl);

    var split = el('section', 'card');
    split.appendChild(el('h2', 'card-title', tr('헤드폰 미리듣기', 'Headphone cue')));
    split.appendChild(el('p', 'card-body', tr(
      '폰과 태블릿은 소리 나가는 곳이 한 쌍뿐입니다. 스플릿 출력을 켜면 왼쪽 채널로 관객이 들을 소리를, ' +
        '오른쪽 채널로 나만 들을 소리를 따로 내보냅니다. 3.5mm 분배 케이블을 끼우면 실제로 나뉩니다.',
      'A phone or tablet has only one pair of outputs. Split output sends what the crowd hears out the left ' +
        'channel and what only you hear out the right. Plug in a 3.5mm splitter cable and they really separate.')));
    split.appendChild(el('p', 'card-body', tr(
      '켜는 동안 마스터는 모노가 됩니다. 이게 스테레오와 맞바꾸는 대가입니다.',
      'The master goes mono while it is on. That is what you trade stereo for.')));
    var sw = el('button', 'btn switch switch-split' + (state.settings.split ? ' on' : ''),
      state.settings.split ? tr('켜짐', 'On') : tr('꺼짐', 'Off'));
    sw.addEventListener('click', function () {
      FM.setSplit(!state.settings.split);
      sw.classList.toggle('on', state.settings.split);
      sw.textContent = state.settings.split ? tr('켜짐', 'On') : tr('꺼짐', 'Off');
    });
    split.appendChild(sw);

    /* 큐 믹스. 헤드폰에 다음 곡만 들리면 무엇에 맞추는지가 없다.
     * 실제 믹서에 CUE/MASTER 손잡이가 반드시 달려 있는 이유다. */
    var mixRow = FM.slider(tr('큐 / 마스터', 'CUE / MASTER'), 0, 1, 0.01, state.mixer.getCueMix(), function (v) {
      state.mixer.setCueMix(v);
      state.settings.cueMix = v;
      saveSettings();
    });
    mixRow.classList.add('sl-cuemix');
    split.appendChild(mixRow);
    split.appendChild(el('p', 'card-note', tr(
      '왼쪽 끝은 다음 곡만, 오른쪽 끝은 나가는 소리만 들립니다. 가운데가 반반입니다.',
      'Full left is the next track only. Full right is the outgoing mix only. Center is half and half.')));
    root.appendChild(split);

    var tips = el('section', 'card');
    tips.appendChild(el('h2', 'card-title', tr('소리가 이상할 때', 'When the sound is wrong')));
    var ul = el('ul', 'tips');
    [
      tr('블루투스 이어폰은 소리가 0.2초쯤 늦게 도착합니다. 박자를 맞추는 연습에는 유선을 쓰세요.',
         'Bluetooth earphones deliver sound about 0.2 seconds late. Use wired ones for beat practice.'),
      tr('분배 케이블이 없다면 스플릿 출력을 끄고 두 곡을 같이 들으면서 맞추면 됩니다. 훈련 레슨은 그 방식을 씁니다.',
         'With no splitter cable, leave split output off and match while hearing both tracks together. The lessons work that way.'),
      tr('소리가 끊기면 다른 앱을 닫고 다시 들어와 주세요.',
         'If the sound breaks up, close other apps and come back in.')
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    tips.appendChild(ul);
    root.appendChild(tips);

    var langCard = el('section', 'card');
    langCard.appendChild(el('h2', 'card-title', tr('언어', 'Language')));
    langCard.appendChild(FM.langRow());
    root.appendChild(langCard);

    var about = el('section', 'card');
    about.appendChild(el('h2', 'card-title', tr('앱 정보', 'About')));
    about.appendChild(el('p', 'card-body', tr(
      '들리는 소리는 앱이 그때그때 만들어 냅니다. 음원 파일이 들어 있지 않습니다.',
      'Everything you hear is generated by the app as it plays. No audio files are bundled.')));
    var links = el('p', 'card-links');
        // 법적 고지는 한 페이지에 두 언어가 같이 있다. 영어면 영어 절로 바로 보낸다.
    var anchor = tr('', '#en');
    [['privacy.html' + anchor, tr('개인정보 처리방침', 'Privacy policy')],
     ['terms.html' + anchor, tr('이용약관', 'Terms of use')]].forEach(function (pair) {
      var a = el('a', null, pair[1]);
      a.href = pair[0];
      links.appendChild(a);
    });
    about.appendChild(links);
    root.appendChild(about);
  }

  /* ── 셸 ────────────────────────────────────────────── */
  /* 탭 이름은 화면을 그릴 때마다 새로 만든다. 상수로 두면 언어를 바꿔도 안 바뀐다. */
  function tabs() {
    return [
      { id: 'train', icon: '◎', label: tr('훈련', 'Train'), title: tr('훈련', 'Train') },
      { id: 'mix', icon: '⇄', label: tr('믹스', 'Mix'), title: tr('자유 믹스', 'Free mix') },
      { id: 'me', icon: '☰', label: tr('나', 'Me'), title: tr('나', 'Me') }
    ];
  }

  function renderTabs() {
    var bar = document.getElementById('tabbar');
    bar.textContent = '';
    tabs().forEach(function (t) {
      var b = el('button', 'tab' + (state.tab === t.id ? ' on' : ''));
      b.append(el('span', 'tab-icon', t.icon), el('span', 'tab-label', t.label));
      b.addEventListener('click', function () { go(t.id); });
      bar.appendChild(b);
    });
  }

  function go(tab) {
    if (FM.leaveTrain) FM.leaveTrain();
    if (FM.leaveDaily) FM.leaveDaily();
    state.tab = tab;
    state.panels = null;
    var root = document.getElementById('app');
    root.textContent = '';
    root.className = 'screen-' + tab;
    document.getElementById('screen-title').textContent =
      tabs().filter(function (t) { return t.id === tab; })[0].title;
    var modeSlot = document.getElementById('topbar-mode');
    if (modeSlot) {
      modeSlot.textContent = '';
      if (tab === 'mix') modeSlot.appendChild(modeSwitch());
    }
    if (tab === 'mix') renderMix(root);
    else if (tab === 'train') FM.renderTrain(root);
    else renderMe(root);
    renderTabs();
  }
  FM.go = go;

  var recTick = 0;
  function loop() {
    if (state.panels) {
      state.panels.a.update();
      state.panels.b.update();
      state.panels.meter.update();
    }
    for (var mi = 0; mi < state.channelMeters.length; mi++) state.channelMeters[mi].update();
    // 녹음 시간은 초 단위라 매 프레임 고칠 이유가 없다
    if (state.recPaint && state.mixer.isRecording() && ++recTick % 20 === 0) state.recPaint();
    updateWakeLock();
    if (FM.trainTick) FM.trainTick();
    if (FM.dailyTick) FM.dailyTick();
    state.raf = requestAnimationFrame(loop);
  }

  /* 화면이 잠들면 세트가 끝난다. 소리가 나는 동안만 깨워 둔다.
   * 계속 켜 두면 배터리를 그냥 태우고, 연습만 하는 사람에게는 필요 없는 일이다. */
  var wakeLock = null, wakeBusy = false;
  function updateWakeLock() {
    if (!navigator.wakeLock || wakeBusy) return;
    var want = !!(state.mixer && (state.mixer.a.playing || state.mixer.b.playing));
    if (want && !wakeLock) {
      wakeBusy = true;
      navigator.wakeLock.request('screen').then(function (l) {
        wakeLock = l;
        l.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {}).then(function () { wakeBusy = false; });
    } else if (!want && wakeLock) {
      wakeBusy = true;
      var l = wakeLock;
      wakeLock = null;
      l.release().catch(function () {}).then(function () { wakeBusy = false; });
    }
  }
  FM.hasWakeLock = function () { return !!wakeLock; };

  function showLatency() {
    var ms = state.mixer.latency() * 1000;
    var node = document.getElementById('latency');
    // 60ms 넘으면 큐 찍기·넛지 감각이 무너진다. 대개 블루투스다.
    if (ms >= 60) {
      node.textContent = tr('출력 지연 ', 'Output latency ') + Math.round(ms) + tr('ms · 유선 권장', 'ms · wired recommended');
      node.hidden = false;
    } else {
      node.hidden = true;
    }
  }

  function start() {
    state.mixer = new FM.Mixer();
    state.mixer.resume()
      .then(function () {
        // 보관함을 못 읽어도(사파리 프라이빗 모드 등) 앱은 떠야 한다.
        return FM.Library.list().catch(function () { return []; });
      })
      .then(function (rows) {
        state.myTracks = rows;
        return FM.Library.listMixes().catch(function () { return []; });
      })
      .then(function (mixes) {
        state.myMixes = mixes;
        FM.setSplit(!!state.settings.split);
        if (state.settings.keylock) state.mixer.setKeylock(true);
        if (typeof state.settings.cueMix === 'number') state.mixer.setCueMix(state.settings.cueMix);
        var gate = document.getElementById('gate');
        if (gate) gate.remove();
        var slot = document.getElementById('topbar-rec');
        if (slot) { slot.textContent = ''; slot.appendChild(recButton()); }
        showLatency();
        go('train');
        loop();
      });
  }

  document.getElementById('gate-btn').addEventListener('click', start, { once: true });

  // 백그라운드로 갔다 오면 컨텍스트가 잠들어 있을 수 있다.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.mixer) { state.mixer.resume(); updateWakeLock(); }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
