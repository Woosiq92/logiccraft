/* 매트릭스아이큐 설정/카피. engine.js 가 문항을 만들고, 여기선 화면 구성·문구만.
 * window.DATA 로 노출 (zero-build). */
window.DATA = {
  tabs: [
    { id: 'train', icon: '🧩', label: '훈련' },
    { id: 'mock',  icon: '⏱️', label: '모의' },
    { id: 'stats', icon: '📈', label: '기록' },
    { id: 'me',    icon: '👤', label: '나' },
  ],

  // 문항 타입 정의 (훈련 화면에서 고름)
  types: [
    { id: 'matrix',   icon: '🔳', label: '행렬추론', desc: '3×3 도형에서 빈칸에 들어갈 모양 찾기' },
    { id: 'sequence', icon: '🔢', label: '수열추리', desc: '숫자의 규칙을 찾아 다음 수 맞히기' },
    { id: 'odd',      icon: '🎯', label: '다른 하나', desc: '여섯 중 규칙을 깨는 하나 찾기' },
    { id: 'mixed',    icon: '🌀', label: '섞어풀기', desc: '세 유형을 무작위로 (실전과 유사)' },
  ],

  // 모의고사 설정 — 실제 한국멘사 조건 모사 (45문항·20분, 시작하면 못 멈춤, 해설은 끝나고)
  mock: {
    count: 45,        // 문항 수 (실제 시험과 동일)
    seconds: 1200,    // 제한시간 20분
    difficulty: 3,    // 모의는 난이도 고정(적응형 아님)
    // 실전은 행렬추론(8도형→9번째)이 주력 → 유형 가중 (합 1)
    weights: { matrix: 0.7, sequence: 0.15, odd: 0.15 },
  },

  // 정직한 포지셔닝: IQ 향상이 아니라 "유형 적응 + 시간 전략" 훈련.
  copy: {
    disclaimer: '이 앱은 도형추론 유형에 익숙해지고 시간 전략을 연습하기 위한 훈련 도구입니다. ' +
      '점수는 연습 정도를 보는 참고용이며, 실제 IQ나 멘사 합격을 보장하지 않습니다.',
  },
};
