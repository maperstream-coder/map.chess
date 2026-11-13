/* maper.chess — движок соперника + решатель мата.
   v2: собственный быстрый движок (доска 0x88, перебор с альфа-бета, ход-ядро, таблица транспозиций,
   тихий поиск, итеративное углубление, оценка с PST/пешечной структурой/безопасностью короля).
   Сильные боты считаются в Web Worker (интерфейс не подвисает), слабые — «человечные»: шум оценки
   и ошибки вместо случайных ходов. Дебютная книга для клубных игроков и мастеров.
   Публичный API (совместим со старым):
     chooseAiMove(game, depth, blunder, cfg?) -> SAN | null        (синхронно, для задач/подсказок/уроков)
     chooseAiMoveAsync(game, cfg) -> Promise<SAN | null>            (воркер; для партий против бота)
     findMate, hintMove, mirrorFen, evaluateBoard — как раньше.   */

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE_SCORE = 100000;

/* ================= движок (самодостаточная функция — её же берёт Web Worker) ================= */
/* ENGINE: self-contained (no outer references) so it can be stringified into a Web Worker. */
/* ENGINE: self-contained (no outer references) so it can be stringified into a Web Worker. */
function createChessEngine() {
  "use strict";
  var INF = 1000000, MATE = 100000;
  // pieces: 1..6 = P N B R Q K (white), +8 black. empty = 0
  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var N_DIR = [-33, -31, -18, -14, 14, 18, 31, 33];
  var K_DIR = [-17, -16, -15, -1, 1, 15, 16, 17];
  var B_DIR = [-17, -15, 15, 17];
  var R_DIR = [-16, -1, 1, 16];

  // ---- piece-square tables (white view, index = rank8-first row*8+file) ----
  var PST = {
    1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  var KEG = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
  var PEG = [0,0,0,0,0,0,0,0, 80,80,80,80,80,80,80,80, 50,50,50,50,50,50,50,50, 30,30,30,30,30,30,30,30, 20,20,20,20,20,20,20,20, 10,10,10,10,10,10,10,10, 10,10,10,10,10,10,10,10, 0,0,0,0,0,0,0,0];

  // index helpers: sq (0x88, rank8 = row 0) -> 0..63 table index
  function tIdx(sq) { return (sq >> 4) * 8 + (sq & 7); }
  var IDX = new Int16Array(128);
  for (var s0 = 0; s0 < 128; s0++) IDX[s0] = (s0 & 0x88) ? 0 : tIdx(s0);

  // ---- zobrist ----
  var seed = 0x9e3779b9;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var ZLO = new Int32Array(16 * 128), ZHI = new Int32Array(16 * 128);
  var i0;
  for (i0 = 0; i0 < ZLO.length; i0++) { ZLO[i0] = rnd(); ZHI[i0] = rnd(); }
  var ZSIDE_LO = rnd(), ZSIDE_HI = rnd();
  var ZCAS_LO = new Int32Array(16), ZCAS_HI = new Int32Array(16);
  for (i0 = 0; i0 < 16; i0++) { ZCAS_LO[i0] = rnd(); ZCAS_HI[i0] = rnd(); }
  var ZEP_LO = new Int32Array(8), ZEP_HI = new Int32Array(8);
  for (i0 = 0; i0 < 8; i0++) { ZEP_LO[i0] = rnd(); ZEP_HI[i0] = rnd(); }

  // ---- position state ----
  var bd = new Int8Array(128);
  var side = 0;                 // 0 white, 1 black
  var castle = 0;               // 1 K, 2 Q, 4 k, 8 q
  var ep = -1;                  // en-passant target square or -1
  var half = 0;                 // halfmove clock
  var hlo = 0, hhi = 0;         // hash
  var ksq = [0, 0];
  var MAXPLY = 128, HIST = 1024;
  // undo stack
  var uCap = new Int8Array(HIST), uCas = new Int8Array(HIST), uEp = new Int16Array(HIST), uHalf = new Int16Array(HIST);
  var uLo = new Int32Array(HIST), uHi = new Int32Array(HIST), uMove = new Int32Array(HIST), uPiece = new Int8Array(HIST);
  var sp = 0;                   // stack pointer (also number of plies played since setup)
  var repLo = new Int32Array(HIST + 8), repHi = new Int32Array(HIST + 8);

  // move encoding: from | to<<7 | promo<<14 (piece type 2..5) | flags<<17
  var F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DBL = 8;
  function mk(from, to, promo, flags) { return from | (to << 7) | (promo << 14) | (flags << 17); }
  function mFrom(m) { return m & 127; }
  function mTo(m) { return (m >> 7) & 127; }
  function mPromo(m) { return (m >> 14) & 7; }
  function mFlags(m) { return (m >> 17) & 15; }

  var CASMASK = new Int8Array(128).fill(15);
  CASMASK[0x74] = 15 & ~3;  // e1 (white king) -> sq index: rank1 = row 7 => 7*16+4 = 116 = 0x74
  CASMASK[0x77] = 15 & ~1;  // h1
  CASMASK[0x70] = 15 & ~2;  // a1
  CASMASK[0x04] = 15 & ~12; // e8
  CASMASK[0x07] = 15 & ~4;  // h8
  CASMASK[0x00] = 15 & ~8;  // a8

  function sqName(sq) { return "abcdefgh"[sq & 7] + (8 - (sq >> 4)); }
  function nameSq(s) { return (8 - (s.charCodeAt(1) - 48)) * 16 + (s.charCodeAt(0) - 97); }

  var CH2P = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6 };
  function setFen(fen) {
    var f = fen.split(" "), r, c, i, ch;
    bd.fill(0); hlo = 0; hhi = 0;
    var rows = f[0].split("/");
    for (r = 0; r < 8; r++) {
      c = 0;
      for (i = 0; i < rows[r].length; i++) {
        ch = rows[r][i];
        if (ch >= "1" && ch <= "8") c += +ch;
        else {
          var up = ch.toUpperCase(), pc = CH2P[up] + (ch === up ? 0 : 8), sq = r * 16 + c;
          bd[sq] = pc; if ((pc & 7) === K) ksq[pc >> 3] = sq;
          hlo ^= ZLO[pc * 128 + sq]; hhi ^= ZHI[pc * 128 + sq];
          c++;
        }
      }
    }
    side = f[1] === "b" ? 1 : 0;
    castle = 0;
    var cs = f[2] || "-";
    if (cs.indexOf("K") >= 0) castle |= 1; if (cs.indexOf("Q") >= 0) castle |= 2;
    if (cs.indexOf("k") >= 0) castle |= 4; if (cs.indexOf("q") >= 0) castle |= 8;
    ep = (f[3] && f[3] !== "-") ? nameSq(f[3]) : -1;
    half = parseInt(f[4], 10) || 0;
    if (side) { hlo ^= ZSIDE_LO; hhi ^= ZSIDE_HI; }
    hlo ^= ZCAS_LO[castle]; hhi ^= ZCAS_HI[castle];
    if (ep >= 0) { hlo ^= ZEP_LO[ep & 7]; hhi ^= ZEP_HI[ep & 7]; }
    sp = 0; repLo[0] = hlo; repHi[0] = hhi;
  }

  function attacked(sq, by) {
    // is square sq attacked by color `by`?
    var cb = by << 3, i, to, p, d;
    // pawns
    if (by === 0) {
      to = sq + 15; if (!(to & 0x88) && bd[to] === P) return true;
      to = sq + 17; if (!(to & 0x88) && bd[to] === P) return true;
    } else {
      to = sq - 15; if (!(to & 0x88) && bd[to] === (P | 8)) return true;
      to = sq - 17; if (!(to & 0x88) && bd[to] === (P | 8)) return true;
    }
    for (i = 0; i < 8; i++) { to = sq + N_DIR[i]; if (!(to & 0x88) && bd[to] === (N | cb)) return true; }
    for (i = 0; i < 8; i++) { to = sq + K_DIR[i]; if (!(to & 0x88) && bd[to] === (K | cb)) return true; }
    for (i = 0; i < 4; i++) {
      d = B_DIR[i]; to = sq + d;
      while (!(to & 0x88)) { p = bd[to]; if (p) { if (p === (B | cb) || p === (Q | cb)) return true; break; } to += d; }
    }
    for (i = 0; i < 4; i++) {
      d = R_DIR[i]; to = sq + d;
      while (!(to & 0x88)) { p = bd[to]; if (p) { if (p === (R | cb) || p === (Q | cb)) return true; break; } to += d; }
    }
    return false;
  }
  function inCheck(c) { return attacked(ksq[c], c ^ 1); }

  // ---- move generation (pseudo-legal) into array `out`, returns count ----
  function gen(out, off, capsOnly) {
    var n = off, sq, p, t, i, to, d, tp, c = side, cb = c << 3, opp = c ^ 1;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq];
      if (!p || (p >> 3) !== c) continue;
      t = p & 7;
      if (t === P) {
        var fw = c === 0 ? -16 : 16, startRow = c === 0 ? 6 : 1, promoRow = c === 0 ? 1 : 6, row = sq >> 4;
        to = sq + fw;
        if (!(to & 0x88) && bd[to] === 0) {
          if (row === promoRow) {
            out[n++] = mk(sq, to, Q, 0);
            if (!capsOnly) { out[n++] = mk(sq, to, N, 0); out[n++] = mk(sq, to, R, 0); out[n++] = mk(sq, to, B, 0); }
          } else if (!capsOnly) {
            out[n++] = mk(sq, to, 0, 0);
            if (row === startRow && bd[to + fw] === 0) out[n++] = mk(sq, to + fw, 0, F_DBL);
          }
        }
        for (i = -1; i <= 1; i += 2) {
          to = sq + fw + i;
          if (to & 0x88) continue;
          tp = bd[to];
          if (tp && (tp >> 3) === opp) {
            if (row === promoRow) {
              out[n++] = mk(sq, to, Q, F_CAP);
              if (!capsOnly) { out[n++] = mk(sq, to, N, F_CAP); out[n++] = mk(sq, to, R, F_CAP); out[n++] = mk(sq, to, B, F_CAP); }
            } else out[n++] = mk(sq, to, 0, F_CAP);
          } else if (to === ep && !tp) out[n++] = mk(sq, to, 0, F_CAP | F_EP);
        }
      } else if (t === N || t === K) {
        var dirs = t === N ? N_DIR : K_DIR;
        for (i = 0; i < 8; i++) {
          to = sq + dirs[i];
          if (to & 0x88) continue;
          tp = bd[to];
          if (!tp) { if (!capsOnly) out[n++] = mk(sq, to, 0, 0); }
          else if ((tp >> 3) === opp) out[n++] = mk(sq, to, 0, F_CAP);
        }
        if (t === K && !capsOnly) {
          if (c === 0 && sq === 0x74) {
            if ((castle & 1) && !bd[0x75] && !bd[0x76] && bd[0x77] === (R) && !attacked(0x74, 1) && !attacked(0x75, 1) && !attacked(0x76, 1)) out[n++] = mk(sq, 0x76, 0, F_CASTLE);
            if ((castle & 2) && !bd[0x73] && !bd[0x72] && !bd[0x71] && bd[0x70] === (R) && !attacked(0x74, 1) && !attacked(0x73, 1) && !attacked(0x72, 1)) out[n++] = mk(sq, 0x72, 0, F_CASTLE);
          } else if (c === 1 && sq === 0x04) {
            if ((castle & 4) && !bd[0x05] && !bd[0x06] && bd[0x07] === (R | 8) && !attacked(0x04, 0) && !attacked(0x05, 0) && !attacked(0x06, 0)) out[n++] = mk(sq, 0x06, 0, F_CASTLE);
            if ((castle & 8) && !bd[0x03] && !bd[0x02] && !bd[0x01] && bd[0x00] === (R | 8) && !attacked(0x04, 0) && !attacked(0x03, 0) && !attacked(0x02, 0)) out[n++] = mk(sq, 0x02, 0, F_CASTLE);
          }
        }
      } else {
        var sd = t === B ? B_DIR : t === R ? R_DIR : K_DIR, ns = t === Q ? 8 : 4;
        var arr = t === Q ? K_DIR : sd;
        for (i = 0; i < ns; i++) {
          d = arr[i]; to = sq + d;
          while (!(to & 0x88)) {
            tp = bd[to];
            if (!tp) { if (!capsOnly) out[n++] = mk(sq, to, 0, 0); }
            else { if ((tp >> 3) === opp) out[n++] = mk(sq, to, 0, F_CAP); break; }
            to += d;
          }
        }
      }
    }
    return n - off;
  }

  function makeMove(m) {
    var from = mFrom(m), to = mTo(m), pr = mPromo(m), fl = mFlags(m);
    var p = bd[from], cap = bd[to], c = side, capSq = to;
    uPiece[sp] = p; uCas[sp] = castle; uEp[sp] = ep; uHalf[sp] = half; uLo[sp] = hlo; uHi[sp] = hhi; uMove[sp] = m;
    if (fl & F_EP) { capSq = c === 0 ? to + 16 : to - 16; cap = bd[capSq]; bd[capSq] = 0; hlo ^= ZLO[cap * 128 + capSq]; hhi ^= ZHI[cap * 128 + capSq]; }
    else if (cap) { hlo ^= ZLO[cap * 128 + to]; hhi ^= ZHI[cap * 128 + to]; }
    uCap[sp] = cap;
    // remove ep / castle hash
    if (ep >= 0) { hlo ^= ZEP_LO[ep & 7]; hhi ^= ZEP_HI[ep & 7]; }
    hlo ^= ZCAS_LO[castle]; hhi ^= ZCAS_HI[castle];
    bd[from] = 0; hlo ^= ZLO[p * 128 + from]; hhi ^= ZHI[p * 128 + from];
    var np = pr ? (pr | (c << 3)) : p;
    bd[to] = np; hlo ^= ZLO[np * 128 + to]; hhi ^= ZHI[np * 128 + to];
    if ((p & 7) === K) ksq[c] = to;
    if (fl & F_CASTLE) {
      var rf, rt, rp = R | (c << 3);
      if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      bd[rf] = 0; bd[rt] = rp;
      hlo ^= ZLO[rp * 128 + rf] ^ ZLO[rp * 128 + rt]; hhi ^= ZHI[rp * 128 + rf] ^ ZHI[rp * 128 + rt];
    }
    castle &= CASMASK[from] & CASMASK[to];
    hlo ^= ZCAS_LO[castle]; hhi ^= ZCAS_HI[castle];
    ep = (fl & F_DBL) ? (c === 0 ? to + 16 : to - 16) : -1;
    if (ep >= 0) { hlo ^= ZEP_LO[ep & 7]; hhi ^= ZEP_HI[ep & 7]; }
    half = ((p & 7) === P || cap) ? 0 : half + 1;
    side ^= 1; hlo ^= ZSIDE_LO; hhi ^= ZSIDE_HI;
    sp++; repLo[sp] = hlo; repHi[sp] = hhi;
  }

  function unmakeMove() {
    sp--;
    var m = uMove[sp], from = mFrom(m), to = mTo(m), fl = mFlags(m), p = uPiece[sp], cap = uCap[sp];
    side ^= 1; var c = side;
    bd[from] = p;
    if (fl & F_EP) { bd[to] = 0; bd[c === 0 ? to + 16 : to - 16] = cap; }
    else bd[to] = cap;
    if ((p & 7) === K) ksq[c] = from;
    if (fl & F_CASTLE) {
      var rf, rt, rp = R | (c << 3);
      if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      bd[rt] = 0; bd[rf] = rp;
    }
    castle = uCas[sp]; ep = uEp[sp]; half = uHalf[sp]; hlo = uLo[sp]; hhi = uHi[sp];
  }

  // null move
  var nullEp = new Int16Array(MAXPLY * 2), nullLo = new Int32Array(MAXPLY * 2), nullHi = new Int32Array(MAXPLY * 2), nullHalf = new Int16Array(MAXPLY * 2), nd = 0;
  function makeNull() {
    nullEp[nd] = ep; nullLo[nd] = hlo; nullHi[nd] = hhi; nullHalf[nd] = half; nd++;
    if (ep >= 0) { hlo ^= ZEP_LO[ep & 7]; hhi ^= ZEP_HI[ep & 7]; }
    ep = -1; side ^= 1; hlo ^= ZSIDE_LO; hhi ^= ZSIDE_HI; half++;
    sp++; uMove[sp - 1] = 0; repLo[sp] = hlo; repHi[sp] = hhi;
  }
  function unmakeNull() { sp--; nd--; side ^= 1; ep = nullEp[nd]; hlo = nullLo[nd]; hhi = nullHi[nd]; half = nullHalf[nd]; }

  // ---- perft (for testing) ----
  var pfBuf = new Int32Array(256 * 16);
  function perft(depth, ply) {
    if (depth === 0) return 1;
    var off = ply * 256, cnt = gen(pfBuf, off, false), total = 0, i;
    for (i = 0; i < cnt; i++) {
      makeMove(pfBuf[off + i]);
      if (!inCheck(side ^ 1)) total += perft(depth - 1, ply + 1);
      unmakeMove();
    }
    return total;
  }

  // ---- evaluation ----
  var STYLE = { mob: 1, king: 1, pawn: 1, aggr: 0, trade: 0 };
  var pawnsW = new Int8Array(8), pawnsB = new Int8Array(8);
  var wMinPawnRow = new Int8Array(8), bMaxPawnRow = new Int8Array(8);
  function evaluate() {
    var mgS = 0, egS = 0, phase = 0, sq, p, t, c, v, idx, i, to, ti;
    var wb = 0, bb = 0, wk = ksq[0], bk = ksq[1];
    pawnsW.fill(0); pawnsB.fill(0); wMinPawnRow.fill(8); bMaxPawnRow.fill(-1);
    var mobW = 0, mobB = 0, matW = 0, matB = 0, aggr = 0;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq]; if (!p) continue;
      t = p & 7; c = p >> 3; idx = IDX[sq];
      var pi = c === 0 ? idx : (idx ^ 56);
      v = VAL[t];
      if (t === K) {
        mgS += (c === 0 ? 1 : -1) * PST[6][pi];
        egS += (c === 0 ? 1 : -1) * KEG[pi];
        continue;
      }
      if (t === P) {
        var pm = PST[1][pi], pe = PEG[pi];
        if (c === 0) { mgS += v + pm; egS += v + pe; matW += v; pawnsW[sq & 7]++; var rr = sq >> 4; if (rr < wMinPawnRow[sq & 7]) wMinPawnRow[sq & 7] = rr; }
        else { mgS -= v + pm; egS -= v + pe; matB += v; pawnsB[sq & 7]++; var rb = sq >> 4; if (rb > bMaxPawnRow[sq & 7]) bMaxPawnRow[sq & 7] = rb; }
        continue;
      }
      var pt = PST[t][pi];
      if (c === 0) { mgS += v + pt; egS += v + pt; matW += v; } else { mgS -= v + pt; egS -= v + pt; matB += v; }
      phase += (t === N || t === B) ? 1 : t === R ? 2 : 4;
      if (t === B) { if (c === 0) wb++; else bb++; }
      // mobility (cheap)
      var mob = 0;
      if (t === N) { for (i = 0; i < 8; i++) { to = sq + N_DIR[i]; if (!(to & 0x88)) { ti = bd[to]; if (!ti || (ti >> 3) !== c) mob++; } } mob = (mob - 4) * 4; }
      else if (t === B || t === R || t === Q) {
        var dd = t === B ? B_DIR : t === R ? R_DIR : K_DIR, nn = t === Q ? 8 : 4, dx, tt;
        for (i = 0; i < nn; i++) {
          dx = dd[i]; to = sq + dx;
          while (!(to & 0x88)) { tt = bd[to]; if (!tt) mob++; else { if ((tt >> 3) !== c) mob++; break; } to += dx; }
        }
        mob = t === B ? (mob - 6) * 3 : t === R ? (mob - 7) * 2 : (mob - 13) * 1;
      }
      if (c === 0) mobW += mob; else mobB += mob;
      // aggression: closeness to enemy king
      if (STYLE.aggr) {
        var ek = c === 0 ? bk : wk, dist = Math.max(Math.abs((sq >> 4) - (ek >> 4)), Math.abs((sq & 7) - (ek & 7)));
        var a = (7 - dist) * (t === Q ? 3 : 2); if (c === 0) aggr += a; else aggr -= a;
      }
    }
    // bishop pair
    if (wb >= 2) { mgS += 30; egS += 45; }
    if (bb >= 2) { mgS -= 30; egS -= 45; }
    // pawn structure + passed pawns + rook files
    var f, sc = 0, scE = 0;
    for (f = 0; f < 8; f++) {
      if (pawnsW[f] > 1) { sc -= 12 * (pawnsW[f] - 1); scE -= 18 * (pawnsW[f] - 1); }
      if (pawnsB[f] > 1) { sc += 12 * (pawnsB[f] - 1); scE += 18 * (pawnsB[f] - 1); }
      if (pawnsW[f] && !(f > 0 && pawnsW[f - 1]) && !(f < 7 && pawnsW[f + 1])) { sc -= 12; scE -= 14; }
      if (pawnsB[f] && !(f > 0 && pawnsB[f - 1]) && !(f < 7 && pawnsB[f + 1])) { sc += 12; scE += 14; }
    }
    // passed pawns: scan pawns again
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq];
      if (p === P) {
        var wf = sq & 7, wr = sq >> 4, passed = true, ff;
        for (ff = Math.max(0, wf - 1); ff <= Math.min(7, wf + 1) && passed; ff++) if (bMaxPawnRow[ff] >= 0 && bMaxPawnRow[ff] < wr) passed = false;
        if (passed) { var adv = 6 - wr; sc += 6 + adv * adv * 2; scE += 12 + adv * adv * 5; }
      } else if (p === (P | 8)) {
        var bf = sq & 7, brr = sq >> 4, passedB = true, fb;
        for (fb = Math.max(0, bf - 1); fb <= Math.min(7, bf + 1) && passedB; fb++) if (wMinPawnRow[fb] < 8 && wMinPawnRow[fb] > brr) passedB = false;
        if (passedB) { var advB = brr - 1; sc -= 6 + advB * advB * 2; scE -= 12 + advB * advB * 5; }
      } else if (p === R || p === (R | 8)) {
        var rf0 = sq & 7;
        if (p === R) { if (!pawnsW[rf0]) { sc += pawnsB[rf0] ? 8 : 16; } }
        else { if (!pawnsB[rf0]) { sc -= pawnsW[rf0] ? 8 : 16; } }
      }
    }
    mgS += sc * STYLE.pawn; egS += scE * STYLE.pawn;
    // king safety (middlegame): pawn shield
    var ks = 0, kf, kr, ff2;
    kf = wk & 7; kr = wk >> 4;
    if (kr >= 6) for (ff2 = Math.max(0, kf - 1); ff2 <= Math.min(7, kf + 1); ff2++) { if (bd[(kr - 1) * 16 + ff2] === P) ks += 10; else if (kr === 7 && bd[(kr - 2) * 16 + ff2] === P) ks += 5; else ks -= 8; }
    kf = bk & 7; kr = bk >> 4;
    if (kr <= 1) for (ff2 = Math.max(0, kf - 1); ff2 <= Math.min(7, kf + 1); ff2++) { if (bd[(kr + 1) * 16 + ff2] === (P | 8)) ks -= 10; else if (kr === 0 && bd[(kr + 2) * 16 + ff2] === (P | 8)) ks -= 5; else ks += 8; }
    mgS += ks * STYLE.king;
    mgS += (mobW - mobB) * STYLE.mob; egS += (mobW - mobB) * STYLE.mob * 0.5;
    mgS += aggr * STYLE.aggr * 1.5;
    // trade preference: ahead => trade, style.trade>0 favours simplification when ahead
    var ph = Math.min(24, phase), score = (mgS * ph + egS * (24 - ph)) / 24;
    // endgame: drive enemy king to the edge when we have clear material edge
    var diff = matW - matB;
    if (ph < 10 && Math.abs(diff) >= 300) {
      var win = diff > 0 ? 0 : 1, lose = win ^ 1, lk = ksq[lose], wkk = ksq[win];
      var lr = lk >> 4, lf = lk & 7, cd = Math.max(3 - lr, lr - 4) + Math.max(3 - lf, lf - 4);
      var kd = Math.abs((lk >> 4) - (wkk >> 4)) + Math.abs((lk & 7) - (wkk & 7));
      var bonus = cd * 10 + (14 - kd) * 4;
      score += win === 0 ? bonus : -bonus;
    }
    if (STYLE.trade && Math.abs(diff) >= 200) { var tb = (7800 - (matW + matB)) * 0.01 * STYLE.trade; score += diff > 0 ? tb : -tb; }
    return Math.round(side === 0 ? score : -score) + 8;
  }

  // draw detection
  function isRepetition(ply) {
    var lim = Math.min(sp, half), j, cnt = 0;
    for (j = 4; j <= lim; j += 2) {
      var k = sp - j;
      if (k < 0) break;
      if (repLo[k] === hlo && repHi[k] === hhi) { if (++cnt >= (ply > 0 ? 1 : 2)) return true; }
    }
    return false;
  }
  function insufficient() {
    var sq, p, minors = 0, other = 0;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq]; if (!p) continue;
      var t = p & 7;
      if (t === K) continue;
      if (t === N || t === B) minors++; else other++;
    }
    return other === 0 && minors <= 1;
  }

  // ---- TT ----
  var TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var ttHi = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE);
  function ttClear() { ttHi.fill(0); ttDepth.fill(-1); ttFlag.fill(0); }
  ttClear();

  // ---- search state ----
  var moveBuf = new Int32Array(MAXPLY * 256), scoreBuf = new Int32Array(MAXPLY * 256);
  var killers = new Int32Array(MAXPLY * 2), history = new Int32Array(2 * 128 * 128);
  var nodes = 0, stop = false, tLimit = 0, startT = 0, rootBest = 0, useQ = true;
  var MV = [0, 1, 2, 3, 4, 5, 6];

  function scoreMoves(off, cnt, ttm, ply) {
    var i, m, s, vic, att;
    for (i = 0; i < cnt; i++) {
      m = moveBuf[off + i];
      if (m === ttm) { s = 1000000; }
      else if (mFlags(m) & F_CAP) {
        vic = (mFlags(m) & F_EP) ? P : (bd[mTo(m)] & 7); att = bd[mFrom(m)] & 7;
        s = 100000 + MV[vic] * 100 - MV[att] + (mPromo(m) ? 50 : 0);
      } else if (mPromo(m)) s = 90000 + mPromo(m);
      else if (m === killers[ply * 2]) s = 80000;
      else if (m === killers[ply * 2 + 1]) s = 79000;
      else s = history[side * 16384 + mFrom(m) * 128 + mTo(m)];
      scoreBuf[off + i] = s;
    }
  }
  function pick(off, cnt, i) {
    var best = i, j, bs = scoreBuf[off + i], t;
    for (j = i + 1; j < cnt; j++) if (scoreBuf[off + j] > bs) { bs = scoreBuf[off + j]; best = j; }
    if (best !== i) {
      t = moveBuf[off + i]; moveBuf[off + i] = moveBuf[off + best]; moveBuf[off + best] = t;
      t = scoreBuf[off + i]; scoreBuf[off + i] = scoreBuf[off + best]; scoreBuf[off + best] = t;
    }
    return moveBuf[off + i];
  }

  function qsearch(alpha, beta, ply) {
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > tLimit) stop = true;
    if (stop) return 0;
    var inChk = inCheck(side), stand;
    if (!inChk) {
      stand = evaluate();
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (ply >= MAXPLY - 2) return stand;
    } else { stand = -MATE + ply; if (ply >= MAXPLY - 2) return evaluate(); }
    var off = ply * 256, cnt = gen(moveBuf, off, !inChk), i, m, sc, legal = 0;
    scoreMoves(off, cnt, 0, ply);
    for (i = 0; i < cnt; i++) {
      m = pick(off, cnt, i);
      if (!inChk && (mFlags(m) & F_CAP) && !mPromo(m)) {
        // delta pruning
        var vic = (mFlags(m) & F_EP) ? P : (bd[mTo(m)] & 7);
        if (stand + VAL[vic] + 200 < alpha) continue;
      }
      makeMove(m);
      if (inCheck(side ^ 1)) { unmakeMove(); continue; }
      legal++;
      sc = -qsearch(-beta, -alpha, ply + 1);
      unmakeMove();
      if (stop) return 0;
      if (sc > stand || inChk) { if (sc > stand) stand = sc; }
      if (sc > alpha) { alpha = sc; if (alpha >= beta) return alpha; }
    }
    if (inChk && legal === 0) return -MATE + ply;
    return alpha > stand ? alpha : stand;
  }

  function search(depth, alpha, beta, ply, nullOk) {
    if (stop) return 0;
    var pv = beta - alpha > 1;
    if (ply > 0) {
      if (half >= 100 || insufficient() || isRepetition(ply)) return 0;
      // mate distance pruning
      var ma = -MATE + ply; if (ma > alpha) { alpha = ma; if (alpha >= beta) return alpha; }
      var mb = MATE - ply - 1; if (mb < beta) { beta = mb; if (alpha >= beta) return beta; }
    }
    var inChk = inCheck(side);
    if (inChk) depth++;
    if (depth <= 0) { return useQ ? qsearch(alpha, beta, ply) : evaluate(); }
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > tLimit) { stop = true; return 0; }
    if (ply >= MAXPLY - 2) return evaluate();

    var ti = hlo & TT_MASK, ttm = 0;
    if (ttHi[ti] === hhi && ttDepth[ti] >= 0) {
      ttm = ttMove[ti];
      if (ply > 0 && ttDepth[ti] >= depth && !pv) {
        var ts = ttScore[ti];
        if (ts > MATE - 200) ts -= ply; else if (ts < -MATE + 200) ts += ply;
        var fl = ttFlag[ti];
        if (fl === 1) return ts;
        if (fl === 2 && ts >= beta) return ts;
        if (fl === 3 && ts <= alpha) return ts;
      }
    }
    var staticEval = 0;
    if (!inChk && !pv) {
      staticEval = evaluate();
      // reverse futility
      if (depth <= 3 && staticEval - 120 * depth >= beta && Math.abs(beta) < MATE - 500) return staticEval - 120 * depth;
      // null move
      if (nullOk && depth >= 3 && staticEval >= beta) {
        var hasPieces = false, sq0, pp;
        for (sq0 = 0; sq0 < 128; sq0++) { if (sq0 & 0x88) { sq0 += 7; continue; } pp = bd[sq0]; if (pp && (pp >> 3) === side && (pp & 7) !== P && (pp & 7) !== K) { hasPieces = true; break; } }
        if (hasPieces) {
          makeNull();
          var ns = -search(depth - 1 - (depth > 5 ? 3 : 2), -beta, -beta + 1, ply + 1, false);
          unmakeNull();
          if (stop) return 0;
          if (ns >= beta) return ns >= MATE - 500 ? beta : ns;
        }
      }
    }
    var off = ply * 256, cnt = gen(moveBuf, off, false), i, m, sc, legal = 0, best = -INF, bestMove = 0, origAlpha = alpha;
    scoreMoves(off, cnt, ttm, ply);
    for (i = 0; i < cnt; i++) {
      m = pick(off, cnt, i);
      var isCap = (mFlags(m) & F_CAP) !== 0, isPromo = mPromo(m) !== 0;
      makeMove(m);
      if (inCheck(side ^ 1)) { unmakeMove(); continue; }
      legal++;
      var givesChk = inCheck(side);
      if (legal === 1) sc = -search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        var red = 0;
        if (depth >= 3 && legal > 4 && !isCap && !isPromo && !inChk && !givesChk) red = legal > 10 ? 2 : 1;
        sc = -search(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && red) sc = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && sc < beta) sc = -search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      unmakeMove();
      if (stop) return 0;
      if (sc > best) {
        best = sc; bestMove = m;
        if (sc > alpha) {
          alpha = sc;
          if (ply === 0) rootBest = m;
          if (alpha >= beta) {
            if (!isCap) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              var hi = side * 16384 + mFrom(m) * 128 + mTo(m);
              history[hi] += depth * depth; if (history[hi] > 60000) { for (var h = 0; h < history.length; h++) history[h] >>= 1; }
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inChk ? -MATE + ply : 0;
    // store
    var store = best;
    if (store > MATE - 200) store += ply; else if (store < -MATE + 200) store -= ply;
    if (ttDepth[ti] <= depth || ttHi[ti] !== hhi) {
      ttHi[ti] = hhi; ttMove[ti] = bestMove; ttScore[ti] = store; ttDepth[ti] = Math.min(depth, 100);
      ttFlag[ti] = best >= beta ? 2 : best > origAlpha ? 1 : 3;
    }
    return best;
  }

  // ---- root helpers ----
  function legalRoot() {
    var cnt = gen(moveBuf, 0, false), out = [], i, m;
    for (i = 0; i < cnt; i++) {
      m = moveBuf[i];
      makeMove(m);
      if (!inCheck(side ^ 1)) out.push(m);
      unmakeMove();
    }
    return out;
  }
  function moveToObj(m) {
    var o = { from: sqName(mFrom(m)), to: sqName(mTo(m)) };
    var pr = mPromo(m); if (pr) o.promotion = "  nbrq"[pr] === " " ? "q" : "nbrq"[pr - 2];
    return o;
  }

  // history = array of {from,to,promotion} replayed from startFen to build repetition info
  function setup(startFen, hist) {
    setFen(startFen);
    if (hist && hist.length) {
      var lm = legalRoot(), j, k, h;
      for (j = 0; j < hist.length; j++) {
        h = hist[j]; lm = legalRoot();
        for (k = 0; k < lm.length; k++) {
          var mv = lm[k];
          if (sqName(mFrom(mv)) === h.from && sqName(mTo(mv)) === h.to) {
            var pr = mPromo(mv), want = h.promotion ? "  nbrq".indexOf(h.promotion) : 0;
            if (pr && want >= 2 && (pr !== want)) continue;
            if (pr && !h.promotion && pr !== Q) continue;
            makeMove(mv); break;
          }
        }
      }
    }
  }

  /* cfg: {depth, timeMs, noise, quiesce, style, blunder, topPick, book} */
  function think(startFen, hist, cfg) {
    cfg = cfg || {};
    setup(startFen, hist);
    // reset per-search heuristics
    killers.fill(0); history.fill(0); nodes = 0; stop = false;
    STYLE = { mob: 1, king: 1, pawn: 1, aggr: 0, trade: 0 };
    if (cfg.style) for (var sk in cfg.style) STYLE[sk] = cfg.style[sk];
    useQ = cfg.quiesce !== false;
    var roots = legalRoot();
    if (!roots.length) return { move: null, mate: inCheck(side), score: 0, depth: 0, nodes: 0 };
    if (roots.length === 1) return { move: moveToObj(roots[0]), score: 0, depth: 0, nodes: 0 };
    var maxDepth = Math.max(1, cfg.depth || 3), timeMs = cfg.timeMs || 1000;
    startT = Date.now(); tLimit = startT + timeMs;
    var noise = cfg.noise || 0, i, m, sc, ranked = [];

    if (noise > 0 || cfg.multi) {
      // evaluate each root move with a full window at depth-1 (human-like imperfection)
      var d = Math.max(0, maxDepth - 1);
      tLimit = startT + timeMs * 4; // let weak levels finish their shallow sweep
      for (i = 0; i < roots.length; i++) {
        m = roots[i];
        makeMove(m);
        sc = -search(d, -INF, INF, 1, true);
        unmakeMove();
        if (stop) { sc = 0; }
        ranked.push({ m: m, s: sc + (noise ? (Math.random() * 2 - 1) * noise : 0), raw: sc });
      }
      ranked.sort(function (a, b) { return b.s - a.s; });
      var chosen = ranked[0];
      if (cfg.blunder && Math.random() < cfg.blunder) {
        var span = Math.min(ranked.length, cfg.topPick || 4);
        chosen = ranked[Math.floor(Math.random() * span)];
      }
      return { move: moveToObj(chosen.m), score: chosen.raw, depth: d + 1, nodes: nodes };
    }

    // strong mode: iterative deepening
    var bestMove = roots[0], bestScore = 0, dd, alpha, beta, delta, s2;
    rootBest = roots[0];
    for (dd = 1; dd <= maxDepth; dd++) {
      if (dd >= 4 && bestScore > -MATE + 300 && bestScore < MATE - 300) {
        delta = 40; alpha = bestScore - delta; beta = bestScore + delta;
        while (true) {
          s2 = search(dd, alpha, beta, 0, true);
          if (stop) break;
          if (s2 <= alpha) { alpha -= delta * 3; delta *= 3; if (alpha < -INF) alpha = -INF; }
          else if (s2 >= beta) { beta += delta * 3; delta *= 3; if (beta > INF) beta = INF; }
          else break;
        }
      } else s2 = search(dd, -INF, INF, 0, true);
      if (stop) break;
      bestScore = s2; bestMove = rootBest;
      if (Math.abs(bestScore) > MATE - 200 && dd >= 2) break;       // forced mate found
      if (Date.now() - startT > timeMs * 0.55 && dd >= 4) break;    // don't start a deeper iteration late
    }
    return { move: moveToObj(bestMove), score: bestScore, depth: dd, nodes: nodes };
  }

  function status(startFen, hist) {
    setup(startFen, hist);
    var r = legalRoot();
    if (!r.length) return inCheck(side) ? "mate" : "stalemate";
    if (half >= 100) return "fifty";
    if (insufficient()) return "material";
    var j, cnt = 0, lim = Math.min(sp, half);
    for (j = 4; j <= lim; j += 2) { var k = sp - j; if (k < 0) break; if (repLo[k] === hlo && repHi[k] === hhi) cnt++; }
    if (cnt >= 2) return "repeat";
    return "";
  }
  function toFen() {
    var rows = [], r, f, e, sq, p, row;
    var CH = ".PNBRQK";
    for (r = 0; r < 8; r++) {
      row = ""; e = 0;
      for (f = 0; f < 8; f++) {
        p = bd[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { row += e; e = 0; }
        var chr = CH[p & 7]; row += (p >> 3) ? chr.toLowerCase() : chr;
      }
      if (e) row += e;
      rows.push(row);
    }
    var cs = ((castle & 1) ? "K" : "") + ((castle & 2) ? "Q" : "") + ((castle & 4) ? "k" : "") + ((castle & 8) ? "q" : "");
    return rows.join("/") + " " + (side ? "b" : "w") + " " + (cs || "-") + " " + (ep >= 0 ? sqName(ep) : "-") + " " + half + " " + (1 + (sp >> 1));
  }
  /* проверка расстановки: короли на месте, ходящий не может «съесть» короля, есть ходы */
  function valid(fen) {
    setFen(fen);
    var wk = 0, bk = 0, sq;
    for (sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } if (bd[sq] === K) wk++; else if (bd[sq] === (K | 8)) bk++; }
    if (wk !== 1 || bk !== 1) return "kings";
    if (inCheck(side ^ 1)) return "opp-in-check";
    if (!legalRoot().length) return "no-moves";
    return "";
  }
  /* сыграть список ходов вида e2e4 (e7e8q) от fen; вернуть сколько применено и итоговый fen */
  function playUci(fen, list) {
    setFen(fen);
    var applied = 0, j, k, lm, mv, u;
    for (j = 0; j < list.length; j++) {
      u = list[j]; lm = legalRoot(); mv = 0;
      for (k = 0; k < lm.length; k++) {
        var x = lm[k];
        if (sqName(mFrom(x)) + sqName(mTo(x)) === u.slice(0, 4)) {
          var pr = mPromo(x);
          if (pr && u[4] && "  nbrq".indexOf(u[4]) !== pr) continue;
          if (pr && !u[4] && pr !== Q) continue;
          mv = x; break;
        }
      }
      if (!mv) break;
      makeMove(mv); applied++;
    }
    return { n: applied, fen: toFen() };
  }
  return { toFen: toFen, valid: valid, playUci: playUci, status: status, think: think, perft: function (fen, d) { setFen(fen); return perft(d, 0); }, setFen: setFen, evalFen: function (fen) { setFen(fen); return evaluate(); }, ttClear: ttClear };
}

/* ================= обёртка над движком ================= */
const _AI = {
  sync: null, worker: null, workerOk: true, seq: 0, pending: new Map(), bookCache: null
};

function _aiSync() { return _AI.sync || (_AI.sync = createChessEngine()); }

/* стартовая позиция и история ходов партии (для повторений) */
function _aiHistory(game, startFen) {
  // без известной стартовой позиции (задачи, подсказки, уроки) берём текущую — без истории повторений
  if (!startFen) return { startFen: game.fen(), hist: [] };
  const verbose = game.history({ verbose: true }) || [];
  return { startFen, hist: verbose.map(m => ({ from: m.from, to: m.to, promotion: m.promotion })) };
}

/* ---------- дебютная книга (SAN; невалидный хвост линии просто отбрасывается) ---------- */
const _BOOK_LINES = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O",
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nc3 Bb4 Nxc6 bxc6 Bd3 d5",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7",
  "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6 f3",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6 Qd2 Nf6 O-O-O Bb4",
  "e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be2 Nc6 O-O Be7",
  "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 dxc5 Nc6",
  "e4 e6 d4 d5 Nd2 c5 exd5 exd5 Ngf3 Nc6 Bb5 Bd6 dxc5 Bxc5 O-O Nge7",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6",
  "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6",
  "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O Bg4 Be3 Nc6",
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O Nbd7 Qe2 Bg6",
  "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 Bb3 Nc6 Nc3 b5",
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5",
  "d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O Nc3 Ne4 Qc2 Nxc3 Qxc3 c5",
  "d4 Nf6 Nf3 e6 Bf4 c5 e3 Qb6 Nbd2 cxd4 exd4 Nc6 c3 Be7",
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O Nbd2 c5 e4 Nc6 Re1 b5",
  "Nf3 Nf6 c4 g6 Nc3 Bg7 e4 O-O d4 d6 Be2 e5 O-O Nc6 d5 Ne7",
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3 O-O",
  "c4 c5 Nf3 Nf6 Nc3 Nc6 g3 g6 Bg2 Bg7 O-O O-O d3 d6 a3 Rb8",
  "c4 Nf6 Nc3 e6 e4 d5 e5 d4 exf6 dxc3 bxc3 Qxf6 Nf3 Nc6 Bd3 Qxc3",
  "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8 Kxd8 Nc3 Ke8"
];

