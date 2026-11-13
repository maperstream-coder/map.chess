/* maper.chess — переключатель темы (тёмная / светлая).
   Ранняя установка темы делается inline-скриптом в <head> (чтобы не было вспышки).
   Здесь — кнопка в шапке и API: MCTheme.get(), MCTheme.set("light"|"dark"), MCTheme.toggle(). */
(function () {
  var KEY = "mc-theme";
  var root = document.documentElement;
  var COLORS = { dark: "#0e0e12", light: "#f4f3f7" };

  function get() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function apply(t) {
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", COLORS[t]);
    var c = document.querySelector('meta[name="color-scheme"]'); if (c) c.setAttribute("content", t);
    var b = document.getElementById("btn-theme");
    if (b) { var l = t === "light" ? "Тёмная тема" : "Светлая тема"; b.title = l; b.setAttribute("aria-label", l); }
  }
  function set(t) {
    t = t === "light" ? "light" : "dark";
    root.classList.add("theme-anim");
    apply(t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    setTimeout(function () { root.classList.remove("theme-anim"); }, 350);
    try { document.dispatchEvent(new CustomEvent("mc:theme", { detail: t })); } catch (e) {}
  }
  function toggle() { set(get() === "light" ? "dark" : "light"); }

  function mount() {
    if (document.getElementById("btn-theme")) return;
    var stats = document.querySelector(".topbar-stats");
    if (!stats) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "btn-theme"; b.className = "theme-toggle";
    b.innerHTML =
      '<svg class="tt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
      '<svg class="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
    b.addEventListener("click", toggle);
    var settings = document.getElementById("btn-settings");
    var anchor = stats.querySelector(".avatar-btn") || settings;
    if (anchor && anchor.parentNode === stats) stats.insertBefore(b, anchor); else stats.appendChild(b);
    apply(get());
  }

  window.MCTheme = { get: get, set: set, toggle: toggle };
  apply(get());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  /* шапку могут перестраивать другие скрипты — подстрахуемся */
  setTimeout(mount, 800); setTimeout(mount, 2500);
})();
