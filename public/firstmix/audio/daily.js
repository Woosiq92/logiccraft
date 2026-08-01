/* 오늘의 도전 — 날짜만으로 문제를 만들고 채점한다.
 *
 * 서버가 없다. 그런데도 "같은 날 모두 같은 문제"가 성립하는 이유는
 * 트랙이 파일이 아니라 코드로 합성되기 때문이다. 날짜를 시드로 넣으면
 * 어느 기기에서든 같은 조합·같은 어긋남이 그대로 재현된다.
 *
 * 리더보드는 만들지 않는다. 서버가 필요하고, 서버가 생기면 개인정보 이야기가 붙는다.
 * 대신 개인 최고 기록과 연속 일수로 돌아올 이유를 만든다.
 */
(function (global) {
  'use strict';

  var FM = global.FirstMix = global.FirstMix || {};

  /* mulberry32 — 짧고 결정적인 난수. 같은 시드는 언제나 같은 수열. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 'YYYY-MM-DD'. 로컬 날짜 기준 — 사용자의 "오늘"과 어긋나면 안 된다. */
  FM.dayKey = function (date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  };

  function seedOf(key) {
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* 도전에서 쓸 수 있는 조합인지. 기본 템포 범위(±8%) 안에서 맞출 수 있어야 한다.
   * 트랙이 늘면서 디스코 118 과 테크노 138 같은 조합(16.9% 차이)이 나올 수 있게 됐는데,
   * 그건 범위 버튼을 먼저 찾아야 풀리는 문제라 도전으로 내면 사용자가 갇힌다.
   * 여유를 조금 남겨 7.5% 로 자른다. */
  var MATCH_LIMIT = 7.5;
  function requiredPercent(a, b, tempoA) {
    return (a.bpm * (1 + tempoA / 100) / b.bpm - 1) * 100;
  }

  /* 그날의 과제. 트랙 두 개, A 의 템포 틀기, B 의 시작 위상 어긋남. */
  FM.dailyChallenge = function (dayKey) {
    var tracks = FM.TRACKS;
    var r = rng(seedOf(dayKey));

    // A 를 조금 틀어 두면 맞춰야 할 값이 트랙 조합만으로 정해지지 않는다.
    // 매일 목표 숫자가 달라야 외워서 푸는 걸 막는다. 조합을 고르기 전에 먼저 뽑아야
    // "이 값에서 맞출 수 있는 조합"을 걸러낼 수 있다.
    var tempoA = Math.round((r() * 4 - 2) * 10) / 10;   // -2.0 ~ +2.0 %

    var pairs = [];
    for (var i = 0; i < tracks.length; i++) {
      for (var j = 0; j < tracks.length; j++) {
        if (i === j) continue;                          // 같은 곡 두 장은 연습이 안 된다
        if (Math.abs(requiredPercent(tracks[i], tracks[j], tempoA)) <= MATCH_LIMIT) pairs.push([i, j]);
      }
    }
    if (!pairs.length) pairs.push([0, 1]);               // 트랙 구성이 바뀌어도 도전은 나와야 한다

    var pick = pairs[Math.floor(r() * pairs.length)];
    return {
      day: dayKey,
      aIndex: pick[0],
      bIndex: pick[1],
      tempoA: tempoA,
      phaseOffset: 0.18 + r() * 0.64                    // 한 박의 18~82%
    };
  };

  FM.MATCH_LIMIT = MATCH_LIMIT;
  FM.requiredPercent = requiredPercent;

  /* 채점.
   * 넘기는 동안 두 곡이 얼마나 겹쳐 있었나 — 실제 DJ 를 보는 잣대와 같게 잡았다.
   * 크로스페이더가 움직이는 구간만 표본으로 쓰고, 그 구간이 너무 짧으면 채점하지 않는다
   * (맞추지 않고 확 넘겨 버리는 걸 점수로 인정하면 안 되기 때문). */
  var MIN_SPAN = 3;      // 최소 이만큼은 걸쳐서 넘겨야 한다 (초)
  var FAIL_MS = 50;      // 평균 위상 오차가 이만큼이면 0점

  FM.scoreDaily = function (samples) {
    if (!samples || samples.length < 2) {
      return { ok: false, reason: 'none', score: 0 };
    }
    var span = samples[samples.length - 1].t - samples[0].t;
    if (span < MIN_SPAN) {
      return { ok: false, reason: 'tooFast', score: 0, span: span };
    }
    var sum = 0, worst = 0;
    for (var i = 0; i < samples.length; i++) {
      var e = Math.abs(samples[i].phaseErrMs);
      sum += e;
      if (e > worst) worst = e;
    }
    var mean = sum / samples.length;
    var ratio = mean / FAIL_MS;
    var score = Math.round(100 * (1 - (ratio < 0 ? 0 : ratio > 1 ? 1 : ratio)));
    return {
      ok: true, score: score, meanMs: mean, worstMs: worst, span: span,
      grade: score >= 90 ? 'perfect' : score >= 75 ? 'good' : score >= 60 ? 'pass' : 'weak'
    };
  };

  FM.MIN_SPAN = MIN_SPAN;

  /* 오늘부터 거꾸로 며칠 연속으로 기록이 있는가.
   * 오늘 아직 안 했으면 어제까지의 연속을 세어 준다 — 자정을 넘겼다고 0 을 보여주면
   * 하루를 통째로 잃은 것처럼 느껴지기 때문이다. */
  FM.dailyStreak = function (records, todayKey) {
    if (!records) return 0;
    var d = new Date(todayKey + 'T00:00:00');
    if (isNaN(d)) return 0;
    if (!records[todayKey]) d.setDate(d.getDate() - 1);
    var n = 0;
    while (records[FM.dayKey(d)]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };

  /* 기록은 하루 한 줄만 남기고 오래된 건 버린다. 무한정 쌓을 이유가 없다. */
  FM.trimDaily = function (records, keepDays) {
    var keys = Object.keys(records || {}).sort();
    var drop = keys.length - (keepDays || 60);
    for (var i = 0; i < drop; i++) delete records[keys[i]];
    return records;
  };
})(typeof window !== 'undefined' ? window : this);
