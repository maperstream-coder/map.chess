/* maper.chess — Ратуша 3D: движок площади, модели зданий, фигурки-жители.
   Рисует на canvas без внешних библиотек: ортографическая 3D-проекция, свет, тени, сортировка граней.
   Подключается ПЕРЕД js/village.js и отдаёт window.VL3. */
(function () {
  "use strict";

  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hyp = Math.hypot;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => { h = String(h).replace("#", ""); if (h.length === 3) h = h.replace(/./g, m => m + m); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgbs = (c, a) => (a == null || a >= 1) ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const rnd = (seed) => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

  /* ---------- материалы ---------- */
  const K = {
    stone: hex("#bdb6a6"), stoneD: hex("#8f897d"), stoneL: hex("#d9d3c5"), marble: hex("#f1ede3"),
    plaster: hex("#eadfc6"), plasterW: hex("#f1e9d8"), brick: hex("#b0624d"), brickD: hex("#8a4a3a"),
    wood: hex("#8a6240"), woodD: hex("#5e4229"), woodL: hex("#b08a5c"), hay: hex("#d9b455"),
    roofR: hex("#b9503f"), roofV: hex("#6d60cc"), roofT: hex("#2f8f8a"), roofB: hex("#496fa8"), roofO: hex("#c97a3a"), roofS: hex("#59606e"),
    gold: hex("#f3cb63"), goldD: hex("#b68a2c"), copper: hex("#58b79c"), glass: hex("#7db1da"), door: hex("#5a3826"),
    grass: hex("#6fae5a"), grassD: hex("#4f8c46"), grassL: hex("#8ccb6e"), leaf: hex("#4f9d58"), leaf2: hex("#74c466"), leaf3: hex("#3f8a55"), pine: hex("#2f7a55"), trunk: hex("#6b4a2e"),
    paving: hex("#a9a294"), paving2: hex("#bcb5a6"), dirt: hex("#a98960"), water: hex("#6bb8e8"), waterL: hex("#bfe8ff"),
    red: hex("#d9534f"), blue: hex("#4f86d9"), white: hex("#f4f0e6"), violet: hex("#8e55e6"), pink: hex("#ee8195"), yellow: hex("#f0c850"), green: hex("#5cba7d"), black: hex("#2a2a32"),
    dark: hex("#2e2b36")
  };

  /* размеры (в клетках), кроме 1×1 */
  const FOOT = { hall: [2, 2], palace: [2, 2], castle: [2, 2] };
  const footOf = id => FOOT[id] || [1, 1];

  /* ---------- геометрия ---------- */
  function newell(p) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = hyp(x, y, z) || 1; return [x / l, y / l, z / l];
  }
  function mkFace(pts, col, n, o) {
    let gx = 0, gy = 0, gz = 0;
    for (let i = 0; i < pts.length; i++) { gx += pts[i][0]; gy += pts[i][1]; gz += pts[i][2]; }
    const k = pts.length;
    const nl = hyp(n[0], n[1], n[2]) || 1;
    return { p: pts, c: col, n: [n[0] / nl, n[1] / nl, n[2] / nl], g: [gx / k, gy / k, gz / k], e: !!(o && o.e), ds: !!(o && o.ds), a: o && o.a, ref: o && o.ref, win: o && o.win, lit: o && o.lit, key: 0, shine: o && o.shine };
  }

  function Model(w, d) {
    this.w = w; this.d = d; this.parts = []; this.cur = null;
    this.flags = []; this.smoke = []; this.lights = []; this.sprites = []; this.water = []; this.rot = [];
    this.top = 0;
  }
  Model.prototype = {
    part(bias) { const p = { faces: [], bias: bias || 0, cx: 0, cy: 0, cz: 0, pl: {} }; this.parts.push(p); this.cur = p; return p; },
    add(p, pts, col, o, ctr) {
      let n = (o && o.n) || newell(pts);
      const f = mkFace(pts, col, n, o);
      if (ctr) { const dd = f.n[0] * (f.g[0] - ctr[0]) + f.n[1] * (f.g[1] - ctr[1]) + f.n[2] * (f.g[2] - ctr[2]); if (dd < 0) f.n = [-f.n[0], -f.n[1], -f.n[2]]; }
      p.faces.push(f);
      return f;
    },
    /* параллелепипед в существующую часть */
    boxIn(p, x, y, z, w, d, h, c, o) {
      o = o || {};
      const x1 = x + w, y1 = y + d, z1 = z + h, top = o.top || c;
      const t = this.add(p, [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], top, { n: [0, 0, 1], shine: o.shine });
      const s = this.add(p, [[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], c, { n: [0, 1, 0] });
      const n = this.add(p, [[x1, y, z], [x, y, z], [x, y, z1], [x1, y, z1]], c, { n: [0, -1, 0] });
      const e = this.add(p, [[x1, y1, z], [x1, y, z], [x1, y, z1], [x1, y1, z1]], c, { n: [1, 0, 0] });
      const ww = this.add(p, [[x, y, z], [x, y1, z], [x, y1, z1], [x, y, z1]], c, { n: [-1, 0, 0] });
      p.pl = { s: y1, n: y, e: x1, w: x };
      p.fs = { t, s, n, e, w: ww };
      return p;
    },
    box(x, y, z, w, d, h, c, o) { const p = this.part(o && o.bias); this.boxIn(p, x, y, z, w, d, h, c, o); p.cx = x + w / 2; p.cy = y + d / 2; p.cz = z + h / 2; this.top = Math.max(this.top, z + h); return p; },
    /* двускатная крыша; ось ridge: "x" или "y" */
    gable(x, y, z, w, d, h, c, o) {
      o = o || {}; const ov = o.ov == null ? 0.05 : o.ov, p = this.part(o.bias), ax = o.axis || "x", gc = o.gc || K.plaster;
      const ctr = [x + w / 2, y + d / 2, z - 0.05];
      if (ax === "x") {
        const ym = y + d / 2;
        this.add(p, [[x - ov, y + d + ov, z], [x + w + ov, y + d + ov, z], [x + w + ov, ym, z + h], [x - ov, ym, z + h]], c, null, ctr);
        this.add(p, [[x - ov, y - ov, z], [x + w + ov, y - ov, z], [x + w + ov, ym, z + h], [x - ov, ym, z + h]], mixc(c, [0, 0, 0], 0.08), null, ctr);
        this.add(p, [[x, y, z], [x, y + d, z], [x, ym, z + h]], gc, { n: [-1, 0, 0] });
        this.add(p, [[x + w, y, z], [x + w, y + d, z], [x + w, ym, z + h]], gc, { n: [1, 0, 0] });
        p.ridge = [[x - ov, ym, z + h], [x + w + ov, ym, z + h]];
      } else {
        const xm = x + w / 2;
        this.add(p, [[x + w + ov, y - ov, z], [x + w + ov, y + d + ov, z], [xm, y + d + ov, z + h], [xm, y - ov, z + h]], c, null, ctr);
        this.add(p, [[x - ov, y - ov, z], [x - ov, y + d + ov, z], [xm, y + d + ov, z + h], [xm, y - ov, z + h]], mixc(c, [0, 0, 0], 0.08), null, ctr);
        this.add(p, [[x, y + d, z], [x + w, y + d, z], [xm, y + d, z + h]], gc, { n: [0, 1, 0] });
        this.add(p, [[x, y, z], [x + w, y, z], [xm, y, z + h]], gc, { n: [0, -1, 0] });
        p.ridge = [[xm, y - ov, z + h], [xm, y + d + ov, z + h]];
      }
      p.cx = x + w / 2; p.cy = y + d / 2; p.cz = z + h / 2; this.top = Math.max(this.top, z + h);
      return p;
    },
    /* вальмовая крыша / пирамида на прямоугольнике */
    hip(x, y, z, w, d, h, c, o) {
      o = o || {}; const ov = o.ov == null ? 0.05 : o.ov, p = this.part(o.bias);
      const rf = o.ridge == null ? 0.0 : o.ridge, cx = x + w / 2, cy = y + d / 2;
      let rx = 0, ry = 0;
      if (w >= d) rx = (w - d) / 2 * (1 - 0) * (rf >= 0 ? 1 : 0) + 0; else ry = (d - w) / 2;
      const a = [x - ov, y - ov, z], b = [x + w + ov, y - ov, z], cc = [x + w + ov, y + d + ov, z], dd = [x - ov, y + d + ov, z];
      const ap1 = [cx - rx * (1 - rf), cy - ry * (1 - rf), z + h], ap2 = [cx + rx * (1 - rf), cy + ry * (1 - rf), z + h];
      const ctr = [cx, cy, z - 0.05], dk = mixc(c, [0, 0, 0], 0.08);
      this.add(p, [dd, cc, ap2, ap1], c, null, ctr);
      this.add(p, [a, b, ap2, ap1], dk, null, ctr);
      this.add(p, [b, cc, ap2], mixc(c, [255, 255, 255], 0.03), null, ctr);
      this.add(p, [a, dd, ap1], dk, null, ctr);
      p.cx = cx; p.cy = cy; p.cz = z + h / 2; this.top = Math.max(this.top, z + h);
      return p;
    },
    cyl(cx, cy, z, r, h, c, o) {
      o = o || {};
      const n = o.n || 12, r2 = o.r2 == null ? r : o.r2, p = this.part(o.bias), rot = o.rot || 0;
      const sl = (r - r2) / (h || 1);
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU + rot, a1 = (i + 1) / n * TAU + rot, am = (a0 + a1) / 2;
        this.add(p, [[cx + cos(a0) * r, cy + sin(a0) * r, z], [cx + cos(a1) * r, cy + sin(a1) * r, z], [cx + cos(a1) * r2, cy + sin(a1) * r2, z + h], [cx + cos(a0) * r2, cy + sin(a0) * r2, z + h]], c, { n: [cos(am), sin(am), sl], shine: o.shine });
      }
      if (!o.noTop && r2 > 0.002) {
        const pts = []; for (let i = 0; i < n; i++) pts.push([cx + cos(i / n * TAU + rot) * r2, cy + sin(i / n * TAU + rot) * r2, z + h]);
        this.add(p, pts, o.top || c, { n: [0, 0, 1] });
      }
      p.cx = cx; p.cy = cy; p.cz = z + h / 2; p.rad = r; p.zTop = z + h; this.top = Math.max(this.top, z + h);
      return p;
    },
    cone(cx, cy, z, r, h, c, o) {
      o = o || {};
      const n = o.n || 12, p = this.part(o.bias), rot = o.rot || 0, sl = r / (h || 1);
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU + rot, a1 = (i + 1) / n * TAU + rot, am = (a0 + a1) / 2;
        this.add(p, [[cx + cos(a0) * r, cy + sin(a0) * r, z], [cx + cos(a1) * r, cy + sin(a1) * r, z], [cx, cy, z + h]], c, { n: [cos(am), sin(am), sl], shine: o.shine });
      }
      p.cx = cx; p.cy = cy; p.cz = z + h * 0.4; this.top = Math.max(this.top, z + h);
      return p;
    },
    /* пирамида на квадрате/прямоугольнике */
    pyr(x, y, z, w, d, h, c, o) { o = o || {}; const p = this.hip(x, y, z, w, d, h, c, { ov: o.ov == null ? 0.03 : o.ov, ridge: 1, bias: o.bias }); return p; },
    dome(cx, cy, z, r, c, o) {
      o = o || {};
      const n = o.n || 14, rings = o.rings || 5, sq = o.squash || 1, p = this.part(o.bias);
      for (let k = 0; k < rings; k++) {
        const f0 = k / rings * PI / 2, f1 = (k + 1) / rings * PI / 2;
        const r0 = r * cos(f0), r1 = r * cos(f1), z0 = z + r * sin(f0) * sq, z1 = z + r * sin(f1) * sq;
        for (let i = 0; i < n; i++) {
          const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2, fm = (f0 + f1) / 2;
          const pts = [[cx + cos(a0) * r0, cy + sin(a0) * r0, z0], [cx + cos(a1) * r0, cy + sin(a1) * r0, z0], [cx + cos(a1) * r1, cy + sin(a1) * r1, z1], [cx + cos(a0) * r1, cy + sin(a0) * r1, z1]];
          if (k === rings - 1) pts.splice(2, 2, [cx, cy, z1]);
          const rib = o.ribs && (i % 2 === 0);
          this.add(p, pts, rib ? (o.rib || c) : c, { n: [cos(am) * cos(fm), sin(am) * cos(fm), sin(fm) / sq], shine: o.shine });
        }
      }
      p.cx = cx; p.cy = cy; p.cz = z + r * 0.5; this.top = Math.max(this.top, z + r * sq);
      return p;
    },
    /* зубцы по периметру прямоугольника */
    crenel(x, y, z, w, d, c, o) {
      o = o || {};
      const p = this.part(o.bias), h = o.h || 0.08, s = o.s || 0.07, step = s * 2;
      const nx = Math.max(2, Math.round((w - s) / step)), ny = Math.max(2, Math.round((d - s) / step));
      for (let i = 0; i < nx; i++) { const px = x + (w - s) * i / (nx - 1); this.boxIn(p, px, y, z, s, s, h, c); this.boxIn(p, px, y + d - s, z, s, s, h, c); }
      for (let j = 1; j < ny - 1; j++) { const py = y + (d - s) * j / (ny - 1); this.boxIn(p, x, py, z, s, s, h, c); this.boxIn(p, x + w - s, py, z, s, s, h, c); }
      p.cx = x + w / 2; p.cy = y + d / 2; p.cz = z + h / 2; this.top = Math.max(this.top, z + h);
      return p;
    },
    crenelRing(cx, cy, z, r, c, o) {
      o = o || {};
      const p = this.part(o.bias), n = o.n || 8, h = o.h || 0.08, s = o.s || 0.07;
      for (let i = 0; i < n; i++) { const a = i / n * TAU; this.boxIn(p, cx + cos(a) * r - s / 2, cy + sin(a) * r - s / 2, z, s, s, h, c); }
      p.cx = cx; p.cy = cy; p.cz = z + h / 2; this.top = Math.max(this.top, z + h);
      return p;
    },
    /* плоская плитка на горизонтали */
    flat(p, x, y, z, w, d, c, o) { return this.add(p, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], c, Object.assign({ n: [0, 0, 1] }, o)); },
    /* четырёхугольник на вертикальной стене */
    wallQ(p, dir, P, a0, a1, z0, z1, col, o) {
      o = o || {};
      let pts, n;
      if (dir === "s") { pts = [[a0, P, z0], [a1, P, z0], [a1, P, z1], [a0, P, z1]]; n = [0, 1, 0]; }
      else if (dir === "n") { pts = [[a1, P, z0], [a0, P, z0], [a0, P, z1], [a1, P, z1]]; n = [0, -1, 0]; }
      else if (dir === "e") { pts = [[P, a0, z0], [P, a1, z0], [P, a1, z1], [P, a0, z1]]; n = [1, 0, 0]; }
      else { pts = [[P, a1, z0], [P, a0, z0], [P, a0, z1], [P, a1, z1]]; n = [-1, 0, 0]; }
      o.n = n; if (!o.ref && p.fs) o.ref = p.fs[dir];
      return this.add(p, pts, col, o);
    },
    wallPoly(p, dir, P, uv, col, o) {   // произвольный контур (u вдоль стены, v по высоте)
      o = o || {};
      const pts = uv.map(q => dir === "s" || dir === "n" ? [q[0], P, q[1]] : [P, q[0], q[1]]);
      const n = dir === "s" ? [0, 1, 0] : dir === "n" ? [0, -1, 0] : dir === "e" ? [1, 0, 0] : [-1, 0, 0];
      if (dir === "n" || dir === "w") pts.reverse();
      o.n = n; if (!o.ref && p.fs) o.ref = p.fs[dir];
      return this.add(p, pts, col, o);
    },
    off(p, dir) { return p.pl[dir] + (dir === "s" || dir === "e" ? 0.004 : -0.004); },
    /* ряд окон */
    wins(p, dir, a0, a1, z0, hh, count, ww, o) {
      o = o || {}; const P = this.off(p, dir), step = (a1 - a0) / count;
      for (let i = 0; i < count; i++) {
        const c = a0 + step * (i + 0.5), lit = o.lit != null ? o.lit : ((i * 7 + Math.round(z0 * 13) + (dir === "e" ? 3 : 0)) % 3 !== 0);
        if (o.frame !== false) this.wallQ(p, dir, P, c - ww / 2 - 0.014, c + ww / 2 + 0.014, z0 - 0.014, z0 + hh + 0.014, o.fc || K.stoneL, {});
        const P2 = P + (dir === "s" || dir === "e" ? 0.003 : -0.003);
        if (o.arch) {
          const u = [], r = ww / 2, zc = z0 + hh - r;
          u.push([c - r, z0], [c + r, z0], [c + r, zc]);
          for (let k = 1; k < 6; k++) { const a = k / 6 * PI; u.push([c + cos(a) * r, zc + sin(a) * r]); }
          u.push([c - r, zc]);
          this.wallPoly(p, dir, P2, u, o.glass || K.glass, { win: 1, lit });
        } else this.wallQ(p, dir, P2, c - ww / 2, c + ww / 2, z0, z0 + hh, o.glass || K.glass, { win: 1, lit });
        if (o.bars !== false && hh > 0.1) { const P3 = P2 + (dir === "s" || dir === "e" ? 0.002 : -0.002); this.wallQ(p, dir, P3, c - 0.006, c + 0.006, z0, z0 + hh, o.fc || K.stoneL, {}); }
      }
    },
    door(p, dir, a, w, h, o) {
      o = o || {}; const P = this.off(p, dir), z0 = o.z || (p.fs[dir].p[0][2]), r = w / 2, u = [];
      const zb = z0;
      u.push([a - r - 0.02, zb], [a + r + 0.02, zb], [a + r + 0.02, zb + h - r + 0.02]);
      for (let k = 1; k < 7; k++) { const t = k / 7 * PI; u.push([a + cos(t) * (r + 0.02), zb + h - r + sin(t) * (r + 0.02)]); }
      u.push([a - r - 0.02, zb + h - r + 0.02]);
      this.wallPoly(p, dir, P, u, o.frame || K.stoneL, {});
      const P2 = P + (dir === "s" || dir === "e" ? 0.003 : -0.003), v = [];
      v.push([a - r, zb], [a + r, zb], [a + r, zb + h - r]);
      for (let k = 1; k < 7; k++) { const t = k / 7 * PI; v.push([a + cos(t) * r, zb + h - r + sin(t) * r]); }
      v.push([a - r, zb + h - r]);
      this.wallPoly(p, dir, P2, v, o.col || K.door, {});
      this.wallQ(p, dir, P2 + (dir === "s" || dir === "e" ? 0.002 : -0.002), a - 0.006, a + 0.006, zb, zb + h - r, K.woodD, {});
      this.wallQ(p, dir, P2 + (dir === "s" || dir === "e" ? 0.002 : -0.002), a + r * 0.55, a + r * 0.55 + 0.02, zb + h * 0.38, zb + h * 0.38 + 0.02, K.gold, {});
    },
    /* круглый циферблат/витраж на стене */
    disc(p, dir, a, zc, r, col, o) {
      o = o || {}; const n = 14, u = [];
      for (let i = 0; i < n; i++) u.push([a + cos(i / n * TAU) * r, zc + sin(i / n * TAU) * r]);
      const P = this.off(p, dir) + (dir === "s" || dir === "e" ? 0.002 : -0.002);
      this.wallPoly(p, dir, P, u, col, { win: o.win, lit: o.lit });
      if (o.hands) {
        const P2 = P + (dir === "s" || dir === "e" ? 0.003 : -0.003);
        this.wallQ(p, dir, P2, a - 0.008, a + 0.008, zc, zc + r * 0.8, K.dark, {});
        this.wallQ(p, dir, P2, a, a + r * 0.6, zc - 0.008, zc + 0.008, K.dark, {});
      }
    },
    flag(x, y, z, h, col, o) {
      o = o || {};
      this.cyl(x, y, z, 0.012, h, o.pole || K.goldD, { n: 4 });
      this.flags.push({ x, y, z: z + h - (o.fh || 0.13), w: o.w || 0.2, h: o.fh || 0.13, c: col, c2: o.c2, ph: x * 7 + y * 3 });
      this.top = Math.max(this.top, z + h);
    },
    smokeAt(x, y, z) { this.smoke.push({ x, y, z, ph: x * 11 + y * 5 }); },
    lightAt(x, y, z, r, c) { this.lights.push({ x, y, z, r, c: c || [255, 214, 140] }); },
    spriteAt(type, x, y, h, pal, o) { this.sprites.push(Object.assign({ type, x, y, h, pal }, o || {})); },
    tree(x, y, s, kind, o) {
      o = o || {}; s = s || 1;
      this.cyl(x, y, 0.02, 0.025 * s, 0.1 * s, K.trunk, { n: 5, noTop: true });
      if (kind === "pine") {
        this.cone(x, y, 0.08 * s, 0.1 * s, 0.14 * s, K.pine, { n: 7 });
        this.cone(x, y, 0.15 * s, 0.08 * s, 0.13 * s, mixc(K.pine, K.leaf, 0.25), { n: 7 });
        this.cone(x, y, 0.22 * s, 0.055 * s, 0.11 * s, mixc(K.pine, K.leaf, 0.45), { n: 7 });
      } else if (kind === "bush") {
        this.dome(x, y, 0.03, 0.075 * s, o.c || K.leaf2, { n: 8, rings: 3, squash: 0.85 });
      } else {
        this.dome(x, y, 0.1 * s, 0.1 * s, o.c || K.leaf, { n: 9, rings: 4, squash: 1 });
        this.dome(x + 0.04 * s, y - 0.02 * s, 0.14 * s, 0.065 * s, mixc(o.c || K.leaf, K.leaf2, 0.6), { n: 8, rings: 3 });
      }
    },
    finish() {
      this.parts.forEach(p => {
        if (p.cx || p.cy || p.cz) return;
        let n = 0, sx = 0, sy = 0, sz = 0; p.faces.forEach(f => { sx += f.g[0]; sy += f.g[1]; sz += f.g[2]; n++; });
        if (n) { p.cx = sx / n; p.cy = sy / n; p.cz = sz / n; }
      });
      return this;
    }
  };


  /* =====================================================================
     МОДЕЛИ ЗДАНИЙ. builder(M, L): M — модель (локальные координаты в клетках), L — уровень.
     Чем выше уровень, тем больше деталей: этажи, башни, купола, колонны, флаги, свет в окнах.
     ===================================================================== */
  const B = {};
  const at = (arr, L) => arr[Math.min(arr.length, Math.max(1, L)) - 1];

  function fencePart(M, segs, z, h, c) {
    const p = M.part(); const t = 0.016;
    segs.forEach(s => {
      const [x0, y0, x1, y1] = s, len = hyp(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 0.1));
      for (let i = 0; i <= n; i++) { const px = lerp(x0, x1, i / n), py = lerp(y0, y1, i / n); M.boxIn(p, px - t / 2, py - t / 2, z, t, t, h, c); }
      const horiz = Math.abs(y1 - y0) < 1e-6;
      for (const zz of [z + h * 0.35, z + h * 0.78]) {
        if (horiz) M.boxIn(p, Math.min(x0, x1), y0 - 0.005, zz, Math.abs(x1 - x0), 0.01, 0.014, c);
        else M.boxIn(p, x0 - 0.005, Math.min(y0, y1), zz, 0.01, Math.abs(y1 - y0), 0.014, c);
      }
    });
    p.cx = (segs[0][0] + segs[segs.length - 1][2]) / 2; p.cy = (segs[0][1] + segs[segs.length - 1][3]) / 2; p.cz = z + h / 2;
    return p;
  }
  function lawn(M, c, w, d, x, y) { return M.box(x == null ? 0.02 : x, y == null ? 0.02 : y, 0, w || 0.96, d || 0.96, 0.035, c || K.grass, { bias: -100, top: c || K.grass }); }
  function slit(M, p, cx, cy, r, z, h, ang, col) {
    const rr = r + 0.004, w = 0.016, a0 = ang - w / r / 2, a1 = ang + w / r / 2;
    let ref = null, best = 0.7;
    for (const f of p.faces) { if (Math.abs(f.n[2]) > 0.5) continue; const dd = f.n[0] * cos(ang) + f.n[1] * sin(ang); if (dd > best) { best = dd; ref = f; } }
    M.add(p, [[cx + cos(a0) * rr, cy + sin(a0) * rr, z], [cx + cos(a1) * rr, cy + sin(a1) * rr, z], [cx + cos(a1) * rr, cy + sin(a1) * rr, z + h], [cx + cos(a0) * rr, cy + sin(a0) * rr, z + h]], col || K.dark, { n: [cos(ang), sin(ang), 0], ref: ref || undefined });
  }
  function checkerTop(M, p, x, y, w, d, z, n, c1, c2) {
    const sx = w / n, sy = d / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M.flat(p, x + i * sx, y + j * sy, z, sx, sy, (i + j) % 2 ? c1 : c2, { ref: p.fs && p.fs.t });
  }
  function lamp(M, x, y, h) {
    M.cyl(x, y, 0.035, 0.012, h || 0.2, K.dark, { n: 5, noTop: true });
    const p = M.cyl(x, y, 0.035 + (h || 0.2), 0.03, 0.045, [255, 226, 160], { n: 6, r2: 0.022 });
    p.glow = true; M.lightAt(x, y, 0.035 + (h || 0.2) + 0.02, 0.2, [255, 214, 140]);
  }

  /* ---------- РАТУША 2×2 ---------- */
  B.hall = function (M, L) {
    const pad = M.box(0.03, 0.03, 0, 1.94, 1.94, 0.05, K.paving, { bias: -100, top: K.paving2 });
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) M.flat(pad, 0.03 + i * 0.2425, 0.03 + j * 0.2425, 0.0515, 0.2425, 0.2425, K.paving, { ref: pad.fs.t });
    const W = at([0.9, 1.0, 1.1, 1.22, 1.34, 1.42, 1.5, 1.56, 1.62, 1.68], L), D = at([0.66, 0.72, 0.78, 0.84, 0.9, 0.94, 0.98, 1.02, 1.05, 1.08], L);
    const fl = L < 3 ? 1 : L < 6 ? 2 : 3, fh = L === 1 ? 0.36 : 0.3, H = fl * fh;
    const bx = 1 - W / 2, by = 0.88 - D / 2, z0 = 0.12;
    const wallC = L < 4 ? K.plaster : L < 7 ? K.plasterW : K.marble;
    const trim = L < 7 ? K.stoneL : K.gold;
    const roofC = L < 3 ? K.roofR : L < 5 ? K.roofV : L < 8 ? K.roofT : K.copper;
    M.box(bx - 0.04, by - 0.04, 0.05, W + 0.08, D + 0.08, 0.07, K.stoneD);
    const body = M.box(bx, by, z0, W, D, H, wallC);
    for (let f = 1; f <= fl; f++) M.wallQ(body, "s", by + D + 0.012, bx - 0.02, bx + W + 0.02, z0 + f * fh - 0.035, z0 + f * fh, trim, { ref: body.fs.s });
    for (let f = 0; f < fl; f++) {
      const wz = z0 + f * fh + (fh - 0.17) / 2 + 0.01, gap = 0.17;
      const k = Math.max(1, Math.floor((W / 2 - gap - 0.08) / 0.24));
      M.wins(body, "s", bx + 0.08, 1 - gap, wz, 0.17, k, 0.09, { arch: L >= 5, fc: trim });
      M.wins(body, "s", 1 + gap, bx + W - 0.08, wz, 0.17, k, 0.09, { arch: L >= 5, fc: trim });
      if (f > 0 || L >= 7) M.wins(body, "s", 1 - 0.1, 1 + 0.1, wz, 0.17, 1, 0.09, { arch: L >= 5, fc: trim });
      const ks = Math.max(1, Math.floor((D - 0.16) / 0.24));
      M.wins(body, "e", by + 0.08, by + D - 0.08, wz, 0.17, ks, 0.09, { fc: trim });
      M.wins(body, "w", by + 0.08, by + D - 0.08, wz, 0.17, ks, 0.09, { fc: trim });
    }
    // крыша
    const rh = 0.22 + 0.012 * L;
    if (L < 5) { const r = M.gable(bx, by, z0 + H, W, D, rh, roofC, { gc: wallC, ov: 0.06 }); }
    else M.hip(bx, by, z0 + H, W, D, rh + 0.06, roofC, { ov: 0.06 });
    if (L <= 4) { M.box(bx + W * 0.78, by + D * 0.25, z0 + H + 0.06, 0.07, 0.07, 0.2, K.brick); M.smokeAt(bx + W * 0.78 + 0.035, by + D * 0.25 + 0.035, z0 + H + 0.28); }
    // башня с часами (спереди) или центральная (на высоких уровнях)
    const cx = 1;
    if (L >= 3 && L < 7) {
      const tw = Math.min(0.46, 0.28 + 0.02 * L), ty = by + D - 0.1, tH = H + 0.14 + 0.07 * (L - 2);
      const tw0 = M.box(cx - tw / 2, ty, z0, tw, 0.32, tH, wallC);
      M.wallQ(tw0, "s", ty + 0.32 + 0.012, cx - tw / 2 - 0.015, cx + tw / 2 + 0.015, z0 + tH - 0.04, z0 + tH, trim, {});
      M.door(tw0, "s", cx, 0.17, 0.25, { z: z0, frame: trim });
      M.disc(tw0, "s", cx, z0 + tH - 0.17, 0.075, K.white, { hands: true });
      M.wallQ(tw0, "s", ty + 0.32 + 0.006, cx - 0.03, cx + 0.03, z0 + 0.36, z0 + 0.5, K.glass, { win: 1, lit: 1 });
      M.disc(tw0, "e", ty + 0.16, z0 + tH - 0.17, 0.07, K.white, { hands: true });
      M.disc(tw0, "w", ty + 0.16, z0 + tH - 0.17, 0.07, K.white, { hands: true });
      const rc = L < 5 ? K.roofV : K.roofT;
      M.pyr(cx - tw / 2, ty, z0 + tH, tw, 0.32, 0.22 + 0.04 * (L - 2), rc, { ov: 0.04 });
      const topz = z0 + tH + 0.22 + 0.04 * (L - 2);
      if (L >= 5) M.dome(cx, ty + 0.16, topz - 0.01, 0.028, K.gold, { n: 8, rings: 3 });
      M.flag(cx, ty + 0.16, topz, 0.14 + (L >= 5 ? 0.04 : 0), L < 5 ? K.red : K.violet, { w: 0.18 });
      M.box(cx - 0.2, ty + 0.32, 0.05, 0.4, 0.1, 0.07, K.stoneL);
      M.lightAt(cx, ty + 0.34, z0 + 0.16, 0.22);
    } else if (L === 1 || L === 2) {
      M.door(body, "s", cx, 0.16, 0.24, { z: z0, frame: trim });
      M.box(cx - 0.17, by + D, 0.05, 0.34, 0.1, 0.07, K.stoneL);
      if (L === 2) {
        M.gable(cx - 0.17, by + D, z0 + 0.24, 0.34, 0.2, 0.1, K.roofV, { axis: "x", ov: 0.03, gc: K.plaster });
        M.box(cx - 0.16, by + D + 0.12, z0, 0.025, 0.025, 0.24, K.woodD); M.box(cx + 0.135, by + D + 0.12, z0, 0.025, 0.025, 0.24, K.woodD);
      }
      M.flag(bx + W - 0.03, by + 0.05, z0 + H + rh - 0.02, 0.2, K.red, { w: 0.15 });
    }
    // крылья (подворье)
    if (L >= 4) {
      const lw = Math.min(0.58, 0.14 + 0.07 * (L - 3)), ww = 0.3, hw = Math.max(fh, fh * (fl - 1)) + 0.02;
      [bx, bx + W - ww].forEach((wx, i) => {
        const wg = M.box(wx, by + D - 0.02, z0, ww, lw, hw, wallC);
        M.gable(wx, by + D - 0.02, z0 + hw, ww, lw, 0.15, roofC, { axis: "y", gc: wallC, ov: 0.04 });
        M.wins(wg, "s", wx + 0.05, wx + ww - 0.05, z0 + 0.1, 0.15, 1, 0.09, { arch: L >= 5, fc: trim });
        M.wins(wg, i ? "e" : "w", by + D + 0.02, by + D + lw - 0.04, z0 + 0.1, 0.15, Math.max(1, Math.round(lw / 0.22)), 0.08, { fc: trim });
      });
    }
    // портик на высоких уровнях
    if (L >= 7) {
      const py = by + D;
      M.box(cx - 0.4, py - 0.02, 0.05, 0.8, 0.26, 0.07, K.stoneL);
      for (let i = 0; i < 4; i++) M.cyl(cx - 0.27 + i * 0.18, py + 0.14, z0, 0.032, fh * 2 + 0.02, K.marble, { n: 8 });
      M.box(cx - 0.38, py + 0.0, z0 + fh * 2 + 0.02, 0.76, 0.2, 0.05, K.marble);
      M.gable(cx - 0.38, py + 0.0, z0 + fh * 2 + 0.07, 0.76, 0.2, 0.13, K.stoneL, { axis: "x", gc: K.marble, ov: 0.02 });
      M.door(body, "s", cx, 0.18, 0.26, { z: z0, frame: K.gold });
      M.lightAt(cx, py + 0.2, z0 + 0.15, 0.25);
    }
    // центральная башня / купол на высоких уровнях
    if (L === 7) {
      const t = M.box(cx - 0.2, by + D * 0.35, z0 + H, 0.4, 0.4, 0.36, wallC);
      M.disc(t, "s", cx, z0 + H + 0.2, 0.08, K.white, { hands: true });
      M.pyr(cx - 0.2, by + D * 0.35, z0 + H + 0.36, 0.4, 0.4, 0.3, K.roofT, { ov: 0.04 });
      M.flag(cx, by + D * 0.35 + 0.2, z0 + H + 0.66, 0.2, K.violet, { w: 0.2 });
    }
    if (L >= 8) {
      const dz = z0 + H + rh + 0.03, dr = 0.16 + 0.015 * (L - 8);
      const dm = M.cyl(cx, by + D * 0.45, dz - 0.06, dr + 0.02, 0.2 + 0.03 * (L - 8), wallC, { n: 12 });
      for (let i = 0; i < 6; i++) slit(M, dm, cx, by + D * 0.45, dr + 0.02, dz + 0.0, 0.1 + 0.03 * (L - 8), i / 6 * TAU + 0.5, K.glass);
      const topz = dz - 0.06 + 0.2 + 0.03 * (L - 8);
      M.cyl(cx, by + D * 0.45, topz, dr + 0.035, 0.03, trim, { n: 12 });
      M.dome(cx, by + D * 0.45, topz + 0.03, dr + 0.02, L >= 10 ? K.gold : K.copper, { n: 14, rings: 5, squash: 1.05, ribs: L >= 9, rib: K.gold });
      const tt = topz + 0.03 + (dr + 0.02) * 1.05;
      M.cyl(cx, by + D * 0.45, tt - 0.01, 0.03, 0.07, trim, { n: 8 });
      M.cone(cx, by + D * 0.45, tt + 0.06, 0.04, 0.14 + 0.02 * (L - 8), K.gold, { n: 8 });
      M.flag(cx, by + D * 0.45, tt + 0.2 + 0.02 * (L - 8), 0.14, L >= 10 ? K.gold : K.violet, { w: 0.2, c2: K.white });
      M.lightAt(cx, by + D * 0.45, dz + 0.1, 0.28, [255, 220, 150]);
    }
    // угловые башенки
    if (L >= 6) {
      const big = L >= 9, r = big ? 0.1 : 0.065, hz = H + (big ? 0.16 : 0.08);
      [[bx + 0.02, by + 0.02], [bx + W - 0.02, by + 0.02], [bx + 0.02, by + D - 0.02], [bx + W - 0.02, by + D - 0.02]].forEach(([tx, ty], i) => {
        const tp = M.cyl(tx, ty, z0, r, hz, wallC, { n: 10 });
        if (big) slit(M, tp, tx, ty, r, z0 + hz * 0.45, 0.1, 0.8 + i * 1.57, K.glass);
        M.cone(tx, ty, z0 + hz, r + 0.025, big ? 0.3 : 0.18, big ? K.roofV : K.roofT, { n: 10 });
        if (big) M.flag(tx, ty, z0 + hz + 0.3, 0.12, K.gold, { w: 0.13 });
      });
    }
    // фонтан, фонари, статуи
    if (L >= 8) {
      const fy = Math.min(1.78, by + D + (L >= 7 ? 0.62 : 0.4));
      M.cyl(cx, fy, 0.05, 0.12, 0.05, K.stoneL, { n: 12 });
      const wp = M.cyl(cx, fy, 0.098, 0.1, 0.01, K.water, { n: 12, shine: 1 }); wp.water = true;
      M.cyl(cx, fy, 0.1, 0.018, 0.1, K.stoneL, { n: 6 });
      M.water.push({ x: cx, y: fy, z: 0.2, r: 0.09 });
    }
    if (L >= 5) { lamp(M, 0.2, 1.75, 0.2); lamp(M, 1.8, 1.75, 0.2); }
    if (L >= 9) { lamp(M, 0.2, 0.3, 0.2); lamp(M, 1.8, 0.3, 0.2); }
    if (L >= 10) { M.spriteAt("pawn", 0.62, 1.72, 0.2, "gold", { stat: 1 }); M.spriteAt("pawn", 1.38, 1.72, 0.2, "gold", { stat: 1 }); }
    M.lightAt(cx, by + D + 0.04, z0 + 0.12, 0.3);
  };

  /* ---------- ДОМИКИ ПЕШЕК ---------- */
  function house(M, x, y, w, d, h, wc, rc, o) {
    o = o || {};
    const b = M.box(x, y, 0.035, w, d, h, wc);
    M.gable(x, y, 0.035 + h, w, d, Math.max(0.1, w * 0.4), rc, { axis: o.axis || "x", gc: wc, ov: 0.035 });
    M.door(b, "s", x + w * 0.35, Math.min(0.09, w * 0.25), Math.min(0.14, h * 0.8), { z: 0.035 });
    M.wins(b, "s", x + w * 0.55, x + w - 0.03, 0.035 + h * 0.4, Math.min(0.08, h * 0.5), 1, 0.06, { bars: false });
    M.wins(b, "e", y + 0.04, y + d - 0.04, 0.035 + h * 0.4, Math.min(0.08, h * 0.5), 1, 0.06, { bars: false });
    if (o.chim) { M.box(x + w * 0.75, y + d * 0.2, 0.035 + h + 0.04, 0.045, 0.045, 0.12, K.brick); M.smokeAt(x + w * 0.75 + 0.022, y + d * 0.2 + 0.022, 0.035 + h + 0.17); }
    M.lightAt(x + w * 0.35, y + d + 0.02, 0.035 + 0.06, 0.1);
    return b;
  }
  B.cottages = function (M, L) {
    lawn(M);
    const roofs = [K.roofR, K.roofB, K.roofT, K.roofO, K.roofV], walls = [K.plaster, K.plasterW, K.brick, K.plaster, K.plasterW];
    const spots = [[0.3, 0.4, 0.4, 0.3], [0.07, 0.1, 0.3, 0.24], [0.6, 0.08, 0.3, 0.26], [0.66, 0.62, 0.26, 0.26], [0.07, 0.66, 0.26, 0.24]];
    const cnt = at([1, 1, 2, 3, 3, 4, 4, 5], L);
    for (let i = 0; i < cnt; i++) { const s = spots[i]; house(M, s[0], s[1], s[2], s[3], i === 0 ? 0.17 + 0.014 * L : 0.13 + 0.01 * L, walls[i], roofs[i], { chim: i === 0 || L >= 5, axis: i % 2 ? "y" : "x" }); }
    if (L >= 2) { const p = M.part(); for (let i = 0; i < 5; i++) M.boxIn(p, 0.1 + i * 0.04, 0.82, 0.035, 0.026, 0.026, 0.026 + (i % 2) * 0.012, [K.pink, K.yellow, K.red, K.white, K.pink][i]); M.boxIn(p, 0.08, 0.8, 0.035, 0.22, 0.08, 0.012, K.grassD); p.cx = 0.2; p.cy = 0.84; p.cz = 0.04; }
    if (L >= 4) fencePart(M, [[0.04, 0.95, 0.96, 0.95], [0.04, 0.56, 0.04, 0.95]], 0.035, 0.07, K.woodL);
    if (L >= 5) { M.cyl(0.5, 0.8, 0.035, 0.012, 0.18, K.woodD, { n: 4 }); M.box(0.43, 0.79, 0.19, 0.14, 0.012, 0.07, K.red); }
    if (L >= 6) { M.cyl(0.9, 0.52, 0.035, 0.05, 0.06, K.stone, { n: 8 }); M.pyr(0.84, 0.46, 0.15, 0.12, 0.12, 0.06, K.roofR, { ov: 0.01 }); }
    if (L >= 7) { M.tree(0.94, 0.4, 0.8); M.tree(0.1, 0.52, 0.7, "bush"); }
    if (L >= 8) { M.flag(0.5, 0.52, 0.035 + 0.17 + 0.014 * L + 0.14, 0.14, K.red, { w: 0.14 }); M.spriteAt("pawn", 0.55, 0.74, 0.12, "classic", { stat: 1 }); }
  };

  /* ---------- КОНЮШНЯ ---------- */
  B.stables = function (M, L) {
    lawn(M, K.grass);
    M.box(0.3, 0.55, 0.036, 0.4, 0.43, 0.004, K.dirt, { bias: -90 });
    const bw = 0.42 + 0.03 * L, bd = 0.44, bx = 0.08, by = 0.08, h = 0.17 + 0.018 * L;
    const wc = L < 4 ? K.wood : L < 6 ? K.brick : K.stone, rc = L < 3 ? K.hay : L < 5 ? K.roofR : K.roofS;
    const b = M.box(bx, by, 0.035, bw, bd, h, wc);
    M.gable(bx, by, 0.035 + h, bw, bd, 0.14 + 0.01 * L, rc, { axis: "y", gc: wc, ov: 0.04 });
    const dw = 0.2, dx = bx + bw / 2 - dw / 2;
    M.wallQ(b, "s", by + bd + 0.004, dx - 0.015, dx + dw + 0.015, 0.035, 0.035 + h * 0.85, K.woodL, {});
    M.wallQ(b, "s", by + bd + 0.007, dx, dx + dw, 0.035, 0.035 + h * 0.8, K.woodD, {});
    M.wallQ(b, "s", by + bd + 0.01, dx + dw / 2 - 0.006, dx + dw / 2 + 0.006, 0.035, 0.035 + h * 0.8, K.woodL, {});
    M.wallQ(b, "s", by + bd + 0.01, dx, dx + dw, 0.035 + h * 0.4, 0.035 + h * 0.4 + 0.012, K.woodL, {});
    M.wallQ(b, "s", by + bd + 0.008, bx + bw / 2 - 0.035, bx + bw / 2 + 0.035, 0.035 + h * 0.9, 0.035 + h * 0.9 + 0.07, K.dark, { win: 1, lit: 1, glass: K.dark });
    M.wins(b, "e", by + 0.06, by + bd - 0.06, 0.035 + h * 0.45, 0.07, Math.max(1, L >= 4 ? 2 : 1), 0.06, { bars: false });
    M.lightAt(bx + bw / 2, by + bd + 0.03, 0.12, 0.18);
    if (L >= 2) { M.cyl(0.84, 0.28, 0.035, 0.07, 0.09, K.hay, { n: 8 }); M.dome(0.84, 0.28, 0.12, 0.07, K.hay, { n: 8, rings: 3, squash: 0.7 }); }
    if (L >= 3) { fencePart(M, [[0.56, 0.58, 0.94, 0.58], [0.94, 0.58, 0.94, 0.95], [0.56, 0.95, 0.94, 0.95]], 0.035, 0.08, K.woodL); M.spriteAt("knight", 0.74, 0.78, 0.2, "horse"); }
    if (L >= 4) { const ls = M.box(bx + bw, 0.2, 0.035, 0.14, 0.3, h * 0.55, wc); M.gable(bx + bw, 0.2, 0.035 + h * 0.55, 0.14, 0.3, 0.07, rc, { axis: "y", gc: wc, ov: 0.03 }); }
    if (L >= 5) { M.spriteAt("knight", 0.66, 0.68, 0.19, "horse2", { flip: 1 }); M.flag(bx + bw / 2, by + bd / 2, 0.035 + h + 0.14 + 0.01 * L, 0.18, K.gold, { w: 0.14 }); }
    if (L >= 6) {
      M.box(0.52, 0.55, 0.035, 0.05, 0.05, 0.26, K.stoneL); M.box(0.9, 0.55, 0.035, 0.05, 0.05, 0.26, K.stoneL);
      M.box(0.52, 0.55, 0.26, 0.43, 0.05, 0.03, K.stoneL); M.flag(0.545, 0.575, 0.295, 0.12, K.violet, { w: 0.12 });
      M.spriteAt("knight", 0.8, 0.86, 0.2, "horse3"); M.tree(0.1, 0.8, 0.9); M.tree(0.22, 0.9, 0.7, "bush");
    }
  };

  /* ---------- КАПЕЛЛА СЛОНА ---------- */
  B.chapel = function (M, L) {
    lawn(M);
    for (let i = 0; i < 4; i++) { const p = M.part(); M.flat(p, 0.45, 0.78 + i * 0.055, 0.037, 0.1, 0.045, i % 2 ? K.paving : K.paving2, {}); p.cx = 0.5; p.cy = 0.8 + i * 0.055; p.cz = 0.037; p.bias = -80; }
    const nw = 0.34 + 0.005 * L, nd = 0.46 + 0.02 * L, nx = 0.5 - nw / 2, ny = 0.1, h = 0.25 + 0.03 * L;
    const nave = M.box(nx, ny, 0.035, nw, nd, h, K.stoneL);
    M.gable(nx, ny, 0.035 + h, nw, nd, 0.14 + 0.01 * L, L < 4 ? K.roofB : K.roofV, { axis: "y", gc: K.stoneL, ov: 0.035 });
    const tn = L >= 5 ? 2 : 1, tw = 0.17 - (tn - 1) * 0.02;
    for (let i = 0; i < tn; i++) {
      const tx = tn === 1 ? 0.5 - tw / 2 : (i === 0 ? 0.2 : 0.8 - tw), ty = ny + nd - 0.08;
      const th = h + 0.1 + 0.035 * L + (i ? -0.03 : 0.0);
      const t = M.box(tx, ty, 0.035, tw, tw + 0.04, th, K.stone);
      M.wallQ(t, "s", ty + tw + 0.04 + 0.01, tx - 0.012, tx + tw + 0.012, 0.035 + th * 0.62, 0.035 + th * 0.62 + 0.02, K.stoneL, {});
      M.wins(t, "s", tx + 0.03, tx + tw - 0.03, 0.035 + th * 0.68, 0.1, 1, 0.045, { arch: true, glass: K.violet });
      if (i === 0 || tn === 1) { M.door(t, "s", tx + tw / 2, 0.08, 0.13, { z: 0.035 }); M.disc(t, "s", tx + tw / 2, 0.035 + th * 0.4, 0.035, [150, 120, 255], { win: 1, lit: 1 }); }
      const sh = 0.2 + 0.035 * L;
      const sp = M.pyr(tx, ty, 0.035 + th, tw, tw + 0.04, sh, L < 4 ? K.roofB : K.roofV, { ov: 0.02 });
      const tz = 0.035 + th + sh;
      if (L >= 6) { M.dome(tx + tw / 2, ty + (tw + 0.04) / 2, tz - 0.02, 0.025, K.gold, { n: 8, rings: 3 }); M.box(tx + tw / 2 - 0.006, ty + (tw + 0.04) / 2 - 0.006, tz, 0.012, 0.012, 0.09, K.gold); M.box(tx + tw / 2 - 0.03, ty + (tw + 0.04) / 2 - 0.006, tz + 0.045, 0.06, 0.012, 0.012, K.gold); }
      else M.flag(tx + tw / 2, ty + (tw + 0.04) / 2, tz, 0.12, K.violet, { w: 0.1 });
    }
    const k = Math.max(1, Math.floor(nd / 0.15));
    M.wins(nave, "e", ny + 0.05, ny + nd - 0.14, 0.035 + h * 0.4, 0.14 + 0.01 * L, k, 0.05, { arch: true, glass: [140, 110, 240], frame: true });
    M.wins(nave, "w", ny + 0.05, ny + nd - 0.14, 0.035 + h * 0.4, 0.14 + 0.01 * L, k, 0.05, { arch: true, glass: [140, 110, 240] });
    if (L >= 4) { const p = M.part(); for (let i = 0; i < 3; i++) { const yy = ny + 0.1 + i * (nd - 0.2) / 2.2; M.boxIn(p, nx - 0.035, yy, 0.035, 0.035, 0.05, h * 0.85, K.stone); M.boxIn(p, nx + nw, yy, 0.035, 0.035, 0.05, h * 0.85, K.stone); } p.cx = 0.5; p.cy = ny + nd / 2; p.cz = h / 2; p.bias = -1; }
    if (L >= 2) { M.tree(0.14, 0.82, 0.8, "pine"); M.tree(0.88, 0.18, 0.85); }
    if (L >= 3) M.tree(0.9, 0.7, 0.7, "bush", { c: K.leaf3 });
    M.lightAt(0.5, 0.88, 0.14, 0.22, [190, 160, 255]);
  };

  /* ---------- БАШНИ ЛАДЕЙ ---------- */
  B.towers = function (M, L) {
    lawn(M, K.paving, 0.96, 0.96);
    const sc = L < 2 ? K.wood : K.stone;
    if (L === 1 || L === 2) {
      const h = 0.45 + 0.1 * L, b = M.box(0.34, 0.34, 0.035, 0.32, 0.32, h, sc);
      M.box(0.31, 0.31, 0.035 + h, 0.38, 0.38, 0.05, L < 2 ? K.woodD : K.stoneD);
      M.crenel(0.31, 0.31, 0.085 + h, 0.38, 0.38, sc, { s: 0.07, h: 0.07 });
      M.door(b, "s", 0.5, 0.1, 0.15, { z: 0.035 });
      M.wins(b, "s", 0.4, 0.6, 0.035 + h * 0.6, 0.09, 1, 0.045, { arch: true });
      M.wins(b, "e", 0.4, 0.6, 0.035 + h * 0.45, 0.09, 1, 0.045, { arch: true });
      M.flag(0.5, 0.5, 0.035 + h, 0.3, K.red, { w: 0.14 });
      return;
    }
    const tall = at([0, 0, 0.55, 0.6, 0.72, 0.9], L), r = L >= 6 ? 0.155 : 0.125;
    const pos = [[0.27, 0.5], [0.73, 0.5]];
    if (L >= 4) {
      const g = M.box(0.27, 0.4, 0.035, 0.46, 0.2, 0.26 + 0.02 * L, K.stoneL);
      M.crenel(0.27, 0.4, 0.035 + 0.26 + 0.02 * L, 0.46, 0.2, K.stoneL, { s: 0.06, h: 0.06 });
      const gz = 0.035;
      M.wallQ(g, "s", 0.605, 0.42, 0.58, gz, gz + 0.17, K.dark, {});
      for (let i = 0; i < 4; i++) M.wallQ(g, "s", 0.608, 0.42, 0.58, gz + 0.03 + i * 0.04, gz + 0.045 + i * 0.04, K.stoneD, {});
      M.lightAt(0.5, 0.62, 0.12, 0.2);
    }
    pos.forEach(([cx, cy], i) => {
      const h = tall + (i ? -0.05 : 0.0);
      const t = M.cyl(cx, cy, 0.035, r, h, K.stone, { n: 12 });
      M.cyl(cx, cy, 0.035 + h * 0.45, r + 0.012, 0.03, K.stoneL, { n: 12 });
      for (let k = 0; k < (L >= 5 ? 3 : 2); k++) slit(M, t, cx, cy, r, 0.035 + h * (0.2 + k * 0.22), 0.09, 1.1 + k * 0.9 + i, K.dark);
      M.cyl(cx, cy, 0.035 + h, r + 0.03, 0.045, K.stoneD, { n: 12, r2: r + 0.045, noTop: false });
      M.crenelRing(cx, cy, 0.08 + h, r + 0.025, K.stoneL, { n: L >= 6 ? 10 : 8, s: 0.065, h: 0.065 });
      if (L >= 4) M.flag(cx, cy, 0.08 + h, 0.22 + 0.02 * L, i ? K.violet : K.red, { w: 0.15 });
      if (L >= 6) { M.lightAt(cx, cy + r + 0.02, 0.035 + h * 0.5, 0.2); M.box(cx - 0.02, cy + r - 0.01, 0.035 + h * 0.2 - 0.02, 0.04, 0.03, 0.05, K.dark); }
    });
    if (L >= 3) { lamp(M, 0.1, 0.9, 0.17); }
    if (L >= 5) { M.spriteAt("rook", 0.5, 0.82, 0.14, "classic", { stat: 1 }); }
  };

  /* ---------- АКАДЕМИЯ ---------- */
  B.academy = function (M, L) {
    lawn(M, K.paving, 0.96, 0.96);
    const bw = 0.56 + 0.006 * L, bd = 0.48, bx = 0.5 - bw / 2, by = 0.14, fl = L < 3 ? 1 : 2, fh = 0.2, H = fl * fh;
    const wc = L < 3 ? K.plasterW : K.stoneL;
    const b = M.box(bx, by, 0.035, bw, bd, H, wc);
    M.wallQ(b, "s", by + bd + 0.01, bx - 0.012, bx + bw + 0.012, 0.035 + H - 0.035, 0.035 + H, K.violet, {});
    checkerTop(M, b, bx, by, bw, bd, 0.035 + H + 0.001, 6, K.white, K.dark);
    M.crenel(bx - 0.01, by - 0.01, 0.035 + H, bw + 0.02, bd + 0.02, K.stone, { s: 0.05, h: 0.035 });
    M.door(b, "s", 0.5, 0.1, 0.15, { z: 0.035, frame: K.violet });
    for (let f = 0; f < fl; f++) {
      const wz = 0.035 + f * fh + 0.07;
      M.wins(b, "s", bx + 0.04, 0.5 - 0.09, wz, 0.1, Math.max(1, Math.round((bw / 2 - 0.12) / 0.11)), 0.06, { arch: L >= 4, fc: K.violet });
      M.wins(b, "s", 0.5 + 0.09, bx + bw - 0.04, wz, 0.1, Math.max(1, Math.round((bw / 2 - 0.12) / 0.11)), 0.06, { arch: L >= 4, fc: K.violet });
      M.wins(b, "e", by + 0.05, by + bd - 0.05, wz, 0.1, 3, 0.06, { fc: K.violet });
      M.wins(b, "w", by + 0.05, by + bd - 0.05, wz, 0.1, 3, 0.06, { fc: K.violet });
    }
    M.box(0.5 - 0.1, by + bd, 0.035, 0.2, 0.08, 0.035, K.stoneL);
    if (L >= 2) M.disc(b, "s", 0.5, 0.035 + H - 0.075, 0.04, K.white, { hands: true });
    if (L >= 4) {
      for (let i = 0; i < 4; i++) M.cyl(0.5 - 0.12 + i * 0.08, by + bd + 0.07, 0.07, 0.016, fh * fl - 0.035, K.marble, { n: 7 });
      M.box(0.5 - 0.15, by + bd + 0.0, 0.035 + H - 0.0, 0.3, 0.14, 0.03, K.marble);
      M.gable(0.5 - 0.15, by + bd + 0.0, 0.035 + H + 0.03, 0.3, 0.14, 0.08, K.stoneL, { axis: "x", gc: K.marble, ov: 0.015 });
    }
    if (L >= 5) {
      M.cyl(0.5, by + bd * 0.4, 0.035 + H + 0.035, 0.12, 0.08, K.stoneL, { n: 12 });
      M.dome(0.5, by + bd * 0.4, 0.035 + H + 0.115, 0.12, L >= 6 ? K.gold : K.copper, { n: 12, rings: 4, squash: 0.95, ribs: L >= 6, rib: K.goldD });
      const ts = M.box(0.5 - 0.012, by + bd * 0.4 + 0.02, 0.035 + H + 0.2, 0.024, 0.09, 0.03, K.dark);
      M.flag(0.5, by + bd * 0.4, 0.035 + H + 0.115 + 0.12 * 0.95, 0.12, K.gold, { w: 0.12 });
    }
    if (L >= 6) {
      const px = bx - 0.0, p = M.part();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) M.wallQ(p, "e", bx + bw + 0.012, by + 0.08 + j * 0.05, by + 0.13 + j * 0.05, 0.035 + H - 0.2 + i * 0.045, 0.035 + H - 0.155 + i * 0.045, (i + j) % 2 ? K.white : K.dark, { ref: b.fs.e });
      p.cx = bx + bw; p.cy = by + 0.2; p.cz = 0.1; p.bias = 2;
      lamp(M, 0.15, 0.92, 0.17); lamp(M, 0.85, 0.92, 0.17);
    }
    if (L >= 3) M.tree(0.1, 0.34, 0.8, "bush", { c: K.leaf3 });
    M.lightAt(0.5, by + bd + 0.04, 0.1, 0.22, [200, 190, 255]);
  };

  /* ---------- РЫНОК ---------- */
  function stall(M, x, y, w, d, c1, c2, o) {
    o = o || {};
    const c = M.box(x, y + d * 0.45, 0.035, w, d * 0.55, 0.085, K.woodL);
    const p = M.part();
    const cols = [K.red, K.yellow, K.green, K.pink, K.blue];
    for (let i = 0; i < 4; i++) M.boxIn(p, x + 0.03 + i * (w - 0.06) / 4, y + d * 0.5, 0.12, 0.035, 0.035, 0.03 + (i % 2) * 0.012, cols[(i + (o.seed || 0)) % 5]);
    p.cx = x + w / 2; p.cy = y + d * 0.55; p.cz = 0.13;
    [[x, y], [x + w - 0.014, y], [x, y + d - 0.014], [x + w - 0.014, y + d - 0.014]].forEach(([px, py]) => M.box(px, py, 0.035, 0.014, 0.014, 0.19, K.woodD));
    const aw = M.part(), n = 6, sw = w / n, zf = 0.2, zb = 0.26;
    for (let i = 0; i < n; i++) M.add(aw, [[x + i * sw - 0.01, y + d + 0.03, zf], [x + (i + 1) * sw + 0.01, y + d + 0.03, zf], [x + (i + 1) * sw + 0.01, y - 0.0, zb], [x + i * sw - 0.01, y - 0.0, zb]], i % 2 ? c2 : c1, { ds: true }, [x + w / 2, y + d / 2, 0]);
    aw.cx = x + w / 2; aw.cy = y + d / 2; aw.cz = 0.24; M.top = Math.max(M.top, zb);
    M.lightAt(x + w / 2, y + d, 0.18, 0.12);
  }
  B.market = function (M, L) {
    lawn(M, K.paving, 0.96, 0.96);
    const spots = [[0.1, 0.52, 0.38, 0.38, K.red, K.white], [0.52, 0.52, 0.38, 0.38, K.blue, K.white], [0.1, 0.1, 0.38, 0.34, K.green, K.white], [0.52, 0.1, 0.38, 0.34, K.yellow, K.white], [0.3, 0.3, 0.4, 0.3, K.violet, K.white]];
    const cnt = at([1, 2, 2, 3, 4, 4], L);
    const ord = L >= 5 ? [0, 1, 2, 3] : [0, 1, 2, 3];
    for (let i = 0; i < cnt; i++) { const s = spots[ord[i]]; stall(M, s[0], s[1], s[2], s[3], s[4], s[5], { seed: i }); }
    if (L >= 3) { const p = M.part(); for (let i = 0; i < 3; i++) M.boxIn(p, 0.88 + (i % 2) * 0.03, 0.3 + i * 0.08, 0.035, 0.07, 0.07, 0.06, K.wood); p.cx = 0.9; p.cy = 0.4; p.cz = 0.06; }
    if (L >= 5) { M.cyl(0.5, 0.5, 0.035, 0.012, 0.34, K.woodD, { n: 5 }); M.flag(0.5, 0.5, 0.375, 0.1, K.red, { w: 0.18, c2: K.yellow }); M.lightAt(0.5, 0.5, 0.3, 0.25); }
    if (L >= 6) { M.cyl(0.5, 0.5, 0.42, 0.06, 0.012, K.gold, { n: 14, shine: 1 }); M.spriteAt("pawn", 0.5, 0.95, 0.12, "gold", { stat: 1 }); }
    if (L >= 4) M.flag(0.1, 0.1, 0.26, 0.14, K.violet, { w: 0.12 });
  };

  /* ---------- САД КОРОЛЯ ---------- */
  function flowerBed(M, x, y, w, d, seed) {
    const r = rnd(seed), p = M.part(), cols = [K.pink, K.yellow, K.red, K.white, K.violet];
    M.boxIn(p, x, y, 0.035, w, d, 0.015, K.grassD);
    const n = Math.round(w * d * 140);
    for (let i = 0; i < n; i++) M.boxIn(p, x + 0.015 + r() * (w - 0.04), y + 0.015 + r() * (d - 0.04), 0.05, 0.022, 0.022, 0.025, cols[(r() * 5) | 0]);
    p.cx = x + w / 2; p.cy = y + d / 2; p.cz = 0.05; p.bias = -40;
  }
  function topiary(M, x, y, kind, s) {
    s = s || 1;
    M.cyl(x, y, 0.035, 0.045 * s, 0.04 * s, K.leaf3, { n: 8 });
    M.cyl(x, y, 0.07 * s, 0.026 * s, 0.07 * s, K.leaf3, { n: 8 });
    M.dome(x, y, 0.135 * s, 0.045 * s, K.leaf, { n: 8, rings: 3 });
    if (kind === "king") { M.box(x - 0.006, y - 0.006, 0.19 * s, 0.012, 0.012, 0.06 * s, K.gold); M.box(x - 0.025, y - 0.006, 0.225 * s, 0.05, 0.012, 0.012, K.gold); }
  }
  B.garden = function (M, L) {
    lawn(M, K.grass);
    for (let i = 0; i < 5; i++) { const p = M.part(); M.flat(p, i % 2 ? 0.46 : 0.5, 0.9 - i * 0.07, 0.037, 0.045, 0.06, i % 2 ? K.paving : K.paving2, {}); p.cx = 0.5; p.cy = 0.93 - i * 0.07; p.cz = 0.037; p.bias = -80; }
    if (L >= 2) { const p = M.part(); for (let i = 0; i < 6; i++) { M.boxIn(p, 0.04 + i * 0.075, 0.05, 0.035, 0.07, 0.05, 0.07, K.leaf3); } p.cx = 0.25; p.cy = 0.07; p.cz = 0.07; p.bias = -5; }
    M.tree(0.74, 0.3, 1.0);
    if (L >= 2) { M.tree(0.22, 0.3, 0.9); M.tree(0.82, 0.7, 0.8, "pine"); }
    if (L >= 3) {
      flowerBed(M, 0.12, 0.55, 0.26, 0.14, 11); flowerBed(M, 0.62, 0.56, 0.24, 0.12, 5);
      const bn = M.box(0.58, 0.8, 0.035, 0.16, 0.05, 0.04, K.woodL); M.box(0.58, 0.83, 0.075, 0.16, 0.02, 0.05, K.woodL);
    }
    if (L >= 4) topiary(M, 0.3, 0.66, "pawn", 1.1);
    if (L >= 5) { M.cyl(0.2, 0.82, 0.035, 0.1, 0.035, K.stoneL, { n: 12 }); const w = M.cyl(0.2, 0.82, 0.068, 0.085, 0.008, K.water, { n: 12, shine: 1 }); w.water = true; M.water.push({ x: 0.2, y: 0.82, z: 0.09, r: 0.07 }); }
    if (L >= 6) {
      topiary(M, 0.68, 0.64, "king", 1.2);
      M.box(0.43, 0.04, 0.035, 0.03, 0.03, 0.26, K.stoneL); M.box(0.54, 0.04, 0.035, 0.03, 0.03, 0.26, K.stoneL);
      for (let i = 0; i <= 8; i++) { const a = i / 8 * PI, p = M.part(); M.boxIn(p, 0.485 + cos(a) * 0.055 - 0.015, 0.045, 0.28 + sin(a) * 0.055, 0.03, 0.02, 0.025, K.gold); p.cx = 0.5; p.cy = 0.05; p.cz = 0.3; p.bias = 1; }
      M.lightAt(0.5, 0.8, 0.2, 0.3, [255, 230, 190]);
    }
  };

  /* ---------- ДВОРЕЦ ФЕРЗЯ 2×2 ---------- */
  B.palace = function (M, L) {
    const pad = M.box(0.03, 0.03, 0, 1.94, 1.94, 0.05, K.paving2, { bias: -100, top: K.paving2 });
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) M.flat(pad, 0.03 + i * 0.2425, 0.03 + j * 0.2425, 0.0515, 0.2425, 0.2425, K.marble, { ref: pad.fs.t });
    const W = at([0.74, 0.78, 0.82, 0.86, 0.9, 0.94], L), D = 0.7, H = 0.62, bx = 1 - W / 2, by = 0.82 - D / 2, z0 = 0.12;
    const wc = K.marble;
    M.box(bx - 0.04, by - 0.04, 0.05, W + 0.08, D + 0.08, 0.07, K.stoneL);
    const b = M.box(bx, by, z0, W, D, H, wc);
    [1, 2].forEach(f => M.wallQ(b, "s", by + D + 0.012, bx - 0.02, bx + W + 0.02, z0 + f * 0.31 - 0.035, z0 + f * 0.31, K.gold, { ref: b.fs.s }));
    for (let f = 0; f < 2; f++) {
      const wz = z0 + f * 0.31 + 0.08, k = Math.max(1, Math.floor((W / 2 - 0.2) / 0.2));
      M.wins(b, "s", bx + 0.07, 1 - 0.16, wz, 0.17, k, 0.085, { arch: true, fc: K.gold });
      M.wins(b, "s", 1 + 0.16, bx + W - 0.07, wz, 0.17, k, 0.085, { arch: true, fc: K.gold });
      if (f) M.wins(b, "s", 1 - 0.08, 1 + 0.08, wz, 0.17, 1, 0.085, { arch: true, fc: K.gold });
      M.wins(b, "e", by + 0.08, by + D - 0.08, wz, 0.17, 3, 0.085, { arch: true, fc: K.gold });
      M.wins(b, "w", by + 0.08, by + D - 0.08, wz, 0.17, 3, 0.085, { arch: true, fc: K.gold });
    }
    M.door(b, "s", 1, 0.2, 0.27, { z: z0, frame: K.gold });
    M.hip(bx, by, z0 + H, W, D, 0.2 + 0.02 * L, L < 3 ? K.roofT : K.copper, { ov: 0.06 });
    M.box(1 - 0.22, by + D, 0.05, 0.44, 0.14, 0.07, K.stoneL);
    if (L >= 2) {
      [bx, bx + W - 0.3].forEach((wx, i) => {
        const wgx = i ? wx : wx - 0.0;
        const ww = M.box(i ? bx + W - 0.02 : bx - 0.3 + 0.02, by + 0.06, z0, 0.3, D - 0.12, H * 0.68, wc);
        M.gable(i ? bx + W - 0.02 : bx - 0.3 + 0.02, by + 0.06, z0 + H * 0.68, 0.3, D - 0.12, 0.13, K.copper, { axis: "x", gc: wc, ov: 0.04 });
        M.wins(ww, "s", (i ? bx + W - 0.02 : bx - 0.28) + 0.05, (i ? bx + W - 0.02 : bx - 0.28) + 0.24, z0 + 0.12, 0.15, 2, 0.07, { arch: true, fc: K.gold });
        M.wins(ww, i ? "e" : "w", by + 0.12, by + D - 0.12, z0 + 0.12, 0.15, 2, 0.07, { arch: true, fc: K.gold });
      });
    }
    if (L >= 3) {
      const dz = z0 + H + 0.08;
      const dr = M.cyl(1, by + D * 0.5, dz - 0.04, 0.2, 0.18, wc, { n: 14 });
      for (let i = 0; i < 7; i++) slit(M, dr, 1, by + D * 0.5, 0.2, dz, 0.1, i / 7 * TAU + 0.2, K.glass);
      M.cyl(1, by + D * 0.5, dz + 0.14, 0.225, 0.03, K.gold, { n: 14 });
      M.dome(1, by + D * 0.5, dz + 0.17, 0.2, L >= 5 ? K.gold : K.copper, { n: 14, rings: 5, squash: 1.0, ribs: L >= 4, rib: K.gold });
      M.lightAt(1, by + D * 0.5, dz + 0.05, 0.3, [255, 220, 150]);
    }
    if (L >= 4) [[bx + 0.01, by + 0.01], [bx + W - 0.01, by + 0.01], [bx + 0.01, by + D - 0.01], [bx + W - 0.01, by + D - 0.01]].forEach(([tx, ty], i) => {
      const tp = M.cyl(tx, ty, z0, 0.07, H + 0.12, wc, { n: 10 });
      M.cone(tx, ty, z0 + H + 0.12, 0.095, 0.24, L >= 6 ? K.gold : K.roofV, { n: 10 });
      M.flag(tx, ty, z0 + H + 0.36, 0.12, K.violet, { w: 0.12, c2: K.gold });
    });
    if (L >= 5) {
      const py = by + D;
      for (let i = 0; i < 4; i++) M.cyl(1 - 0.21 + i * 0.14, py + 0.1, z0, 0.026, 0.52, K.marble, { n: 8 });
      M.box(1 - 0.28, py, z0 + 0.52, 0.56, 0.16, 0.05, K.marble);
      M.gable(1 - 0.28, py, z0 + 0.57, 0.56, 0.16, 0.11, K.stoneL, { axis: "x", gc: K.marble, ov: 0.02 });
    }
    const gy = Math.min(1.7, by + D + 0.46);
    if (L >= 3) { M.cyl(1, gy, 0.05, 0.1, 0.04, K.stoneL, { n: 12 }); const w = M.cyl(1, gy, 0.082, 0.085, 0.008, K.water, { n: 12 }); w.water = true; M.cyl(1, gy, 0.09, 0.014, 0.09, K.stoneL, { n: 6 }); M.water.push({ x: 1, y: gy, z: 0.18, r: 0.08 }); }
    lamp(M, 0.22, 1.7, 0.2); lamp(M, 1.78, 1.7, 0.2);
    if (L >= 2) { M.tree(0.2, 1.4, 0.8, "bush", { c: K.leaf3 }); M.tree(1.8, 1.4, 0.8, "bush", { c: K.leaf3 }); }
    if (L >= 6) {
      M.spriteAt("queen", 0.55, 1.62, 0.26, "gold", { stat: 1 }); M.spriteAt("queen", 1.45, 1.62, 0.26, "gold", { stat: 1 });
      const cz = z0 + H + 0.08 + 0.17 + 0.2 + 0.0, cr = 0.09;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; M.cone(1 + cos(a) * cr, by + D * 0.5 + sin(a) * cr, cz - 0.01, 0.018, 0.075 + (i % 2) * 0.03, K.gold, { n: 5 }); }
      M.dome(1, by + D * 0.5, cz + 0.02, 0.03, K.pink, { n: 8, rings: 3 });
    }
    M.lightAt(1, by + D + 0.06, z0 + 0.12, 0.3);
  };

  /* ---------- КОРОЛЕВСКИЙ ЗАМОК 2×2 ---------- */
  B.castle = function (M, L) {
    const pad = M.box(0.03, 0.03, 0, 1.94, 1.94, 0.05, K.stoneD, { bias: -100, top: K.stoneD });
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) M.flat(pad, 0.03 + i * 0.2425, 0.03 + j * 0.2425, 0.0515, 0.2425, 0.2425, K.paving, { ref: pad.fs.t });
    const z0 = 0.05, wh = 0.2 + 0.02 * L;
    // стены двора
    if (L >= 2) {
      const e = 0.12, t = 0.08;
      const wallsDef = [[e, e, 1.76, t, "n"], [e, 1.8, 1.76, t, "s"], [e, e, t, 1.76, "w"], [1.8, e, t, 1.76, "e"]];
      wallsDef.forEach(([x, y, w, d, side]) => {
        if (side === "s") {
          M.box(x, y, z0, 0.72, d, wh, K.stone); M.crenel(x, y, z0 + wh, 0.72, d, K.stoneL, { s: 0.06, h: 0.05 });
          M.box(x + 1.04, y, z0, 0.72, d, wh, K.stone); M.crenel(x + 1.04, y, z0 + wh, 0.72, d, K.stoneL, { s: 0.06, h: 0.05 });
        } else { M.box(x, y, z0, w, d, wh, K.stone); M.crenel(x, y, z0 + wh, w, d, K.stoneL, { s: 0.06, h: 0.05 }); }
      });
      // ворота
      const g = M.box(0.84, 1.76, z0, 0.32, 0.16, wh + 0.08, K.stoneL);
      M.wallQ(g, "s", 1.926, 0.9, 1.1, z0, z0 + 0.17, K.dark, {});
      for (let i = 0; i < 4; i++) M.wallQ(g, "s", 1.93, 0.9, 1.1, z0 + 0.03 + i * 0.04, z0 + 0.045 + i * 0.04, K.stoneD, {});
      M.crenel(0.84, 1.76, z0 + wh + 0.08, 0.32, 0.16, K.stoneL, { s: 0.055, h: 0.05 });
      M.flag(1, 1.84, z0 + wh + 0.13, 0.16, K.violet, { w: 0.12 });
      M.lightAt(1, 1.94, 0.14, 0.2);
    }
    // угловые башни
    if (L >= 2) [[0.16, 0.16], [1.84, 0.16], [0.16, 1.84], [1.84, 1.84]].forEach(([tx, ty], i) => {
      const th = wh + 0.14 + 0.03 * L;
      const t = M.cyl(tx, ty, z0, 0.13, th, K.stone, { n: 10 });
      for (let k = 0; k < 2; k++) slit(M, t, tx, ty, 0.13, z0 + th * (0.3 + k * 0.3), 0.08, 0.8 + i * 1.57 + k, K.dark);
      if (L >= 3) { M.cyl(tx, ty, z0 + th, 0.15, 0.035, K.stoneD, { n: 10 }); M.cone(tx, ty, z0 + th + 0.035, 0.16, 0.26 + 0.015 * L, L >= 5 ? K.roofV : K.roofR, { n: 10 }); if (L >= 4) M.flag(tx, ty, z0 + th + 0.3 + 0.015 * L, 0.13, i % 2 ? K.gold : K.violet, { w: 0.13 }); }
      else { M.crenelRing(tx, ty, z0 + th, 0.12, K.stoneL, { n: 8, s: 0.06, h: 0.06 }); }
    });
    // главная башня-донжон
    const kw = Math.min(0.78, 0.46 + 0.05 * L), kh = 0.5 + 0.17 * L, kx = 1 - kw / 2, ky = 0.95 - kw / 2;
    const keep = M.box(kx, ky, z0, kw, kw, kh, L < 4 ? K.stone : K.stoneL);
    for (let f = 1; f < Math.round(kh / 0.3); f++) M.wallQ(keep, "s", ky + kw + 0.01, kx - 0.012, kx + kw + 0.012, z0 + f * 0.3 - 0.025, z0 + f * 0.3, K.stoneD, { ref: keep.fs.s });
    const nrow = Math.max(1, Math.floor((kh - 0.25) / 0.3));
    for (let f = 0; f < nrow; f++) {
      const wz = z0 + 0.3 + f * 0.3 - 0.0;
      M.wins(keep, "s", kx + 0.06, kx + kw - 0.06, wz, 0.13, Math.max(1, Math.round((kw - 0.12) / 0.2)), 0.07, { arch: true, fc: K.stoneD });
      M.wins(keep, "e", ky + 0.06, ky + kw - 0.06, wz, 0.13, Math.max(1, Math.round((kw - 0.12) / 0.2)), 0.07, { arch: true, fc: K.stoneD });
      M.wins(keep, "w", ky + 0.06, ky + kw - 0.06, wz, 0.13, Math.max(1, Math.round((kw - 0.12) / 0.2)), 0.07, { arch: true, fc: K.stoneD });
    }
    M.door(keep, "s", 1, 0.17, 0.22, { z: z0, frame: K.stoneD });
    M.box(kx - 0.03, ky + kw + 0.0, z0 + kh, kw + 0.06, 0.0 + 0.0001, 0.0001, K.stoneD);
    const lip = M.box(kx - 0.04, ky - 0.04, z0 + kh, kw + 0.08, kw + 0.08, 0.05, K.stoneD);
    M.crenel(kx - 0.04, ky - 0.04, z0 + kh + 0.05, kw + 0.08, kw + 0.08, K.stoneL, { s: 0.07, h: 0.08 });
    if (L >= 3) [[kx, ky], [kx + kw, ky], [kx, ky + kw], [kx + kw, ky + kw]].forEach(([tx, ty], i) => {
      const th = kh + 0.12 + 0.03 * L, rr = 0.075;
      M.cyl(tx, ty, z0, rr, th, K.stoneL, { n: 8 });
      M.cone(tx, ty, z0 + th, rr + 0.025, 0.2 + 0.02 * L, L >= 5 ? K.roofV : K.roofR, { n: 8 });
      if (L >= 4) M.flag(tx, ty, z0 + th + 0.2 + 0.02 * L, 0.1, K.gold, { w: 0.11 });
    });
    if (L >= 6) {
      const cz = z0 + kh + 0.13, cr = kw * 0.34;
      M.cyl(1, ky + kw / 2, cz, cr + 0.03, 0.06, K.gold, { n: 12 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; M.cone(1 + cos(a) * cr, ky + kw / 2 + sin(a) * cr, cz + 0.05, 0.026, 0.1 + (i % 2) * 0.05, K.gold, { n: 5 }); M.dome(1 + cos(a) * cr, ky + kw / 2 + sin(a) * cr, cz + 0.15 + (i % 2) * 0.05, 0.014, K.pink, { n: 5, rings: 2 }); }
      M.dome(1, ky + kw / 2, cz + 0.05, cr * 0.8, K.violet, { n: 12, rings: 4, squash: 0.7 });
      M.box(1 - 0.012, ky + kw / 2 - 0.012, cz + 0.05 + cr * 0.56, 0.024, 0.024, 0.14, K.gold); M.box(1 - 0.05, ky + kw / 2 - 0.012, cz + 0.05 + cr * 0.56 + 0.07, 0.1, 0.024, 0.024, K.gold);
      M.lightAt(1, ky + kw / 2, z0 + kh * 0.7, 0.35, [255, 220, 150]);
    } else if (L >= 4) M.flag(1, ky + kw / 2, z0 + kh + 0.13, 0.22 + 0.02 * L, L >= 5 ? K.gold : K.violet, { w: 0.2, c2: K.white });
    else M.flag(1, ky + kw / 2, z0 + kh + 0.13, 0.2, K.red, { w: 0.18 });
    if (L >= 2) { lamp(M, 0.55, 1.6, 0.18); lamp(M, 1.45, 1.6, 0.18); }
    if (L >= 5) { M.spriteAt("king", 0.7, 1.52, 0.24, "gold", { stat: 1 }); M.spriteAt("king", 1.3, 1.52, 0.24, "gold", { stat: 1 }); }
    M.lightAt(1, ky + kw + 0.05, z0 + 0.14, 0.28);
  };

  function buildModel(id, L) {
    const f = footOf(id), M = new Model(f[0], f[1]);
    (B[id] || B.cottages)(M, Math.max(1, L | 0));
    return M.finish();
  }

  /* =====================================================================
     ФИГУРКИ-ЖИТЕЛИ: пешка, ладья, слон, конь, ферзь, король — спрайты с объёмной подсветкой.
     ===================================================================== */
  const pal = (hi, mid, lo, acc, eye) => ({ hi: hex(hi), mid: hex(mid), lo: hex(lo), acc: hex(acc || "#e3bf7c"), eye: hex(eye || "#1c1a24") });
  const P_IVORY = pal("#fffaf0", "#e5dcc6", "#9d9378", "#c9a24e"), P_GRAPH = pal("#6b6a7c", "#3b3a49", "#17161f", "#e3bf7c", "#f6f2e6");
  const SPRITE_PAL = {
    classic: P_IVORY, gold: pal("#fff0b0", "#f0c660", "#9a6c1c", "#fff3c9"),
    horse: pal("#c99a6a", "#8e6038", "#4a2f1a", "#2a1a10", "#17110d"), horse2: pal("#ffffff", "#d9dbe3", "#8d93a6", "#6a6f82"), horse3: pal("#5a5a68", "#2e2e3a", "#101018", "#9b9bb0", "#f2f2f2")
  };
  const MIX = ["pawn", "knight", "pawn", "bishop", "pawn", "rook", "pawn", "queen", "pawn", "king"];
  const SKINS = [
    { id: "skin-classic", price: 0, set: ["pawn"], teams: [P_IVORY, P_GRAPH] },
    { id: "skin-court", price: 110, set: MIX, teams: [P_IVORY, P_GRAPH] },
    { id: "skin-jade", price: 160, set: ["pawn", "knight", "pawn", "bishop", "pawn", "rook"], teams: [pal("#d7ffe9", "#72d6a3", "#2b7a57", "#fff3c9"), pal("#4f9a7d", "#256b50", "#0e3426", "#9af0c5", "#f2fff8")] },
    { id: "skin-ruby", price: 210, set: MIX, teams: [pal("#ffc8d0", "#e2455f", "#7c1224", "#ffe3a6"), pal("#bcd0ff", "#4f78e0", "#1b2f7a", "#ffe3a6")] },
    { id: "skin-frost", price: 250, set: ["pawn", "bishop", "pawn", "knight", "pawn", "rook", "queen"], teams: [pal("#ffffff", "#cfe9ff", "#7fa6c8", "#9fd8ff"), pal("#8fb7e0", "#4a79ad", "#1d3a5c", "#e8f6ff", "#f4fbff")] },
    { id: "skin-gold", price: 320, set: MIX, teams: [pal("#fff3b8", "#f0c660", "#a2711f", "#fffbe6"), pal("#d9a35a", "#9c6a2c", "#4e300f", "#ffe9a8", "#fff6d6")] },
    { id: "skin-ghost", price: 400, glow: true, set: MIX, teams: [pal("#efeaff", "#b98bf5", "#5f2fb8", "#ffffff", "#2a2064"), pal("#bfffe9", "#72d6a3", "#2b7a57", "#ffffff", "#0c3a29")] }
  ];
  const SKIN_BY_ID = {}; SKINS.forEach(s => { SKIN_BY_ID[s.id] = s; });

  const PROF = {
    pawn: [[.34, 0], [.34, .06], [.28, .10], [.16, .17], [.13, .44], [.23, .51], [.23, .56], [.13, .61]],
    rook: [[.36, 0], [.36, .07], [.29, .12], [.23, .2], [.23, .62], [.32, .68], [.32, .74]],
    bishop: [[.34, 0], [.34, .06], [.28, .10], [.16, .17], [.14, .5], [.24, .56], [.24, .6], [.14, .65]],
    queen: [[.36, 0], [.36, .07], [.29, .12], [.17, .2], [.15, .45], [.28, .68], [.28, .72]],
    king: [[.36, 0], [.36, .07], [.29, .12], [.17, .2], [.15, .45], [.27, .66], [.27, .7]]
  };
  const KNIGHT = [[-.26, .2], [-.28, .4], [-.22, .6], [-.14, .76], [-.17, .94], [-.07, .86], [.03, 1.01], [.09, .87], [.24, .81], [.4, .58], [.38, .49], [.22, .52], [.12, .5], [.16, .36], [.26, .2]];
  const TYPE_SCALE = { pawn: 0.8, rook: 0.88, bishop: 0.94, knight: 0.92, queen: 1.02, king: 1.08 };
  const EYE_Z = { pawn: .78, rook: .48, bishop: .8, knight: .76, queen: .5, king: .8 };

  function figGrad(ctx, x, w, y0, y1, p, flip) {
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, rgbs(p.lo)); g.addColorStop(0.28, rgbs(p.mid)); g.addColorStop(0.48, rgbs(p.hi)); g.addColorStop(0.78, rgbs(p.mid)); g.addColorStop(1, rgbs(p.lo));
    return g;
  }
  function drawFigure(ctx, type, x, y, H, p, o) {
    o = o || {};
    const face = o.face || 1, sq = o.squash || 1, al = o.alpha == null ? 1 : o.alpha;
    const h = H * (TYPE_SCALE[type] || 0.85);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(x, y);
    ctx.scale(1 / sq, sq); // сжатие при приземлении
    if (o.glow) { ctx.shadowColor = rgbs(p.hi); ctx.shadowBlur = h * 0.6; }
    const gx = 0, w = h * 0.4;
    const grad = figGrad(ctx, gx, w, 0, -h, p);
    ctx.fillStyle = grad; ctx.strokeStyle = rgbs(p.lo, 0.85); ctx.lineWidth = Math.max(0.8, h * 0.02); ctx.lineJoin = "round";
    const L = (px, pz) => [px * h, -pz * h];
    if (type === "knight") {
      ctx.beginPath();
      ctx.moveTo(-.38 * h, 0); ctx.lineTo(.38 * h, 0); ctx.lineTo(.38 * h, -.07 * h); ctx.lineTo(.3 * h, -.12 * h); ctx.lineTo(.26 * h, -.2 * h);
      KNIGHT.slice().reverse().forEach(q => ctx.lineTo(q[0] * face * h, -q[1] * h));
      ctx.lineTo(-.26 * h, -.2 * h); ctx.lineTo(-.3 * h, -.12 * h); ctx.lineTo(-.38 * h, -.07 * h); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgbs(p.lo, 0.7); ctx.beginPath();   // грива
      ctx.moveTo(-.26 * face * h, -.45 * h); ctx.quadraticCurveTo(-.2 * face * h, -.75 * h, -.12 * face * h, -.96 * h); ctx.lineTo(-.1 * face * h, -.78 * h); ctx.quadraticCurveTo(-.16 * face * h, -.6 * h, -.2 * face * h, -.42 * h); ctx.closePath(); ctx.fill();
    } else {
      const prof = PROF[type] || PROF.pawn;
      ctx.beginPath();
      ctx.moveTo(-prof[0][0] * h, 0);
      ctx.lineTo(prof[0][0] * h, 0);
      for (let i = 1; i < prof.length; i++) ctx.lineTo(prof[i][0] * h, -prof[i][1] * h);
      for (let i = prof.length - 1; i >= 1; i--) ctx.lineTo(-prof[i][0] * h, -prof[i][1] * h);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // кольца/воротник
      ctx.strokeStyle = rgbs(p.lo, 0.5); ctx.lineWidth = Math.max(0.6, h * 0.014);
      const ring = (z, r) => { ctx.beginPath(); ctx.moveTo(-r * h, -z * h); ctx.quadraticCurveTo(0, -(z - 0.03) * h, r * h, -z * h); ctx.stroke(); };
      ring(0.1, 0.27);
      if (type === "pawn") {
        ring(0.5, 0.22);
        ctx.fillStyle = figGrad(ctx, 0, w, 0, -h, p); ctx.strokeStyle = rgbs(p.lo, 0.85); ctx.lineWidth = Math.max(0.8, h * 0.02);
        ctx.beginPath(); ctx.arc(0, -0.78 * h, 0.2 * h, 0, TAU); ctx.fill(); ctx.stroke();
        const hl = ctx.createRadialGradient(-0.07 * h, -0.85 * h, 0, -0.07 * h, -0.85 * h, 0.14 * h); hl.addColorStop(0, rgbs(p.hi, 0.7)); hl.addColorStop(1, rgbs(p.hi, 0));
        ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0, -0.78 * h, 0.2 * h, 0, TAU); ctx.fill();
      } else if (type === "rook") {
        ctx.fillStyle = figGrad(ctx, 0, w, 0, -h, p); ctx.strokeStyle = rgbs(p.lo, 0.85); ctx.lineWidth = Math.max(0.8, h * 0.02);
        const pts = [[-.33, .72], [-.33, 1.0], [-.2, 1.0], [-.2, .9], [-.07, .9], [-.07, 1.0], [.07, 1.0], [.07, .9], [.2, .9], [.2, 1.0], [.33, 1.0], [.33, .72]];
        ctx.beginPath(); pts.forEach((q, i) => { i ? ctx.lineTo(q[0] * h, -q[1] * h) : ctx.moveTo(q[0] * h, -q[1] * h); }); ctx.closePath(); ctx.fill(); ctx.stroke();
        ring(0.7, 0.3);
      } else if (type === "bishop") {
        ring(0.55, 0.22);
        ctx.fillStyle = figGrad(ctx, 0, w, 0, -h, p); ctx.strokeStyle = rgbs(p.lo, 0.85); ctx.lineWidth = Math.max(0.8, h * 0.02);
        ctx.beginPath(); ctx.ellipse(0, -0.82 * h, 0.19 * h, 0.27 * h, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = rgbs(p.lo, 0.9); ctx.lineWidth = Math.max(1, h * 0.04); ctx.beginPath(); ctx.moveTo(-0.04 * face * h, -0.98 * h); ctx.lineTo(0.12 * face * h, -0.76 * h); ctx.stroke();
        ctx.fillStyle = rgbs(p.acc); ctx.strokeStyle = rgbs(p.lo, 0.7); ctx.lineWidth = Math.max(0.6, h * 0.014); ctx.beginPath(); ctx.arc(0, -1.1 * h, 0.06 * h, 0, TAU); ctx.fill(); ctx.stroke();
      } else if (type === "queen" || type === "king") {
        ring(0.66, 0.27);
        ctx.fillStyle = figGrad(ctx, 0, w, 0, -h, p); ctx.strokeStyle = rgbs(p.lo, 0.85); ctx.lineWidth = Math.max(0.8, h * 0.02);
        if (type === "queen") {
          const pts = [[-.28, .72], [-.32, .97], [-.16, .85], [0, 1.02], [.16, .85], [.32, .97], [.28, .72]];
          ctx.beginPath(); pts.forEach((q, i) => { i ? ctx.lineTo(q[0] * h, -q[1] * h) : ctx.moveTo(q[0] * h, -q[1] * h); }); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = rgbs(p.acc);
          [[-.32, 1.0], [0, 1.06], [.32, 1.0]].forEach(q => { ctx.beginPath(); ctx.arc(q[0] * h, -q[1] * h, 0.055 * h, 0, TAU); ctx.fill(); ctx.stroke(); });
        } else {
          ctx.beginPath(); ctx.arc(0, -0.83 * h, 0.2 * h, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = rgbs(p.acc); ctx.strokeStyle = rgbs(p.lo, 0.7);
          ctx.beginPath(); ctx.rect(-0.035 * h, -1.2 * h, 0.07 * h, 0.2 * h); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.rect(-0.1 * h, -1.13 * h, 0.2 * h, 0.07 * h); ctx.fill(); ctx.stroke();
        }
      }
    }
    // глазки
    const ez = EYE_Z[type] || 0.78, ex = (type === "knight" ? 0.12 * face : 0.065) * h, spread = type === "knight" ? 0 : 0.07 * h;
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    ctx.fillStyle = rgbs(p.eye);
    const fo = (type === "knight" ? 0 : 0.045 * face * h);
    if (type === "knight") { ctx.beginPath(); ctx.arc(ex, -ez * h, 0.035 * h, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(-spread + fo, -ez * h, 0.032 * h, 0, TAU); ctx.arc(spread + fo, -ez * h, 0.032 * h, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* =====================================================================
     ТЕМЫ
     ===================================================================== */
  const TH = {
    dusk:   { sky: ["#3a2f6b", "#1d1a38", "#12121f"], glow: "#8e55e6", tile: ["#8a84b3", "#4e4a76"], slab: ["#3b3659", "#25213b"], stripe: "#8e55e6", tint: [0.94, 0.92, 1.06], amb: 0.6, night: 0.95, warm: [255, 206, 130], fx: "stars", orb: "moon", hills: ["#241f40", "#1a1830"], edge: "#b98bf5" },
    dawn:   { sky: ["#7d5a9e", "#f0a090", "#ffe0b0"], glow: "#ffb08a", tile: ["#f6e4d3", "#d6a89b"], slab: ["#b88a88", "#86585f"], stripe: "#ffb08a", tint: [1.06, 0.99, 0.93], amb: 0.66, night: 0.12, warm: [255, 200, 140], fx: "petals", orb: "sun", hills: ["#b8708a", "#8f5a7c"], edge: "#ffd0b0" },
    forest: { sky: ["#2d6b52", "#7cc6a2", "#d4f0c8"], glow: "#72d6a3", tile: ["#a3cf8c", "#5f9c64"], slab: ["#6c5b3d", "#47391f"], stripe: "#72d6a3", tint: [0.97, 1.04, 0.95], amb: 0.66, night: 0.0, warm: [255, 225, 160], fx: "leaves", orb: "sun", hills: ["#3d8460", "#2d6a4e"], edge: "#bff0c4" },
    winter: { sky: ["#557fae", "#a9cbe8", "#e8f4fc"], glow: "#91d2f7", tile: ["#eef6fc", "#b4cce2"], slab: ["#8ea9c4", "#637e9c"], stripe: "#91d2f7", tint: [0.95, 1.0, 1.08], amb: 0.68, night: 0.0, warm: [255, 230, 180], fx: "snow", orb: "sun", hills: ["#c4d9ec", "#a4bfd8"], edge: "#ffffff" },
    royal:  { sky: ["#2a1840", "#6a3a6c", "#e0976c"], glow: "#e3bf7c", tile: ["#e8cf96", "#8f6d46"], slab: ["#5d3f2b", "#3a2518"], stripe: "#e3bf7c", tint: [1.08, 0.98, 0.88], amb: 0.62, night: 0.55, warm: [255, 210, 120], fx: "sparks", orb: "sun", hills: ["#4a2a4a", "#331c3a"], edge: "#ffe2a0" },
    aurora: { sky: ["#050e1e", "#0e2a3c", "#17504a"], glow: "#72d6a3", tile: ["#678d99", "#2f4859"], slab: ["#243c4c", "#17293a"], stripe: "#72d6a3", tint: [0.88, 1.02, 1.06], amb: 0.58, night: 1.0, warm: [255, 220, 150], fx: "aurora", orb: "moon", hills: ["#12303a", "#0c2430"], edge: "#9af0c5" }
  };
  const themeKey = id => String(id || "dusk").replace("theme-", "");

  /* ---------- декор-пропы ---------- */
  const PB = {};
  PB.lanterns = M => { lamp(M, 0.5, 0.5, 0.26); };
  PB.fountain = M => {
    M.cyl(0.5, 0.5, 0.0, 0.34, 0.1, K.stoneL, { n: 14, top: K.stone });
    const w = M.cyl(0.5, 0.5, 0.098, 0.3, 0.01, K.water, { n: 14 }); w.water = true;
    M.cyl(0.5, 0.5, 0.1, 0.06, 0.16, K.stoneL, { n: 8 });
    M.cyl(0.5, 0.5, 0.26, 0.14, 0.03, K.stoneL, { n: 12 });
    M.cyl(0.5, 0.5, 0.29, 0.03, 0.1, K.stoneL, { n: 6 });
    M.water.push({ x: 0.5, y: 0.5, z: 0.39, r: 0.22 });
    M.lightAt(0.5, 0.5, 0.3, 0.2, [160, 220, 255]);
  };
  PB.statue = M => {
    M.box(0.3, 0.3, 0, 0.4, 0.4, 0.12, K.stone, { top: K.stoneL });
    M.box(0.36, 0.36, 0.12, 0.28, 0.28, 0.06, K.stoneL);
    M.spriteAt("knight", 0.5, 0.5, 0.36, "gold", { stat: 1, z: 0.18 });
  };
  PB.fair = M => {
    stall(M, 0.04, 0.5, 0.4, 0.4, K.pink, K.white, { seed: 1 });
    stall(M, 0.56, 0.5, 0.4, 0.4, K.yellow, K.white, { seed: 3 });
    [[0.2, 0.2, K.red], [0.5, 0.14, K.blue], [0.8, 0.22, K.green]].forEach(([x, y, c]) => { M.cyl(x, y, 0.0, 0.006, 0.28, K.woodD, { n: 4 }); M.dome(x, y, 0.28, 0.06, c, { n: 8, rings: 4 }); });
    M.lightAt(0.5, 0.5, 0.2, 0.4, [255, 190, 200]);
  };
  PB.flowers = M => {
    M.box(0.06, 0.06, 0, 0.88, 0.88, 0.02, K.grass, { bias: -100 });
    flowerBed(M, 0.12, 0.14, 0.34, 0.22, 3); flowerBed(M, 0.5, 0.5, 0.36, 0.3, 8); flowerBed(M, 0.1, 0.62, 0.3, 0.2, 14);
  };
  PB.windmill = M => {
    M.cyl(0.5, 0.5, 0.0, 0.2, 0.06, K.stone, { n: 8 });
    M.cyl(0.5, 0.5, 0.06, 0.17, 0.46, K.plasterW, { n: 8, r2: 0.12 });
    M.cone(0.5, 0.5, 0.52, 0.16, 0.2, K.roofR, { n: 8 });
    M.door(M.cur && M.cur.fs ? M.cur : M.box(0.46, 0.7, 0, 0.08, 0.0001, 0.0001, K.plaster), "s", 0.5, 0.07, 0.11, { z: 0.06 });
    M.windmill = { x: 0.5, y: 0.66, z: 0.5, len: 0.32 };
  };
  const BANNER_FLAGS = (m, f, col) => { const w = f[0], d = f[1]; [[0.08 * w + 0.04, d * 0.97], [w - 0.08 * w - 0.04, d * 0.97]].forEach(([x, y], i) => m.flag(x, y, 0.05, 0.42, i ? K.gold : col, { w: 0.14, fh: 0.2, c2: K.white })); };

  /* ---------- кэш моделей ---------- */
  const MC = {};
  function getModel(id, L, banners) {
    const key = id + "|" + L + "|" + (banners ? 1 : 0);
    if (!MC[key]) {
      const m = buildModel(id, L);
      if (banners) BANNER_FLAGS(m, footOf(id), K.violet);
      MC[key] = m;
    }
    return MC[key];
  }
  const PC = {};
  function getProp(kind) {
    if (!PC[kind]) { const M = new Model(1, 1); (PB[kind] || (() => { }))(M); PC[kind] = M.finish(); }
    return PC[kind];
  }

  const STARS = (() => { const r = rnd(7), a = []; for (let i = 0; i < 90; i++) a.push([r(), r() * 0.62, 0.4 + r() * 1.2, r() * 6.28]); return a; })();
  const BUILD_ORDER = ["castle", "palace", "hall", "towers", "chapel", "academy", "stables", "market", "garden", "cottages"];

  /* =====================================================================
     СЦЕНА
     ===================================================================== */
  function createScene(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    const S = {
      canvas, ctx, opts,
      data: { b: {}, plot: {}, theme: "theme-dusk", deco: [], folk: { n: 0, skin: "skin-classic" } },
      th: TH.dusk,
      cam: { yaw: 45, tyaw: 45, zoom: 1, tzoom: 1, e: 0.66, te: 0.66, mode: "iso" },
      ov: { sel: null, placing: null, hover: null, taxReady: false, labels: true, coins: false },
      blds: [], props: [], citizens: [], blocked: [], occ: {},
      items: [], t: 0, W: 0, H: 0, dpr: 1, running: false, raf: 0, last: 0,
      onPick: null, onCamera: null, labelFn: null, coinOk: null, partsFx: [], cloud: [], fxSeed: 1
    };
    const rng = rnd(12345);
    for (let i = 0; i < 4; i++) S.cloud.push({ x: rng(), y: 0.08 + rng() * 0.22, s: 0.6 + rng() * 0.8, v: 0.004 + rng() * 0.006 });
    const PN = 46;
    for (let i = 0; i < PN; i++) S.partsFx.push({ x: rng(), y: rng(), v: 0.03 + rng() * 0.06, r: 0.6 + rng() * 1.6, ph: rng() * 6.28, d: rng() });

    /* ----- данные ----- */
    function parsePlot(s) { const m = String(s || "").match(/^([0-7]),([0-7])$/); return m ? [+m[1], +m[2]] : null; }
    S.set = function (d) {
      S.data = d || S.data;
      S.th = TH[themeKey(S.data.theme)] || TH.dusk;
      rebuild();
    };
    function rebuild() {
      const d = S.data, bl = [];
      const blocked = []; for (let i = 0; i < 64; i++) blocked.push(0);
      const ban = (d.deco || []).indexOf("deco-banners") >= 0;
      BUILD_ORDER.forEach(id => {
        const lv = (d.b && +d.b[id]) | 0, p = parsePlot(d.plot && d.plot[id]);
        if (lv < 1 || !p) return;
        const f = footOf(id), c = Math.min(p[0], 8 - f[0]), r = Math.min(p[1], 8 - f[1]);
        bl.push({ kind: "b", id, lv, c, r, f, m: getModel(id, lv, ban) });
        for (let i = 0; i < f[0]; i++) for (let j = 0; j < f[1]; j++) blocked[(r + j) * 8 + c + i] = 1;
      });
      S.blds = bl;
      // пропы декора
      const pr = [], deco = d.deco || [];
      const free = (c, r) => c >= 0 && r >= 0 && c < 8 && r < 8 && !blocked[r * 8 + c];
      const near = (c, r) => { for (let k = 0; k < 9; k++) for (let dx = -k; dx <= k; dx++) for (let dy = -k; dy <= k; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue; if (free(c + dx, r + dy)) return [c + dx, r + dy]; } return null; };
      const put = (kind, c, r, block) => { const q = near(c, r); if (!q) return; pr.push({ kind: "p", id: kind, c: q[0], r: q[1], f: [1, 1], m: getProp(kind) }); if (block) blocked[q[1] * 8 + q[0]] = 1; };
      if (deco.indexOf("deco-lanterns") >= 0) [[0, 0], [7, 0], [0, 7], [7, 7], [3, 7], [4, 7], [0, 3], [7, 4]].forEach(q => put("lanterns", q[0], q[1], true));
      if (deco.indexOf("deco-fountain") >= 0) put("fountain", 3, 4, true);
      if (deco.indexOf("deco-statue") >= 0) { const g = parsePlot(d.plot && d.plot.garden) || [1, 5]; put("statue", Math.min(7, g[0] + 1), g[1], true); }
      if (deco.indexOf("deco-fair") >= 0) put("fair", 5, 6, true);
      if (deco.indexOf("deco-windmill") >= 0) put("windmill", 7, 3, true);
      if (deco.indexOf("deco-flowers") >= 0) { [[2, 7], [6, 4], [1, 4], [5, 0]].forEach(q => put("flowers", q[0], q[1], false)); }
      S.props = pr; S.blocked = blocked;
      syncFolk();
    }

    /* ----- жители ----- */
    function skinOf() { return SKIN_BY_ID[(S.data.folk && S.data.folk.skin) || "skin-classic"] || SKINS[0]; }
    function freeTile(avoid) {
      const list = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (!S.blocked[r * 8 + c] && !(avoid && avoid[c + "," + r])) list.push([c, r]);
      return list.length ? list[(rng() * list.length) | 0] : [3, 3];
    }
    function syncFolk() {
      const want = Math.max(0, Math.min(24, (S.data.folk && S.data.folk.n) | 0)), sk = skinOf();
      const used = {}; S.citizens.forEach(z => { used[Math.floor(z.fx) + "," + Math.floor(z.fy)] = 1; });
      while (S.citizens.length < want) {
        const q = freeTile(used); used[q[0] + "," + q[1]] = 1;
        S.citizens.push({ i: S.citizens.length, fx: q[0] + 0.5, fy: q[1] + 0.5, tx: q[0] + 0.5, ty: q[1] + 0.5, x: q[0] + 0.5, y: q[1] + 0.5, u: 1, dur: 1, wait: rng() * 1.5, face: rng() < 0.5 ? 1 : -1, jump: -1, bub: null, nb: 12 + rng() * 30, born: S.t, hop: 0 });
      }
      S.citizens.length = want;
      S.citizens.forEach((z, i) => { z.i = i; z.type = sk.set[i % sk.set.length]; z.team = i % 2; });
      // если стоим на занятой клетке — уйдём
      S.citizens.forEach(z => { const c = Math.floor(z.x), r = Math.floor(z.y); if (S.blocked[r * 8 + c] && z.u >= 1) { const q = freeTile(); z.fx = z.x = z.tx = q[0] + 0.5; z.fy = z.y = z.ty = q[1] + 0.5; } });
    }
    function citizenOccupied(c, r, self) {
      for (const z of S.citizens) { if (z === self) continue; if ((Math.floor(z.tx) === c && Math.floor(z.ty) === r) || (Math.floor(z.fx) === c && Math.floor(z.fy) === r && z.u < 1)) return true; }
      return false;
    }
    function moveOptions(z) {
      const c0 = Math.floor(z.x), r0 = Math.floor(z.y), out = [], T = z.type;
      const ok = (c, r) => c >= 0 && r >= 0 && c < 8 && r < 8 && !S.blocked[r * 8 + c] && !citizenOccupied(c, r, z);
      const pathClear = (dc, dr, n) => { for (let k = 1; k < n; k++) if (S.blocked[(r0 + dr * k) * 8 + c0 + dc * k]) return false; return true; };
      const ortho = [[1, 0], [-1, 0], [0, 1], [0, -1]], diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      if (T === "pawn") ortho.forEach(([a, b]) => ok(c0 + a, r0 + b) && out.push([c0 + a, r0 + b, 1, 1]));
      else if (T === "king") ortho.concat(diag).forEach(([a, b]) => ok(c0 + a, r0 + b) && out.push([c0 + a, r0 + b, 1, 1]));
      else if (T === "knight") [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, b]) => ok(c0 + a, r0 + b) && out.push([c0 + a, r0 + b, 2.2, 1]));
      else {
        const dirs = T === "rook" ? ortho : T === "bishop" ? diag : ortho.concat(diag);
        dirs.forEach(([a, b]) => { for (let n = 1; n <= 3; n++) { const c = c0 + a * n, r = r0 + b * n; if (c < 0 || r < 0 || c > 7 || r > 7 || S.blocked[r * 8 + c] || !pathClear(a, b, n)) break; if (ok(c, r)) out.push([c, r, n, 0.7]); } });
      }
      return out;
    }
    function stepCitizens(dt) {
      const now = S.t;
      S.citizens.forEach(z => {
        if (z.jump >= 0) { z.jump += dt * 2.4; if (z.jump >= 1) z.jump = -1; }
        if (z.u < 1) {
          z.u = Math.min(1, z.u + dt / z.dur);
          const e = z.u < 0.5 ? 2 * z.u * z.u : 1 - Math.pow(-2 * z.u + 2, 2) / 2, e2 = z.type === "knight" ? z.u : e;
          z.x = lerp(z.fx, z.tx, e2); z.y = lerp(z.fy, z.ty, e2);
          z.hop = Math.sin(z.u * PI) * (z.type === "knight" ? 0.38 : 0.12);
          if (z.u >= 1) { z.fx = z.x = z.tx; z.fy = z.y = z.ty; z.hop = 0; z.wait = 0.5 + rng() * 2.4; z.land = now; }
        } else {
          z.wait -= dt;
          if (z.wait <= 0) {
            const opts2 = moveOptions(z);
            if (!opts2.length) { z.wait = 0.8 + rng(); }
            else {
              const w = opts2.map(o => 1 / (o[2] * 0.8 + 0.4)), tot = w.reduce((a, b) => a + b, 0); let pick = rng() * tot, k = 0;
              while (k < opts2.length - 1 && pick > w[k]) { pick -= w[k]; k++; }
              const o = opts2[k];
              z.fx = z.x; z.fy = z.y; z.tx = o[0] + 0.5; z.ty = o[1] + 0.5; z.u = 0; z.dur = 0.5 + o[2] * 0.2 * (z.type === "knight" ? 0.8 : 1);
              const dx = z.tx - z.fx, dy = z.ty - z.fy, sdx = dx * cos(S.cam.yaw * PI / 180) - dy * sin(S.cam.yaw * PI / 180);
              if (Math.abs(sdx) > 0.05) z.face = sdx > 0 ? 1 : -1;
            }
          }
        }
        // пузырьки
        if (z.bub && now > z.bub.until) z.bub = null;
        z.nb -= dt;
        if (!z.bub && z.nb <= 0 && z.u >= 1) {
          if (S.ov.coins && S.coinOk && S.coinOk()) { z.bub = { kind: "coin", until: now + 14 }; z.nb = 25 + rng() * 40; }
          else { z.bub = { kind: "heart", until: now + 2.6 }; z.nb = 10 + rng() * 25; }
        }
      });
    }

    /* ----- проекция ----- */
    const V = { c: 0.7, s: 0.7, se: 0.6, ce: 0.8, sc: 30, ox: 0, oy: 0, fx: 4, fy: 4 };
    function setupProj() {
      const cam = S.cam, yaw = cam.yaw * PI / 180;
      V.c = cos(yaw); V.s = sin(yaw); V.se = sin(cam.e); V.ce = cos(cam.e);
      const halfW = 4 * Math.SQRT2 + 0.6;
      const fitW = S.W / (2 * halfW * 1.0), fitH = S.H / (2 * halfW * V.se + 3.2 * V.ce);
      V.sc = Math.min(fitW, fitH) * cam.zoom;
      V.ox = S.W / 2; V.oy = S.H * 0.53 + 0.35 * V.ce * V.sc * 0.5; V.fx = cam.fx == null ? 4 : cam.fx; V.fy = cam.fy == null ? 4 : cam.fy;
    }
    const pj = (x, y, z) => { const dx = x - V.fx, dy = y - V.fy, X = dx * V.c - dy * V.s, Y = dx * V.s + dy * V.c; return [V.ox + X * V.sc, V.oy + (Y * V.se - z * V.ce) * V.sc, Y * V.ce + z * V.se]; };
    const depthOf = (x, y, z) => { const dx = x - V.fx, dy = y - V.fy, Y = dx * V.s + dy * V.c; return Y * V.ce + z * V.se; };
    S.project = pj;
    function unproject(sx, sy) {
      const X = (sx - V.ox) / V.sc, Y = (sy - V.oy) / (V.sc * V.se);
      const dx = X * V.c + Y * V.s, dy = -X * V.s + Y * V.c;
      return [dx + V.fx, dy + V.fy];
    }

    /* ----- рисование ----- */
    function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
    const LX = -0.61, LY = 0.355, LZ = 0.71;
    function shadeOf(nx, ny, nz) {
      const rx = nx * V.c - ny * V.s, ry = nx * V.s + ny * V.c, tow = ry * V.ce + nz * V.se, up = nz * V.ce - ry * V.se;
      let d = rx * LX + up * LY + tow * LZ; if (d < 0) d = 0;
      const amb = S.th.amb;
      return amb + (1 - amb) * d * 1.12;
    }
    function drawBg(t) {
      const th = S.th, W = S.W, H = S.H;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const gl = ctx.createRadialGradient(W / 2, H * 0.62, 0, W / 2, H * 0.62, W * 0.7);
      gl.addColorStop(0, rgbs(hex(th.glow), 0.28)); gl.addColorStop(1, rgbs(hex(th.glow), 0));
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
      if (th.night > 0.4) {
        STARS.forEach(s => { const a = (0.35 + 0.65 * (0.5 + 0.5 * sin(t * 1.3 + s[3]))) * Math.min(1, th.night); ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`; ctx.beginPath(); ctx.arc(s[0] * W, s[1] * H, s[2], 0, TAU); ctx.fill(); });
      }
      // светило
      const ox = W * 0.78, oy = H * 0.17;
      if (th.orb === "moon") {
        const mg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 60); mg.addColorStop(0, "rgba(230,225,255,.55)"); mg.addColorStop(1, "rgba(230,225,255,0)"); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(ox, oy, 60, 0, TAU); ctx.fill();
        ctx.fillStyle = "#f1eeff"; ctx.beginPath(); ctx.arc(ox, oy, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(180,170,230,.55)"; ctx.beginPath(); ctx.arc(ox - 4, oy - 2, 4, 0, TAU); ctx.arc(ox + 5, oy + 5, 3, 0, TAU); ctx.fill();
      } else {
        const sg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 80); sg.addColorStop(0, "rgba(255,240,200,.9)"); sg.addColorStop(0.25, "rgba(255,220,150,.45)"); sg.addColorStop(1, "rgba(255,220,150,0)"); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(ox, oy, 80, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(ox, oy, 17, 0, TAU); ctx.fill();
      }
      if (th.fx === "aurora" || th.fx === "stars" && th.night > 0.9 && false) { /* зарезервировано */ }
      if (th.fx === "aurora") {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); const y0 = H * (0.12 + k * 0.07);
          for (let x = 0; x <= W; x += 12) { const y = y0 + sin(x * 0.012 + t * 0.5 + k * 1.7) * 18 + sin(x * 0.03 - t * 0.7) * 6; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          for (let x = W; x >= 0; x -= 12) ctx.lineTo(x, y0 + 60 + sin(x * 0.01 + t * 0.4 + k) * 22);
          ctx.closePath();
          const ag = ctx.createLinearGradient(0, y0 - 20, 0, y0 + 80); ag.addColorStop(0, k % 2 ? "rgba(142, 85, 230,.0)" : "rgba(114,214,163,.0)"); ag.addColorStop(0.35, k % 2 ? "rgba(142, 85, 230,.28)" : "rgba(114,214,163,.32)"); ag.addColorStop(1, "rgba(60,200,160,0)");
          ctx.fillStyle = ag; ctx.fill();
        }
      }
      // облака
      if (th.night < 0.5) S.cloud.forEach(c => {
        c.x += c.v * 0.016; if (c.x > 1.2) c.x = -0.2;
        const cx = c.x * W, cy = c.y * H, s = 34 * c.s; ctx.fillStyle = th.fx === "winter" ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.35)";
        ctx.beginPath(); ctx.ellipse(cx, cy, s * 1.5, s * 0.5, 0, 0, TAU); ctx.ellipse(cx - s * 0.8, cy + 4, s, s * 0.4, 0, 0, TAU); ctx.ellipse(cx + s * 0.9, cy + 5, s * 1.1, s * 0.38, 0, 0, TAU); ctx.fill();
      });
      // холмы
      const hy = H * 0.66;
      [[th.hills[0], 0.0, 26, 0.011], [th.hills[1], 1.9, 18, 0.017]].forEach(([col, ph, amp, fr], li) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
        const off = S.cam.yaw * (li ? 2.4 : 1.4);
        for (let x = 0; x <= W; x += 10) ctx.lineTo(x, hy + li * 14 + sin((x + off) * fr + ph) * amp + sin((x + off) * fr * 2.3) * amp * 0.3);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      });
      // парящее основание: туман
      const fg = ctx.createLinearGradient(0, H * 0.7, 0, H); fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, "rgba(0,0,0,.28)"); ctx.fillStyle = fg; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    }
    function drawFx(t, front) {
      const th = S.th, W = S.W, H = S.H;
      S.partsFx.forEach(p => {
        const kind = th.fx;
        if (kind === "stars" || kind === "aurora") { if (front) return; }
        if (kind === "snow") {
          if (!front) return; const y = ((p.y + t * p.v * 1.5) % 1) * H, x = ((p.x + sin(t * 0.6 + p.ph) * 0.02) % 1) * W;
          ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(x, y, p.r + 0.4, 0, TAU); ctx.fill();
        } else if (kind === "petals") {
          if (!front) return; const y = ((p.y + t * p.v) % 1) * H, x = ((p.x + t * 0.01 + sin(t + p.ph) * 0.03) % 1) * W;
          ctx.fillStyle = "rgba(255,190,200,.75)"; ctx.save(); ctx.translate(x, y); ctx.rotate(t + p.ph); ctx.beginPath(); ctx.ellipse(0, 0, p.r * 2, p.r, 0, 0, TAU); ctx.fill(); ctx.restore();
        } else if (kind === "leaves") {
          if (!front) return; const y = ((p.y + t * p.v * 0.8) % 1) * H, x = ((p.x + t * 0.015 + sin(t * 0.8 + p.ph) * 0.03) % 1) * W;
          ctx.fillStyle = p.d > 0.5 ? "rgba(255,230,140,.7)" : "rgba(150,230,150,.7)"; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.2 + p.ph); ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.8, p.r * 0.9, 0, 0, TAU); ctx.fill(); ctx.restore();
        } else if (kind === "sparks") {
          if (!front) return; const y = H - ((p.y + t * p.v * 0.7) % 1) * H * 0.8, x = ((p.x + sin(t * 0.7 + p.ph) * 0.03) % 1) * W; const a = 0.3 + 0.5 * (0.5 + 0.5 * sin(t * 3 + p.ph));
          ctx.fillStyle = `rgba(255,210,120,${a})`; ctx.beginPath(); ctx.arc(x, y, p.r * 0.9, 0, TAU); ctx.fill();
        } else if (kind === "stars" && front) { /* пусто */ }
      });
      if ((th.fx === "stars" || th.fx === "aurora") && front) {
        S.partsFx.forEach((p, i) => { if (i % 2) return; const y = H * 0.35 + ((p.y * 0.6 + sin(t * 0.4 + p.ph) * 0.02)) * H * 0.6, x = ((p.x + t * 0.004 * (1 + p.d)) % 1) * W; const a = 0.25 + 0.55 * (0.5 + 0.5 * sin(t * 2.2 + p.ph)); ctx.fillStyle = `rgba(190,255,200,${a * 0.8})`; ctx.beginPath(); ctx.arc(x, y, p.r * 0.8, 0, TAU); ctx.fill(); });
      }
    }
    function tileColors(c, r) {
      const th = S.th, base = hex(th.tile[(c + r) % 2 === 0 ? 0 : 1]);
      return base;
    }
    function drawBoard() {
      const th = S.th, e0 = -0.34, e1 = 8.34, thick = 0.62;
      // тень под островом
      const cb = pj(4, 4, -thick - 0.1);
      const sg = ctx.createRadialGradient(cb[0], cb[1] + 18, 0, cb[0], cb[1] + 18, V.sc * 6.4);
      sg.addColorStop(0, "rgba(0,0,0,.42)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.translate(0, V.sc * 0.5); ctx.scale(1, 0.5); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cb[0], (cb[1] + 18) * 2 - V.sc, V.sc * 6.4, 0, TAU); ctx.fill(); ctx.restore();
      // боковины плиты
      const sides = [["s", [e0, e1, 0], [e1, e1, 0], [0, 1, 0]], ["e", [e1, e1, 0], [e1, e0, 0], [1, 0, 0]], ["n", [e1, e0, 0], [e0, e0, 0], [0, -1, 0]], ["w", [e0, e0, 0], [e0, e1, 0], [-1, 0, 0]]];
      sides.forEach(([nm, a, b, n]) => {
        const rx = n[0] * V.c - n[1] * V.s, ry = n[0] * V.s + n[1] * V.c, tow = ry * V.ce;
        if (tow <= 0) return;
        const k = shadeOf(n[0], n[1], 0);
        const mk = (z0, z1, col) => { const pts = [pj(a[0], a[1], z0), pj(b[0], b[1], z0), pj(b[0], b[1], z1), pj(a[0], a[1], z1)]; path(pts); ctx.fillStyle = rgbs(scaleTint(col, k)); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.8; ctx.stroke(); };
        mk(-thick, -0.14, hex(th.slab[1])); mk(-0.14, 0, hex(th.slab[0]));
        const pts = [pj(a[0], a[1], -0.14), pj(b[0], b[1], -0.14), pj(b[0], b[1], -0.12), pj(a[0], a[1], -0.12)]; path(pts); ctx.fillStyle = rgbs(scaleTint(hex(th.stripe), k * 0.95)); ctx.fill();
        // слои камня
        const pts2 = [pj(a[0], a[1], -0.38), pj(b[0], b[1], -0.38), pj(b[0], b[1], -0.37), pj(a[0], a[1], -0.37)]; path(pts2); ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fill();
      });
      // рамка
      const ring = [[e0, e0, 0.0, 0, e1, e0], [e0, e0, 0, e0, e0, e1]];
      const q = (a0, a1, b0, b1, col) => { path([pj(a0, a1, 0), pj(b0, a1, 0), pj(b0, b1, 0), pj(a0, b1, 0)]); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke(); };
      const rimC = rgbs(scaleTint(hex(th.slab[0]), 1.15)), rimC2 = rgbs(scaleTint(hex(th.slab[0]), 1.0));
      q(e0, e0, e1, 0, rimC); q(e0, 8, e1, e1, rimC2); q(e0, 0, 0, 8, rimC2); q(8, 0, e1, 8, rimC);
      // плитки
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const col = tileColors(c, r), pts = [pj(c, r, 0), pj(c + 1, r, 0), pj(c + 1, r + 1, 0), pj(c, r + 1, 0)];
        path(pts); const tk = 0.97 + 0.03 * ((c * 7 + r * 13) % 3) / 2; ctx.fillStyle = rgbs(scaleTint(col, tk * 1.05)); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.10)"; ctx.lineWidth = 1; ctx.stroke();
      }
      // внутренняя кромка
      path([pj(0, 0, 0), pj(8, 0, 0), pj(8, 8, 0), pj(0, 8, 0)]); ctx.strokeStyle = rgbs(hex(th.edge), 0.35); ctx.lineWidth = 1.5; ctx.stroke();
    }
    function scaleTint(c, k) { const t = S.th.tint; return [clamp(c[0] * k * t[0], 0, 255), clamp(c[1] * k * t[1], 0, 255), clamp(c[2] * k * t[2], 0, 255)]; }

    function footRect(b, pad, z) {
      const x0 = b.c - pad, y0 = b.r - pad, x1 = b.c + b.f[0] + pad, y1 = b.r + b.f[1] + pad;
      return [pj(x0, y0, z), pj(x1, y0, z), pj(x1, y1, z), pj(x0, y1, z)];
    }
    function drawGroundOverlays(t) {
      const ov = S.ov;
      // тени зданий
      const sdx = 0.55, sdy = 0.42;  // направление тени во «вьюшных» координатах → в мир
      const wdx = sdx * V.c + sdy * V.s, wdy = -sdx * V.s + sdy * V.c;
      S.blds.concat(S.props).forEach(b => {
        const h = Math.min(1.6, b.m.top) * 0.55, x0 = b.c + 0.1, y0 = b.r + 0.1, x1 = b.c + b.f[0] - 0.08, y1 = b.r + b.f[1] - 0.08;
        if (b.id === "flowers") return;
        const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0 + wdx * h, y0 + wdy * h], [x1 + wdx * h, y0 + wdy * h], [x1 + wdx * h, y1 + wdy * h], [x0 + wdx * h, y1 + wdy * h]].map(q => pj(q[0], q[1], 0.01));
        const hull = convexHull(pts); path(hull); ctx.fillStyle = "rgba(10,8,24,.26)"; ctx.fill();
      });
      S.citizens.forEach(z => { const p = pj(z.x, z.y, 0.01), r = V.sc * 0.2; ctx.fillStyle = "rgba(10,8,24,.3)"; ctx.beginPath(); ctx.ellipse(p[0] + r * 0.2, p[1], r, r * 0.45, 0, 0, TAU); ctx.fill(); });
      // выбранное
      if (ov.sel) { const b = S.blds.find(x => x.id === ov.sel); if (b) { const pts = footRect(b, 0.04, 0.02); path(pts); ctx.strokeStyle = `rgba(255,214,120,${0.7 + 0.3 * sin(t * 4)})`; ctx.lineWidth = 2.4; ctx.shadowColor = "rgba(255,214,120,.8)"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,214,120,.14)"; ctx.fill(); } }
      // режим размещения
      if (ov.placing) {
        const f = footOf(ov.placing.id);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const okTile = canPlace(ov.placing.id, c, r, ov.placing.id);
          const pts = [pj(c, r, 0.02), pj(c + 1, r, 0.02), pj(c + 1, r + 1, 0.02), pj(c, r + 1, 0.02)];
          path(pts); ctx.fillStyle = okTile ? `rgba(114,214,163,${0.16 + 0.07 * sin(t * 4)})` : "rgba(238,129,149,.06)"; ctx.fill();
        }
        if (ov.hover) {
          const [hc, hr] = ov.hover, okh = canPlace(ov.placing.id, hc, hr, ov.placing.id), pts = [pj(hc, hr, 0.03), pj(hc + f[0], hr, 0.03), pj(hc + f[0], hr + f[1], 0.03), pj(hc, hr + f[1], 0.03)];
          path(pts); ctx.fillStyle = okh ? "rgba(114,214,163,.38)" : "rgba(238,129,149,.38)"; ctx.fill(); ctx.strokeStyle = okh ? "#72d6a3" : "#ee8195"; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }
    function canPlace(id, c, r, ignore) {
      const f = footOf(id);
      if (c < 0 || r < 0 || c + f[0] > 8 || r + f[1] > 8) return false;
      for (let i = 0; i < f[0]; i++) for (let j = 0; j < f[1]; j++) {
        const cc = c + i, rr = r + j;
        const who = S.blds.find(b => b.id !== ignore && cc >= b.c && cc < b.c + b.f[0] && rr >= b.r && rr < b.r + b.f[1]);
        if (who) return false;
        const pr = S.props.find(p => p.id !== "flowers" && p.c === cc && p.r === rr);
        if (pr && !(opts.propsMove)) { /* пропы сдвинутся сами */ }
      }
      return true;
    }
    S.canPlace = canPlace;
    function convexHull(pts) {
      const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
      up.pop(); lo.pop(); return lo.concat(up);
    }

    /* ----- грани ----- */
    const tmpKeys = [];
    function drawPart(it) {
      const p = it.p, b = it.b, ox = b.c, oy = b.r, al = it.a, th = S.th;
      const vis = [];
      for (let i = 0; i < p.faces.length; i++) {
        const f = p.faces[i];
        let nx = f.n[0], ny = f.n[1], nz = f.n[2], flip = 1;
        const tow = (nx * V.s + ny * V.c) * V.ce + nz * V.se;
        if (f.ds) { if (tow < 0) { flip = -1; } } else if (tow <= 0.005) continue;
        f._flip = flip;
        f._k = depthOf(ox + f.g[0], oy + f.g[1], f.g[2]);
        vis.push(f);
      }
      for (let i = 0; i < vis.length; i++) { const f = vis[i]; if (f.ref && f.ref._k != null) f._k = f.ref._k + 0.0008; }
      if (vis.length > 1) vis.sort((a, c) => a._k - c._k);
      for (let i = 0; i < vis.length; i++) {
        const f = vis[i], fl = f._flip;
        let col;
        const sh = shadeOf(f.n[0] * fl, f.n[1] * fl, f.n[2] * fl);
        if (f.e) col = f.c;
        else {
          col = scaleTint(f.c, sh);
          if (f.win) {
            const warm = th.warm, lit = f.lit ? 1 : 0.15, mixk = clamp(lit * (0.1 + th.night * 0.92), 0, 1);
            const flick = f.lit && th.night > 0.3 ? 0.94 + 0.06 * sin(S.t * 2 + f.g[0] * 9 + f.g[1] * 5) : 1;
            col = mixc(scaleTint(f.c, sh * 1.05), [warm[0] * flick, warm[1] * flick, warm[2] * flick], mixk);
          }
        }
        const n = f.p.length;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const q = f.p[k], wx = ox + q[0] - V.fx, wy = oy + q[1] - V.fy, X = wx * V.c - wy * V.s, Y = wx * V.s + wy * V.c;
          const sx = V.ox + X * V.sc, sy = V.oy + (Y * V.se - q[2] * V.ce) * V.sc;
          k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        }
        ctx.closePath();
        const fs = rgbs(col, al < 1 ? al : null);
        ctx.fillStyle = fs; ctx.fill();
        ctx.strokeStyle = fs; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
    function drawFlag(it) {
      const fl = it.fl, b = it.b, p = pj(b.c + fl.x, b.r + fl.y, fl.z + fl.h), t = S.t, w = fl.w * V.sc * 0.9, h = fl.h * V.sc * V.ce * 1.1, seg = 6;
      ctx.beginPath(); const top = [], bot = [];
      for (let i = 0; i <= seg; i++) { const u = i / seg, wv = sin(t * 4.2 + fl.ph + u * 3.2) * (h * 0.22) * u; top.push([p[0] + u * w, p[1] + wv]); bot.push([p[0] + u * w, p[1] + h + wv]); }
      ctx.moveTo(top[0][0], top[0][1]); top.forEach(q => ctx.lineTo(q[0], q[1])); for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]); ctx.closePath();
      const sh = 0.95; ctx.fillStyle = rgbs(scaleTint(fl.c, sh), it.a < 1 ? it.a : null); ctx.fill();
      if (fl.c2) { ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1] + h * 0.5); for (let i = 0; i <= seg; i++) ctx.lineTo(top[i][0], top[i][1] + h * 0.5); for (let i = seg; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]); ctx.lineTo(top[0][0], bot[0][1]); ctx.closePath(); ctx.fillStyle = rgbs(scaleTint(fl.c2, sh), it.a < 1 ? it.a : null); ctx.fill(); }
    }
    function spriteH() { return V.sc * Math.max(V.ce, 0.62); }
    function drawSpriteItem(it) {
      const sp = it.sp, b = it.b, p = pj(b.c + sp.x, b.r + sp.y, sp.z || 0.05), H0 = sp.h * spriteH() * 1.6;
      const pa = SPRITE_PAL[sp.pal] || P_IVORY;
      ctx.fillStyle = "rgba(10,8,24,.28)"; ctx.beginPath(); ctx.ellipse(p[0] + 2, p[1], H0 * 0.32, H0 * 0.13, 0, 0, TAU); ctx.fill();
      drawFigure(ctx, sp.type, p[0], p[1], H0, pa, { face: sp.flip ? -1 : 1, alpha: it.a });
    }
    function drawCitizen(it) {
      const z = it.z, sk = skinOf(), t = S.t;
      const pa = sk.teams[z.team % 2];
      const pos = pj(z.x, z.y, 0.02 + (z.hop || 0) * 0.9 + (z.jump >= 0 ? sin(z.jump * PI) * 0.35 : 0));
      const age = clamp((t - (z.born || 0)) * 2, 0, 1);
      let Hh = spriteH() * 0.95 * (0.4 + 0.6 * age);
      const idle = z.u >= 1 ? 1 + sin(t * 3 + z.i * 1.7) * 0.025 : 1;
      let squash = idle;
      if (z.u < 1) squash = 1 + sin(z.u * PI * 2) * 0.05;
      if (z.land && t - z.land < 0.18) squash = 1 - sin((t - z.land) / 0.18 * PI) * 0.12;
      z._sx = pos[0]; z._sy = pos[1]; z._h = Hh * (TYPE_SCALE[z.type] || 0.85);
      drawFigure(ctx, z.type, pos[0], pos[1], Hh, pa, { face: z.face, squash: squash, glow: sk.glow, alpha: age });
    }
    function drawFxModel(b, t) {
      const m = b.m;
      m.smoke.forEach(s => {
        for (let i = 0; i < 4; i++) {
          const u = ((t * 0.22 + i * 0.25 + s.ph) % 1), p = pj(b.c + s.x + u * 0.08, b.r + s.y - u * 0.03, s.z + u * 0.26), r = (0.014 + u * 0.03) * V.sc;
          ctx.fillStyle = `rgba(225,225,235,${0.38 * (1 - u)})`; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
        }
      });
      m.water.forEach(w => {
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + 0.4, u = ((t * 0.9 + i * 0.37) % 1), rr = w.r * (0.25 + u * 0.75), zz = w.z - 0.02 + sin(u * PI) * 0.17 - u * u * 0.14;
          const p = pj(b.c + w.x + cos(a) * rr * 0.6, b.r + w.y + sin(a) * rr * 0.6, zz);
          ctx.fillStyle = `rgba(200,236,255,${0.9 * (1 - u * 0.6)})`; ctx.beginPath(); ctx.arc(p[0], p[1], V.sc * 0.012 + 0.7, 0, TAU); ctx.fill();
        }
        const c = pj(b.c + w.x, b.r + w.y, w.z - 0.2), rr = w.r * V.sc * (0.8 + 0.12 * sin(t * 2));
        ctx.strokeStyle = "rgba(200,236,255,.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * V.se, 0, 0, TAU); ctx.stroke();
      });
      if (m.windmill) {
        const w = m.windmill, c = pj(b.c + w.x, b.r + w.y, w.z), len = w.len * V.sc, a0 = t * 0.9;
        ctx.save(); ctx.translate(c[0], c[1]);
        for (let i = 0; i < 4; i++) {
          const a = a0 + i * PI / 2; ctx.save(); ctx.rotate(a);
          ctx.fillStyle = "#e8dfc9"; ctx.strokeStyle = "#8a7a5a"; ctx.lineWidth = 1; ctx.fillRect(0, -2, len, 4); ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(len * 0.25, -len * 0.16, len * 0.7, len * 0.15); ctx.strokeRect(len * 0.25, -len * 0.16, len * 0.7, len * 0.15);
          ctx.restore();
        }
        ctx.fillStyle = "#6b4a2e"; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    function drawGlows(t) {
      const night = S.th.night; if (night < 0.12) return;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      S.blds.concat(S.props).forEach(b => b.m.lights.forEach(l => {
        const p = pj(b.c + l.x, b.r + l.y, l.z), r = l.r * V.sc * (1 + 0.04 * sin(S.t * 3 + l.x * 9));
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r), a = 0.34 * night;
        g.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${a})`); g.addColorStop(1, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
      }));
      ctx.restore();
    }
    function pill(x, y, text, sub) {
      ctx.font = "700 11px Onest, system-ui, sans-serif";
      const w = ctx.measureText(text).width + (sub ? ctx.measureText(sub).width + 8 : 0) + 14, h = 19;
      ctx.fillStyle = "rgba(14,15,18,.82)"; ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1;
      const rx = x - w / 2, ry = y - h / 2;
      ctx.beginPath(); ctx.moveTo(rx + 9, ry); ctx.arcTo(rx + w, ry, rx + w, ry + h, 9); ctx.arcTo(rx + w, ry + h, rx, ry + h, 9); ctx.arcTo(rx, ry + h, rx, ry, 9); ctx.arcTo(rx, ry, rx + w, ry, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4f1e8"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, rx + 7, y + 0.5);
      if (sub) { ctx.fillStyle = "#e3bf7c"; ctx.fillText(sub, rx + 7 + ctx.measureText(text).width + 8, y + 0.5); }
    }
    function drawCoinIcon(x, y, r, t, big) {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); g.addColorStop(0, "#fff0a8"); g.addColorStop(0.6, "#f0c24c"); g.addColorStop(1, "#b98318");
      ctx.save(); ctx.shadowColor = "rgba(255,210,90,.8)"; ctx.shadowBlur = big ? 14 : 8;
      ctx.fillStyle = g; ctx.strokeStyle = "#8a5f10"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(138,95,16,.7)"; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(138,95,16,.85)"; ctx.font = `800 ${Math.round(r * 1.1)}px Onest, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("M", x, y + 0.5);
      ctx.restore();
    }
    function drawHeart(x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = "#ee8195"; ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.4); ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.35); ctx.fill(); ctx.restore();
    }
    function drawOverlayTop(t) {
      const ov = S.ov;
      S._hits = [];
      // подписи
      if (ov.labels && !ov.placing && S.labelFn) {
        const few = S.blds.length <= 3;
        S.blds.forEach(b => {
          if (!few && b.id !== ov.sel && b.id !== ov.hot) return;
          const top = pj(b.c + b.f[0] / 2, b.r + b.f[1] / 2, b.m.top + 0.1);
          const lab = S.labelFn(b.id, b.lv);
          if (lab) pill(top[0], top[1] - 12, lab[0], lab[1]);
        });
      }
      // дань над ратушей
      if (ov.taxReady) {
        const h = S.blds.find(b => b.id === "hall");
        if (h) { const p = pj(h.c + h.f[0] / 2, h.r + h.f[1] / 2, h.m.top + 0.42), bob = sin(t * 4) * 4, r = Math.max(13, V.sc * 0.4); drawCoinIcon(p[0], p[1] + bob - 18, r, t, true); S._hits.push({ t: "tax", x: p[0], y: p[1] + bob - 18, r: r + 6 }); }
      }
      // пузырьки жителей
      S.citizens.forEach(z => {
        if (!z.bub || z._sx == null) return;
        const age = clamp((t - (z.bub.until - (z.bub.kind === "coin" ? 14 : 2.6))) * 3, 0, 1), bob = sin(t * 5 + z.i) * 2;
        const x = z._sx, y = z._sy - z._h - 12 + bob;
        if (z.bub.kind === "coin") { const r = Math.max(8, V.sc * 0.2) * age; drawCoinIcon(x, y, r, t); S._hits.push({ t: "coin", z, x, y, r: r + 8 }); }
        else drawHeart(x, y, Math.max(5, V.sc * 0.14) * age);
      });
    }

    function frameRender(t) {
      const ctx2 = ctx;
      ctx2.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      ctx2.clearRect(0, 0, S.W, S.H);
      setupProj();
      const nobg = !!S.cam.nobg;
      if (!nobg) { drawBg(t); drawFx(t, false); drawBoard(); }
      drawGroundOverlays(t);
      // сбор отрисовываемых объектов
      const items = S.items; items.length = 0;
      const all = S.blds.concat(S.props);
      const ghost = S.ov.placing && S.ov.hover && canPlace(S.ov.placing.id, S.ov.hover[0], S.ov.hover[1], S.ov.placing.id)
        ? { kind: "g", id: S.ov.placing.id, c: S.ov.hover[0], r: S.ov.hover[1], f: footOf(S.ov.placing.id), m: getModel(S.ov.placing.id, Math.max(1, (S.data.b && S.data.b[S.ov.placing.id]) || 1), false), ghost: 1 } : null;
      if (ghost) all.push(ghost);
      all.forEach(b => {
        const a = b.ghost ? 0.55 : 1;
        b.m.parts.forEach(p => items.push({ k: depthOf(b.c + p.cx, b.r + p.cy, p.cz) + p.bias, t: 0, p, b, a }));
        b.m.flags.forEach(fl => items.push({ k: depthOf(b.c + fl.x, b.r + fl.y, fl.z) + 0.02, t: 1, fl, b, a }));
        b.m.sprites.forEach(sp => items.push({ k: depthOf(b.c + sp.x, b.r + sp.y, 0.1) + 0.04, t: 2, sp, b, a }));
      });
      S.citizens.forEach(z => items.push({ k: depthOf(z.x, z.y, 0.1) + 0.03, t: 3, z }));
      items.sort((a, b) => a.k - b.k);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.t === 0) drawPart(it); else if (it.t === 1) drawFlag(it); else if (it.t === 2) drawSpriteItem(it); else drawCitizen(it);
      }
      all.forEach(b => { if (!b.ghost) drawFxModel(b, t); });
      drawGlows(t);
      drawFx(t, true);
      drawOverlayTop(t);
      if (nobg) return;
      // виньетка
      const vg = ctx2.createRadialGradient(S.W / 2, S.H / 2, Math.min(S.W, S.H) * 0.4, S.W / 2, S.H / 2, Math.max(S.W, S.H) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.28)"); ctx2.fillStyle = vg; ctx2.fillRect(0, 0, S.W, S.H);
    }

    /* ----- пик (клики) ----- */
    function ptInPoly(x, y, pts) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    function pickBuilding(sx, sy) {
      for (let i = S.items.length - 1; i >= 0; i--) {
        const it = S.items[i]; if (it.t !== 0 || it.b.kind !== "b") continue;
        for (const f of it.p.faces) {
          const tow = (f.n[0] * V.s + f.n[1] * V.c) * V.ce + f.n[2] * V.se; if (!f.ds && tow <= 0.005) continue;
          const pts = f.p.map(q => pj(it.b.c + q[0], it.b.r + q[1], q[2]));
          if (ptInPoly(sx, sy, pts)) return it.b;
        }
      }
      return null;
    }
    function pickAt(sx, sy) {
      for (const h of S._hits || []) if (Math.hypot(sx - h.x, sy - h.y) <= h.r) return h.t === "tax" ? { type: "tax" } : { type: "coin", z: h.z };
      if (S.ov.placing) { const g = unproject(sx, sy); const c = Math.floor(g[0]), r = Math.floor(g[1]); return { type: "tile", c: clamp(c, 0, 7), r: clamp(r, 0, 7), out: c < 0 || r < 0 || c > 7 || r > 7 }; }
      for (let i = S.citizens.length - 1; i >= 0; i--) { const z = S.citizens[i]; if (z._sx == null) continue; if (Math.abs(sx - z._sx) < z._h * 0.4 && sy < z._sy + 4 && sy > z._sy - z._h * 1.1) return { type: "citizen", z }; }
      const b = pickBuilding(sx, sy); if (b) return { type: "building", id: b.id };
      const g = unproject(sx, sy), c = Math.floor(g[0]), r = Math.floor(g[1]);
      if (c >= 0 && r >= 0 && c < 8 && r < 8) { const bb = S.blds.find(q => c >= q.c && c < q.c + q.f[0] && r >= q.r && r < q.r + q.f[1]); if (bb) return { type: "building", id: bb.id }; return { type: "tile", c, r }; }
      return { type: "none" };
    }
    S.pickAt = pickAt;
    S.poke = function (z) { if (z) { z.jump = 0; z.bub = { kind: "heart", until: S.t + 2.2 }; } };
    S.dropBubble = function (z) { if (z) { z.bub = null; z.nb = 25 + rng() * 40; } };

    /* ----- ввод ----- */
    const ptrs = new Map(); let drag = null, pinch = null;
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function camChanged() { if (S.onCamera) S.onCamera({ yaw: S.cam.tyaw, zoom: S.cam.tzoom }); }
    canvas.addEventListener("pointerdown", e => {
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, yaw: S.cam.tyaw, moved: false };
      else if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), z: S.cam.tzoom }; if (drag) drag.moved = true; }
    });
    canvas.addEventListener("pointermove", e => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && ptrs.size >= 2) { const a = [...ptrs.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); S.cam.tzoom = clamp(pinch.z * d / (pinch.d || 1), 0.7, 1.9); return; }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        if (drag.moved && !opts.fixedCam) { S.cam.tyaw = ((drag.yaw + dx * 0.4) % 360 + 360) % 360; S.cam.yaw = S.cam.tyaw; }
      } else if (S.ov.placing && e.pointerType === "mouse") { const p = pos(e), g = unproject(p[0], p[1]); const c = Math.floor(g[0]), r = Math.floor(g[1]); S.ov.hover = (c >= 0 && r >= 0 && c < 8 && r < 8) ? [c, r] : null; }
      if (S.ov.placing && e.pointerType === "mouse" && drag && !drag.moved) { const p = pos(e), g = unproject(p[0], p[1]); const c = Math.floor(g[0]), r = Math.floor(g[1]); S.ov.hover = (c >= 0 && r >= 0 && c < 8 && r < 8) ? [c, r] : null; }
    });
    function up(e) {
      const wasDrag = drag, moved = drag && drag.moved;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        drag = null;
        if (wasDrag && !moved && e.type === "pointerup") { const p = pos(e), hit = pickAt(p[0], p[1]); if (S.onPick) S.onPick(hit); }
        else if (wasDrag && moved) camChanged();
        if (pinch === null && S.cam.tzoom !== S.cam.zoom) camChanged();
      }
    }
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") S.ov.hover = null; });
    canvas.addEventListener("wheel", e => { if (opts.fixedCam) return; e.preventDefault(); S.cam.tzoom = clamp(S.cam.tzoom * (e.deltaY < 0 ? 1.08 : 0.925), 0.7, 1.9); clearTimeout(S._wt); S._wt = setTimeout(camChanged, 300); }, { passive: false });

    /* ----- API ----- */
    S.setCamera = function (o) {
      if (o.mode) { S.cam.mode = o.mode; S.cam.te = o.mode === "top" ? 1.36 : o.mode === "hero" ? 0.4 : 0.66; }
      if (o.yaw != null) S.cam.tyaw = ((+o.yaw % 360) + 360) % 360;
      if (o.zoom != null) S.cam.tzoom = clamp(+o.zoom, 0.7, 5);
      if (o.nobg != null) S.cam.nobg = !!o.nobg;
      if (o.fx != null) { S.cam.fx = o.fx; S.cam.fy = o.fy; }
      if (o.snap) { S.cam.yaw = S.cam.tyaw; S.cam.zoom = S.cam.tzoom; S.cam.e = S.cam.te; }
    };
    S.rotate = function (d) { S.cam.tyaw = (((S.cam.tyaw + d) % 360) + 360) % 360; camChanged(); };
    S.zoomBy = function (d) { S.cam.tzoom = clamp(S.cam.tzoom + d, 0.7, 1.9); camChanged(); };
    S.overlay = function (o) { Object.assign(S.ov, o); };

    function resize() {
      const w = opts.size ? opts.size[0] : (canvas.clientWidth || 300), h = opts.size ? opts.size[1] : (canvas.clientHeight || 300), dpr = opts.dpr || Math.min(2, window.devicePixelRatio || 1);
      if (w !== S.W || h !== S.H || dpr !== S.dpr) { S.W = w; S.H = h; S.dpr = dpr; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    }
    function tick(now) {
      if (!S.running) return;
      S.raf = requestAnimationFrame(tick);
      if (!canvas.isConnected || canvas.offsetParent === null || document.hidden) { S.last = now; return; }
      const dt = Math.min(0.05, (now - (S.last || now)) / 1000); S.last = now; S.t += dt;
      resize(); if (!S.W || !S.H) return;
      const k = 1 - Math.pow(0.0008, dt), cam = S.cam;
      let dy = ((cam.tyaw - cam.yaw + 540) % 360) - 180; cam.yaw = (cam.yaw + dy * k + 360) % 360;
      cam.zoom += (cam.tzoom - cam.zoom) * k; cam.e += (cam.te - cam.e) * k;
      stepCitizens(dt);
      frameRender(S.t);
    }
    S.start = function () { if (S.running) return; S.running = true; S.last = 0; S.raf = requestAnimationFrame(tick); };
    S.stop = function () { S.running = false; cancelAnimationFrame(S.raf); };
    S.once = function (steps) { resize(); for (let i = 0; i < (steps || 0); i++) { S.t += 0.1; stepCitizens(0.1); } S.cam.yaw = S.cam.tyaw; S.cam.zoom = S.cam.tzoom; S.cam.e = S.cam.te; frameRender(S.t); };
    S.destroy = function () { S.stop(); };
    S.citizenAt = i => S.citizens[i];
    S.occupiedTiles = () => S.blocked.slice();
    return S;
  }

  /* снимок одной картинкой (карточка на главной, превью) */
  function snapshot(canvas, data, o) {
    o = o || {};
    const sc = createScene(canvas, { fixedCam: true });
    sc.set(data); sc.setCamera({ yaw: o.yaw == null ? 45 : o.yaw, zoom: o.zoom || 1, mode: o.mode || "iso", snap: true });
    sc.overlay({ labels: false }); sc.once(o.steps == null ? 6 : o.steps);
    return sc;
  }

  window.VL3 = { createScene, snapshot, SKINS, SKIN_BY_ID, THEMES: TH, drawFigure, FOOT, footOf, buildModel, SPRITE_PAL, BUILD_ORDER, SKIN_PALS: { P_IVORY, P_GRAPH }, TYPE_SCALE };
})();