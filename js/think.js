/* maper.chess — режим «Продумать ход»
   ─────────────────────────────────────────────────────────────────────────────────────────────
   Кнопка «🧠 Продумать ход» под доской (партии с ботом, задачи, ежедневные задачи, дуэли).
   Внутри режима реальная партия НЕ меняется — вы ходите за обе стороны на «песочнице»:
     • ходы рисуются нумерованными стрелками (1, 2, 3 …): ваши — фиолетовые, ответы соперника — оранжевые;
     • можно листать план вперёд/назад, сделать «пас» (пропустить ход соперника) и сбросить всё;
     • свои стрелки и кружки: правая кнопка мыши (Shift = красная, Ctrl = синяя, Alt = жёлтая),
       на телефоне — переключатель «Стрелки» (перетяните палец от клетки к клетке, тап = кружок);
     • «Угрозы» подсвечивают висящие фигуры (красное — ваши, зелёное — соперника);
     • мини-доска «Реальная позиция» (как превью в других шахматных играх);
     • если соперник пошёл так, как вы предполагали, план сам сдвигается; «Сыграть 1-й ход» — делает его по-настоящему.
   Не трогает board.js / game.js: расширяет BoardView и контроллеры «сверху». Подключать ПОСЛЕДНИМ
   (после js/analysis.js). Стили — css/think.css. */
