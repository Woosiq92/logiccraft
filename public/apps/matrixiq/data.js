/* 매트릭스아이큐 설정/카피. engine.js 가 문항을 만들고, 여기선 화면 구성·문구만.
 * window.DATA 로 노출 (zero-build). */
window.DATA = {
  tabs: [
    { id: 'train', label: '훈련' },
    { id: 'mock',  label: '모의' },
    { id: 'stats', label: '기록' },
  ],

  // 문항 타입 정의 (훈련 화면에서 고름)
  types: [
    { id: 'matrix',   icon: '🔳', label: '행렬추론', desc: '3×3 도형에서 빈칸에 들어갈 모양 찾기' },
    { id: 'sequence', icon: '🔢', label: '수열추리', desc: '숫자의 규칙을 찾아 다음 수 맞히기' },
    { id: 'odd',      icon: '🎯', label: '다른 하나', desc: '여섯 중 규칙을 깨는 하나 찾기' },
    { id: 'calc',     icon: '🧮', label: '응용수리', desc: '거리·농도·비율·경우의 수 계산' },
    { id: 'verbal',   icon: '💬', label: '언어논리', desc: '순서배열·명제·삼단논법 추론' },
    { id: 'spatial',  icon: '🧊', label: '공간지각', desc: '도형 회전·대칭 추론' },
    { id: 'mixed',    icon: '🌀', label: '섞어풀기', desc: '여러 유형을 무작위로 (실전과 유사)' },
  ],

  // 모의고사 설정 — 인적성 추론(도형·수리) 파트 시간압박 모사 (45문항·20분, 시작하면 못 멈춤, 해설은 끝나고)
  mock: {
    count: 45,        // 문항 수
    seconds: 1200,    // 제한시간 20분
    difficulty: 3,    // 모의는 난이도 고정(적응형 아님)
    // 유형 가중 (합 1) — 추론·수리·공간 6유형 분산
    weights: { matrix: 0.2, sequence: 0.15, odd: 0.15, calc: 0.2, verbal: 0.15, spatial: 0.15 },
  },

  // 정직한 포지셔닝: 인적성 적성검사 추론·수리 유형의 "유형 적응 + 시간 전략" 훈련 (어휘·독해·SJT·인성 제외).
  copy: {
    disclaimer: '이 앱은 인적성 적성검사의 추론·수리 유형(도형·수열·응용계산 등)에 익숙해지고 시간 전략을 연습하기 위한 훈련 도구입니다. ' +
      '어휘·독해·상황판단·인성검사는 다루지 않으며, 점수는 연습 정도를 보는 참고용으로 합격을 보장하지 않습니다.',
  },
};
