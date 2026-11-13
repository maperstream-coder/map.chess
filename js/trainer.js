/* maper.chess — ТРЕНАЖЁР во вкладке «Обучение».
   Что внутри:
     ⚡ Шторм            — 3 минуты, 3 жизни, комбо и бонус ко времени: тактика и маты со всего курса
     📅 Тренировка дня   — 5 задач, одни и те же у всех в этот день; серия дней подряд и награда
     🧩 Работа над ошибками — задачи, в которых ты ошибался (шторм, тренировка, уроки), пока не решишь все
     🔤 Координаты       — найди клетку за 30 секунд (азбука шахмат)
     ♟ Спарринг          — партии против MAPER с тренером: мат ферзём/ладьёй, форы, свободная партия.
                           Тренер предупреждает о зевках, пропущенном мате и угрозе мата, ход можно взять назад.
   Использует каркас, голос и награды из lessons.js (window.MaperLsn). Подключается ПОСЛЕ js/lessons.js. */
(function () {
  "use strict";
  const A = window.MaperLsn;
  if (!A || typeof UI === "undefined") return;
  const { tr, ico, $ } = A;
  const lang = () => (UI.state && UI.state.lang) || "en";
  const ru = () => lang() === "ru";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const PN = { ru: { p: "пешку", n: "коня", b: "слона", r: "ладью", q: "ферзя" }, en: { p: "a pawn", n: "a knight", b: "a bishop", r: "a rook", q: "the queen" } };
  const pname = t => PN[ru() ? "ru" : "en"][t] || "";

  /* ---------------- сохранение ---------------- */
  const T = () => {
    const s = UI.state; if (!s.trainer || typeof s.trainer !== "object") s.trainer = {};
    const t = s.trainer;
    t.storm = t.storm || { best: 0, runs: 0 }; t.coord = t.coord || { best: 0 };
    t.daily = t.daily || { day: "", done: false, streak: 0, last: "" };
    if (!Array.isArray(t.mistakes)) t.mistakes = [];
    t.spar = t.spar || {}; t.paid = t.paid || {};
    return t;
  };
  const save = () => { try { saveState(UI.state); UI.renderTopbar(); } catch (e) { /* без сохранения играть можно */ } };
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  /* награда только за УЛУЧШЕНИЕ результата — повторами монеты не накрутить */
  function payImprove(key, value, coinsPer, xpPer, capC, capX) {
    const bag = T().paid, old = bag[key] || 0, nv = Math.max(old, value);
    const f = (v, per, cap) => Math.min(cap, Math.floor(v * per));
    const dc = f(nv, coinsPer, capC) - f(old, coinsPer, capC), dx = f(nv, xpPer, capX) - f(old, xpPer, capX);
    bag[key] = nv; UI.state.coins += dc; UI.state.xp += dx; save();
    return { dc, dx, first: !old };
  }
  function payFlat(coins, xp) { UI.state.coins += coins; UI.state.xp += xp; save(); return { dc: coins, dx: xp, first: true }; }

  /* ---------------- реестр задач ---------------- */
  const TACT = ["tactics", "mates", "mate1", "forks", "pins", "threats", "disc", "sac", "skewer", "backrank", "capdef", "hanging", "smoth", "anas", "arab", "dbl", "epau", "boden", "legal", "batt", "ladder", "mate2", "mate3"];
  let REG = null, MAP = null;
  function registry() {
    if (REG) return REG;
    const out = [];
    A.LESSONS.forEach(l => {
      if (!TACT.includes(l.id)) return;
      l.steps.forEach((st, k) => {
        if (st.quiz || st.tap || st.line || st.mateN || typeof st.ok !== "function") return;
        out.push({ id: "L:" + l.id + ":" + k, kind: "move", st, fen: st.fen, theme: l.id });
      });
    });
    const P = typeof PUZZLES !== "undefined" ? PUZZLES : null;
    if (P && window.MateSolver) [["mate1", 1], ["mate2", 2]].forEach(([key, n]) => (P[key] || []).forEach((p, i) => out.push({ id: key + ":" + i, kind: "mate", n, fen: p.fen, theme: key })));
    REG = out; MAP = {}; out.forEach(x => { MAP[x.id] = x; });
    return out;
  }
  const byId = id => { registry(); return MAP[id]; };
  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const sideOf = fen => fen.split(" ")[1] || "w";

  function solutionFor(task, fen) {
    const f = fen || task.fen, base = new Chess(f);
    if (task.kind === "move") {
      for (const m of base.moves({ verbose: true })) {
        const g = new Chess(f), mv = g.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (mv && task.st.ok(mv, g)) return mv;
      }
      return null;
    }
    const left = task.n - (task.ply || 0), sols = (window.MateSolver && MateSolver.solutions(f, Math.max(1, left))) || [];
    if (!sols.length) return null;
    const s = sols[0]; return base.moves({ verbose: true }).find(m => m.from === s.from && m.to === s.to && (m.promotion || "") === (s.promotion || "")) || null;
  }

  /* ---------------- общее ---------------- */
  let R = null;            /* активный забег (шторм / тренировка / ошибки / координаты) */
  let G = null;            /* активный спарринг */
  let uiTimer = null;
  function stop() {
    if (uiTimer) { clearInterval(uiTimer); uiTimer = null; }
    if (R) R.dead = true; if (G) G.dead = true;
    R = null; G = null;
    try { A.stopAll(); } catch (e) { /* ignore */ }
  }
  const sayq = (text, mood) => { try { A.say(text, mood || "idle", true); } catch (e) { /* ignore */ } };
  const mmss = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function page(html) {
    const p = $("lsn-page"); $("lsn-home").hidden = true; p.hidden = false; p.innerHTML = html; return p;
  }
  const backBtn = () => `<button class="btn btn-ghost" data-act="home">${ico("left", 17)}${tr("Path", "К пути")}</button>`;
  function choosePromo(color, cb) {
    if (typeof choosePromotion === "function") { A.board.setLocked(true); choosePromotion(color, pr => { A.board.setLocked(false); cb(pr); }); } else cb("q");
  }
  function afterShell() {
    const b = $("lp-back"); if (b) b.addEventListener("click", stop, true);
  }

  /* ====================================================================
     ХАБ ТРЕНАЖЁРА
     ==================================================================== */
  const MODES = () => ({
    storm: { ic: "tactics", t: tr("Storm", "Шторм"), d: tr("3 minutes, 3 lives — solve as many as you can", "3 минуты, 3 жизни — реши как можно больше"), go: startStorm },
    daily: { ic: "target", t: tr("Daily 5", "Тренировка дня"), d: tr("5 fresh tasks, a streak and a reward", "5 новых задач, серия дней и награда"), go: startDaily },
    mist: { ic: "bulb", t: tr("Fix mistakes", "Работа над ошибками"), d: tr("Replay tasks you missed until you know them", "Повтори задачи, где ошибся, пока не запомнишь"), go: startMistakes },
    coord: { ic: "board", t: tr("Coordinates", "Координаты"), d: tr("Find squares fast — the alphabet of chess", "Находи клетки быстро — азбука шахмат"), go: startCoord },
    spar: { ic: "play", t: tr("Sparring", "Спарринг"), d: tr("Play MAPER with a coach at your side", "Играй с MAPER — тренер рядом"), go: hubSpar }
  });

  function hub() {
    stop();
    const t = T(), M = MODES(), best = t.storm.best, today = dayKey(), done = t.daily.day === today && t.daily.done;
    const stat = {
      storm: best ? tr(`Best: ${best}`, `Рекорд: ${best}`) : tr("No record yet", "Рекорда ещё нет"),
      daily: done ? tr("Done today ✓", "Сегодня выполнено ✓") : (t.daily.streak ? tr(`Streak: ${t.daily.streak} d`, `Серия: ${t.daily.streak} дн.`) : tr("Not done today", "Сегодня не пройдена")),
      mist: tr(`${t.mistakes.length} to review`, `К повтору: ${t.mistakes.length}`),
      coord: t.coord.best ? tr(`Best: ${t.coord.best}`, `Рекорд: ${t.coord.best}`) : tr("No record yet", "Рекорда ещё нет"),
      spar: tr(`${Object.keys(t.spar).length} / ${SCEN.length + 1} played`, `Сыграно: ${Object.keys(t.spar).length} из ${SCEN.length + 1}`)
    };
    const p = page(`<div class="lp-top">${backBtn()}<div class="lp-title"><span class="lp-ic">${ico("tactics", 22)}</span><span>${tr("Trainer", "Тренажёр")}</span></div></div>
      <p class="tr-lead">${tr("Lessons teach the ideas. The trainer turns them into reflexes — a few minutes a day is enough.", "Уроки объясняют идеи. Тренажёр превращает их в рефлексы — хватает нескольких минут в день.")}</p>
      <div class="tr-hub">${Object.keys(M).map(k => `<button type="button" class="tr-card big" data-m="${k}"><span class="tr-ic">${ico(M[k].ic, 28)}</span><b>${M[k].t}</b><small>${M[k].d}</small><em>${stat[k]}</em></button>`).join("")}</div>`);
    p.querySelector('[data-act="home"]').addEventListener("click", A.home);
    p.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => M[b.dataset.m].go()));
  }

  /* карточки на главной странице пути */
  function decorate(home) {
    const t = T(), M = MODES(), keys = ["storm", "daily", "mist", "coord", "spar"];
    const done = t.daily.day === dayKey() && t.daily.done;
    const badge = { daily: done ? "✓" : "!", mist: t.mistakes.length ? String(t.mistakes.length) : "" };
    const strip = document.createElement("div"); strip.className = "tr-strip";
    strip.innerHTML = `<div class="tr-strip-h"><b>${ico("tactics", 18)}${tr("Trainer", "Тренажёр")}</b><button type="button" class="btn btn-ghost" data-all>${tr("All modes", "Все режимы")}${ico("arrowR", 15)}</button></div>
      <div class="tr-row">${keys.map(k => `<button type="button" class="tr-card" data-m="${k}"><span class="tr-ic">${ico(M[k].ic, 24)}</span><b>${M[k].t}</b>${badge[k] ? `<i class="tr-badge${k === "daily" && done ? " ok" : ""}">${badge[k]}</i>` : ""}</button>`).join("")}</div>`;
    const hero = home.querySelector(".lsn-hero");
    if (hero) hero.after(strip); else home.prepend(strip);
    strip.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => M[b.dataset.m].go()));
    strip.querySelector("[data-all]").addEventListener("click", hub);
  }

  /* ====================================================================
     ДВИЖОК ЗАДАЧ (шторм / тренировка / ошибки)
     ==================================================================== */
  function startRun(cfg) {
    stop();
    A.shell(cfg.title, ico(cfg.icon, 22), 0); afterShell();
    $("lp-dots").innerHTML = cfg.total ? Array.from({ length: cfg.total }, () => "<i></i>").join("") : "";
    if (!cfg.total) $("lp-dots").hidden = true;
    $("lp-quiz").innerHTML = `<div class="tr-hud"><span class="tr-pill" id="tr-time">${cfg.time ? mmss(cfg.time * 1000) : ""}</span><span class="tr-pill gold" id="tr-score">0</span><span class="tr-pill" id="tr-lives"></span><span class="tr-pill hot" id="tr-combo"></span></div>${cfg.time ? '<div class="tr-bar"><i id="tr-fill"></i></div>' : ""}`;
    if (!cfg.time) $("tr-time").hidden = true;
    if (!isFinite(cfg.lives)) $("tr-lives").hidden = true;
    R = { cfg, dead: false, score: 0, solved: 0, wrong: 0, hints: 0, combo: 0, maxCombo: 0, lives: cfg.lives, idx: 0, task: null, busy: false, tries: 0, endAt: cfg.time ? Date.now() + cfg.time * 1000 : 0, failed: [], used: {} };
    hud();
    if (cfg.time) uiTimer = setInterval(tick, 200);
    next();
  }
  function hud() {
    if (!R) return;
    const c = R.cfg;
    $("tr-score").textContent = c.total ? `${R.solved}/${c.total}` : String(R.score);
    if (isFinite(c.lives)) $("tr-lives").innerHTML = ic("heart").repeat(Math.max(0, R.lives)) + ic("heart-o").repeat(Math.max(0, c.lives - R.lives));
    $("tr-combo").textContent = R.combo >= 2 ? `×${R.combo}` : "";
    $("tr-combo").hidden = R.combo < 2;
  }
  function tick() {
    if (!R || R.dead) return;
    const left = R.endAt - Date.now();
    const tm = $("tr-time"), f = $("tr-fill");
    if (tm) { tm.textContent = mmss(left); tm.classList.toggle("low", left < 15000); }
    if (f) f.style.width = Math.max(0, Math.min(100, left / (R.cfg.time * 1000) * 100)) + "%";
    if (left <= 0) endRun();
  }
  function setDots() {
    if (!R || !R.cfg.total) return;
    $("lp-dots").innerHTML = Array.from({ length: R.cfg.total }, (_, k) => `<i class="${k < R.idx ? "ok" : k === R.idx ? "on" : ""}"></i>`).join("");
  }
  function next() {
    if (!R || R.dead) return;
    const c = R.cfg;
    if (c.total && R.idx >= c.total) return endRun();
    const task = c.next(R);
    if (!task) return endRun();
    task.ply = 0; R.task = task; R.tries = 0; R.busy = false; R.hintLvl = 0;
    setDots();
    const side = sideOf(task.fen);
    A.mount(task.fen, side, (from, to) => onMove(from, to), false);
    A.clearMarks(); A.chip(null);
    const first = !R.said;
    R.said = true;
    sayq(task.kind === "mate" ? tr(`${side === "w" ? "White" : "Black"} to move: mate in ${task.n}.`, `Ход ${side === "w" ? "белых" : "чёрных"}: мат в ${task.n}.`)
      : tr(`${side === "w" ? "White" : "Black"} to move — find the best move!`, `Ходят ${side === "w" ? "белые" : "чёрные"} — найди лучший ход!`), "think");
    const btns = [];
    if (c.hint) btns.push({ label: ico("bulb", 17) + tr("Hint", "Подсказка"), fn: runHint });
    if (c.skip) btns.push({ label: tr("Skip", "Пропустить"), fn: () => { if (R && !R.busy) fail(null, true); } });
    A.setBtns(...btns);
    if (first && c.intro) sayq(c.intro, "idle");
  }
  function runHint() {
    if (!R || R.busy || !R.task) return;
    const sol = solutionFor(R.task, A.game.fen());
    if (!sol) return;
    R.hints++; R.hintLvl++;
    A.clearMarks(); A.mark(R.hintLvl >= 2 ? [sol.from, sol.to] : [sol.from], "hint");
    sayq(R.hintLvl >= 2 ? tr("Gold squares show the move.", "Золотые клетки показывают ход.") : tr("Move the highlighted piece.", "Сходи подсвеченной фигурой."), "think");
  }
  function onMove(from, to) {
    if (!R || R.busy || R.dead) return;
    const g0 = new Chess(A.game.fen()), p = g0.get(from);
    const promo = p && p.type === "p" && (to[1] === "8" || to[1] === "1");
    if (promo) choosePromo(p.color, pr => judge(from, to, pr)); else judge(from, to, undefined);
  }
  function judge(from, to, pr) {
    if (!R || R.dead) return;
    const task = R.task, fen0 = A.game.fen(), g = new Chess(fen0), mv = g.move({ from, to, promotion: pr });
    if (!mv) return;
    let ok = false;
    if (task.kind === "move") ok = !!task.st.ok(mv, g);
    else if (g.in_checkmate()) ok = true;
    else { const left = task.n - task.ply, sols = (window.MateSolver && MateSolver.solutions(fen0, left)) || []; ok = sols.some(x => x.from === mv.from && x.to === mv.to && (x.promotion || "") === (mv.promotion || "")); }
    A.board.attach(g, { from: mv.from, to: mv.to });
    if (!ok) return wrongMove(mv);
    A.clearMarks(); A.mark([mv.from, mv.to], "good");
    if (task.kind === "mate" && !g.in_checkmate()) {         /* многоходовый мат: соперник отвечает, продолжаем */
      R.busy = true; A.game = g; task.ply++; sayq(tr("Right! Keep going…", "Верно! Продолжай…"), "happy");
      A.later(() => {
        if (!R || R.dead) return;
        let reply = null; try { reply = chooseAiMove(new Chess(g.fen()), 3, 0); } catch (e) { /* ignore */ }
        const rm = reply ? A.game.move(reply) : null;
        if (rm) A.board.attach(A.game, { from: rm.from, to: rm.to });
        A.clearMarks(); A.board.clearSelection(); R.busy = false; A.board.setLocked(false);
      }, 750);
      return;
    }
    success();
  }
  function success() {
    R.busy = true; A.board.setLocked(true); A.glow("good"); A.sfx("sparkle");
    R.combo++; R.maxCombo = Math.max(R.maxCombo, R.combo); R.solved++;
    const c = R.cfg;
    R.score += 10 + Math.min(R.combo, 10) * 2;
    if (c.bonusEvery && R.combo % c.bonusEvery === 0 && R.endAt) { R.endAt += c.bonusMs; A.chip("ok", `+${c.bonusMs / 1000}${tr("s", " с")}`); }
    else A.chip("ok", tr("Correct!", "Верно!"));
    if (c.onSolved) c.onSolved(R.task);
    R.idx++; hud(); setDots();
    A.later(next, c.fast ? 380 : 900);
  }
  function wrongMove(mv) {
    const c = R.cfg;
    R.combo = 0; hud();
    if (R.tries < c.retries) {                                /* ещё есть попытки: откат и подсказка */
      R.tries++; A.glow("bad"); A.chip("bad", tr("Not quite", "Не то"));
      sayq(tr("Not that one — try again!", "Не то — попробуй ещё раз!"), "sad");
      R.busy = true; A.board.setLocked(true);
      A.later(() => { if (!R) return; A.clearMarks(); A.board.attach(A.game, null); A.board.clearSelection(); A.board.render(A.game); A.board.setLocked(false); R.busy = false; }, 900);
      return;
    }
    fail(mv, false);
  }
  function fail(mv, skipped) {
    const c = R.cfg; R.busy = true; A.board.setLocked(true);
    R.wrong++; R.combo = 0; if (isFinite(c.lives)) R.lives--;
    R.failed.push(R.task.id);
    const t = T(); if (!t.mistakes.includes(R.task.id)) { t.mistakes.push(R.task.id); if (t.mistakes.length > 60) t.mistakes.shift(); save(); }
    A.glow("bad"); A.chip("bad", skipped ? tr("Skipped", "Пропуск") : tr("Missed", "Мимо"));
    const sol = solutionFor(R.task, A.game.fen());
    A.board.attach(A.game, null); A.board.render(A.game); A.clearMarks();
    if (sol) { A.mark([sol.from, sol.to], "hint"); sayq(tr(`The move was ${sol.san}.`, `Нужно было ${sol.san}.`), "sad"); }
    R.idx++; hud(); setDots();
    if (isFinite(c.lives) && R.lives <= 0) return A.later(endRun, 1500);
    A.later(next, c.fast ? 1300 : 1900);
  }
  function endRun() {
    if (!R || R.dead) return;
    const run = R, c = run.cfg; run.dead = true;
    if (uiTimer) { clearInterval(uiTimer); uiTimer = null; }
    R = null;
    A.board.setLocked(true); A.clearMarks();
    const out = c.finish(run);                                 /* {stars, stats, rw, say, again} */
    $("lp-quiz").innerHTML = A.resultHtml(out.stars, out.stats, out.rw);
    A.playResult($("lp-quiz"), out.stars, out.rw.first);
    A.chip(null); sayq(out.say, out.stars >= 2 ? "happy" : "idle");
    A.setBtns(Object.assign({ primary: true }, out.again), { label: ico("tactics", 17) + tr("Trainer", "Тренажёр"), fn: hub }, { label: ico("flag", 17) + tr("Path", "К пути"), fn: A.home });
  }

  /* ----------------- Шторм ----------------- */
  function pool(filter) { return registry().filter(filter); }
  function pickRandom(R0, arr) {
    if (!arr.length) return null;
    for (let i = 0; i < 12; i++) { const t = arr[Math.floor(Math.random() * arr.length)]; if (!R0.used[t.id]) { R0.used[t.id] = 1; return Object.assign({}, t); } }
    return Object.assign({}, arr[Math.floor(Math.random() * arr.length)]);
  }
  function startStorm() {
    const all = pool(() => true);
    if (!all.length) return UI._toast && UI._toast(tr("No tasks yet.", "Пока нет задач."));
    const m1 = all.filter(x => x.theme === "mate1"), m2 = all.filter(x => x.theme === "mate2"), mv = all.filter(x => x.kind === "move");
    startRun({
      title: tr("Storm", "Шторм"), icon: "tactics", time: 180, lives: 3, retries: 0, fast: true, bonusEvery: 5, bonusMs: 4000,
      intro: tr("Solve fast! Every 5 in a row adds 4 seconds. Three misses and it's over.", "Решай быстро! Каждые 5 подряд добавляют 4 секунды. Три промаха — конец."),
      next: R0 => { const r = Math.random(), src = r < 0.34 ? mv : r < 0.8 ? m1 : (m2.length ? m2 : m1); return pickRandom(R0, src.length ? src : all); },
      finish: run => {
        const t = T(); t.storm.runs++; const nb = run.solved > (t.storm.best || 0); if (nb) t.storm.best = run.solved;
        const rw = payImprove("storm", run.solved, 1.5, 3, 45, 90);
        const stars = run.solved >= 20 ? 3 : run.solved >= 12 ? 2 : run.solved >= 5 ? 1 : 0;
        return {
          stars, rw, stats: tr(`Solved: ${run.solved} · misses: ${run.wrong} · best combo: ×${run.maxCombo}${nb ? " · NEW RECORD!" : ""}`, `Решено: ${run.solved} · промахов: ${run.wrong} · лучшее комбо: ×${run.maxCombo}${nb ? " · НОВЫЙ РЕКОРД!" : ""}`),
          say: nb ? tr("A new record! Your tactical vision is sharpening.", "Новый рекорд! Твоё тактическое зрение растёт.") : tr("Nice run. Missed tasks went to «Fix mistakes» — replay them there.", "Хороший забег. Задачи с промахами попали в «Работу над ошибками» — повтори их там."),
          again: { label: ico("redo", 16) + tr("Again", "Ещё раз"), fn: startStorm }
        };
      }
    });
  }

  /* ----------------- Тренировка дня ----------------- */
  function startDaily() {
    const reg = registry(); if (!reg.length) return;
    const t = T(), today = dayKey(), rnd = mulberry(hashStr("daily|" + today));
    const take = (arr, n) => { const a = arr.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
    const tasks = [...take(reg.filter(x => x.kind === "move"), 2), ...take(reg.filter(x => x.theme === "mate1"), 2), ...take(reg.filter(x => x.theme === "mate2"), 1)].map(x => Object.assign({}, x));
    const already = t.daily.day === today && t.daily.done;
    startRun({
      title: tr("Daily 5", "Тренировка дня"), icon: "target", total: tasks.length, lives: Infinity, retries: 2, hint: true,
      intro: already ? tr("You already finished today's set — this is just practice, no reward.", "Сегодняшний набор уже пройден — это просто практика, без награды.") : tr("Five tasks, the same for everyone today. No time limit — think!", "Пять задач, сегодня одинаковые для всех. Без времени — думай!"),
      next: R0 => tasks[R0.idx] || null,
      finish: run => {
        const mis = run.failed.length, stars = mis === 0 && run.hints === 0 ? 3 : mis <= 1 ? 2 : 1;
        let rw = { dc: 0, dx: 0, first: false }, extra = "";
        if (!already) {
          const d = t.daily, yest = dayKey(new Date(Date.now() - 864e5));
          d.streak = d.last === yest ? (d.streak || 0) + 1 : 1; d.last = today; d.day = today; d.done = true;
          rw = payFlat(10 + stars * 4 + Math.min(10, d.streak) * 2, 20 + stars * 8);
          extra = tr(` · streak: ${d.streak} d`, ` · серия: ${d.streak} дн.`);
        }
        return {
          stars, rw, stats: tr(`Misses: ${mis} · hints: ${run.hints}${extra}`, `Ошибок: ${mis} · подсказок: ${run.hints}${extra}`),
          say: already ? tr("Good practice! Come back tomorrow for a new set.", "Хорошая практика! Завтра будет новый набор.") : tr("Daily set done! Come back tomorrow to keep the streak alive.", "Набор дня выполнен! Заходи завтра, чтобы не прервать серию."),
          again: { label: ico("redo", 16) + tr("Again", "Ещё раз"), fn: startDaily }
        };
      }
    });
  }

  /* ----------------- Работа над ошибками ----------------- */
  function startMistakes() {
    const t = T(); registry();
    const ids = t.mistakes.filter(id => byId(id));
    t.mistakes = ids;
    if (!ids.length) { save(); if (UI._toast) UI._toast(tr("No mistakes to review — great!", "Ошибок для повтора нет — отлично!")); return hub(); }
    const queue = ids.slice(0, 8).map(id => Object.assign({}, byId(id)));
    let solvedNow = 0;
    startRun({
      title: tr("Fix mistakes", "Работа над ошибками"), icon: "bulb", total: queue.length, lives: Infinity, retries: 2, hint: true, skip: true,
      intro: tr("These are tasks you missed before. Solve them and they leave the list.", "Это задачи, где ты ошибался. Решишь — они уйдут из списка."),
      next: R0 => queue[R0.idx] || null,
      onSolved: task => { const t2 = T(); t2.mistakes = t2.mistakes.filter(x => x !== task.id); solvedNow++; save(); },
      finish: run => {
        const stars = solvedNow >= queue.length ? 3 : solvedNow >= queue.length / 2 ? 2 : 1;
        const rw = payFlat(solvedNow * 2, solvedNow * 5);
        return {
          stars, rw, stats: tr(`Fixed: ${solvedNow} of ${queue.length} · left in the list: ${T().mistakes.length}`, `Исправлено: ${solvedNow} из ${queue.length} · осталось в списке: ${T().mistakes.length}`),
          say: T().mistakes.length ? tr("Good! Run it again to clear the rest.", "Хорошо! Запусти ещё раз, чтобы разобрать остальное.") : tr("The list is empty. Clean slate!", "Список пуст. Чистый лист!"),
          again: { label: ico("redo", 16) + tr("Next batch", "Следующие"), fn: startMistakes }
        };
      }
    });
  }

  /* ====================================================================
     КООРДИНАТЫ
     ==================================================================== */
  function startCoord() {
    stop();
    A.shell(tr("Coordinates", "Координаты"), ico("board", 22), 0); afterShell();
    $("lp-dots").hidden = true;
    const side = Math.random() < 0.5 ? "w" : "b";
    A.mount(START, null, () => {}, true);
    if (A.board.orientation !== side) A.board.setOrientation(side);
    $("lp-board").classList.add("tr-nocoord");
    $("lp-quiz").innerHTML = `<div class="tr-hud"><span class="tr-pill" id="tr-time">0:30</span><span class="tr-pill gold" id="tr-score">0</span><span class="tr-pill hot" id="tr-combo" hidden></span></div><div class="tr-bar"><i id="tr-fill"></i></div>
      <div class="tr-target" id="tr-target">—</div>`;
    const files = "abcdefgh", rnd = () => files[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8));
    R = { mode: "coord", dead: false, score: 0, wrong: 0, combo: 0, maxCombo: 0, target: null, endAt: 0, started: false };
    const run = R;
    const pick = () => { let s; do { s = rnd(); } while (s === run.target); run.target = s; $("tr-target").textContent = s; A.clearMarks(); };
    A.setBtns({ primary: true, label: ico("play", 16) + tr("Start (30 s)", "Старт (30 с)"), fn: () => begin() });
    sayq(tr("I'll name a square — tap it as fast as you can. Board labels are hidden!", "Я называю клетку — нажимай на неё как можно быстрее. Подписи на доске скрыты!"), "idle");
    function begin() {
      if (run.dead || run.started) return; run.started = true; run.endAt = Date.now() + 30000; A.setBtns(); pick();
      uiTimer = setInterval(() => {
        if (run.dead) return; const left = run.endAt - Date.now();
        $("tr-time").textContent = mmss(left); $("tr-time").classList.toggle("low", left < 8000); $("tr-fill").style.width = Math.max(0, left / 300) + "%";
        if (left <= 0) end();
      }, 150);
    }
    Object.keys(A.board.squares).forEach(sq => A.board.squares[sq].addEventListener("click", () => {
      if (run.dead || !run.started || !run.target) return;
      if (sq === run.target) {
        run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo); run.score++;
        A.mark([sq], "good"); A.sfx("sparkle"); $("tr-score").textContent = run.score;
        $("tr-combo").hidden = run.combo < 3; $("tr-combo").textContent = "×" + run.combo;
        setTimeout(pick, 140);
      } else {
        run.combo = 0; run.wrong++; $("tr-combo").hidden = true; A.mark([sq], "bad"); A.glow("bad");
        setTimeout(() => A.clearMarks(), 260);
      }
    }));
    function end() {
      if (run.dead) return; run.dead = true; if (uiTimer) { clearInterval(uiTimer); uiTimer = null; } R = null;
      const t = T(), nb = run.score > (t.coord.best || 0); if (nb) t.coord.best = run.score;
      const rw = payImprove("coord", run.score, 0.5, 1, 25, 45);
      const stars = run.score >= 35 ? 3 : run.score >= 22 ? 2 : run.score >= 10 ? 1 : 0;
      $("lp-board").classList.remove("tr-nocoord");
      $("lp-quiz").innerHTML = A.resultHtml(stars, tr(`Squares found: ${run.score} · misses: ${run.wrong}${nb ? " · NEW RECORD!" : ""}`, `Найдено клеток: ${run.score} · промахов: ${run.wrong}${nb ? " · НОВЫЙ РЕКОРД!" : ""}`), rw);
      A.playResult($("lp-quiz"), stars, rw.first);
      sayq(nb ? tr("Record! Notation will soon feel automatic.", "Рекорд! Скоро нотация станет автоматической.") : tr("Good. Practise a minute a day and you'll read games like a book.", "Хорошо. Минута в день — и ты будешь читать партии как книгу."), nb ? "happy" : "idle");
      A.setBtns({ primary: true, label: ico("redo", 16) + tr("Again", "Ещё раз"), fn: startCoord }, { label: ico("tactics", 17) + tr("Trainer", "Тренажёр"), fn: hub }, { label: ico("flag", 17) + tr("Path", "К пути"), fn: A.home });
    }
  }

  /* ====================================================================
     СПАРРИНГ С ТРЕНЕРОМ
     ==================================================================== */
  const B2 = (en, ruT) => ({ en, ru: ruT });
  const SCEN = [
    { id: "q1", ic: "mate1", t: B2("Mate with the queen", "Мат ферзём"), d: B2("K+Q vs K: drive the king to the edge and mate", "Ферзь и король против короля: загони на край и поставь мат"),
      fen: "8/8/4k3/8/8/8/8/Q3K3 w - - 0 1", side: "w", max: 22, depth: 3, blunder: 0, lvl: 1, tip: B2("Take away squares with the queen a knight's move away — and avoid stalemate!", "Отнимай поля ферзём «ходом коня» от короля — и берегись пата!") },
    { id: "r1", ic: "mate1", t: B2("Mate with the rook", "Мат ладьёй"), d: B2("K+R vs K: use the king and the rook together", "Ладья и король против короля: работайте вместе"),
      fen: "8/8/4k3/8/8/8/8/R3K3 w - - 0 1", side: "w", max: 32, depth: 3, blunder: 0, lvl: 2, tip: B2("Cut the king off with the rook, then bring your king to the opposition and check.", "Отрежь короля ладьёй, подведи своего короля в оппозицию и дай шах.") },
    { id: "rr", ic: "ladder", t: B2("Two-rook ladder", "Лесенка двумя ладьями"), d: B2("Two rooks mate in a few moves", "Две ладьи ставят мат за несколько ходов"),
      fen: "8/8/4k3/8/8/8/8/RR2K3 w - - 0 1", side: "w", max: 14, depth: 3, blunder: 0, lvl: 1, tip: B2("One rook gives check, the other cuts the next rank — climb like a ladder.", "Одна ладья даёт шах, другая отрезает следующую горизонталь — поднимайся лесенкой.") },
    { id: "pq", ic: "passed", t: B2("Promote and mate", "Проведи пешку и поставь мат"), d: B2("Queen your pawn, then finish the game", "Сделай ферзя и дожми партию"),
      fen: "8/P7/8/8/8/5k2/8/5K2 w - - 0 1", side: "w", max: 24, depth: 3, blunder: 0, lvl: 2, tip: B2("Promote at once with a8=Q, then bring the king closer.", "Сразу превращай пешку a8=Q, потом подтягивай короля.") },
    { id: "oq", ic: "values", t: B2("Queen odds", "Фора ферзя"), d: B2("Black plays without a queen — win the game", "Чёрные играют без ферзя — выиграй партию"),
      fen: "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", side: "w", max: 70, depth: 3, blunder: 0.04, lvl: 3, tip: B2("Trade pieces, avoid blunders, and use your queen to attack.", "Меняй фигуры, не зевай и атакуй ферзём.") },
    { id: "or", ic: "values", t: B2("Rook odds", "Фора ладьи"), d: B2("Black plays without the a8 rook", "У чёрных нет ладьи a8"),
      fen: "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1", side: "w", max: 80, depth: 3, blunder: 0.04, lvl: 3, tip: B2("Develop quickly and attack before Black coordinates.", "Быстро развивайся и атакуй, пока чёрные не скоординировались.") },
    { id: "on", ic: "values", t: B2("Knight odds", "Фора коня"), d: B2("Black plays without the b8 knight", "У чёрных нет коня b8"),
      fen: "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", side: "w", max: 90, depth: 3, blunder: 0.03, lvl: 4, tip: B2("A small edge: play by the opening principles and wait for mistakes.", "Небольшое преимущество: играй по принципам дебюта и дожидайся ошибок.") }
  ];
  const LEVELS = { easy: { depth: 2, blunder: 0.25 }, normal: { depth: 3, blunder: 0.08 }, hard: { depth: 4, blunder: 0 } };

  function hubSpar() {
    stop();
    const t = T();
    const p = page(`<div class="lp-top">${backBtn()}<div class="lp-title"><span class="lp-ic">${ico("play", 22)}</span><span>${tr("Sparring", "Спарринг")}</span></div></div>
      <p class="tr-lead">${tr("Play MAPER from prepared positions. Your coach warns about hanging pieces, missed mates and mate threats — and lets you take a move back.", "Играй с MAPER из подготовленных позиций. Тренер предупредит о зевках, пропущенном мате и угрозе мата — и даст взять ход назад.")}</p>
      <div class="tr-hub">${SCEN.map(s => { const st = t.spar[s.id] || 0; return `<button type="button" class="tr-card big" data-s="${s.id}"><span class="tr-ic">${ico(s.ic, 26)}</span><b>${A.L(s.t)}</b><small>${A.L(s.d)}</small><em>${st ? A.starsRow(st) : tr("Not played", "Не играно")}</em></button>`; }).join("")}
        <button type="button" class="tr-card big" data-s="free"><span class="tr-ic">${ico("board", 26)}</span><b>${tr("Game with a coach", "Партия с тренером")}</b><small>${tr("A normal game from the start — choose level and colour", "Обычная партия с начала — выбери уровень и цвет")}</small><em>${t.spar.free ? A.starsRow(t.spar.free) : tr("Not played", "Не играно")}</em></button></div>`);
    p.querySelector('[data-act="home"]').addEventListener("click", A.home);
    p.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", () => b.dataset.s === "free" ? freeMenu() : startSpar(SCEN.find(x => x.id === b.dataset.s))));
  }
  function freeMenu() {
    const p = page(`<div class="lp-top">${backBtn()}<div class="lp-title"><span class="lp-ic">${ico("board", 22)}</span><span>${tr("Game with a coach", "Партия с тренером")}</span></div></div>
      <p class="tr-lead">${tr("Pick the opponent's strength, then your colour.", "Выбери силу соперника, затем свой цвет.")}</p>
      <div class="tr-chips" id="tr-lv">${["easy", "normal", "hard"].map(k => `<button type="button" class="tr-chip${k === "normal" ? " on" : ""}" data-lv="${k}">${{ easy: tr("Easy", "Лёгкий"), normal: tr("Normal", "Средний"), hard: tr("Hard", "Сильный") }[k]}</button>`).join("")}</div>
      <div class="tr-hub two"><button type="button" class="tr-card big" data-c="w"><span class="tr-ic">${ico("wdisc", 26)}</span><b>${tr("Play White", "Играть белыми")}</b></button><button type="button" class="tr-card big" data-c="b"><span class="tr-ic">${ico("bdisc", 26)}</span><b>${tr("Play Black", "Играть чёрными")}</b></button></div>`);
    let lv = "normal";
    p.querySelector('[data-act="home"]').addEventListener("click", hubSpar);
    p.querySelectorAll("[data-lv]").forEach(b => b.addEventListener("click", () => { lv = b.dataset.lv; p.querySelectorAll("[data-lv]").forEach(x => x.classList.toggle("on", x === b)); }));
    p.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => startSpar({ id: "free", t: B2("Game with a coach", "Партия с тренером"), fen: START, side: b.dataset.c, max: 999, depth: LEVELS[lv].depth, blunder: LEVELS[lv].blunder, lvl: lv === "hard" ? 4 : lv === "normal" ? 3 : 2, free: true, tip: B2("Play by the principles: centre, development, king safety.", "Играй по принципам: центр, развитие, безопасность короля.") })));
  }

  /* ---- мини-оценка для тренера (дёшево, без движка) ---- */
  function netLoss(g) {                    /* g: ход соперника; сколько он может выиграть чистым материалом одним взятием */
    let worst = 0, best = null;
    for (const m of g.moves({ verbose: true })) {
      if (!m.captured) continue;
      const gain = VAL[m.captured] + (m.promotion ? 8 : 0), g2 = new Chess(g.fen()); g2.move({ from: m.from, to: m.to, promotion: m.promotion });
      let rec = 0; for (const r of g2.moves({ verbose: true })) if (r.captured) rec = Math.max(rec, VAL[r.captured]);
      if (g2.in_checkmate()) { rec = 99; }
      if (gain - rec > worst) { worst = gain - rec; best = m; }
    }
    return { worst, best };
  }
  const mateIn1 = fen => { try { return window.MateSolver ? MateSolver.find(fen, 1) : null; } catch (e) { return null; } };

  function startSpar(sc) {
    stop();
    A.shell(A.L(sc.t), ico(sc.ic || "board", 22), sc.lvl); afterShell();
    $("lp-dots").hidden = true;
    const me = sc.side, bot = me === "w" ? "b" : "w";
    G = { sc, me, bot, dead: false, moves: 0, flags: 0, hints: 0, busy: false, pending: null, over: false };
    const g0 = G;
    A.mount(sc.fen, me, (f, t) => onSparMove(f, t), false);
    $("lp-quiz").innerHTML = `<div class="tr-hud"><span class="tr-pill" id="sp-mv">${tr("Moves", "Ходы")}: 0${sc.max < 999 ? " / " + sc.max : ""}</span><span class="tr-pill gold" id="sp-fl"></span></div><div class="tr-note" id="sp-note"></div>`;
    sayq(A.L(sc.tip) + " " + (sc.max < 999 ? tr(`Goal: checkmate within ${sc.max} moves.`, `Цель: мат за ${sc.max} ходов.`) : tr("Goal: win the game.", "Цель: выиграть партию.")), "idle");
    barButtons();
    if (A.game.turn() === bot) botMove();

    function note(txt, kind) { const n = $("sp-note"); if (n) { n.textContent = txt || ""; n.className = "tr-note" + (kind ? " " + kind : ""); } }
    function flagsHud() { const f = $("sp-fl"); if (f) { f.textContent = g0.flags ? tr(`Coach flags: ${g0.flags}`, `Замечаний: ${g0.flags}`) : ""; } const m = $("sp-mv"); if (m) m.textContent = `${tr("Moves", "Ходы")}: ${g0.moves}${sc.max < 999 ? " / " + sc.max : ""}`; }
    function barButtons() {
      A.setBtns({ label: ico("bulb", 17) + tr("Hint", "Подсказка"), fn: hint },
        { label: ico("redo", 16) + tr("Restart", "Заново"), fn: () => startSpar(sc) },
        { label: ico("left", 17) + tr("Spar list", "К списку"), fn: () => { stop(); sc.free ? freeMenu() : hubSpar(); } });
    }
    function hint() {
      if (g0.dead || g0.busy || g0.over || A.game.turn() !== me) return;
      g0.hints++; let san = null;
      try { san = hintMove(A.game); } catch (e) { /* ignore */ }
      if (!san) return;
      const m = new Chess(A.game.fen()).move(san); if (!m) return;
      A.clearMarks(); A.mark([m.from, m.to], "hint"); sayq(tr(`Coach: try ${m.san}.`, `Тренер: попробуй ${m.san}.`), "think");
    }
    function onSparMove(from, to) {
      if (g0.dead || g0.busy || g0.over || g0.pending) return;
      const p = A.game.get(from), promo = p && p.type === "p" && (to[1] === "8" || to[1] === "1");
      if (promo) choosePromo(p.color, pr => doMove(from, to, pr)); else doMove(from, to, undefined);
    }
    function doMove(from, to, pr) {
      if (g0.dead) return;
      const beforeFen = A.game.fen(), mate1 = mateIn1(beforeFen);
      const mv = A.game.move({ from, to, promotion: pr }); if (!mv) return;
      A.board.attach(A.game, { from, to }); A.clearMarks(); g0.moves++; flagsHud();
      if (A.game.game_over()) return finish();
      if (sc.max < 999 && g0.moves >= sc.max) return finish(true);
      /* ---- тренер ---- */
      let warn = null;
      if (mate1) { const s = new Chess(beforeFen).move({ from: mate1.from, to: mate1.to, promotion: mate1.promotion }); warn = tr(`Coach: you missed mate in one — ${s ? s.san : ""}!`, `Тренер: ты пропустил мат в 1 ход — ${s ? s.san : ""}!`); }
      else {
        const th = mateIn1(A.game.fen());
        if (th) { const s = new Chess(A.game.fen()).move({ from: th.from, to: th.to, promotion: th.promotion }); warn = tr(`Coach: careful — the opponent threatens mate (${s ? s.san : ""})!`, `Тренер: осторожно — сопернику грозит мат (${s ? s.san : ""})!`); }
        else {
          const nl = netLoss(A.game);
          if (nl.worst >= 2 && nl.best) warn = tr(`Coach: after this the opponent can win ${pname(nl.best.captured)} with ${nl.best.san}.`, `Тренер: после этого соперник может выиграть ${pname(nl.best.captured)} ходом ${nl.best.san}.`);
        }
      }
      if (warn) {
        g0.flags++; flagsHud(); g0.pending = true; note(warn, "warn"); sayq(warn, "sad"); A.glow("bad");
        A.setBtns({ primary: true, label: ico("redo", 16) + tr("Take it back", "Взять ход назад"), fn: undo },
          { label: tr("Play on anyway", "Всё равно играть"), fn: proceed });
        return;
      }
      note("");
      g0.busy = true; A.board.setLocked(true); A.later(botMove, 450);
    }
    function undo() {
      if (!g0.pending || g0.dead) return;
      A.game.undo(); g0.moves = Math.max(0, g0.moves - 1); g0.pending = null; note("");
      A.board.attach(A.game, null); A.board.clearSelection(); A.board.render(A.game); A.board.setLocked(false);
      flagsHud(); barButtons(); sayq(tr("Good — look for something better.", "Хорошо — ищи ход получше."), "idle");
    }
    function proceed() {
      if (!g0.pending || g0.dead) return;
      g0.pending = null; note(""); barButtons(); g0.busy = true; A.board.setLocked(true); A.later(botMove, 350);
    }
    function botMove() {
      if (g0.dead) return;
      g0.busy = true; A.board.setLocked(true);
      let san = null; try { san = chooseAiMove(A.game, sc.depth, sc.blunder); } catch (e) { /* ignore */ }
      const m = san ? A.game.move(san) : null;
      if (m) A.board.attach(A.game, { from: m.from, to: m.to });
      g0.busy = false;
      if (A.game.game_over()) return finish();
      A.board.setLocked(false);
      sayq(A.game.in_check() ? tr("Check! Answer it.", "Шах! Ответь на него.") : tr("Your move.", "Твой ход."), A.game.in_check() ? "sad" : "idle");
    }
    function finish(timeUp) {
      if (g0.dead || g0.over) return; g0.over = true; g0.busy = true; A.board.setLocked(true); note("");
      const g = A.game, win = g.in_checkmate() && g.turn() !== me, lose = g.in_checkmate() && g.turn() === me;
      let stars = 0, rw = { dc: 0, dx: 0, first: false }, txt;
      if (win) {
        stars = g0.flags === 0 && g0.hints === 0 ? 3 : g0.flags + g0.hints <= 3 ? 2 : 1;
        const t = T(), old = t.spar[sc.id] || 0; t.spar[sc.id] = Math.max(old, stars);
        const base = [0, 8, 14, 22, 32][sc.lvl] || 8, mult = [0, 0.5, 0.75, 1];
        const dc = Math.max(0, Math.round(base * mult[t.spar[sc.id]]) - Math.round(base * mult[old])), dx = Math.max(0, Math.round(base * 2 * mult[t.spar[sc.id]]) - Math.round(base * 2 * mult[old]));
        UI.state.coins += dc; UI.state.xp += dx; save(); rw = { dc, dx, first: !old };
        txt = tr(`Checkmate in ${g0.moves} moves · coach flags: ${g0.flags} · hints: ${g0.hints}`, `Мат за ${g0.moves} ходов · замечаний тренера: ${g0.flags} · подсказок: ${g0.hints}`);
        sayq(stars === 3 ? tr("Flawless technique! Coach has nothing to add.", "Безупречная техника! Тренеру нечего добавить.") : tr("You won! Replay for a cleaner game — fewer flags and hints.", "Победа! Сыграй ещё раз почище — меньше замечаний и подсказок."), "happy");
      } else {
        txt = timeUp ? tr(`Out of moves (${sc.max}). Mate faster next time!`, `Ходы закончились (${sc.max}). В следующий раз мат — быстрее!`)
          : lose ? tr("You were checkmated. Replay and look at the coach's warnings.", "Тебе поставили мат. Сыграй ещё раз и слушай тренера.")
          : tr("It's a draw (stalemate or insufficient material). Watch out for stalemate tricks!", "Ничья (пат или недостаточный материал). Остерегайся патовых ловушек!");
        sayq(txt, "sad");
      }
      $("lp-quiz").innerHTML = A.resultHtml(stars, txt, rw);
      if (stars) A.playResult($("lp-quiz"), stars, rw.first);
      A.setBtns({ primary: true, label: ico("redo", 16) + tr("Play again", "Ещё раз"), fn: () => startSpar(sc) },
        { label: ico("play", 16) + tr("Sparring", "Спарринг"), fn: () => { stop(); hubSpar(); } },
        { label: ico("flag", 17) + tr("Path", "К пути"), fn: A.home });
    }
  }

  /* ---------------- интеграция ---------------- */
  const _sv = UI.showView;
  UI.showView = function (n) { if (n !== "lessons") stop(); return _sv.apply(this, arguments); };
  if (window.__TR_TEST) window.__TR_TEST({ registry, solutionFor, netLoss, mateIn1, SCEN, mulberry, hashStr });
  window.MaperTrainer = { decorate, hub, startStorm, startDaily, startMistakes, startCoord, hubSpar, stop };
})();