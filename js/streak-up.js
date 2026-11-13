/* =====================================================================
   maper.chess — streak-up.js
   «Повышение огонька»: когда серия выросла (recordActivity вернул first:true), поверх всего
   показывается короткая церемония:
     • огонёк вспыхивает, число дней прокручивается как одометр;
     • внутри пламени — фигура ранга: Пешка → Конь → Слон → Ладья → Ферзь → Король
       (смена фигуры = «превращение пешки», как в шахматах);
     • искра перепрыгивает в сегодняшнюю клетку недели;
     • в конце огонёк и монеты «улетают» в счётчики в шапке сайта.

   Подключать ПОСЛЕ js/home-deco.js (там window.Flame) и js/fx.js; css/streak-up.css — после home-deco.css.
   Ничего не меняет в логике серии: только оборачивает recordActivity и рисует поверх.

   Для отладки в консоли:  StreakUp.preview(2, 3)   // с 2-го на 3-й день (Пешка → Конь)
   ===================================================================== */
(function () {
  "use strict";
  if (window.StreakUp) return;

  var $ = function (id) { return document.getElementById(id); };
  var reduced = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };

  /* ---------- тексты ---------- */
  (function () {
    if (typeof I18N === "undefined") return;
    Object.assign(I18N.en, {
      "su.light": "Flame lit", "su.day": "Streak continues", "su.milestone": "Milestone reached", "su.tier": "Flame promoted",
      "su.go": "Continue", "su.reward": "Reward for {n} days", "su.aria": "{name}: {n} days in a row",
      "su.t1": "Smoldering flame", "su.t2": "Lively flame", "su.t3": "Radiant flame", "su.t4": "Roaring flame", "su.t5": "Royal flame", "su.t6": "Eternal flame",
      "su.p1": "Pawn", "su.p2": "Knight", "su.p3": "Bishop", "su.p4": "Rook", "su.p5": "Queen", "su.p6": "King"
    });
    Object.assign(I18N.ru, {
      "su.light": "Огонёк зажжён", "su.day": "Серия продолжается", "su.milestone": "Рубеж взят", "su.tier": "Огонёк повышен",
      "su.go": "Дальше", "su.reward": "Награда за {n} дн.", "su.aria": "{name}: {n} дн. подряд",
      "su.t1": "Тлеющий огонёк", "su.t2": "Живой огонёк", "su.t3": "Яркий огонёк", "su.t4": "Неукротимый огонёк", "su.t5": "Королевский огонёк", "su.t6": "Вечный огонёк",
      "su.p1": "Пешка", "su.p2": "Конь", "su.p3": "Слон", "su.p4": "Ладья", "su.p5": "Ферзь", "su.p6": "Король"
    });
  })();
  var T = function (k, v) { return typeof t === "function" ? t(k, v) : k; };

  /* ---------- ранги ---------- */
  var TIERS = [
    { min: 1,   type: "p", glyph: "\u265F" },
    { min: 3,   type: "n", glyph: "\u265E" },
    { min: 7,   type: "b", glyph: "\u265D" },
    { min: 14,  type: "r", glyph: "\u265C" },
    { min: 30,  type: "q", glyph: "\u265B" },
    { min: 100, type: "k", glyph: "\u265A" }
  ];
  function tierIdx(n) { var k = 0; for (var i = 0; i < TIERS.length; i++) if (n >= TIERS[i].min) k = i; return k; }
  function milestones() { return (typeof STREAK_CONFIG !== "undefined" && STREAK_CONFIG.milestones) || {}; }
  function msList() { return Object.keys(milestones()).map(Number).sort(function (a, b) { return a - b; }); }

  /* прогресс до следующей награды — та же логика, что у полоски на главной (home-deco.js: goalHtml) */
  function goalOf(n) {
    var ms = msList(), next = null, prev = 0, i;
    for (i = 0; i < ms.length; i++) { if (ms[i] > n) { next = ms[i]; break; } prev = ms[i]; }
    if (!next) return { pct: 100, next: null };
    return { pct: Math.max(4, Math.min(100, Math.round((n - prev) / (next - prev) * 100))), next: next };
  }

  /* ---------- мелкие помощники ---------- */
  function pieceHtml(i, color) {
    var T0 = TIERS[i];
    try { if (window.pieceSvg) { var s = window.pieceSvg(color, T0.type); if (s) return s; } } catch (e) { /* упадём на глиф */ }
    return '<span class="su-gl" data-no-ic style="font-family:\'Segoe UI Symbol\',\'Noto Sans Symbols 2\',\'DejaVu Sans\',serif">' + T0.glyph + "&#xFE0E;</span>";
  }
  function flameHtml() { return (window.Flame && window.Flame.svg) ? '<i class="flame">' + window.Flame.svg() + "</i>" : '<i class="flame">\uD83D\uDD25</i>'; }
  function snowHtml() { return (window.Flame && window.Flame.snow) || "\u2744"; }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lettersHtml(s) { return Array.from(s).map(function (c, i) { return '<span style="--i:' + i + '">' + esc(c) + "</span>"; }).join(""); }

  function odometer(from, to) {
    var a = String(from), b = String(to), len = Math.max(a.length, b.length), h = "", i;
    a = a.padStart(len, " "); b = b.padStart(len, " ");
    for (i = 0; i < len; i++) {
      if (a[i] === b[i]) h += '<span class="su-d"><b>' + (b[i] === " " ? "&nbsp;" : b[i]) + "</b></span>";
      else h += '<span class="su-d roll"><em><b>' + (a[i] === " " ? "&nbsp;" : a[i]) + "</b><b>" + (b[i] === " " ? "&nbsp;" : b[i]) + "</b></em></span>";
    }
    return h;
  }

  function weekData(cfg) {
    if (cfg.week && cfg.week.length === 7) return cfg.week;
    var out = [], today = dayKey(), i, key;                 // синтетическая неделя для превью
    for (i = 6; i >= 0; i--) { key = addDays(today, -i); out.push({ key: key, isToday: i === 0, status: i === 0 ? "done" : (i <= cfg.prev ? "done" : "empty") }); }
    return out;
  }
  function weekHtml(cfg) {
    var loc = (typeof getLang === "function" && getLang() === "ru") ? "ru-RU" : "en-US";
    return weekData(cfg).map(function (d) {
      var label = keyToDate(d.key).toLocaleDateString(loc, { weekday: "short" }).slice(0, 2);
      var inner = d.isToday ? flameHtml().replace('class="flame"', 'class="flame flame-wd"')
        : d.status === "done" ? flameHtml().replace('class="flame"', 'class="flame flame-wd"')
        : d.status === "frozen" ? snowHtml() : "";
      return '<div class="su-wd' + (d.isToday ? " today" : "") + '"><i>' + esc(label) + '</i><span class="su-sq">' + inner + "</span></div>";
    }).join("");
  }

  /* ---------- сборка DOM ---------- */
  function build(cfg) {
    var root = document.createElement("div");
    root.className = "su" + (cfg.kind === "light" ? " pre-off" : "");
    root.dataset.tier = String((cfg.kind === "tier" ? cfg.prevTier : cfg.tier) + 1);
    root.dataset.kind = cfg.kind;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", T("su.aria", { name: T("su.t" + (cfg.tier + 1)), n: cfg.count }));

    var eyebrowKey = cfg.kind === "tier" ? "su.tier" : cfg.kind === "light" ? "su.light" : cfg.kind === "milestone" ? "su.milestone" : "su.day";
    var startTier = cfg.kind === "tier" ? cfg.prevTier : cfg.tier;
    var pcs = '<i class="su-pc cur">' + pieceHtml(startTier, "b") + "</i>" + (cfg.kind === "tier" ? '<i class="su-pc new">' + pieceHtml(cfg.tier, "b") + "</i>" : "");
    var ladder = TIERS.map(function (x, i) {
      var cls = i < startTier ? " done" : i === startTier ? " now" : "";
      return '<div class="su-pip' + cls + '" data-i="' + i + '"><span class="pp">' + pieceHtml(i, "w") + "</span><small>" + x.min + "</small></div>";
    }).join("");

    root.innerHTML =
      '<div class="su-scrim"></div><div class="su-board"></div>' +
      '<div class="su-stage">' +
        '<p class="su-eyebrow">' + esc(T(eyebrowKey)) + "</p>" +
        '<div class="su-emblem"><div class="su-emblem-in">' +
          '<div class="su-rays"></div><div class="su-halo"></div>' +
          '<svg class="su-ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="su-ring-bg" cx="100" cy="100" r="90"/><circle class="su-ring-fg" cx="100" cy="100" r="90" pathLength="100"/></svg>' +
          '<div class="su-shock"></div><div class="su-shock s2"></div>' +
          '<div class="su-parts"></div>' +
          '<div class="su-flame"><div class="su-flame-k">' + flameHtml() + "</div></div>" +
          '<div class="su-piece">' + pcs + "</div>" +
        "</div></div>" +
        '<div class="su-count"><div class="su-digits" aria-hidden="true">' + odometer(cfg.prev, cfg.count) + '</div><div class="su-unit">' + esc(T("streak.days", { n: cfg.count })) + "</div></div>" +
        '<h2 class="su-tier">' + lettersHtml(T("su.t" + (startTier + 1))) + "</h2>" +
        '<div class="su-ladder">' + ladder + "</div>" +
        '<div class="su-week">' + weekHtml(cfg) + "</div>" +
        '<div class="su-chips"></div>' +
        '<p class="su-goal"></p>' +
        '<button type="button" class="btn btn-primary su-go">' + esc(T("su.go")) + "</button>" +
      "</div>";
    return root;
  }

  /* ---------- частицы ---------- */
  function embers(root, n, o) {
    o = o || {};
    var box = root.querySelector(".su-parts"), i, s, a, d, e;
    for (i = 0; i < n; i++) {
      e = document.createElement("i"); e.className = "su-em" + (o.amb ? " amb" : "");
      a = (-90 + (Math.random() * 2 - 1) * (o.spread || 70)) * Math.PI / 180;
      d = (o.min || 50) + Math.random() * (o.max || 120);
      s = 2 + Math.random() * (o.size || 4);
      e.style.cssText = "--s:" + s.toFixed(1) + "px;--x:" + (Math.cos(a) * d).toFixed(0) + "px;--y:" + (Math.sin(a) * d - (o.lift || 0)).toFixed(0) + "px;--t:" +
        (o.amb ? 2.6 + Math.random() * 2 : 0.9 + Math.random() * 0.9).toFixed(2) + "s;--d:" + (Math.random() * (o.amb ? 3 : 0.25)).toFixed(2) + "s";
      box.appendChild(e);
      if (!o.amb) (function (el) { setTimeout(function () { el.remove(); }, 2200); })(e);
    }
  }
  function shock(root, idx) {
    var el = root.querySelectorAll(".su-shock")[idx || 0]; if (!el) return;
    el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
  }
  function burst(root, n, power) {
    try {
      if (!window.Celebrate || !Celebrate.burst) return;
      var r = root.querySelector(".su-emblem").getBoundingClientRect();
      Celebrate.burst(r.left + r.width / 2, r.top + r.height * 0.5, { n: n, power: power });
    } catch (e) { /* украшение, не критично */ }
  }
  function sfx(name) { try { if (typeof Sfx !== "undefined" && Sfx[name]) Sfx[name](); } catch (e) { /* без звука */ } }
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* не везде есть */ } }

  /* ---------- очередь и ожидание свободного экрана ---------- */
  var queue = [], active = false, hold = null;

  function busy() {
    return document.hidden || !!document.querySelector(".fx-overlay.show, .dfx.show, .cx.on");
  }
  function whenClear(fn) {
    var t0 = Date.now();
    (function tick() {
      var waited = Date.now() - t0;
      if (waited > 650 && (!busy() || waited > 6500)) return fn();
      setTimeout(tick, 120);
    })();
  }

  /* пока идёт церемония, в шапке показываем «старое» число: оно тикнет, когда огонёк туда прилетит */
  function holdPill(cfg) {
    var pill = $("streak-pill"), cnt = $("streak-count");
    if (!pill || !cnt || hold) return;
    hold = { pill: pill, cnt: cnt, count: cfg.count };
    cnt.textContent = cfg.prev; pill.classList.remove("active");
    hold.safety = setTimeout(releasePill, 14000);
  }
  function releasePill() {
    if (!hold) return;
    clearTimeout(hold.safety);
    hold.cnt.textContent = hold.count; hold.pill.classList.add("active");
    hold = null;
  }
  function pulse(el) { if (!el) return; el.classList.remove("su-pulse"); void el.offsetWidth; el.classList.add("su-pulse"); setTimeout(function () { el.classList.remove("su-pulse"); }, 900); }

  /* ---------- сама церемония ---------- */
  function run(cfg, done) {
    var rm = reduced();
    var root = build(cfg), timers = [], finished = false, closing = false, autoTimer = null;
    var ringFg = root.querySelector(".su-ring-fg");
    var flameK = root.querySelector(".su-flame-k");
    var goal = goalOf(cfg.count), goalPrev = goalOf(cfg.prev);
    var isMs = !!milestones()[cfg.count];
    var $r = function (s) { return root.querySelector(s); };
    var at = function (ms, fn) { timers.push(setTimeout(fn, rm ? Math.min(ms, 60) : ms)); };

    function setRing(p, instant) {
      if (instant) { ringFg.style.transition = "none"; }
      ringFg.style.strokeDashoffset = String(100 - p);
      if (instant) { void ringFg.offsetWidth; ringFg.style.transition = ""; }
    }
    function kick() { flameK.classList.remove("kick", "squeeze"); void flameK.offsetWidth; flameK.classList.add("kick"); }
    function showTier(idx) {
      var h = $r(".su-tier"); h.innerHTML = lettersHtml(T("su.t" + (idx + 1))); h.classList.remove("show"); void h.offsetWidth; h.classList.add("show");
    }
    function ringFull() {
      root.classList.add("s-full"); shock(root, 1);
      at(750, function () { root.classList.remove("s-full"); setRing(goal.pct, true); });
    }

    function ignite() {
      root.classList.remove("pre-off"); root.classList.add("s-lit", "s-count");
      kick(); shock(root, 0);
      embers(root, cfg.kind === "light" ? 26 : 16, { spread: 75, max: cfg.kind === "light" ? 140 : 110 });
      showTier(cfg.kind === "tier" ? cfg.prevTier : cfg.tier);
      vib(cfg.kind === "tier" ? [30, 40, 70] : [24]);
      at(900, function () { embers(root, 9, { amb: true, spread: 38, min: 70, max: 70, size: 3, lift: 10 }); });
    }

    function promote() {                                         // «превращение пешки»: старая фигура сгорает, новая падает в огонь
      var cur = $r(".su-pc.cur"), nw = $r(".su-pc.new");
      flameK.classList.remove("kick"); void flameK.offsetWidth; flameK.classList.add("squeeze");
      at(380, function () {
        cur.classList.add("out"); shock(root, 0); embers(root, 24, { spread: 100, max: 150, size: 5 });
        at(260, function () {
          root.dataset.tier = String(cfg.tier + 1);             // цвет, размер и фильтр пламени меняются плавно через CSS
          nw.classList.add("in"); cur.remove();
          kick(); shock(root, 1); root.classList.add("s-rays");
          embers(root, 30, { spread: 110, max: 170, size: 5 });
          showTier(cfg.tier);
          var pips = root.querySelectorAll(".su-pip");
          pips.forEach(function (p, i) { p.classList.toggle("done", i < cfg.tier); p.classList.toggle("now", i === cfg.tier); });
          if (pips[cfg.tier]) pips[cfg.tier].classList.add("ping");
          burst(root, cfg.tier >= 4 ? 44 : 30, cfg.tier >= 4 ? 1 : 0.8);
          sfx("win"); vib([40, 30, 90]);
          if (isMs) ringFull();
        });
      });
    }

    function hop() {                                             // искра из большого огонька перепрыгивает в сегодняшнюю клетку
      var week = $r(".su-week"), cell = week.querySelector(".su-wd.today"), sq = cell.querySelector(".su-sq");
      week.classList.add("show");
      function land() { cell.classList.add("lit"); }
      if (rm || !window.Flame) return at(250, land);
      at(350, function () {
        var w = week.getBoundingClientRect(), tr = sq.getBoundingClientRect(), f = $r(".su-flame .flame").getBoundingClientRect();
        var tok = document.createElement("i"); tok.className = "su-token flame flame-wd"; tok.innerHTML = window.Flame.svg(); week.appendChild(tok);
        var sx = f.left + f.width / 2 - w.left, sy = f.top + f.height * 0.5 - w.top;
        var ex = tr.left + tr.width / 2 - w.left, ey = tr.top + tr.height / 2 - w.top;
        var mx = (sx + ex) / 2, my = Math.min(sy, ey) - 26;
        var P = function (x, y, sc) { return "translate(" + x + "px," + y + "px) translate(-50%,-50%) scale(" + sc + ")"; };
        var a = tok.animate([
          { offset: 0,   transform: P(sx, sy, 2.4), opacity: 0 },
          { offset: .14, transform: P(sx, sy - 6, 2.2), opacity: 1 },
          { offset: .6,  transform: P(mx, my, 1.35), opacity: 1 },
          { offset: 1,   transform: P(ex, ey, 1), opacity: 1 }
        ], { duration: 720, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
        a.onfinish = function () { tok.remove(); land(); };
      });
    }

    function countUp(el, to, dur) {
      var t0 = performance.now();
      (function f(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = "+" + Math.round(to * e);
        if (k < 1 && !finished) requestAnimationFrame(f); else el.textContent = "+" + to;
      })(t0);
    }
    function chips() {
      var box = $r(".su-chips"), list = [];
      if (cfg.coins > 0) list.push('<span class="su-chip coin"><i class="mcoin"></i><b data-to="' + cfg.coins + '">+0</b></span>');
      if (cfg.freeze) list.push('<span class="su-chip freeze">' + snowHtml() + "<b>+1</b></span>");
      box.innerHTML = list.join("");
      Array.prototype.forEach.call(box.children, function (c, i) {
        at(i * 170, function () {
          c.classList.add("pop"); sfx(i === 0 ? "coin" : "unlock");
          var b = c.querySelector("b[data-to]"); if (b) countUp(b, +b.dataset.to, rm ? 10 : 650);
        });
      });
    }

    function settle() {                                          // финальное состояние: подпись цели, кнопка
      finished = true;
      $r(".su-week").classList.add("show"); $r(".su-week .su-wd.today").classList.add("lit");
      var g = $r(".su-goal");
      g.textContent = isMs ? T("su.reward", { n: cfg.count }) : goal.next ? T("sk.next", { n: goal.next }) : T("sk.best", { n: cfg.count });
      g.classList.add("show");
      $r(".su-go").classList.add("show");
      var btn = $r(".su-go"); try { btn.focus({ preventScroll: true }); } catch (e) { /* ok */ }
      if (cfg.kind === "day" || cfg.kind === "light") autoTimer = setTimeout(close, rm ? 1800 : 3400);
    }

    function fastForward() {                                     // тап во время анимации — сразу к финалу
      if (finished) return;
      timers.forEach(clearTimeout); timers = [];
      root.classList.remove("pre-off"); root.classList.add("s-in", "s-lit", "s-count");
      root.dataset.tier = String(cfg.tier + 1);
      var cur = $r(".su-pc.cur"), nw = $r(".su-pc.new");
      if (nw) { if (cur) cur.remove(); nw.classList.remove("in"); nw.style.opacity = "1"; }
      showTier(cfg.tier);
      root.querySelectorAll(".su-pip").forEach(function (p, i) { p.classList.toggle("done", i < cfg.tier); p.classList.toggle("now", i === cfg.tier); });
      setRing(goal.pct, true);
      root.querySelectorAll(".su-token").forEach(function (n) { n.remove(); });
      chips(); settle();
    }

    function close() {
      if (closing) return; closing = true; finished = true;
      clearTimeout(autoTimer); timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey, true);
      var emb = $r(".su-emblem"), pill = $("streak-pill"), cp = document.querySelector(".pill-coins"), coin = $r(".su-chip.coin");
      var flyMs = rm ? 10 : 640;
      function fly(el, target, scaleTo) {
        if (!el || !target) return;
        var a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
        if (!b.width || !a.width) return;
        var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        el.animate([{ transform: "none", opacity: 1 }, { transform: "translate(" + dx + "px," + dy + "px) scale(" + scaleTo + ")", opacity: .2 }],
          { duration: flyMs, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" });
      }
      if (!rm) {
        var pf = pill && pill.querySelector(".flame");
        fly(emb, pf || pill, Math.max(.06, ((pf || pill || {}).offsetWidth || 14) / emb.offsetWidth * 1.1));
        fly(coin, cp && (cp.querySelector(".mcoin") || cp), .35);
      }
      root.classList.add("s-out");
      setTimeout(function () {
        releasePill(); pulse(pill); if (coin) pulse(cp);
        root.remove(); done();
      }, flyMs + 40);
    }

    function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); finished ? close() : fastForward(); }
    }
    root.addEventListener("click", function () { finished ? close() : fastForward(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(root);

    /* ---- таймлайн ---- */
    var pFrom = goalPrev.pct;
    if (cfg.kind === "light") pFrom = 0;
    setRing(pFrom, true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("s-in"); }); });
    at(520, function () { setRing(isMs ? 100 : goal.pct); });
    at(820, ignite);
    var next;
    if (cfg.kind === "tier") { at(1750, promote); next = 3300; }
    else if (isMs) { at(1500, function () { ringFull(); burst(root, 22, 0.7); sfx("win"); vib([30, 30, 60]); }); next = 2500; }
    else next = 1650;
    at(next, hop);
    at(next + 1150, chips);
    at(next + 1150 + (cfg.freeze ? 500 : 250) + 700, settle);
  }

  function pump() {
    if (active || !queue.length) return;
    active = true;
    var cfg = queue.shift();
    try { run(cfg, function () { active = false; pump(); }); }
    catch (e) { releasePill(); active = false; try { console.warn("[streak-up]", e); } catch (_) { /* ok */ } pump(); }
  }

  /* ---------- публичное API ---------- */
  function show(cfg) {
    cfg.tier = tierIdx(cfg.count);
    cfg.prevTier = cfg.prev > 0 ? tierIdx(cfg.prev) : -1;
    if (!cfg.kind) {
      cfg.kind = (cfg.count <= 1 || cfg.prev <= 0) ? "light" : cfg.tier > cfg.prevTier ? "tier" : milestones()[cfg.count] ? "milestone" : "day";
    }
    if (cfg.kind === "light") cfg.prevTier = cfg.tier;
    queue.push(cfg); pump();
  }

  function onStreak(r) {
    var state = (typeof UI !== "undefined") ? UI.state : null;
    var cfg = { count: r.count, prev: Math.max(0, r.count - 1), coins: r.coins || 0, freeze: !!r.freeze };
    try { if (state && typeof streakWeek === "function") cfg.week = streakWeek(state); } catch (e) { /* возьмём синтетическую */ }
    setTimeout(function () { holdPill(cfg); }, 0);              // после renderTopbar в обработчике результата
    whenClear(function () { show(cfg); });
  }

  /* оборачиваем recordActivity: ui.js и daily.js вызывают её по голому имени, подмена подхватится */
  function hook() {
    if (typeof window.recordActivity !== "function" || window.recordActivity.__su) return;
    var orig = window.recordActivity;
    var wrapped = function (state) {
      var r = orig.apply(this, arguments);
      try { if (r && r.first && !r.blocked && typeof UI !== "undefined" && state === UI.state) onStreak(r); } catch (e) { /* церемония — украшение */ }
      return r;
    };
    wrapped.__su = true;
    window.recordActivity = wrapped;
  }
  hook();

  window.StreakUp = {
    show: show,
    tierOf: tierIdx,
    preview: function (from, to, opts) {                         // StreakUp.preview(2, 3, {coins: 70, freeze: true})
      var count = to == null ? (from || 1) : to;
      var isM = !!milestones()[count];
      var cfg = Object.assign({ count: count, prev: to == null ? count - 1 : from, coins: 10 + (milestones()[count] || 0), freeze: [7, 30, 60].indexOf(count) >= 0 && isM }, opts || {});
      holdPill(cfg);                                             // как в боевом потоке: в шапке «старое» число до прилёта
      show(cfg);
    }
  };
})();