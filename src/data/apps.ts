export interface AppLink {
  label: string;
  href: string;
}

export type Category = '교육' | '일상';

export interface AppInfo {
  name: string;
  icon: string; // /icons/*.png — real app/product icon
  blurb: string;
  category: Category;
  status: 'live' | 'soon';
  featured?: boolean;
  links: AppLink[];
}

export const categories: Category[] = ['교육', '일상'];

// Icons are the real product icons copied from each project. Newer apps host their
// support/privacy pages on this site under /apps/<app>/… ; older apps still link out
// to woosiq92.github.io.
export const apps: AppInfo[] = [
  {
    name: '로보트레일',
    icon: '/icons/robotrail.png',
    blurb: '코드 없이 로봇을 움직이며 코딩 사고력을 훈련하는 퍼즐 앱.',
    category: '교육',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6764465655' },
      { label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.smartsikhye.robotrail' },
      { label: '지원', href: 'https://woosiq92.github.io/robotrail/support.html' },
    ],
  },
  {
    name: '과학자 클럽',
    icon: '/icons/science-club.png',
    blurb: '추측·발견·분기·회고 4단계로 매일 한 별씩 켜는 과학 사고 게임.',
    category: '교육',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6771675434' },
      { label: '개인정보', href: 'https://woosiq92.github.io/science-club/privacy.html' },
      { label: '약관', href: 'https://woosiq92.github.io/science-club/terms.html' },
    ],
  },
  {
    name: '왜 그렇게 생각해?',
    icon: '/icons/scienceapp.png',
    blurb: '정답이 아니라 답에 도달하는 사고 과정을 9과목으로 훈련하는 자기주도 학습 플랫폼 (웹).',
    category: '교육',
    status: 'live',
    featured: true,
    links: [{ label: '바로가기', href: 'https://logicschool.co.kr' }],
  },
  {
    name: '커플맵로그',
    icon: '/icons/ourfootprint.png',
    blurb: '둘이 다녀온 동네가 색으로 칠해지는 커플 데이트 점령 지도.',
    category: '일상',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6769797672' },
      { label: '지원', href: '/apps/ourfootprint/support' },
      { label: '개인정보', href: '/apps/ourfootprint/privacy' },
    ],
  },
  {
    name: '불안한개미',
    icon: '/icons/stockwatch.png',
    blurb: '매매 없이 시세만 — 거치대·위젯·잠금화면으로 보는 한국 주식 시세.',
    category: '일상',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6772662894' },
      { label: '지원', href: '/apps/stockwatch/support' },
      { label: '개인정보', href: '/apps/stockwatch/privacy' },
    ],
  },
  {
    name: '세상돌아가는거알아버리기',
    icon: '/icons/sedolal.png',
    blurb: '정치 몰라도 OK. 친구처럼 알려주는 정치·시사 한 토막과 우리 동네 후보·의원 정리.',
    category: '교육',
    status: 'live',
    featured: true,
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/kr/app/id6770908480' },
      { label: '지원', href: '/apps/sedolal/support' },
      { label: '개인정보', href: '/apps/sedolal/privacy' },
    ],
  },
];
