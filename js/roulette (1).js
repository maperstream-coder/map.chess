/* maper.chess — РУЛЕТКА УДАЧИ v4.
   Что нового:
   • скин виден прямо на ленте: ещё до остановки понятно, какая доска или набор фигур выпадает;
   • мульти-прокрут ×1 / ×2 / ×3 / ×5 / ×10 (×2 и ×3 — несколько лент одновременно, ×5 и ×10 — турбо + карточки итогов);
   • 31 эксклюзивный скин с эффектами (дерево, мрамор, звёзды, туманность, призма, свечение фигур…);
   • новые призы: купон −50%, магнит монет, двойной билет, «Вилка», «Рокировка», «Превращение пешки»,
     королевская казна, набор гроссмейстера, эпические и легендарные скины;
   • коллекция скинов с кнопкой «Надеть» и бонусами за собранные скины.
   Подключать ПОСЛЕ navicons.js и ДО app.js. Вместе с ним нужен css/roulette.css. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);

  /* ======================= НАСТРОЙКИ ======================= */
  const CFG = {
    price: 100, pity: 10, spinMs: 4800, jokeCoins: 10, freezeFallback: 60, hist: 24,
    skinFallback: [0, 0, 200, 450, 900],        /* монеты вместо скина, если вся редкость уже собрана (индекс = редкость) */
    multis: [1, 2, 3, 5, 10],
    bulk: { 10: 0.9 },                          /* ×10 стоит −10% */
    cpnPct: 50, magPct: 50, magCharges: 3
  };
  const RARITY = [
    { id: "common",   color: "#9c9ca6" },
    { id: "uncommon", color: "#72d6a3" },
    { id: "rare",     color: "#e2b85a" },
    { id: "epic",     color: "#e3bf7c" },
    { id: "legend",   color: "#ff9ad5" }
  ];

  /* ======================= ТЕКСТЫ ======================= */
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "rl.tab": "Spin", "rl.title": "Lucky Wheel", "rl.sub": "Spin for coins, XP, hints, boosts and exclusive skins.",
    "rl.spin": "Spin · {n}", "rl.spinX": "Spin ×{x} · {n}", "rl.spinning": "Spinning…",
    "rl.freeSpin": "Free spin!", "rl.freeX": "Free ×{x}",
    "rl.notEnough": "Not enough coins — you need {n} more",
    "rl.pity": "{n} more spins to a guaranteed rare prize", "rl.pityNow": "Next spin is a guaranteed rare prize!",
    "rl.odds": "Odds", "rl.hist": "History", "rl.col": "Collection", "rl.histEmpty": "No spins yet — good luck!",
    "rl.noBoosts": "No active boosts", "rl.mult": "Spins at once", "rl.bulk": "−10%",
    "rl.bShield": "Star Shield", "rl.bDouble": "Double Loot", "rl.bLuck": "Lucky Clover", "rl.bLuck2": "Royal Clover",
    "rl.bFree": "Free Spin", "rl.bCpn": "Coupon −50%", "rl.bMag": "Magnet",
    "rl.banner.t": "Lucky Wheel", "rl.banner.s": "{n} coins a spin · up to ×10 · 31 skins", "rl.banner.go": "Spin",
    "rl.shop.t": "Lucky Wheel", "rl.shop.d": "Spin for {n} coins, up to ×10 at once. Win coins, XP, hints, free spins, boosts, mystery boxes and 31 skins you can't buy anywhere else.",
    "rl.shop.skins": "Exclusive skins: {a}/{b}", "rl.shop.btn": "Open the wheel",
    "rl.again": "Spin again", "rl.againX": "Spin again ×{x}", "rl.close": "Done", "rl.equip": "Equip now", "rl.equipped": "Equipped!",
    "rl.equipBtn": "Equip", "rl.on": "Equipped",
    "rl.fromBefore": "Prize from your last spin", "rl.sound": "Sound",
    "rl.fb.freeze": "Freezes are full — +{n} coins instead", "rl.fb.skin": "This rarity is fully collected — +{n} coins instead",
    "rl.shieldUsed": "🛡 Star Shield: this win counts as 3★",
    "rl.doubleUsed": "✨ Double Loot: +{c} coins, +{x} XP",
    "rl.magUsed": "🧲 Coin Magnet: +{c} coins, +{x} XP ({k} left)",
    "rl.rar.common": "Common", "rl.rar.uncommon": "Uncommon", "rl.rar.rare": "Rare", "rl.rar.epic": "EPIC", "rl.rar.legend": "LEGENDARY",
    "rl.summary": "Spin results", "rl.total": "Total",
    "rl.colNext": "Next bonus at {n} skins: {r}", "rl.colDone": "Collection complete — you are a legend!",
    "rl.ms": "🏆 Collection bonus · {n} skins: {r}",
    "rl.oddsNote": "You never get a skin you already own. A guaranteed rare prize drops every {n} spins.",
    "rl.skin.board": "board", "rl.skin.pieces": "piece set",
    "rl.skin.board.d": "Exclusive board — added to your collection", "rl.skin.pieces.d": "Exclusive piece set — added to your collection",
    "rl.p.meme.n": "Meme of Consolation", "rl.p.meme.d": "+{n} coins",
    "rl.p.c50.n": "Pocket Change", "rl.p.c50.d": "+50 coins",
    "rl.p.h1.n": "Hint", "rl.p.h1.d": "+1 hint",
    "rl.p.xp0.n": "Energy Drink", "rl.p.xp0.d": "+25 XP",
    "rl.p.c100.n": "Coin Pouch", "rl.p.c100.d": "+100 coins",
    "rl.p.h3.n": "Hint Pack", "rl.p.h3.d": "+3 hints",
    "rl.p.shd.n": "Star Shield", "rl.p.shd.d": "Your next game win gives 3★ even if you used hints",
    "rl.p.frz.n": "Streak Freeze", "rl.p.frz.d": "+1 freeze — saves your streak on a missed day",
    "rl.p.xp1.n": "Level-Up Potion", "rl.p.xp1.d": "+100 XP",
    "rl.p.free.n": "Golden Ticket", "rl.p.free.d": "Your next spin is free!",
    "rl.p.dbl.n": "Double Loot", "rl.p.dbl.d": "Your next first-time level or puzzle clear gives ×2 coins and XP",
    "rl.p.luck.n": "Lucky Clover", "rl.p.luck.d": "Your next spin can't be a common prize",
    "rl.p.cpn.n": "Half-Price Coupon", "rl.p.cpn.d": "Your next paid spin costs half",
    "rl.p.mag.n": "Coin Magnet", "rl.p.mag.d": "Your next 3 first-time clears give +50% coins and XP",
    "rl.p.skin.n": "Exclusive Skin", "rl.p.skin.d": "A board or piece set you can't buy anywhere",
    "rl.p.c250.n": "Treasure Chest", "rl.p.c250.d": "+250 coins",
    "rl.p.h5.n": "Hint Stash", "rl.p.h5.d": "+5 hints",
    "rl.p.box.n": "Mystery Box", "rl.p.box.d": "Surprise inside!",
    "rl.p.xp3.n": "XP Blast", "rl.p.xp3.d": "+300 XP — three levels at once!",
    "rl.p.free2.n": "Double Ticket", "rl.p.free2.d": "2 free spins!",
    "rl.p.fork.n": "Knight Fork", "rl.p.fork.d": "+150 coins and +2 hints — a double attack!",
    "rl.p.rok.n": "Castling", "rl.p.rok.d": "Star Shield and Double Loot at once",
    "rl.p.jack.n": "JACKPOT", "rl.p.jack.d": "+500 coins!",
    "rl.p.skinE.n": "Epic Skin", "rl.p.skinE.d": "An epic board or piece set",
    "rl.p.pawn.n": "Pawn Promotion", "rl.p.pawn.d": "Your next spin is a guaranteed Rare prize or better",
    "rl.p.treas.n": "Royal Treasury", "rl.p.treas.d": "+350 coins, +150 XP and +3 hints",
    "rl.p.mega.n": "MEGA JACKPOT", "rl.p.mega.d": "+1000 coins!!!",
    "rl.p.skinL.n": "Legendary Skin", "rl.p.skinL.d": "A legendary board or piece set",
    "rl.p.dcc.n": "Decoration · common", "rl.p.dcc.d": "A plain piece for your village — hedge, bench or hay.",
    "rl.p.dcu.n": "Decoration · uncommon", "rl.p.dcu.d": "A well, a cart, a tent or a pond.",
    "rl.p.dcr.n": "Decoration · rare", "rl.p.dcr.d": "Sakura, obelisk, gazebo, ballista, fountain…",
    "rl.p.dce.n": "Decoration · epic", "rl.p.dce.d": "Crystal, queen statue, golden tree, windmill.",
    "rl.p.dcl.n": "Decoration · legendary", "rl.p.dcl.d": "A stone dragon or a throne for your village.",
    "rl.p.gm.n": "Grandmaster Pack", "rl.p.gm.d": "+600 coins, 3 free spins and a Star Shield",
    "shop.board-bubblegum": "Bubblegum", "shop.board-toxic": "Toxic Waste", "shop.board-sunset": "Sunset Strip",
    "shop.board-matrix": "Matrix", "shop.board-lava": "Lava Lamp", "shop.board-neon": "Neon Night",
    "shop.board-ice": "Frostbite", "shop.board-sakura": "Sakura",
    "shop.board-wood": "Mahogany", "shop.board-ocean": "Deep Ocean", "shop.board-marble": "Marble Hall",
    "shop.board-goldrush": "Gold Rush", "shop.board-midnight": "Midnight Sky", "shop.board-nebula": "Nebula",
    "shop.board-royal": "Royal Purple", "shop.board-prism": "Prism", "shop.board-eclipse": "Eclipse",
    "shop.pieces-bubble": "Bubble Pop", "shop.pieces-matrix": "Green Code", "shop.pieces-lava": "Magma",
    "shop.pieces-ice": "Glacier", "shop.pieces-neon": "Synthwave", "shop.pieces-sakura": "Blossom",
    "shop.pieces-ebony": "Ebony & Ivory", "shop.pieces-midas": "Midas", "shop.pieces-jade": "Jade",
    "shop.pieces-gems": "Ruby vs Sapphire", "shop.pieces-obsidian": "Obsidian", "shop.pieces-solar": "Sun & Moon",
    "shop.pieces-phantom": "Phantoms", "shop.pieces-dragon": "Dragonfire"
  }, {
    "rl.tab": "Рулетка", "rl.title": "Рулетка удачи", "rl.sub": "Крути ленту — монеты, опыт, подсказки, бусты и эксклюзивные скины.",
    "rl.spin": "Крутить · {n}", "rl.spinX": "Крутить ×{x} · {n}", "rl.spinning": "Крутится…",
    "rl.freeSpin": "Бесплатный прокрут!", "rl.freeX": "Бесплатно ×{x}",
    "rl.notEnough": "Не хватает монет — нужно ещё {n}",
    "rl.pity": "Ещё {n} прокр. до гарантированного редкого приза", "rl.pityNow": "Следующий прокрут — гарантированно редкий приз!",
    "rl.odds": "Шансы", "rl.hist": "История", "rl.col": "Коллекция", "rl.histEmpty": "Прокрутов пока не было — удачи!",
    "rl.noBoosts": "Активных бустов нет", "rl.mult": "Прокрутов за раз", "rl.bulk": "−10%",
    "rl.bShield": "Щит звёзд", "rl.bDouble": "Двойная добыча", "rl.bLuck": "Клевер удачи", "rl.bLuck2": "Королевский клевер",
    "rl.bFree": "Бесплатный прокрут", "rl.bCpn": "Купон −50%", "rl.bMag": "Магнит",
    "rl.banner.t": "Рулетка удачи", "rl.banner.s": "{n} монет за прокрут · до ×10 · 31 скин", "rl.banner.go": "Крутить",
    "rl.shop.t": "Рулетка удачи", "rl.shop.d": "Прокрут — {n} монет, можно сразу до ×10. Выигрывай монеты, опыт, подсказки, бесплатные прокруты, бусты, таинственные ящики и 31 скин, которых нет в магазине.",
    "rl.shop.skins": "Эксклюзивные скины: {a}/{b}", "rl.shop.btn": "Открыть рулетку",
    "rl.again": "Ещё раз", "rl.againX": "Ещё ×{x}", "rl.close": "Готово", "rl.equip": "Надеть сразу", "rl.equipped": "Надето!",
    "rl.equipBtn": "Надеть", "rl.on": "Надето",
    "rl.fromBefore": "Приз с прошлого прокрута", "rl.sound": "Звук",
    "rl.fb.freeze": "Заморозки заполнены — вместо них +{n} монет", "rl.fb.skin": "Скины этой редкости собраны — вместо них +{n} монет",
    "rl.shieldUsed": "🛡 Щит звёзд: победа засчитана на 3★",
    "rl.doubleUsed": "✨ Двойная добыча: +{c} монет, +{x} XP",
    "rl.magUsed": "🧲 Магнит монет: +{c} монет, +{x} XP (осталось {k})",
    "rl.rar.common": "Обычный", "rl.rar.uncommon": "Необычный", "rl.rar.rare": "Редкий", "rl.rar.epic": "ЭПИЧЕСКИЙ", "rl.rar.legend": "ЛЕГЕНДАРНЫЙ",
    "rl.summary": "Итоги прокрута", "rl.total": "Всего",
    "rl.colNext": "Следующий бонус при {n} скинах: {r}", "rl.colDone": "Коллекция собрана — вы легенда!",
    "rl.ms": "🏆 Бонус коллекции · {n} скинов: {r}",
    "rl.oddsNote": "Скин, который у вас уже есть, не выпадает повторно. Гарантированный редкий приз — каждые {n} прокрутов.",
    "rl.skin.board": "доска", "rl.skin.pieces": "набор фигур",
    "rl.skin.board.d": "Эксклюзивная доска — добавлена в вашу коллекцию", "rl.skin.pieces.d": "Эксклюзивный набор фигур — добавлен в вашу коллекцию",
    "rl.p.meme.n": "Мем-утешение", "rl.p.meme.d": "+{n} монет",
    "rl.p.c50.n": "Горсть монет", "rl.p.c50.d": "+50 монет",
    "rl.p.h1.n": "Подсказка", "rl.p.h1.d": "+1 подсказка",
    "rl.p.xp0.n": "Энергетик", "rl.p.xp0.d": "+25 опыта",
    "rl.p.c100.n": "Мешочек монет", "rl.p.c100.d": "+100 монет",
    "rl.p.h3.n": "Пачка подсказок", "rl.p.h3.d": "+3 подсказки",
    "rl.p.shd.n": "Щит звёзд", "rl.p.shd.d": "Следующая победа в партии даст 3★, даже если вы брали подсказки",
    "rl.p.frz.n": "Заморозка огонька", "rl.p.frz.d": "+1 заморозка — спасёт серию в пропущенный день",
    "rl.p.xp1.n": "Зелье уровня", "rl.p.xp1.d": "+100 опыта",
    "rl.p.free.n": "Золотой билет", "rl.p.free.d": "Следующий прокрут бесплатный!",
    "rl.p.dbl.n": "Двойная добыча", "rl.p.dbl.d": "Следующее первое прохождение уровня или задачи даст ×2 монет и XP",
    "rl.p.luck.n": "Клевер удачи", "rl.p.luck.d": "Следующий прокрут не выдаст обычный приз",
    "rl.p.cpn.n": "Купон −50%", "rl.p.cpn.d": "Следующий платный прокрут стоит вдвое дешевле",
    "rl.p.mag.n": "Магнит монет", "rl.p.mag.d": "Следующие 3 первых прохождения дадут +50% монет и опыта",
    "rl.p.skin.n": "Эксклюзивный скин", "rl.p.skin.d": "Доска или набор фигур, которых нет в магазине",
    "rl.p.c250.n": "Сундук сокровищ", "rl.p.c250.d": "+250 монет",
    "rl.p.h5.n": "Склад подсказок", "rl.p.h5.d": "+5 подсказок",
    "rl.p.box.n": "Таинственный ящик", "rl.p.box.d": "Сюрприз внутри!",
    "rl.p.xp3.n": "Взрыв опыта", "rl.p.xp3.d": "+300 опыта — сразу три уровня!",
    "rl.p.free2.n": "Двойной билет", "rl.p.free2.d": "2 бесплатных прокрута!",
    "rl.p.fork.n": "Вилка конём", "rl.p.fork.d": "+150 монет и +2 подсказки — двойной удар!",
    "rl.p.rok.n": "Рокировка", "rl.p.rok.d": "Щит звёзд и Двойная добыча сразу",
    "rl.p.jack.n": "ДЖЕКПОТ", "rl.p.jack.d": "+500 монет!",
    "rl.p.skinE.n": "Эпический скин", "rl.p.skinE.d": "Эпическая доска или набор фигур",
    "rl.p.pawn.n": "Превращение пешки", "rl.p.pawn.d": "Следующий прокрут — гарантированно редкий приз или лучше",
    "rl.p.treas.n": "Королевская казна", "rl.p.treas.d": "+350 монет, +150 опыта и +3 подсказки",
    "rl.p.mega.n": "МЕГА-ДЖЕКПОТ", "rl.p.mega.d": "+1000 монет!!!",
    "rl.p.skinL.n": "Легендарный скин", "rl.p.skinL.d": "Легендарная доска или набор фигур",
    "rl.p.dcc.n": "Декор · обычный", "rl.p.dcc.d": "Простая вещица для деревни: изгородь, скамья, сено.",
    "rl.p.dcu.n": "Декор · необычный", "rl.p.dcu.d": "Колодец, телега, шатёр или пруд.",
    "rl.p.dcr.n": "Декор · редкий", "rl.p.dcr.d": "Сакура, обелиск, беседка, баллиста, фонтан…",
    "rl.p.dce.n": "Декор · эпический", "rl.p.dce.d": "Кристалл, статуя ферзя, золотое дерево, мельница.",
    "rl.p.dcl.n": "Декор · легендарный", "rl.p.dcl.d": "Каменный дракон или трон для вашей деревни.",
    "rl.p.gm.n": "Набор гроссмейстера", "rl.p.gm.d": "+600 монет, 3 бесплатных прокрута и Щит звёзд",
    "shop.board-bubblegum": "Жвачка", "shop.board-toxic": "Токсик", "shop.board-sunset": "Закат",
    "shop.board-matrix": "Матрица", "shop.board-lava": "Лава-лампа", "shop.board-neon": "Неоновая ночь",
    "shop.board-ice": "Стужа", "shop.board-sakura": "Сакура",
    "shop.board-wood": "Красное дерево", "shop.board-ocean": "Глубина", "shop.board-marble": "Мраморный зал",
    "shop.board-goldrush": "Золотая лихорадка", "shop.board-midnight": "Звёздная полночь", "shop.board-nebula": "Туманность",
    "shop.board-royal": "Королевский пурпур", "shop.board-prism": "Призма", "shop.board-eclipse": "Затмение",
    "shop.pieces-bubble": "Пузырьки", "shop.pieces-matrix": "Зелёный код", "shop.pieces-lava": "Магма",
    "shop.pieces-ice": "Ледник", "shop.pieces-neon": "Синтвейв", "shop.pieces-sakura": "Цветение",
    "shop.pieces-ebony": "Эбен и слоновая кость", "shop.pieces-midas": "Мидас", "shop.pieces-jade": "Нефрит",
    "shop.pieces-gems": "Рубин и сапфир", "shop.pieces-obsidian": "Обсидиан", "shop.pieces-solar": "Солнце и Луна",
    "shop.pieces-phantom": "Призраки", "shop.pieces-dragon": "Драконье пламя"
  });

  const lang = () => (typeof getLang === "function" && getLang() === "ru") ? "ru" : "en";
  /* склонение: en [one, many], ru [one, few, many] */
  function pl(n, w) {
    if (lang() === "ru") {
      const a = w.ru, m10 = n % 10, m100 = n % 100;
      return m10 === 1 && m100 !== 11 ? a[0] : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? a[1] : a[2];
    }
    return n === 1 ? w.en[0] : w.en[1];
  }
  const PLW = {
    coins: { en: ["coin", "coins"], ru: ["монета", "монеты", "монет"] },
    hints: { en: ["hint", "hints"], ru: ["подсказка", "подсказки", "подсказок"] },
    free: { en: ["free spin", "free spins"], ru: ["бесплатный прокрут", "бесплатных прокрута", "бесплатных прокрутов"] }
  };
  function giveText(g) {
    const a = [];
    if (g.coins) a.push(`${g.coins} ${pl(g.coins, PLW.coins)}`);
    if (g.hints) a.push(`${g.hints} ${pl(g.hints, PLW.hints)}`);
    if (g.free) a.push(`${g.free} ${pl(g.free, PLW.free)}`);
    return a.join(", ");
  }

  /* мем-утешения для пустых секторов (в обоих языках одинаковое количество) */
  const JOKES = {
    en: ["The knight moves in an L, you moved in an... also L. Take 10 coins.",
      "That pawn also thought it would promote. Don't give up!",
      "It's not a loss, it's opening preparation.",
      "Hung your queen? At least you didn't hang the coins.",
      "Chess player: \"It was a deliberate sacrifice.\"",
      "A meme was supposed to be here, but the bishop ate it.",
      "The king is always safe. Your wallet, not so much.",
      "Stockfish says this spin was −0.3. Humanity says +10 coins.",
      "Even Magnus loses sometimes. Not to a wheel, but still.",
      "Zugzwang: any spin is bad. Take 10 coins.",
      "En passant, your luck passed by. Take coins.",
      "This sector was sponsored by a blundered rook.",
      "Your luck is in time trouble. Have 10 coins for the increment.",
      "Not a blunder — a creative pawn sacrifice.",
      "The wheel offers a draw. You accept 10 coins."],
    ru: ["Конь ходит буквой Г, а ты — мимо джекпота. Держи 10 монет.",
      "Пешка тоже думала, что дойдёт до ферзя. Не сдавайся!",
      "Это не проигрыш, это дебютная подготовка.",
      "Зевнул ферзя? Зато монеты не зевнул — держи.",
      "Шахматист: «Это была сознательная жертва».",
      "Тут должен быть мем, но его съел слон.",
      "Король всегда в безопасности. А вот кошелёк — не очень.",
      "Stockfish оценил этот прокрут в −0.3. Человечество — в +10 монет.",
      "Даже Карлсен иногда проигрывает. Правда, не колесу, но всё же.",
      "Цугцванг: любой прокрут плох. Держи 10 монет.",
      "Взятие на проходе: удача прошла мимо. Держи монеты.",
      "Этот сектор спонсирует зевнутая ладья.",
      "У удачи цейтнот. Держи 10 монет за добавление времени.",
      "Не зевок, а творческая жертва пешки.",
      "Колесо предлагает ничью. Ты берёшь 10 монет."]
  };

  /* линейные иконки (24×24, как в меню сайта) */
  const ICONS = {
    tree: "M12 3.5l5 7h-3l4 6H6l4-6H7z|M12 16.5v4",
    face: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z|M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2|M9 10h.01|M15 10h.01",
    coin: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z|M12 7v10|M14.6 9.6c-.5-.8-1.4-1.2-2.6-1.2-1.4 0-2.4.7-2.4 1.8 0 2.4 5 1.1 5 3.6 0 1.1-1.1 1.9-2.6 1.9-1.2 0-2.1-.4-2.6-1.3",
    stack: "M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z|M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7|M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5",
    chest: "M4 11h16v8.5H4z|M4 11V9a8 4.5 0 0 1 16 0v2|M12 14v2.5",
    shield: "M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3z|M8.8 12l2.2 2.2 4.2-4.4",
    palette: "M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.5-1.3-1.6-1.3-3 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.7 16.8 3.5 12 3.5z|M7.5 11h.01|M10 7.5h.01|M14.5 7.5h.01",
    bulb: "M9 18h6|M10 21h4|M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
    flame: "M12 21a6 6 0 0 0 6-6c0-3.5-3-5-4-9-2 1.5-3 3.5-3 5.5-1-.5-1.7-1.5-1.8-2.8C7.2 10 6 12.5 6 15a6 6 0 0 0 6 6z",
    snow: "M12 3v18|M4.2 7.5l15.6 9|M4.2 16.5l15.6-9|M9.5 4.5L12 7l2.5-2.5|M9.5 19.5L12 17l2.5 2.5",
    flask: "M9.5 3h5|M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3|M7.5 15h9",
    gem: "M6 4h12l3 5-9 11L3 9l3-5z|M3 9h18|M9.5 4L8 9l4 11 4-11-1.5-5",
    ticket: "M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4V7z|M14 7.5v1.5|M14 11.3v1.4|M14 15v1.5",
    gift: "M4 10h16v10H4z|M3 7h18v3H3z|M12 7v13|M12 7c-1-3-5-3.5-5-1.5S10 7 12 7z|M12 7c1-3 5-3.5 5-1.5S14 7 12 7z",
    sparkles: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z|M18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z",
    clover: "M12 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z|M12 13.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z|M4.5 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0z|M13.5 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0z",
    bolt: "M13 2.5L5 13.5h6l-1 8 8-11h-6l1-8z",
    crown: "M3.5 8l4.5 4 4-6.5 4 6.5 4.5-4-1.5 10h-14L3.5 8z|M6 21h12",
    sound: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z|M15.5 9a4 4 0 0 1 0 6|M18 6.5a7.5 7.5 0 0 1 0 11",
    mute: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z|M16 9.5l5 5|M21 9.5l-5 5",
    coupon: "M3.5 12L12 3.5h8.5V12L12 20.5 3.5 12z|M9.2 14.8l5.6-5.6|M9.6 9.6h.01|M14.4 14.4h.01",
    magnet: "M5 3.5h4.5v8.5a2.5 2.5 0 0 0 5 0V3.5H19v8.5a7 7 0 0 1-14 0V3.5z|M5 8h4.5|M14.5 8H19",
    rook: "M7 20.5h10|M8 20.5V11|M16 20.5V11|M6 11h12|M6.5 11V5.5H9v2h2v-2h2v2h2v-2h2.5V11",
    pawn: "M12 4a2.8 2.8 0 1 1 0 5.6A2.8 2.8 0 0 1 12 4z|M9.5 9.6h5|M10.2 9.6C10 12 9 13.5 7.5 17h9c-1.5-3.5-2.5-5-2.7-7.4|M6 20.5h12|M7 17v3.5",
    fork: "M6 3.5v5a6 6 0 0 0 12 0v-5|M12 3.5v7|M12 14.5V21|M9 21h6",
    trophy: "M8 4h8v5a4 4 0 0 1-8 0z|M8 6H5v1.5A3 3 0 0 0 8 10.5|M16 6h3v1.5a3 3 0 0 1-3 3|M12 13v4|M8.5 20h7|M10 17h4",
    vault: "M4 5h16v14H4z|M7 19v1.5|M17 19v1.5|M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z|M12 9.5V8|M12 16v-1.5",
    star: "M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z",
    lock: "M6.5 11h11v9h-11z|M8.5 11V8a3.5 3.5 0 0 1 7 0v3"
  };
  const svg = (k, s, c) => `<svg class="rl-i" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c || "currentColor"}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICONS[k] || "").split("|").map(d => `<path d="${d}"/>`).join("")}</svg>`;

  /* ======================= ПРИЗЫ =======================
     w — вес в % (сумма = 100). rar: 0 обычный, 1 необычный, 2 редкий, 3 эпик, 4 легенда.
     give — что выдаётся; skin: N — выдать скин редкости N; box — ящик (внутри случайный приз из BOX_POOL). */
  const P = [
    /* обычные — 34% */
    { id: "meme", ic: "face",    lbl: "+10",    w: 8,  rar: 0, give: { coins: CFG.jokeCoins }, joke: true, c: ["#3a3f52", "#8fa0c8"] },
    { id: "c50",  ic: "coin",    lbl: "+50",    w: 9,   rar: 0, give: { coins: 50 },  c: ["#7a5212", "#e8a93a"] },
    { id: "h1",   ic: "bulb",    lbl: "+1",     w: 6,   rar: 0, give: { hints: 1 },   c: ["#6b6112", "#f0dc3b"] },
    { id: "dcc",  ic: "tree",    lbl: "DECOR",  w: 6,   rar: 0, decor: 0,          c: ["#2f4a2a", "#8fc27a"] },
    { id: "xp0",  ic: "star",    lbl: "+25",    w: 5,   rar: 0, give: { xp: 25 },     c: ["#5a3a12", "#f2a14b"] },
    /* необычные — 38% */
    { id: "c100", ic: "stack",   lbl: "+100",   w: 5,   rar: 1, give: { coins: 100 }, c: ["#8a5a10", "#f0b038"] },
    { id: "h3",   ic: "bulb",    lbl: "+3",     w: 4,   rar: 1, give: { hints: 3 },   c: ["#5c6b12", "#cfe83b"] },
    { id: "shd",  ic: "shield",  lbl: "3★",     w: 4,   rar: 1, give: { shield: 1 },  c: ["#17407a", "#4a9bff"] },
    { id: "frz",  ic: "snow",    lbl: "+1",     w: 4,   rar: 1, give: { freeze: 1 },  c: ["#0f5566", "#55dcf5"] },
    { id: "xp1",  ic: "flask",   lbl: "+100",   w: 4,   rar: 1, give: { xp: 100 },    c: ["#7a3412", "#ff8a4a"] },
    { id: "free", ic: "ticket",  lbl: "FREE",   w: 3,   rar: 1, give: { free: 1 },    c: ["#0e5e4f", "#3fe0b8"] },
    { id: "dcu",  ic: "tree",    lbl: "DECOR",  w: 4,   rar: 1, decor: 1,          c: ["#2f5a3a", "#72d6a3"] },
    { id: "dbl",  ic: "sparkles", lbl: "×2",    w: 3,   rar: 1, give: { dbl: 1 },     c: ["#7a1f55", "#ff68b8"] },
    { id: "luck", ic: "clover",  lbl: "LUCK",   w: 3,   rar: 1, give: { luck: 1 },    c: ["#1a6b2a", "#55e878"] },
    { id: "cpn",  ic: "coupon",  lbl: "−50%",   w: 2,   rar: 1, give: { cpn: 1 },     c: ["#7a2a2a", "#ff7a6a"] },
    { id: "mag",  ic: "magnet",  lbl: "+50%",   w: 2,   rar: 1, give: { mag: CFG.magCharges }, c: ["#5a1f1f", "#ff5a5a"] },
    /* редкие — 20% */
    { id: "skin", ic: "palette", lbl: "SKIN",   w: 5,   rar: 2, skin: 2,            c: ["#6b1d6e", "#e75ad8"] },
    { id: "c250", ic: "chest",   lbl: "+250",   w: 3,   rar: 2, give: { coins: 250 }, c: ["#7a4a0a", "#ffae38"] },
    { id: "h5",   ic: "flame",   lbl: "+5",     w: 2,   rar: 2, give: { hints: 5 },   c: ["#3a5f12", "#92f040"] },
    { id: "box",  ic: "gift",    lbl: "BOX",    w: 3,   rar: 2, box: true,           c: ["#43237a", "#a56bff"] },
    { id: "dcr",  ic: "tree",    lbl: "DECOR",  w: 3,   rar: 2, decor: 2,          c: ["#4a3a7a", "#a99dff"] },
    { id: "xp3",  ic: "bolt",    lbl: "+300",   w: 1,   rar: 2, give: { xp: 300 },    c: ["#7a2412", "#ff6a45"] },
    { id: "free2", ic: "ticket", lbl: "FREE×2", w: 1,   rar: 2, give: { free: 2 },    c: ["#0e5e55", "#2ff0d0"] },
    { id: "fork", ic: "fork",    lbl: "FORK",   w: 1,   rar: 2, give: { coins: 150, hints: 2 }, c: ["#5a3a7a", "#c88aff"] },
    { id: "rok",  ic: "rook",    lbl: "SET",    w: 1,   rar: 2, give: { shield: 1, dbl: 1 },  c: ["#1f4a7a", "#6ab8ff"] },
    /* эпические — 6% */
    { id: "jack", ic: "gem",     lbl: "+500",   w: 2,   rar: 3, give: { coins: 500 }, c: ["#7a5a0a", "#ffd84d"] },
    { id: "skinE", ic: "palette", lbl: "EPIC",  w: 1.5, rar: 3, skin: 3,            c: ["#7a4a0a", "#ffc24d"] },
    { id: "dce",  ic: "tree",    lbl: "DECOR",  w: 1.5, rar: 3, decor: 3, hot: 1,   c: ["#7a5a1a", "#e3bf7c"] },
    { id: "pawn", ic: "pawn",    lbl: "PROMO",  w: 0.5,  rar: 3, give: { luck: 2 },    c: ["#2a5a2a", "#7aff8a"] },
    { id: "treas", ic: "vault",  lbl: "VAULT",  w: 0.5,  rar: 3, give: { coins: 350, xp: 150, hints: 3 }, c: ["#6a4a10", "#ffc860"] },
    /* легендарные — 2% */
    { id: "mega", ic: "crown",   lbl: "+1000",  w: 0.7, rar: 4, give: { coins: 1000 }, rainbow: true, c: ["#8a0f3a", "#ff4d8a"] },
    { id: "dcl",  ic: "tree",    lbl: "DECOR",  w: 0.4, rar: 4, decor: 4, rainbow: true, c: ["#6a1a5a", "#ff9ad5"] },
    { id: "skinL", ic: "palette", lbl: "LEGEND", w: 0.5, rar: 4, skin: 4, rainbow: true, c: ["#6a1a7a", "#ff7ae0"] },
    { id: "gm",   ic: "trophy",  lbl: "GM",     w: 0.4, rar: 4, give: { coins: 600, free: 3, shield: 1 }, rainbow: true, c: ["#7a5a0a", "#ffe066"] }
  ];
  const P_BY_ID = {}; P.forEach(p => { P_BY_ID[p.id] = p; });
  const BOX_POOL = ["dcc", "dcu", "c50", "c100", "c250", "h3", "h5", "frz", "shd", "dbl", "luck", "xp1", "free", "skin", "cpn", "mag", "fork"];

  /* ======================= ЭКСКЛЮЗИВНЫЕ СКИНЫ (в магазине не продаются) =======================
     rar: 2 редкий, 3 эпик, 4 легенда.  fx — эффект доски (см. roulette.css), hl — подсветка последнего хода,
     glow — свечение фигур. ID старых скинов не менялись — выбитое раньше остаётся у игроков. */
  const SKINS = [];
  const board = (id, rar, l, d, a, o) => SKINS.push(Object.assign({
    id: "board-" + id, type: "board", nameKey: "shop.board-" + id, price: 0, rar,
    vars: { "--sq-light": l, "--sq-dark": d, "--sq-active": a }
  }, o || {}));
  const pcs = (id, rar, wF, wS, bF, bS, bD, o) => SKINS.push(Object.assign({
    id: "pieces-" + id, type: "pieces", nameKey: "shop.pieces-" + id, price: 0, rar,
    vars: { "--pc-white": wF, "--pc-black": bF }, pal: { wF, wS, bF, bS, bD }
  }, o || {}));

  /* доски: редкие */
  board("bubblegum", 2, "#c78bbd", "#5d3b73", "#ffd6f0");
  board("sunset",    2, "#bf7a62", "#4c2b49", "#ffc58a", { hl: "rgba(255,197,138,.26)" });
  board("ice",       2, "#a9d6ee", "#4a7ea8", "#e6fbff");
  board("sakura",    2, "#e8b4c8", "#8a4a6b", "#fff0f6");
  board("wood",      2, "#b98b5e", "#6e4527", "#ffe3a8", { fx: "wood", hl: "rgba(255,226,140,.28)" });
  board("toxic",     2, "#78974a", "#2d2248", "#d4ff4a", { hl: "rgba(212,255,74,.22)" });
  board("matrix",    2, "#2f5d3c", "#0e1c14", "#4dff88", { fx: "grid", hl: "rgba(77,255,136,.24)" });
  board("neon",      2, "#4a3bb5", "#150f3d", "#00f0ff", { fx: "neon", hl: "rgba(0,240,255,.22)" });
  board("lava",      2, "#8f4d3b", "#2b1311", "#ff7a45", { fx: "lava", hl: "rgba(255,122,69,.28)" });
  board("ocean",     2, "#5aa6b8", "#1c4a63", "#a8f0ff", { fx: "ocean", hl: "rgba(168,240,255,.25)" });
  board("marble",    2, "#c9c6d2", "#6f6c7a", "#7fb8ff", { fx: "marble" });
  /* доски: эпические */
  board("goldrush",  3, "#d9b45a", "#5a3f12", "#fff1b0", { fx: "gold", hl: "rgba(255,230,140,.32)" });
  board("midnight",  3, "#2f3a6b", "#0c1128", "#8fb4ff", { fx: "stars", hl: "rgba(143,180,255,.25)" });
  board("nebula",    3, "#6a3f9e", "#1b1042", "#ff8ae6", { fx: "nebula", hl: "rgba(255,138,230,.26)" });
  board("royal",     3, "#7a4a9e", "#2a1745", "#ffd98a", { fx: "royal", hl: "rgba(255,217,138,.3)" });
  /* доски: легендарные */
  board("prism",     4, "#8a8fc9", "#3a3f7a", "#ffffff", { fx: "prism", hl: "rgba(255,255,255,.28)" });
  board("eclipse",   4, "#3a3340", "#0d0a12", "#ffc65a", { fx: "eclipse", hl: "rgba(255,198,90,.3)" });

  /* фигуры: редкие */
  pcs("bubble",  2, "#ffd0ec", "#8a1f6a", "#7b2a8c", "#3c0f47", "#7ff0ff");
  pcs("sakura",  2, "#ffe0ec", "#9a3a62", "#6b2a4a", "#2a0f1e", "#ffb0d0");
  pcs("ice",     2, "#e4f7ff", "#2a6a8f", "#2d5f86", "#0d2a40", "#8fe8ff", { glow: "#8fe8ff" });
  pcs("ebony",   2, "#f1dfbf", "#5a3b1e", "#4a2f1d", "#1e120a", "#e0b878");
  pcs("matrix",  2, "#b6ffd0", "#0b3a1c", "#12301d", "#06150c", "#4dff88", { glow: "#4dff88" });
  pcs("lava",    2, "#ffd9a0", "#6b2a1a", "#3b1a4d", "#190a24", "#ff9a5c", { glow: "#ff7a45" });
  pcs("neon",    2, "#9dfcff", "#0a5560", "#3b1070", "#14052b", "#ff4df0", { glow: "#4df0ff" });
  pcs("jade",    2, "#d4f5e0", "#1f6b4a", "#1e5a44", "#082a1f", "#6ff0b4", { glow: "#4dffb0" });
  pcs("gems",    2, "#ff9aa8", "#7a1228", "#3a5fd0", "#0f1f5a", "#9ad0ff");
  /* фигуры: эпические */
  pcs("midas",   3, "#ffe08a", "#7a5410", "#3a2a10", "#150e04", "#ffd24a", { glow: "#ffd24a" });
  pcs("obsidian", 3, "#e8e4ff", "#3a2a6b", "#14101f", "#050309", "#b06cff", { glow: "#b06cff" });
  pcs("solar",   3, "#ffc94d", "#7a3a00", "#aab8d8", "#1c2a4a", "#ffffff", { glow: "#ffd36b" });
  /* фигуры: легендарные */
  pcs("phantom", 4, "#f4fbff", "#4fd8ff", "#1a1030", "#c58bff", "#7ff0ff", { glow: "#7ff0ff" });
  pcs("dragon",  4, "#ffdc9a", "#8a2a00", "#5a0f1a", "#1a0508", "#ffb02e", { glow: "#ff7a2e" });

  SKINS.forEach(i => { if (!SHOP_ITEMS.some(x => x.id === i.id)) SHOP_ITEMS.push(i); });
  const SKIN_IDS = SKINS.map(s => s.id);
  const SKIN_BY_ID = {}; SKINS.forEach(s => { SKIN_BY_ID[s.id] = s; });
  const owns = (s, k) => s.owned.includes(k.id);
  const countSkins = s => SKINS.filter(k => owns(s, k)).length;

  /* бонусы за собранные скины */
  const MS = [
    { n: 3, coins: 60 }, { n: 6, coins: 100, free: 1 }, { n: 10, coins: 200, hints: 3 }, { n: 15, coins: 300, free: 2 },
    { n: 20, coins: 500, free: 2 }, { n: 26, coins: 800, hints: 5 }, { n: SKINS.length, coins: 2000, free: 5 }
  ];

  /* ---------- перекраска SVG-фигур: берём классический набор и подменяем цвета за один проход ---------- */
  const CLASSIC = { "#f6f6f9": "wF", "#15151c": "wS", "#3f3f4a": "bF", "#101017": "bS", "#e9e9f4": "bD" };
  const _ps = window.pieceSvg;
  function skinSvg(id, color, type) {
    const sk = SKIN_BY_ID[id];
    if (!sk || !sk.pal || !_ps) return null;
    const st = UI.state, prev = st.equipped.pieces;
    st.equipped.pieces = "pieces-classic";
    try { return _ps(color, type).replace(/#(?:f6f6f9|15151c|3f3f4a|101017|e9e9f4)/gi, m => sk.pal[CLASSIC[m.toLowerCase()]]); }
    finally { st.equipped.pieces = prev; }
  }
  window.pieceSvg = function (color, type) {
    const id = UI.state && UI.state.equipped && UI.state.equipped.pieces;
    if (id && SKIN_BY_ID[id] && SKIN_BY_ID[id].pal) {
      const s = skinSvg(id, color, type);
      if (s) return s;
    }
    return _ps ? _ps.apply(this, arguments) : "";
  };

  /* ---------- эффекты досок и свечение фигур (атрибуты на <html>, стили — в roulette.css) ---------- */
  function applyFx() {
    const st = UI.state; if (!st || !st.equipped) return;
    const root = document.documentElement, b = SKIN_BY_ID[st.equipped.board], p = SKIN_BY_ID[st.equipped.pieces];
    if (b && b.fx) root.setAttribute("data-rl-board", b.fx); else root.removeAttribute("data-rl-board");
    if (b && b.hl) root.style.setProperty("--last-hl", b.hl); else root.style.removeProperty("--last-hl");
    if (p && p.glow) { root.setAttribute("data-rl-pc", "1"); root.style.setProperty("--pc-glow", p.glow); }
    else { root.removeAttribute("data-rl-pc"); root.style.removeProperty("--pc-glow"); }
  }
  const _at = UI._applyTheme;
  UI._applyTheme = function () { const r = _at.apply(this, arguments); applyFx(); return r; };

  /* в магазине скины видны только тем, кто их выбил */
  const _rs = UI.renderShop;
  UI.renderShop = function (type) {
    const tab = type || (document.querySelector(".shop-tab.active") || {}).dataset?.type;
    if (tab === "roulette") { this.renderTopbar(); renderShopTab(); return; }
    const hide = SKINS.filter(i => !this.state.owned.includes(i.id));
    hide.forEach(i => { const k = SHOP_ITEMS.indexOf(i); if (k > -1) SHOP_ITEMS.splice(k, 1); });
    try { _rs.apply(this, arguments); } finally { hide.forEach(i => SHOP_ITEMS.push(i)); }
    document.querySelectorAll("#shop-grid .shop-card").forEach(card => {
      const nm = card.querySelector(".shop-name"), sw = card.querySelector(".pc-swatch");
      if (!nm || !sw) return;
      SKINS.filter(s => s.pal).forEach(sk => {
        if (nm.textContent === t(sk.nameKey)) {
          sw.innerHTML = skinSvg(sk.id, "w", "n") + skinSvg(sk.id, "b", "n");
          sw.style.background = "linear-gradient(135deg, #5d6584, #2c3149)";
        }
      });
    });
  };

  /* ======================= СОСТОЯНИЕ ======================= */
  function RS(s) {
    const r = s.roulette && typeof s.roulette === "object" ? s.roulette : (s.roulette = {});
    r.spins = +r.spins || 0; r.pity = +r.pity || 0; r.luck = +r.luck || 0;
    r.shield = +r.shield || 0; r.free = +r.free || 0; r.dbl = +r.dbl || 0; r.mute = !!r.mute;
    r.cpn = +r.cpn || 0; r.mag = +r.mag || 0;
    r.mult = CFG.multis.includes(+r.mult) ? +r.mult : 1;
    r.hist = Array.isArray(r.hist) ? r.hist : [];
    r.ms = Array.isArray(r.ms) ? r.ms : [];
    if (!r.pending || typeof r.pending !== "object") r.pending = null;
    return r;
  }
  /* приз, который не успели показать: старый формат (один объект) или новый { res: [...], ms: [...] } */
  function pendingOf(r) {
    const p = r.pending; if (!p) return null;
    if (Array.isArray(p.res)) return { res: p.res.filter(x => x && P_BY_ID[x.id]), ms: p.ms || [] };
    return P_BY_ID[p.id] ? { res: [p], ms: [] } : null;
  }
  const rnd = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } };
  const rint = n => Math.floor(rnd() * n);
  const pname = id => t(`rl.p.${id}.n`);

  function pickWeighted(pool) {
    const sum = pool.reduce((a, p) => a + p.w, 0);
    let x = rnd() * sum;
    for (const p of pool) { x -= p.w; if (x < 0) return p; }
    return pool[pool.length - 1];
  }

  /* выбор приза: гарантия редкого каждые CFG.pity прокрутов; «клевер» убирает обычные, «королевский клевер» — всё ниже редкого */
  function roll(r, luckLvl) {
    const min = Math.max(r.pity >= CFG.pity - 1 ? 2 : 0, luckLvl || 0);
    return pickWeighted(min ? P.filter(p => p.rar >= min) : P);
  }

  /* скин нужной редкости, которого ещё нет; если такой редкости не осталось — ближайшая */
  function pickSkin(s, rar) {
    const un = SKINS.filter(k => !owns(s, k));
    if (!un.length) return null;
    let pool = un.filter(k => k.rar === rar);
    if (!pool.length) {
      const near = un.reduce((m, k) => Math.abs(k.rar - rar) < Math.abs(m.rar - rar) ? k : m, un[0]);
      pool = un.filter(k => Math.abs(k.rar - rar) === Math.abs(near.rar - rar));
    }
    return pool[rint(pool.length)];
  }

  function grant(def, s, r, res) {
    const g = res.g, plus = (k, n) => { g[k] = (g[k] || 0) + n; };
    if (def.coins) { s.coins += def.coins; plus("coins", def.coins); }
    if (def.xp) { s.xp += def.xp; plus("xp", def.xp); }
    if (def.hints) { s.hints = s.hints || { left: 0, day: null }; s.hints.left += def.hints; plus("hints", def.hints); }
    if (def.freeze) {
      if (s.streak.freezes < STREAK_CONFIG.maxFreezes) { s.streak.freezes++; plus("freeze", 1); }
      else { s.coins += CFG.freezeFallback; plus("coins", CFG.freezeFallback); res.fb = "freeze"; res.fbn = CFG.freezeFallback; }
    }
    if (def.shield) { r.shield += def.shield; plus("shield", def.shield); }
    if (def.dbl) { r.dbl += def.dbl; plus("dbl", def.dbl); }
    if (def.luck) { r.luck = Math.max(r.luck, def.luck); plus("luck", 1); }
    if (def.free) { r.free += def.free; plus("free", def.free); }
    if (def.cpn) { r.cpn += def.cpn; plus("cpn", def.cpn); }
    if (def.mag) { r.mag = Math.min(r.mag + def.mag, 9); plus("mag", def.mag); }
  }

  /* применяет приз к состоянию, возвращает описание (сохраняется в r.pending, поэтому только простые данные) */
  function applyPrize(prize, s, r) {
    const res = { id: prize.id, g: {} };
    if (prize.joke) res.joke = rint(JOKES.en.length);
    if (prize.give) grant(prize.give, s, r, res);
    if (prize.box) res.inner = applyPrize(pickWeighted(P.filter(p => BOX_POOL.includes(p.id))), s, r);
    if (prize.decor != null && window.VillageDecor) {
      const d = VillageDecor.pickFor(prize.decor, () => rint(1000) / 1000);
      if (d && VillageDecor.give(d.id, 1)) res.decor = d.id;
    }
    if (prize.skin) {
      const sk = pickSkin(s, prize.skin);
      if (sk) { s.owned.push(sk.id); res.skin = sk.id; }
      else { const c = CFG.skinFallback[prize.skin] || 200; s.coins += c; res.g.coins = (res.g.coins || 0) + c; res.fb = "skin"; res.fbn = c; }
    }
    return res;
  }

  /* бонусы коллекции: выдаём всё, что уже заработано (в том числе скины, полученные обменом) */
  function checkMs(s, r) {
    const out = [], cnt = countSkins(s);
    MS.forEach(m => {
      if (cnt < m.n || r.ms.includes(m.n)) return;
      r.ms.push(m.n);
      if (m.coins) s.coins += m.coins;
      if (m.hints) { s.hints = s.hints || { left: 0, day: null }; s.hints.left += m.hints; }
      if (m.free) r.free += m.free;
      out.push({ n: m.n, coins: m.coins || 0, hints: m.hints || 0, free: m.free || 0 });
    });
    return out;
  }

  /* стоимость: сначала тратятся билеты, потом купон на первый платный, скидка за ×10 */
  function quote(n, r) {
    const free = Math.min(r.free, n), paid = n - free;
    let cpn = r.cpn, cost = 0;
    for (let i = 0; i < paid; i++) {
      let pr = CFG.price;
      if (cpn > 0) { pr = Math.round(pr * (100 - CFG.cpnPct) / 100); cpn--; }
      cost += pr;
    }
    const base = paid * CFG.price;
    if (paid && CFG.bulk[n]) cost = Math.round(cost * CFG.bulk[n]);
    return { free, paid, cost, base, cpnUsed: r.cpn - cpn };
  }

  /* ======================= ЗВУК ======================= */
  let ac = null;
  function audio() {
    if (ac) return ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    return ac;
  }
  function tone(f, d, type, vol, when) {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.02);
  }
  const muted = () => RS(UI.state).mute;
  let lastTick = 0;
  const tick = () => { if (!muted()) tone(900, 0.035, "triangle", 0.03); };
  function winSound(rar) {
    if (muted()) return;
    const seq = rar >= 4 ? [523, 659, 784, 1047, 1319, 1568, 2093] : rar >= 3 ? [523, 659, 784, 1047, 1319] : rar === 2 ? [523, 659, 784, 1047] : rar === 1 ? [523, 659, 784] : [440, 554];
    seq.forEach((f, i) => tone(f, 0.22, "triangle", 0.06, i * 0.09));
  }
  const flipSound = rar => { if (!muted()) tone(520 + rar * 130, 0.14, "triangle", 0.045); };
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ======================= ПРЕВЬЮ СКИНОВ ======================= */
  const FALLBACK_KNIGHT = "♞&#xFE0E;";
  function skinPrev(sk, size, cls) {
    const s = size || 44;
    if (sk.type === "board") {
      let c = "";
      for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) c += `<i class="${(r + f) % 2 ? "d" : "l"}${r === 1 && f === 2 ? " a" : ""}"></i>`;
      const v = sk.vars;
      return `<span class="rl-bd ${cls || ""}" data-fx="${sk.fx || ""}" style="--s:${s}px;--l:${v["--sq-light"]};--d:${v["--sq-dark"]};--a:${v["--sq-active"]}">${c}</span>`;
    }
    const w = skinSvg(sk.id, "w", "n") || FALLBACK_KNIGHT, b = skinSvg(sk.id, "b", "n") || FALLBACK_KNIGHT;
    const gl = sk.glow ? `;--g:${sk.glow}` : "";
    return `<span class="rl-pcp ${cls || ""}" style="--s:${s}px${gl}"><u class="l">${w}</u><u class="d">${b}</u></span>`;
  }

  /* ======================= ЛЕНТА ======================= */
  let dims = { card: 84, gap: 8 }, reels = [], busy = false, panel = "odds", ready = false, modal, pointer;
  const step = () => dims.card + dims.gap;
  const reelCount = m => (m <= 3 ? m : 1);

  /* элемент ленты: приз (+ конкретный скин, если это скин) */
  function skinForDisplay(p) {            /* для «пустышек» на ленте — любой скин нужной редкости */
    const pool = SKINS.filter(k => k.rar === p.skin);
    return pool[rint(pool.length)];
  }
  const randomItem = () => { const p = pickWeighted(P); return { p, sk: p.skin ? skinForDisplay(p) : null }; };
  const decPrev = (id, px) => { const u = window.VillageDecor ? VillageDecor.thumb(id) : ""; return u ? `<img alt="" src="${u}" width="${px}" height="${px}" style="object-fit:contain">` : ""; };
  const itemOf = res => { const p = P_BY_ID[res.id]; return { p, sk: res.skin ? SKIN_BY_ID[res.skin] : null }; };
  const itemRar = it => it.sk ? Math.max(it.p.rar, it.sk.rar) : it.p.rar;

  function cardHtml(it) {
    const rr = itemRar(it), col = RARITY[rr].color, p = it.p;
    if (it.sk) {
      return `<div class="rl-ci rl-ci-skin${rr >= 3 ? " hot" : ""}" style="--rc:${col};--c2:${p.c[1]}">` +
        `<span class="rl-ci-pv">${skinPrev(it.sk, dims.card >= 80 ? 46 : 38)}</span><b class="rl-ci-nm">${t(it.sk.nameKey)}</b></div>`;
    }
    return `<div class="rl-ci${rr >= 3 ? " hot" : ""}${p.rainbow ? " rb" : ""}" style="--rc:${col};--c2:${p.c[1]}">` +
      `<span class="rl-ci-ic">${svg(p.ic, dims.card >= 80 ? 28 : 24, p.c[1])}</span><b>${p.lbl}</b></div>`;
  }

  function mkReels(n) {
    const host = $("rl-reels"); if (!host) return;
    dims = n === 1 ? { card: 84, gap: 8 } : { card: 68, gap: 6 };
    host.style.setProperty("--cw", dims.card + "px");
    host.style.setProperty("--ch", (n === 1 ? 90 : 76) + "px");
    host.className = "rl-reels rl-n" + n;
    host.innerHTML = "";
    reels = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div"); el.className = "rl-reel";
      const track = document.createElement("div"); track.className = "rl-track";
      el.appendChild(track); host.appendChild(el);
      const rl = { el, track, items: Array.from({ length: 24 }, randomItem), center: 12, off: 0 };
      track.innerHTML = rl.items.map(cardHtml).join("");
      reels.push(rl);
    }
    placeAll();
  }
  function place(rl) {
    const vw = rl.el.clientWidth || 300;
    rl.track.style.transform = `translate3d(${vw / 2 - (rl.center * step() + dims.card / 2 + rl.off)}px,0,0)`;
  }
  const placeAll = () => reels.forEach(place);

  /* ======================= ИНТЕРФЕЙС ======================= */
  function build() {
    if (ready) return; ready = true;
    modal = document.createElement("div");
    modal.className = "modal"; modal.id = "roulette-modal";
    modal.innerHTML = `
      <div class="modal-card rl-card" id="rl-card">
        <button class="modal-x" id="rl-close" type="button">✕</button>
        <h3 id="rl-title"></h3>
        <p class="rl-sub" id="rl-sub"></p>
        <div class="rl-top">
          <span class="rl-chip rl-bal"><i class="mcoin"></i><b id="rl-coins">0</b></span>
          <span class="rl-chip">${svg("bulb", 14)}<b id="rl-hints">0</b></span>
          <button class="rl-chip rl-skchip" id="rl-sk" type="button"></button>
          <button class="rl-chip rl-snd" id="rl-snd" type="button" aria-label="Sound"></button>
        </div>
        <div class="rl-stage" id="rl-stage">
          <div class="rl-pointer" id="rl-pointer"></div>
          <div class="rl-reels" id="rl-reels"></div>
          <div class="rl-line"></div>
        </div>
        <div class="rl-boosts" id="rl-boosts"></div>
        <div class="rl-multwrap"><span class="rl-multlbl" id="rl-multlbl"></span><div class="rl-mult" id="rl-mult"></div></div>
        <button class="btn btn-primary rl-spin" id="rl-spin" type="button"></button>
        <div class="rl-pity"><div class="rl-pity-bar"><i id="rl-pity-fill"></i></div><span id="rl-pity-txt"></span></div>
        <div class="rl-tabs">
          <button type="button" data-p="odds" id="rl-tab-odds"></button>
          <button type="button" data-p="col" id="rl-tab-col"></button>
          <button type="button" data-p="hist" id="rl-tab-hist"></button>
        </div>
        <div class="rl-panel" id="rl-panel"></div>
      </div>
      <div class="rl-reveal" id="rl-reveal"></div>`;
    document.querySelector(".phone-frame").appendChild(modal);
    pointer = $("rl-pointer");
    $("rl-close").onclick = close;
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    $("rl-spin").onclick = spin;
    $("rl-snd").onclick = () => { const r = RS(UI.state); r.mute = !r.mute; saveState(UI.state); paint(); };
    $("rl-sk").onclick = () => { if (busy) return; panel = "col"; paint(); };
    $("rl-mult").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) setMult(+b.dataset.m); });
    modal.querySelectorAll(".rl-tabs button").forEach(b => b.onclick = () => { panel = b.dataset.p; paint(); });
    $("rl-panel").addEventListener("click", e => {
      const b = e.target.closest("[data-eq]"); if (!b || busy) return;
      equip(b.dataset.eq); paint();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
    mkReels(1);
  }

  function equip(id) {
    const s = UI.state, sk = SKIN_BY_ID[id]; if (!sk || !owns(s, sk)) return false;
    s.equipped[sk.type] = sk.id; saveState(s); UI._applyTheme();
    return true;
  }

  function setMult(m) {
    if (busy || !CFG.multis.includes(m)) return;
    const r = RS(UI.state); r.mult = m; saveState(UI.state);
    mkReels(reelCount(m)); paint();
  }

  const fmtPct = w => (Math.round(w * 10) / 10) + "%";

  function paint() {
    if (!ready) return;
    const s = UI.state, r = RS(s);
    $("rl-title").textContent = t("rl.title");
    $("rl-sub").textContent = t("rl.sub");
    $("rl-snd").innerHTML = svg(r.mute ? "mute" : "sound", 15);
    $("rl-snd").title = t("rl.sound");
    $("rl-multlbl").textContent = t("rl.mult");

    /* кнопки ×N */
    $("rl-mult").innerHTML = CFG.multis.map(m => {
      const q = quote(m, r), poor = q.cost > s.coins;
      return `<button type="button" data-m="${m}" class="${m === r.mult ? "on" : ""}${poor ? " poor" : ""}"${busy ? " disabled" : ""}>×${m}${CFG.bulk[m] ? `<i>${t("rl.bulk")}</i>` : ""}</button>`;
    }).join("");

    /* главная кнопка */
    const q = quote(r.mult, r), b = $("rl-spin"), n = r.mult;
    let label;
    if (busy) label = t("rl.spinning");
    else if (q.cost === 0) label = `${svg("ticket", 16)}${n > 1 ? t("rl.freeX", { x: n }) : t("rl.freeSpin")}`;
    else {
      label = `<i class="mcoin"></i>${n > 1 ? t("rl.spinX", { x: n, n: q.cost }) : t("rl.spin", { n: q.cost })}`;
      if (q.base > q.cost) label += `<s class="rl-old">${q.base}</s>`;
      if (q.free) label += `<span class="rl-sbadge">${svg("ticket", 12)}×${q.free}</span>`;
    }
    b.innerHTML = label;
    b.disabled = busy;
    b.classList.toggle("rl-free", !busy && q.cost === 0);
    b.classList.toggle("rl-poor", !busy && q.cost > s.coins);
    $("rl-close").disabled = busy;
    $("rl-tab-odds").textContent = t("rl.odds"); $("rl-tab-hist").textContent = t("rl.hist"); $("rl-tab-col").textContent = t("rl.col");
    modal.querySelectorAll(".rl-tabs button").forEach(x => x.classList.toggle("on", x.dataset.p === panel));
    if (busy) return;   /* пока крутится лента, цифры не трогаем — иначе спойлер приза */

    $("rl-coins").textContent = s.coins;
    $("rl-hints").textContent = s.hints ? s.hints.left : 0;
    $("rl-sk").innerHTML = `${svg("palette", 14)}${countSkins(s)}/${SKINS.length}`;

    /* гарантия */
    const need = CFG.pity - 1 - r.pity;
    $("rl-pity-fill").style.width = Math.min(100, Math.round(r.pity / (CFG.pity - 1) * 100)) + "%";
    $("rl-pity-txt").textContent = need <= 0 ? t("rl.pityNow") : t("rl.pity", { n: need });
    $("rl-pity-txt").classList.toggle("rl-hot", need <= 0);

    /* активные бусты */
    const bo = [], bst = (ic, key, k) => `<span class="rl-boost">${svg(ic, 13)} ${t(key)}${k > 1 ? " ×" + k : ""}</span>`;
    if (r.shield) bo.push(bst("shield", "rl.bShield", r.shield));
    if (r.dbl) bo.push(bst("sparkles", "rl.bDouble", r.dbl));
    if (r.mag) bo.push(bst("magnet", "rl.bMag", r.mag));
    if (r.cpn) bo.push(bst("coupon", "rl.bCpn", r.cpn));
    if (r.free) bo.push(bst("ticket", "rl.bFree", r.free));
    if (r.luck) bo.push(bst("clover", r.luck > 1 ? "rl.bLuck2" : "rl.bLuck", 1));
    $("rl-boosts").innerHTML = bo.length ? bo.join("") : `<span class="rl-noboost">${t("rl.noBoosts")}</span>`;

    const pn = $("rl-panel");
    if (panel === "odds") pn.innerHTML = oddsHtml(r);
    else if (panel === "col") pn.innerHTML = colHtml(s, r);
    else pn.innerHTML = histHtml(r);
  }

  function oddsHtml(r) {
    const sums = [0, 0, 0, 0, 0];
    P.forEach(p => { sums[p.rar] += p.w; });
    let h = `<div class="rl-rbar">${RARITY.map((c, i) => `<i style="flex:${sums[i]};background:${c.color}" title="${t("rl.rar." + c.id)} ${fmtPct(sums[i])}"></i>`).join("")}</div>`;
    h += `<div class="rl-rleg">${RARITY.map((c, i) => `<span style="color:${c.color}">● ${t("rl.rar." + c.id)} ${fmtPct(sums[i])}</span>`).join("")}</div>`;
    h += P.slice().sort((a, c) => c.rar - a.rar || a.w - c.w).map(p => {
      const col = RARITY[p.rar].color, dead = p.rar < (r.luck || 0);
      return `<div class="rl-row"><span class="rl-row-ic">${svg(p.ic, 18, p.c[1])}</span>
        <span class="rl-row-tx"><b>${pname(p.id)}</b><i style="color:${col}">${t("rl.rar." + RARITY[p.rar].id)}</i></span>
        <span class="rl-row-pc" style="${dead ? "opacity:.35;text-decoration:line-through" : ""}">${fmtPct(p.w)}</span></div>`;
    }).join("");
    return h + `<p class="rl-empty">${t("rl.oddsNote", { n: CFG.pity })}</p>`;
  }

  function histHtml(r) {
    if (!r.hist.length) return `<p class="rl-empty">${t("rl.histEmpty")}</p>`;
    return r.hist.map(h => {
      const p = P_BY_ID[h.box || h.id]; if (!p) return "";
      const sk = h.skin && SKIN_BY_ID[h.skin], rr = sk ? Math.max(p.rar, sk.rar) : p.rar, col = RARITY[rr].color;
      const ic = sk ? skinPrev(sk, 30) : svg(p.ic, 18, p.c[1]);
      const nm = sk ? t(sk.nameKey) : pname(p.id);
      return `<div class="rl-row"><span class="rl-row-ic">${ic}</span>
        <span class="rl-row-tx"><b>${h.box ? svg("gift", 12) + " " : ""}${nm}</b><i style="color:${col}">${t("rl.rar." + RARITY[rr].id)}</i></span></div>`;
    }).join("");
  }

  function colHtml(s, r) {
    const own = countSkins(s), total = SKINS.length, next = MS.find(m => !r.ms.includes(m.n));
    let h = `<div class="rl-colh"><div class="rl-colh-t"><b>${own}/${total}</b><span>${next ? t("rl.colNext", { n: next.n, r: giveText(next) }) : t("rl.colDone")}</span></div>
      <div class="rl-pity-bar"><i style="width:${Math.round(own / total * 100)}%"></i></div></div>`;
    h += SKINS.slice().sort((a, c) => c.rar - a.rar || (a.type === c.type ? 0 : a.type === "board" ? -1 : 1))
      .map(k => {
        const has = owns(s, k), col = RARITY[k.rar].color, on = s.equipped[k.type] === k.id;
        return `<div class="rl-row${has ? "" : " rl-locked"}"><span class="rl-row-pv">${skinPrev(k, 34)}</span>
          <span class="rl-row-tx"><b>${t(k.nameKey)}</b><i style="color:${col}">${t("rl.rar." + RARITY[k.rar].id)} · ${t("rl.skin." + k.type)}</i></span>
          ${has ? `<button type="button" class="rl-eq${on ? " on" : ""}" data-eq="${k.id}"${on ? " disabled" : ""}>${on ? "✓ " + t("rl.on") : t("rl.equipBtn")}</button>` : `<span class="rl-lock">${svg("lock", 16)}</span>`}</div>`;
      }).join("");
    return h;
  }

  function open() {
    build();
    const s = UI.state, r = RS(s);
    const ms = checkMs(s, r);                 /* догоняем бонусы коллекции (скины могли прийти из обмена) */
    if (ms.length) { saveState(s); UI.renderTopbar(); ms.forEach(m => UI._toast(t("rl.ms", { n: m.n, r: giveText(m) }))); }
    mkReels(reelCount(r.mult)); paint();
    $("rl-reveal").classList.remove("show");
    $("rl-stage").className = "rl-stage";
    modal.classList.add("open");
    placeAll();
    const pend = pendingOf(r);
    if (pend) setTimeout(() => showResults(pend.res, pend.ms, true), 250);   /* приз, который не успели показать */
  }
  function close() {
    if (busy || !modal) return;
    modal.classList.remove("open");
    UI.renderTopbar(); if (UI.state && $("view-shop").classList.contains("active")) UI.renderShop();
    if ($("view-home").classList.contains("active")) refreshBanner();
  }

  /* ======================= ПРОКРУТ ======================= */
  function spin() {
    if (busy) return;
    const s = UI.state, r = RS(s), n = r.mult, q = quote(n, r);
    if (q.cost > s.coins) {
      UI._toast(t("rl.notEnough", { n: q.cost - s.coins }));
      const b = $("rl-spin"); b.classList.remove("rl-shake"); void b.offsetWidth; b.classList.add("rl-shake");
      return;
    }
    audio(); if (ac && ac.state === "suspended") ac.resume();
    busy = true;
    const coinsBefore = s.coins;
    /* всё считаем и сохраняем СРАЗУ — перезагрузка страницы посреди прокрута ничего не сломает */
    s.coins -= q.cost; r.free -= q.free; r.cpn -= q.cpnUsed;
    const results = [];
    for (let i = 0; i < n; i++) {
      r.spins++;
      const usedLuck = r.luck; r.luck = 0;
      const prize = roll(r, usedLuck);
      r.pity = prize.rar >= 2 ? 0 : r.pity + 1;
      const res = applyPrize(prize, s, r);
      results.push(res);
      r.hist.unshift({ id: res.id, skin: (res.inner ? res.inner.skin : res.skin) || null, box: res.inner ? res.inner.id : null, at: Date.now() });
    }
    r.hist.length = Math.min(r.hist.length, CFG.hist);
    const ms = checkMs(s, r);
    r.pending = { res: results, ms };
    saveState(s);

    paint();
    $("rl-coins").textContent = coinsBefore - q.cost;
    $("rl-reveal").classList.remove("show");
    $("rl-card").scrollTop = 0;

    /* ×1–×3: по ленте на каждый прокрут; ×5 и ×10: одна турбо-лента с лучшим призом, потом карточки итогов */
    const turbo = n > 3, shown = turbo ? [bestOf(results)] : results;
    if (reels.length !== shown.length) mkReels(shown.length);
    $("rl-stage").className = "rl-stage spinning";
    const fast = reduced();
    let left = shown.length;
    shown.forEach((res, i) => {
      const ms2 = fast ? 1100 : (turbo ? 2800 : CFG.spinMs + i * 650);
      runReel(reels[i], res, ms2, () => {
        if (--left > 0) return;
        const top = shown.reduce((m, x) => Math.max(m, rarOfRes(x)), 0);
        $("rl-stage").className = "rl-stage landed l" + top;
        setTimeout(() => {
          $("rl-stage").className = "rl-stage"; busy = false;
          showResults(results, ms, false);
        }, fast ? 150 : 900);
      });
    });
  }

  function runReel(rl, res, ms, done) {
    const vw = rl.el.clientWidth || 300, st = step(), card = dims.card;
    /* новая лента начинается с тех же карточек, что сейчас под стрелкой — без скачка */
    const from = Math.max(0, rl.center - 5), keep = rl.items.slice(from, rl.center + 6), si = rl.center - from;
    const winIdx = keep.length + 30 + rint(6), next = keep.slice();
    for (let i = keep.length; i < winIdx + 8; i++) next.push(i === winIdx ? itemOf(res) : randomItem());
    rl.items = next; rl.center = winIdx;
    rl.el.classList.remove("landed");
    rl.track.innerHTML = next.map(cardHtml).join("");
    const startX = vw / 2 - (si * st + card / 2 + rl.off);
    rl.off = (rnd() - 0.5) * card * 0.7;                    /* стрелка встаёт не строго по центру карточки */
    const finalX = vw / 2 - (winIdx * st + card / 2 + rl.off);
    rl.track.style.transform = `translate3d(${startX}px,0,0)`;
    const t0 = performance.now(); let last = -1;
    function frame(now) {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3.6);
      const x = startX + (finalX - startX) * e;
      rl.track.style.transform = `translate3d(${x}px,0,0)`;
      const idx = Math.floor((vw / 2 - x) / st);
      if (idx !== last) {
        if (last !== -1 && now - lastTick > 45) {
          lastTick = now; tick();
          pointer.classList.remove("flick"); void pointer.offsetWidth; pointer.classList.add("flick");
        }
        last = idx;
      }
      if (p < 1) requestAnimationFrame(frame);
      else { rl.track.children[winIdx].classList.add("win"); rl.el.classList.add("landed"); done(); }
    }
    requestAnimationFrame(frame);
  }

  /* ======================= ПОКАЗ ПРИЗОВ ======================= */
  const innerOf = res => res.inner || res;
  function rarOfRes(res) {
    const p = P_BY_ID[res.id], e = innerOf(res), ep = P_BY_ID[e.id] || p, sk = e.skin ? SKIN_BY_ID[e.skin] : null;
    return Math.max(p.rar, ep.rar, sk ? sk.rar : 0);
  }
  const bestOf = list => list.reduce((m, x) => rarOfRes(x) > rarOfRes(m) ? x : m, list[0]);

  function descFor(ep, e, sk) {
    if (e.decor) return t("vd." + e.decor + ".d") + " · " + t("vd.p." + VDECOR.BY_ID[e.decor].perk[0], { n: VDECOR.BY_ID[e.decor].perk[1] });
    if (sk) return t("rl.skin." + sk.type + ".d");
    if (e.fb) return t("rl.fb." + e.fb, { n: e.fbn || (e.g && e.g.coins) || e.coins || 0 });
    if (ep.joke) { const L = JOKES[lang()]; return L[(e.joke || 0) % L.length] + " " + t("rl.p.meme.d", { n: CFG.jokeCoins }); }
    return t(`rl.p.${ep.id}.d`);
  }

  function msLines(ms) {
    return (ms || []).map(m => `<div class="rl-rv-ms">${t("rl.ms", { n: m.n, r: giveText(m) })}</div>`).join("");
  }

  function showResults(results, ms, late) {
    const s = UI.state, r = RS(s);
    if (!results || !results.length) { r.pending = null; saveState(s); paint(); return; }
    r.pending = null; saveState(s);
    UI.renderTopbar();
    if (typeof Hints !== "undefined" && Hints.paintNow) Hints.paintNow();
    if (results.length === 1) revealOne(results[0], ms, late); else revealMany(results, ms, late);
    paint();
  }

  function bindAgain(rv) {
    const a = rv.querySelector("#rl-again"), d = rv.querySelector("#rl-done");
    if (a) a.onclick = () => { rv.classList.remove("show"); setTimeout(spin, 120); };
    if (d) d.onclick = () => { rv.classList.remove("show"); close(); };
  }
  function buzz(rr) {
    if (rr >= 2 && navigator.vibrate) { try { navigator.vibrate(rr >= 4 ? [40, 40, 40, 40, 120] : [30, 40, 60]); } catch (x) {} }
  }

  function revealOne(res, ms, late) {
    const s = UI.state, p = P_BY_ID[res.id], e = innerOf(res), ep = P_BY_ID[e.id] || p, sk = e.skin ? SKIN_BY_ID[e.skin] : null;
    const rr = rarOfRes(res), col = RARITY[rr].color, rv = $("rl-reveal");
    const tag = (late ? t("rl.fromBefore") + " · " : "") + (res.inner ? `${pname(p.id)} · ` : "");
    rv.style.setProperty("--rc", col);
    rv.className = "rl-reveal show rar-" + RARITY[rr].id;
    rv.innerHTML = `
      <div class="rl-rv-card">
        <div class="rl-rv-rar">${tag}${t("rl.rar." + RARITY[rr].id)}</div>
        <div class="rl-rv-ic${sk || e.decor ? " rl-rv-skin" : ""}">${sk ? skinPrev(sk, 76) : e.decor ? decPrev(e.decor, 84) : svg(ep.ic, 36, ep.c[1])}</div>
        <h4>${sk ? t(sk.nameKey) : e.decor ? t("vd." + e.decor) : pname(ep.id)}</h4>
        <p>${descFor(ep, e, sk)}</p>
        ${msLines(ms)}
        <div class="rl-rv-acts">
          ${sk ? `<button class="btn btn-ghost" id="rl-equip" type="button">${t("rl.equip")}</button>` : ""}
          <button class="btn btn-primary" id="rl-again" type="button">${t("rl.again")}</button>
          <button class="btn btn-ghost" id="rl-done" type="button">${t("rl.close")}</button>
        </div>
      </div>`;
    confetti(rv, rr, col); winSound(rr); buzz(rr);
    const eq = rv.querySelector("#rl-equip");
    if (eq) eq.onclick = () => { if (equip(sk.id)) { eq.textContent = "✓ " + t("rl.equipped"); eq.disabled = true; } };
    bindAgain(rv);
  }

  /* суммы по всем призам (с учётом содержимого ящиков) */
  function sumG(list) {
    const o = {};
    const walk = x => { Object.keys(x.g || {}).forEach(k => { o[k] = (o[k] || 0) + x.g[k]; }); if (x.inner) walk(x.inner); };
    list.forEach(walk);
    return o;
  }
  const TOT = [
    ["coins", "coin", "#e8b84a"], ["xp", "star", "#f2a14b"], ["hints", "bulb", "#e0cc2b"], ["free", "ticket", "#3fe0b8"],
    ["freeze", "snow", "#55dcf5"], ["shield", "shield", "#4a9bff"], ["dbl", "sparkles", "#ff68b8"],
    ["mag", "magnet", "#ff7a6a"], ["cpn", "coupon", "#ff7a6a"], ["luck", "clover", "#55e878"]
  ];

  function revealMany(results, ms, late) {
    const rv = $("rl-reveal"), n = results.length;
    const order = results.slice().sort((a, b) => rarOfRes(a) - rarOfRes(b));       /* лучшие карточки открываются последними */
    const top = rarOfRes(order[order.length - 1]), col = RARITY[top].color;
    const fast = reduced(), gap = fast ? 0 : (n > 5 ? 190 : 260);
    const tiles = order.map((res, i) => {
      const p = P_BY_ID[res.id], e = innerOf(res), ep = P_BY_ID[e.id] || p, sk = e.skin ? SKIN_BY_ID[e.skin] : null;
      const rr = rarOfRes(res), c = RARITY[rr].color;
      const pv = sk ? skinPrev(sk, n >= 10 ? 30 : n >= 5 ? 40 : 44) : e.decor ? decPrev(e.decor, n >= 10 ? 30 : n >= 5 ? 40 : 44) : svg(ep.ic, n >= 10 ? 22 : 26, ep.c[1]);
      return `<div class="rl-tile r${rr}" style="--rc:${c};--d:${i * gap}ms">
        <div class="rl-tile-in">
          ${res.inner ? `<span class="rl-tile-box">${svg("gift", 11)}</span>` : ""}
          <span class="rl-tile-pv">${pv}</span>
          <b>${sk ? t(sk.nameKey) : e.decor ? t("vd." + e.decor) : pname(ep.id)}</b>
          ${sk ? `<button type="button" class="rl-tile-eq" data-eq="${sk.id}">${t("rl.equipBtn")}</button>` : ""}
        </div></div>`;
    }).join("");
    const g = sumG(results);
    const tot = TOT.filter(x => g[x[0]]).map(x => `<span class="rl-tchip" style="--tc:${x[2]}">${svg(x[1], 14, x[2])}<b>${x[0] === "coins" || x[0] === "xp" || x[0] === "hints" ? "+" : "×"}${g[x[0]]}</b></span>`).join("");
    rv.style.setProperty("--rc", col);
    rv.className = "rl-reveal show many rar-" + RARITY[top].id;
    rv.innerHTML = `
      <div class="rl-rv-card rl-rv-multi">
        <div class="rl-rv-rar">${late ? t("rl.fromBefore") + " · " : ""}×${n}</div>
        <h4>${t("rl.summary")}</h4>
        <div class="rl-grid n${n}">${tiles}</div>
        <div class="rl-tot" style="--d:${n * gap + 150}ms"><span class="rl-tot-l">${t("rl.total")}</span>${tot || ""}</div>
        ${msLines(ms)}
        <div class="rl-rv-acts">
          <button class="btn btn-primary" id="rl-again" type="button">${t("rl.againX", { x: n })}</button>
          <button class="btn btn-ghost" id="rl-done" type="button">${t("rl.close")}</button>
        </div>
      </div>`;
    /* звук и вибрация по мере открытия карточек */
    order.forEach((res, i) => setTimeout(() => { if (rv.classList.contains("show")) flipSound(rarOfRes(res)); }, i * gap + 80));
    setTimeout(() => { if (rv.classList.contains("show")) { confetti(rv, top, col); winSound(top); buzz(top); } }, n * gap + 80);
    rv.querySelectorAll("[data-eq]").forEach(b => b.onclick = () => {
      if (equip(b.dataset.eq)) { b.textContent = "✓ " + t("rl.on"); b.disabled = true; b.classList.add("on"); }
    });
    bindAgain(rv);
  }

  function confetti(host, rar, col) {
    if (reduced() || rar < 2) return;       /* только искры, и только для редких призов */
    const n = rar >= 4 ? 44 : rar >= 3 ? 28 : 14;
    const colors = [col, "#e3bf7c", "#eceae4", "#f1d79a"];
    const wrap = document.createElement("div"); wrap.className = "rl-conf";
    for (let i = 0; i < n; i++) {
      const el = document.createElement("i"), ang = rnd() * Math.PI * 2, dist = 80 + rnd() * 150, z = 3 + rint(3);
      el.style.cssText = `--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 30}px;background:${colors[rint(colors.length)]};` +
        `animation-delay:${rnd() * 0.1}s;width:${z}px;height:${z}px`;
      wrap.appendChild(el);
    }
    host.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2000);
  }

  /* ======================= ВХОДЫ: главная и магазин ======================= */
  function refreshBanner() {
    const home = $("view-home"); if (!home) return;
    let b = $("rl-banner");
    if (!b) {
      b = document.createElement("button"); b.type = "button"; b.id = "rl-banner"; b.className = "rl-banner";
      b.addEventListener("click", open);
      const anchor = $("streak-card");
      if (anchor) anchor.after(b); else home.appendChild(b);
    }
    const r = RS(UI.state), can = UI.state.coins >= CFG.price || r.free > 0;
    b.classList.toggle("rl-banner-ready", can);
    b.innerHTML = `<span class="rl-b-wheel" aria-hidden="true"></span>
      <span class="rl-b-tx"><b>${t("rl.banner.t")}</b><i>${t("rl.banner.s", { n: CFG.price })}</i></span>
      <span class="rl-b-go">${t("rl.banner.go")} →</span>`;
  }
  const _rh = UI.renderHome;
  UI.renderHome = function () { _rh.apply(this, arguments); refreshBanner(); };

  function renderShopTab() {
    const grid = $("shop-grid"), s = UI.state;
    grid.innerHTML = "";
    const card = document.createElement("div");
    card.className = "shop-card shop-wide rl-shopcard";
    card.innerHTML = `
      <span class="swatch swatch-roulette"><span class="rl-b-wheel"></span></span>
      <span class="shop-name">${t("rl.shop.t")}</span>
      <span class="shop-desc">${t("rl.shop.d", { n: CFG.price })}</span>
      <span class="shop-price">${t("rl.shop.skins", { a: countSkins(s), b: SKINS.length })}</span>`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "shop-btn"; btn.textContent = t("rl.shop.btn");
    btn.onclick = open;
    card.appendChild(btn); grid.appendChild(card);
  }

  /* вкладка «Рулетка» в магазине (создаём до UI.init — он сам навесит обработчики на все .shop-tab) */
  const tabs = document.querySelector(".shop-tabs");
  if (tabs && !tabs.querySelector('[data-type="roulette"]')) {
    const tb = document.createElement("button");
    tb.className = "shop-tab"; tb.dataset.type = "roulette"; tb.setAttribute("data-i18n", "rl.tab");
    tb.textContent = t("rl.tab");
    tabs.appendChild(tb);
  }

  /* перевод на лету */
  const _tr = UI.translate;
  UI.translate = function () { _tr.apply(this, arguments); if (UI.state) { refreshBanner(); if (ready && !busy) { mkReels(reels.length || 1); paint(); } } };

  /* ======================= БУСТЫ В ПАРТИЯХ ======================= */
  /* Щит звёзд: победа даёт 3★ (тратится, только если реально были подсказки).
     Двойная добыча: первое прохождение даёт ×2 монет и XP.
     Магнит монет: первое прохождение даёт +50% монет и XP (3 заряда). */
  function lineInModal(text) {
    const box = $("modal-achievements"); if (!box) return;
    const el = document.createElement("div"); el.className = "modal-ach rl-modal-ach"; el.textContent = text; box.prepend(el);
  }
  const pct = (v, p) => Math.floor(v * p / 100);

  const _go = UI._handleGameOver;
  UI._handleGameOver = function (level, res) {
    const s = this.state, r = RS(s), win = res && res.result === "win";
    const first = !s.completed.includes(level.id);
    const useShield = win && r.shield > 0 && res.hintsUsed > 0;
    const _stars = window.starsForResult;
    if (useShield) window.starsForResult = () => 3;
    let out;
    try { out = _go.apply(this, arguments); } finally { window.starsForResult = _stars; }
    const notes = [];
    if (useShield) { r.shield--; notes.push(t("rl.shieldUsed")); }
    if (win && first && r.dbl > 0) {
      r.dbl--; s.coins += level.coins; s.xp += level.xp;
      notes.push(t("rl.doubleUsed", { c: level.coins, x: level.xp }));
    }
    if (win && first && r.mag > 0) {
      const c = pct(level.coins, CFG.magPct), x = pct(level.xp, CFG.magPct);
      r.mag--; s.coins += c; s.xp += x;
      notes.push(t("rl.magUsed", { c, x, k: r.mag }));
    }
    if (notes.length) { saveState(s); this.renderTopbar(); notes.reverse().forEach(lineInModal); }
    return out;
  };

  const _pr = UI._handlePuzzleResult;
  UI._handlePuzzleResult = function (puzzle, solved, result) {
    const s = this.state, r = RS(s);
    const first = !s.completedPuzzles.includes(puzzle.id);
    const out = _pr.apply(this, arguments);
    const notes = [];
    if (solved && first && r.dbl > 0) {
      r.dbl--; s.coins += puzzle.coins; s.xp += puzzle.xp;
      notes.push(t("rl.doubleUsed", { c: puzzle.coins, x: puzzle.xp }));
    }
    if (solved && first && r.mag > 0) {
      const c = pct(puzzle.coins, CFG.magPct), x = pct(puzzle.xp, CFG.magPct);
      r.mag--; s.coins += c; s.xp += x;
      notes.push(t("rl.magUsed", { c, x, k: r.mag }));
    }
    if (notes.length) { saveState(s); this.renderTopbar(); notes.reverse().forEach(lineInModal); }
    return out;
  };

  window.Roulette = { open, close, CFG, PRIZES: P, SKINS };
})();