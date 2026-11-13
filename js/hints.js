/* maper.chess — лимитированные подсказки. Гейтинг на уровне кнопки:
   подсказка списывается ДО показа, не зависит от порядка загрузки скриптов.
   FIX: после покупки счётчик подсказок обновляется НЕМЕДЛЕННО (многослойная перерисовка).
   Load AFTER js/leaderboard.js, BEFORE js/app.js. */
const HINTS_CONFIG = { daily: 3, price: 40, max: 10 };

const Hints = (function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "hints.name": "Hint",
    "hints.desc": "{n} free hints every day. Extra hints can be bought for coins.",
    "hints.left": "You have: {n}",
    "hints.full": "Stock is full",
    "hints.bought": "+1 hint",
    "hints.none": "No hints left — get more in the Shop (Streak tab)"
  }, {
    "hints.name": "Подсказка",
    "hints.desc": "Каждый день — {n} бесплатные подсказки. Докупить можно за монеты.",
    "hints.left": "У вас: {n}",
    "hints.full": "Заполнено",
    "hints.bought": "+1 подсказка",
    "hints.none": "Подсказки закончились — возьмите в магазине (вкладка «Огонёк»)"
  });

  function refresh(state) {
    if (!state) return;
    if (!state.hints) state.hints = { left: HINTS_CONFIG.daily, day: null };
    const today = normToday(state);
    if (state.hints.day !== today) {
      state.hints.left = Math.max(+state.hints.left || 0, HINTS_CONFIG.daily);   /* выигранные/докупленные не сгорают */
      state.hints.day = today;
      saveState(state);
    }
  }

  function paint() {
    const s = UI.state, b = document.getElementById("btn-hint");
    if (!b || !s) return;
    const left = s.hints ? s.hints.left : 0;
    const label = t("btn.hint").replace(/\u{1F4A1}/u, "").trim();
    b.innerHTML = `${label} <span class="hint-chip">${left}</span>`;
    b.classList.toggle("ctrl-empty", left <= 0);
  }

  /* FIX: тройная перерисовка — сразу, на след. кадр и через 60мс.
     Любой поздний рендер UI (topbar/shop/translate) всё равно вернёт актуальный счётчик. */
  function paintNow() {
    paint();
    requestAnimationFrame(paint);
    setTimeout(paint, 60);
  }

  function card(grid) {
    const s = UI.state, full = s.hints.left >= HINTS_CONFIG.max;
    const el = document.createElement("div");
    el.className = "shop-card shop-wide";
    el.innerHTML = `
      <span class="swatch swatch-hint">💡</span>
      <span class="shop-name">${t("hints.name")}</span>
      <span class="shop-desc">${t("hints.desc", { n: HINTS_CONFIG.daily })}</span>
      <span class="shop-price">${t("hints.left", { n: s.hints.left })} · ${t("shop.priceCoins", { n: HINTS_CONFIG.price })}</span>`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "shop-btn"; btn.disabled = full;
    btn.textContent = full ? t("hints.full") : t("shop.btn.buy");
    btn.addEventListener("click", () => {
      const st = UI.state;
      if (st.hints.left >= HINTS_CONFIG.max) return;
      if (st.coins < HINTS_CONFIG.price) { UI._toast(t("shop.notEnoughCoins")); return; }
      st.coins -= HINTS_CONFIG.price; st.hints.left++;
      saveState(st);
      UI.renderShop(); UI.renderTopbar();
      UI._toast(t("hints.bought"));
      paintNow(); /* подсказка появляется СРАЗУ, без повторного нажатия */
    });
    el.appendChild(btn); grid.appendChild(el);
  }

  UI._bindGameControls = function () {
    document.getElementById("btn-hint").addEventListener("click", () => {
      const s = this.state;
      refresh(s);
      if (!s.hints || s.hints.left <= 0) { this._toast(t("hints.none")); paint(); return; }
      if (!this.gameController) return;
      /* подсказка списывается только если она реально показана
         (не в ход соперника и не после конца партии) */
      if (!this.gameController.hint()) return;
      s.hints.left--; saveState(s);
      paintNow();
    });
    document.getElementById("btn-undo").addEventListener("click", () => this.gameController?.undo());
    document.getElementById("btn-resign").addEventListener("click", () => {
      const msg = this.currentMode === "puzzle" ? t("confirm.giveUp") : t("confirm.resign");
      if (confirm(msg)) this.gameController?.resign();
    });
    document.getElementById("btn-exit-game").addEventListener("click", () => this.showView("levels"));
    paintNow();
  };
  const _sync = UI._syncStreak;
  UI._syncStreak = function (silent) { _sync.call(this, silent); refresh(this.state); paintNow(); };
  const _tr = UI.translate;
  UI.translate = function () { _tr.call(this); paintNow(); };
  const _rt = UI.renderTopbar;
  UI.renderTopbar = function () { _rt.call(this); paint(); };
  const _boost = UI._renderBoostShop;
  UI._renderBoostShop = function (grid) { _boost.call(this, grid); card(grid); };

  return { refresh, paint, paintNow };
})();