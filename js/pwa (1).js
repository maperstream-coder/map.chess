/* maper.chess — PWA: регистрация service worker и установка приложения.
   Подключается в index.html рано (до app.js). Не зависит от остальных модулей.
   window.PWA = { canInstall(), install(), isStandalone(), isIosSafari(), onChange(fn) } */
(function () {
  "use strict";
  const listeners = [];
  let deferred = null;

  const isStandalone = () => {
    try {
      return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    } catch (e) { return false; }
  };
  const isIosSafari = () => {
    const ua = navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  };
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.warn("PWA listener", e); } });

  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });

  window.PWA = {
    isStandalone, isIosSafari,
    canInstall: () => !!deferred && !isStandalone(),
    install() {
      if (!deferred) return Promise.resolve(false);
      const p = deferred; deferred = null; emit();
      p.prompt();
      return p.userChoice.then(c => c && c.outcome === "accepted").catch(() => false);
    },
    onChange(fn) { listeners.push(fn); }
  };

  /* service worker: только по HTTPS (или localhost), после загрузки страницы — чтобы не замедлять старт */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(err => console.warn("maper.chess: service worker не зарегистрирован", err));
    });
  }
})();