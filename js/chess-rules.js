/* maper.chess — страховка правил рокировки поверх chess.js.
   Подключать СРАЗУ после chess.min.js.
   Рокировка запрещена, если:
     • король сейчас под шахом;
     • поле, через которое проходит король, или поле, куда он встаёт, бьётся фигурой соперника;
     • между королём и ладьёй есть фигуры;
     • король или ладья не стоят на своих исходных полях (неверные права в FEN позиции уровня/задачи).
   Все места сайта, где создаётся new Chess(...), автоматически получают эту проверку. */
(function () {
  "use strict";
  if (typeof window.Chess !== "function" || window.Chess.__mcSafe) return;
  const Orig = window.Chess;

  /* убираем права на рокировку, если король/ладья не на своих полях */
  function fixFen(fen) {
    if (typeof fen !== "string") return fen;
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 3 || parts[2] === "-") return fen;
    const rows = parts[0].split("/");
    if (rows.length !== 8) return fen;
    const at = (file, rank) => {
      const row = rows[8 - rank]; let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += +ch; continue; }
        if (f === file) return ch;
        f++;
      }
      return null;
    };
    let cs = "";
    for (const c of parts[2]) {
      if (c === "K" && at(4, 1) === "K" && at(7, 1) === "R") cs += c;
      else if (c === "Q" && at(4, 1) === "K" && at(0, 1) === "R") cs += c;
      else if (c === "k" && at(4, 8) === "k" && at(7, 8) === "r") cs += c;
      else if (c === "q" && at(4, 8) === "k" && at(0, 8) === "r") cs += c;
    }
    parts[2] = cs || "-";
    return parts.join(" ");
  }

  /* бьётся ли поле sq фигурами соперника стороны `us` (через подстановку короля на это поле) */
  function squareAttacked(game, sq, us) {
    try {
      const fenParts = game.fen().split(" ");
      const g = new Orig(fenParts.join(" "));
      const kingSq = findKing(g, us);
      if (!kingSq) return false;
      g.remove(kingSq);
      g.put({ type: "k", color: us }, sq);
      const p = g.fen().split(" ");
      p[1] = us; p[2] = "-"; p[3] = "-";
      const t = new Orig(p.join(" "));
      return t.in_check();
    } catch (e) { return false; }
  }
  function findKing(g, color) {
    const files = "abcdefgh";
    for (let r = 1; r <= 8; r++) for (let f = 0; f < 8; f++) {
      const sq = files[f] + r, pc = g.get(sq);
      if (pc && pc.type === "k" && pc.color === color) return sq;
    }
    return null;
  }

  /* законна ли рокировка (verbose-ход chess.js с флагом k/q) */
  function castleOk(game, m) {
    const us = m.color, rank = us === "w" ? "1" : "8";
    if (m.from !== "e" + rank) return false;
    if (game.in_check()) return false;
    const king = m.flags.indexOf("k") >= 0;
    const rook = game.get((king ? "h" : "a") + rank);
    if (!rook || rook.type !== "r" || rook.color !== us) return false;
    const between = king ? ["f", "g"] : ["d", "c", "b"];
    for (const f of between) if (game.get(f + rank)) return false;
    const path = king ? ["f", "g"] : ["d", "c"];
    for (const f of path) if (squareAttacked(game, f + rank, us)) return false;
    return true;
  }
  const isCastle = m => m && typeof m.flags === "string" && (m.flags.indexOf("k") >= 0 || m.flags.indexOf("q") >= 0);

  function Safe(fen) {
    const g = fen === undefined ? new Orig() : new Orig(fixFen(fen));
    const _moves = g.moves.bind(g), _move = g.move.bind(g), _load = g.load.bind(g);

    g.load = f => _load(fixFen(f));
    g.moves = function (opts) {
      opts = opts || {};
      const verbose = _moves(Object.assign({}, opts, { verbose: true }));
      const ok = verbose.filter(m => !isCastle(m) || castleOk(g, m));
      return opts.verbose ? ok : ok.map(m => m.san);
    };
    g.move = function (mv, opts) {
      if (mv == null) return null;
      const all = _moves({ verbose: true });
      let target = null;
      if (typeof mv === "string") {
        const clean = s => s.replace(/[+#?!=]/g, "").replace(/0/g, "O");
        target = all.find(m => m.san === mv) || all.find(m => clean(m.san) === clean(mv)) ||
          all.find(m => m.from + m.to + (m.promotion || "") === mv.toLowerCase());
      } else if (typeof mv === "object") {
        target = all.find(m => m.from === mv.from && m.to === mv.to && (!m.promotion || m.promotion === (mv.promotion || "q")));
      }
      if (target && isCastle(target) && !castleOk(g, target)) return null;
      return _move(mv, opts);
    };
    /* мат/пат/конец партии считаем с учётом исправленных ходов */
    g.in_checkmate = () => g.in_check() && g.moves().length === 0;
    g.in_stalemate = () => !g.in_check() && g.moves().length === 0;
    const _over = Orig.prototype && Orig.prototype.game_over;
    const _draw = g.in_draw.bind(g);
    g.game_over = () => g.moves().length === 0 || _draw();
    void _over;
    return g;
  }
  Safe.__mcSafe = true;
  Safe.prototype = Orig.prototype;
  window.Chess = Safe;
})();
