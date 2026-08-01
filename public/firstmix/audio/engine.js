/* 첫믹스 오디오 엔진 — Web Audio 2덱 믹서.
 *
 * 훈련 모드(절차 합성 루프)와 실전 모드(로컬 파일)가 같은 그래프를 쓴다.
 * 둘 다 결국 AudioBuffer 하나이므로 덱은 소스를 구분하지 않는다.
 *
 * 덱 그래프:  source → low → mid → high → gain(채널) → xfade(크로스페이더) → master
 *
 * 위치 추적은 AudioBufferSourceNode 가 알려주지 않으므로 직접 한다.
 * 속도(playbackRate)가 바뀌는 순간마다 앵커를 다시 잡는 방식:
 *   pos(t) = anchorPos + (t - anchorTime) * rate
 */
(function (global) {
  'use strict';

  var EQ_MIN_DB = -30;   // 완전히 죽이는 지점 (DJ 믹서의 킬)
  var EQ_MAX_DB = 8;
  var SMOOTH = 0.012;    // 게인 변화 시정수 — 클릭 방지

  // 필터를 다 열었을 때의 자리. 여기서는 소리에 아무 영향이 없어야 한다.
  var TRIM_DB = 12;            // 트림이 움직이는 범위 (±dB)
  var FILTER_OPEN_LP = 22000;
  var FILTER_OPEN_HP = 20;
  var FILTER_MIN_LP = 180;     // 왼쪽 끝: 저역만 남는다
  var FILTER_MAX_HP = 6000;    // 오른쪽 끝: 고역만 남는다

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* 0.85 아래는 그대로, 위는 tanh 로 눕혀 1.0 에 닿지 않게 한다.
   * 곡선 밖(±1 초과)의 입력은 웹오디오가 양 끝 값으로 잡아 주므로 절대 안 넘는다. */
  function softClipCurve() {
    var n = 2048, c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var a = Math.abs(x), y;
      if (a <= 0.85) y = a;
      else y = 0.85 + 0.15 * Math.tanh((a - 0.85) / 0.15);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  /* 아날라이저에서 피크를 읽는다. RMS 가 아니라 피크인 이유는
   * 게인 스테이징에서 봐야 하는 게 "찌그러지는가"이기 때문이다. */
  var _peakBuf = null;
  function peakOf(analyser) {
    if (!analyser) return 0;
    if (!_peakBuf || _peakBuf.length !== analyser.fftSize) _peakBuf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(_peakBuf);
    var p = 0;
    for (var i = 0; i < _peakBuf.length; i++) {
      var v = _peakBuf[i] < 0 ? -_peakBuf[i] : _peakBuf[i];
      if (v > p) p = v;
    }
    return p;
  }
  function mod(a, n) { return ((a % n) + n) % n; }

  function Deck(ctx, dest, id) {
    this.ctx = ctx;
    this.id = id;
    this.buffer = null;
    this.bpm = 0;          // 버퍼 원본 BPM
    this.beatOffset = 0;   // 첫 박이 오는 시각(초). 합성 트랙은 0 이지만 실제 곡은 인트로가 있다
    this.loop = true;
    this.playing = false;
    this.cue = 0;          // 큐 포인트 (버퍼 시간축, 초)
    this.hotCues = [null, null, null, null];   // 핫큐 — 곡을 갈면 지운다

    var low = ctx.createBiquadFilter();
    low.type = 'lowshelf'; low.frequency.value = 200;
    var mid = ctx.createBiquadFilter();
    mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.9;
    var high = ctx.createBiquadFilter();
    high.type = 'highshelf'; high.frequency.value = 3200;

    /* 필터 한 손잡이. 현대 컨트롤러에서 가장 많이 쓰는 컨트롤이다.
     * 가운데가 통과, 왼쪽으로 돌리면 저역만 남고(lowpass 가 내려옴),
     * 오른쪽으로 돌리면 고역만 남는다(highpass 가 올라감). 필터 둘을 직렬로 두고
     * 쓰지 않는 쪽을 양 끝으로 밀어 두면 한 손잡이로 양방향이 된다. */
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = FILTER_OPEN_LP; lp.Q.value = 1;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = FILTER_OPEN_HP; hp.Q.value = 1;

    this.low = low; this.mid = mid; this.high = high;
    this.lp = lp; this.hp = hp;
    this.gain = ctx.createGain();
    this.xfade = ctx.createGain();

    /* 트림(게인). 실제 믹서에서 EQ 앞에 있는 그 손잡이다.
     * 곡마다 녹음 레벨이 달라서 이게 없으면 채널 페이더가 볼륨과 레벨 맞추기를 겸하게 된다. */
    this.trim = ctx.createGain();
    this.trim.connect(low);

    /* 채널 레벨 미터. 실제 믹서와 같이 페이더 "앞"에서 뽑는다 —
     * 페이더를 내려 둔 채로도 그 채널이 얼마나 센지 봐야 트림을 맞출 수 있다. */
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 1024;
    hp.connect(this.meter);

    /* 소스가 꽂히는 자리. 키락을 켜면 여기에 워크릿이 끼어든다. */
    this.input = this.trim;
    this._keylock = null;

    /* 헤드폰 미리듣기(PFL) 갈래. 실제 DJ 믹서와 같이 채널 페이더 "앞"에서 뽑는다 —
     * 페이더를 내려 관객에게 안 들리는 상태에서 나만 들어야 의미가 있기 때문이다.
     * 필터·EQ 는 지난 뒤에서 뽑는다. 헤드폰에서 들리는 소리가 나갈 소리와 같아야 하기 때문. */
    this.cueSend = ctx.createGain();
    this.cueSend.gain.value = 0;
    hp.connect(this.cueSend);

    /* 에코. 실제 컨트롤러의 FX 자리에 가장 흔히 앉아 있는 것이고,
     * 초보가 첫날 쓸 수 있는 유일한 이펙트이기도 하다(넘기다 막혔을 때 시간을 번다).
     * 반드시 박에 맞아야 한다 — 박과 무관한 지연은 그냥 소음이다. 8분음표로 잡는다.
     * EQ·필터 뒤에서 뽑아 채널 게인으로 되돌린다. 페이더를 내리면 꼬리도 같이 준다. */
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0;
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = 0.25;   // 곡이 올라오기 전 기본값 (120BPM 의 8분음표)
    this.echoFb = ctx.createGain();
    this.echoFb.gain.value = 0.42;      // 이보다 크면 안 끝나고 쌓인다
    hp.connect(this.echoSend);
    this.echoSend.connect(this.echo);
    this.echo.connect(this.echoFb);
    this.echoFb.connect(this.echo);
    this.echo.connect(this.gain);
    this._echo = 0;

    low.connect(mid).connect(high).connect(lp).connect(hp)
       .connect(this.gain).connect(this.xfade).connect(dest);

    this.src = null;
    this._tempo = 1;       // 템포 페이더 (지속)
    this._nudge = 1;       // 넛지 (순간, 누르고 있는 동안만)
    this._rate = 1;
    this._range = 8;       // 템포 페이더가 움직이는 범위(±%)
    this._anchorPos = 0;
    this._anchorTime = 0;

    this.loopActive = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.loopBeats = 0;
  }

  Deck.prototype.load = function (buffer, bpm, beatOffset) {
    var wasPlaying = this.playing;
    this.pause();
    this.buffer = buffer;
    this.bpm = bpm || 0;
    this.beatOffset = beatOffset || 0;
    this._anchorPos = 0;
    this.cue = 0;
    this.hotCues = [null, null, null, null];
    this._syncEcho();             // 곡이 바뀌면 BPM 이 바뀌고 에코 간격도 바뀐다
    this.loopActive = false;      // 앞 곡의 루프 구간이 새 곡에 남아 있으면 안 된다
    this.loopBeats = 0;
    if (wasPlaying) this.play();
  };

  Object.defineProperty(Deck.prototype, 'position', {
    get: function () {
      if (!this.buffer) return 0;
      var p = this._anchorPos;
      if (this.playing) p += (this.ctx.currentTime - this._anchorTime) * this._rate;
      // 루프가 걸려 있으면 소스도 그 구간을 돌므로 위치 계산도 같이 접어야 한다
      if (this.loopActive && p >= this.loopStart) {
        return this.loopStart + mod(p - this.loopStart, this.loopEnd - this.loopStart);
      }
      return this.loop ? mod(p, this.buffer.duration) : clamp(p, 0, this.buffer.duration);
    }
  });

  /* 실제로 들리는 BPM. 넛지는 순간값이라 제외한다. */
  Object.defineProperty(Deck.prototype, 'effectiveBpm', {
    get: function () { return this.bpm * this._tempo; }
  });

  /* 지금 이 순간의 재생 배속 (템포 × 넛지). */
  Object.defineProperty(Deck.prototype, 'rate', {
    get: function () { return this._rate; }
  });

  /* 임의 지점의 비트 안 위상 0..1. 버퍼 원본 시간축에서 재므로 템포와 무관하게 음악적으로 맞다.
   * 지연 보정처럼 "조금 전 위상"이 필요한 곳이 있어 위치를 인자로 받는다. */
  Deck.prototype.phaseAt = function (pos) {
    if (!this.bpm) return 0;
    return mod((pos - this.beatOffset) / (60 / this.bpm), 1);
  };

  Object.defineProperty(Deck.prototype, 'beatPhase', {
    get: function () { return this.phaseAt(this.position); }
  });

  Object.defineProperty(Deck.prototype, 'beat', {
    get: function () {
      if (!this.bpm) return 0;
      return Math.floor((this.position - this.beatOffset) / (60 / this.bpm));
    }
  });

  Deck.prototype._reanchor = function () {
    var now = this.ctx.currentTime;
    if (this.playing) {
      this._anchorPos = this.position;   // 반드시 옛 rate 로 계산한 뒤에
      this._anchorTime = now;
    }
    this._rate = this._tempo * this._nudge;
    if (this.src) this.src.playbackRate.setValueAtTime(this._rate, now);
    // 키락은 재생 속도만큼 음정을 도로 내린다. 속도가 바뀌면 같이 따라가야 한다.
    if (this._keylock) this._keylock.parameters.get('ratio').setValueAtTime(this._rate, now);
    this._syncEcho();
  };

  /* 템포 페이더. pct 는 ±8 같은 퍼센트. */
  Deck.prototype.setTempoPercent = function (pct) {
    this._tempo = 1 + clamp(pct, -this._range, this._range) / 100;
    this._reanchor();
  };

  Deck.prototype.getTempoPercent = function () {
    return (this._tempo - 1) * 100;
  };

  /* 페이더가 움직이는 범위. 실제 기기의 ±6/10/16/WIDE 에 해당한다.
   * 100BPM 곡과 128BPM 곡을 맞추려면 +28% 가 필요해서 ±8 로는 아예 안 된다.
   * 범위를 넓히면 페이더 한 칸이 커져 미세 조정이 어려워지는 게 대가다. */
  Deck.prototype.setTempoRange = function (pct) {
    this._range = clamp(pct, 1, 50);
    var cur = this.getTempoPercent();
    if (Math.abs(cur) > this._range) this.setTempoPercent(cur > 0 ? this._range : -this._range);
    return this._range;
  };

  Deck.prototype.getTempoRange = function () { return this._range; };

  /* 필터 한 손잡이. 0 = 저역만, 0.5 = 통과, 1 = 고역만. */
  Deck.prototype.setFilter = function (v) {
    v = clamp(v, 0, 1);
    this._filter = v;
    var t = this.ctx.currentTime;
    var lpF = FILTER_OPEN_LP, hpF = FILTER_OPEN_HP;
    if (v < 0.5) {
      lpF = FILTER_MIN_LP * Math.pow(FILTER_OPEN_LP / FILTER_MIN_LP, v / 0.5);
    } else if (v > 0.5) {
      hpF = FILTER_OPEN_HP * Math.pow(FILTER_MAX_HP / FILTER_OPEN_HP, (v - 0.5) / 0.5);
    }
    this.lp.frequency.setTargetAtTime(lpF, t, SMOOTH);
    this.hp.frequency.setTargetAtTime(hpF, t, SMOOTH);
  };

  Deck.prototype.getFilter = function () {
    return this._filter === undefined ? 0.5 : this._filter;
  };

  /* 몇 박짜리 루프를 지금 자리에 건다. 0 이면 푼다.
   * 실제 곡은 인트로가 지나가 버려서, 맞출 시간을 벌 방법이 없으면 초보는 계속 실패한다. */
  Deck.prototype.setLoop = function (beats) {
    if (!beats || !this.buffer || !this.bpm) return this.clearLoop();
    var spb = 60 / this.bpm;
    var pos = this.position;
    // 지금 위치가 속한 박의 머리부터 — 박 중간에서 시작하면 루프가 어긋나 들린다
    var start = this.beatOffset + Math.floor((pos - this.beatOffset) / spb) * spb;
    var end = start + beats * spb;
    if (start < 0 || end > this.buffer.duration) return false;
    this.loopStart = start;
    this.loopEnd = end;
    this.loopBeats = beats;
    this.loopActive = true;
    if (this.src) { this.src.loopStart = start; this.src.loopEnd = end; }
    return true;
  };

  Deck.prototype.clearLoop = function () {
    if (!this.loopActive) return false;
    // 위치를 지금 들리는 자리로 고정해 두고 풀어야 소리가 튀지 않는다
    var p = this.position;
    this.loopActive = false;
    this.loopBeats = 0;
    this._anchorPos = p;
    this._anchorTime = this.ctx.currentTime;
    if (this.src) {
      this.src.loopStart = 0;
      this.src.loopEnd = this.buffer ? this.buffer.duration : 0;
    }
    return true;
  };

  /* 플래터를 손으로 미는 것 = 순간 속도 변화. amount>0 이면 앞으로 당김. */
  Deck.prototype.setNudge = function (amount) {
    this._nudge = 1 + clamp(amount, -0.5, 0.5);
    this._reanchor();
  };

  Deck.prototype.play = function () {
    if (this.playing || !this.buffer) return;
    var src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this.loop;
    src.loopStart = this.loopActive ? this.loopStart : 0;
    src.loopEnd = this.loopActive ? this.loopEnd : this.buffer.duration;
    src.playbackRate.value = this._rate;
    src.connect(this.input);
    var now = this.ctx.currentTime;
    src.start(now, mod(this._anchorPos, this.buffer.duration));
    this.src = src;
    this.playing = true;
    this._anchorTime = now;
  };

  Deck.prototype.pause = function () {
    if (!this.playing) return;
    this._anchorPos = this.position;
    try { this.src.stop(); } catch (e) { /* 이미 끝난 소스 */ }
    this.src.disconnect();
    this.src = null;
    this.playing = false;
  };

  Deck.prototype.toggle = function () {
    if (this.playing) this.pause(); else this.play();
  };

  Deck.prototype.seek = function (sec) {
    var was = this.playing;
    this.pause();
    this._anchorPos = this.buffer ? mod(sec, this.buffer.duration) : 0;
    if (was) this.play();
  };

  /* 에코 세기. 0 이면 꺼진 것과 같고, 올리면 꼬리가 붙는다.
   * 되돌아오는 양(피드백)도 같이 살짝 키워야 "깊어지는" 느낌이 난다. */
  Deck.prototype.setEcho = function (v) {
    v = clamp(v, 0, 1);
    this._echo = v;
    var t = this.ctx.currentTime;
    this.echoSend.gain.setTargetAtTime(v * 0.8, t, SMOOTH);
    this.echoFb.gain.setTargetAtTime(0.25 + v * 0.3, t, SMOOTH);
  };
  Deck.prototype.getEcho = function () { return this._echo; };

  /* 지연 시간은 들리는 빠르기를 따라간다. 템포를 당기면 에코도 같이 당겨져야
   * 박에 붙어 있다. 8분음표(반 박). */
  Deck.prototype._syncEcho = function () {
    if (!this.bpm) return;
    var eighth = 30 / (this.bpm * this._rate);
    this.echo.delayTime.setTargetAtTime(Math.min(1.9, eighth), this.ctx.currentTime, 0.05);
  };

  Deck.prototype.setCue = function () { this.cue = this.position; };
  Deck.prototype.jumpToCue = function () { this.seek(this.cue); };

  /* 핫큐. 빈 자리를 누르면 찍고, 찍힌 자리를 누르면 그리로 뛴다. */
  Deck.prototype.setHotCue = function (i) {
    if (!this.buffer) return false;
    this.hotCues[i] = this.position;
    return true;
  };
  Deck.prototype.jumpHotCue = function (i) {
    if (this.hotCues[i] == null) return false;
    this.seek(this.hotCues[i]);
    return true;
  };
  Deck.prototype.clearHotCue = function (i) { this.hotCues[i] = null; };
  /* 누른 자리가 비었으면 찍고, 차 있으면 뛴다 — 실제 기기와 같은 한 버튼 동작 */
  Deck.prototype.hotCue = function (i) {
    return this.hotCues[i] == null ? (this.setHotCue(i), 'set') : (this.jumpHotCue(i), 'jump');
  };

  /* 키락(마스터 템포). 소스와 트림 사이에 워크릿을 끼웠다 뺐다 한다.
   * 재생 중에 갈면 한 번 딱 소리가 난다 — 그래서 설정 화면에서만 만지게 뒀다. */
  Deck.prototype.setKeylock = function (node) {
    var wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    if (this._keylock) { try { this._keylock.disconnect(); } catch (e) {} }
    this._keylock = node || null;
    if (node) {
      node.parameters.get('ratio').value = this._rate;
      node.connect(this.trim);
      this.input = node;
    } else {
      this.input = this.trim;
    }
    if (wasPlaying) this.play();
  };
  Deck.prototype.hasKeylock = function () { return !!this._keylock; };

  /* 트림. v 0..1, 가운데(0.5)가 원래 크기. 양 끝이 ±12dB. */
  Deck.prototype.setTrim = function (v) {
    v = clamp(v, 0, 1);
    this._trim = v;
    var db = (v - 0.5) * 2 * TRIM_DB;
    this.trim.gain.setTargetAtTime(Math.pow(10, db / 20), this.ctx.currentTime, SMOOTH);
  };
  Deck.prototype.getTrim = function () { return this._trim == null ? 0.5 : this._trim; };

  /* 지금 이 채널이 얼마나 센가 (0..1 피크). 미터가 이 값을 그린다. */
  Deck.prototype.level = function () { return peakOf(this.meter); };

  /* band: 'low'|'mid'|'high', v: 0..1 (0.5 = 중립) */
  Deck.prototype.setEq = function (band, v) {
    var db = v <= 0.5
      ? EQ_MIN_DB * (1 - v / 0.5)
      : EQ_MAX_DB * ((v - 0.5) / 0.5);
    this[band].gain.setTargetAtTime(db, this.ctx.currentTime, SMOOTH);
  };

  /* 채널 페이더 0..1 */
  Deck.prototype.setVolume = function (v) {
    this.gain.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, SMOOTH);
  };

  /* ctx 를 넘기면 그걸 쓴다 — 검증에서 OfflineAudioContext 로 실제 출력을 재기 위해. */
  function Mixer(ctx) {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    this.ctx = ctx;

    // 두 덱을 동시에 틀면 쉽게 클리핑되므로 마스터에 안전장치 하나.
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;

    this.master = ctx.createGain();
    limiter.connect(this.master);

    /* 마스터 미터는 리미터 "뒤"에서 뽑는다. 실제로 나가는 소리를 봐야 하기 때문이다.
     * 채널 미터(리미터 앞)와 같이 보면 리미터가 얼마나 일하고 있는지가 드러난다. */
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 1024;
    this.master.connect(this.meter);

    /* 마지막 안전장치. 컴프레서는 3ms 어택이라 킥의 첫 순간을 다 못 잡는다 —
     * 트림을 양쪽 다 끝까지 올리면 마스터가 1.03 까지 올라간다(실측). 디지털에서 1.0 을 넘으면
     * 그대로 찌그러지고, 녹음이라면 영구히 남는다.
     * 0.85 까지는 손대지 않고 그 위만 둥글려 1.0 을 절대 안 넘게 한다.
     *
     * ★ 미터는 이 앞(master)에서 뽑는다. 사용자에게는 "지금 너무 세다"가 그대로 보여야 하고,
     *   출력만 조용히 지켜 주는 게 맞다. 미터까지 눌러 버리면 트림을 배울 수가 없다. */
    this._safety = ctx.createWaveShaper();
    this._safety.curve = softClipCurve();
    // 오버샘플은 끈다. 켜면 되돌리는 필터가 살짝 넘쳐(실측 1.0045) 안전장치의 뜻이 없어진다.
    this._safety.oversample = 'none';

    this.a = new Deck(ctx, limiter, 'A');
    this.b = new Deck(ctx, limiter, 'B');

    /* 스플릿 출력 — 폰·태블릿의 유일한 스테레오 출력을 둘로 쪼갠다.
     *   왼쪽 채널 = 관객이 듣는 마스터, 오른쪽 채널 = 나만 듣는 미리듣기
     * 3.5mm 분배 케이블(TRS → TS 둘)을 끼면 실제로 따로 들린다. 대가는 마스터가 모노가 되는 것.
     * 이걸 안 하면 "다음 곡을 나만 미리 듣기"가 폰에서 아예 불가능하다. */
    this.cueBus = ctx.createGain();
    this.cueBus.gain.value = 1;
    this.a.cueSend.connect(this.cueBus);
    this.b.cueSend.connect(this.cueBus);

    function toMono(node) {
      node.channelCount = 1;
      node.channelCountMode = 'explicit';
      node.channelInterpretation = 'speakers';
      return node;
    }
    this._masterMono = toMono(ctx.createGain());
    this._cueMono = toMono(ctx.createGain());
    this._merger = ctx.createChannelMerger(2);
    this._masterMono.connect(this._merger, 0, 0);   // 왼쪽 = 마스터
    this._cueMono.connect(this._merger, 0, 1);      // 오른쪽 = 미리듣기
    this.cueBus.connect(this._cueMono);

    /* 큐 믹스 — 헤드폰에 마스터를 얼마나 섞을지.
     * 이게 없으면 헤드폰에 다음 곡만 들려서 "무엇에" 맞추는지가 없다.
     * 실제 믹서에 CUE/MASTER 손잡이가 반드시 달려 있는 이유다. */
    this._cueBlend = ctx.createGain();
    this.master.connect(this._cueBlend);
    this._cueBlend.connect(this._cueMono);

    /* 출력 스위치를 마스터가 아니라 별도 노드로 둔다.
     * disconnect() 를 인자 없이 부르면 그 노드에서 나가는 선을 전부 끊는다 —
     * master 에서 직접 끊으면 헤드폰으로 가는 큐 믹스 선까지 같이 날아간다. */
    this._masterOut = ctx.createGain();
    this.master.connect(this._safety);
    this._safety.connect(this._masterOut);

    this.split = false;
    this.setSplitOutput(false);
    this.setCueMix(0.5);
    this.setCrossfade(0.5);
  }

  /* 0 = 다음 곡만, 1 = 나가는 소리만. 0.5 가 반반. */
  Mixer.prototype.setCueMix = function (v) {
    this._cueMix = clamp(v, 0, 1);
    this._applyCueMix();
  };

  /* 스플릿이 꺼져 있으면 큐 갈래가 출력에서 끊겨 있고, 끊긴 노드는 자동화가 진행되지 않는다.
   * 그때는 값을 직접 박아 둬야 나중에 켰을 때 설정한 대로 들린다. */
  Mixer.prototype._applyCueMix = function () {
    var v = this.getCueMix(), t = this.ctx.currentTime;
    var cue = this.cueBus.gain, blend = this._cueBlend.gain;
    if (this.split) {
      cue.setTargetAtTime(1 - v, t, SMOOTH);
      blend.setTargetAtTime(v, t, SMOOTH);
    } else {
      cue.cancelScheduledValues(t); cue.value = 1 - v;
      blend.cancelScheduledValues(t); blend.value = v;
    }
  };

  Mixer.prototype.getCueMix = function () {
    return this._cueMix === undefined ? 0.5 : this._cueMix;
  };

  /* 스플릿을 끄면 미리듣기 갈래를 완전히 끊는다.
   * 살려 두면 큐가 오른쪽 스피커로 새어 나가 관객에게 들린다. */
  Mixer.prototype.level = function () { return peakOf(this.meter); };

  /* 키락은 반드시 두 덱을 같이 켠다. 한쪽만 켜면 워크릿 지연(약 W/2 샘플)만큼
   * 그 덱만 늦어져서, 맞춰 놓은 박이 통째로 어긋난다. */
  var KEYLOCK_URL = 'audio/keylock-worklet.js';
  Mixer.prototype.setKeylock = function (on) {
    var self = this;
    if (!on) {
      this.a.setKeylock(null);
      this.b.setKeylock(null);
      this.keylock = false;
      return Promise.resolve(false);
    }
    if (!this.ctx.audioWorklet) return Promise.resolve(false);
    var ready = this._klReady || (this._klReady = this.ctx.audioWorklet.addModule(KEYLOCK_URL));
    return ready.then(function () {
      self.a.setKeylock(new AudioWorkletNode(self.ctx, 'firstmix-keylock', { outputChannelCount: [2] }));
      self.b.setKeylock(new AudioWorkletNode(self.ctx, 'firstmix-keylock', { outputChannelCount: [2] }));
      self.keylock = true;
      return true;
    }).catch(function () { self.keylock = false; return false; });
  };

  /* ── 세트 녹음 ─────────────────────────────────────────
   * 마스터를 한 갈래 더 뽑아 MediaRecorder 로 받는다. 나가는 소리 그대로다.
   * 앱 미리보기 영상을 만들면서 이 방법이 실제로 되는 걸 확인했고, 여기서 다시 쓴다. */
  Mixer.prototype.canRecord = function () {
    return typeof MediaRecorder !== 'undefined' && !!this.ctx.createMediaStreamDestination;
  };
  Mixer.prototype.startRecording = function () {
    if (this._rec || !this.canRecord()) return false;
    var dest = this.ctx.createMediaStreamDestination();
    this._masterOut.connect(dest);
    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    var mime = '';
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; }
    }
    var rec = mime ? new MediaRecorder(dest.stream, { mimeType: mime }) : new MediaRecorder(dest.stream);
    var parts = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
    rec.start();
    this._rec = { rec: rec, parts: parts, dest: dest, startedAt: this.ctx.currentTime, mime: rec.mimeType };
    return true;
  };
  Mixer.prototype.recordingSeconds = function () {
    return this._rec ? this.ctx.currentTime - this._rec.startedAt : 0;
  };
  Mixer.prototype.isRecording = function () { return !!this._rec; };
  Mixer.prototype.stopRecording = function () {
    var r = this._rec;
    if (!r) return Promise.resolve(null);
    this._rec = null;
    var self = this;
    return new Promise(function (res) {
      r.rec.onstop = function () {
        try { self._masterOut.disconnect(r.dest); } catch (e) {}
        res({ blob: new Blob(r.parts, { type: r.mime }), seconds: self.ctx.currentTime - r.startedAt, mime: r.mime });
      };
      r.rec.stop();
    });
  };

  Mixer.prototype.setSplitOutput = function (on) {
    var ctx = this.ctx;
    if (!on) {
      /* 반드시 끊기 "전에" 내린다. 출력까지 이어지지 않는 노드는 렌더 그래프에서 빠지고,
       * 빠진 노드의 AudioParam 자동화는 진행되지 않아 값이 마지막 상태로 굳는다.
       * 그대로 두면 스플릿을 다시 켰을 때 예전에 켜둔 큐가 되살아난다. */
      [this.a, this.b].forEach(function (d) {
        d.cueSend.gain.cancelScheduledValues(ctx.currentTime);
        d.cueSend.gain.value = 0;
        d.cueOn = false;
      });
    }
    try { this._masterOut.disconnect(); } catch (e) {}
    try { this._merger.disconnect(); } catch (e) {}
    if (on) {
      this._masterOut.connect(this._masterMono);
      this._merger.connect(ctx.destination);
    } else {
      this._masterOut.connect(ctx.destination);
    }
    this.split = on;
    if (this._cueBlend) this._applyCueMix();   // 살아난 뒤 다시 걸어 준다
  };

  /* 덱 하나를 헤드폰으로 보낼지. 스플릿이 꺼져 있으면 아무 일도 하지 않는다. */
  Mixer.prototype.setCue = function (deckId, on) {
    if (!this.split) return false;
    var deck = deckId === 'A' ? this.a : this.b;
    deck.cueSend.gain.cancelScheduledValues(this.ctx.currentTime);
    deck.cueSend.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, SMOOTH);
    deck.cueOn = !!on;
    return true;
  };

  /* 0 = A만, 1 = B만. 정출력(constant power) 곡선 — 중앙에서 음량이 꺼지지 않는다. */
  Mixer.prototype.setCrossfade = function (x) {
    x = clamp(x, 0, 1);
    this._x = x;
    var t = this.ctx.currentTime;
    this.a.xfade.gain.setTargetAtTime(Math.cos(x * Math.PI / 2), t, SMOOTH);
    this.b.xfade.gain.setTargetAtTime(Math.sin(x * Math.PI / 2), t, SMOOTH);
  };

  Mixer.prototype.getCrossfade = function () { return this._x; };

  Mixer.prototype.setMaster = function (v) {
    this.master.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, SMOOTH);
  };

  /* iOS·모바일 크롬은 사용자 제스처 안에서만 컨텍스트가 살아난다. */
  Mixer.prototype.resume = function () {
    return this.ctx.state === 'running' ? Promise.resolve() : this.ctx.resume();
  };

  /* 출력 지연(초). 블루투스면 크게 나오고, 그때는 큐잉·넛지 감각이 무너진다. */
  Mixer.prototype.latency = function () {
    /* 키락을 켜면 워크릿이 한 바퀴의 절반(1024샘플)만큼 늦게 내보낸다.
     * 레슨은 "사람이 들은 시점"으로 판정하므로 이걸 빼먹으면 채점이 그만큼 틀어진다. */
    var kl = this.keylock ? 1024 / this.ctx.sampleRate : 0;
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0) + kl;
  };

  global.FirstMix = global.FirstMix || {};
  global.FirstMix.Deck = Deck;
  global.FirstMix.Mixer = Mixer;
})(typeof window !== 'undefined' ? window : this);
