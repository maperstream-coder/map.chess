/* maper.chess — extras: colour choice, play-with-friend, new piece sets.
   Load AFTER ui.js and BEFORE app.js. Does not touch the streak system. */
(function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "color.title": "Play as", "color.white": "White", "color.black": "Black", "color.random": "Random",
    "mode.friend": "Friend", "friend.title": "Play with a friend",
    "friend.sub": "Two players, one device. Take turns tapping your moves.",
    "friend.flip": "Flip the board after each move", "friend.start": "Start game",
    "friend.tier": "Two players", "friend.name": "Friend game",
    "game.whiteToMove": "White to move", "game.blackToMove": "Black to move", "game.check": "check!",
    "friend.mate": "Checkmate! {side} wins", "friend.resigned": "{side} wins by resignation",
    "friend.drawTitle": "Draw", "friend.drawSub": "The game ended in a draw.",
    "side.white": "White", "side.black": "Black",
    "game.findMate": "Your move — find mate in {n}.",
    "shop.pieces-ivory": "Carved Ivory", "shop.pieces-teal": "Frost Glass", "shop.pieces-gold": "Royal Gold",
    "shop.pieces-neon": "Neon", "shop.pieces-ember": "Ember"
  }, {
    "color.title": "Играть за", "color.white": "Белые", "color.black": "Чёрные", "color.random": "Случайно",
    "mode.friend": "С другом", "friend.title": "Игра с другом",
    "friend.sub": "Два игрока, одно устройство. Ходите по очереди.",
    "friend.flip": "Разворачивать доску после каждого хода", "friend.start": "Начать партию",
    "friend.tier": "Два игрока", "friend.name": "Партия с другом",
    "game.whiteToMove": "Ход белых", "game.blackToMove": "Ход чёрных", "game.check": "шах!",
    "friend.mate": "Мат! Победили {side}", "friend.resigned": "{side} побеждают — соперник сдался",
    "friend.drawTitle": "Ничья", "friend.drawSub": "Партия завершилась вничью.",
    "side.white": "Белые", "side.black": "Чёрные",
    "game.findMate": "Ваш ход — найдите мат в {n}.",
    "shop.pieces-ivory": "Резная кость", "shop.pieces-teal": "Ледяное стекло", "shop.pieces-gold": "Королевское золото",
    "shop.pieces-neon": "Неон", "shop.pieces-ember": "Угли"
  });


  // ---------- colour choice ----------
  function askColor(cb) {
    let m = document.getElementById("color-modal");
    if (!m) {
      m = document.createElement("div");
      m.className = "modal"; m.id = "color-modal";
      m.innerHTML = `<div class="modal-card"><button class="modal-x" data-c="x">✕</button>
        <h3 data-i18n="color.title"></h3>
        <div class="color-choice">
          <button class="color-btn" data-c="w"><b class="cp cp-w" data-no-ic>♚</b><span data-i18n="color.white"></span></button>
          <button class="color-btn" data-c="b"><b class="cp cp-b" data-no-ic>♚</b><span data-i18n="color.black"></span></button>
          <button class="color-btn" data-c="r"><b class="cp cp-r" data-no-ic>♚</b><span data-i18n="color.random"></span></button>
        </div></div>`;
      document.querySelector(".phone-frame").appendChild(m);
    }
    translatePage(m);
    m.classList.add("open");
    m.onclick = e => {
      const c = e.target.closest("[data-c]")?.dataset.c;
      if (!c) return;
      m.classList.remove("open");
      if (c === "x") return;
      cb(c === "r" ? (Math.random() < 0.5 ? "w" : "b") : c);
    };
  }

  UI.startLevel = function (id) {
    const lv = ALL_LEVELS.find(l => l.id === id);
    if (lv && lv.color) { this._launchLevel(id, lv.color); return; }   // сторона задана самим уровнем
    askColor(c => this._launchLevel(id, c));
  };
  UI.startPuzzle = function (id) { askColor(c => this._launchPuzzle(id, c)); };

  // ---------- play with a friend (one device) ----------
  class FriendController {
    constructor(o) {
      this.flip = o.flip; this.onStatus = o.onStatus; this.onOver = o.onOver;
      this.game = new Chess(); this.finished = false;
      this.board = new BoardView(o.boardEl, { playerColor: null, orientation: "w", onMove: (f, to) => this._move(f, to) });
      this.board.attach(this.game, null);
      this._status();
    }
    _side(c) { return t(c === "w" ? "side.white" : "side.black"); }
    _status() {
      const tw = this.game.turn() === "w";
      this.onStatus(t(tw ? "game.whiteToMove" : "game.blackToMove") + (this.game.in_check() ? " · " + t("game.check") : ""));
    }
    _move(from, to) {
      if (this.finished) return;
      const p = this.game.get(from);
      const promo = p && p.type === "p" && (to[1] === "8" || to[1] === "1");
      if (!this.game.move({ from, to, promotion: promo ? "q" : undefined })) return;
      this.board.attach(this.game, { from, to });
      if (this.game.game_over()) {
        this.finished = true; this.board.setLocked(true);
        if (this.game.in_checkmate()) {
          const w = this.game.turn() === "w" ? "b" : "w";
          this.onOver(t("friend.mate", { side: this._side(w) }), "");
        } else this.onOver(t("friend.drawTitle"), t("friend.drawSub"));
        return;
      }
      if (this.flip) this.board.setOrientation(this.game.turn());
      this._status();
    }
    hint() {}
    undo() {
      if (this.finished || !this.game.undo()) return;
      this.board.clearSelection(); this.board.attach(this.game, null);
      if (this.flip) this.board.setOrientation(this.game.turn());
      this._status();
    }
    resign() {
      if (this.finished) return;
      this.finished = true; this.board.setLocked(true);
      const w = this.game.turn() === "w" ? "b" : "w";
      this.onOver(t("friend.resigned", { side: this._side(w) }), "");
    }
  }

  UI.startFriend = function (flip) {
    this.currentMode = "friend";
    document.getElementById("game-level-name").textContent = t("friend.name");
    document.getElementById("game-level-tier").textContent = t("friend.tier");
    this._enterGameView();
    document.getElementById("btn-hint").hidden = true;
    this.gameController = new FriendController({
      boardEl: document.getElementById("board"), flip,
      onStatus: x => this._setStatus(x),
      onOver: (title, sub) => {
        this._modalRetryAction = () => this.startFriend(flip);
        this._showResultModal(title, sub, [], false, "", "");
      }
    });
  };
  const _eg = UI._enterGameView;
  UI._enterGameView = function () { _eg.call(this); document.getElementById("btn-hint").hidden = false; };

  // "Friend" tab inside Levels
  const tabs = document.querySelector(".mode-tabs");
  const ft = document.createElement("button");
  ft.className = "mode-tab"; ft.dataset.mode = "friend"; ft.setAttribute("data-i18n", "mode.friend");
  ft.textContent = t("mode.friend");
  tabs.appendChild(ft);

  const _rl = UI.renderLevels;
  UI.renderLevels = function () {
    _rl.call(this);
    if (this.activeMode !== "friend") return;
    const grid = document.getElementById("levels-grid");
    grid.style.display = "block";
    grid.innerHTML = `<div class="friend-card">
      <div class="friend-icon">♞ ♘</div>
      <h3>${t("friend.title")}</h3><p>${t("friend.sub")}</p>
      <label class="friend-opt"><input type="checkbox" id="friend-flip" checked> ${t("friend.flip")}</label>
      <button class="btn btn-primary" id="friend-start">${t("friend.start")}</button></div>`;
    document.getElementById("friend-start").onclick = () => this.startFriend(document.getElementById("friend-flip").checked);
  };
  const _rg = UI._renderGameLevels, _rp = UI._renderPuzzleLevels;
  UI._renderGameLevels = function () { document.getElementById("levels-grid").style.display = ""; _rg.call(this); };
  UI._renderPuzzleLevels = function () { document.getElementById("levels-grid").style.display = ""; _rp.call(this); };
})();