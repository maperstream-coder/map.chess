/* maper.chess — FX: анимация результата (победа / поражение / ничья / решено / мимо).
   Подключён ПОСЛЕ js/hints.js и ДО js/app.js. */
(function () {
  /* ---------- i18n ---------- */
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "fx.win": "VICTORY", "fx.winTag": "checkmate confirmed",
    "fx.loss": "DEFEAT", "fx.lossTag": "the machine prevails",
    "fx.draw": "DRAW", "fx.drawTag": "dead position",
    "fx.solved": "SOLVED", "fx.solvedTag": "tactics cleared",
    "fx.fail": "WRONG", "fx.failTag": "attempt failed",
    "fx.dwinTag": "You beat {name}", "fx.dlossTag": "{name} takes this one",
    "fx.ddrawTag": "An even fight with {name}",
    "fx.toGames": "To games", "fx.viewBoard": "View board", "fx.rematchSent": "Invite sent", "fx.analyze": "Game review"
  }, {
    "fx.win": "ПОБЕДА", "fx.winTag": "мат подтверждён",
    "fx.loss": "ПОРАЖЕНИЕ", "fx.lossTag": "машина победила",
    "fx.draw": "НИЧЬЯ", "fx.drawTag": "ничейная позиция",
    "fx.solved": "РЕШЕНО", "fx.solvedTag": "задача пройдена",
    "fx.fail": "МИМО", "fx.failTag": "неудачная попытка",
    "fx.dwinTag": "Вы обыграли {name}", "fx.dlossTag": "{name} забирает эту партию",
    "fx.ddrawTag": "Равная борьба с {name}",
    "fx.toGames": "К партиям", "fx.viewBoard": "Смотреть доску", "fx.rematchSent": "Приглашение отправлено", "fx.analyze": "Анализ партии"
  });

  /* ---------- FX-оверлей. ВАЖНО: «МИМО» держится СТОЛЬКО ЖЕ, сколько «РЕШЕНО». ---------- */
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FX = {
    _el: null, _timer: null,
    _build() {
      if (this._el) return this._el;
      const el = document.createElement("div");
      el.className = "fx-overlay";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML =
        '<div class="fx-scan"></div><div class="fx-vig"></div><div class="fx-glow"></div>' +
        '<div class="fx-frame"><i></i><i></i><i></i><i></i></div>' +
        '<div class="fx-box">' +
        '<div class="fx-glyph">♞</div>' +
        '<div class="fx-title"></div>' +
        '<div class="fx-tag"></div>' +
        "</div>" +
        '<div class="fx-particles"></div>';
      document.body.appendChild(el);
      this._el = el;
      return el;
    },
    play(type) {
      if (reduced()) return;
      const el = this._build();
      clearTimeout(this._timer);
      const title = t("fx." + type), tag = t("fx." + type + "Tag");
      el.dataset.fx = type;
      const tt = el.querySelector(".fx-title");
      tt.textContent = title;
      tt.dataset.text = title;
      el.querySelector(".fx-tag").textContent = tag;
      const pc = el.querySelector(".fx-particles");
      pc.innerHTML = "";
      for (let i = 0; i < 16; i++) {
        const s = document.createElement("i");
        s.style.setProperty("--tx", (Math.random() * 260 - 130) + "px");
        s.style.setProperty("--ty", (-50 - Math.random() * 190) + "px");
        s.style.setProperty("--d", (Math.random() * 0.35) + "s");
        s.style.setProperty("--s", (4 + Math.random() * 6) + "px");
        pc.appendChild(s);
      }
      el.classList.remove("show");
      void el.offsetWidth; // перезапуск анимации
      el.classList.add("show");
      /* единое время показа для ВСЕХ типов — «мимо» больше не уходит быстрее «решено» */
      this._timer = setTimeout(() => el.classList.remove("show"), 2400);
    }
  };
  window.FX = FX;


  /* ---------- Результат поединка с другом: победа / поражение / ничья ----------
     Остаётся на экране, пока игрок сам не закроет (в карточке есть кнопки). */
  const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const kingSvg = color => (window.pieceSvg && window.pieceSvg(color, "k")) || '<span class="dfx-glyph">♚</span>';
  const CROWN = '<svg viewBox="0 0 48 34" aria-hidden="true"><path d="M4 28 7 8l11 10L24 4l6 14L41 8l3 20z" fill="#e8c47c" stroke="#8a6a1f" stroke-width="2" stroke-linejoin="round"/><rect x="4" y="28" width="40" height="5" rx="2.5" fill="#e8c47c" stroke="#8a6a1f" stroke-width="2"/><circle cx="7" cy="8" r="2.6" fill="#fff3c9"/><circle cx="24" cy="4" r="2.6" fill="#fff3c9"/><circle cx="41" cy="8" r="2.6" fill="#fff3c9"/></svg>';
  const CRACK = '<svg class="dfx-crack" viewBox="0 0 200 120" aria-hidden="true"><path d="M100 0 92 22 108 40 90 62 104 84 96 120"/><path d="M108 40 132 48 150 74"/><path d="M90 62 66 70 52 96"/></svg>';

  function stageHtml(type, myColor) {
    if (type === "win") return `<div class="dfx-halo"></div><div class="dfx-crown">${CROWN}</div><div class="dfx-king">${kingSvg(myColor)}</div>`;
    if (type === "loss") return `<div class="dfx-king">${kingSvg(myColor)}</div>${CRACK}<div class="dfx-floor"></div>`;
    return `<div class="dfx-k dfx-kl">${kingSvg("w")}</div><div class="dfx-eq">=</div><div class="dfx-k dfx-kr">${kingSvg("b")}</div>`;
  }

  function particlesHtml(type) {
    let h = "";
    const r = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
    if (type === "win") {
      const cols = ["#e8c47c", "#fff3c9", "#b98bf5", "#72d6a3", "#f3a560", "#91d2f7"];
      for (let i = 0; i < 46; i++)
        h += `<i class="cf" style="--x:${r(0, 100)}%;--d:${r(0, 1.6)}s;--t:${r(2.4, 4.2)}s;--c:${cols[i % cols.length]};--w:${r(6, 11)}px;--rot:${r(-540, 540)}deg;--sw:${r(-40, 40)}px"></i>`;
    } else if (type === "loss") {
      for (let i = 0; i < 24; i++)
        h += `<i class="ash" style="--x:${r(0, 100)}%;--d:${r(0.4, 3)}s;--t:${r(4, 7)}s;--s:${r(2, 5)}px;--sw:${r(-30, 30)}px"></i>`;
    } else {
      for (let i = 0; i < 20; i++)
        h += `<i class="mote" style="--x:${r(0, 100)}%;--d:${r(0, 3)}s;--t:${r(4, 7)}s;--s:${r(3, 7)}px;--sw:${r(-25, 25)}px"></i>`;
    }
    return h;
  }

  let duelEl = null, duelKey = null;
  FX.duelClose = function () {
    if (!duelEl) return;
    duelEl.classList.remove("show");
    document.removeEventListener("keydown", duelKey);
    const el = duelEl; duelEl = null;
    setTimeout(() => el.remove(), 400);
  };

  FX.duel = function (o) {
    FX.duelClose();
    const type = o.type === "win" || o.type === "draw" ? o.type : "loss";
    const el = document.createElement("div");
    el.className = "dfx"; el.dataset.t = type;
    el.setAttribute("role", "dialog");
    const title = t("fx." + type);
    const tag = t("fx.d" + type + "Tag", { name: esc(o.oppNick) });
    el.innerHTML =
      '<div class="dfx-bg"></div><div class="dfx-rays"></div>' +
      `<div class="dfx-parts">${particlesHtml(type)}</div>` +
      '<div class="dfx-card">' +
        `<div class="dfx-stage">${stageHtml(type, o.myColor || "w")}</div>` +
        `<h2 class="dfx-title">${[...title].map((c, i) => `<span style="--i:${i}">${esc(c)}</span>`).join("")}</h2>` +
        `<p class="dfx-tag">${tag}</p>` +
        `<p class="dfx-reason">${esc(o.reason || "")}</p>` +
        `<div class="dfx-vs"><b>${esc(o.myNick)}</b><i>vs</i><b>${esc(o.oppNick)}</b></div>` +
        '<div class="dfx-actions"></div>' +
      "</div>";
    const acts = el.querySelector(".dfx-actions");
    const mk = (cls, label, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = cls; b.textContent = label;
      b.addEventListener("click", () => fn(b)); acts.appendChild(b); return b;
    };
    mk("btn btn-primary", t("du.rematch"), async b => {
      b.disabled = true;
      const ok = o.onRematch ? await o.onRematch() : false;
      if (ok) { b.textContent = "✓ " + t("fx.rematchSent"); setTimeout(() => { FX.duelClose(); if (o.onBack) o.onBack(); }, 700); }
      else b.disabled = false;
    });
    if (o.onAnalyze) mk("btn btn-ghost", "◎ " + t("fx.analyze"), () => { FX.duelClose(); o.onAnalyze(); });
    mk("btn btn-ghost", t("fx.toGames"), () => { FX.duelClose(); if (o.onBack) o.onBack(); });
    mk("dfx-link", t("fx.viewBoard"), () => FX.duelClose());

    el.querySelector(".dfx-bg").addEventListener("click", FX.duelClose);
    duelKey = e => { if (e.key === "Escape") FX.duelClose(); };
    document.addEventListener("keydown", duelKey);
    document.body.appendChild(el);
    duelEl = el;
    void el.offsetWidth;
    el.classList.add("show");
    if (navigator.vibrate) { try { navigator.vibrate(type === "win" ? [60, 40, 90] : type === "loss" ? [140] : [50]); } catch (e) {} }
  };

  /* ---------- хуки: все пять случаев ---------- */
  const _go = UI._handleGameOver.bind(UI);
  UI._handleGameOver = function (level, result) {
    FX.play(result.result === "win" ? "win" : result.result === "draw" ? "draw" : "loss");
    return _go(level, result);
  };
  const _pr = UI._handlePuzzleResult.bind(UI);
  UI._handlePuzzleResult = function (puzzle, solved, result) {
    FX.play(solved ? "solved" : "fail");
    return _pr(puzzle, solved, result);
  };
})();