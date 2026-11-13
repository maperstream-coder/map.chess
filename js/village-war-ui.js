/* maper.chess — интерфейс войска и походов: вкладки «Войско» / «Походы», окно подготовки набега, анимированный бой.
   Логика, сеть и бой — в village-war.js и village-sim.js. */
(function () {
  "use strict";
  if (!window.VillageWarCore) return;
  const W = VillageWarCore, A = W.A, S = W.S, UT = S.UT, U = S.UNITS, $ = id => document.getElementById(id);
  const esc = A.esc, toast = A.toast, sfx = A.sfx;
  const ico = d => `<svg class="vl-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    swords: ico('<path d="M6 18L19 5M18 18L5 5"/><path d="M4 15.5l4.5 4.5M20 15.5L15.5 20"/><path d="M5 5h4M19 5h-4"/>'),
    shield: ico('<path d="M12 3l7 3v5.5c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6z"/>'),
    coin: A.ICO.coin
  };
  const star = on => `<svg class="vw-star ${on ? "on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/></svg>`;
  const stars = n => `<span class="vw-stars">${[1, 2, 3].map(i => star(i <= n)).join("")}</span>`;
  const v0 = () => A.st();
  const targets = {};         // кэш для окна цели
  let sq = {}, cur = null, estCache = null, locks = null, battle = null;

  /* ================= вкладка «Войско» ================= */
  function unitCard(k, v) {
    const u = U[k], open = A.lv(u.need, v) >= 1, n = v.army.u[k], mul = S.mulOf(A.lv(u.need, v)), bonus = Math.round((mul - 1) * 100);
    const free = S.housing(v) - S.popAll(v), canRoom = free >= u.pop, canRoom5 = free >= u.pop * 5;
    const b1 = u.cost, b5 = u.cost * 5, coins = UI.state.coins;
    const acts = open ? `<div class="vl-card-act">
        <button type="button" class="shop-btn" data-a="wtrain" data-v="${k}:1" ${canRoom && coins >= b1 ? "" : "disabled"}>${t("vw.army.x1", { n: b1 })}</button>
        <button type="button" class="vl-rename" data-a="wtrain" data-v="${k}:5" ${canRoom5 && coins >= b5 ? "" : "disabled"}>${t("vw.army.x5", { n: b5 })}</button></div>` : "";
    return `<article class="vl-card vw-unit ${open ? "" : "locked"}"><canvas data-unit="${k}" width="120" height="120"></canvas>
      <div class="vl-card-t"><b>${t("vw.u." + k)} <em class="vl-sz">${n}</em></b><small>${esc(t("vw.u." + k + ".d"))}</small>
        <small class="vl-dim">${t("vw.army.stat", { a: Math.round(u.atk * mul), h: Math.round(u.hp * mul) })}${bonus ? " · " + t("vw.army.lvl", { n: bonus }) : ""}</small>
        ${open ? "" : `<i class="vl-need">${t("vw.army.need", { name: t("vl.b." + u.need) })}</i>`}</div>${acts}</article>`;
  }
  function armyHtml(v) {
    W.armyTick();
    const now = Date.now(), pop = S.popAll(v), cap = S.housing(v), m = W.muls(v), home = v.army.u;
    const atk = S.atkPower(home, m, W.atkPct(v)), def = S.defPower(W.defSnap(v));
    const queue = v.army.q.map((q, i) => { const left = q.end - now, cost = Math.max(1, Math.ceil(left / 60000)) * 2;
      return `<li><b>${t("vw.u." + q.t)} ×${q.n}</b><small data-end="${q.end}" data-k="q">${W.fmtT(left)}</small><button type="button" class="vl-rename" data-a="wspeed" data-v="${i}">${t("vw.army.speed", { n: cost })}</button></li>`; }).join("");
    const out = v.army.out.map(o => `<li><b>${UT.filter(k => o.u[k]).map(k => t("vw.u." + k) + " ×" + o.u[k]).join(", ")}</b><small data-end="${o.back}" data-k="o">${t("vw.army.back", { t: W.fmtT(o.back - now) })}</small></li>`).join("");
    return `<div class="vw-sum"><div><p class="vl-kicker">${t("vw.army.title")}</p><b>${t("vw.army.pop", { a: pop, b: cap })}</b></div>
        <div class="vw-sum-chips"><span class="vl-chip"><i>${IC.swords}</i>${t("vw.army.atk", { n: atk })}</span><span class="vl-chip"><i>${IC.shield}</i>${t("vw.army.def", { n: def })}</span></div></div>
      <div class="vl-bar"><i style="width:${Math.min(100, Math.round(pop / cap * 100))}%"></i></div>
      <p class="vl-found-sub">${t("vw.army.garrison")}</p>
      ${queue ? `<p class="vl-label">${t("vw.army.queue")}</p><ul class="vw-list">${queue}</ul>` : ""}
      ${out ? `<p class="vl-label">${t("vw.army.out")}</p><ul class="vw-list">${out}</ul>` : ""}
      <p class="vl-label">${t("vw.army.train")}</p><div class="vl-grid">${UT.map(k => unitCard(k, v)).join("")}</div>
      <p class="vl-label">${t("vl.folk.title")}</p>${A.folkHtml(v)}`;
  }
  function paintUnits(el) {
    const sk = VL3.SKINS[0];
    el.querySelectorAll("canvas[data-unit]").forEach(cv => {
      const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height);
      VL3.drawFigure(c, cv.dataset.unit, cv.width / 2, cv.height - 10, cv.height * 0.8, sk.teams[0], { face: 1 });
    });
  }

  /* ================= вкладка «Походы» ================= */
  function targetCard(tg, key) {
    targets[key] = tg;
    const v = v0(), mine = S.atkPower(v.army.u, W.muls(v), W.atkPct(v));
    const ratio = tg.power / Math.max(1, mine), cls = ratio < 0.7 ? "easy" : ratio < 1.15 ? "fair" : "hard";
    const sub = tg.kind === "npc" ? t("vw.war.camp") + " · " + t("vw.war.loot", { n: tg.snap.tr }) : (tg.name ? esc(tg.name) + " · " : "") + (tg.snap.tr > 0 ? t("vw.war.loot", { n: Math.floor(tg.snap.tr * 1) }) : t("vw.t.empty"));
    const btn = tg.done ? `<button type="button" class="shop-btn" disabled>${t("vw.war.done")}</button>` : `<button type="button" class="shop-btn" data-a="wopen" data-v="${key}">${t("vw.war.attack")}</button>`;
    return `<article class="vl-card vw-target ${cls}"><span class="vw-badge">${IC.swords}</span>
      <div class="vl-card-t"><b>${esc(tg.kind === "npc" ? tg.name : (tg.nick || tg.name || "?"))}</b><small>${sub}</small><small class="vl-dim">${t("vw.war.power", { n: tg.power })}${tg.rep ? " · " + t("vw.war.rep") + " " + tg.rep : ""}</small></div>${btn}</article>`;
  }
  function chronicle(v) {
    const inc = W.inbox.list.map(r => {
      const s = r.snap && r.at ? S.simulate({ u: r.au || {}, m: r.am || {}, pct: Math.min(60, +r.ap || 0) }, r.snap, +r.seed || 1) : { stars: r.stars || 0, loot: 0 };
      const when = r.at && r.at.toMillis ? new Date(r.at.toMillis()).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
      const txt = s.stars === 0 ? t("vw.war.heldN", { nick: esc(r.an || "?") }) : t("vw.war.rob", { nick: esc(r.an || "?"), n: s.loot });
      return `<li class="${s.stars === 0 ? "win" : "lose"}"><div><b>${txt}</b><small>${when} · ${stars(s.stars)}</small></div>
        <div class="vw-row-act"><button type="button" class="vl-rename" data-a="wreplay" data-v="${r.id}">${t("vw.war.replay")}</button>${r.a ? `<button type="button" class="vl-rename" data-a="wrevenge" data-v="${r.a}|${esc(r.an || "")}">${t("vw.war.revenge")}</button>` : ""}</div></li>`;
    }).join("");
    const out = v.war.log.slice().reverse().slice(0, 6).map(x => `<li><div><b>${esc(x.nick || "?")}</b><small>${new Date(x.t).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${stars(x.stars)} · +${x.loot}</small></div></li>`).join("");
    return `<p class="vl-label">${t("vw.war.chron")}</p>${inc ? `<ul class="vw-list chron">${inc}</ul>` : `<p class="vl-found-sub">${t("vw.war.chronEmpty")}</p>`}${out ? `<ul class="vw-list chron out">${out}</ul>` : ""}`;
  }
  function warHtml(v) {
    const nr = W.near, online = !!W.db();
    if (online && !nr.list && !nr.loading) W.loadNear(false);
    const camps = W.npcTargets().map((c, i) => targetCard(c, "npc" + i)).join("");
    let pl = "";
    if (!online) pl = `<p class="vl-found-sub">${t("vw.war.off")}</p>`;
    else if (nr.loading && !nr.list) pl = `<p class="vl-found-sub">${t("vw.war.loading")}</p>`;
    else if (nr.err) pl = `<p class="vl-found-sub">${t("vw.war.err", { code: esc(nr.err) })}</p>`;
    else if (!nr.list || !nr.list.length) pl = `<p class="vl-found-sub">${t("vw.war.empty")}</p>`;
    else pl = `<div class="vl-grid">${nr.list.map(x => targetCard(x, "pl:" + x.uid)).join("")}</div>`;
    const fr = nr.friends && nr.friends.length ? `<p class="vl-label">${t("vw.war.friends")}</p><div class="vl-grid">${nr.friends.map(x => targetCard(x, "pl:" + x.uid)).join("")}</div>` : "";
    const w = v.war;
    return `<div class="vw-sum"><div><p class="vl-kicker">${t("vw.war.rep")}</p><b class="vw-rep">${w.rep}</b></div><small class="vl-dim">${t("vw.war.stats", { a: w.raids, b: w.defended, c: w.loot })}</small></div>
      <p class="vl-label">${t("vw.war.camps")}</p><p class="vl-found-sub">${t("vw.war.campsSub")}</p><div class="vl-grid">${camps}</div>
      <div class="vw-h"><p class="vl-label">${t("vw.war.players")}</p>${online ? `<button type="button" class="vl-rename" data-a="wnear">${t("vw.war.refresh")}</button>` : ""}</div>${pl}${fr}
      ${online ? `<p class="vl-label">${t("vw.war.search")}</p><div class="vw-search"><input class="vl-input" id="vw-nick" maxlength="16" autocomplete="off"><button type="button" class="shop-btn" data-a="wfind">${t("vw.war.go")}</button></div><p class="vl-found-sub" id="vw-find-msg"></p>` : ""}
      ${chronicle(v)}`;
  }

  /* ================= окно цели ================= */
  function overlay() {
    let ov = $("vw-ov"); if (ov) return ov;
    ov = document.createElement("div"); ov.id = "vw-ov"; ov.className = "vw-ov";
    ov.innerHTML = `<div class="vw-card"><button type="button" class="vl-visit-x" data-w="close" aria-label="close">✕</button>
      <div class="vl-visit-head"><p class="vl-kicker" id="vw-k"></p><h3 class="vl-visit-name" id="vw-name"></h3><p class="vl-rank" id="vw-sub"></p></div>
      <div class="vl-stage vl-visit-stage"><canvas class="vl-canvas" id="vw-cv"></canvas><div class="vw-hud" id="vw-hud" hidden><span id="vw-round"></span><div class="vl-bar big wall"><i id="vw-wall"></i></div></div></div>
      <div id="vw-body"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", e => {
      if (e.target === ov || e.target.closest("[data-w=close]")) return close();
      const b = e.target.closest("[data-w]"); if (!b) return;
      const a = b.dataset.w, k = b.dataset.k;
      if (a === "inc") step(k, 1); else if (a === "dec") step(k, -1); else if (a === "max") { sq = {}; UT.forEach(x => { sq[x] = v0().army.u[x]; }); renderPrep(); }
      else if (a === "go") go(); else if (a === "skip" && battle) battle.skip();
    });
    return ov;
  }
  let scn = null;
  function ensureScene() {
    if (scn) return scn;
    scn = VL3.createScene($("vw-cv"), { readonly: true }); scn.labelFn = null; return scn;
  }
  function close() {
    const ov = $("vw-ov"); if (ov) ov.classList.remove("open");
    if (scn) { scn.clearBattle(); scn.stop(); }
    battle = null; document.body.classList.remove("vl-visiting");
    if (A.root() && A.root().classList.contains("active")) A.renderSide();
  }
  function sceneOf(tg) {
    if (tg.kind === "npc") { const o = tg.vdata; return { b: o.b, plot: o.plot, theme: o.theme, deco: [], decor: o.decor, folk: { n: 0, skin: "skin-classic" } }; }
    const d = tg.vil ? A.unpack(tg.vil) : null; return d ? A.sceneData(d) : { b: { hall: 1 }, plot: { hall: "3,3" }, theme: "theme-dusk", deco: [], decor: [], folk: { n: 0, skin: "skin-classic" } };
  }
  function openTarget(tg) {
    const v = v0(); armyTick0(); cur = tg; locks = null; estCache = null;
    sq = {}; UT.forEach(k => { sq[k] = v.army.u[k]; });
    const ov = overlay(); ov.classList.add("open"); document.body.classList.add("vl-visiting");
    $("vw-k").textContent = t("vw.atk.title"); $("vw-name").textContent = tg.kind === "npc" ? tg.name : (tg.nick || tg.name || "?");
    $("vw-sub").textContent = tg.kind === "npc" ? t("vw.war.camp") : (tg.name || "") + " · " + t("vw.war.rep") + " " + (tg.rep || 0);
    $("vw-hud").hidden = true;
    const sc = ensureScene(); sc.clearBattle(); sc.set(sceneOf(tg)); sc.overlay({ sel: null, labels: false, coins: false }); sc.setCamera({ yaw: 45, zoom: 1, mode: "iso", snap: true }); sc.start();
    renderPrep();
    if (tg.kind === "pl") W.locksFor(tg.uid).then(l => { if (cur === tg) { locks = l; renderPrep(); } });
  }
  const armyTick0 = () => W.armyTick();
  function step(k, d) {
    const v = v0(); sq[k] = Math.max(0, Math.min(v.army.u[k], MAXS(), (sq[k] || 0) + d)); estCache = null; renderPrep();
  }
  const MAXS = () => 60;
  function estimate() {
    if (estCache) return estCache; const v = v0(), tg = cur;
    const rev = !!(tg.kind === "pl" && v.war.rev[tg.uid] && Date.now() - v.war.rev[tg.uid] < 864e5);
    const A1 = { u: sq, m: W.muls(v), pct: W.atkPct(v, rev) };
    estCache = Object.assign({ rev, pow: S.atkPower(sq, A1.m, A1.pct) }, S.estimate(A1, cur.snap, 24)); return estCache;
  }
  function renderPrep() {
    const v = v0(), tg = cur, body = $("vw-body"); if (!tg || !body) return;
    const total = UT.reduce((n, k) => n + (sq[k] || 0), 0), e = total ? estimate() : null, now = Date.now();
    let block = "", sig = "";
    if (tg.kind === "pl") {
      if (!locks) sig = `<small class="vl-dim">${t("vw.war.loading")}</small>`;
      else if (locks.shield > now) { sig = `<small class="vw-warn">${t("vw.sig.shield", { t: W.fmtT(locks.shield - now) })}</small>`; block = "x"; }
      else if (locks.pair > now) { sig = `<small class="vw-warn">${t("vw.sig.pair", { t: W.fmtT(locks.pair - now) })}</small>`; block = "x"; }
      else sig = `<small class="vl-dim">${t("vw.sig.free")}</small>`;
    }
    const rows = UT.map(k => { const have = v.army.u[k]; if (!have) return "";
      return `<div class="vw-row"><canvas data-unit="${k}" width="60" height="60"></canvas><b>${t("vw.u." + k)}</b><small>${sq[k] || 0} / ${have}</small>
        <div class="vw-step"><button type="button" class="vl-tool" data-w="dec" data-k="${k}">${A.ICO.minus}</button><button type="button" class="vl-tool vl-plus" data-w="inc" data-k="${k}">${A.ICO.plus}</button></div></div>`; }).join("");
    const g = tg.snap.g, gn = UT.reduce((n, k) => n + (g[k] || 0), 0);
    const chance = e ? `<div class="vw-est"><p class="vl-label">${t("vw.atk.chance")}</p>
      <div class="vw-odds"><i class="a" style="width:${Math.round((1 - e.p[0]) * 100)}%"></i><i class="b" style="width:${Math.round((e.p[2] + e.p[3]) * 100)}%"></i><i class="c" style="width:${Math.round(e.p[3] * 100)}%"></i></div>
      <small>${t("vw.atk.chanceLine", { a: Math.round((1 - e.p[0]) * 100), b: Math.round((e.p[2] + e.p[3]) * 100), c: Math.round(e.p[3] * 100) })}</small>
      <small class="vl-dim">${t("vw.atk.exp", { n: e.loot })} · ${t("vw.atk.pow", { a: e.pow, b: tg.power })}</small>
      ${e.rev ? `<small class="vw-good">${t("vw.atk.rev")}</small>` : ""}${W.atkPct(v) ? `<small class="vw-good">${t("vw.atk.decor", { n: W.atkPct(v) })}</small>` : ""}</div>` : "";
    body.innerHTML = `<div class="vw-info"><small>${t("vw.atk.wall", { n: Math.round(tg.snap.wall) })} · ${t("vw.atk.tower", { n: tg.snap.dps })} · ${t("vw.atk.garrison", { n: gn })}</small>${sig}</div>
      <p class="vl-label">${t("vw.atk.squad")} <button type="button" class="vl-rename" data-w="max">max</button></p>
      ${rows || `<p class="vl-found-sub">${t("vw.atk.noArmy")}</p>`}${chance}
      <button type="button" class="btn btn-primary vw-go" data-w="go" ${total && !block ? "" : "disabled"}>${t("vw.atk.go")}${total ? " · " + t("vw.atk.send", { n: total }) : ""}</button>`;
    paintUnits(body);
  }
  async function go() {
    if (!cur) return; const btn = document.querySelector(".vw-go"); if (btn) { btn.disabled = true; btn.textContent = t("vw.atk.sending"); }
    const out = await W.launch(cur, Object.assign({}, sq));
    if (!out || out.error) { renderPrep(); return; }
    playBattle({ target: cur, res: out.res, A1: out.A, seed: out.seed, mine: false, rep: out.rep });
  }

  /* ================= анимация боя ================= */
  function playBattle(o) {
    const sc = ensureScene(), ex = sc.extra, snap = o.target.snap, res = o.res, ov = overlay();
    ov.classList.add("open"); document.body.classList.add("vl-visiting");
    sc.clearBattle(); sc.set(o.mine ? A.sceneData(v0()) : sceneOf(o.target)); sc.setCamera({ yaw: 45, zoom: 1, mode: "iso", snap: true });
    sc.overlay({ sel: null, labels: false, coins: false }); sc.start();
    ex.hideFolk = true; $("vw-hud").hidden = false; $("vw-k").textContent = t("vw.b.title"); $("vw-name").textContent = o.mine ? t("vw.b.mine") : $("vw-name").textContent;
    const bl = sc.blds, gateB = bl.find(b => b.id === "castle") || bl.find(b => b.id === "hall") || bl[0];
    const gx = gateB ? gateB.c + gateB.f[0] / 2 : 4, gy = gateB ? gateB.r + gateB.f[1] / 2 : 4;
    const shooters = bl.filter(b => b.id === "towers" || b.id === "castle"); const sh = shooters.length ? shooters : (gateB ? [gateB] : []);
    const rnd = S.rng32((o.seed || 1) ^ 0x9e3779b9), wallMax = Math.max(1, snap.wall);
    // отряд на экране: до 14 фигурок, остальное — «масштаб»
    const sqd = o.A1.u, total = UT.reduce((n, k) => n + (sqd[k] || 0), 0), scaleA = total > 14 ? 14 / total : 1;
    const shownA = {}; let ai = 0; const atk = [];
    UT.forEach(k => { shownA[k] = Math.max(sqd[k] ? 1 : 0, Math.round((sqd[k] || 0) * scaleA)); for (let i = 0; i < shownA[k]; i++) {
      const y = Math.max(0.6, Math.min(7.4, gy - 2.4 + ((ai * 0.57) % 4.8)));
      atk.push({ type: k, team: 0, x: -1.6 - (ai % 2) * 0.5, y, tx: gx - 1.7 - (ai % 3) * 0.38, ty: gy + (y - gy) * 0.55, face: 1, alive: true, hpMax: 1, hp: 1 }); ai++; } });
    const totG = UT.reduce((n, k) => n + (snap.g[k] || 0), 0), scaleG = totG > 8 ? 8 / totG : 1, shownG = {}; const def = [];
    UT.forEach(k => { shownG[k] = Math.round((snap.g[k] || 0) * scaleG); for (let i = 0; i < shownG[k]; i++) {
      const a = rnd() * 6.28, r = 0.9 + rnd() * 0.9; def.push({ type: k, team: 1, x: gx + Math.cos(a) * r + 0.3, y: gy + Math.sin(a) * r, face: -1, alive: true, hpMax: 1, hp: 1 }); } });
    atk.forEach(u => { u.tx0 = u.tx; ex.units.push(u); u.x = u.x; }); def.forEach(u => { u.tx = u.x; u.ty = u.y; ex.units.push(u); });
    const events = []; let T = 1.3; const RD = 1.35; let prevA = Object.assign({}, shownA), prevG = Object.assign({}, shownG);
    const setWall = w => { $("vw-wall").style.width = Math.max(0, Math.round(w / wallMax * 100)) + "%"; };
    setWall(wallMax); $("vw-round").textContent = "";
    const pickAlive = list => { const a = list.filter(u => u.alive); return a.length ? a[Math.floor(rnd() * a.length)] : null; };
    const kill = (list, type, n) => { let c = 0; list.forEach(u => { if (c < n && u.alive && u.type === type) { u.alive = false; u.dying = 1; u.hit = 1; c++; } }); };
    // марш
    events.push({ t: 0.05, fn: () => atk.forEach(u => { u.moving = true; }) });
    res.rounds.forEach((rd, i) => {
      const t0 = T + i * RD;
      events.push({ t: t0, fn: () => { $("vw-round").textContent = t("vw.b.round", { n: rd.r }); } });
      // атака по воротам
      events.push({ t: t0 + 0.15, fn: () => {
        const al = atk.filter(u => u.alive).slice(0, 5);
        al.forEach((u, j) => sc.fx({ k: "shot", x0: u.x, y0: u.y, z0: 0.35, x1: gx - 0.5 + rnd() * 0.5, y1: gy - 0.5 + rnd(), z1: 0.4, arc: 0.45, dur: 0.45, delay: j * 0.06, c: "#ff9b8a" }));
      } });
      events.push({ t: t0 + 0.55, fn: () => {
        sfx("move"); sc.fx({ k: "burst", x: gx - 0.2, y: gy, z: 0.4, dur: 0.5, c: "#ffb86a" });
        if (rd.hitW > 0) sc.fx({ k: "text", x: gx, y: gy, z: 0.9, s: "−" + rd.hitW, c: "#ffd27a", dur: 1, big: true });
        const m = ex.marks[gateB && gateB.id] = ex.marks[gateB && gateB.id] || { shake: 0, burn: 0 }; m.shake = 1; m.burn = Math.min(1, 1 - rd.wall / wallMax);
        setWall(rd.wall);
        // потери защитников
        UT.forEach(k => { const want = Math.min(shownG[k], rd.d[k] > 0 ? Math.max(1, Math.round(rd.d[k] * scaleG)) : 0); const lost = prevG[k] - want; if (lost > 0) { kill(def, k, lost); prevG[k] = want; } });
      } });
      // ответ обороны
      events.push({ t: t0 + 0.8, fn: () => {
        const shots = Math.min(5, Math.max(2, sh.length * 2));
        for (let j = 0; j < shots; j++) { const b = sh[j % sh.length], tgt = pickAlive(atk); if (!b || !tgt) break;
          sc.fx({ k: "shot", x0: b.c + b.f[0] / 2, y0: b.r + b.f[1] / 2, z0: b.m.top + 0.05, x1: tgt.x, y1: tgt.y, z1: 0.3, arc: 0.3, dur: 0.38, delay: j * 0.07, c: "#fff0a8" });
          sc.fx({ k: "burst", x: tgt.x, y: tgt.y, z: 0.3, dur: 0.4, delay: 0.38 + j * 0.07, c: "#fff0a8" }); tgt.hit = 1; }
        if (rd.hitA > 0) sc.fx({ k: "text", x: gx - 1.8, y: gy, z: 0.9, s: "−" + rd.hitA, c: "#ff8a8a", dur: 1 });
      } });
      events.push({ t: t0 + 1.15, fn: () => { UT.forEach(k => { const want = rd.a[k] > 0 ? Math.max(1, Math.round(rd.a[k] * scaleA)) : 0; const lost = prevA[k] - Math.min(prevA[k], want); if (lost > 0) { kill(atk, k, lost); prevA[k] -= lost; } }); } });
    });
    const tEnd = T + res.rounds.length * RD + 0.4;
    events.push({ t: tEnd, fn: () => {
      if (res.breach) { sc.fx({ k: "text", x: gx, y: gy, z: 1.1, s: t("vw.b.breach"), c: "#ffd27a", dur: 1.6, big: true }); for (let i = 0; i < 6; i++) sc.fx({ k: "coin", x0: gx, y0: gy, x1: -1, y1: gy, dur: 1, delay: i * 0.12 }); sfx("win"); }
      else sc.fx({ k: "text", x: gx, y: gy, z: 1.1, s: t("vw.b.held"), c: "#a8d8ff", dur: 1.6, big: true });
    } });
    events.push({ t: tEnd + 1.5, fn: () => finish(o) });
    events.sort((a, b) => a.t - b.t);
    let time = 0, idx = 0, done = false;
    sc.onTick = dt => {
      time += dt;
      while (idx < events.length && events[idx].t <= time) events[idx++].fn();
      ex.units.forEach(u => {
        if (u.hit > 0) u.hit = Math.max(0, u.hit - dt * 2.5);
        if (u.dying) { u.alpha = Math.max(0, (u.alpha == null ? 1 : u.alpha) - dt * 1.8); u.dy = (u.dy || 0) - dt * 14; return; }
        if (u.team === 0 && u.moving) { const k = 1 - Math.pow(0.15, dt), dx = u.tx - u.x, dyy = u.ty - u.y; u.x += dx * k; u.y += dyy * k; u.hop = Math.abs(dx) + Math.abs(dyy) > 0.15 ? Math.abs(Math.sin(sc.t * 9 + u.y)) * 0.12 : 0; }
        if (u.team === 0 && !u.dying) { u.face = 1; }
      });
      for (const k in ex.marks) { const m = ex.marks[k]; m.shake = Math.max(0, m.shake - dt * 2.2); }
    };
    battle = { skip() { if (done) return; time = 1e6; while (idx < events.length) events[idx++].fn(); } };
    const prep = $("vw-body"); prep.innerHTML = `<div class="vw-bat-bar"><button type="button" class="btn btn-ghost" data-w="skip">${t("vw.b.skip")}</button></div>`;
    function finish(oo) {
      if (done) return; done = true;
      const lostN = UT.reduce((n, k) => n + (res.lost[k] || 0), 0);
      $("vw-body").innerHTML = `<div class="vw-result r${res.stars}">${stars(res.stars)}<h3>${t("vw.b.res" + res.stars)}</h3>
        ${oo.mine ? `<p>${t("vw.war.rob", { nick: esc(oo.nick || "?"), n: res.loot })}</p>` : `<p class="vw-loot">${A.ICO.coin}<b>${t("vw.b.loot", { n: res.loot })}</b></p><p class="vl-dim">${t("vw.b.lost", { n: lostN })} · ${t("vw.b.rep", { n: (oo.rep > 0 ? "+" : "") + (oo.rep || 0) })}</p>`}
        <button type="button" class="btn btn-primary" data-w="close">${t("vw.b.close")}</button></div>`;
    }
  }
  function replay(id) {
    const r = W.inbox.list.find(x => x.id === id); if (!r || !r.snap) return;
    const A1 = { u: r.au || {}, m: r.am || {}, pct: Math.min(60, +r.ap || 0) }, seed = +r.seed || 1, res = S.simulate(A1, r.snap, seed);
    $("vw-hud") || overlay();
    playBattle({ target: { snap: r.snap }, res, A1, seed, mine: true, nick: r.an });
  }
  async function revenge(uidNick) {
    const [uid, nick] = uidNick.split("|"), d = W.db(); if (!d) return;
    try { const s = await d.collection("villages").doc(uid).get(); if (!s.exists) { toast("vw.war.nofound"); return; } const tg = W.fromDoc(uid, s.data()); targets["pl:" + uid] = tg; openTarget(tg); }
    catch (e) { toast("vw.war.err", { code: e.code || "?" }); }
  }
  async function findNick() {
    const inp = $("vw-nick"), msg = $("vw-find-msg"); if (!inp || !inp.value.trim()) return;
    msg.textContent = t("vw.war.loading");
    try { const tg = await W.findByNick(inp.value.trim()); if (!tg) { msg.textContent = t("vw.war.nofound"); return; } msg.textContent = ""; targets["pl:" + tg.uid] = tg; openTarget(tg); }
    catch (e) { msg.textContent = t("vw.war.err", { code: e.code || "?" }); }
  }

  /* ================= регистрация плагина ================= */
  Village.use({
    tabs: ["army", "war"],
    html: (tab, v) => tab === "army" ? armyHtml(v) : warHtml(v),
    after: (tab, el) => { if (tab === "army") paintUnits(el); },
    act: (a, val) => {
      if (a === "wtrain") { const [k, n] = val.split(":"); W.train(k, +n); }
      else if (a === "wspeed") W.speedUp(+val);
      else if (a === "wopen") { const tg = targets[val]; if (tg && !tg.done) openTarget(tg); }
      else if (a === "wnear") { W.loadNear(true); A.renderSide(); }
      else if (a === "wfind") findNick();
      else if (a === "wreplay") replay(val);
      else if (a === "wrevenge") revenge(val);
    },
    tick: () => {
      document.querySelectorAll("[data-end]").forEach(el => { const left = +el.dataset.end - Date.now(); el.textContent = el.dataset.k === "o" ? t("vw.army.back", { t: W.fmtT(left) }) : W.fmtT(left); });
    },
    visit: (uid, d, data, vEl) => {
      const old = vEl.querySelector(".vw-visit-atk"); if (old) old.remove();
      if (!W.db() || uid === W.me()) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-primary vw-visit-atk"; b.textContent = t("vw.war.attack");
      b.addEventListener("click", () => revenge(uid + "|" + ((d && d.nick) || "")).then(() => { vEl.classList.remove("open"); }));
      const back = vEl.querySelector(".vl-visit-back"); back.parentNode.insertBefore(b, back);
    }
  });
  window.VillageWar = { openTarget, playBattle, replay };
})();
