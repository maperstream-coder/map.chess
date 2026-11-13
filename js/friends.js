/* maper.chess — друзья + профили игроков */
(function () {
  const add = (en, ru) => {
    Object.assign(I18N.en, en);
    Object.assign(I18N.ru, ru);
  };

  add({
    "nav.friends": "Friends",
    "fr.title": "Friends",
    "fr.sub": "Add friends by nickname and follow their progress",
    "fr.ph": "Friend's nickname",
    "fr.add": "Add",
    "fr.empty": "No friends yet",
    "fr.incoming": "Friend requests",
    "fr.accept": "Accept",
    "fr.decline": "Decline",
    "fr.none": "No incoming requests",
    "fr.self": "That's you",
    "fr.unknown": "Player not found",
    "fr.exists": "Already friends or request sent",
    "fr.sent": "Request sent",
    "fr.off": "Sign in to add friends",
    "fr.err": "Something went wrong",
    "fr.remove": "Remove",
    "fr.my": "My profile",
    "fr.tap": "Tap to open profile",
    "prof.card": "player profile",
    "prof.loading": "Scanning player…",
    "prof.notFound": "Player not found",
    "prof.puzzles": "Puzzles",
    "prof.levels": "Levels",
    "prof.lvl": "Rank",
    "prof.xp": "XP",
    "prof.coins": "Coins",
    "prof.streak": "Streak",
    "prof.wins": "Wins",
    "prof.games": "Games",
    "prof.winrate": "Win rate",
    "prof.add": "Add friend",
    "prof.sent": "Request sent",
    "prof.removeF": "Remove from friends",
    "prof.you": "This is you",
    "prof.close": "Close",
    "du.new": "Invite to duel",
    "fr.tabFriends": "Friends", "fr.tabDuels": "Duels",
    "fr.play": "Play", "fr.playTip": "Invite to a game"
  }, {
    "nav.friends": "Друзья",
    "fr.title": "Друзья",
    "fr.sub": "Добавляйте друзей по никнейму и следите за прогрессом",
    "fr.ph": "Никнейм друга",
    "fr.add": "Добавить",
    "fr.empty": "Пока нет друзей",
    "fr.incoming": "Заявки в друзья",
    "fr.accept": "Принять",
    "fr.decline": "Отклонить",
    "fr.none": "Входящих заявок нет",
    "fr.self": "Это вы",
    "fr.unknown": "Игрок не найден",
    "fr.exists": "Уже друзья или заявка отправлена",
    "fr.sent": "Заявка отправлена",
    "fr.off": "Войдите, чтобы добавлять друзей",
    "fr.err": "Что-то пошло не так",
    "fr.remove": "Убрать",
    "fr.my": "Мой профиль",
    "fr.tap": "Нажмите, чтобы открыть профиль",
    "prof.card": "профиль игрока",
    "prof.loading": "Сканируем игрока…",
    "prof.notFound": "Игрок не найден",
    "prof.puzzles": "Задачи",
    "prof.levels": "Уровни",
    "prof.lvl": "Уровень",
    "prof.xp": "Опыт",
    "prof.coins": "Монеты",
    "prof.streak": "Серия",
    "prof.wins": "Победы",
    "prof.games": "Партий",
    "prof.winrate": "Винрейт",
    "prof.add": "Добавить в друзья",
    "prof.sent": "Заявка отправлена",
    "prof.removeF": "Убрать из друзей",
    "prof.you": "Это вы",
    "prof.close": "Закрыть",
    "du.new": "Позвать на партию",
    "fr.tabFriends": "Друзья", "fr.tabDuels": "Поединки",
    "fr.play": "Играть", "fr.playTip": "Позвать на партию"
  });

  const $ = id => document.getElementById(id);

  const reqId = (a, b) => `${a}_${b}`;

  const me = () =>
    typeof Cloud !== "undefined" &&
    Cloud.enabled &&
    Cloud.user
      ? Cloud.user.uid
      : null;

  function errMsg(e, where = "") {
    console.error("Firestore error:", where, e);

    const code = e && e.code ? e.code : "";
    const message = e && e.message ? e.message : "";

    if (code === "permission-denied") {
      return (
        t("fr.err") +
        " — Firestore: нет прав" +
        (where ? ` (${where})` : "") +
        ". " +
        message
      );
    }

    return (
      t("fr.err") +
      (code ? ` (${code})` : "") +
      (message ? `: ${message}` : "")
    );
  }

  /* ================= ДРУЗЬЯ ================= */

  const sec = document.createElement("section");

  sec.id = "view-friends";
  sec.className = "view";

  sec.innerHTML = `
    <div class="seg-tabs">
      <button type="button" class="seg-tab active" data-go="friends" data-i18n="fr.tabFriends"></button>
      <button type="button" class="seg-tab" data-go="duels" data-i18n="fr.tabDuels"></button>
    </div>
    <h2 class="view-title" data-i18n="fr.title"></h2>
    <p class="lb-sub" data-i18n="fr.sub"></p>

    <button
      type="button"
      class="btn btn-ghost fr-my"
      id="fr-my"
      data-i18n="fr.my">
    </button>

    <div class="fr-add">
      <input
        id="fr-input"
        class="nick-input"
        maxlength="16"
        autocomplete="off">

      <button
        type="button"
        class="btn btn-primary"
        id="fr-go"
        data-i18n="fr.add">
      </button>
    </div>

    <p class="fr-sec" data-i18n="fr.incoming"></p>
    <div id="fr-reqs"></div>

    <p class="fr-sec" data-i18n="nav.friends"></p>
    <div id="fr-list"></div>
  `;

  document.querySelector(".views").appendChild(sec);
  sec.querySelectorAll(".seg-tab").forEach(b => b.addEventListener("click", () => UI.showView(b.dataset.go)));

  const nb = document.createElement("button");

  nb.className = "nav-btn";
  nb.dataset.view = "friends";

  nb.innerHTML = `
    <span>♟</span>
    <span data-i18n="nav.friends"></span>
  `;

  document
    .querySelector('.nav-btn[data-view="leaderboard"]')
    .after(nb);

  /* ---- карточки друзей / заявок ---- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initialOf = n => esc(((n || "?").trim()[0] || "?").toUpperCase());

  const svgIc = (path, color) =>
    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${path}</svg>`;
  const ICONS = {
    solved: svgIc('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>', "#72d6a3"),
    levels: svgIc('<path d="M5 21V3.5M5 4.5h12.5l-2.5 4 2.5 4H5"/>', "#e3bf7c"),
    streak: svgIc('<path d="M12 2.5c.8 3.8 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2.2-4.6.4 2 1.3 2.8 2 3 .1-3.4.2-6 1.3-8.9z"/>', "#f3a560")
  };
  const chip = (svg, v, title) => `<span class="fr-st" title="${esc(title)}">${svg}<b>${esc(v)}</b></span>`;

  async function fetchStat(uid) {
    try {
      const doc = await Cloud._db.collection("leaderboard").doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (e) { return null; }
  }

  function buildCard(uid, nick, st, kind) {
    const row = document.createElement("div");
    row.className = "fr-row fr-card" + (kind === "req" ? " fr-req" : "");
    const lv = st && window.Ranks ? Ranks.level(st.xp) : 1;
    const col = st && window.Ranks ? Ranks.list[Ranks.idx(lv)].c : "#6f7280";
    const ava = st && st.avatar && /^data:image\//.test(st.avatar)
      ? `<img src="${st.avatar}" alt="">`
      : `<span>${initialOf(nick)}</span>`;
    row.innerHTML = `
      <span class="fr-ava" style="--rk:${col}">${ava}</span>
      <span class="fr-info">
        <b class="fr-nick"><span class="fr-nick-t"></span></b>
        <span class="fr-rk"></span>
        <span class="fr-stats"></span>
      </span>
      <span class="fr-side"></span>`;
    row.querySelector(".fr-nick-t").textContent = nick || "—";
    if (st && window.Ranks) {
      row.querySelector(".fr-nick").insertAdjacentHTML("afterbegin", Ranks.badge(lv, 22));
      row.querySelector(".fr-rk").innerHTML = `${Ranks.line(lv)} · ${t("prof.lvl")} ${lv}`;
      row.querySelector(".fr-stats").innerHTML =
        chip(ICONS.solved, st.puzzles || 0, t("prof.puzzles")) +
        chip(ICONS.levels, `${st.levels || 0}/${ALL_LEVELS.length}`, t("prof.levels")) +
        chip(ICONS.streak, streakShown(st), t("prof.streak"));
    } else {
      row.querySelector(".fr-rk").textContent = kind === "req" ? "" : t("fr.tap");
      row.querySelector(".fr-stats").remove();
    }
    if (kind !== "req") {
      const side = row.querySelector(".fr-side");
      side.innerHTML = `<span class="fr-go">›</span>`;
      /* друзья → сразу позвать на партию (поединок) */
      if (kind === "friend" && typeof Duels !== "undefined" && Duels.invitePrompt) {
        const pb = document.createElement("button");
        pb.type = "button"; pb.className = "fr-play";
        pb.title = t("fr.playTip");
        pb.innerHTML = `<span class="fr-play-ic">⚔</span><span class="fr-play-tx">${esc(t("fr.play"))}</span>`;
        pb.addEventListener("click", e => { e.stopPropagation(); Duels.invitePrompt(nick, uid); });
        side.prepend(pb);
      }
      row.addEventListener("click", () => {
        if (typeof PlayerProfile !== "undefined" && PlayerProfile.open) PlayerProfile.open(uid);
      });
    }
    return row;
  }

  let renderSeq = 0;

  async function render() {
    UI.renderTopbar();
    const seq = ++renderSeq;

    $("fr-input").placeholder = t("fr.ph");

    const reqs = $("fr-reqs");
    const list = $("fr-list");
    const my = me();

    $("fr-my").style.display = my ? "" : "none";

    if (!my) {
      reqs.innerHTML = "";
      list.innerHTML = `<p class="lb-note">${t("fr.off")}</p>`;
      return;
    }

    list.innerHTML = `<p class="lb-note">${t("lb.loading")}</p>`;

    try {
      const db = Cloud._db;

      /* входящие заявки (Rules проверяют resource.data.to == request.auth.uid) */
      const [rq, fr] = await Promise.all([
        db.collection("friendReqs").where("to", "==", my).get(),
        db.collection("users").doc(my).collection("friends").get()
      ]);

      const reqItems = rq.docs.map(doc => ({ id: doc.id, d: doc.data() }));
      const frItems = fr.docs.map(doc => ({ uid: doc.id, d: doc.data() || {} }));

      const [reqStats, frStats] = await Promise.all([
        Promise.all(reqItems.map(x => fetchStat(x.d.from))),
        Promise.all(frItems.map(x => fetchStat(x.uid)))
      ]);

      if (seq !== renderSeq) return; /* пришёл более свежий render */

      reqs.innerHTML = "";
      list.innerHTML = "";

      if (!reqItems.length) {
        reqs.innerHTML = `<p class="lb-note">${t("fr.none")}</p>`;
      }

      reqItems.forEach((x, i) => {
        const nick = Nick.safe((reqStats[i] && reqStats[i].nick) || x.d.fromNick || "?");
        const row = buildCard(x.d.from, nick, reqStats[i], "req");
        const side = row.querySelector(".fr-side");
        side.className = "fr-side fr-acts";
        side.append(
          mkBtn("btn btn-primary", t("fr.accept"), b => {
            b.disabled = true;
            accept(x.id, x.d.from, x.d.fromNick || nick, my);
          }),
          mkBtn("btn btn-ghost", t("fr.decline"), async b => {
            b.disabled = true;
            try {
              await db.collection("friendReqs").doc(x.id).delete();
              await render();
            } catch (e) {
              b.disabled = false;
              console.warn("friendDecline", e);
              UI._toast(errMsg(e, "decline"));
            }
          })
        );
        /* клик по карточке заявки открывает профиль, но не по кнопкам */
        row.addEventListener("click", e => {
          if (e.target.closest("button")) return;
          if (typeof PlayerProfile !== "undefined" && PlayerProfile.open) PlayerProfile.open(x.d.from);
        });
        row.classList.add("fr-click");
        reqs.appendChild(row);
      });

      if (!frItems.length) {
        list.innerHTML = `<p class="lb-note">${t("fr.empty")}</p>`;
        return;
      }

      /* сначала те, у кого больше опыта */
      const order = frItems.map((x, i) => ({ x, st: frStats[i] }))
        .sort((a, b) => ((b.st && b.st.xp) || 0) - ((a.st && a.st.xp) || 0));

      order.forEach(({ x, st }) => {
        const nick = Nick.safe((st && st.nick) || x.d.nick || "?");
        list.appendChild(buildCard(x.uid, nick, st, "friend"));
      });

    } catch (e) {
      if (seq !== renderSeq) return;
      console.warn("friends", e);
      list.innerHTML = `<p class="lb-note">${esc(errMsg(e, "load"))}</p>`;
    }
  }

  /* ================= ОТПРАВКА ЗАЯВКИ ================= */

  async function send() {
    const v = $("fr-input").value.trim();

    if (!v) return;

    const my = me();

    if (!my) {
      UI._toast(t("fr.off"));
      return;
    }

    try {
      const key = Nick.normKey(v);

      let found = (
        await Cloud._db
          .collection("leaderboard")
          .where("nickLower", "==", key)
          .limit(1)
          .get()
      ).docs[0];

      if (!found) {
        const snap = await Cloud._db
          .collection("leaderboard")
          .limit(500)
          .get();

        found = snap.docs.find(
          d =>
            Nick.normKey(
              d.data().nick || ""
            ) === key
        );
      }

      if (!found) {
        UI._toast(t("fr.unknown"));
        return;
      }

      const uid = found.id;

      if (uid === my) {
        UI._toast(t("fr.self"));
        return;
      }

      const mine = await Cloud._db
        .collection("users")
        .doc(my)
        .collection("friends")
        .doc(uid)
        .get();

      if (mine.exists) {
        UI._toast(t("fr.exists"));
        return;
      }

      const incoming = await Cloud._db
        .collection("friendReqs")
        .doc(reqId(uid, my))
        .get();

      if (incoming.exists) {
        UI._toast(t("fr.exists"));
        return;
      }

      const outgoing = await Cloud._db
        .collection("friendReqs")
        .doc(reqId(my, uid))
        .get();

      if (outgoing.exists) {
        UI._toast(t("fr.exists"));
        return;
      }

      await Cloud._db
        .collection("friendReqs")
        .doc(reqId(my, uid))
        .set({
          from: my,
          fromNick: UI.state.nick || "?",
          to: uid,
          ts: Date.now()
        });

      $("fr-input").value = "";

      UI._toast(t("fr.sent"));

      await render();

    } catch (e) {
      console.warn("friendReq", e);
      UI._toast(errMsg(e, "send"));
    }
  }

  /* ================= ПРИНЯТИЕ ЗАЯВКИ ================= */

  async function accept(
    requestId,
    fromUid,
    fromNick,
    my
  ) {
    if (
      !requestId ||
      !fromUid ||
      !my ||
      fromUid === my
    ) {
      return;
    }

    const db = Cloud._db;

    const reqRef = db
      .collection("friendReqs")
      .doc(requestId);

    try {
      /*
       * Сначала читаем ИМЕННО ту заявку,
       * по которой пользователь нажал «Принять».
       */
      const reqSnap = await reqRef.get();

      if (!reqSnap.exists) {
        UI._toast(t("fr.exists"));
        await render();
        return;
      }

      const req = reqSnap.data() || {};

      /*
       * Проверяем реальные данные заявки.
       */
      if (
        req.from !== fromUid ||
        req.to !== my
      ) {
        console.warn(
          "friendAccept: invalid request",
          req
        );

        UI._toast(t("fr.err"));
        await render();
        return;
      }

      /*
       * Нельзя просто удалить заявку отдельно.
       *
       * Все три операции должны быть одним batch:
       *
       * 1. users/my/friends/fromUid
       * 2. users/fromUid/friends/my
       * 3. удаление friendReqs/requestId
       *
       * Rules видят существующую заявку
       * во время проверки batch.
       */

      const now = Date.now();

      const batch = db.batch();

      /*
       * Запись у того, кто принял заявку.
       */
      batch.set(
        db
          .collection("users")
          .doc(my)
          .collection("friends")
          .doc(fromUid),
        {
          nick: req.fromNick || fromNick || "?",
          since: now,
          requestId: requestId
        },
        {
          merge: true
        }
      );

      /*
       * Зеркальная запись у отправителя.
       */
      batch.set(
        db
          .collection("users")
          .doc(fromUid)
          .collection("friends")
          .doc(my),
        {
          nick: UI.state.nick || "?",
          since: now,
          requestId: requestId
        },
        {
          merge: true
        }
      );

      /*
       * Удаляем именно ту заявку,
       * которую пользователь принял.
       */
      batch.delete(reqRef);

      await batch.commit();

      await render();

    } catch (e) {
      console.warn("friendAccept", e);
      UI._toast(errMsg(e, "accept"));
    }
  }

  /* ================= УДАЛЕНИЕ ДРУГА ================= */

  async function remove(my, uid) {
    try {
      const batch = Cloud._db.batch();

      batch.delete(
        Cloud._db
          .collection("users")
          .doc(my)
          .collection("friends")
          .doc(uid)
      );

      batch.delete(
        Cloud._db
          .collection("users")
          .doc(uid)
          .collection("friends")
          .doc(my)
      );

      await batch.commit();

      await render();

    } catch (e) {
      console.warn("friendRemove", e);
      UI._toast(errMsg(e, "remove"));
    }
  }

  /* ================= ПОДКЛЮЧЕНИЕ ВЬЮ ================= */

  const _sv = UI.showView;

  UI.showView = function (n) {
    _sv.call(this, n);

    if (n === "friends") {
      render();
    }
  };

  $("fr-go").addEventListener(
    "click",
    send
  );

  $("fr-input").addEventListener(
    "keydown",
    e => {
      if (e.key === "Enter") {
        send();
      }
    }
  );

  $("fr-my").addEventListener(
    "click",
    () => {
      const my = me();

      if (
        my &&
        typeof PlayerProfile !== "undefined" &&
        PlayerProfile.open
      ) {
        PlayerProfile.open(my);
      }
    }
  );

  /* ================= ПРОФИЛЬ ================= */

  const pp = document.createElement("div");

  pp.className = "pp-overlay";
  pp.id = "pp-overlay";

  pp.innerHTML = `
    <div class="pp-card">
      <div class="pp-frame">
        <i></i><i></i><i></i><i></i>
      </div>

      <button
        type="button"
        class="pp-close"
        id="pp-close">
        ✕
      </button>

      <div
        class="pp-body"
        id="pp-body">
      </div>

      <div
        class="pp-actions"
        id="pp-actions">
      </div>
    </div>
  `;

  document.body.appendChild(pp);

  pp.addEventListener(
    "click",
    e => {
      if (e.target === pp) {
        pp.classList.remove("open");
      }
    }
  );

  document.addEventListener(
    "keydown",
    e => {
      if (e.key === "Escape") {
        pp.classList.remove("open");
      }
    }
  );

  pp
    .querySelector("#pp-close")
    .addEventListener(
      "click",
      () => pp.classList.remove("open")
    );

  function statCell(v, l) {
    return `
      <div class="pp-stat">
        <b>${v}</b>
        <small>${l}</small>
      </div>
    `;
  }

  function selfStats() {
    const s = UI.state;
    const g = s.stats.gamesPlayed;

    return {
      nick: s.nick,
      avatar: s.avatar || null,
      puzzles: s.completedPuzzles.length,
      levels: s.completed.length,
      xp: s.xp,
      coins: s.coins,
      streak: streakShown({ streak: s.streak.count, streakDay: s.streak.lastDay, streakFreezes: s.streak.freezes }),
      wins: s.stats.wins,
      games: g,
      winRate: g
        ? Math.round(
            s.stats.wins / g * 100
          )
        : 0
    };
  }

  function renderBody(d, found) {
    const body = $("pp-body");

    if (!found) {
      body.innerHTML = `
        <div class="pp-nick">—</div>
        <div class="pp-rank">
          ${t("prof.notFound")}
        </div>
      `;
      return;
    }

    const rankNo =
      typeof playerLevelFromXp === "function"
        ? playerLevelFromXp(d.xp || 0).level
        : 1;

    const ava =
      d.avatar &&
      /^data:image\//.test(d.avatar)
        ? `<img src="${d.avatar}" alt="">`
        : Nick.safe(d.nick || "?")[0].toUpperCase();

    body.innerHTML = `
      <div class="pp-ava-wrap">
        <div class="pp-ava">${ava}</div>${window.Ranks ? Ranks.badge(rankNo, 40, "rk-corner") : ""}
      </div>

      <div class="pp-nick">
        ${(d.nick ? Nick.safe(d.nick) : "—").replace(/</g, "&lt;")}
      </div>

      <div class="pp-rank">
        ${t("prof.card")} ·
        ${t("prof.lvl")} ${rankNo}${window.Ranks ? " · " + Ranks.line(rankNo) : ""}
      </div>

      <div class="pp-stats">
        ${statCell(
          d.puzzles || 0,
          t("prof.puzzles")
        )}

        ${statCell(
          `${d.levels || 0}/${ALL_LEVELS.length}`,
          t("prof.levels")
        )}

        ${statCell(
          d.xp || 0,
          t("prof.xp")
        )}

        ${statCell(
          d.coins || 0,
          t("prof.coins")
        )}

        ${statCell(
          `🔥 ${streakShown(d)}`,
          t("prof.streak")
        )}

        ${statCell(
          `${d.wins || 0}/${d.games || 0}`,
          t("prof.wins") +
          " / " +
          t("prof.games")
        )}

        ${statCell(
          (d.winRate || 0) + "%",
          t("prof.winrate")
        )}

        ${statCell(
          rankNo,
          t("prof.lvl")
        )}
      </div>
    `;
  }

  function mkBtn(
    cls,
    label,
    fn,
    disabled
  ) {
    const b = document.createElement("button");

    b.type = "button";
    b.className = cls;
    b.textContent = label;

    if (disabled) {
      b.disabled = true;
    }

    if (fn) {
      b.addEventListener(
        "click",
        e => {
          e.stopPropagation();
          fn(b);
        }
      );
    }

    return b;
  }

  const closeBtn = () =>
    mkBtn(
      "btn btn-ghost",
      t("prof.close"),
      () => pp.classList.remove("open")
    );

  const noteEl = txt => {
    const s = document.createElement("span");
    s.className = "pp-note";
    s.textContent = txt;
    return s;
  };

  let openSeq = 0;

  /* профиль, который сейчас открыт: нужен для кнопки «Посетить деревню» */
  let ppCur = null;

  function villageBtn() {
    if (!ppCur || !window.Village) return null;

    const snap = ppCur;
    const b = document.createElement("button");

    b.type = "button";
    b.className = "btn btn-primary vl-visit-btn";
    b.textContent = "🏰 " + t(snap.own ? "vl.visit.own" : "vl.visit.btn");

    b.addEventListener("click", () => {
      if (snap.own) {
        pp.classList.remove("open");
        Village.open();
        return;
      }

      if (Village.visit(snap.uid, snap.d) !== false) {
        pp.classList.remove("open");
      }
    });

    return b;
  }

  function setActions(seq, ...nodes) {
    if (seq !== openSeq) return;

    const vb = villageBtn();

    $("pp-actions").replaceChildren(
      ...(vb ? [vb, ...nodes] : nodes)
    );
  }

  async function renderActions(
    seq,
    uid,
    my,
    d
  ) {
    if (!my) {
      return setActions(
        seq,
        noteEl(t("fr.off")),
        closeBtn()
      );
    }

    if (uid === my) {
      return setActions(
        seq,
        noteEl(t("prof.you")),
        closeBtn()
      );
    }

    setActions(
      seq,
      mkBtn(
        "btn btn-primary",
        "…",
        null,
        true
      ),
      closeBtn()
    );

    try {
      const db = Cloud._db;

      /*
       * Профиль проверяет только стандартные ID.
       * Новые заявки именно такие.
       */
      const [
        friend,
        inc,
        out
      ] = await Promise.all([
        db
          .collection("users")
          .doc(my)
          .collection("friends")
          .doc(uid)
          .get(),

        db
          .collection("friendReqs")
          .doc(reqId(uid, my))
          .get(),

        db
          .collection("friendReqs")
          .doc(reqId(my, uid))
          .get()
      ]);

      if (friend.exists) {
        const nodes = [];

        if (
          typeof Duels !== "undefined" &&
          Duels.invite
        ) {
          nodes.push(
            mkBtn(
              "btn btn-primary",
              t("du.new"),
              () => {
                pp.classList.remove("open");

                (Duels.invitePrompt || Duels.invite)(
                  (d && d.nick) || "?",
                  uid,
                  0
                );
              }
            )
          );
        }

        nodes.push(
          mkBtn(
            "btn btn-ghost ctrl-danger",
            t("prof.removeF"),
            () =>
              remove(my, uid)
                .then(() => open(uid))
          )
        );

        nodes.push(closeBtn());

        return setActions(
          seq,
          ...nodes
        );
      }

      if (inc.exists) {
        const from = inc.data();

        return setActions(
          seq,

          mkBtn(
            "btn btn-primary",
            t("fr.accept"),
            () =>
              accept(
                reqId(uid, my),
                uid,
                from.fromNick,
                my
              ).then(() => open(uid))
          ),

          mkBtn(
            "btn btn-ghost",
            t("fr.decline"),
            () =>
              db
                .collection("friendReqs")
                .doc(reqId(uid, my))
                .delete()
                .then(() => {
                  open(uid);
                  render();
                })
                .catch(e => {
                  console.warn(
                    "ppDecline",
                    e
                  );

                  UI._toast(
                    errMsg(e, "decline")
                  );
                })
          ),

          closeBtn()
        );
      }

      if (out.exists) {
        return setActions(
          seq,
          mkBtn(
            "btn btn-ghost",
            t("prof.sent"),
            null,
            true
          ),
          closeBtn()
        );
      }

      return setActions(
        seq,

        mkBtn(
          "btn btn-primary",
          t("prof.add"),
          async btn => {
            btn.disabled = true;

            try {
              await db
                .collection("friendReqs")
                .doc(reqId(my, uid))
                .set({
                  from: my,
                  fromNick:
                    UI.state.nick || "?",
                  to: uid,
                  ts: Date.now()
                });

              UI._toast(
                t("fr.sent")
              );

              setActions(
                seq,
                mkBtn(
                  "btn btn-ghost",
                  t("prof.sent"),
                  null,
                  true
                ),
                closeBtn()
              );

            } catch (e) {
              console.warn(
                "ppAdd",
                e
              );

              btn.disabled = false;

              UI._toast(
                errMsg(e, "send")
              );
            }
          }
        ),

        closeBtn()
      );

    } catch (e) {
      console.warn(
        "ppActions",
        e
      );

      setActions(
        seq,
        noteEl(errMsg(e, "profile")),
        closeBtn()
      );
    }
  }

  async function open(uid) {
    const seq = ++openSeq;

    ppCur = null;

    pp.classList.add("open");

    $("pp-body").innerHTML =
      `<div class="pp-loading">${t("prof.loading")}</div>`;

    $("pp-actions").replaceChildren(
      closeBtn()
    );

    const my = me();

    let d = null;
    let found = false;

    if (my && uid === my) {
      d = selfStats();
      found = true;

    } else if (
      typeof Cloud !== "undefined" &&
      Cloud.enabled
    ) {
      try {
        const doc = await Cloud._db
          .collection("leaderboard")
          .doc(uid)
          .get();

        if (doc.exists) {
          d = doc.data();
          found = true;
        }

      } catch (e) {
        console.warn(
          "ppLoad",
          e
        );
      }
    }

    if (
      seq !== openSeq ||
      !pp.classList.contains("open")
    ) {
      return;
    }

    ppCur = found ? { uid, d, own: !!(my && uid === my) } : null;

    renderBody(d, found);

    if (!found) {
      return setActions(
        seq,
        closeBtn()
      );
    }

    renderActions(
      seq,
      uid,
      my,
      d
    );
  }

  window.PlayerProfile = {
    open
  };

  /*
   * Уведомления.
   *
   * Старый код передавал параметры в неправильном порядке.
   * Здесь принимаем fromUid/fromNick и ищем реальную заявку.
   */
  window.Friends = {
    accept: async (
      fromUid,
      fromNick
    ) => {
      const my = me();

      if (!my) {
        return;
      }

      try {
        const snap = await Cloud._db
          .collection("friendReqs")
          .where("from", "==", fromUid)
          .where("to", "==", my)
          .limit(1)
          .get();

        if (snap.empty) {
          UI._toast(t("fr.err"));
          return;
        }

        const doc = snap.docs[0];
        const d = doc.data();

        return accept(
          doc.id,
          fromUid,
          d.fromNick || fromNick,
          my
        );

      } catch (e) {
        console.warn(
          "notifyFriendAccept",
          e
        );

        UI._toast(
          errMsg(e, "notify")
        );
      }
    }
  };

  window.addEventListener(
    "mc:notify",
    () => {
      const view = $("view-friends");

      if (
        view &&
        view.classList.contains("active")
      ) {
        render();
      }
    }
  );
})();