function _aiBook() {
  if (_AI.bookCache) return _AI.bookCache;
  const lines = [];
  try {
    _BOOK_LINES.forEach(txt => {
      const g = new Chess(), moves = [];
      for (const san of txt.split(" ")) {
        const m = g.move(san);
        if (!m) break;
        moves.push(m.from + m.to + (m.promotion || ""));
      }
      if (moves.length) lines.push(moves);
    });
  } catch (e) {}
  return (_AI.bookCache = lines);
}

/* ход из книги: вся история партии (с обычной стартовой позиции) должна совпасть с началом линии */
function _bookMove(game, startFen, maxPlies) {
  try {
    if (startFen && startFen.split(" ")[0] !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR") return null;
    const h = game.history({ verbose: true });
    if (h.length >= (maxPlies || 12)) return null;
    const played = h.map(m => m.from + m.to + (m.promotion || ""));
    const options = [];
    _aiBook().forEach(line => {
      if (line.length <= played.length) return;
      for (let i = 0; i < played.length; i++) if (line[i] !== played[i]) return;
      options.push(line[played.length]);
    });
    if (!options.length) return null;
    const uci = options[Math.floor(Math.random() * options.length)];
    const legal = game.moves({ verbose: true }).find(m => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4) && (m.promotion || "") === (uci[4] || ""));
    return legal ? legal.san : null;
  } catch (e) { return null; }
}

