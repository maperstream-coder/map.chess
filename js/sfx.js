/* maper.chess — звуковые эффекты (WebAudio, без аудиофайлов).
   Звуки: клик по кнопке, открытие окна/вкладки, победа, поражение, ничья, монеты.
   Конец партии: Sfx.result("win"|"loss"|"draw"|"solved"|"fail") — мягкие джинглы с лёгкой реверберацией.
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

  /* ---------- шахматные звуки: мягкий деревянный «тук» ----------
     Синтез без файлов: короткий шумовой щелчок (удар о доску) + низкий «корпус» с быстрым падением тона
     + тёплый деревянный обертон. Общая шина с мягким фильтром и компрессором — звук ровный и не режет слух.
     Лёгкий случайный разброс высоты, чтобы подряд идущие ходы не звучали как копия. */
  let bus = null, busCtx = null, noiseBuf = null;
  function out(c) {
    if (!bus || busCtx !== c) {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 5200; lp.Q.value = 0.5;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 20; comp.ratio.value = 3; comp.attack.value = 0.002; comp.release.value = 0.12;
      lp.connect(comp); comp.connect(c.destination);
      bus = lp; busCtx = c; noiseBuf = null;
    }
    return bus;
  }
  function noise(c) {
    if (!noiseBuf) {
      const n = Math.floor(c.sampleRate * 0.25), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) { last = last * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = last; }   // чуть «приглушённый» шум
      noiseBuf = b;
    }
    return noiseBuf;
  }
  function knock(o) {
    const c = ac();
    if (!c) return;
    try {
      const dst = out(c);
      const t0 = c.currentTime + (o.t || 0) + 0.004;
      const v = Math.max(0.0002, cfg.vol) * (o.g == null ? 1 : o.g);
      const p = (o.p || 1) * (1 + (Math.random() - 0.5) * 0.07);

      /* 1. щелчок удара */
      const src = c.createBufferSource(); src.buffer = noise(c);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = (o.click || 1900) * p; bp.Q.value = 0.9;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.30 * v), t0 + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.nd || 0.032));
      src.connect(bp).connect(ng).connect(dst);
      src.start(t0); src.stop(t0 + 0.08);

      /* 2. корпус: низкий тон, быстро «проседающий» */
      const f0 = (o.body || 240) * p;
      const ob = c.createOscillator(); ob.type = "sine";
      ob.frequency.setValueAtTime(f0, t0);
      ob.frequency.exponentialRampToValueAtTime(f0 * 0.6, t0 + 0.085);
      const bg = c.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.42 * v), t0 + 0.004);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.d || 0.11));
      ob.connect(bg).connect(dst);
      ob.start(t0); ob.stop(t0 + (o.d || 0.11) + 0.05);

      /* 3. дерево: короткий тёплый обертон */
      const ow = c.createOscillator(); ow.type = "triangle";
      ow.frequency.setValueAtTime(f0 * 2.7, t0);
      ow.frequency.exponentialRampToValueAtTime(f0 * 2.2, t0 + 0.05);
      const wg = c.createGain();
      wg.gain.setValueAtTime(0.0001, t0);
      wg.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.10 * v), t0 + 0.003);
      wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
      ow.connect(wg).connect(dst);
      ow.start(t0); ow.stop(t0 + 0.1);
    } catch (e) {}
  }
  /* тихий колокольчик для «шаха» / «превращения» — через общую шину, очень мягкий */
  function chime(f, t, d, g) {
    const c = ac();
    if (!c) return;
    try {
      const dst = out(c), t0 = c.currentTime + t;
      const o = c.createOscillator(), gn = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f, t0);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, g * cfg.vol), t0 + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(gn).connect(dst);
      o.start(t0); o.stop(t0 + d + 0.05);
    } catch (e) {}
  }

  /* ---------- джинглы конца партии ----------
     Отдельная шина с мягким «залом» (свёртка с синтезированным откликом), срезом верхов и компрессором:
     звук тёплый, без резких пиков. Колокольчик = чистый тон + два короткоживущих обертона (как металлофон). */
  let jb = null, jbCtx = null;
  function impulse(c, sec, decay) {
    const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }
  function jingleBus(c) {
    if (!jb || jbCtx !== c) {
      const input = c.createGain();
      const dry = c.createGain(); dry.gain.value = 0.92;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6800; lp.Q.value = 0.4;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -22; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
      let conv = null;
      try { conv = c.createConvolver(); conv.buffer = impulse(c, 1.7, 3.2); } catch (e) { conv = null; }
      input.connect(dry); dry.connect(lp);
      if (conv) { const wet = c.createGain(); wet.gain.value = 0.3; input.connect(conv); conv.connect(wet); wet.connect(lp); }
      lp.connect(comp); comp.connect(c.destination);
      jb = input; jbCtx = c;
    }
    return jb;
  }
  /* один мягкий тон: o = { f, t, d, g, type, att, lp, slide } */
  function pad(o) {
    const c = ac();
    if (!c) return;
    try {
      const dst = jingleBus(c), t0 = c.currentTime + (o.t || 0) + 0.01, att = o.att || 0.02;
      const peak = Math.max(0.0002, (o.g || 0.1) * cfg.vol);
      const osc = c.createOscillator(); osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.f, t0);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + o.d);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
      let node = osc;
      if (o.lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
      node.connect(g); g.connect(dst);
      osc.start(t0); osc.stop(t0 + o.d + 0.05);
    } catch (e) {}
  }
  function bell(f, t, d, g) {
    pad({ f, t, d, g, type: "sine", att: 0.006 });
    pad({ f: f * 2, t, d: d * 0.5, g: g * 0.32, type: "sine", att: 0.004 });
    pad({ f: f * 4.01, t, d: d * 0.22, g: g * 0.1, type: "sine", att: 0.003 });
  }

  const gameOn = () => cfg.on && cfg.game;
  let lastResultAt = 0;

  const api = {
    get config() { return cfg; },
    save,

    /* ---------- звуки шахматных ходов (o = { delay: секунды, opp: ход соперника }) ---------- */
    /* обычный ход: фигура ставится на деревянную доску */
    move(o) {
      if (!gameOn()) return; o = o || {};
      knock({ t: o.delay, p: o.opp ? 0.93 : 1, g: o.opp ? 0.88 : 1 });
    },
    /* взятие: удар плотнее и ниже + короткий второй «стук» сбитой фигуры */
    capture(o) {
      if (!gameOn()) return; o = o || {};
      const p = o.opp ? 0.93 : 1, g = o.opp ? 0.9 : 1;
      knock({ t: o.delay, p: p * 0.9, g: 1.12 * g, body: 210, click: 1500, nd: 0.05, d: 0.14 });
      knock({ t: (o.delay || 0) + 0.05, p: p * 1.15, g: 0.45 * g, body: 300, click: 2300, d: 0.07 });
    },
    /* рокировка: два тука подряд — король и ладья */
    castle(o) {
      if (!gameOn()) return; o = o || {};
      const p = o.opp ? 0.93 : 1;
      knock({ t: o.delay, p: p, g: 0.95 });
      knock({ t: (o.delay || 0) + 0.12, p: p * 1.08, g: 0.85 });
    },
    /* шах: ход + тихий двойной «звоночек» */
    check(o) {
      if (!gameOn()) return; o = o || {};
      knock({ t: o.delay, p: o.opp ? 0.93 : 1, g: 1.05 });
      const t = (o.delay || 0) + 0.07;
      chime(784, t, 0.32, 0.05);
      chime(1175, t + 0.06, 0.4, 0.04);
    },
    /* превращение пешки: ход + мягкий подъём */
    promote(o) {
      if (!gameOn()) return; o = o || {};
      knock({ t: o.delay, p: o.opp ? 0.93 : 1 });
      const t = (o.delay || 0) + 0.08;
      chime(659, t, 0.2, 0.04);
      chime(880, t + 0.07, 0.22, 0.04);
      chime(1319, t + 0.14, 0.34, 0.04);
    },
    /* выбор фигуры: едва слышный лёгкий «тик» */
    select() {
      if (!gameOn()) return;
      knock({ p: 1.35, g: 0.32, body: 330, click: 2700, nd: 0.02, d: 0.05 });
    },

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
    /* победа: светлое мажорное арпеджио колокольчиками → тёплый аккорд, который «раскрывается» и тает;
       short — укороченная версия (решённая задача, мелкие события) */
    win(o) {
      if (!cfg.on || !cfg.game) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, i * 0.1, 0.95, 0.15));
      if (o && o.short) { bell(1318.5, 0.42, 1.0, 0.11); return; }
      [261.63, 329.63, 392.0, 523.25].forEach(f => pad({ f, t: 0.4, d: 1.7, g: 0.065, type: "triangle", att: 0.12, lp: 2200 }));
      pad({ f: 130.81, t: 0.4, d: 1.7, g: 0.09, type: "sine", att: 0.1 });
      bell(1318.5, 0.48, 1.2, 0.1);
      bell(1568.0, 0.58, 1.3, 0.085);
      bell(2093.0, 0.70, 1.5, 0.06);
    },
    /* поражение: тихий низкий «выдох» и спокойное нисходящее ре-минорное арпеджио, без резкости и насмешки */
    lose() {
      if (!cfg.on || !cfg.game) return;
      pad({ f: 118, slide: 58, t: 0, d: 0.55, g: 0.18, type: "sine", att: 0.012 });
      [440.0, 349.23, 293.66, 220.0].forEach((f, i) => pad({ f, t: 0.06 + i * 0.3, d: 0.95, g: 0.1, type: "triangle", att: 0.045, lp: 1500 }));
      [146.83, 174.61, 220.0].forEach(f => pad({ f, t: 1.28, d: 1.7, g: 0.075, type: "triangle", att: 0.16, lp: 950 }));
    },
    /* ничья: два ровных колокольчика на расстоянии квинты и открытая квинта, которая спокойно тает (ни светло, ни грустно) */
    draw() {
      if (!cfg.on || !cfg.game) return;
      bell(440.0, 0, 1.0, 0.13);
      bell(659.25, 0.22, 1.1, 0.12);
      [220.0, 329.63, 440.0].forEach(f => pad({ f, t: 0.46, d: 1.4, g: 0.06, type: "triangle", att: 0.16, lp: 1800 }));
    },
    /* неудачная попытка в задаче: короткий мягкий спад */
    miss() {
      if (!cfg.on || !cfg.game) return;
      pad({ f: 392.0, t: 0, d: 0.4, g: 0.1, type: "triangle", att: 0.03, lp: 1500 });
      pad({ f: 311.13, t: 0.16, d: 0.6, g: 0.09, type: "triangle", att: 0.04, lp: 1300 });
    },
    /* единая точка для конца партии/задачи: win | loss | draw | solved | fail.
       Защита от двойного звука (оверлей + окно результата + хук режима срабатывают почти одновременно) */
    result(type, delay) {
      if (!cfg.on || !cfg.game) return;
      const now = Date.now();
      if (now - lastResultAt < 2500) return;
      lastResultAt = now;
      const run = () => {
        if (type === "win") api.win();
        else if (type === "solved") api.win({ short: true });
        else if (type === "draw") api.draw();
        else if (type === "fail") api.miss();
        else api.lose();
      };
      /* небольшая пауза: сначала дослушать «стук» последнего хода */
      setTimeout(run, delay == null ? 420 : delay);
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
  };

  /* ---------- автоматические хуки ---------- */
  function hook() {
    /* 1) клик по любой кнопке/карточке (capture — срабатывает даже если модуль остановил всплытие) */
    document.addEventListener("click", e => {
      const b = e.target && e.target.closest
        ? e.target.closest("button, .btn, .ctrl-btn, .mode-tab, .tier-tab, .shop-tab, .lang-btn, .level-card, .shop-card, .continue-card, .ms-item")
        : null;
      if (!b || b.disabled) return;
      if (b.classList.contains("sq")) return;     // клетки доски: звук даёт сам ход (board.js), а не «пузырёк» кнопки
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

    /* 3) конец партии/задачи — главный путь: оверлей результата (FX) и дуэль с другом.
       sfx.js грузится ПОСЛЕ fx.js, поэтому здесь FX уже есть */
    if (typeof FX !== "undefined" && FX) {
      if (FX.play) {
        const _play = FX.play.bind(FX);
        FX.play = function (type) { try { api.result(type); } catch (e) {} return _play(type); };
      }
      if (FX.duel) {
        const _duel = FX.duel;
        FX.duel = function (o) { try { api.result(o && o.type === "win" ? "win" : o && o.type === "draw" ? "draw" : "loss", 520); } catch (e) {} return _duel.apply(this, arguments); };
      }
    }

    /* 3б) запасной путь: окно результата (партии, где FX не вызывается, например «Фишер» против бота) */
    const rm = document.getElementById("result-modal");
    const rt = document.getElementById("modal-title");
    if (rm && rt) {
      let was = rm.classList.contains("open");
      new MutationObserver(() => {
        const is = rm.classList.contains("open");
        if (is && !was) {
          setTimeout(() => {
            const s = (rt.textContent || "").toLowerCase();
            if (/ничь|draw/.test(s)) api.result("draw", 0);
            else if (/пораж|defeat|checkmated|^мат|lose|lost|проигр|resign|сдал/i.test(s)) api.result("loss", 0);
            else if (/побед|victor|win|won|solved|решен|great|отличн|красав/i.test(s)) api.result("win", 0);
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