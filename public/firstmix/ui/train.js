/* 첫믹스 훈련 — 비트매칭을 네 단계로 쪼갠 레슨.
 *
 * 설계 원칙 두 가지:
 *  1) 컨트롤을 한 번에 다 주지 않는다. 그 레슨에 필요한 것만 화면에 있다.
 *  2) 숫자를 감춘다. BPM 숫자를 보면 귀 대신 숫자를 맞추게 된다.
 */
(function (global) {
  'use strict';

  var FM = global.FirstMix;
  var el = FM.el, tr = FM.tr, dl = FM.dl, L = FM.L;

  var LESSONS = [
    {
      id: 'l1',
      title: L('박 느끼기', 'Feel the beat'),
      sub: L('한 곡, 네 박', 'One track, four beats'),
      lead: L('곡이 흐르는 동안 박에 맞춰 버튼을 두드리세요.',
              'Tap the button on the beat while the track plays.'),
      hint: L('"쿵" 하는 킥에 맞추면 됩니다. 여덟 번 이상 두드리면 채점합니다.',
              'Follow the thump of the kick drum. Scoring starts once you have tapped eight times.'),
      mode: 'tap'
    },
    {
      id: 'l2',
      title: L('템포 맞추기', 'Match the tempo'),
      sub: L('두 곡의 빠르기를 같게', 'Make both tracks run at one speed'),
      lead: L('B 곡이 A 곡보다 느립니다. 템포 페이더로 빠르기를 맞추세요.',
              'Track B is slower than track A. Use the tempo fader to match it.'),
      hint: L('바늘이 한쪽으로 계속 흐르면 아직 빠르기가 다릅니다. 흐름이 멈출 때까지 미세하게 움직이세요.',
              'A needle that keeps drifting one way means the speeds still differ. Move the fader in small steps until the drift stops.'),
      mode: 'tempo'
    },
    {
      id: 'l3',
      title: L('박 겹치기', 'Line the beats up'),
      sub: L('빠르기는 같은데 어긋난 상태', 'Same speed, still out of step'),
      lead: L('빠르기는 이미 같습니다. 밀기 버튼으로 두 곡의 박을 겹치세요.',
              'The speeds already match. Use the nudge buttons to lay the beats on top of each other.'),
      hint: L('바늘이 오른쪽에 치우쳐 있으면 ◀, 왼쪽이면 ▶ 를 짧게 누릅니다.',
              'Needle sitting to the right, tap ◀. Sitting to the left, tap ▶. Short taps.'),
      mode: 'phase'
    },
    {
      id: 'l4',
      title: L('첫 믹스', 'Your first mix'),
      sub: L('맞춘 뒤 넘기기', 'Match it, then cross over'),
      lead: L('빠르기와 박을 맞춘 다음, 크로스페이더를 B쪽 끝까지 넘기세요.',
              'Match the speed and the beats, then push the crossfader all the way over to B.'),
      hint: L('어긋난 채로 넘기면 통과가 아닙니다. 겹친 상태를 유지하면서 넘기세요.',
              'Crossing over while the beats are apart does not count. Keep them locked the whole way.'),
      mode: 'mix'
    },

    /* ── 전환 기술 (2026-08-01) ────────────────────────────
     * 여기까지는 "두 곡을 겹치는 법"이고, 아래 셋은 "겹친 다음 무엇을 하는가"다.
     * 원래 배우기 글로만 있던 것들인데, 읽기만 하는 앱은 죽어 있다는 게 이 앱의 전제였다.
     * 합성 트랙이라 정답을 우리가 안다 — 브레이크가 몇 번째 박에서 시작하는지도,
     * 저음이 언제 겹쳤는지도 잴 수 있다. 그래서 셋 다 판정이 붙는다.
     * 미학은 채점하지 않는다. "했다/안 했다"와 "겹친 시간"까지만 본다. */
    {
      id: 'l5', group: 'transition',
      title: L('묶음 첫 박에서 넘기기', 'Cross on the phrase'),
      sub: L('언제 넘기는가', 'When to cross'),
      lead: L('A 곡이 처음부터 흐릅니다. 16박 묶음이 시작하는 자리에서 크로스페이더를 넘기세요.',
              'Track A plays from the top. Push the crossfader over where a 16-beat block begins.'),
      hint: L('빠르기와 박은 이미 맞춰 뒀습니다. 킥을 넷씩 네 번 세면 16박입니다. 킥이 사라지는 브레이크가 가장 알기 쉬운 자리입니다.',
              'Speed and beats are already matched. Count the kick four times four and you have 16 beats. The break, where the kick drops out, is the easiest one to spot.'),
      mode: 'phrase'
    },
    {
      id: 'l6', group: 'transition',
      title: L('저음 자리 비우기', 'Clear the low end'),
      sub: L('EQ 로 부딪히지 않게', 'Keep the bass from colliding'),
      lead: L('B 의 LOW 를 내리고 들여보낸 다음, 넘어가면서 두 곡의 LOW 를 맞바꾸세요.',
              'Bring B in with its LOW down, then swap the two LOWs as you cross.'),
      hint: L('두 곡의 LOW 가 동시에 열려 있으면 소리가 뭉칩니다. 그 시간이 짧을수록 좋습니다. 다 넘긴 뒤에는 B 의 LOW 를 다시 올려야 합니다.',
              'While both LOWs are open the sound turns to mud. The less time that lasts, the better. Once you are across, B\'s LOW has to come back up.'),
      mode: 'eq'
    },
    {
      id: 'l7', group: 'transition',
      title: L('필터로 들여보내기', 'Bring it in on the filter'),
      sub: L('한 손잡이로 하는 전환', 'One knob does it'),
      lead: L('B 의 필터가 오른쪽 끝에 있습니다. 그대로 들여보낸 뒤, 넘기면서 천천히 가운데로 되돌리세요.',
              'B\'s filter sits hard right. Bring it in like that, then walk it back to center as you cross.'),
      hint: L('오른쪽 끝은 고음만 남은 상태라 얇게 얹힙니다. 다 넘겼을 때 필터가 가운데에 와 있어야 합니다.',
              'Hard right leaves only the highs, so it lays on thin. By the time you are fully across the filter has to be back at center.'),
      mode: 'filter'
    }
  ];
  FM.LESSONS = LESSONS;

  // 판정이 한 번에 끝나는 레슨들. 크로스페이더를 다 넘기는 순간 채점한다.
  var DRILLS = { phrase: 1, eq: 1, filter: 1 };
  var PHRASE = 16;        // 한 묶음 = 16박

  var HOLD = 4;            // 정렬을 몇 초 유지해야 통과인가
  var active = null;       // 진행 중인 레슨 런타임

  /* 사람이 실제로 들은 시점의 위상.
   * 출력 지연만큼 과거의 소리를 지금 듣고 있으므로 그만큼 되돌려 재야 공정하다. */
  function heardPhase(deck, latency) {
    return deck.phaseAt(deck.position - latency * deck.rate);
  }

  function fold(x) { return x - Math.round(x); }

  /* ── 레슨 목록 ─────────────────────────────────────── */
  function renderList(root) {
    var intro = el('section', 'card card-intro');
    intro.appendChild(el('h2', 'card-title', tr('기기를 사기 전에', 'Before you buy gear')));
    intro.appendChild(el('p', 'card-body', tr(
      '디제잉의 처음 절반은 장비가 아니라 두 곡의 박을 겹치는 감각입니다. 그건 폰으로도 배울 수 있습니다.',
      'The first half of DJing is not equipment. It is the feel for laying two tracks on the same beat, and a phone can teach you that.')));
    var howto = el('button', 'btn btn-ghost intro-guide', tr('처음이신가요 · 사용 안내 ›', 'New here? Read the guide ›'));
    howto.addEventListener('click', function () { FM.openGuide(); });
    intro.appendChild(howto);
    root.appendChild(intro);

    // 오늘의 도전 — 레슨을 다 마친 사람이 돌아올 이유
    if (FM.dailyCard) root.appendChild(FM.dailyCard());

    var list = el('section', 'lessons');
    // 지금 할 레슨 하나만 도드라지게. 목록에서 눈이 갈 곳이 여러 개면 아무 데도 안 간다.
    var nextIdx = -1;
    LESSONS.forEach(function (les, i) {
      var open = i === 0 || FM.state.progress[LESSONS[i - 1].id];
      if (nextIdx < 0 && open && !FM.state.progress[les.id]) nextIdx = i;
    });
    var shownGroup = null;
    LESSONS.forEach(function (les, i) {
      // 기초 넷과 전환 셋은 배우는 결이 달라서 줄을 하나 긋는다
      if (les.group && les.group !== shownGroup) {
        shownGroup = les.group;
        list.appendChild(el('h3', 'lesson-group', tr('겹친 다음', 'Once they are locked')));
      }
      var doneBefore = i === 0 || FM.state.progress[LESSONS[i - 1].id];
      var row = el('button', 'lesson' + (FM.state.progress[les.id] ? ' done' : '') +
        (doneBefore ? '' : ' locked') + (i === nextIdx ? ' next' : ''));
      row.append(
        el('span', 'lesson-no', FM.state.progress[les.id] ? '✓' : String(i + 1)),
        (function () {
          var t = el('span', 'lesson-text');
          t.append(el('span', 'lesson-title', dl(les.title)), el('span', 'lesson-sub', dl(les.sub)));
          return t;
        })()
      );
      if (doneBefore) row.addEventListener('click', function () { openLesson(les); });
      else row.disabled = true;
      list.appendChild(row);
    });
    root.appendChild(list);

    // 배우기 — 4단계를 마친 뒤의 다음 벽. 접어 두어 목록을 길게 만들지 않는다.
    if (FM.learnSection) root.appendChild(FM.learnSection());
  }

  /* B 를 A 와 같은 자리에 놓는다. 박만 맞추면 들어오는 곡이 묶음 한가운데서 시작해서,
   * "묶음 시작끼리 맞춘다"는 정작 배울 것이 화면에 없어진다.
   * 두 곡 다 112박짜리라 박 번호를 그대로 옮기면 묶음 자리까지 같아진다. */
  function alignB() {
    var mix = FM.state.mixer, a = mix.a, b = mix.b;
    if (!a.bpm || !b.bpm) return;
    /* ★ position 은 버퍼 안의 자리다. 박 격자도 원본 BPM 기준이지 당겨 놓은 속도 기준이 아니다
     * (engine 의 phaseAt 이 60/bpm 을 쓴다). effectiveBpm 으로 환산하면 정확히 반 박 어긋난다 —
     * 스크린샷의 바늘이 오른쪽 끝에 붙어 있어서 잡았다. */
    var beatsA = (a.position - a.beatOffset) / (60 / a.bpm);
    b.seek(b.beatOffset + beatsA * (60 / b.bpm));
  }

  /* ── 레슨 화면 ─────────────────────────────────────── */
  function openLesson(les) {
    var root = document.getElementById('app');
    root.textContent = '';
    var mix = FM.state.mixer;
    mix.a.pause(); mix.b.pause();
    mix.a.setTempoPercent(0); mix.b.setTempoPercent(0);
    // 4단계는 A쪽에 치우쳐 시작한다. 완전히 0으로 두면 B가 안 들려서 맞출 수가 없다.
    // (스플릿 출력을 켜면 헤드폰으로 미리 들을 수 있지만, 레슨은 케이블 없이도 되어야 한다.)
    mix.setCrossfade(les.mode === 'mix' || DRILLS[les.mode] ? 0.2 : 0.5);
    mix.a.setVolume(1); mix.b.setVolume(1);

    var head = el('section', 'lesson-head');
    var back = el('button', 'btn btn-ghost btn-back', tr('‹ 목록', '‹ Lessons'));
    back.addEventListener('click', function () { closeLesson(); FM.go('train'); });
    head.append(back, el('h2', 'lesson-h', dl(les.title)));
    var lead = el('p', 'lesson-lead', dl(les.lead));
    var hint = el('p', 'lesson-hint', dl(les.hint));
    root.append(head, lead, hint);

    var meter = null, status = el('div', 'lesson-status', ''), controls = el('section', 'lesson-controls');

    var rt = {
      les: les, holdFrom: null, taps: [], done: false, status: status, meter: null, controls: controls,
      // 드릴이 채점에 쓰는 것들. 손잡이 값은 엔진에서 되읽지 않고 여기에 적어 둔다.
      eq: { aLow: 0.5, bLow: 0.5 }, filter: 1, bothLowSec: 0, lastT: 0,
      atEntry: null, atMid: null
    };

    var A = FM.TRACKS[2];   // 하우스 128
    var B = FM.TRACKS[0];   // 딥 하우스 122

    // 어느 덱에서 무슨 곡이 도는지 — 이게 없으면 두 소리가 그냥 한 덩어리로 들린다.
    var nowRow = el('div', 'nowrow');
    function chip(tag, track) {
      var c = el('div', 'chip');
      c.style.setProperty('--accent', FM.DECK_COLOR[tag]);
      // 곡 색은 여기서 쓰지 않는다 — 덱 색과 섞이면 A/B 를 색으로 읽을 수 없다.
      c.append(el('span', 'chip-tag', tag), el('span', 'chip-name', dl(track.name)));
      return c;
    }
    nowRow.appendChild(chip('A', A));
    if (les.mode !== 'tap') nowRow.appendChild(chip('B', B));
    root.appendChild(nowRow);

    if (les.mode === 'tap') {
      FM.loadTrack(mix.a, A).then(function () { FM.practiceLoop(mix.a, A); mix.a.play(); });
      var tap = el('button', 'tapper', tr('박에 맞춰\n두드리기', 'Tap\non the beat'));
      tap.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (rt.done) return;
        var err = fold(heardPhase(mix.a, mix.latency())) * (60 / mix.a.effectiveBpm) * 1000;
        rt.taps.push(err);
        tap.classList.remove('hit', 'miss');
        void tap.offsetWidth;                       // 클래스 재적용을 위해 리플로 강제
        tap.classList.add(Math.abs(err) < 60 ? 'hit' : 'miss');
      });
      controls.appendChild(tap);
      var reset = el('button', 'btn btn-ghost', tr('다시 세기', 'Start over'));
      reset.addEventListener('click', function () { rt.taps = []; });
      controls.appendChild(reset);
    } else {
      meter = FM.createPhaseMeter(mix.a, mix.b, { showBpm: false, caption: false });
      rt.meter = meter;
      root.appendChild(meter.el);

      Promise.all([FM.loadTrack(mix.a, A), FM.loadTrack(mix.b, B)]).then(function () {
        if (DRILLS[les.mode]) {
          /* 드릴은 비트매칭을 이미 끝낸 상태에서 시작한다. 여기서 배우는 건 타이밍과 손이지
           * 맞추는 일이 아니고, 안 맞은 채로 두면 무엇 때문에 지저분한지 구분이 안 된다. */
          mix.b.setTempoPercent((A.bpm / B.bpm - 1) * 100);
          if (les.mode === 'phrase') {
            // 프레이즈 드릴만 편곡 전체를 돈다 — 브레이크가 와야 넘길 자리가 생긴다.
            mix.a.clearLoop();
            mix.a.seek(0);
          } else {
            FM.practiceLoop(mix.a, A);
          }
          mix.a.play();
          mix.b.seek(0);
          mix.b.clearLoop();
          alignB();
          mix.b.play();
          if (les.mode === 'eq') mix.b.setEq('low', 0.5);
          if (les.mode === 'filter') { mix.b.setFilter(1); rt.filter = 1; }
          return;
        }
        if (les.mode === 'phase' || les.mode === 'mix') {
          // 3·4단계는 빠르기를 미리 맞춰 두거나(3), 둘 다 어긋나게 둔다(4).
          if (les.mode === 'phase') mix.b.setTempoPercent((A.bpm / B.bpm - 1) * 100);
          else mix.b.setTempoPercent(0);
        }
        FM.practiceLoop(mix.a, A);
        mix.a.play();
        // 위상을 한 박의 20~80% 만큼 어긋나게 시작 — 우연히 맞아떨어지지 않도록.
        FM.practiceLoop(mix.b, B, (60 / B.bpm) * (0.2 + Math.random() * 0.6));
        mix.b.play();
      });

      if (les.mode === 'tempo' || les.mode === 'mix') {
        var tempo = FM.slider(tr('B 템포', 'B TEMPO'), -8, 8, 0.05, 0, function (v) { mix.b.setTempoPercent(v); });
        tempo.classList.add('sl-tempo');
        controls.appendChild(tempo);
      }
      if (les.mode === 'phase' || les.mode === 'mix') {
        controls.appendChild(FM.nudgeRow(mix.b));
      }
      if (les.mode === 'mix') {
        controls.appendChild(FM.crossfader(mix, 0.2));
      }

      if (les.mode === 'eq') {
        [['A', 'a', 'aLow'], ['B', 'b', 'bLow']].forEach(function (t) {
          var sl = FM.slider(t[0] + ' LOW', 0, 1, 0.01, 0.5, function (v) {
            mix[t[1]].setEq('low', v);
            rt.eq[t[2]] = v;
          });
          controls.appendChild(sl);
        });
      }
      if (les.mode === 'filter') {
        var fsl = FM.slider(tr('B 필터', 'B FILTER'), 0, 1, 0.01, 1, function (v) {
          mix.b.setFilter(v);
          rt.filter = v;
        });
        controls.appendChild(fsl);
      }
      if (DRILLS[les.mode]) controls.appendChild(FM.crossfader(mix, 0.2));
    }

    // 레슨 중에도 소리를 끌 수 있어야 한다. 못 끄는 훈련 앱은 금방 미움받는다.
    var stop = el('button', 'btn btn-ghost btn-stop', tr('소리 멈추기', 'Stop sound'));
    stop.addEventListener('click', function () {
      var on = mix.a.playing || mix.b.playing;
      if (on) {
        mix.a.pause();
        if (les.mode !== 'tap') mix.b.pause();
      } else {
        mix.a.play();
        if (les.mode !== 'tap') mix.b.play();
      }
      stop.textContent = on ? tr('다시 재생', 'Play again') : tr('소리 멈추기', 'Stop sound');
      rt.holdFrom = null;
    });
    controls.appendChild(stop);

    root.append(controls, status);
    active = rt;
  }

  function closeLesson() {
    if (!active) return;
    var mix = FM.state.mixer;
    mix.a.pause(); mix.b.pause();
    mix.a.setTempoPercent(0); mix.b.setTempoPercent(0);
    mix.b.setNudge(0);
    mix.setCrossfade(0.5);
    ['a', 'b'].forEach(function (d) {
      mix[d].setEq('low', 0.5); mix[d].setEq('mid', 0.5); mix[d].setEq('high', 0.5);
      mix[d].setFilter(0.5);
      mix[d].setEcho(0);
      mix[d].clearLoop();
    });
    active = null;
  }
  FM.leaveTrain = closeLesson;

  /* 배우기 글에서 그 드릴로 바로 보내기 위한 통로 */
  FM.openLessonById = function (id) {
    var les = LESSONS.filter(function (x) { return x.id === id; })[0];
    if (les) openLesson(les);
  };

  function pass(rt) {
    if (rt.done) return;
    rt.done = true;
    FM.state.progress[rt.les.id] = true;
    FM.saveProgress();
    // 통과한 뒤의 컨트롤은 만질 것이 없다. 결과를 위로 올린다.
    if (rt.controls) {
      rt.controls.classList.add('spent');
      rt.controls.parentNode.insertBefore(rt.status, rt.controls);
    }
    rt.status.className = 'lesson-status ok';
    rt.status.textContent = tr('통과했습니다', 'Passed');
    var next = el('button', 'btn btn-primary', tr('목록으로', 'Back to list'));
    next.addEventListener('click', function () { closeLesson(); FM.go('train'); });
    rt.status.appendChild(next);
  }

  /* 드릴 채점. 미학은 안 본다 — "했다/안 했다"와 "겹친 시간"까지만.
   * 실제 디제잉에서 LOW 를 언제 바꾸는지에 정답은 없고, 정답인 척하면 나쁜 앱이 된다. */
  function judgeDrill(rt) {
    var mix = FM.state.mixer;
    if (rt.les.mode === 'phrase') {
      /* 넘어가는 순간(페이더가 가운데를 지날 때) A 가 묶음의 어디에 있었나.
       * 합성 트랙이라 몇 번째 박인지 우리가 정확히 안다. */
      var off = rt.atMid === null ? 99 : rt.atMid;
      var err = Math.abs(off - Math.round(off / PHRASE) * PHRASE);
      if (err <= 1) return { ok: true, msg: tr('묶음 첫 박에서 넘겼습니다', 'You crossed on the first beat of a block') };
      return { ok: false, msg: tr(
        '묶음 시작에서 ' + err.toFixed(1) + '박 벗어났습니다. 킥을 넷씩 네 번 세어 보세요.',
        err.toFixed(1) + ' beats off the start of a block. Try counting the kick four times four.') };
    }
    if (rt.les.mode === 'eq') {
      if (rt.atEntry === null || rt.atEntry.bLow > 0.3) {
        return { ok: false, msg: tr('B 의 LOW 를 내리지 않고 들여보냈습니다. 내린 채로 들여보내세요.',
          'B came in with its LOW still up. Bring it in with the LOW down.') };
      }
      if (rt.eq.bLow < 0.55) {
        return { ok: false, msg: tr('다 넘긴 뒤 B 의 LOW 를 올리지 않았습니다. 저음이 빈 채로 끝납니다.',
          'B\'s LOW never came back up. The track is left with no bottom end.') };
      }
      if (rt.bothLowSec > 0.6) {
        return { ok: false, msg: tr(
          '두 곡의 LOW 가 ' + rt.bothLowSec.toFixed(1) + '초 동안 같이 열려 있었습니다. 맞바꾸는 순간을 짧게 하세요.',
          'Both LOWs were open together for ' + rt.bothLowSec.toFixed(1) + 's. Make the swap quicker.') };
      }
      return { ok: true, msg: tr('저음이 한 번도 부딪히지 않았습니다', 'The low end never collided') };
    }
    // filter
    if (rt.atEntry === null || rt.atEntry.filter < 0.7) {
      return { ok: false, msg: tr('필터를 오른쪽에 둔 채로 들여보내야 합니다. 그래야 얇게 얹힙니다.',
        'The filter has to stay hard right while it comes in. That is what keeps it thin.') };
    }
    if (rt.atMid === null || rt.atMid < 0.55 || rt.atMid > 0.9) {
      return { ok: false, msg: tr('가운데로 한 번에 던졌습니다. 넘기면서 천천히 되돌리세요.',
        'The filter jumped to center. Walk it back gradually as you cross.') };
    }
    if (rt.filter < 0.42 || rt.filter > 0.58) {
      return { ok: false, msg: tr('다 넘겼는데 필터가 가운데가 아닙니다. 끝나면 반드시 가운데로 돌려놓습니다.',
        'You are fully across but the filter is not at center. It always goes back when you are done.') };
    }
    return { ok: true, msg: tr('얇게 들여보내고 몸통을 열었습니다', 'Brought in thin, then opened up') };
  }

  function finishDrill(rt) {
    var res = judgeDrill(rt);
    var mix = FM.state.mixer;
    rt.done = true;
    rt.controls.classList.add('spent');
    rt.controls.parentNode.insertBefore(rt.status, rt.controls);
    rt.status.textContent = '';
    rt.status.className = 'lesson-status ' + (res.ok ? 'ok' : 'warn');
    rt.status.appendChild(el('span', null, res.msg));

    if (res.ok) {
      FM.state.progress[rt.les.id] = true;
      FM.saveProgress();
      var next = el('button', 'btn btn-primary', tr('목록으로', 'Back to list'));
      next.addEventListener('click', function () { closeLesson(); FM.go('train'); });
      rt.status.appendChild(next);
    } else {
      var again = el('button', 'btn btn-primary', tr('다시 하기', 'Try again'));
      again.addEventListener('click', function () { closeLesson(); openLesson(rt.les); });
      var list = el('button', 'btn btn-ghost', tr('목록으로', 'Back to list'));
      list.addEventListener('click', function () { closeLesson(); FM.go('train'); });
      rt.status.append(again, list);
    }
    mix.a.pause(); mix.b.pause();
  }

  /* 매 프레임 판정. 유지 조건은 "몇 초 동안" 이어야 한다 — 스쳐 지나가는 정렬은 실력이 아니다. */
  FM.trainTick = function () {
    if (!active || active.done) return;
    var rt = active, mix = FM.state.mixer, now = mix.ctx.currentTime;
    if (rt.meter) rt.meter.update();

    if (DRILLS[rt.les.mode]) {
      if (!mix.a.playing || !mix.b.playing) return;
      var x = mix.getCrossfade();
      // 들여보내기 시작한 순간의 손 상태 — 이때 이미 준비돼 있어야 한다
      if (rt.atEntry === null && x > 0.35) rt.atEntry = { bLow: rt.eq.bLow, filter: rt.filter };
      // 넘어가는 순간
      if (rt.atMid === null && x > 0.5) {
        rt.atMid = rt.les.mode === 'phrase'
          ? (mix.a.position - mix.a.beatOffset) / (60 / mix.a.effectiveBpm)
          : rt.filter;
      }
      // 두 곡이 같이 들리는 동안 저음이 겹친 시간
      if (rt.les.mode === 'eq') {
        var dt = rt.lastT ? Math.max(0, now - rt.lastT) : 0;
        /* "열려 있다"의 기준은 0.5(플랫)이지 그 위가 아니다. 손대지 않은 LOW 는 이미 다 나온다.
         * 세는 구간은 넘기기 시작한 뒤부터 — 0.2 에서 출발하니 손댈 틈은 줘야 한다. */
        if (x > 0.3 && x < 0.95 && rt.eq.aLow > 0.42 && rt.eq.bLow > 0.42) rt.bothLowSec += dt;
      }
      rt.lastT = now;

      rt.status.className = 'lesson-status';
      rt.status.textContent = x <= 0.21 ? ''
        : tr('넘기는 중 ', 'Crossing ') + Math.round(x * 100) + '%';
      if (x > 0.97) finishDrill(rt);
      return;
    }

    if (rt.les.mode === 'tap') {
      var n = rt.taps.length;
      if (n < 8) {
        rt.status.className = 'lesson-status';
        rt.status.textContent = n === 0 ? '' : n + tr(' / 8 번', ' / 8 taps');
        return;
      }
      var last = rt.taps.slice(-8);
      var avg = last.reduce(function (s, v) { return s + Math.abs(v); }, 0) / last.length;
      rt.status.className = 'lesson-status';
      rt.status.textContent = tr('평균 오차 ', 'Average error ') + Math.round(avg) + 'ms';
      if (avg < 60) pass(rt);
      return;
    }

    if (!mix.a.playing || !mix.b.playing) return;
    var lat = mix.latency();
    var dPhase = Math.abs(fold(heardPhase(mix.a, lat) - heardPhase(mix.b, lat)));
    var dBpm = Math.abs(mix.a.effectiveBpm - mix.b.effectiveBpm);

    var ok;
    if (rt.les.mode === 'tempo') ok = dBpm < 0.15;
    else if (rt.les.mode === 'phase') ok = dPhase < 0.02;
    else ok = dBpm < 0.2 && dPhase < 0.03 && mix.getCrossfade() > 0.97;

    if (!ok) { rt.holdFrom = null; rt.status.className = 'lesson-status'; rt.status.textContent = ''; return; }
    if (rt.holdFrom === null) rt.holdFrom = now;
    var held = now - rt.holdFrom;
    if (held >= HOLD) return pass(rt);
    rt.status.className = 'lesson-status hold';
    rt.status.textContent = tr('유지 중 ', 'Holding ') + Math.max(0, HOLD - held).toFixed(1) + tr('초', 's');
  };

  FM.renderTrain = function (root) {
    active = null;
    renderList(root);
  };
})(typeof window !== 'undefined' ? window : this);
