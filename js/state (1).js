/* maper.chess — player state
   Small localStorage-backed store. No frameworks, just get()/save() and a few helpers. */

Object.assign(I18N.en, { "streak.blocked": "System time was changed — the streak day wasn't counted" });
Object.assign(I18N.ru, { "streak.blocked": "Время устройства изменено — день огонька не засчитан" });

const STORAGE_KEY = "mapchess_state_v1";
const STATE_SCHEMA = 2;   // версия формата сохранения: 2 = добавлены daily и flags (старые сохранения читаются как есть)

function defaultState() {
  return {
    lang: detectDefaultLang(),
    coins: 50,
    xp: 0,
    completed: [],              // level ids the player has beaten
    completedPuzzles: [],       // puzzle ids the player has solved
    unlockedAchievements: [],   // achievement ids
    owned: [...DEFAULT_OWNED],  // shop item ids the player owns
    equipped: { board: "board-classic", pieces: "pieces-classic" },
    levelStars: {},             // levelId -> best star rating (1-3) earned so far
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      hintlessWins: 0,
      fastestWin: null
    },
    currentLevelId: null,
    currentPuzzleId: null,
    hints: { left: 3, day: null },   // подсказки: лимит в день, пополняются сами
    streak: defaultStreak(),
    daily: defaultDaily(),           // ежедневное испытание (js/daily.js)
    village: defaultVillage(),       // шахматная деревня / ратуша (js/village.js)
    flags: {},                       // одноразовые подсказки/приветствия интерфейса
    schema: STATE_SCHEMA
  };
}

function defaultVillage() {
  return {
    founded: false,
    name: "",
    foundedAt: 0,
    b: {},
    owned: ["theme-dusk"],
    theme: "theme-dusk",
    deco: [],                                        // только «знамёна» (deco-banners); остальной декор — в decor
    plot: {},
    ui: defaultVillageUi(),
    lastTax: null,                                   // устарело (дань раз в день), нужно для переноса старых сохранений
    folk: { n: 0, max: 0, skin: "skin-classic" },   // жители-фигурки: сколько бегает, сколько уже «нанято», надетый скин
    find: { d: null, n: 0 },                         // монетки, найденные жителями за сегодня
    /* ---- Деревня 2.0 ---- */
    treasury: { at: 0, amt: 0 },                     // казна копится сама; at — момент последнего пересчёта
    army: { u: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 }, q: [], out: [] },   // дома / обучаются / в походе
    decor: { inv: {}, placed: [], mig: 0 },          // склад декора (id → штук) и расстановка по клеткам
    quests: { d: null, list: [], base: {}, cum: {}, done: 0 },// ежедневные задания
    war: { shield: 0, rep: 0, wins: 0, raids: 0, defended: 0, lost: 0, loot: 0, seen: {}, last: {}, log: [], rev: {} },
    bazaar: { slot: 0, bought: [] }                  // базар: ротация товаров каждые 6 часов
  };
}

function defaultVillageUi() {
  return { hud: "full", labels: true, cam: "iso", yaw: 45, zoom: 1 };
}