(function () {
  "use strict";
  if (typeof BoardView === "undefined" || typeof Chess === "undefined") return;

  /* ---------- тексты ---------- */
  const TXT = {
    ru: {
      btn: "Продумать ход", btnOff: "Выйти из режима",
      title: "Режим размышления", sub: "Партия не меняется — это только план",
      empty: "Ходите фигурами за обе стороны — увидите позицию через несколько ходов. Реальная партия при этом не затрагивается.",
      first: "В начало", prev: "Шаг назад", next: "Шаг вперёд", last: "В конец",
      reset: "Сбросить план", pass: "Пропустить ход (пас)",
      mModes: "Режим ввода", mMove: "Ходы", mArrow: "Стрелки",
      clear: "Стереть свои стрелки", threats: "Угрозы", mini: "Реальная позиция",
      play: "Сыграть 1-й ход", exit: "Выйти",
      ahead: "Вперёд: {n}", material: "Материал", check: "Шах", mate: "Мат", stalemate: "Пат", draw: "Ничья",
      moveLbl: "ходов", realPos: "Реальная позиция",
      toastMatch: "Соперник пошёл как в вашем плане ✓", toastReset: "Позиция изменилась — план сброшен",
      toastPassCheck: "Под шахом пасовать нельзя", toastPlayed: "Ход сыгран",
      toastNoPlay: "Сейчас нельзя сыграть этот ход", toastFinished: "Партия уже окончена",
      legendMine: "ваши", legendOpp: "соперника", color: "Цвет стрелки",
      realMine: "В партии: ваш ход", realOpp: "В партии: ход соперника", realW: "В партии ходят белые", realB: "В партии ходят чёрные"
    },
    en: {
      btn: "Think ahead", btnOff: "Leave mode",
      title: "Thinking mode", sub: "The game isn't changed — it's only a plan",
      empty: "Move the pieces for both sides to see the position a few moves ahead. The real game stays untouched.",
      first: "To start", prev: "Step back", next: "Step forward", last: "To end",
      reset: "Reset plan", pass: "Skip a move (pass)",
      mModes: "Input mode", mMove: "Moves", mArrow: "Arrows",
      clear: "Clear my arrows", threats: "Threats", mini: "Real position",
      play: "Play 1st move", exit: "Exit",
      ahead: "Ahead: {n}", material: "Material", check: "Check", mate: "Mate", stalemate: "Stalemate", draw: "Draw",
      moveLbl: "moves", realPos: "Real position",
      toastMatch: "Opponent played as you planned ✓", toastReset: "Position changed — plan reset",
      toastPassCheck: "Can't pass while in check", toastPlayed: "Move played",
      toastNoPlay: "Can't play this move right now", toastFinished: "The game is over",
      legendMine: "yours", legendOpp: "opponent", color: "Arrow colour",
      realMine: "In game: your move", realOpp: "In game: opponent's move", realW: "In game: White to move", realB: "In game: Black to move"
    }
  };
  const lang = () => ((typeof getLang === "function" ? getLang() : "ru") === "en" ? "en" : "ru");
  const tx = (k, v) => {
    let s = (TXT[lang()] && TXT[lang()][k]) || TXT.ru[k] || k;
    if (v) Object.keys(v).forEach(x => { s = s.replace("{" + x + "}", v[x]); });
    return s;
  };

  /* ---------- константы ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const FILES = "abcdefgh";
  const FREE = { g: "#72d6a3", r: "#ee8195", b: "#6aa8ff", y: "#e3bf7c" };
  const PLAN_MINE = "#8f84ff", PLAN_OPP = "#ff9468";
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const posKey = fen => fen.split(" ").slice(0, 4).join(" ");
  const toast = m => { try { if (typeof UI !== "undefined" && UI._toast) UI._toast(m); } catch (e) {} };
  const sfx = n => { try { if (typeof Sfx !== "undefined" && Sfx[n]) Sfx[n](); } catch (e) {} };

  let ACTIVE = null;            // текущий сеанс размышления (одна доска за раз)
  const BOARDS = {};            // id контейнера -> актуальный BoardView
  const HOSTS = {};             // id контейнера -> { btn, panel }

  /* ---------- где живёт кнопка ---------- */
  function hostInfo(board) {
    const id = board.el && board.el.id;
    if (id === "board") { const v = $("view-game"); return v && { view: v, anchor: v.querySelector(".game-controls"), id }; }
    if (id === "duel-board") { const v = $("view-duel-game"); return v && { view: v, anchor: v.querySelector(".dg-actions"), id }; }
    return null;
  }
  const tracked = board => !!(board.el && (board.el.id === "board" || board.el.id === "duel-board"));

  function tk(board) {
    if (!board._tk) board._tk = { arrows: [], circles: [], drag: null, layer: null, mini: null, lastPos: null, realLast: null, bound: false };
    return board._tk;
  }

  /* игра закончилась? (после конца партии думать уже не над чем) */
  function isFinished(board) {
    try {
      const c = typeof UI !== "undefined" && UI.gameController;
      if (c && c.board === board) return !!c.finished;
      if (board.el.id === "duel-board") { const r = $("duel-rematch"); return !!(r && !r.hidden); }
    } catch (e) {}
    return false;
  }
  /* «моя» сторона: у партии с ботом/дуэли — цвет игрока; в игре вдвоём на одном устройстве — тот, чей ход в начале плана */
  const viewerColor = board => board.playerColor ||
    (ACTIVE && ACTIVE.board === board ? ACTIVE.fens[0].split(" ")[1] : (board._game ? board._game.turn() : "w"));

  /* =============================================================================================
     РИСОВАНИЕ: стрелки, кружки, угрозы — один SVG-слой поверх клеток
     ============================================================================================= */
  function ensureLayer(board) {
    const s = tk(board);
    if (!s.layer || !board.el.contains(s.layer)) {
      const L = document.createElementNS(NS, "svg");
      L.setAttribute("class", "think-layer");
      L.setAttribute("aria-hidden", "true");
      board.el.appendChild(L);
      s.layer = L;
    }
    return s.layer;
  }
  function geom(board, sq) {
    const e = board.squares[sq];
    return { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight, cx: e.offsetLeft + e.offsetWidth / 2, cy: e.offsetTop + e.offsetHeight / 2 };
  }

  /* стрелка с наконечником; для хода коня — «Г-образная», как в других шахматных играх */
  function arrowSvg(board, from, to, color, opacity, label) {
    if (from === to || !board.squares[from] || !board.squares[to]) return "";
    const a = geom(board, from), b = geom(board, to), sq = a.w;
    const nx = Math.round((b.cx - a.cx) / sq), ny = Math.round((b.cy - a.cy) / sq);
    const knight = (Math.abs(nx) === 1 && Math.abs(ny) === 2) || (Math.abs(nx) === 2 && Math.abs(ny) === 1);
    let pts = [[a.cx, a.cy]];
    if (knight) pts.push(Math.abs(ny) === 2 ? [a.cx, b.cy] : [b.cx, a.cy]);
    pts.push([b.cx, b.cy]);
    const p = pts[pts.length - 2], e = pts[pts.length - 1];
    let dx = e[0] - p[0], dy = e[1] - p[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const headLen = sq * 0.46, headHalf = sq * 0.27, sw = sq * 0.17;
    const tip = [e[0] - dx * sq * 0.1, e[1] - dy * sq * 0.1];
    const base = [tip[0] - dx * headLen, tip[1] - dy * headLen];
    const shaft = pts.slice(0, -1).concat([[base[0] + dx * 2, base[1] + dy * 2]]);
    const px = -dy, py = dx;
    const poly = `${tip[0]},${tip[1]} ${base[0] + px * headHalf},${base[1] + py * headHalf} ${base[0] - px * headHalf},${base[1] - py * headHalf}`;
    let out = `<g opacity="${opacity}"><polyline points="${shaft.map(q => q.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polygon points="${poly}" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="round"/>`;
    if (label != null) {                                   // номер хода на отрезке стрелки
      let total = 0; const seg = [];
      for (let i = 1; i < shaft.length; i++) { const l = Math.hypot(shaft[i][0] - shaft[i - 1][0], shaft[i][1] - shaft[i - 1][1]); seg.push(l); total += l; }
      let want = total * 0.5, i = 0;
      while (i < seg.length - 1 && want > seg[i]) { want -= seg[i]; i++; }
      const k = seg[i] ? want / seg[i] : 0;
      const lx = shaft[i][0] + (shaft[i + 1][0] - shaft[i][0]) * k, ly = shaft[i][1] + (shaft[i + 1][1] - shaft[i][1]) * k;
      const r = sq * 0.2;
      out += `<circle cx="${lx}" cy="${ly}" r="${r}" fill="#14131e" stroke="${color}" stroke-width="${sq * 0.035}"/>` +
        `<text x="${lx}" y="${ly}" fill="#fff" font-size="${r * 1.25}" font-weight="800" text-anchor="middle" dominant-baseline="central" font-family="Onest,system-ui,sans-serif">${label}</text>`;
    }
    return out + "</g>";
  }
  function circleSvg(board, sq, color) {
    if (!board.squares[sq]) return "";
    const g = geom(board, sq);
    return `<circle cx="${g.cx}" cy="${g.cy}" r="${g.w * 0.44}" fill="none" stroke="${color}" stroke-width="${g.w * 0.07}" opacity=".85"/>`;
  }
  function ringSvg(board, sq, color) {
    const g = geom(board, sq), m = g.w * 0.05;
    return `<rect x="${g.x + m}" y="${g.y + m}" width="${g.w - m * 2}" height="${g.h - m * 2}" rx="${g.w * 0.12}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="${g.w * 0.05}" stroke-dasharray="${g.w * 0.16} ${g.w * 0.09}"/>`;
  }

  function draw(board) {
    if (!tracked(board) || !board.squares || BOARDS[board.el.id] !== board) return;
    const s = tk(board), L = ensureLayer(board);
    const W = board.el.clientWidth, H = board.el.clientHeight;
    if (!W) return;
    L.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const S = ACTIVE && ACTIVE.board === board ? ACTIVE : null;
    let out = "";
    if (S && S.threats) out += threatsSvg(board, S);
    s.circles.forEach(c => { out += circleSvg(board, c.sq, FREE[c.color] || FREE.g); });
    if (S) {
      const viewer = viewerColor(board);
      S.plan.forEach((m, i) => {
        if (m.pass) return;
        const done = i < S.cursor;
        const op = done ? (i === S.cursor - 1 ? 0.95 : 0.78) : 0.28;
        out += arrowSvg(board, m.from, m.to, m.color === viewer ? PLAN_MINE : PLAN_OPP, op, i + 1);
      });
    }
    s.arrows.forEach(a => { out += arrowSvg(board, a.from, a.to, FREE[a.color] || FREE.g, 0.82, null); });
    if (s.drag && s.drag.from !== s.drag.to) out += arrowSvg(board, s.drag.from, s.drag.to, FREE[s.drag.color] || FREE.g, 0.55, null);
    else if (s.drag) out += circleSvg(board, s.drag.from, FREE[s.drag.color] || FREE.g);
    L.innerHTML = out;
  }
  const clearFree = board => {
    const s = tk(board);
    if (s.arrows.length || s.circles.length) { s.arrows = []; s.circles = []; draw(board); }
  };

  /* =============================================================================================
     УГРОЗЫ: висящие фигуры (атакованы и не защищены / атакованы более дешёвой фигурой)
     ============================================================================================= */
  const withTurn = (fen, c) => { const p = fen.split(" "); p[1] = c; p[3] = "-"; return p.join(" "); };
  function attackersOf(fen, sq, byColor) {
    const g = new Chess(withTurn(fen, byColor));
    return g.moves({ verbose: true }).filter(m => m.to === sq && m.captured).map(m => m.piece);
  }
  function isDefended(fen, sq, cell) {
    const enemy = cell.color === "w" ? "b" : "w";
    const g = new Chess(fen);
    g.remove(sq);
    if (!g.put({ type: "n", color: enemy }, sq)) return false;
    return attackersOf(g.fen(), sq, cell.color).length > 0;
  }
  function loosePieces(fen) {
    const res = { w: [], b: [] };
    try {
      const g = new Chess(fen), brd = g.board();
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const cell = brd[r][c];
        if (!cell || cell.type === "k") continue;
        const sq = FILES[c] + (8 - r), enemy = cell.color === "w" ? "b" : "w";
        const atk = attackersOf(fen, sq, enemy);
        if (!atk.length) continue;
        const cheapest = Math.min.apply(null, atk.map(x => VAL[x]));
        if (cheapest < VAL[cell.type] || !isDefended(fen, sq, cell)) res[cell.color].push(sq);
      }
    } catch (e) {}
    return res;
  }
  function threatsSvg(board, S) {
    const fen = S.fens[S.cursor];
    if (S._thrFen !== fen) { S._thr = loosePieces(fen); S._thrFen = fen; }
    const me = viewerColor(board), opp = me === "w" ? "b" : "w";
    return S._thr[me].map(sq => ringSvg(board, sq, "#ee6a7e")).join("") + S._thr[opp].map(sq => ringSvg(board, sq, "#72d6a3")).join("");
  }

  /* =============================================================================================
     ВВОД: правая кнопка / режим «Стрелки» — свои стрелки и кружки
     ============================================================================================= */
  function sqAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const s = el && el.closest && el.closest(".sq");
    return s ? s.dataset.sq : null;
  }
  function bindBoard(board) {
    const el = board.el;
    if (el._thinkBound) return; el._thinkBound = true;       // один раз на элемент (BoardView пересоздаётся для каждой партии)
    const cur = () => BOARDS[el.id];
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("pointerdown", e => {
      const board = cur(); if (!board) return;
      const s = tk(board);
      const S = ACTIVE && ACTIVE.board === board ? ACTIVE : null;
      const right = e.button === 2, tool = S && S.mode === "arrow" && e.button === 0;
      if (!right && !tool) return;
      const sq = sqAt(e); if (!sq) return;
      e.preventDefault();
      const color = e.shiftKey ? "r" : e.ctrlKey ? "b" : e.altKey ? "y" : (S ? S.color : "g");
      s.drag = { from: sq, to: sq, color };
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      draw(board);
    });
    el.addEventListener("pointermove", e => {
      const board = cur(); if (!board) return;
      const s = tk(board); if (!s.drag) return;
      const sq = sqAt(e);
      if (sq && sq !== s.drag.to) { s.drag.to = sq; draw(board); }
    });
    el.addEventListener("pointerup", e => {
      const board = cur(); if (!board) return;
      const s = tk(board); if (!s.drag) return;
      const d = s.drag; s.drag = null;
      try { el.releasePointerCapture(e.pointerId); } catch (x) {}
      if (d.from === d.to) {
        const i = s.circles.findIndex(c => c.sq === d.from);
        if (i >= 0) { const same = s.circles[i].color === d.color; s.circles.splice(i, 1); if (!same) s.circles.push({ sq: d.from, color: d.color }); }
        else s.circles.push({ sq: d.from, color: d.color });
      } else {
        const i = s.arrows.findIndex(a => a.from === d.from && a.to === d.to);
        if (i >= 0) { const same = s.arrows[i].color === d.color; s.arrows.splice(i, 1); if (!same) s.arrows.push(d); }
        else s.arrows.push({ from: d.from, to: d.to, color: d.color });
      }
      draw(board);
    });
    el.addEventListener("pointercancel", () => { const board = cur(); if (board) { tk(board).drag = null; draw(board); } });
    const redraw = () => { const board = cur(); if (board) draw(board); };
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(el);
    window.addEventListener("resize", redraw);
  }

  /* =============================================================================================
     ПАТЧИ BoardView (поверх board.js и boost.js — ничего в них не меняем)
     ============================================================================================= */
  const _render = BoardView.prototype.render;
  BoardView.prototype.render = function (game) {
    if (ACTIVE && ACTIVE.board === this && game !== ACTIVE.view) return;     // реальную позицию не рисуем, пока думаем
    return _render.apply(this, arguments);
  };
  const _attach = BoardView.prototype.attach;
  BoardView.prototype.attach = function (game, lastMove) {
    if (!tracked(this)) return _attach.apply(this, arguments);
    registerBoard(this);
    const s = tk(this), key = posKey(game.fen());
    const changed = s.lastPos !== null && s.lastPos !== key;
    s.lastPos = key; s.realLast = lastMove || null;
    if (ACTIVE && ACTIVE.board === this) {          // партия пошла дальше, пока мы думали
      this._game = game; this.lastMove = lastMove || null;
      this._moveSound(game, lastMove);
      onRealChange(this);
      return;
    }
    if (changed) { s.arrows = []; s.circles = []; }
    const r = _attach.apply(this, arguments);
    draw(this);
    return r;
  };
  const _so = BoardView.prototype.setOrientation;
  BoardView.prototype.setOrientation = function () {
    const r = _so.apply(this, arguments);              // пересобирает клетки и стирает слой стрелок
    if (tracked(this)) { if (ACTIVE && ACTIVE.board === this) refresh(); else draw(this); }
    return r;
  };
  const _tap = BoardView.prototype._handleTap;
  BoardView.prototype._handleTap = function (sq) {
    if (ACTIVE && ACTIVE.board === this) { if (ACTIVE.mode === "move") thinkTap(sq); return; }
    if (tracked(this)) clearFree(this);              // обычный тап по доске стирает нарисованные стрелки
    return _tap.apply(this, arguments);
  };

  function registerBoard(board) {
    const id = board.el.id;
    BOARDS[id] = board;
    bindBoard(board);
    injectHost(board);
  }

  /* =============================================================================================
     ПЛАН: песочница, ходы, шаги
     ============================================================================================= */
  function enter(board) {
    if (!board || !board._game || !HOSTS[board.el.id]) return;
    if (ACTIVE) { if (ACTIVE.board === board) return exit(); exit(true); }
    if (isFinished(board)) { toast(tx("toastFinished")); return; }
    const fen = board._game.fen();
    ACTIVE = {
      board, fens: [fen], plan: [], cursor: 0, view: new Chess(fen),
      sel: null, targets: [], mode: "move", color: "g", threats: false, mini: false,
      _thr: null, _thrFen: null, timer: null
    };
    const h = HOSTS[board.el.id];
    board.el.classList.add("think-on");
    h.view.classList.add("think-lock");
    h.panel.hidden = false;
    ACTIVE.timer = setInterval(watchdog, 500);
    refresh();
  }

  function exit(silent) {
    const S = ACTIVE; if (!S) return;
    clearInterval(S.timer);
    ACTIVE = null;
    const board = S.board, h = HOSTS[board.el.id];
    board.el.classList.remove("think-on", "think-arrow-mode");
    if (h) { h.view.classList.remove("think-lock"); h.panel.hidden = true; }
    const s = tk(board);
    if (s.mini) { s.mini.remove(); s.mini = null; }
    board.selected = null; board.legalTargets = [];
    board.lastMove = s.realLast;
    board._bxN = null;                                // чтобы boost.js не «проигрывал» ход заново
    if (board._game) _render.call(board, board._game);
    s.arrows = []; s.circles = [];
    draw(board);
    paintButton(board);
  }

  function watchdog() {
    const S = ACTIVE; if (!S) return;
    const b = S.board, cur = typeof UI !== "undefined" && UI.gameController;
    const gone = !document.body.contains(b.el) || b.el.offsetParent === null;
    const swapped = b.el.id === "board" && cur && cur.board && cur.board !== b;
    if (gone || swapped || isFinished(b)) exit(true);
    else paintPanelState();
  }

  /* соперник сходил / партия откатилась, пока мы думали */
  function onRealChange(board) {
    const S = ACTIVE, real = board._game, rk = posKey(real.fen());
    if (rk !== posKey(S.fens[0])) {
      let k = -1;
      for (let i = 1; i < S.fens.length; i++) if (posKey(S.fens[i]) === rk) { k = i; break; }
      if (k > 0) {
        S.plan = S.plan.slice(k); S.fens = S.fens.slice(k); S.fens[0] = real.fen();
        S.cursor = Math.max(0, S.cursor - k);
        toast(tx("toastMatch"));
      } else {
        S.plan = []; S.fens = [real.fen()]; S.cursor = 0;
        toast(tx("toastReset"));
      }
      S.view = new Chess(S.fens[S.cursor]); S.sel = null; S.targets = []; S._thrFen = null;
    }
    refresh();
  }

  function setCursor(c) {
    const S = ACTIVE; if (!S) return;
    S.cursor = Math.max(0, Math.min(S.plan.length, c));
    S.view = new Chess(S.fens[S.cursor]);
    S.sel = null; S.targets = [];
    refresh();
  }

  function thinkTap(sq) {
    const S = ACTIVE, g = S.view;
    if (S.sel === sq) { S.sel = null; S.targets = []; return syncBoard(); }
    if (S.sel && S.targets.indexOf(sq) >= 0) {
      const from = S.sel; S.sel = null; S.targets = [];
      return tryMove(from, sq);
    }
    const p = g.get(sq);
    if (p && p.color === g.turn()) {
      S.sel = sq;
      S.targets = g.moves({ square: sq, verbose: true }).map(m => m.to);
      sfx("select");
    } else { S.sel = null; S.targets = []; }
    syncBoard();
  }
  function tryMove(from, to) {
    const S = ACTIVE, p = S.view.get(from);
    if (p && p.type === "p" && (to[1] === "8" || to[1] === "1") && typeof choosePromotion === "function") {
      choosePromotion(p.color, pr => { if (ACTIVE === S) commit(from, to, pr); });
      return;
    }
    commit(from, to);
  }
  function commit(from, to, promo) {
    const S = ACTIVE;
    const g = new Chess(S.fens[S.cursor]);
    const mv = g.move({ from, to, promotion: promo });
    if (!mv) return syncBoard();
    const nx = S.plan[S.cursor];
    if (nx && !nx.pass && nx.from === from && nx.to === to && (nx.promotion || "") === (mv.promotion || "")) {
      S.cursor++;                                       // тот же ход, что уже в плане — просто шаг вперёд
    } else {
      S.plan.length = S.cursor; S.fens.length = S.cursor + 1;
      S.plan.push({ from, to, san: mv.san, color: mv.color, piece: mv.piece, captured: mv.captured || null, promotion: mv.promotion || null });
      S.fens.push(g.fen()); S.cursor++;
    }
    S.view = new Chess(S.fens[S.cursor]);
    sfx(g.in_check() ? "check" : mv.captured ? "capture" : "move");
    refresh();
  }
  function pass() {
    const S = ACTIVE, g = S.view;
    if (g.game_over()) return;
    if (g.in_check()) { toast(tx("toastPassCheck")); return; }
    const p = S.fens[S.cursor].split(" "), was = p[1];
    p[1] = was === "w" ? "b" : "w"; p[3] = "-";
    if (was === "b") p[5] = String((+p[5] || 1) + 1);
    const f = p.join(" ");
    S.plan.length = S.cursor; S.fens.length = S.cursor + 1;
    S.plan.push({ pass: true, color: was, san: "—" }); S.fens.push(f); S.cursor++;
    S.view = new Chess(f);
    refresh();
  }
  function resetPlan() {
    const S = ACTIVE; if (!S) return;
    S.plan = []; S.fens = [S.fens[0]]; S.cursor = 0; S.view = new Chess(S.fens[0]); S.sel = null; S.targets = [];
    refresh();
  }
  function playFirst() {
    const S = ACTIVE; if (!S) return;
    if (!canPlay(S)) { toast(tx("toastNoPlay")); return; }
    const m = S.plan[0], b = S.board;
    toast(tx("toastPlayed"));
    b.onMove(m.from, m.to);                             // контроллер сам спросит превращение и позовёт соперника
  }
  function canPlay(S) {
    const b = S.board, m = S.plan[0], real = b._game;
    if (!m || m.pass || !real || b.locked || isFinished(b)) return false;
    if (m.color !== real.turn()) return false;
    if (b.playerColor && b.playerColor !== real.turn()) return false;
    return true;
  }

  /* =============================================================================================
     ОТРИСОВКА СОСТОЯНИЯ: доска-песочница + стрелки + панель
     ============================================================================================= */
  function syncBoard() {
    const S = ACTIVE, b = S.board, m = S.cursor > 0 ? S.plan[S.cursor - 1] : null;
    b.selected = S.sel; b.legalTargets = S.targets;
    b.lastMove = S.cursor === 0 ? tk(b).realLast : (m && !m.pass ? { from: m.from, to: m.to } : null);
    _render.call(b, S.view);
    b.el.classList.toggle("think-arrow-mode", S.mode === "arrow");
    draw(b);
  }
  function refresh() {
    syncBoard();
    paintPanel();
    paintMini();
    paintButton(ACTIVE.board);
  }

  function materialDiff(g, viewer) {
    let d = 0;
    g.board().forEach(row => row.forEach(c => { if (c && c.type !== "k") d += (c.color === viewer ? 1 : -1) * VAL[c.type]; }));
    return d;
  }
  function plyLabel(S, i) {
    const p = S.fens[0].split(" "), s0 = p[1], n0 = +p[5] || 1;
    const m = S.plan[i];
    const no = n0 + Math.floor((i + (s0 === "b" ? 1 : 0)) / 2);
    const white = m.color === "w";
    const pre = white ? no + "." : (i === 0 ? no + "…" : "");
    return pre + (m.pass ? "⏸" : m.san);
  }

  const ICO = {
    first: '<path d="M7 5v14M18 6l-8 6 8 6z"/>', prev: '<path d="M15 6l-7 6 7 6"/>', next: '<path d="M9 6l7 6-7 6"/>',
    last: '<path d="M17 5v14M6 6l8 6-8 6z"/>', reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>',
    pass: '<path d="M8 6v12M16 6v12"/>', moves: '<path d="M7 20h10M9 20v-3l-2-2 1.5-5L12 4l3.5 6L17 15l-2 2v3"/>',
    arrow: '<path d="M5 19L18 6M10 6h8v8"/>', clear: '<path d="M4 20h9l7-7-5-5-9 9z"/><path d="M12 8l5 5M13 20h7"/>',
    warn: '<path d="M12 4l9 15H3z"/><path d="M12 10v4M12 16.5v.5"/>', mini: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
    play: '<path d="M7 5l12 7-12 7z"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const ico = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
  const tb = (act, icon, title, extra, on, dis) =>
    `<button type="button" class="tk-b${on ? " on" : ""}" data-act="${act}" title="${esc(title)}" aria-label="${esc(title)}"${dis ? " disabled" : ""}${extra || ""}>${ico(icon)}</button>`;

  function paintPanel() {
    const S = ACTIVE; if (!S) return;
    const h = HOSTS[S.board.el.id], g = S.view, viewer = viewerColor(S.board);
    const chips = S.plan.map((m, i) => {
      const cls = "tk-chip" + (m.color === viewer ? " mine" : " opp") + (i === S.cursor - 1 ? " cur" : "") + (i >= S.cursor ? " ghost" : "");
      return `<button type="button" class="${cls}" data-act="goto" data-i="${i + 1}">${esc(plyLabel(S, i))}</button>`;
    }).join("");
    const md = materialDiff(g, viewer);
    let state = "";
    if (g.in_checkmate()) state = `<span class="tk-tag bad">${tx("mate")}</span>`;
    else if (g.in_stalemate()) state = `<span class="tk-tag">${tx("stalemate")}</span>`;
    else if (g.in_draw()) state = `<span class="tk-tag">${tx("draw")}</span>`;
    else if (g.in_check()) state = `<span class="tk-tag warn">${tx("check")}</span>`;
    const palette = Object.keys(FREE).map(k => `<button type="button" class="tk-dot${S.color === k ? " on" : ""}" data-act="color" data-c="${k}" style="--c:${FREE[k]}" title="${esc(tx("color"))}" aria-label="${esc(tx("color"))}"></button>`).join("");
    const playable = canPlay(S);
    const real = S.board._game, pc = S.board.playerColor;
    let realTag = "";
    if (real && !isFinished(S.board)) {
      if (pc) realTag = real.turn() === pc ? `<span class="tk-tag real mine">${tx("realMine")}</span>` : `<span class="tk-tag real">${tx("realOpp")}</span>`;
      else realTag = `<span class="tk-tag real">${tx(real.turn() === "w" ? "realW" : "realB")}</span>`;
    }

    h.panel.innerHTML = `
      <div class="tk-head">
        <div class="tk-ttl"><b>${tx("title")}</b><small>${tx("sub")}</small></div>
        <button type="button" class="tk-x" data-act="exit" aria-label="${esc(tx("exit"))}">${ico("close")}</button>
      </div>
      <div class="tk-line">${chips || `<span class="tk-empty">${tx("empty")}</span>`}</div>
      <div class="tk-info">
        <span class="tk-tag">${tx("ahead", { n: S.plan.length })}</span>
        <span class="tk-tag ${md > 0 ? "good" : md < 0 ? "bad" : ""}">${tx("material")} ${md > 0 ? "+" : ""}${md}</span>
        ${state}
        ${realTag}
        <span class="tk-legend"><i class="m"></i>${tx("legendMine")} <i class="o"></i>${tx("legendOpp")}</span>
      </div>
      <div class="tk-bar">
        ${tb("first", "first", tx("first"), "", false, S.cursor === 0)}
        ${tb("prev", "prev", tx("prev"), "", false, S.cursor === 0)}
        ${tb("next", "next", tx("next"), "", false, S.cursor >= S.plan.length)}
        ${tb("last", "last", tx("last"), "", false, S.cursor >= S.plan.length)}
        <span class="tk-sep"></span>
        ${tb("pass", "pass", tx("pass"), "", false, false)}
        ${tb("reset", "reset", tx("reset"), "", false, !S.plan.length)}
      </div>
      <div class="tk-bar">
        <div class="tk-seg" role="group" aria-label="${esc(tx("mModes"))}">
          <button type="button" class="${S.mode === "move" ? "on" : ""}" data-act="mode" data-m="move">${ico("moves")}<span>${tx("mMove")}</span></button>
          <button type="button" class="${S.mode === "arrow" ? "on" : ""}" data-act="mode" data-m="arrow">${ico("arrow")}<span>${tx("mArrow")}</span></button>
        </div>
        <span class="tk-pal">${palette}</span>
        ${tb("clear", "clear", tx("clear"), "", false, false)}
      </div>
      <div class="tk-bar">
        ${tb("threats", "warn", tx("threats"), "", S.threats, false)}
        ${tb("mini", "mini", tx("mini"), "", S.mini, false)}
        <button type="button" class="tk-play" data-act="play"${playable ? "" : " disabled"}>${ico("play")}<span>${tx("play")}</span></button>
      </div>`;
  }
  function paintPanelState() {                          // лёгкое обновление (кнопка «Сыграть» зависит от locked)
    const S = ACTIVE; if (!S) return;
    const btn = HOSTS[S.board.el.id].panel.querySelector(".tk-play");
    if (btn) btn.disabled = !canPlay(S);
  }

  /* мини-доска «Реальная позиция» — как превью на скриншоте */
  function paintMini() {
    const S = ACTIVE; if (!S) return;
    const b = S.board, s = tk(b), real = b._game;
    if (!S.mini || !real) { if (s.mini) { s.mini.remove(); s.mini = null; } return; }
    if (!s.mini || !b.el.contains(s.mini)) {
      s.mini = document.createElement("div");
      s.mini.className = "think-mini";
      b.el.appendChild(s.mini);
    }
    const flipped = b.orientation === "b", brd = real.board(), last = s.realLast;
    let cells = "";
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const r = flipped ? 7 - i : i, c = flipped ? 7 - j : j;
      const sq = FILES[c] + (8 - r), cell = brd[r][c];
      const dark = (c + (8 - r)) % 2 === 0;
      const svg = cell && window.pieceSvg ? window.pieceSvg(cell.color, cell.type) : "";
      const isLast = last && (last.from === sq || last.to === sq);
      cells += `<i class="${dark ? "d" : "l"}${isLast ? " last" : ""}">${svg}</i>`;
    }
    s.mini.innerHTML = `<div class="tm-grid">${cells}</div><span class="tm-cap">${tx("realPos")}</span><button type="button" class="tm-x" data-act="mini" aria-label="${esc(tx("exit"))}">✕</button>`;
  }

  /* кнопка-переключатель под доской */
  function paintButton(board) {
    const h = HOSTS[board.el.id]; if (!h) return;
    const on = ACTIVE && ACTIVE.board === board;
    h.btn.classList.toggle("on", !!on);
    h.btn.innerHTML = `<span class="tt-ico">${on ? ico("close") : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L17 7M11 7h6v6"/><circle cx="6" cy="18" r="1.6"/></svg>'}</span><span>${on ? tx("btnOff") : tx("btn")}</span>`;
  }

  function injectHost(board) {
    const id = board.el.id;
    if (HOSTS[id] && document.body.contains(HOSTS[id].btn)) { paintButton(board); return; }
    const info = hostInfo(board);
    if (!info || !info.anchor) return;
    const wrap = document.createElement("div");
    wrap.className = "think-bar";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "think-toggle"; btn.id = "btn-think-" + id;
    const panel = document.createElement("div");
    panel.className = "think-panel"; panel.hidden = true;
    wrap.appendChild(btn); wrap.appendChild(panel);
    info.anchor.parentNode.insertBefore(wrap, info.anchor);
    HOSTS[id] = { btn, panel, view: info.view };
    btn.addEventListener("click", () => enter(BOARDS[id]));
    panel.addEventListener("click", e => {
      const el = e.target.closest("[data-act]"), S = ACTIVE;
      if (!el || !S) return;
      switch (el.dataset.act) {
        case "exit": exit(); break;
        case "first": setCursor(0); break;
        case "prev": setCursor(S.cursor - 1); break;
        case "next": setCursor(S.cursor + 1); break;
        case "last": setCursor(S.plan.length); break;
        case "goto": setCursor(+el.dataset.i); break;
        case "pass": pass(); break;
        case "reset": resetPlan(); break;
        case "mode": S.mode = el.dataset.m; S.sel = null; S.targets = []; refresh(); break;
        case "color": S.color = el.dataset.c; paintPanel(); break;
        case "clear": { const s = tk(S.board); s.arrows = []; s.circles = []; draw(S.board); break; }
        case "threats": S.threats = !S.threats; refresh(); break;
        case "mini": S.mini = !S.mini; paintPanel(); paintMini(); break;
        case "play": playFirst(); break;
      }
    });
    paintButton(board);
  }

  /* мини-доска закрывается своим крестиком (он внутри доски, а не панели) */
  document.addEventListener("click", e => {
    const x = e.target.closest && e.target.closest(".think-mini [data-act='mini']");
    if (x && ACTIVE) { ACTIVE.mini = false; paintPanel(); paintMini(); }
  });
  document.addEventListener("keydown", e => {
    if (!ACTIVE) return;
    const tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA") return;
    if (e.key === "Escape") exit();
    else if (e.key === "ArrowLeft") { setCursor(ACTIVE.cursor - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { setCursor(ACTIVE.cursor + 1); e.preventDefault(); }
  });

  /* смена языка — перерисовать подписи */
  if (typeof UI !== "undefined" && UI.translate) {
    const _tr = UI.translate;
    UI.translate = function () {
      const r = _tr.apply(this, arguments);
      Object.keys(BOARDS).forEach(id => paintButton(BOARDS[id]));
      if (ACTIVE) paintPanel();
      return r;
    };
  }

  window.Think = { enter, exit, isActive: () => !!ACTIVE };
})();