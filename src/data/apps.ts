export interface AppLink {
  label: string;
  href: string;
}

export interface AppInfo {
  name: string;
  emoji: string;
  color: string; // accent for the card icon tile
  blurb: string;
  status: 'live' | 'soon';
  featured?: boolean;
  links: AppLink[];
}

// App support/privacy pages remain hosted on woosiq92.github.io (the apps' own
// infrastructure). The company site links out to them — it does not host them.
export const apps: AppInfo[] = [
  {
    name: '로보트레일',
    emoji: '🤖',
    color: '#F59E0B',
    blurb: '코드 없이 로봇을 움직이며 코딩 사고력을 훈련하는 퍼즐 앱.',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6764465655' },
      { label: '지원', href: 'https://woosiq92.github.io/robotrail/support.html' },
    ],
  },
  {
    name: '과학자 클럽',
    emoji: '🔭',
    color: '#7C3AED',
    blurb: '추측·발견·분기·회고 4단계로 매일 한 별씩 켜는 과학 사고 게임.',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6771675434' },
      { label: '개인정보', href: 'https://woosiq92.github.io/science-club/privacy.html' },
      { label: '약관', href: 'https://woosiq92.github.io/science-club/terms.html' },
    ],
  },
  {
    name: '커플맵로그',
    emoji: '💞',
    color: '#EC4899',
    blurb: '둘이 다녀온 동네가 색으로 칠해지는 커플 데이트 점령 지도.',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6769797672' },
      { label: '개인정보', href: 'https://woosiq92.github.io/ourfootprint/privacy.html' },
      { label: '지원', href: 'https://woosiq92.github.io/ourfootprint/support.html' },
    ],
  },
  {
    name: '불안한개미',
    emoji: '📈',
    color: '#2563EB',
    blurb: '매매 없이 시세만 — 거치대·위젯·잠금화면으로 보는 한국 주식 시세.',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6772662894' },
      { label: '개인정보', href: 'https://woosiq92.github.io/stockwatch/privacy.html' },
    ],
  },
  {
    name: '왜 그렇게 생각해?',
    emoji: '🤔',
    color: '#4F46E5',
    blurb: '정답이 아니라 답에 도달하는 사고 과정을 9과목으로 훈련하는 자기주도 학습 플랫폼 (웹).',
    status: 'live',
    featured: true,
    links: [{ label: '바로가기', href: 'https://logicschool.co.kr' }],
  },
  {
    name: '폴리톡',
    emoji: '⚖️',
    color: '#0EA5E9',
    blurb: '뉴스를 30초로 파악하고 내 의견을 정리하는 정치 리터러시 앱.',
    status: 'soon',
    links: [],
  },
];