function mergeVillage(v) {
  const d = defaultVillage();
  if (!v || typeof v !== "object" || Array.isArray(v)) return d;
  const b = {};
  if (v.b && typeof v.b === "object" && !Array.isArray(v.b)) {
    Object.keys(v.b).forEach(k => { if (/^[a-z]{3,12}$/.test(k)) b[k] = Math.max(0, Math.min(12, Math.floor(+v.b[k] || 0))); });
  }
  const owned = Array.isArray(v.owned) ? v.owned.filter(x => typeof x === "string") : [];
  const deco = Array.isArray(v.deco) ? v.deco.filter(x => typeof x === "string") : [];
  const plot = {};
  if (v.plot && typeof v.plot === "object" && !Array.isArray(v.plot)) {
    Object.keys(v.plot).forEach(k => {
      const m = String(v.plot[k]).match(/^([0-7]),([0-7])$/);
      if (m) plot[k] = m[1] + "," + m[2];
    });
  }
  const uiIn = (v.ui && typeof v.ui === "object") ? v.ui : {};
  const ui = defaultVillageUi();
  if (uiIn.hud === "compact" || uiIn.hud === "full") ui.hud = uiIn.hud;
  if (uiIn.labels === false) ui.labels = false;
  if (uiIn.cam === "iso" || uiIn.cam === "hero" || uiIn.cam === "top") ui.cam = uiIn.cam;
  if (Number.isFinite(+uiIn.yaw)) ui.yaw = ((+uiIn.yaw % 360) + 360) % 360;
  if (Number.isFinite(+uiIn.zoom)) ui.zoom = Math.min(1.9, Math.max(0.7, +uiIn.zoom));
  /* жители: у старых сохранений (до v4) при основанной деревне даём двух жителей в подарок */
  const fIn = (v.folk && typeof v.folk === "object" && !Array.isArray(v.folk)) ? v.folk : null;
  const folk = { n: 0, max: 0, skin: "skin-classic" };
  if (fIn) {
    folk.n = Math.max(0, Math.min(24, Math.floor(+fIn.n || 0)));
    folk.max = Math.max(folk.n, Math.min(24, Math.floor(+fIn.max || 0)));
    if (typeof fIn.skin === "string" && /^skin-[a-z0-9-]{1,24}$/.test(fIn.skin)) folk.skin = fIn.skin;
  } else if (v.founded) { folk.n = 2; folk.max = 2; }
  const fdIn = (v.find && typeof v.find === "object") ? v.find : {};
  const find = { d: typeof fdIn.d === "string" ? fdIn.d : null, n: Math.max(0, Math.min(99, Math.floor(+fdIn.n || 0))) };
  /* ---- Деревня 2.0 ---- */
  const num = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(+x || 0)));
  const trIn = (v.treasury && typeof v.treasury === "object") ? v.treasury : {};
  const treasury = { at: num(trIn.at, 0, 4e12), amt: Math.max(0, Math.min(1e6, +trIn.amt || 0)) };
  const UT = ["pawn", "knight", "bishop", "rook", "queen"];
  const aIn = (v.army && typeof v.army === "object") ? v.army : {};
  const army = { u: {}, q: [], out: [] };
  UT.forEach(k => { army.u[k] = num(aIn.u && aIn.u[k], 0, 999); });
  (Array.isArray(aIn.q) ? aIn.q : []).slice(0, 6).forEach(x => {
    if (x && UT.includes(x.t) && num(x.n, 0, 60) > 0) army.q.push({ t: x.t, n: num(x.n, 1, 60), end: num(x.end, 0, 4e12) });
  });
  (Array.isArray(aIn.out) ? aIn.out : []).slice(0, 6).forEach(x => {
    if (!x || typeof x !== "object") return;
    const u = {}; let tot = 0; UT.forEach(k => { u[k] = num(x.u && x.u[k], 0, 999); tot += u[k]; });
    if (tot > 0) army.out.push({ back: num(x.back, 0, 4e12), u });
  });
  const dIn = (v.decor && typeof v.decor === "object") ? v.decor : {};
  const decor = { inv: {}, placed: [], mig: dIn.mig ? 1 : 0 };
  if (dIn.inv && typeof dIn.inv === "object" && !Array.isArray(dIn.inv)) {
    Object.keys(dIn.inv).forEach(k => { if (/^dc-[a-z]{2,14}$/.test(k)) { const n = num(dIn.inv[k], 0, 99); if (n > 0) decor.inv[k] = n; } });
  }
  const used = {};
  (Array.isArray(dIn.placed) ? dIn.placed : []).slice(0, 64).forEach(x => {
    if (!x || !/^dc-[a-z]{2,14}$/.test(x.id)) return;
    const c = num(x.c, -1, 7), r = num(x.r, -1, 7); if (c < 0 || r < 0 || used[c + "," + r]) return;
    used[c + "," + r] = 1; decor.placed.push({ id: x.id, c, r });
  });
  const qIn = (v.quests && typeof v.quests === "object") ? v.quests : {};
  const quests = { d: typeof qIn.d === "string" ? qIn.d : null, list: [], base: {}, cum: {}, done: num(qIn.done, 0, 99999) };
  (Array.isArray(qIn.list) ? qIn.list : []).slice(0, 4).forEach(x => {
    if (x && /^[a-z]{3,12}$/.test(x.k)) quests.list.push({ k: x.k, need: num(x.need, 1, 999), rw: num(x.rw, 0, 999), p: num(x.p, 0, 9999), claimed: x.claimed ? 1 : 0 });
  });
  if (qIn.base && typeof qIn.base === "object") Object.keys(qIn.base).forEach(k => { if (/^[a-z]{3,12}$/.test(k)) quests.base[k] = num(qIn.base[k], 0, 1e9); });
  if (qIn.cum && typeof qIn.cum === "object") Object.keys(qIn.cum).forEach(k => { if (/^[a-z]{3,12}$/.test(k)) quests.cum[k] = num(qIn.cum[k], 0, 1e9); });
  const wIn = (v.war && typeof v.war === "object") ? v.war : {};
  const war = { shield: num(wIn.shield, 0, 4e12), rep: num(wIn.rep, 0, 99999), wins: num(wIn.wins, 0, 99999), raids: num(wIn.raids, 0, 99999),
    defended: num(wIn.defended, 0, 99999), lost: num(wIn.lost, 0, 1e9), loot: num(wIn.loot, 0, 1e9), seen: {}, last: {}, log: [], rev: {} };
  ["seen", "last", "rev"].forEach(f => {
    if (wIn[f] && typeof wIn[f] === "object" && !Array.isArray(wIn[f])) {
      Object.keys(wIn[f]).slice(-80).forEach(k => { if (/^[A-Za-z0-9_\-]{3,80}$/.test(k)) war[f][k] = num(wIn[f][k], 0, 4e12) || 1; });
    }
  });
  (Array.isArray(wIn.log) ? wIn.log : []).slice(-20).forEach(x => {
    if (x && typeof x === "object") war.log.push({ t: num(x.t, 0, 4e12), uid: String(x.uid || "").slice(0, 40), nick: String(x.nick || "").replace(/[<>]/g, "").slice(0, 20),
      stars: num(x.stars, 0, 3), loot: num(x.loot, 0, 1e6), rep: Math.max(-99, Math.min(99, Math.floor(+x.rep || 0))) });
  });
  const bzIn = (v.bazaar && typeof v.bazaar === "object") ? v.bazaar : {};
  const bazaar = { slot: num(bzIn.slot, 0, 1e9), bought: (Array.isArray(bzIn.bought) ? bzIn.bought : []).filter(x => typeof x === "string" && /^dc-[a-z]{2,14}$/.test(x)).slice(0, 12) };
  return {
    founded: !!v.founded,
    name: typeof v.name === "string" ? v.name.trim().slice(0, 20) : "",
    foundedAt: Math.max(0, +v.foundedAt || 0),
    b,
    owned: owned.length ? Array.from(new Set(owned.concat(["theme-dusk"]))) : d.owned.slice(),
    theme: typeof v.theme === "string" ? v.theme : d.theme,
    deco: Array.from(new Set(deco)),
    plot,
    ui,
    lastTax: typeof v.lastTax === "string" ? v.lastTax : null,
    folk,
    find,
    treasury, army, decor, quests, war, bazaar
  };
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("saved progress is not an object");
    // merge with defaults so new fields introduced later don't break old saves
    return Object.assign(defaultState(), parsed, {
      daily: mergeDaily(parsed.daily),
      village: mergeVillage(parsed.village),
      flags: (parsed.flags && typeof parsed.flags === "object") ? parsed.flags : {},
      schema: STATE_SCHEMA,
      lang: parsed.lang || detectDefaultLang(),
      stats: Object.assign(defaultState().stats, parsed.stats || {}),
      equipped: Object.assign(defaultState().equipped, parsed.equipped || {}),
      levelStars: Object.assign({}, parsed.levelStars || {}),
      completedPuzzles: Array.isArray(parsed.completedPuzzles) ? parsed.completedPuzzles : [],
      hints: Object.assign({ left: 3, day: null }, parsed.hints || {}),
      streak: mergeStreak(parsed.streak)
    });
  } catch (e) {
    console.warn("maper.chess: could not read saved progress, starting fresh.", e);
    /* НЕ даём следующему сохранению затереть повреждённую запись — откладываем копию, её можно будет достать вручную */
    try { if (raw) localStorage.setItem(STORAGE_KEY + "_corrupt_backup", raw); } catch (e2) { console.warn("maper.chess: could not back up the broken save.", e2); }
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("maper.chess: could not save progress.", e);
  }
}

