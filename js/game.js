/* maper.chess — level/game controllers
   GameController owns one chess.js game plus the BoardView for a regular level (full game vs AI).
   v2: стартовые позиции уровней (эндшпили, гамбиты, фора), бот считает в Web Worker (интерфейс не
   подвисает), «бонус-цель» уровня и данные для панели партии (взятые фигуры, материал, цель).
   PuzzleController owns the same pieces for a tactics puzzle: the player has a fixed move budget
   to deliver checkmate, and the opponent's replies are played by the same search engine at full
   strength (blunder = 0) rather than a scripted line — every puzzle FEN was proven by exhaustive
   search to be a forced mate against ANY defence, so this is always solvable within the budget. */

/* ---------- выбор фигуры при превращении пешки ---------- */
function choosePromotion(color, onPick) {
  let ov = document.getElementById("promo-overlay");
  if (ov) ov.remove();
  ov = document.createElement("div");
  ov.id = "promo-overlay";
  ov.className = "promo-overlay";
  const box = document.createElement("div");
  box.className = "promo-box";
  ["q", "r", "b", "n"].forEach(tp => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "promo-btn";
    b.innerHTML = window.pieceSvg ? window.pieceSvg(color, tp) : (color === "w" ? "♙" : "♟");
    b.addEventListener("click", () => { ov.remove(); onPick(tp); });
    box.appendChild(b);
  });
  ov.appendChild(box);
  document.body.appendChild(ov);
}

