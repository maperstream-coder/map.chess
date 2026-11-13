/* maper.chess — «Шахматы Фишера» (Chess960).
   ─────────────────────────────────────────────────────────────────────────────────────────────
   Правило режима: фигуры первой горизонтали расставляются случайно, пешки стоят как обычно,
   а расстановка у соперника ЗЕРКАЛЬНАЯ (ладья напротив ладьи, король напротив короля и т.д.).
   Как в настоящих шахматах Фишера (Chess960): слоны на полях разного цвета, король между ладьями —
   всего 960 возможных расстановок (№518 — обычная).
   Рокировки в этом режиме нет: у обоих игроков условия одинаковые.

   Что внутри:
     • window.Fischer — генератор позиций (используется и в js/duels.js для партий с друзьями);
     • экран «Шахматы Фишера»: предпросмотр позиции, партия против бота (сила + цвет), приглашение друга;
     • карточка на главной и пункт в меню «Ещё».
   Подключать ПОСЛЕ js/leaderboard.js и ДО js/duels.js (см. index.html). Стили — css/fischer.css. */
(function () {
  "use strict";

  /* ---------- тексты ---------- */
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nav.fischer": "Fischer", "fi.title": "Fischer Chess", "fi.kicker": "Chess960",
    "fi.sub": "Pieces start in a random order — pawns stay in place, and your opponent gets the mirror image. No memorised openings: just think.",
    "fi.pos": "Position #{n} of 960", "fi.shuffle": "Another position",
    "fi.bot": "Play vs bot", "fi.diff": "Bot strength", "fi.color": "Play as",
    "fi.d.easy": "Easy", "fi.d.mid": "Medium", "fi.d.hard": "Hard", "fi.d.master": "Master", "fi.d.gm": "Grandmaster",
    "fi.play": "Play", "fi.friend": "Play with a friend", "fi.friendSub": "Invite a friend to a Fischer game — you both get the same random position.",
    "fi.invite": "Invite a friend", "fi.pickFriend": "Choose a friend", "fi.noFriends": "No friends yet — add someone first!",
    "fi.openFriends": "Open friends", "fi.rules": "No castling in this mode — both sides play by the same rules.",
    "fi.botName": "Fischer bot", "bot.fischer": "Fischer bot",
    "fi.homeSub": "Random mirrored set-up. Vs bot or with friends.",
    "fi.resultSub": "Fischer Chess · position #{n}", "fi.badge": "960 · #{n}",
    "du.fischer": "Fischer 960", "du.classic": "Classic", "du.variant": "Game type"
  }, {
    "nav.fischer": "Фишер", "fi.title": "Шахматы Фишера", "fi.kicker": "Chess960",
    "fi.sub": "Фигуры стоят в случайном порядке, пешки — как обычно, а у соперника расстановка зеркальная. Никакой заученной теории — только ваша голова.",
    "fi.pos": "Позиция №{n} из 960", "fi.shuffle": "Другая позиция",
    "fi.bot": "Игра с ботом", "fi.diff": "Сила бота", "fi.color": "Играть за",
    "fi.d.easy": "Лёгкий", "fi.d.mid": "Средний", "fi.d.hard": "Сильный", "fi.d.master": "Мастер", "fi.d.gm": "Гроссмейстер",
    "fi.play": "Играть", "fi.friend": "Игра с другом", "fi.friendSub": "Позовите друга на партию Фишера — у обоих будет одна и та же случайная расстановка.",
    "fi.invite": "Позвать друга", "fi.pickFriend": "Выберите друга", "fi.noFriends": "Друзей пока нет — сначала добавьте кого-нибудь!",
    "fi.openFriends": "Открыть друзей", "fi.rules": "Рокировки в этом режиме нет — у обоих игроков одинаковые условия.",
    "fi.botName": "Бот Фишера", "bot.fischer": "Бот Фишера",
    "fi.homeSub": "Случайная зеркальная расстановка. С ботом и с друзьями.",
    "fi.resultSub": "Шахматы Фишера · позиция №{n}", "fi.badge": "960 · №{n}",
    "du.fischer": "Фишер 960", "du.classic": "Классика", "du.variant": "Тип партии"
  });

  /* =============================================================================================
     ГЕНЕРАТОР ПОЗИЦИЙ (нумерация Шарнагля: 0…959, №518 = RNBQKBNR)
     ============================================================================================= */
  const KN = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];

  function rankFromIndex(n) {
    n = ((Math.floor(n) % 960) + 960) % 960;
    const row = new Array(8).fill(null);
    const free = () => { const f = []; row.forEach((v, i) => { if (!v) f.push(i); }); return f; };
    row[1 + 2 * (n % 4)] = "b"; n = Math.floor(n / 4);      // слон на светлом поле (b, d, f, h)
    row[2 * (n % 4)] = "b"; n = Math.floor(n / 4);          // слон на тёмном поле (a, c, e, g)
    let f = free(); row[f[n % 6]] = "q"; n = Math.floor(n / 6);
    f = free(); row[f[KN[n][0]]] = "n"; row[f[KN[n][1]]] = "n";
    f = free(); row[f[0]] = "r"; row[f[1]] = "k"; row[f[2]] = "r";   // король всегда между ладьями
    return row.join("");
  }
  /* FEN: чёрные — зеркало белых, рокировок нет */
  function fenFromIndex(n) {
    const r = rankFromIndex(n);
    return `${r}/pppppppp/8/8/8/8/PPPPPPPP/${r.toUpperCase()} w - - 0 1`;
  }
  /* №0…959 по FEN (для подписи «Позиция №N») */
  function indexOfFen(fen) {
    const rank = String(fen).split(" ")[0].split("/")[0];
    for (let i = 0; i < 960; i++) if (rankFromIndex(i) === rank) return i;
    return -1;
  }
  const randomIndex = () => Math.floor(Math.random() * 960);

  /* позиция партии с другом выводится из id документа игры — у обоих игроков она одинаковая */
  function hashStr(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    return h >>> 0;
  }
  const indexForGame = id => hashStr(id) % 960;
  const fenForGame = id => fenFromIndex(indexForGame(id));

  /* Партия-дуэль «Фишер»? Приглашение — если в fen лежит позиция этой игры; идущая/законченная партия —
     если журнал ходов от этой позиции даёт текущую расстановку. Новые поля в Firestore не нужны. */
  const _cache = new Map();
  function isFischerGame(id, d) {
    if (!id || !d || typeof d.fen !== "string") return false;
    const start = fenForGame(id);
    if (d.status === "invited") return d.fen === start;
    const moves = Array.isArray(d.moves) ? d.moves : [];
    const key = id + ":" + moves.length + ":" + d.fen;
    if (_cache.has(key)) return _cache.get(key);
    let ok = false;
    try {
      if (!moves.length) ok = d.fen === start;
      else {
        const g = new Chess(start);
        ok = moves.every(m => !!g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })) &&
          g.fen().split(" ")[0] === d.fen.split(" ")[0];
      }
    } catch (e) { ok = false; }
    _cache.set(key, ok);
    return ok;
  }

  window.Fischer = { rankFromIndex, fenFromIndex, indexOfFen, randomIndex, indexForGame, fenForGame, isFischerGame };

  /* =============================================================================================
     ЭКРАН «ШАХМАТЫ ФИШЕРА»
     ============================================================================================= */
  const $ = id => document.getElementById(id);
  const toast = m => { try { UI._toast(m); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* сила бота -> строка шкалы сложности из data.js (DIFFICULTY_RAMP) */
  const DIFFS = [
    { id: "easy", key: "fi.d.easy", ramp: 2, tier: "beginner", piece: "p" },
    { id: "mid", key: "fi.d.mid", ramp: 8, tier: "intermediate", piece: "n" },
    { id: "hard", key: "fi.d.hard", ramp: 14, tier: "intermediate", piece: "b" },
    { id: "master", key: "fi.d.master", ramp: 19, tier: "pro", piece: "r" },
    { id: "gm", key: "fi.d.gm", ramp: 23, tier: "pro", piece: "q" }
  ];
  const S = { idx: randomIndex(), diff: "mid", color: "r" };

  const glyph = (c, tp) => (typeof PIECE_GLYPH !== "undefined" && PIECE_GLYPH[c] ? PIECE_GLYPH[c][tp] : "");
  const piece = (c, tp) => (window.pieceSvg && window.pieceSvg(c, tp)) || glyph(c, tp);

  const sec = document.createElement("section");
  sec.id = "view-fischer"; sec.className = "view";
  sec.innerHTML = `
    <div class="fi-hero">
      <span class="fi-hero-ico" aria-hidden="true">${diceSvg()}</span>
      <div><span class="fi-kicker" data-i18n="fi.kicker"></span><h2 class="view-title fi-h" data-i18n="fi.title"></h2></div>
    </div>
    <p class="lb-sub fi-sub" data-i18n="fi.sub"></p>
    <div class="fi-board-card">
      <div class="fi-prev" id="fi-prev" aria-hidden="true"></div>
      <div class="fi-prev-foot"><b id="fi-pos"></b>
        <button type="button" class="du-tc-chip fi-shuffle" id="fi-shuffle"><span aria-hidden="true">🎲</span> <span data-i18n="fi.shuffle"></span></button>
      </div>
    </div>
    <p class="fr-sec" data-i18n="fi.bot"></p>
    <div class="fi-card-box">
      <p class="fi-lbl" data-i18n="fi.diff"></p>
      <div class="du-tc-row" id="fi-diffs"></div>
      <p class="fi-lbl" data-i18n="fi.color"></p>
      <div class="du-tc-row" id="fi-colors"></div>
      <button type="button" class="btn btn-primary fi-play" id="fi-play" data-i18n="fi.play"></button>
    </div>
    <p class="fr-sec" data-i18n="fi.friend"></p>
    <div class="fi-card-box">
      <p class="fi-note" data-i18n="fi.friendSub"></p>
      <button type="button" class="btn btn-ghost fi-play" id="fi-invite" data-i18n="fi.invite"></button>
    </div>
    <p class="fi-rules" data-i18n="fi.rules"></p>`;
  document.querySelector(".views").appendChild(sec);

  function diceSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/></svg>';
  }

  /* ---------- нижнее меню ---------- */
  const nb = document.createElement("button");
  nb.className = "nav-btn"; nb.dataset.view = "fischer";
  nb.innerHTML = '<span>♞</span><span data-i18n="nav.fischer"></span>';
  const anchor = document.querySelector('.nav-btn[data-view="levels"]');
  if (anchor) anchor.after(nb); else document.querySelector(".bottom-nav").appendChild(nb);

  /* ---------- карточка на главной убрана: режим открывается из меню «Ещё» ---------- */
  function ensureHomeCard() {
    const old = $("fi-card");
    if (old) old.remove();
  }

  /* ---------- предпросмотр расстановки ---------- */
  function renderPreview() {
    const rank = rankFromIndex(S.idx), box = $("fi-prev");
    const rows = [["b", rank.split("")], ["b", "pppppppp".split("")], ["w", "pppppppp".split("")], ["w", rank.split("")]];
    const realRow = [0, 1, 6, 7];                                   // номера рядов на настоящей доске (для цвета клеток)
    box.innerHTML = rows.map((r, i) => {
      const cells = r[1].map((tp, c) => {
        const dark = (realRow[i] + c) % 2 === 1;
        return `<i class="fi-sq ${dark ? "d" : "l"}">${piece(r[0], tp)}</i>`;
      }).join("");
      return `<div class="fi-row${i === 1 ? " fi-gap" : ""}">${cells}</div>`;
    }).join("");
    $("fi-pos").textContent = t("fi.pos", { n: S.idx });
  }

  function renderChips() {
    const dRow = $("fi-diffs"), cRow = $("fi-colors");
    dRow.innerHTML = ""; cRow.innerHTML = "";
    DIFFS.forEach(d => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "du-tc-chip" + (S.diff === d.id ? " on" : "");
      b.textContent = t(d.key);
      b.addEventListener("click", () => { S.diff = d.id; renderChips(); });
      dRow.appendChild(b);
    });
    [["w", "color.white"], ["b", "color.black"], ["r", "color.random"]].forEach(([v, k]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "du-tc-chip" + (S.color === v ? " on" : "");
      b.textContent = t(k);
      b.addEventListener("click", () => { S.color = v; renderChips(); });
      cRow.appendChild(b);
    });
  }

  function render() {
    UI.renderTopbar();
    translatePage(sec);
    renderChips();
    renderPreview();
  }

  $("fi-shuffle").addEventListener("click", () => {
    let n; do { n = randomIndex(); } while (n === S.idx);
    S.idx = n; renderPreview();
  });
  $("fi-play").addEventListener("click", () => startBot());
  $("fi-invite").addEventListener("click", () => pickFriend());

  /* =============================================================================================
     ПАРТИЯ ПРОТИВ БОТА
     ============================================================================================= */
  function startBot() {
    if (typeof GameController === "undefined" || typeof DIFFICULTY_RAMP === "undefined") return;
    const d = DIFFS.find(x => x.id === S.diff) || DIFFS[1], rp = DIFFICULTY_RAMP[d.ramp];
    const color = S.color === "r" ? (Math.random() < 0.5 ? "w" : "b") : S.color;
    const ai = { depth: rp[0], noise: rp[1], blunder: rp[2], ms: rp[3], book: 0 };
    if (!rp[4]) ai.quiesce = false;
    const level = {
      id: "fischer", tier: d.tier, index: 1, depth: rp[0], blunder: rp[2], ai,
      botPiece: d.piece, botStyle: "fresh", fen: fenFromIndex(S.idx), moves: null, color,
      goal: null, xp: 0, coins: 0
    };

    UI.currentMode = "level";
    $("game-level-name").textContent = t("fi.title");
    $("game-level-tier").textContent = `${t(d.key)} · ${t("fi.badge", { n: S.idx })}`;
    UI._enterGameView();
    UI._setupMatchHud(level, color);
    $("gp-opp-name").textContent = t("fi.botName");
    $("gp-opp-sub").textContent = t(d.key);
    const badge = $("game-badge");
    badge.hidden = false; badge.textContent = t("fi.badge", { n: S.idx });

    UI.gameController = new GameController({
      boardEl: $("board"), level, playerColor: color,
      onStatus: x => UI._setStatus(x),
      onHintUsed: () => {},
      onHud: info => UI._renderMatchHud(level, info),
      onThinking: on => UI._setThinking(on),
      onGameOver: r => onBotOver(level, r)
    });
  }

  /* конец партии: считаем в общую статистику и огонёк, но уровни/награды кампании не трогаем */
  function onBotOver(level, r) {
    const s = UI.state, num = (level.fen && indexOfFen(level.fen)) || 0;
    s.stats.gamesPlayed++;
    let title;
    if (r.result === "win") { s.stats.wins++; if (!r.hintsUsed) s.stats.hintlessWins++; title = t("modal.victoryTitle"); }
    else if (r.result === "draw") { s.stats.draws++; title = t("modal.drawTitle"); }
    else { s.stats.losses++; title = t("modal.checkmatedTitle"); }

    const sr = r.moves >= STREAK_CONFIG.minMovesForGame ? recordActivity(s) : null;
    if (sr && sr.blocked) toast(t("streak.blocked"));
    const streakLine = UI._streakLine ? UI._streakLine(sr) : "";
    const newAch = checkAchievements(s);
    saveState(s);
    UI.renderTopbar();

    UI._modalRetryAction = () => { S.idx = randomIndex(); startBot(); };
    UI._showResultModal(title, t("fi.resultSub", { n: num }), newAch, false, "", streakLine, null);
  }

  /* из партии с ботом «Фишера» стрелка ← ведёт на экран режима, а не в список уровней */
  const gv = $("view-game");
  if (gv) gv.addEventListener("click", e => {
    const c = UI.gameController;
    if (c && c.level && c.level.id === "fischer" && e.target.closest("#btn-exit-game")) {
      e.stopPropagation();
      UI.showView("fischer");
    }
  }, true);

  /* =============================================================================================
     ПРИГЛАШЕНИЕ ДРУГА
     ============================================================================================= */
  async function pickFriend() {
    if (typeof Cloud === "undefined" || !Cloud.enabled || !Cloud.user || !window.Duels) { toast(t("du.off")); return; }
    const old = $("fi-overlay"); if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "fi-overlay"; ov.className = "inv-overlay";
    ov.innerHTML = `<div class="inv-card" role="dialog"><b class="inv-title">${esc(t("fi.pickFriend"))}</b>
      <div class="fi-friends" id="fi-friends"><p class="lb-note">${esc(t("lb.loading"))}</p></div>
      <div class="inv-acts"><button type="button" class="btn btn-ghost" id="fi-ov-x">${esc(t("du.cancel"))}</button></div></div>`;
    const close = () => ov.remove();
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    ov.querySelector("#fi-ov-x").addEventListener("click", close);
    document.body.appendChild(ov);
    const list = ov.querySelector("#fi-friends");
    try {
      const fr = await Cloud._db.collection("users").doc(Cloud.user.uid).collection("friends").get();
      list.innerHTML = "";
      if (fr.empty) {
        list.innerHTML = `<p class="lb-note">${esc(t("fi.noFriends"))}</p>`;
        const go = document.createElement("button");
        go.type = "button"; go.className = "btn btn-primary"; go.style.width = "100%";
        go.textContent = t("fi.openFriends");
        go.addEventListener("click", () => { close(); UI.showView("friends"); });
        list.appendChild(go);
        return;
      }
      fr.forEach(doc => {
        const nick = doc.data().nick ? Nick.safe(doc.data().nick) : "—";
        const b = document.createElement("button");
        b.type = "button"; b.className = "fr-row du-game-row";
        b.innerHTML = `<span class="fr-ava">${esc(nick[0].toUpperCase())}</span><span class="fr-info"><b></b></span>`;
        b.querySelector("b").textContent = nick;
        b.addEventListener("click", () => { close(); Duels.invitePrompt(doc.data().nick || nick, doc.id, true); });
        list.appendChild(b);
      });
    } catch (e) { list.innerHTML = `<p class="lb-note">${esc(t("du.err"))}</p>`; }
  }

  /* =============================================================================================
     ПОДКЛЮЧЕНИЕ К ПРИЛОЖЕНИЮ
     ============================================================================================= */
  const _sv = UI.showView;
  UI.showView = function (n) {
    _sv.call(this, n);
    if (n === "fischer") render();
    if (n === "home") ensureHomeCard();
  };
  const _init = UI.init;
  UI.init = function () { _init.call(this); ensureHomeCard(); translatePage(nb); };
  /* язык сменили — перерисовать экран, если он открыт */
  document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest(".lang-btn") && sec.classList.contains("active")) setTimeout(render, 0);
  });
})();
