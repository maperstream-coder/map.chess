/* maper.chess — быстрый решатель «мат в N» (без chess.js, доска 0x88).
   Нужен для подсказок в задачах: ищет принудительный мат против ЛЮБОЙ защиты,
   поэтому подсказка всегда ведёт к мату, если он ещё возможен в оставшиеся ходы.
   Работает и в браузере (window.MateSolver), и в Node (module.exports) — так мы проверяли все задачи.
   API: MateSolver.find(fen, n) -> { from:"e2", to:"e4", promotion:"q"|undefined, depth:k }
                                 | null (мата за n ходов нет) | false (поиск прерван по лимиту узлов)
        MateSolver.depth(fen, n)  -> минимальное k<=n, за которое есть форсированный мат (0 — нет)
        MateSolver.solutions(fen, n) -> список всех первых ходов, ведущих к мату за <=n */
(function (root) {
  "use strict";
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const nOff = [31, 33, 14, 18, -31, -33, -14, -18], kOff = [1, -1, 16, -16, 15, -15, 17, -17];
  const bDir = [15, -15, 17, -17], rDir = [1, -1, 16, -16];
  const VAL = [0, 1, 3, 3, 5, 9, 0];

  /* --- Zobrist (детерминированный xorshift32) --- */
  let seed = 2463534242;
  const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const zA = new Int32Array(16 * 128), zB = new Int32Array(16 * 128), zEpA = new Int32Array(8), zEpB = new Int32Array(8);
  for (let i = 0; i < zA.length; i++) { zA[i] = rnd32(); zB[i] = rnd32(); }
  for (let i = 0; i < 8; i++) { zEpA[i] = rnd32(); zEpB[i] = rnd32(); }
  const zSideA = rnd32(), zSideB = rnd32();

  /* --- состояние (одна глобальная позиция — быстрее, решатель не реентерабельный) --- */
  const b = new Int8Array(128);
  let side = 0, ep = -1, k0 = 0, k1 = 0, h1 = 0, h2 = 0;
  const ksq = () => (side === 0 ? k0 : k1);
  let nodes = 0, budget = 3000000, aborted = false;

  /* undo-стек */
  const uCap = new Int8Array(64), uEp = new Int16Array(64), uH1 = new Int32Array(64), uH2 = new Int32Array(64),
        uK0 = new Int16Array(64), uK1 = new Int16Array(64);
  let sp = 0;

  function attacked(sq, by) {
    let s;
    if (by === 0) {
      s = sq - 15; if (!(s & 0x88) && b[s] === P) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === P) return true;
    } else {
      s = sq + 15; if (!(s & 0x88) && b[s] === (P | 8)) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === (P | 8)) return true;
    }
    const sh = by << 3;
    for (let i = 0; i < 8; i++) { s = sq + nOff[i]; if (!(s & 0x88) && b[s] === (N | sh)) return true; }
    for (let i = 0; i < 8; i++) { s = sq + kOff[i]; if (!(s & 0x88) && b[s] === (K | sh)) return true; }
    for (let i = 0; i < 4; i++) {
      const d = bDir[i]; s = sq + d;
      while (!(s & 0x88)) { const pc = b[s]; if (pc) { if (pc === (B | sh) || pc === (Q | sh)) return true; break; } s += d; }
    }
    for (let i = 0; i < 4; i++) {
      const d = rDir[i]; s = sq + d;
      while (!(s & 0x88)) { const pc = b[s]; if (pc) { if (pc === (R | sh) || pc === (Q | sh)) return true; break; } s += d; }
    }
    return false;
  }

  /* ход = from | to<<8 | promo<<16 | flag<<20 ; flag: 1 = en passant, 2 = двойной ход пешки */
  const mFrom = m => m & 0xff, mTo = m => (m >> 8) & 0xff, mPromo = m => (m >> 16) & 15, mFlag = m => (m >> 20) & 15;

  function make(m) {
    const from = m & 0xff, to = (m >> 8) & 0xff, promo = (m >> 16) & 15, flag = (m >> 20) & 15;
    uCap[sp] = b[to]; uEp[sp] = ep; uH1[sp] = h1; uH2[sp] = h2; uK0[sp] = k0; uK1[sp] = k1;
    const us = side, pc = b[from];
    if (ep >= 0) { h1 ^= zEpA[ep & 7]; h2 ^= zEpB[ep & 7]; }
    h1 ^= zA[pc * 128 + from]; h2 ^= zB[pc * 128 + from]; b[from] = 0;
    if (flag === 1) {
      const cs = to + (us === 0 ? -16 : 16); const cp = b[cs]; uCap[sp] = cp;
      h1 ^= zA[cp * 128 + cs]; h2 ^= zB[cp * 128 + cs]; b[cs] = 0;
    } else if (uCap[sp]) { const cp = uCap[sp]; h1 ^= zA[cp * 128 + to]; h2 ^= zB[cp * 128 + to]; }
    const np = promo ? (promo | (us << 3)) : pc;
    b[to] = np; h1 ^= zA[np * 128 + to]; h2 ^= zB[np * 128 + to];
    if ((pc & 7) === K) { if (us === 0) k0 = to; else k1 = to; }
    ep = -1;
    if (flag === 2) { ep = (from + to) >> 1; h1 ^= zEpA[ep & 7]; h2 ^= zEpB[ep & 7]; }
    side ^= 1; h1 ^= zSideA; h2 ^= zSideB;
    sp++;
  }
  function unmake(m) {
    sp--;
    const from = m & 0xff, to = (m >> 8) & 0xff, promo = (m >> 16) & 15, flag = (m >> 20) & 15;
    side ^= 1; const us = side; let pc = b[to]; if (promo) pc = P | (us << 3);
    b[from] = pc;
    if (flag === 1) { b[to] = 0; b[to + (us === 0 ? -16 : 16)] = uCap[sp]; } else b[to] = uCap[sp];
    ep = uEp[sp]; h1 = uH1[sp]; h2 = uH2[sp]; k0 = uK0[sp]; k1 = uK1[sp];
  }

  const tmp = new Int32Array(256);
  function pawnAdd(buf, n, from, to, us) {
    const last = us === 0 ? (to >> 4) === 7 : (to >> 4) === 0;
    if (last) { buf[n++] = from | (to << 8) | (Q << 16); buf[n++] = from | (to << 8) | (R << 16); buf[n++] = from | (to << 8) | (B << 16); buf[n++] = from | (to << 8) | (N << 16); }
    else buf[n++] = from | (to << 8);
    return n;
  }
  function genPseudo(buf) {
    let n = 0; const us = side;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const pc = b[sq]; if (!pc || (pc >> 3) !== us) continue; const t = pc & 7;
      if (t === P) {
        const dir = us === 0 ? 16 : -16; const to = sq + dir;
        if (!(to & 0x88) && !b[to]) {
          n = pawnAdd(buf, n, sq, to, us);
          const row = sq >> 4;
          if ((us === 0 && row === 1) || (us === 1 && row === 6)) { const to2 = to + dir; if (!b[to2]) buf[n++] = sq | (to2 << 8) | (2 << 20); }
        }
        for (let k = -1; k <= 1; k += 2) {
          const c = sq + dir + k; if (c & 0x88) continue;
          if (b[c] && (b[c] >> 3) !== us) n = pawnAdd(buf, n, sq, c, us);
          else if (c === ep && !b[c]) buf[n++] = sq | (c << 8) | (1 << 20);
        }
      } else if (t === N || t === K) {
        const off = t === N ? nOff : kOff;
        for (let i = 0; i < 8; i++) { const to = sq + off[i]; if (to & 0x88) continue; if (!b[to] || (b[to] >> 3) !== us) buf[n++] = sq | (to << 8); }
      } else {
        const dirs = t === R ? rDir : t === B ? bDir : kOff;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i]; let to = sq + d;
          while (!(to & 0x88)) {
            if (!b[to]) buf[n++] = sq | (to << 8);
            else { if ((b[to] >> 3) !== us) buf[n++] = sq | (to << 8); break; }
            to += d;
          }
        }
      }
    }
    return n;
  }
  function legal(buf) {
    const c = genPseudo(tmp); let n = 0; const us = side;
    for (let i = 0; i < c; i++) {
      const m = tmp[i]; make(m);
      const ok = !attacked(us === 0 ? k0 : k1, 1 - us);
      unmake(m);
      if (ok) buf[n++] = m;
    }
    return n;
  }

  /* --- таблица транспозиций: ключ -> winN | loseN<<4 --- */
  let tt = new Map();
  const ttKey = () => (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);

  const MAXPLY = 12;
  const attBuf = [], repBuf = [];
  for (let i = 0; i < MAXPLY; i++) { attBuf.push(new Int32Array(256)); repBuf.push(new Int32Array(256)); }
  const keyBuf = new Int32Array(256);

  /* сторона на ходу может форсированно поставить мат за <= n своих ходов */
  function win(n, ply) {
    if (aborted) return false;
    if (++nodes > budget) { aborted = true; return false; }
    const key = ttKey(); const e = tt.get(key);
    if (e !== undefined) { const w = e & 15, l = e >> 4; if (w && w <= n) return true; if (l >= n) return false; }
    const ms = attBuf[ply], rs = repBuf[ply];
    const c = legal(ms); const us = side; let res = false;
    for (let pass = 0; pass < (n === 1 ? 1 : 2) && !res; pass++) {
      for (let i = 0; i < c && !res; i++) {
        const m = ms[i]; make(m);
        const chk = attacked(us === 0 ? k1 : k0, us);
        if ((pass === 0) !== chk) { unmake(m); continue; }
        const rc = legal(rs); let ok;
        if (rc === 0) ok = chk;
        else if (n === 1) ok = false;
        else {
          ok = true;
          for (let j = 0; j < rc; j++) {
            const r = rs[j]; let k = 0; const cap = b[(r >> 8) & 0xff];
            if (cap) k += 100 + VAL[cap & 7] * 10 - VAL[b[r & 0xff] & 7];
            if (((r >> 20) & 15) === 1) k += 100; if ((r >> 16) & 15) k += 50; if ((b[r & 0xff] & 7) === K) k += 3;
            keyBuf[j] = k;
          }
          /* порядок ответов защиты: взятия -> превращения -> ходы короля */
          for (let a = 0; a < rc; a++) {
            let bi = a; for (let j = a + 1; j < rc; j++) if (keyBuf[j] > keyBuf[bi]) bi = j;
            if (bi !== a) { const t1 = keyBuf[a]; keyBuf[a] = keyBuf[bi]; keyBuf[bi] = t1; const t2 = rs[a]; rs[a] = rs[bi]; rs[bi] = t2; }
            const r = rs[a]; make(r); const w = win(n - 1, ply + 1); unmake(r);
            if (!w) { ok = false; break; }
          }
        }
        unmake(m);
        if (ok) res = true;
      }
    }
    if (!aborted) {
      const old = tt.get(key) || 0; let w = old & 15, l = old >> 4;
      if (res) { if (!w || n < w) w = n; } else if (n > l) l = n;
      if (tt.size > 600000) tt = new Map();
      tt.set(key, w | (l << 4));
    }
    return res;
  }

  function load(fen) {
    b.fill(0); const f = fen.trim().split(/\s+/); let r = 7, c = 0;
    for (const ch of f[0]) {
      if (ch === "/") { r--; c = 0; continue; }
      if (ch >= "1" && ch <= "8") { c += +ch; continue; }
      const t = { p: P, n: N, b: B, r: R, q: Q, k: K }[ch.toLowerCase()]; const color = ch === ch.toUpperCase() ? 0 : 1;
      b[r * 16 + c] = t | (color << 3); if (t === K) { if (color === 0) k0 = r * 16 + c; else k1 = r * 16 + c; } c++;
    }
    side = f[1] === "b" ? 1 : 0; ep = -1;
    if (f[3] && f[3] !== "-") ep = (+f[3][1] - 1) * 16 + (f[3].charCodeAt(0) - 97);
    sp = 0; h1 = 0; h2 = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) continue; const pc = b[s]; if (pc) { h1 ^= zA[pc * 128 + s]; h2 ^= zB[pc * 128 + s]; } }
    if (side) { h1 ^= zSideA; h2 ^= zSideB; }
    if (ep >= 0) { h1 ^= zEpA[ep & 7]; h2 ^= zEpB[ep & 7]; }
  }

  const sqName = s => String.fromCharCode(97 + (s & 7)) + String.fromCharCode(49 + (s >> 4));
  const PROMO = ["", "", "n", "b", "r", "q"];
  function moveObj(m) { const p = (m >> 16) & 15; return { from: sqName(m & 0xff), to: sqName((m >> 8) & 0xff), promotion: p ? PROMO[p] : undefined }; }

  /* ход m ведёт к мату за <= n (n — число ходов атакующего, считая m)? */
  function moveWins(m, n, ply) {
    const us = side; make(m);
    const chk = attacked(us === 0 ? k1 : k0, us); const rs = repBuf[ply]; const rc = legal(rs); let ok;
    if (rc === 0) ok = chk;
    else if (n === 1) ok = false;
    else { ok = true; for (let j = 0; j < rc && ok; j++) { make(rs[j]); if (!win(n - 1, ply + 1)) ok = false; unmake(rs[j]); } }
    unmake(m); return ok;
  }

  function solutions(fen, n, opts) {
    load(fen); nodes = 0; aborted = false; budget = (opts && opts.budget) || 3000000;
    const out = []; const ms = new Int32Array(256); const c = legal(ms);
    for (let k = 1; k <= n; k++) {
      for (let i = 0; i < c; i++) if (moveWins(ms[i], k, 1)) out.push(Object.assign(moveObj(ms[i]), { depth: k }));
      if (out.length || aborted) break;
    }
    return aborted ? null : out;
  }
  function find(fen, n, opts) {
    load(fen); nodes = 0; aborted = false; budget = (opts && opts.budget) || 3000000;
    const ms = new Int32Array(256); const c = legal(ms);
    for (let k = 1; k <= n; k++) {
      let mateNow = -1, any = -1;
      for (let i = 0; i < c; i++) {
        if (moveWins(ms[i], k, 1)) {
          any = any < 0 ? i : any;
          make(ms[i]); const rs = repBuf[1]; const rc = legal(rs); const chk = attacked(side === 0 ? k0 : k1, 1 - side); unmake(ms[i]);
          if (rc === 0 && chk) { mateNow = i; break; }
        }
        if (aborted) return false;
      }
      if (aborted) return false;
      if (any >= 0) return Object.assign(moveObj(ms[mateNow >= 0 ? mateNow : any]), { depth: k });
    }
    return null;
  }
  function depth(fen, n, opts) {
    load(fen); nodes = 0; aborted = false; budget = (opts && opts.budget) || 3000000;
    for (let k = 1; k <= n; k++) { if (win(k, 0)) return k; if (aborted) return -1; }
    return 0;
  }

  /* perft — только для самопроверки генератора ходов (сверка с эталонными числами) */
  function perft(fen, d) {
    load(fen);
    const rec = (dd, ply) => {
      const buf = new Int32Array(256); const c = legal(buf); if (dd === 1) return c;
      let t = 0; for (let i = 0; i < c; i++) { make(buf[i]); t += rec(dd - 1, ply + 1); unmake(buf[i]); } return t;
    };
    return rec(d, 0);
  }

  /* вспомогательные функции для самопроверки (тесты): список ходов, сыграть ход, статус позиции */
  function toFen() {
    let out = "";
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let c = 0; c < 8; c++) {
        const pc = b[r * 16 + c]; if (!pc) { e++; continue; }
        if (e) { out += e; e = 0; }
        const ch = " pnbrqk"[pc & 7]; out += (pc >> 3) ? ch : ch.toUpperCase();
      }
      if (e) out += e; if (r) out += "/";
    }
    return out + (side ? " b" : " w") + " - " + (ep >= 0 ? sqName(ep) : "-") + " 0 1";
  }
  function moves(fen) { load(fen); const buf = new Int32Array(256); const c = legal(buf); const o = []; for (let i = 0; i < c; i++) o.push(moveObj(buf[i])); return o; }
  function play(fen, mv) {
    load(fen); const buf = new Int32Array(256); const c = legal(buf);
    for (let i = 0; i < c; i++) {
      const m = moveObj(buf[i]);
      if (m.from === mv.from && m.to === mv.to && (m.promotion || "") === (mv.promotion || "")) { make(buf[i]); return toFen(); }
    }
    return null;
  }
  function status(fen) {
    load(fen); const buf = new Int32Array(256); const c = legal(buf); const chk = attacked(ksq(), 1 - side);
    return c === 0 ? (chk ? "mate" : "stalemate") : (chk ? "check" : "ok");
  }

  const api = { find, solutions, depth, perft, moves, play, status };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MateSolver = api;
})(typeof window !== "undefined" ? window : globalThis);