// Player "rank" is just a friendly label derived from XP, shown next to the coin count.
const MAX_PLAYER_LEVEL = 300;   // потолок уровня: 300 уровней = 30 званий по 10 уровней (см. ranks.js)
/* Кривая опыта: переход с уровня n на n+1 стоит XP_BASE + XP_STEP*(n-1) XP.
   Ур.1→2 = 100 XP, ур.2→3 = 110, ур.50→51 = 590, ур.299→300 = 3070. Чем выше уровень, тем он дороже.
   Хочешь сложнее/легче — меняй XP_STEP (больше = тяжелее). */
const XP_BASE = 100, XP_STEP = 10;
/* всего XP, нужно набрать, чтобы ДОСТИЧЬ уровня L (для L=1 это 0) */
function xpForLevel(L) {
  L = Math.max(1, Math.floor(+L || 1));
  return XP_BASE * (L - 1) + XP_STEP * (L - 1) * (L - 2) / 2;
}
function playerLevelFromXp(xp) {
  xp = Math.max(0, +xp || 0);
  let lv = 1;
  while (lv < MAX_PLAYER_LEVEL && xp >= xpForLevel(lv + 1)) lv++;
  const need = xpForLevel(lv + 1) - xpForLevel(lv);
  if (lv >= MAX_PLAYER_LEVEL) return { level: MAX_PLAYER_LEVEL, progress: 1, xpIntoLevel: need, xpForNext: need, max: true };
  const into = Math.floor(xp - xpForLevel(lv));
  return { level: lv, progress: into / need, xpIntoLevel: into, xpForNext: need, max: false };
}

