/* maper.chess — вкладка «Декор»: склад предметов, расстановка по клеткам, базар с ротацией, коллекция.
   Предметы приходят с базара за монеты и из наград. Каждый предмет даёт бонус (см. village-props.js). */
(function () {
  "use strict";
  if (!window.Village || !window.VDECOR) return;
  const A = Village.api, D = VDECOR, $ = id => document.getElementById(id);
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "vd.title": "Decorations", "vd.placed": "Placed {a} of {b}", "vd.bonus": "Bonuses from decor", "vd.none": "No bonuses yet — place something.",
    "vd.stock": "In storage", "vd.stockEmpty": "Storage is empty. Visit the bazaar.", "vd.place": "Place", "vd.more": "×{n}",
    "vd.bazaar": "Bazaar", "vd.bazaarSub": "New goods every 6 hours. The first lot is 30% off.", "vd.refresh": "Refresh in {t}", "vd.buy": "Buy · {n}", "vd.sold": "Sold",
    "vd.bought": "Bought: {name}", "vd.collection": "Collection", "vd.owned": "{a} of {b} collected", "vd.wheelOnly": "Wheel only", "vd.pick": "Selected decoration",
    "vd.remove": "Put in storage", "vd.move": "Move", "vd.removed": "{name} is back in storage", "vd.limit": "Decoration limit reached — upgrade the Town Hall",
    "vd.sell": "Sell spare · {n}", "vd.sold1": "Sold {name}: +{n}", "vd.noStock": "You have none of these", "vd.themes": "Sky and light", "vd.placedOk": "{name} placed",
    "vd.eff": "effective {n}"
  }, {
    "vd.title": "Декор", "vd.placed": "Расставлено {a} из {b}", "vd.bonus": "Бонусы от декора", "vd.none": "Пока без бонусов — поставьте что-нибудь.",
    "vd.stock": "На складе", "vd.stockEmpty": "Склад пуст. Загляните на базар.", "vd.place": "Поставить", "vd.more": "×{n}",
    "vd.bazaar": "Базар", "vd.bazaarSub": "Новый товар каждые 6 часов. Первый лот — со скидкой 30%.", "vd.refresh": "Обновится через {t}", "vd.buy": "Купить · {n}", "vd.sold": "Продано",
    "vd.bought": "Куплено: {name}", "vd.collection": "Коллекция", "vd.owned": "Собрано {a} из {b}", "vd.wheelOnly": "Только из колеса", "vd.pick": "Выбранный предмет",
    "vd.remove": "Убрать на склад", "vd.move": "Переставить", "vd.removed": "{name} — снова на складе", "vd.limit": "Лимит декора — улучшите ратушу",
    "vd.sell": "Продать лишнее · {n}", "vd.sold1": "Продано: {name} +{n}", "vd.noStock": "Таких нет", "vd.themes": "Небо и свет", "vd.placedOk": "Поставлено: {name}",
    "vd.eff": "действует {n}"
  });
  const esc = A.esc, toast = A.toast;
  const cache = {};
  let sel = null;           // выбранный на поле предмет {id,c,r}

  function thumb(id) {
    if (cache[id] !== undefined) return cache[id];
    try {
      const S = 200, cv = document.createElement("canvas"); cv.width = cv.height = S;
      const sc = VL3.createScene(cv, { fixedCam: true, size: [S, S], dpr: 1 });
      sc.set({ b: {}, plot: {}, theme: "theme-dusk", deco: [], decor: [{ id, c: 3, r: 3 }], folk: { n: 0, skin: "skin-classic" } });
      sc.setCamera({ yaw: 45, zoom: 11.5 * (S / 112), mode: "iso", snap: true, fx: 3.5, fy: 3.5, nobg: true });
      sc.overlay({ labels: false }); sc.once(0);
      cache[id] = cv.toDataURL("image/png");
    } catch (e) { cache[id] = ""; }
    return cache[id];
  }
  const inv = v => v.decor.inv;
  const placedCount = v => v.decor.placed.length;
  function bonuses(v) {
    const o = { inc: 0, def: 0, atk: 0, cap: 0, safe: 0 };
    v.decor.placed.forEach(x => { const d = D.BY_ID[x.id]; if (d) o[d.perk[0]] += d.perk[1]; });
    ["inc", "atk", "safe"].forEach(k => { o[k + "Raw"] = o[k]; o[k] = Math.min(D.CAPS[k], o[k]); });
    return o;
  }
  const perkTxt = d => I18N_t("vd.p." + d.perk[0], { n: d.perk[1] });
  const I18N_t = (k, o) => t(k, o);
  const rarTag = d => `<i class="vd-rar r${d.rar}" style="--rc:${D.RAR_COL[d.rar]}">${t("vd.rar." + D.RAR_KEYS[d.rar])}</i>`;

  /* ---------- склад: добавление предметов (базар, награды) ---------- */
  function give(id, n) {
    const v = A.st(); if (!D.BY_ID[id]) return false;
    v.decor.inv[id] = Math.min(99, (v.decor.inv[id] || 0) + (n || 1)); return true;
  }
  /* случайный предмет нужной редкости; сначала те, которых у игрока нет совсем */
  function pickFor(rar, rnd) {
    const v = A.st(); let pool = D.LIST.filter(d => d.rar === rar);
    if (!pool.length) pool = D.LIST.filter(d => Math.abs(d.rar - rar) === 1);
    const has = d => (v.decor.inv[d.id] || 0) + v.decor.placed.filter(x => x.id === d.id).length;
    const fresh = pool.filter(d => !has(d));
    const from = fresh.length && rnd() < 0.8 ? fresh : pool;
    return from[Math.floor(rnd() * from.length)];
  }

  /* ---------- расстановка ---------- */
  function startPlace(id) {
    const v = A.st();
    if (!(inv(v)[id] > 0)) { toast("vd.noStock"); return; }
    if (placedCount(v) >= A.decorCap(v)) { toast("vd.limit"); return; }
    sel = null; A.setPlacing({ id, decor: true });
  }
  function dropDecor(c, r) {
    const v = A.st(), pl = A.getPlacing(); if (!pl || !pl.decor) return;
    if (placedCount(v) >= A.decorCap(v)) { toast("vd.limit"); A.setPlacing(null); return; }
    if (!(inv(v)[pl.id] > 0)) { A.setPlacing(null); return; }
    if (!A.decorFree(v, c, r)) { toast("vl.tileBusy"); A.sfx("err"); return; }
    v.decor.placed.push({ id: pl.id, c, r }); inv(v)[pl.id]--; if (inv(v)[pl.id] <= 0) delete inv(v)[pl.id];
    A.cum("decor"); A.sfx("move"); A.persist(); A.sync();
    toast("vd.placedOk", { name: t("vd." + pl.id) });
    if (inv(v)[pl.id] > 0 && placedCount(v) < A.decorCap(v)) { A.renderSide(); } else A.setPlacing(null);
  }
  function pickDecor(h) {
    sel = { id: h.id, c: h.c, r: h.r }; A.go("deco"); A.syncOverlay(); return true;
  }
  function takeBack() {
    const v = A.st(); if (!sel) return;
    const i = v.decor.placed.findIndex(x => x.c === sel.c && x.r === sel.r); if (i < 0) { sel = null; return; }
    const it = v.decor.placed.splice(i, 1)[0]; give(it.id, 1); sel = null;
    A.persist(); A.sync(); A.renderSide(); toast("vd.removed", { name: t("vd." + it.id) });
  }
  function moveSel() {
    const v = A.st(); if (!sel) return;
    const i = v.decor.placed.findIndex(x => x.c === sel.c && x.r === sel.r); if (i < 0) return;
    const it = v.decor.placed.splice(i, 1)[0]; give(it.id, 1); sel = null; A.persist(); A.sync(); startPlace(it.id);
  }

  /* ---------- базар ---------- */
  const SLOT = 6 * 3600 * 1000;
  function bazaar(v) {
    const slot = Math.floor(Date.now() / SLOT);
    if (v.bazaar.slot !== slot) { v.bazaar.slot = slot; v.bazaar.bought = []; A.save(); }
    const r = VSIM.rng32(VSIM.hashStr(slot + "|" + (UI.state.nick || v.name || "x")));
    const pool = D.LIST.filter(d => d.shop > 0), W = [6, 5, 3, 1, 0], out = [];
    while (out.length < 4 && out.length < pool.length) {
      const cand = pool.filter(d => !out.includes(d)), tot = cand.reduce((n, d) => n + W[d.rar], 0);
      let x = r() * tot; let pick = cand[cand.length - 1]; for (const d of cand) { x -= W[d.rar]; if (x < 0) { pick = d; break; } }
      out.push(pick);
    }
    return out.map((d, i) => ({ d, price: i === 0 ? Math.round(d.shop * 0.7) : d.shop, sale: i === 0 }));
  }
  function buy(id) {
    const v = A.st(), o = bazaar(v).find(x => x.d.id === id); if (!o || v.bazaar.bought.includes(id)) return;
    if (UI.state.coins < o.price) { toast("vl.noCoins"); return; }
    UI.state.coins -= o.price; v.bazaar.bought.push(id); give(id, 1); try { A.emit("deco", 1); } catch (e) {} A.sfx("coin"); A.persist(); A.renderSide(); toast("vd.bought", { name: t("vd." + id) });
  }
  function sellSpare(id) {
    const v = A.st(), d = D.BY_ID[id]; if (!d || !(inv(v)[id] > 0)) return;
    const n = D.SELL[d.rar]; inv(v)[id]--; if (inv(v)[id] <= 0) delete inv(v)[id]; UI.state.coins += n; A.sfx("coin"); A.persist(); A.renderSide(); toast("vd.sold1", { name: t("vd." + id), n });
  }
  const left = ms => { const m = Math.max(0, Math.ceil(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };

  /* ---------- разметка ---------- */
  function card(d, extra, right) {
    return `<article class="vl-card vd-card r${d.rar}"><img class="vl-thumb" alt="" src="${thumb(d.id)}">
      <div class="vl-card-t"><b>${esc(t("vd." + d.id))} ${rarTag(d)}</b><small>${esc(perkTxt(d))}</small>${extra || ""}</div>${right || ""}</article>`;
  }
  function html(tabName, v) {
    const b = bonuses(v), cap = A.decorCap(v);
    const chips = [["inc", b.inc], ["def", b.def], ["atk", b.atk], ["cap", b.cap], ["safe", b.safe]].filter(x => x[1] > 0).map(x => `<span class="vl-chip">${esc(t("vd.p." + x[0], { n: x[1] }))}</span>`).join("");
    let selHtml = "";
    if (sel) {
      const it = v.decor.placed.find(x => x.c === sel.c && x.r === sel.r), d = it && D.BY_ID[it.id];
      if (d) selHtml = `<div class="vl-inspect"><p class="vl-kicker">${t("vd.pick")}</p>${card(d)}<div class="vl-inspect-act">
        <button type="button" class="shop-btn" data-a="dmove">${t("vd.move")}</button><button type="button" class="vl-rename" data-a="dtake">${t("vd.remove")}</button></div></div>`;
      else sel = null;
    }
    const stock = D.LIST.filter(d => inv(v)[d.id] > 0).map(d => card(d, `<small class="vl-dim">${t("vd.more", { n: inv(v)[d.id] })}</small>`,
      `<div class="vl-card-act"><button type="button" class="shop-btn" data-a="dplace" data-v="${d.id}">${t("vd.place")}</button>${inv(v)[d.id] > 1 ? `<button type="button" class="vl-rename" data-a="dsell" data-v="${d.id}">${t("vd.sell", { n: D.SELL[d.rar] })}</button>` : ""}</div>`)).join("");
    const bz = bazaar(v), mid = (Math.floor(Date.now() / SLOT) + 1) * SLOT - Date.now();
    const bzHtml = bz.map(o => { const sold = v.bazaar.bought.includes(o.d.id);
      return card(o.d, o.sale ? `<small class="vd-sale">−30%</small>` : "", `<button type="button" class="shop-btn" data-a="dbuy" data-v="${o.d.id}" ${sold ? "disabled" : ""}>${sold ? t("vd.sold") : t("vd.buy", { n: o.price })}</button>`); }).join("");
    const have = id => (inv(v)[id] || 0) + v.decor.placed.filter(x => x.id === id).length;
    const owned = D.LIST.filter(d => have(d.id) > 0).length;
    const coll = D.LIST.map(d => `<div class="vd-cell r${d.rar} ${have(d.id) ? "on" : ""}" title="${esc(t("vd." + d.id))}" style="--rc:${D.RAR_COL[d.rar]}">
      ${have(d.id) ? `<img alt="" src="${thumb(d.id)}">` : `<span>?</span>`}${have(d.id) > 1 ? `<em>${have(d.id)}</em>` : ""}</div>`).join("");
    return `${selHtml}
      <div class="vd-head"><div><p class="vl-kicker">${t("vd.title")}</p><b>${t("vd.placed", { a: placedCount(v), b: cap })}</b></div></div>
      <div class="vl-bar"><i style="width:${Math.round(placedCount(v) / cap * 100)}%"></i></div>
      <p class="vl-label">${t("vd.bonus")}</p><div class="vl-visit-chips">${chips || `<small class="vl-dim">${t("vd.none")}</small>`}</div>
      <p class="vl-label">${t("vd.stock")}</p>${stock ? `<div class="vl-grid">${stock}</div>` : `<p class="vl-found-sub">${t("vd.stockEmpty")}</p>`}
      <p class="vl-label">${t("vd.bazaar")} · <span class="vl-dim">${t("vd.refresh", { t: left(mid) })}</span></p><p class="vl-found-sub">${t("vd.bazaarSub")}</p><div class="vl-grid">${bzHtml}</div>
      <p class="vl-label">${t("vd.collection")} · <span class="vl-dim">${t("vd.owned", { a: owned, b: D.LIST.length })}</span></p><div class="vd-coll">${coll}</div>
      <p class="vl-label">${t("vd.themes")}</p>${A.themesHtml(v)}`;
  }
  function act(a, val) {
    if (a === "dplace") startPlace(val); else if (a === "dbuy") buy(val); else if (a === "dtake") takeBack(); else if (a === "dmove") moveSel(); else if (a === "dsell") sellSpare(val);
  }
  Village.use({ tabs: ["deco"], html, act, dropDecor, pickDecor, tick: () => { }, after: () => { } });
  window.VillageDecor = { give, pickFor, bonuses, thumb };
})();
