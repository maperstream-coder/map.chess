/* maper.chess — интерактивная декорация главного экрана
   Клик по доске → магазин (вкладка «Доски»), клик по королю → магазин (вкладка «Фигуры»). */
(function () {
  "use strict";

  /* дополняем словари i18n, чтобы подсказка переводилась штатным механизмом */
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.en, {
      "deco.hint": "Tap to change style",
      "tg.kicker": "Telegram channel", "tg.title": "Follow the news here",
      "tg.sub": "Updates, new levels and announcements — first in the channel.", "tg.cta": "Open",
      "sk.next": "Next reward · day {n}", "sk.best": "Best streak: {n}", "sk.freeze": "Streak freezes"
    });
    Object.assign(I18N.ru, {
      "deco.hint": "Нажми, чтобы сменить стиль",
      "tg.kicker": "Телеграм-канал", "tg.title": "Следи за новостями тут",
      "tg.sub": "Обновления, новые уровни и анонсы — первыми в канале.", "tg.cta": "Открыть",
      "sk.next": "Следующая награда · день {n}", "sk.best": "Лучшая серия: {n}", "sk.freeze": "Заморозки огонька"
    });
  }


  /* ================= ОГОНЁК: нарисованное пламя вместо эмодзи 🔥 =================
     Три слоя (внешний красно-оранжевый язык, жёлтое тело, светлое ядро) + свечение и искры.
     Градиенты лежат в скрытом спрайте <svg id="mc-flame-defs"> в index.html (если его нет — добавим сами).
     Состояния и анимация живут в css/home-deco.css: серый → тёплый → горит. */
  var FLAME_DEFS =
    '<svg id="mc-flame-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="mcf-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".5" stop-color="#ff6a2b"/><stop offset="1" stop-color="#d42a22"/></linearGradient>' +
    '<linearGradient id="mcf-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe56e"/><stop offset="1" stop-color="#ff9a2e"/></linearGradient>' +
    '<linearGradient id="mcf-i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf0"/><stop offset="1" stop-color="#ffe98a"/></linearGradient>' +
    '<radialGradient id="mcf-g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff8a2e" stop-opacity=".6"/><stop offset="1" stop-color="#ff8a2e" stop-opacity="0"/></radialGradient>' +
    '</defs></svg>';
  function ensureDefs() {
    if (document.getElementById("mc-flame-defs") || !document.body) return;
    document.body.insertAdjacentHTML("afterbegin", FLAME_DEFS);
  }
  function flameSvg() {
    return '<svg class="fl" viewBox="0 0 64 80" aria-hidden="true" focusable="false">' +
      '<ellipse class="fl-glow" cx="32" cy="58" rx="30" ry="24" fill="url(#mcf-g)"/>' +
      '<path class="fl-o" fill="url(#mcf-o)" d="M33 3C35 15 50 24 52 43C54 62 44 77 32 77C19 77 9 65 10 49C11 38 17 31 22 25C23 32 26 36 29 37C27 26 28 12 33 3Z"/>' +
      '<path class="fl-m" fill="url(#mcf-m)" d="M32 30C34 40 45 45 45 57C45 68 39 74 32 74C25 74 19 68 19 58C19 51 23 47 26 43C27 48 29 50 31 50C29 43 30 36 32 30Z"/>' +
      '<path class="fl-i" fill="url(#mcf-i)" d="M32 52C34 57 39 60 39 64C39 69 36 72 32 72C28 72 25 69 25 64C25 60 29 57 32 52Z"/>' +
      '<circle class="fl-sp s1" cx="15" cy="30" r="1.7"/><circle class="fl-sp s2" cx="50" cy="26" r="1.4"/><circle class="fl-sp s3" cx="40" cy="12" r="1.2"/>' +
      '</svg>';
  }
  var SNOW_SVG = '<svg class="snow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 2.8v18.4M4 7.4l16 9.2M20 7.4l-16 9.2"/><path d="M9.6 4.6L12 6.9l2.4-2.3M9.6 19.4L12 17.1l2.4 2.3M3.4 10.6l3.2-.6-.9-3.1M20.6 13.4l-3.2.6.9 3.1M3.4 13.4l3.2.6-.9 3.1M20.6 10.6l-3.2-.6.9-3.1"/></svg>';

  window.Flame = { svg: flameSvg, snow: SNOW_SVG };

  function paintFlames(root) {
    ensureDefs();
    (root || document).querySelectorAll("[data-flame]").forEach(function (el) {
      if (!el.firstChild) el.innerHTML = flameSvg();
    });
  }

  /* ===== карточка огонька на главной =====
     Разметка лежит в index.html (#streak-card.sk), здесь — только наполнение. Перекрываем UI.renderStreakCard целиком:
     эмодзи 🔥/❄ заменены на векторные значки, неделя рисуется кружками, добавлен прогресс до ближайшей награды. */
  function $id(id) { return document.getElementById(id); }
  function weekCell(d, loc) {
    var label = keyToDate(d.key).toLocaleDateString(loc, { weekday: "short" }).slice(0, 2);
    var icon = d.status === "done" ? '<i class="flame flame-wd">' + flameSvg() + "</i>" : d.status === "frozen" ? SNOW_SVG : "";
    return '<span class="wd ' + d.status + (d.isToday ? " is-today" : "") + '"><i>' + label + "</i><b>" + icon + "</b></span>";
  }
  function goalHtml(st) {
    var cfg = (typeof STREAK_CONFIG !== "undefined" && STREAK_CONFIG.milestones) || {};
    var ms = Object.keys(cfg).map(Number).sort(function (a, b) { return a - b; });
    var next = null, prev = 0, i;
    for (i = 0; i < ms.length; i++) { if (ms[i] > st.count) { next = ms[i]; break; } prev = ms[i]; }
    if (!next) return '<div class="sk-goal-t"><span>' + t("sk.best", { n: st.best || st.count }) + "</span></div>";
    var pct = Math.max(4, Math.min(100, Math.round((st.count - prev) / (next - prev) * 100)));
    return '<div class="sk-goal-t"><span>' + t("sk.next", { n: next }) + "</span><em>+" + cfg[next] + ' <i class="mcoin"></i></em></div>' +
      '<div class="sk-bar"><i style="width:' + pct + '%"></i></div>';
  }
  function renderStreakCard() {
    var ui = (typeof UI !== "undefined") ? UI : null, card = $id("streak-card");
    if (!ui || !ui.state || !card) return;
    var st = ui.state.streak, done = st.lastDay === dayKey();
    card.classList.toggle("streak-on", st.count > 0);
    card.classList.toggle("streak-done", done);
    paintFlames(card);
    $id("streak-days").textContent = st.count;
    $id("streak-label").textContent = t("streak.days", { n: st.count });
    var fz = $id("streak-freeze");
    if (fz) { fz.innerHTML = SNOW_SVG + "<span>" + st.freezes + "</span>"; fz.title = t("sk.freeze"); fz.setAttribute("aria-label", t("sk.freeze") + ": " + st.freezes); }
    var loc = getLang() === "ru" ? "ru-RU" : "en-US";
    $id("streak-week").innerHTML = streakWeek(ui.state).map(function (d) { return weekCell(d, loc); }).join("");
    var left = timeLeftToday();
    $id("streak-note").textContent = done ? t("streak.doneToday") : st.count > 0 ? t("streak.todayLeft", { h: left.h, m: left.m }) : t("streak.start");
    var goal = $id("streak-goal"); if (goal) goal.innerHTML = goalHtml(st);
  }
  function decorateStreak() { renderStreakCard(); }
  paintFlames(document);   /* скрипт стоит в конце body — разметка уже есть, рисуем сразу, без мигания */
  if (typeof UI !== "undefined") {
    UI.renderStreakCard = renderStreakCard;
    if (UI.state && document.getElementById("view-home").classList.contains("active")) renderStreakCard();
  }

  function currentLang() {
    try {
      var s = JSON.parse(localStorage.getItem("mapchess_state_v1") || "{}");
      if (s.lang) return s.lang;
    } catch (e) {}
    return (navigator.language || "en").slice(0, 2);
  }

  function refreshHint() {
    var el = document.getElementById("home-deco-hint");
    if (!el) return;
    try { if (typeof t === "function") { el.textContent = t("deco.hint"); return; } } catch (e) {}
    el.textContent = currentLang() === "ru" ? "Нажми, чтобы сменить стиль" : "Tap to change style";
  }

  function goToShop(type) {
    /* нажимаем штатную кнопку навигации — срабатывает любой существующий обработчик showView */
    var nav = document.querySelector('.nav-btn[data-view="shop"]');
    if (nav) nav.click();
    setTimeout(function () {
      var tab = document.querySelector('.shop-tab[data-type="' + type + '"]');
      if (tab) tab.click();
    }, 60);
  }

  function init() {
    paintFlames(document);
    decorateStreak();
    var deco = document.getElementById("home-deco");
    if (!deco) return;
    refreshHint();

    deco.addEventListener("click", function (e) {
      var onPiece = e.target && e.target.closest && e.target.closest("#home-deco-piece");
      goToShop(onPiece ? "pieces" : "board");
    });

    deco.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goToShop("board");
      }
    });

    /* если язык приложения переключили в настройках — обновим подсказку при возврате на главную */
    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".lang-btn")) {
        setTimeout(refreshHint, 50);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();