/* 배우기 — 4단계를 마친 사람이 부딪히는 다음 벽만 다룬다.
 *
 * 읽을거리를 쌓지 않는다. 읽기만 하는 DJ 앱은 시장에서 이미 죽어 있다.
 * 우리는 실습이 있으니, 글마다 "그 자리에서 해볼 것"을 하나씩 붙이고 화면까지 데려다준다.
 *
 * 주제 고르는 기준: 이 앱 안에서 바로 해볼 수 있는가. 못 하면 넣지 않는다.
 *
 * 글은 모듈이 읽힐 때 한 번 평가되므로 L() 로 두 언어를 짝지어 두고 그리는 자리에서 dl() 로 푼다.
 */
(function (global) {
  'use strict';

  var FM = global.FirstMix;
  var el = FM.el, tr = FM.tr, dl = FM.dl, L = FM.L;

  var LEARN = [
    {
      id: 'a1',
      title: L('곡은 8박 단위로 짜여 있다', 'Tracks are built in blocks of 8 beats'),
      sub: L('넘길 자리를 찾는 법', 'How to find the spot to cross over'),
      body: [
        L('클럽에서 트는 음악은 거의 다 네 박이 한 마디입니다. 그리고 마디가 4개, 8개씩 묶여 한 덩어리를 이룹니다. 인트로가 16박, 메인이 32박 하는 식으로요. 실제 곡은 이보다 길지만 짜이는 원리는 같습니다.',
          'Almost everything played in clubs puts four beats in a bar. Bars then group into fours and eights to form a block: 16 beats of intro, 32 of main section, that sort of thing. Real tracks run longer, but they are built the same way.'),
        L('이 묶음의 첫 박에서 넘기면 두 곡이 자연스럽게 이어집니다. 묶음 중간에서 넘기면 박은 맞는데도 어딘가 어색하게 들립니다.',
          'Cross over on the first beat of a block and the two tracks join naturally. Cross in the middle of one and it sounds off, even with the beats lined up.')
      ],
      points: [
        [L('왜 8박인가', 'Why 8 beats'),
         L('만드는 사람이 8박 단위로 짜기 때문입니다. 드럼이 바뀌거나 새 소리가 들어오는 자리가 대개 8박의 배수에 있습니다.',
           'Because that is how producers build. Drums change and new sounds enter at multiples of 8 nearly every time.')],
        [L('어디서 넘기나', 'Where to cross'),
         L('들어오는 곡의 큰 묶음이 시작하는 지점에 나가는 곡의 큰 묶음 시작을 맞춥니다.',
           'Line up the start of a block in the incoming track with the start of a block in the outgoing one.')],
        [L('가장 쉬운 자리', 'The easiest spot'),
         L('킥이 빠지는 브레이크입니다. 저음이 비어 있어 다음 곡을 얹어도 부딪히지 않습니다. 앱의 연습 곡에도 중간에 브레이크가 하나씩 있습니다.',
           'The break, where the kick drops out. The low end is empty, so the next track can sit on top without clashing. Every practice track here has one in the middle.')],
        [L('어떻게 세나', 'How to count'),
         L('킥을 하나 둘 셋 넷으로 세고, 그걸 여덟 번 세면 32박입니다. 처음에는 소리 내어 세는 편이 빠릅니다.',
           'Count the kick one two three four. Do that eight times and you have 32 beats. Counting out loud is faster at first.')]
      ],
      practice: L('훈련 5단계에서 직접 해 봅니다. 곡이 처음부터 흐르고, 16박 묶음이 시작하는 자리에서 넘기면 통과입니다. 킥이 사라지는 브레이크가 가장 알기 쉬운 자리입니다.',
        'Step 5 in Training is this, hands on. The track plays from the top and you pass by crossing where a 16-beat block begins. The break, where the kick drops out, is the easiest one to spot.'),
      drill: 'l5'
    },
    {
      id: 'a2',
      title: L('어울리는 곡 고르기', 'Picking tracks that go together'),
      sub: L('빠르기 차이가 얼마까지 괜찮은가', 'How far apart the speeds can be'),
      body: [
        L('두 곡의 원래 빠르기가 너무 다르면 하나를 억지로 당겨야 합니다. 이 앱에는 음정을 붙잡아 주는 기능이 없어서, 빠르기를 당긴 만큼 음정도 같이 올라가고 내려갑니다. 실제 턴테이블도 그렇습니다.',
          'If two tracks start far apart in speed, one of them has to be dragged. This app has no key lock, so pitch rises and falls along with speed. Real turntables behave the same way.'),
        L('6% 를 당기면 음정이 약 반음 움직입니다. 이 정도까지는 대개 티가 안 납니다. 그보다 크게 당기면 목소리가 먼저 이상해집니다.',
          'Pull 6 percent and the pitch moves about a semitone. Up to there it usually goes unnoticed. Past that, vocals are the first thing to sound wrong.')
      ],
      points: [
        [L('안전한 범위', 'A safe range'),
         L('두 곡의 BPM 차이가 6% 안쪽이면 무난합니다. 124와 128 사이는 약 3% 라 편합니다.',
           'Within 6 percent between the two is comfortable. 124 against 128 is about 3 percent, which is easy.')],
        [L('장르별 대략', 'Rough ranges by genre'),
         L('디스코 110~125, 하우스 118~128, 테크노 130~140 근처입니다. 힙합은 80~100 이라 하우스와 바로 붙이기 어렵습니다.',
           'Disco 110 to 125, house 118 to 128, techno 130 to 140. Hip hop sits at 80 to 100, which is hard to join straight onto house.')],
        [L('그래도 붙이고 싶다면', 'If you want it anyway'),
         L('템포 옆 범위 버튼으로 ±16 이나 ±50 을 고르면 물리적으로는 맞출 수 있습니다. 음정이 크게 변하는 것은 감수해야 합니다.',
           'The range button beside the tempo fader gives you ±16 or ±50, so it can be done. A large pitch shift is the price.')]
      ],
      practice: L('트랙 이름을 눌러 스무 곡의 BPM 을 견줘 보세요. 110 부터 140 까지 있습니다. 로파이 110 과 하드 그루브 140 은 27% 차이라, 붙이려면 범위를 넓혀야 하고 음정이 크게 변합니다.',
        'Tap a track name and compare the BPM across all twenty, which run from 110 to 140. Lo-fi at 110 against hard groove at 140 is 27 percent apart, so joining them needs a wider range and moves the pitch a long way.'),
      go: 'mix'
    },
    {
      id: 'a6',
      title: L('장르마다 박이 다르게 잡힌다', 'The beat sits differently in every genre'),
      sub: L('스무 곡 중 여덟 곡으로', 'Eight of the twenty tracks'),
      body: [
        L('클럽에서 트는 음악은 대부분 네 박이 한 마디입니다. 그런데 킥이 어디에 놓이고 그 위에 무엇이 얹히는지가 장르마다 달라서, 같은 비트매칭인데도 장르에 따라 박이 잘 잡히기도 하고 전혀 안 잡히기도 합니다.',
          'Almost everything played in clubs has four beats to a bar. Where the kick lands and what gets stacked on top changes by genre, though, so the same beatmatching feels obvious in one track and impossible in another.'),
        L('앱에는 110 부터 140 까지 스무 곡이 있습니다. 그중 여덟 곡을 아래에 골라 뒀습니다. 박이 가장 쉬운 것부터 가장 어려운 것까지 순서대로입니다. 하나씩 덱에 올려 보면 귀가 무엇을 따라가는지 알게 됩니다.',
          'The app carries twenty tracks from 110 to 140. Eight of them are laid out below, ordered from the easiest beat to find to the hardest. Load them one at a time and you find out what your ear is actually following.')
      ],
      tracks: [
        ['disco118', L('킥이 매 박에 있습니다. 베이스가 화려하게 움직여 처음엔 헷갈리지만 킥만 따라가면 됩니다.',
          'Kick on every beat. The bass moves around a lot, which is confusing at first, but following the kick is enough.')],
        ['deep122', L('킥이 매 박, 베이스가 엇박입니다. 소리가 부드러워 겹쳐도 지저분해지지 않아서 연습 시작에 좋습니다.',
          'Kick on every beat, bass on the offbeat. Soft enough that overlapping never gets muddy, which makes it a good place to start.')],
        ['tech126', L('강세가 두 박마다 옵니다. 마디의 머리를 반대로 잡기 쉬운 장르라 클랩이 어디 있는지 확인하는 습관이 필요합니다.',
          'The accent comes every two beats. It is easy to hear the top of the bar backwards here, so get in the habit of checking where the clap is.')],
        ['house128', L('킥이 매 박, 클랩이 2·4박입니다. 스무 곡 중 박 잡기가 가장 쉽습니다.',
          'Kick on every beat, clap on 2 and 4. The easiest of the twenty to find the beat in.')],
        ['techno138', L('킥은 또렷한데 위에 얹히는 게 적습니다. 박은 쉬운데 어디가 마디의 머리인지 찾기 어렵습니다.',
          'The kick is clear but little sits on top of it. The beat is easy, the top of the bar is hard.')],
        ['amapiano112', L('킥은 매 박인데 저음이 전부 엇박입니다. 킥을 놓치는 순간 베이스를 박으로 착각하게 됩니다.',
          'Kick on every beat, but the bass sits entirely off it. Lose the kick for a moment and you start counting the bass instead.')],
        ['breaks130', L('킥이 1박·2박 반·3박 반에 있습니다. 스네어가 2·4박을 잡아 줘서 개러지보다는 낫지만 4/4 만 듣던 귀에는 낯섭니다.',
          'Kick on 1, the and of 2 and the and of 3. The snare holds 2 and 4 so it is kinder than garage, but it is still strange to an ear raised on four-to-the-floor.')],
        ['garage132', L('킥이 매 박에 없습니다. 1박과 3박 반에 하나씩 있고 스네어가 2·4박을 잡습니다. 하우스만 듣던 귀에 박이 안 잡히는 게 정상입니다.',
          'No kick on every beat. One lands on 1 and another on the and of 3, with the snare holding 2 and 4. An ear raised on house losing the beat here is normal.')]
      ],
      points: [
        [L('무엇끼리 섞이나', 'What mixes with what'),
         L('이웃한 곡끼리는 대개 8% 안쪽이라 그냥 붙습니다. 양 끝인 로파이 110 과 하드 그루브 140 은 27% 차이라 범위를 넓혀야 하고 음정이 크게 변합니다.',
           'Neighbouring tracks sit within about 8 percent of each other, so they join without trouble. The two ends, lo-fi 110 and hard groove 140, are 27 percent apart, which needs a wider range and moves the pitch a long way.')],
        [L('앱에 없는 장르', 'Genres left out'),
         L('힙합 80~100 과 드럼앤베이스 170~180 은 스무 곡 어느 것과도 템포 범위 안에서 못 붙습니다. 들어도 연습할 데가 없어서 넣지 않았습니다.',
           'Hip hop at 80 to 100 and drum and bass at 170 to 180 cannot reach any of the twenty inside the tempo range. Adding them would leave you nothing to practise against.')],
        [L('개러지가 어려운 이유', 'Why garage is hard'),
         L('박을 알리는 소리가 엇박에 더 많습니다. 불러온 곡이 이런 경우라면 앱도 첫 박을 엇박으로 잡을 수 있습니다. 조정 화면에서 첫 박을 옮기면 됩니다.',
           'More of the markers that announce the beat land off the beat. If a track you import behaves this way, the app can latch onto an offbeat as beat one. Move the first beat on the adjust screen.')]
      ],
      practice: L('개러지와 하우스를 양쪽 덱에 올려 보세요. 킥이 매 박에 있는 곡과 없는 곡을 겹치면 박을 어디서 세야 하는지가 분명해집니다.',
        'Load garage on one deck and house on the other. Overlapping a track with a kick on every beat and one without makes it obvious where to count from.'),
      go: 'mix'
    },
    {
      id: 'a3',
      title: L('저음이 겹치면 탁해진다', 'Overlapping low end turns to mud'),
      sub: L('EQ 로 자리를 비워 주는 법', 'Clearing room with EQ'),
      body: [
        L('두 곡을 겹치면 킥과 베이스가 같은 자리에서 부딪힙니다. 소리가 뭉치고 힘이 빠지는데, 박은 맞는데도 좋게 안 들리는 이유가 대개 이것입니다.',
          'Overlap two tracks and their kicks and basses collide in the same place. The sound clumps and loses its power. When the beats match but it still does not sound good, this is usually why.'),
        L('해법은 저음 자리를 한 곡에만 내주는 것입니다. 들어오는 곡의 LOW 를 내려두고 들여보낸 다음, 넘어가는 순간에 두 곡의 LOW 를 맞바꿉니다.',
          'The fix is to let one track own the low end. Bring the incoming track in with its LOW down, then swap the two LOWs at the moment you hand over.')
      ],
      points: [
        [L('들여보낼 때', 'Bringing it in'),
         L('들어오는 곡의 LOW 를 끝까지 내립니다. 중고음만 들어와서 겹쳐도 지저분하지 않습니다.',
           'Take the incoming LOW all the way down. Only mids and highs enter, so the overlap stays clean.')],
        [L('넘기는 순간', 'At the handover'),
         L('나가는 곡의 LOW 를 내리면서 들어오는 곡의 LOW 를 올립니다. 저음 주인이 바뀝니다.',
           'Drop the outgoing LOW as you raise the incoming one. Ownership of the low end changes hands.')],
        [L('다 넘긴 뒤', 'Once you are across'),
         L('들어온 곡의 EQ 를 모두 가운데로 되돌립니다.',
           'Return every EQ on the track that came in to center.')]
      ],
      practice: L('훈련 6단계에서 직접 해 봅니다. 두 곡의 LOW 가 같이 열려 있던 시간을 재서 채점합니다. 짧을수록 좋습니다.',
        'Step 6 in Training is this, hands on. It scores you on how long both LOWs were open at once. Shorter is better.'),
      drill: 'l6'
    },
    {
      id: 'a4',
      title: L('필터로 들여보내기', 'Bringing a track in with the filter'),
      sub: L('한 손잡이로 하는 가장 쉬운 전환', 'The easiest transition, on one knob'),
      body: [
        L('EQ 세 개를 동시에 다루기가 아직 어렵다면 필터 하나로도 비슷한 일을 할 수 있습니다. 들어오는 곡의 필터를 오른쪽으로 돌려 두면 고음만 남아서, 나가는 곡 위에 얹어도 부딪히지 않습니다.',
          'If handling three EQ knobs at once is still too much, one filter does a similar job. Turn the incoming filter to the right and only highs remain, so it sits on top of the outgoing track without clashing.'),
        L('넘기면서 필터를 천천히 가운데로 되돌리면 그 곡의 몸통이 서서히 드러납니다. 클럽에서 자주 보이는 전환이 대개 이것입니다.',
          'Walk the filter slowly back to center as you cross, and the body of the track emerges bit by bit. Most transitions you notice in clubs are this one.')
      ],
      points: [
        [L('오른쪽으로 돌리면', 'Turned right'),
         L('저음이 깎이고 고음만 남습니다. 얇게 얹을 때 씁니다.',
           'Lows are cut and highs remain. Use it to lay a track on thin.')],
        [L('왼쪽으로 돌리면', 'Turned left'),
         L('고음이 깎이고 저음만 남습니다. 곡을 잠깐 물속에 넣는 느낌이라 브레이크 직전에 씁니다.',
           'Highs are cut and lows remain. It sounds like the track went underwater, which suits the moment just before a break.')],
        [L('가운데', 'Center'),
         L('아무 영향이 없는 자리입니다. 끝나면 반드시 여기로 돌려놓습니다.',
           'The position that does nothing. Always return here when you are done.')]
      ],
      practice: L('훈련 7단계에서 직접 해 봅니다. 얇게 들여보냈는지, 가운데로 되돌렸는지, 한 번에 던지지 않았는지를 봅니다.',
        'Step 7 in Training is this, hands on. It checks that you came in thin, walked the filter back, and did not throw it to center in one go.'),
      drill: 'l7'
    },
    {
      id: 'a5',
      title: L('이제 무엇을 사면 되나', 'So what should you buy'),
      sub: L('기기를 고를 때 볼 것', 'What to look at when choosing gear'),
      body: [
        L('여기까지 왔다면 손이 무엇을 원하는지 알게 됐을 겁니다. 그 기준으로 고르면 됩니다. 비싼 것부터 볼 이유가 없습니다.',
          'By now your hands know what they want. Choose on that basis. There is no reason to start from the expensive end.'),
        L('입문용 컨트롤러가 갖춰야 할 것은 정해져 있습니다. 덱 두 개, 채널마다 3밴드 EQ, 크로스페이더, 조그휠, 그리고 헤드폰 출력입니다. 이 다섯이 있으면 배운 것을 그대로 옮길 수 있습니다.',
          'What a starter controller needs is settled. Two decks, three-band EQ per channel, a crossfader, jog wheels, and a headphone output. With those five, everything you learned here transfers directly.')
      ],
      points: [
        [L('헤드폰 출력', 'Headphone output'),
         L('가장 중요합니다. 이 앱에서 케이블로 우회했던 미리듣기가 기기에는 제대로 달려 있습니다.',
           'The most important one. The cue this app works around with a cable is built into the hardware properly.')],
        [L('조그휠 크기', 'Jog wheel size'),
         L('클수록 미세 조정이 쉽습니다. 작아도 배우는 데는 지장이 없습니다.',
           'Bigger makes fine adjustment easier. Small does not hold your learning back.')],
        [L('소프트웨어', 'Software'),
         L('컨트롤러를 사면 대개 전용 프로그램이 딸려 옵니다. 그것부터 쓰고, 부족해지면 그때 바꾸면 됩니다.',
           'A controller usually ships with its own program. Start there and switch only when it stops being enough.')],
        [L('서두르지 않아도 되는 것', 'What can wait'),
         L('이펙트 개수, 패드 개수, 4덱 여부입니다. 처음 몇 달은 쓸 일이 거의 없습니다.',
           'Effect counts, pad counts, four-deck support. You will barely touch them for the first few months.')]
      ],
      practice: null,
      go: ''
    }
  ];
  FM.LEARN = LEARN;

  function readMap() {
    if (!FM.state.progress.read) FM.state.progress.read = {};
    return FM.state.progress.read;
  }

  FM.learnReadCount = function () {
    var r = FM.state.progress.read || {};
    return LEARN.filter(function (a) { return r[a.id]; }).length;
  };

  /* 훈련 목록 아래에 접어 둔다. 펼치지 않으면 목록이 길어지지 않는다. */
  FM.learnSection = function () {
    var read = readMap();
    var box = el('section', 'learn-sec');
    var head = el('button', 'guide-head');
    head.append(
      el('span', 'guide-title', tr('배우기', 'Learn')),
      el('span', 'learn-count', FM.learnReadCount() + ' / ' + LEARN.length),
      el('span', 'guide-caret', '⌄')
    );
    var body = el('div', 'guide-body');

    LEARN.forEach(function (a) {
      var row = el('button', 'learn-item' + (read[a.id] ? ' done' : ''));
      var txt = el('span', 'learn-text');
      txt.append(el('span', 'learn-title', dl(a.title)), el('span', 'learn-sub', dl(a.sub)));
      row.append(el('span', 'learn-dot', read[a.id] ? '✓' : ''), txt);
      row.addEventListener('click', function () { open(a); });
      body.appendChild(row);
    });

    head.addEventListener('click', function () { box.classList.toggle('open'); });
    box.append(head, body);
    return box;
  };

  function open(a) {
    if (FM.leaveTrain) FM.leaveTrain();
    if (FM.leaveDaily) FM.leaveDaily();

    var root = document.getElementById('app');
    root.textContent = '';
    root.className = 'screen-learn';
    document.getElementById('screen-title').textContent = tr('배우기', 'Learn');
    [].forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) { b.classList.remove('on'); });

    var head = el('section', 'lesson-head');
    var back = el('button', 'btn btn-ghost btn-back', tr('‹ 목록', '‹ Lessons'));
    back.addEventListener('click', function () { FM.go('train'); });
    head.append(back, el('h2', 'lesson-h', dl(a.title)));
    root.appendChild(head);
    root.appendChild(el('p', 'lesson-hint', dl(a.sub)));

    var art = el('article', 'article');
    a.body.forEach(function (p) { art.appendChild(el('p', 'article-p', dl(p))); });

    /* 장르 이야기는 글로 읽는 것보다 한 번 들어 보는 게 빠르다.
     * 그 곡을 덱 A 로 골라 두고 믹스 화면으로 보낸다. */
    (a.tracks || []).forEach(function (pair) {
      var idx = -1;
      FM.TRACKS.forEach(function (t, i) { if (t.id === pair[0]) idx = i; });
      if (idx < 0) return;
      var t = FM.TRACKS[idx];
      var row = el('div', 'trackrow');
      var dot = el('span', 'trackrow-dot');
      dot.style.background = t.color;
      var txt = el('div', 'trackrow-text');
      var head = el('div', 'trackrow-head');
      head.append(el('span', 'trackrow-name', dl(t.name)), el('span', 'trackrow-bpm', t.bpm + ' BPM'));
      txt.append(head, el('span', 'guide-desc', dl(pair[1])));
      var play = el('button', 'btn trackrow-go', tr('들어보기', 'Listen'));
      play.addEventListener('click', function () {
        FM.state.picked.A = idx;
        markRead(a);
        FM.go('mix');
      });
      row.append(dot, txt, play);
      art.appendChild(row);
    });

    a.points.forEach(function (pair) {
      var row = el('div', 'guide-pair');
      row.append(el('span', 'guide-term', dl(pair[0])), el('span', 'guide-desc', dl(pair[1])));
      art.appendChild(row);
    });
    root.appendChild(art);

    if (a.practice) {
      var box = el('section', 'practice');
      box.append(el('span', 'practice-tag', tr('해보기', 'Try it')),
        el('p', 'practice-body', dl(a.practice)));
      var go = el('button', 'btn btn-primary',
        a.drill ? tr('해보러 가기', 'Go and try it') : tr('믹스 화면으로', 'Go to Mix'));
      go.addEventListener('click', function () {
        markRead(a);
        // 글에 딸린 드릴이 있으면 믹스 화면이 아니라 그 판정으로 데려간다
        if (a.drill && FM.openLessonById) { FM.go('train'); FM.openLessonById(a.drill); }
        else FM.go(a.go || 'mix');
      });
      box.appendChild(go);
      root.appendChild(box);
    }

    var done = el('button', 'btn btn-ghost learn-done', tr('읽었습니다', 'Mark as read'));
    done.addEventListener('click', function () { markRead(a); FM.go('train'); });
    root.appendChild(done);
  }

  function markRead(a) {
    readMap()[a.id] = true;
    FM.saveProgress();
  }
  FM.openArticle = function (id) {
    var a = LEARN.filter(function (x) { return x.id === id; })[0];
    if (a) open(a);
  };
})(typeof window !== 'undefined' ? window : this);
