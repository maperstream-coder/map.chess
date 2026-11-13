/* maper.chess — боевая математика деревни. Чистые функции, без DOM и Firebase.
   Бой детерминирован: simulate(атакующие, оборона, seed) даёт один и тот же ход боя у любого клиента.
   Поэтому в документе набега хранятся только сид и два «снимка» — защитник перепроверяет и воспроизводит бой сам. */
(function (root) {
  "use strict";
  const UT = ["pawn", "knight", "bishop", "rook", "queen"];
  /* atk/hp — базовые; pop — места в войске; cost — монеты; sec — время обучения; need — здание, которое открывает юнита */
  const UNITS = {
    pawn:   { atk: 4,  hp: 10, pop: 1, cost: 14,  sec: 45,  need: "cottages" },
    knight: { atk: 12, hp: 15, pop: 2, cost: 46,  sec: 130, need: "stables" },
    bishop: { atk: 9,  hp: 10, pop: 2, cost: 40,  sec: 110, need: "chapel" },
    rook:   { atk: 6,  hp: 32, pop: 3, cost: 64,  sec: 190, need: "towers" },
    queen:  { atk: 32, hp: 34, pop: 6, cost: 200, sec: 420, need: "palace" }
  };
  const ROUNDS = 10, LOOT_PCT = [0, 0.25, 0.6, 1];
  const MARCH_MS = 4 * 60 * 1000;        // отряд возвращается через 4 минуты
  const num = (x, d) => (Number.isFinite(+x) ? +x : (d || 0));

  function rng32(seed) {                 // mulberry32
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
  /* множитель юнита от уровня его здания: +6% за уровень выше первого, максимум +40% */
  const mulOf = lv => 1 + Math.min(0.4, 0.06 * Math.max(0, num(lv, 1) - 1));

  /* ---- параметры деревни ---- */
  function lvl(v, id) { return Math.max(0, num(v.b && v.b[id])); }
  function decorSum(v, kind) {
    const D = root.VDECOR; if (!D) return 0;
    let s = 0; ((v.decor && v.decor.placed) || []).forEach(x => { const d = D.BY_ID[x.id]; if (d && d.perk[0] === kind) s += d.perk[1]; });
    return kind in (D.CAPS || {}) ? Math.min(D.CAPS[kind], s) : s;
  }
  function housing(v) { return 8 + 5 * lvl(v, "hall") + 3 * lvl(v, "cottages") + decorSum(v, "cap"); }
  function popOf(u) { return UT.reduce((n, k) => n + num(u && u[k]) * UNITS[k].pop, 0); }
  function popAll(v) {
    const a = v.army || { u: {}, q: [], out: [] };
    let n = popOf(a.u);
    (a.q || []).forEach(x => { n += num(x.n) * UNITS[x.t].pop; });
    (a.out || []).forEach(x => { n += popOf(x.u); });
    return n;
  }
  function unitMuls(v) { const m = {}; UT.forEach(k => { m[k] = mulOf(lvl(v, UNITS[k].need)); }); return m; }
  /* оборона: HP ворот и урон башен в раунд (без гарнизона) */
  function structure(v) {
    const h = lvl(v, "hall"), c = lvl(v, "castle"), t = lvl(v, "towers"), p = lvl(v, "palace");
    return {
      wall: Math.round(90 + 46 * c + 28 * t + 18 * h + 9 * p),
      dps: Math.round((4 + 7 * t + 9 * c + 3 * h + 4 * p + decorSum(v, "def")) * 10) / 10
    };
  }
  /* снимок обороны — его публикует деревня, по нему идёт бой */
  function defSnapshot(v, treasuryNow) {
    const s = structure(v), g = {}; UT.forEach(k => { g[k] = clampN(num(v.army && v.army.u && v.army.u[k]), 0, 999); });
    return { wall: s.wall, dps: s.dps, g, gm: unitMuls(v), safe: Math.min(40, decorSum(v, "safe")), tr: Math.max(0, Math.floor(num(treasuryNow) * 0.4)) };
  }
  function unitPower(u, m) { return UT.reduce((n, k) => n + num(u[k]) * (UNITS[k].atk + UNITS[k].hp * 0.25) * ((m && m[k]) || 1), 0); }
  function defPower(d) { return Math.round(d.wall * 0.3 + d.dps * 2.2 + unitPower(d.g, d.gm)); }
  function atkPower(u, m, pct) { return Math.round(unitPower(u, m) * (1 + num(pct) / 100)); }

  /* ---- бой ---- */
  function expand(u, m) {
    const out = [];
    UT.forEach(k => { for (let i = 0; i < num(u && u[k]); i++) { const hp = UNITS[k].hp * ((m && m[k]) || 1); out.push({ t: k, hp, max: hp, atk: UNITS[k].atk * ((m && m[k]) || 1) }); } });
    return out;
  }
  function counts(list) { const c = { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 }; list.forEach(x => { if (x.hp > 0) c[x.t]++; }); return c; }
  /* урон по списку: сначала самые слабые; возвращает, сколько не потрачено */
  function hurt(list, dmg) {
    const alive = list.filter(x => x.hp > 0).sort((a, b) => a.hp - b.hp);
    for (const x of alive) { if (dmg <= 0) break; const d = Math.min(x.hp, dmg); x.hp -= d; dmg -= d; }
    return dmg;
  }
  /* A: { u:{pawn..}, m:{pawn..}, pct }   D: defSnapshot   seed: целое */
  function simulate(A, D, seed) {
    const rnd = rng32(seed), att = expand(A.u, A.m), gar = expand(D.g, D.gm);
    gar.forEach(x => { x.hp *= 1.2; x.max = x.hp; });
    const pct = 1 + num(A.pct) / 100, wallMax = Math.max(1, D.wall), startPop = att.reduce((n, x) => n + UNITS[x.t].pop, 0);
    let wall = wallMax; const rounds = [];
    for (let r = 1; r <= ROUNDS; r++) {
      const aliveA = att.filter(x => x.hp > 0);
      if (!aliveA.length) break;
      // 1) атакующие
      const aPow = aliveA.reduce((n, x) => n + x.atk, 0) * pct * (0.9 + 0.2 * rnd());
      const share = k => { const s = aliveA.filter(x => x.t === k).reduce((n, x) => n + x.atk, 0); const tot = aliveA.reduce((n, x) => n + x.atk, 0) || 1; return s / tot; };
      const direct = aPow * (0.4 * share("bishop") + 0.3 * share("knight"));      // слоны бьют поверх, кони перепрыгивают
      const toGar = aPow - direct;
      const left = hurt(gar, toGar);
      const rookMul = 1 + 0.6 * share("rook");                                       // ладьи крушат ворота
      const wallHit = (direct + left) * rookMul;
      wall -= wallHit;
      // 2) обороняющиеся (пока ворота стоят — башни стреляют)
      const aliveG = gar.filter(x => x.hp > 0);
      const dPow = ((wall > 0 ? D.dps : D.dps * 0.4) + aliveG.reduce((n, x) => n + x.atk, 0) * 0.7) * (0.9 + 0.2 * rnd());
      hurt(att, dPow);
      rounds.push({ r, a: counts(att), d: counts(gar), wall: Math.max(0, Math.round(wall * 10) / 10), hitW: Math.round(wallHit), hitA: Math.round(dPow), hitG: Math.round(toGar) });
      if (wall <= 0) break;
    }
    const left2 = att.filter(x => x.hp > 0), endPop = left2.reduce((n, x) => n + UNITS[x.t].pop, 0);
    const dmgPct = 1 - Math.max(0, wall) / wallMax;
    let stars = 0;
    if (dmgPct >= 0.5) stars = 1;
    if (wall <= 0) stars = 2;
    if (wall <= 0 && endPop >= startPop * 0.6) stars = 3;
    const lost = {}, dk = {}; const a1 = counts(att), g1 = counts(gar);
    UT.forEach(k => { lost[k] = Math.max(0, num(A.u && A.u[k]) - a1[k]); dk[k] = Math.max(0, num(D.g && D.g[k]) - g1[k]); });
    const loot = Math.floor(num(D.tr) * LOOT_PCT[stars] * (1 - num(D.safe) / 100));
    return { stars, wallPct: Math.round(dmgPct * 100), survivors: a1, lost, dk, loot, rounds, breach: wall <= 0 };
  }
  /* быстрая оценка шансов (Монте-Карло с фиксированными сидами — одинакова при каждом показе) */
  function estimate(A, D, n) {
    n = n || 24; const c = [0, 0, 0, 0]; let loot = 0;
    for (let i = 0; i < n; i++) { const r = simulate(A, D, 1000 + i * 7919); c[r.stars]++; loot += r.loot; }
    return { p: c.map(x => x / n), win: (c[2] + c[3]) / n, loot: Math.round(loot / n) };
  }
  /* репутация за бой */
  const repFor = stars => (stars === 0 ? -5 : 8 + stars * 6);
  const repLossDef = stars => (stars === 0 ? 6 : -stars * 4);   // защитник: плюс за отбитый набег, минус за разорение

  /* ---- NPC-лагеря: детерминированны от дня и деревни, не требуют сервера ---- */
  const NPC_NAMES = [["Лагерь бродяг", "Vagrant camp"], ["Форт барона Слона", "Baron Bishop's fort"], ["Крепость Рокировка", "Castling stronghold"], ["Логово разбойников", "Bandit den"], ["Застава Чёрных пешек", "Black pawn outpost"], ["Башня одинокого коня", "Lone knight's tower"]];
  function npcCamps(prosperity, seed) {
    const r = rng32(seed), out = [], off = Math.floor(r() * NPC_NAMES.length);
    const base = Math.max(2, Math.round(prosperity / 4));
    [[0.7, 0], [1.0, 1], [1.4, 2]].forEach(([k, tier], i) => {
      const L = Math.max(1, Math.round(base * k)), nm = NPC_NAMES[(off + i * 2) % NPC_NAMES.length];
      const g = { pawn: Math.round(L * 1.5 * (0.8 + r() * 0.4)), knight: tier ? Math.round(L / 3) : 0, bishop: tier > 1 ? Math.round(L / 4) : 0, rook: tier ? Math.round(L / 4) : 0, queen: 0 };
      const d = { wall: Math.round(90 + 38 * L * (0.9 + r() * 0.2)), dps: Math.round((4 + 4.6 * L) * 10) / 10, g, gm: { pawn: 1, knight: 1, bishop: 1, rook: 1, queen: 1 }, safe: 0, tr: Math.round(24 + 9 * L * (tier + 1) * 0.8) };
      const hall = Math.min(10, Math.max(1, Math.round(L / 2) + 1));
      const b = { hall, cottages: Math.min(8, Math.max(1, Math.round(L / 2))), towers: Math.min(6, Math.max(1, Math.round(L / 3))) };
      if (tier) b.stables = Math.min(6, Math.max(1, Math.round(L / 3)));
      if (tier > 1) { b.castle = Math.min(6, Math.max(1, Math.round(L / 4))); b.chapel = 1; }
      const plot = { hall: "3,3", cottages: "1,5", towers: "6,2", stables: "6,6", castle: "0,0", chapel: "2,2" };
      out.push({ id: "npc" + i, tier, name: nm, d, power: defPower(d), v: { b, plot, theme: ["theme-dusk", "theme-winter", "theme-forest"][i], deco: [], decor: [{ id: "dc-pine", c: 1, r: 1 }, { id: "dc-hay", c: 5, r: 5 }, { id: "dc-brazier", c: 5, r: 3 }].slice(0, 1 + tier), folk: { n: 0, skin: "skin-classic" } } });
    });
    return out;
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  root.VSIM = { UT, UNITS, ROUNDS, LOOT_PCT, MARCH_MS, mulOf, lvl, decorSum, housing, popOf, popAll, unitMuls, structure, defSnapshot, unitPower, defPower, atkPower, simulate, estimate, repFor, repLossDef, npcCamps, rng32, hashStr };
  if (typeof module !== "undefined") module.exports = root.VSIM;
})(typeof window !== "undefined" ? window : globalThis);
