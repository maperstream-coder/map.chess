/* maper.chess — brand-home.js
   Большая «витрина» главной страницы для ПК (≥1024px): баннер с новым логотипом, кнопки, чипы и карточки разделов.
   На телефоне эти блоки скрыты стилями (css/brand.css), мобильная версия не меняется.
   Подключается ПОСЛЕ home-plus.js и home-deco.js. Ничего не выдумывает: цифры берутся из реальных данных. */
(function () {
  "use strict";

  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "bh.kicker": "Free · no sign-up",
    "bh.title": "Learn chess by <em>playing</em>, not reading.",
    "bh.sub": "Mate puzzles, games against bots and a fresh Daily Challenge every day — level up, earn coins and unlock awards.",
    "bh.retTitle": "Ready for your <em>next move</em>?",
    "bh.retSub": "Next up: {what}",
    "bh.retSubEmpty": "Pick up where you left off, or try today’s Daily Challenge.",
    "bh.chipPuzzles": "{n} puzzles", "bh.chipLevels": "{n} levels", "bh.chipDaily": "New Daily Challenge",
    "bh.chipStreak": "{n}-day streak", "bh.chipCoins": "{n} coins",
    "bh.f1t": "Mate puzzles", "bh.f1d": "Mate in 1 to 4 — sharpen your tactics.",
    "bh.f2t": "Games vs bots", "bh.f2d": "From novice to master level.",
    "bh.f3t": "Daily Challenge", "bh.f3d": "Four fresh puzzles every day.",
    "bh.f4t": "Achievements", "bh.f4d": "Collect awards, unlock boards and pieces.",
    "bh.open": "Open"
  }, {
    "bh.kicker": "Бесплатно · без регистрации",
    "bh.title": "Учись шахматам, <em>играя</em>, а не читая.",
    "bh.sub": "Мат-задачи, партии с ботами и новое Испытание дня каждый день — расти в уровне, зарабатывай монеты и открывай награды.",
    "bh.retTitle": "Готов к <em>следующему ходу</em>?",
    "bh.retSub": "Дальше: {what}",
    "bh.retSubEmpty": "Продолжай с того места, где остановился, или пройди Испытание дня.",
    "bh.chipPuzzles": "{n} задач", "bh.chipLevels": "{n} уровней", "bh.chipDaily": "Новое Испытание дня",
    "bh.chipStreak": "Серия: {n} дн.", "bh.chipCoins": "{n} монет",
    "bh.f1t": "Мат-задачи", "bh.f1d": "Мат в 1–4 хода — прокачай тактику.",
    "bh.f2t": "Партии с ботами", "bh.f2d": "От новичка до мастера.",
    "bh.f3t": "Испытание дня", "bh.f3d": "Четыре новые задачи каждый день.",
    "bh.f4t": "Достижения", "bh.f4d": "Собирай награды, открывай доски и фигуры.",
    "bh.open": "Открыть"
  });

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const txt = id => { const el = $(id); return el ? String(el.textContent || "").trim() : ""; };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    puzzle: '<path d="M12 3v3M10.5 4.5h3"/><path d="M8 20h8M9 20v-2.5c0-2.5-2.5-3-2.5-6.2A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 5.5 5.3c0 3.2-2.5 3.7-2.5 6.2V20"/>',
    swords: '<path d="M4 4l9 9M20 4l-9 9"/><path d="M3.5 13.5l7 7M20.5 13.5l-7 7"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>',
    medal: '<circle cx="12" cy="14" r="5.5"/><path d="M8.5 3.5l3.5 5.5 3.5-5.5M10 14l1.5 1.5L14.5 12"/>'
  };

  function counts() {
    let p = 0, l = 0;
    try { if (typeof ALL_PUZZLES !== "undefined") p = ALL_PUZZLES.length; } catch (e) {}
    try { if (typeof ALL_LEVELS !== "undefined") l = ALL_LEVELS.length; } catch (e) {}
    return { p, l };
  }

  function ensure(view) {
    let hero = $("brand-hero"), feats = $("brand-feats");
    if (!hero) { hero = document.createElement("section"); hero.id = "brand-hero"; hero.className = "bh"; view.insertBefore(hero, view.firstChild); }
    if (!feats) { feats = document.createElement("div"); feats.id = "brand-feats"; feats.className = "bf"; hero.after(feats); }
    return { hero, feats };
  }

  function heroHtml(isNew) {
    const c = counts();
    let kicker, title, sub, primary, chips = [];
    if (isNew) {
      kicker = esc(t("bh.kicker"));
      title = t("bh.title"); sub = esc(t("bh.sub"));
      primary = `<button type="button" class="btn btn-primary bh-btn" data-hp="first">${svg(ICON.play)}<span>${esc(t("hp.firstBtn"))}</span></button>`;
      if (c.p) chips.push(esc(t("bh.chipPuzzles", { n: c.p })));
      if (c.l) chips.push(esc(t("bh.chipLevels", { n: c.l })));
      chips.push(esc(t("bh.chipDaily")));
    } else {
      const nick = (window.UI && UI.state && UI.state.nick) || "";
      kicker = esc(nick ? t("hp.welcomeNick", { nick }) : t("hp.welcome"));
      title = t("bh.retTitle");
      let what = "";
      try { const tg = window.HomePlus && HomePlus.target(UI.state); if (tg) what = tg.title + (tg.sub ? " · " + tg.sub : ""); } catch (e) {}
      sub = esc(what ? t("bh.retSub", { what }) : t("bh.retSubEmpty"));
      primary = `<button type="button" class="btn btn-primary bh-btn" data-hp="continue">${svg(ICON.play)}<span>${esc(t("hp.continue"))}</span></button>`;
      const rank = txt("player-rank"), st = txt("streak-count"), coins = txt("coin-count");
      if (rank) chips.push(esc(rank));
      if (st && st !== "0") chips.push(esc(t("bh.chipStreak", { n: st })));
      if (coins) chips.push(esc(t("bh.chipCoins", { n: coins })));
    }
    const chipsHtml = chips.length ? `<ul class="bh-chips">${chips.map(x => `<li>${x}</li>`).join("")}</ul>` : "";
    return `<div class="bh-bg" aria-hidden="true"></div>
      <div class="bh-copy">
        <span class="bh-kicker"><i></i>${kicker}</span>
        <h1 class="bh-title">${title}</h1>
        <p class="bh-sub">${sub}</p>
        <div class="bh-actions">
          ${primary}
          <button type="button" class="btn btn-ghost bh-btn" data-hp="levels"><span>${esc(t("hp.pickLevel"))}</span>${svg(ICON.arrow)}</button>
        </div>
        ${chipsHtml}
      </div>
      <div class="bh-stage" aria-hidden="true">
        <span class="bh-halo"></span>
        <span class="bh-ring r1"></span>
        <span class="bh-ring r2"></span>
        <img class="bh-mark" src="assets/logo-mark.png?v=2" alt="" draggable="false">
        <span class="bh-g g1">&#9822;&#xFE0E;</span>
        <span class="bh-g g2">&#9819;&#xFE0E;</span>
        <span class="bh-g g3">&#9820;&#xFE0E;</span>
        <span class="bh-g g4">&#9821;&#xFE0E;</span>
      </div>`;
  }

  function featsHtml() {
    const F = [
      { k: "tactics", i: ICON.puzzle, t: "bh.f1t", d: "bh.f1d" },
      { k: "games", i: ICON.swords, t: "bh.f2t", d: "bh.f2d" },
      { k: "daily", i: ICON.cal, t: "bh.f3t", d: "bh.f3d" },
      { k: "ach", i: ICON.medal, t: "bh.f4t", d: "bh.f4d" }
    ];
    return F.map(f => `<button type="button" class="bf-card" data-bh="${f.k}">
        <span class="bf-ico">${svg(f.i)}</span>
        <span class="bf-body"><b>${esc(t(f.t))}</b><small>${esc(t(f.d))}</small></span>
        <span class="bf-go">${svg(ICON.arrow)}</span>
      </button>`).join("");
  }

  function render() {
    const view = $("view-home"); if (!view || !window.UI || !UI.state) return;
    try {
      const b = ensure(view), isNew = view.classList.contains("home-new");
      b.hero.classList.toggle("bh-new", isNew);
      b.hero.innerHTML = heroHtml(isNew);
      b.feats.innerHTML = featsHtml();
      if (view.firstChild !== b.hero) view.insertBefore(b.hero, view.firstChild);
      if (b.hero.nextSibling !== b.feats) b.hero.after(b.feats);
    } catch (e) { console.warn("maper.chess: brand-home", e); }
  }

  function onClick(e) {
    const b = e.target.closest("[data-bh]"); if (!b) return;
    const k = b.dataset.bh;
    if (k === "tactics") { UI.activeMode = "tactics"; UI.showView("levels"); }
    else if (k === "games") { UI.activeMode = "games"; UI.showView("levels"); }
    else if (k === "daily") UI.showView("daily");
    else if (k === "ach") UI.showView("achievements");
  }

  const view = $("view-home");
  if (view && window.UI) {
    view.addEventListener("click", onClick);
    const _rh = UI.renderHome;
    UI.renderHome = function () { const r = _rh.apply(this, arguments); render(); return r; };
    if (UI.state && view.classList.contains("active")) render();
  }
  window.BrandHome = { render };
})();
