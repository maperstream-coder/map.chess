/* maper.chess — «Поделиться» и прямые ссылки.
   Share.url(params)          — ссылка на это приложение с параметрами (?daily=1, ?puzzle=mate2-5 …)
   Share.text(opts)           — системное меню «Поделиться» (если есть) или копирование в буфер
   Share.copy(str)            — копирование текста/ссылки с запасным способом для старых браузеров
   Share.card(opts)           — рисует картинку-карточку результата (PNG Blob)
   Share.shareCard(opts,...)  — отправляет картинку через системное меню или скачивает файл
   Share.openSheet(cfg)       — маленькое окно «Поделиться» (ссылка · текст · картинка)
   Router                     — открывает нужный экран по ссылке: ?daily=1 · ?puzzle=ID · ?level=ID · ?view=NAME
   Подключается ПОСЛЕ ui.js (нужны I18N, t, UI). Не раскрывает правильные ходы: в карточке/тексте только результат. */
(function () {
  "use strict";
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "share.title": "Share", "share.native": "Share…", "share.copyLink": "Copy link", "share.copyText": "Copy result",
    "share.image": "Result image", "share.copied": "Copied to clipboard", "share.copyFail": "Couldn't copy — select the text and copy it manually",
    "share.imgSaved": "Image saved", "share.imgFail": "Couldn't create the image", "share.close": "Close",
    "share.cta": "Think you can do better?", "share.puzzleText": "I solved a MaperChess puzzle — can you?",
    "share.levelText": "I cleared a MaperChess level — try to beat it!",
    "link.badPuzzle": "That puzzle isn't available — here's the game instead.",
    "link.badLevel": "That level isn't available — here's the game instead.",
    "link.lockedLevel": "That level is still locked — finish the earlier levels first.",
    "link.badView": "That page doesn't exist — opening the home screen."
  }, {
    "share.title": "Поделиться", "share.native": "Поделиться…", "share.copyLink": "Скопировать ссылку", "share.copyText": "Скопировать результат",
    "share.image": "Картинка с результатом", "share.copied": "Скопировано", "share.copyFail": "Не удалось скопировать — выделите текст и скопируйте вручную",
    "share.imgSaved": "Картинка сохранена", "share.imgFail": "Не удалось создать картинку", "share.close": "Закрыть",
    "share.cta": "Сможешь лучше?", "share.puzzleText": "Я решил задачу в MaperChess — а ты сможешь?",
    "share.levelText": "Я прошёл уровень в MaperChess — попробуй повторить!",
    "link.badPuzzle": "Эта задача недоступна — открываю игру.",
    "link.badLevel": "Этот уровень недоступен — открываю игру.",
    "link.lockedLevel": "Этот уровень ещё закрыт — сначала пройдите предыдущие.",
    "link.badView": "Такой страницы нет — открываю главную."
  });

  const $ = id => document.getElementById(id);
  const toast = m => { if (typeof UI !== "undefined" && UI._toast) UI._toast(m); };

  /* ---------- ссылки ---------- */
  function baseUrl() {
    try { return location.origin + location.pathname; } catch (e) { return ""; }
  }
  function url(params) {
    const q = Object.keys(params || {}).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== false)
      .map(k => encodeURIComponent(k) + (params[k] === true ? "" : "=" + encodeURIComponent(params[k])));
    return baseUrl() + (q.length ? "?" + q.join("&") : "");
  }

  /* ---------- копирование ---------- */
  async function copy(str) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(str); toast(t("share.copied")); return true; }
    } catch (e) { /* пойдём запасным путём */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = str; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, str.length);
      const ok = document.execCommand("copy"); ta.remove();
      toast(t(ok ? "share.copied" : "share.copyFail")); return ok;
    } catch (e) { toast(t("share.copyFail")); return false; }
  }

  /* ---------- системное меню «Поделиться» ---------- */
  async function text(o) {
    const full = o.url && !String(o.text || "").includes(o.url) ? (o.text ? o.text + "\n" : "") + o.url : (o.text || "");
    if (navigator.share) {
      try { await navigator.share({ title: o.title || "MaperChess", text: o.text || "", url: o.url || undefined }); return true; }
      catch (e) { if (e && e.name === "AbortError") return false; /* пользователь закрыл меню — не ошибка */ }
    }
    return copy(full);
  }

  /* ---------- картинка-карточка ---------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  /* o: { kicker, title, big, bigLabel, cells:[ "ok"|"retry"|"hint"|"skip"|"empty" ], stars:0-3, footer } */
  function card(o) {
    return new Promise((resolve, reject) => {
      try {
        const W = 1200, H = 630, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const c = cv.getContext("2d");
        const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#15111c"); bg.addColorStop(1, "#0c0a11");
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        /* доска-узор справа */
        const S = 56, ox = W - 8 * S - 60, oy = 60;
        for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
          c.fillStyle = (r + q) % 2 ? "rgba(142, 85, 230,.20)" : "rgba(255,255,255,.05)"; c.fillRect(ox + q * S, oy + r * S, S, S);
        }
        const glow = c.createRadialGradient(ox + 4 * S, oy + 4 * S, 10, ox + 4 * S, oy + 4 * S, 330);
        glow.addColorStop(0, "rgba(142, 85, 230,.30)"); glow.addColorStop(1, "rgba(142, 85, 230,0)");
        c.fillStyle = glow; c.fillRect(0, 0, W, H);
        c.fillStyle = "rgba(236,234,228,.9)"; c.font = "300px serif"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("♞", ox + 4 * S, oy + 4 * S + 14);
        c.textAlign = "left"; c.textBaseline = "alphabetic";
        /* тексты */
        c.fillStyle = "#b98bf5"; c.font = "700 30px 'Onest', system-ui, sans-serif";
        c.fillText((o.kicker || "MaperChess").toUpperCase(), 70, 100);
        c.fillStyle = "#eceae4"; c.font = "600 64px 'Unbounded', Georgia, serif"; c.fillText(o.title || "", 70, 186);
        if (o.big !== undefined && o.big !== null) {
          c.fillStyle = "#e3bf7c"; c.font = "700 150px 'Unbounded', Georgia, serif"; c.fillText(String(o.big), 70, 360);
          if (o.bigLabel) { c.fillStyle = "#9c9ca6"; c.font = "600 32px 'Onest', system-ui, sans-serif"; c.fillText(o.bigLabel, 74, 410); }
        }
        if (typeof o.stars === "number") {
          c.font = "56px serif";
          const STAR = new Path2D("M12 2.9l2.75 5.8 6.35.85-4.65 4.4 1.2 6.3L12 17.05 6.35 20.25l1.2-6.3L2.9 9.55l6.35-.85z");
          for (let i = 0; i < 3; i++) { c.save(); c.translate(66 + i * 62, 446); c.scale(2.3, 2.3); c.fillStyle = i < o.stars ? "#e3bf7c" : "rgba(255,255,255,.18)"; c.fill(STAR); c.restore(); }
        }
        const COL = { ok: "#72d6a3", retry: "#e3bf7c", hint: "#91d2f7", skip: "#4a4c55", empty: "#2b2636" };
        (o.cells || []).forEach((k, i) => { c.fillStyle = COL[k] || COL.empty; roundRect(c, 340 + i * 74, 450, 62, 62, 14); c.fill(); });
        c.fillStyle = "#9c9ca6"; c.font = "600 28px 'Onest', system-ui, sans-serif";
        c.fillText(o.footer || "", 70, 580);
        cv.toBlob(b => b ? resolve(b) : reject(new Error("toBlob")), "image/png");
      } catch (e) { reject(e); }
    });
  }
  async function shareCard(o, shareText, shareUrl) {
    try {
      const blob = await card(o);
      const file = new File([blob], "maperchess-result.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "MaperChess", text: shareText || "", url: shareUrl || undefined }); return true; }
        catch (e) { if (e && e.name === "AbortError") return false; }
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "maperchess-result.png";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(t("share.imgSaved")); return true;
    } catch (e) { console.warn("Share.card", e); toast(t("share.imgFail")); return false; }
  }

  /* ---------- окно «Поделиться» ---------- */
  function openSheet(cfg) {
    let m = $("share-modal");
    if (!m) {
      m = document.createElement("div");
      m.className = "modal"; m.id = "share-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
      m.innerHTML = '<div class="modal-card"><button class="modal-x" type="button" data-sh="x" aria-label="">✕</button>' +
        '<h3 id="share-title"></h3><p id="share-sub"></p><pre class="share-pre" id="share-pre"></pre>' +
        '<div class="share-actions" id="share-actions"></div></div>';
      (document.querySelector(".phone-frame") || document.body).appendChild(m);
      m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-sh='x']")) m.classList.remove("open"); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") m.classList.remove("open"); });
    }
    m.querySelector(".modal-x").setAttribute("aria-label", t("share.close"));
    $("share-title").textContent = cfg.title || t("share.title");
    $("share-sub").textContent = cfg.sub || "";
    $("share-pre").textContent = cfg.text || "";
    $("share-pre").hidden = !cfg.text;
    const box = $("share-actions"); box.innerHTML = "";
    const btn = (label, cls, fn) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label;
      b.addEventListener("click", fn); box.appendChild(b); return b;
    };
    const fullText = cfg.text ? cfg.text + (cfg.url ? "\n" + cfg.url : "") : (cfg.url || "");
    btn(t(navigator.share ? "share.native" : "share.copyText"), "btn-primary", () => text({ title: cfg.title, text: cfg.text, url: cfg.url }));
    if (navigator.share) btn(t("share.copyText"), "btn-ghost", () => copy(fullText));
    if (cfg.url) btn(t("share.copyLink"), "btn-ghost", () => copy(cfg.url));
    if (cfg.card) btn(t("share.image"), "btn-ghost", () => shareCard(cfg.card, cfg.text, cfg.url));
    m.classList.add("open");
  }

  /* ---------- прямые ссылки ---------- */
  const VIEWS = ["home", "levels", "daily", "achievements", "shop", "profile", "lessons", "leaderboard", "friends", "trade"];
  function route(search) {
    if (typeof UI === "undefined" || !UI.state) return false;
    let p; try { p = new URLSearchParams(search !== undefined ? search : location.search); } catch (e) { return false; }
    const go = n => { UI.showView(n); return true; };

    if (p.has("puzzle")) {
      const id = p.get("puzzle");
      const pz = ALL_PUZZLES.find(x => x.id === id);
      if (!pz) { toast(t("link.badPuzzle")); return go("levels"); }
      UI.activeMode = "tactics"; UI.activePuzzleTier = pz.tier;
      UI.showView("levels"); UI._launchPuzzle(pz.id, "w"); return true;     /* прямая ссылка = именно эта задача, цвет — как у автора */
    }
    if (p.has("level")) {
      const id = p.get("level");
      const lv = ALL_LEVELS.find(x => x.id === id);
      if (!lv) { toast(t("link.badLevel")); return go("levels"); }
      UI.activeMode = "games"; UI.activeTier = lv.tier;
      if (!isLevelUnlocked(UI.state, lv.id)) { toast(t("link.lockedLevel")); return go("levels"); }
      UI.showView("levels"); UI.startLevel(lv.id); return true;
    }
    if (p.has("daily")) return go("daily");
    if (p.has("view")) {
      const v = p.get("view");
      if (!VIEWS.includes(v) || !document.getElementById("view-" + v)) { toast(t("link.badView")); return go("home"); }
      return go(v);
    }
    return false;
  }
  function cleanUrl() {
    try { if (location.search) history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* не критично */ }
  }
  function boot() {
    setTimeout(() => {
      try { if (route()) cleanUrl(); } catch (e) { console.warn("maper.chess: ссылка не открылась", e); }
    }, 0);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.Share = { url, copy, text, card, shareCard, openSheet, route };
})();