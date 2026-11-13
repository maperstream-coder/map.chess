/* maper.chess — boost.js
   Небольшие улучшения поверх существующей логики. Ничего не подменяет и не удаляет:
   все изменения — это обёртки, которые вызывают оригинальные методы и только добавляют отклик.
   Каждый блок изолирован в try/catch: если что-то пойдёт не так, игра продолжит работать как раньше.
   Подключается ПОСЛЕДНИМ (после streak-up.js / admin-ops.js). */
(function () {
  "use strict";

  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nick.go": "Save & play", "hp.firstBtn": "Play", "hp.firstSub": "Your first puzzle takes about a minute. No sign-up needed.",
    "bx.play": "Play", "bx.continue": "Continue", "bx.allDone": "Everything cleared — replay your favourites",
    "bx.levelUp": "Level {n}! Keep going", "bx.tryAgain": "Every master lost first — try again"
  }, {
    "nick.go": "Сохранить и играть", "hp.firstBtn": "Играть", "hp.firstSub": "Первая задача займёт около минуты. Регистрация не нужна.",
    "bx.play": "Играть", "bx.continue": "Продолжить", "bx.allDone": "Всё пройдено — переиграйте любимое",
    "bx.levelUp": "Уровень {n}! Так держать", "bx.tryAgain": "Все мастера сначала проигрывали — попробуйте ещё"
  });

  const $ = id => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const vibrate = p => { if (reduced()) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const tr = (k, p) => { try { return t(k, p); } catch (e) { return k; } };
  const safe = fn => function () { try { return fn.apply(this, arguments); } catch (e) { console.warn("maper.chess boost:", e); } };

  /* =====================================================================
     1. Главная кнопка «Играть / Продолжить» для вернувшегося игрока
        (у новичка уже есть большая кнопка из home-plus.js — она лишь переименована в «Играть»)
     ===================================================================== */
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z"/></svg>';
  const ICON_GO = '<svg class="bx-play-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function launch(tg) {
    if (!tg) { UI.showView("levels"); return; }
    if (tg.kind === "p") {
      const p = ALL_PUZZLES.find(x => x.id === tg.id);
      if (!p) { UI.showView("levels"); return; }
      UI.activeMode = "tactics"; UI.activePuzzleTier = p.tier; UI.showView("levels"); UI.startPuzzle(tg.id);
    } else {
      const l = ALL_LEVELS.find(x => x.id === tg.id);
      if (!l) { UI.showView("levels"); return; }
      UI.activeMode = "games"; UI.activeTier = l.tier; UI.showView("levels"); UI.startLevel(tg.id);
    }
  }

  function currentTarget() {
    try { return window.HomePlus && HomePlus.target ? HomePlus.target(UI.state) : null; } catch (e) { return null; }
  }

  function ensurePlayButton() {
    const view = $("view-home"), top = $("home-top");
    if (!view || !top || !UI.state) return;
    const ret = view.classList.contains("home-ret");
    let btn = $("bx-play");
    if (!ret) { if (btn) btn.remove(); return; }          /* новичку — только его большая кнопка */
    const tg = currentTarget();
    const sub = tg ? `${tg.title} · ${tg.sub}` : tr("bx.allDone");
    const hasProgress = (UI.state.completed || []).length || (UI.state.completedPuzzles || []).length;
    const label = tr(hasProgress ? "bx.continue" : "bx.play");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button"; btn.id = "bx-play"; btn.className = "bx-play";
      btn.addEventListener("click", () => { if (window.Sfx && Sfx.click) { try { Sfx.click(); } catch (e) {} } launch(currentTarget()); });
    }
    const html = `<span class="bx-play-ico">${ICON_PLAY}</span><span class="bx-play-body"><b>${label}</b><small></small></span>${ICON_GO}`;
    if (btn._html !== html) { btn.innerHTML = html; btn._html = html; }
    btn.querySelector("small").textContent = sub;
    if (top.firstChild !== btn) top.insertBefore(btn, top.firstChild);
  }

  function watchHome() {
    const top = $("home-top"), view = $("view-home");
    if (!top || !view) return;
    /* home-plus.js перерисовывает #home-top целиком — возвращаем кнопку на место */
    let busy = false;
    new MutationObserver(() => {
      if (busy) return; busy = true;
      Promise.resolve().then(() => { try { ensurePlayButton(); } finally { busy = false; } });
    }).observe(top, { childList: true });
    ensurePlayButton();
  }

  /* =====================================================================
     2. Доска: приземление фигуры, взятие, шах, кольца на возможных взятиях
     ===================================================================== */
  function patchBoard() {
    if (typeof BoardView === "undefined" || BoardView.prototype.__bx) return;
    const P = BoardView.prototype, origRender = P.render;
    const pieces = fen => (fen.split(" ")[0].match(/[a-z]/gi) || []).length;

    P.render = function (game) {
      let before = null;
      try {
        before = { n: this._bxN, fen: this._bxFen };
        Object.keys(this.squares).forEach(k => this.squares[k].classList.remove("bx-land", "bx-land-ai", "bx-cap", "sq-cap-target"));
      } catch (e) {}
      const res = origRender.apply(this, arguments);
      try {
        const n = game.history().length, fen = game.fen().split(" ")[0];
        /* кольца на клетках, где можно взять фигуру */
        (this.legalTargets || []).forEach(sq => { const el = this.squares[sq]; if (el && game.get(sq)) el.classList.add("sq-cap-target"); });
        /* анимация нового хода (не при выборе, не при откате, не при первой отрисовке) */
        const moved = before && before.n != null && n > before.n && fen !== before.fen && this.lastMove;
        if (moved) {
          const el = this.squares[this.lastMove.to];
          if (el) {
            const mine = this.playerColor === null || (game.turn() !== this.playerColor);   /* только что ходил игрок */
            el.classList.add("bx-land"); if (!mine) el.classList.add("bx-land-ai");
            const captured = pieces(fen) < pieces(before.fen);
            if (captured) { el.classList.add("bx-cap"); vibrate(12); }
            if (game.in_check()) vibrate([18, 30, 18]);
            setTimeout(() => el.classList.remove("bx-cap"), 600);
          }
        }
        this._bxN = n; this._bxFen = fen;
      } catch (e) {}
      return res;
    };
    P.__bx = true;
  }

  /* =====================================================================
     3. Шапка: «+N» у монет, всплеск при новом уровне
     ===================================================================== */
  function floatText(anchor, text) {
    if (!anchor || reduced()) return;
    const r = anchor.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "bx-float"; f.textContent = text;
    f.style.left = (r.left + r.width / 2) + "px"; f.style.top = (r.bottom + 2) + "px";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }
  function bump(el) {
    if (!el) return;
    el.classList.remove("bx-bump"); void el.offsetWidth; el.classList.add("bx-bump");
    setTimeout(() => el.classList.remove("bx-bump"), 700);
  }

  function watchTopbar() {
    const cc = $("coin-count");
    if (cc) {
      let last = null;
      new MutationObserver(safe(() => {
        const v = parseInt(cc.textContent, 10);
        if (isNaN(v)) return;
        if (last !== null && v > last) { const pill = cc.closest(".pill") || cc; bump(pill); floatText(pill, "+" + (v - last)); }
        last = v;
      })).observe(cc, { childList: true, characterData: true, subtree: true });
    }
    if (typeof UI !== "undefined" && UI.renderTopbar && !UI.renderTopbar.__bx) {
      const orig = UI.renderTopbar;
      let lastLvl = null;
      UI.renderTopbar = function () {
        const r = orig.apply(this, arguments);
        try {
          const lvl = playerLevelFromXp(this.state.xp).level;
          if (lastLvl !== null && lvl > lastLvl) {
            bump($("player-rank"));
            setTimeout(() => { try { this._toast(tr("bx.levelUp", { n: lvl })); } catch (e) {} }, 900);
            vibrate([30, 40, 60]);
          }
          lastLvl = lvl;
        } catch (e) {}
        return r;
      };
      UI.renderTopbar.__bx = true;
    }
  }

  /* =====================================================================
     4. Окно результата: звёзды, значок, конфетти, акцент на нужной кнопке
     ===================================================================== */
  const COLORS = ["#b98bf5", "#e3bf7c", "#72d6a3", "#f3a560", "#dcc6ff"];

  function confetti(card) {
    if (reduced()) return;
    const box = document.createElement("div");
    box.className = "bx-confetti"; box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 30; i++) {
      const p = document.createElement("i");
      p.style.left = (4 + Math.random() * 92) + "%";
      p.style.background = COLORS[i % COLORS.length];
      p.style.setProperty("--x", (Math.random() * 90 - 45) + "px");
      p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      p.style.setProperty("--d", (1.5 + Math.random() * 1.1) + "s");
      p.style.setProperty("--dl", (Math.random() * .5) + "s");
      box.appendChild(p);
    }
    card.appendChild(box);
    setTimeout(() => box.remove(), 3400);
  }

  function decorateResult(title, sub) {
    const modal = $("result-modal"), card = modal && modal.querySelector(".modal-card");
    if (!card) return;
    card.querySelectorAll(".bx-hero, .bx-confetti").forEach(n => n.remove());
    card.classList.remove("bx-win");
    const winTitles = [tr("modal.victoryTitle"), tr("puzzle.solvedTitle")];
    const drawTitle = tr("modal.drawTitle");
    const win = winTitles.indexOf(title) >= 0;
    const draw = title === drawTitle;
    const hero = document.createElement("div");
    hero.className = "bx-hero"; hero.setAttribute("aria-hidden", "true");
    const stars = ((sub || "").match(/★/g) || []).length, hollow = ((sub || "").match(/☆/g) || []).length;
    if (win && stars + hollow === 3) {
      for (let i = 0; i < 3; i++) { const s = document.createElement("span"); s.className = "bx-star" + (i < stars ? " on" : ""); s.style.setProperty("--i", i); s.textContent = "★"; hero.appendChild(s); }
    } else {
      const b = document.createElement("span");
      b.className = "bx-badge " + (win ? "ok" : draw ? "draw" : "lose");
      b.textContent = win ? "✓" : draw ? "=" : "↻";
      hero.appendChild(b);
    }
    card.insertBefore(hero, $("modal-title"));
    if (win) { card.classList.add("bx-win"); confetti(card); }

    /* после поражения главным действием становится «ещё раз», после победы — «дальше» */
    const retry = $("modal-retry"), next = $("modal-next");
    if (retry) {
      const retryPrimary = !(win && next && !next.hidden);
      retry.classList.toggle("btn-primary", retryPrimary);
      retry.classList.toggle("btn-ghost", !retryPrimary);
    }
    const p = $("modal-sub");
    if (p && !win && !draw && p.textContent.indexOf(tr("bx.tryAgain")) < 0) p.textContent = p.textContent + " " + tr("bx.tryAgain") + ".";
  }

  function patchResult() {
    if (typeof UI === "undefined" || !UI._showResultModal || UI._showResultModal.__bx) return;
    const orig = UI._showResultModal;
    UI._showResultModal = function (title, sub) {
      const r = orig.apply(this, arguments);
      try { decorateResult(title, sub); } catch (e) { console.warn("maper.chess boost:", e); }
      return r;
    };
    UI._showResultModal.__bx = true;
  }

  /* ===================================================================== */
  function start() {
    safe(patchBoard)();
    safe(patchResult)();
    safe(watchTopbar)();
    safe(watchHome)();
    /* на случай, если главная отрисовалась до загрузки скрипта */
    if (typeof UI !== "undefined" && UI.renderHome && !UI.renderHome.__bx) {
      const orig = UI.renderHome;
      UI.renderHome = function () { const r = orig.apply(this, arguments); safe(ensurePlayButton)(); return r; };
      UI.renderHome.__bx = true;
    }
    /* смена языка → обновим подпись кнопки */
    document.addEventListener("click", e => { if (e.target.closest && e.target.closest(".lang-btn")) setTimeout(safe(ensurePlayButton), 80); });
  }

  /* app.js вызывает UI.init() на DOMContentLoaded; наш start должен выполниться после него */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();