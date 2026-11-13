/* MaperChess — анализ партии на движке Stockfish 18
   ------------------------------------------------------------------
   Как это работает (та же методика, что у lichess / chess.com):
   • Каждая позиция партии проверяется настоящим Stockfish 18 (WASM, в отдельном потоке),
     две лучшие линии (MultiPV 2), глубина до 20 полуходов.
   • Оценка переводится в «шанс на победу» (формула lichess). Ход оценивается по тому,
     сколько процентов шанса он потерял по сравнению с лучшим ходом Stockfish:
        Лучший     — ход движка (или равноценный, потеря ≤ 0.08 пешки)
        Отлично    — потеря < 2 %       Хорошо      — < 5 %
        Неточность — 5–10 %             Ошибка      — 10–15 %
        Зевок      — ≥ 15 %             (пороги lichess)
     + потеря ≥ 2 пешек при не решающем перевесе — минимум «Неточность»,
     + упущенный форсированный мат — минимум «Неточность».
   • Точность партии — формула lichess: среднее, взвешенное по «остроте» позиции,
     + гармоническое среднее (один зевок честно роняет точность).
   • Средняя потеря в сантипешках (ACPL), точность по стадиям партии, название дебюта,
     причина ошибки (зевнул фигуру, пропустил мат, позволил мат…), лучшая линия движка.

   Подключение (в index.html уже есть):
     <link rel="stylesheet" href="css/analysis.css?v=4" />
     <script src="js/analysis.js?v=4"></script>   — после js/ui.js
   Файлы движка положить в папку js/stockfish/:
     stockfish-18-lite-single.js  и  stockfish-18-lite-single.wasm
   Если их нет — движок грузится с CDN (unpkg). Если и CDN недоступен —
   используется встроенный движок сайта (с пометкой в окне анализа). */