/* ---------- web worker (движок целиком передаётся строкой — внешних файлов не нужно) ---------- */
function _aiWorker() {
  if (_AI.worker || !_AI.workerOk) return _AI.worker;
  try {
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || !window.URL || !URL.createObjectURL) throw new Error("no worker");
    const src = "var E=(" + createChessEngine.toString() + ")();" +
      "onmessage=function(e){var d=e.data;var r=null;try{r=E.think(d.fen,d.hist,d.cfg)}catch(x){r={error:String(x)}}postMessage({id:d.id,res:r})};";
    const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
    const w = new Worker(url);
    w.onmessage = ev => {
      const p = _AI.pending.get(ev.data.id);
      if (!p) return;
      _AI.pending.delete(ev.data.id);
      clearTimeout(p.timer);
      p.resolve(ev.data.res);
    };
    w.onerror = () => { _AI.workerOk = false; try { w.terminate(); } catch (e) {} _AI.worker = null;
      _AI.pending.forEach(p => { clearTimeout(p.timer); p.resolve(undefined); }); _AI.pending.clear(); };
    _AI.worker = w;
  } catch (e) { _AI.workerOk = false; _AI.worker = null; }
  return _AI.worker;
}

function _aiAskWorker(payload, timeoutMs) {
  return new Promise(resolve => {
    const w = _aiWorker();
    if (!w) { resolve(undefined); return; }
    const id = ++_AI.seq;
    const timer = setTimeout(() => { _AI.pending.delete(id); resolve(undefined); }, timeoutMs);
    _AI.pending.set(id, { resolve, timer });
    try { w.postMessage({ id, fen: payload.fen, hist: payload.hist, cfg: payload.cfg }); }
    catch (e) { clearTimeout(timer); _AI.pending.delete(id); resolve(undefined); }
  });
}

