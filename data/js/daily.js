/* maper.chess — ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ.
   • 4 задачи на день из проверенного пула «мат в 1–4» (PUZZLES) — никаких придуманных позиций;
   • набор един для всех игроков в рамках одного игрового дня (выбор зависит только от даты, без случайности);
   • «сегодня» берётся из normToday(): серверная дата Firebase, если часы устройства подкручены вперёд;
   • награда выдаётся один раз за день (флаг claimed) и не выдаётся при откате часов устройства назад;
   • промахи не наказываются: задачу можно повторить (меньше очков) или пропустить; пропущенный день серию не ломает.
   Подключается ПОСЛЕ rewards.js (нужны Celebrate и SHOP_ITEMS) и ДО nav.js.
   window.Daily = { today, buildSet, status, open } — использует главная страница (home-plus.js). */
(function () {
  "use strict";
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nav.daily": "Daily", "daily.title": "Daily Challenge", "daily.weekend": "Weekend set — a bit harder",
    "daily.sub": "Four puzzles, the same for everyone today.",
    "daily.start": "Start the challenge", "daily.continue": "Continue", "daily.review": "See your result",
    "daily.progress": "Solved {a} of {b}", "daily.nextIn": "New challenge in {h} h {m} min",
    "daily.puzzleN": "Puzzle {n} of {total}", "daily.mateIn": "Mate in {n}",
    "daily.status.ok": "Solved", "daily.status.skip": "Skipped", "daily.status.n": "Not solved yet",
    "daily.play": "Play", "daily.retry": "Try again", "daily.pts": "{n} pts",
    "daily.solvedTitle": "Solved!", "daily.solvedSub": "+{n} points. {left} to go.",
    "daily.solvedLast": "That was the last one — let's see how you did.",
    "daily.failTitle": "Not this time", "daily.failSub": "Try again for fewer points, or skip and come back later.",
    "daily.skip": "Skip →", "daily.results": "Results →", "daily.nextPuzzle": "Next puzzle →", "daily.toChallenge": "Back to challenge",
    "daily.skipped": "Skipped. You can still come back to it.",
    "daily.doneTitle": "Challenge complete", "daily.outOf": "out of {max} points",
    "daily.record": "New personal best!", "daily.best": "Best day", "daily.days": "Days completed", "daily.streak": "Day streak",
    "daily.perfect": "Perfect day: every puzzle on the first try, no hints",
    "daily.rewardLine": "Reward: +{c} coins · +{x} XP", "daily.rewardPerfect": "incl. perfect-day bonus",
    "daily.rewardBlocked": "Device time was changed — no reward for this day.", "daily.rewardNone": "Solve at least one puzzle to earn a reward.",
    "daily.history": "Recent days", "daily.historyEmpty": "Your finished days will appear here.",
    "daily.share": "Share result", "daily.shareText": "MaperChess · Daily Challenge · {date}",
    "daily.shareLine": "{cells} · {a}/{b} · {pts} pts {stars}",
    "daily.cta": "Can you beat it?", "daily.unavailable": "No puzzles available right now — try again later.",
    "daily.legendOk": "first try", "daily.legendRetry": "retried", "daily.legendHint": "used a hint", "daily.legendSkip": "skipped",
    "daily.explain": "Score: 100 per puzzle on the first try, 70 on the second, 40 later; a hint costs 20.",
    "shop.board-daily": "Daily Ember", "shop.pieces-daily": "Flame Keeper",
    "daily.itemUnlocked": "Unlocked: {name}", "daily.celebKicker": "Daily Challenge", "daily.celebSub": "You solved {a} of {b}.",
    "ach.daily-first.name": "Daily Habit", "ach.daily-first.desc": "Complete your first Daily Challenge.",
    "ach.daily-3row.name": "Three in a Row", "ach.daily-3row.desc": "Complete the Daily Challenge three days in a row.",
    "ach.daily-7.name": "Seven-Day Rhythm", "ach.daily-7.desc": "Complete the Daily Challenge on 7 different days. Unlocks the Daily Ember board.",
    "ach.daily-30.name": "Keeper of the Flame", "ach.daily-30.desc": "Complete the Daily Challenge on 30 different days. Unlocks the Flame Keeper pieces.",
    "ach.daily-perfect.name": "Flawless Day", "ach.daily-perfect.desc": "Finish a Daily Challenge with every puzzle on the first try and no hints.",
    "ach.daily-record.name": "Record Breaker", "ach.daily-record.desc": "Beat your own best Daily Challenge score.",
    "ach.genius.name": "Tactical Genius", "ach.genius.desc": "Solve 3 puzzles from the Mate in 4 category.",
    "ach.explorer.name": "Explorer", "ach.explorer.desc": "Solve at least one puzzle in every tactics category (mate in 1, 2, 3 and 4)."
  }, {
    "nav.daily": "Испытание", "daily.title": "Испытание дня", "daily.weekend": "Выходной набор — чуть сложнее",
    "daily.sub": "Четыре задачи — одинаковые для всех игроков сегодня.",
    "daily.start": "Начать испытание", "daily.continue": "Продолжить", "daily.review": "Смотреть результат",
    "daily.progress": "Решено {a} из {b}", "daily.nextIn": "Новое испытание через {h} ч {m} мин",
    "daily.puzzleN": "Задача {n} из {total}", "daily.mateIn": "Мат в {n}",
    "daily.status.ok": "Решена", "daily.status.skip": "Пропущена", "daily.status.n": "Ещё не решена",
    "daily.play": "Играть", "daily.retry": "Ещё раз", "daily.pts": "{n} очк.",
    "daily.solvedTitle": "Решено!", "daily.solvedSub": "+{n} очков. Осталось: {left}.",
    "daily.solvedLast": "Это была последняя — посмотрим, как у вас получилось.",
    "daily.failTitle": "Не в этот раз", "daily.failSub": "Попробуйте ещё раз (очков будет меньше) или пропустите и вернитесь позже.",
    "daily.skip": "Пропустить →", "daily.results": "Итоги →", "daily.nextPuzzle": "Следующая задача →", "daily.toChallenge": "К испытанию",
    "daily.skipped": "Пропущено. К задаче можно вернуться.",
    "daily.doneTitle": "Испытание пройдено", "daily.outOf": "из {max} очков",
    "daily.record": "Новый личный рекорд!", "daily.best": "Лучший день", "daily.days": "Пройдено дней", "daily.streak": "Серия дней",
    "daily.perfect": "Идеальный день: все задачи с первой попытки и без подсказок",
    "daily.rewardLine": "Награда: +{c} монет · +{x} XP", "daily.rewardPerfect": "включая бонус за идеальный день",
    "daily.rewardBlocked": "Время на устройстве изменено — награда за этот день не начислена.", "daily.rewardNone": "Решите хотя бы одну задачу, чтобы получить награду.",
    "daily.history": "Последние дни", "daily.historyEmpty": "Здесь появятся ваши завершённые дни.",
    "daily.share": "Поделиться результатом", "daily.shareText": "MaperChess · Испытание дня · {date}",
    "daily.shareLine": "{cells} · {a}/{b} · {pts} очк. {stars}",
    "daily.cta": "Сможешь лучше?", "daily.unavailable": "Сейчас нет доступных задач — попробуйте позже.",
    "daily.legendOk": "с первой попытки", "daily.legendRetry": "с повтором", "daily.legendHint": "с подсказкой", "daily.legendSkip": "пропущена",
    "daily.explain": "Очки: 100 за задачу с первой попытки, 70 со второй, 40 позже; подсказка стоит 20.",
    "shop.board-daily": "Огонь дня", "shop.pieces-daily": "Хранитель огня",
    "daily.itemUnlocked": "Открыто: {name}", "daily.celebKicker": "Испытание дня", "daily.celebSub": "Решено {a} из {b}.",
    "ach.daily-first.name": "Ежедневная привычка", "ach.daily-first.desc": "Пройдите первое Испытание дня.",
    "ach.daily-3row.name": "Три дня подряд", "ach.daily-3row.desc": "Проходите Испытание дня три дня подряд.",
    "ach.daily-7.name": "Семидневный ритм", "ach.daily-7.desc": "Пройдите Испытание дня в 7 разных дней. Открывает доску «Огонь дня».",
    "ach.daily-30.name": "Хранитель огня", "ach.daily-30.desc": "Пройдите Испытание дня в 30 разных дней. Открывает фигуры «Хранитель огня».",
    "ach.daily-perfect.name": "Идеальный день", "ach.daily-perfect.desc": "Пройдите Испытание дня: все задачи с первой попытки и без подсказок.",
    "ach.daily-record.name": "Рекордсмен", "ach.daily-record.desc": "Превзойдите свой лучший результат в Испытании дня.",
    "ach.genius.name": "Тактический гений", "ach.genius.desc": "Решите 3 задачи из категории «Мат в 4 хода».",
    "ach.explorer.name": "Исследователь", "ach.explorer.desc": "Решите хотя бы одну задачу в каждой категории тактики (мат в 1, 2, 3 и 4)."
  });

  const $ = id => document.getElementById(id);
  const isRu = () => getLang() === "ru";
  const sfx = (fn, ...a) => { try { if (typeof Sfx !== "undefined" && Sfx[fn]) Sfx[fn](...a); } catch (e) { /* звук не критичен */ } };
  const CFG = {
    pts: [100, 70, 40], hintPenalty: 20, minPts: 10,
    coinsBase: 15, coinsPer: 10, xpPer: 10, perfectCoins: 30, perfectXp: 20,
    items: [[7, "board-daily"], [30, "pieces-daily"]]
  };

  /* ---------- призы-предметы: в магазине не продаются, открываются только за дни испытаний ---------- */
  const DAILY_ITEMS = [
    { id: "board-daily", type: "board", nameKey: "shop.board-daily", price: 0,
      vars: { "--sq-light": "#85694f", "--sq-dark": "#3b2a22", "--sq-active": "#ffb36b" } },
    { id: "pieces-daily", type: "pieces", nameKey: "shop.pieces-daily", price: 0,
      vars: { "--pc-white": "#ffe9c9", "--pc-black": "#3a1a14" } }
  ];
  DAILY_ITEMS.forEach(i => { if (!SHOP_ITEMS.some(x => x.id === i.id)) SHOP_ITEMS.push(i); });
  const _rs = UI.renderShop;
  UI.renderShop = function () {
    const hide = DAILY_ITEMS.filter(i => !this.state.owned.includes(i.id));
    hide.forEach(i => { const k = SHOP_ITEMS.indexOf(i); if (k > -1) SHOP_ITEMS.splice(k, 1); });
    try { return _rs.apply(this, arguments); } finally { hide.forEach(i => SHOP_ITEMS.push(i)); }
  };

  /* ---------- игровой день и набор задач ---------- */
  const today = () => normToday(UI.state);
  const epochDay = key => { const [y, m, d] = key.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  const isWeekend = key => { const w = new Date(epochDay(key) * 86400000).getUTCDay(); return w === 0 || w === 6; };

  /* Позиция выбирается шагом 37 по кругу из 100 задач: 100 дней подряд без повторов, у всех игроков одинаково. */
  function buildSet(key) {
    const e = epochDay(key);
    const slots = isWeekend(key)
      ? [["mate1", 7], ["mate2", 41], ["mate3", 63], ["mate4", 89]]
      : [["mate1", 7], ["mate2", 41], ["mate2", 91], ["mate3", 63]];
    const out = [];
    slots.forEach(([tier, salt]) => {
      const list = (PUZZLES[tier] || []);
      if (!list.length) return;
      out.push(list[(((e * 37 + salt) % list.length) + list.length) % list.length]);
    });
    return out;
  }

  const D = () => UI.state.daily || (UI.state.daily = mergeDaily(null));
  function dayRec(key, create) {
    const d = D(), set = buildSet(key);
    let r = d.days[key];
    if (r && r.p.length !== set.length && !r.done) r = null;         /* набор изменился (в пуле стало меньше задач) — начинаем день заново */
    if (!r && create) {
      r = d.days[key] = { p: set.map(() => ({ s: "n", a: 0, h: 0, pts: 0 })), done: false, score: 0, claimed: false, at: 0, rc: 0, rx: 0 };
      Object.keys(d.days).sort().slice(0, -DAILY_KEEP_DAYS).forEach(k => delete d.days[k]);
    }
    return r || null;
  }
  const solvedOf = r => r ? r.p.filter(e => e.s === "ok").length : 0;
  const cellKind = e => e.s === "skip" ? "skip" : e.s !== "ok" ? "empty" : e.h > 0 ? "hint" : e.a > 1 ? "retry" : "ok";
  const EMOJI = { ok: "🟩", retry: "🟨", hint: "🟦", skip: "⬛", empty: "⬜" };
  const maxScore = set => set.length * CFG.pts[0];
  const starsFor = (score, set) => { const r = score / Math.max(1, maxScore(set)); return r >= 0.9 ? 3 : r >= 0.6 ? 2 : r >= 0.25 ? 1 : 0; };
  const ptsFor = (a, h) => Math.max(CFG.minPts, CFG.pts[Math.min(Math.max(a, 1), 3) - 1] - (h > 0 ? CFG.hintPenalty : 0));

  function status() {
    const key = today(), set = buildSet(key), rec = dayRec(key, false);
    return { key, set, rec, total: set.length, solved: solvedOf(rec), done: !!(rec && rec.done),
             started: !!(rec && rec.p.some(e => e.s !== "n" || e.a > 0 || e.h > 0)), score: rec ? rec.score : 0 };
  }

  /* ---------- награда: один раз за игровой день ---------- */
  function claim(key, rec) {
    const s = UI.state, d = D(), n = solvedOf(rec), set = buildSet(key);
    if (rec.claimed) return null;
    if (n === 0) { rec.claimed = true; return { none: true }; }
    const nowMs = Date.now();
    if (nowMs < d.lastClaimMs - 10 * 60000 || (d.lastClaimDay && key <= d.lastClaimDay)) return { blocked: true };   /* часы отмотаны назад / день уже оплачен */
    const perfect = n === set.length && rec.p.every(e => e.a === 1 && e.h === 0);
    const coins = CFG.coinsBase + CFG.coinsPer * n + (perfect ? CFG.perfectCoins : 0);
    const xp = CFG.xpPer * n + (perfect ? CFG.perfectXp : 0);
    const lvl0 = playerLevelFromXp(s.xp).level;
    s.coins += coins; s.xp += xp;
    rec.claimed = true; rec.rc = coins; rec.rx = xp;
    d.lastClaimDay = key; d.lastClaimMs = nowMs;
    const items = [];
    CFG.items.forEach(([need, id]) => { if (d.doneDays >= need && !s.owned.includes(id)) { s.owned.push(id); items.push(id); } });
    return { coins, xp, perfect, items, levelUp: playerLevelFromXp(s.xp).level > lvl0 };
  }

  let pendingCeleb = null;     /* что показать, когда игрок увидит итоги */
  let lastClaim = null;

  function finalize(key, rec) {
    const d = D();
    if (rec.done) { d.best = Math.max(d.best, rec.score); return null; }
    rec.done = true; rec.at = Date.now();
    if (d.best > 0 && rec.score > d.best) { d.recordBreaks++; rec.rb = true; }
    d.best = Math.max(d.best, rec.score);
    d.doneDays++;
    const c = claim(key, rec);
    lastClaim = c;
    return c;
  }

  /* ---------- игра ---------- */
  let ctx = null, pendingCtx = null;
  const _eg = UI._enterGameView;
  UI._enterGameView = function () { ctx = pendingCtx; pendingCtx = null; return _eg.apply(this, arguments); };

  function firstOpen(set, rec, from) {
    const n = set.length;
    for (let k = 1; k <= n; k++) { const i = ((from === undefined ? -1 : from) + k) % n; if (rec.p[i].s === "n") return i; }
    for (let k = 1; k <= n; k++) { const i = ((from === undefined ? -1 : from) + k) % n; if (rec.p[i].s === "skip") return i; }
    return -1;
  }

  function play(i) {
    const key = today(), set = buildSet(key);
    if (!set.length) { UI._toast(t("daily.unavailable")); return; }
    const rec = dayRec(key, true), pz = set[i];
    if (!pz || rec.p[i].s === "ok") return;
    pendingCtx = { key, i };
    UI.currentMode = "puzzle";
    $("game-level-name").textContent = t("daily.puzzleN", { n: i + 1, total: set.length });
    $("game-level-tier").textContent = t("daily.title") + " · " + t("daily.mateIn", { n: pz.movesAllowed });
    UI._enterGameView();
    const c = new PuzzleController({
      boardEl: $("board"), puzzle: pz, playerColor: "w",
      onStatus: x => UI._setStatus(x),
      onHud: info => UI._renderPuzzleHud(pz, info),
      onSolved: () => onResult(key, i, true),
      onFailed: () => onResult(key, i, false)
    });
    const oh = c.hint.bind(c);
    c.hint = function () {
      const ok = oh();
      if (ok) { const r = dayRec(key, true); r.p[i].h = Math.min(99, r.p[i].h + 1); saveState(UI.state); }
      return ok;
    };
    UI.gameController = c;
    saveState(UI.state);
  }

  function showModal(title, sub, extra, nextLabel, onNext, onRetry, retryLabel) {
    UI._modalRetryAction = onRetry;
    UI._modalNextAction = onNext;
    UI._showResultModal(title, sub, extra || [], !!nextLabel, nextLabel || "", "");
    if (retryLabel) $("modal-retry").textContent = retryLabel;
  }

  function onResult(key, i, solved) {
    const s = UI.state, set = buildSet(key), rec = dayRec(key, true), e = rec.p[i];
    if (typeof FX !== "undefined" && FX.play) FX.play(solved ? "solved" : "fail");
    e.a = Math.min(99, e.a + 1);
    let streakLine = "", gained = 0;
    if (solved) {
      e.s = "ok"; e.pts = ptsFor(e.a, e.h); gained = e.pts;
      const sr = recordActivity(s);
      if (sr && sr.blocked) UI._toast(t("streak.blocked"));
      streakLine = UI._streakLine(sr);
    }
    rec.score = rec.p.reduce((a, x) => a + x.pts, 0);
    const wasDone = rec.done;
    const res = rec.p.every(x => x.s !== "n") ? finalize(key, rec) : null;
    if (!wasDone && rec.done) pendingCeleb = { key, claim: res };
    else if (wasDone) D().best = Math.max(D().best, rec.score);
    const newAch = checkAchievements(s);
    saveState(s);
    UI.renderTopbar();

    const left = rec.p.filter(x => x.s === "n").length;
    const after = firstOpen(set, rec, i);
    if (solved) {
      const last = rec.done;
      showModal(t("daily.solvedTitle"), last ? t("daily.solvedLast") : t("daily.solvedSub", { n: gained, left }), newAch,
        last || after < 0 ? t("daily.results") : t("daily.nextPuzzle"),
        () => { if (rec.done || after < 0) UI.showView("daily"); else play(after); },
        () => UI.showView("daily"), t("daily.toChallenge"));
      const box = $("modal-achievements");
      if (streakLine && box) { const el = document.createElement("div"); el.className = "modal-ach modal-streak"; el.textContent = streakLine; box.prepend(el); }
    } else {
      showModal(t("daily.failTitle"), t("daily.failSub"), newAch, t("daily.skip"),
        () => skip(key, i), () => play(i), t("daily.retry"));
    }
  }

  function skip(key, i) {
    const s = UI.state, set = buildSet(key), rec = dayRec(key, true);
    if (rec.p[i].s === "ok") return;
    rec.p[i].s = "skip"; rec.p[i].pts = 0;
    rec.score = rec.p.reduce((a, x) => a + x.pts, 0);
    const wasDone = rec.done;
    const res = rec.p.every(x => x.s !== "n") ? finalize(key, rec) : null;
    if (!wasDone && rec.done) pendingCeleb = { key, claim: res };
    const newAch = checkAchievements(s);
    saveState(s); UI.renderTopbar();
    const next = firstOpen(set, rec, i);
    if (rec.done || next < 0 || rec.p[next].s !== "n") { UI._toast(t("daily.skipped")); UI.showView("daily"); }
    else { UI._toast(t("daily.skipped")); play(next); }
    if (newAch.length) UI._toast(t("toast.achievementUnlocked", { name: t(`ach.${newAch[0].id}.name`) }));
  }

  /* ---------- экран ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dateLabel = (key, long) => keyToDate(key).toLocaleDateString(isRu() ? "ru-RU" : "en-US", long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function shareData(key, set, rec) {
    const n = solvedOf(rec), kinds = rec.p.map(cellKind), st = starsFor(rec.score, set);
    const stars = "★".repeat(st) + "☆".repeat(3 - st);
    const header = t("daily.shareText", { date: dateLabel(key) });
    const line = t("daily.shareLine", { cells: kinds.map(k => EMOJI[k]).join(""), a: n, b: set.length, pts: rec.score, stars });
    const text = header + "\n" + line + "\n" + t("daily.cta");
    return {
      title: t("daily.title"), text, url: Share.url({ daily: 1 }),
      card: { kicker: t("daily.celebKicker"), title: cap(dateLabel(key, true)), big: rec.score, bigLabel: t("daily.outOf", { max: maxScore(set) }),
              cells: kinds, stars: st, footer: "MaperChess \u00B7 " + location.host }
    };
  }

  function ringSvg(done, total) {
    const R = 44, C = 2 * Math.PI * R, f = total ? done / total : 0;
    return `<svg class="dl-ring-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="dl-ring-bg"/>` +
      `<circle cx="50" cy="50" r="${R}" class="dl-ring-fg" style="stroke-dasharray:${(C * f).toFixed(1)} ${C.toFixed(1)}"/></svg>`;
  }

  function render() {
    const root = $("daily-root"); if (!root || !UI.state) return;
    const key = today(), set = buildSet(key), rec = dayRec(key, false), d = D();
    if (!set.length) { root.innerHTML = `<p class="dl-empty">${t("daily.unavailable")}</p>`; return; }
    const solved = solvedOf(rec), done = !!(rec && rec.done), started = !!(rec && rec.p.some(e => e.s !== "n" || e.a > 0 || e.h > 0));
    const left = timeLeftToday();
    const nextIdx = rec ? firstOpen(set, rec) : 0;

    let h = `<section class="dl-hero${done ? " is-done" : ""}">
      <div class="dl-date">${esc(cap(dateLabel(key, true)))}</div>
      <div class="dl-ring" role="img" aria-label="${esc(t("daily.progress", { a: solved, b: set.length }))}">${ringSvg(done ? set.length : solved, set.length)}<b>${solved}/${set.length}</b></div>
      ${done ? `<p class="dl-note">${t("daily.doneTitle")}</p>` : ""}`;
    if (!done) h += `<button type="button" class="btn btn-primary dl-cta" data-act="${nextIdx < 0 ? "none" : "play"}" data-i="${Math.max(0, nextIdx)}">${started ? t("daily.continue") : t("daily.start")}</button>`;
    h += `<div class="dl-time">${t("daily.nextIn", { h: left.h, m: left.m })}</div></section>`;

    if (done) {
      const st = starsFor(rec.score, set), sd = shareData(key, set, rec);
      const perfect = rec.p.every(e => e.s === "ok" && e.a === 1 && e.h === 0);
      h += `<section class="dl-result" aria-live="polite">
        <div class="dl-stars" aria-label="${st}/3">${[1, 2, 3].map(i => `<i class="${i <= st ? "on" : ""}">★</i>`).join("")}</div>
        <div class="dl-score"><b>${rec.score}</b><span>${t("daily.outOf", { max: maxScore(set) })}</span></div>
        ${rec.rb ? `<div class="dl-badge">${t("daily.record")}</div>` : ""}
        ${perfect ? `<div class="dl-badge perfect">${t("daily.perfect")}</div>` : ""}
        ${rec.rc || rec.rx ? `<div class="dl-reward">${t("daily.rewardLine", { c: rec.rc, x: rec.rx })}${rec.rc >= CFG.coinsBase + CFG.coinsPer * set.length + CFG.perfectCoins ? " · " + t("daily.rewardPerfect") : ""}</div>` : ""}
        ${!rec.claimed ? `<div class="dl-reward muted">${t("daily.rewardBlocked")}</div>` : ""}
        ${rec.claimed && !rec.rc && !solved ? `<div class="dl-reward muted">${t("daily.rewardNone")}</div>` : ""}
        <div class="dl-share-row">
          <button type="button" class="btn btn-primary" data-act="share">${t("daily.share")}</button>
        </div>
      </section>`;
    }

    h += `<ol class="dl-list">` + set.map((pz, i) => {
      const e = rec ? rec.p[i] : { s: "n", a: 0, h: 0, pts: 0 }, kind = cellKind(e);
      const label = t("daily.status." + e.s);
      const can = e.s !== "ok";
      return `<li class="dl-row ${e.s}${nextIdx === i && !done ? " cur" : ""}">
        <span class="dl-num" aria-hidden="true">${i + 1}</span>
        <span class="dl-info"><b>${t("daily.mateIn", { n: pz.movesAllowed })}</b><small>${esc(label)}${e.s === "ok" ? " · " + t("daily.pts", { n: e.pts }) : ""}</small></span>
        <span class="dl-dot k-${kind}" role="img" aria-label="${esc(label)}"></span>
        ${can ? `<button type="button" class="btn btn-ghost dl-play" data-act="play" data-i="${i}" aria-label="${esc(t("daily.puzzleN", { n: i + 1, total: set.length }))}">${e.s === "skip" || e.a > 0 ? t("daily.retry") : t("daily.play")}</button>` : `<span class="dl-check" aria-hidden="true">✓</span>`}
      </li>`;
    }).join("") + `</ol>`;

    if (d.doneDays > 0) {
      h += `<div class="dl-stats">
        <div><b>${d.best}</b><span>${t("daily.best")}</span></div>
        <div><b>${d.doneDays}</b><span>${t("daily.days")}</span></div>
        <div><b>${UI.state.streak.count}</b><span>${t("daily.streak")}</span></div></div>`;
    }
    const hist = Object.keys(d.days).filter(k => k !== key && d.days[k].p.some(e => e.s !== "n")).sort().reverse().slice(0, 7);
    if (hist.length) {
      h += `<h3 class="dl-h3">${t("daily.history")}</h3><ul class="dl-hist">` + hist.map(k => {
        const r = d.days[k];
        return `<li><span>${esc(dateLabel(k))}</span><span class="dl-mini">${r.p.map(e => `<i class="k-${cellKind(e)}"></i>`).join("")}</span><b>${r.done ? r.score : "—"}</b></li>`;
      }).join("") + `</ul>`;
    }
    root.innerHTML = h;
    root.dataset.key = key;
    if (pendingCeleb && done) celebrate();
  }

  function celebrate() {
    const pc = pendingCeleb; pendingCeleb = null;
    if (!pc || !pc.claim || !window.Celebrate) return;
    const c = pc.claim, key = pc.key, set = buildSet(key), rec = dayRec(key, false);
    if (!rec || c.none || c.blocked) return;
    const cards = [{ kind: "coin", n: c.coins }];
    if (c.xp) cards.push({ kind: "xp", n: c.xp });
    (c.items || []).forEach(id => cards.push({ kind: "item", id }));
    setTimeout(() => {
      Celebrate.show({ tone: "gold", big: !!c.perfect, icon: c.perfect ? "star" : "trophy", kicker: t("daily.celebKicker"),
        title: c.perfect ? t("ach.daily-perfect.name") : t("daily.doneTitle"),
        sub: t("daily.celebSub", { a: solvedOf(rec), b: set.length }), cards });
    }, 450);
  }

  function bind() {
    const root = $("daily-root"); if (!root || root._bound) return; root._bound = true;
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const act = b.dataset.act;
      if (act === "play") play(+b.dataset.i || 0);
      else if (act === "share") {
        const st = status(); if (!st.rec) return;
        Share.openSheet(Object.assign({ sub: dateLabel(st.key, true) }, shareData(st.key, st.set, st.rec)));
      }
    });
    /* «←» в игре ведёт обратно к испытанию, а не в общий список уровней */
    const hdr = document.querySelector(".game-header");
    if (hdr) hdr.addEventListener("click", e => {
      if (ctx && e.target.closest("#btn-exit-game")) { e.stopPropagation(); e.preventDefault(); UI.showView("daily"); }
    }, true);
  }

  /* ---------- подключение к приложению ---------- */
  const _sv = UI.showView;
  UI.showView = function (n) {
    if (n !== "game") ctx = null;
    const r = _sv.apply(this, arguments);
    if (n === "daily") { try { UI._checkServerDay(); } catch (e) { /* сервер недоступен — работаем по часам устройства */ } render(); }
    return r;
  };
  const _tr = UI.translate;
  UI.translate = function () { _tr.apply(this, arguments); if ($("view-daily") && $("view-daily").classList.contains("active")) render(); };

  /* обновление таймера и смена дня, пока экран открыт */
  setInterval(() => {
    const v = $("view-daily"), root = $("daily-root");
    if (!v || !root || !v.classList.contains("active") || !UI.state) return;
    if (root.dataset.key !== today()) render();
    else { const el = root.querySelector(".dl-time"), l = timeLeftToday(); if (el) el.textContent = t("daily.nextIn", { h: l.h, m: l.m }); }
  }, 30000);

  /* ---------- достижения (по реальным событиям; выдаются один раз) ---------- */
  const runOf = days => {
    const keys = Object.keys(days).filter(k => days[k].done).sort(); let best = 0, run = 0, prev = null;
    keys.forEach(k => { run = prev && dayDiff(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return best;
  };
  const tierDone = (s, tier) => s.completedPuzzles.filter(id => id.indexOf(tier + "-") === 0).length;
  const ACH = [
    ["daily-first", "calendar", 30, s => s.daily.doneDays >= 1, s => [Math.min(1, s.daily.doneDays), 1]],
    ["daily-3row", "flame", 50, s => runOf(s.daily.days) >= 3, s => [Math.min(3, runOf(s.daily.days)), 3]],
    ["daily-7", "music", 100, s => s.daily.doneDays >= 7, s => [Math.min(7, s.daily.doneDays), 7]],
    ["daily-30", "trophy", 250, s => s.daily.doneDays >= 30, s => [Math.min(30, s.daily.doneDays), 30]],
    ["daily-perfect", "sparkles", 80, s => Object.values(s.daily.days).some(r => r.done && r.p.every(e => e.s === "ok" && e.a === 1 && e.h === 0))],
    ["daily-record", "chart-up", 60, s => s.daily.recordBreaks >= 1],
    ["genius", "brain", 120, s => tierDone(s, "mate4") >= 3, s => [Math.min(3, tierDone(s, "mate4")), 3]],
    ["explorer", "compass", 70, s => ["mate1", "mate2", "mate3", "mate4"].every(k => tierDone(s, k) >= 1),
      s => [["mate1", "mate2", "mate3", "mate4"].filter(k => tierDone(s, k) >= 1).length, 4]]
  ];
  ACH.forEach(([id, icon, coins, test, prog]) => {
    if (ACHIEVEMENTS.some(a => a.id === id)) return;
    ACHIEVEMENTS.push({ id, icon, coins, test: s => { try { return !!test(s); } catch (e) { return false; } }, prog });
  });

  function init() { bind(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.Daily = { today, buildSet, status, play, render, CFG, open: () => UI.showView("daily") };
})();