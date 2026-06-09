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
    const art = document.querySelector('.hero-art');
    const panel = document.getElementById('mascotPanel');
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
