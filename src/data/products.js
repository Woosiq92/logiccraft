// 제품 데이터 — 단일 소스(single source of truth).
// 홈(index.astro)과 제품 목록(apps.astro)이 이 배열을 함께 import해 ProductCard로 렌더한다.
// 새 앱 추가 = 여기에 한 줄. 카드 마크업은 src/components/ProductCard.astro 한 곳에만 존재.
//   section: 'edu' | 'daily' → 카드 그리드. 'series' → 카운트용(카드는 Synergeion 타임라인에서 별도 렌더).
//   type: 'app'(ios/play) | 'web'(web). ios/play 가 null 이면 "(예정)" 버튼.
//   group(edu 전용): 'thinking'(어린이 사고력) | 'exam'(시험·자격) | 'practical'(실용·자기주도) → 홈 교육 하위 분류.
//   lab: true → 아직 다듬는 중인 웹 도구. 교육/일상 목록에서 빠지고 "실험실" 섹션으로 모임(홈·apps 공통).
export const products = [
  // Synergeion 시리즈 (카운트용 · 카드는 타임라인에서 렌더)
  { name: 'Synergeion Wonder', type: 'app', section: 'series' },
  { name: 'Synergeion Build', type: 'app', section: 'series' },
  // 교육
  { section: 'edu', group: 'exam', slug: 'psattriage', icon: 'psattriage', name: '데일리 PSAT', chip: 'PSAT·공시', type: 'app', desc: '기출 문제은행이 아니라, 시간배분·버리기·매몰비용을 측정하는 트리아지 트레이너. 자료·논리 감각을 단계로 훈련.', ios: 'https://apps.apple.com/kr/app/id6781955472', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.psattriage' },
  { section: 'edu', group: 'thinking', slug: 'robotrail', icon: 'robotrail', name: '로보트레일', chip: '컴퓨팅 사고력', type: 'app', desc: '코드 없이 명령 퍼즐로 코딩 사고력을 측정·훈련하는 앱. 학습 108판 + 측정 36문제 + 도전 모드.', ios: 'https://apps.apple.com/kr/app/id6764465655', play: 'https://play.google.com/store/apps/details?id=com.smartsikhye.robotrail' },
  { section: 'edu', group: 'practical', slug: 'science-club', icon: 'science-club', name: '과학자 클럽', chip: '과학', type: 'app', desc: '추측·발견·분기·회고 4단계로 매일 한 별씩 켜는 과학 사고 게임.', ios: 'https://apps.apple.com/kr/app/id6771675434', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.scienceclub' },
  { section: 'edu', group: 'exam', slug: 'certnote', icon: 'certnote', name: '모두의 자격증', chip: '자격증', type: 'app', desc: '82종 자격증의 정리 글·모의고사·암기카드를 잠금 없이. 매일 오늘의 훈련으로 점검하고 오답은 자동 복습. 광고는 있고, 원하면 한 번 결제로 없앨 수 있어요.', ios: 'https://apps.apple.com/kr/app/id6779944719', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.certnote' },
  { section: 'edu', group: 'thinking', slug: 'topbattle', icon: 'topbattle', name: '브레인블레이드', chip: '학습 배틀', type: 'app', desc: '팽이 배틀과 학습 퀴즈를 합친 두뇌 게임. 빠르고 정확하게 맞힐수록 강한 일격이 나가요. 구구단·영단어·한자·세계·바른말 5과목.', ios: 'https://apps.apple.com/kr/app/id6780302277', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.topbattle' },
  { section: 'edu', group: 'exam', slug: 'eduessay', icon: 'eduessay', name: '교논 트레이너', chip: '중등임용', type: 'app', desc: '중등임용 1교시 교육학 논술 올인원. 기출 개념 인출·간격 반복 복습, 50분 논제 실전, 객관식 모의고사를 인터넷·로그인 없이.', ios: 'https://apps.apple.com/kr/app/id6781959302', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.eduessay' },
  { section: 'edu', group: 'exam', slug: 'matrixiq', icon: 'matrixiq', name: '매트릭스 인적성', chip: '인적성·적성', type: 'app', desc: '도형추리·수열·공간지각 등 추론·수리 적성을 매일 한 사이클로 훈련하고, 약점을 진단해 맞춤으로 성장하는 룰베이스 앱. 완전 무료·광고 없음, 한국어·영어.', ios: 'https://apps.apple.com/kr/app/id6785131602', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.matrixiq' },
  { section: 'edu', group: 'practical', slug: 'sentence-forge', icon: 'sentence-forge', name: '글벼림', chip: '글쓰기·문장력', type: 'app', desc: '근대문학 명문장 88편을 문장 단위로 뜯어보고, 400개 넘는 연습으로 내 문장을 직접 다듬는 글쓰기 훈련 앱. 광고·계정·인터넷 없이, 기록은 내 폰에만.', ios: 'https://apps.apple.com/kr/app/id6790785003', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.sentenceforge' },
  // 일상
  { section: 'daily', slug: 'wedding-map', icon: 'wedding-map', name: '웨딩맵', chip: '결혼 준비', warm: true, lab: true, type: 'web', desc: '전국 결혼식장(민간·공공·호텔)을 지도에서 한눈에 보고, 받은 견적을 표로 비교해 정하는 도구. 가입·설치 없이 양가와 공유까지.', web: 'https://logiccraft.co.kr/wedding-map/' },
  { section: 'daily', slug: 'ourfootprint', icon: 'ourfootprint', name: '커플맵로그', chip: '지도', warm: true, type: 'app', desc: '둘이 다녀온 동네가 색으로 칠해지는 커플 점령 지도. 우리만의 맛집 등급도 직접 만들어요.', ios: 'https://apps.apple.com/kr/app/id6769797672', play: 'https://play.google.com/store/apps/details?id=com.logiccraft.ourfootprint' },
  { section: 'daily', slug: 'dadexam', icon: 'dadexam', name: '아빠자격시험', chip: '예비·초보 아빠', warm: true, lab: true, type: 'web', desc: '아빠 시점으로 임신·출산부터 영유아 안전·응급까지 육아 상식을 시험처럼 점검하고, 틀린 문제는 근거와 함께 배우는 자가점검. 30과목, 가입·설치 없이 무료. 재미로 보는 점검이며 국가공인 자격이 아닙니다.', web: 'https://logiccraft.co.kr/dadexam/' },
  { section: 'daily', slug: 'stockwatch', icon: 'stockwatch', name: '불안한개미', chip: '주식 시세', warm: true, type: 'app', desc: '매매 없이 시세만 — 거치대·위젯·잠금화면으로 보는 한국 주식 시세.', ios: 'https://apps.apple.com/kr/app/id6772662894', play: 'https://play.google.com/store/apps/details?id=com.logiccraft.stockwatch' },
  { section: 'daily', slug: 'yangmyeon', icon: 'yangmyeon', name: '양면', chip: '중도정치', warm: true, type: 'web', desc: '하나의 정치 쟁점을 가운데 사실관계 위에 놓고, 양옆에 찬성과 반대의 가장 강한 논거를 나란히. 어느 쪽이 옳은지 정해주지 않고, 무엇이 사실이고 무엇이 해석인지 구분하도록 돕는 사이트.', web: 'https://중도정치.kr' },
  { section: 'daily', slug: 'stage-radar', icon: 'stage-radar', name: '공연 발견', chip: '공연·페스티벌', warm: true, lab: true, type: 'web', desc: '오늘 비는 날 갈 수 있는 공연·페스티벌만 — 끝난 것·상설은 빼고 날짜·지역·장르·가격으로 고르고, 라인업 검색과 인기순까지. 공연예술통합전산망(KOPIS) 데이터.', web: 'https://stage-radar-production.up.railway.app' },
  { section: 'daily', slug: 'goalcast', icon: 'goalcast', name: '목표 캘린더', chip: '목표·할 일', warm: true, lab: true, type: 'web', desc: '한 해의 큰 목표를 월→주→일 할 일로 쪼개 관리하는 달력. 목표별 색·진행률로 무엇에 얼마나 다가갔는지 한눈에. 가입·설치 없이 브라우저에 저장.', web: 'https://logiccraft.co.kr/goalcast/' },
  { section: 'daily', icon: 'classvote', name: '학급 도구', chip: '투표·답변·사다리·뽑기', warm: true, type: 'web', desc: '반장·부반장 선거를 종이 없이 — 선생님이 코드·QR을 띄우면 학생들이 각자 폰으로 투표하고 실시간 개표까지. 질문 하나를 띄워 학생 답변을 실시간으로 모아 교실 화면에 카드로 펼칠 수도 있어요. 발표 순서·역할·당번은 사다리 타기와 랜덤 번호 뽑기로. 가입·설치 없이 무료.', web: 'https://classvote-production-6bee.up.railway.app' },
  { section: 'daily', slug: 'windeck', icon: 'windeck', name: 'WinDeck', chip: '맥 창 관리', warm: true, type: 'mac', desc: '맥 기본 창 정렬의 4분할 한계를 넘는 창 덱. 실제 창을 최대 9분할로 타일링하고, 덱에 없는 창은 오른쪽 스트립에 라이브 미러로 띄워 클릭 한 번에 불러옵니다. macOS 11 이상, 무료.', download: 'https://github.com/Woosiq92/windeck/releases/latest/download/WinDeck.dmg' },
  { section: 'edu', group: 'practical', slug: 'firstmix', icon: 'firstmix', name: '첫믹스', chip: '디제잉 입문', lab: true, type: 'web', desc: '컨트롤러를 사기 전에 두 곡의 박을 겹치는 감각부터. 일곱 단계 훈련과 연습 트랙 스무 곡, 실제 기기와 같은 믹서 구성. 음원을 코드로 합성해 박자의 정답을 앱이 알고 있어서 채점이 흔들리지 않아요. 가입·설치 없이 무료.', web: 'https://logiccraft.co.kr/firstmix/' },
  { section: 'edu', group: 'practical', icon: 'school-os', name: 'SCHOOL OS', chip: '학교 설계 시뮬레이션', lab: true, type: 'web', desc: '학교가 오늘 처음 만들어진다면 어떤 모습일까. 8가지 운영 원칙을 직접 정하고 제한된 자원으로 30일을 운영해보는 사고실험 게임. 약 15분, 가입 없이.', web: 'https://logiccraft.co.kr/school-os/' },
  // ⚠️홈 타임라인의 Synergeion 05 Village(15–18세, 예정)와 이름이 겹친다. 다른 제품이다.
  //   여기서는 학교·모임이 쓰는 진행 도구고, 저기는 나이대 라인이다. 이름 정리는 아직 안 됐다.
  { section: 'edu', group: 'practical', icon: 'synergeion-village', name: '시너지언 빌리지', chip: '팀 프로젝트 진행', lab: true, type: 'web', desc: '한 학기 팀 프로젝트를 굴리고 그 과정이 개인의 성장기록으로 남는 도구. 학생은 계정 없이 참여 코드와 이름만으로 들어오고, 주마다 쓴 보고서에 선생님이 답합니다. 개수나 등수를 어디에도 만들지 않아요. 코드 없이 예시 공간을 둘러볼 수 있습니다.', web: 'https://synergeion-village-production-92ed.up.railway.app' },
];
