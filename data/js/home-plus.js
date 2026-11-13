/* maper.chess — динамичная главная страница.
   Новый игрок: короткое объяснение + одна главная кнопка «Решить первую задачу» (без регистрации), пустая статистика скрыта.
   Вернувшийся игрок: приветствие, уровень и XP, «Продолжить», испытание дня, ближайшая цель, последнее достижение.
   Ничего не выдумывает: каждый блок показывается только если есть реальные данные.
   Подключается ПОСЛЕ progress-plus.js и daily.js. */
(function () {
  "use strict";
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "hp.firstTitle": "Solve your first puzzle", "hp.firstBtn": "Play", "hp.pickLevel": "Choose a level",
    "hp.firstSub": "Takes about a minute. No sign-up needed.",
    "hp.how1t": "Solve", "hp.how1d": "Find the checkmate or beat a bot.",
    "hp.how2t": "Level up", "hp.how2d": "Earn XP and coins for every win.",
    "hp.how3t": "Come back daily", "hp.how3d": "A new Daily Challenge every day.",
    "hp.welcome": "Welcome back", "hp.welcomeNick": "Welcome back, {nick}", "hp.xpLeft": "{n} XP to level {m}",
    "hp.continue": "Continue", "hp.nextUp": "Next up", "hp.puzzleSub": "{tier} · puzzle {n}", "hp.allDone": "Everything cleared — replay your favourites",
    "hp.dailyKicker": "Daily Challenge", "hp.dailyStart": "4 puzzles today", "hp.dailyGo": "Start", "hp.dailyResume": "Solved {a} of {b}",
    "hp.dailyDone": "Done today · {pts} pts", "hp.dailySee": "Results",
    "hp.goal": "Closest goal", "hp.lastAch": "Latest achievement", "hp.install": "Install MaperChess", "hp.installSub": "Add it to your home screen for quick access.",
    "hp.installBtn": "Install", "hp.iosSub": "Tap Share, then “Add to Home Screen”.", "hp.dismiss": "Not now"
  }, {
    "hp.firstTitle": "Решите первую задачу", "hp.firstBtn": "Играть", "hp.pickLevel": "Выбрать уровень",
    "hp.firstSub": "Займёт около минуты. Регистрация не нужна.",
    "hp.how1t": "Решайте", "hp.how1d": "Найдите мат или победите бота.",
    "hp.how2t": "Растите", "hp.how2d": "XP и монеты за каждую победу.",
    "hp.how3t": "Возвращайтесь", "hp.how3d": "Каждый день — новое Испытание дня.",
    "hp.welcome": "С возвращением", "hp.welcomeNick": "С возвращением, {nick}", "hp.xpLeft": "До уровня {m}: {n} XP",
    "hp.continue": "Продолжить", "hp.nextUp": "Дальше", "hp.puzzleSub": "{tier} · задача {n}", "hp.allDone": "Всё пройдено — переиграйте любимое",
    "hp.dailyKicker": "Испытание дня", "hp.dailyStart": "4 задачи сегодня", "hp.dailyGo": "Начать", "hp.dailyResume": "Решено {a} из {b}",
    "hp.dailyDone": "Пройдено · {pts} очк.", "hp.dailySee": "Итоги",
    "hp.goal": "Ближайшая цель", "hp.lastAch": "Последнее достижение", "hp.install": "Установить MaperChess", "hp.installSub": "Добавьте на главный экран для быстрого доступа.",
    "hp.installBtn": "Установить", "hp.iosSub": "Нажмите «Поделиться» → «На экран Домой».", "hp.dismiss": "Не сейчас"
  });

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const svg = (p, c) => `<svg class="hp-ic${c ? " " + c : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    puzzle: '<path d="M12 3v3M10.5 4.5h3"/><path d="M8 20h8M9 20v-2.5c0-2.5-2.5-3-2.5-6.2A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 5.5 5.3c0 3.2-2.5 3.7-2.5 6.2V20"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>',
    swords: '<path d="M4 4l9 9M20 4l-9 9"/><path d="M3.5 13.5l7 7M20.5 13.5l-7 7"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>',
    dl: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'
  };

  const isNew = s => !s.completed.length && !s.completedPuzzles.length && !s.stats.gamesPlayed && !(s.daily && s.daily.doneDays) &&
    !(window.Daily && Daily.status().started);

  /* что предложить на «Продолжить» */
  function target(s) {
    const last = s.flags && s.flags.last;
    const puzzleNext = tier => { const l = PUZZLES[tier] || []; return l.find((p, i) => !s.completedPuzzles.includes(p.id) && (i === 0 || s.completedPuzzles.includes(l[i - 1].id))); };
    const pz = p => p ? { kind: "p", id: p.id, title: t("daily.mateIn", { n: p.movesAllowed }) + " · #" + p.index, sub: t("hp.puzzleSub", { tier: t(PUZZLE_TIERS[p.tier].labelKey), n: p.index }) } : null;
    const lv = l => l ? { kind: "l", id: l.id, title: levelTitle(l), sub: `${t(TIERS[l.tier].labelKey)} ${l.index} · ${levelBotName(l)}` } : null;
    if (last && last.k === "p") {
      const p0 = ALL_PUZZLES.find(x => x.id === last.id);
      const r = p0 && pz(puzzleNext(p0.tier));
      if (r) return r;
    }
    if (last && last.k === "l") { const r = lv(nextIncompleteLevel(s)); if (r) return r; }
    return lv(nextIncompleteLevel(s)) || pz(["mate1", "mate2", "mate3", "mate4"].map(puzzleNext).find(Boolean)) || null;
  }
  function launch(tg) {
    if (!tg) { UI.showView("levels"); return; }
    if (tg.kind === "p") { const p = ALL_PUZZLES.find(x => x.id === tg.id); UI.activeMode = "tactics"; UI.activePuzzleTier = p.tier; UI.showView("levels"); UI.startPuzzle(tg.id); }
    else { const l = ALL_LEVELS.find(x => x.id === tg.id); UI.activeMode = "games"; UI.activeTier = l.tier; UI.showView("levels"); UI.startLevel(tg.id); }
  }
  function firstPuzzle() { return (PUZZLES.mate1 && PUZZLES.mate1[0]) || (PUZZLES.mate2 && PUZZLES.mate2[0]) || null; }

  function ensureBoxes(view) {
    let top = $("home-top"), more = $("home-more"), inst = $("home-install");
    if (!top) { top = document.createElement("div"); top.id = "home-top"; view.insertBefore(top, view.firstChild); }
    if (!more) { more = document.createElement("div"); more.id = "home-more"; const sc = $("streak-card"); if (sc && sc.parentNode) sc.parentNode.insertBefore(more, sc.nextSibling); else view.appendChild(more); }
    if (!inst) { inst = document.createElement("div"); inst.id = "home-install"; const tg = $("tg-card"); if (tg && tg.parentNode) tg.parentNode.insertBefore(inst, tg); else view.appendChild(inst); }
    return { top, more, inst };
  }

  function dailyCard() {
    if (!window.Daily) return "";
    const st = Daily.status(), l = timeLeftToday();
    let sub, cta, cls = "";
    if (st.done) { sub = t("hp.dailyDone", { pts: st.score }); cta = t("hp.dailySee"); cls = " done"; }
    else if (st.started) { sub = t("hp.dailyResume", { a: st.solved, b: st.total }); cta = t("daily.continue"); }
    else { sub = t("hp.dailyStart"); cta = t("hp.dailyGo"); }
    return `<button type="button" class="hp-card hp-daily${cls}" data-hp="daily">
      <span class="hp-card-ico">${svg(IC.cal)}</span>
      <span class="hp-card-body"><small>${t("hp.dailyKicker")}</small><b>${esc(sub)}</b></span>
      <span class="hp-go">${cta}${svg(IC.arrow)}</span></button>`;
  }

  function renderTop(s, top) {
    const view = $("view-home");
    const rank = playerLevelFromXp(s.xp);
    if (isNew(s)) {
      view.classList.add("home-new"); view.classList.remove("home-ret");
      /* новичку — только одна кнопка: без «как это работает», подписей и второй кнопки */
      top.innerHTML = `<div class="hp-first">
          <button type="button" class="btn btn-primary hp-big" data-hp="first">${svg(IC.puzzle)}<span>${t("hp.firstBtn")}</span></button>
        </div>`;
      return;
    }
    view.classList.add("home-ret"); view.classList.remove("home-new");
    const tg = target(s), badge = (window.Ranks && Ranks.badge) ? Ranks.badge(rank.level, 46) : "";
    const ava = s.avatar && /^data:image\//.test(s.avatar) ? `<img class="hp-ava" src="${s.avatar}" alt="">` : "";
    top.innerHTML = `<section class="hp-me">
        <div class="hp-me-top">${ava}<div class="hp-me-t"><small>${s.nick ? t("hp.welcomeNick", { nick: esc(s.nick) }) : t("hp.welcome")}</small>
          <b>${t("res.level", { n: rank.level })}</b></div><span class="hp-badge">${badge}</span></div>
        <div class="hp-xp" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rank.progress * 100)}"><i style="width:${Math.round(rank.progress * 100)}%"></i></div>
      </section>
      ${dailyCard()}`;
    top._tg = tg;
  }

  /* панели «ближайшая цель» и «последнее достижение» убраны с главной */
  function renderMore(s, more) { more.innerHTML = ""; }

  function renderInstall(s, box) {
    const P = window.PWA; box.innerHTML = "";
    if (!P || P.isStandalone() || (s.flags && s.flags.installNo) || isNew(s)) return;
    const can = P.canInstall(), ios = P.isIosSafari();
    if (!can && !ios) return;
    box.innerHTML = `<div class="hp-card hp-install"><span class="hp-card-ico">${svg(IC.dl)}</span>
      <span class="hp-card-body"><b>${t("hp.install")}</b>${can ? "" : `<em>${t("hp.iosSub")}</em>`}</span>
      ${can ? `<button type="button" class="btn btn-primary hp-btn" data-hp="install">${t("hp.installBtn")}</button>` : ""}
      <button type="button" class="hp-x" data-hp="noinstall" aria-label="${esc(t("hp.dismiss"))}">✕</button></div>`;
  }

  function render() {
    const view = $("view-home"), s = UI.state; if (!view || !s) return;
    const b = ensureBoxes(view);
    try {
      renderTop(s, b.top); renderMore(s, b.more); renderInstall(s, b.inst);
      /* новичку сначала заголовок-обещание, потом кнопка; вернувшемуся — сразу его прогресс */
      const hero = view.querySelector(".hero"), want = isNew(s) && hero ? hero.nextSibling : view.firstChild;
      if (b.top.previousSibling !== (isNew(s) && hero ? hero : null)) view.insertBefore(b.top, want);
    }
    catch (e) { console.warn("maper.chess: главная", e); }
  }

  function onClick(e) {
    const b = e.target.closest("[data-hp]"); if (!b) return;
    const a = b.dataset.hp, s = UI.state;
    if (a === "first") {
      const p = firstPuzzle();
      if (!p) { UI.showView("levels"); return; }
      UI.activeMode = "tactics"; UI.activePuzzleTier = p.tier; UI.showView("levels"); UI._launchPuzzle(p.id, "w");   /* сразу в игру, без выбора цвета */
    }
    else if (a === "levels") UI.showView("levels");
    else if (a === "continue") launch($("home-top")._tg);
    else if (a === "daily") UI.showView("daily");
    else if (a === "ach") UI.showView("achievements");
    else if (a === "install") { PWA.install().then(() => render()); }
    else if (a === "noinstall") { s.flags = s.flags || {}; s.flags.installNo = 1; saveState(s); render(); }
  }

  const _rh = UI.renderHome;
  UI.renderHome = function () { const r = _rh.apply(this, arguments); render(); return r; };
  const view = $("view-home");
  if (view) view.addEventListener("click", onClick);
  if (window.PWA) PWA.onChange(() => { if (UI.state && view && view.classList.contains("active")) render(); });
  /* пересчёт «через N ч» и состояния дня раз в минуту, пока главная открыта */
  setInterval(() => { if (UI.state && view && view.classList.contains("active") && !view.contains(document.activeElement)) render(); }, 60000);
  window.HomePlus = { render, target };
})();