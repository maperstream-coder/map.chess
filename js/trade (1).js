/* maper.chess — «Обмен»: игроки-друзья меняются коинами, подсказками, заморозками и оформлениями.
   Живёт во вкладке «Ещё». Load AFTER friends.js / duels.js, BEFORE app.js.

   Как это работает (всё через Firestore, коллекция trades):
   trades/{id} = { from, fromNick, to, toNick,
                   give:{coins,hints,freezes,items[]}   — что отдаёт автор предложения
                   take:{coins,hints,freezes,items[]}   — что автор хочет получить взамен
                   status:"pending"|"accepted"|"declined"|"cancelled",
                   pend:[uid…]  — кому ещё нужно получить свою часть (атомарно снимается транзакцией),
                   createdAt, updatedAt }
   • Автор при отправке СРАЗУ «замораживает» (списывает) то, что отдаёт — отдать одно и то же дважды нельзя.
   • Получатель при принятии мгновенно меняет свой инвентарь, транзакция переводит предложение в accepted.
   • Автор получает свою часть (или возврат при отказе/отмене) — клиент делает это сам, один раз,
     с журналом в localStorage, чтобы ничего не потерялось и не задвоилось.                              */
(function () {
  "use strict";
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nav.trade": "Trade", "tr.title": "Trade", "tr.sub": "Swap coins, hints, freezes and skins with your friends",
    "tr.tabNew": "New", "tr.tabIn": "Incoming", "tr.tabMine": "My offers",
    "tr.friend": "Trade with", "tr.pickFriend": "Choose a friend",
    "tr.youGive": "You give", "tr.youGet": "You want", "tr.have": "You have",
    "tr.coins": "Coins", "tr.hints": "Hints", "tr.freezes": "Freezes", "tr.skins": "Skins",
    "tr.board": "Board", "tr.pieces": "Pieces", "tr.max": "Max",
    "tr.send": "Send offer", "tr.sent": "Offer sent!", "tr.empty": "Nothing here yet",
    "tr.emptyIn": "No incoming offers", "tr.emptyMine": "You haven't sent any offers",
    "tr.accept": "Accept", "tr.decline": "Decline", "tr.cancel": "Withdraw",
    "tr.st.pending": "Waiting", "tr.st.accepted": "Completed", "tr.st.declined": "Declined", "tr.st.cancelled": "Withdrawn",
    "tr.noFriends": "Add friends first — trades are only between friends (Friends tab)",
    "tr.noSkins": "You have no skins to trade yet", "tr.noWant": "You already own every skin",
    "tr.off": "Sign in to trade", "tr.notFriend": "You are not friends with this player",
    "tr.nothing": "Add something to at least one side",
    "tr.giveNothing": "Offer something — a free gift is fine, but not an empty trade",
    "tr.poor": "Not enough: {item}", "tr.cap": "You can hold at most {n} freezes",
    "tr.itemOwned": "You already own: {item}", "tr.theyCap": "Freezes: the other player can hold at most {n}",
    "tr.gives": "Gives", "tr.wants": "Wants", "tr.gift": "Nothing — a gift", "tr.free": "nothing",
    "tr.you": "You", "tr.sendTo": "to {name}", "tr.from": "from {name}",
    "tr.done": "Trade complete!", "tr.got": "You received: {x}", "tr.back": "Returned to you: {x}",
    "tr.err": "Trade failed ({code})", "tr.gone": "This offer is no longer available",
    "tr.confirmAccept": "Accept this trade?", "tr.summary": "Summary",
    "tr.ago.m": "{n} min ago", "tr.ago.h": "{n} h ago", "tr.ago.d": "{n} d ago", "tr.ago.now": "just now",
    "tr.newOffer": "New trade offer from {name}", "tr.pickHint": "Pick a friend, then choose what each side puts in.",
    "tr.rules": "Skins you give away are removed from your collection. Coins, hints and freezes are held while the offer is open and returned if it is declined or withdrawn.",
    "tr.loading": "Loading…"
  }, {
    "nav.trade": "Обмен", "tr.title": "Обмен", "tr.sub": "Меняйтесь с друзьями коинами, подсказками, заморозками и оформлениями",
    "tr.tabNew": "Новый", "tr.tabIn": "Входящие", "tr.tabMine": "Мои",
    "tr.friend": "Обмен с", "tr.pickFriend": "Выберите друга",
    "tr.youGive": "Вы отдаёте", "tr.youGet": "Вы хотите", "tr.have": "У вас",
    "tr.coins": "Коины", "tr.hints": "Подсказки", "tr.freezes": "Заморозки", "tr.skins": "Оформления",
    "tr.board": "Доска", "tr.pieces": "Фигуры", "tr.max": "Всё",
    "tr.send": "Отправить предложение", "tr.sent": "Предложение отправлено!", "tr.empty": "Здесь пока пусто",
    "tr.emptyIn": "Входящих предложений нет", "tr.emptyMine": "Вы ещё не отправляли предложений",
    "tr.accept": "Принять", "tr.decline": "Отклонить", "tr.cancel": "Отозвать",
    "tr.st.pending": "Ждёт ответа", "tr.st.accepted": "Завершён", "tr.st.declined": "Отклонён", "tr.st.cancelled": "Отозван",
    "tr.noFriends": "Сначала добавьте друзей — обмен только между друзьями (вкладка «Друзья»)",
    "tr.noSkins": "У вас пока нет оформлений для обмена", "tr.noWant": "У вас уже есть все оформления",
    "tr.off": "Войдите, чтобы обмениваться", "tr.notFriend": "Вы не друзья с этим игроком",
    "tr.nothing": "Добавьте что-нибудь хотя бы с одной стороны",
    "tr.giveNothing": "Что-то нужно предложить — подарить можно, а вот пустой обмен нельзя",
    "tr.poor": "Не хватает: {item}", "tr.cap": "Заморозок может быть не больше {n}",
    "tr.itemOwned": "У вас это уже есть: {item}", "tr.theyCap": "Заморозки: у друга может быть не больше {n}",
    "tr.gives": "Отдаёт", "tr.wants": "Хочет", "tr.gift": "Ничего — это подарок", "tr.free": "ничего",
    "tr.you": "Вы", "tr.sendTo": "для {name}", "tr.from": "от {name}",
    "tr.done": "Обмен завершён!", "tr.got": "Вы получили: {x}", "tr.back": "Вернулось к вам: {x}",
    "tr.err": "Обмен не удался ({code})", "tr.gone": "Это предложение уже недоступно",
    "tr.confirmAccept": "Принять этот обмен?", "tr.summary": "Итог",
    "tr.ago.m": "{n} мин назад", "tr.ago.h": "{n} ч назад", "tr.ago.d": "{n} дн. назад", "tr.ago.now": "только что",
    "tr.newOffer": "Новое предложение обмена от {name}", "tr.pickHint": "Выберите друга, затем — что кладёт каждая сторона.",
    "tr.rules": "Оформления, которые вы отдаёте, пропадают из вашей коллекции. Коины, подсказки и заморозки замораживаются, пока предложение открыто, и возвращаются при отказе или отзыве.",
    "tr.loading": "Загрузка…"
  });

  const $ = id => document.getElementById(id);
  const me = () => (typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user) ? Cloud.user.uid : null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtN = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
  const col = () => Cloud._db.collection("trades");
  const FV = () => firebase.firestore.FieldValue;
  const MAX_COINS = 1000000, MAX_HINTS = 100, MAX_ITEMS = 12;
  const maxFreezes = () => (typeof STREAK_CONFIG !== "undefined" && STREAK_CONFIG.maxFreezes) || 2;

  /* ================= инвентарь (под реальную структуру state) ================= */
  const emptyPack = () => ({ coins: 0, hints: 0, freezes: 0, items: [] });
  const norm = p => {
    p = p || {};
    return {
      coins: Math.max(0, Math.min(MAX_COINS, Math.floor(+p.coins || 0))),
      hints: Math.max(0, Math.min(MAX_HINTS, Math.floor(+p.hints || 0))),
      freezes: Math.max(0, Math.min(10, Math.floor(+p.freezes || 0))),
      items: Array.isArray(p.items) ? p.items.filter(x => typeof x === "string").slice(0, MAX_ITEMS) : []
    };
  };
  const isEmpty = p => !p.coins && !p.hints && !p.freezes && !p.items.length;

  const shopItem = id => (typeof SHOP_ITEMS !== "undefined" ? SHOP_ITEMS : []).find(i => i.id === id);
  const tradable = id => {
    const it = shopItem(id), def = (typeof DEFAULT_OWNED !== "undefined" ? DEFAULT_OWNED : []);
    return !!it && (it.type === "board" || it.type === "pieces") && !def.includes(id);
  };
  const itemName = id => { const it = shopItem(id); if (!it) return id; const n = t(it.nameKey); return n === it.nameKey ? id : n; };

  const Inv = {
    coins: s => Math.max(0, Math.floor(+s.coins || 0)),
    hints: s => Math.max(0, Math.floor(+(s.hints && s.hints.left) || 0)),
    freezes: s => Math.max(0, Math.floor(+(s.streak && s.streak.freezes) || 0)),
    owned: s => Array.isArray(s.owned) ? s.owned : (s.owned = []),
    mine: s => Inv.owned(s).filter(tradable),
    /* чего не хватает, чтобы ОТДАТЬ pack */
    lacking(s, p) {
      if (p.coins > this.coins(s)) return "coins";
      if (p.hints > this.hints(s)) return "hints";
      if (p.freezes > this.freezes(s)) return "freezes";
      const o = this.owned(s);
      for (const id of p.items) if (!o.includes(id) || !tradable(id)) return "item:" + id;
      return null;
    },
    /* можно ли ПОЛУЧИТЬ pack (после того, как отдадим give) */
    blocked(s, get, give) {
      const o = this.owned(s);
      if (this.freezes(s) - (give ? give.freezes : 0) + get.freezes > maxFreezes()) return "cap";
      for (const id of get.items) if (o.includes(id) && !(give && give.items.includes(id))) return "item:" + id;
      return null;
    },
    /* применить: −give +get. Лишнее сверх лимитов не теряется молча — возвращает, что не уместилось */
    apply(s, give, get) {
      const lost = [];
      s.coins = Math.max(0, this.coins(s) - give.coins + get.coins);
      s.hints = Object.assign({ left: 0, day: null }, s.hints || {});
      s.hints.left = Math.max(0, this.hints(s) - give.hints + get.hints);
      s.streak = s.streak || { count: 0, best: 0, lastDay: null, freezes: 0, history: {} };
      const fz = this.freezes(s) - give.freezes + get.freezes;
      s.streak.freezes = Math.max(0, Math.min(maxFreezes(), fz));
      if (fz > maxFreezes()) lost.push("freezes");
      const o = this.owned(s);
      give.items.forEach(id => {
        const i = o.indexOf(id); if (i >= 0) o.splice(i, 1);
        if (s.equipped) Object.keys(s.equipped).forEach(k => {          /* отдали надетое — возвращаем стандартное */
          if (s.equipped[k] === id) s.equipped[k] = k === "board" ? "board-classic" : "pieces-classic";
        });
      });
      get.items.forEach(id => { if (!o.includes(id)) o.push(id); else lost.push(id); });
      saveState(s);
      try { if (UI._applyTheme) UI._applyTheme(); } catch (e) {}
      UI.renderTopbar();
      return lost;
    }
  };

  /* ================= показ пакетов ================= */
  const ICON_HINT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21.2h4M12 3a6.2 6.2 0 0 0-3.6 11.3c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6.2 6.2 0 0 0 12 3z"/></svg>';
  const snow = () => (window.Flame && Flame.snow) || "❄";
  function swatch(id) {
    const it = shopItem(id), v = (it && it.vars) || {};
    if (it && it.type === "pieces") {
      const a = (it.pal && it.pal.wF) || v["--pc-white"] || "#eee", b = (it.pal && it.pal.bF) || v["--pc-black"] || "#222";
      return `<i class="tr-sw tr-sw-p" style="--a:${a};--b:${b}"></i>`;
    }
    return `<i class="tr-sw tr-sw-b" style="--a:${v["--sq-light"] || "#667"};--b:${v["--sq-dark"] || "#223"}"></i>`;
  }
  function packHtml(p, empty) {
    const a = [];
    if (p.coins) a.push(`<span class="tr-chip tr-c-coin">${fmtN(p.coins)}<i class="mcoin"></i></span>`);
    if (p.hints) a.push(`<span class="tr-chip tr-c-hint">${p.hints}${ICON_HINT}</span>`);
    if (p.freezes) a.push(`<span class="tr-chip tr-c-ice">${p.freezes}${snow()}</span>`);
    p.items.forEach(id => a.push(`<span class="tr-chip tr-c-item">${swatch(id)}${esc(itemName(id))}</span>`));
    return a.length ? a.join("") : `<span class="tr-none">${esc(empty || t("tr.free"))}</span>`;
  }
  const packText = p => {
    const a = [];
    if (p.coins) a.push(fmtN(p.coins) + " 🪙");
    if (p.hints) a.push(p.hints + " 💡");
    if (p.freezes) a.push(p.freezes + " ❄");
    p.items.forEach(id => a.push(itemName(id)));
    return a.join(", ") || "—";
  };
  const ago = ts => {
    const m = Math.max(0, Math.round((Date.now() - (+ts || 0)) / 60000));
    if (m < 1) return t("tr.ago.now");
    if (m < 60) return t("tr.ago.m", { n: m });
    if (m < 1440) return t("tr.ago.h", { n: Math.floor(m / 60) });
    return t("tr.ago.d", { n: Math.floor(m / 1440) });
  };
  const lackText = k => k.startsWith("item:") ? itemName(k.slice(5)) : t("tr." + k);

  /* ================= журналы (защита от потерь и двойных начислений) ================= */
  const jget = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  const jset = (k, o) => {
    const ks = Object.keys(o);
    if (ks.length > 200) ks.sort((a, b) => (o[a].ts || 0) - (o[b].ts || 0)).slice(0, ks.length - 200).forEach(x => delete o[x]);
    try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {}
  };
  const PAID = "mc.tradePaid.v1", INTENT = "mc.tradeIntent.v1", ACC = "mc.tradeAcc.v1";

  /* что положено автору предложения, когда оно закрыто */
  const authorGets = d => d.status === "accepted" ? norm(d.take) : (d.status === "declined" || d.status === "cancelled") ? norm(d.give) : null;

  let settling = false;
  const accepting = new Set();      /* предложения, которые принимаются прямо сейчас (recover их не трогает) */
  async function settleOne(ref, uid) {
    const key = ref.id + ":" + uid, paid = jget(PAID), intent = jget(INTENT);
    let get = null, removed = false, status = null;
    try {
      await Cloud._db.runTransaction(async tx => {
        const snap = await tx.get(ref), d = snap.data();
        if (!d || !(d.pend || []).includes(uid)) return;
        const g = uid === d.from ? authorGets(d) : null;
        if (!g) return;
        get = g; status = d.status;
        intent[key] = { get: g, status: d.status, ts: Date.now() }; jset(INTENT, intent);
        tx.update(ref, { pend: FV().arrayRemove(uid), updatedAt: Date.now() });
        removed = true;
      });
    } catch (e) { console.warn("trade settle", e); return null; }
    if (!removed) return null;
    return finishPayout(key, get, status);
  }
  function finishPayout(key, get, status) {
    const paid = jget(PAID);
    if (!paid[key]) {
      const lost = Inv.apply(UI.state, emptyPack(), get);
      paid[key] = { ts: Date.now() }; jset(PAID, paid);
      if (lost.length) UI._toast(t("tr.cap", { n: maxFreezes() }));
    }
    const i2 = jget(INTENT); delete i2[key]; jset(INTENT, i2);
    return { get, status };
  }
  /* транзакция прошла, а выплату применить не успели (закрыли вкладку) */
  async function recover(uid) {
    const intent = jget(INTENT), paid = jget(PAID);
    for (const key of Object.keys(intent)) {
      const [id, u] = key.split(":");
      if (u !== uid) continue;
      if (paid[key]) { delete intent[key]; continue; }
      try {
        const d = (await col().doc(id).get()).data();
        if (!d || !(d.pend || []).includes(uid)) { const r = finishPayout(key, norm(intent[key].get), intent[key].status); announce(r); delete intent[key]; }
        else delete intent[key];
      } catch (e) {}
    }
    jset(INTENT, intent);
    /* принял предложение, но не дошёл до транзакции → откатываем локальное изменение */
    const acc = jget(ACC);
    for (const id of Object.keys(acc)) {
      if (accepting.has(id)) continue;
      try {
        const d = (await col().doc(id).get()).data();
        if (!(d && d.status === "accepted" && d.to === uid)) Inv.apply(UI.state, norm(acc[id].get), norm(acc[id].give));
      } catch (e) { continue; }
      delete acc[id];
    }
    jset(ACC, acc);
  }
  function announce(r) {
    if (!r) return;
    UI._toast(r.status === "accepted" ? t("tr.got", { x: packText(r.get) }) : t("tr.back", { x: packText(r.get) }));
    if (active()) render();
  }
  async function settleAll() {
    const uid = me();
    if (!uid || settling || !UI.state) return;
    settling = true;
    try {
      await recover(uid);
      const q = await col().where("pend", "array-contains", uid).get();
      for (const doc of q.docs) {
        const d = doc.data();
        if (d.from !== uid || !authorGets(d)) continue;
        announce(await settleOne(doc.ref, uid));
      }
    } catch (e) { console.warn("trade settleAll", e); }
    settling = false;
  }

  /* ================= экран ================= */
  const sec = document.createElement("section");
  sec.id = "view-trade"; sec.className = "view";
  sec.innerHTML = `
    <h2 class="view-title" data-i18n="tr.title"></h2>
    <p class="lb-sub" data-i18n="tr.sub"></p>
    <div class="seg-tabs tr-tabs">
      <button type="button" class="seg-tab active" data-tr="new" data-i18n="tr.tabNew"></button>
      <button type="button" class="seg-tab" data-tr="in"><span data-i18n="tr.tabIn"></span><i class="tr-dot" id="tr-dot" hidden></i></button>
      <button type="button" class="seg-tab" data-tr="mine" data-i18n="tr.tabMine"></button>
    </div>
    <div id="tr-body"></div>`;
  document.querySelector(".views").appendChild(sec);

  const nb = document.createElement("button");
  nb.className = "nav-btn"; nb.dataset.view = "trade";
  nb.innerHTML = `<span>⇄</span><span data-i18n="nav.trade"></span>`;
  (document.querySelector('.nav-btn[data-view="friends"]') || document.querySelector(".bottom-nav")).after(nb);

  let tab = "new";
  const active = () => sec.classList.contains("active");
  const draft = { to: null, toNick: "", give: emptyPack(), take: emptyPack() };
  let friendsCache = null;

  async function loadFriends() {
    const my = me();
    try {
      const snap = await Cloud._db.collection("users").doc(my).collection("friends").get();
      friendsCache = snap.docs.map(d => ({ uid: d.id, nick: (d.data() || {}).nick || (d.data() || {}).name || "?" }))
        .sort((a, b) => a.nick.localeCompare(b.nick));
    } catch (e) { friendsCache = friendsCache || []; }
    return friendsCache;
  }

  /* ---------- «Новый обмен» ---------- */
  async function renderNew() {
    const body = $("tr-body"), my = me();
    if (!my) { body.innerHTML = `<p class="lb-note">${t("tr.off")}</p>`; return; }
    body.innerHTML = `<p class="lb-note">${t("tr.loading")}</p>`;
    const friends = await loadFriends();
    if (!active() || tab !== "new") return;
    if (!friends.length) { body.innerHTML = `<p class="lb-note">${t("tr.noFriends")}</p>`; return; }
    if (draft.to && !friends.some(f => f.uid === draft.to)) draft.to = null;
    const s = UI.state;

    body.innerHTML = `
      <p class="fr-sec tr-sech">${t("tr.friend")}</p>
      <div class="tr-friends" id="tr-friends">${friends.map(f =>
        `<button type="button" class="tr-friend${f.uid === draft.to ? " on" : ""}" data-u="${esc(f.uid)}" data-n="${esc(f.nick)}">
           <span class="tr-ava">${esc(f.nick[0].toUpperCase())}</span><span class="tr-fn">${esc(f.nick)}</span></button>`).join("")}</div>
      <p class="lb-note tr-hint" id="tr-hint"${draft.to ? " hidden" : ""}>${t("tr.pickHint")}</p>
      <div class="tr-panels" id="tr-panels"${draft.to ? "" : " hidden"}>
        ${panel("g", s)}${panel("w", s)}
      </div>
      <div class="tr-sum" id="tr-sum" ${draft.to ? "" : "hidden"}></div>
      <p class="nick-err" id="tr-err" hidden></p>
      <button type="button" class="btn btn-primary tr-send" id="tr-send"${draft.to ? "" : " hidden"}>${t("tr.send")}</button>
      <p class="lb-note tr-rules">${t("tr.rules")}</p>`;

    body.querySelectorAll(".tr-friend").forEach(b => b.addEventListener("click", () => {
      draft.to = b.dataset.u; draft.toNick = b.dataset.n;
      body.querySelectorAll(".tr-friend").forEach(x => x.classList.toggle("on", x === b));
      $("tr-hint").hidden = true; $("tr-panels").hidden = false; $("tr-sum").hidden = false; $("tr-send").hidden = false;
      paintSum();
    }));
    bindPanel("g"); bindPanel("w");
    $("tr-send").addEventListener("click", send);
    paintSum();
  }

  function panel(k, s) {
    const pack = k === "g" ? draft.give : draft.take;
    const wantList = (typeof SHOP_ITEMS !== "undefined" ? SHOP_ITEMS : []).filter(i => tradable(i.id) && !Inv.owned(s).includes(i.id)).map(i => i.id);
    const items = k === "g" ? Inv.mine(s) : wantList;
    const bal = k === "g"
      ? `<p class="tr-bal">${t("tr.have")}: ${fmtN(Inv.coins(s))}<i class="mcoin"></i> · ${Inv.hints(s)} ${ICON_HINT} · ${Inv.freezes(s)} ${snow()}</p>` : "";
    return `
    <div class="tr-panel tr-${k}">
      <div class="tr-ph"><b>${t(k === "g" ? "tr.youGive" : "tr.youGet")}</b></div>${bal}
      <div class="tr-row"><span class="tr-lab"><i class="mcoin"></i>${t("tr.coins")}</span>
        <span class="tr-coin"><input type="number" min="0" step="10" inputmode="numeric" id="tr-${k}-coins" value="${pack.coins || ""}" placeholder="0">
        ${k === "g" ? `<button type="button" class="tr-mini" data-max="${k}">${t("tr.max")}</button>` : ""}</span></div>
      <div class="tr-row"><span class="tr-lab tr-c-hint">${ICON_HINT}${t("tr.hints")}</span>${stepper(k, "hints", pack.hints)}</div>
      <div class="tr-row"><span class="tr-lab tr-c-ice">${snow()}${t("tr.freezes")}</span>${stepper(k, "freezes", pack.freezes)}</div>
      <p class="tr-sub">${t("tr.skins")}</p>
      <div class="tr-items" id="tr-${k}-items">${items.length ? items.map(id =>
        `<button type="button" class="tr-item${pack.items.includes(id) ? " on" : ""}" data-id="${esc(id)}">${swatch(id)}
           <span><b>${esc(itemName(id))}</b><small>${t("tr." + (shopItem(id).type))}</small></span></button>`).join("")
        : `<p class="lb-note">${t(k === "g" ? "tr.noSkins" : "tr.noWant")}</p>`}</div>
    </div>`;
  }
  const stepper = (k, f, v) => `<span class="tr-step" data-k="${k}" data-f="${f}">
      <button type="button" data-d="-1" aria-label="−">−</button><b>${v}</b><button type="button" data-d="1" aria-label="+">+</button></span>`;

  function bindPanel(k) {
    const pack = k === "g" ? draft.give : draft.take, s = UI.state;
    const root = document.querySelector(`.tr-${k}`);
    const inp = $(`tr-${k}-coins`);
    inp.addEventListener("input", () => { pack.coins = Math.max(0, Math.min(MAX_COINS, Math.floor(+inp.value || 0))); paintSum(); });
    const mx = root.querySelector("[data-max]");
    if (mx) mx.addEventListener("click", () => { pack.coins = Inv.coins(s); inp.value = pack.coins || ""; paintSum(); });
    root.querySelectorAll(".tr-step").forEach(st => st.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const f = st.dataset.f, cap = k === "g" ? (f === "hints" ? Inv.hints(s) : Inv.freezes(s)) : (f === "hints" ? MAX_HINTS : maxFreezes());
      pack[f] = Math.max(0, Math.min(cap, pack[f] + (+b.dataset.d)));
      st.querySelector("b").textContent = pack[f]; paintSum();
    })));
    root.querySelectorAll(".tr-item").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.id, i = pack.items.indexOf(id);
      if (i >= 0) pack.items.splice(i, 1); else if (pack.items.length < MAX_ITEMS) pack.items.push(id);
      b.classList.toggle("on", pack.items.includes(id)); paintSum();
    }));
  }

  /* проверка черновика → текст ошибки или null */
  function validate() {
    const s = UI.state, g = norm(draft.give), w = norm(draft.take);
    if (!draft.to) return t("tr.pickFriend");
    if (draft.to === me()) return t("tr.pickFriend");
    if (isEmpty(g) && isEmpty(w)) return t("tr.nothing");
    if (isEmpty(g)) return t("tr.giveNothing");
    const lack = Inv.lacking(s, g);
    if (lack) return t("tr.poor", { item: lackText(lack) });
    if (w.freezes > maxFreezes()) return t("tr.theyCap", { n: maxFreezes() });
    const bl = Inv.blocked(s, w, g);
    if (bl === "cap") return t("tr.cap", { n: maxFreezes() });
    if (bl) return t("tr.itemOwned", { item: lackText(bl) });
    return null;
  }
  function paintSum() {
    const sum = $("tr-sum"), err = $("tr-err"), btn = $("tr-send");
    if (!sum) return;
    const g = norm(draft.give), w = norm(draft.take), e = draft.to ? validate() : null;
    sum.innerHTML = `<p class="tr-sum-t">${t("tr.summary")}${draft.toNick ? ` · ${esc(t("tr.sendTo", { name: draft.toNick }))}` : ""}</p>
      <div class="tr-sum-row"><span class="tr-sum-l">${t("tr.gives")}</span><div class="tr-pack">${packHtml(g)}</div></div>
      <div class="tr-sum-arrow">⇅</div>
      <div class="tr-sum-row"><span class="tr-sum-l">${t("tr.wants")}</span><div class="tr-pack">${packHtml(w, t("tr.gift"))}</div></div>`;
    err.hidden = !e || isEmpty(g) && isEmpty(w); err.textContent = e || "";
    btn.disabled = !!e;
  }

  async function send() {
    const err = $("tr-err"), btn = $("tr-send"), s = UI.state, my = me();
    const e0 = validate();
    if (e0) { err.textContent = e0; err.hidden = false; return; }
    const give = norm(draft.give), take = norm(draft.take), to = draft.to, toNick = draft.toNick;
    btn.disabled = true;
    let held = false;
    try {
      const fdoc = await Cloud._db.collection("users").doc(to).collection("friends").doc(my).get();
      if (!fdoc.exists) { err.textContent = t("tr.notFriend"); err.hidden = false; btn.disabled = false; return; }
      /* проверка ещё раз — состояние могло измениться, пока шла сеть */
      const e1 = validate();
      if (e1) { err.textContent = e1; err.hidden = false; btn.disabled = false; return; }
      Inv.apply(s, give, emptyPack()); held = true;                   /* заморозили своё */
      const created = await col().add({
        from: my, fromNick: s.nick || "?", to, toNick,
        give, take, status: "pending", pend: [], createdAt: Date.now(), updatedAt: Date.now()
      }).then(() => true, e => { throw e; });
      held = !created;                                                  /* документ создан — возвращать нечего */
      draft.give = emptyPack(); draft.take = emptyPack();
      UI._toast(t("tr.sent"));
      tab = "mine"; syncTabs(); render();
    } catch (e) {
      if (held) Inv.apply(s, emptyPack(), give);                       /* не отправилось — возвращаем */
      err.textContent = t("tr.err", { code: e.code || "?" }); err.hidden = false; btn.disabled = false;
    }
  }

  /* ---------- списки ---------- */
  function statusChip(st) { return `<span class="tr-st tr-st-${st}">${t("tr.st." + st)}</span>`; }

  function card(d, id, kind) {
    const el = document.createElement("div");
    el.className = "tr-card";
    const other = kind === "in" ? d.fromNick : d.toNick;
    const give = norm(d.give), take = norm(d.take);
    /* «Отдаёт/Хочет» — с точки зрения АВТОРА предложения (give = что он кладёт, take = что просит) */
    el.innerHTML = `
      <div class="tr-card-h">
        <span class="tr-ava">${esc(String(other || "?")[0].toUpperCase())}</span>
        <span class="tr-card-w"><b>${esc(other || "—")}</b>
          <small>${ago(d.createdAt)}</small></span>
        ${d.status === "pending" && kind === "in" ? "" : statusChip(d.status)}
      </div>
      <div class="tr-card-b">
        <div class="tr-col"><span class="tr-sum-l">${kind === "in" ? t("tr.gives") : t("tr.youGive")}</span><div class="tr-pack">${packHtml(give)}</div></div>
        <div class="tr-sum-arrow">⇄</div>
        <div class="tr-col"><span class="tr-sum-l">${kind === "in" ? t("tr.wants") : t("tr.youGet")}</span><div class="tr-pack">${packHtml(take, t("tr.gift"))}</div></div>
      </div>
      <div class="tr-card-f"></div>`;
    const f = el.querySelector(".tr-card-f");
    if (d.status !== "pending") { f.remove(); return el; }
    if (kind === "in") {
      const lack = Inv.lacking(UI.state, take), bl = Inv.blocked(UI.state, give, take);
      const why = lack ? t("tr.poor", { item: lackText(lack) }) : bl === "cap" ? t("tr.cap", { n: maxFreezes() }) : bl ? t("tr.itemOwned", { item: lackText(bl) }) : "";
      f.innerHTML = `${why ? `<p class="tr-why">${esc(why)}</p>` : ""}
        <button type="button" class="btn btn-primary" data-a="ok"${why ? " disabled" : ""}>${t("tr.accept")}</button>
        <button type="button" class="btn btn-ghost" data-a="no">${t("tr.decline")}</button>`;
      f.querySelector('[data-a="ok"]').onclick = () => accept(id, d);
      f.querySelector('[data-a="no"]').onclick = () => closeOffer(id, "declined");
    } else {
      f.innerHTML = `<button type="button" class="btn btn-ghost" data-a="no">${t("tr.cancel")}</button>`;
      f.querySelector("button").onclick = () => closeOffer(id, "cancelled");
    }
    return el;
  }

  async function closeOffer(id, status) {
    try {
      await Cloud._db.runTransaction(async tx => {
        const ref = col().doc(id), snap = await tx.get(ref), cur = snap.data();
        if (!cur || cur.status !== "pending") throw new Error("gone");
        tx.update(ref, { status, pend: [cur.from], updatedAt: Date.now() });
      });
      if (status === "cancelled") settleAll();
    } catch (e) { UI._toast(e && e.message === "gone" ? t("tr.gone") : t("tr.err", { code: e.code || "?" })); }
    render();
  }

  async function accept(id, d0) {
    if (!confirm(t("tr.confirmAccept"))) return;
    const s = UI.state, my = me();
    let applied = false, give = null, take = null;
    accepting.add(id);
    try {
      const ref = col().doc(id), snap = await ref.get(), d = snap.data();
      if (!d || d.status !== "pending" || d.to !== my) { UI._toast(t("tr.gone")); render(); return; }
      give = norm(d.give); take = norm(d.take);                            /* give — что отдаёт автор, take — что он просит у меня */
      const lack = Inv.lacking(s, take);
      if (lack) { UI._toast(t("tr.poor", { item: lackText(lack) })); return; }
      const bl = Inv.blocked(s, give, take);
      if (bl) { UI._toast(bl === "cap" ? t("tr.cap", { n: maxFreezes() }) : t("tr.itemOwned", { item: lackText(bl) })); return; }
      const acc = jget(ACC); acc[id] = { give: take, get: give, ts: Date.now() }; jset(ACC, acc);   /* журнал на случай обрыва */
      Inv.apply(s, take, give); applied = true;
      await Cloud._db.runTransaction(async tx => {
        const cur = (await tx.get(ref)).data();
        if (!cur || cur.status !== "pending") throw new Error("gone");
        tx.update(ref, { status: "accepted", pend: [cur.from], updatedAt: Date.now() });
      });
      const a2 = jget(ACC); delete a2[id]; jset(ACC, a2);
      UI._toast(t("tr.done") + " " + packText(give));
    } catch (e) {
      if (applied) { Inv.apply(s, give, take); const a2 = jget(ACC); delete a2[id]; jset(ACC, a2); }   /* откат */
      UI._toast(e && e.message === "gone" ? t("tr.gone") : t("tr.err", { code: (e && e.code) || "?" }));
    } finally { accepting.delete(id); }
    render();
  }

  async function renderList(kind) {
    const my = me(), body = $("tr-body");
    if (!my) { body.innerHTML = `<p class="lb-note">${t("tr.off")}</p>`; return; }
    body.innerHTML = `<p class="lb-note">${t("tr.loading")}</p>`;
    try {
      let docs;
      if (kind === "in") {
        const snap = await col().where("to", "==", my).get();
        docs = snap.docs.filter(d => d.data().status === "pending");
      } else {
        const [a, b] = await Promise.all([col().where("from", "==", my).get(), col().where("to", "==", my).get()]);
        const mineOut = a.docs.map(d => ({ d, kind: "out" }));
        const histIn = b.docs.filter(d => d.data().status !== "pending").map(d => ({ d, kind: "in" }));
        docs = [...mineOut, ...histIn];
      }
      if (!active() || (kind === "in" ? tab !== "in" : tab !== "mine")) return;
      body.innerHTML = "";
      const rows = (kind === "in" ? docs.map(d => ({ d, kind: "in" })) : docs)
        .sort((x, y) => (y.d.data().createdAt || 0) - (x.d.data().createdAt || 0)).slice(0, 40);
      if (!rows.length) { body.innerHTML = `<p class="lb-note">${t(kind === "in" ? "tr.emptyIn" : "tr.emptyMine")}</p>`; return; }
      rows.forEach(r => body.appendChild(card(r.d.data(), r.d.id, r.kind)));
    } catch (e) { body.innerHTML = `<p class="lb-note">${t("tr.err", { code: e.code || "?" })}</p>`; }
  }

  function syncTabs() { sec.querySelectorAll(".seg-tab").forEach(x => x.classList.toggle("active", x.dataset.tr === tab)); }
  function render() {
    if (typeof translatePage === "function") translatePage(sec);
    if (tab === "new") renderNew(); else renderList(tab);
  }
  sec.querySelectorAll(".seg-tab").forEach(b => b.addEventListener("click", () => { tab = b.dataset.tr; syncTabs(); render(); }));
  const _sv = UI.showView;
  UI.showView = function (n) { _sv.call(this, n); if (n === "trade") { render(); settleAll(); } };

  /* ================= живые уведомления ================= */
  let inUnsub = null, pendUnsub = null, listenFor = null, firstSnap = true;
  function listen() {
    const my = me();
    if (!my || listenFor === my) return;
    if (inUnsub) inUnsub(); if (pendUnsub) pendUnsub();
    listenFor = my; firstSnap = true;
    inUnsub = col().where("to", "==", my).where("status", "==", "pending").onSnapshot(snap => {
      const dot = $("tr-dot"); if (dot) dot.hidden = snap.empty;
      const more = document.querySelector(".nav-more"); if (more) more.classList.toggle("has-dot", !snap.empty);
      if (!firstSnap) snap.docChanges().forEach(c => { if (c.type === "added") UI._toast(t("tr.newOffer", { name: c.doc.data().fromNick || "?" })); });
      firstSnap = false;
      if (active() && tab === "in") renderList("in");
    }, e => console.warn("trade in", e));
    pendUnsub = col().where("pend", "array-contains", my).onSnapshot(() => settleAll(), e => console.warn("trade pend", e));
    setTimeout(settleAll, 1200);
  }
  if (typeof Cloud !== "undefined") {
    const _emit = Cloud._emit;
    Cloud._emit = function (x) { _emit.call(this, x); setTimeout(() => { if (me()) listen(); }, 800); };
    setTimeout(() => { if (me()) listen(); }, 3000);
  }

  /* ================= стили (единые с сайтом) ================= */
  const css = document.createElement("style");
  css.textContent = `
  #view-trade{padding-bottom:28px}
  .tr-tabs{margin-bottom:14px}.tr-tabs .seg-tab{position:relative}
  .tr-dot{display:inline-block;width:7px;height:7px;margin-left:6px;border-radius:50%;background:var(--violet-2,#e2b85a);box-shadow:0 0 0 3px rgba(200,155,60,.25);vertical-align:2px}
  .tr-dot[hidden]{display:none}
  .nav-more.has-dot span:first-child{position:relative}
  .nav-more.has-dot span:first-child::after{content:"";position:absolute;top:-1px;right:-3px;width:8px;height:8px;border-radius:50%;background:var(--violet-2,#e2b85a);box-shadow:0 0 0 2px var(--bg,#0e0f12)}
  .tr-sech{margin:6px 0 8px}
  .tr-friends{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;scrollbar-width:none}
  .tr-friends::-webkit-scrollbar{display:none}
  .tr-friend{flex:none;display:flex;align-items:center;gap:9px;padding:7px 14px 7px 7px;border-radius:999px;color:var(--ink-dim);
    background:var(--panel);border:1px solid var(--line);font:700 13px var(--font-ui);transition:.15s}
  .tr-friend:hover{border-color:var(--line-2);color:var(--ink)}
  .tr-friend.on{color:var(--ink);background:var(--tint,rgba(200,155,60,.14));border-color:rgba(226,184,90,.5)}
  .tr-ava{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:800 13px var(--font-ui);color:#fff;
    background:linear-gradient(135deg,rgba(200,155,60,.95),rgba(84,70,201,.95))}
  .tr-hint{margin:6px 2px}
  .tr-panels[hidden],.tr-sum[hidden],.tr-send[hidden],.tr-hint[hidden]{display:none!important}
  .tr-panels{display:grid;gap:12px;margin:6px 0 12px}
  @media (min-width:760px){.tr-panels{grid-template-columns:1fr 1fr;align-items:start}}
  .tr-panel{padding:16px;border-radius:var(--r-md,16px);background:linear-gradient(160deg,#1d1f27,#16171c);border:1px solid var(--line-2,rgba(255,255,255,.14))}
  .tr-g{border-top:2px solid rgba(227,191,124,.55)}.tr-w{border-top:2px solid rgba(226,184,90,.6)}
  .tr-ph b{font:700 15px var(--font-display);color:var(--ink)}
  .tr-bal{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin:6px 0 4px;font:600 12px var(--font-ui);color:var(--ink-dim)}
  .tr-bal svg,.tr-lab svg{width:15px;height:15px}.tr-bal .mcoin{margin:0 2px 0 3px}
  .tr-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
  .tr-row:last-of-type{border-bottom:0}
  .tr-lab{display:inline-flex;align-items:center;gap:8px;font:700 13px var(--font-ui);color:var(--ink)}
  .tr-lab .mcoin{margin:0}
  .tr-c-hint{color:#f2d27a}.tr-c-ice{color:var(--ice,#91d2f7)}.tr-c-coin{color:var(--gold,#e3bf7c)}
  .tr-lab.tr-c-hint,.tr-lab.tr-c-ice{color:inherit}
  .tr-coin{display:inline-flex;align-items:center;gap:6px}
  .tr-coin input{width:104px;background:var(--panel);border:1px solid var(--line-2);color:var(--ink);border-radius:12px;padding:8px 11px;font:700 13px var(--font-ui);outline:none;text-align:right}
  .tr-coin input:focus{border-color:rgba(200,155,60,.65)}
  .tr-mini{height:34px;padding:0 10px;border-radius:10px;font:800 11px var(--font-ui);color:var(--gold,#e3bf7c);background:rgba(227,191,124,.1);border:1px solid rgba(227,191,124,.35)}
  .tr-step{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}
  .tr-step button{width:30px;height:30px;border-radius:9px;border:0;background:transparent;color:var(--ink);font:700 17px/1 var(--font-ui)}
  .tr-step button:hover{background:rgba(255,255,255,.07)}.tr-step button:active{transform:scale(.9)}
  .tr-step b{min-width:28px;text-align:center;font:800 14px var(--font-ui);color:var(--ink)}
  .tr-sub{margin:12px 0 8px;font:700 12px var(--font-ui);color:var(--ink-dim);text-transform:uppercase;letter-spacing:.06em}
  .tr-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .tr-item{display:flex;align-items:center;gap:10px;padding:9px 10px;text-align:left;border-radius:14px;color:var(--ink-dim);
    background:var(--panel);border:1px solid var(--line);transition:.15s}
  .tr-item:hover{border-color:var(--line-2)}
  .tr-item b{display:block;font:700 12.5px var(--font-ui);color:var(--ink)}.tr-item small{font:600 11px var(--font-ui);color:var(--ink-faint)}
  .tr-item.on{background:var(--tint,rgba(200,155,60,.14));border-color:rgba(226,184,90,.55)}
  .tr-sw{flex:none;display:block;width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.18)}
  .tr-sw-b{background:conic-gradient(var(--a) 25%,var(--b) 0 50%,var(--a) 0 75%,var(--b) 0);background-size:15px 15px}
  .tr-sw-p{border-radius:50%;background:linear-gradient(135deg,var(--a) 50%,var(--b) 50%)}
  .tr-sum{margin:0 0 12px;padding:14px 16px;border-radius:var(--r-md,16px);background:rgba(255,255,255,.03);border:1px solid var(--line)}
  .tr-sum-t{margin:0 0 10px;font:700 12px var(--font-ui);color:var(--ink-dim)}
  .tr-sum-row{display:flex;align-items:flex-start;gap:12px}
  .tr-sum-l{flex:none;min-width:62px;font:800 11px var(--font-ui);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-faint)}
  .tr-sum-arrow{margin:6px 0 6px 66px;color:var(--violet-2,#e2b85a);font-size:15px;line-height:1}
  .tr-pack{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
  .tr-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font:700 12px var(--font-ui);background:rgba(255,255,255,.05);border:1px solid var(--line-2)}
  .tr-chip svg{width:14px;height:14px}.tr-chip .mcoin{margin:0 0 0 1px;width:13px;height:13px;vertical-align:0}
  .tr-chip .tr-sw{width:16px;height:16px;border-radius:5px}.tr-chip .tr-sw-p{border-radius:50%}
  .tr-chip.tr-c-coin{border-color:rgba(227,191,124,.4);background:rgba(227,191,124,.09)}
  .tr-chip.tr-c-hint{border-color:rgba(242,210,122,.38);background:rgba(242,210,122,.08)}
  .tr-chip.tr-c-ice{border-color:rgba(145,210,247,.4);background:rgba(145,210,247,.08)}
  .tr-chip.tr-c-item{color:var(--ink)}
  .tr-none{font:600 12px var(--font-ui);color:var(--ink-faint);padding:5px 2px}
  .tr-send{width:100%;margin-top:2px}.tr-send:disabled{opacity:.45;cursor:not-allowed}
  .tr-rules{margin:12px 2px 0;line-height:1.5}
  #tr-err{margin:0 2px 10px}
  .tr-card{margin:0 0 10px;padding:14px;border-radius:var(--r-md,16px);background:linear-gradient(160deg,#1d1f27,#16171c);border:1px solid var(--line-2,rgba(255,255,255,.14))}
  .tr-card-h{display:flex;align-items:center;gap:11px}
  .tr-card-w{flex:1;min-width:0}.tr-card-w b{display:block;font:700 14px var(--font-ui);color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tr-card-w small{font:600 11.5px var(--font-ui);color:var(--ink-faint)}
  .tr-st{flex:none;padding:4px 10px;border-radius:999px;font:800 11px var(--font-ui);color:var(--ink-dim);background:rgba(255,255,255,.05);border:1px solid var(--line)}
  .tr-st-accepted{color:var(--ok,#72d6a3);background:rgba(114,214,163,.1);border-color:rgba(114,214,163,.35)}
  .tr-st-declined,.tr-st-cancelled{color:var(--danger,#ee8195);background:rgba(238,129,149,.08);border-color:rgba(238,129,149,.3)}
  .tr-card-b{display:flex;flex-direction:column;gap:2px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
  .tr-col{display:flex;align-items:flex-start;gap:12px}
  .tr-card-f{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .tr-card-f .btn{flex:1;min-width:120px}.tr-card-f .btn:disabled{opacity:.45}
  .tr-why{flex-basis:100%;margin:0;font:600 12px var(--font-ui);color:var(--danger,#ee8195)}`;
  document.head.appendChild(css);

  window.Trade = { render, settle: settleAll };
})();
