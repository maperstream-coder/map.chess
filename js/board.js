/* maper.chess — board renderer
   Pure DOM rendering of an 8x8 board from a chess.js position.
   Ввод: тап-тап (выбрать фигуру → клетку) И перетаскивание пальцем/мышью (зажать фигуру и отпустить на клетке).
   Перетаскивание на Pointer Events + setPointerCapture, поэтому не «залипает» на телефоне и планшете. */

// Solid glyphs for BOTH colours (outline glyphs render hollow/thin). \uFE0E forces text style so
// iOS/Android don't swap the pawn for an emoji. Colour + outline come from CSS.
const _S = "\uFE0E";
const PIECE_GLYPH = {
  w: { p: "♟" + _S, n: "♞" + _S, b: "♝" + _S, r: "♜" + _S, q: "♛" + _S, k: "♚" + _S },
  b: { p: "♟" + _S, n: "♞" + _S, b: "♝" + _S, r: "♜" + _S, q: "♛" + _S, k: "♚" + _S }
};

class BoardView {
  /**
   * @param {HTMLElement} el - container element (gets the 64 square divs appended to it).
   * @param {object} opts - { onMove(from, to), playerColor }
   */
  constructor(el, opts) {
    this.el = el;
    this.onMove = opts.onMove;
    this.playerColor = opts.playerColor === null ? null : (opts.playerColor || "w");
    this.orientation = opts.orientation || this.playerColor || "w";
    this.selected = null;
    this.legalTargets = [];
    this.locked = false; // true while AI is "thinking" or after game over
    this.squares = {};
    this._prevFen = null; // позиция до последнего attach(): по ней понимаем, что за ход сделан (звук, анимация)
    this._mf = null;      // активная анимация хода
    this._buildGrid();
    this._initDrag();
  }

