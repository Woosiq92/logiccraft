/* LogicCraft — shared site behavior. Every block guards for missing elements,
   so the same file works on every page. */
(function () {
  // sticky header border
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }

  // mobile menu
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    const close = () => { document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
    menuBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('#mobileMenu a').forEach(a => a.addEventListener('click', close));
  }

  // scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el, i) => { el.style.transitionDelay = (Math.min(i % 4, 3) * 60) + 'ms'; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  requestAnimationFrame(() => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    reveals.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.95) el.classList.add('in'); else io.observe(el);
    });
  });
  setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < (window.innerHeight || 0)) el.classList.add('in');
  }), 1500);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- Hero: pointer-parallax 3D tilt (subtle) ---- */
  (function heroTilt() {
    if (reduceMotion || !finePointer) return;
    const panel = document.getElementById('mascotPanel');
    const art = panel && panel.closest('.feat-art');
    const row = panel && panel.querySelector('.mascot-row');
    const glare = panel && panel.querySelector('.glare');
    if (!art || !panel) return;
    const MAX = 4.5;
    let raf = null, nx = 0, ny = 0;
    const apply = () => {
      raf = null;
      panel.style.setProperty('--ry', (nx * MAX).toFixed(2) + 'deg');
      panel.style.setProperty('--rx', (-ny * MAX).toFixed(2) + 'deg');
      if (row) row.style.transform = 'translate3d(' + (nx * -9).toFixed(1) + 'px,' + (ny * -7).toFixed(1) + 'px,24px)';
      if (glare) { glare.style.setProperty('--glx', (34 + nx * 38) + '%'); glare.style.setProperty('--gly', (18 + ny * 38) + '%'); }
    };
    art.addEventListener('pointermove', (e) => {
      const r = art.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width - 0.5;
      ny = (e.clientY - r.top) / r.height - 0.5;
      panel.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    art.addEventListener('pointerleave', () => {
      panel.classList.remove('is-tilting');
      panel.style.setProperty('--rx', '0deg'); panel.style.setProperty('--ry', '0deg');
      if (row) row.style.transform = 'translate3d(0,0,24px)';
    });
  })();

  /* ---- Home: series strip pointer-parallax 3D tilt ---- */
  (function stripTilt() {
    if (reduceMotion || !finePointer) return;
    const strip = document.getElementById('synStrip');
    if (!strip) return;
    const MAX = 8;
    let raf = null, nx = 0, ny = 0;
    const apply = () => {
      raf = null;
      strip.style.setProperty('--ry', (nx * MAX).toFixed(2) + 'deg');
      strip.style.setProperty('--rx', (-ny * MAX * 0.55).toFixed(2) + 'deg');
    };
    strip.addEventListener('pointermove', (e) => {
      const r = strip.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width - 0.5;
      ny = (e.clientY - r.top) / r.height - 0.5;
      strip.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    strip.addEventListener('pointerleave', () => {
      strip.classList.remove('is-tilting');
      strip.style.setProperty('--rx', '0deg');
      strip.style.setProperty('--ry', '0deg');
    });
  })();

  /* ---- Synergeion: scroll-linked journey spine + node activation ---- */
  (function journeyTrack() {
    const journey = document.querySelector('.journey');
    const fill = document.getElementById('spineFill');
    if (!journey || !fill) return;
    const stages = [...journey.querySelectorAll('.stage')];
    let raf = null;
    const update = () => {
      raf = null;
      const r = journey.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const line = vh * 0.62;
      let p = (line - r.top) / r.height;
      p = Math.max(0, Math.min(1, p));
      fill.style.height = (p * 100) + '%';
      stages.forEach((st) => {
        const sr = st.getBoundingClientRect();
        st.classList.toggle('active', sr.top + sr.height / 2 < line);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();
})();

/* 방문자 카운터. 어느 페이지로 들어오든 1회 집계, 같은 브라우저는 하루 1번만(localStorage).
   Railway 배포 후 받은 도메인으로 COUNTER_API 를 교체할 것. 미설정/실패 시 조용히 숨김. */
(function () {
  var COUNTER_API = 'https://logiccraft-counter-production.up.railway.app';
  var box = document.querySelector('.visit-count');
  if (!box || COUNTER_API.indexOf('REPLACE-ME') !== -1) return;

  var fmt = function (n) { return Number(n).toLocaleString('ko-KR'); };
  var show = function (d) {
    if (!d) return;
    document.getElementById('visitToday').textContent = fmt(d.today);
    document.getElementById('visitTotal').textContent = fmt(d.total);
    box.hidden = false;
  };

  var day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  var fresh = false;
  try { fresh = !localStorage.getItem('lc_visit_' + day); } catch (e) {}

  fetch(COUNTER_API + (fresh ? '/hit' : '/count'), { method: fresh ? 'POST' : 'GET' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (fresh) { try { localStorage.setItem('lc_visit_' + day, '1'); } catch (e) {} } show(d); })
    .catch(function () {});
})();
