/* MaperChess — админ-панель (клиент).
   Вся защита — в firestore.rules: даже если кто-то откроет эту страницу или подделает запросы,
   сервер Firestore откажет всем, кроме аккаунтов Google из коллекции admins/{uid}.
   Баланс игрока здесь НЕ меняется напрямую: панель создаёт команду (users/{uid}/inbox) и запись аудита
   (adminOps) одним атомарным батчем; игра игрока применяет команду один раз (js/admin-ops.js). */
(function () {
  "use strict";

  /* ---------- лимиты панели (правила Firestore допускают до 1 000 000 000) ---------- */
  const MAX_SINGLE = 10000000;     // макс. сумма одной операции
  const MAX_STREAK = 3650;         // макс. огонёк, который можно выставить (10 лет)
  const MAX_BULK_EACH = 1000000;   // макс. сумма каждому при массовой выдаче
  const MAX_BULK_PLAYERS = 500;
  const CHUNK = 8;                // операций в одном батче (лимит обращений правил = 20)
  const PAGE = 25;
  const MIN_GAP_MS = 1200;         // пауза между опасными действиями
  const MAX_PER_MIN = 40;          // операций в минуту с одного браузера

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const fmt = n => (Math.floor(+n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const ms = v => v == null ? 0 : typeof v === "number" ? v : v.toMillis ? v.toMillis() : v.seconds ? v.seconds * 1000 : 0;
  const when = v => { const m = ms(v); return m ? new Date(m).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—"; };
  const short = id => id.length > 10 ? id.slice(0, 8) + "…" : id;
  const TYPE_RU = { credit: "Начисление", debit: "Списание", set: "Установка баланса", streak: "Изменение огонька", restore: "Восстановление", ban: "Блокировка", unban: "Разблокировка", note: "Заметка" };

  /* та же нормализация ника, что в js/nick.js */
  const HOMO = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "м": "m", "т": "t", "к": "k", "н": "h", "в": "b" };
  const normKey = s => String(s).toLowerCase().replace(/./g, c => HOMO[c] !== undefined ? HOMO[c] : c).trim().replace(/\s+/g, " ");

  /* ---------- Firebase (отдельный экземпляр приложения: сессия админа не смешивается с игрой) ---------- */
  const app = firebase.initializeApp(FIREBASE_CONFIG, "admin");
  const auth = app.auth(), db = app.firestore();
  const FV = firebase.firestore.FieldValue;
  let me = null, canWrite = false, bannedSet = new Set();

  /* ---------- уведомления ---------- */
  function toast(msg, kind) {
    const d = document.createElement("div");
    d.className = "toast " + (kind || "");
    d.textContent = msg;
    $("toasts").appendChild(d);
    setTimeout(() => d.remove(), kind === "err" ? 7000 : 3800);
  }
  const errText = e => {
    const c = e && e.code;
    if (c === "permission-denied") return "Сервер отклонил операцию (нет прав или данные не прошли проверку правил).";
    if (c === "unavailable") return "Нет связи с сервером. Повторите позже.";
    if (c === "failed-precondition") return "Для этого запроса нужен индекс Firestore — разверните firestore.indexes.json (см. README-ADMIN.md).";
    return "Ошибка: " + ((e && (e.message || e.code)) || e);
  };

  /* ---------- вход ---------- */
  function show(id) { ["boot", "login", "denied", "app"].forEach(x => { $(x).hidden = x !== id; }); }
  $("btn-login").onclick = async () => {
    $("login-msg").hidden = true;
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      $("login-msg").textContent = "Не удалось войти: " + (e.code || e.message); $("login-msg").hidden = false;
    }
  };
  $("btn-out").onclick = $("btn-denied-out").onclick = () => auth.signOut();

  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
  auth.onAuthStateChanged(async user => {
    if (!user) { me = null; show("login"); return; }
    show("boot");
    try {
      if (user.isAnonymous) throw Object.assign(new Error("anon"), { code: "anon" });
      const snap = await db.collection("admins").doc(user.uid).get();
      if (!snap.exists) throw Object.assign(new Error("not-admin"), { code: "not-admin" });
      me = { uid: user.uid, email: user.email || "", role: snap.data().role || "viewer" };
      canWrite = me.role === "owner" || me.role === "admin";
      $("me-mail").textContent = me.email; $("me-role").textContent = ({ owner: "владелец", admin: "админ", viewer: "только просмотр" })[me.role] || me.role; $("me-role").className = "badge " + (canWrite ? "ok" : "warn");
      show("app");
      await loadBans();
      resetPlayers();
    } catch (e) {
      $("denied-uid").textContent = user.uid;
      show("denied");
    }
  });

  /* ---------- вкладки ---------- */
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === b));
    ["players", "bulk", "journal"].forEach(n => { $("tab-" + n).hidden = n !== b.dataset.tab; });
    if (b.dataset.tab === "journal" && !journalLoaded) loadJournal(true);
  });

  /* ---------- блокировки ---------- */
  async function loadBans() {
    try {
      const s = await db.collection("bans").where("active", "==", true).get();
      bannedSet = new Set(s.docs.map(d => d.id));
    } catch (e) { toast("Не удалось загрузить список блокировок: " + errText(e), "err"); }
  }

  /* ---------- разбор документа игрока ---------- */
  function parseUser(doc) {
    const raw = doc.data() || {};
    let st = null;
    try { st = raw.data ? JSON.parse(raw.data) : null; } catch (e) { st = null; }
    const xp = +(st ? st.xp : raw.xp) || 0;
    return {
      id: doc.id, raw, st,
      nick: raw.nick || (st && st.nick) || "",
      coins: st && Number.isFinite(+st.coins) ? Math.floor(+st.coins) : (Number.isFinite(+raw.coins) ? Math.floor(+raw.coins) : null),
      xp, level: (typeof playerLevelFromXp === "function" ? playerLevelFromXp(xp).level : Math.min(300, 1 + Math.floor(xp / 100))),
      created: (st && st.createdAt) || raw.createdAt || 0,
      lastSeen: raw.lastSeenAt || raw.updatedAt || 0,
      anonymous: !!raw.anonymous, email: raw.email || ""
    };
  }

  /* ---------- список игроков ---------- */
  let pCursor = null, pRows = [], pMode = "list";
  function resetPlayers() { $("q").value = ""; pMode = "list"; pCursor = null; pRows = []; loadPlayers(); }
  $("btn-reset").onclick = resetPlayers;
  ["sort", "f-status", "f-type"].forEach(id => $(id).onchange = () => { if (pMode === "list") { pCursor = null; pRows = []; loadPlayers(); } else paintPlayers(); });
  $("btn-more").onclick = () => loadPlayers();

  async function loadPlayers() {
    const sort = $("sort").value;
    $("players-state").className = "state"; $("players-state").textContent = "Загрузка…";
    $("btn-more").hidden = true;
    try {
      let q = db.collection("users").orderBy(sort, "desc").limit(PAGE);
      if (pCursor) q = q.startAfter(pCursor);
      const snap = await q.get();
      pRows = pRows.concat(snap.docs.map(parseUser));
      pCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : pCursor;
      $("btn-more").hidden = snap.docs.length < PAGE;
      paintPlayers();
    } catch (e) {
      $("players-state").className = "state err"; $("players-state").textContent = errText(e);
    }
  }

  $("search-form").onsubmit = async ev => {
    ev.preventDefault();
    const q = $("q").value.trim();
    if (!q) return resetPlayers();
    pMode = "search"; $("btn-more").hidden = true;
    $("players-state").className = "state"; $("players-state").textContent = "Поиск…"; $("players-body").innerHTML = "";
    try {
      const found = new Map(), lower = normKey(q), end = "";
      const add = d => { if (d.exists) found.set(d.id, d); };
      const jobs = [
        db.collection("users").doc(q).get().then(add),
        db.collection("users").where(firebase.firestore.FieldPath.documentId(), ">=", q).where(firebase.firestore.FieldPath.documentId(), "<=", q + end).limit(20).get().then(s => s.docs.forEach(add)),
        db.collection("users").where("nickLower", ">=", lower).where("nickLower", "<=", lower + end).limit(20).get().then(s => s.docs.forEach(add)),
        db.collection("users").where("nick", ">=", q).where("nick", "<=", q + end).limit(20).get().then(s => s.docs.forEach(add)),
        /* рейтинг: ник мог быть сохранён раньше, чем в users появилось поле nickLower */
        db.collection("leaderboard").where("nickLower", ">=", lower).where("nickLower", "<=", lower + end).limit(20).get()
          .then(async s => { for (const d of s.docs) if (!found.has(d.id)) add(await db.collection("users").doc(d.id).get()); })
      ];
      const res = await Promise.allSettled(jobs);
      if (!found.size && res.every(r => r.status === "rejected")) throw res[0].reason;
      pRows = [...found.values()].map(parseUser);
      paintPlayers(true);
    } catch (e) {
      $("players-state").className = "state err"; $("players-state").textContent = errText(e);
    }
  };

  function paintPlayers(isSearch) {
    const st = $("f-status").value, tp = $("f-type").value;
    const rows = pRows.filter(p => {
      const banned = bannedSet.has(p.id);
      if (st === "banned" && !banned) return false;
      if (st === "active" && banned) return false;
      if (tp === "google" && p.anonymous) return false;
      if (tp === "guest" && !p.anonymous) return false;
      return true;
    });
    $("players-body").innerHTML = rows.map(p => `
      <tr class="click" data-id="${esc(p.id)}">
        <td><span class="id-chip" title="${esc(p.id)}">${esc(short(p.id))}</span></td>
        <td>${esc(p.nick) || '<span class="muted">без ника</span>'}${p.anonymous ? ' <span class="badge">гость</span>' : ""}</td>
        <td class="num coin">${p.coins == null ? "—" : fmt(p.coins)}</td>
        <td class="num">${p.level}</td>
        <td>${bannedSet.has(p.id) ? '<span class="badge bad">заблокирован</span>' : '<span class="badge ok">активен</span>'}</td>
        <td>${when(p.lastSeen)}</td>
      </tr>`).join("");
    const stEl = $("players-state");
    stEl.className = "state";
    stEl.textContent = rows.length ? "" : (isSearch || pMode === "search" ? "Ничего не найдено." : "Игроков нет (с учётом фильтров).");
    $("players-body").querySelectorAll("tr").forEach(tr => tr.onclick = () => openProfile(tr.dataset.id));
  }

  /* ---------- диалог ---------- */
  function closeDlg() { $("dlg").hidden = true; $("dlg-body").innerHTML = ""; }
  /* Показывает форму → шаг подтверждения. Возвращает значения или null при отмене. */
  function askOp(o) {
    return new Promise(resolve => {
      const root = $("dlg-body"); $("dlg").hidden = false;
      const fields = o.fields || [];
      const stepForm = prev => {
        root.innerHTML = `<h3>${esc(o.title)}</h3>${o.intro ? `<p class="muted">${o.intro}</p>` : ""}
          <form id="dlg-form" autocomplete="off">
          ${fields.map(f => `<label for="df-${f.name}">${esc(f.label)}</label>${f.type === "textarea"
            ? `<textarea id="df-${f.name}" rows="3" maxlength="${f.max || 300}" placeholder="${esc(f.ph || "")}"></textarea>`
            : `<input id="df-${f.name}" type="${f.type || "text"}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.type === "number" ? 'step="1" inputmode="numeric"' : `maxlength="${f.maxlen || 300}"`} placeholder="${esc(f.ph || "")}" />`}`).join("")}
          <p id="dlg-err" class="msg" hidden></p>
          <div class="row"><button class="btn btn-primary" type="submit">Далее</button><button class="btn" type="button" id="dlg-cancel">Отмена</button></div></form>`;
        fields.forEach(f => { if (prev && prev[f.name] != null) $("df-" + f.name).value = prev[f.name]; });
        const first = fields[0] && $("df-" + fields[0].name); if (first) first.focus();
        $("dlg-cancel").onclick = () => { closeDlg(); resolve(null); };
        $("dlg-form").onsubmit = ev => {
          ev.preventDefault();
          const v = {};
          for (const f of fields) {
            let x = $("df-" + f.name).value.trim();
            if (f.type === "number") {
              if (x === "" || !/^\d+$/.test(x)) return err(`«${f.label}»: введите целое неотрицательное число`);
              x = parseInt(x, 10);
              if (f.min != null && x < f.min) return err(`«${f.label}»: минимум ${fmt(f.min)}`);
              if (f.max != null && x > f.max) return err(`«${f.label}»: максимум ${fmt(f.max)}`);
            } else if (f.required !== false && x.length < (f.minlen || 3)) return err(`«${f.label}»: минимум ${f.minlen || 3} символа`);
            v[f.name] = x;
          }
          stepConfirm(v);
        };
      };
      const err = m => { const e = $("dlg-err"); e.textContent = m; e.hidden = false; };
      const stepConfirm = v => {
        const word = o.confirmWord ? o.confirmWord(v) : null;
        root.innerHTML = `<h3>Подтвердите действие</h3>
          <div class="sumbox">${o.summary(v)}</div>
          ${o.danger ? `<div class="warnbox">${o.danger}</div>` : ""}
          ${word ? `<label for="dlg-word">Для подтверждения введите: <b>${esc(word)}</b></label><input id="dlg-word" autocomplete="off" />` : ""}
          <p id="dlg-err" class="msg" hidden></p>
          <div class="row"><button id="dlg-ok" class="btn ${o.dangerBtn ? "btn-danger" : "btn-primary"}" type="button">${esc(o.okLabel || "Подтвердить")}</button>
          <button id="dlg-back" class="btn" type="button">Назад</button><button id="dlg-cancel" class="btn" type="button">Отмена</button></div>`;
        $("dlg-cancel").onclick = () => { closeDlg(); resolve(null); };
        $("dlg-back").onclick = () => stepForm(v);
        $("dlg-ok").onclick = () => {
          if (word && $("dlg-word").value.trim().toUpperCase() !== word.toUpperCase()) return err("Слово подтверждения введено неверно");
          $("dlg-ok").disabled = true; closeDlg(); resolve(v);
        };
      };
      stepForm();
    });
  }

  /* ---------- создание операций (аудит + команда игроку одним батчем) ---------- */
  let lastOpAt = 0; const recent = [];
  function throttle() {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60000) recent.shift();
    if (now - lastOpAt < MIN_GAP_MS) throw new Error("Слишком часто. Подождите секунду.");
    if (recent.length >= MAX_PER_MIN) throw new Error("Достигнут лимит операций в минуту. Подождите.");
    lastOpAt = now; recent.push(now);
  }
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)));

  /* op: {opId,type,target,amount?,reason,verify?,payload?,kind?,batchId?,meta?} */
  function buildBatch(batch, op) {
    const audit = { admin: me.uid, adminEmail: me.email, type: op.type, target: op.target, reason: op.reason, createdAt: FV.serverTimestamp() };
    if (op.amount != null) audit.amount = op.amount;
    if (op.verify) audit.verify = op.verify;
    if (op.batchId) audit.batchId = op.batchId;
    if (op.meta) audit.meta = op.meta;
    batch.set(db.collection("adminOps").doc(op.opId), audit);
    if (["credit", "debit", "set", "streak", "restore"].includes(op.type)) {
      const cmd = { type: op.type, reason: op.reason, admin: me.uid, status: "pending", createdAt: FV.serverTimestamp() };
      if (op.type !== "restore") cmd.amount = op.amount;
      if (op.kind) cmd.kind = op.kind;
      if (op.payload) cmd.payload = op.payload;
      batch.set(db.collection("users").doc(op.target).collection("inbox").doc(op.opId), cmd);
    }
    if (op.type === "ban" || op.type === "unban") {
      batch.set(db.collection("bans").doc(op.target), { active: op.type === "ban", reason: op.reason, opId: op.opId, by: me.uid, at: FV.serverTimestamp() });
    }
  }
  /* Идемпотентность: если батч «не прошёл» из-за обрыва, но запись уже есть — считаем выполненным. */
  async function commitOps(ops) {
    if (!canWrite) throw new Error("У вашей роли нет прав на изменение данных.");
    throttle();
    const done = [], failed = [];
    for (let i = 0; i < ops.length; i += CHUNK) {
      const part = ops.slice(i, i + CHUNK), batch = db.batch();
      part.forEach(op => buildBatch(batch, op));
      try { await batch.commit(); done.push(...part); }
      catch (e) {
        let exists = false;
        try { exists = (await db.collection("adminOps").doc(part[0].opId).get()).exists; } catch (e2) {}
        if (exists) done.push(...part); else failed.push({ part, e });
      }
    }
    return { done, failed };
  }

  /* ---------- профиль игрока ---------- */
  let cur = null;
  $("pf-close").onclick = $("scrim").onclick = closeProfile;
  function closeProfile() { $("profile").hidden = true; $("scrim").hidden = true; cur = null; }

  async function openProfile(uid) {
    $("profile").hidden = false; $("scrim").hidden = false;
    $("pf-title").textContent = "Загрузка…"; $("pf-body").innerHTML = '<div class="state">Загрузка…</div>';
    try {
      const doc = await db.collection("users").doc(uid).get();
      if (!doc.exists) { $("pf-body").innerHTML = '<div class="state err">Документ игрока не найден.</div>'; return; }
      cur = parseUser(doc);
      const [ban, pending, backups, hist] = await Promise.all([
        db.collection("bans").doc(uid).get(),
        db.collection("users").doc(uid).collection("inbox").where("status", "==", "pending").get(),
        db.collection("users").doc(uid).collection("backups").orderBy("at", "desc").limit(15).get().catch(() => ({ docs: [] })),
        loadHistory(uid)
      ]);
      cur.ban = ban.exists && ban.data().active ? ban.data() : null;
      cur.pending = pending.size; cur.backups = backups.docs; cur.hist = hist;
      paintProfile();
    } catch (e) { $("pf-body").innerHTML = `<div class="state err">${esc(errText(e))}</div>`; }
  }

  async function loadHistory(uid) {
    let ops = [], note = "";
    try {
      ops = (await db.collection("adminOps").where("target", "==", uid).orderBy("createdAt", "desc").limit(50).get()).docs;
    } catch (e) {
      if (e.code !== "failed-precondition") throw e;
      note = "Нет индекса — история отсортирована в браузере и может быть неполной.";
      ops = (await db.collection("adminOps").where("target", "==", uid).limit(50).get()).docs.sort((a, b) => ms(b.data().createdAt) - ms(a.data().createdAt));
    }
    const inbox = {};
    try { (await db.collection("users").doc(uid).collection("inbox").orderBy("createdAt", "desc").limit(100).get()).docs.forEach(d => { inbox[d.id] = d.data(); }); } catch (e) {}
    return { rows: ops.map(d => ({ id: d.id, ...d.data(), res: inbox[d.id] || null })), note };
  }

  function paintProfile() {
    const p = cur, st = p.st || {}, sx = st.stats || {};
    $("pf-title").textContent = p.nick || "Игрок без ника";
    const histRows = p.hist.rows.map(h => `<tr>
        <td>${when(h.createdAt)}</td><td>${esc(TYPE_RU[h.type] || h.type)}</td>
        <td class="num">${h.amount != null ? fmt(h.amount) : ""}</td>
        <td>${h.res && h.res.status === "applied" && h.res.before != null ? `${fmt(h.res.before)} → <b>${fmt(h.res.after)}</b>` : ""}</td>
        <td>${h.res ? (h.res.status === "applied" ? '<span class="badge ok">применено</span>' : h.res.status === "rejected" ? '<span class="badge bad">отклонено</span>' : '<span class="badge warn">ожидает</span>') : ""}</td>
        <td>${esc(h.reason)}${h.verify ? `<br><span class="muted">Подтверждение: ${esc(h.verify)}</span>` : ""}<br><span class="muted">${esc(h.adminEmail || short(h.admin || ""))}</span></td></tr>`).join("");
    const bk = p.backups.map(d => { const b = d.data(); return `<tr><td>${esc(d.id)}</td><td class="num">${fmt(b.coins)}</td><td class="num">${fmt(b.xp)}</td>
        <td><button class="btn btn-sm" data-act="restore-backup" data-id="${esc(d.id)}" ${canWrite ? "" : "disabled"}>Восстановить</button></td></tr>`; }).join("");
    $("pf-body").innerHTML = `
      <div class="sec">
        <div class="balance">${p.coins == null ? "—" : fmt(p.coins)} <span class="muted small" style="font:500 13px var(--font-ui)">монет (по последней синхронизации)</span></div>
        ${p.pending ? `<p><span class="badge warn">ждёт применения: ${p.pending}</span> <span class="muted small">Операции применятся, когда игрок откроет игру.</span></p>` : ""}
        <div class="actions">
          <button class="btn btn-ok" data-act="credit" ${canWrite ? "" : "disabled"}>Начислить</button>
          <button class="btn btn-danger" data-act="debit" ${canWrite ? "" : "disabled"}>Списать</button>
          <button class="btn" data-act="set" ${canWrite ? "" : "disabled"}>Установить баланс</button>
          <button class="btn" data-act="comp" ${canWrite ? "" : "disabled"}>Компенсация</button>
          <button class="btn" data-act="streak" ${canWrite ? "" : "disabled"}>🔥 Изменить огонёк</button>
        </div>
        ${canWrite ? "" : '<p class="muted small">Роль viewer: только просмотр.</p>'}
      </div>
      <div class="sec"><h3>Аккаунт</h3><dl class="kv">
        <dt>ID</dt><dd><code>${esc(p.id)}</code> <button class="btn btn-sm" data-act="copy">копировать</button></dd>
        <dt>Никнейм</dt><dd>${esc(p.nick) || "—"}</dd>
        <dt>Статус</dt><dd>${p.ban ? `<span class="badge bad">заблокирован</span> ${esc(p.ban.reason)} <span class="muted">(${when(p.ban.at)})</span>` : '<span class="badge ok">активен</span>'}</dd>
        <dt>Тип входа</dt><dd>${p.anonymous ? "Гость (анонимный)" : "Google"}${p.email ? " · " + esc(p.email) : ""}</dd>
        <dt>Регистрация</dt><dd>${when(p.created)}</dd>
        <dt>Последний вход</dt><dd>${when(p.lastSeen)}</dd>
        <dt>Уровень / XP</dt><dd>${p.level} / ${fmt(p.xp)}</dd>
      </dl>
      <div class="actions">${p.ban
        ? `<button class="btn btn-ok" data-act="unban" ${canWrite ? "" : "disabled"}>Разблокировать</button>`
        : `<button class="btn btn-danger" data-act="ban" ${canWrite ? "" : "disabled"}>Заблокировать</button>`}</div></div>
      <div class="sec"><h3>Игровые данные</h3><dl class="kv">
        <dt>Партий / побед</dt><dd>${fmt(sx.gamesPlayed)} / ${fmt(sx.wins)}</dd>
        <dt>Уровней пройдено</dt><dd>${(st.completed || []).length}</dd>
        <dt>Задач решено</dt><dd>${(st.completedPuzzles || []).length}</dd>
        <dt>Подсказки</dt><dd>${fmt(st.hints && st.hints.left)}</dd>
        <dt>Заморозки серии</dt><dd>${fmt(st.streak && st.streak.freezes)}</dd>
        <dt>Серия (лучшая)</dt><dd>${fmt(st.streak && st.streak.count)} (${fmt(st.streak && st.streak.best)})</dd>
        <dt>Инвентарь (оформления)</dt><dd>${(st.owned || []).length ? (st.owned || []).map(x => `<code>${esc(x)}</code>`).join(" ") : "—"}</dd>
        <dt>Надето</dt><dd>${st.equipped ? Object.entries(st.equipped).map(([k, v]) => `${esc(k)}: <code>${esc(v)}</code>`).join(" · ") : "—"}</dd>
      </dl></div>
      <div class="sec"><h3>Восстановление аккаунта</h3>
        <p class="muted small">Паролей в игре нет: вход — через Google или гостевой аккаунт, поэтому «сброс пароля» не нужен (и показать чужой пароль невозможно). Восстановление = перенос или откат прогресса. Перед каждым восстановлением игра автоматически сохраняет копию текущего состояния.</p>
        <div class="actions"><button class="btn" data-act="transfer" ${canWrite ? "" : "disabled"}>Перенести прогресс с другого аккаунта…</button></div>
        <h3 style="margin-top:14px">Резервные копии</h3>
        ${bk ? `<table class="mini"><tr><th>Копия</th><th class="num">Монеты</th><th class="num">XP</th><th></th></tr>${bk}</table>` : '<p class="muted small">Копий пока нет (игра делает их раз в сутки при входе).</p>'}</div>
      <div class="sec"><h3>История операций</h3>
        ${p.hist.note ? `<p class="muted small">${esc(p.hist.note)}</p>` : ""}
        ${histRows ? `<table class="mini"><tr><th>Время</th><th>Тип</th><th class="num">Сумма</th><th>Баланс</th><th>Статус</th><th>Причина / админ</th></tr>${histRows}</table>` : '<p class="muted small">Операций пока не было.</p>'}</div>`;
    $("pf-body").querySelectorAll("[data-act]").forEach(b => b.onclick = () => profileAction(b.dataset.act, b.dataset.id));
  }

  const who = () => `<b>${esc(cur.nick || "без ника")}</b> <span class="id-chip">${esc(short(cur.id))}</span>`;

  async function runOps(ops, okMsg) {
    try {
      const r = await commitOps(ops);
      if (r.failed.length) toast(errText(r.failed[0].e), "err");
      if (r.done.length) toast(okMsg(r.done.length), "ok");
      if (r.done.some(o => o.type === "ban" || o.type === "unban")) await loadBans();
      return r;
    } catch (e) { toast(e.message || errText(e), "err"); return { done: [], failed: [{}] }; }
  }

  async function profileAction(act, id) {
    const p = cur; if (!p) return;
    if (act === "copy") { try { await navigator.clipboard.writeText(p.id); toast("ID скопирован", "ok"); } catch (e) { toast("Не удалось скопировать", "err"); } return; }
    const opId = newId();
    const base = { opId, target: p.id };
    const bal = p.coins == null ? "неизвестен" : fmt(p.coins);
    let ops = null, okMsg;

    if (act === "credit" || act === "comp") {
      const v = await askOp({
        title: act === "comp" ? "Компенсация игроку" : "Начислить валюту", intro: `Игрок: ${who()}. Текущий баланс: <b>${bal}</b>`,
        fields: [{ name: "amount", label: "Сумма (монет)", type: "number", min: 1, max: MAX_SINGLE, ph: "например 5000" },
                 { name: "reason", label: "Причина (обязательно)", ph: act === "comp" ? "Компенсация после бага" : "Причина начисления" }],
        summary: v => `<div>Игрок: ${who()}</div><div>Начислить: <b class="coin">+${fmt(v.amount)}</b></div><div>Причина: ${esc(v.reason)}</div>`,
        okLabel: "Начислить"
      });
      if (!v) return;
      ops = [{ ...base, type: "credit", amount: v.amount, reason: v.reason, kind: act === "comp" ? "compensation" : "adjust" }];
      okMsg = () => "Операция сохранена. Баланс обновится, когда игрок откроет игру.";
    } else if (act === "debit") {
      const v = await askOp({
        title: "Списать валюту", intro: `Игрок: ${who()}. Текущий баланс: <b>${bal}</b>. Баланс не может стать отрицательным: если монет не хватит, операция будет отклонена.`,
        fields: [{ name: "amount", label: "Сумма (монет)", type: "number", min: 1, max: MAX_SINGLE }, { name: "reason", label: "Причина (обязательно)" }],
        summary: v => `<div>Игрок: ${who()}</div><div>Списать: <b class="coin">−${fmt(v.amount)}</b></div><div>Причина: ${esc(v.reason)}</div>`,
        danger: "Списание уменьшает монеты игрока.", dangerBtn: true, confirmWord: () => "СПИСАТЬ", okLabel: "Списать"
      });
      if (!v) return;
      ops = [{ ...base, type: "debit", amount: v.amount, reason: v.reason }];
      okMsg = () => "Операция сохранена. Применится при следующем входе игрока.";
    } else if (act === "set") {
      const v = await askOp({
        title: "Установить баланс", intro: `Игрок: ${who()}. Текущий баланс: <b>${bal}</b>. Используйте для исправления ошибочного баланса.`,
        fields: [{ name: "amount", label: "Новый баланс (монет)", type: "number", min: 0, max: MAX_SINGLE }, { name: "reason", label: "Причина (обязательно)" }],
        summary: v => `<div>Игрок: ${who()}</div><div>Было (по синхр.): ${bal}</div><div>Будет: <b class="coin">${fmt(v.amount)}</b></div><div>Причина: ${esc(v.reason)}</div>`,
        danger: "Баланс будет заменён на указанное число независимо от текущего значения.", dangerBtn: true, confirmWord: () => "УСТАНОВИТЬ", okLabel: "Установить"
      });
      if (!v) return;
      ops = [{ ...base, type: "set", amount: v.amount, reason: v.reason }];
      okMsg = () => "Операция сохранена.";
    } else if (act === "streak") {
      const stt = (p.st && p.st.streak) || {};
      const curStreak = stt.count == null ? "неизвестно" : fmt(stt.count);
      const v = await askOp({
        title: "🔥 Изменить огонёк (дней подряд)",
        intro: `Игрок: ${who()}. Сейчас огонёк: <b>${curStreak}</b> (лучший: ${fmt(stt.best || 0)}). Новый огонёк засчитает сегодняшний день как сыгранный.`,
        fields: [{ name: "amount", label: "Новое количество дней подряд", type: "number", min: 0, max: MAX_STREAK, ph: "например 30" },
                 { name: "reason", label: "Причина (обязательно)", ph: "Например: огонёк сгорел из-за ошибки" }],
        summary: v => `<div>Игрок: ${who()}</div><div>Было (по синхр.): ${curStreak}</div><div>Будет: <b>🔥 ${fmt(v.amount)}</b></div><div>Причина: ${esc(v.reason)}</div>`,
        danger: "Огонёк игрока будет заменён на указанное число. Применится, когда игрок откроет игру.", okLabel: "Изменить огонёк"
      });
      if (!v) return;
      ops = [{ ...base, type: "streak", amount: v.amount, reason: v.reason }];
      okMsg = () => "Огонёк будет изменён, когда игрок откроет игру.";
    } else if (act === "ban" || act === "unban") {
      const ban = act === "ban";
      const v = await askOp({
        title: ban ? "Заблокировать аккаунт" : "Разблокировать аккаунт", intro: `Игрок: ${who()}`,
        fields: [{ name: "reason", label: ban ? "Причина блокировки (увидит игрок)" : "Причина разблокировки" }],
        summary: v => `<div>Игрок: ${who()}</div><div>Действие: <b>${ban ? "блокировка" : "разблокировка"}</b></div><div>Причина: ${esc(v.reason)}</div>`,
        danger: ban ? "Сервер перестанет принимать запись данных этого игрока (прогресс, рейтинг, дуэли, обмены)." : "", dangerBtn: ban, confirmWord: ban ? () => "ЗАБЛОКИРОВАТЬ" : null,
        okLabel: ban ? "Заблокировать" : "Разблокировать"
      });
      if (!v) return;
      ops = [{ ...base, type: act, reason: v.reason }];
      okMsg = () => ban ? "Аккаунт заблокирован." : "Аккаунт разблокирован.";
    } else if (act === "restore-backup") {
      const b = p.backups.find(d => d.id === id); if (!b) return;
      const bd = b.data();
      const v = await askOp({
        title: "Восстановить из резервной копии", intro: `Игрок: ${who()}. Копия: <b>${esc(id)}</b> (монеты ${fmt(bd.coins)}, XP ${fmt(bd.xp)}).`,
        fields: [{ name: "verify", label: "Как подтверждено владение аккаунтом?", ph: "Например: игрок назвал e-mail Google и дату регистрации", minlen: 8 },
                 { name: "reason", label: "Причина (обязательно)" }],
        summary: v => `<div>Игрок: ${who()}</div><div>Копия: ${esc(id)} — монеты ${fmt(bd.coins)}, XP ${fmt(bd.xp)}</div><div>Подтверждение: ${esc(v.verify)}</div><div>Причина: ${esc(v.reason)}</div>`,
        danger: "Весь прогресс игрока будет заменён данными копии. Текущее состояние игра сохранит в копию «pre-restore-…».", dangerBtn: true, confirmWord: () => "ВОССТАНОВИТЬ", okLabel: "Восстановить"
      });
      if (!v) return;
      ops = [{ ...base, type: "restore", reason: v.reason, verify: v.verify, payload: bd.data, meta: { source: "backup:" + id } }];
      okMsg = () => "Восстановление поставлено в очередь и применится, когда игрок откроет игру.";
    } else if (act === "transfer") {
      const v1 = await askOp({
        title: "Перенос прогресса с другого аккаунта", intro: `Прогресс с исходного аккаунта (например, старого гостевого) будет скопирован на <b>этот</b> аккаунт: ${who()}`,
        fields: [{ name: "src", label: "ID исходного аккаунта (UID)", minlen: 10, maxlen: 128 },
                 { name: "verify", label: "Как подтверждено владение обоими аккаунтами?", minlen: 8 },
                 { name: "reason", label: "Причина (обязательно)" }],
        summary: v => `<div>Откуда: <code>${esc(v.src)}</code></div><div>Куда: ${who()}</div><div>Подтверждение: ${esc(v.verify)}</div><div>Причина: ${esc(v.reason)}</div>`,
        danger: "Прогресс этого игрока будет полностью заменён прогрессом исходного аккаунта.", dangerBtn: true, confirmWord: () => "ПЕРЕНЕСТИ", okLabel: "Перенести"
      });
      if (!v1) return;
      try {
        if (v1.src === p.id) return toast("Исходный и целевой аккаунт совпадают.", "err");
        const sd = await db.collection("users").doc(v1.src).get();
        if (!sd.exists || !sd.data().data) return toast("Исходный аккаунт не найден или пуст.", "err");
        ops = [{ ...base, type: "restore", reason: v1.reason, verify: v1.verify, payload: sd.data().data, meta: { source: "account:" + v1.src } }];
        okMsg = () => "Перенос поставлен в очередь и применится, когда игрок откроет игру.";
      } catch (e) { return toast(errText(e), "err"); }
    }
    if (!ops) return;
    const r = await runOps(ops, okMsg);
    if (r.done.length) openProfile(p.id);
  }

  /* ---------- массовая выдача ---------- */
  document.querySelectorAll("input[name=bulk-mode]").forEach(r => r.onchange = () => {
    const recent = document.querySelector("input[name=bulk-mode]:checked").value === "recent";
    $("bulk-list").hidden = recent; $("bulk-recent").hidden = !recent;
  });
  let bulkPlan = null;
  $("bulk-preview").onclick = async () => {
    const out = $("bulk-result"); bulkPlan = null;
    const amount = parseInt($("bulk-amount").value, 10), reason = $("bulk-reason").value.trim();
    if (!(amount >= 1 && amount <= MAX_BULK_EACH)) return toast(`Сумма: от 1 до ${fmt(MAX_BULK_EACH)}`, "err");
    if (reason.length < 3) return toast("Укажите причину", "err");
    out.innerHTML = '<div class="state">Подбираем игроков…</div>';
    try {
      const mode = document.querySelector("input[name=bulk-mode]:checked").value;
      const targets = new Map(), unresolved = [];
      if (mode === "recent") {
        const days = Math.max(1, Math.min(90, parseInt($("bulk-days").value, 10) || 7));
        const s = await db.collection("users").where("lastSeenAt", ">=", Date.now() - days * 864e5).orderBy("lastSeenAt", "desc").limit(MAX_BULK_PLAYERS + 1).get();
        s.docs.forEach(d => targets.set(d.id, parseUser(d).nick));
      } else {
        const lines = [...new Set($("bulk-list").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))];
        for (const line of lines) {
          let id = null, nick = "";
          if (/^[A-Za-z0-9]{20,40}$/.test(line)) { const d = await db.collection("users").doc(line).get(); if (d.exists) { id = d.id; nick = parseUser(d).nick; } }
          else {
            const s = await db.collection("leaderboard").where("nickLower", "==", normKey(line)).limit(2).get();
            if (s.size === 1) { id = s.docs[0].id; nick = s.docs[0].data().nick || line; }
            else if (s.size > 1) { unresolved.push(line + " (несколько совпадений)"); continue; }
          }
          if (id) targets.set(id, nick); else unresolved.push(line);
        }
      }
      let skippedBanned = 0;
      [...targets.keys()].forEach(id => { if (bannedSet.has(id)) { targets.delete(id); skippedBanned++; } });
      if (targets.size > MAX_BULK_PLAYERS) { out.innerHTML = `<div class="state err">Слишком много игроков (больше ${MAX_BULK_PLAYERS}). Сузьте выборку.</div>`; return; }
      if (!targets.size) { out.innerHTML = '<div class="state">Подходящих игроков не найдено.</div>'; return; }
      bulkPlan = { ids: [...targets.keys()], amount, reason };
      const total = amount * targets.size;
      out.innerHTML = `<div class="preview"><div class="big">${fmt(targets.size)} игроков · всего ${fmt(total)} монет</div>
        <div>Каждому: <b class="coin">+${fmt(amount)}</b> · Причина: ${esc(reason)}</div>
        ${skippedBanned ? `<div class="muted">Пропущено заблокированных: ${skippedBanned}</div>` : ""}
        ${unresolved.length ? `<div class="muted">Не найдено: ${unresolved.map(esc).join(", ")}</div>` : ""}
        <div class="muted small">Первые: ${[...targets].slice(0, 10).map(([i, n]) => esc(n || short(i))).join(", ")}${targets.size > 10 ? "…" : ""}</div>
        <div class="row"><button id="bulk-go" class="btn btn-danger" type="button" ${canWrite ? "" : "disabled"}>Выдать</button></div></div>`;
      $("bulk-go").onclick = bulkGo;
    } catch (e) { out.innerHTML = `<div class="state err">${esc(errText(e))}</div>`; }
  };
  async function bulkGo() {
    const plan = bulkPlan; if (!plan) return;
    const n = plan.ids.length, total = plan.amount * n;
    const v = await askOp({
      title: "Массовая выдача", fields: [],
      summary: () => `<div>Игроков: <b>${fmt(n)}</b></div><div>Каждому: <b class="coin">+${fmt(plan.amount)}</b></div><div>Общая сумма: <b class="coin">${fmt(total)}</b></div><div>Причина: ${esc(plan.reason)}</div>`,
      danger: "Действие нельзя отменить одним нажатием: потребуется списание у каждого игрока.", dangerBtn: true, confirmWord: () => "ВЫДАТЬ " + n, okLabel: "Выдать всем"
    });
    if (!v) return;
    const batchId = newId();
    const ops = plan.ids.map(id => ({ opId: newId(), target: id, type: "credit", amount: plan.amount, reason: plan.reason, kind: "compensation", batchId, meta: { bulk: true, players: n } }));
    $("bulk-go") && ($("bulk-go").disabled = true);
    const r = await runOps(ops, c => `Сохранено операций: ${c} из ${ops.length}`);
    $("bulk-result").innerHTML = `<div class="preview"><div class="big">Готово: ${r.done.length} из ${ops.length}</div>${r.failed.length ? `<div class="warnbox">Часть операций не выполнена. Не повторяйте всё заново — проверьте Журнал (пакет <code>${esc(batchId)}</code>).</div>` : ""}</div>`;
    bulkPlan = null;
  }

  /* ---------- журнал ---------- */
  let jCursor = null, journalLoaded = false;
  $("j-refresh").onclick = () => loadJournal(true); $("j-more").onclick = () => loadJournal(false);
  $("j-type").onchange = () => loadJournal(true);
  async function loadJournal(reset) {
    journalLoaded = true;
    if (reset) { jCursor = null; $("j-body").innerHTML = ""; }
    $("j-state").className = "state"; $("j-state").textContent = "Загрузка…"; $("j-more").hidden = true;
    try {
      let q = db.collection("adminOps"); const t = $("j-type").value;
      if (t) q = q.where("type", "==", t);
      q = q.orderBy("createdAt", "desc").limit(PAGE);
      if (jCursor) q = q.startAfter(jCursor);
      const s = await q.get();
      $("j-body").insertAdjacentHTML("beforeend", s.docs.map(d => { const h = d.data(); return `<tr>
        <td>${when(h.createdAt)}</td><td>${esc(h.adminEmail || short(h.admin || ""))}</td><td>${esc(TYPE_RU[h.type] || h.type)}</td>
        <td><a href="#" class="id-chip" data-uid="${esc(h.target)}">${esc(short(h.target))}</a></td>
        <td class="num">${h.amount != null ? fmt(h.amount) : ""}</td>
        <td>${esc(h.reason)}${h.verify ? `<br><span class="muted">Подтв.: ${esc(h.verify)}</span>` : ""}${h.batchId ? `<br><span class="muted">пакет ${esc(short(h.batchId))}</span>` : ""}</td></tr>`; }).join(""));
      $("j-body").querySelectorAll("[data-uid]").forEach(a => a.onclick = ev => { ev.preventDefault(); openProfile(a.dataset.uid); });
      if (s.docs.length) jCursor = s.docs[s.docs.length - 1];
      $("j-more").hidden = s.docs.length < PAGE;
      $("j-state").textContent = $("j-body").children.length ? "" : "Записей пока нет.";
    } catch (e) { $("j-state").className = "state err"; $("j-state").textContent = errText(e); }
  }

  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("dlg").hidden) closeDlg(); else if (!$("profile").hidden) closeProfile(); } });
})();