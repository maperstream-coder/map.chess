/* maper.chess — лёгкая защита интерфейса от случайного «подглядывания».
   ВАЖНО: это отпугивание, а не настоящая защита — код сайта всё равно загружается в браузер.
   Реальную защиту данных обеспечивают правила Firestore и ограничение API-ключа Firebase. */
(function () {
  "use strict";
  const editable = el => !!(el && el.closest && el.closest("input, textarea, [contenteditable='true']"));

  /* 1) нет контекстного меню («Просмотреть код»), кроме полей ввода */
  document.addEventListener("contextmenu", e => { if (!editable(e.target)) e.preventDefault(); });

  /* 2) горячие клавиши: F12, Ctrl/Cmd+U (исходник), Ctrl+Shift+I/J/C/K (DevTools), Cmd+Opt+I/J/U/C */
  document.addEventListener("keydown", e => {
    const k = (e.key || "").toLowerCase(), mod = e.ctrlKey || e.metaKey;
    const devtools = e.key === "F12" ||
      (mod && e.shiftKey && ["i", "j", "c", "k"].includes(k)) ||
      (e.metaKey && e.altKey && ["i", "j", "u", "c"].includes(k)) ||
      (mod && !e.shiftKey && k === "u");
    if (devtools) { e.preventDefault(); e.stopPropagation(); return false; }
  }, true);

  /* 3) нельзя утащить картинки и логотип перетаскиванием */
  document.addEventListener("dragstart", e => { if (e.target && e.target.tagName === "IMG") e.preventDefault(); });

  /* 4) сайт нельзя встроить в чужую страницу (iframe) */
  try { if (window.top !== window.self) window.top.location = window.self.location; } catch (e) {
    document.documentElement.innerHTML = ""; // чужой домен не даёт перейти — просто не показываем игру
  }

  /* 5) предупреждение в консоли: защита от «вставь этот код, и получишь монеты» */
  try {
    console.log("%cСтоп!", "color:#ee8195;font:800 42px sans-serif");
    console.log("%cЭта консоль — для разработчиков. Если кто-то просит вставить сюда код, чтобы получить монеты или взломать аккаунт — это мошенничество.",
      "font:600 15px sans-serif");
  } catch (e) {}
})();

/* ===== NO-ZOOM: приложение не масштабируется (pinch / двойной тап / зум при фокусе поля) ===== */
(function () {
  "use strict";
  const opt = { passive: false };
  /* iOS Safari: щипок двумя пальцами */
  ["gesturestart", "gesturechange", "gestureend"].forEach(n =>
    document.addEventListener(n, e => e.preventDefault(), opt));
  /* любой multi-touch жест — не масштаб, а ничего */
  document.addEventListener("touchmove", e => { if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault(); }, opt);
  /* Ctrl + колесо / Ctrl +/-/0 на ПК */
  document.addEventListener("wheel", e => { if (e.ctrlKey && e.cancelable) e.preventDefault(); }, opt);
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", "_"].includes(e.key) && e.cancelable) e.preventDefault();
  }, true);
  /* Двойной тап: основная защита — CSS touch-action: manipulation (css/boost.css).
     Запасной вариант для браузеров, которые его игнорируют: второй быстрый тап по тому же месту
     не даёт зум, но клик при этом НЕ теряется — отправляем его вручную. */
  let lastEnd = 0, lastX = 0, lastY = 0;
  document.addEventListener("touchend", e => {
    const tch = e.changedTouches && e.changedTouches[0];
    if (!tch || (e.touches && e.touches.length)) return;
    const now = Date.now(), near = Math.abs(tch.clientX - lastX) < 30 && Math.abs(tch.clientY - lastY) < 30;
    const tg = e.target;
    const field = tg && tg.closest && tg.closest("input, textarea, select, label, a, [contenteditable='true']");
    if (!field && near && now - lastEnd < 320 && e.cancelable) {
      e.preventDefault();
      try { tg.click(); } catch (x) {}
    }
    lastEnd = now; lastX = tch.clientX; lastY = tch.clientY;
  }, opt);
})();