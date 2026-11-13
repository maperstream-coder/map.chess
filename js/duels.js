/* maper.chess — «Поединки»: онлайн-партии с друзьями через Firestore.
   Документ games/{id}: {p1,p1Nick,p2,p2Nick,status:"invited"|"active"|"finished",
   winner:null|uid|"draw", fen, turn, lastMove, tc (минуты, 0 = без времени),
   times:{w,b}, createdAt, updatedAt,
   stake (коины с каждого игрока, 0 = без ставки), pend:[uid…] (чьи ставки ещё не рассчитаны)}. p1 — белые.
   Ставки: приглашающий вносит ставку при отправке приглашения, принимающий — при принятии; победитель забирает банк (2×ставка),
   при ничьей ставки возвращаются, при отмене/отказе возвращается ставка приглашающего.
   Чат: games/{id}/messages/{auto}: {from,nick,text,ts}.
   Load AFTER js/friends.js, BEFORE js/hints.js. */
(function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nav.duels": "Duels", "du.title": "Duels", "du.sub": "Play online with your friends",
    "du.new": "New invite", "du.pick": "Choose a friend", "du.cancel": "Cancel",
    "du.invites": "Invitations", "du.noneInv": "No invitations",
    "du.active": "Active games", "du.noneActive": "No active games — invite a friend!",
    "du.finished": "Finished", "du.yourMove": "Your move", "du.theirMove": "Opponent's move",
    "du.accept": "Accept", "du.decline": "Decline",
    "du.youWin": "Victory!", "du.youLose": "Defeat", "du.draw": "Draw",
    "du.winsBy": "{name} wins", "du.analyze": "Game review", "du.noMoves": "This game has no saved moves (it was played before the update)", "du.rematch": "Rematch", "du.resign": "Resign",
    "du.waiting": "Waiting for the opponent…", "du.err": "Something went wrong",
    "du.off": "Sign in to play with friends", "du.sent": "Invite sent",
    "du.youInCheck": "You are in check!", "du.theyInCheck": "Check!",
    "du.time": "Time control", "du.tc5": "5 min", "du.tc10": "10 min",
    "du.tc30": "30 min", "du.tc0": "No time",
    "du.chat": "Chat", "du.chatPh": "Message…", "du.flag": "Time out",
    "du.chatEmpty": "No messages yet — say hi!", "du.close": "Close",
    "du.capByMe": "You captured", "du.capByOpp": "{name} captured",
    "du.r.mate": "Checkmate", "du.r.resign": "Resignation", "du.r.time": "Time out",
    "du.r.stalemate": "Stalemate", "du.r.repeat": "Threefold repetition",
    "du.r.material": "Insufficient material", "du.r.fifty": "50-move rule",
    "du.inviteTo": "Invite {name} to a game", "du.send": "Send invite",
    "du.stake": "Stake per player", "du.stakeFree": "Free", "du.stakeCustom": "Custom",
    "du.stakeSum": "Pot: {n} — the winner takes it all, a draw returns the stakes.",
    "du.stakeNone": "Just for fun — no coins at stake.", "du.balance": "You have {n}",
    "du.poor": "Not enough coins for this stake", "du.pot": "Pot {n}", "du.stakeTag": "Stake {n}",
    "du.potWon": "+{n} coins — the pot is yours!", "du.refund": "+{n} coins returned",
    "du.withdraw": "Withdraw", "du.sentInv": "Sent invitations", "du.noneSent": "No sent invitations",
    "du.waitingFor": "Waiting for {name}", "du.gone": "This invitation is no longer available",
    "du.resignStake": "Resign and lose {n} coins?", "du.acceptStake": "Accept · {n}",
    "du.q1": "Good game!", "du.q2": "Nice move!", "du.q3": "Your move ⏱", "du.q4": "Rematch?"
  }, {
    "nav.duels": "Поединки", "du.title": "Поединки", "du.sub": "Играй онлайн с друзьями",
    "du.new": "Создать приглашение", "du.pick": "Выбери друга", "du.cancel": "Отмена",
    "du.invites": "Приглашения", "du.noneInv": "Приглашений нет",
    "du.active": "Текущие партии", "du.noneActive": "Нет текущих партий — позови друга!",
    "du.finished": "Завершённые", "du.yourMove": "Ваш ход", "du.theirMove": "Ход соперника",
    "du.accept": "Принять", "du.decline": "Отклонить",
    "du.youWin": "Победа!", "du.youLose": "Поражение", "du.draw": "Ничья",
    "du.winsBy": "Победа: {name}", "du.analyze": "Анализ партии", "du.noMoves": "У этой партии нет записи ходов (она сыграна до обновления)", "du.rematch": "Реванш", "du.resign": "Сдаться",
    "du.waiting": "Ждём соперника…", "du.err": "Что-то пошло не так",
    "du.off": "Войдите, чтобы играть с друзьями", "du.sent": "Приглашение отправлено",
    "du.youInCheck": "Вам шах!", "du.theyInCheck": "Шах!",
    "du.time": "Контроль времени", "du.tc5": "5 мин", "du.tc10": "10 мин",
    "du.tc30": "30 мин", "du.tc0": "Без времени",
    "du.chat": "Чат", "du.chatPh": "Сообщение…", "du.flag": "Время вышло",
    "du.chatEmpty": "Сообщений пока нет — поздоровайся!", "du.close": "Закрыть",
    "du.capByMe": "Вы съели", "du.capByOpp": "{name} съел(а)",
    "du.r.mate": "Мат", "du.r.resign": "Сдача", "du.r.time": "Время вышло",
    "du.r.stalemate": "Пат", "du.r.repeat": "Троекратное повторение",
    "du.r.material": "Недостаточно материала", "du.r.fifty": "Правило 50 ходов",
    "du.inviteTo": "Позвать {name} на партию", "du.send": "Отправить приглашение",
    "du.stake": "Ставка с каждого игрока", "du.stakeFree": "Без ставки", "du.stakeCustom": "Своя",
    "du.stakeSum": "Банк: {n} — победитель забирает всё, при ничьей ставки возвращаются.",
    "du.stakeNone": "Просто для удовольствия — коины не ставятся.", "du.balance": "У вас {n}",
    "du.poor": "Не хватает коинов для такой ставки", "du.pot": "Банк {n}", "du.stakeTag": "Ставка {n}",
    "du.potWon": "+{n} коинов — банк ваш!", "du.refund": "+{n} коинов возвращено",
    "du.withdraw": "Отозвать", "du.sentInv": "Отправленные приглашения", "du.noneSent": "Отправленных приглашений нет",
    "du.waitingFor": "Ждём ответа: {name}", "du.gone": "Это приглашение уже недоступно",
    "du.resignStake": "Сдаться и потерять {n} коинов?", "du.acceptStake": "Принять · {n}",
    "du.q1": "Хорошая партия!", "du.q2": "Красивый ход!", "du.q3": "Твой ход ⏱", "du.q4": "Реванш?"
  });

  const $ = id => document.getElementById(id);
  let unsub = null, unsubChat = null, tickIv = null;
  let currentId = null, board = null, chess = null, myColor = "w", lastFen = null;
  let lastData = null, endingGame = false, pickerTc = 0, pickerStake = 0, pickerFi = false;
  let resultShownFor = null, resultTimer = null, capPrev = null, rematchSent = false;
  let chatUnread = 0, chatLastTs = 0, chatReady = false;

  const TC_OPTS = [5, 10, 30, 0];
  const tcLabel = tc => tc === 0 ? t("du.tc0") : t("du.tc" + tc);

  /* ================= шахматы Фишера (js/fischer.js) ================= */
  const isFi = (id, g) => !!(window.Fischer && Fischer.isFischerGame(id, g));
  const fiTag = (id, g) => isFi(id, g) ? ` <span class="du-fi-tag">960</span>` : "";
  /* переключатель «Классика / Фишер 960»; get/set — как у stakePicker */
  function variantPicker(get, set) {
    const row = document.createElement("div");
    row.className = "du-var-row";
    const mk = (v, label) => {
      const c = document.createElement("button");
      c.type = "button"; c.className = "du-tc-chip"; c.textContent = label;
      c.addEventListener("click", () => { set(v); paint(); });
      row.appendChild(c); return c;
    };
    const a = mk(false, t("du.classic")), b = mk(true, "♞ " + t("du.fischer"));
    const paint = () => { a.classList.toggle("on", !get()); b.classList.toggle("on", !!get()); };
    paint();
    return row;
  }

  /* ================= ставки (коины) ================= */
  const STAKE_OPTS = [0, 50, 100, 200, 500, 1000], STAKE_MAX = 100000;
  const FV = () => firebase.firestore.FieldValue;
  const coinsNow = () => Math.max(0, Math.floor(+(UI.state && UI.state.coins) || 0));
  function addCoins(n) {
    if (!UI.state || !n) return;
    UI.state.coins = Math.max(0, coinsNow() + Math.round(n));
    saveState(UI.state); UI.renderTopbar();
  }
  const fmtN = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
  const coinTxt = n => `${fmtN(n)} <i class="mcoin"></i>`;
  /* журнал выплат на этом устройстве: защита от двойного начисления */
  const PAID_KEY = "mc.duelPaid.v1", INTENT_KEY = "mc.duelIntent.v1";
  const jget = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  const jset = (k, o) => {
    const keys = Object.keys(o);
    if (keys.length > 300) keys.sort((a, b) => (o[a].ts || 0) - (o[b].ts || 0)).slice(0, keys.length - 300).forEach(x => delete o[x]);
    try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {}
  };
  const payoutFor = (d, uid) => {
    const st = +d.stake || 0;
    if (st <= 0) return 0;
    if (d.status === "declined" || d.status === "cancelled") return uid === d.p1 ? st : 0;
    if (d.status !== "finished") return null;                 /* ещё идёт — не рассчитываем */
    if (d.winner === "draw") return st;
    return d.winner === uid ? st * 2 : 0;
  };
  let settling = false;
  /* Каждый клиент рассчитывает только СВОЮ часть: атомарно снимает себя из pend, затем начисляет коины. */
  async function settleOne(ref, uid) {
    const key = ref.id + ":" + uid, paid = jget(PAID_KEY), intent = jget(INTENT_KEY);
    let amt = 0, removed = false;
    try {
      await Cloud._db.runTransaction(async tx => {
        const snap = await tx.get(ref), d = snap.data();
        if (!d || !(d.pend || []).includes(uid)) { removed = false; return; }
        const p = payoutFor(d, uid);
        if (p === null) { removed = false; return; }
        amt = p;
        intent[key] = { amt: p, ts: Date.now() }; jset(INTENT_KEY, intent);   /* намерение — до записи, чтобы пережить обрыв */
        tx.update(ref, { pend: FV().arrayRemove(uid), updatedAt: Date.now() });
        removed = true;
      });
    } catch (e) { console.warn("settle", e); return 0; }
    if (!removed) return 0;
    if (!paid[key]) { if (amt > 0) addCoins(amt); paid[key] = { ts: Date.now() }; jset(PAID_KEY, paid); }
    const i2 = jget(INTENT_KEY); delete i2[key]; jset(INTENT_KEY, i2);
    return amt;
  }
  /* восстановление: транзакция прошла, а коины начислить не успели (закрыли вкладку) */
  async function recoverIntents(uid) {
    const intent = jget(INTENT_KEY), paid = jget(PAID_KEY);
    for (const key of Object.keys(intent)) {
      const [gid, u] = key.split(":");
      if (u !== uid) continue;
      if (paid[key]) { delete intent[key]; continue; }
      try {
        const snap = await Cloud._db.collection("games").doc(gid).get();
        const d = snap.data();
        if (!d || !(d.pend || []).includes(uid)) {          /* из pend уже вычеркнуты → выплата положена */
          const amt = +intent[key].amt || 0;
          if (amt > 0) addCoins(amt);
          paid[key] = { ts: Date.now() }; jset(PAID_KEY, paid); delete intent[key];
          if (amt > 0) UI._toast(t("du.refund", { n: fmtN(amt) }));
        } else delete intent[key];                            /* транзакция не состоялась — обычный расчёт сделает settle() */
      } catch (e) {}
    }
    jset(INTENT_KEY, intent);
  }
  async function settleAll(quiet) {
    if (settling || !Cloud.enabled || !Cloud.user || !UI.state) return;
    settling = true;
    try {
      const uid = me();
      await recoverIntents(uid);
      const q = await Cloud._db.collection("games").where("pend", "array-contains", uid).get();
      for (const doc of q.docs) {
        const d = doc.data();
        if (payoutFor(d, uid) === null) continue;
        const got = await settleOne(doc.ref, uid);
        if (got > 0 && !quiet) {
          const won = d.status === "finished" && d.winner === uid;
          UI._toast(won ? t("du.potWon", { n: fmtN(got) }) : t("du.refund", { n: fmtN(got) }));
        }
      }
    } catch (e) { console.warn("settleAll", e); }
    settling = false;
  }
  let settleTimer = null;
  const _emitD = Cloud._emit;
  Cloud._emit = function (x) { _emitD.call(this, x); clearTimeout(settleTimer); settleTimer = setTimeout(() => settleAll(true), 1800); };
  setInterval(() => { if (Cloud.enabled && Cloud.user) settleAll(false); }, 45000);
  setTimeout(() => settleAll(false), 4000);

  /* выбор ставки: чипы + своя сумма. get/set — геттер и сеттер значения у вызывающего */
  function stakePicker(get, set) {
    const box = document.createElement("div");
    box.className = "du-stake-box";
    box.innerHTML = `<p class="fr-sec du-stake-t"></p><div class="du-tc-row du-stake-row"></div>
      <label class="du-stake-custom"><span></span><input type="number" min="0" step="10" inputmode="numeric"></label>
      <p class="du-stake-sum"></p>`;
    box.querySelector(".du-stake-t").textContent = t("du.stake");
    box.querySelector(".du-stake-custom span").textContent = t("du.stakeCustom");
    const row = box.querySelector(".du-stake-row"), inp = box.querySelector("input"), sum = box.querySelector(".du-stake-sum");
    const paint = () => {
      const v = get(), bal = coinsNow();
      row.querySelectorAll(".du-tc-chip").forEach(c => {
        const cv = +c.dataset.v;
        c.classList.toggle("on", cv === v); c.classList.toggle("off", cv > bal);
      });
      if (document.activeElement !== inp) inp.value = v > 0 && !STAKE_OPTS.includes(v) ? v : "";
      sum.innerHTML = (v > 0 ? t("du.stakeSum", { n: coinTxt(v * 2) }) : t("du.stakeNone")) +
        ` <span class="du-stake-bal${v > bal ? " bad" : ""}">${t(v > bal ? "du.poor" : "du.balance", { n: coinTxt(bal) })}</span>`;
    };
    STAKE_OPTS.forEach(v => {
      const c = document.createElement("button");
      c.type = "button"; c.className = "du-tc-chip"; c.dataset.v = v;
      c.innerHTML = v === 0 ? t("du.stakeFree") : coinTxt(v);
      c.addEventListener("click", () => { set(v); paint(); });
      row.appendChild(c);
    });
    inp.addEventListener("input", () => {
      const v = Math.max(0, Math.min(STAKE_MAX, Math.floor(+inp.value || 0)));
      set(v); paint();
    });
    paint();
    return box;
  }

  const sec = document.createElement("section");
  sec.id = "view-duels"; sec.className = "view";
  sec.innerHTML = `
    <div class="seg-tabs">
      <button type="button" class="seg-tab" data-go="friends" data-i18n="fr.tabFriends"></button>
      <button type="button" class="seg-tab active" data-go="duels" data-i18n="fr.tabDuels"></button>
    </div>
    <h2 class="view-title" data-i18n="du.title"></h2>
    <p class="lb-sub" data-i18n="du.sub"></p>
    <button type="button" class="btn btn-primary du-new" id="du-new" data-i18n="du.new"></button>
    <div id="du-picker" class="du-picker" hidden></div>
    <p class="fr-sec" data-i18n="du.invites"></p>
    <div id="du-invites"></div>
    <p class="fr-sec" data-i18n="du.sentInv"></p>
    <div id="du-sent"></div>
    <p class="fr-sec" data-i18n="du.active"></p>
    <div id="du-active"></div>
    <p class="fr-sec" data-i18n="du.finished"></p>
    <div id="du-finished"></div>`;
  document.querySelector(".views").appendChild(sec);
  /* «Поединки» — часть вкладки «Друзья»: отдельной кнопки в меню больше нет */
  sec.querySelectorAll(".seg-tab").forEach(b => b.addEventListener("click", () => UI.showView(b.dataset.go)));
  const markFriendsNav = () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === "friends"));
  };

  const gsec = document.createElement("section");
  gsec.id = "view-duel-game"; gsec.className = "view";
  gsec.dataset.mode = "duel";
  gsec.innerHTML = `
    <div class="game-header dg-header">
      <button class="icon-btn" id="duel-exit" aria-label="Back">←</button>
      <div class="game-titles">
        <span class="game-tier" id="duel-tier"></span>
        <span class="game-name" id="duel-name"></span>
      </div>
      <span class="dg-chips" id="duel-chips"></span>
    </div>
    <p class="game-status dg-status" id="duel-status"><i class="gs-dot"></i><span id="duel-status-text"></span></p>
    <div class="gp-bar dg-bar" id="duel-bar-opp">
      <span class="gp-ava" id="duel-opp-ava"></span>
      <div class="gp-who"><b id="duel-opp-name"></b><small id="duel-opp-sub"></small></div>
      <div class="gp-cap du-cap" id="duel-cap-opp"></div>
      <div class="dg-clock" id="duel-clock-opp"><b id="duel-opp-time">—</b></div>
    </div>
    <div class="board-wrap"><div class="board" id="duel-board"></div></div>
    <div class="gp-bar dg-bar dg-me" id="duel-bar-my">
      <span class="gp-ava gp-ava-me" id="duel-my-ava"></span>
      <div class="gp-who"><b id="duel-my-name"></b><small id="duel-my-sub"></small></div>
      <div class="gp-cap du-cap" id="duel-cap-my"></div>
      <div class="dg-clock" id="duel-clock-my"><b id="duel-my-time">—</b></div>
    </div>
    <div class="dg-actions">
      <button type="button" class="dg-btn dg-chat" id="duel-chat-btn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5H10.5L6 20v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg><span data-i18n="du.chat">${t("du.chat")}</span><i class="du-badge" id="duel-chat-badge" hidden></i>
      </button>
      <button type="button" class="dg-btn dg-danger" id="duel-resign"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 5h11l-2.2 3.5L17 12H6"/></svg><span data-i18n="du.resign">${t("du.resign")}</span></button>
      <button type="button" class="dg-btn du-analyze" id="duel-analyze" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/></svg><span data-i18n="du.analyze">${t("du.analyze")}</span></button>
      <button type="button" class="dg-btn dg-primary du-rematch" id="duel-rematch" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/></svg><span data-i18n="du.rematch">${t("du.rematch")}</span></button>
    </div>`;
  document.querySelector(".views").appendChild(gsec);

  /* чат вынесен в отдельную панель: открывается кнопкой «Чат», поле ввода — только внутри неё */
  const sheet = document.createElement("div");
  sheet.className = "du-sheet"; sheet.id = "duel-sheet";
  sheet.setAttribute("aria-hidden", "true");
  sheet.innerHTML = `
    <div class="du-sheet-card dg-sheet-card" role="dialog">
      <div class="dg-sheet-head">
        <span class="gp-ava dg-chat-ava" id="duel-chat-ava"></span>
        <div class="gp-who"><b id="duel-chat-name"></b><small data-i18n="du.chat">${t("du.chat")}</small></div>
        <button type="button" class="du-sheet-x" id="duel-sheet-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="du-chat-log" id="duel-chat-log"></div>
      <div class="dg-quick" id="duel-quick"></div>
      <div class="dg-chat-row">
        <input class="du-chat-input" id="duel-chat-input" maxlength="200" autocomplete="off">
        <button class="du-chat-send" id="duel-chat-send" type="button" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-7-6 15-2.5-6z"/><path d="M11.5 14L20 5"/></svg></button>
      </div>
    </div>`;
  (document.querySelector(".phone-frame") || document.body).appendChild(sheet);

  const setSt = x => { const el = $("duel-status-text"); if (el) el.textContent = x; };
  const initial = n => String(n || "?").trim().charAt(0).toUpperCase() || "?";
  const hhmm = ts => { try { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); } catch (e) { return ""; } };
  const oppName = d => (d.p1 === Cloud.user?.uid ? d.p2Nick : d.p1Nick) || "—";
  const errMsg = e => (e && e.code === "permission-denied")
    ? t("du.err") + " — Firestore: нет прав. Firebase Console → Firestore → Rules → вставьте firestore.rules → Publish"
    : t("du.err");
  const me = () => Cloud.user && Cloud.user.uid;

  const stakeTag = g => (g.stake || 0) > 0 ? ` · <span class="du-stake-tag">${t("du.stakeTag", { n: coinTxt(g.stake) })}</span>` : "";

  /* отказ / отзыв приглашения. Без ставки — как раньше (документ удаляется); со ставкой — меняем статус,
     чтобы приглашающий мог получить своё обратно (см. settleAll). */
  async function closeInvite(g, status) {
    const ref = Cloud._db.collection("games").doc(g.id);
    try {
      if (!((+g.stake || 0) > 0)) { await ref.delete(); renderList(); return; }
      await Cloud._db.runTransaction(async tx => {
        const snap = await tx.get(ref), cur = snap.data();
        if (!cur || cur.status !== "invited") throw new Error("gone");
        tx.update(ref, { status, updatedAt: Date.now() });
      });
      if (status === "cancelled") settleAll(false);        /* свою ставку забираем сразу */
      renderList();
    } catch (e) { console.warn("closeInvite", e); UI._toast(t("du.gone")); renderList(); }
  }
  const decline = g => closeInvite(g, "declined");
  const withdraw = g => closeInvite(g, "cancelled");

  /* ================= список партий ================= */
  async function renderList() {
    const inv = $("du-invites"), act = $("du-active"), fin = $("du-finished");
    inv.innerHTML = ""; act.innerHTML = ""; fin.innerHTML = ""; if ($("du-sent")) $("du-sent").innerHTML = "";
    if (!Cloud.enabled || !Cloud.user) {
      act.innerHTML = `<p class="lb-note">${t("du.off")}</p>`; return;
    }
    try {
      const col = Cloud._db.collection("games");
      const [q1, q2] = await Promise.all([col.where("p1", "==", me()).get(), col.where("p2", "==", me()).get()]);
      const byId = new Map();
      [...q1.docs, ...q2.docs].forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));
      const mine = [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const invited = mine.filter(g => g.status === "invited" && g.p2 === me());
      const sent = mine.filter(g => g.status === "invited" && g.p1 === me());
      const active = mine.filter(g => g.status === "active");
      const done = mine.filter(g => g.status === "finished");

      inv.innerHTML = invited.length ? "" : `<p class="lb-note">${t("du.noneInv")}</p>`;
      invited.forEach(g => {
        const row = document.createElement("div");
        row.className = "fr-row";
        row.innerHTML = `<span class="fr-ava">${(g.p1Nick || "?")[0].toUpperCase()}</span>
          <span class="fr-info"><b></b><small>${t("du.title")} · ⏱ ${tcLabel(g.tc || 0)}${stakeTag(g)}${fiTag(g.id, g)}</small></span>`;
        row.querySelector("b").textContent = g.p1Nick || "—";
        const a = document.createElement("span"); a.className = "fr-actions";
        const ok = document.createElement("button"); ok.className = "btn btn-primary";
        ok.textContent = (g.stake || 0) > 0 ? t("du.acceptStake", { n: fmtN(g.stake) }) : t("du.accept");
        ok.addEventListener("click", () => accept(g.id));
        const no = document.createElement("button"); no.className = "btn btn-ghost"; no.textContent = t("du.decline");
        no.addEventListener("click", () => decline(g));
        a.append(ok, no); row.appendChild(a); inv.appendChild(row);
      });

      const snt = $("du-sent");
      if (snt) {
        snt.innerHTML = sent.length ? "" : `<p class="lb-note">${t("du.noneSent")}</p>`;
        sent.forEach(g => {
          const row = document.createElement("div");
          row.className = "fr-row";
          row.innerHTML = `<span class="fr-ava">${(g.p2Nick || "?")[0].toUpperCase()}</span>
            <span class="fr-info"><b></b><small>${t("du.waitingFor", { name: "" }).replace(/\s*$/, "")} · ⏱ ${tcLabel(g.tc || 0)}${stakeTag(g)}${fiTag(g.id, g)}</small></span>`;
          row.querySelector("b").textContent = g.p2Nick || "—";
          const a = document.createElement("span"); a.className = "fr-actions";
          const wd = document.createElement("button"); wd.className = "btn btn-ghost"; wd.textContent = t("du.withdraw");
          wd.addEventListener("click", () => withdraw(g));
          a.appendChild(wd); row.appendChild(a); snt.appendChild(row);
        });
      }

      act.innerHTML = active.length ? "" : `<p class="lb-note">${t("du.noneActive")}</p>`;
      active.forEach(g => {
        const myTurn = g.turn === (g.p1 === me() ? "w" : "b");
        const row = document.createElement("button");
        row.type = "button";
        row.className = "fr-row du-game-row";
        row.innerHTML = `<span class="fr-ava">${(oppName(g))[0].toUpperCase()}</span>
          <span class="fr-info"><b></b><small class="${myTurn ? "du-myturn" : ""}"></small></span>
          <span class="du-tc">${fiTag(g.id, g)} ⏱ ${tcLabel(g.tc || 0)}${(g.stake || 0) > 0 ? ` · <span class="du-stake-tag">${coinTxt(g.stake * 2)}</span>` : ""}</span>`;
        row.querySelector("b").textContent = oppName(g);
        row.querySelector("small").textContent = myTurn ? `● ${t("du.yourMove")}` : t("du.theirMove");
        row.addEventListener("click", () => openGame(g.id));
        act.appendChild(row);
      });

      fin.innerHTML = done.length ? "" : `<p class="lb-note">—</p>`;
      done.slice(0, 5).forEach(g => {
        const row = document.createElement("div");
        row.className = "fr-row";
        const res = g.winner === "draw" ? t("du.draw") : g.winner === me() ? t("du.youWin") : t("du.youLose");
        row.innerHTML = `<span class="fr-ava">${(oppName(g))[0].toUpperCase()}</span>
          <span class="fr-info"><b></b><small></small></span>`;
        row.querySelector("b").textContent = oppName(g);
        row.querySelector("small").innerHTML = "";
        row.querySelector("small").append(res);
        if ((g.stake || 0) > 0) {
          const sp = document.createElement("span");
          sp.className = "du-stake-res " + (g.winner === "draw" ? "" : g.winner === me() ? "win" : "loss");
          sp.innerHTML = " · " + (g.winner === "draw" ? coinTxt(0).replace(/^0/, "±0") : (g.winner === me() ? "+" : "−") + coinTxt(g.stake));
          row.querySelector("small").appendChild(sp);
        }
        const a = document.createElement("span"); a.className = "fr-actions";
        if (hasMoves(g)) {
          const an = document.createElement("button"); an.className = "btn btn-ghost"; an.textContent = "◎ " + t("du.analyze");
          an.addEventListener("click", () => openAnalysis(g));
          a.appendChild(an);
        }
        const rm = document.createElement("button"); rm.className = "btn btn-ghost"; rm.textContent = t("du.rematch");
        rm.addEventListener("click", () => openPickerWithTc(oppName(g), g.p1 === me() ? g.p2 : g.p1, g.tc || 0, g.stake || 0, isFi(g.id, g)));
        a.appendChild(rm); row.appendChild(a); fin.appendChild(row);
      });
    } catch (e) { console.warn("duels", e); act.innerHTML = `<p class="lb-note">${errMsg(e)}</p>`; }
  }

  /* ================= приглашение + выбор времени ================= */
  async function invite(nick, uid, tc, stake, fischer) {
    stake = Math.max(0, Math.min(STAKE_MAX, Math.floor(+stake || 0)));
    if (stake > coinsNow()) { UI._toast(t("du.poor")); return false; }
    if (stake > 0) addCoins(-stake);                       /* ставка замораживается сразу */
    try {
      /* Фишер: расстановка выводится из id партии и кладётся в поле fen (новых полей в базе нет) */
      const ref = Cloud._db.collection("games").doc();
      await ref.set({
        p1: me(), p1Nick: UI.state.nick || "?", p2: uid, p2Nick: nick,
        status: "invited", winner: null, fen: fischer && window.Fischer ? Fischer.fenForGame(ref.id) : null,
        turn: "w", lastMove: null,
        tc: tc || 0, times: null, stake, pend: stake > 0 ? [me()] : [],
        createdAt: Date.now(), updatedAt: Date.now()
      });
      UI._toast(t("du.sent"));
      renderList();
      return true;
    } catch (e) {
      if (stake > 0) addCoins(stake);                      /* не отправилось — возвращаем */
      console.warn("invite", e); UI._toast(errMsg(e)); return false;
    }
  }

  /* окно «Позвать на партию»: выбор контроля времени и отправка (используется из списка друзей и профиля) */
  function invitePrompt(nick, uid, fischer) {
    if (!Cloud.enabled || !Cloud.user) { UI._toast(t("du.off")); return; }
    const old = document.getElementById("inv-overlay"); if (old) old.remove();
    let tc = 0, stake = 0, fi = !!fischer;
    const ov = document.createElement("div");
    ov.id = "inv-overlay"; ov.className = "inv-overlay";
    ov.innerHTML = `<div class="inv-card" role="dialog">
      <b class="inv-title"></b>
      <p class="fr-sec" style="margin:10px 0 6px">${t("du.time")}</p>
      <div class="du-tc-row"></div>
      <p class="fr-sec" style="margin:10px 0 6px">${t("du.variant")}</p>
      <div class="inv-var"></div>
      <div class="inv-stake"></div>
      <div class="inv-acts">
        <button type="button" class="btn btn-ghost inv-cancel">${t("du.cancel")}</button>
        <button type="button" class="btn btn-primary inv-send">${t("du.send")}</button>
      </div></div>`;
    ov.querySelector(".inv-title").textContent = t("du.inviteTo", { name: nick });
    const row = ov.querySelector(".du-tc-row");
    TC_OPTS.forEach(v => {
      const c = document.createElement("button");
      c.type = "button"; c.className = "du-tc-chip" + (v === tc ? " on" : "");
      c.textContent = tcLabel(v);
      c.addEventListener("click", () => { tc = v; row.querySelectorAll(".du-tc-chip").forEach(x => x.classList.remove("on")); c.classList.add("on"); });
      row.appendChild(c);
    });
    ov.querySelector(".inv-var").appendChild(variantPicker(() => fi, v => { fi = v; }));
    ov.querySelector(".inv-stake").appendChild(stakePicker(() => stake, v => { stake = v; }));
    const close = () => ov.remove();
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    ov.querySelector(".inv-cancel").addEventListener("click", close);
    ov.querySelector(".inv-send").addEventListener("click", async () => {
      const b = ov.querySelector(".inv-send"); b.disabled = true;
      const ok = await invite(nick, uid, tc, stake, fi);
      if (ok) close(); else b.disabled = false;
    });
    document.body.appendChild(ov);
  }

  function openPickerWithTc(nick, uid, tc, stake, fischer) {
    /* реванш — сразу шлём с тем же контролем времени, той же ставкой и тем же типом партии */
    invite(nick, uid, tc, stake || 0, fischer);
  }

  $("du-new").addEventListener("click", async () => {
    const box = $("du-picker");
    if (!box.hidden) { box.hidden = true; return; }
    pickerTc = 0; pickerStake = 0; pickerFi = false;
    box.innerHTML = `<p class="fr-sec">${t("du.pick")}</p>
      <p class="fr-sec" style="margin-top:10px">${t("du.time")}</p>
      <div class="du-tc-row" id="du-tc-row"></div>
      <p class="fr-sec" style="margin-top:10px">${t("du.variant")}</p>
      <div id="du-var-slot"></div><div id="du-stake-slot"></div>`;
    box.querySelector("#du-var-slot").appendChild(variantPicker(() => pickerFi, v => { pickerFi = v; }));
    box.querySelector("#du-stake-slot").appendChild(stakePicker(() => pickerStake, v => { pickerStake = v; }));
    const row = box.querySelector("#du-tc-row");
    TC_OPTS.forEach(tc => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "du-tc-chip" + (tc === pickerTc ? " on" : "");
      chip.textContent = tcLabel(tc);
      chip.addEventListener("click", () => {
        pickerTc = tc;
        row.querySelectorAll(".du-tc-chip").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
      });
      row.appendChild(chip);
    });
    try {
      const fr = await Cloud._db.collection("users").doc(me()).collection("friends").get();
      if (fr.empty) box.innerHTML += `<p class="lb-note">${t("fr.empty")}</p>`;
      fr.forEach(d => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "fr-row du-game-row";
        b.innerHTML = `<span class="fr-ava">${Nick.safe(d.data().nick || "?")[0].toUpperCase()}</span>
          <span class="fr-info"><b></b><small>⏱ ${t("du.time").toLowerCase()}</small></span>`;
        b.querySelector("b").textContent = d.data().nick ? Nick.safe(d.data().nick) : "—";
        b.querySelector("small").textContent = "⏱ " + tcLabel(pickerTc);
        b.addEventListener("click", () => {
          if (pickerStake > coinsNow()) { UI._toast(t("du.poor")); return; }
          box.hidden = true; invite(d.data().nick, d.id, pickerTc, pickerStake, pickerFi);
        });
        box.appendChild(b);
      });
    } catch (e) { box.innerHTML += `<p class="lb-note">${errMsg(e)}</p>`; }
    box.hidden = false;
  });

  async function accept(id) {
    let paid = 0;
    try {
      const ref = Cloud._db.collection("games").doc(id);
      const snap = await ref.get();
      const d = snap.data() || {};
      if (d.status !== "invited") { UI._toast(t("du.gone")); renderList(); return; }
      const tc = d.tc || 0, stake = Math.max(0, +d.stake || 0);
      if (stake > coinsNow()) { UI._toast(t("du.poor")); return; }
      if (stake > 0) { addCoins(-stake); paid = stake; }      /* вторая ставка вносится при принятии */
      await Cloud._db.runTransaction(async tx => {
        const s2 = await tx.get(ref), cur = s2.data();
        if (!cur || cur.status !== "invited") throw new Error("gone");
        tx.update(ref, {
          status: "active",
          /* Фишер: берём расстановку из приглашения, только если она точно соответствует id партии (подмену не принимаем) */
          fen: (window.Fischer && cur.fen && cur.fen === Fischer.fenForGame(id)) ? cur.fen : (new Chess()).fen(),
          turn: "w", moves: [],
          times: tc > 0 ? { w: tc * 60000, b: tc * 60000 } : null,
          pend: stake > 0 ? [cur.p1, cur.p2] : [],
          updatedAt: Date.now()
        });
      });
      paid = 0;
      openGame(id);
    } catch (e) {
      if (paid > 0) addCoins(paid);                            /* принять не вышло — ставка возвращается */
      console.warn("accept", e); UI._toast(e && e.message === "gone" ? t("du.gone") : errMsg(e)); renderList();
    }
  }

  /* ================= часы ================= */
  function fmtClock(ms) {
    if (ms == null) return "∞";
    ms = Math.max(0, ms);
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /* Часы идут по ЛОКАЛЬНОМУ монотонному таймеру (performance.now), а не по разнице
     «моё Date.now() − updatedAt соперника»: часы у двух устройств расходятся, и из-за этого
     секунды «летели» быстрее. Отметку времени соперника используем только для небольшой
     поправки на задержку сети (не больше 2 с). */
  const CLK = { key: null, at: 0, base: 0 };
  const nowMs = () => (window.performance && performance.now) ? performance.now() : Date.now();
  function turnElapsed(d) {
    if (!d || d.status !== "active") return 0;
    const key = [d.status, d.turn, d.fen, d.times ? d.times.w + ":" + d.times.b : ""].join("|");
    if (CLK.key !== key) {
      CLK.key = key; CLK.at = nowMs();
      CLK.base = Math.max(0, Math.min(2000, Date.now() - (d.updatedAt || Date.now())));
    }
    return CLK.base + Math.max(0, nowMs() - CLK.at);
  }

  function paintClocks() {
    const d = lastData;
    if (!d || !d.times) {
      $("duel-opp-time").textContent = "∞";
      $("duel-my-time").textContent = "∞";
      $("duel-clock-opp").classList.remove("active", "low");
      $("duel-clock-my").classList.remove("active", "low");
      return;
    }
    const elapsed = turnElapsed(d);
    const rem = { w: d.times.w, b: d.times.b };
    if (d.status === "active") rem[d.turn] -= elapsed;
    const mySide = myColor, oppSide = myColor === "w" ? "b" : "w";
    const myRem = rem[mySide], oppRem = rem[oppSide];
    $("duel-my-time").textContent = fmtClock(myRem);
    $("duel-opp-time").textContent = fmtClock(oppRem);
    const myActive = d.status === "active" && d.turn === mySide;
    const oppActive = d.status === "active" && d.turn === oppSide;
    $("duel-clock-my").classList.toggle("active", myActive);
    $("duel-clock-opp").classList.toggle("active", oppActive);
    $("duel-clock-my").classList.toggle("low", myRem != null && myRem < 30000);
    $("duel-clock-opp").classList.toggle("low", oppRem != null && oppRem < 30000);
    return rem;
  }

  function checkFlag(rem) {
    const d = lastData;
    if (!d || d.status !== "active" || !rem || endingGame) return;
    if (rem[d.turn] > 0) return;
    endingGame = true;
    /* флаг упал у того, чья сторона ходит; p1 = белые */
    const winner = d.turn === "w" ? d.p2 : d.p1;
    Cloud._db.collection("games").doc(currentId).get().then(s => {
      const cur = s.data();
      if (cur && cur.status === "active") {
        s.ref.update({ status: "finished", winner, flagFall: true, updatedAt: Date.now() })
          .catch(e => console.warn("flag", e));
      }
    }).catch(e => console.warn("flag", e));
  }

  /* ================= чат ================= */
  const readKey = id => "mc.chatRead." + id;
  const getRead = id => { try { return +localStorage.getItem(readKey(id)) || 0; } catch (e) { return 0; } };
  const setRead = (id, ts) => { try { localStorage.setItem(readKey(id), String(ts)); } catch (e) {} };
  const sheetOpen = () => sheet.classList.contains("open");

  function paintBadge() {
    const bd = $("duel-chat-badge");
    bd.hidden = chatUnread <= 0;
    bd.textContent = chatUnread > 9 ? "9+" : String(chatUnread);
  }

  function openChat() {
    if (!currentId) return;
    sheet.classList.add("open"); sheet.setAttribute("aria-hidden", "false");
    chatUnread = 0; paintBadge();
    if (chatLastTs) setRead(currentId, chatLastTs);
    const log = $("duel-chat-log"); log.scrollTop = log.scrollHeight;
    /* на телефоне клавиатуру не вызываем сами — поле ввода нужно нажать вручную */
    if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches)) setTimeout(() => $("duel-chat-input").focus(), 260);
  }
  function closeChat() {
    sheet.classList.remove("open"); sheet.setAttribute("aria-hidden", "true");
    $("duel-chat-input").blur();
  }
  $("duel-chat-btn").addEventListener("click", openChat);
  $("duel-sheet-x").addEventListener("click", closeChat);
  sheet.addEventListener("click", e => { if (e.target === sheet) closeChat(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetOpen()) closeChat(); });

  function bindChat(id) {
    if (unsubChat) { unsubChat(); unsubChat = null; }
    const log = $("duel-chat-log");
    log.innerHTML = "";
    chatUnread = 0; chatLastTs = 0; chatReady = false; paintBadge();
    const readTs = getRead(id);
    unsubChat = Cloud._db.collection("games").doc(id).collection("messages")
      .orderBy("ts").limitToLast(50)
      .onSnapshot(snap => {
        log.innerHTML = "";
        let unread = 0, last = 0, fresh = false;
        if (snap.empty) log.innerHTML = `<p class="du-chat-empty">${t("du.chatEmpty")}</p>`;
        snap.forEach(doc => {
          const m = doc.data();
          const div = document.createElement("div");
          const mine = m.from === me();
          div.className = "du-msg " + (mine ? "me" : "them");
          const txt = (m.text || "").replace(/</g, "&lt;");
          div.innerHTML = `${mine ? "" : `<small>${(m.nick || "?").replace(/</g, "&lt;")}</small>`}<span class="du-txt">${txt}</span><time>${hhmm(m.ts)}</time>`;
          log.appendChild(div);
          if (m.ts > last) last = m.ts;
          if (!mine && m.ts > readTs) unread++;
        });
        /* новое сообщение от соперника уже после первой загрузки */
        if (chatReady && last > chatLastTs) {
          const lastMsg = snap.docs[snap.docs.length - 1].data();
          fresh = lastMsg.from !== me();
        }
        chatLastTs = last; chatReady = true;
        log.scrollTop = log.scrollHeight;
        if (sheetOpen()) { chatUnread = 0; if (last) setRead(id, last); }
        else {
          chatUnread = unread;
          if (fresh) { const b = $("duel-chat-btn"); b.classList.remove("ping"); void b.offsetWidth; b.classList.add("ping"); }
        }
        paintBadge();
      }, e => console.warn("chat", e));
  }

  function sendChat(text) {
    const inp = $("duel-chat-input");
    const v = (typeof text === "string" ? text : inp.value).trim();
    if (!v || !currentId || !Cloud.user) return;
    if (typeof text !== "string") inp.value = "";
    Cloud._db.collection("games").doc(currentId).collection("messages").add({
      from: me(), nick: UI.state.nick || "?", text: v.slice(0, 200), ts: Date.now()
    }).catch(e => console.warn("chat send", e));
  }
  $("duel-chat-send").addEventListener("click", () => sendChat());
  /* быстрые фразы */
  (function () {
    const box = $("duel-quick");
    ["du.q1", "du.q2", "du.q3", "du.q4"].forEach(k => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "dg-q"; b.textContent = t(k);
      b.addEventListener("click", () => sendChat(t(k)));
      box.appendChild(b);
    });
  })();
  $("duel-chat-input").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

  /* ================= съеденные фигуры ================= */
  /* Считаем по FEN: чего не хватает до стартового набора — то и съедено.
     Превращённая пешка: лишние Q/R/B/N вычитаем из «потерянных» пешек. */
  const START = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const CAP_ORDER = ["q", "r", "b", "n", "p"];

  function countPieces(fen) {
    const c = { w: {}, b: {} };
    for (const ch of String(fen).split(" ")[0]) {
      if (!/[pnbrqk]/i.test(ch)) continue;
      const col = ch === ch.toUpperCase() ? "w" : "b", ty = ch.toLowerCase();
      c[col][ty] = (c[col][ty] || 0) + 1;
    }
    return c;
  }
  function lostPieces(cnt) {
    const out = {}; let promoted = 0;
    for (const ty of ["q", "r", "b", "n"]) {
      promoted += Math.max(0, (cnt[ty] || 0) - START[ty]);
      out[ty] = Math.max(0, START[ty] - (cnt[ty] || 0));
    }
    out.p = Math.max(0, 8 - (cnt.p || 0) - promoted);
    return out;
  }
  const matValue = lost => CAP_ORDER.reduce((n, ty) => n + (lost[ty] || 0) * VALUE[ty], 0);

  function capHtml(lost, color, prev, adv) {
    let html = "";
    CAP_ORDER.forEach(ty => {
      const n = lost[ty] || 0; if (!n) return;
      let g = "";
      for (let i = 0; i < n; i++) {
        const svg = window.pieceSvg ? window.pieceSvg(color, ty) : "";
        const pop = prev && i >= (prev[ty] || 0) ? " pop" : "";
        g += `<span class="du-cap-p c-${color}${pop}">${svg || PIECE_GLYPH[color][ty]}</span>`;
      }
      html += `<span class="du-cap-g">${g}</span>`;
    });
    if (adv > 0) html += `<span class="du-cap-adv">+${adv}</span>`;
    return html;
  }

  function renderCaptured(fen) {
    const cnt = countPieces(fen);
    const lostW = lostPieces(cnt.w), lostB = lostPieces(cnt.b);      // съеденные белые / чёрные
    const oppColor = myColor === "w" ? "b" : "w";
    const byMe = myColor === "w" ? lostB : lostW;                     // фигуры соперника, которые съел я
    const byOpp = myColor === "w" ? lostW : lostB;                    // мои фигуры, которые съел соперник
    const diff = matValue(byMe) - matValue(byOpp);
    $("duel-cap-my").innerHTML = capHtml(byMe, oppColor, capPrev && capPrev.my, diff > 0 ? diff : 0);
    $("duel-cap-opp").innerHTML = capHtml(byOpp, myColor, capPrev && capPrev.opp, diff < 0 ? -diff : 0);
    $("duel-cap-my").title = t("du.capByMe");
    $("duel-cap-opp").title = t("du.capByOpp", { name: lastData ? oppName(lastData) : "" });
    capPrev = { my: byMe, opp: byOpp };
  }

  /* ================= результат партии ================= */
  function endReason(d, ch) {
    if (d.flagFall) return "time";
    if (d.winner === "draw") {
      if (ch.in_stalemate && ch.in_stalemate()) return "stalemate";
      if (ch.insufficient_material && ch.insufficient_material()) return "material";
      return (parseInt(String(d.fen).split(" ")[4], 10) || 0) >= 100 ? "fifty" : "repeat";
    }
    return ch.in_checkmate() ? "mate" : "resign";
  }
  const resultType = d => d.winner === "draw" ? "draw" : d.winner === me() ? "win" : "loss";

  /* ================= анализ партии ================= */
  const hasMoves = d => !!d && Array.isArray(d.moves) && d.moves.length > 0;
  function openAnalysis(d) {
    if (!hasMoves(d)) { UI._toast(t("du.noMoves")); return; }
    if (!window.MCAnalysis || !MCAnalysis.openDuel) return;
    let mate = false;
    try { mate = new Chess(d.fen).in_checkmate(); } catch (e) {}
    const data = {
      moves: d.moves.slice(),
      pc: d.p1 === me() ? "w" : "b",
      result: resultType(d),
      resigned: resultType(d) === "loss" && !d.flagFall && !mate,   /* подпись «Сдача» — только если сдался я */
      oppName: oppName(d)
    };
    const gid = d.id || currentId;                                 /* Фишер: разбор идёт от своей стартовой позиции */
    if (isFi(gid, d)) data.startFen = Fischer.fenForGame(gid);
    MCAnalysis.openDuel(data);
  }

  function showResult(d, ch) {
    const opp = oppName(d), oppUid = d.p1 === me() ? d.p2 : d.p1;
    if (window.FX && FX.duel) {
      FX.duel({
        type: resultType(d), reason: t("du.r." + endReason(d, ch)),
        myNick: UI.state.nick || "—", oppNick: opp, myColor,
        onRematch: async () => {
          if (rematchSent) return false;
          rematchSent = true;
          const ok = await invite(opp, oppUid, d.tc || 0, d.stake || 0, isFi(currentId, d));
          if (!ok) rematchSent = false;
          return ok;
        },
        onAnalyze: hasMoves(d) ? () => openAnalysis(d) : null,
        onBack: leaveGame
      });
    }
  }

  function scheduleResult(d) {
    if (resultShownFor === currentId) return;
    resultShownFor = currentId;
    clearTimeout(resultTimer);
    /* небольшая пауза — чтобы успеть увидеть последний ход на доске */
    resultTimer = setTimeout(() => { if (chess && lastData && lastData.status === "finished") showResult(lastData, chess); }, 750);
  }

  /* ================= экран партии ================= */
  function openGame(id) {
    if (unsub) { unsub(); unsub = null; }
    if (unsubChat) { unsubChat(); unsubChat = null; }
    if (tickIv) { clearInterval(tickIv); tickIv = null; }
    currentId = id; board = null; chess = null; lastFen = null; CLK.key = null;
    lastData = null; endingGame = false;
    capPrev = null; rematchSent = false; resultShownFor = null; clearTimeout(resultTimer);
    closeChat();
    document.querySelectorAll("#duel-quick .dg-q").forEach((b, i) => { b.textContent = t("du.q" + (i + 1)); });
    $("duel-cap-my").innerHTML = ""; $("duel-cap-opp").innerHTML = "";
    $("duel-rematch").hidden = true; $("duel-analyze").hidden = true;
    if (window.FX && FX.duelClose) FX.duelClose();
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-duel-game"));
    markFriendsNav();
    $("duel-board").innerHTML = "";
    $("duel-chat-log").innerHTML = "";
    $("duel-chat-input").value = "";
    setSt(t("du.waiting"));

    bindChat(id);
    tickIv = setInterval(() => { const rem = paintClocks(); checkFlag(rem); }, 500);

    unsub = Cloud._db.collection("games").doc(id).onSnapshot(snap => {
      const d = snap.data();
      if (!d) { leaveGame(); return; }
      const prev = lastData;
      lastData = d;
      myColor = d.p1 === me() ? "w" : "b";
      $("duel-tier").textContent = t("nav.duels");
      $("duel-name").textContent = `${d.p1Nick} vs ${d.p2Nick}`;
      $("duel-chips").innerHTML = (isFi(id, d) ? `<span class="dg-chip fi">♞ 960</span>` : "") + `<span class="dg-chip">⏱ ${tcLabel(d.tc || 0)}</span>` +
        ((d.stake || 0) > 0 ? `<span class="dg-chip gold">${t("du.pot", { n: coinTxt(d.stake * 2) })}</span>` : "");
      const oppSide = myColor === "w" ? "b" : "w", myNick = UI.state.nick || "—";
      $("duel-opp-name").textContent = oppName(d);
      $("duel-my-name").textContent = myNick;
      $("duel-opp-ava").textContent = initial(oppName(d));
      $("duel-my-ava").textContent = initial(myNick);
      $("duel-opp-sub").textContent = t(oppSide === "w" ? "side.white" : "side.black");
      $("duel-my-sub").textContent = t(myColor === "w" ? "side.white" : "side.black");
      $("duel-opp-ava").dataset.side = oppSide; $("duel-my-ava").dataset.side = myColor;
      $("duel-chat-name").textContent = oppName(d);
      $("duel-chat-ava").textContent = initial(oppName(d));
      $("duel-bar-my").classList.toggle("active", d.status === "active" && d.turn === myColor);
      $("duel-bar-opp").classList.toggle("active", d.status === "active" && d.turn === oppSide);
      $("duel-resign").style.display = d.status === "active" ? "" : "none";
      paintClocks();

      if (d.status === "invited") {
        setSt(t("du.waiting"));
        return;
      }
      if (!chess || lastFen !== d.fen) {
        chess = new Chess(d.fen);
        lastFen = d.fen;
        if (!board) {
          board = new BoardView($("duel-board"), {
            playerColor: myColor, orientation: myColor,
            onMove: (from, to) => playerMove(from, to)
          });
        }
        board.setOrientation(myColor);
        board.attach(chess, d.lastMove || null);
      }
      renderCaptured(d.fen);
      if (d.status === "finished") {
        board.setLocked(true);
        const res = d.winner === "draw" ? t("du.draw") : d.winner === me() ? t("du.youWin") : t("du.youLose");
        setSt(`${res} · ${t("du.r." + endReason(d, chess))}`);
        $("duel-rematch").hidden = false;
        $("duel-analyze").hidden = !hasMoves(d);
        /* анимация — только когда партия закончилась на наших глазах, не при повторном заходе */
        if ((d.stake || 0) > 0) settleAll(false);               /* банк приходит сразу после партии */
        if (prev && prev.status !== "finished") scheduleResult(d);
        else if (resultShownFor !== currentId) resultShownFor = currentId;
        return;
      }
      $("duel-rematch").hidden = true; $("duel-analyze").hidden = true;
      const myTurn = d.turn === myColor;
      $("duel-status").classList.toggle("mine", myTurn);
      board.setLocked(!myTurn);
      if (chess.in_check && chess.in_check()) {
        setSt(myTurn ? t("du.youInCheck") : t("du.theyInCheck"));
      } else {
        setSt(myTurn ? t("du.yourMove") : t("du.theirMove"));
      }
    }, e => { console.warn("duel snap", e); setSt(t("du.err")); });
  }

  function playerMove(from, to) {
    if (!chess) return;
    const piece = chess.get(from);
    const needsPromotion = piece && piece.type === "p" && (to[1] === "8" || to[1] === "1");
    const apply = (promotion) => {
      const mv = chess.move({ from, to, promotion });
      if (!mv) return;
      const update = { fen: chess.fen(), turn: chess.turn(), lastMove: { from, to }, updatedAt: Date.now() };
      /* журнал ходов для анализа: пишем, только если он полный (партия начата с нуля или журнал уже ведётся) */
      if (lastData) {
        const startFen = (new Chess()).fen();
        if (Array.isArray(lastData.moves)) update.moves = lastData.moves.concat(from + to + (mv.promotion || ""));
        else if (lastData.fen === startFen) update.moves = [from + to + (mv.promotion || "")];
      }
      if (chess.game_over()) {
        update.status = "finished";
        update.winner = chess.in_checkmate() ? me() : "draw";
      }
      /* локально списываем время сходившей стороны, чтобы часы не прыгали */
      if (lastData && lastData.times) {
        const elapsed = turnElapsed(lastData);
        const times = { w: lastData.times.w, b: lastData.times.b };
        times[chess.turn() === "w" ? "b" : "w"] -= elapsed;
        update.times = times;
      }
      board.setLocked(true);
      Cloud._db.collection("games").doc(currentId).update(update).catch(e => console.warn("duel move", e));
    };
    if (needsPromotion && window.choosePromotion) {
      board.setLocked(true);
      window.choosePromotion(piece.color, p => { board.setLocked(false); apply(p); });
    } else apply("q");
  }

  function stopGame() {
    if (unsub) { unsub(); unsub = null; }
    if (unsubChat) { unsubChat(); unsubChat = null; }
    if (tickIv) { clearInterval(tickIv); tickIv = null; }
    clearTimeout(resultTimer); closeChat();
    currentId = null; lastData = null;
  }
  function leaveGame() { stopGame(); UI.showView("duels"); }

  $("duel-exit").addEventListener("click", leaveGame);
  $("duel-analyze").addEventListener("click", () => openAnalysis(lastData));
  $("duel-rematch").addEventListener("click", async () => {
    if (!lastData || rematchSent) return;
    const d = lastData, oppUid = d.p1 === me() ? d.p2 : d.p1;
    rematchSent = true;
    const ok = await invite(oppName(d), oppUid, d.tc || 0, d.stake || 0, isFi(currentId, d));
    if (ok) leaveGame(); else rematchSent = false;
  });
  $("duel-resign").addEventListener("click", () => {
    if (!currentId || !Cloud.user) return;
    const stk = lastData && +lastData.stake || 0;
    if (!confirm(stk > 0 ? t("du.resignStake", { n: fmtN(stk) }) : t("confirm.resign"))) return;
    Cloud._db.collection("games").doc(currentId).get().then(s => {
      const d = s.data(); if (!d) return;
      const winner = d.p1 === me() ? d.p2 : d.p1;
      s.ref.update({ status: "finished", winner, updatedAt: Date.now() }).catch(e => console.warn("resign", e));
    }).catch(e => console.warn("resign", e));
  });

  const _sv = UI.showView;
  UI.showView = function (n) {
    _sv.call(this, n);
    if (n === "duels") { markFriendsNav(); stopGame(); renderList(); }
    else if (n !== "duel-game" && currentId) stopGame();
  };

  window.addEventListener("mc:notify", () => {
    if ($("view-duels").classList.contains("active")) renderList();
  });

  /* доступ из профиля игрока (js/friends.js): кнопка «Позвать на партию» */
  window.Duels = { invite, invitePrompt, open: openGame, accept, settle: settleAll };

  /* стили ставок — в единой палитре сайта */
  const css = document.createElement("style");
  css.textContent = `
  .du-stake-box{margin-top:12px}
  .du-stake-t{margin:0 0 8px}
  .du-stake-row{flex-wrap:wrap}
  .du-stake-row .du-tc-chip{display:inline-flex;align-items:center;padding:8px 13px}
  .du-stake-row .du-tc-chip .mcoin{margin:0 0 0 6px;vertical-align:0}
  .du-stake-row .du-tc-chip.on{color:var(--gold,#e3bf7c);background:rgba(227,191,124,.12);border-color:rgba(227,191,124,.5)}
  .du-stake-row .du-tc-chip.off:not(.on){opacity:.42}
  .du-stake-custom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font:600 12.5px var(--font-ui);color:var(--ink-dim)}
  .du-stake-custom input{width:130px;background:var(--panel);border:1px solid var(--line-2);color:var(--ink);border-radius:12px;padding:9px 12px;font:700 13px var(--font-ui);outline:none}
  .du-stake-custom input:focus{border-color:rgba(142, 85, 230,.65)}
  .du-stake-sum{margin:10px 2px 0;font:500 12px/1.5 var(--font-ui);color:var(--ink-dim)}
  .du-stake-sum .mcoin{margin:0 0 0 4px}
  .du-stake-bal{display:block;margin-top:2px;color:var(--ink-faint)}
  .du-stake-bal.bad{color:var(--danger,#ee8195)}
  .du-stake-tag{color:var(--gold,#e3bf7c);font-weight:700}
  .du-stake-tag .mcoin,.du-stake-res .mcoin{margin:0 0 0 3px;width:12px;height:12px;vertical-align:-2px}
  .du-stake-res.win{color:var(--ok,#72d6a3);font-weight:700}.du-stake-res.loss{color:var(--danger,#ee8195);font-weight:700}
  .inv-stake{max-height:42dvh;overflow:auto}`;
  document.head.appendChild(css);
})();