function isLevelUnlocked(state, levelId) {
  const idx = ALL_LEVELS.findIndex(l => l.id === levelId);
  if (idx <= 0) return true; // first level of the whole game is always open
  const prev = ALL_LEVELS[idx - 1];
  return state.completed.includes(prev.id);
}

// 0 hints = 3 stars, 1 hint = 2 stars, 2+ hints = 1 star. Simple and easy to explain in the UI.
function starsForResult(hintsUsed) {
  if (hintsUsed <= 0) return 3;
  if (hintsUsed === 1) return 2;
  return 1;
}

function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  return defaultState();
}

function nextIncompleteLevel(state) {
  return ALL_LEVELS.find(l => !state.completed.includes(l.id)) || null;
}

// Runs after any state-changing event; returns newly unlocked achievements (if any) so the UI can toast them.
function checkAchievements(state) {
  const newly = [];
  ACHIEVEMENTS.forEach(a => {
    if (!state.unlockedAchievements.includes(a.id) && a.test(state)) {
      state.unlockedAchievements.push(a.id);
      state.coins += a.coins;
      newly.push(a);
    }
  });
  return newly;
}


/* ---------- streak (огонёк) ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function dayKey(d) { d = d || new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function keyToDate(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12); } // noon: DST-safe
function dayDiff(a, b) { return Math.round((keyToDate(b) - keyToDate(a)) / 86400000); }
function addDays(k, n) { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); }

function defaultStreak() {
  return { count: 0, best: 0, lastDay: null, freezes: 0, history: {}, sec: { lastMs: 0, serverDay: null, serverAt: 0, skewMs: 0, v: 2 } };
}

function mergeStreak(s) {
  if (!s || typeof s !== "object") return defaultStreak();
  const sec = (s.sec && typeof s.sec === "object") ? s.sec : {};
  const out = {
    count: Math.max(0, +s.count || 0),
    best: Math.max(0, +s.best || 0),
    lastDay: typeof s.lastDay === "string" ? s.lastDay : null,
    freezes: Math.min(STREAK_CONFIG.maxFreezes, Math.max(0, +s.freezes || 0)),
    history: s.history && typeof s.history === "object" ? s.history : {},
    sec: {
      lastMs: +sec.lastMs || 0,
      serverDay: typeof sec.serverDay === "string" ? sec.serverDay : null,
      serverAt: +sec.serverAt || 0,
      skewMs: Math.max(0, +sec.skewMs || 0),
      v: +sec.v || 0
    }
  };
  /* ОДНОРАЗОВАЯ МИГРАЦИЯ (баг «огонёк застрял»): в старой версии серверная дата сохранялась навсегда,
     и «сегодня» навсегда замирало на этом старом дне — стрик переставал обновляться.
     Если огонёк застрял именно так (последний день == сохранённый старый serverDay),
     прощаем пропущенные из-за бага дни: серия продолжается, нужно просто сыграть сегодня. */
  if (out.sec.v < 2) {
    const today = dayKey();
    if (out.count > 0 && out.lastDay && out.sec.serverDay && out.lastDay === out.sec.serverDay &&
        dayDiff(out.lastDay, today) > 1) {
      out.lastDay = addDays(today, -1);
    }
    out.sec.serverDay = null; out.sec.serverAt = 0; out.sec.skewMs = 0; out.sec.v = 2;
  }
  return out;
}

