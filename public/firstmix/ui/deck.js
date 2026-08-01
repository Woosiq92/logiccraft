/* 첫믹스 UI 부품 — 덱 패널과 위상 미터.
 * 캔버스는 매 프레임 다시 그리고, DOM 은 값이 바뀔 때만 건드린다. */
(function (global) {
  'use strict';

  var FM = global.FirstMix = global.FirstMix || {};
  var tr = FM.tr, dl = FM.dl;

  // 덱 색은 고정한다. 트랙마다 바뀌면 A/B 를 색으로 알아보는 게 무너진다.
  FM.DECK_COLOR = { A: '#7c3aed', B: '#06b6d4' };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mmss(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var r = String(s % 60);
    return m + ':' + (r.length < 2 ? '0' + r : r);
  }

  function fitCanvas(c) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  /* 슬라이더 한 줄 */
  function slider(label, min, max, step, value, onInput) {
    var wrap = el('label', 'sl');
    wrap.appendChild(el('span', 'sl-label', label));
    var input = el('input', 'sl-input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener('input', function () { onInput(parseFloat(input.value)); });
    wrap.appendChild(input);
    wrap.input = input;
    return wrap;
  }

  /* ── 덱 패널 ───────────────────────────────────────────── */
  FM.createDeckPanel = function (deck, opts) {
    var accent = FM.DECK_COLOR[deck.id];
    var root = el('section', 'deck deck-' + deck.id.toLowerCase());
    root.style.setProperty('--accent', accent);

    var head = el('div', 'deck-head');
    var tag = el('span', 'deck-tag', 'DECK ' + deck.id);
    var name = el('button', 'deck-name', dl(opts.trackName) || tr('트랙 선택', 'Pick a track'));
    // 남은 시간은 짧은 연습 루프에서는 의미가 없어서 긴 곡(1분 이상)에만 띄운다
    var time = el('span', 'deck-time', '');
    var bpm = el('span', 'deck-bpm', '—');
    head.append(tag, name, time, bpm);

    /* 조그휠 — 화면이 넓을 때만 보인다(CSS). 실제 CDJ 와 같은 두 가지 동작:
     *   재생 중 = 피치 벤드(미는 만큼 순간 빨라지고 느려진다)
     *   정지 중 = 위치 탐색(큐 지점 찾기)
     * 한 바퀴를 한 마디로 잡았다. 두 덱을 나란히 놓으면 마커 위치 차이가 곧 위상차다. */
    var jogWrap = el('div', 'jogwrap');
    var jog = el('canvas', 'jog');
    jog.setAttribute('aria-label', 'DECK ' + deck.id + tr(' 조그휠', ' jog wheel'));
    jogWrap.appendChild(jog);

    var grid = el('canvas', 'beatgrid');
    var transport = el('div', 'transport');
    var play = el('button', 'btn btn-play', '▶');
    play.setAttribute('aria-label', tr('재생/정지', 'Play / pause'));
    var cue = el('button', 'btn btn-cue', 'CUE');
    // 헤드폰 미리듣기. 스플릿 출력이 켜졌을 때만 보인다(CSS: body.split)
    var pfl = el('button', 'btn btn-pfl', '🎧');
    pfl.setAttribute('aria-label', 'DECK ' + deck.id + tr(' 헤드폰으로 미리듣기', ' headphone cue'));
    /* 루프. 실제 곡은 인트로가 지나가 버려서, 맞출 시간을 벌 방법이 없으면 초보는 계속 놓친다.
     * 길이 고르기는 자리가 넉넉한 태블릿에서만 주고, 폰에서는 8박 토글 하나로 둔다. */
    var loopBtn = el('button', 'btn btn-loop', 'LOOP');
    loopBtn.setAttribute('aria-label', 'DECK ' + deck.id + tr(' 8박 루프', ' 8-beat loop'));
    var nudgeDown = el('button', 'btn btn-nudge', '◀');
    var nudgeUp = el('button', 'btn btn-nudge', '▶');
    nudgeDown.setAttribute('aria-label', tr('뒤로 밀기', 'Nudge back'));
    nudgeUp.setAttribute('aria-label', tr('앞으로 당기기', 'Nudge forward'));
    transport.append(play, cue, pfl, loopBtn, nudgeDown, nudgeUp);

    function setLoop(beats) {
      if (!beats || (deck.loopActive && deck.loopBeats === beats)) deck.clearLoop();
      else deck.setLoop(beats);
      syncLoop();
    }
    function syncLoop() {
      loopBtn.classList.toggle('on', deck.loopActive);
      loopBtn.textContent = deck.loopActive ? deck.loopBeats + tr('박', ' beats') : 'LOOP';
      if (loopRow) {
        [].forEach.call(loopRow.children, function (b) {
          b.classList.toggle('on', deck.loopActive && deck.loopBeats === Number(b.dataset.beats));
        });
      }
    }
    loopBtn.addEventListener('click', function () { setLoop(8); });

    /* 핫큐 넷. 실제 기기와 같은 한 버튼 동작 — 빈 자리는 찍고, 찍힌 자리는 뛴다.
     * 길게 누르면 지운다. 큐가 하나뿐이면 곡의 여러 자리를 오갈 수가 없다. */
    var hotRow = el('div', 'hotcues');
    var pads = [];
    for (var hc = 0; hc < 4; hc++) {
      (function (i) {
        var pad = el('button', 'hotcue', String(i + 1));
        pad.setAttribute('aria-label', 'DECK ' + deck.id + tr(' 핫큐 ', ' hot cue ') + (i + 1));
        var held = 0;
        var longPress = false;
        pad.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          longPress = false;
          held = setTimeout(function () { longPress = true; deck.clearHotCue(i); syncHotCues(); }, 600);
        });
        var up = function () {
          clearTimeout(held);
          if (longPress) return;
          deck.hotCue(i);
          syncHotCues();
        };
        pad.addEventListener('pointerup', up);
        pad.addEventListener('pointercancel', function () { clearTimeout(held); });
        pads.push(pad);
        hotRow.appendChild(pad);
      })(hc);
    }
    function syncHotCues() {
      pads.forEach(function (p, i) { p.classList.toggle('on', deck.hotCues[i] != null); });
    }

    var loopRow = el('div', 'looprow');
    [4, 8, 16].forEach(function (n) {
      var b = el('button', 'btn btn-loopn', n + tr('박', ' beats'));
      b.dataset.beats = n;
      b.addEventListener('click', function () { setLoop(n); });
      loopRow.appendChild(b);
    });
    var loopOff = el('button', 'btn btn-loopn', tr('해제', 'Off'));
    loopOff.addEventListener('click', function () { deck.clearLoop(); syncLoop(); });
    loopRow.appendChild(loopOff);

    pfl.addEventListener('click', function () {
      var want = !pfl.classList.contains('on');
      if (opts.onPfl && opts.onPfl(want)) pfl.classList.toggle('on', want);
    });

    var tempo = slider(tr('템포', 'TEMPO'), -8, 8, 0.1, 0, function (v) { deck.setTempoPercent(v); });
    tempo.classList.add('sl-tempo');
    var tempoVal = el('span', 'sl-val', '0.0%');
    tempo.appendChild(tempoVal);

    /* 템포 범위. ±8 로는 100BPM 곡과 128BPM 곡을 아예 못 맞춘다(+28% 필요).
     * 실제 기기의 ±6/10/16/WIDE 와 같은 자리. */
    var RANGES = [8, 16, 50];
    var rangeBtn = el('button', 'btn btn-range', '±8');
    rangeBtn.setAttribute('aria-label', tr('템포 범위 바꾸기', 'Change tempo range'));
    rangeBtn.addEventListener('click', function () {
      var next = RANGES[(RANGES.indexOf(deck.getTempoRange()) + 1) % RANGES.length];
      deck.setTempoRange(next);
      tempo.input.min = -next;
      tempo.input.max = next;
      tempo.input.step = next > 20 ? 0.5 : next > 10 ? 0.2 : 0.1;
      tempo.input.value = deck.getTempoPercent();
      rangeBtn.textContent = '±' + next;
    });
    tempo.appendChild(rangeBtn);

    root.append(head, jogWrap, grid, transport, hotRow, loopRow, tempo);

    /* ── 조그휠 조작 ── */
    var jogState = null;
    function jogAngle(e) {
      var r = jog.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    }
    jog.addEventListener('pointerdown', function (e) {
      if (!deck.buffer) return;
      e.preventDefault();
      jog.setPointerCapture(e.pointerId);
      jogState = { last: jogAngle(e), lastMove: performance.now(), id: e.pointerId };
      jog.classList.add('on');
    });
    jog.addEventListener('pointermove', function (e) {
      if (!jogState || e.pointerId !== jogState.id) return;
      var a = jogAngle(e);
      var d = a - jogState.last;
      while (d > Math.PI) d -= 2 * Math.PI;      // 12시를 넘어갈 때 각도가 튀는 것 보정
      while (d < -Math.PI) d += 2 * Math.PI;
      var now = performance.now();
      var dt = Math.max(8, now - jogState.lastMove) / 1000;
      jogState.last = a;
      jogState.lastMove = now;

      if (deck.playing) {
        deck.setNudge(Math.max(-0.5, Math.min(0.5, (d / dt) * 0.06)));
      } else if (deck.bpm) {
        deck.seek(deck.position + (d / (2 * Math.PI)) * (4 * 60 / deck.bpm));
      }
    });
    function jogRelease() {
      if (!jogState) return;
      jogState = null;
      deck.setNudge(0);
      jog.classList.remove('on');
    }
    ['pointerup', 'pointercancel'].forEach(function (ev) { jog.addEventListener(ev, jogRelease); });

    play.addEventListener('click', function () {
      deck.toggle();
      play.textContent = deck.playing ? '❚❚' : '▶';
      play.classList.toggle('on', deck.playing);
    });
    cue.addEventListener('click', function () {
      // 재생 중이면 큐 지점으로 돌아가고, 멈춰 있으면 현재 지점을 큐로 찍는다 (DJ 관행)
      if (deck.playing) deck.jumpToCue(); else deck.setCue();
    });
    name.addEventListener('click', function () { opts.onPickTrack && opts.onPickTrack(deck); });

    // 넛지: 누르고 있는 동안만. 손으로 플래터를 미는 것과 같다.
    function bindNudge(btn, amount) {
      var press = function (e) { e.preventDefault(); deck.setNudge(amount); btn.classList.add('on'); };
      var release = function () { deck.setNudge(0); btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    }
    bindNudge(nudgeDown, -0.06);
    bindNudge(nudgeUp, 0.06);

    function drawJog() {
      if (!jog.clientWidth) return;              // 폰에서는 CSS 로 숨겨져 있다
      var f = fitCanvas(jog), ctx = f.ctx, w = f.w, h = f.h;
      var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 2;
      ctx.clearRect(0, 0, w, h);

      // 원판
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#20202f');
      g.addColorStop(1, '#14141f');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill();

      // 바깥 링 = 미는 곳
      ctx.strokeStyle = jogState ? accent : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, 2 * Math.PI); ctx.stroke();

      // 마디 안 네 박 눈금 (12시가 다운비트)
      for (var b = 0; b < 4; b++) {
        var ang = -Math.PI / 2 + b * Math.PI / 2;
        ctx.strokeStyle = b === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.16)';
        ctx.lineWidth = b === 0 ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * R * 0.74, cy + Math.sin(ang) * R * 0.74);
        ctx.lineTo(cx + Math.cos(ang) * R * 0.94, cy + Math.sin(ang) * R * 0.94);
        ctx.stroke();
      }

      if (!deck.buffer || !deck.bpm) return;

      // 재생 위치 마커 — 한 바퀴가 한 마디
      var barSec = 4 * 60 / deck.bpm;
      var t = ((deck.position - deck.beatOffset) / barSec) % 1;
      if (t < 0) t += 1;
      var pa = -Math.PI / 2 + t * 2 * Math.PI;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(pa) * R * 0.30, cy + Math.sin(pa) * R * 0.30);
      ctx.lineTo(cx + Math.cos(pa) * R * 0.90, cy + Math.sin(pa) * R * 0.90);
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.fillStyle = deck.playing ? accent : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.10, 0, 2 * Math.PI); ctx.fill();
    }

    var lastBpm = '', lastTime = '', lastHot = '';
    function draw() {
      var f = fitCanvas(grid), ctx = f.ctx, w = f.w, h = f.h;
      ctx.clearRect(0, 0, w, h);
      // 카드보다 어둡게 파 넣어 계기 창처럼 보이게 한다
      ctx.fillStyle = '#06060b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      if (!deck.buffer || !deck.bpm) return;

      var beatsVisible = 8;
      var px = w / beatsVisible;
      var spb = 60 / deck.bpm;
      var pos = (deck.position - deck.beatOffset) / spb;               // 박 단위 위치

      // 루프 구간을 칠해 준다. 어디가 물려 있는지 안 보이면 왜 안 넘어가는지 알 수 없다.
      if (deck.loopActive) {
        var ls = (deck.loopStart - deck.beatOffset) / spb;
        var le = (deck.loopEnd - deck.beatOffset) / spb;
        ctx.fillStyle = 'rgba(245,158,11,0.16)';
        ctx.fillRect(w / 2 + (ls - pos) * px, 0, (le - ls) * px, h);
      }

      // 16분음표 잔눈금 — 자 위의 작은 눈금처럼 바탕을 만든다
      ctx.fillStyle = 'rgba(255,255,255,0.055)';
      for (var s = -beatsVisible * 2 - 4; s <= beatsVisible * 2 + 4; s++) {
        var sx = w / 2 + (Math.floor(pos * 4) + s - pos * 4) * (px / 4);
        if (sx < 0 || sx > w) continue;
        ctx.fillRect(sx, h * 0.44, 1, h * 0.12);
      }

      for (var i = -Math.ceil(beatsVisible / 2) - 1; i <= beatsVisible / 2 + 1; i++) {
        var beatIdx = Math.floor(pos) + i;
        var x = w / 2 + (beatIdx - pos) * px;
        if (x < -px || x > w + px) continue;
        var down = ((beatIdx % 4) + 4) % 4 === 0;
        if (down) {
          ctx.fillStyle = accent;
          ctx.fillRect(x - 1.5, 0, 3, h);           // 마디 머리는 창을 세로로 가른다
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(x - 1, h * 0.28, 2, h * 0.44);
        }
      }

      // 찍어 둔 핫큐 자리. 눈금 위에 얇은 선으로 세운다.
      deck.hotCues.forEach(function (at, i) {
        if (at == null) return;
        var hx = w / 2 + ((at - deck.beatOffset) / spb - pos) * px;
        if (hx < 0 || hx > w) return;
        ctx.fillStyle = 'rgba(245,158,11,0.85)';
        ctx.fillRect(hx - 1, 0, 2, h * 0.3);
        ctx.font = '600 8px system-ui, sans-serif';
        ctx.fillText(String(i + 1), hx + 3, h * 0.28);
      });

      // 재생 헤드 — 항상 중앙. 위에 삼각 표식을 얹어 눈금과 구분되게
      ctx.fillStyle = '#fff';
      ctx.fillRect(w / 2 - 1, 0, 2, h);
      ctx.beginPath();
      ctx.moveTo(w / 2 - 4, 0);
      ctx.lineTo(w / 2 + 4, 0);
      ctx.lineTo(w / 2, 5);
      ctx.closePath();
      ctx.fill();
    }

    return {
      el: root,
      update: function () {
        draw();
        drawJog();
        // 손가락을 올려두고 멈추면 pointermove 가 안 온다. 그대로 두면 마지막 벤드가 계속 걸린다.
        if (jogState && performance.now() - jogState.lastMove > 80) deck.setNudge(0);
        var b = deck.bpm ? deck.effectiveBpm.toFixed(1) : '—';
        if (b !== lastBpm) { bpm.textContent = b; lastBpm = b; }
        tempoVal.textContent = (deck.getTempoPercent() >= 0 ? '+' : '') + deck.getTempoPercent().toFixed(1) + '%';

        var t = deck.buffer && deck.buffer.duration > 60
          ? mmss(deck.position) + ' / ' + mmss(deck.buffer.duration) : '';
        if (t !== lastTime) { time.textContent = t; lastTime = t; }

        // 핫큐는 곡을 갈면 비워지므로 화면도 따라가야 한다. 바뀔 때만 건드린다.
        var sig = deck.hotCues.map(function (v) { return v == null ? 0 : 1; }).join('');
        if (sig !== lastHot) { syncHotCues(); lastHot = sig; }
      },
      syncLoop: syncLoop,
      syncHotCues: syncHotCues,
      setTrack: function (t) { name.textContent = dl(t.name); syncLoop(); syncHotCues(); },
      syncTransport: function () {
        play.textContent = deck.playing ? '❚❚' : '▶';
        play.classList.toggle('on', deck.playing);
        pfl.classList.toggle('on', !!deck.cueOn);
      },
      tempoInput: tempo.input
    };
  };

  /* ── 위상 미터 ─────────────────────────────────────────
   * 비트매칭의 전부는 두 가지다: BPM 이 같은가, 박의 위상이 겹치는가.
   * 숫자로 보여주면 숫자만 보게 되므로, 위상은 바늘로 보여준다. */
  FM.createPhaseMeter = function (a, b, opts) {
    opts = opts || {};
    var root = el('section', 'phase');
    var c = el('canvas', 'phase-canvas');
    var IDLE = tr('두 덱을 모두 재생하면 여기에 어긋난 정도가 보입니다',
      'Play both decks to see how far apart they are');
    var caption = opts.caption === false ? null : el('div', 'phase-caption', IDLE);
    root.appendChild(c);
    if (caption) root.appendChild(caption);
    var TOL = 0.02;   // 이 안에 들어오면 겹친 것으로 본다

    function draw() {
      var f = fitCanvas(c), ctx = f.ctx, w = f.w, h = f.h;
      ctx.clearRect(0, 0, w, h);

      var live = a.playing && b.playing && a.bpm && b.bpm;
      var mid = w / 2;

      // 파 넣은 계기 창
      ctx.fillStyle = '#06060b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

      // 잔눈금 20칸 + 큰 눈금 4칸. 자를 보는 느낌을 만든다.
      for (var i = -10; i <= 10; i++) {
        if (i === 0) continue;
        var big = i % 5 === 0;
        ctx.fillStyle = big ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
        ctx.fillRect(mid + i * (w / 22) - 0.5, big ? h * 0.24 : h * 0.38, 1, big ? h * 0.5 : h * 0.22);
      }

      // 목표 구간 — 여기 안에 넣으면 된다. 대괄호로 감싸 경계를 분명히.
      var band = Math.max(TOL * w * 0.9, 6);
      ctx.fillStyle = 'rgba(34,197,94,0.13)';
      ctx.fillRect(mid - band, 1, band * 2, h - 2);
      ctx.strokeStyle = 'rgba(34,197,94,0.45)';
      ctx.beginPath();
      ctx.moveTo(mid - band + 3, h * 0.14); ctx.lineTo(mid - band, h * 0.14);
      ctx.lineTo(mid - band, h * 0.86); ctx.lineTo(mid - band + 3, h * 0.86);
      ctx.moveTo(mid + band - 3, h * 0.14); ctx.lineTo(mid + band, h * 0.14);
      ctx.lineTo(mid + band, h * 0.86); ctx.lineTo(mid + band - 3, h * 0.86);
      ctx.stroke();

      if (!live) return;

      // 위상차를 -0.5..0.5 박으로 접는다
      var d = a.beatPhase - b.beatPhase;
      d = d - Math.round(d);
      var aligned = Math.abs(d) < TOL;
      var x = mid + d * (w * 0.9);

      /* 겹쳤을 때는 색만 바꾸지 않는다. 색으로만 알리면 색각 이상인 사람이 못 읽는다.
       * 바늘 위에 삼각 표식이 채워지는 것으로 모양까지 바뀌게 한다. */
      ctx.fillStyle = aligned ? '#22c55e' : '#f59e0b';
      ctx.fillRect(x - 2.5, h * 0.10, 5, h * 0.80);
      if (aligned) {
        ctx.beginPath();
        ctx.moveTo(x - 6, h * 0.10);
        ctx.lineTo(x + 6, h * 0.10);
        ctx.lineTo(x, h * 0.32);
        ctx.closePath();
        ctx.fill();
      }

      // BPM 차이 — 바늘이 계속 흐르면 템포가 안 맞은 것이다.
      // 훈련에서는 숫자를 감춘다. 숫자를 띄우면 귀 대신 숫자를 보게 된다.
      if (opts.showBpm !== false) {
        var bpmDiff = a.effectiveBpm - b.effectiveBpm;
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = Math.abs(bpmDiff) < 0.05 ? '#22c55e' : 'rgba(255,255,255,0.55)';
        ctx.fillText((bpmDiff >= 0 ? '+' : '') + bpmDiff.toFixed(2) + ' BPM', mid, h - 3);
      }
      return aligned;
    }

    var lastCaption = '';
    return {
      el: root,
      update: function () {
        var aligned = draw();
        if (!caption) return;
        var msg = !(a.playing && b.playing) ? IDLE
          : aligned ? tr('박이 겹쳤습니다 — 이 상태를 유지하세요', 'Beats are locked. Hold it right here.')
          : tr('바늘이 한쪽으로 흐르면 템포를, 가만히 치우쳐 있으면 넛지를 쓰세요',
               'Drifting one way means tempo. Sitting off-center means nudge.');
        if (msg !== lastCaption) { caption.textContent = msg; lastCaption = msg; }
      }
    };
  };

  /* 밀기 버튼 한 쌍. 레슨과 오늘의 도전이 같은 것을 쓴다. */
  FM.nudgeRow = function (deck) {
    var row = el('div', 'nudge-row');
    [['◀', -0.06], ['▶', 0.06]].forEach(function (pair) {
      var btn = el('button', 'btn btn-nudge btn-nudge-lg', pair[0]);
      var press = function (e) { e.preventDefault(); deck.setNudge(pair[1]); btn.classList.add('on'); };
      var release = function () { deck.setNudge(0); btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', press);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { btn.addEventListener(ev, release); });
      row.appendChild(btn);
    });
    return row;
  };

  /* 크로스페이더 한 줄. onInput 은 값이 바뀔 때마다 불린다(채점에 필요). */
  FM.crossfader = function (mixer, initial, onInput) {
    var wrap = el('div', 'xfader');
    var input = el('input', 'xf-input');
    input.type = 'range'; input.min = 0; input.max = 1; input.step = 0.01;
    input.value = initial;
    input.setAttribute('aria-label', tr('크로스페이더', 'Crossfader'));
    mixer.setCrossfade(initial);
    input.addEventListener('input', function () {
      var v = parseFloat(input.value);
      mixer.setCrossfade(v);
      if (onInput) onInput(v);
    });
    wrap.append(el('span', 'xf-end', 'A'), input, el('span', 'xf-end', 'B'));
    wrap.input = input;
    return wrap;
  };

  FM.slider = slider;
  FM.el = el;
})(typeof window !== 'undefined' ? window : this);