(function () {
  "use strict";
  if (typeof Chess === "undefined") return;

  /* ---------------- настройки движка ---------------- */
  const SF_FILE = "stockfish-18-lite-single";
  const SF_LOCAL = (window.MC_STOCKFISH_PATH || "js/stockfish/") + SF_FILE + ".js";
  const SF_CDN = "https://unpkg.com/stockfish@18.0.8/bin/" + SF_FILE;
  const BUDGET_MS = 36000;      // примерное время на разбор всей партии
  const MOVETIME_MIN = 300, MOVETIME_MAX = 900, MAX_DEPTH = 20, MULTIPV = 2;

  /* ---------------- тексты ---------------- */
  const TXT = {
    ru: {
      title: "Анализ партии", btn: "Анализ партии", btnWait: "Анализ… {p}%", open: "Открыть анализ",
      auto: "Авто", autoHint: "Открывать анализ сам после партии",
      you: "Ты", bot: "Бот", accuracy: "Точность",
      acpl: "Средняя потеря", acplHint: "Сколько в среднем сотых пешки терялось за ход (ACPL). Меньше — лучше.",
      win: "Победа", loss: "Поражение", draw: "Ничья", resigned: "Сдача",
      loadingEngine: "Загружаю Stockfish…", analysing: "Stockfish разбирает партию…", analysingPly: "Позиция {a} из {b}",
      engineSf: "Stockfish 18 · глубина {d}", engineLite: "Встроенный движок — Stockfish не загрузился, оценки приблизительные",
      start: "Начальная позиция", startHint: "Листай ходы стрелками или включи автопросмотр ▶.",
      brilliant: "Блестящий", great: "Отличный ход", book: "Теория", miss: "Упущение",
      best: "Лучший", excellent: "Отлично", good: "Хорошо", inaccuracy: "Неточность", mistake: "Ошибка", blunder: "Зевок", forced: "Единственный",
      keyMoments: "Ключевые моменты", noKey: "Ключевых моментов нет — ровная партия.", keyPrev: "Предыдущий ключевой момент", keyNext: "Следующий ключевой момент",
      opening: "Дебют", phases: "Твоя точность по стадиям", phOpening: "Дебют", phMiddle: "Миттельшпиль", phEnd: "Эндшпиль",
      rBest: "Лучший ход по оценке Stockfish.", rBestEq: "Равноценен лучшему ходу движка.",
      rBook: "Теоретический ход{o}.", rForced: "Единственный возможный ход.",
      rBrilliant: "Жертва материала — и Stockfish подтверждает, что она корректна!",
      rGreat: "Единственный сильный ход: все остальные заметно хуже.", rGreatPunish: "Точное наказание ошибки соперника.",
      rExcellent: "Почти не уступает лучшему ходу {m}.", rGood: "Нормально, но {m} было точнее.",
      rInacc: "Неточность — {m} было заметно сильнее.", rMistake: "Ошибка: преимущество уходит. Нужно было {m}.",
      rBlunder: "Грубая ошибка. Нужно было {m}.", rMiss: "Соперник ошибся, но ты этим не воспользовался — {m} выигрывало.",
      xAllowsMate: "Теперь у соперника форсированный мат в {n}.", xMissedMate: "Упущен форсированный мат в {n}.",
      xHangs: "{P} остаётся под боем — соперник забирает: {m}.", xLoses: "Ход ведёт к потере материала: ты теряешь {p}.",
      xMissedWin: "{m} выигрывало {p}.", xLostAdv: "Перевес растерян: {a} → {b}.", xMateDone: "Мат!",
      xLostNow: "После этого хода позиция практически проиграна.", xWorseNow: "Теперь у соперника явный перевес.",
      materialN: "материал (≈{n} пешк.)",
      better: "Лучше", line: "Линия", reply: "Сильнейший ответ", lines: "Линии Stockfish", noLines: "Позиция ещё анализируется…",
      mate: "Мат", stalemate: "Пат — ничья",
      betterWas: "Лучше было {m}", bestWas: "Это лучший ход в позиции.",
      fix: "Исправить ход", train: "Работа над ошибками", trainCount: "{n} ошибок",
      noMistakes: "Ни одной ошибки — чистая партия!", fixTitle: "Найди ход лучше",
      fixSub: "Ты сыграл {m}. Сделай на доске ход сильнее.", tryAgain: "Не то. {m} — тоже слабо, попробуй ещё.",
      correct: "Точно! {m} — лучший ход.", alsoGood: "Отлично! {m} тоже сильный ход.",
      showBest: "Показать лучший", skip: "Дальше", giveUp: "Лучший ход: {m}", checking: "Stockfish проверяет…",
      fixed: "Исправлено {a} из {b}", done: "Все ошибки разобраны!", exit: "Выйти из тренировки",
      evalGraph: "График оценки", moves: "Ходы", close: "Закрыть", mateIn: "Мат в {n}",
      replay: "Сыграть заново", trainDone: "Работа над ошибками завершена"
    },
    en: {
      title: "Game review", btn: "Game review", btnWait: "Analysing… {p}%", open: "Open review",
      auto: "Auto", autoHint: "Open review automatically after a game",
      you: "You", bot: "Bot", accuracy: "Accuracy",
      acpl: "Avg. loss", acplHint: "Average centipawn loss per move (ACPL). Lower is better.",
      win: "Victory", loss: "Defeat", draw: "Draw", resigned: "Resigned",
      loadingEngine: "Loading Stockfish…", analysing: "Stockfish is reviewing your game…", analysingPly: "Position {a} of {b}",
      engineSf: "Stockfish 18 · depth {d}", engineLite: "Built-in engine — Stockfish failed to load, evaluations are approximate",
      start: "Starting position", startHint: "Step through moves with the arrows or press ▶ for autoplay.",
      brilliant: "Brilliant", great: "Great move", book: "Book", miss: "Miss",
      best: "Best", excellent: "Excellent", good: "Good", inaccuracy: "Inaccuracy", mistake: "Mistake", blunder: "Blunder", forced: "Only move",
      keyMoments: "Key moments", noKey: "No key moments — a smooth game.", keyPrev: "Previous key moment", keyNext: "Next key moment",
      opening: "Opening", phases: "Your accuracy by phase", phOpening: "Opening", phMiddle: "Middlegame", phEnd: "Endgame",
      rBest: "Stockfish's top choice.", rBestEq: "As good as the engine's top move.",
      rBook: "A known theory move{o}.", rForced: "The only legal move.",
      rBrilliant: "A material sacrifice — and Stockfish confirms it works!",
      rGreat: "The only strong move: everything else is clearly worse.", rGreatPunish: "Precise punishment of your opponent's mistake.",
      rExcellent: "Nearly as strong as the best move {m}.", rGood: "Fine, but {m} was more precise.",
      rInacc: "Inaccuracy — {m} was clearly stronger.", rMistake: "Mistake: the advantage slips away. {m} was needed.",
      rBlunder: "A blunder. {m} was needed.", rMiss: "Your opponent slipped, but you missed it — {m} was winning.",
      xAllowsMate: "Your opponent now has a forced mate in {n}.", xMissedMate: "Missed a forced mate in {n}.",
      xHangs: "{P} is left hanging — your opponent takes it: {m}.", xLoses: "This loses material: you drop {p}.",
      xMissedWin: "{m} won {p}.", xLostAdv: "The advantage is gone: {a} → {b}.", xMateDone: "Checkmate!",
      xLostNow: "After this move the position is practically lost.", xWorseNow: "Your opponent now has a clear advantage.",
      materialN: "material (≈{n} pawns)",
      better: "Better", line: "Line", reply: "Best reply", lines: "Stockfish lines", noLines: "Still analysing this position…",
      mate: "Checkmate", stalemate: "Stalemate — draw",
      betterWas: "Better was {m}", bestWas: "That's the best move in the position.",
      fix: "Fix this move", train: "Fix my mistakes", trainCount: "{n} mistakes",
      noMistakes: "Not a single mistake — a clean game!", fixTitle: "Find a better move",
      fixSub: "You played {m}. Make a stronger move on the board.", tryAgain: "Not quite. {m} is weak too — try again.",
      correct: "Exactly! {m} is the best move.", alsoGood: "Great! {m} is a strong move too.",
      showBest: "Show best", skip: "Next", giveUp: "Best move: {m}", checking: "Stockfish is checking…",
      fixed: "Fixed {a} of {b}", done: "All mistakes reviewed!", exit: "Exit training",
      evalGraph: "Evaluation", moves: "Moves", close: "Close", mateIn: "Mate in {n}",
      replay: "Play again", trainDone: "Training complete"
    }
  };
  const PIECE = {
    ru: {
      nom: { p: "Пешка", n: "Конь", b: "Слон", r: "Ладья", q: "Ферзь", k: "Король" },
      acc: { p: "пешку", n: "коня", b: "слона", r: "ладью", q: "ферзя", k: "короля" }
    },
    en: {
      nom: { p: "The pawn", n: "The knight", b: "The bishop", r: "The rook", q: "The queen", k: "The king" },
      acc: { p: "a pawn", n: "a knight", b: "a bishop", r: "a rook", q: "the queen", k: "the king" }
    }
  };
  function lang() { try { return (typeof getLang === "function" && getLang()) === "en" ? "en" : "ru"; } catch (e) { return "ru"; } }
  function L(k, v) {
    let s = (TXT[lang()] || TXT.en)[k] || TXT.en[k] || k;
    if (v) Object.keys(v).forEach(x => { s = s.split("{" + x + "}").join(v[x]); });
    return s;
  }
  const PN = (form, type) => PIECE[lang()][form][type] || type;

  /* ---------------- классы ходов ---------------- */
  const CLS = {
    brilliant:  { icon: "!!" }, great: { icon: "!" }, book: { icon: "≡" }, miss: { icon: "✕" },
    best:       { icon: "★" }, excellent: { icon: "✦" }, good: { icon: "✓" }, forced: { icon: "→" },
    inaccuracy: { icon: "?!" }, mistake: { icon: "?" }, blunder: { icon: "??" }
  };
  const ORDER = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder"];
  const BAD = { inaccuracy: 1, mistake: 1, miss: 1, blunder: 1 };
  const NOTE = { brilliant: 1, great: 1, inaccuracy: 1, mistake: 1, miss: 1, blunder: 1 };
  const KEY = { brilliant: 1, great: 1, mistake: 1, miss: 1, blunder: 1 };
  const PVAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const STD_BOARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const MATE = 100000;
  const isMate = s => Math.abs(s) > MATE - 1000;
  const AUTO_KEY = "mc_analysis_auto";
  const isAuto = () => { try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) { return true; } };
  const setAuto = on => { try { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch (e) {} };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* шанс на победу (0..100) по оценке в сантипешках — формула lichess */
  function winPct(cp) {
    if (cp > MATE - 1000) return 100;
    if (cp < -(MATE - 1000)) return 0;
    const c = clamp(cp, -1000, 1000);
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
  }
  /* точность хода по потере шанса — формула lichess (с поправкой +1 на погрешность) */
  function moveAcc(drop) { return clamp(103.1668 * Math.exp(-0.04354 * drop) - 3.1669 + 1, 0, 100); }
  const cpOf = s => isMate(s) ? (s > 0 ? 1000 : -1000) : clamp(s, -1000, 1000);
  function mateN(s) { return MATE - Math.abs(s); }
  function fmtEval(cpWhite) {
    if (cpWhite == null) return "…";
    if (isMate(cpWhite)) {
      const n = mateN(cpWhite);
      if (n === 0) return "#";
      return (cpWhite > 0 ? "" : "-") + "M" + n;
    }
    const v = cpWhite / 100;
    if (Math.abs(v) < 0.05) return "0.0";
    return (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1);
  }
  const uciOf = m => m ? m.from + m.to + (m.promotion || "") : "";
  const sameMove = (a, b) => !!a && !!b && (a === b || (a.slice(0, 4) === b.slice(0, 4) && (a[4] || "q") === (b[4] || "q")));
  const toMove = u => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });

  /* ================= ДВИЖОК ================= */

  /* --- Stockfish (UCI через Web Worker) --- */
  function SFEngine(w, name) {
    this.kind = "sf"; this.name = name || "Stockfish 18";
    this.w = w; this.chain = Promise.resolve(); this.cur = null; this.waitFor = null; this.mpv = 1; this.dead = false;
    w.onmessage = e => String(e.data == null ? "" : e.data).split("\n").forEach(l => this._line(l.trim()));
    w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); this.dead = true; if (this.cur) this.cur.finish(); };
  }
  SFEngine.prototype.send = function (c) { try { this.w.postMessage(c); } catch (e) { this.dead = true; } };
  SFEngine.prototype._line = function (l) {
    if (!l) return;
    if (this.waitFor && l.indexOf(this.waitFor.token) === 0) { const f = this.waitFor; this.waitFor = null; f.resolve(); return; }
    const c = this.cur;
    if (!c) return;
    if (l.indexOf("bestmove") === 0) { c.best = l.split(/\s+/)[1]; c.finish(); return; }
    if (l.indexOf("info ") !== 0 || l.indexOf(" pv ") < 0) return;
    const t = l.split(/\s+/);
    let depth = 0, mpv = 1, cp = null, mate = null, bound = false, pv = null;
    for (let k = 1; k < t.length; k++) {
      const x = t[k];
      if (x === "depth") depth = +t[++k];
      else if (x === "multipv") mpv = +t[++k];
      else if (x === "score") {
        const ty = t[++k], v = +t[++k];
        if (ty === "cp") cp = v; else if (ty === "mate") mate = v;
        if (t[k + 1] === "lowerbound" || t[k + 1] === "upperbound") { bound = true; k++; }
      } else if (x === "pv") { pv = t.slice(k + 1); break; }
    }
    if (!pv || !pv.length || (cp == null && mate == null)) return;
    if (bound && c.lines[mpv - 1]) return;
    const score = mate != null ? (mate > 0 ? MATE - mate : -MATE - mate) : cp;
    c.lines[mpv - 1] = { uci: pv[0], pv, score, depth };
    if (mpv === 1) c.depth = Math.max(c.depth, depth);
  };
  SFEngine.prototype._queue = function (job) {
    const p = this.chain.then(job, job);
    this.chain = p.catch(() => {});
    return p;
  };
  SFEngine.prototype._ready = function () {
    return new Promise(res => {
      const t = setTimeout(res, 6000);
      this.waitFor = { token: "readyok", resolve: () => { clearTimeout(t); res(); } };
      this.send("isready");
    });
  };
  SFEngine.prototype.newGame = function () {
    return this._queue(() => { this.send("ucinewgame"); return this._ready(); });
  };
  SFEngine.prototype.analyse = function (fen, o) {
    return this._queue(() => new Promise(resolve => {
      if (this.dead) { resolve(null); return; }
      const c = { lines: [], depth: 0, best: null, done: false };
      let timer = null;
      c.finish = () => {
        if (c.done) return;
        c.done = true; clearTimeout(timer); this.cur = null;
        const lines = c.lines.filter(Boolean);
        if (!lines.length && c.best && c.best !== "(none)") lines.push({ uci: c.best, pv: [c.best], score: 0, depth: 0 });
        resolve(this.dead && !lines.length ? null : { lines, depth: c.depth });
      };
      this.cur = c;
      const mpv = o.multipv || 1;
      if (this.mpv !== mpv) { this.send("setoption name MultiPV value " + mpv); this.mpv = mpv; }
      this.send("position fen " + fen);
      this.send("go depth " + (o.depth || MAX_DEPTH) + " movetime " + o.movetime);
      /* страховка: движок завис — считаем его неработающим, дальше будет встроенный */
      timer = setTimeout(() => { this.dead = true; this.send("stop"); c.finish(); }, o.movetime + 8000);
    }));
  };

  function startWorker(url, ms) {
    return new Promise(resolve => {
      let w = null, done = false, name = "", ping = null;
      const end = ok => {
        if (done) return;
        done = true; clearTimeout(t); clearInterval(ping);
        if (!ok) { try { w && w.terminate(); } catch (e) {} resolve(null); }
        else resolve({ w, name });
      };
      const t = setTimeout(() => end(false), ms);
      try { w = new Worker(url); } catch (e) { end(false); return; }
      w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); end(false); };
      w.onmessage = e => {
        const s = String(e.data == null ? "" : e.data);
        if (s.indexOf("id name") === 0) name = s.slice(8).trim();
        if (s.indexOf("uciok") >= 0) end(true);
      };
      const hello = () => { try { w.postMessage("uci"); } catch (e) { end(false); } };
      hello();
      ping = setInterval(hello, 2000);
    });
  }
  function cdnWorkerUrl() {
    try {
      const src = "importScripts(" + JSON.stringify(SF_CDN + ".js") + ");";
      return URL.createObjectURL(new Blob([src], { type: "application/javascript" })) + "#" + encodeURIComponent(SF_CDN + ".wasm");
    } catch (e) { return null; }
  }

  /* --- запасной вариант: встроенный движок сайта (если Stockfish недоступен) --- */
  function LiteEngine() { this.kind = "lite"; this.name = "built-in"; this.w = null; this.ok = typeof createChessEngine === "function"; this.seq = 0; this.pend = new Map(); this.sync = null; this.chain = Promise.resolve(); }
  LiteEngine.prototype.newGame = function () { return Promise.resolve(); };
  LiteEngine.prototype._worker = function () {
    if (this.w || !this.ok) return this.w;
    try {
      const src = "var E=(" + createChessEngine.toString() + ")();" +
        "onmessage=function(e){var d=e.data,res;try{var r=E.think(d.fen,[],d.cfg);res=r.move?{uci:r.move.from+r.move.to+(r.move.promotion||''),score:r.score,depth:r.depth}:{uci:null,score:0}}catch(x){res={error:String(x)}}postMessage({id:d.id,res:res})};";
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: "application/javascript" })));
      w.onmessage = ev => { const p = this.pend.get(ev.data.id); if (p) { this.pend.delete(ev.data.id); p(ev.data.res); } };
      w.onerror = () => { this.w = null; this.pend.forEach(p => p(null)); this.pend.clear(); };
      this.w = w;
    } catch (e) { this.w = null; }
    return this.w;
  };
  LiteEngine.prototype._sync = function (fen, cfg) {
    try {
      if (!this.sync) this.sync = createChessEngine();
      const r = this.sync.think(fen, [], cfg);
      return r.move ? { uci: uciOf(r.move), score: r.score, depth: r.depth } : null;
    } catch (e) { return null; }
  };
  LiteEngine.prototype.analyse = function (fen, o) {
    const job = () => new Promise(resolve => {
      const cfg = { depth: 14, timeMs: Math.max(300, o.movetime), quiesce: true };
      const fin = r => resolve(r && r.uci ? { lines: [{ uci: r.uci, pv: [r.uci], score: r.score || 0, depth: r.depth || 0 }], depth: r.depth || 0 } : { lines: [], depth: 0 });
      if (!this.ok) { fin(null); return; }
      const w = this._worker();
      if (!w) { setTimeout(() => fin(this._sync(fen, cfg)), 0); return; }
      const id = ++this.seq;
      const timer = setTimeout(() => { this.pend.delete(id); fin(this._sync(fen, cfg)); }, cfg.timeMs * 8 + 3000);
      this.pend.set(id, res => { clearTimeout(timer); fin(res && !res.error ? res : this._sync(fen, cfg)); });
      w.postMessage({ id, fen, cfg });
    });
    const p = this.chain.then(job, job);
    this.chain = p.catch(() => {});
    return p;
  };

  const Engine = {
    p: null, lite: null,
    get() { return this.p || (this.p = this._boot()); },
    getLite() { return this.lite || (this.lite = new LiteEngine()); },
    async _boot() {
      if (typeof Worker !== "undefined" && typeof WebAssembly === "object") {
        let r = await startWorker(SF_LOCAL, 45000);
        if (!r) { const u = cdnWorkerUrl(); if (u) r = await startWorker(u, 60000); }
        if (r) {
          const e = new SFEngine(r.w, r.name);
          e.send("setoption name Hash value 32");
          await e._queue(() => e._ready());
          return e;
        }
      }
      console.warn("MaperChess: Stockfish не загрузился — анализ на встроенном движке");
      return this.getLite();
    }
  };

  /* анализ одной позиции: { lines:[{uci,move,pv,score}], score(сторона хода), ev(белые), legal, term, depth } */
  async function analysePos(fen, o) {
    const g = new Chess(fen), turn = fen.split(" ")[1];
    const legal = g.moves({ verbose: true });
    if (!legal.length) {
      const s = g.in_check() ? -MATE : 0;
      return { lines: [], score: s, ev: turn === "w" ? s : -s, legal: 0, term: true, mated: g.in_check(), depth: 0 };
    }
    let eng = await Engine.get(), r = await eng.analyse(fen, o);
    if ((!r || !r.lines.length) && eng.kind === "sf") {         // Stockfish упал посреди разбора
      Engine.p = Promise.resolve(Engine.getLite());
      eng = Engine.getLite(); r = await eng.analyse(fen, o);
    }
    let lines = (r && r.lines || []).filter(l => legal.some(m => sameMove(uciOf(m), l.uci)));
    if (!lines.length) lines = [{ uci: uciOf(legal[0]), pv: [uciOf(legal[0])], score: 0, depth: 0 }];
    lines.forEach(l => { l.move = toMove(l.uci); });
    const s = lines[0].score;
    return { lines, score: s, ev: turn === "w" ? s : -s, legal: legal.length, term: false, depth: (r && r.depth) || 0, kind: eng.kind };
  }

  /* ================= ТЕОРИЯ ДЕБЮТОВ ================= */
  const OPENINGS = [
    ["e4", "Дебют королевской пешки", "King's Pawn Opening"],
    ["e4 e5", "Открытые дебюты", "Open Game"],
    ["e4 e5 Nf3 Nc6 Bc4", "Итальянская партия", "Italian Game"],
    ["e4 e5 Nf3 Nc6 Bc4 Bc5", "Итальянская партия: Джуоко пиано", "Italian Game: Giuoco Piano"],
    ["e4 e5 Nf3 Nc6 Bc4 Bc5 c3", "Итальянская партия: главная линия", "Italian Game: Main Line"],
    ["e4 e5 Nf3 Nc6 Bc4 Bc5 d3", "Итальянская партия: Джуоко пианиссимо", "Italian Game: Giuoco Pianissimo"],
    ["e4 e5 Nf3 Nc6 Bc4 Bc5 b4", "Гамбит Эванса", "Evans Gambit"],
    ["e4 e5 Nf3 Nc6 Bc4 Nf6", "Защита двух коней", "Two Knights Defense"],
    ["e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5", "Защита двух коней: атака Ng5", "Two Knights Defense: Knight Attack"],
    ["e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7", "Атака Фегателло (жареная печень)", "Fried Liver Attack"],
    ["e4 e5 Nf3 Nc6 Bc4 Nf6 d3", "Защита двух коней: спокойная система", "Two Knights Defense: Modern Bishop's Opening"],
    ["e4 e5 Nf3 Nc6 Bc4 Be7", "Венгерская защита", "Hungarian Defense"],
    ["e4 e5 Nf3 Nc6 Bb5", "Испанская партия", "Ruy Lopez"],
    ["e4 e5 Nf3 Nc6 Bb5 a6", "Испанская партия: защита Морфи", "Ruy Lopez: Morphy Defense"],
    ["e4 e5 Nf3 Nc6 Bb5 a6 Bxc6", "Испанская партия: разменный вариант", "Ruy Lopez: Exchange Variation"],
    ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7", "Испанская партия: закрытый вариант", "Ruy Lopez: Closed"],
    ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4", "Испанская партия: открытый вариант", "Ruy Lopez: Open"],
    ["e4 e5 Nf3 Nc6 Bb5 Nf6", "Испанская партия: Берлинская защита", "Ruy Lopez: Berlin Defense"],
    ["e4 e5 Nf3 Nc6 Bb5 d6", "Испанская партия: защита Стейница", "Ruy Lopez: Steinitz Defense"],
    ["e4 e5 Nf3 Nc6 d4", "Шотландская партия", "Scotch Game"],
    ["e4 e5 Nf3 Nc6 d4 exd4 Nxd4", "Шотландская партия: главная линия", "Scotch Game: Main Line"],
    ["e4 e5 Nf3 Nc6 d4 exd4 Bc4", "Шотландский гамбит", "Scotch Gambit"],
    ["e4 e5 Nf3 Nc6 Nc3", "Дебют трёх коней", "Three Knights Opening"],
    ["e4 e5 Nf3 Nc6 Nc3 Nf6", "Дебют четырёх коней", "Four Knights Game"],
    ["e4 e5 Nf3 Nc6 c3", "Дебют Понциани", "Ponziani Opening"],
    ["e4 e5 Nf3 Nf6", "Русская партия (защита Петрова)", "Petrov's Defense"],
    ["e4 e5 Nf3 d6", "Защита Филидора", "Philidor Defense"],
    ["e4 e5 Nf3 f5", "Латышский гамбит", "Latvian Gambit"],
    ["e4 e5 Nf3 d5", "Контргамбит Эльфинстона (Слоновый гамбит)", "Elephant Gambit"],
    ["e4 e5 Nf3 f6", "Защита Дамиано", "Damiano Defense"],
    ["e4 e5 f4", "Королевский гамбит", "King's Gambit"],
    ["e4 e5 f4 exf4", "Королевский гамбит: принятый", "King's Gambit Accepted"],
    ["e4 e5 f4 Bc5", "Королевский гамбит: отказанный", "King's Gambit Declined"],
    ["e4 e5 f4 d5", "Контргамбит Фалькбеера", "Falkbeer Countergambit"],
    ["e4 e5 Nc3", "Венская партия", "Vienna Game"],
    ["e4 e5 Bc4", "Дебют слона", "Bishop's Opening"],
    ["e4 e5 d4 exd4", "Центральный дебют", "Center Game"],
    ["e4 e5 d4 exd4 c3", "Северный гамбит", "Danish Gambit"],
    ["e4 e5 Qh5", "Дебют Паркера (ранний выход ферзя)", "Wayward Queen Attack"],
    ["e4 c5", "Сицилианская защита", "Sicilian Defense"],
    ["e4 c5 Nf3 d6", "Сицилианская защита: 2…d6", "Sicilian Defense: Modern Variations"],
    ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3", "Сицилианская защита: открытый вариант", "Sicilian Defense: Open"],
    ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "Сицилианская защита: вариант Найдорфа", "Sicilian Defense: Najdorf"],
    ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6", "Сицилианская защита: вариант Дракона", "Sicilian Defense: Dragon"],
    ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6", "Сицилианская защита: Шевенинген", "Sicilian Defense: Scheveningen"],
    ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6", "Сицилианская защита: классический вариант", "Sicilian Defense: Classical"],
    ["e4 c5 Nf3 d6 Bb5+", "Сицилианская защита: Московский вариант", "Sicilian Defense: Moscow Variation"],
    ["e4 c5 Nf3 Nc6", "Сицилианская защита: 2…Nc6", "Sicilian Defense: Old Sicilian"],
    ["e4 c5 Nf3 Nc6 Bb5", "Сицилианская защита: вариант Россолимо", "Sicilian Defense: Rossolimo"],
    ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5", "Сицилианская защита: вариант Свешникова", "Sicilian Defense: Sveshnikov"],
    ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6", "Сицилианская защита: ускоренный дракон", "Sicilian Defense: Accelerated Dragon"],
    ["e4 c5 Nf3 e6", "Сицилианская защита: 2…e6", "Sicilian Defense: French Variation"],
    ["e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6", "Сицилианская защита: вариант Паульсена (Кана)", "Sicilian Defense: Kan"],
    ["e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6", "Сицилианская защита: вариант Тайманова", "Sicilian Defense: Taimanov"],
    ["e4 c5 Nc3", "Сицилианская защита: закрытый вариант", "Sicilian Defense: Closed"],
    ["e4 c5 c3", "Сицилианская защита: вариант Алапина", "Sicilian Defense: Alapin"],
    ["e4 c5 d4 cxd4 c3", "Сицилианская защита: гамбит Морра", "Sicilian Defense: Smith-Morra Gambit"],
    ["e4 c5 f4", "Сицилианская защита: атака Гран-при", "Sicilian Defense: Grand Prix Attack"],
    ["e4 e6", "Французская защита", "French Defense"],
    ["e4 e6 d4 d5", "Французская защита: главная линия", "French Defense: Normal Variation"],
    ["e4 e6 d4 d5 e5", "Французская защита: вариант продвижения", "French Defense: Advance"],
    ["e4 e6 d4 d5 Nc3", "Французская защита: 3.Nc3", "French Defense: Paulsen"],
    ["e4 e6 d4 d5 Nc3 Bb4", "Французская защита: вариант Винавера", "French Defense: Winawer"],
    ["e4 e6 d4 d5 Nc3 Nf6", "Французская защита: классический вариант", "French Defense: Classical"],
    ["e4 e6 d4 d5 Nc3 dxe4", "Французская защита: вариант Рубинштейна", "French Defense: Rubinstein"],
    ["e4 e6 d4 d5 Nd2", "Французская защита: вариант Тарраша", "French Defense: Tarrasch"],
    ["e4 e6 d4 d5 exd5", "Французская защита: разменный вариант", "French Defense: Exchange"],
    ["e4 c6", "Защита Каро-Канн", "Caro-Kann Defense"],
    ["e4 c6 d4 d5 e5", "Защита Каро-Канн: вариант продвижения", "Caro-Kann Defense: Advance"],
    ["e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5", "Защита Каро-Канн: классический вариант", "Caro-Kann Defense: Classical"],
    ["e4 c6 d4 d5 exd5 cxd5", "Защита Каро-Канн: разменный вариант", "Caro-Kann Defense: Exchange"],
    ["e4 c6 d4 d5 exd5 cxd5 c4", "Защита Каро-Канн: атака Панова", "Caro-Kann Defense: Panov Attack"],
    ["e4 d5", "Скандинавская защита", "Scandinavian Defense"],
    ["e4 d5 exd5 Qxd5", "Скандинавская защита: 2…Qxd5", "Scandinavian Defense: Main Line"],
    ["e4 d5 exd5 Nf6", "Скандинавская защита: 2…Nf6", "Scandinavian Defense: Modern"],
    ["e4 Nf6", "Защита Алехина", "Alekhine's Defense"],
    ["e4 d6", "Защита Пирца-Уфимцева", "Pirc Defense"],
    ["e4 d6 d4 Nf6 Nc3 g6", "Защита Пирца-Уфимцева: главная линия", "Pirc Defense: Main Line"],
    ["e4 g6", "Современная защита", "Modern Defense"],
    ["e4 Nc6", "Защита Нимцовича (1…Nc6)", "Nimzowitsch Defense"],
    ["e4 b6", "Защита Оуэна", "Owen's Defense"],
    ["e4 a6", "Защита Святого Георгия", "St. George Defense"],
    ["d4", "Дебют ферзевой пешки", "Queen's Pawn Opening"],
    ["d4 d5", "Закрытые дебюты", "Closed Game"],
    ["d4 d5 c4", "Ферзевый гамбит", "Queen's Gambit"],
    ["d4 d5 c4 dxc4", "Ферзевый гамбит: принятый", "Queen's Gambit Accepted"],
    ["d4 d5 c4 e6", "Ферзевый гамбит: отказанный", "Queen's Gambit Declined"],
    ["d4 d5 c4 e6 Nc3 Nf6 Bg5", "Ферзевый гамбит: ортодоксальная защита", "QGD: Orthodox"],
    ["d4 d5 c4 e6 Nc3 c5", "Защита Тарраша", "Tarrasch Defense"],
    ["d4 d5 c4 c6", "Славянская защита", "Slav Defense"],
    ["d4 d5 c4 c6 Nf3 Nf6 Nc3 e6", "Полуславянская защита", "Semi-Slav Defense"],
    ["d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4", "Славянская защита: главная линия", "Slav Defense: Main Line"],
    ["d4 d5 c4 e5", "Контргамбит Альбина", "Albin Countergambit"],
    ["d4 d5 c4 Nc6", "Защита Чигорина", "Chigorin Defense"],
    ["d4 d5 Bf4", "Лондонская система", "London System"],
    ["d4 d5 Nf3 Nf6 Bf4", "Лондонская система", "London System"],
    ["d4 Nf6 Bf4", "Лондонская система", "London System"],
    ["d4 Nf6 Nf3 e6 Bf4", "Лондонская система", "London System"],
    ["d4 d5 Nf3 Nf6 e3", "Система Колле", "Colle System"],
    ["d4 d5 e4", "Гамбит Блэкмара-Димера", "Blackmar-Diemer Gambit"],
    ["d4 Nf6 Bg5", "Атака Тромповского", "Trompowsky Attack"],
    ["d4 Nf6", "Индийские защиты", "Indian Defense"],
    ["d4 Nf6 c4", "Индийские защиты", "Indian Defense"],
    ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6", "Староиндийская защита", "King's Indian Defense"],
    ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5", "Староиндийская защита: классический вариант", "King's Indian Defense: Classical"],
    ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3", "Староиндийская защита: вариант Земиша", "King's Indian Defense: Sämisch"],
    ["d4 Nf6 c4 g6 Nc3 d5", "Защита Грюнфельда", "Grünfeld Defense"],
    ["d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4", "Защита Грюнфельда: разменный вариант", "Grünfeld Defense: Exchange"],
    ["d4 Nf6 c4 e6 Nc3 Bb4", "Защита Нимцовича", "Nimzo-Indian Defense"],
    ["d4 Nf6 c4 e6 Nf3 b6", "Новоиндийская защита", "Queen's Indian Defense"],
    ["d4 Nf6 c4 e6 Nf3 Bb4+", "Защита Боголюбова", "Bogo-Indian Defense"],
    ["d4 Nf6 c4 e6 g3", "Каталонское начало", "Catalan Opening"],
    ["d4 Nf6 c4 e6 g3 d5", "Каталонское начало", "Catalan Opening"],
    ["d4 Nf6 c4 c5 d5", "Защита Бенони", "Benoni Defense"],
    ["d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6", "Защита Бенони: современный вариант", "Modern Benoni"],
    ["d4 Nf6 c4 c5 d5 b5", "Волжский гамбит (гамбит Бенко)", "Benko Gambit"],
    ["d4 Nf6 c4 e5", "Будапештский гамбит", "Budapest Gambit"],
    ["d4 Nf6 c4 d6", "Древнеиндийская защита", "Old Indian Defense"],
    ["d4 f5", "Голландская защита", "Dutch Defense"],
    ["d4 f5 c4 Nf6 g3 e6 Bg2 d5", "Голландская защита: каменная стена", "Dutch Defense: Stonewall"],
    ["d4 f5 c4 Nf6 g3 g6", "Голландская защита: Ленинградский вариант", "Dutch Defense: Leningrad"],
    ["d4 e5", "Гамбит Энглунда", "Englund Gambit"],
    ["d4 e6", "Французская структура против 1.d4", "Horwitz Defense"],
    ["c4", "Английское начало", "English Opening"],
    ["c4 e5", "Английское начало: обратная сицилианская", "English Opening: Reversed Sicilian"],
    ["c4 e5 Nc3 Nf6", "Английское начало: два коня", "English Opening: Two Knights"],
    ["c4 c5", "Английское начало: симметричный вариант", "English Opening: Symmetrical"],
    ["c4 Nf6", "Английское начало: индийский вариант", "English Opening: Anglo-Indian"],
    ["c4 e6", "Английское начало: 1…e6", "English Opening: Agincourt Defense"],
    ["Nf3", "Дебют Цукерторта-Рети", "Zukertort Opening"],
    ["Nf3 d5 c4", "Дебют Рети", "Réti Opening"],
    ["Nf3 d5 g3", "Дебют Рети: королевский фианкетто", "Réti Opening: King's Indian Attack"],
    ["Nf3 Nf6 g3", "Дебют Рети: королевский фианкетто", "Réti Opening: King's Indian Attack"],
    ["g3", "Дебют Бенко (королевский фианкетто)", "Hungarian Opening"],
    ["b3", "Дебют Нимцовича-Ларсена", "Nimzo-Larsen Attack"],
    ["f4", "Дебют Бёрда", "Bird's Opening"],
    ["f4 e5", "Гамбит Фрома", "From's Gambit"],
    ["Nc3", "Дебют Ван-Гейта", "Van Geet Opening"],
    ["b4", "Дебют Сокольского (орангутанг)", "Polish Opening"],
    ["e3", "Дебют Ван-Крейсберга", "Van 't Kruijs Opening"],
    ["d3", "Дебют Мизеса", "Mieses Opening"],
    ["c3", "Сарагосское начало", "Saragossa Opening"]
  ];
  let THEORY = null;
  function theory() {
    if (THEORY) return THEORY;
    const prefixes = new Set(), names = new Map();
    const addLine = (uciList, name) => {
      for (let k = 1; k <= uciList.length; k++) prefixes.add(uciList.slice(0, k).join(" "));
      if (name) names.set(uciList.join(" "), name);
    };
    OPENINGS.forEach(([san, ru, en]) => {
      try {
        const g = new Chess(START_FEN), list = [];
        for (const m of san.split(" ")) { const mv = g.move(m); if (!mv) return; list.push(uciOf(mv)); }
        addLine(list, { ru, en });
      } catch (e) {}
    });
    try { if (typeof _aiBook === "function") _aiBook().forEach(line => addLine(line, null)); } catch (e) {}
    return (THEORY = { prefixes, names });
  }

  /* ================= ТАКТИЧЕСКИЕ ПОМОЩНИКИ ================= */
  /* материальный баланс для color на «спокойном» конце линии */
  function lineMaterial(fen, pv, max, color) {
    const out = { net: 0, lost: [], won: [] };
    try {
      const g = new Chess(fen);
      let net = 0, settled = 0, lost = [], won = [], sLost = [], sWon = [];
      const n = Math.min(max, pv.length);
      for (let k = 0; k < n; k++) {
        const mv = g.move(toMove(pv[k]));
        if (!mv) break;
        if (mv.captured) {
          const v = PVAL[mv.captured];
          if (mv.color === color) { net += v; won.push(mv.captured); } else { net -= v; lost.push(mv.captured); }
        }
        if (mv.promotion) { const v = PVAL[mv.promotion] - 1; net += mv.color === color ? v : -v; }
        const next = pv[k + 1];
        let nextCap = false;
        if (next && k + 1 < n) { const sq = next.slice(2, 4); nextCap = !!g.get(sq); }
        if (!nextCap) { settled = net; sLost = lost.slice(); sWon = won.slice(); }
      }
      out.net = settled; out.lost = sLost; out.won = sWon;
    } catch (e) {}
    return out;
  }
  function pieceForValue(list, v) {
    if (v === 1) return "p";
    const s = list.slice().sort((a, b) => PVAL[b] - PVAL[a]).find(t => PVAL[t] <= v + 1 && PVAL[t] >= v - 1);
    return s || null;
  }
  function pvSan(fen, pv, max) {
    try {
      const g = new Chess(fen), parts = [];
      let num = parseInt(fen.split(" ")[5], 10) || 1, turn = fen.split(" ")[1];
      for (let k = 0; k < Math.min(max, pv.length); k++) {
        const mv = g.move(toMove(pv[k]));
        if (!mv) break;
        if (turn === "w") parts.push(num + ". " + mv.san);
        else parts.push((k === 0 ? num + "… " : "") + mv.san);
        if (turn === "b") num++;
        turn = turn === "w" ? "b" : "w";
      }
      return parts.join(" ");
    } catch (e) { return ""; }
  }
  function sanOf(fen, uci) {
    try { const g = new Chess(fen); const mv = g.move(toMove(uci)); return mv ? mv.san : null; } catch (e) { return null; }
  }
  /* «жертва»: после хода у соперника есть выгодное взятие нашей фигуры, которого не было до хода */
  function isSacrifice(p) {
    try {
      const g = new Chess(p.fenAfter);
      if (g.in_checkmate()) return false;
      const took = new Chess(p.fenBefore).get(p.to);
      const gain = took ? PVAL[took.type] : 0;
      const fb = p.fenBefore.split(" "); fb[1] = fb[1] === "w" ? "b" : "w"; fb[3] = "-";
      let pre = [];
      try { const gb = new Chess(fb.join(" ")); pre = gb.moves({ verbose: true }).filter(m => m.captured).map(m => m.from + m.to); } catch (e) {}
      const caps = g.moves({ verbose: true }).filter(m => m.captured && m.captured !== "p" && m.captured !== "k");
      for (const m of caps) {
        const v = PVAL[m.captured];
        if (v <= gain) continue;
        if (m.to !== p.to && pre.indexOf(m.from + m.to) >= 0) continue;
        g.move(m);
        const re = g.moves({ verbose: true }).some(x => x.to === m.to && x.captured);
        g.undo();
        const loss = re ? v - PVAL[m.piece] : v;
        if (loss - gain >= 2) return true;
      }
    } catch (e) {}
    return false;
  }
  function phaseOf(fen, ply) {
    let mat = 0;
    const board = fen.split(" ")[0];
    for (const ch of board) { const t = ch.toLowerCase(); if ("nbrq".indexOf(t) >= 0) mat += PVAL[t]; }
    if (mat <= 26) return "end";
    if (ply < 20) return "open";
    return "middle";
  }

  /* ================= РАЗБОР ПАРТИИ ================= */
  /* data: { startFen, moves:[{from,to,promotion}], pc, result, resigned, base, oppName } */
  function Review(data) {
    this.data = data;
    this.plies = [];
    this.pos = [];
    this.progress = 0;
    this.stage = "engine";
    this.done = false;
    this.cancelled = false;
    this.listeners = [];
    this.depthSum = 0; this.depthN = 0;
    const g = new Chess(data.startFen);
    data.moves.forEach(m => {
      const before = g.fen();
      const mv = g.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
      if (!mv) return;
      this.plies.push({ san: mv.san, uci: uciOf(mv), color: mv.color, from: mv.from, to: mv.to, piece: mv.piece, fenBefore: before, fenAfter: g.fen() });
    });
    const skip = Math.min(data.base || 0, this.plies.length);
    if (skip > 0) {
      this.bookOk = false;
      this.plies = this.plies.slice(skip);
      if (!this.plies.length) this.data = Object.assign({}, data, { startFen: g.fen() });
    } else this.bookOk = (data.startFen || "").split(" ")[0] === STD_BOARD;
    this.base = 0;
  }
  Review.prototype.on = function (fn) { this.listeners.push(fn); };
  Review.prototype._emit = function () { this.listeners.forEach(fn => { try { fn(this); } catch (e) {} }); };
  Review.prototype.fens = function () {
    return [this.plies.length ? this.plies[0].fenBefore : this.data.startFen].concat(this.plies.map(p => p.fenAfter));
  };
  Review.prototype.run = async function () {
    const fens = this.fens(), total = fens.length;
    this._emit();
    const eng = await Engine.get();
    if (this.cancelled) return;
    this.engineKind = eng.kind;
    this.stage = "analyse";
    this._emit();
    try { await eng.newGame(); } catch (e) {}
    const movetime = clamp(Math.round(BUDGET_MS / total), MOVETIME_MIN, MOVETIME_MAX);
    for (let i = 0; i < total; i++) {
      if (this.cancelled) return;
      const r = await analysePos(fens[i], { movetime, depth: MAX_DEPTH, multipv: MULTIPV });
      this.pos[i] = r;
      if (r.kind) this.engineKind = r.kind;
      if (!r.term && r.depth) { this.depthSum += r.depth; this.depthN++; }
      this.progress = Math.round((i + 1) / total * 100);
      this.posDone = i + 1; this.posTotal = total;
      this._emit();
    }
    this.avgDepth = this.depthN ? Math.round(this.depthSum / this.depthN) : 0;
    this._classify();
    this.done = true;
    this._emit();
  };

  Review.prototype._classify = function () {
    const th = this.bookOk ? theory() : null;
    const played = [];
    let inBookStill = !!th;
    this.opening = null;
    this.plies.forEach((p, i) => {
      const a = this.pos[i], b = this.pos[i + 1];
      const lines = a.lines || [];
      const bestScore = a.score;                       // для ходящего
      const k = lines.findIndex(l => sameMove(l.uci, p.uci));
      let afterScore = -b.score;
      if (k >= 0) afterScore = lines[k].score;         // та же глубина поиска — честнее сравнение
      const before = winPct(bestScore), after = winPct(afterScore);
      const drop = Math.max(0, before - after);
      const cpLoss = Math.min(1000, Math.max(0, cpOf(bestScore) - cpOf(afterScore)));
      p.winBefore = before; p.winAfter = after; p.drop = drop; p.cpLoss = cpLoss;
      p.scoreBest = bestScore; p.scoreAfter = afterScore;

      let c;
      if (a.legal === 1) c = "forced";
      else if (k === 0 || (cpLoss <= 8 && drop <= 0.6)) c = "best";
      else if (drop < 2) c = "excellent";
      else if (drop < 5) c = "good";
      else if (drop < 10) c = "inaccuracy";
      else if (drop < 15) c = "mistake";
      else c = "blunder";

      /* разрешил мат, хотя форсированного проигрыша не было — всегда зевок */
      if (isMate(afterScore) && afterScore < 0 && !(isMate(bestScore) && bestScore < 0) && a.legal > 1) c = "blunder";
      /* потеря 2+ пешек в не решающей позиции — не «хорошо» */
      if ((c === "excellent" || c === "good") && cpLoss >= 200 && cpOf(afterScore) < 600) c = "inaccuracy";
      /* был форсированный мат и его упустили */
      p.missedMate = isMate(bestScore) && bestScore > 0 && !(isMate(afterScore) && afterScore > 0);
      if (p.missedMate && !BAD[c] && c !== "forced") c = "inaccuracy";

      const prev = i > 0 ? this.plies[i - 1] : null;
      const prevErr = !!prev && prev.drop >= 10;

      /* теория */
      played.push(p.uci);
      let book = false;
      if (inBookStill) {
        const key = played.join(" ");
        if (th.prefixes.has(key)) {
          book = true;
          const nm = th.names.get(key);
          if (nm) this.opening = nm;
        } else inBookStill = false;
      }
      if (book && !BAD[c] && drop < 6 && c !== "forced") c = "book";
      else {
        if ((c === "mistake" || c === "blunder") && prevErr && before >= 60) c = "miss";
        if ((c === "best" || c === "excellent") && drop < 1 && after >= 45 && (before < 95 || (isMate(afterScore) && afterScore > 0)) && isSacrifice(p)) c = "brilliant";
        else if (c === "best" && a.legal > 1 && lines[1] && after >= 40 && !(b.term && b.mated)) {
          const gap = winPct(lines[0].score) - winPct(lines[1].score);
          if (gap >= 15) { c = "great"; p.greatWhy = "only"; }
          else if (prevErr && gap >= 8) { c = "great"; p.greatWhy = "punish"; }
        }
      }
      p.cls = c;
      p.bestMove = lines[0] ? lines[0].move : null;
      p.bestUci = lines[0] ? lines[0].uci : null;
      p.bestSan = p.bestUci ? (sameMove(p.bestUci, p.uci) ? p.san : sanOf(p.fenBefore, p.bestUci)) : null;
      p.bestLine = lines[0] ? pvSan(p.fenBefore, lines[0].pv, 7) : "";
      p.bestEvW = lines[0] ? (p.color === "w" ? lines[0].score : -lines[0].score) : null;
      const rl = b.lines && b.lines[0];
      p.reply = rl ? { from: rl.move.from, to: rl.move.to, san: sanOf(p.fenAfter, rl.uci), line: pvSan(p.fenAfter, rl.pv, 6) } : null;
      p.phase = phaseOf(p.fenBefore, i);
      p.acc = moveAcc(drop);
      p.reason = this._reason(p, a, b);
    });
    this._stats();
  };

  /* почему ход плохой/хороший — конкретная причина */
  Review.prototype._reason = function (p, a, b) {
    const c = p.cls;
    if (!BAD[c]) {
      if (c === "brilliant") return { key: "rBrilliant" };
      return null;
    }
    const bm = p.bestSan ? `<b>${esc(p.bestSan)}</b>` : "";
    /* мат на доске / разрешён мат */
    if (isMate(p.scoreAfter) && p.scoreAfter < 0) return { key: "xAllowsMate", v: { n: mateN(p.scoreAfter) } };
    if (p.missedMate) return { key: "xMissedMate", v: { n: mateN(p.scoreBest) } };
    /* материал: линия после сыгранного хода против лучшей линии */
    const rl = b.lines && b.lines[0], bl = a.lines && a.lines[0];
    if (rl && bl) {
      const playedLine = [p.uci].concat(rl.pv);
      const mPlayed = lineMaterial(p.fenBefore, playedLine, 9, p.color);
      const mBest = lineMaterial(p.fenBefore, bl.pv, 9, p.color);
      const diff = mBest.net - mPlayed.net;
      /* материал объясняет потерю, только если он соразмерен падению оценки */
      if (diff >= 1 && diff * 100 >= p.cpLoss * 0.6) {
        /* фигура под боем: соперник сразу забирает то, что стоит на поле хода */
        if (rl.move.to === p.to && diff >= 2 && mPlayed.net <= -2) {
          const moved = new Chess(p.fenAfter).get(p.to);
          if (moved && PVAL[moved.type] >= 3) return { key: "xHangs", v: { P: PN("nom", moved.type), m: `<b class="bad">${esc(sanOf(p.fenAfter, rl.uci) || "")}</b>` } };
        }
        if (mPlayed.net < 0 || mBest.net <= 0) {
          const t = pieceForValue(mPlayed.lost, diff);
          return { key: "xLoses", v: { p: t ? PN("acc", t) : L("materialN", { n: diff }) } };
        }
        if (mBest.net >= 2 && bm) {
          const t = pieceForValue(mBest.won, diff);
          return { key: "xMissedWin", v: { m: bm, p: t ? PN("acc", t) : L("materialN", { n: diff }) } };
        }
      }
    }
    if (p.winBefore >= 70 && p.winAfter < 60) {
      const ew = s => fmtEval(p.color === "w" ? s : -s);
      return { key: "xLostAdv", v: { a: ew(p.scoreBest), b: ew(p.scoreAfter) } };
    }
    if (p.winAfter < 15 && p.winBefore >= 25) return { key: "xLostNow" };
    if (p.winAfter < 35 && p.winBefore >= 45) return { key: "xWorseNow" };
    return null;
  };

  /* точность (формула lichess), ACPL, стадии, счётчики, ключевые моменты */
  Review.prototype._stats = function () {
    const wins = this.pos.map(x => winPct(x.ev));        // глазами белых
    const n = this.plies.length;
    const ws = clamp(Math.floor(n / 10), 2, 8);
    const weights = [];
    if (wins.length >= 2) {
      const sd = arr => { const m = arr.reduce((s, x) => s + x, 0) / arr.length; return Math.sqrt(arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length); };
      const w0 = wins.slice(0, Math.min(ws, wins.length));
      for (let k = 0; k < Math.min(ws, wins.length) - 2; k++) weights.push(clamp(sd(w0), 0.5, 12));
      for (let k = 0; k + ws <= wins.length; k++) weights.push(clamp(sd(wins.slice(k, k + ws)), 0.5, 12));
    }
    while (weights.length < n) weights.push(1);
    const acc = { w: [], b: [] }, wgt = { w: [], b: [] }, loss = { w: [], b: [] };
    const ph = { w: { open: [], middle: [], end: [] }, b: { open: [], middle: [], end: [] } };
    this.plies.forEach((p, i) => {
      acc[p.color].push(p.acc); wgt[p.color].push(weights[i]); loss[p.color].push(p.cpLoss);
      ph[p.color][p.phase].push(p.acc);
    });
    const gameAcc = c => {
      const a = acc[c];
      if (!a.length) return null;
      const sw = wgt[c].reduce((s, x) => s + x, 0);
      const weighted = a.reduce((s, x, k) => s + x * wgt[c][k], 0) / sw;
      const harmonic = a.length / a.reduce((s, x) => s + 1 / Math.max(x, 1), 0);
      return Math.round((weighted + harmonic) / 2 * 10) / 10;
    };
    const mean = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
    this.accuracy = { w: gameAcc("w"), b: gameAcc("b") };
    this.acpl = { w: loss.w.length ? Math.round(mean(loss.w)) : null, b: loss.b.length ? Math.round(mean(loss.b)) : null };
    this.phases = {};
    ["w", "b"].forEach(c => {
      this.phases[c] = {};
      ["open", "middle", "end"].forEach(k => { const m = mean(ph[c][k]); this.phases[c][k] = m == null ? null : Math.round(m); });
    });
    this.counts = { w: {}, b: {} };
    this.keys = [];
    this.plies.forEach((p, i) => {
      const k = p.cls === "forced" ? "best" : p.cls;
      if (KEY[p.cls]) this.keys.push(i + 1);
      this.counts[p.color][k] = (this.counts[p.color][k] || 0) + 1;
    });
  };
  Review.prototype.mistakes = function () {
    const pc = this.data.pc;
    return this.plies.map((p, i) => ({ p, i })).filter(x => x.p.color === pc && BAD[x.p.cls] && x.p.bestMove);
  };

  /* ---------------- утилиты DOM ---------------- */
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function startNo(rv) { return parseInt((rv.plies[0] ? rv.plies[0].fenBefore : rv.data.startFen).split(" ")[5], 10) || 1; }
  function moveLabel(rv, i) {      // i — индекс полухода (0..)
    const p = rv.plies[i];
    const n = parseInt(p.fenBefore.split(" ")[5], 10) || 1;
    return n + (p.color === "w" ? ". " : "… ") + p.san;
  }
  function reasonText(r) {
    if (!r) return "";
    return L(r.key, r.v);
  }

  /* ---------------- окно анализа ---------------- */
  const View = {
    root: null, rv: null, idx: 0, board: null, game: null, autoTimer: null,
    fix: null, train: null,

    open(rv) {
      this.close(true);
      this.rv = rv;
      this.idx = 0;
      this.fix = null; this.train = null;
      this._shownDone = false;
      this._build();
      document.body.classList.add("an-lock");
      requestAnimationFrame(() => this.root && this.root.classList.add("open"));
      rv.on(r => { if (this.rv === r) this._onProgress(); });
      this._onProgress();
      this.go(0);
    },

    close(silent) {
      this._stopAuto();
      if (this._key) { document.removeEventListener("keydown", this._key); this._key = null; }
      if (!this.root) return;
      const r = this.root;
      this.root = null; this.board = null;
      document.body.classList.remove("an-lock");
      if (silent) { r.remove(); return; }
      r.classList.remove("open");
      setTimeout(() => r.remove(), 280);
    },

    _build() {
      const rv = this.rv, d = rv.data;
      const resKey = d.resigned ? "resigned" : d.result;
      const root = el("div", "an-overlay");
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.innerHTML = `
        <div class="an-shell">
          <header class="an-head">
            <div class="an-head-l">
              <span class="an-kicker">MaperChess</span>
              <h2 class="an-title">${L("title")}</h2>
              <span class="an-result an-res-${esc(d.result)}">${L(resKey)}</span>
              <div class="an-sub">
                <span class="an-opening" hidden></span>
                <span class="an-engine"></span>
              </div>
            </div>
            <div class="an-head-r">
              <label class="an-auto" title="${esc(L("autoHint"))}">
                <input type="checkbox" ${isAuto() ? "checked" : ""}/>
                <span class="an-switch"><i></i></span>
                <span>${L("auto")}</span>
              </label>
              <button class="an-x" type="button" aria-label="${esc(L("close"))}">✕</button>
            </div>
          </header>
          <div class="an-body">
            <section class="an-left">
              <div class="an-board-row">
                <div class="an-evalbar"><div class="an-evalbar-fill"></div><span class="an-evalbar-num">0.0</span></div>
                <div class="an-board-box">
                  <div class="board an-board"></div>
                  <div class="an-toast" hidden></div>
                </div>
              </div>
              <div class="an-controls">
                <button class="an-ctl" data-a="first" aria-label="first">⏮</button>
                <button class="an-ctl" data-a="prev" aria-label="prev">◀</button>
                <button class="an-ctl an-ctl-play" data-a="play" aria-label="play">▶</button>
                <button class="an-ctl" data-a="next" aria-label="next">▶︎▶︎</button>
                <button class="an-ctl" data-a="last" aria-label="last">⏭</button>
                <button class="an-ctl an-ctl-key" data-a="kprev" aria-label="${esc(L("keyPrev"))}" title="${esc(L("keyPrev"))}">◀★</button>
                <button class="an-ctl an-ctl-key" data-a="knext" aria-label="${esc(L("keyNext"))}" title="${esc(L("keyNext"))}">★▶</button>
              </div>
            </section>
            <section class="an-right">
              <div class="an-loading">
                <div class="an-loading-ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="an-lr-val" cx="22" cy="22" r="19"/></svg><b>0%</b></div>
                <div><div class="an-loading-t">${L("loadingEngine")}</div><div class="an-loading-s"></div><div class="an-loading-bar"><i></i></div></div>
              </div>
              <div class="an-summary" hidden></div>
              <div class="an-coach"></div>
              <div class="an-lines-box" hidden>
                <div class="an-sec-t">${L("lines")}</div>
                <div class="an-lines"></div>
              </div>
              <div class="an-graph-box" hidden>
                <div class="an-sec-t">${L("evalGraph")}</div>
                <svg class="an-graph" viewBox="0 0 300 80" preserveAspectRatio="none"></svg>
              </div>
              <div class="an-moves-box">
                <div class="an-sec-t">${L("moves")}</div>
                <div class="an-moves"></div>
              </div>
            </section>
          </div>
        </div>`;
      document.body.appendChild(root);
      this.root = root;
      this.$ = s => root.querySelector(s);

      root.addEventListener("click", e => { if (e.target === root) this.close(); });
      this.$(".an-x").addEventListener("click", () => this.close());
      this.$(".an-auto input").addEventListener("change", e => setAuto(e.target.checked));
      root.querySelectorAll(".an-ctl").forEach(b => b.addEventListener("click", () => {
        const a = b.dataset.a;
        if (a === "play") { this.autoTimer ? this._stopAuto() : this._startAuto(); return; }
        this._stopAuto();
        if (a === "first") this.go(0);
        if (a === "prev") this.go(this.idx - 1);
        if (a === "next") this.go(this.idx + 1);
        if (a === "last") this.go(rv.plies.length);
        if (a === "kprev" || a === "knext") {
          const ks = rv.keys || [];
          const t = a === "knext" ? ks.find(k => k > this.idx) : ks.slice().reverse().find(k => k < this.idx);
          if (t != null) { this._exitFix(); this.go(t); }
        }
      }));
      if (this._key) document.removeEventListener("keydown", this._key);
      this._key = e => {
        if (!this.root) return;
        if (e.key === "Escape") { this.close(); }
        else if (this.fix) return;
        else if (e.key === "ArrowLeft") { this._stopAuto(); this.go(this.idx - 1); }
        else if (e.key === "ArrowRight") { this._stopAuto(); this.go(this.idx + 1); }
      };
      document.addEventListener("keydown", this._key);

      this.game = new Chess(rv.plies.length ? rv.plies[0].fenBefore : d.startFen);
      this.board = new BoardView(this.$(".an-board"), {
        playerColor: null, orientation: d.pc,
        onMove: (from, to) => this._onBoardMove(from, to)
      });
      this.board.setLocked(true);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "an-arrows");
      svg.setAttribute("viewBox", "0 0 8 8");
      this.$(".an-board-box").appendChild(svg);
      this.arrows = svg;

      this._renderMoves();
    },

    _engineLabel() {
      const rv = this.rv, e = this.$(".an-engine");
      if (!e) return;
      if (!rv.engineKind) { e.textContent = L("loadingEngine"); e.className = "an-engine"; return; }
      if (rv.engineKind === "sf") {
        const d = rv.avgDepth || (rv.depthN ? Math.round(rv.depthSum / rv.depthN) : 0);
        e.textContent = L("engineSf", { d: d || "…" });
        e.className = "an-engine is-sf";
      } else { e.textContent = L("engineLite"); e.className = "an-engine is-lite"; }
    },

    _onProgress() {
      if (!this.root) return;
      const rv = this.rv;
      const p = rv.progress;
      this.$(".an-loading b").textContent = p + "%";
      this.$(".an-loading-bar i").style.width = p + "%";
      this.$(".an-lr-val").style.strokeDashoffset = String(119.4 * (1 - p / 100));
      this.$(".an-loading-t").textContent = rv.stage === "engine" ? L("loadingEngine") : L("analysing");
      this.$(".an-loading-s").textContent = rv.posTotal ? L("analysingPly", { a: rv.posDone, b: rv.posTotal }) : "";
      this._engineLabel();
      if (!rv.done) { this._evalBar(rv.pos[this.idx] ? rv.pos[this.idx].ev : null); }
      if (rv.done && !this._shownDone) {
        this._shownDone = true;
        this.$(".an-loading").hidden = true;
        this.root.classList.add("an-ready");
        const op = this.$(".an-opening");
        if (rv.opening) { op.textContent = L("opening") + ": " + rv.opening[lang()]; op.hidden = false; }
        this._renderSummary();
        this._renderGraph();
        this._renderMoves();
        this.go(this.idx);
      }
    },

    /* ----- сводка ----- */
    _renderSummary() {
      const rv = this.rv, pc = rv.data.pc, oc = pc === "w" ? "b" : "w";
      const box = this.$(".an-summary");
      const ring = (v, cls) => {
        const c = 2 * Math.PI * 30, val = v == null ? 0 : v, off = c * (1 - val / 100);
        return `<div class="an-ring ${cls}"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30"/><circle class="v" cx="36" cy="36" r="30" style="stroke-dasharray:${c};stroke-dashoffset:${c}" data-off="${off}"/></svg><b>${v == null ? "—" : v.toFixed(1)}</b></div>`;
      };
      const rows = ORDER.filter(k => (rv.counts[pc][k] || 0) + (rv.counts[oc][k] || 0) > 0 || k === "best" || k === "blunder").map(k => `
        <div class="an-crow an-c-${k}">
          <span class="an-cnum">${rv.counts[pc][k] || 0}</span>
          <span class="an-clabel"><i class="an-badge an-b-${k}">${CLS[k].icon}</i>${L(k)}</span>
          <span class="an-cnum">${rv.counts[oc][k] || 0}</span>
        </div>`).join("");
      const ph = rv.phases[pc];
      const phCell = (k, label) => {
        const v = ph[k];
        const tone = v == null ? "na" : v >= 85 ? "hi" : v >= 65 ? "mid" : "lo";
        return `<div class="an-ph an-ph-${tone}"><b>${v == null ? "—" : v + "%"}</b><span>${label}</span></div>`;
      };
      const mist = rv.mistakes();
      box.innerHTML = `
        <div class="an-players">
          <div class="an-player me">${ring(rv.accuracy[pc], "me")}<span>${L("you")}</span></div>
          <div class="an-vs">${L("accuracy")}</div>
          <div class="an-player opp">${ring(rv.accuracy[oc], "opp")}<span>${esc(rv.data.oppName || L("bot"))}</span></div>
        </div>
        <div class="an-acpl" title="${esc(L("acplHint"))}">
          <b>${rv.acpl[pc] == null ? "—" : rv.acpl[pc]}</b><span>${L("acpl")} (ACPL)</span><b>${rv.acpl[oc] == null ? "—" : rv.acpl[oc]}</b>
        </div>
        <div class="an-counts">${rows}</div>
        <div class="an-phases-box">
          <div class="an-sec-t">${L("phases")}</div>
          <div class="an-phases">${phCell("open", L("phOpening"))}${phCell("middle", L("phMiddle"))}${phCell("end", L("phEnd"))}</div>
        </div>
        <div class="an-keys">
          <div class="an-sec-t">${L("keyMoments")}</div>
          ${rv.keys.length ? `<div class="an-keys-list">${rv.keys.map(n => {
            const kp = rv.plies[n - 1];
            return `<button type="button" class="an-key an-k-${kp.cls}${kp.color === pc ? " mine" : ""}" data-i="${n}"><i class="an-badge an-b-${kp.cls}">${CLS[kp.cls].icon}</i>${esc(moveLabel(rv, n - 1))}</button>`;
          }).join("")}</div>` : `<div class="an-keys-none">${L("noKey")}</div>`}
        </div>
        <button class="an-train ${mist.length ? "" : "is-clean"}" type="button" ${mist.length ? "" : "disabled"}>
          <span class="an-train-ic">${mist.length ? "⚔" : "✦"}</span>
          <span class="an-train-t">${mist.length ? L("train") : L("noMistakes")}</span>
          ${mist.length ? `<span class="an-train-n">${L("trainCount", { n: mist.length })}</span>` : ""}
        </button>`;
      box.hidden = false;
      requestAnimationFrame(() => setTimeout(() => box.querySelectorAll(".an-ring .v").forEach(c => { c.style.strokeDashoffset = c.dataset.off; }), 60));
      box.querySelectorAll(".an-key").forEach(b => b.addEventListener("click", () => { this._stopAuto(); this._exitFix(); this.go(+b.dataset.i); }));
      const tb = box.querySelector(".an-train");
      if (mist.length) tb.addEventListener("click", () => this._startTrain());
    },

    /* ----- график оценки ----- */
    _renderGraph() {
      const rv = this.rv, svg = this.$(".an-graph"), n = rv.pos.length;
      if (n < 2) return;
      const W = 300, H = 80;
      const y = i => H - winPct(rv.pos[i].ev) / 100 * H;
      const x = i => i / (n - 1) * W;
      let d = `M0 ${H} `;
      for (let i = 0; i < n; i++) d += `L${x(i).toFixed(2)} ${y(i).toFixed(2)} `;
      d += `L${W} ${H} Z`;
      let dots = "";
      rv.plies.forEach((p, i) => {
        if (p.cls === "mistake" || p.cls === "blunder" || p.cls === "miss" || p.cls === "brilliant" || p.cls === "great")
          dots += `<circle class="an-gdot an-gd-${p.cls}" cx="${x(i + 1).toFixed(2)}" cy="${y(i + 1).toFixed(2)}" r="2.6"/>`;
      });
      svg.innerHTML = `<rect class="an-gbg" x="0" y="0" width="${W}" height="${H}"/><path class="an-garea" d="${d}"/><line class="an-gmid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>${dots}<line class="an-gcur" x1="0" y1="0" x2="0" y2="${H}"/>`;
      this.$(".an-graph-box").hidden = false;
      svg.onclick = e => {
        const r = svg.getBoundingClientRect();
        const i = Math.round((e.clientX - r.left) / r.width * (n - 1));
        this._stopAuto(); this._exitFix(); this.go(i);
      };
    },

    /* ----- список ходов ----- */
    _renderMoves() {
      const rv = this.rv, box = this.$(".an-moves");
      let html = "";
      const firstBlack = rv.plies[0] && rv.plies[0].color === "b";
      let num = startNo(rv);
      rv.plies.forEach((p, i) => {
        if (p.color === "w" || (i === 0 && firstBlack)) {
          html += `<span class="an-mnum">${num}.</span>`;
          if (i === 0 && firstBlack) html += `<span class="an-mv an-mv-empty">…</span>`;
        }
        const c = rv.done && NOTE[p.cls] ? p.cls : "";
        const mine = p.color === rv.data.pc ? " mine" : "";
        html += `<button type="button" class="an-mv${mine} ${c ? "an-m-" + c : ""}" data-i="${i + 1}">${c ? `<i class="an-badge an-b-${c}">${CLS[c].icon}</i>` : ""}<span>${esc(p.san)}</span></button>`;
        if (p.color === "b") num++;
      });
      box.innerHTML = html;
      box.querySelectorAll(".an-mv[data-i]").forEach(b => b.addEventListener("click", () => {
        this._stopAuto(); this._exitFix(); this.go(+b.dataset.i);
      }));
      this._markMove();
    },
    _markMove() {
      if (!this.root) return;
      const box = this.$(".an-moves");
      box.querySelectorAll(".an-mv.cur").forEach(b => b.classList.remove("cur"));
      const b = box.querySelector(`.an-mv[data-i="${this.idx}"]`);
      if (b) {
        b.classList.add("cur");
        const top = b.offsetTop - box.offsetTop;
        if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) box.scrollTo({ top: top - box.clientHeight / 2, behavior: "smooth" });
      } else if (this.idx === 0) box.scrollTop = 0;
    },

    /* ----- переход к позиции после хода idx (0 = старт) ----- */
    go(i) {
      if (!this.root) return;
      const rv = this.rv;
      i = Math.max(0, Math.min(rv.plies.length, i));
      this.idx = i;
      const fen = i === 0 ? (rv.plies[0] ? rv.plies[0].fenBefore : rv.data.startFen) : rv.plies[i - 1].fenAfter;
      this.game.load(fen);
      const p = i > 0 ? rv.plies[i - 1] : null;
      this.board.clearSelection();
      this.board.setLocked(true);
      this.board.attach(this.game, p ? { from: p.from, to: p.to } : null);
      this._paintSquares(p);
      this._arrowsFor(p);
      this._evalBar(rv.pos[i] ? rv.pos[i].ev : null);
      this._coach(p, i);
      this._lines(i, fen);
      this._markMove();
      this._graphCursor();
    },

    _paintSquares(p) {
      const sqs = this.board.squares;
      Object.keys(sqs).forEach(k => { sqs[k].classList.remove("an-sq-bad", "an-sq-good", "an-sq-best"); sqs[k].removeAttribute("data-an"); });
      if (!p || !this.rv.done) return;
      const t = sqs[p.to];
      if (!t) return;
      t.classList.add(BAD[p.cls] ? "an-sq-bad" : (p.cls === "best" ? "an-sq-best" : "an-sq-good"));
      t.setAttribute("data-an", CLS[p.cls].icon);
      t.style.setProperty("--an-c", `var(--an-${p.cls})`);
    },

    _arrow(from, to, cls) {
      const flip = this.board.orientation === "b";
      const c = sq => {
        const f = sq.charCodeAt(0) - 97, r = +sq[1];
        return flip ? [7 - f + 0.5, r - 1 + 0.5] : [f + 0.5, 8 - r + 0.5];
      };
      const [x1, y1] = c(from), [x2, y2] = c(to);
      const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1) - 0.32;
      const ex = x1 + Math.cos(ang) * len, ey = y1 + Math.sin(ang) * len;
      const hx = x1 + Math.cos(ang) * (len + 0.3), hy = y1 + Math.sin(ang) * (len + 0.3);
      const pr = ang + Math.PI / 2, w = 0.26;
      return `<g class="an-arrow ${cls}"><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}"/><polygon points="${hx},${hy} ${ex + Math.cos(pr) * w},${ey + Math.sin(pr) * w} ${ex - Math.cos(pr) * w},${ey - Math.sin(pr) * w}"/></g>`;
    },
    _arrowsFor(p) {
      let h = "";
      if (p && this.rv.done && BAD[p.cls]) {
        if (p.bestMove) h += this._arrow(p.bestMove.from, p.bestMove.to, "best");
        if (p.reply) h += this._arrow(p.reply.from, p.reply.to, "reply");
      }
      this.arrows.innerHTML = h;
    },

    _evalBar(ev) {
      if (!this.root) return;
      const fill = this.$(".an-evalbar-fill"), num = this.$(".an-evalbar-num"), bar = this.$(".an-evalbar");
      if (ev == null) { fill.style.height = "50%"; num.textContent = "…"; return; }
      const w = winPct(ev);
      const flip = this.board.orientation === "b";
      bar.classList.toggle("flip", flip);
      fill.style.height = w + "%";
      num.textContent = fmtEval(ev);
      bar.classList.toggle("white-ahead", ev >= 0);
    },

    _graphCursor() {
      const g = this.root && this.root.querySelector(".an-gcur");
      if (!g) return;
      const n = this.rv.pos.length;
      const x = n > 1 ? this.idx / (n - 1) * 300 : 0;
      g.setAttribute("x1", x); g.setAttribute("x2", x);
    },

    /* ----- линии Stockfish для текущей позиции ----- */
    _lines(i, fen) {
      const box = this.$(".an-lines-box"), list = this.$(".an-lines");
      if (!box) return;
      const rv = this.rv, pos = rv.pos[i];
      if (!rv.done && !pos) { box.hidden = true; return; }
      box.hidden = false;
      if (!pos) { list.innerHTML = `<div class="an-line-none">${L("noLines")}</div>`; return; }
      if (pos.term) { list.innerHTML = `<div class="an-line-none">${pos.mated ? L("mate") : L("stalemate")}</div>`; return; }
      const turn = fen.split(" ")[1];
      list.innerHTML = pos.lines.slice(0, 2).map((l, k) => {
        const evW = turn === "w" ? l.score : -l.score;
        const tone = isMate(evW) ? (evW > 0 ? "w" : "b") : evW > 30 ? "w" : evW < -30 ? "b" : "eq";
        return `<div class="an-line${k === 0 ? " top" : ""}"><b class="an-line-ev an-ev-${tone}">${fmtEval(evW)}</b><span>${esc(pvSan(fen, l.pv, 8))}</span></div>`;
      }).join("");
    },

    /* ----- комментарий «тренера» к текущему ходу ----- */
    _coach(p, i) {
      const box = this.$(".an-coach");
      if (this.fix) return;
      const rv = this.rv;
      if (!p) {
        box.className = "an-coach an-coach-start";
        box.innerHTML = `<div class="an-coach-ic">♞</div><div class="an-coach-main"><div class="an-coach-t">${L("start")}</div><div class="an-coach-s">${L("startHint")}</div></div>`;
        return;
      }
      if (!rv.done) {
        box.className = "an-coach";
        box.innerHTML = `<div class="an-coach-ic">…</div><div class="an-coach-main"><div class="an-coach-t">${esc(moveLabel(rv, i - 1))}</div><div class="an-coach-s">${L("analysing")}</div></div>`;
        return;
      }
      const mine = p.color === rv.data.pc;
      const canFix = mine && BAD[p.cls] && p.bestMove;
      const bm = p.bestSan ? `<b>${esc(p.bestSan)}</b>` : "";
      const c = p.cls;
      let sub = "";
      if (c === "best") sub = sameMove(p.bestUci, p.uci) ? L("rBest") : L("rBestEq");
      else if (c === "forced") sub = L("rForced");
      else if (c === "book") sub = L("rBook", { o: rv.opening ? " — " + esc(rv.opening[lang()]) : "" });
      else if (c === "brilliant") sub = L("rBrilliant");
      else if (c === "great") sub = p.greatWhy === "punish" ? L("rGreatPunish") : L("rGreat");
      else if (c === "excellent") sub = L("rExcellent", { m: bm });
      else if (c === "good") sub = L("rGood", { m: bm });
      else if (c === "inaccuracy") sub = L("rInacc", { m: bm });
      else if (c === "mistake") sub = L("rMistake", { m: bm });
      else if (c === "blunder") sub = L("rBlunder", { m: bm });
      else if (c === "miss") sub = L("rMiss", { m: bm });
      const why = BAD[c] ? reasonText(p.reason) : "";
      const prevPos = rv.pos[i - 1], curPos = rv.pos[i];
      const evChip = prevPos && curPos ? `<span class="an-evchip">${fmtEval(prevPos.ev)} <i>→</i> ${fmtEval(curPos.term && curPos.mated ? (p.color === "w" ? MATE : -MATE) : curPos.ev)}</span>` : "";
      const showAlt = !(c === "best" || c === "forced" || c === "book" || c === "brilliant" || c === "great") && p.bestSan;
      const alt = showAlt ? `
        <div class="an-coach-alt">
          <div><span class="an-alt-k">${L("better")}:</span> <b class="good">${esc(p.bestSan)}</b> <em>${fmtEval(p.bestEvW)}</em></div>
          ${p.bestLine ? `<div class="an-coach-line"><span class="an-alt-k">${L("line")}:</span> ${esc(p.bestLine)}</div>` : ""}
          ${BAD[c] && p.reply && p.reply.san ? `<div class="an-coach-line bad"><span class="an-alt-k">${L("reply")}:</span> ${esc(p.reply.line || p.reply.san)}</div>` : ""}
        </div>` : "";
      box.className = `an-coach an-coach-${c}`;
      box.innerHTML = `
        <div class="an-coach-ic an-b-${c}">${CLS[c].icon}</div>
        <div class="an-coach-main">
          <div class="an-coach-top">
            <div class="an-coach-t"><span class="an-coach-who">${mine ? L("you") : esc(rv.data.oppName || L("bot"))}</span> ${esc(moveLabel(rv, i - 1))} — ${L(c)}</div>
            ${evChip}
          </div>
          <div class="an-coach-s">${sub}${why ? ` <span class="an-why">${why}</span>` : ""}</div>
          ${alt}
          ${canFix ? `<button class="an-fix-btn" type="button">${L("fix")}</button>` : ""}
        </div>`;
      const fb = box.querySelector(".an-fix-btn");
      if (fb) fb.addEventListener("click", () => this._startFix(i - 1));
    },

    _toast(msg, kind) {
      const t = this.$(".an-toast");
      t.className = "an-toast an-toast-" + (kind || "info");
      t.innerHTML = msg;
      t.hidden = false;
      clearTimeout(this._tt);
      this._tt = setTimeout(() => { if (t) t.hidden = true; }, 1800);
    },

    /* ----- автопросмотр ----- */
    _startAuto() {
      this._exitFix();
      if (this.idx >= this.rv.plies.length) this.go(0);
      const btn = this.$(".an-ctl-play");
      btn.textContent = "⏸"; btn.classList.add("on");
      const step = () => {
        if (!this.root) return;
        if (this.idx >= this.rv.plies.length) { this._stopAuto(); return; }
        this.go(this.idx + 1);
        const p = this.rv.plies[this.idx - 1];
        this.autoTimer = setTimeout(step, p && BAD[p.cls] ? 2400 : 1050);
      };
      this.autoTimer = setTimeout(step, 350);
    },
    _stopAuto() {
      clearTimeout(this.autoTimer); this.autoTimer = null;
      const btn = this.root && this.root.querySelector(".an-ctl-play");
      if (btn) { btn.textContent = "▶"; btn.classList.remove("on"); }
    },

    /* ----- исправление ошибки: игрок сам ищет ход лучше ----- */
    _startFix(plyIndex) {
      this._stopAuto();
      const rv = this.rv, p = rv.plies[plyIndex];
      this.go(plyIndex);
      this.fix = { ply: plyIndex, tries: 0, busy: false, solved: false };
      this.root.classList.add("an-fixing");
      this.$(".an-lines-box").hidden = true;          // не подсказываем линии движка
      this.board.playerColor = rv.data.pc;
      this.board.setLocked(false);
      this.arrows.innerHTML = this._arrow(p.from, p.to, "bad");
      const sqs = this.board.squares;
      if (sqs[p.from]) sqs[p.from].classList.add("an-sq-was");
      this._fixPanel(L("fixSub", { m: `<b class="bad">${esc(p.san)}</b>` }), "ask");
    },
    _fixPanel(msg, state) {
      const box = this.$(".an-coach");
      const tr = this.train;
      const prog = tr ? `<div class="an-fix-prog"><i style="width:${(tr.pos) / tr.list.length * 100}%"></i></div><div class="an-fix-cnt">${L("fixed", { a: tr.fixed, b: tr.list.length })}</div>` : "";
      box.className = "an-coach an-coach-fix an-fix-" + state;
      box.innerHTML = `
        <div class="an-coach-ic">${state === "ok" ? "✓" : state === "no" ? "✕" : "⚔"}</div>
        <div class="an-coach-main">
          <div class="an-coach-t">${state === "ok" ? "" : L("fixTitle")}</div>
          <div class="an-coach-s">${msg}</div>
          ${prog}
          <div class="an-fix-actions">
            ${state === "ok" || state === "gave" ? `<button class="an-fbtn primary" data-f="next">${L("skip")} →</button>` : `<button class="an-fbtn" data-f="show">${L("showBest")}</button><button class="an-fbtn ghost" data-f="skip">${L("skip")}</button>`}
            <button class="an-fbtn ghost" data-f="exit">${L("exit")}</button>
          </div>
        </div>`;
      box.querySelectorAll(".an-fbtn").forEach(b => b.addEventListener("click", () => {
        const f = b.dataset.f;
        if (f === "show") this._revealBest();
        else if (f === "skip" || f === "next") this._nextFix();
        else if (f === "exit") { const i = this.fix ? this.fix.ply + 1 : this.idx; this._exitFix(); this.go(i); }
      }));
    },
    _revealBest() {
      const f = this.fix; if (!f) return;
      const p = this.rv.plies[f.ply];
      this.arrows.innerHTML = this._arrow(p.bestMove.from, p.bestMove.to, "best pulse");
      f.solved = true;
      this.board.setLocked(true);
      this._fixPanel(L("giveUp", { m: `<b class="good">${esc(p.bestSan || "")}</b>` }) + (p.bestLine ? `<div class="an-coach-line">${esc(p.bestLine)}</div>` : ""), "gave");
    },
    async _onBoardMove(from, to) {
      const f = this.fix;
      if (!f || f.busy || f.solved) return;
      const rv = this.rv, p = rv.plies[f.ply], a = rv.pos[f.ply];
      const piece = this.game.get(from);
      const promo = piece && piece.type === "p" && (to[1] === "8" || to[1] === "1") ? "q" : undefined;
      const mv = this.game.move({ from, to, promotion: promo });
      if (!mv) return;
      f.busy = true;
      this.board.setLocked(true);
      this.board.attach(this.game, { from, to });
      const uci = uciOf(mv);
      const isBest = sameMove(uci, p.bestUci);
      let ok = isBest;
      if (!ok && !sameMove(uci, p.uci)) {
        /* та же оценка, что и при разборе: потеря шанса относительно лучшего хода < 5 % */
        let after = null;
        const k = (a.lines || []).findIndex(l => sameMove(l.uci, uci));
        if (k >= 0) after = a.lines[k].score;
        else {
          this._fixPanel(L("checking"), "ask");
          const r = await analysePos(this.game.fen(), { movetime: 700, depth: 18, multipv: 1 });
          if (!this.fix || this.fix !== f) return;
          after = -r.score;
        }
        ok = winPct(a.score) - winPct(after) < 5;
      }
      f.busy = false;
      if (ok) {
        f.solved = true;
        if (this.train) this.train.fixed++;
        this.board.squares[to] && this.board.squares[to].classList.add("an-sq-win");
        this.arrows.innerHTML = this._arrow(from, to, "best");
        this.root.classList.add("an-flash-ok");
        setTimeout(() => this.root && this.root.classList.remove("an-flash-ok"), 700);
        try { window.Sfx && Sfx.capture && Sfx.capture(); } catch (e) {}
        this._fixPanel(L(isBest ? "correct" : "alsoGood", { m: `<b class="good">${esc(mv.san)}</b>` }), "ok");
      } else {
        f.tries++;
        this.board.squares[to] && this.board.squares[to].classList.add("an-sq-wrong");
        this.root.classList.add("an-shake");
        setTimeout(() => this.root && this.root.classList.remove("an-shake"), 450);
        this._fixPanel(L("tryAgain", { m: `<b class="bad">${esc(mv.san)}</b>` }), "no");
        setTimeout(() => {
          if (this.fix !== f || !this.root) return;
          this.game.load(p.fenBefore);
          this.board.clearSelection();
          this.board.attach(this.game, null);
          this.board.setLocked(false);
          if (f.tries >= 2 && p.bestMove) this.board.squares[p.bestMove.from] && this.board.squares[p.bestMove.from].classList.add("an-sq-hint");
          this.arrows.innerHTML = this._arrow(p.from, p.to, "bad");
        }, 900);
      }
    },
    _exitFix() {
      if (!this.fix && !this.train) return;
      this.fix = null; this.train = null;
      if (!this.root) return;
      this.root.classList.remove("an-fixing");
      this.board.playerColor = null;
      this.board.setLocked(true);
      Object.values(this.board.squares).forEach(s => s.classList.remove("an-sq-was", "an-sq-hint", "an-sq-win", "an-sq-wrong"));
    },
    _startTrain() {
      const list = this.rv.mistakes();
      if (!list.length) return;
      this._exitFix();
      this.train = { list, pos: 0, fixed: 0 };
      this._startFix(list[0].i);
    },
    _nextFix() {
      const tr = this.train;
      const cur = this.fix ? this.fix.ply : this.idx;
      Object.values(this.board.squares).forEach(s => s.classList.remove("an-sq-was", "an-sq-hint", "an-sq-win", "an-sq-wrong"));
      if (tr) {
        tr.pos++;
        if (tr.pos >= tr.list.length) {
          const fixed = tr.fixed, total = tr.list.length;
          this.fix = null;
          this.board.setLocked(true);
          const box = this.$(".an-coach");
          box.className = "an-coach an-coach-fix an-fix-done";
          box.innerHTML = `<div class="an-coach-ic">♛</div><div class="an-coach-main"><div class="an-coach-t">${L("trainDone")}</div><div class="an-coach-s">${L("fixed", { a: fixed, b: total })}</div><div class="an-fix-prog"><i style="width:100%"></i></div><div class="an-fix-actions"><button class="an-fbtn primary" data-f="exit">${L("exit")}</button></div></div>`;
          box.querySelector(".an-fbtn").addEventListener("click", () => { this._exitFix(); this.go(cur + 1); });
          return;
        }
        this.fix = null;
        this._startFix(tr.list[tr.pos].i);
      } else {
        const next = this.rv.mistakes().find(x => x.i > cur);
        if (next) { this.fix = null; this._startFix(next.i); }
        else { this._exitFix(); this.go(cur + 1); }
      }
    }
  };

  /* ---------------- связь с игрой ---------------- */
  let current = null;

  function startReview(data) {
    if (current) current.cancelled = true;
    const rv = new Review(data);
    current = rv;
    if (!data.duel) rv.on(() => updateModalBtn());
    rv.on(r => {
      if (!data.duel && r.done && !r._autoOpened && isAuto() && !View.root) {
        r._autoOpened = true;
        setTimeout(() => { if (current === r && !View.root) View.open(r); }, 600);
      }
    });
    rv.run().catch(e => console.warn("analysis", e));
    return rv;
  }

  function updateModalBtn() {
    const modal = document.getElementById("result-modal");
    if (!modal) return;
    let b = modal.querySelector(".an-modal-btn");
    if (!current || current.plies.length < 1) { if (b) b.remove(); return; }
    if (!b) {
      const actions = modal.querySelector(".modal-actions") || modal.querySelector(".modal-card");
      if (!actions || !actions.parentNode) return;
      b = el("button", "btn an-modal-btn");
      b.type = "button";
      b.innerHTML = `<span class="an-mb-fill"></span><span class="an-mb-ic">◎</span><span class="an-mb-t"></span>`;
      b.addEventListener("click", () => { if (current) View.open(current); });
      actions.parentNode.insertBefore(b, actions);
    }
    b.querySelector(".an-mb-t").textContent = current.done ? L("btn") : L("btnWait", { p: current.progress });
    b.querySelector(".an-mb-fill").style.width = (current.done ? 100 : current.progress) + "%";
    b.classList.toggle("ready", current.done);
  }

  /* перехватываем конец партии против бота */
  if (typeof GameController !== "undefined") {
    const orig = GameController.prototype._finishWith;
    GameController.prototype._finishWith = function (result, resigned) {
      try {
        const full = this.game.history({ verbose: true });
        if (full.length - (this.baseCount || 0) >= 1) {
          startReview({
            startFen: this.startFen || (typeof STD_FEN !== "undefined" ? STD_FEN : START_FEN),
            moves: full.map(m => ({ from: m.from, to: m.to, promotion: m.promotion })),
            pc: this.playerColor, result, resigned: !!resigned,
            base: this.baseCount || 0
          });
        }
      } catch (e) { console.warn("analysis", e); }
      const r = orig.apply(this, arguments);
      setTimeout(updateModalBtn, 0);
      return r;
    };
  }

  /* новая партия / задача — убираем кнопку старого анализа */
  ["startLevel", "startPuzzle"].forEach(fn => {
    if (typeof UI !== "undefined" && typeof UI[fn] === "function") {
      const o = UI[fn];
      UI[fn] = function () {
        if (current && !current.done) current.cancelled = true;
        current = null;
        /* движок грузится заранее, пока идёт партия, — к её концу он уже готов */
        if (fn === "startLevel") setTimeout(() => { try { Engine.get(); } catch (e) {} }, 1500);
        const b = document.querySelector("#result-modal .an-modal-btn"); if (b) b.remove();
        return o.apply(this, arguments);
      };
    }
  });


  /* открыть анализ любой партии вручную: MCAnalysis.open({ moves:["e2e4","e7e5",…], pc:"w", result:"win" }) */
  window.MCAnalysis = {
    open(data) {
      const d = Object.assign({ startFen: typeof STD_FEN !== "undefined" ? STD_FEN : START_FEN, pc: "w", result: "draw" }, data || {});
      d.moves = (d.moves || []).map(m => typeof m === "string" ? { from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] } : m);
      const rv = startReview(d);
      View.open(rv);
      return rv;
    },
    /* партия из «Поединков»: { moves:["e2e4",…], pc:"w"|"b", result:"win"|"loss"|"draw", resigned, oppName, startFen } */
    openDuel(data) { return this.open(Object.assign({}, data, { duel: true })); },
    reopen() { if (current) View.open(current); },
    close() { View.close(); },
    current() { return current; },
    engine() { return Engine.get().then(e => e.kind); }
  };
})();