/* Слияние двух копий огонька (локальной и облачной): берём ту, где активность была позже.
   Раньше облачный стейт целиком затирал локальный (по XP), и огонёк с другого устройства терялся. */
function mergeStreaks(a, b) {
  a = mergeStreak(a);
  if (!b) return a;
  b = mergeStreak(b);
  let win = a, lose = b;
  const ka = a.count > 0 ? a.lastDay : null, kb = b.count > 0 ? b.lastDay : null;
  if (!ka && kb) { win = b; lose = a; }
  else if (ka && kb) {
    const d = dayDiff(ka, kb);
    if (d > 0 || (d === 0 && b.count > a.count)) { win = b; lose = a; }
  }
  const out = JSON.parse(JSON.stringify(win));
  out.best = Math.max(a.best, b.best, out.count);
  out.history = Object.assign({}, lose.history, win.history);
  const keys = Object.keys(out.history).sort();
  while (keys.length > 40) delete out.history[keys.shift()];
  out.sec.lastMs = Math.max(a.sec.lastMs, b.sec.lastMs);
  return out;
}

/* Какой огонёк показывать другим игрокам: если человек давно не играл и заморозок не хватает,
   серия уже сгорела, даже если в сохранённых данных ещё лежит старое число. */
function streakShown(d) {
  const c = +d.streak || 0;
  if (c <= 0) return 0;
  if (!d.streakDay) return c;
  const gap = dayDiff(d.streakDay, dayKey()) - 1;
  if (gap <= 0) return c;
  return (+d.streakFreezes || 0) >= gap ? c : 0;
}

/* "Сегодня" с учётом сервера: если часы устройства переведены ВПЕРЁД, считаем время сервера.
   Храним не дату, а СДВИГ часов (skewMs = устройство − сервер): дата тогда сама «едет» дальше каждый день
   и не может застрять на старом дне (раньше сохранялась дата и стрик замирал навсегда).
   Сдвиг доверяем 36 часов с момента проверки, дальше — только после новой проверки с сервером. */
function normToday(state) {
  const st = state.streak;
  const sec = st.sec || (st.sec = { lastMs: 0, serverDay: null, serverAt: 0, skewMs: 0, v: 2 });
  const now = Date.now();
  if (sec.skewMs > 0 && sec.serverAt && Math.abs(now - sec.serverAt) < 36 * 3600000) {
    return dayKey(new Date(now - sec.skewMs));
  }
  return dayKey();
}

/* Подсказки: каждый день (по серверной дате, если известна) — полное бесплатное пополнение. */
function refreshHints(state) {
  if (!state.hints) state.hints = { left: 3, day: null };
  const daily = (typeof HINTS_CONFIG !== "undefined") ? HINTS_CONFIG.daily : 3;
  const today = normToday(state);
  if (state.hints.day !== today) {
    state.hints.left = Math.max(+state.hints.left || 0, daily);   /* докупленные/выигранные подсказки не сгорают */
    state.hints.day = today;
    saveState(state);
  }
}