/* res движка -> SAN через chess.js */
function _aiToSan(game, res) {
  if (!res || !res.move) return null;
  const m = res.move;
  const legal = game.moves({ verbose: true }).find(x => x.from === m.from && x.to === m.to && (!m.promotion || x.promotion === m.promotion));
  return legal ? legal.san : null;
}

/* Преобразование уровня -> настройки поиска.
   level.ai = { depth, ms, noise, blunder, top, quiesce, style:{mob,king,pawn,aggr,trade}, book } */
function _aiConfigFromLevel(level) {
  const a = (level && level.ai) || {};
  return {
    depth: a.depth || (level && level.depth) || 2,
    timeMs: a.ms || 400,
    noise: a.noise || 0,
    blunder: a.blunder != null ? a.blunder : (level && level.blunder) || 0,
    topPick: a.top || 4,
    quiesce: a.quiesce !== false,
    style: a.style || null,
    book: a.book || 0
  };
}

/* Асинхронный ход бота для партии. cfg — результат _aiConfigFromLevel (+startFen) */
async function chooseAiMoveAsync(game, cfg) {
  const legal = game.moves({ verbose: true });
  if (!legal.length) return null;
  if (cfg.book) { const b = _bookMove(game, cfg.startFen, cfg.book); if (b) return b; }
  const { startFen, hist } = _aiHistory(game, cfg.startFen);
  const payload = { fen: startFen, hist, cfg };
  let res = await _aiAskWorker(payload, Math.max(4000, cfg.timeMs * 6 + 2500));
  if (res === undefined || (res && res.error)) {
    try { res = _aiSync().think(startFen, hist, Object.assign({}, cfg, { timeMs: Math.min(cfg.timeMs, 700), depth: Math.min(cfg.depth, 5) })); }
    catch (e) { res = null; }
  }
  return _aiToSan(game, res) || legal[Math.floor(Math.random() * legal.length)].san;
}

