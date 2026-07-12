// 제품 데이터 — 단일 소스(single source of truth).
// 홈(index.astro)과 제품 목록(apps.astro)이 이 배열을 함께 import해 ProductCard로 렌더한다.
// 새 앱 추가 = 여기에 한 줄. 카드 마크업은 src/components/ProductCard.astro 한 곳에만 존재.
//   section: 'edu' | 'daily' → 카드 그리드. 'series' → 카운트용(카드는 Synergeion 타임라인에서 별도 렌더).
//   type: 'app'(ios/play) | 'web'(web). ios/play 가 null 이면 "(예정)" 버튼.
//   group(edu 전용): 'thinking'(어린이 사고력) | 'exam'(시험·자격) | 'practical'(실용·자기주도) → 홈 교육 하위 분류.
export const products = [
  // Synergeion 시리즈 (카운트용 · 카드는 타임라인에서 렌더)
  { name: 'Synergeion Wonder', type: 'app', section: 'series' },
  { name: 'Synergeion Build', type: 'app', section: 'series' },
  // 교육
  { section: 'edu', group: 'exam', slug: 'psattriage', icon: 'psattriage', name: '데일리 PSAT', chip: 'PSAT·공시', type: 'app', desc: '기출 문제은행이 아니라, 시간배분·버리기·매몰비용을 측정하는 트리아지 트레이너. 자료·논리 감각을 단계로 훈련.', ios: 'https://apps.apple.com/kr/app/id6781955472', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.psattriage' },
  { section: 'edu', group: 'thinking', slug: 'robotrail', icon: 'robotrail', name: '로보트레일', chip: '컴퓨팅 사고력', type: 'app', desc: '코드 없이 명령 퍼즐로 코딩 사고력을 측정·훈련하는 앱. 학습 108판 + 측정 36문제 + 도전 모드.', ios: 'https://apps.apple.com/kr/app/id6764465655', play: 'https://play.google.com/store/apps/details?id=com.smartsikhye.robotrail' },
  { section: 'edu', group: 'practical', slug: 'science-club', icon: 'science-club', name: '과학자 클럽', chip: '과학', type: 'app', desc: '추측·발견·분기·회고 4단계로 매일 한 별씩 켜는 과학 사고 게임.', ios: 'https://apps.apple.com/kr/app/id6771675434', play: null },
  { section: 'edu', group: 'practical', slug: 'scienceapp', icon: 'scienceapp', name: '왜 그렇게 생각해?', chip: '융합 사고력', type: 'web', desc: '정답이 아니라 답에 도달하는 사고 과정을 9과목으로 훈련하는 자기주도 학습 플랫폼(웹).', web: 'https://logicschool.co.kr' },
  { section: 'edu', group: 'exam', slug: 'certnote', icon: 'certnote', name: '모두의 자격증', chip: '자격증', type: 'app', desc: '오늘의 훈련·정리 글·빠른 모의고사는 무료, 전체 문제은행·실전 모드는 합격팩으로. 자격증 시험 공부를 한 곳에서.', ios: 'https://apps.apple.com/kr/app/id6779944719', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.certnote' },
  { section: 'edu', group: 'thinking', slug: 'topbattle', icon: 'topbattle', name: '브레인블레이드', chip: '학습 배틀', type: 'app', desc: '팽이 배틀과 학습 퀴즈를 합친 두뇌 게임. 빠르고 정확하게 맞힐수록 강한 일격이 나가요. 구구단·영단어·한자·세계·바른말 5과목.', ios: 'https://apps.apple.com/kr/app/id6780302277', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.topbattle' },
  { section: 'edu', group: 'exam', slug: 'eduessay', icon: 'eduessay', name: '교논 트레이너', chip: '중등임용', type: 'app', desc: '중등임용 1교시 교육학 논술 올인원. 기출 개념 인출·간격 반복 복습, 50분 논제 실전, 객관식 모의고사를 인터넷·로그인 없이.', ios: 'https://apps.apple.com/kr/app/id6781959302', play: 'https://play.google.com/store/apps/details?id=kr.logiccraft.eduessay' },
  { section: 'edu', group: 'practical', slug: 'prompt-dojo', icon: 'prompt-dojo', name: '프롬프트 도장', chip: 'AI 프롬프트', type: 'web', desc: 'AI가 답하는 방식에 기반해, 좋은 프롬프트의 5가지를 문제로 풀며 익히는 훈련. 기초부터 코딩·글쓰기·영상까지 무료로, 가입·설치 없이.', web: 'https://logiccraft.co.kr/prompt-dojo/' },
  // 일상
  { section: 'daily', slug: 'wedding-map', icon: 'wedding-map', name: '웨딩맵', chip: '결혼 준비', warm: true, type: 'web', desc: '전국 결혼식장(민간·공공·호텔)을 지도에서 한눈에 보고, 받은 견적을 표로 비교해 정하는 도구. 가입·설치 없이 양가와 공유까지.', web: 'https://logiccraft.co.kr/wedding-map/' },
  { section: 'daily', slug: 'ourfootprint', icon: 'ourfootprint', name: '커플맵로그', chip: '지도', warm: true, type: 'app', desc: '둘이 다녀온 동네가 색으로 칠해지는 커플 점령 지도. 우리만의 맛집 등급도 직접 만들어요.', ios: 'https://apps.apple.com/kr/app/id6769797672', play: 'https://play.google.com/store/apps/details?id=com.logiccraft.ourfootprint' },
  { section: 'daily', slug: 'stockwatch', icon: 'stockwatch', name: '불안한개미', chip: '주식 시세', warm: true, type: 'app', desc: '매매 없이 시세만 — 거치대·위젯·잠금화면으로 보는 한국 주식 시세.', ios: 'https://apps.apple.com/kr/app/id6772662894', play: 'https://play.google.com/store/apps/details?id=com.logiccraft.stockwatch' },
  { section: 'daily', slug: 'yangmyeon', icon: 'yangmyeon', name: '양면', chip: '중도정치', warm: true, type: 'web', desc: '하나의 정치 쟁점을 가운데 사실관계 위에 놓고, 양옆에 찬성과 반대의 가장 강한 논거를 나란히. 어느 쪽이 옳은지 정해주지 않고, 무엇이 사실이고 무엇이 해석인지 구분하도록 돕는 사이트.', web: 'https://중도정치.kr' },
  { section: 'daily', slug: 'stage-radar', icon: 'stage-radar', name: '공연 발견', chip: '공연·페스티벌', warm: true, type: 'web', desc: '오늘 비는 날 갈 수 있는 공연·페스티벌만 — 끝난 것·상설은 빼고 날짜·지역·장르·가격으로 고르고, 라인업 검색과 인기순까지. 공연예술통합전산망(KOPIS) 데이터.', web: 'https://stage-radar-production.up.railway.app' },
  { section: 'daily', slug: 'goalcast', icon: 'goalcast', name: '목표 캘린더', chip: '목표·할 일', warm: true, type: 'web', desc: '한 해의 큰 목표를 월→주→일 할 일로 쪼개 관리하는 달력. 목표별 색·진행률로 무엇에 얼마나 다가갔는지 한눈에. 가입·설치 없이 브라우저에 저장.', web: 'https://logiccraft.co.kr/goalcast/' },
];
