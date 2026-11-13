/* maper.chess — profile: nickname, avatar, Google e-mail link. Load after pieces.js. */
(function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "hero.sub": "Play levels, solve puzzles, earn coins.",
    "prof.title": "Profile", "prof.nick": "Nickname", "prof.removeAvatar": "Remove photo",
    "prof.email": "E-mail", "prof.noEmail": "Not linked", "prof.link": "Link Google", "prof.out": "Sign out",
    "prof.off": "Sign-in isn't set up yet", "prof.err": "Sign-in failed, try again", "prof.saved": "Progress synced"
  }, {
    "hero.sub": "Проходи уровни, решай задачи, копи монеты.",
    "prof.title": "Профиль", "prof.nick": "Никнейм", "prof.removeAvatar": "Убрать фото",
    "prof.email": "Почта", "prof.noEmail": "Не привязана", "prof.link": "Привязать Google", "prof.out": "Выйти",
    "prof.off": "Вход пока не настроен", "prof.err": "Не удалось войти, попробуйте снова", "prof.saved": "Прогресс синхронизирован"
  });
  add({
    "nav.profile": "Profile", "view.profile.title": "Profile",
    "pg.maxLevel": "Max level reached", "pg.level": "Level {n}", "pg.xpLeft": "{n} XP to the next level", "pg.edit": "Edit nickname & photo", "pg.settings": "Settings",
    "pg.stats": "Statistics", "pg.games": "Games", "pg.wins": "Wins", "pg.winrate": "Win rate",
    "pg.puzzles": "Puzzles solved", "pg.levels": "Levels cleared", "pg.bestStreak": "Best streak",
    "pg.prefix": "Prefix", "pg.prefixSub": "Shown next to your nickname in the leaderboard. New prefixes unlock as you level up.",
    "pg.prefixNone": "No prefix", "pg.prefixSet": "Prefix selected: {name}", "pg.prefixOff": "Prefix removed",
    "pg.preview": "How others see you", "pg.lvShort": "Lv. {n}",
    "pg.next": "Next prefix «{name}» unlocks at level {n}", "pg.all": "All prefixes unlocked", "pg.guest": "Player"
  }, {
    "nav.profile": "Профиль", "view.profile.title": "Профиль",
    "pg.maxLevel": "Достигнут максимальный уровень", "pg.level": "Уровень {n}", "pg.xpLeft": "{n} XP до следующего уровня", "pg.edit": "Изменить ник и фото", "pg.settings": "Настройки",
    "pg.stats": "Статистика", "pg.games": "Партий", "pg.wins": "Побед", "pg.winrate": "Винрейт",
    "pg.puzzles": "Задач решено", "pg.levels": "Уровней пройдено", "pg.bestStreak": "Лучшая серия",
    "pg.prefix": "Префикс", "pg.prefixSub": "Показывается рядом с ником в рейтинге. Новые префиксы открываются за уровни.",
    "pg.prefixNone": "Без префикса", "pg.prefixSet": "Префикс выбран: {name}", "pg.prefixOff": "Префикс убран",
    "pg.preview": "Так тебя видят другие", "pg.lvShort": "Ур. {n}",
    "pg.next": "Следующий префикс «{name}» откроется на {n} уровне", "pg.all": "Все префиксы открыты", "pg.guest": "Игрок"
  });

  // push every save to the cloud (no-op for guests)
  const _save = window.saveState;
  window.saveState = function (s) { s.updatedAt = Date.now(); _save(s); Cloud.queueSave(s); };

  // ---- settings UI ----
  const card = document.querySelector("#settings-modal .modal-card");
  card.style.maxHeight = "88%"; card.style.overflowY = "auto";
  const box = document.createElement("div");
  box.className = "prof-box";
  box.innerHTML = `
    <div class="prof-row">
      <button type="button" class="avatar-btn" id="avatar-btn"></button>
      <input type="file" id="avatar-file" accept="image/*" hidden>
      <div class="prof-fields">
        <input id="nick-input" class="nick-input" maxlength="16" autocomplete="off">
        <button type="button" class="avatar-clear" id="avatar-clear" data-i18n="prof.removeAvatar"></button>
      </div>
    </div>`;
  card.insertBefore(box, card.querySelector("h3").nextSibling);

  const $ = id => document.getElementById(id);
  const esc1 = c => String(c).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  function refresh() {
    const s = UI.state;
    $("avatar-btn").innerHTML = s.avatar ? `<img src="${s.avatar}" alt="">` : `<span>${(s.nick || "♞")[0].toUpperCase()}</span>`;
    $("avatar-clear").hidden = !s.avatar;
    $("nick-input").value = s.nick || "";
    $("nick-input").placeholder = t("prof.nick");
    /* единственная иконка профиля в шапке: фото игрока или первая буква ника */
    const sb = $("btn-settings");
    sb.classList.add("top-profile");
    sb.innerHTML = s.avatar
      ? `<img class="top-ava" src="${s.avatar}" alt="">`
      : `<span class="top-letter">${esc1((s.nick || "♞")[0].toUpperCase())}</span>`;
    if (pageActive()) renderPage();   /* страница «Профиль» открыта — обновляем её вместе с шапкой */
  }

  // смена ника с проверкой формата, мата и занятости (срабатывает при уходе из поля)
  $("nick-input").addEventListener("change", async e => {
    const v = e.target.value.trim();
    if (v === (UI.state.nick || "")) return;
    const bad = Nick.validate(v);
    if (bad) { UI._toast(t(Nick.errKey(bad))); e.target.value = UI.state.nick || ""; return; }
    if (await Nick.taken(v, Cloud.user ? Cloud.user.uid : null)) {
      UI._toast(t("nick.taken")); e.target.value = UI.state.nick || ""; return;
    }
    UI.state.nick = v; saveState(UI.state); refresh2();
  });
  function refresh2() { // keep avatar letter in sync without re-writing the input
    if (!UI.state.avatar) $("avatar-btn").innerHTML = `<span>${(UI.state.nick || "♞")[0].toUpperCase()}</span>`;
    refresh();
  }
  $("avatar-btn").addEventListener("click", () => $("avatar-file").click());
  $("avatar-clear").addEventListener("click", () => { delete UI.state.avatar; saveState(UI.state); refresh(); });
  $("avatar-file").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = 96;
      const m = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 96, 96);
      UI.state.avatar = c.toDataURL("image/jpeg", .82);
      URL.revokeObjectURL(url); saveState(UI.state); refresh();
    };
    img.src = url; e.target.value = "";
  });

  /* ================= ПРЕФИКСЫ (звания, полученные за уровни) =================
     state.prefix = индекс звания из Ranks.list либо null. Выбрать можно только уже открытое звание:
     проверка идёт по XP игрока и при выборе, и при показе (в рейтинге подделать префикс нельзя). */
  const rkList = () => (window.Ranks && Ranks.list) || [];
  const rkName = i => { const r = rkList()[i]; if (!r) return ""; return (UI.state && UI.state.lang === "ru") ? r.ru : r.en; };
  const lvlOf = xp => playerLevelFromXp(xp).level;
  function prefixOpen(i, xp) { const r = rkList()[i]; return !!r && lvlOf(xp) >= r.min; }
  window.Prefix = {
    open: prefixOpen,
    name: rkName,
    /* маленькая цветная плашка с названием звания; пустая строка, если префикса нет или он ещё не открыт */
    chip(i, xp) {
      if (!Number.isInteger(i) || !prefixOpen(i, xp)) return "";
      const r = rkList()[i];
      return `<span class="px-chip" style="--rk:${r.c}">${esc1(rkName(i))}</span>`;
    }
  };

  /* ================= СТРАНИЦА «ПРОФИЛЬ» (раздел «Ещё») ================= */
  function pageActive() { const v = document.getElementById("view-profile"); return !!(v && v.classList.contains("active")); }

  function renderPage() {
    const root = $("profile-root"), s = UI.state;
    if (!root || !s) return;
    const R = rkList(), lv = playerLevelFromXp(s.xp), level = lv.level;
    const ri = window.Ranks ? Ranks.idx(level) : 0;
    const nick = s.nick || t("pg.guest");
    const letter = esc1((s.nick || "♞")[0].toUpperCase());
    const ava = s.avatar ? `<img src="${s.avatar}" alt="">` : `<span>${letter}</span>`;
    const badge = window.Ranks ? Ranks.badge(level, 34, "pg-badge") : "";
    const rankLine = window.Ranks ? Ranks.line(level) : "";
    const played = s.stats.gamesPlayed, wr = played ? Math.round(s.stats.wins / played * 100) : 0;
    const cells = [
      [played, "pg.games"], [s.stats.wins, "pg.wins"], [wr + "%", "pg.winrate"],
      [s.completedPuzzles.length, "pg.puzzles"], [s.completed.length, "pg.levels"], [(s.streak && s.streak.best) || 0, "pg.bestStreak"]
    ].map(c => `<div class="pg-stat"><b>${c[0]}</b><span>${t(c[1])}</span></div>`).join("");

    const cur = Number.isInteger(s.prefix) && prefixOpen(s.prefix, s.xp) ? s.prefix : null;
    const opts = [`<button type="button" class="px-opt${cur === null ? " sel" : ""}" data-px="-1"><span class="px-none">∅</span><span class="px-nm">${t("pg.prefixNone")}</span></button>`]
      .concat(R.map((r, i) => {
        if (i === 0) return "";   /* «Novice» (ур. 1–9) — стартовый титул, не префикс */
        const open = level >= r.min;
        return `<button type="button" class="px-opt${cur === i ? " sel" : ""}${open ? "" : " locked"}" data-px="${i}" style="--rk:${r.c}"${open ? "" : " disabled"}>` +
          `${Ranks.badge(r.min, 26)}<span class="px-nm">${esc1(rkName(i))}</span>` +
          (open ? "" : `<small>${t("pg.lvShort", { n: r.min })}</small>`) + `</button>`;
      })).join("");
    const nextIdx = R.findIndex(r => r.min > level);
    const nextLine = nextIdx < 0 ? t("pg.all") : t("pg.next", { name: rkName(nextIdx), n: R[nextIdx].min });
    const preview = (cur !== null ? `<span class="px-chip" style="--rk:${R[cur].c}">${esc1(rkName(cur))}</span>` : "") + `<span class="pg-pv-nick">${esc1(nick)}</span>`;

    root.innerHTML = `
      <div class="pg-hero" style="--rk:${R[ri] ? R[ri].c : "#e2b85a"}">
        <div class="pg-ava-wrap">
          <button type="button" class="pg-ava" id="pg-ava" aria-label="${t("pg.edit")}">${ava}</button>
          ${badge}
        </div>
        <div class="pg-id">
          <div class="pg-nick">${cur !== null ? `<span class="px-chip" style="--rk:${R[cur].c}">${esc1(rkName(cur))}</span>` : ""}<span>${esc1(nick)}</span></div>
          <div class="pg-rank">${rankLine} · ${t("pg.level", { n: level })}</div>
          <div class="pg-xp"><i style="width:${Math.round(lv.progress * 100)}%"></i></div>
          <div class="pg-xp-note">${lv.max ? t("pg.maxLevel") : t("pg.xpLeft", { n: lv.xpForNext - lv.xpIntoLevel })}</div>
        </div>
        <div class="pg-actions">
          <button type="button" class="btn btn-ghost" id="pg-edit">${t("pg.edit")}</button>
          <button type="button" class="btn btn-ghost" id="pg-settings">${t("pg.settings")}</button>
        </div>
      </div>
      <h3 class="pg-h">${t("pg.stats")}</h3>
      <div class="pg-stats">${cells}</div>
      <h3 class="pg-h">${t("pg.prefix")}</h3>
      <p class="pg-sub">${t("pg.prefixSub")}</p>
      <div class="px-grid" id="px-grid">${opts}</div>
      <p class="pg-next">${esc1(nextLine)}</p>
      <div class="pg-preview"><span class="pg-pv-lab">${t("pg.preview")}</span><div class="pg-pv">${preview}</div></div>`;

    $("pg-ava").onclick = () => $("avatar-file").click();
    $("pg-edit").onclick = () => UI._openSettings();
    $("pg-settings").onclick = () => UI._openSettings();
    $("px-grid").onclick = e => {
      const b = e.target.closest(".px-opt");
      if (!b || b.disabled) return;
      const i = +b.dataset.px;
      if (i < 0) { delete UI.state.prefix; UI._toast(t("pg.prefixOff")); }
      else if (prefixOpen(i, UI.state.xp)) { UI.state.prefix = i; UI._toast(t("pg.prefixSet", { name: rkName(i) })); }
      else return;
      if (window.Sfx && Sfx.select) Sfx.select();
      saveState(UI.state);
      renderPage();
    };
  }

  const _showView = UI.showView;
  UI.showView = function (n) { const r = _showView.apply(this, arguments); if (n === "profile") renderPage(); return r; };

  // ---- hooks ----
  const _open = UI._openSettings;
  UI._openSettings = function () { _open.call(this); translatePage(card); refresh(); };
  const _lang = UI._renderSettingsModal;
  UI._renderSettingsModal = function () { _lang.call(this); refresh(); };

  function onCloud(info) {
    if (info.error) UI._toast(t("prof.err") + (info.code ? " (" + info.code + ")" : ""));
    if (info.loaded) {
      const old = UI.state, n = info.loaded;
      n.nick = n.nick || old.nick; n.avatar = n.avatar || old.avatar;
      if (!n.nick && Cloud.user && Cloud.user.displayName) {
        const dn = Cloud.user.displayName.slice(0, 16);   // имя из Google тоже проходит фильтр
        n.nick = Nick.validate(dn) ? null : dn;
      }
      UI.state = n; setLang(n.lang); saveState(n); UI._applyTheme(); UI._syncStreak(true);
      UI.translate();
      if (info.pushLocal) Cloud.flush(n);
      if (Cloud.user && !Cloud.user.isAnonymous) UI._toast(t("prof.saved"));
    }
    refresh();
  }
  const _init = UI.init;
  UI.init = function () { _init.call(this); Cloud.init(onCloud); refresh(); };
})();