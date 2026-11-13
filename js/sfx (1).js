/* maper.chess — звуковые эффекты (WebAudio, без аудиофайлов).
   Звуки: клик по кнопке, открытие окна/вкладки, победа, поражение, ничья, монеты.
   Настройки хранятся отдельно от прогресса: localStorage "mapchess_sfx_v1". */
const Sfx = (function () {
  let ctx = null;
  let cfg = load();

  function load() {
    const def = { on: true, vol: 0.7, ui: true, game: true };
    try {
      return Object.assign(def, JSON.parse(localStorage.getItem("mapchess_sfx_v1") || "{}"));
    } catch (e) { return def; }
  }
  function save() {
    try { localStorage.setItem("mapchess_sfx_v1", JSON.stringify(cfg)); } catch (e) {}
  }

  function ac() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctx = new A();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  /* один синтезированный тон */
  function tone(o) {
    const c = ac();
    if (!c) return;
    try {
      const t0 = c.currentTime + (o.t || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.f, t0);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + o.d);
      const peak = Math.max(0.0002, (o.g || 0.15) * cfg.vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
      osc.connect(g).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + o.d + 0.06);
    } catch (e) {}
  }

  const api = {
    get config() { return cfg; },
    save,

    /* короткий «тик» кнопки */
    click() {
      if (!cfg.on || !cfg.ui) return;
      tone({ f: 680, d: 0.055, type: "triangle", g: 0.1 });
    },
    /* открытие вкладки/окна — лёгкий подъём */
    open() {
      if (!cfg.on || !cfg.ui) return;
      tone({ f: 430, slide: 880, d: 0.14, type: "sine", g: 0.08 });
    },
    /* возврат назад — спад */
    back() {
      if (!cfg.on || !cfg.ui) return;
      tone({ f: 540, slide: 320, d: 0.12, type: "sine", g: 0.07 });
    },
    /* монетка */
    coin() {
      if (!cfg.on) return;
      tone({ f: 1320, d: 0.08, type: "square", g: 0.05 });
      tone({ f: 1760, t: 0.07, d: 0.15, type: "square", g: 0.05 });
    },
    /* победа — мажорное арпеджио вверх */
    win() {
      if (!cfg.on || !cfg.game) return;
      const N = [
        { f: 523.25, t: 0.00, d: 0.16, g: 0.15 },
        { f: 659.25, t: 0.11, d: 0.16, g: 0.15 },
        { f: 783.99, t: 0.22, d: 0.2,  g: 0.17 },
        { f: 1046.5, t: 0.34, d: 0.38, g: 0.18 }
      ];
      N.forEach(n => tone(Object.assign({ type: "triangle" }, n)));
      tone({ f: 1568, t: 0.42, d: 0.3, type: "sine", g: 0.06 });
    },
    /* поражение — нисходящее минорное движение */
    lose() {
      if (!cfg.on || !cfg.game) return;
      const N = [
        { f: 392.00, t: 0.00, d: 0.22, g: 0.12 },
        { f: 329.63, t: 0.18, d: 0.24, g: 0.11 },
        { f: 261.63, t: 0.38, d: 0.42, g: 0.1 }
      ];
      N.forEach(n => tone(Object.assign({ type: "sawtooth" }, n)));
    },
    /* звезда за урок: колокольчик, высота растёт с номером звезды (0, 1, 2) */
    star(i) {
      if (!cfg.on || !cfg.game) return;
      const f = [659.25, 830.61, 1046.5][Math.min(2, i | 0)];
      tone({ f, d: 0.55, type: "sine", g: 0.17 });
      tone({ f: f * 2, t: 0.015, d: 0.38, type: "triangle", g: 0.05 });
      tone({ f: f * 3, t: 0.03, d: 0.22, type: "sine", g: 0.025 });
    },
    /* блеск: несколько высоких «искр» */
    sparkle() {
      if (!cfg.on || !cfg.game) return;
      for (let k = 0; k < 5; k++) tone({ f: 1800 + Math.random() * 2000, t: k * 0.07, d: 0.16, type: "sine", g: 0.04 });
    },
    /* открытие награды: восходящий «вжух» + звон */
    unlock() {
      if (!cfg.on || !cfg.game) return;
      tone({ f: 280, slide: 1250, d: 0.45, type: "sine", g: 0.09 });
      tone({ f: 1318.5, t: 0.4, d: 0.5, type: "triangle", g: 0.1 });
      tone({ f: 1975.5, t: 0.44, d: 0.5, type: "sine", g: 0.05 });
    },
    /* большая фанфара — награда за блок */
    fanfare() {
      if (!cfg.on || !cfg.game) return;
      const N = [
        { f: 523.25, t: 0.00, d: 0.18 }, { f: 659.25, t: 0.12, d: 0.18 },
        { f: 783.99, t: 0.24, d: 0.18 }, { f: 1046.5, t: 0.36, d: 0.26 },
        { f: 783.99, t: 0.60, d: 0.14 }, { f: 1046.5, t: 0.72, d: 0.14 }
      ];
      N.forEach(n => tone(Object.assign({ type: "triangle", g: 0.17 }, n)));
      [523.25, 659.25, 783.99, 1046.5].forEach(f => tone({ f, t: 0.86, d: 1.1, type: "triangle", g: 0.1 }));
      tone({ f: 130.81, t: 0.86, d: 1.0, type: "sine", g: 0.12 });
      tone({ f: 2093, t: 0.9, d: 0.7, type: "sine", g: 0.04 });
    },
    /* ничья — два нейтральных тона */
    draw() {
      if (!cfg.on || !cfg.game) return;
      tone({ f: 440, d: 0.16, g: 0.12 });
      tone({ f: 440, t: 0.2, d: 0.22, g: 0.1 });
    }
  };

  /* ---------- автоматические хуки ---------- */
  function hook() {
    /* 1) клик по любой кнопке/карточке (capture — срабатывает даже если модуль остановил всплытие) */
    document.addEventListener("click", e => {
      const b = e.target && e.target.closest
        ? e.target.closest("button, .btn, .ctrl-btn, .mode-tab, .tier-tab, .shop-tab, .lang-btn, .level-card, .shop-card, .continue-card, .ms-item")
        : null;
      if (!b || b.disabled) return;
      api.click();
    }, true);

    /* 2) открытие любого модального окна — звук «открытия» */
    document.querySelectorAll(".modal").forEach(m => {
      let was = m.classList.contains("open");
      new MutationObserver(() => {
        const is = m.classList.contains("open");
        if (is && !was && m.id !== "result-modal") api.open();
        was = is;
      }).observe(m, { attributes: true, attributeFilter: ["class"] });
    });

    /* 3) результат партии: победа / поражение / ничья — по заголовку result-modal */
    const rm = document.getElementById("result-modal");
    const rt = document.getElementById("modal-title");
    if (rm && rt) {
      let was = rm.classList.contains("open");
      new MutationObserver(() => {
        const is = rm.classList.contains("open");
        if (is && !was) {
          setTimeout(() => {
            const s = (rt.textContent || "").toLowerCase();
            if (/ничь|draw/.test(s)) api.draw();
            else if (/пораж|defeat|lose|проигр|resign|сдал/i.test(s)) api.lose();
            else if (/побед|victor|win|won|great|отличн|красав/i.test(s)) api.win();
            else api.open();
          }, 60);
        }
        was = is;
      }).observe(rm, { attributes: true, attributeFilter: ["class"] });
    }

    /* 4) монеты: при УВЕЛИЧЕНИИ счётчика — звук монетки */
    const cc = document.getElementById("coin-count");
    if (cc) {
      let last = null;
      new MutationObserver(() => {
        const v = parseInt(cc.textContent, 10);
        if (isNaN(v)) return;
        if (last !== null && v > last) api.coin();
        last = v;
      }).observe(cc, { childList: true, characterData: true, subtree: true });
    }

    /* 5) смена вкладки — звук открытия */
    if (typeof UI !== "undefined" && UI.showView) {
      const orig = UI.showView.bind(UI);
      let first = true;
      UI.showView = function (name) {
        const had = !!document.querySelector(".view.active");
        orig(name);
        if (!first && had) api.open();
        first = false;
      };
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  else hook();

  return api;
})();