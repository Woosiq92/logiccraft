/* 오늘의 도전 화면.
 *
 * 훈련 레슨이 한 가지씩 떼어 가르친다면, 여기는 그걸 한 판에 다 쓴다.
 * 빠르기를 맞추고, 박을 겹치고, 넘긴다. 채점은 "넘기는 동안" 얼마나 겹쳐 있었나로 한다 —
 * 넘기기 직전 한 순간만 보면 운으로 맞은 것과 구분되지 않기 때문이다.
 */
(function (global) {
  'use strict';

  var FM = global.FirstMix;
  var el = FM.el, tr = FM.tr, dl = FM.dl;

  var rt = null;   // 진행 중인 도전

  /* 채점 결과의 등급은 키로 나온다(audio/daily.js). 화면에 쓸 이름은 여기서 붙인다 —
   * 저장된 옛 기록에는 한글 등급이 그대로 들어 있어서, 모르는 값은 그냥 통과시킨다. */
  var GRADE = {
    perfect: { ko: '완벽', en: 'Perfect' },
    good:    { ko: '좋음', en: 'Good' },
    pass:    { ko: '통과', en: 'Pass' },
    weak:    { ko: '아쉬움', en: 'Needs work' }
  };
  function gradeLabel(g) { return GRADE[g] ? dl(GRADE[g]) : g; }

  var MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateLabel(mm, dd) {
    return FM.lang === 'en' ? MONTH_EN[mm - 1] + ' ' + dd : mm + '월 ' + dd + '일';
  }
  function days(n) { return FM.lang === 'en' ? n + (n === 1 ? ' day' : ' days') : n + '일'; }

  function fold(x) { return x - Math.round(x); }

  function heardPhase(deck, latency) {
    return deck.phaseAt(deck.position - latency * deck.rate);
  }

  function records() {
    if (!FM.state.progress.daily) FM.state.progress.daily = {};
    return FM.state.progress.daily;
  }

  /* 훈련 목록 맨 위에 놓이는 카드. 오늘 상태를 한눈에 보여준다. */
  FM.dailyCard = function () {
    var today = FM.dayKey();
    var recs = records();
    var mine = recs[today];
    var streak = FM.dailyStreak(recs, today);

    var card = el('button', 'daily-card' + (mine ? ' done' : ''));
    var head = el('div', 'daily-head');
    var md = today.slice(5).split('-');
    head.append(el('span', 'daily-tag', tr('오늘의 도전', "Today's challenge")),
      el('span', 'daily-date', dateLabel(Number(md[0]), Number(md[1]))));
    card.appendChild(head);

    card.appendChild(el('p', 'daily-lead', mine
      ? tr('오늘 최고 ' + mine.best + '점 · ' + gradeLabel(mine.grade),
           'Best today ' + mine.best + ' · ' + gradeLabel(mine.grade))
      : tr('두 곡을 맞춰서 넘기세요. 오늘은 모두 같은 문제입니다.',
           'Match two tracks and cross over. Everyone gets the same challenge today.')));

    var foot = el('div', 'daily-foot');
    foot.appendChild(el('span', 'daily-streak', streak > 0
      ? tr('연속 ' + days(streak), days(streak) + ' in a row')
      : tr('아직 시작 전', 'Not started yet')));
    foot.appendChild(el('span', 'daily-go', mine ? tr('다시 도전 ›', 'Try again ›') : tr('시작하기 ›', 'Start ›')));
    card.appendChild(foot);

    card.addEventListener('click', open);
    return card;
  };

  function open() {
    var mix = FM.state.mixer;
    var today = FM.dayKey();
    var ch = FM.dailyChallenge(today);
    var A = FM.TRACKS[ch.aIndex], B = FM.TRACKS[ch.bIndex];

    var root = document.getElementById('app');
    root.textContent = '';
    mix.a.pause(); mix.b.pause();
    mix.b.setNudge(0);
    mix.a.setVolume(1); mix.b.setVolume(1);

    var head = el('section', 'lesson-head');
    var back = el('button', 'btn btn-ghost btn-back', tr('‹ 목록', '‹ Lessons'));
    back.addEventListener('click', function () { close(); FM.go('train'); });
    head.append(back, el('h2', 'lesson-h', tr('오늘의 도전', "Today's challenge")));
    root.appendChild(head);

    root.appendChild(el('p', 'lesson-lead', tr(
      '빠르기와 박을 맞춘 다음, 크로스페이더를 B쪽 끝까지 넘기세요.',
      'Match the speed and the beats, then push the crossfader all the way over to B.')));
    root.appendChild(el('p', 'lesson-hint', tr(
      '점수는 넘기는 동안 두 곡이 얼마나 겹쳐 있었는지로 매깁니다. ' + FM.MIN_SPAN + '초보다 빨리 넘기면 채점하지 않습니다.',
      'Your score comes from how well the beats held together while you crossed over. Cross in under ' + FM.MIN_SPAN + ' seconds and it is not scored.')));

    var nowRow = el('div', 'nowrow');
    [['A', A], ['B', B]].forEach(function (pair) {
      var c = el('div', 'chip');
      c.style.setProperty('--accent', FM.DECK_COLOR[pair[0]]);
      c.append(el('span', 'chip-tag', pair[0]), el('span', 'chip-name', dl(pair[1].name)));
      nowRow.appendChild(c);
    });
    root.appendChild(nowRow);

    var meter = FM.createPhaseMeter(mix.a, mix.b, { showBpm: false, caption: false });
    root.appendChild(meter.el);

    var controls = el('section', 'lesson-controls');
    var tempo = FM.slider(tr('B 템포', 'B TEMPO'), -8, 8, 0.05, 0, function (v) { mix.b.setTempoPercent(v); });
    tempo.classList.add('sl-tempo');
    controls.append(tempo, FM.nudgeRow(mix.b));

    var xf = FM.crossfader(mix, 0.2, function (v) { onFade(v); });
    controls.appendChild(xf);

    var status = el('div', 'lesson-status', '');
    root.append(controls, status);

    rt = {
      ch: ch, A: A, B: B, samples: [], done: false,
      status: status, meter: meter, xf: xf, tempo: tempo, controls: controls
    };

    Promise.all([FM.loadTrack(mix.a, A), FM.loadTrack(mix.b, B)]).then(function () {
      if (!rt) return;
      mix.a.setTempoPercent(ch.tempoA);      // 매일 목표 숫자가 달라지도록 A 도 조금 틀어 둔다
      mix.b.setTempoPercent(0);
      FM.practiceLoop(mix.a, A);
      mix.a.play();
      FM.practiceLoop(mix.b, B, (60 / B.bpm) * ch.phaseOffset);
      mix.b.play();
    });
  }

  /* 크로스페이더가 움직이기 시작한 순간부터 표본을 모은다. */
  function onFade(v) {
    if (!rt || rt.done) return;
    if (v > 0.97) finish();
  }

  function close() {
    if (!rt) return;
    var mix = FM.state.mixer;
    mix.a.pause(); mix.b.pause();
    mix.a.setTempoPercent(0); mix.b.setTempoPercent(0);
    mix.b.setNudge(0);
    mix.setCrossfade(0.5);
    rt = null;
  }
  FM.leaveDaily = close;

  function finish() {
    var res = FM.scoreDaily(rt.samples);
    rt.done = true;
    var mix = FM.state.mixer;

    /* 끝난 판의 컨트롤은 더 만질 것이 없다. 결과를 위로 올리고 컨트롤은 물러나게 한다.
     * 안 그러면 이 화면의 정점인 점수가 화면 아래로 밀린다. */
    rt.controls.classList.add('spent');
    rt.controls.parentNode.insertBefore(rt.status, rt.controls);

    rt.status.textContent = '';
    if (!res.ok) {
      rt.status.className = 'lesson-status warn';
      rt.status.appendChild(el('span', null, res.reason === 'tooFast'
        ? tr('너무 빨리 넘겼습니다. ' + FM.MIN_SPAN + '초 이상 걸쳐서 넘겨 주세요.',
             'That was too fast. Take at least ' + FM.MIN_SPAN + ' seconds to cross over.')
        : tr('맞춰 가는 과정이 없었습니다. 두 곡을 겹친 뒤에 넘겨 주세요.',
             'There was nothing to judge. Line the beats up first, then cross over.')));
    } else {
      var recs = records();
      var today = rt.ch.day;
      var prev = recs[today];
      var isBest = !prev || res.score > prev.best;
      recs[today] = {
        best: isBest ? res.score : prev.best,
        grade: isBest ? res.grade : prev.grade,
        tries: (prev ? prev.tries : 0) + 1
      };
      FM.trimDaily(recs, 60);
      FM.saveProgress();

      rt.status.className = 'lesson-status ok';
      var big = el('div', 'score-big', res.score + tr('점', ''));
      var sub = el('div', 'score-sub', tr(
        gradeLabel(res.grade) + ' · 평균 어긋남 ' + Math.round(res.meanMs) + 'ms · ' +
          res.span.toFixed(1) + '초에 걸쳐 넘김',
        gradeLabel(res.grade) + ' · ' + Math.round(res.meanMs) + 'ms average drift · crossed over ' +
          res.span.toFixed(1) + 's'));
      rt.status.append(big, sub);
      if (isBest && prev) rt.status.appendChild(el('div', 'score-note', tr('오늘 최고 기록을 갱신했습니다', 'New best for today')));
      var streak = FM.dailyStreak(recs, today);
      if (streak > 1) rt.status.appendChild(el('div', 'score-note', tr('연속 ' + streak + '일째', days(streak) + ' in a row')));
    }

    var again = el('button', 'btn btn-primary', tr('다시 도전', 'Try again'));
    again.addEventListener('click', function () { close(); open(); });
    var list = el('button', 'btn btn-ghost', tr('목록으로', 'Back to list'));
    list.addEventListener('click', function () { close(); FM.go('train'); });
    rt.status.append(again, list);

    mix.a.pause(); mix.b.pause();
  }

  /* 매 프레임. 크로스페이더가 움직이는 동안의 어긋남을 모은다. */
  FM.dailyTick = function () {
    if (!rt || rt.done) return;
    rt.meter.update();

    var mix = FM.state.mixer;
    if (!mix.a.playing || !mix.b.playing) return;
    var x = mix.getCrossfade();
    if (x <= 0.21) return;                 // 아직 넘기기 시작하지 않았다

    var lat = mix.latency();
    var d = fold(heardPhase(mix.a, lat) - heardPhase(mix.b, lat));
    var beatMs = 60000 / mix.a.effectiveBpm;
    rt.samples.push({ t: mix.ctx.currentTime, phaseErrMs: d * beatMs });

    rt.status.className = 'lesson-status';
    rt.status.textContent = tr('넘기는 중 · 어긋남 ', 'Crossing over · ') + Math.abs(Math.round(d * beatMs)) + 'ms' + tr('', ' off');
  };
})(typeof window !== 'undefined' ? window : this);
