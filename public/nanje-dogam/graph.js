/* 난제도감 — 관계 지도 (canvas, zero-dep)
 *
 * 목록으로 표현되지 않는 정보는 "A가 풀리면 B도 풀린다"는 함의 구조뿐이다. 이 화면만 그 구조를 보여준다.
 * 레이아웃은 결정론적이다(초기 배치를 인덱스로 고정). 매번 같은 그림이라야 사용자가 위치를 기억한다.
 */
window.NanjeGraph = (function () {
  'use strict';

  var raf = null;

  function mount(canvas, selEl, P, M, focusId, field) {
    if (!canvas) return;
    if (raf) { cancelAnimationFrame(raf); raf = null; }

    // 관계가 하나라도 있는 문제만 그린다 (고립점은 지도에서 의미가 없다)
    var deg = {};
    P.forEach(function (p) {
      (p.rel || []).forEach(function (r) {
        if (!P.some(function (x) { return x.id === r.to; })) return;
        deg[p.id] = (deg[p.id] || 0) + 1;
        deg[r.to] = (deg[r.to] || 0) + 1;
      });
    });

    /* 분야를 고르면 그 분야와 직접 이웃만 남긴다.
     * 60개가 넘으면 폰 화면에서 이름이 절반 넘게 가려져 지도가 그림으로만 남는다. */
    var keep = null;
    if (field) {
      keep = {};
      P.forEach(function (p) {
        if (p.field !== field || !deg[p.id]) return;
        keep[p.id] = 1;
        (p.rel || []).forEach(function (r) { keep[r.to] = 1; });
      });
      P.forEach(function (p) {
        (p.rel || []).forEach(function (r) {
          var t = P.filter(function (x) { return x.id === r.to; })[0];
          if (t && t.field === field) keep[p.id] = 1;
        });
      });
    }

    var nodes = P.filter(function (p) {
      return deg[p.id] && (!keep || keep[p.id]);
    }).map(function (p, i, arr) {
      var a = (i / arr.length) * Math.PI * 2;
      return {
        id: p.id, p: p, deg: deg[p.id],
        x: Math.cos(a) * 120, y: Math.sin(a) * 120, vx: 0, vy: 0,
        r: 7 + Math.min(deg[p.id], 5) * 1.6,
      };
    });
    var index = {};
    nodes.forEach(function (n) { index[n.id] = n; });

    // 양쪽 문제에 서로를 가리키는 관계가 적혀 있으면 같은 선이 두 번 그려진다. 쌍 단위로 한 번만 담는다.
    var links = [], seen = {};
    P.forEach(function (p) {
      (p.rel || []).forEach(function (r) {
        if (!index[p.id] || !index[r.to]) return;
        var key = [p.id, r.to].sort().join('|');
        if (seen[key]) return;
        seen[key] = 1;
        links.push({ a: index[p.id], b: index[r.to], t: r.t });
      });
    });

    // ── 힘 시뮬레이션 (고정 횟수, 결정론적) ──
    // 척력을 세게 잡는다. 라벨이 겹치면 지도의 유일한 값어치인 "무엇이 무엇과 이어졌나"가 사라진다.
    for (var step = 0; step < 600; step++) {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.vx -= n.x * 0.0013; n.vy -= n.y * 0.0013;      // 중심으로
        for (var j = i + 1; j < nodes.length; j++) {
          var m = nodes[j];
          var dx = n.x - m.x, dy = n.y - m.y;
          var d2 = dx * dx + dy * dy || 0.01;
          var d = Math.sqrt(d2);
          var f = 2600 / d2;
          // 세로로 더 밀어낸다 — 라벨은 점 아래에 깔리므로 상하 간격이 더 필요하다
          n.vx += dx / d * f; n.vy += dy / d * f * 1.7;
          m.vx -= dx / d * f; m.vy -= dy / d * f * 1.7;
        }
      }
      links.forEach(function (l) {
        var dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var f = (d - 96) * 0.011;                          // 용수철
        l.a.vx += dx / d * f; l.a.vy += dy / d * f;
        l.b.vx -= dx / d * f; l.b.vy -= dy / d * f;
      });
      nodes.forEach(function (n) {
        n.x += n.vx; n.y += n.vy; n.vx *= 0.82; n.vy *= 0.82;
      });
    }

    // ── 화면 좌표로 정규화 ──
    var pad = 26;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });

    var sel = focusId && index[focusId] ? index[focusId] : null;

    function resize() {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.parentNode.clientWidth;
      /* 폰은 폭이 묶여 있어 늘릴 수 있는 축이 세로뿐이라 점이 많을수록 길어진다.
         넓은 화면에서는 반대로 가로가 남으므로, 세로로 길게 뽑으면 스크롤만 생기고 읽기 나빠진다. */
      var h;
      if (w >= 720) {
        h = Math.max(520, Math.min(860, Math.round(w * (nodes.length > 40 ? 0.72 : 0.56))));
      } else {
        var ratio = nodes.length > 40 ? 2.3 : (nodes.length > 20 ? 1.7 : 1.2);
        h = Math.max(380, Math.min(1100, Math.round(w * ratio)));
      }
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* 가로세로를 따로 늘려 캔버스를 꽉 채운다.
       * 같은 배율을 쓰면 세로로 긴 캔버스에 빈 여백만 생기고 라벨 자리는 그대로다.
       * 힘 배치의 절대 비율에는 의미가 없으므로 늘려도 정보가 왜곡되지 않는다. */
      var sx = (w - pad * 2) / (maxX - minX || 1);
      var sy = (h - pad * 2 - 12) / (maxY - minY || 1);
      nodes.forEach(function (n) {
        n.sx = pad + (n.x - minX) * sx;
        n.sy = pad + 6 + (n.y - minY) * sy;
      });
      draw();
    }

    function draw() {
      var ctx = canvas.getContext('2d');
      var w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      links.forEach(function (l) {
        var hot = sel && (l.a === sel || l.b === sel);
        ctx.strokeStyle = hot ? 'rgba(30,58,95,.75)' : 'rgba(120,130,145,.28)';
        ctx.lineWidth = hot ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(l.a.sx, l.a.sy);
        ctx.lineTo(l.b.sx, l.b.sy);
        ctx.stroke();
        if (l.t === 'implies' || l.t === 'impliedby') {   // 방향이 있는 관계만 화살촉
          var from = l.t === 'implies' ? l.a : l.b, to = l.t === 'implies' ? l.b : l.a;
          var ang = Math.atan2(to.sy - from.sy, to.sx - from.sx);
          var tx = to.sx - Math.cos(ang) * (to.r + 3), ty = to.sy - Math.sin(ang) * (to.r + 3);
          ctx.fillStyle = hot ? 'rgba(30,58,95,.8)' : 'rgba(120,130,145,.45)';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - Math.cos(ang - 0.4) * 7, ty - Math.sin(ang - 0.4) * 7);
          ctx.lineTo(tx - Math.cos(ang + 0.4) * 7, ty - Math.sin(ang + 0.4) * 7);
          ctx.fill();
        }
      });

      nodes.forEach(function (n) {
        var f = M.fields[n.p.field];
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.p.status === 'solved' ? '#ffffff' : f.color;
        ctx.fill();
        ctx.lineWidth = n === sel ? 3 : 1.5;
        ctx.strokeStyle = n === sel ? '#1e3a5f' : f.color;
        ctx.stroke();
      });

      // 라벨은 겹치면 버린다. 겹쳐 쓴 이름은 읽을 수 없어서 없느니만 못하다.
      // 이어진 문제가 많은 순으로 자리를 먼저 잡고, 선택된 점은 무조건 그린다.
      // 점 위에 글자가 얹히는 것도 겹침이므로, 모든 점을 미리 자리 잡힌 것으로 친다.
      var placed = nodes.map(function (n) {
        return { x1: n.sx - n.r, y1: n.sy - n.r, x2: n.sx + n.r, y2: n.sy + n.r };
      });
      var nodeBoxes = placed.length;
      var order = nodes.slice().sort(function (a, b) {
        return (b === sel ? 1e9 : b.deg) - (a === sel ? 1e9 : a.deg);
      });
      order.forEach(function (n) {
        var isSel = n === sel;
        ctx.font = (isSel ? '600 ' : '') + '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
        var tw = ctx.measureText(n.p.ko).width;
        // 아래가 막히면 위·오른쪽·왼쪽 순으로 자리를 찾는다. 한 자리만 시도하면 이름이 절반 넘게 사라진다.
        var cands = [
          { x: n.sx, y: n.sy + n.r + 12, align: 'center' },
          { x: n.sx, y: n.sy - n.r - 5,  align: 'center' },
          { x: n.sx + n.r + 5, y: n.sy + 4, align: 'left' },
          { x: n.sx - n.r - 5, y: n.sy + 4, align: 'right' },
        ];
        var pick = null;
        for (var ci = 0; ci < cands.length; ci++) {
          var c = cands[ci];
          var x1 = c.align === 'center' ? c.x - tw / 2 : (c.align === 'left' ? c.x : c.x - tw);
          x1 = Math.max(8, Math.min(w - tw - 8, x1));       // 가장자리 잘림 방지(여백 8px)
          var box = { x1: x1 - 2, y1: c.y - 9, x2: x1 + tw + 2, y2: c.y + 3 };
          if (box.y1 < 0 || box.y2 > h) continue;
          var hit = placed.some(function (b) {
            return !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2);
          });
          if (!hit) { pick = { box: box, x: x1, y: c.y }; break; }
        }
        if (!pick) {
          if (!isSel) return;
          var sx1 = Math.max(8, Math.min(w - tw - 8, n.sx - tw / 2));
          pick = { box: { x1: sx1 - 2, y1: n.sy + n.r + 3, x2: sx1 + tw + 2, y2: n.sy + n.r + 15 },
                   x: sx1, y: n.sy + n.r + 12 };
        }
        placed.push(pick.box);
        ctx.textAlign = 'left';
        if (isSel) {                                        // 선택된 이름은 배경을 깔아 항상 읽히게
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.fillRect(pick.box.x1, pick.box.y1, pick.box.x2 - pick.box.x1, pick.box.y2 - pick.box.y1);
        }
        ctx.fillStyle = isSel ? '#12202f' : '#5a6472';
        ctx.fillText(n.p.ko, pick.x, pick.y);
      });
      hidden = nodes.length - (placed.length - nodeBoxes);
      total = nodes.length;
    }
    var hidden = 0, total = 0;

    function showSel() {
      if (!selEl) return;
      if (!sel) {
        selEl.innerHTML = '<p class="note">점 ' + total + '개. 속이 빈 점은 이미 해결된 문제, '
          + '화살표는 "이쪽이 풀리면 저쪽도 풀린다"는 뜻입니다. 점을 누르면 여기에 문제가 뜹니다.'
          + (hidden > 0 ? ' 자리가 모자라 이름을 숨긴 점이 ' + hidden + '개 있습니다. '
              + '위에서 분야를 고르면 이름이 다 보입니다.' : '')
          + '</p>';
        return;
      }
      var p = sel.p, f = M.fields[p.field];
      selEl.innerHTML = '<a class="pcard" href="#/p/' + p.id + '" style="--c:' + f.color + '">'
        + '<div class="pcard-top"><span class="pglyph">' + f.icon + '</span>'
        + '<span class="chip st-' + M.status[p.status].tone + '">' + M.status[p.status].label + '</span></div>'
        + '<h3>' + p.ko + '</h3><p>' + p.oneline + '</p>'
        + '<div class="pcard-foot">이어진 문제 ' + sel.deg + '개 · 눌러서 펼치기</div></a>';
    }

    function pick(ev) {
      var rect = canvas.getBoundingClientRect();
      var t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      var x = t.clientX - rect.left, y = t.clientY - rect.top;
      var best = null, bd = 22 * 22;
      nodes.forEach(function (n) {
        var d = (n.sx - x) * (n.sx - x) + (n.sy - y) * (n.sy - y);
        if (d < bd) { bd = d; best = n; }
      });
      sel = best;
      draw(); showSel();
    }

    canvas.onclick = pick;
    window.onresize = resize;
    resize();
    showSel();
  }

  return { mount: mount };
})();
