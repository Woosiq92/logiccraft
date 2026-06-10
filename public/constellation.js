/* LogicCraft — hero 3D constellation.
   A rotating 3D point cloud projected to 2D canvas; nearby nodes link up.
   Pointer steers rotation; idle auto-drift keeps it alive. Cheap + graceful.
   Runs one instance per `canvas.hero-net` found inside a `.hero`/`.page-hero`. */
(function () {
  const canvases = document.querySelectorAll('canvas.hero-net');
  canvases.forEach((canvas) => {
    const hero = canvas.closest('.hero, .page-hero');
    if (hero) initOne(canvas, hero);
  });

  function initOne(canvas, hero) {
    const ctx = canvas.getContext('2d');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let cx = 0, cy = 0;

    // --- build the cloud ---
    const COUNT = finePointer ? 72 : 44;           // fewer nodes on mobile
    const R = 320;                                 // cloud radius (model units)
    const LINK = 138;                              // link distance threshold
    const FOCAL = 620;                             // perspective focal length
    const nodes = [];
    for (let i = 0; i < COUNT; i++) {
      // even-ish distribution in a slightly flattened sphere
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = R * Math.cbrt(Math.random());
      const s = Math.sqrt(1 - u * u);
      nodes.push({
        x: r * s * Math.cos(t),
        y: r * u * 0.7,
        z: r * s * Math.sin(t),
        big: Math.random() < 0.24,
        ph: Math.random() * Math.PI * 2,           // twinkle phase
        sp: 0.6 + Math.random() * 0.8              // twinkle speed
      });
    }

    // rotation state (eased toward target)
    let rx = 0.1, ry = 0, trx = 0.1, try_ = 0;
    let pointerActive = false;
    let idle = 0;

    function resize() {
      const r = hero.getBoundingClientRect();
      W = r.width; H = r.height;
      cx = W / 2; cy = H / 2;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    if (finePointer && !reduceMotion) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5..0.5
        const ny = (e.clientY - r.top) / r.height - 0.5;
        try_ = nx * 0.9;                                   // yaw
        trx = 0.1 + ny * 0.6;                              // pitch
        pointerActive = true;
      });
      hero.addEventListener('pointerleave', () => { pointerActive = false; });
    }

    const proj = new Array(COUNT);

    function draw(ts) {
      // idle drift target when pointer isn't steering
      idle += 0.0026;
      if (!pointerActive) {
        try_ = Math.sin(idle) * 0.5;
        trx = 0.12 + Math.cos(idle * 0.8) * 0.16;
      }
      // ease
      rx += (trx - rx) * 0.05;
      ry += (try_ - ry) * 0.05;
      // continuous slow spin on top, so it never feels frozen
      const spin = reduceMotion ? 0 : ry + idle * 0.12;

      const cosY = Math.cos(spin), sinY = Math.sin(spin);
      const cosX = Math.cos(rx), sinX = Math.sin(rx);

      for (let i = 0; i < COUNT; i++) {
        const n = nodes[i];
        // rotate Y
        let x = n.x * cosY - n.z * sinY;
        let z = n.x * sinY + n.z * cosY;
        // rotate X
        let y = n.y * cosX - z * sinX;
        z = n.y * sinX + z * cosX;
        const scale = FOCAL / (FOCAL + z);
        proj[i] = { sx: cx + x * scale, sy: cy + y * scale, z: z, scale: scale, n: n };
      }

      ctx.clearRect(0, 0, W, H);

      // edges
      ctx.lineWidth = 1.15;
      for (let i = 0; i < COUNT; i++) {
        const a = proj[i];
        for (let j = i + 1; j < COUNT; j++) {
          const b = proj[j];
          const dx = a.n.x - b.n.x, dy = a.n.y - b.n.y, dz = a.n.z - b.n.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < LINK) {
            const depth = (a.scale + b.scale) * 0.5;
            const alpha = (1 - d / LINK) * 0.5 * Math.max(0, (depth - 0.55) / 0.7);
            if (alpha <= 0.01) continue;
            ctx.strokeStyle = 'rgba(150,176,255,' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // nodes (draw far→near)
      const order = proj.slice().sort((p, q) => p.z - q.z);
      const tw = ts * 0.001;
      for (const p of order) {
        const depth = Math.max(0, (p.scale - 0.5) / 0.8);
        const twk = 0.6 + 0.4 * Math.sin(tw * p.n.sp + p.n.ph);
        const baseR = (p.n.big ? 2.8 : 1.8) * p.scale;
        const alpha = (p.n.big ? 1 : 0.82) * depth * twk;
        if (alpha <= 0.02) continue;
        if (p.n.big) {
          const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, baseR * 4.5);
          g.addColorStop(0, 'rgba(157,185,255,' + (alpha * 0.55).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(157,185,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, baseR * 4.5, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(200,216,255,' + alpha.toFixed(3) + ')';
        } else {
          ctx.fillStyle = 'rgba(190,206,255,' + alpha.toFixed(3) + ')';
        }
        ctx.beginPath(); ctx.arc(p.sx, p.sy, baseR, 0, 6.2832); ctx.fill();
      }
    }

    let raf = null;
    function frame(ts) {
      draw(ts);
      raf = requestAnimationFrame(frame);
    }

    resize();
    draw(performance.now());   // guaranteed first paint even if rAF is throttled
    if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); draw(performance.now()); }).observe(hero);
    else window.addEventListener('resize', resize);

    // pause when offscreen to save battery
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
        else if (raf) { cancelAnimationFrame(raf); raf = null; }
      });
    }, { threshold: 0 });
    io.observe(hero);
  }
})();
