// Synergeion — LogicCraft 산하 EdTech 브랜드 우산.
// 5개 연령 라인이 "한 아이의 인생 항해" 하나의 이야기로 연결된다.
// 서사: 🌱 기르기 → 🦫 만들기 → ⛵ 찾기 → ⚒ 집 짓기 → 🛖 마을 짓기
// (출처: ~/synergeion/MARKETING_SERIES_NARRATIVE.md, DESIGN_SYSTEM.md)

export interface SeriesLine {
  key: string;
  name: string; // 라인명 (App Store 등록명은 "Synergeion <name>")
  age: string;
  emoji: string;
  narrative: string; // 한 줄 서사 (서로 이어짐)
  motif: string; // 발달 모티프
  color: string; // 라인 primary
  soft: string; // 라인 soft 배경
  status: '출시' | '개발 중' | '예정';
  href?: string; // App Store 링크 (출시 라인만)
}

export const series = {
  name: 'Synergeion',
  etymology: 'συνεργεῖον — “함께 일하고 성취하는 장소”',
  vision: '생각하는 힘이 문제를 푼다.',
  value: 'AI는 답을 주고, 아이는 푸는 힘을 기릅니다.',
};

export const lines: SeriesLine[] = [
  {
    key: 'wonder',
    name: 'Wonder',
    age: '3–6세',
    emoji: '🌱',
    narrative: '새싹을 길러 자라는 걸 관찰합니다.',
    motif: '경이감 · 이야기 · 부모도 함께 자람',
    color: '#2e9e63',
    soft: '#e6f4ec',
    status: '출시',
    href: 'https://apps.apple.com/kr/app/synergeion-wonder/id6774041352',
  },
  {
    key: 'build',
    name: 'Build',
    age: '6–9세',
    emoji: '🦫',
    narrative: '그 나무로 집과 배를 만듭니다.',
    motif: '손 · 도구 · 만들기',
    color: '#0f766e',
    soft: '#e4f1ef',
    status: '개발 중',
  },
  {
    key: 'voyage',
    name: 'Voyage',
    age: '9–12세',
    emoji: '⛵',
    narrative: '그 배를 타고 새 땅을 찾아 나섭니다.',
    motif: '탐험 · 조사 · 발표',
    color: '#4338ca',
    soft: '#e9ebfb',
    status: '개발 중',
  },
  {
    key: 'forge',
    name: 'Forge',
    age: '12–15세',
    emoji: '⚒',
    narrative: '단조한 도구로 자기만의 집을 짓습니다.',
    motif: '사고 도구 · 자기 정체성',
    color: '#475569',
    soft: '#eef2f6',
    status: '예정',
  },
  {
    key: 'village',
    name: 'Village',
    age: '15–18세',
    emoji: '🛖',
    narrative: '여러 사람과 모여 사는 마을을 짓습니다.',
    motif: '관계망 · 기여 · 진로',
    color: '#b3672f',
    soft: '#f6ece2',
    status: '예정',
  },
];
