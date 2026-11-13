/* maper.chess — звук загрузочного экрана (WebAudio, без аудиофайлов).
   Рыцарь обходит доску — каждый его прыжок это нота «арфы» из минорной пентатоники, которая карабкается вверх,
   под ней мягко растёт тёмный «пад», на трети и двух третях пути — переливы, перед финалом — «райзер»,
   а когда доска собрана — яркий аккорд (мажорная «тьерс де Пикарди») с басовым ударом и эхом.
   Подключается ПЕРЕД inline-скриптом прелоадера в index.html. Уважает настройки звука (localStorage "mapchess_sfx_v1").
   Браузеры не дают играть звук до первого касания: тогда внизу появляется подсказка «Коснись экрана»,
   а после касания звук включается сразу — даже посреди загрузки. */
(function () {
  "use strict";

  var cfg = { on: true, vol: 0.7, game: true };
  try { var saved = JSON.parse(localStorage.getItem("mapchess_sfx_v1") || "{}"); for (var k in saved) cfg[k] = saved[k]; } catch (e) {}
  var enabled = !!cfg.on && cfg.game !== false;
  var vol = Math.max(0.05, Math.min(1, +cfg.vol || 0.7));

  var ctx = null, dry = null, rev = null, dly = null, noiseBuf = null, pad = null;
  var lastNote = 0, lastTick = 0, closed = false, unlockedPlayed = false;

  /* A минорная пентатоника: A C D E G, от A3 вверх */
  var SCALE = [0, 3, 5, 7, 10];
  function freq(n) { return 220 * Math.pow(2, (12 * Math.floor(n / 5) + SCALE[n % 5]) / 12); }

  function build() {
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    var master = ctx.createGain();
    master.gain.value = 0.9 * vol;
    var soft = ctx.createBiquadFilter();                // мягкий верх: не «звенит» в ушах
    soft.type = "lowpass"; soft.frequency.value = 7000; soft.Q.value = 0.4;
    master.connect(soft); soft.connect(comp); comp.connect(ctx.destination);

    dry = ctx.createGain(); dry.gain.value = 1; dry.connect(master);

    /* реверб: затухающий шум, сгенерированный на лету */
    var len = Math.floor(ctx.sampleRate * 1.7), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    var conv = ctx.createConvolver(); conv.buffer = ir;
    rev = ctx.createGain(); rev.gain.value = 1;
    rev.connect(conv);
    var wet = ctx.createGain(); wet.gain.value = 0.5;
    conv.connect(wet); wet.connect(master);

    /* эхо с затухающим тёмным повтором */
    var dl = ctx.createDelay(1); dl.delayTime.value = 0.22;
    var fb = ctx.createGain(); fb.gain.value = 0.32;
    var dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2400;
    dl.connect(dlp); dlp.connect(fb); fb.connect(dl);
    var dw = ctx.createGain(); dw.gain.value = 0.55;
    dlp.connect(dw); dw.connect(master); dw.connect(rev);
    dly = dl;
  }

  function ensure() {
    if (!enabled || closed) return null;
    if (!ctx) {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) { enabled = false; return null; }
      try { ctx = new A(); build(); } catch (e) { enabled = false; ctx = null; return null; }
    }
    return ctx;
  }

  /* подключить источник: сухо + (по желанию) в реверб и эхо */
  function route(node, rv, dl) {
    node.connect(dry);
    if (rv) { var g = ctx.createGain(); g.gain.value = rv; node.connect(g); g.connect(rev); }
    if (dl) { var h = ctx.createGain(); h.gain.value = dl; node.connect(h); h.connect(dly); }
  }

  function noise() {
    if (!noiseBuf) {
      var n = Math.floor(ctx.sampleRate * 1.2), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
      for (var i = 0; i < n; i++) { last = last * 0.5 + (Math.random() * 2 - 1) * 0.5; d[i] = last; }
      noiseBuf = b;
    }
    return noiseBuf;
  }

  /* щипок «арфы»: тёплый треугольник + октава, фильтр закрывается по мере затухания */
  function pluck(f, g, t, d, rv, dl) {
    var t0 = ctx.currentTime + (t || 0);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(Math.min(f * 8, 7500), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 300), t0 + d * 0.7);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    var o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.003;
    var g2 = ctx.createGain(); g2.gain.value = 0.32;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(env);
    route(env, rv, dl);
    o1.start(t0); o2.start(t0); o1.stop(t0 + d + 0.05); o2.stop(t0 + d + 0.05);
  }

  /* маленький деревянный «тук» — стук фигуры по доске */
  function tick(g, t, p) {
    var t0 = ctx.currentTime + (t || 0);
    var s = ctx.createBufferSource(); s.buffer = noise();
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700 * (p || 1); bp.Q.value = 0.9;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t0 + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    s.connect(bp); bp.connect(ng); route(ng, 0.12, 0);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + 0.06);
    var o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(240 * (p || 1), t0);
    o.frequency.exponentialRampToValueAtTime(140 * (p || 1), t0 + 0.07);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(Math.max(0.0002, g * 1.1), t0 + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    o.connect(og); route(og, 0.1, 0);
    o.start(t0); o.stop(t0 + 0.14);
  }

  /* «вжух»: шум, по которому едет полосовой фильтр */
  function sweep(t, d, f0, f1, g) {
    var t0 = ctx.currentTime + (t || 0);
    var s = ctx.createBufferSource(); s.buffer = noise();
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(f1, t0 + d);
    var e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t0 + d * 0.85);
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.08);
    s.connect(bp); bp.connect(e); route(e, 0.35, 0.1);
    s.start(t0, Math.random() * 0.4); s.stop(t0 + d + 0.12);
  }

  /* тёмный пад: квинта + октава, фильтр раскрывается вместе с прогрессом */
  function startPad() {
    if (pad || !ctx) return;
    var t0 = ctx.currentTime;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 1.2; lp.frequency.value = 260;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 1.4);
    var oscs = [[55, 0], [82.41, 4], [110, -5], [164.81, 3]].map(function (v) {
      var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = v[0]; o.detune.value = v[1];
      var og = ctx.createGain(); og.gain.value = v[0] > 100 ? 0.45 : 1;
      o.connect(og); og.connect(lp); o.start(t0); return o;
    });
    lp.connect(g); route(g, 0.4, 0);
    pad = { lp: lp, g: g, oscs: oscs };
  }
  function stopPad(rel) {
    if (!pad) return;
    var p = pad, t = ctx.currentTime;
    pad = null;
    try {
      p.g.gain.cancelScheduledValues(t);
      p.g.gain.setValueAtTime(Math.max(0.0002, p.g.gain.value), t);
      p.g.gain.exponentialRampToValueAtTime(0.0001, t + rel);
      p.oscs.forEach(function (o) { o.stop(t + rel + 0.05); });
    } catch (e) {}
  }

  /* ---------- подсказка «коснись экрана» и разблокировка звука ---------- */
  function hint(show) {
    var el = document.getElementById("pl-snd");
    if (el) el.classList.toggle("show", !!show);
  }
  function unlocked() {
    hint(false);
    if (unlockedPlayed || !ctx || closed) return;
    unlockedPlayed = true;
    pluck(freq(5), 0.06, 0, 0.5, 0.4, 0.3);
    pluck(freq(8), 0.06, 0.09, 0.6, 0.4, 0.3);
  }
  function arm() {
    var evs = ["pointerdown", "touchstart", "mousedown", "keydown", "click"];
    var f = function () {
      var c = ensure();
      if (!c) return;
      if (c.state === "running") { evs.forEach(function (e) { document.removeEventListener(e, f, true); }); unlocked(); return; }
      c.resume().then(function () {
        if (c.state === "running") { evs.forEach(function (e) { document.removeEventListener(e, f, true); }); unlocked(); }
      }).catch(function () {});
    };
    evs.forEach(function (e) { document.addEventListener(e, f, true); });
  }
  function running() { return !!ctx && ctx.state === "running" && !closed; }

  var api = {
    /* прыжок рыцаря: i — сколько клеток пройдено (1..64), p — прогресс 0..1 */
    step: function (i, p) {
      var c = ensure(); if (!c) return;
      if (c.state !== "running") { c.resume().catch(function () {}); return; }
      startPad();
      var now = c.currentTime;
      if (pad) pad.lp.frequency.setTargetAtTime(260 + p * 2100, now, 0.12);
      if (now - lastNote < 0.028) return;
      lastNote = now;
      var pat = [0, 2, 1, 3];
      var n = Math.floor(i * 0.2) + pat[i % 4];                       // арпеджио, ползущее вверх
      pluck(freq(n), 0.046 + 0.01 * Math.sin(i * 1.7), 0, 0.42, 0.28, 0.2);
      if (i % 2 === 0 && now - lastTick > 0.05) { lastTick = now; tick(0.11 + Math.random() * 0.04, 0, 0.9 + Math.random() * 0.2); }
    },
    /* переход на следующий этап (n = 1 или 2): переливы + короткий «вжух» */
    stage: function (n) {
      var c = ensure(); if (!running()) return;
      var b = 7 + n * 3;
      sweep(0, 0.28, 500, 3200, 0.05);
      pluck(freq(b), 0.07, 0.05, 0.9, 0.5, 0.35);
      pluck(freq(b + 2), 0.06, 0.12, 0.9, 0.5, 0.35);
      pluck(freq(b + 4), 0.05, 0.19, 1.1, 0.5, 0.35);
    },
    /* нарастание перед финалом */
    riser: function () {
      if (!ensure() || !running()) return;
      sweep(0, 0.42, 300, 5200, 0.09);
      var t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(880, t0 + 0.4);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.46);
      o.connect(g); route(g, 0.3, 0); o.start(t0); o.stop(t0 + 0.5);
    },
    /* финал: доска собрана — яркий мажорный аккорд, бас-удар, блёстки */
    finale: function () {
      if (!ensure() || !running()) return;
      var t = 0.02;
      stopPad(1.6);
      tick(0.28, t, 0.8);                                             // последний «тук» фигуры
      /* бас-удар: падающий синус */
      var t0 = ctx.currentTime + t, ob = ctx.createOscillator(), og = ctx.createGain();
      ob.type = "sine"; ob.frequency.setValueAtTime(120, t0); ob.frequency.exponentialRampToValueAtTime(55, t0 + 0.16);
      og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.26, t0 + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
      ob.connect(og); route(og, 0.2, 0); ob.start(t0); ob.stop(t0 + 1.4);
      /* аккорд A мажор (A3 E4 A4 C#5 E5) — «строй» с лёгкой раскладкой */
      [220, 329.63, 440, 554.37, 659.25].forEach(function (f, i) { pluck(f, 0.07 - i * 0.004, t + i * 0.045, 1.9, 0.55, 0.3); });
      /* блёстки сверху */
      [1318.5, 1760, 2217.5, 2637].forEach(function (f, i) { pluck(f, 0.022, t + 0.12 + i * 0.07, 0.9, 0.6, 0.45); });
      sweep(t, 0.7, 6000, 1400, 0.035);
    },
    /* загрузочный экран закрывается — освобождаем аудиоконтекст */
    end: function () {
      closed = true;
      if (!ctx) return;
      var c = ctx;
      stopPad(0.4);
      hint(false);
      setTimeout(function () { try { c.close(); } catch (e) {} }, 3200);
    }
  };

  window.PlSound = api;

  if (enabled) {
    ensure();
    arm();
    /* если через полсекунды звук всё ещё заблокирован браузером — подсказываем коснуться экрана */
    setTimeout(function () { if (!closed && ctx && ctx.state !== "running") hint(true); }, 500);
  }
})();
