/* maper.chess — Деревня v6: войско из фигур, ОСАДЫ НА НАСТОЯЩИХ ШАХМАТНЫХ ЗАДАЧАХ, хроника обороны, задания на основе реальных результатов.
   Подключать ПОСЛЕ js/village.js. Использует Village.api / Village.ext и PuzzleController из js/game.js.

   Как работает осада:
   • у каждой цели (лагерь разбойников или чужая деревня) есть крепость — шахматная задача «мат в N ходов» (N от 1 до 4);
   • чем выше оборона цели, тем длиннее мат; задачу берём из того же банка, что и раздел «Задачи» (PUZZLES.mate1…mate4);
   • фигуры в войске дают «снаряжение»: кони — подсказки, слоны — вторые попытки, пешки и ферзь — добычу, ладьи — оборону дома;
   • звёзды: 3 — без подсказок и повторов, 2 — с одной помощью, 1 — с двумя и больше. Мат не поставлен — осада провалена;
   • для игроков бой по-прежнему фиксируется документом raids/{id} = { from, to, loot, stars, ... }, защитник забирает добычу при входе. */
(function () {
  "use strict";
  if (!window.Village || !Village.api || !Village.ext) return;
  const A = Village.api, X = Village.ext, $ = id => document.getElementById(id);
  const esc = A.esc, t = A.t;
  const toast = (k, o) => { try { UI._toast(t(k, o)); } catch (e) {} };
  const sfx = n => A.sfx(n);

  const SHIELD_MS = 3 * 3600e3, PAIR_MS = 8 * 3600e3, LOOT_MAX = 1500, LOOT_PCT = [0, 0.3, 0.45, 0.6];

  /* ---------- тексты ---------- */
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "vg.u.pawn": "Pawns", "vg.u.knight": "Knights", "vg.u.bishop": "Bishops", "vg.u.rook": "Rooks", "vg.u.queen": "Queens",
    "vg.u.pawn.d": "Cheap infantry. The bulk of any army.", "vg.u.knight.d": "Jumps over walls — strong attacker.", "vg.u.bishop.d": "Balanced: attacks and guards.",
    "vg.u.rook.d": "A living wall. Best defender.", "vg.u.queen.d": "One queen is worth a regiment.",
    "vg.perk.pawn": "Every 5 pawns: +5% siege loot (up to +30%)", "vg.perk.knight": "Scouting: 1 extra hint for every 2 knights (up to 3 hints)",
    "vg.perk.bishop": "Second chance: a retry for every 3 bishops (up to 2)", "vg.perk.rook": "Home defence: raiders get a longer mate to solve",
    "vg.perk.queen": "The queen takes +25% loot",
    "vg.army.title": "Army", "vg.army.pop": "Barracks {a} / {b}", "vg.army.atk": "⚔ Attack {n}", "vg.army.def": "🛡 Defense {n}",
    "vg.army.train": "+1 · {n}", "vg.army.train5": "+5 · {n}", "vg.army.need": "Needs {name}", "vg.army.full": "Barracks are full — upgrade the Town Hall, Pawn cottages or Castle",
    "vg.army.trained": "{name}: +{n}", "vg.army.stat": "ATK {a} · DEF {d} · place {p}", "vg.army.home": "The army is at home and guards the village",
    "vg.army.hint": "Soldiers at home defend the village. In a siege they bring supplies: hints, retries and extra loot.",
    "vg.army.fire": "Dismiss one",
    "vg.kit.title": "Siege kit", "vg.kit.hints": "Hints {n}", "vg.kit.retries": "Retries {n}", "vg.kit.loot": "Loot +{n}%",
    "vg.raid.title": "Sieges", "vg.raid.rep": "Renown {n}", "vg.raid.stats": "Sieges won {a} · lost {b} · loot {c}",
    "vg.raid.camps": "Bandit camps", "vg.raid.campsSub": "Three camps every day. Break in by delivering checkmate — one strike each. Works without signing in.",
    "vg.raid.players": "Rival villages", "vg.raid.playersSub": "The stronger their defence, the longer the mate you have to find.",
    "vg.raid.search": "Nickname", "vg.raid.find": "Find", "vg.raid.more": "Other targets", "vg.raid.loading": "Scouting…",
    "vg.raid.off": "Sign in to raid other players. Bandit camps are always open.", "vg.raid.none": "No villages nearby yet. Try again later.",
    "vg.raid.err": "Could not load targets ({code})", "vg.raid.nofound": "No village with that nickname",
    "vg.raid.attack": "Besiege", "vg.raid.loot": "Loot ~{n}", "vg.raid.def": "Defense {n}", "vg.raid.shield": "Shield {t}", "vg.raid.pair": "Again in {t}",
    "vg.raid.done": "Taken today", "vg.raid.noArmy": "Train a few soldiers first (Army tab)",
    "vg.raid.chron": "Defense chronicle", "vg.raid.chronEmpty": "Nobody has raided you yet.", "vg.raid.revenge": "Revenge",
    "vg.raid.robbed": "{nick} raided you: −{n} 🪙", "vg.raid.held": "{nick} attacked but got nothing", "vg.raid.ago": "{t} ago",
    "vg.raid.rules": "The siege was not saved online ({code}). The site owner needs to add the Firestore rules for raids.",
    "vg.raid.selfShield": "Your shield will drop if you raid a player",
    "vg.s.title": "Siege", "vg.s.fort": "Fortress: mate in {n}", "vg.s.moves": "Move {a} of {b}", "vg.s.scout": "Scout · {n}", "vg.s.retreat": "Retreat",
    "vg.s.noengine": "The chess board is not ready yet — try again in a moment", "vg.s.hintLeft": "Hints left: {n}", "vg.s.noHints": "No scouts left",
    "vg.s.fail": "The fortress held", "vg.s.failSub": "Mate was not delivered in time.", "vg.s.retry": "Retry · {n}", "vg.s.win": "The fortress is yours!",
    "vg.s.loot": "Loot: +{n} coins", "vg.s.lost": "Lost soldiers: {list}", "vg.s.noLoss": "No losses", "vg.s.ok": "Back to the village",
    "vg.s.stars": "Mate delivered in {n} moves · hints {h} · retries {r}", "vg.s.rep": "Renown {n}",
    "vg.camp.0": "Bandit hut", "vg.camp.1": "Robber fort", "vg.camp.2": "Black Rook keep",
    "vg.q.title": "Daily quests", "vg.q.sub": "Most quests come from real chess: play, solve, win. Finish all three for a bonus chest.",
    "vg.q.puz": "Solve {n} new puzzles", "vg.q.win": "Win {n} games", "vg.q.xp": "Earn {n} XP in games and puzzles", "vg.q.game": "Finish {n} game", "vg.q.siege": "Win {n} siege of a player village",
    "vg.q.camp": "Take {n} bandit camps", "vg.q.collect": "Collect the treasury {n} times", "vg.q.build": "Upgrade buildings {n} times", "vg.q.train": "Train {n} soldiers", "vg.q.deco": "Get {n} decoration from the bazaar",
    "vg.q.claim": "Claim · {n}", "vg.q.claimed": "Done", "vg.q.bonus": "Bonus chest · {n}", "vg.q.got": "Quest reward: +{n} coins", "vg.q.go": "Play",
    "vg.land.army": "⚔ {a} · 🛡 {d}", "vg.land.toRaid": "To the sieges", "vg.land.robbed": "While you were away: −{n} 🪙 from {k} raids",
    "vg.visit.attack": "⚔ Besiege this village"
  }, {
    "vg.u.pawn": "Пешки", "vg.u.knight": "Кони", "vg.u.bishop": "Слоны", "vg.u.rook": "Ладьи", "vg.u.queen": "Ферзи",
    "vg.u.pawn.d": "Дешёвая пехота. Основа любого войска.", "vg.u.knight.d": "Прыгает через стены — сильный атакующий.", "vg.u.bishop.d": "Универсал: и нападает, и охраняет.",
    "vg.u.rook.d": "Живая стена. Лучший защитник.", "vg.u.queen.d": "Один ферзь стоит целого полка.",
    "vg.perk.pawn": "Каждые 5 пешек: +5% к добыче осад (до +30%)", "vg.perk.knight": "Разведка: +1 подсказка за каждых 2 коней (до 3 подсказок)",
    "vg.perk.bishop": "Второй шанс: попытка за каждых 3 слонов (до 2)", "vg.perk.rook": "Оборона дома: нападающим достаётся более длинный мат",
    "vg.perk.queen": "Ферзь приносит +25% к добыче",
    "vg.army.title": "Войско", "vg.army.pop": "Казармы {a} / {b}", "vg.army.atk": "⚔ Атака {n}", "vg.army.def": "🛡 Оборона {n}",
    "vg.army.train": "+1 · {n}", "vg.army.train5": "+5 · {n}", "vg.army.need": "Нужно: {name}", "vg.army.full": "Казармы полны — улучшите ратушу, домики пешек или замок",
    "vg.army.trained": "{name}: +{n}", "vg.army.stat": "АТК {a} · ЗАЩ {d} · мест {p}", "vg.army.home": "Войско дома и охраняет деревню",
    "vg.army.hint": "Воины дома защищают деревню. В осаде они дают снаряжение: подсказки, повторные попытки и добычу.",
    "vg.army.fire": "Распустить одного",
    "vg.kit.title": "Снаряжение осады", "vg.kit.hints": "Подсказки {n}", "vg.kit.retries": "Попытки {n}", "vg.kit.loot": "Добыча +{n}%",
    "vg.raid.title": "Осады", "vg.raid.rep": "Слава {n}", "vg.raid.stats": "Осад выиграно {a} · проиграно {b} · добыча {c}",
    "vg.raid.camps": "Лагеря разбойников", "vg.raid.campsSub": "Три лагеря каждый день. Чтобы ворваться внутрь, поставьте мат — по одному удару на лагерь. Работает и без входа в аккаунт.",
    "vg.raid.players": "Деревни соперников", "vg.raid.playersSub": "Чем крепче их оборона, тем длиннее мат, который придётся найти.",
    "vg.raid.search": "Ник игрока", "vg.raid.find": "Найти", "vg.raid.more": "Другие цели", "vg.raid.loading": "Разведка…",
    "vg.raid.off": "Войдите в аккаунт, чтобы грабить других игроков. Лагеря разбойников доступны всегда.", "vg.raid.none": "Рядом пока нет деревень. Загляните позже.",
    "vg.raid.err": "Не удалось загрузить цели ({code})", "vg.raid.nofound": "Деревни с таким ником нет",
    "vg.raid.attack": "В осаду", "vg.raid.loot": "Добыча ~{n}", "vg.raid.def": "Оборона {n}", "vg.raid.shield": "Щит {t}", "vg.raid.pair": "Снова через {t}",
    "vg.raid.done": "Взят сегодня", "vg.raid.noArmy": "Сначала обучите несколько воинов (вкладка «Войско»)",
    "vg.raid.chron": "Хроника обороны", "vg.raid.chronEmpty": "На вас ещё никто не нападал.", "vg.raid.revenge": "Отомстить",
    "vg.raid.robbed": "{nick} ограбил(а) вас: −{n} 🪙", "vg.raid.held": "{nick} напал(а), но ушёл ни с чем", "vg.raid.ago": "{t} назад",
    "vg.raid.rules": "Осада не сохранилась в сети ({code}). Владельцу сайта нужно добавить правила Firestore для коллекции raids.",
    "vg.raid.selfShield": "Ваш щит пропадёт, если нападёте на игрока",
    "vg.s.title": "Осада", "vg.s.fort": "Крепость: мат в {n}", "vg.s.moves": "Ход {a} из {b}", "vg.s.scout": "Разведка · {n}", "vg.s.retreat": "Отступить",
    "vg.s.noengine": "Шахматная доска ещё не готова — попробуйте через секунду", "vg.s.hintLeft": "Подсказок осталось: {n}", "vg.s.noHints": "Разведчики закончились",
    "vg.s.fail": "Крепость устояла", "vg.s.failSub": "Мат не удалось поставить вовремя.", "vg.s.retry": "Ещё попытка · {n}", "vg.s.win": "Крепость взята!",
    "vg.s.loot": "Добыча: +{n} монет", "vg.s.lost": "Потеряно воинов: {list}", "vg.s.noLoss": "Без потерь", "vg.s.ok": "В деревню",
    "vg.s.stars": "Мат за {n} ход. · подсказок {h} · повторов {r}", "vg.s.rep": "Слава {n}",
    "vg.camp.0": "Хижина бандитов", "vg.camp.1": "Форт грабителей", "vg.camp.2": "Крепость Чёрной ладьи",
    "vg.q.title": "Задания дня", "vg.q.sub": "Большинство заданий — настоящие шахматы: играйте, решайте, побеждайте. Выполните все три — получите бонусный сундук.",
    "vg.q.puz": "Решите новых задач: {n}", "vg.q.win": "Выиграйте партий: {n}", "vg.q.xp": "Заработайте {n} опыта в партиях и задачах", "vg.q.game": "Завершите партий: {n}", "vg.q.siege": "Выиграйте осад чужих деревень: {n}",
    "vg.q.camp": "Возьмите лагерей разбойников: {n}", "vg.q.collect": "Соберите казну {n} раз(а)", "vg.q.build": "Улучшите здания {n} раз(а)", "vg.q.train": "Обучите воинов: {n}", "vg.q.deco": "Купите на базаре украшение: {n}",
    "vg.q.claim": "Забрать · {n}", "vg.q.claimed": "Готово", "vg.q.bonus": "Бонусный сундук · {n}", "vg.q.got": "Награда за задание: +{n} монет", "vg.q.go": "Играть",
    "vg.land.army": "⚔ {a} · 🛡 {d}", "vg.land.toRaid": "К осадам", "vg.land.robbed": "Пока вас не было: −{n} 🪙 за {k} набег(а)",
    "vg.visit.attack": "⚔ Осадить деревню"
  });

  /* ---------- войско ---------- */
  const UT = ["pawn", "knight", "bishop", "rook", "queen"];
  const UNITS = {
    pawn:   { atk: 5,  def: 4,  pop: 1, cost: 12,  need: "cottages", g: "♟" },
    knight: { atk: 14, def: 7,  pop: 2, cost: 40,  need: "stables",  g: "♞" },
    bishop: { atk: 11, def: 11, pop: 2, cost: 45,  need: "chapel",   g: "♝" },
    rook:   { atk: 8,  def: 26, pop: 3, cost: 70,  need: "towers",   g: "♜" },
    queen:  { atk: 40, def: 30, pop: 5, cost: 220, need: "palace",   g: "♛" }
  };
  const num = (x, d) => (Number.isFinite(+x) ? +x : (d || 0));
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  function W() {
    const x = A.vx();
    const w = (x.war && typeof x.war === "object") ? x.war : (x.war = {});
    if (!w.army || typeof w.army !== "object") w.army = {};
    UT.forEach(k => { w.army[k] = Math.max(0, Math.floor(num(w.army[k]))); });
    if (w.march) {                                   // старый поход (v5): возвращаем войско домой
      try { UT.forEach(k => { w.army[k] += Math.max(0, Math.floor(num(w.march.u && w.march.u[k]))); }); } catch (e) {}
      w.march = null;
    }
    if (!w.hit || typeof w.hit !== "object") w.hit = {};
    if (!w.camps || typeof w.camps !== "object") w.camps = { d: null, done: [] };
    if (!Array.isArray(w.log)) w.log = [];
    if (!Array.isArray(w.seen)) w.seen = [];
    w.rep = Math.max(0, Math.floor(num(w.rep)));
    w.won = Math.floor(num(w.won)); w.lost = Math.floor(num(w.lost)); w.loot = Math.floor(num(w.loot));
    w.shield = num(w.shield);
    return w;
  }
  const mulOf = k => { const l = A.lv(UNITS[k].need); return 1 + 0.08 * Math.max(0, l - 1); };
  function housing(v) { v = v || A.st(); return 6 + 3 * A.lv("hall", v) + 2 * A.lv("cottages", v) + 3 * A.lv("castle", v) + A.lv("towers", v); }
  function popOf(u) { return UT.reduce((n, k) => n + num(u[k]) * UNITS[k].pop, 0); }
  function usedPop() { return popOf(W().army); }
  function attackOf(u, v) { return Math.round(UT.reduce((n, k) => n + num(u[k]) * UNITS[k].atk * mulOf(k), 0) * (1 + A.bonus("atk", v))); }
  function defenseOf(v) {
    v = v || A.st(); const w = W();
    const walls = 12 * A.lv("towers", v) + 20 * A.lv("castle", v) + 6 * A.lv("hall", v) + 4 * A.lv("garden", v);
    const garrison = UT.reduce((n, k) => n + w.army[k] * UNITS[k].def * mulOf(k), 0);
    return Math.round((10 + walls + garrison) * (1 + A.bonus("def", v)));
  }
  function unitOpen(k, v) { return A.lv(UNITS[k].need, v) >= 1; }

  /* снаряжение осады: что дают фигуры */
  function kit() {
    const a = W().army;
    const hints = Math.min(3, 1 + Math.floor(a.knight / 2));
    const retries = Math.min(2, Math.floor(a.bishop / 3));
    const loot = Math.min(30, Math.floor(a.pawn / 5) * 5) + (a.queen > 0 ? 25 : 0);
    return { hints, retries, loot };
  }

  function train(k, n) {
    const v = A.st(), w = W(), u = UNITS[k];
    if (!u || !v.founded) return;
    if (!unitOpen(k, v)) { toast("vg.army.need", { name: t("vl.b." + u.need) }); return; }
    const room = Math.floor((housing(v) - usedPop()) / u.pop);
    n = Math.min(n, room);
    if (n < 1) { toast("vg.army.full"); sfx("err"); return; }
    const price = u.cost * n;
    if (UI.state.coins < price) { toast("vl.noCoins"); sfx("err"); return; }
    UI.state.coins -= price; w.army[k] += n;
    sfx("coin"); qBump("train", n); A.persist();
    toast("vg.army.trained", { name: t("vg.u." + k), n });
    A.renderSide();
  }
  function fire(k) {
    const w = W(); if (w.army[k] < 1) return;
    w.army[k]--; A.persist(); A.renderSide();
  }

  /* ---------- осады: сложность и задача ---------- */
  function rnd() { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const TIERS = ["mate1", "mate2", "mate3", "mate4"];
  function tierFor(def) { return def < 70 ? "mate1" : def < 150 ? "mate2" : def < 270 ? "mate3" : "mate4"; }
  function campTier(i) { return TIERS[clamp(Math.floor((A.lv("hall") - 1) / 3) + i, 0, 3)]; }
  const tierN = tier => +String(tier).replace("mate", "") || 1;
  function applyLosses(frac) {
    const w = W(), lost = {};
    UT.forEach(k => { let l = 0; for (let i = 0; i < w.army[k]; i++) if (rnd() < frac) l++; lost[k] = l; });
    UT.forEach(k => { w.army[k] -= lost[k]; });
    return lost;
  }
  function haveForce() { if (attackOf(W().army) < 1) { toast("vg.raid.noArmy"); return false; } return true; }

  /* ---------- лагеря разбойников (PvE) ---------- */
  function campsToday() {
    const v = A.st(), w = W(), d = A.today();
    if (w.camps.d !== d) { w.camps = { d, done: [] }; }
    return [0, 1, 2].map(i => ({
      i, tier: campTier(i), def: [50, 110, 200][i] + A.lv("hall", v) * 6,
      loot: Math.round((25 + A.lv("hall", v) * 14) * [1, 1.7, 2.6][i]), done: w.camps.done.includes(i)
    }));
  }
  function attackCamp(i) {
    if (!haveForce()) return;
    const c = campsToday()[i]; if (!c || c.done) return;
    openSiege({
      name: t("vg.camp." + i), tier: c.tier, key: "camp" + i + (A.st().name || ""), kind: "camp", icon: ["♟", "♞", "♜"][i],
      onResult: res => {
        const w = W(); let loot = 0, lost = {};
        if (res.stars) {
          loot = Math.round(c.loot * (0.6 + 0.2 * res.stars) * (1 + A.bonus("loot") + kit().loot / 100));
          w.camps.done.push(i); UI.state.coins += loot; w.won++; w.loot += loot; w.rep += res.stars * 3; qBump("camp", 1);
        } else { w.lost++; lost = applyLosses(0.12); }
        A.persist();
        return { loot, lost, rep: w.rep };
      }
    });
  }

  /* ---------- сеть ---------- */
  const db = () => (typeof Cloud !== "undefined" && Cloud.enabled && Cloud._db) ? Cloud._db : null;
  const me = () => (typeof Cloud !== "undefined" && Cloud.user) ? Cloud.user.uid : null;

  X.packW = function (v) {
    const w = W();
    return { d: defenseOf(v), a: attackOf(w.army, v), s: w.shield > Date.now() ? Math.round(w.shield) : 0, h: A.lv("hall", v), rp: w.rep };
  };
  function pubNow() { try { A.save(); if (window.saveState) saveState(UI.state); } catch (e) {} }

  function lootEst(wd) {
    if (!wd) return 0;
    const g = num(wd.g), r = num(wd.r), c = num(wd.c, 1e9), at = num(wd.t, Date.now());
    return Math.max(0, Math.floor(Math.min(c, g + r * Math.max(0, Date.now() - at) / 3.6e6)));
  }
  function targetFrom(uid, d) {
    if (!d || !d.vil || uid === me()) return null;
    const v = Village.unpack(d.vil); if (!v || !v.founded) return null;
    const wd = v._w || {};
    const def = Math.max(10, Math.round(num(wd.d, 10 + 12 * num(v.b.towers) + 20 * num(v.b.castle) + 6 * num(v.b.hall))));
    return {
      uid, nick: d.nick || "?", name: v.name || d.nick || "?", raw: d.vil, def, tier: tierFor(def),
      gold: lootEst(wd), shield: num(wd.s), hall: num(wd.h, num(v.b.hall)), rep: num(wd.rp), live: !!v._w
    };
  }
  let near = null, nearAt = 0, nearErr = null, loading = false, pool = [], offset = 0;
  async function loadNear(force) {
    const D = db(); if (!D || !me()) { near = null; return; }
    if (loading) return;
    if (!force && near && Date.now() - nearAt < 5 * 60e3) return;
    loading = true; nearErr = null; paintRaid();
    try {
      const snap = await D.collection("leaderboard").orderBy("score", "desc").limit(250).get();
      const list = [];
      snap.forEach(doc => { const x = targetFrom(doc.id, doc.data()); if (x && x.live) list.push(x); });
      const myAtk = attackOf(W().army) || 30;
      list.sort((a, b) => Math.abs(a.def - myAtk) - Math.abs(b.def - myAtk));
      pool = list; offset = 0; near = list.slice(0, 6); nearAt = Date.now();
    } catch (e) { nearErr = e.code || String(e); near = []; }
    loading = false; paintRaid();
  }
  function moreTargets() {
    if (!pool.length) return loadNear(true);
    offset = (offset + 6) % Math.max(6, pool.length);
    near = pool.slice(offset, offset + 6); if (!near.length) near = pool.slice(0, 6);
    paintRaid();
  }
  async function findNick(nick) {
    const D = db(); if (!D) return;
    const key = (typeof Nick !== "undefined" && Nick.normKey) ? Nick.normKey(nick) : String(nick).toLowerCase();
    if (!key) return;
    try {
      const snap = await D.collection("leaderboard").where("nickLower", "==", key).limit(1).get();
      if (snap.empty) { toast("vg.raid.nofound"); return; }
      const doc = snap.docs[0], x = targetFrom(doc.id, doc.data());
      if (!x) { toast("vg.raid.nofound"); return; }
      near = [x].concat((near || []).filter(y => y.uid !== x.uid)).slice(0, 6); paintRaid();
    } catch (e) { toast("vg.raid.err", { code: e.code || "?" }); }
  }
  async function fetchTarget(uid) {
    const D = db(); if (!D) return null;
    try { const doc = await D.collection("leaderboard").doc(uid).get(); return doc.exists ? targetFrom(uid, doc.data()) : null; } catch (e) { return null; }
  }
  async function shieldOf(uid) {
    const D = db(); if (!D) return 0;
    try {
      const snap = await D.collection("raids").where("to", "==", uid).limit(30).get();
      let s = 0; snap.forEach(d => { const x = d.data(); if (x && x.stars > 0) s = Math.max(s, num(x.at) + SHIELD_MS); });
      return s;
    } catch (e) { return 0; }
  }
  function blockOf(x) {
    const w = W(), now = Date.now();
    if (x.shield > now) return t("vg.raid.shield", { t: A.fmtT(x.shield - now) });
    const h = num(w.hit[x.uid]);
    if (h && now - h < PAIR_MS) return t("vg.raid.pair", { t: A.fmtT(PAIR_MS - (now - h)) });
    return "";
  }

  let busy = false;
  async function attackPlayer(uid) {
    if (busy) return;
    if (!me()) { toast("vg.raid.off"); return; }
    if (!haveForce()) return;
    busy = true;
    try {
      let x = (near || []).find(y => y.uid === uid);
      const fresh = await fetchTarget(uid); if (fresh) x = fresh;
      if (!x) { toast("vg.raid.nofound"); return; }
      const sh = await shieldOf(uid); if (sh > x.shield) x.shield = sh;
      const block = blockOf(x); if (block) { UI._toast(block); return; }
      openSiege({
        name: x.name + " · " + x.nick, tier: x.tier, key: uid, kind: "player", icon: "♜",
        onResult: async res => {
          const w = W(), myAtk = attackOf(w.army);
          let loot = res.stars ? Math.floor(x.gold * LOOT_PCT[res.stars] * (1 + A.bonus("loot") + kit().loot / 100)) : 0;
          loot = Math.min(loot, LOOT_MAX, x.gold);
          const myNick = (UI.state && UI.state.nick) || "?";
          try {
            await db().collection("raids").add({
              from: me(), to: uid, nick: String(myNick).slice(0, 24), vname: String(A.st().name || "").slice(0, 20),
              stars: res.stars, loot: Math.floor(loot), atk: Math.round(myAtk), def: Math.round(x.def), at: Date.now()
            });
          } catch (e) {
            toast("vg.raid.rules", { code: e.code || "?" });
            return { loot: 0, lost: {}, rep: w.rep, aborted: true };      // без записи защитник ничего не теряет — добычу «из воздуха» не даём
          }
          let lost = {};
          w.hit[uid] = Date.now(); w.shield = 0;
          if (res.stars) { UI.state.coins += loot; w.won++; w.loot += loot; w.rep += res.stars * 10; qBump("siege", 1); }
          else { w.lost++; w.rep = Math.max(0, w.rep - 5); lost = applyLosses(0.12); }
          if (near) near = near.map(y => y.uid === uid ? Object.assign({}, y, { gold: Math.max(0, y.gold - loot), shield: res.stars ? Date.now() + SHIELD_MS : y.shield }) : y);
          A.persist(); pubNow();
          return { loot, lost, rep: w.rep };
        }
      });
    } finally { busy = false; }
  }

  let pollAt = 0, polling = false, robbedNote = null;
  async function pollRaids(force) {
    const D = db(), uid = me(); if (!D || !uid || polling) return;
    if (!force && Date.now() - pollAt < 60e3) return;
    polling = true; pollAt = Date.now();
    try {
      const snap = await D.collection("raids").where("to", "==", uid).limit(40).get();
      const w = W(), v = A.st(); let lostSum = 0, k = 0, changed = false;
      const docs = []; snap.forEach(d => docs.push(d));
      docs.sort((a, b) => num(a.data().at) - num(b.data().at));
      for (const d of docs) {
        const r = d.data() || {};
        if (!w.seen.includes(d.id)) {
          w.seen.push(d.id); if (w.seen.length > 80) w.seen.splice(0, w.seen.length - 80);
          let taken = 0;
          if (v.founded && num(r.stars) > 0) {
            A.tick(); const x = A.vx();
            taken = Math.min(Math.floor(x.gold), Math.max(0, Math.floor(num(r.loot))));
            x.gold -= taken;
            w.shield = Math.max(w.shield, num(r.at, Date.now()) + SHIELD_MS);
          }
          w.log.unshift({ uid: String(r.from || ""), nick: String(r.nick || "?").slice(0, 24), stars: num(r.stars), loot: taken, at: num(r.at, Date.now()) });
          if (w.log.length > 20) w.log.length = 20;
          lostSum += taken; k++; changed = true;
          UI._toast(taken > 0 ? t("vg.raid.robbed", { nick: r.nick || "?", n: taken }) : t("vg.raid.held", { nick: r.nick || "?" }));
        }
        d.ref.delete().catch(() => {});
      }
      if (changed) {
        if (lostSum > 0) robbedNote = { n: lostSum, k };
        A.persist(); pubNow();
        if (A.root() && A.root().classList.contains("active")) A.renderSide();
      }
    } catch (e) { /* правила ещё не добавлены — тихо */ }
    polling = false;
  }

  /* ---------- ОСАДА: окно с настоящей шахматной доской ---------- */
  let sEl = null, sCtl = null, sCur = null;
  function closeSiege() {
    if (sCtl && sCtl.destroy) sCtl.destroy();
    sCtl = null; sCur = null;
    if (sEl) sEl.classList.remove("open");
    document.body.classList.remove("vg-sieging");
    A.renderSide(); A.badge();
  }
  function siegeShell() {
    if (sEl) return;
    sEl = document.createElement("div"); sEl.className = "vg-siege"; sEl.id = "vg-siege";
    document.body.appendChild(sEl);
    sEl.addEventListener("click", e => {
      const b = e.target.closest("[data-sg]"); if (!b) return;
      const a = b.dataset.sg;
      if (a === "hint") useHint();
      else if (a === "retreat") { if (sCur && !sCur.done) finishSiege(0, true); else closeSiege(); }
      else if (a === "retry") retrySiege();
      else if (a === "close") closeSiege();
    });
  }
  function openSiege(o) {
    if (typeof PuzzleController === "undefined" || typeof Chess === "undefined" || typeof PUZZLES === "undefined" || !PUZZLES[o.tier] || !PUZZLES[o.tier].length) { toast("vg.s.noengine"); return; }
    siegeShell();
    const pl = PUZZLES[o.tier], k = kit();
    sCur = { o, puzzle: pl[hash(o.key + A.today()) % pl.length], hints: k.hints, hintsUsed: 0, retries: k.retries, retriesUsed: 0, done: false, moves: 0 };
    drawSiege();
    sEl.classList.add("open"); document.body.classList.add("vg-sieging");
    startBoard();
  }
  function stars3(n) { let s = ""; for (let i = 1; i <= 3; i++) s += `<i class="${i <= n ? "on" : ""}" style="--d:${300 + i * 220}ms">★</i>`; return s; }
  function drawSiege() {
    const o = sCur.o, n = tierN(o.tier);
    sEl.innerHTML = `<div class="vg-s-card">
      <div class="vg-s-head">
        <span class="vg-s-ic">${o.icon || "♜"}</span>
        <div><p class="vl-kicker">${esc(t("vg.s.title"))}</p><h3>${esc(o.name)}</h3><small>${esc(t("vg.s.fort", { n }))}</small></div>
      </div>
      <div class="vg-s-play" id="vg-s-play">
        <p class="vg-s-status" id="vg-s-status"></p>
        <div class="vg-s-boardwrap"><div class="board vg-board" id="vg-board"></div></div>
        <div class="vg-s-bar">
          <span class="vl-chip" id="vg-s-mv">${esc(t("vg.s.moves", { a: 0, b: sCur.puzzle.movesAllowed }))}</span>
          <span class="vl-chip" id="vg-s-kit"></span>
        </div>
        <div class="vg-s-act">
          <button type="button" class="btn btn-ghost" data-sg="hint" id="vg-s-hint">${esc(t("vg.s.scout", { n: sCur.hints }))}</button>
          <button type="button" class="btn btn-ghost" data-sg="retreat">${esc(t("vg.s.retreat"))}</button>
        </div>
      </div>
      <div class="vg-s-res" id="vg-s-res" hidden></div>
    </div>`;
    kitLine();
  }
  function kitLine() {
    const el = $("vg-s-kit"), h = $("vg-s-hint"); if (!el || !sCur) return;
    el.textContent = t("vg.kit.hints", { n: sCur.hints }) + " · " + t("vg.kit.retries", { n: sCur.retries });
    if (h) { h.textContent = t("vg.s.scout", { n: sCur.hints }); h.disabled = sCur.hints < 1; }
  }
  function startBoard() {
    if (sCtl && sCtl.destroy) sCtl.destroy();
    const status = $("vg-s-status"), mv = $("vg-s-mv");
    sCtl = new PuzzleController({
      boardEl: $("vg-board"), puzzle: Object.assign({}, sCur.puzzle),
      onStatus: s => { if (status) status.textContent = s; },
      onHud: i => { if (sCur) sCur.moves = i.used; if (mv) mv.textContent = t("vg.s.moves", { a: Math.min(i.used + 1, i.allowed), b: i.allowed }); },
      onSolved: r => { if (!sCur) return; sCur.moves = r.moves; setTimeout(() => finishSiege(Math.max(1, 3 - sCur.hintsUsed - sCur.retriesUsed), false), 650); },
      onFailed: () => { if (sCur) setTimeout(failed, 700); }
    });
    sfx("move");
  }
  function useHint() {
    if (!sCur || sCur.done || !sCtl) return;
    if (sCur.hints < 1) { toast("vg.s.noHints"); return; }
    if (sCtl.hint()) { sCur.hints--; sCur.hintsUsed++; kitLine(); sfx("coin"); }
  }
  function failed() {
    if (!sCur || sCur.done) return;
    if (sCur.retries > 0) {
      const res = $("vg-s-res"), play = $("vg-s-play"); if (!res || !play) return;
      play.hidden = true; res.hidden = false;
      res.innerHTML = `<div class="vg-s-out lose"><div class="vg-s-big">♞</div><h4>${esc(t("vg.s.fail"))}</h4><p class="vl-dim">${esc(t("vg.s.failSub"))}</p>
        <div class="vg-s-act"><button type="button" class="btn btn-primary" data-sg="retry">${esc(t("vg.s.retry", { n: sCur.retries }))}</button><button type="button" class="btn btn-ghost" data-sg="retreat">${esc(t("vg.s.retreat"))}</button></div></div>`;
      sfx("err");
    } else finishSiege(0, false);
  }
  function retrySiege() {
    if (!sCur || sCur.retries < 1) return;
    sCur.retries--; sCur.retriesUsed++;
    const res = $("vg-s-res"), play = $("vg-s-play");
    if (res) res.hidden = true; if (play) play.hidden = false;
    kitLine(); startBoard();
  }
  async function finishSiege(stars, retreat) {
    if (!sCur || sCur.done) return;
    sCur.done = true;
    const cur = sCur, play = $("vg-s-play"), res = $("vg-s-res");
    if (sCtl && sCtl.destroy) sCtl.destroy();
    if (play) play.hidden = true;
    let r = { loot: 0, lost: {}, rep: null };
    try { r = (await cur.o.onResult({ stars, retreat })) || r; } catch (e) { console.error(e); }
    if (!res || !sEl || !sEl.classList.contains("open")) return;
    const lost = UT.filter(k => r.lost && r.lost[k] > 0).map(k => `${UNITS[k].g}×${r.lost[k]}`).join("  ");
    const win = stars > 0 && !r.aborted;
    res.hidden = false;
    res.innerHTML = `<div class="vg-s-out ${win ? "win" : "lose"}">
      <div class="vg-b-stars">${stars3(win ? stars : 0)}</div>
      <h4>${esc(win ? t("vg.s.win") : t("vg.s.fail"))}</h4>
      ${win ? `<p class="vg-b-loot">${esc(t("vg.s.loot", { n: r.loot }))}</p><p class="vl-dim">${esc(t("vg.s.stars", { n: cur.moves, h: cur.hintsUsed, r: cur.retriesUsed }))}</p>` : `<p class="vl-dim">${esc(t("vg.s.failSub"))}</p>`}
      <p class="vl-dim">${lost ? esc(t("vg.s.lost", { list: lost })) : esc(t("vg.s.noLoss"))}</p>
      ${r.rep != null ? `<p class="vl-dim">${esc(t("vg.s.rep", { n: r.rep }))}</p>` : ""}
      <button type="button" class="btn btn-primary" data-sg="close">${esc(t("vg.s.ok"))}</button></div>`;
    setTimeout(() => sfx(win ? "win" : "err"), 500);
  }

  /* ---------- задания дня: настоящие шахматы + немного деревни ---------- */
  const QCHESS = [["puz", 2, 45], ["puz", 4, 80], ["win", 1, 60], ["win", 2, 100], ["xp", 60, 50], ["xp", 150, 90], ["game", 1, 35], ["siege", 1, 70], ["camp", 2, 60]];
  const QTOWN = [["collect", 2, 30], ["build", 1, 45], ["train", 5, 40], ["collect", 3, 45]];
  const QICON = { puz: "♘", win: "♛", xp: "✦", game: "♟", siege: "♜", camp: "♞", collect: "◎", build: "♖", train: "♙", deco: "✧" };
  const snapNow = () => { const s = UI.state || {}; return { puz: (s.completedPuzzles || []).length, win: (s.stats && s.stats.wins) || 0, xp: s.xp || 0, game: (s.stats && s.stats.gamesPlayed) || 0 }; };
  const DERIVED = { puz: 1, win: 1, xp: 1, game: 1 };
  function Q() {
    const x = A.vx(), d = A.today();
    if (!x.q || x.q.d !== d || !x.q.base) {
      let h = hash(d + "q6") || 1;
      const nx = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h; };
      const picks = [], used = {};
      for (let i = 0; picks.length < 2 && i < 60; i++) { const q = QCHESS[nx() % QCHESS.length]; if (used[q[0]] || (q[0] === "siege" && !me())) continue; used[q[0]] = 1; picks.push(q); }
      picks.push(QTOWN[nx() % QTOWN.length]);
      x.q = { d, base: snapNow(), list: picks.map(p => ({ k: p[0], n: p[1], r: p[2], p: 0, c: 0 })), bonus: 0 };
    }
    return x.q;
  }
  function progOf(it, q) {
    if (DERIVED[it.k]) { const b = (q || Q()).base || {}; return clamp(snapNow()[it.k] - num(b[it.k]), 0, it.n); }
    return Math.min(it.n, it.p);
  }
  function qBump(k, n) {
    if (DERIVED[k]) return;
    const q = Q(); let ch = false;
    q.list.forEach(it => { if (it.k === k && it.p < it.n) { it.p = Math.min(it.n, it.p + n); ch = true; } });
    if (ch) { A.save(); A.badge(); }
  }
  X.on.push((k, n) => { if (k === "collect" || k === "build" || k === "deco") qBump(k, 1); });
  function claim(i) {
    const q = Q(), it = q.list[+i]; if (!it || it.c || progOf(it, q) < it.n) return;
    it.c = 1; UI.state.coins += it.r; sfx("coin"); toast("vg.q.got", { n: it.r }); A.celebrate(); A.renderSide();
  }
  function claimBonus() {
    const q = Q(); if (q.bonus || !q.list.every(x => x.c)) return;
    const n = 80 + 15 * A.lv("hall");
    q.bonus = 1; UI.state.coins += n; sfx("win"); toast("vg.q.got", { n }); A.celebrate(); A.renderSide();
  }
  function questHtml() {
    const q = Q(), bonusN = 80 + 15 * A.lv("hall"), all = q.list.every(x => x.c);
    const done = q.list.filter(x => x.c).length;
    return `<div class="vg-pane"><div class="vr-panel vg-qhead"><div><p class="vl-kicker">${t("vg.q.title")}</p><p class="vl-found-sub">${t("vg.q.sub")}</p></div><b class="vg-qcount">${done}/3</b></div>
      ${q.list.map((it, i) => {
        const pr = progOf(it, q), pct = Math.round(pr / it.n * 100), ready = pr >= it.n;
        const go = !ready && !it.c && DERIVED[it.k] ? `<button type="button" class="vl-rename" data-a="go" data-v="${it.k === "xp" || it.k === "puz" ? "levels" : "levels"}">${t("vg.q.go")}</button>` : "";
        return `<article class="vl-card vg-q ${it.c ? "on" : ""} ${ready && !it.c ? "ready" : ""}">
          <span class="vg-glyph">${QICON[it.k] || "♟"}</span>
          <div class="vl-card-t"><b>${esc(t("vg.q." + it.k, { n: it.n }))}</b><span class="vx-bar"><i style="width:${pct}%"></i></span><small>${pr} / ${it.n}</small></div>
          <div class="vl-card-act vg-acts">${go}<button type="button" class="shop-btn" data-a="vg-claim" data-v="${i}" ${it.c || !ready ? "disabled" : ""}>${it.c ? t("vg.q.claimed") : t("vg.q.claim", { n: it.r })}</button></div>
        </article>`;
      }).join("")}
      <button type="button" class="btn btn-primary vg-bonus" data-a="vg-bonus" ${all && !q.bonus ? "" : "disabled"}>🎁 ${q.bonus ? t("vg.q.claimed") : t("vg.q.bonus", { n: bonusN })}</button>
    </div>`;
  }

  /* ---------- панели ---------- */
  function kitHtml() {
    const k = kit();
    return `<div class="vr-panel vg-kit"><p class="vl-kicker">${t("vg.kit.title")}</p>
      <div class="vg-stats"><span class="vl-chip"><i>♞</i>${t("vg.kit.hints", { n: k.hints })}</span><span class="vl-chip"><i>♝</i>${t("vg.kit.retries", { n: k.retries })}</span><span class="vl-chip"><i>♟</i>${t("vg.kit.loot", { n: k.loot })}</span></div></div>`;
  }
  function armyHtml(v) {
    const w = W(), cap = housing(v), used = usedPop();
    const rows = UT.map(k => {
      const u = UNITS[k], open = unitOpen(k, v), m = mulOf(k);
      const a = Math.round(u.atk * m), d = Math.round(u.def * m);
      return `<article class="vl-card vg-unit ${open ? "" : "locked"}">
        <span class="vg-glyph">${u.g}</span>
        <div class="vl-card-t"><b>${t("vg.u." + k)} <em class="vg-n">×${w.army[k]}</em></b>
          <small>${t("vg.u." + k + ".d")}</small>
          <i class="vx-perk">${t("vg.perk." + k)}</i>
          <i class="vx-perk vg-stat">${t("vg.army.stat", { a, d, p: u.pop })}</i>
          ${open ? "" : `<i class="vl-need">${t("vg.army.need", { name: t("vl.b." + u.need) })}</i>`}</div>
        <div class="vl-card-act vg-acts">
          <button type="button" class="shop-btn" data-a="vg-train" data-v="${k}:1" ${open ? "" : "disabled"}>${t("vg.army.train", { n: u.cost })}</button>
          <button type="button" class="shop-btn" data-a="vg-train" data-v="${k}:5" ${open ? "" : "disabled"}>${t("vg.army.train5", { n: u.cost * 5 })}</button>
          ${w.army[k] ? `<button type="button" class="vl-rename" data-a="vg-fire" data-v="${k}">${t("vg.army.fire")}</button>` : ""}
        </div></article>`;
    }).join("");
    return `<div class="vg-pane">
      <div class="vr-panel">
        <div class="vg-stats">
          <span class="vl-chip">${t("vg.army.atk", { n: attackOf(w.army, v) })}</span>
          <span class="vl-chip">${t("vg.army.def", { n: defenseOf(v) })}</span>
          <span class="vl-chip">${t("vg.army.pop", { a: used, b: cap })}</span>
        </div>
        <span class="vx-bar"><i style="width:${Math.min(100, Math.round(used / cap * 100))}%"></i></span>
        <p class="vl-found-sub">${t("vg.army.hint")}</p>
      </div>
      ${kitHtml()}
      <div class="vl-list">${rows}</div></div>`;
  }
  function targetCard(x, act) {
    const block = blockOf(x), n = tierN(x.tier);
    return `<article class="vl-card vg-tgt">
      <span class="vg-glyph">♜</span>
      <div class="vl-card-t"><b>${esc(x.name)}</b><small>${esc(x.nick)} · ${t("vl.lv", { n: x.hall })}${x.rep ? " · " + t("vg.raid.rep", { n: x.rep }) : ""}</small>
        <i class="vx-perk">${t("vg.raid.def", { n: x.def })} · ${t("vg.raid.loot", { n: Math.min(LOOT_MAX, Math.floor(x.gold * LOOT_PCT[3])) })}</i>
        <span class="vg-mate">♔ ${esc(t("vg.s.fort", { n }))}</span></div>
      <div class="vl-card-act vg-acts">
        <button type="button" class="vl-rename" data-a="vg-look" data-v="${esc(x.uid)}">👁</button>
        <button type="button" class="shop-btn" data-a="${act}" data-v="${esc(x.uid)}" ${block ? "disabled" : ""}>${block ? esc(block) : t("vg.raid.attack")}</button>
      </div></article>`;
  }
  function raidHtml(v) {
    const w = W(), atk = attackOf(w.army, v);
    const camps = campsToday().map(c => `<article class="vl-card vg-camp ${c.done ? "on" : ""}">
        <span class="vg-glyph">${["♟", "♞", "♜"][c.i]}</span>
        <div class="vl-card-t"><b>${t("vg.camp." + c.i)}</b><i class="vx-perk">${t("vg.raid.loot", { n: c.loot })}</i><span class="vg-mate">♔ ${esc(t("vg.s.fort", { n: tierN(c.tier) }))}</span></div>
        <button type="button" class="shop-btn" data-a="vg-camp" data-v="${c.i}" ${c.done ? "disabled" : ""}>${c.done ? t("vg.raid.done") : t("vg.raid.attack")}</button>
      </article>`).join("");
    let players;
    if (!me()) players = `<p class="vl-dim">${t("vg.raid.off")}</p>`;
    else if (loading && !near) players = `<p class="vl-dim">${t("vg.raid.loading")}</p>`;
    else if (nearErr) players = `<p class="vl-dim">${t("vg.raid.err", { code: esc(nearErr) })}</p>`;
    else if (near && !near.length) players = `<p class="vl-dim">${t("vg.raid.none")}</p>`;
    else players = (near || []).map(x => targetCard(x, "vg-hit")).join("") || `<p class="vl-dim">${t("vg.raid.loading")}</p>`;
    const now = Date.now();
    const chron = w.log.length ? w.log.slice(0, 10).map(l => `<div class="vg-log ${l.loot ? "bad" : "good"}">
        <span>${l.loot ? "🔥" : "🛡"}</span>
        <div><b>${esc(l.loot ? t("vg.raid.robbed", { nick: l.nick, n: l.loot }) : t("vg.raid.held", { nick: l.nick }))}</b><small class="vl-dim">${t("vg.raid.ago", { t: A.fmtT(now - l.at) })}</small></div>
        ${l.uid && me() ? `<button type="button" class="vl-rename" data-a="vg-hit" data-v="${esc(l.uid)}">${t("vg.raid.revenge")}</button>` : ""}
      </div>`).join("") : `<p class="vl-dim">${t("vg.raid.chronEmpty")}</p>`;
    return `<div class="vg-pane">
      <div class="vr-panel">
        <div class="vg-stats">
          <span class="vl-chip">${t("vg.army.atk", { n: atk })}</span>
          <span class="vl-chip">${t("vg.raid.rep", { n: w.rep })}</span>
          ${w.shield > now ? `<span class="vl-chip">🛡 ${A.fmtT(w.shield - now)}</span>` : ""}
        </div>
        <p class="vl-dim">${t("vg.raid.stats", { a: w.won, b: w.lost, c: w.loot })}</p>
      </div>
      ${kitHtml()}
      <p class="vl-label">${t("vg.raid.camps")}</p><p class="vl-found-sub">${t("vg.raid.campsSub")}</p>
      <div class="vl-list">${camps}</div>
      <p class="vl-label">${t("vg.raid.players")}</p><p class="vl-found-sub">${t("vg.raid.playersSub")}${w.shield > now ? " " + t("vg.raid.selfShield") : ""}</p>
      ${me() ? `<div class="vg-search"><input class="vl-input" id="vg-nick" maxlength="24" placeholder="${esc(t("vg.raid.search"))}"><button type="button" class="vl-rename" data-a="vg-find">${t("vg.raid.find")}</button><button type="button" class="vl-rename" data-a="vg-more">↻ ${t("vg.raid.more")}</button></div>` : ""}
      <div class="vl-list" id="vg-players">${players}</div>
      <p class="vl-label">${t("vg.raid.chron")}</p>
      <div class="vg-chron">${chron}</div></div>`;
  }
  function paintRaid() { if (A.tab() === "raid" && A.root() && A.root().classList.contains("active") && !(sEl && sEl.classList.contains("open"))) A.renderSide(); }

  X.tabs.push("army", "raid", "quest");
  X.html.army = armyHtml;
  X.html.raid = v => { loadNear(false); pollRaids(false); return raidHtml(v); };
  X.html.quest = () => questHtml();
  X.landTop.push(v => {
    const w = W(), now = Date.now(), q = Q();
    const ready = q.list.filter(it => !it.c && progOf(it, q) >= it.n).length;
    let h = `<div class="vg-landbar"><span class="vl-chip">${t("vg.land.army", { a: attackOf(w.army, v), d: defenseOf(v) })}</span>`;
    if (w.shield > now) h += `<span class="vl-chip">${t("vl.shield", { t: A.fmtT(w.shield - now) })}</span>`;
    if (ready) h += `<button type="button" class="vl-rename vg-pulse" data-a="tab" data-v="quest">🎁 ${t("vg.q.title")}</button>`;
    h += `<button type="button" class="vl-rename" data-a="tab" data-v="raid">♛ ${t("vg.land.toRaid")}</button></div>`;
    if (robbedNote) { h += `<p class="vg-warn">${t("vg.land.robbed", { n: robbedNote.n, k: robbedNote.k })}</p>`; }
    return h;
  });
  X.act["vg-train"] = val => { const p = String(val).split(":"); train(p[0], +p[1] || 1); };
  X.act["vg-fire"] = k => fire(k);
  X.act["vg-camp"] = i => attackCamp(+i);
  X.act["vg-hit"] = uid => attackPlayer(uid);
  X.act["vg-more"] = () => moreTargets();
  X.act["vg-find"] = () => { const i = $("vg-nick"); if (i && i.value.trim()) findNick(i.value.trim()); };
  X.act["vg-claim"] = i => claim(i);
  X.act["vg-bonus"] = () => claimBonus();
  X.act["vg-look"] = async uid => {
    const x = (near || []).find(y => y.uid === uid) || await fetchTarget(uid);
    if (x) D_visit(uid, { nick: x.nick, vil: x.raw });
  };
  X.on.push((k, v) => { if (k === "tab" && v !== "land") robbedNote = null; });
  X.tick.push(() => { const q = Q(); return q.list.some(x => !x.c && progOf(x, q) >= x.n) || (q.list.every(x => x.c) && !q.bonus); });

  /* ---------- визит: кнопка «Осадить» ---------- */
  const _visit = Village.visit;
  function D_visit(uid, d) { return _visit(uid, d) && addVisitBtn(uid); }
  function addVisitBtn(uid) {
    const card = document.querySelector("#vl-visit .vl-visit-card"); if (!card) return true;
    let b = card.querySelector(".vg-visit-atk");
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "btn btn-primary vg-visit-atk"; card.insertBefore(b, card.querySelector(".vl-visit-back")); }
    b.textContent = t("vg.visit.attack");
    b.hidden = !me() || uid === me() || !A.st().founded;
    b.onclick = () => {
      const vEl = $("vl-visit"); if (vEl) { vEl.classList.remove("open"); document.body.classList.remove("vl-visiting"); }
      Village.open("raid"); setTimeout(() => attackPlayer(uid), 150);
    };
    return true;
  }
  Village.visit = D_visit;

  /* ---------- фоновые проверки ---------- */
  setInterval(() => {
    try {
      if (!UI.state) return;
      pollRaids(false);
      A.badge();
    } catch (e) {}
  }, 20e3);
  if (typeof Cloud !== "undefined" && Cloud._emit) {
    const _em = Cloud._emit;
    Cloud._emit = function (x) { _em.call(this, x); if (x && x.loaded) setTimeout(() => { pollRaids(true); near = null; }, 1500); };
  }
  if (typeof UI !== "undefined" && UI.showView) {
    const _sv = UI.showView;
    UI.showView = function (n) { const r = _sv.apply(this, arguments); if (n === "village") pollRaids(false); if (n !== "village" && sEl && sEl.classList.contains("open")) closeSiege(); return r; };
  }

  window.VillageGame = { UNITS, attackOf: () => attackOf(W().army), defenseOf: () => defenseOf(), pollRaids, loadNear, kit, tierFor, siege: openSiege };
})();