  /* ===================== ПЕРЕТАСКИВАНИЕ ФИГУР ===================== */
  _initDrag() {
    this._drag = null;
    this._suppressClickUntil = 0;
    const el = this.el;
    el._mcBoard = this; // если на тот же элемент создали новую доску — старые обработчики молчат
    el.classList.add("board-draggable");
    const sqAt = (x, y) => {
      const t = document.elementFromPoint(x, y);
      const b = t && t.closest ? t.closest(".sq") : null;
      return b && el.contains(b) ? b.dataset.sq : null;
    };
    const canGrab = sq => {
      if (el._mcBoard !== this) return false;
      if (this.locked || !this._game) return false;
      const g = this._game, piece = g.get(sq);
      return !!piece && piece.color === g.turn() && (this.playerColor === null || piece.color === this.playerColor);
    };
    el.addEventListener("pointerdown", e => {
      if (e.button !== undefined && e.button !== 0) return;
      const b = e.target.closest ? e.target.closest(".sq") : null;
      if (!b || !el.contains(b) || el._mcBoard !== this) return;
      const sq = b.dataset.sq;
      const grab = canGrab(sq);
      this._drag = { sq, id: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, ghost: null, over: null, grab };
      if (grab) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    el.addEventListener("pointermove", e => {
      const d = this._drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.started) {
        if (!d.grab || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
        if (!canGrab(d.sq)) { this._endDrag(); return; }
        d.started = true;
        this.selected = d.sq;
        this.legalTargets = this._game.moves({ square: d.sq, verbose: true }).map(m => m.to);
        this.render(this._game);
        const src = this.squares[d.sq];
        const r = src.getBoundingClientRect();
        const g = document.createElement("div");
        g.className = "drag-ghost " + (src.classList.contains("sq-white-piece") ? "sq-white-piece" : "sq-black-piece");
        g.innerHTML = src.innerHTML;
        g.style.width = r.width + "px"; g.style.height = r.height + "px";
        g.style.fontSize = getComputedStyle(src).fontSize;
        document.body.appendChild(g);
        d.ghost = g; d.w = r.width; d.h = r.height;
        src.classList.add("sq-drag-src");
        el.classList.add("is-dragging");
        const sfx = sfxRef(); if (sfx && sfx.select) sfx.select();
      }
      e.preventDefault();
      // на сенсоре фигура чуть выше пальца, чтобы её было видно
      const lift = e.pointerType === "touch" ? d.h * 0.55 : 0;
      d.ghost.style.transform = `translate(${e.clientX - d.w / 2}px, ${e.clientY - d.h / 2 - lift}px) scale(${e.pointerType === "touch" ? 1.25 : 1.1})`;
      const over = sqAt(e.clientX, e.clientY - lift);
      if (over !== d.over) {
        if (d.over) this.squares[d.over]?.classList.remove("sq-drag-over");
        if (over && this.legalTargets.includes(over)) this.squares[over]?.classList.add("sq-drag-over");
        d.over = over;
      }
    });
    const finish = (e, cancel) => {
      const d = this._drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.started) { // обычный тап (по фигуре или по пустой клетке) — обрабатываем здесь, click от мыши/пальца игнорируется
        this._drag = null;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        if (cancel) return;
        const up = sqAt(e.clientX, e.clientY) || d.sq;
        this._handleTap(up);
        return;
      }
      const lift = e.pointerType === "touch" ? d.h * 0.55 : 0;
      const to = cancel ? null : sqAt(e.clientX, e.clientY - lift);
      const from = d.sq;
      this._endDrag();
      if (to && to !== from && this.legalTargets.includes(to) && !this.locked) {
        this.clearSelection();
        this._dropMove = { from, to, t: Date.now() }; // фигуру уже «донесли» рукой — повторный полёт не нужен
        this.onMove(from, to);
      } else if (to === from) {
        this.render(this._game); // фигура остаётся выбранной — можно доходить тапом
      } else {
        this.clearSelection(); this.render(this._game);
      }
    };
    el.addEventListener("pointerup", e => finish(e, false));
    el.addEventListener("pointercancel", e => finish(e, true));
    el.addEventListener("lostpointercapture", e => { if (this._drag && this._drag.started) finish(e, true); });
    // мышь и палец полностью обрабатываются через pointer-события; click остаётся только для клавиатуры (Enter/пробел, detail === 0)
    el.addEventListener("click", e => {
      if (el._mcBoard !== this) return;
      const b = e.target.closest ? e.target.closest(".sq") : null;
      if (!b || !el.contains(b)) return;
      if (e.detail === 0) this._handleTap(b.dataset.sq);
    });
  }

  _endDrag() {
    const d = this._drag;
    this._drag = null;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    if (d.over) this.squares[d.over]?.classList.remove("sq-drag-over");
    this.squares[d.sq]?.classList.remove("sq-drag-src");
    this.el.classList.remove("is-dragging");
  }

  _buildGrid() {
    this.el.innerHTML = "";
    const files = "abcdefgh";
    // White at the bottom: ranks 8 -> 1 top to bottom.
    const flipped = this.orientation === "b";
    this.squares = {};
    for (let i = 0; i < 8; i++) {
      const rank = flipped ? i + 1 : 8 - i;
      for (let j = 0; j < 8; j++) {
        const f = flipped ? 7 - j : j;
        const file = files[f];
        const sq = `${file}${rank}`;
        const div = document.createElement("button");
        div.type = "button";
        div.className = "sq " + (((f + rank) % 2 === 1) ? "sq-dark" : "sq-light");
        div.dataset.sq = sq;
        div.setAttribute("aria-label", sq);
        this.el.appendChild(div);
        this.squares[sq] = div;
      }
    }
    this._buildCoords(flipped);
  }

  /* Разметка доски: буквы a–h снизу, цифры 1–8 слева.
     Это отдельные слои поверх клеток (pointer-events: none), поэтому render() их не стирает,
     а при повороте доски (setOrientation) они пересобираются вместе с сеткой.
     Цвет подписи = цвет соседней клетки другого тона, так читается на любой доске из магазина. */
  _buildCoords(flipped) {
    const files = "abcdefgh";
    const mk = (text, f, rank) => {
      const s = document.createElement("span");
      s.className = "bc " + (((f + rank) % 2 === 1) ? "bc-on-dark" : "bc-on-light");
      s.textContent = text;
      s.setAttribute("aria-hidden", "true");
      return s;
    };
    const fl = document.createElement("div");
    fl.className = "bc-layer bc-files";
    const bottomRank = flipped ? 8 : 1;
    for (let j = 0; j < 8; j++) {
      const f = flipped ? 7 - j : j;
      fl.appendChild(mk(files[f], f, bottomRank));
    }
    const rk = document.createElement("div");
    rk.className = "bc-layer bc-ranks";
    const leftFile = flipped ? 7 : 0;
    for (let i = 0; i < 8; i++) {
      const rank = flipped ? i + 1 : 8 - i;
      rk.appendChild(mk(String(rank), leftFile, rank));
    }
    this.el.appendChild(rk);
    this.el.appendChild(fl);
  }

  setOrientation(o) {
    this._cancelAnim();
    if (this._endDrag) this._endDrag();
    this.orientation = o; this.selected = null; this.legalTargets = [];
    this._buildGrid();
    if (this._game) this.render(this._game);
  }

  setLocked(locked) { this.locked = locked; }

  render(game) {
    const board = game.board();
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const file = files[c];
        const rank = 8 - r;
        const sq = `${file}${rank}`;
        const cell = board[r][c];
        const div = this.squares[sq];
        const svg = cell && window.pieceSvg ? window.pieceSvg(cell.color, cell.type) : null;
        if (svg) div.innerHTML = svg; else div.textContent = cell ? PIECE_GLYPH[cell.color][cell.type] : "";
        div.classList.toggle("sq-white-piece", !!cell && cell.color === "w");
        div.classList.toggle("sq-black-piece", !!cell && cell.color === "b");
        div.classList.remove("sq-selected", "sq-target", "sq-last", "sq-check", "mf-from", "mf-to", "mf-me", "mf-opp");
      }
    }
    if (this.selected) this.squares[this.selected].classList.add("sq-selected");
    this.legalTargets.forEach(t => this.squares[t]?.classList.add("sq-target"));
    if (this.lastMove) {
      const lf = this.squares[this.lastMove.from], lt = this.squares[this.lastMove.to];
      lf?.classList.add("sq-last", "mf-from");
      lt?.classList.add("sq-last", "mf-to");
      /* кто сходил: цвет подсветки отличает «мой» ход от хода соперника (в игре вдвоём на одном экране — белые/чёрные) */
      const mover = game.get(this.lastMove.to);
      if (mover) {
        const mine = this.playerColor === null ? mover.color === "w" : mover.color === this.playerColor;
        const cls = mine ? "mf-me" : "mf-opp";
        lf?.classList.add(cls); lt?.classList.add(cls);
      }
    }
    if (game.in_check()) {
      const kingSq = this._findKing(game, game.turn());
      if (kingSq) this.squares[kingSq].classList.add("sq-check");
    }
  }

  _findKing(game, color) {
    const board = game.board();
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.type === "k" && cell.color === color) return `${files[c]}${8 - r}`;
    }
    return null;
  }

  clearSelection() {
    this.selected = null;
    this.legalTargets = [];
  }

  _handleTap(sq) {
    if (this.locked) return;
    if (!this._game) return;
    const game = this._game;

    if (this.selected === sq) { this.clearSelection(); this.render(game); return; }

    if (this.selected && this.legalTargets.includes(sq)) {
      const from = this.selected;
      this.clearSelection();
      this.onMove(from, sq);
      return;
    }

    const piece = game.get(sq);
    if (piece && piece.color === game.turn() && (this.playerColor === null || piece.color === this.playerColor)) {
      this.selected = sq;
      this.legalTargets = game.moves({ square: sq, verbose: true }).map(m => m.to);
      const sfx = sfxRef(); if (sfx && sfx.select) sfx.select();
      this.render(game);
    } else {
      this.clearSelection();
      this.render(game);
    }
  }

  /* =====================================================================================
     ХОД: разбор позиции «до → после», звук, плавная анимация, заметная подсветка.
     Всё считается по двум FEN-ам (прошлый attach и текущий), поэтому работает одинаково
     для партии с ботом, дуэли с другом, уроков и анализа. Откат/перемотка — без анимации.
     ===================================================================================== */

  /* разбор хода: что двигалось, что взято, была ли рокировка/превращение, шах/мат */
  _noteMove(game, lastMove) {
    const fen = game.fen();
    const prev = this._prevFen;
    this._prevFen = fen;
    if (!prev || prev === fen || !lastMove) return null;
    try { return analyzeMove(prev, fen, game, lastMove, this.playerColor); } catch (e) { return null; }
  }

  _playMoveSound(info, delay) {
    try {
      const sfx = sfxRef();
      if (!info || !sfx) return;
      const kind = (info.mate || info.check) ? "check" : info.castle ? "castle" : info.captured ? "capture" : info.promo ? "promote" : "move";
      if (sfx[kind]) sfx[kind]({ delay: delay || 0, opp: info.opp });
    } catch (e) {}
  }

  /* звук хода без анимации (используют надстройки, например режим «Продумать ход») */
  _moveSound(game, lastMove) {
    const info = this._noteMove(game, lastMove);
    this._playMoveSound(info, 0);
    return info;
  }

  /* геометрия полёта фигуры; null — анимировать нельзя (нет места, «уменьшенная анимация» и т.п.) */
  _animGeom(info) {
    if (reducedMotion() || !this.el.animate || !this.el.isConnected) return null;
    const a = this.squares[info.from], b = this.squares[info.to];
    if (!a || !b || !b.offsetWidth) return null;
    const w = b.offsetWidth, dx = b.offsetLeft - a.offsetLeft, dy = b.offsetTop - a.offsetTop;
    if (!dx && !dy) return null;
    const ax = Math.abs(dx) / w, ay = Math.abs(dy) / w;
    const dist = Math.max(ax, ay);
    const knight = (Math.round(ax) === 1 && Math.round(ay) === 2) || (Math.round(ax) === 2 && Math.round(ay) === 1);
    /* чем дальше ход — тем чуть дольше; ход соперника чуть медленнее, чтобы его было легко заметить */
    const dur = Math.round(Math.min(560, 240 + 55 * dist + (knight ? 40 : 0)) + (info.opp ? 60 : 0));
    return { dx, dy, dur, knight };
  }

  attach(game, lastMove) {
    this._cancelAnim(); if (this._drag) this._endDrag();
    this._game = game;
    this.lastMove = lastMove || null;
    const info = this._noteMove(game, lastMove);
    const dm = this._dropMove; this._dropMove = null;
    const dropped = !!(info && dm && dm.from === info.from && dm.to === info.to && Date.now() - dm.t < 15000);
    const geo = info && !dropped ? this._animGeom(info) : null;
    /* звук — в момент, когда фигура «встаёт» на клетку */
    this._playMoveSound(info, geo ? Math.max(0, geo.dur / 1000 - 0.035) : 0);
    this.render(game);
    if (!info) return;
    try {
      if (geo) {
        /* boost.js рисует «приземление» сразу при отрисовке — здесь его покажем, когда фигура долетит */
        const eT = this.squares[info.to];
        if (eT) eT.classList.remove("bx-land", "bx-land-ai", "bx-cap");
        this._runAnim(info, geo);
      } else {
        this._afterMove(info);
      }
    } catch (e) { this._cancelAnim(); }
  }

  _runAnim(info, g) {
    const eT = this.squares[info.to];
    const fs = getComputedStyle(eT).fontSize;
    const m = this._mf = { info, nodes: [], hide: [], anims: [], timer: 0 };

    /* летящая копия фигуры: стоит на конечной клетке и «едет» из начальной (transform) */
    const spawn = (ch, fromSq, toSq, cls) => {
      const a = this.squares[fromSq], b = this.squares[toSq];
      if (!a || !b) return null;
      const d = document.createElement("div");
      d.className = "mf-piece" + (cls ? " " + cls : "");
      d.setAttribute("aria-hidden", "true");
      d.style.cssText = `left:${b.offsetLeft}px;top:${b.offsetTop}px;width:${b.offsetWidth}px;height:${b.offsetHeight}px;font-size:${fs}`;
      const pm = pieceMarkup(ch);
      if (pm.html) d.innerHTML = pm.html; else { d.textContent = pm.text; d.classList.add(pm.cls); }
      this.el.appendChild(d);
      m.nodes.push(d);
      return { d, dx: b.offsetLeft - a.offsetLeft, dy: b.offsetTop - a.offsetTop, to: b };
    };
    const hideSq = el => { if (el) { el.classList.add("mf-hide"); m.hide.push(el); } };
    const EASE = "cubic-bezier(.4, 0, .2, 1)";

    /* взятая фигура: стоит на месте и растворяется, когда на неё «приходит» ходящая */
    if (info.captured) {
      const gh = spawn(info.captured.ch, info.captured.sq, info.captured.sq, "mf-ghost");
      if (gh) m.anims.push(gh.d.animate(
        [{ opacity: 1, transform: "scale(1)" }, { opacity: 1, transform: "scale(1)", offset: 0.55 }, { opacity: 0, transform: "scale(.55)" }],
        { duration: g.dur, easing: "ease-in", fill: "forwards" }));
    }
    /* ладья при рокировке едет вместе с королём */
    if (info.castle && info.castle.from && info.castle.to) {
      const r = spawn(info.castle.ch, info.castle.from, info.castle.to, "mf-rook");
      if (r) {
        hideSq(r.to);
        m.anims.push(r.d.animate(
          [{ transform: `translate(${-r.dx}px, ${-r.dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: g.dur, easing: EASE, fill: "forwards" }));
      }
    }
    /* сама ходящая фигура: чуть «приподнимается» в полёте (конь — выше, он прыгает) */
    const mv = spawn(info.piece, info.from, info.to, "mf-mover");
    if (!mv) { this._cancelAnim(); this._afterMove(info); return; }
    hideSq(mv.to);
    const lift = g.knight ? 1.14 : 1.05;
    m.anims.push(mv.d.animate([
      { transform: `translate(${-mv.dx}px, ${-mv.dy}px) scale(1.01)` },
      { transform: `translate(${-mv.dx / 2}px, ${-mv.dy / 2}px) scale(${lift})`, offset: 0.5 },
      { transform: "translate(0, 0) scale(1)" }
    ], { duration: g.dur, easing: EASE, fill: "forwards" }));

    m.anims[m.anims.length - 1].onfinish = () => this._endAnim(m);
    m.timer = setTimeout(() => this._endAnim(m), g.dur + 140);   // страховка, если браузер не пришлёт onfinish
  }

  _dropAnim(m) {
    clearTimeout(m.timer);
    m.anims.forEach(a => { a.onfinish = null; try { a.cancel(); } catch (e) {} });
    m.nodes.forEach(n => n.remove());
    m.hide.forEach(e => e.classList.remove("mf-hide"));
  }

  /* прервать полёт (пришёл следующий ход, поворот доски…) — без эффектов приземления */
  _cancelAnim() {
    const m = this._mf;
    if (!m) return;
    this._mf = null;
    this._dropAnim(m);
  }

  /* фигура долетела: убираем копию, показываем настоящую, «пружинка» + круг на клетке */
  _endAnim(m) {
    if (this._mf !== m) return;
    this._mf = null;
    this._dropAnim(m);
    try {
      const info = m.info, eT = this.squares[info.to];
      if (eT && eT.isConnected) {
        eT.classList.add("mf-settle");
        setTimeout(() => eT.classList.remove("mf-settle"), 540);
        if (info.captured) { eT.classList.add("bx-cap"); setTimeout(() => eT.classList.remove("bx-cap"), 900); }
        const ping = document.createElement("div");
        ping.className = "mf-ping " + (info.mine ? "mf-me" : "mf-opp");
        ping.style.cssText = `left:${eT.offsetLeft}px;top:${eT.offsetTop}px;width:${eT.offsetWidth}px;height:${eT.offsetHeight}px`;
        ping.setAttribute("aria-hidden", "true");
        this.el.appendChild(ping);
        setTimeout(() => ping.remove(), 1000);
      }
      this._afterMove(info);
    } catch (e) {}
  }

  /* заметность хода: вспышка по краю доски + плашка «Вы · e4» / «Соперник · Nf3» (только в партиях и дуэлях) */
  _afterMove(info) {
    try {
      const id = this.el.id;
      if (id !== "board" && id !== "duel-board") return;
      const mine = !!info.mine;
      this.el.classList.remove("mf-flash-me", "mf-flash-opp");
      void this.el.offsetWidth;
      this.el.classList.add(mine ? "mf-flash-me" : "mf-flash-opp");
      clearTimeout(this._mfFlashT);
      this._mfFlashT = setTimeout(() => this.el.classList.remove("mf-flash-me", "mf-flash-opp"), 1600);

      this.el.querySelectorAll(".mf-chip").forEach(n => n.remove());
      const chip = document.createElement("div");
      chip.className = "mf-chip " + (mine ? "mf-me" : "mf-opp");
      chip.setAttribute("aria-hidden", "true");
      const who = document.createElement("b");
      who.textContent = whoLabel(info, this.playerColor);
      const mvTxt = document.createElement("span");
      mvTxt.textContent = sanOf(info) || (info.from + "–" + info.to);
      chip.appendChild(who); chip.appendChild(mvTxt);
      this.el.appendChild(chip);
      setTimeout(() => chip.remove(), 2100);
    } catch (e) {}
  }
}

/* ---------- вспомогательные функции хода ---------- */
const _SQ_ALL = (() => { const a = []; for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) a.push(f + r); return a; })();

/* Sfx объявлен как const в sfx.js — это глобальная переменная, но НЕ свойство window, поэтому window.Sfx пуст */
function sfxRef() { try { return typeof Sfx !== "undefined" ? Sfx : null; } catch (e) { return null; } }

function reducedMotion() {
  try { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
}

/* FEN → { "e4": "P", ... } (заглавная — белая) */
function fenPlacement(fen) {
  const map = {}, rows = fen.split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r] || "") {
      if (ch >= "1" && ch <= "8") f += +ch;
      else { map["abcdefgh"[f] + (8 - r)] = ch; f++; }
    }
  }
  return map;
}
const _pcColor = ch => (ch === ch.toUpperCase() ? "w" : "b");

function pieceMarkup(ch) {
  const color = _pcColor(ch), type = ch.toLowerCase();
  const svg = window.pieceSvg ? window.pieceSvg(color, type) : null;
  if (svg) return { html: svg };
  return { text: PIECE_GLYPH[color][type], cls: color === "w" ? "sq-white-piece" : "sq-black-piece" };
}

/* Сравнивает позицию до и после и проверяет, что это ровно один ход (иначе — откат/перемотка: null) */
function analyzeMove(prev, fen, game, lastMove, playerColor) {
  const A = fenPlacement(prev), B = fenPlacement(fen);
  const from = lastMove.from, to = lastMove.to;
  const pc = A[from];
  if (!pc || B[from] || !B[to]) return null;
  const color = _pcColor(pc);
  const side = prev.split(" ")[1];
  if (side && side !== color) return null;                 // ходила не та сторона — это не «ход вперёд»
  if (_pcColor(B[to]) !== color) return null;

  const extras = _SQ_ALL.filter(sq => sq !== from && sq !== to && A[sq] !== B[sq]);
  if (extras.length > 2) return null;

  const type = pc.toLowerCase();
  const mine = playerColor === null ? color === "w" : color === playerColor;
  const info = {
    from, to, piece: pc, color, mine, opp: playerColor !== null && !mine, prevFen: prev,
    captured: null, castle: null, promo: null,
    check: !!(game.in_check && game.in_check()),
    mate: !!(game.in_checkmate && game.in_checkmate())
  };
  if (A[to] && _pcColor(A[to]) !== color) info.captured = { sq: to, ch: A[to] };
  if (type === "p" && B[to].toLowerCase() !== "p") info.promo = B[to].toLowerCase();

  if (type === "p" && !info.captured && from[0] !== to[0] && extras.length === 1) {       // взятие на проходе
    const x = extras[0];
    if (A[x] && A[x].toLowerCase() === "p" && _pcColor(A[x]) !== color && !B[x]) info.captured = { sq: x, ch: A[x] };
  }
  if (type === "k" && extras.length === 2) {                                              // рокировка: ищем ладью
    const rf = extras.find(x => A[x] && A[x].toLowerCase() === "r" && _pcColor(A[x]) === color);
    const rt = extras.find(x => B[x] && B[x].toLowerCase() === "r" && _pcColor(B[x]) === color);
    if (rf && rt) info.castle = { from: rf, to: rt, ch: A[rf] };
  }
  if (type === "k" && !info.castle && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) info.castle = { from: null, to: null };
  return info;
}

function whoLabel(info, playerColor) {
  const en = (typeof getLang === "function" ? getLang() : "ru") === "en";
  if (playerColor === null) return info.color === "w" ? (en ? "White" : "Белые") : (en ? "Black" : "Чёрные");
  return info.mine ? (en ? "You" : "Вы") : (en ? "Opponent" : "Соперник");
}

function sanOf(info) {
  try {
    const g = new Chess(info.prevFen);
    const m = g.move({ from: info.from, to: info.to, promotion: info.promo || undefined });
    return m ? m.san : null;
  } catch (e) { return null; }
}
