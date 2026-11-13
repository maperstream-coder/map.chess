/* maper.chess — применение операций администратора на стороне игры.

   Как это работает (коротко):
   • Админ-панель НЕ пишет баланс игрока напрямую. Она создаёт запись-команду в users/{uid}/inbox/{opId}
     (+ неизменяемую запись аудита в adminOps/{opId}) — правила Firestore проверяют, что это делает
     настоящий админ, и что запись аудита создана в той же операции.
   • Игра игрока (этот файл) видит команду со статусом "pending", ОДИН раз применяет её к своему
     состоянию (монеты не уходят в минус), сохраняет прогресс и помечает команду applied / rejected,
     записывая «было → стало». Повторное применение исключено: id применённых команд хранится в state.adminLog.
   • Блокировка: bans/{uid}. Запись данных заблокированного игрока запрещена правилами Firestore;
     здесь мы дополнительно показываем игроку сообщение.
   • Раз в сутки делается резервная копия прогресса users/{uid}/backups/{YYYY-MM-DD} (хранится 30 дней,
     если включить TTL-политику по полю expireAt — см. README-ADMIN.md).

   Загружать ПОСЛЕ cloud.js и profile.js (см. index.html). */

const AdminOpsCore = (function () {
  "use strict";
  const COIN_CAP = 2000000000;      // потолок баланса: безопасно для JS-чисел и для полей Firestore
  const LOG_CAP = 200;              // сколько последних применённых операций помним в состоянии

  const int = v => Math.floor(+v || 0);
  const coinsOf = s => Math.max(0, int(s && s.coins));

  function alreadyApplied(state, id) {
    return Array.isArray(state.adminLog) && state.adminLog.some(e => e && e.id === id);
  }

  function remember(state, id, res) {
    if (!Array.isArray(state.adminLog)) state.adminLog = [];
    state.adminLog.push({ id, status: res.status, before: res.before, after: res.after, at: Date.now() });
    if (state.adminLog.length > LOG_CAP) state.adminLog = state.adminLog.slice(-LOG_CAP);
  }

  /* Применить ОДНУ операцию к состоянию (мутирует state). Возвращает {status, before, after, why?}. */
  function applyOne(state, op) {
    const before = coinsOf(state);
    const amount = int(op.amount);

    if (op.type === "credit" || op.type === "debit" || op.type === "set") {
      if (!(amount >= 0 && amount <= 1000000000) || (op.type !== "set" && amount <= 0)) {
        return { status: "rejected", before, after: before, why: "bad-amount" };
      }
      let next;
      if (op.type === "credit") next = Math.min(COIN_CAP, before + amount);
      else if (op.type === "debit") {
        if (before < amount) return { status: "rejected", before, after: before, why: "insufficient" };
        next = before - amount;
      } else next = amount;
      state.coins = next;
      return { status: "applied", before, after: next };
    }

    /* огонёк (дней подряд): before/after — количество дней, а не монеты */
    if (op.type === "streak") {
      if (!state.streak || typeof state.streak !== "object") state.streak = { count: 0, best: 0, lastDay: null, freezes: 0, history: {} };
      const st = state.streak;
      const was = Math.max(0, int(st.count));
      if (!(amount >= 0 && amount <= 3650)) return { status: "rejected", before: was, after: was, why: "bad-amount" };
      st.count = amount;
      st.best = Math.max(int(st.best), amount);
      if (amount > 0) {
        const today = (typeof normToday === "function") ? normToday(state) : new Date().toISOString().slice(0, 10);
        st.lastDay = today;                          // сегодняшний день считается сыгранным
        if (!st.history || typeof st.history !== "object") st.history = {};
        st.history[today] = 1;
        if (st.sec && typeof st.sec === "object") st.sec.lastMs = Date.now();
      } else {
        st.lastDay = null;
      }
      return { status: "applied", before: was, after: amount };
    }

    if (op.type === "restore") {
      let snap;
      try { snap = JSON.parse(op.payload); } catch (e) { snap = null; }
      if (!snap || typeof snap !== "object" || Array.isArray(snap) || !Number.isFinite(+snap.xp) || !Number.isFinite(+snap.coins)) {
        return { status: "rejected", before, after: before, why: "bad-payload" };
      }
      const keepLog = state.adminLog, keepCreated = state.createdAt, keepNick = state.nick, keepAvatar = state.avatar;
      Object.keys(state).forEach(k => { delete state[k]; });
      Object.assign(state, snap);
      state.coins = Math.min(COIN_CAP, Math.max(0, int(snap.coins)));
      state.adminLog = keepLog || [];          // журнал применённых операций НЕ откатываем — иначе они применятся заново
      if (keepCreated) state.createdAt = keepCreated;
      if (!state.nick && keepNick) state.nick = keepNick;
      if (!state.avatar && keepAvatar) state.avatar = keepAvatar;
      return { status: "applied", before, after: state.coins };
    }

    return { status: "rejected", before, after: before, why: "unknown-type" };
  }

  /* Применить список операций по порядку создания. Уже применённые пропускаются (идемпотентность).
     Возвращает [{id, status, before, after, why, repeated}] — repeated=true, если операция уже была применена
     раньше и нужно лишь повторно отметить её в облаке. */
  function applyAll(state, ops) {
    const out = [];
    const sorted = ops.slice().sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
    for (const op of sorted) {
      if (!op || !op.id) continue;
      if (alreadyApplied(state, op.id)) {
        const e = state.adminLog.find(x => x.id === op.id);
        out.push({ id: op.id, status: e.status, before: e.before, after: e.after, repeated: true });
        continue;
      }
      const res = applyOne(state, op);
      remember(state, op.id, res);
      out.push(Object.assign({ id: op.id }, res));
    }
    return out;
  }

  return { COIN_CAP, applyOne, applyAll, alreadyApplied };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AdminOpsCore;

/* ----------------------- часть для браузера ----------------------- */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof Cloud === "undefined" || typeof UI === "undefined") return;

  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "ao.credit": "Support added {n} coins to your account", "ao.debit": "{n} coins were deducted from your account",
    "ao.set": "Your balance was set to {n} coins", "ao.streak": "Support set your streak to {n} days 🔥", "ao.restore": "Your progress was restored by support",
    "ao.rejected": "A support correction couldn't be applied (not enough coins)",
    "ao.banTitle": "Account suspended", "ao.banText": "Your account is restricted. Your progress is not being saved.",
    "ao.reason": "Reason"
  }, {
    "ao.credit": "Поддержка начислила вам {n} монет", "ao.debit": "С вашего счёта списано {n} монет",
    "ao.set": "Ваш баланс установлен: {n} монет", "ao.streak": "Поддержка установила ваш огонёк: {n} дн. 🔥", "ao.restore": "Поддержка восстановила ваш прогресс",
    "ao.rejected": "Корректировку поддержки не удалось применить (не хватает монет)",
    "ao.banTitle": "Аккаунт заблокирован", "ao.banText": "Ваш аккаунт ограничен. Прогресс не сохраняется.",
    "ao.reason": "Причина"
  });

  const db = () => Cloud._db;
  const uid = () => (Cloud.user ? Cloud.user.uid : null);
  const FV = () => firebase.firestore.FieldValue;
  let unsubInbox = null, unsubBan = null, boundUid = null, busy = false, again = false;

  async function process(docs) {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const s = UI.state;
      if (!s || !docs.length) return;
      const ops = docs.map(d => {
        const x = d.data();
        return { id: d.id, type: x.type, amount: x.amount, payload: x.payload, reason: x.reason,
                 createdAtMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 };
      });
      /* перед восстановлением прогресса сохраняем резервную копию текущего состояния — откат всегда возможен */
      for (const o of ops) {
        if (o.type === "restore" && !AdminOpsCore.alreadyApplied(s, o.id)) {
          try {
            await db().collection("users").doc(uid()).collection("backups").doc("pre-restore-" + o.id).set({
              data: JSON.stringify(s), xp: s.xp || 0, coins: s.coins || 0, at: Date.now(),
              expireAt: new Date(Date.now() + 90 * 864e5)
            });
          } catch (e) { console.warn("admin-ops: pre-restore backup", e.code || e); }
        }
      }
      const results = AdminOpsCore.applyAll(s, ops);
      const fresh = results.filter(r => !r.repeated);
      if (fresh.length) {
        saveState(s);                                  // локально + очередь в облако
        UI.renderTopbar();
        try { const hv = document.getElementById("view-home"); if (hv && hv.classList.contains("active") && UI.renderStreakCard) UI.renderStreakCard(); } catch (e) { }
        try { await Cloud.flush(s); } catch (e) { /* queueSave повторит */ }
      }
      /* помечаем в облаке результат (один раз; правила разрешают только pending → applied/rejected) */
      for (const r of results) {
        try {
          await db().collection("users").doc(uid()).collection("inbox").doc(r.id).update({
            status: r.status, before: r.before, after: r.after, appliedAt: FV().serverTimestamp()
          });
        } catch (e) { console.warn("admin-ops: mark", r.id, e.code || e); }
      }
      for (const r of fresh) {
        const op = ops.find(o => o.id === r.id);
        if (r.status === "rejected") UI._toast(t("ao.rejected"));
        else UI._toast(t("ao." + op.type, { n: String(op.type === "set" || op.type === "streak" ? r.after : op.amount) }));
      }
      if (fresh.some(r => r.status === "applied" && ops.find(o => o.id === r.id).type === "restore")) {
        setTimeout(() => location.reload(), 1500);     // чтобы весь интерфейс перерисовался с восстановленным прогрессом
      }
    } catch (e) {
      console.warn("admin-ops: process failed", e);
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(() => { if (lastDocs) process(lastDocs); }, 300); }
    }
  }

  let lastDocs = null;
  function listen() {
    const u = uid();
    if (!u || boundUid === u) return;
    stop();
    boundUid = u;
    unsubInbox = db().collection("users").doc(u).collection("inbox").where("status", "==", "pending")
      .onSnapshot(snap => { lastDocs = snap.docs; process(snap.docs); },
                  e => console.warn("admin-ops: inbox listener", e.code || e));
    unsubBan = db().collection("bans").doc(u).onSnapshot(snap => {
      const d = snap.exists ? snap.data() : null;
      showBan(d && d.active ? d : null);
    }, e => console.warn("admin-ops: ban listener", e.code || e));
  }
  function stop() {
    if (unsubInbox) { unsubInbox(); unsubInbox = null; }
    if (unsubBan) { unsubBan(); unsubBan = null; }
    boundUid = null;
  }

  function showBan(d) {
    window.__mcBanned = !!d;
    let el = document.getElementById("ao-ban");
    if (!d) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "ao-ban";
      el.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,10,14,.92);color:#eceae4;font-family:sans-serif;text-align:center";
      document.body.appendChild(el);
    }
    const reason = String(d.reason || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    el.innerHTML = `<div style="max-width:340px"><div style="font-size:42px;color:#ff6b6b">${ic("ban")}</div>
      <h3 style="margin:10px 0">${t("ao.banTitle")}</h3><p style="opacity:.8">${t("ao.banText")}</p>
      <p style="opacity:.8;margin-top:10px"><b>${t("ao.reason")}:</b> ${reason}</p></div>`;
  }

  /* суточная резервная копия прогресса */
  async function dailyBackup() {
    const u = uid(), s = UI.state;
    if (!u || !s || window.__mcBanned) return;
    const d = new Date(), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const flag = "mc.backup." + u;
    try { if (localStorage.getItem(flag) === key) return; } catch (e) {}
    const json = JSON.stringify(s);
    if (json.length > 800000) return;                  // не превышаем лимит документа
    try {
      await db().collection("users").doc(u).collection("backups").doc(key).set({
        data: json, xp: s.xp || 0, coins: s.coins || 0, at: Date.now(), expireAt: new Date(Date.now() + 30 * 864e5)
      });
      try { localStorage.setItem(flag, key); } catch (e) {}
    } catch (e) { console.warn("admin-ops: backup", e.code || e); }
  }

  function onLoaded() {
    if (!UI.state) return;
    if (!UI.state.createdAt) { UI.state.createdAt = Date.now(); saveState(UI.state); }   // дата регистрации для админ-панели
    listen();
    setTimeout(dailyBackup, 4000);
  }

  const _emit = Cloud._emit;
  Cloud._emit = function (x) {
    _emit.call(this, x);
    if (x && x.loaded) setTimeout(onLoaded, 900);
    if (x && x.authenticated === false) stop();
  };

  /* не даём заблокированному игроку даже ставить сохранения в очередь */
  const _queue = Cloud.queueSave;
  Cloud.queueSave = function (s) { if (window.__mcBanned) return; return _queue.call(this, s); };

  window.AdminOps = { core: AdminOpsCore, listen, stop };
})();