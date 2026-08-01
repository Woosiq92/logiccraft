/* 첫믹스 트랙 — 음원 파일 없이 코드로 합성한 루프.
 *
 * 왜 합성인가:
 *   1) 라이선스가 걸리지 않는다 (상용 음원도, CC 표기도 필요 없다)
 *   2) BPM 정답을 우리가 안다 — 비트매칭 판정이 추정치에 흔들리지 않는다
 *   3) 앱 용량이 수 KB 다
 *
 * 패턴 표기: 한 마디 = 16스텝(16분음표).
 *   드럼  '1' 침 / '2' 오픈하이햇 / '.' 쉼
 *   음정  16칸 배열, 근음에서의 반음 오프셋 또는 null
 *   문자열/배열 하나면 모든 마디 반복, 4개 주면 마디마다 다르게.
 */
(function (global) {
  'use strict';

  var L = global.FirstMix.L;

  var TRACKS = [
    {
      id: 'deep122', name: L('딥 하우스', 'Deep House'), bpm: 122, root: 45, // A2
      color: '#7c3aed',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: ['..1...1...1...1.', '..1...1...1...1.', '..1...1...1...1.', '..1...1...1.1.2.'],
      bass: [null, null, 0, null, null, null, 0, null, null, null, -2, null, null, null, 0, null],
      stab: [null, null, null, null, null, null, [0, 3, 7], null, null, null, null, null, null, null, null, null]
    },
    {
      id: 'tech126', name: L('테크 하우스', 'Tech House'), bpm: 126, root: 43, // G2
      color: '#06b6d4',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.2.1...1.2.1.',
      bass: [0, null, null, 0, null, null, 0, null, 0, null, null, 0, null, 5, null, null],
      stab: [null, null, null, null, null, null, null, null, null, null, [0, 7, 12], null, null, null, null, null]
    },
    {
      id: 'house128', name: L('하우스', 'House'), bpm: 128, root: 48, // C3
      color: '#f59e0b',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1...1...1...1.',
      bass: [0, null, null, null, -5, null, null, null, -3, null, null, null, -5, null, null, null],
      stab: [null, null, null, null, [0, 4, 7], null, null, null, null, null, null, null, [-3, 0, 4], null, null, null]
    },
    {
      id: 'disco118', name: L('디스코', 'Disco'), bpm: 118, root: 41, // F2
      color: '#ec4899',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: ['..1.2.1...1.2.1.', '..1.2.1...1.2.1.', '..1.2.1...1.2.1.', '..1.2.1.1.1.2.2.'],
      bass: [0, null, 12, null, 0, null, 7, null, 0, null, 12, null, 10, null, 7, null],
      stab: [null, null, null, null, null, null, null, null, [0, 4, 9], null, null, null, null, null, null, null]
    },
    {
      /* 테크노. 킥은 하우스와 같은 매 박이지만 위에 얹히는 게 거의 없다.
       * 박은 잡기 쉬운데 어디가 마디의 머리인지 찾기 어려운 장르라, 그 차이를 들려주려고 넣었다. */
      id: 'techno138', name: L('테크노', 'Techno'), bpm: 138, root: 38, // D2
      color: '#a3e635',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.1.1...1.1.1.',
      bass: [null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, -5, null],
      stab: [null, null, null, null, null, null, null, null, null, null, null, null, [0, 7], null, null, null]
    },
    {
      /* UK 개러지. 킥이 매 박에 없다(2스텝). 하우스만 듣던 귀에는 박이 안 잡히는 게 정상이고,
       * 그게 이 장르를 넣은 이유다. swing 으로 16분음표를 밀어 특유의 흐느적거림을 만든다. */
      id: 'garage132', name: L('UK 개러지', 'UK Garage'), bpm: 132, root: 45, // A2
      color: '#14b8a6', swing: 0.3,
      kick: '1.........1.....',
      clap: '....1.......1...',
      hat: '..1.1.1.1.1.1.1.',
      bass: [0, null, null, null, null, null, null, null, null, null, 0, null, null, null, -5, null],
      stab: [null, null, null, null, null, null, [0, 3, 7], null, null, null, null, null, null, null, [0, 3, 7], null]
    },

    /* ── 여기부터 2026-08-01 추가 ──────────────────────────
     * 여섯 곡으로는 오늘의 도전 조합이 15쌍뿐이라 2주면 다 본다. 합성이 11ms·수 KB 라
     * 곡을 늘리는 값이 거의 0 이다. 스무 곡이면 190쌍이 되고, 배우기 3편(장르마다 박이
     * 다르게 잡힌다)도 그제야 여섯 개가 아니라 스무 개로 이야기할 수 있다.
     *
     * 고를 때 기준은 하나. 킥이 어디 놓이고 그 위에 무엇이 얹히는지가 서로 달라야 한다.
     * 같은 4/4 라도 박을 알리는 소리가 정박에 있는지 엇박에 있는지가 훈련 난이도를 가른다. */
    {
      id: 'lofi110', name: L('로파이 하우스', 'Lo-fi House'), bpm: 110, root: 40, // E2
      color: '#f97316',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.......1.....',
      bass: [0, null, null, null, null, null, -5, null, 0, null, null, null, null, null, 3, null],
      stab: [null, null, null, null, [0, 3, 7, 10], null, null, null, null, null, null, null, null, null, null, null]
    },
    {
      /* 아마피아노. 킥은 매 박인데 저음(로그드럼)이 전부 엇박이라,
       * 킥을 놓치면 베이스를 박으로 착각하기 쉽다. */
      id: 'amapiano112', name: L('아마피아노', 'Amapiano'), bpm: 112, root: 38, // D2
      color: '#eab308',
      kick: '1...1...1...1...',
      clap: '............1...',
      hat: '1.1.1.1.1.1.1.1.',
      bass: [null, null, 0, null, null, null, -2, null, null, null, 0, null, null, null, 3, null],
      stab: [null, null, null, null, null, null, null, null, [0, 5, 7], null, null, null, null, null, null, null]
    },
    {
      id: 'nudisco115', name: L('누 디스코', 'Nu Disco'), bpm: 115, root: 41, // F2
      color: '#f43f5e',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.2.1...1.2.1.',
      bass: [0, null, 0, 7, null, 0, null, 10, 0, null, 0, 7, null, 12, null, 10],
      stab: [null, null, null, null, null, null, [0, 4, 7], null, null, null, null, null, null, null, null, null]
    },
    {
      id: 'italo119', name: L('이탈로 디스코', 'Italo Disco'), bpm: 119, root: 43, // G2
      color: '#d946ef',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1...1...1...1.',
      bass: [0, null, 12, null, 0, null, 12, null, -5, null, 7, null, -5, null, 7, null],
      stab: [null, null, null, null, null, null, null, null, [0, 4, 7], null, null, null, null, null, null, null]
    },
    {
      /* 아프로 하우스. 킥은 매 박이지만 퍼커션이 엇박에 흩어져 있어
       * 마디의 머리를 퍼커션으로 잡으려 하면 어긋난다. */
      id: 'afro120', name: L('아프로 하우스', 'Afro House'), bpm: 120, root: 45, // A2
      color: '#84cc16',
      kick: '1...1...1...1...',
      clap: '..1....1..1...1.',
      hat: '..1.1.1.1.1.1.1.',
      bass: [0, null, null, 3, null, null, 0, null, null, 3, null, null, 0, null, null, null],
      stab: [null, null, null, null, null, null, null, null, null, null, [0, 3, 7], null, null, null, null, null]
    },
    {
      id: 'melodic123', name: L('멜로딕 하우스', 'Melodic House'), bpm: 123, root: 40, // E2
      color: '#38bdf8',
      kick: '1...1...1...1...',
      clap: '............1...',
      hat: '..1...1...1...1.',
      bass: [0, null, null, null, null, null, null, null, -4, null, null, null, null, null, null, null],
      stab: [[0, 3, 7, 10], null, null, null, null, null, null, null, [-4, 0, 3, 7], null, null, null, null, null, null, null]
    },
    {
      id: 'soulful124', name: L('소울풀 하우스', 'Soulful House'), bpm: 124, root: 44, // G#2
      color: '#fb7185',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.2.1...1.2.1.',
      bass: [0, null, null, 0, null, null, -5, null, 0, null, null, 0, null, null, 3, null],
      stab: [null, null, [0, 4, 7, 11], null, null, null, [0, 4, 7, 11], null, null, null, [-2, 2, 5, 9], null, null, null, null, null]
    },
    {
      id: 'progressive125', name: L('프로그레시브 하우스', 'Progressive House'), bpm: 125, root: 41, // F2
      color: '#818cf8',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1...1...1...1.',
      bass: [null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, -5, null],
      stab: [null, null, null, null, null, null, null, null, [0, 7, 12], null, null, null, null, null, null, null]
    },
    {
      /* 미니멀. 얹히는 게 거의 없어서 킥 말고는 붙잡을 게 없다.
       * 테크노와 같은 이유로 넣었지만 템포대가 다르다. */
      id: 'minimal127', name: L('미니멀', 'Minimal'), bpm: 127, root: 36, // C2
      color: '#94a3b8',
      kick: '1...1...1...1...',
      clap: '............1...',
      hat: '..1.......1.....',
      bass: [0, null, null, null, null, null, null, null, null, null, 0, null, null, null, null, null],
      stab: [null, null, null, null, null, null, null, null, null, null, null, null, [0, 7], null, null, null]
    },
    {
      id: 'funkhouse129', name: L('펑크 하우스', 'Funky House'), bpm: 129, root: 43, // G2
      color: '#fbbf24',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.2.1.1.1.2.1.',
      bass: [0, null, 0, null, 7, null, null, 0, null, 0, null, null, 10, null, 7, null],
      stab: [[0, 4, 7], null, null, null, null, null, [0, 4, 7], null, null, null, null, null, [-3, 0, 4], null, null, null]
    },
    {
      /* 브레이크비트. 킥이 매 박에 없고 1박·2박반·3박반에 있다.
       * 스네어가 2·4박을 잡아 주므로 개러지보다는 쉽지만, 4/4 만 듣던 귀에는 여전히 낯설다. */
      id: 'breaks130', name: L('브레이크비트', 'Breakbeat'), bpm: 130, root: 38, // D2
      color: '#22d3ee',
      kick: '1.....1...1.....',
      clap: '....1.......1...',
      hat: '..1.1.1.1.1.1.1.',
      bass: [0, null, null, null, null, null, -5, null, 0, null, null, null, null, null, 3, null],
      stab: [null, null, null, null, null, null, null, null, null, null, null, null, [0, 3, 7], null, null, null]
    },
    {
      /* 베이스라인. 저음이 엇박에서 크게 움직여 킥과 자리를 다툰다.
       * 배우기 4편(저음이 겹치면 탁해진다)을 몸으로 느끼기 좋은 재료다. */
      id: 'bassline134', name: L('베이스라인', 'Bassline'), bpm: 134, root: 36, // C2
      color: '#4ade80',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1...1...1...1.',
      bass: [null, null, 0, null, null, null, 3, null, null, null, 0, null, null, null, -2, null],
      stab: [null, null, null, null, null, null, null, null, null, null, null, null, [0, 5, 7], null, null, null]
    },
    {
      id: 'trance136', name: L('트랜스', 'Trance'), bpm: 136, root: 40, // E2
      color: '#c084fc',
      kick: '1...1...1...1...',
      clap: '....1.......1...',
      hat: '..1.2.1...1.2.1.',
      bass: [null, null, 0, null, null, null, 12, null, null, null, 0, null, null, null, 7, null],
      stab: [null, null, null, null, null, null, null, null, [0, 7, 12], null, null, null, null, null, null, null]
    },
    {
      id: 'hardgroove140', name: L('하드 그루브', 'Hard Groove'), bpm: 140, root: 38, // D2
      color: '#ef4444',
      kick: '1...1...1...1...',
      clap: '..1...1...1...1.',
      hat: '1.1.1.1.1.1.1.1.',
      bass: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, -5, null],
      stab: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, [0, 7], null]
    }
  ];

  /* 편곡 — 곡에 구조를 준다.
   *
   * 4마디 루프만 돌리면 "넘길 자리를 찾는" 연습을 할 수가 없다. 배우기 1편이
   * 8·16·32박 묶음을 가르치는데 정작 재료에 묶음이 없었다.
   * 마디 수를 4·4·8·4·8 로 잡아 16·16·32·16·32박이 되게 했다.
   *
   * 길이는 128BPM 에서 약 53초. 더 길게 하면 디코드된 버퍼가 덱마다 수십 MB 로 불어난다. */
  var ARRANGEMENT = [
    { name: '인트로',   bars: 4, parts: ['kick', 'hat'] },
    { name: '빌드',     bars: 4, parts: ['kick', 'hat', 'bass'] },
    { name: '메인',     bars: 8, parts: ['kick', 'clap', 'hat', 'bass', 'stab'] },
    { name: '브레이크', bars: 4, parts: ['hat', 'stab'] },        // 킥이 빠진다. 넘길 자리.
    { name: '드롭',     bars: 8, parts: ['kick', 'clap', 'hat', 'bass', 'stab'] }
  ];

  function arrangementOf(def) { return def.arrangement || ARRANGEMENT; }

  function totalBars(def) {
    return arrangementOf(def).reduce(function (n, s) { return n + s.bars; }, 0);
  }

  /* 각 섹션이 몇 번째 마디에서 시작하는지. 화면과 연습 구간 계산이 같은 값을 쓰게. */
  function sections(def) {
    var spb = 60 / def.bpm, at = 0;
    return arrangementOf(def).map(function (s) {
      var out = {
        name: s.name, parts: s.parts, bars: s.bars,
        startBar: at, startSec: at * 4 * spb, durSec: s.bars * 4 * spb
      };
      at += s.bars;
      return out;
    });
  }

  function partsAtBar(def, bar) {
    var arr = arrangementOf(def), at = 0;
    for (var i = 0; i < arr.length; i++) {
      if (bar < at + arr[i].bars) return arr[i].parts;
      at += arr[i].bars;
    }
    return arr[arr.length - 1].parts;
  }

  /* 레슨과 오늘의 도전이 쓸 구간. 악기가 다 나와 있는 첫 섹션(메인).
   * 브레이크에서 킥이 사라지면 박을 셀 수가 없어 판정이 깨진다. */
  function practiceRegion(def) {
    var secs = sections(def);
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].parts.indexOf('kick') >= 0 && secs[i].parts.indexOf('clap') >= 0) return secs[i];
    }
    return secs[0];
  }

  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* 마디별 패턴 꺼내기 — 하나만 주면 전 마디 반복.
   *
   * 규칙: 한 마디는 16스텝이다. 길이 16 짜리 배열은 그 자체가 한 마디 패턴이고,
   * 그 밖의 배열은 마디마다 다른 패턴 묶음이다.
   *
   * ★ "pattern[0] 이 배열인가" 로 가르면 안 된다. stab 의 0번 칸(마디 첫 박)에 화음이
   *   오는 순간 한 마디 패턴을 마디 묶음으로 착각해서 터진다. 여섯 곡일 때는 우연히
   *   전부 0번이 null 이라 안 드러났고, 곡을 늘리자마자 나왔다. */
  function forBar(pattern, bar) {
    if (!Array.isArray(pattern)) return pattern;
    if (pattern.length === 16) return pattern;
    return pattern[bar % pattern.length];
  }

  function noiseBuffer(oc) {
    if (oc._noise) return oc._noise;
    var len = Math.floor(oc.sampleRate * 0.5);
    var buf = oc.createBuffer(1, len, oc.sampleRate);
    var d = buf.getChannelData(0);
    // 결정적 난수 — 매번 같은 소리가 나야 훈련 결과가 재현된다.
    var seed = 12345;
    for (var i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x3fffffff) - 1;
    }
    oc._noise = buf;
    return buf;
  }

  function noise(oc, t, dur, filter, freq, q, peak) {
    var src = oc.createBufferSource();
    src.buffer = noiseBuffer(oc);
    src.loop = true;
    var f = oc.createBiquadFilter();
    f.type = filter; f.frequency.value = freq; f.Q.value = q || 1;
    var g = oc.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + dur + 0.02);
    return g;
  }

  function kick(oc, out, t) {
    var osc = oc.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.06);
    var g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.95, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.38);
    // 폰 스피커에서 킥이 사라지지 않도록 어택에 작은 클릭 하나.
    noise(oc, t, 0.012, 'highpass', 2200, 0.7, 0.18).connect(out);
  }

  function clap(oc, out, t) {
    [0, 0.011, 0.023].forEach(function (d) {
      noise(oc, t + d, 0.05, 'bandpass', 1400, 1.1, 0.28).connect(out);
    });
    noise(oc, t + 0.032, 0.19, 'bandpass', 1100, 0.8, 0.34).connect(out);
  }

  function hat(oc, out, t, open) {
    noise(oc, t, open ? 0.24 : 0.038, 'highpass', 7800, 0.9, open ? 0.20 : 0.26).connect(out);
  }

  function bassNote(oc, out, t, midi, dur) {
    var osc = oc.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiToHz(midi);
    var sub = oc.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = midiToHz(midi - 12);

    var f = oc.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(230, t + Math.min(dur, 0.18));

    var g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.008);
    g.gain.setValueAtTime(0.42, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    osc.connect(f); sub.connect(f); f.connect(g).connect(out);
    osc.start(t); osc.stop(t + dur + 0.02);
    sub.start(t); sub.stop(t + dur + 0.02);
  }

  function stabChord(oc, out, t, midis, dur) {
    var f = oc.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = 0.7;
    var hp = oc.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 260;   // 베이스와 안 겹치게
    var g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    f.connect(hp).connect(g).connect(out);

    midis.forEach(function (m) {
      [-6, 6].forEach(function (cents) {
        var o = oc.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToHz(m);
        o.detune.value = cents;
        o.connect(f);
        o.start(t); o.stop(t + dur + 0.02);
      });
    });
  }

  /* 악기 소리를 한 번씩만 렌더해 둔다.
   * 히트마다 노드를 새로 만들어 스케줄하면 28마디 한 곡에 3.5초가 걸린다(실측).
   * 소리 자체는 그대로다 — 잡음 버퍼가 결정적이라 같은 악기는 언제나 같은 파형이다. */
  function renderVoice(sampleRate, dur, schedule) {
    var OC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    var oc = new OC(1, Math.max(1, Math.ceil(dur * sampleRate)), sampleRate);
    var out = oc.createGain();
    out.gain.value = 1;
    out.connect(oc.destination);
    schedule(oc, out);
    return oc.startRendering().then(function (b) { return b.getChannelData(0); });
  }

  var MASTER = 0.85;

  /* 트랙 하나를 AudioBuffer 로 렌더.
   * 악기 소리를 모아 두고 배열 덧셈으로 곡을 조립한다. 끝을 넘는 잔향은 머리로 접어
   * 루프 이음매에서 딸깍 소리가 안 나게 한다. */
  function render(def, sampleRate) {
    var spb = 60 / def.bpm;
    var stepDur = spb / 4;
    var bars = totalBars(def);
    var loopSamples = Math.round(bars * 4 * spb * sampleRate);

    // 이 곡에 실제로 쓰이는 음정·화음만 렌더한다
    var bassSet = {}, stabSet = {};
    for (var bar = 0; bar < bars; bar++) {
      var on = partsAtBar(def, bar);
      if (on.indexOf('bass') >= 0) {
        var bp = forBar(def.bass, bar);
        for (var i = 0; i < 16; i++) if (bp && bp[i] !== null && bp[i] !== undefined) bassSet[bp[i]] = true;
      }
      if (on.indexOf('stab') >= 0) {
        var sp = forBar(def.stab, bar);
        for (var j = 0; j < 16; j++) if (sp && sp[j]) stabSet[sp[j].join(',')] = sp[j];
      }
    }

    var bassDur = stepDur * 1.8, stabDur = stepDur * 3;
    var voices = {}, jobs = [];
    function voice(key, dur, fn) {
      jobs.push(renderVoice(sampleRate, dur, fn).then(function (v) { voices[key] = v; }));
    }
    voice('kick', 0.42, function (oc, o) { kick(oc, o, 0); });
    voice('clap', 0.28, function (oc, o) { clap(oc, o, 0); });
    voice('hat', 0.08, function (oc, o) { hat(oc, o, 0, false); });
    voice('hat2', 0.30, function (oc, o) { hat(oc, o, 0, true); });
    Object.keys(bassSet).forEach(function (k) {
      voice('b' + k, bassDur + 0.08, function (oc, o) { bassNote(oc, o, 0, def.root + Number(k), bassDur); });
    });
    Object.keys(stabSet).forEach(function (k) {
      var chord = stabSet[k];
      voice('s' + k, stabDur + 0.08, function (oc, o) {
        stabChord(oc, o, 0, chord.map(function (n) { return def.root + 24 + n; }), stabDur);
      });
    });

    return Promise.all(jobs).then(function () {
      var OC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
      var oc = new OC(2, loopSamples, sampleRate);
      var buf = oc.createBuffer(2, loopSamples, sampleRate);
      var L = buf.getChannelData(0), R = buf.getChannelData(1);

      /* pan 이 null 이면 모노를 양 채널에 그대로(Web Audio 의 업믹스와 같게).
       * 값이 있으면 StereoPanner 와 같은 정출력 곡선을 쓴다. */
      function place(v, at, gain, pan) {
        if (!v) return;
        var gl = gain, gr = gain;
        if (pan !== null && pan !== undefined) {
          var x = (pan + 1) * Math.PI / 4;
          gl = Math.cos(x) * gain; gr = Math.sin(x) * gain;
        }
        var n = v.length;
        for (var i = 0; i < n; i++) {
          var k = at + i;
          if (k >= loopSamples) k -= loopSamples;      // 끝을 넘으면 머리로
          L[k] += v[i] * gl;
          R[k] += v[i] * gr;
        }
      }

      for (var bar = 0; bar < bars; bar++) {
        var on = partsAtBar(def, bar);
        var kickP = on.indexOf('kick') >= 0 ? forBar(def.kick, bar) : null;
        var clapP = on.indexOf('clap') >= 0 ? forBar(def.clap, bar) : null;
        var hatP = on.indexOf('hat') >= 0 ? forBar(def.hat, bar) : null;
        var bassP = on.indexOf('bass') >= 0 ? forBar(def.bass, bar) : null;
        var stabP = on.indexOf('stab') >= 0 ? forBar(def.stab, bar) : null;

        for (var s = 0; s < 16; s++) {
          /* 스윙: 홀수 16분음표를 뒤로 민다. 개러지·셔플의 흐느적거림이 여기서 나온다.
           * 킥은 대개 짝수 스텝이라 격자 위에 그대로 남고, 박자 판정이 흔들리지 않는다. */
          var t = (bar * 16 + s) * stepDur;
          if (def.swing && s % 2 === 1) t += def.swing * stepDur;
          var at = Math.round(t * sampleRate);

          if (kickP && kickP[s] === '1') place(voices.kick, at, MASTER, null);
          if (clapP && clapP[s] === '1') place(voices.clap, at, MASTER, null);
          if (hatP && (hatP[s] === '1' || hatP[s] === '2')) {
            place(voices[hatP[s] === '2' ? 'hat2' : 'hat'], at, MASTER, 0.22);
          }
          if (bassP && bassP[s] !== null && bassP[s] !== undefined) {
            place(voices['b' + bassP[s]], at, MASTER, null);
          }
          if (stabP && stabP[s]) place(voices['s' + stabP[s].join(',')], at, MASTER, -0.18);
        }
      }
      return buf;
    });
  }

  global.FirstMix = global.FirstMix || {};
  global.FirstMix.TRACKS = TRACKS;
  global.FirstMix.trackSections = sections;
  global.FirstMix.practiceRegion = practiceRegion;
  global.FirstMix.trackBars = totalBars;
  global.FirstMix.renderTrack = render;
  global.FirstMix.midiToHz = midiToHz;
})(typeof window !== 'undefined' ? window : this);