// Call on app start, when the tab regains focus, and before recording activity.
// Returns {status: "none"|"ok"|"frozen"|"lost", used?, lost?}.
function syncStreak(state, today) {
  const st = state.streak;
  today = today || normToday(state);
  if (!st.lastDay || st.count <= 0) return { status: "none" };
  const gap = dayDiff(st.lastDay, today) - 1;      // fully missed days in between
  if (gap <= 0) return { status: "ok" };
  if (st.freezes >= gap) {
    st.freezes -= gap;
    for (let i = 1; i <= gap; i++) st.history[addDays(st.lastDay, i)] = "f";
    st.lastDay = addDays(today, -1);
    return { status: "frozen", used: gap };
  }
  const lost = st.count;
  st.count = 0; st.lastDay = null;                 // freezes are kept if they couldn't cover the gap
  return { status: "lost", lost };
}

// Records "the player did something today". Idempotent within a day.
function recordActivity(state) {
  const st = state.streak;
  const sec = st.sec || (st.sec = { lastMs: 0, serverDay: null, serverAt: 0, skewMs: 0, v: 2 });
  const nowMs = Date.now();

  // 1) часы устройства переведены НАЗАД — день не засчитываем
  if (sec.lastMs && nowMs < sec.lastMs - 10 * 60000) {
    return { first: false, count: st.count, blocked: true };
  }

  let today = normToday(state);
  syncStreak(state, today);

  // 2) уже отмечались этим "сегодня" (по серверу или устройству)
  if (st.lastDay === today) { sec.lastMs = nowMs; return { first: false, count: st.count }; }

  // 3) дата на устройстве ушла назад — не считаем повторно
  if (st.lastDay && dayDiff(st.lastDay, today) < 0) { sec.lastMs = nowMs; return { first: false, count: st.count }; }

  // 4) АНТИ-ФАРМ: за реальное время с прошлой отметки — максимум один новый день на каждые 24ч
  if (st.lastDay && sec.lastMs) {
    const maxDiff = Math.floor((nowMs - sec.lastMs) / 86400000) + 1;
    if (dayDiff(st.lastDay, today) > maxDiff) today = addDays(st.lastDay, maxDiff);
    if (dayDiff(st.lastDay, today) <= 0) { sec.lastMs = nowMs; return { first: false, count: st.count }; }
  }

  st.count = st.count > 0 ? st.count + 1 : 1;
  st.best = Math.max(st.best, st.count);
  st.lastDay = today;
  st.history[today] = 1;
  const keys = Object.keys(st.history).sort();
  while (keys.length > 40) delete st.history[keys.shift()];
  sec.lastMs = nowMs;

  let coins = STREAK_CONFIG.dailyBonus, freeze = false;
  if (STREAK_CONFIG.milestones[st.count]) coins += STREAK_CONFIG.milestones[st.count];
  if (STREAK_CONFIG.freezeMilestones.includes(st.count) && st.freezes < STREAK_CONFIG.maxFreezes) {
    st.freezes++; freeze = true;
  }
  state.coins += coins;
  return { first: true, count: st.count, coins, freeze };
}

// Last 7 days ending today, for the week strip.
function streakWeek(state) {
  const st = state.streak, today = dayKey(), out = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDays(today, -i), h = st.history[key];
    out.push({ key, isToday: i === 0, status: h === 1 ? "done" : h === "f" ? "frozen" : "empty" });
  }
  return out;
}

function timeLeftToday() {
  const n = new Date(), end = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  const ms = end - n;
  return { h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000) };
}


/* ---------- ежедневное испытание: хранение ----------
   days[ключ дня] = { p: [ {s:"n|ok|skip", a:попыток, h:подсказок, pts:очков} × N ], done, score, claimed, at }
   Всё, что касается наград, идемпотентно: claimed ставится один раз на игровой день. */
