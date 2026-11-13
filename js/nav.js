/* maper.chess — единая навигация.
   В панели остаются только основные вкладки, всё остальное (Lessons, Leaderboard,
   Friends, Duels и любые будущие кнопки, которые добавляют модули) автоматически
   собирается в шторку «Ещё». Работает и в нижней навигации телефона, и в сайдбаре ПК. */
const Nav = (function () {
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.en, { "nav.more": "More", "nav.moreEmpty": "Nothing here yet" });
    Object.assign(I18N.ru, { "nav.more": "Ещё", "nav.moreEmpty": "Здесь пока пусто" });
  }

  /* что всегда видно в панели — именно в таком порядке (остальное — в «Ещё»):
     Главная · Уровни · Испытание · Ратуша · Друзья (+поединки) · Ещё */
  const PRIMARY = ["home", "levels", "daily", "village", "friends"];
  /* что лежит в шторке «Ещё» — тоже по порядку */
  const MORE = ["lessons", "fischer", "leaderboard", "achievements", "profile", "shop", "trade"];

  let sheet = null, moreBtn = null, built = false;

  function t(k) {
    try { return (typeof I18N !== "undefined" && window.t) ? t(k) : k; } catch (e) { return k; }
  }
  function label(k) { try { return window.t ? window.t(k) : k; } catch (e) { return k; } }

  function allButtons() {
    return Array.from(document.querySelectorAll(".bottom-nav .nav-btn[data-view]"))
      .filter(b => b.dataset.view && b.dataset.view !== "__more");
  }

  function ensureUI() {
    const nav = document.querySelector(".bottom-nav");
    if (!nav) return null;
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.className = "more-sheet";
      sheet.id = "more-sheet";
      sheet.innerHTML =
        '<div class="ms-backdrop"></div>' +
        '<div class="ms-panel" role="dialog" aria-modal="true">' +
          '<div class="ms-head">' +
            '<span class="ms-title" data-i18n="nav.more">More</span>' +
            '<button class="ms-close" type="button" aria-label="Close">' + ic("close") + '</button>' +
          '</div>' +
          '<div class="ms-list"></div>' +
        "</div>";
      document.body.appendChild(sheet);
      sheet.querySelector(".ms-backdrop").addEventListener("click", close);
      sheet.querySelector(".ms-close").addEventListener("click", close);

      moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "nav-btn nav-more";
      moreBtn.dataset.view = "__more";
      moreBtn.innerHTML =
        '<span><svg class="nv" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-menu"/></svg></span>' +
        '<span data-i18n="nav.more">More</span>';
      moreBtn.addEventListener("click", toggle);
      nav.appendChild(moreBtn);
    }
    return nav;
  }

  /* выстраиваем кнопки в нужном порядке (модули добавляют их как попало); «Ещё» всегда последняя */
  function reorder(nav) {
    const want = PRIMARY.concat(MORE);
    const btns = allButtons();
    const sorted = btns.slice().sort((a, b) => {
      const ia = want.indexOf(a.dataset.view), ib = want.indexOf(b.dataset.view);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const cur = Array.from(nav.querySelectorAll(".nav-btn[data-view]")).map(b => b.dataset.view);
    const wanted = sorted.map(b => b.dataset.view).concat(["__more"]);
    if (cur.join("|") === wanted.join("|")) return;      /* уже в порядке — ничего не двигаем (иначе observer зациклится) */
    sorted.forEach(b => nav.insertBefore(b, moreBtn));
    nav.appendChild(moreBtn);
  }

  function build() {
    const nav = ensureUI();
    if (!nav) return;
    reorder(nav);
    const buttons = allButtons();
    /* «Поединки» объединены с «Друзьями» — отдельной кнопки нет */
    const duelBtn = buttons.find(b => b.dataset.view === "duels");
    if (duelBtn) duelBtn.remove();
    const extra = buttons
      .filter(b => b !== duelBtn && !PRIMARY.includes(b.dataset.view))
      .sort((a, b) => {
        const ia = MORE.indexOf(a.dataset.view), ib = MORE.indexOf(b.dataset.view);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

    buttons.filter(b => b !== duelBtn).forEach(b => {
      const hide = !PRIMARY.includes(b.dataset.view);
      b.classList.toggle("nav-collapsed", hide);
    });

    const list = sheet.querySelector(".ms-list");
    list.innerHTML = "";
    if (!extra.length) {
      const empty = document.createElement("p");
      empty.className = "ms-empty";
      empty.dataset.i18n = "nav.moreEmpty";
      empty.textContent = label("nav.moreEmpty");
      list.appendChild(empty);
    }
    extra.forEach(b => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ms-item" + (b.classList.contains("active") ? " active" : "");
      item.innerHTML = b.innerHTML;
      item.addEventListener("click", () => { close(); b.click(); });
      list.appendChild(item);
    });

    const activeExtra = extra.some(b => b.classList.contains("active"));
    moreBtn.classList.toggle("active", activeExtra && !sheet.classList.contains("open"));
    built = true;
  }

  function open() {
    ensureUI();
    build();
    sheet.classList.add("open");
    document.body.classList.add("ms-locked");
    if (window.Sfx) Sfx.open();
  }
  function close() {
    if (!sheet) return;
    sheet.classList.remove("open");
    document.body.classList.remove("ms-locked");
  }
  function toggle() { sheet && sheet.classList.contains("open") ? close() : open(); }

  function start() {
    /* кнопка «Ещё» не вкладка: UI._bindNav вешает на неё showView("__more") — глушим */
    if (typeof UI !== "undefined" && UI.showView && !UI.showView.__moreGuard) {
      const orig = UI.showView;
      UI.showView = function (name) {
        if (name === "__more") return;
        return orig.apply(this, arguments);
      };
      UI.showView.__moreGuard = true;
    }
    build();
    const nav = document.querySelector(".bottom-nav");
    if (nav) {
      /* если модули добавят свои кнопки позже — пересоберём список */
      new MutationObserver(() => build()).observe(nav, { childList: true });
    }
    const views = document.querySelector(".views");
    if (views) {
      /* подсветка активного пункта при смене вкладки */
      let deb = null;
      new MutationObserver(() => {
        clearTimeout(deb);
        deb = setTimeout(() => built && build(), 60);
      }).observe(views, { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    document.addEventListener("click", e => {
  const btn = e.target.closest(
    '.nav-btn[data-view]:not([data-view="__more"])'
  );

  if (!btn) return;

  close();

  const view = btn.dataset.view;

  if (
    typeof Cloud !== "undefined" &&
    Cloud.analytics &&
    typeof Cloud.analytics.logEvent === "function"
  ) {
    Cloud.analytics.logEvent("section_open", {
      section_name: view
    });
  }
});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  return { open, close, toggle, rebuild: build };
})();