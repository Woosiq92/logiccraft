/* 사용 안내 — 처음 쓰는 사람이 실제로 막히는 곳만 모았다.
 *
 * 코치마크로 화면을 덮지 않는다. 한 번 지나가면 다시 못 보고, 나중에 막혔을 때
 * 찾아올 곳이 없어지기 때문이다. 언제든 열어서 필요한 절만 펼쳐 보는 문서로 둔다.
 *
 * 첫 절만 펼쳐 두고 나머지는 접는다. 처음 열었을 때 글이 한 화면을 넘기면 안 읽는다.
 *
 * 글은 모듈이 읽힐 때 한 번 평가되므로 tr() 이 아니라 L() 로 두 언어를 짝지어 두고,
 * 그리는 자리에서 dl() 로 푼다. tr() 을 쓰면 첫 언어로 굳어 토글이 안 먹는다.
 */
(function (global) {
  'use strict';

  var FM = global.FirstMix;
  var el = FM.el, tr = FM.tr, dl = FM.dl, L = FM.L;

  /* kind:
   *   'step'  번호가 붙는 순서
   *   'pair'  [이름, 설명] 두 칸짜리 줄
   *   'note'  그냥 문단 */
  var GUIDE = [
    {
      id: 'start', title: L('무엇부터 하면 되나', 'Where to start'), kind: 'step',
      items: [
        L('유선 이어폰을 꽂습니다. 블루투스는 소리가 0.2초쯤 늦게 도착해서 박자를 다루는 연습이 어렵습니다.',
          'Plug in wired earphones. Bluetooth arrives about 0.2 seconds late, which makes beat practice hard.'),
        L('훈련 탭에서 1단계부터 차례로 지나갑니다. 한 단계에 한 가지만 배웁니다.',
          'Work through the Train tab from step 1. Each step teaches one thing.'),
        L('네 단계를 마치면 믹스 탭에서 두 덱을 자유롭게 다룹니다.',
          'Once all four steps are done, the Mix tab hands you both decks with nothing held back.'),
        L('매일 오늘의 도전을 한 판 합니다. 같은 날에는 모든 사람이 같은 문제를 받습니다.',
          "Play one round of Today's challenge each day. Everyone gets the same one on the same date.")
      ]
    },
    {
      id: 'meter', title: L('가운데 바늘 읽는 법', 'Reading the needle'), kind: 'meter',
      items: [
        [L('한쪽으로 계속 흐른다', 'It keeps drifting one way'),
         L('두 곡의 빠르기가 다릅니다. 템포 페이더를 미세하게 움직이세요.',
           'The two tracks run at different speeds. Move the tempo fader in small steps.')],
        [L('한자리에 치우쳐 멈췄다', 'It sits off-center and stays there'),
         L('빠르기는 같고 박만 어긋났습니다. 밀기 버튼을 짧게 누르세요.',
           'The speeds match but the beats do not. Tap the nudge buttons briefly.')],
        [L('가운데 초록 구간에 있다', 'It is inside the green band'),
         L('박이 겹쳤습니다. 이 상태를 유지하면서 넘기면 됩니다.',
           'The beats are locked. Hold this and cross over.')]
      ]
    },
    {
      id: 'read', title: L('화면 읽는 법', 'Reading the screen'), kind: 'pair',
      items: [
        [L('비트그리드', 'Beatgrid'),
         L('덱 아래 눈금입니다. 굵은 선이 마디의 첫 박이고, 가운데 흰 선이 지금 재생 위치입니다.',
           'The ruler under each deck. Thick lines are the first beat of a bar. The white line in the middle is where you are now.')],
        [L('조그휠', 'Jog wheel'),
         L('태블릿에서 보입니다. 바늘이 12시에 오면 마디의 첫 박입니다. 두 덱의 바늘을 견주면 어긋난 정도가 눈에 보입니다.',
           'Shows on tablets. When the marker points straight up you are on the first beat of a bar. Compare both decks and the gap becomes visible.')],
        [L('BPM 숫자', 'BPM readout'),
         L('덱 오른쪽 위입니다. 훈련 중에는 일부러 감춥니다. 숫자를 보고 맞추면 귀가 늘지 않습니다.',
           'Top right of each deck. Training hides it on purpose. Matching by number does not train your ear.')],
        [L('주황색 칠', 'Orange fill'),
         L('루프가 걸린 구간입니다. 그 구간만 반복됩니다.',
           'The looped region. Only that stretch repeats.')]
      ]
    },
    {
      id: 'controls', title: L('컨트롤', 'Controls'), kind: 'pair',
      items: [
        [L('간단 / 전체', 'Simple / Full'),
         L('믹스 화면 맨 위의 스위치입니다. 간단은 레슨에서 쓰던 손잡이만 남기고, 전체는 EQ·필터·핫큐까지 다 엽니다. 7단계를 지나면 전체가 기본이 됩니다.',
           'The switch at the top of the Mix screen. Simple keeps only the controls the lessons used; Full opens EQ, filter and hot cues as well. After step 7, Full becomes the default.')],
        [L('템포', 'TEMPO'),
         L('곡의 빠르기입니다. 옆의 ±8 버튼으로 움직이는 범위를 바꿉니다. 빠르기 차이가 큰 두 곡에는 ±16이나 ±50이 필요합니다.',
           'Track speed. The ±8 button beside it changes how far the fader reaches. Tracks far apart in speed need ±16 or ±50.')],
        [L('밀기 ◀ ▶', 'Nudge ◀ ▶'),
         L('누르고 있는 동안만 잠깐 빨라지거나 느려집니다. 실제 기기에서 판을 손으로 미는 동작과 같습니다.',
           'Speeds up or slows down only while held. The same move as pushing the platter by hand on real gear.')],
        [L('CUE', 'CUE'),
         L('재생 중에 누르면 찍어둔 지점으로 돌아갑니다. 멈춘 상태에서 누르면 지금 지점을 찍습니다.',
           'Press while playing to jump back to your marked point. Press while stopped to mark the current point.')],
        [L('LOOP', 'LOOP'),
         L('지금 자리에서 8박을 반복합니다. 맞출 시간이 필요할 때 씁니다. 다시 누르면 풀립니다.',
           'Repeats 8 beats from where you are. Use it when you need time to match. Press again to release.')],
        [L('크로스페이더', 'Crossfader'),
         L('왼쪽 끝이면 A만, 오른쪽 끝이면 B만 들립니다.',
           'Full left is A only. Full right is B only.')],
        [L('HI · MID · LOW', 'HI · MID · LOW'),
         L('대역별 소리 크기입니다. 끝까지 내리면 그 대역이 사라집니다.',
           'Volume for each frequency band. All the way down removes that band.')],
        [L('FILTER', 'FILTER'),
         L('가운데가 통과입니다. 왼쪽으로 가면 저음만, 오른쪽으로 가면 고음만 남습니다.',
           'Center passes everything through. Left keeps the lows, right keeps the highs.')],
        [L('헤드폰 버튼', 'Headphone button'),
         L('스플릿 출력을 켰을 때만 나옵니다. 그 덱을 헤드폰으로만 미리 듣습니다.',
           'Appears only when split output is on. Sends that deck to your headphones alone.')],
        [L('핫큐 1·2·3·4', 'Hot cues 1-4'),
         L('빈 자리를 누르면 지금 지점을 찍고, 찍힌 자리를 누르면 그리로 뜁니다. 길게 누르면 지웁니다.',
           'Tap an empty pad to mark where you are. Tap a filled one to jump there. Hold to clear.')],
        [L('ECHO', 'ECHO'),
         L('소리가 박에 맞춰 되돌아옵니다. 간격은 반 박이고 템포를 당기면 같이 따라옵니다. 넘기다 막혔을 때 시간을 벌거나, 브레이크를 길게 늘일 때 씁니다. 끝나면 0 으로 돌려놓습니다.',
           'The sound comes back on the beat, half a beat apart, and it follows the tempo fader. Use it to buy time mid-transition or to stretch a break. Return it to 0 when you are done.')],
        [L('SYNC 가 없습니다', 'There is no SYNC'),
         L('일부러 안 넣었습니다. 맞추는 일을 기계가 대신하면 그 감각이 늘지 않습니다. 그 하나를 뺀 나머지는 실제 기기와 같은 구성입니다.',
           'Left out on purpose. If the machine does the matching, the feel never develops. Apart from that one thing, this matches what real gear gives you.')],
        [L('TRIM', 'TRIM'),
         L('곡마다 다른 녹음 크기를 맞추는 손잡이입니다. EQ 앞에 있고 가운데가 원래 크기입니다. 옆 미터를 보면서 맞춥니다.',
           'Evens out the different recording levels of your tracks. It sits before the EQ, with center meaning untouched. Set it while watching the meter beside it.')],
        [L('레벨 미터', 'Level meter'),
         L('그 채널이 얼마나 센지 보여줍니다. 눈금 하나가 -6dB 이고, 그 언저리에 두는 것이 목표입니다. 오른쪽 끝이 빨개지면 찌그러지고 있다는 뜻입니다.',
           'Shows how hot the channel is. The tick sits at -6dB, which is what to aim for. Red at the right edge means it is clipping.')],
        [L('녹음', 'REC'),
         L('맨 위에 있습니다. 누르면 나가는 소리를 그대로 담고, 다시 누르면 멈춰서 나 화면에 쌓입니다.',
           'At the top of the screen. It keeps exactly what goes out; press again to stop and it lands on the Me screen.')]
      ]
    },
    {
      id: 'terms', title: L('용어', 'Terms'), kind: 'pair',
      items: [
        [L('BPM', 'BPM'),
         L('1분에 몇 박인지를 나타냅니다. 숫자가 클수록 빠릅니다.',
           'Beats per minute. A bigger number means faster.')],
        [L('비트매칭', 'Beatmatching'),
         L('두 곡의 빠르기를 같게 만들고 박을 겹치는 일입니다. 디제잉의 첫 단계입니다.',
           'Making two tracks run at the same speed and laying their beats on top of each other. The first step of DJing.')],
        [L('위상', 'Phase'),
         L('박이 어느 지점에 와 있는지입니다. 빠르기가 같아도 위상이 어긋나면 두 번 치는 것처럼 들립니다.',
           'Where inside the beat you are. Even at the same speed, tracks out of phase sound like a double hit.')],
        [L('큐 포인트', 'Cue point'),
         L('곡의 특정 지점을 찍어두고 바로 돌아가는 자리입니다.',
           'A spot you mark in a track so you can jump straight back to it.')],
        [L('스플릿 출력', 'Split output'),
         L('왼쪽 채널로 나갈 소리를, 오른쪽 채널로 나만 들을 소리를 따로 보내는 방식입니다. 3.5mm 분배 케이블이 필요합니다.',
           'Sends the audience mix out the left channel and your private mix out the right. Needs a 3.5mm splitter cable.')]
      ]
    },
    {
      id: 'stuck', title: L('자주 막히는 곳', 'Common snags'), kind: 'pair',
      items: [
        [L('통과가 안 됩니다', 'It will not pass me'),
         L('각 단계는 맞춘 상태를 4초 동안 유지해야 합니다. 스쳐 지나가는 정렬로는 넘어가지 않습니다.',
           'Each step needs the match held for 4 seconds. Alignment you merely pass through does not count.')],
        [L('소리가 계속 어긋나 들립니다', 'The sound is always off'),
         L('블루투스 이어폰인지 확인하세요. 화면 위쪽에 지연 안내가 뜨면 유선으로 바꾸는 편이 낫습니다.',
           'Check whether your earphones are Bluetooth. If a latency notice appears at the top of the screen, switch to wired.')],
        [L('내 음악이 안 열립니다', 'My music will not open'),
         L('스트리밍 서비스의 곡은 보호가 걸려 있어 열 수 없습니다. 기기에 파일로 저장된 mp3, m4a, wav 를 넣어 주세요.',
           'Tracks from streaming services are protected and cannot be opened. Use mp3, m4a or wav files stored on the device.')],
        [L('BPM 이 이상하게 잡힙니다', 'The BPM came out wrong'),
         L('트랙 목록에서 조정을 누르면 배로 올리거나 반으로 내릴 수 있습니다. 첫 박도 밀리초 단위로 옮깁니다.',
           'Press Adjust in the track list to double it or halve it. The first beat moves in milliseconds too.')],
        [L('다음 곡을 혼자 듣고 싶습니다', 'I want to hear the next track alone'),
         L('나 화면에서 스플릿 출력을 켜고 분배 케이블을 끼웁니다. 켜는 동안 나가는 소리는 모노가 됩니다.',
           'Turn on split output in the Me tab and plug in a splitter cable. The audience mix goes mono while it is on.')],
        [L('빠르기 차이가 커서 안 맞습니다', 'The speeds are too far apart'),
         L('템포 옆 ±8 버튼을 눌러 범위를 넓히세요. 100BPM 곡과 128BPM 곡은 ±50 이 필요합니다.',
           'Press the ±8 button beside the tempo fader to widen the range. 100 BPM against 128 BPM needs ±50.')],
        [L('당기면 음정이 변합니다', 'Pulling the tempo changes the pitch'),
         L('나 화면에서 키락을 켜면 음정이 그대로 있습니다. 크게 당길수록 소리에 일렁임이 생기고, 재생 중에 켜고 끄면 한 번 끊깁니다.',
           'Turn on key lock on the Me screen and the pitch stays put. The further you pull, the more it warbles, and switching it mid-playback breaks the sound once.')],
        [L('곡이 많아 못 찾겠습니다', 'Too many tracks to find anything'),
         L('트랙 목록 위의 검색창에 이름을 치면 걸러집니다. BPM 순으로 정렬할 수도 있고, 크레이트를 만들어 오늘 틀 곡만 담아 둘 수도 있습니다.',
           'Type into the search box above the track list. You can also sort by BPM, or make a crate and keep only tonight\'s tracks in it.')],
        [L('세트 도중에 화면이 꺼집니다', 'The screen sleeps during a set'),
         L('소리가 나는 동안에는 앱이 화면을 깨워 둡니다. 그래도 꺼진다면 기기의 자동 잠금을 꺼 주세요.',
           'The app keeps the screen awake while sound is playing. If it still sleeps, turn off auto-lock on the device.')]
      ]
    }
  ];
  FM.GUIDE = GUIDE;

  /* 바늘 상태 세 가지를 작게 그려 준다. 글로만 쓰면 어느 쪽이 어느 상태인지 안 잡힌다. */
  function miniMeter(kind) {
    var c = el('canvas', 'mini-meter');
    c.width = 240; c.height = 44;
    var ctx = c.getContext('2d');
    var w = 120, h = 22;                      // CSS 픽셀 기준 (2배 캔버스)
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = '#111119';
    ctx.fillRect(0, 0, w, h);

    var mid = w / 2;
    ctx.fillStyle = 'rgba(34,197,94,0.18)';
    ctx.fillRect(mid - 5, 0, 10, h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (var i = -3; i <= 3; i++) ctx.fillRect(mid + i * (w / 8) - 0.5, h * 0.3, 1, h * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(mid - 1, h * 0.15, 2, h * 0.7);

    var x = kind === 'aligned' ? mid : kind === 'offset' ? mid + w * 0.28 : mid - w * 0.34;
    ctx.fillStyle = kind === 'aligned' ? '#22c55e' : '#f59e0b';
    ctx.fillRect(x - 2, h * 0.1, 4, h * 0.8);

    if (kind === 'drift') {                   // 흐르는 중이라는 표시
      ctx.fillStyle = 'rgba(245,158,11,0.35)';
      ctx.fillRect(x + 6, h * 0.42, 10, 2);
      ctx.fillRect(x + 18, h * 0.42, 6, 2);
    }
    return c;
  }

  function section(sec, openFirst) {
    var box = el('section', 'guide-sec' + (openFirst ? ' open' : ''));
    var head = el('button', 'guide-head');
    head.append(el('span', 'guide-title', dl(sec.title)), el('span', 'guide-caret', '⌄'));
    var body = el('div', 'guide-body');

    if (sec.kind === 'step') {
      var ol = el('ol', 'guide-steps');
      sec.items.forEach(function (t) { ol.appendChild(el('li', null, dl(t))); });
      body.appendChild(ol);
    } else if (sec.kind === 'meter') {
      var kinds = ['drift', 'offset', 'aligned'];
      sec.items.forEach(function (pair, i) {
        var row = el('div', 'guide-meterrow');
        row.appendChild(miniMeter(kinds[i]));
        var txt = el('div', 'guide-metertext');
        txt.append(el('span', 'guide-term', dl(pair[0])), el('span', 'guide-desc', dl(pair[1])));
        row.appendChild(txt);
        body.appendChild(row);
      });
    } else {
      sec.items.forEach(function (pair) {
        var row = el('div', 'guide-pair');
        row.append(el('span', 'guide-term', dl(pair[0])), el('span', 'guide-desc', dl(pair[1])));
        body.appendChild(row);
      });
    }

    head.addEventListener('click', function () { box.classList.toggle('open'); });
    box.append(head, body);
    return box;
  }

  FM.openGuide = function () {
    if (FM.leaveTrain) FM.leaveTrain();
    if (FM.leaveDaily) FM.leaveDaily();
    var root = document.getElementById('app');
    root.textContent = '';
    root.className = 'screen-guide';
    document.getElementById('screen-title').textContent = tr('사용 안내', 'Guide');
    // 안내는 탭이 아니다. 아무 탭도 켜져 있으면 안 된다.
    [].forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) { b.classList.remove('on'); });

    var head = el('section', 'lesson-head');
    var back = el('button', 'btn btn-ghost btn-back', tr('‹ 돌아가기', '‹ Back'));
    back.addEventListener('click', function () { FM.go(FM.state.tab); });
    head.append(back, el('h2', 'lesson-h', tr('처음이신가요', 'New here?')));
    root.appendChild(head);

    root.appendChild(el('p', 'lesson-lead', tr(
      '디제잉의 첫 단계는 두 곡의 박을 겹치는 감각입니다. 이 앱은 그것만 다룹니다.',
      'The first step of DJing is the feel for laying two tracks on the same beat. This app covers that and nothing else.')));

    GUIDE.forEach(function (sec, i) { root.appendChild(section(sec, i === 0)); });

    var go = el('button', 'btn btn-primary guide-go', tr('훈련 1단계로 가기', 'Go to step 1'));
    go.addEventListener('click', function () { FM.go('train'); });
    root.appendChild(go);
  };
})(typeof window !== 'undefined' ? window : this);