const DAILY_KEEP_DAYS = 60;
function defaultDaily() {
  return { v: 1, days: {}, best: 0, doneDays: 0, recordBreaks: 0, lastClaimDay: null, lastClaimMs: 0 };
}
function _cleanDailyDay(x) {
  if (!x || typeof x !== "object" || !Array.isArray(x.p)) return null;
  const p = x.p.slice(0, 6).map(e => {
    e = (e && typeof e === "object") ? e : {};
    const st = e.s === "ok" || e.s === "skip" ? e.s : "n";
    return { s: st, a: Math.max(0, Math.min(99, +e.a || 0)), h: Math.max(0, Math.min(99, +e.h || 0)), pts: Math.max(0, Math.min(1000, +e.pts || 0)) };
  });
  return { p, done: !!x.done, score: Math.max(0, Math.min(10000, +x.score || 0)), claimed: !!x.claimed, rb: !!x.rb, at: +x.at || 0,
    rc: Math.max(0, Math.min(5000, +x.rc || 0)), rx: Math.max(0, Math.min(5000, +x.rx || 0)) };
}
function mergeDaily(d) {
  const out = defaultDaily();
  if (!d || typeof d !== "object") return out;
  out.best = Math.max(0, +d.best || 0);
  out.recordBreaks = Math.max(0, +d.recordBreaks || 0);
  out.lastClaimDay = typeof d.lastClaimDay === "string" ? d.lastClaimDay : null;
  out.lastClaimMs = Math.max(0, +d.lastClaimMs || 0);
  const src = (d.days && typeof d.days === "object") ? d.days : {};
  Object.keys(src).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-DAILY_KEEP_DAYS).forEach(k => {
    const c = _cleanDailyDay(src[k]); if (c) out.days[k] = c;
  });
  out.doneDays = Object.keys(out.days).filter(k => out.days[k].done).length;
  /* doneDays — не только за хранимые 60 дней: сохраняем накопленное значение, если оно больше */
  out.doneDays = Math.max(out.doneDays, Math.max(0, +d.doneDays || 0));
  return out;
}
/* слияние двух копий (локальной и облачной): по каждому дню берём более «продвинутую» запись */
function mergeDailies(a, b) {
  a = mergeDaily(a); b = mergeDaily(b);
  const out = defaultDaily();
  out.best = Math.max(a.best, b.best);
  out.recordBreaks = Math.max(a.recordBreaks, b.recordBreaks);
  out.lastClaimDay = [a.lastClaimDay, b.lastClaimDay].filter(Boolean).sort().pop() || null;
  out.lastClaimMs = Math.max(a.lastClaimMs, b.lastClaimMs);
  const solved = x => x.p.filter(e => e.s === "ok").length;
  const rank = x => (x.claimed ? 1e6 : 0) + (x.done ? 1e5 : 0) + solved(x) * 1e3 + x.score;
  new Set([...Object.keys(a.days), ...Object.keys(b.days)]).forEach(k => {
    const x = a.days[k], y = b.days[k];
    out.days[k] = x && y ? (rank(y) > rank(x) ? y : x) : (x || y);
  });
  Object.keys(out.days).sort().slice(0, -DAILY_KEEP_DAYS).forEach(k => delete out.days[k]);
  out.doneDays = Math.max(a.doneDays, b.doneDays, Object.keys(out.days).filter(k => out.days[k].done).length);
  return out;
}

/* used by cloud.js: same merge as loadState, for a state object that came from the cloud */
function normalizeState(p) {
  const d = defaultState(); p = p || {};
  return Object.assign(d, p, {
    lang: p.lang || detectDefaultLang(),
    stats: Object.assign(defaultState().stats, p.stats || {}),
    equipped: Object.assign(defaultState().equipped, p.equipped || {}),
    levelStars: Object.assign({}, p.levelStars || {}),
    completedPuzzles: Array.isArray(p.completedPuzzles) ? p.completedPuzzles : [],
    hints: Object.assign({ left: 3, day: null }, p.hints || {}),
    streak: mergeStreak(p.streak),
    daily: mergeDaily(p.daily),
    flags: (p.flags && typeof p.flags === "object") ? p.flags : {},
    schema: STATE_SCHEMA
  });
}