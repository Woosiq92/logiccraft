/* 첫믹스 BPM·첫박 감지 — 룰베이스. LLM 도 외부 API 도 쓰지 않는다.
 *
 * 순서:
 *   1) 모노로 합치고 데시메이션 (~11kHz)
 *   2) one-pole 4개로 대역을 갈라 각 대역의 프레임 에너지를 낸다
 *   3) 에너지의 양(+)의 변화만 더해 온셋 강도 곡선을 만든다  ← 여기까지가 "언제 소리가 들어왔나"
 *   4) 자기상관으로 주기를 찾고, 배·반 박(옥타브) 을 춤곡 범위로 접는다
 *   5) 그 주기로 빗질해 첫 박 위치를 찾는다
 *
 * FFT 를 안 쓰는 이유: 대역 4개면 킥·스네어·하이햇을 가르기에 충분하고,
 * 폰에서 3분짜리 곡을 1초 안에 처리해야 하기 때문이다.
 */
(function (global) {
  'use strict';

  var TARGET_SR = 11025;
  var HOP = 128;                  // 프레임 간격 → 약 86 fps, 11.6ms 해상도
  var BAND_HZ = [200, 800, 3000]; // 이 셋으로 4개 대역이 된다
  var BPM_MIN = 70, BPM_MAX = 190;

  /* 템포 사전확률. 자기상관만 보면 진짜 박이 아닌 주기에 걸린다 —
   * 강세가 2박 주기인 곡은 1박 자기상관이 1.5박보다 낮게 나오는 일이 실제로 있다(테크하우스).
   * 사람이 "이게 박이다"라고 느끼는 범위(120 BPM 언저리)를 옥타브 거리로 가중한다. */
  var PRIOR_CENTER = 120, PRIOR_SIGMA = 0.6;   // 옥타브 단위 표준편차
  /* 첫 박을 찾을 때 저역에 주는 무게. 감이 아니라 트랙 전부를 훑어 정했다.
   * 6곡일 때는 0.25 였다(테크노를 215ms → 1.6ms 로 고치면서 딥 하우스를 안 깨는 유일한 값).
   * 20곡으로 늘리자 소울풀·프로그레시브가 반 박씩 밀렸고, 0.6 이 그 둘을 고치면서
   * 나머지 열여덟을 그대로 두는 값이다. 2.0 부터는 하드 그루브가 넘어간다. */
  var PHASE_LOW_WEIGHT = 0.6;
  function tempoPrior(bpm) {
    var d = Math.log(bpm / PRIOR_CENTER) / Math.LN2 / PRIOR_SIGMA;
    return Math.exp(-0.5 * d * d);
  }

  function mono(buffer) {
    var n = buffer.length, out = new Float32Array(n), ch = buffer.numberOfChannels;
    for (var c = 0; c < ch; c++) {
      var d = buffer.getChannelData(c);
      for (var i = 0; i < n; i++) out[i] += d[i] / ch;
    }
    return out;
  }

  /* 상자 평균으로 데시메이션 — 평균 자체가 에일리어싱 방지 저역통과 역할을 한다. */
  function decimate(x, sr) {
    var factor = Math.max(1, Math.round(sr / TARGET_SR));
    if (factor === 1) return { x: x, sr: sr };
    var n = Math.floor(x.length / factor), out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var s = 0, base = i * factor;
      for (var k = 0; k < factor; k++) s += x[base + k];
      out[i] = s / factor;
    }
    return { x: out, sr: sr / factor };
  }

  /* 온셋 강도 곡선. 값이 클수록 "여기서 새 소리가 시작됐다". */
  function onsetEnvelope(x, sr) {
    var a = BAND_HZ.map(function (f) { return Math.exp(-2 * Math.PI * f / sr); });
    var lp = [0, 0, 0];
    var frames = Math.floor(x.length / HOP);
    var nb = BAND_HZ.length + 1;
    var energy = [];
    for (var b = 0; b < nb; b++) energy.push(new Float32Array(frames));
    var lowLin = new Float32Array(frames);

    for (var f = 0; f < frames; f++) {
      var acc = new Float64Array(nb);
      for (var i = f * HOP; i < (f + 1) * HOP; i++) {
        var v = x[i];
        for (var k = 0; k < 3; k++) lp[k] = (1 - a[k]) * v + a[k] * lp[k];
        var band = [lp[0], lp[1] - lp[0], lp[2] - lp[1], v - lp[2]];
        for (var b2 = 0; b2 < nb; b2++) acc[b2] += band[b2] * band[b2];
      }
      // log 압축 — 조용한 구간의 작은 타점도 큰 구간의 타점과 비슷한 무게를 갖게 한다
      for (var b3 = 0; b3 < nb; b3++) energy[b3][f] = Math.log(1 + 800 * Math.sqrt(acc[b3] / HOP));
      /* 위상용 저역은 압축하지 않는다. log 를 씌우면 킥(0.95)과 베이스(0.42)가
       * 비슷한 크기로 보여서, 엇박 베이스가 있는 곡에서 첫 박이 반 박 밀린다. */
      lowLin[f] = Math.sqrt(acc[0] / HOP);
    }

    var flux = new Float32Array(frames);
    var lowFlux = new Float32Array(frames);      // 저역만 — 박의 위치는 킥이 정한다
    for (var t = 1; t < frames; t++) {
      var s = 0;
      for (var b4 = 0; b4 < nb; b4++) {
        var d = energy[b4][t] - energy[b4][t - 1];
        if (d > 0) s += d;
      }
      flux[t] = s;
      var dl = lowLin[t] - lowLin[t - 1];
      lowFlux[t] = dl > 0 ? dl : 0;
    }

    // 이동 평균을 빼서 곡 전체의 음량 변화를 지운다 (드롭 전후를 같은 잣대로 보기 위해)
    function detrend(src) {
      var win = 40, out = new Float32Array(frames);
      for (var i = 0; i < frames; i++) {
        var lo = Math.max(0, i - win), hi = Math.min(frames, i + win + 1), sum = 0;
        for (var j = lo; j < hi; j++) sum += src[j];
        var v = src[i] - sum / (hi - lo);
        out[i] = v > 0 ? v : 0;
      }
      return out;
    }
    return { all: detrend(flux), low: detrend(lowFlux) };
  }

  function autocorr(env, lag) {
    if (lag < 0) return 0;
    var n = env.length - lag, s = 0;
    if (n <= 0) return 0;
    for (var i = 0; i < n; i++) s += env[i] * env[i + lag];
    return s / n;
  }

  /* 자기상관은 정수 프레임에서만 잴 수 있다(11.6ms 격자). 그 사이를 직선으로 이으면
   * 곡선의 봉우리가 정수 쪽으로 끌려가, 110 BPM 곡이 110.3 으로 잡히는 식의 치우침이 생긴다.
   * 세 점을 지나는 포물선으로 읽으면 그 치우침이 준다. */
  function acfAt(env, lag) {
    var i = Math.round(lag), f = lag - i;
    var y0 = autocorr(env, i - 1), y1 = autocorr(env, i), y2 = autocorr(env, i + 1);
    return y1 + f * (y2 - y0) / 2 + f * f * (y0 - 2 * y1 + y2) / 2;
  }

  function analyze(buffer) {
    var dec = decimate(mono(buffer), buffer.sampleRate);
    var envs = onsetEnvelope(dec.x, dec.sr);
    var env = envs.all;
    /* 위상(첫 박)을 찾을 때는 저역을 더 세게 본다. 박의 자리는 킥이 정하기 때문이다.
     * 두 곡선을 그냥 더하면 안 된다 — 전 대역 합이 저역 합의 30배라 가중치가 묻힌다.
     * 각각 평균 1 로 맞춘 뒤 섞는다. */
    function meanOf(a) {
      var t = 0;
      for (var i = 0; i < a.length; i++) t += a[i];
      return t / (a.length || 1) || 1;
    }
    var mAll = meanOf(env), mLow = meanOf(envs.low);
    var W = global.FirstMix.PHASE_LOW_WEIGHT;
    var phaseEnv = new Float32Array(env.length);
    for (var pe = 0; pe < env.length; pe++) {
      phaseEnv[pe] = env[pe] / mAll + W * envs.low[pe] / mLow;
    }
    var fps = dec.sr / HOP;
    if (env.length < fps * 4) return null;      // 4초도 안 되면 못 잰다

    // 후보 BPM 을 0.1 간격으로 훑는다. 배음(2·3·4배 주기)까지 더해야
    // 킥만 센 것과 한 마디를 센 것이 뒤섞이지 않는다.
    function salience(bpm) {
      var lag = fps * 60 / bpm, s = 0;
      for (var m = 1; m <= 4; m++) {
        if (lag * m >= env.length - 2) break;
        s += acfAt(env, lag * m) / m;
      }
      return s * tempoPrior(bpm);
    }

    var chosen = null, chosenScore = -Infinity;
    for (var bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 0.1) {
      var s = salience(bpm);
      if (s > chosenScore) { chosenScore = s; chosen = bpm; }
    }
    if (chosen === null) return null;

    // 첫 박: 그 주기로 빗질해서 온셋이 가장 많이 걸리는 위상을 찾는다
    var period = fps * 60 / chosen;
    var bestPhase = 0, bestSum = -1;
    var steps = Math.ceil(period);
    for (var p = 0; p < steps; p++) {
      var sum = 0;
      for (var t = p; t < phaseEnv.length; t += period) {
        var idx = Math.round(t);
        if (idx < phaseEnv.length) sum += phaseEnv[idx];
      }
      if (sum > bestSum) { bestSum = sum; bestPhase = p; }
    }

    // 프레임 해상도(11.6ms)는 귀에 걸린다. 이웃 두 점으로 포물선 보간해 더 좁힌다.
    function phaseSum(p) {
      var s = 0;
      for (var t = p; t < phaseEnv.length; t += period) {
        var i = Math.floor(t), fr = t - i;
        if (i + 1 < phaseEnv.length) s += phaseEnv[i] * (1 - fr) + phaseEnv[i + 1] * fr;
      }
      return s;
    }
    var y0 = phaseSum(Math.max(0, bestPhase - 1)), y1 = bestSum, y2 = phaseSum(bestPhase + 1);
    var denom = y0 - 2 * y1 + y2;
    var refined = bestPhase + (denom !== 0 ? 0.5 * (y0 - y2) / denom : 0);

    var mean = 0;
    for (var q = 0; q < env.length; q++) mean += env[q];
    mean /= env.length || 1;

    return {
      bpm: Math.round(chosen * 10) / 10,
      offset: Math.max(0, refined) / fps,
      // 온셋이 주기에 얼마나 잘 맞아떨어지는가. 낮으면 사용자가 손으로 고쳐야 한다는 뜻.
      confidence: mean > 0 ? Math.min(1, (bestSum / (env.length / period)) / (mean * 4)) : 0
    };
  }

  global.FirstMix = global.FirstMix || {};
  global.FirstMix.analyzeBpm = analyze;
  global.FirstMix.PHASE_LOW_WEIGHT = PHASE_LOW_WEIGHT;
  // 검증에서 자기상관 값을 직접 재보기 위한 통로
  global.FirstMix._bpmInternals = function (buffer) {
    var dec = decimate(mono(buffer), buffer.sampleRate);
    var e = onsetEnvelope(dec.x, dec.sr);
    return { env: e.all, low: e.low, fps: dec.sr / HOP, acfAt: acfAt };
  };
})(typeof window !== 'undefined' ? window : this);
