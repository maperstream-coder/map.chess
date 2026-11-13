/* maper.chess — уведомления: заявки в друзья и приглашения в партию (в реальном времени).
   Работает через onSnapshot по тем же запросам, что уже есть в friends.js / duels.js — новые Rules не нужны.
   Показывает: баннер сверху, красный счётчик на вкладках «Друзья» и «Поединки», вибрацию
   и системное уведомление браузера (если вкладка в фоне и пользователь разрешил).
   Load AFTER js/duels.js, BEFORE js/app.js. */
(function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nt.friendReq": "Friend request", "nt.friendReqText": "{name} wants to be your friend",
    "nt.invite": "Game invitation", "nt.inviteText": "{name} invites you to play · ⏱ {tc}",
    "nt.inviteOk": "Invitation accepted", "nt.inviteOkText": "{name} accepted — the game is on!",
    "nt.inviteNo": "Invitation declined", "nt.inviteNoText": "{name} declined your invitation",
    "nt.friendOk": "New friend", "nt.friendOkText": "{name} accepted your friend request",
    "nt.summary": "While you were away", "nt.summaryText": "Friend requests: {f} · Game invites: {g}",
    "nt.accept": "Accept", "nt.play": "Play", "nt.accepted": "Friend added",
    "nt.enable": "Enable notifications", "nt.enabled": "Notifications enabled"
  }, {
    "nt.friendReq": "Заявка в друзья", "nt.friendReqText": "{name} хочет добавить вас в друзья",
    "nt.invite": "Приглашение в партию", "nt.inviteText": "{name} зовёт вас сыграть · ⏱ {tc}",
    "nt.inviteOk": "Приглашение принято", "nt.inviteOkText": "{name} принял(а) вызов — партия началась!",
    "nt.inviteNo": "Приглашение отклонено", "nt.inviteNoText": "{name} отклонил(а) ваше приглашение",
    "nt.friendOk": "Новый друг", "nt.friendOkText": "{name} принял(а) вашу заявку в друзья",
    "nt.summary": "Пока вас не было", "nt.summaryText": "Заявок в друзья: {f} · Приглашений в партию: {g}",
    "nt.accept": "Принять", "nt.play": "Играть", "nt.accepted": "Друг добавлен",
    "nt.enable": "Включить уведомления", "nt.enabled": "Уведомления включены"
  });

  const $ = id => document.getElementById(id);
  const frame = document.querySelector(".phone-frame") || document.body;
  const stack = document.createElement("div");
  stack.className = "nt-stack";
  frame.appendChild(stack);

  const tcText = tc => tc ? (t("du.tc" + tc) || tc + "") : t("du.tc0");
  const activeView = () => (document.querySelector(".view.active") || {}).id || "";
  const ping = () => window.dispatchEvent(new Event("mc:notify"));

  /* ---------- баннеры ---------- */
  const shown = new Set();
  function close(el) {
    if (!el || el._gone) return;
    el._gone = true; clearTimeout(el._timer);
    el.classList.add("out");
    setTimeout(() => el.remove(), 320);
  }

  function push(o) {
    if (o.id) { if (shown.has(o.id)) return; shown.add(o.id); }
    const el = document.createElement("div");
    el.className = "nt"; el.setAttribute("role", "status");
    const ttl = o.ttl || 8000;
    el.style.setProperty("--ttl", ttl + "ms");
    el.innerHTML = `<span class="nt-ico">${o.icon || "🔔"}</span>
      <div class="nt-body"><b></b><small></small></div>
      <div class="nt-actions"></div><i class="nt-bar"></i>`;
    el.querySelector("b").textContent = o.title;
    el.querySelector("small").textContent = o.text;
    el.querySelector(".nt-body").addEventListener("click", () => { close(el); if (o.onTap) o.onTap(); });
    const acts = el.querySelector(".nt-actions");
    (o.actions || []).forEach(a => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn " + (a.primary ? "btn-primary" : "btn-ghost"); b.textContent = a.label;
      b.addEventListener("click", async e => {
        e.stopPropagation(); b.disabled = true;
        try { await a.fn(); } finally { close(el); }
      });
      acts.appendChild(b);
    });
    while (stack.children.length >= 3) close(stack.firstElementChild);
    stack.appendChild(el);
    el._timer = setTimeout(() => close(el), ttl);

    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
    /* вкладка в фоне — дублируем системным уведомлением */
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(o.title, { body: o.text, icon: "assets/icon-192.png", tag: o.id || undefined });
        n.onclick = () => { window.focus(); n.close(); if (o.onTap) o.onTap(); };
      } catch (e) { /* некоторые мобильные браузеры не поддерживают конструктор */ }
    }
  }

  /* ---------- счётчики на вкладках ---------- */
  function setBadge(view, n) {
    const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
    if (!btn) return;
    let dot = btn.querySelector(".nav-dot");
    if (!dot) { dot = document.createElement("i"); dot.className = "nav-dot"; btn.appendChild(dot); }
    dot.hidden = !(n > 0);
    dot.textContent = n > 9 ? "9+" : String(n);
  }

  /* ---------- слушатели Firestore ---------- */
  let curUid = null, unsubs = [];
  const st = { friendReqs: 0, invites: 0, turns: 0, p1: new Map(), p2: new Map() };

  function stop() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = []; curUid = null;
    st.friendReqs = 0; st.invites = 0; st.turns = 0; st.p1.clear(); st.p2.clear();
    setBadge("friends", 0);
  }

  function paintBadges() {
    /* поединки теперь внутри «Друзей» — один общий счётчик: заявки + приглашения + мои ходы */
    setBadge("friends", st.friendReqs + st.invites + st.turns);
  }

  function recount(uid) {
    let inv = 0, turns = 0;
    st.p2.forEach(g => { if (g.status === "invited") inv++; });
    st.p1.forEach(g => { if (g.status === "active" && g.turn === "w") turns++; });
    st.p2.forEach(g => { if (g.status === "active" && g.turn === "b") turns++; });
    st.invites = inv; st.turns = turns;
    paintBadges();
  }

  function start(uid) {
    curUid = uid;
    const db = Cloud._db;
    let initLeft = 2;                       // ждём первые снимки заявок и приглашений → один общий «summary»
    const sum = { f: 0, g: 0 };
    const afterInit = () => {
      if (--initLeft > 0) return;
      const v = activeView();
      if ((sum.f || sum.g) && v !== "view-friends" && v !== "view-duels") {
        push({
          id: "summary:" + uid, icon: "🔔", title: t("nt.summary"),
          text: t("nt.summaryText", { f: sum.f, g: sum.g }),
          onTap: () => UI.showView(sum.f && !sum.g ? "friends" : "duels")
        });
      }
    };

    /* 1. входящие заявки в друзья */
    let frFirst = true;
    unsubs.push(db.collection("friendReqs").where("to", "==", uid).onSnapshot(snap => {
      st.friendReqs = snap.size; paintBadges();
      if (frFirst) { frFirst = false; sum.f = snap.size; afterInit(); return; }
      snap.docChanges().forEach(ch => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        push({
          id: "fr:" + ch.doc.id, icon: "👋", title: t("nt.friendReq"),
          text: t("nt.friendReqText", { name: d.fromNick || "?" }),
          onTap: () => UI.showView("friends"),
          actions: [{
            label: t("nt.accept"), primary: true,
            fn: async () => { if (window.Friends) { await Friends.accept(d.from, d.fromNick); UI._toast(t("nt.accepted")); } }
          }]
        });
      });
      ping();
    }, e => console.warn("notify friendReqs", e)));

    /* 2. приглашения мне + мои ходы (я — чёрные, p2) */
    let p2First = true;
    unsubs.push(db.collection("games").where("p2", "==", uid).onSnapshot(snap => {
      const prev = new Map(st.p2);
      st.p2.clear();
      snap.forEach(doc => st.p2.set(doc.id, { id: doc.id, ...doc.data() }));
      recount(uid);
      if (p2First) { p2First = false; sum.g = st.invites; afterInit(); return; }
      snap.docChanges().forEach(ch => {
        const g = st.p2.get(ch.doc.id);
        if (ch.type === "added" && g && g.status === "invited") {
          push({
            id: "inv:" + g.id, icon: "⚔", title: t("nt.invite"),
            text: t("nt.inviteText", { name: g.p1Nick || "?", tc: tcText(g.tc || 0) }),
            onTap: () => UI.showView("duels"),
            actions: [{ label: t("nt.accept"), primary: true, fn: () => (window.Duels && Duels.accept) ? Duels.accept(g.id) : UI.showView("duels") }]
          });
        }
      });
      ping();
    }, e => console.warn("notify games p2", e)));

    /* 3. мои приглашения: приняли / отклонили (я — белые, p1) */
    let p1First = true;
    unsubs.push(db.collection("games").where("p1", "==", uid).onSnapshot(snap => {
      const prev = new Map(st.p1);
      st.p1.clear();
      snap.forEach(doc => st.p1.set(doc.id, { id: doc.id, ...doc.data() }));
      recount(uid);
      if (p1First) { p1First = false; return; }
      snap.docChanges().forEach(ch => {
        if (ch.doc.metadata.hasPendingWrites) return;
        const before = prev.get(ch.doc.id), g = { id: ch.doc.id, ...ch.doc.data() };
        if (ch.type === "modified" && before && before.status === "invited" && g.status === "active") {
          push({
            id: "ok:" + g.id, icon: "✅", title: t("nt.inviteOk"),
            text: t("nt.inviteOkText", { name: g.p2Nick || "?" }),
            onTap: () => Duels.open(g.id),
            actions: [{ label: t("nt.play"), primary: true, fn: () => Duels.open(g.id) }]
          });
        } else if (ch.type === "removed" && before && before.status === "invited") {
          push({
            id: "no:" + before.id, icon: "✖", title: t("nt.inviteNo"),
            text: t("nt.inviteNoText", { name: before.p2Nick || "?" }), onTap: () => UI.showView("duels")
          });
        }
      });
      ping();
    }, e => console.warn("notify games p1", e)));

    /* 4. мою заявку приняли */
    let fFirst = true;
    unsubs.push(db.collection("users").doc(uid).collection("friends").onSnapshot(snap => {
      if (fFirst) { fFirst = false; return; }
      snap.docChanges().forEach(ch => {
        if (ch.type !== "added" || ch.doc.metadata.hasPendingWrites) return;   // своё принятие — не уведомляем
        push({
          id: "fok:" + ch.doc.id, icon: "🤝", title: t("nt.friendOk"),
          text: t("nt.friendOkText", { name: ch.doc.data().nick || "?" }), onTap: () => UI.showView("friends")
        });
      });
      ping();
    }, e => console.warn("notify friends", e)));
  }

  /* uid появляется асинхронно (анонимный вход) — следим за ним */
  setInterval(() => {
    const uid = (typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user) ? Cloud.user.uid : null;
    if (uid === curUid) return;
    stop();
    if (uid) start(uid);
  }, 1500);

  /* ---------- кнопка «Включить уведомления» ---------- */
  const canAsk = () => "Notification" in window && Notification.permission === "default";
  function mountPerm(viewId) {
    const sec = $(viewId); if (!sec) return;
    const box = document.createElement("div");
    box.className = "nt-perm"; box.hidden = !canAsk();
    box.innerHTML = `<button type="button" class="btn btn-ghost">${ic("bell")} <span class="nt-label"></span></button>`;
    const sp = box.querySelector(".nt-label");
    sp.textContent = t("nt.enable");
    box.querySelector("button").addEventListener("click", () => {
      Notification.requestPermission().then(p => {
        document.querySelectorAll(".nt-perm").forEach(b => { b.hidden = true; });
        if (p === "granted") UI._toast(t("nt.enabled"));
      }).catch(() => {});
    });
    const sub = sec.querySelector(".lb-sub");
    if (sub) sub.after(box); else sec.prepend(box);
  }
  mountPerm("view-friends"); mountPerm("view-duels");

  /* подпись кнопки при смене языка */
  const _sv = UI.showView;
  UI.showView = function (n) {
    _sv.call(this, n);
    document.querySelectorAll(".nt-perm .nt-label").forEach(s => { s.textContent = t("nt.enable"); });
  };
})();