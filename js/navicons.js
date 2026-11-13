/* maper.chess — иконки нижнего/бокового меню. Берёт значки из общего спрайта (js/icons.js, <symbol id="i-…">).
   Подменяет любые шахматные символы в кнопках .nav-btn, даже если модуль добавил кнопку позже. */
(function () {
  const ICON = {
    home: "home", levels: "levels", daily: "calendar-check", lessons: "book", leaderboard: "trophy",
    friends: "users", duels: "swords", achievements: "medal", shop: "bag", trade: "swap",
    profile: "user", fischer: "dice", village: "village"
  };
  function apply() {
    document.querySelectorAll(".nav-btn").forEach(b => {
      const key = b.dataset.view, ico = b.querySelector("span:first-child");
      if (!ico || !ICON[key] || ico.querySelector("svg.nv")) return;
      ico.innerHTML = `<svg class="nv" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${ICON[key]}"/></svg>`;
    });
  }
  window.NavIcons = { apply, ICON };
  apply();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else setTimeout(apply, 0);
  /* кнопки, которые модули добавляют позже */
  const nav = document.querySelector(".bottom-nav");
  if (nav) new MutationObserver(apply).observe(nav, { childList: true });
})();