/* Синхронный ход — для задач (оппонент защищается в полную силу), подсказок и уроков. */
function chooseAiMove(game, depth, blunder, cfg) {
  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return null;
  const c = Object.assign({ depth: Math.max(1, depth || 2), timeMs: 450, noise: 0, blunder: blunder || 0, topPick: 3 }, cfg || {});
  if (c.blunder > 0 && !c.noise) c.multi = true;   // ошибки возможны только при «человеческом» переборе корня
  try {
    const { startFen, hist } = _aiHistory(game, c.startFen);
    const san = _aiToSan(game, _aiSync().think(startFen, hist, c));
    if (san) return san;
  } catch (e) { /* падаем на запасной вариант */ }
  return legal[Math.floor(Math.random() * legal.length)].san;
}

/* Грубая оценка для старого кода (в сантипешках с позиции белых) */
function evaluateBoard(game) {
  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c];
    if (!sq) continue;
    score += sq.color === "w" ? PIECE_VALUE[sq.type] : -PIECE_VALUE[sq.type];
  }
  return score;
}

function orderMoves(moves) {
  const k = m => (/[+#]/.test(m.san) ? 2 : 0) + (m.captured ? 1 : 0);
  return moves.slice().sort((a, b) => k(b) - k(a));
}

/* ---- exhaustive "mate in n" solver (n = moves of the side to move) ---- */
function _mates(game, n) {
  for (const m of orderMoves(game.moves({ verbose: true }))) {
    if (n === 1 && !/[+#]/.test(m.san)) continue;      // last move must give check
    game.move(m.san);
    let ok = false;
    if (game.in_checkmate()) ok = true;
    else if (n > 1 && !game.game_over()) {
      ok = true;
      for (const r of game.moves()) {
        game.move(r);
        const good = _mates(game, n - 1);
        game.undo();
        if (!good) { ok = false; break; }
      }
    }
    game.undo();
    if (ok) return m.san;
  }
  return null;
}
function findMate(game, n) {
  for (let k = 1; k <= n; k++) { const s = _mates(game, k); if (s) return s; }
  return null;
}

/* Hint: forced mate if one exists, otherwise the engine's best move at full strength. */
function hintMove(game) {
  const fen = game.fen().split(" ")[0];
  const pieces = (fen.match(/[a-zA-Z]/g) || []).length;
  if (pieces <= 10) { const m = findMate(game, 2); if (m) return m; }
  else { const m = findMate(game, 1); if (m) return m; }
  return chooseAiMove(game, pieces <= 16 ? 6 : 5, 0, { timeMs: 900 });
}

/* Mirror a position (swap colours, flip board) so a "White to move" puzzle can be played as Black. */
function mirrorFen(fen) {
  const f = fen.split(" ");
  const rows = f[0].split("/").reverse().map(r => r.replace(/[a-zA-Z]/g, c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
  return `${rows.join("/")} ${f[1] === "w" ? "b" : "w"} - - 0 1`;
}