/* MaperChess — service worker.
   Сознательно МИНИМАЛЬНЫЙ и безопасный:
   • страницы (навигация) — сначала сеть; если сети нет, показываем offline.html;
   • всё остальное (JS, CSS, шахматные данные, Firebase, результаты) воркер НЕ перехватывает —
     браузер грузит как обычно, поэтому пользователь никогда не застрянет на старой версии приложения
     и устаревшие данные не сломают игру;
   • в кэше лежат только страница «нет сети» и иконки.
   Это НЕ полноценная офлайн-игра: движок chess.js и Firebase грузятся из интернета. */
const VERSION = "maperchess-v1";
const PRECACHE = ["offline.html", "assets/icon-192.png", "assets/icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;          // не трогаем ничего, кроме открытия страниц
  event.respondWith(
    fetch(req).catch(() =>
      caches.open(VERSION).then(c => c.match("offline.html")).then(r => r || Response.error())
    )
  );
});