/* maper.chess — прогресс игрока: достижения с прогрессом, красивый экран «Награды», итог партии/задачи (XP, уровень, шеринг).
   Подключается ПОСЛЕ rewards.js, daily.js и roulette.js (нужно быть самой внешней обёрткой над обработчиками результата).
   window.Progress = { progOf(achievement, state), nearest(state), summary(state) } */
(function () {
  "use strict";
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "ap.title": "Achievements", "ap.open": "{a} of {b} unlocked", "ap.all": "All", "ap.done": "Unlocked", "ap.todo": "In progress",
    "ap.reward": "+{n} coins", "ap.unlockedBanner": "Achievement unlocked", "ap.empty": "Nothing here yet — go play!",
    "ap.progress": "{a} / {b}",
    "res.xp": "+{n} XP", "res.coins": "+{n} coins", "res.level": "Level {n}", "res.toNext": "{n} XP to level {m}",
    "res.levelUp": "Level up! You are now level {n}", "res.share": "Share", "res.maxLevel": "Max level reached",
    "res.puzzleCard": "Puzzle solved", "res.levelCard": "Level cleared"
  }, {
    "ap.title": "Достижения", "ap.open": "Открыто {a} из {b}", "ap.all": "Все", "ap.done": "Открытые", "ap.todo": "В процессе",
    "ap.reward": "+{n} монет", "ap.unlockedBanner": "Достижение открыто", "ap.empty": "Пока пусто — самое время поиграть!",
    "ap.progress": "{a} / {b}",
    "res.xp": "+{n} XP", "res.coins": "+{n} монет", "res.level": "Уровень {n}", "res.toNext": "До уровня {m}: {n} XP",
    "res.levelUp": "Новый уровень! Теперь вы на {n}-м", "res.share": "Поделиться", "res.maxLevel": "Достигнут максимальный уровень",
    "res.puzzleCard": "Задача решена", "res.levelCard": "Уровень пройден"
  });

  /* ИСПРАВЛЕНИЕ: в проекте было ДВА достижения с id "tactician" (за 6 задач — в data.js, за уроки — в rewards.js),
     из-за этого у них совпадали название/описание и открывались «одним на двоих». Первому даём собственный id. */
  const dupe = ACHIEVEMENTS.find(a => a.id === "tactician" && /completedPuzzles/.test(String(a.test)));
  if (dupe && !ACHIEVEMENTS.some(a => a.id === "tactician-puzzles")) dupe.id = "tactician-puzzles";
  add({ "ach.tactician-puzzles.name": "Puzzle Apprentice", "ach.tactician-puzzles.desc": "Solve 6 puzzles." },
      { "ach.tactician-puzzles.name": "Ученик тактики", "ach.tactician-puzzles.desc": "Решите 6 задач." });

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lessonsN = s => Object.keys(s.lessons || {}).length;
  const openingsN = s => Object.keys(s.openings || {}).length;
  const MP = () => window.MaperPath || { lessons: 8, openings: 8 };
  const star3 = s => Object.values(s.levelStars || {}).filter(v => v >= 3).length;
  const tierN = (s, tier) => (LEVELS[tier] || []).filter(l => s.completed.includes(l.id)).length;
  const cl = (c, m) => [Math.max(0, Math.min(c, m)), m];

  /* прогресс для достижений, у которых он есть в данных (для остальных полоски не будет) */
  const PROG = {
    "first-win": s => cl(s.stats.wins, 1),
    "novice-grad": s => cl(tierN(s, "beginner"), LEVELS.beginner.length),
    "club-grad": s => cl(tierN(s, "intermediate"), LEVELS.intermediate.length),
    "grandmaster": s => cl(tierN(s, "pro"), LEVELS.pro.length),
    "flawless": s => cl(s.stats.hintlessWins, 1),
    "persistent": s => cl(s.stats.gamesPlayed, 10),
    "collector": s => cl(s.owned.length, 3),
    "century": s => cl(s.xp, 500),
    "tactician-puzzles": s => cl(s.completedPuzzles.length, 6),
    "streak-3": s => cl(s.streak.best, 3), "streak-7": s => cl(s.streak.best, 7), "streak-14": s => cl(s.streak.best, 14),
    "streak-30": s => cl(s.streak.best, 30), "streak-60": s => cl(s.streak.best, 60),
    "wins-5": s => cl(s.stats.wins, 5), "wins-25": s => cl(s.stats.wins, 25), "wins-100": s => cl(s.stats.wins, 100),
    "games-50": s => cl(s.stats.gamesPlayed, 50), "flawless-5": s => cl(s.stats.hintlessWins, 5),
    "puzzle-15": s => cl(s.completedPuzzles.length, 15),
    "xp-1000": s => cl(s.xp, 1000), "xp-3000": s => cl(s.xp, 3000),
    "coins-1000": s => cl(s.coins, 1000), "shop-6": s => cl(s.owned.length, 6), "stars-10": s => cl(star3(s), 10),
    "lesson-first": s => cl(lessonsN(s), 1), "lessons-8": s => cl(lessonsN(s), MP().lessons),
    "openings-4": s => cl(openingsN(s), 4), "openings-8": s => cl(openingsN(s), MP().openings)
  };
  function progOf(a, s) {
    try {
      const fn = a.prog || PROG[a.id];
      if (!fn) return null;
      const r = fn(s);
      return r && r[1] > 0 ? r : null;
    } catch (e) { return null; }
  }
  /* ближайшая цель: незакрытое достижение с наибольшей долей выполненного (но не нулевой) */
  function nearest(s) {
    let best = null;
    ACHIEVEMENTS.forEach(a => {
      if (s.unlockedAchievements.includes(a.id)) return;
      const p = progOf(a, s); if (!p) return;
      const r = p[0] / p[1];
      if (!best || r > best.r || (r === best.r && p[1] < best.p[1])) best = { a, p, r };
    });
    return best;
  }
  const summary = s => ({ open: s.unlockedAchievements.filter(id => ACHIEVEMENTS.some(a => a.id === id)).length, total: ACHIEVEMENTS.length });

  /* ---------- экран «Награды» ---------- */
  let filter = "all";
  UI.renderAchievements = function () {
    this.renderTopbar();
    const s = this.state, list = $("achievements-list"); if (!list) return;
    const sm = summary(s), pct = Math.round(sm.open / Math.max(1, sm.total) * 100);
    const rows = ACHIEVEMENTS.map((a, i) => {
      const open = s.unlockedAchievements.includes(a.id), p = progOf(a, s);
      return { a, i, open, p, r: open ? 1 : p ? p[0] / p[1] : 0 };
    }).filter(x => filter === "all" || (filter === "done" ? x.open : !x.open))
      .sort((x, y) => (x.open - y.open) || (y.r - x.r) || (x.i - y.i));

    let h = `<div class="ap-sum"><div class="ap-sum-top"><b>${t("ap.open", { a: sm.open, b: sm.total })}</b><span>${pct}%</span></div>
      <div class="ap-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${sm.total}" aria-valuenow="${sm.open}"><i style="width:${pct}%"></i></div></div>
      <div class="ap-tabs" role="group" aria-label="${esc(t("ap.title"))}">` +
      [["all", "ap.all"], ["todo", "ap.todo"], ["done", "ap.done"]].map(([k, key]) =>
        `<button type="button" class="ap-tab${filter === k ? " active" : ""}" data-f="${k}" aria-pressed="${filter === k}">${t(key)}</button>`).join("") + `</div>`;
    h += rows.length ? rows.map(x => {
      const a = x.a, bar = !x.open && x.p ? `<span class="ap-prog"><i style="width:${Math.round(x.p[0] / x.p[1] * 100)}%"></i></span><em class="ap-num">${t("ap.progress", { a: x.p[0], b: x.p[1] })}</em>` : "";
      return `<div class="ach-row${x.open ? " ach-unlocked" : ""}">
        <span class="ach-icon" aria-hidden="true">${a.icon}</span>
        <span class="ach-text"><span class="ach-name">${esc(t(`ach.${a.id}.name`))}</span><span class="ach-desc">${esc(t(`ach.${a.id}.desc`))}</span>${bar}</span>
        <span class="ach-reward">${x.open ? "✓" : `+${a.coins}`}</span></div>`;
    }).join("") : `<p class="ap-empty">${t("ap.empty")}</p>`;
    list.innerHTML = h;
    list.querySelectorAll(".ap-tab").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; UI.renderAchievements(); }));
  };

  /* ---------- уведомление о новом достижении ---------- */
  const queue = []; let showing = false;
  function banner() {
    if (showing || !queue.length) return;
    showing = true;
    const a = queue.shift();
    const el = document.createElement("div");
    el.className = "ach-banner"; el.setAttribute("role", "status");
    el.innerHTML = `<span class="ab-ico" aria-hidden="true">${a.icon}</span><span class="ab-txt"><small>${t("ap.unlockedBanner")}</small><b>${esc(t(`ach.${a.id}.name`))}</b></span><em>+${a.coins}</em>`;
    (document.querySelector(".phone-frame") || document.body).appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => { el.remove(); showing = false; banner(); }, 380); }, 3200);
  }
  function announce(list) {
    setTimeout(() => {
      /* если игрок прямо сейчас видит окно результата — там достижения уже перечислены, баннер был бы лишним */
      const rm = $("result-modal"), cel = document.querySelector(".cx.on");
      if ((rm && rm.classList.contains("open")) || cel) return;
      list.forEach(a => queue.push(a)); banner();
    }, 900);
  }
  const _ca = window.checkAchievements;
  window.checkAchievements = function (state) {
    const r = _ca.apply(this, arguments);
    if (r && r.length && typeof UI !== "undefined" && state === UI.state) announce(r);
    return r;
  };

  /* ---------- окно результата: XP-полоска, уровень, «Поделиться» ---------- */
  const _srm = UI._showResultModal;
  UI._showResultModal = function () {
    document.querySelectorAll("#result-modal .mp-extra").forEach(n => n.remove());
    return _srm.apply(this, arguments);
  };

  function xpPanel(xp0, xp1, coinsGain) {
    const a = playerLevelFromXp(xp0), b = playerLevelFromXp(xp1), gain = xp1 - xp0, up = b.level > a.level;
    if (gain <= 0 && coinsGain <= 0) return null;
    const el = document.createElement("div"); el.className = "mp-xp mp-extra";
    const start = up ? 0 : Math.round(a.progress * 100), end = Math.round(b.progress * 100);
    el.innerHTML = `<div class="mp-xp-top"><span class="mp-chips">${gain > 0 ? `<b class="mp-chip xp">${t("res.xp", { n: gain })}</b>` : ""}${coinsGain > 0 ? `<b class="mp-chip coin">${t("res.coins", { n: coinsGain })}</b>` : ""}</span><span class="mp-lv">${t("res.level", { n: b.level })}</span></div>
      <div class="mp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${end}"><i style="width:${start}%"></i></div>
      <small>${up ? t("res.levelUp", { n: b.level }) : b.max ? t("res.maxLevel") : t("res.toNext", { n: b.xpForNext - b.xpIntoLevel, m: b.level + 1 })}</small>`;
    el.classList.toggle("up", up);
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => { const i = el.querySelector(".mp-bar i"); if (i) i.style.width = end + "%"; }, 120)));
    if (up && window.Celebrate) setTimeout(() => { try { const r = el.getBoundingClientRect(); Celebrate.burst(r.left + r.width / 2, r.top, { n: 30, power: 0.7 }); } catch (e) { /* украшение, не критично */ } }, 500);
    return el;
  }
  function shareRow(cfg) {
    const row = document.createElement("div"); row.className = "mp-share mp-extra";
    const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-ghost"; b.textContent = t("res.share");
    b.addEventListener("click", () => Share.openSheet(cfg));
    row.appendChild(b); return row;
  }
  function decorate(xp0, coins0, share) {
    const s = UI.state, box = $("modal-achievements"), card = document.querySelector("#result-modal .modal-card");
    if (!box || !card) return;
    const p = xpPanel(xp0, s.xp, s.coins - coins0);
    if (p) box.parentNode.insertBefore(p, box);
    if (share) { const act = card.querySelector(".modal-actions"); if (act) act.parentNode.insertBefore(shareRow(share), act.nextSibling); }
  }

  const _hp = UI._handlePuzzleResult;
  UI._handlePuzzleResult = function (puzzle, solved) {
    const s = this.state, xp0 = s.xp, c0 = s.coins;
    const out = _hp.apply(this, arguments);
    try {
      decorate(xp0, c0, solved ? {
        title: t("res.puzzleCard"), text: t("share.puzzleText"), url: Share.url({ puzzle: puzzle.id }),
        card: { kicker: "MaperChess", title: t("res.puzzleCard"), big: t("daily.mateIn", { n: puzzle.movesAllowed }), bigLabel: "#" + puzzle.index, stars: 3, footer: "MaperChess · " + location.host }
      } : null);
    } catch (e) { console.warn("maper.chess: result panel", e); }
    return out;
  };
  const _hg = UI._handleGameOver;
  UI._handleGameOver = function (level, res) {
    const s = this.state, xp0 = s.xp, c0 = s.coins;
    const out = _hg.apply(this, arguments);
    try {
      const win = res && res.result === "win";
      decorate(xp0, c0, win ? {
        title: t("res.levelCard"), text: t("share.levelText"), url: Share.url({ level: level.id }),
        card: { kicker: "MaperChess", title: levelTitle(level), big: "✓", bigLabel: t("res.levelCard"), stars: this.state.levelStars[level.id] || 0, footer: "MaperChess · " + location.host }
      } : null);
    } catch (e) { console.warn("maper.chess: result panel", e); }
    return out;
  };

  /* запоминаем, во что играли последним — «Продолжить» на главной ведёт именно туда */
  const mark = (k, id) => { const s = UI.state; if (!s) return; s.flags = s.flags || {}; s.flags.last = { k, id }; };
  const _ll = UI._launchLevel; UI._launchLevel = function (id) { mark("l", id); return _ll.apply(this, arguments); };
  const _lp = UI._launchPuzzle; UI._launchPuzzle = function (id) { mark("p", id); return _lp.apply(this, arguments); };

  window.Progress = { progOf, nearest, summary, PROG };
})();