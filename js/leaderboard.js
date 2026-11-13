/* maper.chess — nickname gate + leaderboard. Load after profile.js.
   Rank = puzzles solved (then levels cleared, then XP). One nickname = one row.
   Клик по строке открывает профиль игрока (PlayerProfile из friends.js). */
(function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nav.top": "Top", "lb.title": "Leaderboard", "lb.sub": "Everyone who has joined — ranked by puzzles solved",
    "lb.mine": "Solved: {a} of {b} puzzles", "lb.loading": "Loading…", "lb.empty": "No players yet — be the first!",
    "lb.off": "Leaderboard isn't set up yet", "lb.err": "Couldn't load the leaderboard", "lb.you": "you",
    "lb.pz": "puzzles", "lb.lv": "lvl", "lb.guest": "Player", "lb.more": "Show more", "lb.count": "Players shown: {n}", "lb.place": "Your place: {n}",
    "lb.pubErr": "Your result wasn't saved to the leaderboard ({code}). Check Firestore rules for the leaderboard collection.",
    "nick.skip": "Skip for now", "nick.title": "Choose a nickname", "nick.sub": "It will be shown in the leaderboard.",
    "nick.ph": "Nickname", "nick.go": "Play", "nick.bad": "2–16 characters: letters, digits, _ . - and spaces"
  }, {
    "nav.top": "Рейтинг", "lb.title": "Рейтинг", "lb.sub": "Здесь все, кто заходил в игру. Чем больше решено задач, тем выше место",
    "lb.mine": "Решено задач: {a} из {b}", "lb.loading": "Загрузка…", "lb.empty": "Пока никого — станьте первым!",
    "lb.off": "Рейтинг пока не настроен", "lb.err": "Не удалось загрузить рейтинг", "lb.you": "вы",
    "lb.pz": "задач", "lb.lv": "ур.", "lb.guest": "Игрок", "lb.more": "Показать ещё", "lb.count": "Игроков в списке: {n}", "lb.place": "Ваше место: {n}",
    "lb.pubErr": "Ваш результат не сохранился в рейтинге ({code}). Проверьте правила Firestore для коллекции leaderboard.",
    "nick.skip": "Пока пропустить", "nick.title": "Придумайте никнейм", "nick.sub": "Он будет виден в рейтинге игроков.",
    "nick.ph": "Никнейм", "nick.go": "Играть", "nick.bad": "2–16 символов: буквы, цифры, _ . - и пробелы"
  });

  const $ = id => document.getElementById(id);
  const NICK_RE = Nick.NICK_RE;

  /* имя для тех, кто зашёл без ника: «Игрок A1B2» (код — из первых символов uid) */
  const guestName = (id, lang) => (lang === "ru" || (!lang && typeof I18N_STATE !== "undefined" && I18N_STATE.lang === "ru") ? "Игрок " : (typeof t === "function" ? t("lb.guest") + " " : "Player ")) + String(id || "????").slice(0, 4).toUpperCase();
  function stats(s) {
    const puzzles = s.completedPuzzles.length, levels = s.completed.length, g = s.stats.gamesPlayed;
    const real = !!s.nick && !Nick.validate(s.nick);          // есть нормальный ник?
    const uid = Cloud.user ? Cloud.user.uid : "";
    return {
      nick: real ? s.nick : guestName(uid, s.lang),
      nickLower: real ? Nick.normKey(s.nick) : "",           // у гостей пусто: ник занять они не могут
      guest: !real,
      avatar: s.avatar || null,
      prefix: Number.isInteger(s.prefix) ? s.prefix : null, puzzles, levels, xp: s.xp, coins: s.coins,
      wins: s.stats.wins, games: g, winRate: g ? Math.round(s.stats.wins / g * 100) : 0,
      streak: streakShown({ streak: s.streak.count, streakDay: s.streak.lastDay, streakFreezes: s.streak.freezes }),
      streakDay: s.streak.lastDay || null, streakFreezes: s.streak.freezes || 0,
      bestStreak: s.streak.best, lang: s.lang,
      score: puzzles * 1e7 + levels * 1e5 + Math.min(s.xp, 99999), updatedAt: Date.now(),
      vil: (window.Village && Village.pack) ? Village.pack(s) : null   // деревня игрока: её видят другие в профиле
    };
  }
  let pubErr = null;
  function publish() {
    /* в рейтинг попадают ВСЕ, кто зашёл: ник не обязателен (без него показываем «Игрок XXXX») */
    if (!Cloud.enabled || !Cloud.user || !UI.state) return Promise.resolve();
    return Cloud._db.collection("leaderboard").doc(Cloud.user.uid).set(stats(UI.state))
      .then(() => { pubErr = null; })
      .catch(e => { pubErr = e.code || String(e); console.warn("leaderboard publish", pubErr); });
  }
  let tq; const queue = () => { clearTimeout(tq); tq = setTimeout(publish, 3000); };
  const _save = window.saveState;
  window.saveState = function (s) { _save(s); queue(); };

  function ensureNick() {
    /* новичка не держим на экране ника: можно пропустить и начать играть; спросим снова, когда появится прогресс */
    if (UI.state && UI.state.nick && Nick.validate(UI.state.nick)) { UI.state.nick = ""; if (UI.state.flags) delete UI.state.flags.nickSkip; saveState(UI.state); try { UI._renderSettingsModal(); } catch (e) {} }
    const st0 = UI.state, hasProgress = !!st0 && (st0.completed.length || st0.completedPuzzles.length || st0.stats.gamesPlayed);
    const skipped = !!st0 && !!(st0.flags && st0.flags.nickSkip) && !hasProgress;
    if (!UI.state || UI.state.nick || skipped) { const g0 = $("nick-gate"); if (g0) g0.hidden = true; return; }
    let g = $("nick-gate");
    if (!g) {
      g = document.createElement("div"); g.id = "nick-gate"; g.className = "nick-gate";
      g.innerHTML = `<div class="nick-card"><div class="nick-icon">♞</div>
        <h3 data-i18n="nick.title"></h3><p data-i18n="nick.sub"></p>
        <input id="gate-input" class="nick-input" maxlength="16" autocomplete="off">
        <p class="nick-err" id="gate-err" hidden data-i18n="nick.bad"></p>
        <button type="button" class="btn btn-primary" id="gate-go" data-i18n="nick.go"></button>
        <button type="button" class="btn btn-ghost" id="gate-skip" data-i18n="nick.skip" style="margin-top:8px;width:100%"></button></div>`;
      document.querySelector(".phone-frame").appendChild(g);
      const submit = async () => {
        const v = $("gate-input").value.trim();
        const bad = Nick.validate(v);
        if (bad) {
          $("gate-err").textContent = t(Nick.errKey(bad));
          $("gate-err").hidden = false; return;
        }
        $("gate-go").disabled = true;
        const busy = await Nick.taken(v, Cloud.user ? Cloud.user.uid : null);
        $("gate-go").disabled = false;
        if (busy) {
          $("gate-err").textContent = t("nick.taken");
          $("gate-err").hidden = false; return;
        }
        UI.state.nick = v; saveState(UI.state); g.hidden = true;
        UI._renderSettingsModal(); publish();
      };
      $("gate-go").onclick = submit;
      $("gate-skip").onclick = () => { UI.state.flags = UI.state.flags || {}; UI.state.flags.nickSkip = 1; saveState(UI.state); g.hidden = true; };
      $("gate-input").addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
      $("gate-input").addEventListener("input", () => { $("gate-err").hidden = true; });
    }
    translatePage(g); $("gate-input").placeholder = t("nick.ph");
    g.hidden = false; setTimeout(() => $("gate-input").focus(), 50);
  }

  const sec = document.createElement("section");
  sec.id = "view-leaderboard"; sec.className = "view";
  sec.innerHTML = `<h2 class="view-title" data-i18n="lb.title"></h2><p class="lb-sub" data-i18n="lb.sub"></p>
    <div class="lb-me" id="lb-me"></div><div id="lb-list"></div>`;
  document.querySelector(".views").appendChild(sec);
  const nb = document.createElement("button");
  nb.className = "nav-btn"; nb.dataset.view = "leaderboard";
  nb.innerHTML = `<span>♙</span><span data-i18n="nav.top"></span>`;
  document.querySelector('.nav-btn[data-view="levels"]').after(nb);

  /* ключ сортировки считаем из самих полей, а не доверяем сохранённому score:
     у старых документов score мог быть посчитан по другой формуле */
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const keyOf = d => num(d.puzzles) * 1e7 + num(d.levels) * 1e5 + Math.min(num(d.xp), 99999);

  const PAGE = 50;                 // сколько строк подгружаем за раз (показать можно всех — кнопкой «Показать ещё»)
  let cursor = null, hasMore = false, seen = new Map(), loadingMore = false;

  const nameOf = (id, d) => (!d.guest && d.nick && !Nick.validate(d.nick)) ? d.nick : guestName(id, d.lang);

  function put(id, d, myUid) {
    if (!d) return;
    const real = !d.guest && d.nick && !Nick.validate(d.nick);
    /* один ник = одна строка (после переноса аккаунтов могут остаться дубли); гости не склеиваются */
    const k = real ? "n:" + Nick.normKey(d.nick) : "u:" + id;
    const cur = seen.get(k);
    if (!cur || keyOf(d) > keyOf(cur.d) || id === myUid) seen.set(k, { id, d });
  }

  function paint(list, myUid) {
    const s = UI.state;
    list.innerHTML = "";
    if (pubErr) {
      const w = document.createElement("p"); w.className = "lb-note nick-err";
      w.textContent = t("lb.pubErr", { code: pubErr }); list.appendChild(w);
    }
    const all = [...seen.values()];
    /* свою строку берём из локального прогресса — она всегда актуальна.
       Пока загружена не вся таблица, показываем её только если она входит в загруженный диапазон — иначе место было бы неверным */
    if (myUid && s) {
      const mine = stats(s);
      const lowest = all.length ? Math.min(...all.filter(v => v.id !== myUid).map(v => keyOf(v.d)), Infinity) : Infinity;
      for (const [k, v] of seen) if (v.id === myUid) seen.delete(k);
      if (!hasMore || keyOf(mine) >= lowest) put(myUid, mine, myUid);
    }
    const rows = [...seen.values()].sort((x, y) =>
      keyOf(y.d) - keyOf(x.d) || String(nameOf(x.id, x.d)).localeCompare(String(nameOf(y.id, y.d))));
    if (!rows.length) { list.innerHTML = `<p class="lb-note">${t("lb.empty")}</p>`; return; }

    const myIdx = rows.findIndex(v => v.id === myUid);
    $("lb-me").textContent = t("lb.mine", { a: s.completedPuzzles.length, b: ALL_PUZZLES.length }) +
      (myIdx >= 0 ? " · " + t("lb.place", { n: myIdx + 1 }) : "");

    rows.forEach((v, i) => {
      const d = v.d, rank = i + 1, mine = v.id === myUid, name = nameOf(v.id, d);
      const row = document.createElement("div");
      row.className = "lb-row" + (mine ? " lb-mine" : "");
      row.title = name;
      const ava = document.createElement("span"); ava.className = "lb-ava";
      if (d.avatar && /^data:image\//.test(d.avatar)) { const im = document.createElement("img"); im.src = d.avatar; ava.appendChild(im); }
      else ava.textContent = d.guest ? "♟" : name[0].toUpperCase();
      const nick = document.createElement("span"); nick.className = "lb-nick"; nick.textContent = name;
      if (window.Ranks) nick.insertAdjacentHTML("afterbegin", Ranks.badge(Ranks.level(d.xp), 22) + (window.Prefix ? Prefix.chip(d.prefix, d.xp) : ""));
      if (mine) { const y = document.createElement("i"); y.textContent = " · " + t("lb.you"); nick.appendChild(y); }
      const sc = document.createElement("span"); sc.className = "lb-score";
      const b = document.createElement("b"); b.textContent = num(d.puzzles);
      const sm = document.createElement("small");
      sm.textContent = `${t("lb.pz")} · ${t("lb.lv")} ${num(d.levels)}/${ALL_LEVELS.length}`;
      sc.append(b, sm);
      const rk = document.createElement("span"); rk.className = "lb-rank" + (rank <= 3 ? ` lb-top${rank}` : ""); rk.textContent = rank;
      row.append(rk, ava, nick, sc);
      row.addEventListener("click", () => { if (window.PlayerProfile) PlayerProfile.open(v.id); });
      list.appendChild(row);
    });

    const foot = document.createElement("p"); foot.className = "lb-note";
    foot.textContent = t("lb.count", { n: rows.length }); list.appendChild(foot);
    if (hasMore) {
      const more = document.createElement("button"); more.type = "button"; more.className = "btn btn-ghost";
      more.style.cssText = "width:100%;margin:4px 0 16px"; more.textContent = t("lb.more");
      more.onclick = async () => { more.disabled = true; await fetchPage(); paint(list, myUid); };
      list.appendChild(more);
    }
  }

  async function fetchPage() {
    if (loadingMore) return; loadingMore = true;
    try {
      let q = Cloud._db.collection("leaderboard").orderBy("score", "desc");
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.limit(PAGE).get();
      const myUid = Cloud.user ? Cloud.user.uid : null;
      snap.forEach(doc => { if (doc.id !== myUid) put(doc.id, doc.data(), myUid); });
      if (snap.docs.length) cursor = snap.docs[snap.docs.length - 1];
      hasMore = snap.docs.length === PAGE;
    } finally { loadingMore = false; }
  }

  async function render() {
    UI.renderTopbar();
    const s = UI.state, list = $("lb-list");
    $("lb-me").textContent = t("lb.mine", { a: s.completedPuzzles.length, b: ALL_PUZZLES.length });
    if (!Cloud.enabled) { list.innerHTML = `<p class="lb-note">${t("lb.off")}</p>`; return; }
    list.innerHTML = `<p class="lb-note">${t("lb.loading")}</p>`;
    try {
      await publish();
      cursor = null; hasMore = false; seen = new Map();
      await fetchPage();
      paint(list, Cloud.user ? Cloud.user.uid : null);
    } catch (e) { list.innerHTML = `<p class="lb-note">${t("lb.err")} (${e.code || "?"})</p>`; }
  }

  const _sv = UI.showView;
  UI.showView = function (n) { _sv.call(this, n); if (n === "leaderboard") render(); };
  const _init = UI.init;
  UI.init = function () { _init.call(this); ensureNick(); };
  const _emit = Cloud._emit;
  Cloud._emit = function (x) { _emit.call(this, x); setTimeout(() => { if (UI.state) { ensureNick(); queue(); } }, 0); };
})();