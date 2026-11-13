/* maper.chess — расширенный профиль и настройки.
   Добавляет: кнопку-аватар в шапку, три вкладки в окне настроек
   (Профиль / Настройки / Аккаунт), управление звуком и аккаунтом Firebase.
   Не трогает существующую логику: оборачивает UI._openSettings, а не заменяет её. */
(function () {
  "use strict";

  /* ---------- i18n ---------- */
  const L = {
    en: {
      "set.tab.profile": "Profile", "set.tab.settings": "Settings", "set.tab.account": "Account",
      "set.sound": "Sound", "set.sound.master": "Sound effects", "set.sound.masterSub": "All sounds in the app",
      "set.sound.volume": "Volume", "set.sound.ui": "Interface sounds", "set.sound.uiSub": "Buttons, tabs, windows",
      "set.sound.game": "Game events", "set.sound.gameSub": "Victory, defeat, draw",
      "pf.title": "Player profile", "pf.nickPlaceholder": "Nickname", "pf.save": "Save",
      "pf.saved": "Nickname saved", "pf.stats": "Statistics",
      "pf.games": "Games", "pf.wins": "Wins", "pf.losses": "Losses",
      "pf.draws": "Draws", "pf.winrate": "Win rate", "pf.bestStreak": "Best streak",
      "pf.note": "Your profile is visible to friends and on the leaderboard.",
      "acc.title": "Account", "acc.anon": "Guest session",
      "acc.anonNote": "Progress is saved on this device only. Sign in with Google to sync it across devices and keep it safe.",
      "acc.google": "Sign in with Google",
      "acc.linked": "Signed in", "acc.verified": "Verified", "acc.notVerified": "Not verified",
      "acc.verify": "Send verification email",
      "acc.verifySent": "Verification email sent",
      "acc.switch": "Switch account",
      "acc.error": "Something went wrong, try again",
      "acc.offline": "Cloud sync is unavailable (Firebase is not configured)"
    },
    ru: {
      "set.tab.profile": "Профиль", "set.tab.settings": "Настройки", "set.tab.account": "Аккаунт",
      "set.sound": "Звук", "set.sound.master": "Звуковые эффекты", "set.sound.masterSub": "Все звуки в приложении",
      "set.sound.volume": "Громкость", "set.sound.ui": "Звуки интерфейса", "set.sound.uiSub": "Кнопки, вкладки, окна",
      "set.sound.game": "События игры", "set.sound.gameSub": "Победа, поражение, ничья",
      "pf.title": "Профиль игрока", "pf.nickPlaceholder": "Никнейм", "pf.save": "Сохранить",
      "pf.saved": "Никнейм сохранён", "pf.stats": "Статистика",
      "pf.games": "Партий", "pf.wins": "Побед", "pf.losses": "Поражений",
      "pf.draws": "Ничьих", "pf.winrate": "Винрейт", "pf.bestStreak": "Лучший стрик",
      "pf.note": "Твой профиль видят друзья и другие игроки в рейтинге.",
      "acc.title": "Аккаунт", "acc.anon": "Гостевая сессия",
      "acc.anonNote": "Прогресс хранится только на этом устройстве. Войди через Google, чтобы синхронизировать его между устройствами и не потерять.",
      "acc.google": "Войти через Google",
      "acc.linked": "Вход выполнен", "acc.verified": "Подтверждён", "acc.notVerified": "Не подтверждён",
      "acc.verify": "Отправить письмо для подтверждения",
      "acc.verifySent": "Письмо отправлено",
      "acc.switch": "Сменить аккаунт",
      "acc.error": "Что-то пошло не так, попробуй ещё раз",
      "acc.offline": "Облачная синхронизация недоступна (Firebase не настроен)"
    }
  };
  if (typeof I18N !== "undefined") { Object.assign(I18N.en, L.en); Object.assign(I18N.ru, L.ru); }

  function t(k) { try { return window.t ? window.t(k) : k; } catch (e) { return k; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function toast(msg) { try { if (typeof UI !== "undefined" && UI._toast) UI._toast(msg); } catch (e) {} }
  function $(sel, root) { return (root || document).querySelector(sel); }

  let activeTab = "profile";
  let uiBuilt = false;

  /* ---------- аватар в шапке ---------- */
  function avatarLetter() {
    const nick = (typeof UI !== "undefined" && UI.state && UI.state.nick) || "";
    if (nick) return nick.trim().charAt(0).toUpperCase();
    try {
      if (typeof Cloud !== "undefined" && Cloud.user && Cloud.user.email) return Cloud.user.email.charAt(0).toUpperCase();
    } catch (e) {}
    return "♞";
  }
  /* в шапке одна иконка профиля (#btn-settings, её рисует profile.js) — вторая кнопка убрана */
  function refreshAvatar() {
    const old = $("#btn-profile");          /* на случай старого кэша */
    if (old) old.remove();
  }

  /* ---------- разметка вкладок ---------- */
  function buildSettingsUI() {
    if (uiBuilt) return;
    const card = $("#settings-modal .modal-card");
    if (!card) return;
    uiBuilt = true;

    const h3 = card.querySelector("h3");
    const langLabel = card.querySelector(".settings-label");
    const langTabs = card.querySelector(".lang-tabs");
    const actions = card.querySelector(".modal-actions");

    /* панель звука */
    const soundPanel =
      '<div class="set-sect">' +
        '<span class="set-sect-title" data-i18n="set.sound">Sound</span>' +
        '<div class="set-row"><div class="set-row-txt"><span class="set-row-name" data-i18n="set.sound.master">Sound effects</span>' +
          '<span class="set-row-sub" data-i18n="set.sound.masterSub">All sounds in the app</span></div>' +
          '<label class="sw"><input type="checkbox" id="sw-master"><span class="sw-track"><span class="sw-dot"></span></span></label></div>' +
        '<div class="set-row vol-row"><div class="vol-head"><span class="set-row-name" data-i18n="set.sound.volume">Volume</span>' +
          '<span class="vol-val" id="vol-val">70%</span></div>' +
          '<input type="range" class="vol" id="vol-range" min="0" max="100" step="1"></div>' +
        '<div class="set-row"><div class="set-row-txt"><span class="set-row-name" data-i18n="set.sound.ui">Interface sounds</span>' +
          '<span class="set-row-sub" data-i18n="set.sound.uiSub">Buttons, tabs, windows</span></div>' +
          '<label class="sw"><input type="checkbox" id="sw-ui"><span class="sw-track"><span class="sw-dot"></span></span></label></div>' +
        '<div class="set-row"><div class="set-row-txt"><span class="set-row-name" data-i18n="set.sound.game">Game events</span>' +
          '<span class="set-row-sub" data-i18n="set.sound.gameSub">Victory, defeat, draw</span></div>' +
          '<label class="sw"><input type="checkbox" id="sw-game"><span class="sw-track"><span class="sw-dot"></span></span></label></div>' +
      "</div>";

    /* панель профиля: фото + ник живут в блоке .prof-box (profile.js), ниже — уровень и статистика */
    const profilePanel =
      '<div class="pf-sub" id="pf-sub">—</div>' +
      '<span class="set-sect-title" data-i18n="pf.stats">Statistics</span>' +
      '<div class="pf-stats" id="pf-stats"></div>' +
      '<p class="pf-note" data-i18n="pf.note">Your profile is visible to friends and on the leaderboard.</p>';

    /* панель аккаунта */
    const accountPanel = '<div class="acc-card" id="acc-card"></div>';

    /* собираем вкладки */
    const tabs = document.createElement("div");
    tabs.className = "set-tabs";
    tabs.innerHTML =
      '<button type="button" class="set-tab" data-tab="profile" data-i18n="set.tab.profile">Profile</button>' +
      '<button type="button" class="set-tab" data-tab="settings" data-i18n="set.tab.settings">Settings</button>' +
      '<button type="button" class="set-tab" data-tab="account" data-i18n="set.tab.account">Account</button>';

    const pProfile = document.createElement("section");
    pProfile.className = "set-panel";
    pProfile.dataset.panel = "profile";
    pProfile.innerHTML = profilePanel;
    const profBox = card.querySelector(".prof-box");       /* переносим фото+ник в профиль, из остальных вкладок он исчезает */
    if (profBox) pProfile.insertBefore(profBox, pProfile.firstChild);

    const pSettings = document.createElement("section");
    pSettings.className = "set-panel";
    pSettings.dataset.panel = "settings";
    if (langLabel) pSettings.appendChild(langLabel);
    if (langTabs) pSettings.appendChild(langTabs);
    pSettings.insertAdjacentHTML("afterbegin", soundPanel);

    const pAccount = document.createElement("section");
    pAccount.className = "set-panel";
    pAccount.dataset.panel = "account";
    pAccount.innerHTML = accountPanel;

    if (actions) pSettings.appendChild(actions);

    h3.after(tabs, pProfile, pSettings, pAccount);

    tabs.querySelectorAll(".set-tab").forEach(b => {
      b.addEventListener("click", () => { activeTab = b.dataset.tab; paintTabs(); });
    });

    /* звук: привязка контролов */
    const swM = $("#sw-master"), swU = $("#sw-ui"), swG = $("#sw-game"), vol = $("#vol-range");
    function pullSound() {
      const c = (typeof Sfx !== "undefined") ? Sfx.config : { on: true, vol: .7, ui: true, game: true };
      swM.checked = !!c.on; swU.checked = !!c.ui; swG.checked = !!c.game;
      vol.value = Math.round(c.vol * 100);
      paintVol();
    }
    function paintVol() {
      $("#vol-val").textContent = vol.value + "%";
      vol.style.setProperty("--fill", vol.value + "%");
    }
    function pushSound() {
      if (typeof Sfx === "undefined") return;
      Sfx.config.on = swM.checked;
      Sfx.config.ui = swU.checked;
      Sfx.config.game = swG.checked;
      Sfx.config.vol = vol.value / 100;
      Sfx.save();
      paintVol();
    }
    [swM, swU, swG].forEach(el => el.addEventListener("change", () => { pushSound(); if (el.checked && typeof Sfx !== "undefined") Sfx.click(); }));
    vol.addEventListener("input", pushSound);
    vol.addEventListener("change", () => { if (typeof Sfx !== "undefined") Sfx.click(); });

    /* аккаунт: кнопки */
    $("#acc-card").addEventListener("click", async e => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.dataset.act === "google" && typeof Cloud !== "undefined") {
          b.disabled = true;
          await Cloud.signIn();            /* привязка Google к гостю + перенос прогресса */
        } else if (b.dataset.act === "verify" && typeof Cloud !== "undefined" && Cloud.user) {
          b.disabled = true;
          await Cloud.user.sendEmailVerification();
          toast(t("acc.verifySent"));
        } else if (b.dataset.act === "switch" && typeof Cloud !== "undefined") {
          b.disabled = true;
          await Cloud.signOut();           /* cloud.js сам перелогинит анонимно */
        }
      } catch (err) {
        toast(t("acc.error"));
      }
      b.disabled = false;
      paintTabs();
    });

    pullSound();
  }

  /* ---------- отрисовка вкладок ---------- */
  function paintTabs() {
    const card = $("#settings-modal .modal-card");
    if (!card) return;
    card.querySelectorAll(".set-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === activeTab));
    card.querySelectorAll(".set-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === activeTab));
    const h3 = card.querySelector("h3");
    const keys = { profile: "pf.title", settings: "settings.title", account: "acc.title" };
    if (h3 && keys[activeTab]) {
      h3.setAttribute("data-i18n", keys[activeTab]);
      h3.textContent = t(keys[activeTab]);
    }
    if (activeTab === "profile") renderProfile();
    if (activeTab === "account") renderAccount();
    if (activeTab === "settings") {
      /* синхронизируем звуковые контролы с конфигом */
      const c = (typeof Sfx !== "undefined") ? Sfx.config : null;
      const swM = $("#sw-master"), swU = $("#sw-ui"), swG = $("#sw-game"), vol = $("#vol-range");
      if (c && swM) {
        swM.checked = !!c.on; swU.checked = !!c.ui; swG.checked = !!c.game;
        vol.value = Math.round(c.vol * 100);
        $("#vol-val").textContent = vol.value + "%";
        vol.style.setProperty("--fill", vol.value + "%");
      }
    }
  }

  function renderProfile() {
    const st = (typeof UI !== "undefined" && UI.state) ? UI.state : null;
    if (!st) { $("#pf-sub").textContent = "—"; $("#pf-stats").innerHTML = ""; return; }
    const rank = (typeof playerLevelFromXp === "function") ? playerLevelFromXp(st.xp) : { level: 1 };
    $("#pf-sub").textContent = `Lv. ${rank.level} · ${st.xp || 0} XP · 🔥 ${(st.streak && st.streak.count) || 0}`;
    const s = st.stats || {};
    const played = s.gamesPlayed || 0;
    const wr = played ? Math.round(((s.wins || 0) / played) * 100) : 0;
    const cells = [
      [played, "pf.games"], [s.wins || 0, "pf.wins"], [s.losses || 0, "pf.losses"],
      [s.draws || 0, "pf.draws"], [wr + "%", "pf.winrate"], [(st.streak && st.streak.best) || 0, "pf.bestStreak"]
    ];
    $("#pf-stats").innerHTML = cells.map(c => `<div class="pf-stat"><b>${c[0]}</b><span>${t(c[1])}</span></div>`).join("");
  }

  function renderAccount() {
    const box = $("#acc-card");
    if (!box) return;
    const mailIco = '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4V6z"/><path d="M4 7l8 6 8-6"/></svg>';
    let html = "";
    try {
      if (typeof Cloud === "undefined" || !Cloud.enabled) {
        html = `<p class="acc-note">${esc(t("acc.offline"))}</p>`;
      } else if (!Cloud.user || Cloud.user.isAnonymous) {
        html =
          `<div class="acc-mail">${mailIco}<span>${esc(t("acc.anon"))}</span></div>` +
          `<p class="acc-note">${esc(t("acc.anonNote"))}</p>` +
          `<div class="acc-btns"><button class="btn btn-primary" type="button" data-act="google">${esc(t("acc.google"))}</button></div>`;
      } else {
        const u = Cloud.user;
        const verified = !!u.emailVerified;
        html =
          `<div class="acc-mail">${mailIco}<span>${esc(u.email || "—")}</span>` +
          `<span class="${verified ? "acc-verified" : "acc-pending"}">${esc(t(verified ? "acc.verified" : "acc.notVerified"))}</span></div>` +
          `<div class="acc-btns">` +
          (!verified && u.email ? `<button class="btn btn-ghost" type="button" data-act="verify">${esc(t("acc.verify"))}</button>` : "") +
          `<button class="btn btn-ghost" type="button" data-act="switch">${esc(t("acc.switch"))}</button>` +
          `</div>`;
      }
    } catch (e) {
      html = `<p class="acc-note">${esc(t("acc.error"))}</p>`;
    }
    box.innerHTML = html;
    /* auth подгружается асинхронно — подстрахуемся перерисовкой */
    if (typeof Cloud !== "undefined" && Cloud.enabled && (!Cloud.user || Cloud.user.isAnonymous)) {
      setTimeout(() => { if (activeTab === "account" && document.getElementById("settings-modal").classList.contains("open")) renderAccount(); }, 2500);
    }
  }

  /* ---------- оборачиваем открытие настроек ---------- */
  function wrap() {
    if (typeof UI === "undefined" || !UI._openSettings) return;
    const orig = UI._openSettings.bind(UI);
    UI._openSettings = function () {
      buildSettingsUI();
      refreshAvatar();
      orig();
      paintTabs();
    };
    /* единственная иконка в шапке (аватар) открывает окно на вкладке «Профиль»; остальное — вкладки внутри */
    const gear = $("#btn-settings");
    if (gear) gear.addEventListener("click", () => { activeTab = "profile"; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { wrap(); });
  } else {
    wrap();
  }
})();