/* ---------- стартовые позиции ---------- */
const STD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/* зеркало: игрок «вместо белых» становится чёрным. Первым ходит бот (белые). */
function mirrorFenFull(fen) {
  const f = fen.split(" ");
  const rows = f[0].split("/").reverse().map(r => r.replace(/[a-zA-Z]/g, c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
  let cs = f[2] || "-";
  if (cs !== "-") cs = cs.split("").map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).sort((a, b) => "KQkq".indexOf(a) - "KQkq".indexOf(b)).join("");
  return `${rows.join("/")} w ${cs} - 0 1`;
}

/* собирает позицию уровня; возвращает { game, playerColor, startFen } */
function buildLevelStart(level, chosenColor) {
  let game = new Chess(), startFen = STD_FEN;
  let playerColor = level.color || chosenColor || "w";
  if (level.moves) {
    level.moves.split(" ").forEach(u => game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
  } else if (level.fen) {
    const fen = (!level.color && playerColor === "b") ? mirrorFenFull(level.fen) : level.fen;
    const g = new Chess(fen);
    if (g.moves().length) { game = g; startFen = fen; }
  }
  return { game, playerColor, startFen };
}

/* ---------- бонус-цель уровня: считается по истории ходов ---------- */
const PV = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function goalStatus(goal, hist, pc) {
  if (!goal) return null;
  const mine = hist.filter(m => m.color === pc), theirs = hist.filter(m => m.color !== pc);
  let cur = 0, target = goal.n || 1, achieved = false, fail = false, counter = true;
  switch (goal.t) {
    case "moves":
      cur = mine.length; achieved = cur <= target; fail = cur > target; break;
    case "capture":
      cur = mine.filter(m => m.captured).length; achieved = cur >= target; break;
    case "check":
      cur = mine.filter(m => /[+#]/.test(m.san)).length; achieved = cur >= target; break;
    case "castle":
      cur = mine.some(m => /[kq]/.test(m.flags)) ? 1 : 0; target = 1; achieved = !!cur; counter = false; break;
    case "promote":
      cur = mine.some(m => m.promotion) ? 1 : 0; target = 1; achieved = !!cur; counter = false; break;
    case "keepQueen": {
      const lost = theirs.some(m => m.captured === "q");
      cur = lost ? 0 : 1; target = 1; achieved = !lost; fail = lost; counter = false; break;
    }
    case "losePieces": {
      const lost = theirs.filter(m => m.captured && m.captured !== "p").length;
      cur = lost; target = goal.n || 0; achieved = lost <= target; fail = lost > target; break;
    }
  }
  return { goal, cur, target, achieved, fail, counter };
}

/* взятые фигуры и перевес в материале по истории */
function captureSummary(hist, pc) {
  const mine = [], opp = [];
  let diff = 0;
  hist.forEach(m => {
    const v = m.captured ? PV[m.captured] || 0 : 0;
    const promo = m.promotion ? (PV[m.promotion] || 0) - 1 : 0;
    if (m.color === pc) { if (m.captured) mine.push(m.captured); diff += v + promo; }
    else { if (m.captured) opp.push(m.captured); diff -= v + promo; }
  });
  const order = "qrbnp";
  const sorter = (a, b) => order.indexOf(a) - order.indexOf(b);
  return { mine: mine.sort(sorter), opp: opp.sort(sorter), diff };
}

class GameController {
  /**
   * @param {object} opts
   *   boardEl, level, playerColor, onStatus(text), onGameOver({result, moves, hintsUsed, goal}), onHintUsed(),
   *   onHud(info), onThinking(bool)
   */
  constructor(opts) {
    this.level = opts.level;
    this.onStatus = opts.onStatus || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.onHintUsed = opts.onHintUsed || (() => {});
    this.onHud = opts.onHud || (() => {});
    this.onThinking = opts.onThinking || (() => {});
    const start = buildLevelStart(this.level, opts.playerColor);
    this.game = start.game;
    this.playerColor = start.playerColor;
    this.startFen = start.startFen;
    this.baseCount = this.game.history().length;     // ходы, сыгранные «за кадром» при расстановке
    this.aiCfg = Object.assign(_aiConfigFromLevel(this.level), { startFen: this.startFen });
    this.hintsUsed = 0;
    this.playerMoveCount = 0;
    this.finished = false;
    this.destroyed = false;
    this._token = 0;

    this.board = new BoardView(opts.boardEl, {
      playerColor: this.playerColor,
      onMove: (from, to) => this._playerMove(from, to)
    });
    const hist = this.game.history({ verbose: true });
    const last = hist.length ? hist[hist.length - 1] : null;
    this.board.lastMove = last ? { from: last.from, to: last.to } : null;
    this.board.attach(this.game, this.board.lastMove);
    this._updateStatus();
    this._emitHud();
    if (this.game.turn() !== this.playerColor) { this.board.setLocked(true); setTimeout(() => this._aiMove(), 650); }
  }

  destroy() { this.destroyed = true; this._token++; this.onThinking(false); }

  _history() { return this.game.history({ verbose: true }).slice(this.baseCount); }

  _emitHud() {
    const hist = this._history();
    this.onHud({
      pc: this.playerColor,
      cap: captureSummary(hist, this.playerColor),
      goal: goalStatus(this.level.goal, hist, this.playerColor),
      moves: this.playerMoveCount,
      lastSan: hist.length ? hist[hist.length - 1].san : ""
    });
  }

  _updateStatus() {
    if (this.finished) return;
    if (this.game.in_check()) {
      this.onStatus(this.game.turn() === this.playerColor ? t("game.youInCheck") : t("game.engineInCheck"));
    } else {
      this.onStatus(this.game.turn() === this.playerColor ? t("game.yourMove") : t("game.engineThinking"));
    }
  }

  _playerMove(from, to) {
    if (this.finished || this.destroyed) return;
    const piece = this.game.get(from);
    const needsPromotion = piece && piece.type === "p" && (to[1] === "8" || to[1] === "1");
    if (needsPromotion) {           // спрашиваем фигуру, затем ходим
      this.board.setLocked(true);
      choosePromotion(piece.color, p => { this.board.setLocked(false); this._applyMove(from, to, p); });
      return;
    }
    this._applyMove(from, to);
  }

  _applyMove(from, to, promotion) {
    if (this.destroyed) return;
    const move = this.game.move({ from, to, promotion });
    if (!move) return; // illegal, ignore
    this.playerMoveCount++;
    this.board.lastMove = { from, to };
    this.board.attach(this.game, { from, to });
    this._updateStatus();
    this._emitHud();

    if (this._checkGameOver()) return;

    this.board.setLocked(true);
    setTimeout(() => this._aiMove(), 120);
  }

  async _aiMove() {
    if (this.finished || this.destroyed) return;
    const token = ++this._token;
    this.onThinking(true);
    this._updateStatus();
    const t0 = Date.now();
    let san = null;
    try { san = await chooseAiMoveAsync(this.game, this.aiCfg); }
    catch (e) { san = chooseAiMove(this.game, 2, 0.1); }
    const wait = 480 - (Date.now() - t0);                 // чтобы ход не выглядел мгновенным и «роботным»
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (this.destroyed || this.finished || token !== this._token) return;
    this.onThinking(false);
    if (san) {
      const moveObj = this.game.move(san);
      if (moveObj) this.board.lastMove = { from: moveObj.from, to: moveObj.to };
      this.board.attach(this.game, this.board.lastMove);
    }
    this.board.setLocked(false);
    this._updateStatus();
    this._emitHud();
    this._checkGameOver();
  }

  _checkGameOver() {
    if (!this.game.game_over()) return false;
    this.finished = true;
    this.board.setLocked(true);
    this.onThinking(false);
    let result;
    if (this.game.in_checkmate()) {
      result = this.game.turn() === this.playerColor ? "loss" : "win";
    } else {
      result = "draw";
    }
    this._finishWith(result, false);
    return true;
  }

  _finishWith(result, resigned) {
    const gs = goalStatus(this.level.goal, this._history(), this.playerColor);
    const goal = gs ? { ok: result === "win" && gs.achieved && !gs.fail, status: gs } : null;
    this.onGameOver({ result, moves: this.playerMoveCount, hintsUsed: this.hintsUsed, resigned: !!resigned, goal });
  }

  /** Highlights the engine's suggestion for the player's next move (costs nothing but is tracked for achievements). */
  hint() {
    if (this.finished || this.game.turn() !== this.playerColor) return false;
    const san = hintMove(this.game);
    if (!san) return false;
    const verbose = this.game.moves({ verbose: true }).find(m => m.san === san);
    if (!verbose) return false;
    this.hintsUsed++;
    this.onHintUsed();
    this.board.selected = verbose.from;
    this.board.legalTargets = [verbose.to];
    this.board.render(this.game);
    this.onStatus(t("game.hint", { from: verbose.from, to: verbose.to }));
    return true;
  }

  undo() {
    if (this.finished) return;
    if (this.game.turn() !== this.playerColor) return; // AI's reply is still pending, ignore
    if (this.game.history().length - this.baseCount < 2) return;
    // Undo both the AI's reply and the player's move so it's always the player's turn again.
    this.game.undo();
    this.game.undo();
    this.playerMoveCount = Math.max(0, this.playerMoveCount - 1);
    const hist = this.game.history({ verbose: true });
    const last = hist.length ? hist[hist.length - 1] : null;
    this.board.lastMove = last && hist.length > this.baseCount ? { from: last.from, to: last.to } : null;
    this.board.clearSelection();
    this.board.attach(this.game, this.board.lastMove);
    this._updateStatus();
    this._emitHud();
  }

  resign() {
    if (this.finished) return;
    this.finished = true;
    this._token++;
    this.board.setLocked(true);
    this.onThinking(false);
    this._finishWith("loss", true);
  }
}

class PuzzleController {
  /**
   * @param {object} opts
   *   boardEl, puzzle, onStatus(text), onSolved({moves}), onFailed(), onHud(info)
   */
  constructor(opts) {
    this.puzzle = opts.puzzle;
    this.onStatus = opts.onStatus || (() => {});
    this.onSolved = opts.onSolved || (() => {});
    this.onFailed = opts.onFailed || (() => {});
    this.onHud = opts.onHud || (() => {});
    this.mirrored = opts.playerColor === "b";   // «Играть за чёрных» = зеркальная позиция
    this.game = new Chess(this.mirrored ? mirrorFen(this.puzzle.fen) : this.puzzle.fen);
    this.playerColor = this.game.turn();
    this.movesAllowed = this.puzzle.movesAllowed;
    this.movesUsed = 0;
    this.finished = false;
    this.destroyed = false;

    this.board = new BoardView(opts.boardEl, {
      playerColor: this.playerColor,
      onMove: (from, to) => this._playerMove(from, to)
    });
    this.board.attach(this.game, null);
    this._updateStatus();
    this._emitHud();
  }

  destroy() { this.destroyed = true; }

  _emitHud() { this.onHud({ puzzle: true, used: this.movesUsed, allowed: this.movesAllowed }); }

  _movesLeft() {
    return Math.max(0, this.movesAllowed - this.movesUsed);
  }

  _updateStatus() {
    if (this.finished) return;
    this.onStatus(`${t("game.findMate", { n: this.movesAllowed })} ${t("game.movesLeft", { n: this._movesLeft() })}`);
  }

  _playerMove(from, to) {
    if (this.finished || this.destroyed) return;
    const piece = this.game.get(from);
    const needsPromotion = piece && piece.type === "p" && (to[1] === "8" || to[1] === "1");
    if (needsPromotion) {
      this.board.setLocked(true);
      choosePromotion(piece.color, p => { this.board.setLocked(false); this._applyMove(from, to, p); });
      return;
    }
    this._applyMove(from, to);
  }

  _applyMove(from, to, promotion) {
    if (this.destroyed) return;
    const move = this.game.move({ from, to, promotion });
    if (!move) return; // illegal, ignore
    this.movesUsed++;
    this.board.attach(this.game, { from, to });
    this._emitHud();

    if (this.game.in_checkmate()) {
      this._finish(true);
      return;
    }
    if (this.movesUsed >= this.movesAllowed || this.game.game_over()) {
      this._finish(false);
      return;
    }

    this._updateStatus();
    this.board.setLocked(true);
    setTimeout(() => this._opponentMove(), 450);
  }

  _opponentMove() {
    if (this.finished || this.destroyed) return;
    // Full-strength, zero-blunder reply — the puzzle is only offered because it's proven to be
    // a forced mate against every possible defence, so any reply here still lets it through.
    const san = chooseAiMove(this.game, this.puzzle.depth, 0);
    if (san) {
      const moveObj = this.game.move(san);
      this.board.attach(this.game, { from: moveObj.from, to: moveObj.to });
    }
    this.board.setLocked(false);
    if (this.game.game_over() || this._movesLeft() <= 0) {
      this._finish(false);
      return;
    }
    this._updateStatus();
  }

  _finish(solved) {
    this.finished = true;
    this.board.setLocked(true);
    if (solved) this.onSolved({ moves: this.movesUsed });
    else this.onFailed();
  }

  /** Подсказка: ход, ведущий к форсированному мату в оставшиеся ходы.
   *  1) в начальной позиции берём заранее проверенный ключевой ход (мгновенно);
   *  2) дальше — быстрый решатель MateSolver (js/mate-solver.js), он доказывает мат против ЛЮБОЙ защиты;
   *  3) если мата уже нет (игрок ушёл с верного пути) — говорим об этом и подсказку НЕ списываем;
   *  4) запасной путь (если решатель не загрузился или упёрся в лимит) — старый поиск. */
  hint() {
    if (this.finished || this.game.turn() !== this.playerColor) return false;
    const left = this._movesLeft();
    const legal = this.game.moves({ verbose: true });
    let verbose = null;
    const pick = (from, to, promo) => legal.find(m => m.from === from && m.to === to && (!promo || m.promotion === promo));

    if (this.movesUsed === 0 && this.puzzle.sol) {
      let s = this.puzzle.sol;
      if (this.mirrored) {                                   // зеркало: номер горизонтали r -> 9-r
        const fl = x => x[0] + (9 - Number(x[1]));
        s = fl(s.slice(0, 2)) + fl(s.slice(2, 4)) + (s[4] || "");
      }
      verbose = pick(s.slice(0, 2), s.slice(2, 4), s[4]) || null;
    }
    if (!verbose && typeof MateSolver !== "undefined") {
      const r = MateSolver.find(this.game.fen(), left);
      if (r === null) { this.onStatus(t("puzzle.noMate")); return false; }
      if (r) verbose = pick(r.from, r.to, r.promotion) || null;
    }
    if (!verbose) {
      const san = findMate(this.game, left) || chooseAiMove(this.game, 3, 0);
      if (!san) return false;
      verbose = legal.find(m => m.san === san);
    }
    if (!verbose) return false;
    this.board.selected = verbose.from;
    this.board.legalTargets = [verbose.to];
    this.board.render(this.game);
    this.onStatus(t("game.hint", { from: verbose.from, to: verbose.to }) + (verbose.promotion ? " =" + verbose.promotion.toUpperCase() : ""));
    return true;
  }

  undo() {
    if (this.finished) return;
    if (this.game.turn() !== this.playerColor) return;
    if (this.movesUsed === 0) return;
    // If it's the player's turn again, the opponent has already replied — undo both plies.
    this.game.undo();
    this.game.undo();
    this.movesUsed = Math.max(0, this.movesUsed - 1);
    this.board.clearSelection();
    this.board.attach(this.game, null);
    this._updateStatus();
    this._emitHud();
  }

  resign() {
    if (this.finished) return;
    this._finish(false);
  }
}