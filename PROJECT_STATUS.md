# 로직크래프트 사이트 — PROJECT STATUS

회사 공식 사이트 `logiccraft.co.kr`의 구현 스냅샷(= 단일 진실원). 사이트 자체는 광고 없음.
앱 광고 인프라(AdMob `app-ads.txt`)도 이제 이 사이트가 호스팅(`public/app-ads.txt` → `logiccraft.co.kr/app-ads.txt`). 구 `woosiq92.github.io`는 2026-06-11 삭제·은퇴.

---

## 스택 / 구조

- **Astro 5** 바닐라 (Three.js 폐기 — 2026-06-09). 의존성: `astro`, `@astrojs/sitemap`.
- 위치 `~/logiccraft-site` · 레포 `Woosiq92/logiccraft` · 도메인 `logiccraft.co.kr`(apex).
- 폰트: Pretendard Variable + IBM Plex Mono(Layout `<head>`에서 CDN 로드).

```
src/
  layouts/Layout.astro      SEO 메타·JSON-LD·폰트·푸터 뒤 <script src="/site.js">
  components/Nav.astro       헤더 + 모바일 햄버거(active·문맥별 CTA)
  components/Footer.astro    푸터
  styles/global.css          디자인 시스템(시안 styles.css) + 법적페이지 토큰 별칭
  pages/
    index · synergeion · apps · about · contact   ← 마케팅 5
    apps/<app>/{privacy,terms,support,delete-data} ← 법적 18 (App Store/Play 링크 대상)
public/
  site.js                    공유 JS(스티키 헤더·모바일 메뉴·.reveal·히어로 틸트·여정 스파인)
  mascots/{naru,neti}.png · icons/*.png · logo-mark.png · logo-full.png · book-cover.jpg
```

빌드: `npm run build` → 23페이지(마케팅 5 + 법적 18). 개발: `npm run dev` → `localhost:4321`.

---

## 디자인 시스템 (2026-06-09 클로드 디자인 시안 이식)

- 팔레트: navy 잉크 `#11183a` + 브랜드 블루 `#2f63f4` + 클레이 액센트 `#cf8350`.
  라인별 색 토큰 `--st-wonder/build/voyage/forge/village`.
- 히어로: 별가루 dot-field(navy radial) + 나루·느티 마스코트 패널(포인터 3D 틸트).
- 컴포넌트: `.pcard`(제품 카드)·여정 타임라인(`.journey`/`.stage`/스크롤 스파인 채움)·
  `.principle`·`.bizcard`·`.contact-card`·미디어 밴드.
- 제품 데이터는 **`src/data/products.js` 단일 소스**(2026-06-24 SSOT 재도입).
  홈(`index.astro`)·제품목록(`apps.astro`)이 이 배열을 import해 공용
  `src/components/ProductCard.astro`로 렌더. 교육/일상 카운트도 데이터에서 파생.
  → **새 앱 추가·수정 = `products.js` 한 줄.** 카드 마크업은 `ProductCard.astro` 한 곳에만 존재.
  예외(일회성 마크업, 직접 편집): 홈의 Wonder 피처 카드(마스코트 아트)·`apps.astro`의
  Synergeion 여정 타임라인(`.journey`/`.stage`). 상세 페이지·법적 페이지는 여전히
  `src/pages/apps/<slug>/`에 개별 추가.

### 법적 페이지 보존 트릭 (중요)

`/apps/*` 18개 문서 페이지는 각자 `<style>`에서 옛 토큰(`--sub`, `--border`,
`--accent-deep`, `--bg`, `--bg-alt`)을 참조한다. `global.css` `:root`에 그 별칭을
**새 팔레트로 매핑**하는 블록이 있어, 디자인 토큰을 바꿔도 법적 페이지가 새
nav/footer/팔레트를 입은 채 문서 스타일을 유지한다. 기본 세로 리듬은 `section.wrap`
에만 적용해 마케팅 `.hero` 등 클래스 섹션은 건드리지 않는다.
→ **이 별칭 블록을 지우면 App Store/Play 심사 링크의 문서 페이지가 깨진다.**

---

## 배포

- `main` push → GitHub Actions(`.github/workflows/deploy.yml`) → GitHub Pages, ~1분.
- 워크플로: `actions/checkout@v5` + `withastro/action@v3` + `actions/deploy-pages@v4`,
  env `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`(Node20 deprecation 대응).
- 확인: `gh run list --limit 1`. DNS=가비아 apex A(185.199.108~111.153)+www CNAME.
- SEO: `@astrojs/sitemap` 자동 사이트맵 + `robots.txt` + 네이버 인증 메타. 구글/네이버 등록 완료.

---

## 제품 라인업 (현재 노출)

- 교육: 로보트레일 · 과학자 클럽 · 왜 그렇게 생각해?(웹, logicschool.co.kr) · Synergeion Wonder(피처)
- 일상: 커플맵로그 · 불안한개미 · 세상돌아가는거알아버리기
- 시리즈: [Synergeion](https://logiccraft.co.kr/synergeion) 5라인(Wonder 출시 / Build·Voyage 개발 중 / Forge·Village 예정)

## 사업자

로직크래프트(LogicCraft) · 대표 최우식 · 사업자등록번호 302-11-03141 · smartsikhye@gmail.com
