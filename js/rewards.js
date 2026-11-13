/* maper.chess — награды за обучение + новые достижения + ЦЕРЕМОНИЯ НАГРАД (анимации).
   Подключается ПОСЛЕ lessons.js.
   Что здесь:
     • 10 наград за блоки пути (было 5): за первый шаг, 3/4/5/8 уроков, 2/4/6/8 дебютов и диплом;
     • эксклюзивные предметы (доски и фигуры), которые выдаются только за обучение;
     • Celebrate — салют (canvas), окно награды с лучами, медалью, блеском, карточками и летящими монетами;
     • window.MaperRewards — отдаёт список наград в lessons.js, чтобы показать «подарки» на клетках пути. */
(function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  const isRu = () => !!(UI.state && UI.state.lang === "ru");
  const tr = (en, ru) => (isRu() ? ru : en);
  const cnt = (s, k) => Object.keys(s[k] || {}).length;
  const L = s => cnt(s, "lessons"), O = s => cnt(s, "openings");
  const sfx = (fn, ...a) => { try { if (typeof Sfx !== "undefined" && Sfx[fn]) Sfx[fn](...a); } catch (e) {} };

  /* ---------- эксклюзивные предметы (в магазине не продаются, выдаются только за обучение) ---------- */
  const REWARD_ITEMS = [
    { id: "board-dawn", type: "board", nameKey: "shop.board-dawn", price: 0,
      vars: { "--sq-light": "#8c6f82", "--sq-dark": "#3b2840", "--sq-active": "#ffc59a" } },
    { id: "board-academy", type: "board", nameKey: "shop.board-academy", price: 0,
      vars: { "--sq-light": "#6f7f55", "--sq-dark": "#2d3a23", "--sq-active": "#d6e87c" } },
    { id: "pieces-aurora", type: "pieces", nameKey: "shop.pieces-aurora", price: 0,
      vars: { "--pc-white": "#c9f5ea", "--pc-black": "#1d2f4a" } },
    { id: "pieces-maper", type: "pieces", nameKey: "shop.pieces-maper", price: 0,
      vars: { "--pc-white": "#e9deff", "--pc-black": "#2b1759" } },
    { id: "board-diploma", type: "board", nameKey: "shop.board-diploma", price: 0,
      vars: { "--sq-light": "#85749a", "--sq-dark": "#31264a", "--sq-active": "#ffd98a" } }
  ];
  REWARD_ITEMS.forEach(i => SHOP_ITEMS.push(i));
  add({ "shop.board-dawn": "Summit Dawn", "shop.board-academy": "Academy Green", "shop.pieces-aurora": "Aurora", "shop.pieces-maper": "MAPER Violet", "shop.board-diploma": "Diploma Gold" },
      { "shop.board-dawn": "Рассвет на вершине", "shop.board-academy": "Зелёная академия", "shop.pieces-aurora": "Северное сияние", "shop.pieces-maper": "Фиолетовый MAPER", "shop.board-diploma": "Золото диплома" });

  const _rs = UI.renderShop;
  if (_rs) UI.renderShop = function () {
    const hide = REWARD_ITEMS.filter(i => !this.state.owned.includes(i.id));
    hide.forEach(i => { const k = SHOP_ITEMS.indexOf(i); if (k > -1) SHOP_ITEMS.splice(k, 1); });
    try { return _rs.apply(this, arguments); } finally { hide.forEach(i => SHOP_ITEMS.push(i)); }
  };

  /* ---------- векторные иконки (единый стиль: линия 1.8, скруглённые концы) ---------- */
  const SV = (body, size, extra) => `<svg class="rw-svg" viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra || ""} aria-hidden="true">${body}</svg>`;
  const ICON = {
    book: '<path d="M3 5.5C5.5 4.3 8.5 4.5 12 6.5c3.5-2 6.5-2.2 9-1v13c-2.5-1.2-5.5-1-9 1-3.5-2-6.5-2.2-9-1z"/><path d="M12 6.5v13"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.6V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.4"/><path d="M22 9v5.5"/>',
    list: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
    medal: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.6L7 21l5-2.6 5 2.6-1.6-7.4"/><path d="M12 6.4l.95 1.9 2.1.3-1.5 1.5.35 2.1L12 11.2l-1.9 1 .35-2.1-1.5-1.5 2.1-.3z" stroke-width="1.4"/>',
    check: '<path d="M5 12.5l4.6 4.6L19 7.5" stroke-width="2.4"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.6c3-1.7 5.4 1.7 8.4 0 1.5-.85 2.9-.9 3.6-.6v8c-.7-.3-2.1-.25-3.6.6-3 1.7-5.4-1.7-8.4 0"/>',
    mountain: '<path d="M2.5 20l6.8-11.5 3.7 6 2.3-3.4L21.5 20z"/><path d="M9.3 8.5l1.9 3.2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="2.2"/><path d="M12 9v11.5M3.5 13.5h17"/><path d="M12 9C8.8 9 7.4 7.4 8 5.9s3.2-.9 4 3.1c.8-4 3.6-4.6 4-3.1s-.8 3.1-4 3.1"/>',
    snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8L20.2 7.2"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" stroke-width="1.5"/>'
  };
  const MINI = {
    coin: SV('<circle cx="12" cy="12" r="9.5" fill="#e3bf7c" stroke="#b8923e"/><circle cx="12" cy="12" r="5.8" stroke="#a07c2c" stroke-width="1.6"/>', 14),
    snow: SV(ICON.snow, 14, 'style="color:#91d2f7"'),
    gift: SV(ICON.gift, 14, 'style="color:#b9aeff"')
  };

  /* ---------- награды за блоки пути ----------
     kind: lessons | openings | both — что считаем; n — сколько нужно; xp/coins/freeze/item — что дарим */
  /* сколько всего уроков и дебютов — приходит из lessons.js, поэтому награды сами подстраиваются под число уроков */
  const MP = window.MaperPath || { lessons: 8, openings: 8 };
  const TL = MP.lessons, TO = MP.openings;
  const STEPS = [
    { id: "l1", kind: "lessons", n: 1, coins: 10, xp: 5, ic: "flag", en: "First step: 1 lesson", ru: "Первый шаг: 1 урок" },
    { id: "l3", kind: "lessons", n: 3, coins: 15, xp: 10, ic: "book", en: "Three lessons in", ru: "Три урока позади" },
    { id: "l5", kind: "lessons", n: 5, coins: 30, xp: 20, item: "board-dawn", ic: "mountain", en: "Chapter 1 cleared: Basics", ru: "Глава 1 пройдена: Основы" },
    { id: "l8", kind: "lessons", n: 8, coins: 45, xp: 30, ic: "book", en: "Eight lessons in", ru: "Восемь уроков позади" },
    { id: "l12", kind: "lessons", n: 12, coins: 90, xp: 50, freeze: true, item: "board-academy", ic: "cap", en: "Twelve lessons in", ru: "Двенадцать уроков позади" },
    { id: "l15", kind: "lessons", n: 15, coins: 140, xp: 70, ic: "trophy", en: "Fifteen lessons in", ru: "Пятнадцать уроков позади" },
    { id: "lall", kind: "lessons", n: 17, coins: 220, xp: 100, freeze: true, ic: "mountain", en: "Seventeen lessons in", ru: "Семнадцать уроков позади" },
    { id: "o2", kind: "openings", n: 2, coins: 20, xp: 10, ic: "list", en: "Two openings learned", ru: "Два дебюта выучено" },
    { id: "o4", kind: "openings", n: 4, coins: 40, xp: 20, ic: "list", en: "Half-way: 4 openings", ru: "Полпути: 4 дебюта" },
    { id: "o6", kind: "openings", n: Math.min(6, TO), coins: 70, xp: 35, item: "pieces-aurora", ic: "star", en: "Six openings learned", ru: "Шесть дебютов выучено" },
    { id: "o8", kind: "openings", n: 8, coins: 120, xp: 50, item: "pieces-maper", ic: "trophy", en: "Eight openings learned: a solid repertoire", ru: "Восемь дебютов выучено: крепкий репертуар" },
    { id: "l22", kind: "lessons", n: 22, coins: 160, xp: 80, ic: "cap", en: "Twenty-two lessons in", ru: "Двадцать два урока позади" },
    { id: "l27", kind: "lessons", n: 27, coins: 200, xp: 90, ic: "book", en: "Twenty-seven lessons in", ru: "Двадцать семь уроков позади" },
    { id: "l35", kind: "lessons", n: 35, coins: 230, xp: 100, ic: "book", en: "Thirty-five lessons in", ru: "Тридцать пять уроков позади" },
    { id: "l45", kind: "lessons", n: 45, coins: 260, xp: 110, ic: "cap", en: "Forty-five lessons in", ru: "Сорок пять уроков позади" },
    { id: "lall2", kind: "lessons", n: TL, coins: 300, xp: 130, freeze: true, ic: "mountain", en: "Every lesson cleared!", ru: "Все уроки пройдены!" },
    { id: "o12", kind: "openings", n: 12, coins: 150, xp: 60, ic: "list", en: "Twelve openings learned", ru: "Двенадцать дебютов выучено" },
    { id: "o18", kind: "openings", n: TO, coins: 250, xp: 100, freeze: true, ic: "trophy", en: "Every opening learned!", ru: "Все дебюты выучены!" },
    { id: "dip", kind: "both", n: TL + TO, coins: 400, xp: 150, freeze: true, item: "board-diploma", ic: "medal", big: true, en: "MAPER Diploma: everything cleared", ru: "Диплом MAPER: всё пройдено" }
  ].filter(st => st.n <= (st.kind === "lessons" ? TL : st.kind === "openings" ? TO : TL + TO));
  const have = (s, st) => st.kind === "lessons" ? L(s) : st.kind === "openings" ? O(s) : L(s) + O(s);
  const rewardHtml = st => [`<em>${MINI.coin}+${st.coins}</em>`, st.freeze ? `<em>${MINI.snow}+1</em>` : "",
    st.item ? `<em>${MINI.gift}${t("shop." + st.item)}</em>` : ""].filter(Boolean).join("");
  window.MaperRewards = { STEPS, have };

  function grantBlocks(s) {
    s.rewardsClaimed = Array.isArray(s.rewardsClaimed) ? s.rewardsClaimed : [];
    const got = [];
    STEPS.forEach(st => {
      if (s.rewardsClaimed.includes(st.id) || have(s, st) < st.n) return;
      s.rewardsClaimed.push(st.id);
      s.coins += st.coins;
      s.xp += st.xp || 0;
      if (st.freeze && s.streak.freezes < STREAK_CONFIG.maxFreezes) s.streak.freezes++;
      if (st.item && !s.owned.includes(st.item)) s.owned.push(st.item);
      got.push(st);
    });
    return got;
  }

  /* ---------- новые достижения ---------- */
  const ACH = [
    ["wins-5", "swords", 40, s => s.stats.wins >= 5, "Fighter", "Win 5 games.", "Боец", "Выиграйте 5 партий."],
    ["wins-25", "medal", 100, s => s.stats.wins >= 25, "Veteran", "Win 25 games.", "Ветеран", "Выиграйте 25 партий."],
    ["wins-100", "hundred", 300, s => s.stats.wins >= 100, "Centurion", "Win 100 games.", "Сотник", "Выиграйте 100 партий."],
    ["games-50", "run", 80, s => s.stats.gamesPlayed >= 50, "Marathoner", "Play 50 games.", "Марафонец", "Сыграйте 50 партий."],
    ["flawless-5", "target", 90, s => s.stats.hintlessWins >= 5, "Clean Play", "Win 5 games without hints.", "Чистая игра", "Выиграйте 5 партий без подсказок."],
    ["puzzle-15", "brain", 70, s => s.completedPuzzles.length >= 15, "Puzzle Solver", "Solve 15 puzzles.", "Решатель", "Решите 15 задач."],
    ["puzzle-all", "puzzle", 150, s => ALL_PUZZLES.every(p => s.completedPuzzles.includes(p.id)), "Combination Master", "Solve every puzzle.", "Мастер комбинаций", "Решите все задачи."],
    ["xp-1000", "sparkles", 80, s => s.xp >= 1000, "Thousand Club", "Earn 1000 XP.", "Тысячник", "Заработайте 1000 XP."],
    ["xp-3000", "crown", 200, s => s.xp >= 3000, "Legend", "Earn 3000 XP.", "Легенда", "Заработайте 3000 XP."],
    ["coins-1000", "coins", 50, s => s.coins >= 1000, "Piggy Bank", "Hold 1000 coins at once.", "Копилка", "Накопите 1000 монет."],
    ["shop-6", "bag", 60, s => s.owned.length >= 6, "Fashionista", "Own 6 shop items.", "Модник", "Соберите 6 предметов из магазина."],
    ["stars-10", "star", 100, s => Object.values(s.levelStars || {}).filter(v => v >= 3).length >= 10, "Star Path", "Get 3 stars on 10 levels.", "Звёздный путь", "Получите 3 звезды на 10 уровнях."],
    ["streak-14", "flame", 100, s => s.streak.best >= 14, "Two Weeks", "Keep a 14-day streak.", "Две недели", "Серия огонька — 14 дней."],
    ["streak-60", "volcano", 250, s => s.streak.best >= 60, "Unburnable", "Keep a 60-day streak.", "Несгораемый", "Серия огонька — 60 дней."],
    ["lesson-first", "book", 20, s => L(s) >= 1, "First Lesson", "Finish your first lesson.", "Первый урок", "Пройдите первый урок."],
    ["lessons-8", "cap", 50, s => L(s) >= TL, "Academy Graduate", `Finish all ${TL} lessons.`, "Выпускник академии", `Пройдите все ${TL} уроков.`],
    ["lessons-3star", "star-glow", 120, s => L(s) >= TL && Object.values(s.lessons).every(v => v >= 3), "Honor Student", "Get 3 stars on every lesson.", "Отличник", "3 звезды за каждый урок."],
    ["openings-4", "books", 50, s => O(s) >= 4, "Opening Rookie", "Learn 4 openings.", "Дебютант", "Выучите 4 дебюта."],
    ["openings-8", "doc", 100, s => O(s) >= TO, "Opening Expert", `Learn all ${TO} openings.`, "Знаток дебютов", `Выучите все ${TO} дебютов.`],
    ["tactician", "target", 60, s => ["mate1", "forks", "pins", "threats"].every(i => (s.lessons || {})[i]), "Tactician", "Finish the mate, fork, pin and threat lessons.", "Тактик", "Пройдите уроки про мат, вилки, связки и угрозы."],
    ["endgamer", "pawn", 70, s => (s.lessons || {}).kpk >= 1, "Endgame Player", "Finish the king-and-pawn endgame lesson.", "Эндшпилист", "Пройдите урок «Король и пешка»."],
    ["mate-master", "queen", 120, s => ["mate2", "sac", "mate3"].every(i => (s.lessons || {})[i]), "Mating Master", "Finish mate in two, sacrifices and mate in three.", "Мастер мата", "Пройдите мат в два хода, жертвы и мат в три хода."],
    ["summit-3star", "mountain", 200, s => ["sac", "mate3"].every(i => ((s.lessons || {})[i] || 0) >= 3), "Summit, no slips", "Get 3 stars on both summit lessons.", "Вершина без ошибок", "3 звезды в обоих уроках главы «Вершина»."],
    ["diploma", "medal", 250, s => L(s) >= TL && O(s) >= TO, "MAPER Diploma", "Finish all lessons and openings.", "Диплом MAPER", "Пройдите все уроки и дебюты."]
  ];
  ACH.forEach(([id, icon, coins, test, ne, de, nr, dr]) => {
    ACHIEVEMENTS.push({ id, icon, coins, test });
    add({ [`ach.${id}.name`]: ne, [`ach.${id}.desc`]: de }, { [`ach.${id}.name`]: nr, [`ach.${id}.desc`]: dr });
  });

  /* ====================================================================
     ЦЕРЕМОНИЯ НАГРАД
     Celebrate.burst(x, y, {n, power}) — салют из точки (квадратики-«клетки», прямоугольники, искры);
     Celebrate.show(cfg)               — окно награды (лучи, медаль с блеском, карточки, монеты летят в счётчик);
     Все анимации выключаются при prefers-reduced-motion.
     ==================================================================== */
  const Celebrate = (function () {
    const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const COLORS = ["#b98bf5", "#8e55e6", "#e3bf7c", "#72d6a3", "#f3d595", "#dcc6ff", "#ee8195"];
    let cv = null, ctx = null, parts = [], raf = 0, W = 0, H = 0;

    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function ensure() {
      if (cv) return;
      cv = document.createElement("canvas"); cv.className = "cx-cv"; cv.setAttribute("aria-hidden", "true");
      document.body.appendChild(cv); ctx = cv.getContext("2d"); size();
      window.addEventListener("resize", size);
    }
    function spark(c, r) { /* четырёхконечная искра */
      c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(0, 0, r, 0); c.quadraticCurveTo(0, 0, 0, r); c.quadraticCurveTo(0, 0, -r, 0); c.quadraticCurveTo(0, 0, 0, -r); c.fill();
    }
    function loop() {
      ctx.clearRect(0, 0, W, H);
      parts = parts.filter(p => p.t < p.life && p.y < H + 40);
      parts.forEach(p => {
        p.t++; p.vy += p.g; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const fade = p.life - p.t < 24 ? (p.life - p.t) / 24 : 1;
        ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        if (p.kind === 0) ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);               /* клетка */
        else if (p.kind === 1) ctx.fillRect(-p.r * 1.5, -p.r * 0.6, p.r * 3, p.r * 1.2); /* конфетти */
        else spark(ctx, p.r * 1.8);                                                  /* искра */
        ctx.restore();
      });
      raf = parts.length ? requestAnimationFrame(loop) : 0;
      if (!raf) ctx.clearRect(0, 0, W, H);
    }
    function push(p) { parts.push(p); }
    function burst(x, y, o) {
      if (reduce()) return; ensure(); o = o || {};
      const n = o.n || 40, pw = o.power || 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 6.5) * pw;
        push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3.2 * pw, g: 0.15 + Math.random() * 0.08, r: 3 + Math.random() * 3.5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.36,
               c: COLORS[i % COLORS.length], life: 70 + Math.random() * 55, t: 0, kind: Math.random() < 0.18 ? 2 : Math.random() < 0.5 ? 0 : 1 });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }
    /* дождь из конфетти сверху на несколько секунд (для больших наград) */
    function rain(ms) {
      if (reduce()) return; ensure();
      const end = performance.now() + (ms || 2500);
      (function drop() {
        for (let i = 0; i < 4; i++) push({ x: Math.random() * W, y: -12, vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 2.5, g: 0.05, r: 3 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25,
          c: COLORS[(Math.random() * COLORS.length) | 0], life: 160 + Math.random() * 60, t: 0, kind: Math.random() < 0.4 ? 0 : Math.random() < 0.85 ? 1 : 2 });
        if (!raf) raf = requestAnimationFrame(loop);
        if (performance.now() < end) setTimeout(drop, 60);
      })();
    }

    /* ---- карточки наград ---- */
    const boardPrev = v => { let c = ""; for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) c += `<i class="${(r + f) % 2 ? "d" : "l"}${r === 1 && f === 2 ? " a" : ""}"></i>`;
      return `<span class="cx-bd" style="--l:${v["--sq-light"]};--d:${v["--sq-dark"]};--a:${v["--sq-active"]}">${c}</span>`; };
    const piecesPrev = v => {
      const w = window.pieceSvg ? window.pieceSvg("w", "n") : "", b = window.pieceSvg ? window.pieceSvg("b", "n") : "";
      return `<span class="cx-pc" style="--pc-white:${v["--pc-white"]};--pc-black:${v["--pc-black"]}"><u style="background:${v["--pc-white"]}">${w}</u><u style="background:${v["--pc-black"]}">${b}</u></span>`;
    };
    function cardHtml(c, i) {
      const st = `style="--i:${i}"`;
      if (c.kind === "coin") return `<div class="cx-c gold" ${st}><span class="cx-ci">${SV('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.8c.6-.9 1.5-1.3 2.5-1.3 1.4 0 2.5.7 2.5 1.8 0 2.5-5 1.4-5 4 0 1 1.1 1.8 2.5 1.8 1 0 1.9-.4 2.5-1.3" stroke-width="1.5"/>', 26)}</span><b>+<span data-to="${c.n}">0</span></b><small>${tr("coins", "монет")}</small></div>`;
      if (c.kind === "xp") return `<div class="cx-c" ${st}><span class="cx-ci">${SV(ICON.star, 26)}</span><b>+<span data-to="${c.n}">0</span></b><small>XP</small></div>`;
      if (c.kind === "freeze") return `<div class="cx-c ice" ${st}><span class="cx-ci">${SV(ICON.snow, 26)}</span><b>+1</b><small>${tr("streak freeze", "заморозка серии")}</small></div>`;
      if (c.kind === "item") {
        const it = SHOP_ITEMS.find(x => x.id === c.id), prev = it ? (it.type === "board" ? boardPrev(it.vars) : piecesPrev(it.vars)) : `<span class="cx-ci">${SV(ICON.gift, 26)}</span>`;
        return `<div class="cx-c item" ${st}>${prev}<b>${t("shop." + c.id)}</b><small>${tr("new in your collection", "новое в коллекции")}</small></div>`;
      }
      return `<div class="cx-c ach" ${st}><span class="cx-ci">${SV(ICON.trophy, 26)}</span><b>${c.name}</b><small>+${c.coins} ${tr("coins", "монет")}</small></div>`;
    }

    /* ---- окно награды ---- */
    let queue = [], showing = false;
    function countUp(el, to, delay) {
      setTimeout(() => {
        const t0 = performance.now(), dur = 900;
        (function tick(now) { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && el.isConnected) requestAnimationFrame(tick); })(t0);
      }, delay);
    }
    function flyCoins(from, n) {
      const tgt = document.querySelector(".pill-coins"); if (!tgt || reduce() || !from.animate) return;
      const a = from.getBoundingClientRect(), b = tgt.getBoundingClientRect();
      for (let i = 0; i < n; i++) {
        const c = document.createElement("i"); c.className = "cx-fly"; document.body.appendChild(c);
        const sx = a.left + a.width / 2 - 9 + (Math.random() - 0.5) * 60, sy = a.top + a.height / 2 - 9 + (Math.random() - 0.5) * 20;
        const dx = b.left + b.width / 2 - 9 - sx, dy = b.top + b.height / 2 - 9 - sy;
        const an = c.animate([{ transform: `translate(${sx}px,${sy}px) scale(.4)`, opacity: 0 }, { transform: `translate(${sx}px,${sy - 40}px) scale(1.1)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${sx + dx}px,${sy + dy}px) scale(.7)`, opacity: 1 }], { duration: 750 + i * 40, delay: i * 70, easing: "cubic-bezier(.5,0,.8,.4)", fill: "both" });
        an.onfinish = () => { c.remove(); sfx("coin"); tgt.classList.remove("cx-bump"); void tgt.offsetWidth; tgt.classList.add("cx-bump"); };
      }
    }
    function next() {
      const cfg = queue.shift();
      if (!cfg) { showing = false; return; }
      showing = true; ensure();
      const el = document.createElement("div"); el.className = `cx ${cfg.tone || "gold"}`; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
      el.innerHTML = `<div class="cx-bg"></div><div class="cx-rays"></div>
        <div class="cx-box">
          <div class="cx-medal"><span class="cx-ring r1"></span><span class="cx-ring r2"></span><div class="cx-disc">${SV(ICON[cfg.icon] || ICON.medal, cfg.big ? 66 : 56)}<span class="cx-shine"></span></div></div>
          <div class="cx-k">${cfg.kicker || ""}</div>
          <h3 class="cx-t">${cfg.title}</h3>
          ${cfg.sub ? `<p class="cx-s">${cfg.sub}</p>` : ""}
          <div class="cx-cards">${(cfg.cards || []).map(cardHtml).join("")}</div>
          <button type="button" class="btn btn-primary cx-go" style="--n:${(cfg.cards || []).length}">${tr("Collect", "Забрать")}</button>
        </div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add("on"));
      sfx(cfg.big ? "fanfare" : "unlock");
      const mid = () => { const r = el.querySelector(".cx-medal").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
      setTimeout(() => { const [x, y] = mid(); burst(x, y, { n: cfg.big ? 90 : 60, power: cfg.big ? 1.5 : 1.15 }); sfx("sparkle"); }, 650);
      if (cfg.big) { setTimeout(() => rain(3200), 900); }
      el.querySelectorAll(".cx-c").forEach((c, i) => {
        const d = 1000 + i * 220;
        setTimeout(() => { const r = c.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 14, power: 0.55 }); }, d + 250);
        c.querySelectorAll("[data-to]").forEach(n => countUp(n, +n.dataset.to, d + 200));
      });
      const go = el.querySelector(".cx-go");
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        document.removeEventListener("keydown", onKey);
        const coins = el.querySelector(".cx-c.gold,.cx-c.ach");
        if (coins) flyCoins(go, 8);
        el.classList.remove("on"); el.classList.add("out");
        setTimeout(() => { el.remove(); next(); }, 380);
      };
      const onKey = e => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); close(); } };
      document.addEventListener("keydown", onKey);
      go.addEventListener("click", close);
      setTimeout(() => go.focus({ preventScroll: true }), 300);
    }
    function show(cfg) { queue.push(cfg); if (!showing) next(); }

    return { burst, rain, show };
  })();
  window.Celebrate = Celebrate;

  /* ---------- проверка при любом сохранении (урок/дебют сохраняются через saveState) ---------- */
  const inLessons = () => { const v = document.getElementById("view-lessons"); return !!(v && v.classList.contains("active")); };
  let pending = [];
  function blockCfg(st) {
    const cards = [{ kind: "coin", n: st.coins }];
    if (st.xp) cards.push({ kind: "xp", n: st.xp });
    if (st.freeze) cards.push({ kind: "freeze" });
    if (st.item) cards.push({ kind: "item", id: st.item });
    return { tone: "gold", big: !!st.big, icon: st.ic, kicker: tr("Block cleared", "Блок пройден"), title: isRu() ? st.ru : st.en,
             sub: st.big ? tr("You climbed all the way to the top. Nicely done!", "Ты поднялся на самую вершину. Блестяще!") : tr("Your reward is ready.", "Твоя награда готова."), cards };
  }
  function achCfg(ach) {
    return { tone: "violet", icon: "trophy", kicker: tr("Achievement", "Достижение"),
             title: ach.length > 1 ? tr("New achievements!", "Новые достижения!") : t(`ach.${ach[0].id}.name`),
             sub: ach.length > 1 ? "" : t(`ach.${ach[0].id}.desc`),
             cards: ach.map(a => ({ kind: "ach", name: t(`ach.${a.id}.name`), coins: a.coins })) };
  }
  function celebrate(blocks, ach) {
    const list = [...blocks.map(blockCfg), ...(ach.length ? [achCfg(ach)] : [])];
    list.forEach(c => Celebrate.show(c));
  }
  let busy = false;
  const _save = window.saveState;
  window.saveState = function (s) {
    _save(s);
    /* UI объявлен через const и не лежит в window — поэтому проверяем через typeof (раньше из-за window.UI награды не выдавались) */
    if (busy || typeof UI === "undefined" || s !== UI.state) return;
    busy = true;
    try {
      const blocks = grantBlocks(s), ach = checkAchievements(s);
      if (blocks.length || ach.length) {
        _save(s); UI.renderTopbar();
        if (inLessons()) {
          /* даём сначала доиграть анимацию звёзд урока, потом — торжественное окно */
          setTimeout(() => celebrate(blocks, ach), 2300);
        } else {
          /* награда получена не на экране обучения (например, после партии) — показываем её, когда игрок откроет «Обучение» */
          pending.push({ blocks, ach });
          const msg = [...blocks.map(b => isRu() ? b.ru : b.en), ...ach.map(a => t(`ach.${a.id}.name`))].slice(0, 3).join("\n");
          UI._toast(msg);
        }
        paint();
      }
    } finally { busy = false; }
  };
  /* отложенные награды — показываем, когда игрок зашёл в «Обучение» */
  const _sv = UI.showView;
  UI.showView = function (n) {
    const r = _sv.apply(this, arguments);
    if (n === "lessons" && pending.length) { const p = pending; pending = []; setTimeout(() => p.forEach(x => celebrate(x.blocks, x.ach)), 700); }
    return r;
  };

  /* ---------- плашка наград на экране обучения + стили церемонии ---------- */
  const css = document.createElement("style");
  css.textContent = `.rw-strip{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
  .rw-chip{flex:1 1 200px;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:var(--panel);border:1px solid var(--line)}
  .rw-chip b{display:block;font-size:13px;color:var(--ink)}.rw-chip small{display:block;font-size:11.5px;color:var(--ink-dim);line-height:1.35}
  .rw-chip i{display:block;height:4px;margin-top:5px;border-radius:4px;background:var(--panel-3);overflow:hidden}.rw-chip i u{display:block;height:100%;background:var(--violet-2)}
  .rw-chip>div{flex:1;min-width:0}.rw-chip i{width:100%}
  .rw-ico{display:grid;place-items:center;width:46px;height:46px;flex:none;border-radius:14px;color:#cfc7ff;
    background:linear-gradient(145deg,rgba(142, 85, 230,.34),rgba(95, 47, 184,.12));box-shadow:inset 0 0 0 1px rgba(185, 139, 245,.28)}
  .rw-chip.ok .rw-ico{color:#8ae6b6;background:linear-gradient(145deg,rgba(114,214,163,.30),rgba(114,214,163,.08));box-shadow:inset 0 0 0 1px rgba(114,214,163,.4)}
  .rw-r{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:3px}.rw-r em{display:inline-flex;align-items:center;gap:5px;font-style:normal;font-weight:700;color:var(--ink-dim)}
  .rw-r .rw-svg{flex:none}
  .rw-chip.ok{border-color:rgba(114,214,163,.4);background:rgba(114,214,163,.07)}.rw-chip.ok i u{background:var(--ok)}

  /* ---- окно награды ---- */
  .cx-cv{position:fixed;left:0;top:0;width:100%;height:100%;z-index:10020;pointer-events:none}
  .cx{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;overflow:auto;opacity:0;transition:opacity .3s}
  .cx.on{opacity:1}.cx.out{opacity:0}
  .cx-bg{position:fixed;inset:0;background:radial-gradient(70% 60% at 50% 40%,rgba(54,42,110,.55),rgba(8,8,12,.92));-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .cx-rays{position:fixed;left:50%;top:50%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;pointer-events:none;opacity:0;
    background:repeating-conic-gradient(from 0deg,rgba(227,191,124,.20) 0 7deg,transparent 7deg 22deg);
    -webkit-mask-image:radial-gradient(circle,#000 0,transparent 42%);mask-image:radial-gradient(circle,#000 0,transparent 42%)}
  .cx.violet .cx-rays{background:repeating-conic-gradient(from 0deg,rgba(185, 139, 245,.22) 0 7deg,transparent 7deg 22deg)}
  .cx.on .cx-rays{opacity:1;transition:opacity .8s .2s;animation:cxSpin 26s linear infinite}
  .cx-box{position:relative;width:min(440px,100%);display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0 4px}
  .cx-medal{position:relative;width:132px;height:132px;margin:22px 0 40px;opacity:0}
  .cx.on .cx-medal{animation:cxDrop .9s cubic-bezier(.2,1.25,.35,1) .1s forwards}
  .cx-disc{position:relative;overflow:hidden;display:grid;place-items:center;width:100%;height:100%;border-radius:36px;transform:rotate(45deg);color:#3a2a07;
    background:linear-gradient(145deg,#f7dca0,var(--gold) 55%,#b8923e);border:2px solid #f9e6b8;box-shadow:0 0 0 6px rgba(227,191,124,.18),0 20px 50px -10px rgba(227,191,124,.65)}
  .cx-disc .rw-svg{transform:rotate(-45deg)}
  .cx.violet .cx-disc{color:#fff;background:linear-gradient(145deg,var(--violet-2),var(--violet) 55%,var(--violet-deep));border-color:var(--violet-3);box-shadow:0 0 0 6px rgba(142, 85, 230,.22),0 20px 50px -10px rgba(142, 85, 230,.75)}
  .cx-shine{position:absolute;top:-30%;bottom:-30%;left:-60%;width:36%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-20deg);opacity:0}
  .cx.on .cx-shine{animation:cxShine 1.1s ease 1.1s 1 forwards,cxShine 1.1s ease 3.6s infinite}
  .cx-ring{position:absolute;inset:-6px;border-radius:40px;border:2px solid rgba(227,191,124,.7);transform:rotate(45deg);pointer-events:none;opacity:0}
  .cx.violet .cx-ring{border-color:rgba(185, 139, 245,.7)}
  .cx.on .cx-ring.r1{animation:cxRing 2s ease-out 1s infinite}.cx.on .cx-ring.r2{animation:cxRing 2s ease-out 2s infinite}
  .cx-k{font:700 13px var(--font-ui);color:var(--gold);opacity:0}.cx.violet .cx-k{color:var(--violet-3)}
  .cx-t{margin:4px 0 0;font:600 28px/1.15 var(--font-display);color:var(--ink);opacity:0}
  .cx-s{margin:8px 0 0;max-width:340px;color:var(--ink-dim);font:600 14px/1.5 var(--font-ui);opacity:0}
  .cx.on .cx-k{animation:cxUp .5s ease .55s forwards}.cx.on .cx-t{animation:cxUp .5s ease .65s forwards}.cx.on .cx-s{animation:cxUp .5s ease .75s forwards}
  .cx-cards{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:20px 0 20px}
  .cx-c{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:104px;max-width:150px;padding:14px 14px 12px;border-radius:18px;border:1px solid var(--line-2);
    background:linear-gradient(180deg,var(--panel-2),var(--panel));opacity:0}
  .cx.on .cx-c{animation:cxCard .6s cubic-bezier(.2,1.4,.4,1) forwards;animation-delay:calc(1s + var(--i) * .22s)}
  .cx-c b{font:800 20px var(--font-ui);color:var(--ink);font-variant-numeric:tabular-nums}.cx-c.item b,.cx-c.ach b{font-size:14px;line-height:1.25}
  .cx-c small{font:600 11.5px/1.3 var(--font-ui);color:var(--ink-dim)}
  .cx-ci{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;color:var(--violet-3);background:var(--tint);border:1px solid var(--tint-2)}
  .cx-c.gold{border-color:rgba(227,191,124,.4)}.cx-c.gold .cx-ci{color:var(--gold);background:rgba(227,191,124,.12);border-color:rgba(227,191,124,.35)}.cx-c.gold b{color:var(--gold)}
  .cx-c.ice .cx-ci{color:#91d2f7;background:rgba(145,210,247,.12);border-color:rgba(145,210,247,.35)}
  .cx-c.ach .cx-ci{color:var(--gold);background:rgba(227,191,124,.12);border-color:rgba(227,191,124,.35)}
  .cx-bd{display:grid;grid-template-columns:repeat(4,1fr);width:58px;height:58px;border-radius:12px;overflow:hidden;border:1px solid var(--line-3)}
  .cx-bd i{display:block}.cx-bd i.l{background:var(--l)}.cx-bd i.d{background:var(--d)}.cx-bd i.a{box-shadow:inset 0 0 0 3px var(--a)}
  .cx-pc{display:flex;gap:6px}.cx-pc u{display:grid;place-items:center;width:34px;height:42px;border-radius:10px;text-decoration:none;border:1px solid var(--line-3)}
  .cx-pc svg{width:28px;height:28px;display:block}
  .cx-go{opacity:0;padding:12px 34px;font-size:15px}.cx.on .cx-go{animation:cxUp .5s ease forwards;animation-delay:calc(1.2s + var(--n,3) * .22s)}
  .cx-fly{position:fixed;left:0;top:0;width:18px;height:18px;border-radius:50%;z-index:10030;pointer-events:none;background:radial-gradient(circle at 35% 30%,#fff2c4,var(--gold) 55%,#b8923e);box-shadow:0 0 10px rgba(227,191,124,.8)}
  .pill-coins.cx-bump{animation:cxBump .35s ease}
  @keyframes cxSpin{to{transform:rotate(360deg)}}
  @keyframes cxDrop{0%{opacity:0;transform:translateY(-140px) scale(.2) rotate(-30deg)}55%{opacity:1;transform:translateY(8px) scale(1.14) rotate(4deg)}75%{transform:translateY(-6px) scale(.97)}100%{opacity:1;transform:none}}
  @keyframes cxShine{0%{left:-60%;opacity:0}20%{opacity:1}100%{left:140%;opacity:0}}
  @keyframes cxRing{0%{opacity:.8;transform:rotate(45deg) scale(1)}100%{opacity:0;transform:rotate(45deg) scale(1.7)}}
  @keyframes cxUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes cxCard{0%{opacity:0;transform:translateY(34px) scale(.6) rotate(-6deg)}100%{opacity:1;transform:none}}
  @keyframes cxBump{0%,100%{transform:scale(1)}40%{transform:scale(1.22)}}
  @media(prefers-reduced-motion:reduce){.cx *,.cx{animation:none!important}.cx-medal,.cx-k,.cx-t,.cx-s,.cx-c,.cx-go{opacity:1!important}.cx-rays{display:none}}`;
  document.head.appendChild(css);
  const host = document.getElementById("view-lessons");
  function paint() {
    if (!host || !UI.state) return;
    const hero = host.querySelector(".lsn-hero");
    if (!hero) return;
    let strip = host.querySelector(".rw-strip");
    if (!strip) { strip = document.createElement("div"); strip.className = "rw-strip"; hero.after(strip); }
    const s = UI.state, claimed = s.rewardsClaimed || [];
    /* показываем две ближайшие ещё не полученные награды (из уроков и дебютов) */
    const prog = st => Math.min(have(s, st), st.n) / st.n;
    const html = STEPS.filter(st => !claimed.includes(st.id)).sort((a, b) => prog(b) - prog(a)).slice(0, 2).map(st => {
      const ok = claimed.includes(st.id), n = Math.min(have(s, st), st.n);
      return `<div class="rw-chip${ok ? " ok" : ""}"><span class="rw-ico">${SV(ICON[ok ? "check" : st.ic], 24)}</span><div><b>${isRu() ? st.ru : st.en}</b>
        <small class="rw-r">${rewardHtml(st)}</small><i><u style="width:${Math.round(n / st.n * 100)}%"></u></i></div></div>`;
    }).join("");
    if (strip.dataset.h !== html) { strip.innerHTML = html; strip.dataset.h = html; }
  }
  if (host) {
    let q; new MutationObserver(() => { clearTimeout(q); q = setTimeout(paint, 30); })
      .observe(host, { childList: true, subtree: true });
    paint();
  }
})();