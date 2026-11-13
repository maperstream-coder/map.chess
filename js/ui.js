/* maper.chess — UI layer. Renders every screen from state and wires navigation. */

const UI = {
  state: null,
  activeMode: "games",
  activeTier: "beginner",
  activePuzzleTier: "mate2",
  gameController: null,
  currentMode: null,
  _modalRetryAction: null,
  _modalNextAction: null,
  _jumpObserver: null,
  _autoScroll: false,

  init() {
    this.state = loadState();
    setLang(this.state.lang);
    this._applyTheme();
    this._bindNav();
    this._bindShopTabs();
    this._bindLevelModeTabs();
    this._bindGameControls();
    this._bindModal();
    this._bindSettings();
    this._bindJump();
    this.translate();
    this.renderTopbar();
    const last = window.__mcLastView;      /* запомнен в index.html до загрузки модулей */
    this.showView("home");
    /* вернулись в приложение (страницу перезагрузила система) — открываем тот же раздел, где были */
    if (window.__mcWarm && last && last !== "home" && document.getElementById("view-" + last)) this.showView(last);
    this._syncStreak();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this._syncStreak(); });
    setInterval(() => this._syncStreak(true), 60000);
    document.getElementById("streak-freeze").addEventListener("click", () => {
      this.showView("shop");
      document.querySelector('.shop-tab[data-type="boost"]').click();
    });
  },

  _syncStreak(silent) {
    const r = syncStreak(this.state);
    if (r.status === "frozen" || r.status === "lost") saveState(this.state);
    if (r.status === "frozen") this._toast(t("streak.freezeUsed", { n: r.used }));
    if (r.status === "lost") this._toast(t("streak.lost", { n: r.lost }));
    this.renderTopbar();
    if (document.getElementById("view-home").classList.contains("active")) this.renderStreakCard();
    this._checkServerDay();
  },

  _checkServerDay() {
    if (typeof Cloud === "undefined" || !Cloud.enabled || !Cloud.user || this._sdPending) return;
    this._sdPending = true;
    Cloud.serverDay().then(day => {
      this._sdPending = false;
      if (!day) return;
      const st = this.state.streak, sec = st.sec || (st.sec = { lastMs: 0, serverDay: null, serverAt: 0, skewMs: 0, v: 2 });
      /* Каждая успешная проверка ОБНОВЛЯЕТ (или сбрасывает) сдвиг часов.
         Раньше серверная дата записывалась только когда часы опережали сервер и никогда не стиралась,
         из-за чего «сегодня» навсегда застревало на старом дне и стрик не шёл. */
      const c = Cloud._serverDayCache, skew = c && c.skew > 60000 ? c.skew : 0;
      const changed = (skew > 0) !== (sec.skewMs > 0) || Math.abs(skew - sec.skewMs) > 60000 || sec.serverDay !== day;
      sec.serverAt = Date.now();
      if (changed) {
        sec.skewMs = skew;
        sec.serverDay = day;
        const r = syncStreak(this.state);
        saveState(this.state);
        if (r.status === "frozen") this._toast(t("streak.freezeUsed", { n: r.used }));
        if (r.status === "lost") this._toast(t("streak.lost", { n: r.lost }));
        this.renderTopbar();
        if (document.getElementById("view-home").classList.contains("active")) this.renderStreakCard();
      }
    }).catch(() => { this._sdPending = false; });
  },

  renderStreakCard() {
    const st = this.state.streak, done = st.lastDay === dayKey();
    const card = document.getElementById("streak-card");
    card.classList.toggle("streak-on", st.count > 0);
    card.classList.toggle("streak-done", done);
    document.getElementById("streak-days").textContent = st.count;
    document.getElementById("streak-label").textContent = t("streak.days", { n: st.count });
    document.getElementById("streak-freeze").innerHTML = `${ic("snow")} ${st.freezes}`;
    const loc = getLang() === "ru" ? "ru-RU" : "en-US";
    document.getElementById("streak-week").innerHTML = streakWeek(this.state).map(d => {
      const label = keyToDate(d.key).toLocaleDateString(loc, { weekday: "short" }).slice(0, 2);
      const icon = d.status === "done" ? ic("flame") : d.status === "frozen" ? ic("snow") : "";
      return `<span class="wd ${d.status}${d.isToday ? " is-today" : ""}"><i>${label}</i><b>${icon}</b></span>`;
    }).join("");
    const left = timeLeftToday();
    document.getElementById("streak-note").textContent =
      done ? t("streak.doneToday") : st.count > 0 ? t("streak.todayLeft", { h: left.h, m: left.m }) : t("streak.start");
  },

  _streakLine(sr) {
    if (!sr || !sr.first) return "";
    return t("streak.line", { n: sr.count, coins: sr.coins }) + (sr.freeze ? " · +1 ❄" : "");
  },

  translate() {
    translatePage();
    const active = document.querySelector(".view.active");
    if (active) this.showView(active.id.replace("view-", ""));
    else this.renderTopbar();
  },

  setLanguage(lang) {
    this.state.lang = lang;
    setLang(lang);
    saveState(this.state);
    this.translate();
    this._renderSettingsModal();
  },

  _bindNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => this.showView(btn.dataset.view));
    });
    document.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => this.showView(btn.dataset.goto));
    });
  },

  showView(name) {
    if (name !== "game" && this.gameController && this.gameController.destroy) {
      this.gameController.destroy();
      this.gameController = null;
    }
    if (name === "levels" && !document.getElementById("view-levels").classList.contains("active")) this._autoScroll = true;
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    if (name === "home") this.renderHome();
    if (name === "levels") this.renderLevels();
    if (name === "achievements") this.renderAchievements();
    if (name === "shop") this.renderShop();
    try { if (name !== "game") sessionStorage.setItem("mc_view", name); } catch (e) {}
  },

  renderTopbar() {
    const rank = playerLevelFromXp(this.state.xp);
    document.getElementById("coin-count").textContent = this.state.coins;
    const st = this.state.streak;
    document.getElementById("streak-count").textContent = st.count;
    document.getElementById("streak-pill").classList.toggle("active", st.lastDay === dayKey());
    document.getElementById("player-rank").textContent = `Lv. ${rank.level}`;
    const bar = document.getElementById("xp-fill");
    if (bar) bar.style.width = `${Math.round(rank.progress * 100)}%`;
  },

  _bindSettings() {
    const btn = document.getElementById("btn-settings");
    if (btn) btn.addEventListener("click", () => this._openSettings());
    document.getElementById("settings-close").addEventListener("click", () => this._closeSettings());
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (!confirm(t("confirm.reset"))) return;
      this.state = resetProgress();
      setLang(this.state.lang);
      this._applyTheme();
      this._closeSettings();
      this.translate();
      this.renderTopbar();
      this.showView("home");
      this._toast(t("toast.progressReset"));
    });
    document.querySelectorAll(".lang-btn").forEach(b => {
      b.addEventListener("click", () => this.setLanguage(b.dataset.lang));
    });
  },

  _openSettings() {
    this._renderSettingsModal();
    document.getElementById("settings-modal").classList.add("open");
  },

  _closeSettings() {
    document.getElementById("settings-modal").classList.remove("open");
  },

  _renderSettingsModal() {
    document.querySelectorAll(".lang-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.lang === getLang());
    });
  },

  renderHome() {
    this.renderTopbar();
    this.renderStreakCard();
    const wins = this.state.stats.wins;
    const played = this.state.stats.gamesPlayed;
    const winRate = played ? Math.round((wins / played) * 100) : 0;
    /* статистика и карточка «Продолжить» с главной убраны (есть в профиле и в большой кнопке «Играть») */
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt("stat-solved", this.state.completed.length);
    setTxt("stat-winrate", `${winRate}%`);
    setTxt("stat-total", `${this.state.completed.length + this.state.completedPuzzles.length}/${ALL_LEVELS.length + ALL_PUZZLES.length}`);

    const next = nextIncompleteLevel(this.state);
    const cta = document.getElementById("continue-card");
    if (!cta) return;
    if (next) {
      cta.hidden = false;
      document.getElementById("continue-title").textContent = levelTitle(next);
      document.getElementById("continue-sub").textContent =
        `${t(TIERS[next.tier].labelKey)} ${next.index} · ${levelBotName(next)}`;
      cta.onclick = () => { this.showView("levels"); this.startLevel(next.id); };
    } else {
      cta.hidden = false;
      document.getElementById("continue-title").textContent = t("continue.allClearedTitle");
      document.getElementById("continue-sub").textContent = t("continue.allClearedSub");
      cta.onclick = () => this.showView("levels");
    }
  },

  _levelName(level) {
    return `${t(TIERS[level.tier].labelKey)} ${level.index}`;
  },

  _bindLevelModeTabs() {
    document.querySelectorAll(".mode-tab").forEach(b => {
      b.addEventListener("click", () => { this.activeMode = b.dataset.mode; this._autoScroll = true; this.renderLevels(); });
    });
  },

  renderLevels() {
    this.renderTopbar();
    document.querySelectorAll(".mode-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === this.activeMode));
    document.getElementById("tier-tabs-games").hidden = this.activeMode !== "games";
    document.getElementById("tier-tabs-tactics").hidden = this.activeMode !== "tactics";
    const banner = document.getElementById("tier-banner");
    if (banner) banner.hidden = true;

    if (this.activeMode === "games") {
      const tabs = document.querySelectorAll("#tier-tabs-games .tier-tab");
      tabs.forEach(t2 => {
        t2.classList.toggle("active", t2.dataset.tier === this.activeTier);
        t2.onclick = () => { this.activeTier = t2.dataset.tier; this._autoScroll = true; this.renderLevels(); };
      });
      this._renderGameLevels();
    } else if (this.activeMode === "tactics") {
      const tabs = document.querySelectorAll("#tier-tabs-tactics .tier-tab");
      tabs.forEach(t2 => {
        t2.classList.toggle("active", t2.dataset.tier === this.activePuzzleTier);
        t2.onclick = () => { this.activePuzzleTier = t2.dataset.tier; this._autoScroll = true; this.renderLevels(); };
      });
      this._renderPuzzleLevels();
    } else {
      this._setJump(null);
    }
  },

  /* ---------- «текущий» уровень / задача и кнопка перехода ---------- */
  _gameTarget() {
    const open = l => isLevelUnlocked(this.state, l.id) && !this.state.completed.includes(l.id);
    const inTier = LEVELS[this.activeTier].find(open);
    if (inTier) return { kind: "game", id: inTier.id, tier: inTier.tier };
    const any = ALL_LEVELS.find(open);
    return any ? { kind: "game", id: any.id, tier: any.tier } : null;
  },

  _puzzleOpen(list) {
    return list.find((p, i) => !this.state.completedPuzzles.includes(p.id) &&
      (i === 0 || this.state.completedPuzzles.includes(list[i - 1].id)));
  },

  _puzzleTarget() {
    const here = this._puzzleOpen(PUZZLES[this.activePuzzleTier]);
    if (here) return { kind: "puzzle", id: here.id, tier: here.tier };
    for (const tier of ["mate1", "mate2", "mate3", "mate4"]) {
      const p = PUZZLES[tier] && this._puzzleOpen(PUZZLES[tier]);
      if (p) return { kind: "puzzle", id: p.id, tier };
    }
    return null;
  },

  _bindJump() {
    const btn = document.getElementById("jump-current");
    if (btn) btn.addEventListener("click", () => this._jumpToCurrent());
  },

  _setJump(target) {
    const btn = document.getElementById("jump-current");
    if (!btn) return;
    if (this._jumpObserver) { this._jumpObserver.disconnect(); this._jumpObserver = null; }
    this._jumpTarget = target;
    if (!target) { btn.hidden = true; return; }
    const isGame = target.kind === "game";
    const sameTier = isGame ? target.tier === this.activeTier : target.tier === this.activePuzzleTier;
    let label = t(isGame ? "jump.level" : "jump.puzzle");
    if (!sameTier) {
      const name = isGame ? t(TIERS[target.tier].labelKey) : t(PUZZLE_TIERS[target.tier].labelKey);
      label = `${label} · ${name}`;
    }
    document.getElementById("jump-text").textContent = label;
    const card = document.querySelector(`#levels-grid [data-id="${target.id}"]`);
    const dir = document.getElementById("jump-dir");
    if (!card) { btn.hidden = false; dir.textContent = "→"; return; }
    btn.hidden = true;
    if (typeof IntersectionObserver === "undefined") { btn.hidden = false; return; }
    const root = document.querySelector(".views");
    this._jumpObserver = new IntersectionObserver(entries => {
      const e = entries[entries.length - 1];
      const visible = e.isIntersecting && e.intersectionRatio > 0.55;
      btn.hidden = visible;
      if (!visible) {
        const above = e.boundingClientRect.top < (e.rootBounds ? e.rootBounds.top : 0);
        dir.textContent = above ? "↑" : "↓";
        btn.classList.toggle("up", above);
      }
    }, { root, threshold: [0, 0.55, 1] });
    this._jumpObserver.observe(card);
  },

  _scrollToTarget(smooth) {
    const target = this._jumpTarget;
    if (!target) return;
    const card = document.querySelector(`#levels-grid [data-id="${target.id}"]`);
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    card.classList.remove("jump-pulse");
    void card.offsetWidth;
    card.classList.add("jump-pulse");
    setTimeout(() => card.classList.remove("jump-pulse"), 2000);
  },

  _jumpToCurrent() {
    const target = this._jumpTarget;
    if (!target) return;
    let switched = false;
    if (target.kind === "game" && (this.activeMode !== "games" || this.activeTier !== target.tier)) {
      this.activeMode = "games"; this.activeTier = target.tier; switched = true;
    }
    if (target.kind === "puzzle" && (this.activeMode !== "tactics" || this.activePuzzleTier !== target.tier)) {
      this.activeMode = "tactics"; this.activePuzzleTier = target.tier; switched = true;
    }
    if (switched) { this._autoScroll = false; this.renderLevels(); }
    requestAnimationFrame(() => this._scrollToTarget(true));
  },

  _afterLevelsRender() {
    if (this._autoScroll) {
      this._autoScroll = false;
      requestAnimationFrame(() => {
        const target = this._jumpTarget;
        const card = target && document.querySelector(`#levels-grid [data-id="${target.id}"]`);
        if (card) this._scrollToTarget(false);
        else { const v = document.querySelector(".views"); if (v) v.scrollTop = 0; }
      });
    }
  },

  _pieceAvatar(color, type) {
    return window.pieceSvg ? window.pieceSvg(color, type) : (PIECE_GLYPH ? PIECE_GLYPH[color][type] : "");
  },

  _renderGameLevels() {
    const grid = document.getElementById("levels-grid");
    grid.innerHTML = "";
    const list = LEVELS[this.activeTier];
    const target = this._gameTarget();
    const doneCount = list.filter(l => this.state.completed.includes(l.id)).length;

    const banner = document.getElementById("tier-banner");
    if (banner) {
      banner.hidden = false;
      banner.style.setProperty("--tier", TIERS[this.activeTier].color);
      banner.innerHTML = `
        <div class="tb-top"><b>${t(TIERS[this.activeTier].labelKey)}</b><span>${t("level.progress", { a: doneCount, b: list.length })}</span></div>
        <div class="tb-bar"><i style="width:${Math.round(doneCount / list.length * 100)}%"></i></div>`;
    }

    list.forEach(level => {
      const unlocked = isLevelUnlocked(this.state, level.id);
      const done = this.state.completed.includes(level.id);
      const current = !!target && target.id === level.id;
      const stars = this.state.levelStars[level.id] || 0;
      const card = document.createElement("button");
      card.type = "button";
      card.dataset.id = level.id;
      card.className = "level-card lv-card" + (done ? " level-done" : "") + (!unlocked ? " level-locked" : "") + (current ? " level-current" : "");
      card.disabled = !unlocked;
      const meta = done
        ? `<span class="level-stars">${[1, 2, 3].map(i => `<i class="${i <= stars ? "st-on" : "st-off"}">${ic("star", { plain: true })}</i>`).join("")}</span>`
        : unlocked ? `<span class="lc-play">${t("level.play")} →</span>` : t("level.locked");
      const goal = level.goal ? `<span class="lc-goal"><i></i>${goalText(level.goal)}</span>` : "";
      card.innerHTML = `
        <span class="lc-top">
          <span class="level-num">${String(level.index).padStart(2, "0")}</span>
          ${current ? `<span class="lc-now">${t("level.current")}</span>` : ""}
        </span>
        <span class="lc-bot">
          <span class="lc-ava">${this._pieceAvatar("b", level.botPiece)}</span>
          <span class="lc-names"><b class="level-name">${levelTitle(level)}</b><small>${levelBotName(level)} · ${levelBotStyle(level)}</small></span>
        </span>
        ${goal}
        <span class="level-meta">${meta}</span>
      `;
      card.addEventListener("click", () => unlocked && this.startLevel(level.id));
      grid.appendChild(card);
    });
    this._setJump(target);
    this._afterLevelsRender();
  },

  _renderPuzzleLevels() {
    const grid = document.getElementById("levels-grid");
    grid.innerHTML = "";
    const list = PUZZLES[this.activePuzzleTier];
    const target = this._puzzleTarget();
    const doneCount = list.filter(p => this.state.completedPuzzles.includes(p.id)).length;

    const banner = document.getElementById("tier-banner");
    if (banner) {
      banner.hidden = false;
      banner.style.setProperty("--tier", "#a99cf0");
      banner.innerHTML = `
        <div class="tb-top"><b>${t(PUZZLE_TIERS[this.activePuzzleTier].labelKey)}</b><span>${t("level.progress", { a: doneCount, b: list.length })}</span></div>
        <div class="tb-bar"><i style="width:${Math.round(doneCount / list.length * 100)}%"></i></div>`;
    }

    list.forEach((puzzle, idx) => {
      const done = this.state.completedPuzzles.includes(puzzle.id);
      const unlocked = idx === 0 || this.state.completedPuzzles.includes(list[idx - 1].id);
      const current = !!target && target.id === puzzle.id;
      const card = document.createElement("button");
      card.type = "button";
      card.dataset.id = puzzle.id;
      card.className = "level-card" + (done ? " level-done" : "") + (!unlocked ? " level-locked" : "") + (current ? " level-current" : "");
      card.disabled = !unlocked;
      const meta = done ? t("level.solved") : unlocked ? t("level.tapToSolve") : t("level.locked");
      card.innerHTML = `
        <span class="lc-top"><span class="level-num">${String(puzzle.index).padStart(2, "0")}</span>${current ? `<span class="lc-now">${t("level.current")}</span>` : ""}</span>
        <span class="level-name">${t(PUZZLE_TIERS[puzzle.tier].labelKey)}</span>
        <span class="level-meta">${meta}</span>
      `;
      card.addEventListener("click", () => unlocked && this.startPuzzle(puzzle.id));
      grid.appendChild(card);
    });
    this._setJump(target);
    this._afterLevelsRender();
  },

  startLevel(levelId) {
    const level = ALL_LEVELS.find(l => l.id === levelId);
    if (level) this._launchLevel(levelId, level.color || "w");
  },

  startPuzzle(puzzleId) { this._launchPuzzle(puzzleId, "w"); },

  _setStatus(text) {
    const el = document.getElementById("game-status-text");
    if (el) el.textContent = text;
    else document.getElementById("game-status").textContent = text;
  },

  _launchLevel(levelId, color) {
    const level = ALL_LEVELS.find(l => l.id === levelId);
    if (!level) return;
    this.currentMode = "level";
    this.state.currentLevelId = levelId;
    saveState(this.state);

    document.getElementById("game-level-name").textContent = levelTitle(level);
    document.getElementById("game-level-tier").textContent = `${t(TIERS[level.tier].labelKey)} · ${level.index}/${LEVELS[level.tier].length}`;
    this._enterGameView();
    this._setupMatchHud(level, color);

    this.gameController = new GameController({
      boardEl: document.getElementById("board"), level, playerColor: color,
      onStatus: text => this._setStatus(text),
      onHintUsed: () => {},
      onHud: info => this._renderMatchHud(level, info),
      onThinking: on => this._setThinking(on),
      onGameOver: (result) => this._handleGameOver(level, result)
    });
  },

  _launchPuzzle(puzzleId, color) {
    const puzzle = ALL_PUZZLES.find(p => p.id === puzzleId);
    if (!puzzle) return;
    this.currentMode = "puzzle";
    this.state.currentPuzzleId = puzzleId;
    saveState(this.state);

    document.getElementById("game-level-name").textContent = `#${puzzle.index}`;
    document.getElementById("game-level-tier").textContent = t(PUZZLE_TIERS[puzzle.tier].labelKey);
    this._enterGameView();

    this.gameController = new PuzzleController({
      boardEl: document.getElementById("board"), puzzle, playerColor: color,
      onStatus: text => this._setStatus(text),
      onHud: info => this._renderPuzzleHud(puzzle, info),
      onSolved: (result) => this._handlePuzzleResult(puzzle, true, result),
      onFailed: () => this._handlePuzzleResult(puzzle, false, null)
    });
  },

  _enterGameView() {
    if (this.gameController && this.gameController.destroy) this.gameController.destroy();
    this.gameController = null;
    this._setStatus("");
    const v = document.getElementById("view-game");
    v.dataset.mode = this.currentMode || "level";
    v.classList.add("active");
    document.querySelectorAll(".view").forEach(x => { if (x.id !== "view-game") x.classList.remove("active"); });
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    this._setThinking(false);
    document.getElementById("gp-goal").hidden = true;
    document.getElementById("game-badge").hidden = true;
    const views = document.querySelector(".views");
    if (views) views.scrollTop = 0;
  },

  /* ---------- панель партии: соперник, взятые фигуры, цель ---------- */
  _capHtml(types, color) {
    return types.map(tp => `<span class="gp-cp">${this._pieceAvatar(color, tp)}</span>`).join("");
  },

  _setupMatchHud(level, playerColor) {
    const oppColor = playerColor === "w" ? "b" : "w";
    const ava = document.getElementById("gp-opp-ava");
    ava.innerHTML = this._pieceAvatar(oppColor, level.botPiece);
    ava.style.setProperty("--tier", TIERS[level.tier].color);
    document.getElementById("gp-opp-name").textContent = levelBotName(level);
    document.getElementById("gp-opp-sub").textContent = `${levelBotStyle(level)} · ${t(TIERS[level.tier].labelKey)}`;
    const meAva = document.getElementById("gp-me-ava");
    meAva.innerHTML = this._pieceAvatar(playerColor, "k");
    document.getElementById("gp-me-name").textContent = this.state.nick || t("match.you");
    document.getElementById("gp-me-sub").textContent = playerColor === "w" ? t("side.white") : t("side.black");
    document.getElementById("gp-opp-cap").innerHTML = "";
    document.getElementById("gp-me-cap").innerHTML = "";
    const badge = document.getElementById("game-badge");
    const odds = level.fen && !level.moves && level.fen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    badge.hidden = !odds;
    badge.textContent = t("match.odds");
    this._renderMatchHud(level, { pc: playerColor, cap: { mine: [], opp: [], diff: 0 }, goal: goalStatus(level.goal, [], playerColor), moves: 0 });
  },

  _setThinking(on) {
    const el = document.getElementById("gp-think");
    if (el) el.hidden = !on;
    const opp = document.getElementById("gp-opp");
    if (opp) opp.classList.toggle("is-thinking", !!on);
    const dot = document.querySelector("#game-status .gs-dot");
    if (dot) dot.classList.toggle("wait", !!on);
  },

  _renderMatchHud(level, info) {
    if (!info || !info.cap) return;
    const pc = info.pc || (this.gameController ? this.gameController.playerColor : "w");
    const oppColor = pc === "w" ? "b" : "w";
    // справа от каждого игрока — фигуры, которые он взял (цвет фигур = цвет побеждённого)
    const diff = info.cap.diff;
    document.getElementById("gp-me-cap").innerHTML =
      this._capHtml(info.cap.mine, oppColor) + (diff > 0 ? `<em class="gp-adv">${t("match.ahead", { n: diff })}</em>` : "");
    document.getElementById("gp-opp-cap").innerHTML =
      this._capHtml(info.cap.opp, pc) + (diff < 0 ? `<em class="gp-adv">${t("match.ahead", { n: -diff })}</em>` : "");

    const box = document.getElementById("gp-goal");
    const g = info.goal;
    if (!g) { box.hidden = true; return; }
    box.hidden = false;
    box.className = "gp-goal" + (g.fail ? " fail" : g.achieved && g.goal.t !== "moves" ? " ok" : "");
    const pct = g.goal.t === "moves" ? Math.min(100, Math.round(g.cur / g.target * 100))
      : g.goal.t === "losePieces" ? Math.min(100, Math.round(g.cur / Math.max(1, g.target) * 100))
      : Math.min(100, Math.round(g.cur / g.target * 100));
    let prog = "";
    if (g.goal.t === "moves") prog = `${g.cur}/${g.target}`;
    else if (g.goal.t === "losePieces") prog = `${g.cur}/${g.target}`;
    else if (g.counter) prog = `${Math.min(g.cur, g.target)}/${g.target}`;
    else prog = g.fail ? "✕" : g.achieved ? "✓" : "";
    box.innerHTML = `
      <span class="gg-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/></svg></span>
      <span class="gg-body"><small>${t("goal.title")}</small><b>${goalText(g.goal)}</b>
        <i class="gg-bar"><u style="width:${pct}%"></u></i></span>
      <span class="gg-prog">${prog}</span>`;
  },

  _renderPuzzleHud(puzzle, info) {
    const box = document.getElementById("gp-goal");
    box.hidden = false;
    box.className = "gp-goal puzzle";
    const pips = Array.from({ length: info.allowed }, (_, i) => `<u class="${i < info.used ? "used" : ""}"></u>`).join("");
    box.innerHTML = `
      <span class="gg-ico"><svg viewBox="0 0 24 24"><path d="M12 3v3M10.5 4.5h3"/><path d="M8 20h8M9 20v-2.5c0-2.5-2.5-3-2.5-6.2A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 5.5 5.3c0 3.2-2.5 3.7-2.5 6.2V20"/></svg></span>
      <span class="gg-body"><small>${t("match.mateIn", { n: info.allowed })}</small><b>${t("match.puzzleGoal", { n: info.allowed })}</b>
        <span class="gg-pips">${pips}</span></span>
      <span class="gg-prog">${info.used}/${info.allowed}</span>`;
  },

  _bindGameControls() {
    document.getElementById("btn-hint").addEventListener("click", () => this.gameController?.hint());
    document.getElementById("btn-undo").addEventListener("click", () => this.gameController?.undo());
    document.getElementById("btn-resign").addEventListener("click", () => {
      const msg = this.currentMode === "puzzle" ? t("confirm.giveUp") : t("confirm.resign");
      if (confirm(msg)) this.gameController?.resign();
    });
    document.getElementById("btn-exit-game").addEventListener("click", () => this.showView("levels"));
  },

  _handleGameOver(level, { result, moves, hintsUsed, goal }) {
    const s = this.state;
    s.stats.gamesPlayed++;
    let title, sub;

    let starsWon = 0;
    if (result === "win") {
      s.stats.wins++;
      if (hintsUsed === 0) s.stats.hintlessWins++;
      if (s.stats.fastestWin === null || moves < s.stats.fastestWin) s.stats.fastestWin = moves;
      starsWon = starsForResult(hintsUsed);
      // третья звезда — только если выполнена бонус-цель
      const shielded = starsForResult(99) >= 3;
      if (goal && !goal.ok && !shielded) starsWon = Math.min(starsWon, 2);
      s.levelStars[level.id] = Math.max(s.levelStars[level.id] || 0, starsWon);
      const firstClear = !s.completed.includes(level.id);
      let coinsWon = 0, xpWon = 0;
      if (firstClear) {
        s.completed.push(level.id);
        coinsWon = level.coins;
        xpWon = level.xp;
        s.coins += coinsWon;
        s.xp += xpWon;
      }
      const stars = `${"★".repeat(starsWon)}${"☆".repeat(3 - starsWon)}`;
      title = t("modal.victoryTitle");
      sub = firstClear
        ? t("modal.winFirstClear", { stars, xp: xpWon, coins: coinsWon })
        : t("modal.winReplay", { stars });
    } else if (result === "draw") {
      s.stats.draws++;
      title = t("modal.drawTitle");
      sub = t("modal.drawSub");
    } else {
      s.stats.losses++;
      title = t("modal.checkmatedTitle");
      sub = t("modal.lossSub");
    }

    const sr = moves >= STREAK_CONFIG.minMovesForGame ? recordActivity(s) : null;
    if (sr && sr.blocked) this._toast(t("streak.blocked"));
    const streakLine = this._streakLine(sr);
    const newAchievements = checkAchievements(s);
    saveState(s);
    this.renderTopbar();

    this._modalRetryAction = () => this.startLevel(level.id);
    this._modalNextAction = () => {
      const idx = ALL_LEVELS.findIndex(l => l.id === level.id);
      const next = ALL_LEVELS[idx + 1];
      if (next && isLevelUnlocked(this.state, next.id)) this.startLevel(next.id);
      else this.showView("levels");
    };
    const idx = ALL_LEVELS.findIndex(l => l.id === level.id);
    const showNext = idx < ALL_LEVELS.length - 1 && this.state.completed.includes(level.id);
    const goalLine = goal && result === "win" ? { ok: goal.ok, text: t(goal.ok ? "goal.resultOk" : "goal.resultFail") } : null;
    this._showResultModal(title, sub, newAchievements, showNext, t("modal.next"), streakLine, goalLine);
  },

  _handlePuzzleResult(puzzle, solved, result) {
    const s = this.state;
    let title, sub;

    if (solved) {
      const firstClear = !s.completedPuzzles.includes(puzzle.id);
      let coinsWon = 0, xpWon = 0;
      if (firstClear) {
        s.completedPuzzles.push(puzzle.id);
        coinsWon = puzzle.coins;
        xpWon = puzzle.xp;
        s.coins += coinsWon;
        s.xp += xpWon;
      }
      title = t("puzzle.solvedTitle");
      sub = firstClear
        ? t("puzzle.solvedFirst", { n: puzzle.movesAllowed, xp: xpWon, coins: coinsWon })
        : t("puzzle.solvedReplay", { n: puzzle.movesAllowed });
    } else {
      title = t("puzzle.failedTitle");
      sub = t("puzzle.failedSub");
    }

    const sr = solved ? recordActivity(s) : null;
    if (sr && sr.blocked) this._toast(t("streak.blocked"));
    const streakLine = this._streakLine(sr);
    const newAchievements = checkAchievements(s);
    saveState(s);
    this.renderTopbar();

    this._modalRetryAction = () => this.startPuzzle(puzzle.id);
    this._modalNextAction = () => {
      const list = PUZZLES[puzzle.tier];
      const idx = list.findIndex(p => p.id === puzzle.id);
      const next = list[idx + 1];
      if (next) this.startPuzzle(next.id);
      else this.showView("levels");
    };
    const list = PUZZLES[puzzle.tier];
    const idx = list.findIndex(p => p.id === puzzle.id);
    const showNext = solved && idx < list.length - 1;
    this._showResultModal(title, sub, newAchievements, showNext, t("puzzle.next"), streakLine);
  },

  renderAchievements() {
    this.renderTopbar();
    const list = document.getElementById("achievements-list");
    list.innerHTML = "";
    ACHIEVEMENTS.forEach(a => {
      const unlocked = this.state.unlockedAchievements.includes(a.id);
      const row = document.createElement("div");
      row.className = "ach-row" + (unlocked ? " ach-unlocked" : "");
      row.innerHTML = `
        <span class="ach-icon">${ic(a.icon)}</span>
        <span class="ach-text">
          <span class="ach-name">${t(`ach.${a.id}.name`)}</span>
          <span class="ach-desc">${t(`ach.${a.id}.desc`)}</span>
        </span>
        <span class="ach-reward">${unlocked ? "✓" : `+${a.coins}`}</span>
      `;
      list.appendChild(row);
    });
  },

  _bindShopTabs() {
    document.querySelectorAll(".shop-tab").forEach(t2 => {
      t2.addEventListener("click", () => {
        document.querySelectorAll(".shop-tab").forEach(x => x.classList.toggle("active", x === t2));
        this.renderShop(t2.dataset.type);
      });
    });
  },

  renderShop(type) {
    this.renderTopbar();
    const activeTab = type || document.querySelector(".shop-tab.active")?.dataset.type || "board";
    const grid = document.getElementById("shop-grid");
    grid.innerHTML = "";
    if (activeTab === "boost") { this._renderBoostShop(grid); return; }
    SHOP_ITEMS.filter(i => i.type === activeTab).forEach(item => {
      const owned = this.state.owned.includes(item.id);
      const equipped = this.state.equipped[item.type] === item.id;
      const card = document.createElement("div");
      card.className = "shop-card" + (equipped ? " shop-equipped" : "");
      const swatch = item.type === "board"
        ? `<span class="swatch" style="background:linear-gradient(135deg, ${item.vars["--sq-light"]}, ${item.vars["--sq-dark"]})"></span>`
        : `<span class="swatch pc-swatch" style="--pc-white:${item.vars["--pc-white"]}; --pc-black:${item.vars["--pc-black"]}; background:linear-gradient(90deg, #5b5f82 50%, #2b2d46 50%)"><span class="sq-white-piece" data-no-ic>♞&#xFE0E;</span><span class="sq-black-piece" data-no-ic>♞&#xFE0E;</span></span>`;
      card.innerHTML = `
        ${swatch}
        <span class="shop-name">${t(item.nameKey)}</span>
        <span class="shop-price">${owned ? (equipped ? t("shop.equipped") : t("shop.owned")) : t("shop.priceCoins", { n: item.price })}</span>
      `;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-btn";
      btn.textContent = equipped ? t("shop.equipped") : owned ? t("shop.btn.equip") : t("shop.btn.buy");
      btn.disabled = equipped;
      btn.addEventListener("click", () => this._buyOrEquip(item));
      card.appendChild(btn);
      grid.appendChild(card);
    });
  },

  _renderBoostShop(grid) {
    const st = this.state.streak, cfg = STREAK_CONFIG, full = st.freezes >= cfg.maxFreezes;
    const card = document.createElement("div");
    card.className = "shop-card shop-wide";
    card.innerHTML = `
      <span class="swatch swatch-freeze">❄</span>
      <span class="shop-name">${t("shop.freeze.name")}</span>
      <span class="shop-desc">${t("shop.freeze.desc", { max: cfg.maxFreezes })}</span>
      <span class="shop-price">${t("shop.freeze.owned", { n: st.freezes, max: cfg.maxFreezes })} · ${t("shop.priceCoins", { n: cfg.freezePrice })}</span>`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "shop-btn"; btn.disabled = full;
    btn.textContent = full ? t("shop.freeze.full") : t("shop.btn.buy");
    btn.addEventListener("click", () => this._buyFreeze());
    card.appendChild(btn);
    grid.appendChild(card);
  },

  _buyFreeze() {
    const s = this.state, cfg = STREAK_CONFIG;
    if (s.streak.freezes >= cfg.maxFreezes) return;
    if (s.coins < cfg.freezePrice) { this._toast(t("shop.notEnoughCoins")); return; }
    s.coins -= cfg.freezePrice;
    s.streak.freezes++;
    saveState(s);
    this.renderShop();
    this.renderTopbar();
    this._toast(t("toast.freezeBought"));
  },

  _buyOrEquip(item) {
    const s = this.state;
    if (!s.owned.includes(item.id)) {
      if (s.coins < item.price) { this._toast(t("shop.notEnoughCoins")); return; }
      s.coins -= item.price;
      s.owned.push(item.id);
    }
    s.equipped[item.type] = item.id;
    const newAchievements = checkAchievements(s);
    saveState(s);
    this._applyTheme();
    this.renderShop();
    this.renderTopbar();
    if (newAchievements.length) this._toast(t("toast.achievementUnlocked", { name: t(`ach.${newAchievements[0].id}.name`) }));
  },

  _applyTheme() {
    /* надетого предмета больше нет в магазине (например, скин из удалённой рулетки) — возвращаем стандартный */
    const eq = this.state.equipped;
    if (!SHOP_ITEMS.some(i => i.id === eq.board)) eq.board = "board-classic";
    if (!SHOP_ITEMS.some(i => i.id === eq.pieces)) eq.pieces = "pieces-classic";
    const board = SHOP_ITEMS.find(i => i.id === this.state.equipped.board);
    const pieces = SHOP_ITEMS.find(i => i.id === this.state.equipped.pieces);
    const root = document.documentElement.style;
    [board, pieces].forEach(item => {
      if (!item) return;
      Object.entries(item.vars).forEach(([k, v]) => root.setProperty(k, v));
    });
  },

  _bindModal() {
    document.getElementById("modal-close").addEventListener("click", () => this._closeModal());
    document.getElementById("modal-retry").addEventListener("click", () => {
      this._closeModal();
      if (this._modalRetryAction) this._modalRetryAction();
    });
    document.getElementById("modal-next").addEventListener("click", () => {
      this._closeModal();
      if (this._modalNextAction) this._modalNextAction();
    });
  },

  _showResultModal(title, sub, newAchievements, showNext, nextLabel, streakLine, goalLine) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-sub").textContent = sub;
    const achBox = document.getElementById("modal-achievements");
    achBox.innerHTML = "";
    if (goalLine) {
      const el = document.createElement("div");
      el.className = "modal-ach modal-goal " + (goalLine.ok ? "ok" : "fail");
      el.textContent = (goalLine.ok ? "★ " : "☆ ") + goalLine.text;
      achBox.appendChild(el);
    }
    if (streakLine) {
      const el = document.createElement("div");
      el.className = "modal-ach modal-streak";
      el.textContent = streakLine;
      achBox.appendChild(el);
    }
    newAchievements.forEach(a => {
      const el = document.createElement("div");
      el.className = "modal-ach";
      el.innerHTML = ic(a.icon) + " "; el.appendChild(document.createTextNode(`${t(`ach.${a.id}.name`)} · +${a.coins}`));
      achBox.appendChild(el);
    });
    const nextBtn = document.getElementById("modal-next");
    nextBtn.hidden = !showNext;
    nextBtn.textContent = nextLabel;
    document.getElementById("modal-retry").textContent = t("modal.retry");
    document.getElementById("result-modal").classList.add("open");
  },

  _closeModal() {
    document.getElementById("result-modal").classList.remove("open");
  },

  _toast(msg) {
    const t2 = document.getElementById("toast");
    t2.textContent = msg;
    t2.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t2.classList.remove("show"), 2400);
  }
};