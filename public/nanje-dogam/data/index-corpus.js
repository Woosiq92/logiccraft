/* 난제도감 — 색인 코퍼스 (기계 수집 + 사람 판정)
 *
 * 정독 코퍼스(problems.js)와 층이 다르다. 여기에는 해설을 쓰지 않는다.
 * 제목·분야·출처 링크뿐이며, 앱은 이 항목을 열 때 "해설 없음"을 정직하게 표시한다.
 * 정독으로 승격하면 여기서 지운다(같은 문제가 두 층에 동시에 있으면 tests/data.test.js 가 막는다).
 *
 * 갱신: node scripts/fetch-sources.mjs → 후보 diff 출력 → 사람이 판정해 이 파일에 반영.
 * 스크레이퍼가 이 파일을 직접 덮어쓰지 않는다(오보 방지).
 * generated: seed / 검토일 2026-07-31
 */
window.INDEX_CORPUS = [
  // 정수론
  { id: 'x_firoozbakht', ko: '피루즈바흐트 추측',        en: "Firoozbakht's conjecture", field: 'nt' },
  { id: 'x_singmaster',  ko: '싱마스터 추측',            en: "Singmaster's conjecture", field: 'nt' },
  { id: 'x_agoh',        ko: '아고–지우가 추측',          en: 'Agoh–Giuga conjecture', field: 'nt' },
  { id: 'x_hall',        ko: '홀 추측',                  en: "Hall's conjecture", field: 'nt' },
  { id: 'x_pillai',      ko: '필라이 추측',              en: "Pillai's conjecture", field: 'nt' },
  { id: 'x_waring',      ko: '웨어링 문제의 G(k)',        en: 'Waring problem, exact G(k)', field: 'nt' },
  { id: 'x_class_num',   ko: '실 이차체 유수 문제',        en: 'Class number problem for real quadratic fields', field: 'nt' },
  { id: 'x_leopoldt',    ko: '레오폴트 추측',            en: "Leopoldt's conjecture", field: 'nt' },
  { id: 'x_szpiro',      ko: '시피로 추측',              en: "Szpiro's conjecture", field: 'nt' },

  // 대수·기하
  { id: 'x_standard',    ko: '표준 추측',                en: 'Standard conjectures on algebraic cycles', field: 'alg' },
  { id: 'x_bombieri',    ko: '봄비에리–랑 추측',          en: 'Bombieri–Lang conjecture', field: 'alg' },
  { id: 'x_zariski',     ko: '자리스키 소거 문제',         en: 'Zariski cancellation problem', field: 'alg' },
  { id: 'x_kaplansky',   ko: '캐플런스키 추측',           en: "Kaplansky's conjectures", field: 'alg' },
  { id: 'x_sendov',      ko: '센도프 추측',              en: "Sendov's conjecture", field: 'alg' },

  // 위상·기하
  { id: 'x_schoenflies', ko: '매끄러운 쇤플리스 문제',      en: 'Smooth Schoenflies problem', field: 'top' },
  { id: 'x_slice',       ko: '슬라이스–리본 추측',        en: 'Slice-ribbon conjecture', field: 'top' },
  { id: 'x_novikov',     ko: '노비코프 추측',            en: 'Novikov conjecture', field: 'top' },
  { id: 'x_baum_connes', ko: '밤–콘 추측',               en: 'Baum–Connes conjecture', field: 'top' },
  { id: 'x_whitehead',   ko: '휘트헤드 점근 추측',         en: 'Whitehead asphericity conjecture', field: 'top' },
  { id: 'x_andrews',     ko: '앤드루스–커티스 추측',       en: 'Andrews–Curtis conjecture', field: 'top' },
  { id: 'x_sofic',       ko: '소픽 군 문제',             en: 'Sofic group problem', field: 'top' },

  // 조합·그래프
  { id: 'x_ramsey_gr',   ko: '램지 수의 증가율',          en: 'Growth rate of Ramsey numbers', field: 'comb' },
  { id: 'x_erdos_gyarfas', ko: '에르되시–자르파시 추측',    en: 'Erdős–Gyárfás conjecture', field: 'comb' },
  { id: 'x_hirsch',      ko: '다항 히르쉬 추측',          en: 'Polynomial Hirsch conjecture', field: 'comb' },

  // 계산·복잡도
  { id: 'x_pspace',      ko: 'P 대 PSPACE',             en: 'P versus PSPACE', field: 'cs' },
  { id: 'x_bpp_p',       ko: 'BPP 대 P',                en: 'BPP versus P', field: 'cs' },
  { id: 'x_circuit',     ko: '명시적 회로 하한',          en: 'Explicit circuit lower bounds', field: 'cs' },
  { id: 'x_lattice',     ko: '격자 문제의 근사 난이도',     en: 'Hardness of approximating lattice problems', field: 'cs' },

  // 논리·집합
  { id: 'x_woodin',      ko: '거대 기수 계층의 정합성',     en: 'Consistency of large cardinal axioms', field: 'logic' },
  { id: 'x_pcf',         ko: '셸라의 PCF 이론 문제',       en: 'Problems in Shelah PCF theory', field: 'logic' },
  { id: 'x_regularity',  ko: '규칙성 성질과 결정성',       en: 'Regularity properties and determinacy', field: 'logic' },
  { id: 'x_hilbert10_q', ko: '유리수 위의 힐베르트 10번',   en: "Hilbert's tenth problem over the rationals", field: 'logic' },

  // 해석·미분방정식
  { id: 'x_bloch',       ko: '블로흐 상수의 정확한 값',     en: 'Exact value of the Bloch constant', field: 'ana' },
  { id: 'x_hot_spots',   ko: '핫스팟 추측',              en: 'Hot spots conjecture', field: 'ana' },
  { id: 'x_lieb',        ko: '리브–씨링 상수 문제',        en: 'Lieb–Thirring constant', field: 'ana' },
  { id: 'x_restriction', ko: '제한 추측',                en: 'Restriction conjecture', field: 'ana' },
  { id: 'x_bochner',     ko: '보흐너–리스 추측',          en: 'Bochner–Riesz conjecture', field: 'ana' },
  { id: 'x_arnold',      ko: '아널드 확산',              en: 'Arnold diffusion', field: 'ana' },
];
