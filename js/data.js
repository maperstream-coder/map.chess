/* maper.chess — static game data
   Everything the app needs to know about levels, puzzles, achievements and the shop lives here.
   Display strings are looked up through i18n keys (see i18n.js) rather than hard-coded, so the
   whole app can be shown in English or Russian.

   v2 «Игры»: 24 партии против живых «персонажей». У каждой — свой соперник (имя, характер, сила),
   своя стартовая позиция (эндшпиль, гамбит, фора в материале, дебют за чёрных…) и необязательная цель
   на третью звезду. Сила бота задаётся блоком `ai` (см. js/chess-ai.js). */

const TIERS = {
  beginner: { labelKey: "tier.beginner", color: "#8f97ea", descKey: "tier.beginner.desc" },
  intermediate: { labelKey: "tier.intermediate", color: "#a99cf0", descKey: "tier.intermediate.desc" },
  pro: { labelKey: "tier.pro", color: "#dcb56d", descKey: "tier.pro.desc" }
};

/* ---------- стили игры бота (веса оценки движка) ---------- */
const BOT_STYLES = {
  fresh:   { key: "style.fresh",   w: null },
  aggr:    { key: "style.aggr",    w: { aggr: 1, king: 0.7, mob: 1.2 } },
  solid:   { key: "style.solid",   w: { king: 1.6, pawn: 1.3, mob: 0.8 } },
  tactic:  { key: "style.tactic",  w: { mob: 1.5, aggr: 0.4 } },
  endgame: { key: "style.endgame", w: { pawn: 1.5, trade: 1, aggr: 0 } },
  pos:     { key: "style.pos",     w: { pawn: 1.5, mob: 1.3, king: 1.1 } },
  gambit:  { key: "style.gambit",  w: { aggr: 0.8, mob: 1.2, king: 0.8 } }
};

/* ---------- описание уровней ----------
   t: [ruTitle, enTitle, ruDesc, enDesc]; bot: [ruName, enName, piece, style]
   start: fen — расстановка «глазами игрока» (игрок = белые; если выбрал чёрных — зеркалится);
          moves — ходы от начальной позиции (e2e4 e7e5 …), color — сторона игрока жёстко.
   goal: moves(n) | capture(n) | check(n) | castle | promote | keepQueen | losePieces(n) */
const LEVEL_SPECS = {
  beginner: [
    { t: ["Ферзь на отдыхе", "Queen's Day Off", "У соперника нет ферзя. Развивай фигуры и дави численным перевесом.", "Your opponent starts without a queen. Develop your pieces and use the extra power."],
      bot: ["Миша", "Misha", "p", "fresh"], fen: "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      goal: { t: "moves", n: 35 }, ai: { depth: 1, noise: 320, blunder: 0.4, quiesce: false, ms: 120 } },
    { t: ["Ладья в подарок", "A Rook Short", "Чёрные начинают без ладьи. Захватывай центр и забирай фигуры.", "Black starts a rook down. Take the centre and collect pieces."],
      bot: ["Аня", "Anya", "p", "fresh"], fen: "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1",
      goal: { t: "capture", n: 5 }, ai: { depth: 1, noise: 240, blunder: 0.32, quiesce: false, ms: 120 } },
    { t: ["Ловушка на f7", "The f7 Trap", "Соперник рвётся к детскому мату на f7. Защитись — и накажи за жадность.", "Your opponent is going for a quick mate on f7. Defend — then punish the greed."],
      bot: ["Боря", "Boris", "n", "aggr"], moves: "e2e4 e7e5 f1c4 b8c6 d1h5", color: "b",
      goal: { t: "keepQueen" }, ai: { depth: 1, noise: 170, blunder: 0.2, quiesce: false, ms: 120 } },
    { t: ["Ферзь против пешек", "Queen vs Pawns", "Ферзь и король против короля с тремя пешками. Остановись, а потом поставь мат.", "King and queen against king and three pawns. Stop the pawns, then deliver mate."],
      bot: ["Лена", "Lena", "b", "fresh"], fen: "4k3/ppp5/8/8/8/8/8/3QK3 w - - 0 1",
      goal: { t: "moves", n: 25 }, ai: { depth: 2, noise: 140, blunder: 0.15, quiesce: false, ms: 150 } },
    { t: ["Мат ладьёй", "Rook Mate", "Король и ладья против одинокого короля. Загони его к краю и поставь мат.", "King and rook against a lone king. Drive it to the edge and mate."],
      bot: ["Гриша", "Grisha", "n", "endgame"], fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
      goal: { t: "moves", n: 30 }, ai: { depth: 2, noise: 90, blunder: 0.1, ms: 150 } },
    { t: ["Королевский гамбит", "King's Gambit", "Белые жертвуют пешку ради атаки. Играй остро: объяви несколько шахов.", "White sacrifices a pawn for the attack. Play sharp — and give a few checks."],
      bot: ["Ксюша", "Ksusha", "b", "gambit"], moves: "e2e4 e7e5 f2f4 e5f4", color: "w",
      goal: { t: "check", n: 3 }, ai: { depth: 2, noise: 100, blunder: 0.1, ms: 180 } },
    { t: ["Лишняя пешка", "A Pawn Up", "Пешечный эндшпиль с лишней пешкой. Прорвись и проведи пешку в ферзи.", "A pawn endgame, one pawn up. Break through and promote."],
      bot: ["Тимур", "Timur", "r", "endgame"], fen: "4k3/ppp5/8/8/8/8/PPPP4/4K3 w - - 0 1",
      goal: { t: "promote" }, ai: { depth: 3, noise: 70, blunder: 0.06, ms: 200 } },
    { t: ["Первый экзамен", "First Exam", "Обычная партия с полным набором фигур. Сделай рокировку и сыграй уверенно.", "A normal game with all the pieces. Castle early and play with confidence."],
      bot: ["Вера", "Vera", "q", "solid"], goal: { t: "castle" }, ai: { depth: 3, noise: 55, blunder: 0.04, ms: 250 } }
  ],
  intermediate: [
    { t: ["Ответ на e4", "Facing e4", "Ты играешь чёрными и отвечаешь на 1.e4. Займи центр и рокируйся.", "You are Black and answer 1.e4. Fight for the centre and castle."],
      bot: ["Артём", "Artem", "n", "fresh"], moves: "e2e4", color: "b",
      goal: { t: "castle" }, ai: { depth: 3, noise: 100, blunder: 0.03, ms: 350, book: 6 } },
    { t: ["Ферзевый гамбит", "Queen's Gambit", "Белые против 1…d5. Сыграй c4 и забери побольше фигур соперника.", "White against 1…d5. Play c4 and collect plenty of enemy pieces."],
      bot: ["Диана", "Diana", "b", "pos"], moves: "d2d4 d7d5", color: "w",
      goal: { t: "capture", n: 5 }, ai: { depth: 3, noise: 85, blunder: 0.03, ms: 350, book: 6, style: { pawn: 1.3, mob: 1.2 } } },
    { t: ["Лишнее качество", "Exchange Up", "У тебя ладья против слона при равных пешках. Реализуй перевес.", "You have a rook against a bishop with equal pawns. Convert the advantage."],
      bot: ["Макс", "Max", "r", "endgame"], fen: "5k2/pp3pp1/2b4p/8/8/5P2/PP3KPP/3R4 w - - 0 1",
      goal: { t: "moves", n: 50 }, ai: { depth: 3, noise: 75, blunder: 0.02, ms: 400, style: { pawn: 1.4, trade: 0.5 } } },
    { t: ["Итальянская партия", "Italian Game", "Тихая итальянская партия. Играй за белых и атакуй короля шахами.", "A quiet Italian Game. Play White and harass the king with checks."],
      bot: ["Ирина", "Irina", "q", "solid"], moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6", color: "w",
      goal: { t: "check", n: 2 }, ai: { depth: 3, noise: 65, blunder: 0.02, ms: 450, style: { king: 1.4 } } },
    { t: ["Без коня", "Knight Odds", "У чёрных нет коня, зато бот стал сильнее. Не давай ему равных разменов.", "Black is missing a knight, but the bot is stronger. Don't allow equal trades."],
      bot: ["Роман", "Roman", "n", "tactic"], fen: "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      goal: { t: "losePieces", n: 2 }, ai: { depth: 4, noise: 55, blunder: 0.02, ms: 500, style: { mob: 1.3 } } },
    { t: ["Ферзь против ладей", "Queen vs Two Rooks", "Дисбаланс: твой ферзь против двух ладей. Береги ферзя и ищи вилки.", "An imbalance: your queen against two rooks. Protect the queen and look for forks."],
      bot: ["Алиса", "Alisa", "b", "tactic"], fen: "r3r1k1/5ppp/8/8/8/8/PPP2PPP/3Q2K1 w - - 0 1",
      goal: { t: "keepQueen" }, ai: { depth: 4, noise: 40, blunder: 0.01, ms: 550 } },
    { t: ["Сицилианская защита", "Sicilian Defence", "Чёрными против 1.e4 c5 2.Nf3. Контратакуй и бери материал.", "Black against 1.e4 c5 2.Nf3. Counterattack and win material."],
      bot: ["Павел", "Pavel", "r", "aggr"], moves: "e2e4 c7c5 g1f3", color: "b",
      goal: { t: "capture", n: 6 }, ai: { depth: 4, noise: 28, blunder: 0, ms: 650, book: 8, style: { aggr: 0.6 } } },
    { t: ["Босс клуба", "Club Boss", "Сильнейший игрок клуба. Выиграй, потеряв не больше одной фигуры.", "The strongest player of the club. Win while losing at most one piece."],
      bot: ["Эльза", "Elsa", "q", "aggr"], goal: { t: "losePieces", n: 1 },
      ai: { depth: 4, noise: 14, blunder: 0, ms: 800, book: 10, style: { aggr: 0.7, mob: 1.2 } } }
  ],
  pro: [
    { t: ["Мастер дебюта", "Opening Master", "Бот знает теорию и играет без грубых ошибок. Дойди до рокировки целым.", "The bot knows theory and plays without cheap errors. Reach castling in one piece."],
      bot: ["Орлов", "Orlov", "k", "solid"], goal: { t: "castle" },
      ai: { depth: 5, noise: 14, blunder: 0, ms: 800, book: 12, style: { king: 1.5, pawn: 1.2 } } },
    { t: ["Гамбит Эванса", "Evans Gambit", "Ты чёрными в остром гамбите. Прими жертву, но удержи позицию.", "You are Black in a sharp gambit. Accept the sacrifice but hold the position."],
      bot: ["Белова", "Belova", "b", "gambit"], moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4", color: "b",
      goal: { t: "capture", n: 5 }, ai: { depth: 6, noise: 6, blunder: 0, ms: 1000, style: { aggr: 1, mob: 1.2 } } },
    { t: ["Староиндийская", "King's Indian", "Белые в староиндийской защите: пешечный центр против контратаки.", "White against the King's Indian: a pawn centre against a counterattack."],
      bot: ["Кузнецов", "Kuznetsov", "n", "tactic"], moves: "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6", color: "w",
      goal: { t: "check", n: 2 }, ai: { depth: 6, noise: 0, blunder: 0, ms: 1200, style: { aggr: 0.6, mob: 1.3 } } },
    { t: ["Ферзь против ладьи", "Queen vs Rook", "Ферзь и пешки против ладьи и пешек. Чистая техника против мастера обороны.", "Queen and pawns against rook and pawns. Clean technique against a master defender."],
      bot: ["Лебедев", "Lebedev", "r", "endgame"], fen: "3r2k1/6pp/8/8/3Q4/8/6PP/6K1 w - - 0 1",
      goal: { t: "moves", n: 40 }, ai: { depth: 7, noise: 0, blunder: 0, ms: 1400, style: { pawn: 1.5, trade: 0.4 } } },
    { t: ["Найдорф", "Najdorf", "Острейший вариант сицилианской: белые против лучшей теории.", "The sharpest Sicilian: White against the best theory."],
      bot: ["Соколова", "Sokolova", "q", "tactic"], moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6", color: "w",
      goal: { t: "losePieces", n: 2 }, ai: { depth: 7, noise: 0, blunder: 0, ms: 1600, style: { mob: 1.5, aggr: 0.4 } } },
    { t: ["Без f-пешки", "Pawn Odds", "Ты без пешки f2, а бот играет в полную силу. Отыграй материал.", "You are without the f2 pawn and the bot plays at full strength. Win material back."],
      bot: ["Морозов", "Morozov", "n", "aggr"], fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPP1PP/RNBQKBNR w KQkq - 0 1",
      goal: { t: "capture", n: 6 }, ai: { depth: 8, noise: 0, blunder: 0, ms: 1900, book: 10, style: { aggr: 0.8, mob: 1.2 } } },
    { t: ["Каталонское начало", "Catalan Opening", "Чёрными против позиционного давления. Не потеряй ферзя и дождись шанса.", "Black against positional pressure. Keep your queen and wait for a chance."],
      bot: ["Зайцев", "Zaitsev", "b", "pos"], moves: "d2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1", color: "b",
      goal: { t: "keepQueen" }, ai: { depth: 8, noise: 0, blunder: 0, ms: 2200, style: { pawn: 1.5, mob: 1.4, king: 1.1 } } },
    { t: ["Гроссмейстер", "Grandmaster", "Финальный босс. Полная сила, дебютная книга и ни одного шанса на ошибку.", "The final boss. Full strength, an opening book and no room for error."],
      bot: ["Ярослав", "Yaroslav", "k", "solid"], goal: { t: "check", n: 3 },
      ai: { depth: 10, noise: 0, blunder: 0, ms: 2600, book: 14, style: { king: 1.2, pawn: 1.2, mob: 1.1 } } }
  ]
};

/* строки: названия, описания, имена ботов, стили, цели, описания рангов */
(function () {
  const en = {}, ru = {};
  Object.keys(LEVEL_SPECS).forEach(tier => LEVEL_SPECS[tier].forEach((s, i) => {
    const id = `${tier}-${i + 1}`;
    ru[`lv.${id}.t`] = s.t[0]; en[`lv.${id}.t`] = s.t[1];
    ru[`lv.${id}.d`] = s.t[2]; en[`lv.${id}.d`] = s.t[3];
    ru[`bot.${id}`] = s.bot[0]; en[`bot.${id}`] = s.bot[1];
  }));
  Object.assign(I18N.en, en, {
    "tier.beginner.desc": "Gentle opponents with handicaps and special set-ups. Learn the basics.",
    "tier.intermediate.desc": "Club players who think ahead. Real openings, imbalances and tactics.",
    "tier.pro.desc": "Strong opponents with an opening book and deeper search — tough, but they still make human mistakes.",
    "style.fresh": "Beginner", "style.aggr": "Attacker", "style.solid": "Solid", "style.tactic": "Tactician",
    "style.endgame": "Endgame", "style.pos": "Positional", "style.gambit": "Gambiteer",
    "goal.title": "Bonus goal", "goal.done": "Goal complete", "goal.fail": "Goal missed",
    "goal.moves": "Win in {n} moves or fewer", "goal.capture": "Capture {n} enemy pieces",
    "goal.check": "Give check {n} times", "goal.castle": "Castle at least once",
    "goal.promote": "Promote a pawn", "goal.keepQueen": "Win without losing your queen",
    "goal.lose0": "Win without losing a piece", "goal.losePieces": "Win losing at most {n} pieces (pawns don't count)",
    "goal.star": "Complete it without hints for the third star",
    "goal.resultOk": "Bonus goal complete — 3rd star!", "goal.resultFail": "Bonus goal missed — the third star needs it.",
    "level.current": "Current", "level.play": "Play", "level.goalShort": "Goal",
    "level.progress": "{a} of {b} cleared", "jump.level": "Current level", "jump.puzzle": "Current puzzle",
    "jump.all": "All cleared", "jump.to": "Go to {x}",
    "match.thinking": "Thinking", "match.you": "You", "match.material": "Material", "match.captured": "Captured",
    "match.ahead": "+{n}", "match.odds": "Handicap game", "match.movesUsed": "Moves {a}/{b}",
    "match.mateIn": "Mate in {n}", "match.movesLeftChip": "{a} of {b} moves used", "match.puzzleGoal": "Deliver checkmate in {n}"
  });
  Object.assign(I18N.ru, ru, {
    "tier.beginner.desc": "Мягкие соперники с форой и особыми расстановками. Учимся основам.",
    "tier.intermediate.desc": "Клубные игроки, которые считают наперёд. Настоящие дебюты, дисбалансы и тактика.",
    "tier.pro.desc": "Сильные соперники: дебютная книга и глубокий расчёт — трудно, но и они ошибаются, как люди.",
    "style.fresh": "Новичок", "style.aggr": "Атакующий", "style.solid": "Надёжный", "style.tactic": "Тактик",
    "style.endgame": "Эндшпильщик", "style.pos": "Позиционный", "style.gambit": "Гамбитёр",
    "goal.title": "Бонус-цель", "goal.done": "Цель выполнена", "goal.fail": "Цель не выполнена",
    "goal.moves": "Победи не более чем за {n} ходов", "goal.capture": "Возьми {n} фигур(ы) соперника",
    "goal.check": "Объяви шах {n} раз(а)", "goal.castle": "Сделай рокировку",
    "goal.promote": "Проведи пешку в фигуру", "goal.keepQueen": "Победи, не потеряв ферзя",
    "goal.lose0": "Победи, не потеряв ни одной фигуры", "goal.losePieces": "Победи, потеряв не больше {n} фигур (пешки не считаются)",
    "goal.star": "Выполни без подсказок — и получишь третью звезду",
    "goal.resultOk": "Бонус-цель выполнена — третья звезда!", "goal.resultFail": "Бонус-цель не выполнена — для третьей звезды она нужна.",
    "level.current": "Текущий", "level.play": "Играть", "level.goalShort": "Цель",
    "level.progress": "Пройдено {a} из {b}", "jump.level": "К текущему уровню", "jump.puzzle": "К текущей задаче",
    "jump.all": "Всё пройдено", "jump.to": "Перейти: {x}",
    "match.thinking": "Думает", "match.you": "Вы", "match.material": "Материал", "match.captured": "Взято",
    "match.ahead": "+{n}", "match.odds": "Партия с форой", "match.movesUsed": "Ходы {a}/{b}",
    "match.mateIn": "Мат в {n}", "match.movesLeftChip": "Ходов использовано: {a} из {b}", "match.puzzleGoal": "Поставьте мат за {n}"
  });
})();

/* сила бота -> настройки поиска (см. chooseAiMoveAsync) */
/* ЕДИНАЯ ШКАЛА СЛОЖНОСТИ: 24 ступени, каждая чуть сильнее предыдущей (проверено матчами бот против бота).
   [глубина, шум оценки (сантипешки), шанс «человеческой» ошибки, мс на ход, тихий поиск]
   Чем меньше шум и ошибки — тем сильнее бот. Даже «Гроссмейстер» играет неидеально, поэтому его можно победить. */
const DIFFICULTY_RAMP = [
  [1, 320, 0.40, 120, false], [1, 280, 0.34, 120, false], [1, 240, 0.28, 120, false], [2, 210, 0.24, 150, false],
  [2, 180, 0.20, 150, false], [2, 150, 0.17, 150, true], [2, 125, 0.14, 180, true], [3, 150, 0.14, 250, true],
  [3, 135, 0.12, 300, true], [3, 120, 0.11, 300, true], [3, 105, 0.10, 350, true], [3, 95, 0.09, 350, true],
  [4, 120, 0.10, 400, true], [4, 108, 0.09, 450, true], [4, 98, 0.08, 450, true], [4, 90, 0.075, 500, true],
  [4, 82, 0.07, 550, true], [4, 76, 0.065, 600, true], [4, 70, 0.06, 650, true], [4, 66, 0.055, 700, true],
  [5, 90, 0.06, 800, true], [5, 80, 0.055, 850, true], [5, 70, 0.05, 900, true], [5, 62, 0.045, 1000, true]
];
const TIER_OFFSET = { beginner: 0, intermediate: 8, pro: 16 };

function buildLevels(tierId, xpStart, coinStart) {
  const specs = LEVEL_SPECS[tierId], count = specs.length;
  return specs.map((s, i) => {
    const tt = i / (count - 1);
    const ai = Object.assign({}, s.ai);
    const rp = DIFFICULTY_RAMP[TIER_OFFSET[tierId] + i];
    if (rp) { ai.depth = rp[0]; ai.noise = rp[1]; ai.blunder = rp[2]; ai.ms = rp[3]; if (rp[4]) delete ai.quiesce; else ai.quiesce = false; }
    const style = BOT_STYLES[s.bot[3]];
    const w = Object.assign({}, style && style.w || {}, ai.style || {});
    ai.style = Object.keys(w).length ? w : null;
    return {
      id: `${tierId}-${i + 1}`,
      tier: tierId,
      index: i + 1,
      depth: ai.depth,
      blunder: ai.blunder || 0,
      ai,
      botPiece: s.bot[2],
      botStyle: s.bot[3],
      fen: s.fen || null,
      moves: s.moves || null,
      color: s.color || null,
      goal: s.goal || null,
      xp: Math.round(xpStart + tt * xpStart * 0.8),
      coins: Math.round(coinStart + tt * coinStart * 0.8)
    };
  });
}

const LEVELS = {
  beginner: buildLevels("beginner", 20, 12),
  intermediate: buildLevels("intermediate", 40, 25),
  pro: buildLevels("pro", 80, 50)
};

const ALL_LEVELS = [...LEVELS.beginner, ...LEVELS.intermediate, ...LEVELS.pro];

/* удобные подписи для интерфейса */
function levelTitle(level) { return t(`lv.${level.id}.t`); }
function levelDesc(level) { return t(`lv.${level.id}.d`); }
function levelBotName(level) { return t(`bot.${level.id}`); }
function levelBotStyle(level) { return t((BOT_STYLES[level.botStyle] || BOT_STYLES.fresh).key); }
function goalText(goal) {
  if (!goal) return "";
  if (goal.t === "losePieces") return goal.n === 0 ? t("goal.lose0") : t("goal.losePieces", { n: goal.n });
  return t(`goal.${goal.t}`, { n: goal.n });
}

/* ---------- tactics puzzles ----------
   Every position below was generated and then proven by exhaustive search (a full minimax
   "mate in N" prover, not a single scripted line) to be a genuine forced mate in exactly the
   stated number of the player's own moves against ANY legal defence. Because the proof holds
   against every reply, the in-app opponent can play its normal search engine here instead of a
   scripted line — the puzzle is solved the moment the player delivers checkmate within the move
   budget, however the game actually goes. */
const PUZZLE_TIERS = {
  mate2: { labelKey: "tier.mate2", movesAllowed: 2, depth: 3 },
  mate3: { labelKey: "tier.mate3", movesAllowed: 3, depth: 3 }
};

function buildPuzzleTier(tierId, fens) {
  const cfg = PUZZLE_TIERS[tierId];
  return fens.map((fen, i) => ({
    id: `${tierId}-${i + 1}`,
    tier: tierId,
    index: i + 1,
    isPuzzle: true,
    fen,
    movesAllowed: cfg.movesAllowed,
    depth: cfg.depth,
    xp: tierId === "mate2" ? 25 : 45,
    coins: tierId === "mate2" ? 15 : 30
  }));
}

const PUZZLES = {
  mate2: buildPuzzleTier("mate2", [
    "1k6/8/8/K7/8/8/2Q5/8 w - - 0 1",
    "6k1/8/5K2/8/8/8/8/2Q5 w - - 0 1",
    "4k3/2Q5/8/6K1/8/8/8/8 w - - 0 1",
    "2k5/5Q2/K7/8/8/8/8/8 w - - 0 1",
    "7k/1Q6/8/4K3/8/8/8/8 w - - 0 1",
    "8/8/Q7/8/8/7k/5K2/8 w - - 0 1"
  ]),
  mate3: buildPuzzleTier("mate3", [
    "8/8/2R5/8/2K5/8/8/k7 w - - 0 1",
    "8/7k/4K3/R7/8/8/8/8 w - - 0 1",
    "8/8/5R2/8/8/5K2/7k/8 w - - 0 1",
    "8/8/8/3K3R/k7/8/8/8 w - - 0 1",
    "8/8/8/8/2R1K3/8/7k/8 w - - 0 1",
    "8/8/8/8/8/2R5/4K3/6k1 w - - 0 1"
  ])
};

const ALL_PUZZLES = [...PUZZLES.mate2, ...PUZZLES.mate3];

const ACHIEVEMENTS = [
  { id: "first-win", icon: "pawn", coins: 25,
    test: s => s.stats.wins >= 1 },
  { id: "novice-grad", icon: "knight", coins: 60,
    test: s => LEVELS.beginner.every(l => s.completed.includes(l.id)) },
  { id: "club-grad", icon: "bishop", coins: 90,
    test: s => LEVELS.intermediate.every(l => s.completed.includes(l.id)) },
  { id: "grandmaster", icon: "queen", coins: 120,
    test: s => LEVELS.pro.every(l => s.completed.includes(l.id)) },
  { id: "flawless", icon: "king", coins: 40,
    test: s => s.stats.hintlessWins >= 1 },
  { id: "quickmate", icon: "bolt", coins: 40,
    test: s => s.stats.fastestWin !== null && s.stats.fastestWin <= 20 },
  { id: "persistent", icon: "clock", coins: 30,
    test: s => s.stats.gamesPlayed >= 10 },
  { id: "collector", icon: "palette", coins: 35,
    test: s => s.owned.length >= 3 },
  { id: "century", icon: "star", coins: 50,
    test: s => s.xp >= 500 },
  { id: "tactician", icon: "puzzle", coins: 45,
    test: s => s.completedPuzzles.length >= 6 },
  { id: "full-house", icon: "trophy", coins: 150,
    test: s => ALL_LEVELS.every(l => s.completed.includes(l.id)) && ALL_PUZZLES.every(p => s.completedPuzzles.includes(p.id)) },
  { id: "streak-3", icon: "flame", coins: 30, test: s => s.streak.best >= 3 },
  { id: "streak-7", icon: "flame", coins: 70, test: s => s.streak.best >= 7 },
  { id: "streak-30", icon: "flame", coins: 150, test: s => s.streak.best >= 30 }
];

/* ---------- streak (огонёк) ----------
   A "day" is a calendar day on the player's device (ends at local midnight). Finishing one game
   (3+ of your own moves, win/lose/draw) or solving one puzzle keeps the flame alive.
   Missed days are covered automatically by Streak Freezes, one freeze per missed day. */
const STREAK_CONFIG = {
  freezePrice: 100,
  maxFreezes: 2,
  dailyBonus: 10,                       // coins for the first activity of each day
  minMovesForGame: 3,                   // stops "start and instantly resign" farming
  milestones: { 3: 20, 7: 50, 14: 100, 30: 250, 60: 300, 100: 500 },  // extra coins at these day counts
  freezeMilestones: [7, 30, 60]         // these also gift one free freeze (if below the cap)
};

// Board themes: css custom properties applied to the board when equipped.
// Kept fairly muted on purpose — easy on the eyes for long sessions, and every piece pairing
// still gets a readable outline (see styles.css) regardless of which theme is equipped.
const BOARD_THEMES = [
  { id: "board-classic", type: "board", nameKey: "shop.board-classic", price: 0,
    vars: { "--sq-light": "#5b5f82", "--sq-dark": "#2b2d46", "--sq-active": "#b8adff" } },
  { id: "board-slate", type: "board", nameKey: "shop.board-slate", price: 120,
    vars: { "--sq-light": "#66707f", "--sq-dark": "#2f343e", "--sq-active": "#9fd0ea" } },
  { id: "board-rose", type: "board", nameKey: "shop.board-rose", price: 220,
    vars: { "--sq-light": "#7a5f75", "--sq-dark": "#3a2a3c", "--sq-active": "#ffb3d0" } },
  { id: "board-emerald", type: "board", nameKey: "shop.board-emerald", price: 320,
    vars: { "--sq-light": "#4f7266", "--sq-dark": "#22332d", "--sq-active": "#7de3bd" } },
  { id: "board-gold", type: "board", nameKey: "shop.board-gold", price: 450,
    vars: { "--sq-light": "#7a6a48", "--sq-dark": "#3a311c", "--sq-active": "#f2c977" } },
  { id: "board-teal", type: "board", nameKey: "shop.board-teal", price: 600,
    vars: { "--sq-light": "#4f7482", "--sq-dark": "#1f3138", "--sq-active": "#7fdcea" } }
];

// Piece styles: recolor the unicode glyphs. Fills stay well clear of near-black/near-white so
// pieces read clearly against either square colour; the CSS outline does the rest.
const PIECE_THEMES = [
  { id: "pieces-classic", type: "pieces", nameKey: "shop.pieces-classic", price: 0,
    vars: { "--pc-white": "#f8f4e6", "--pc-black": "#14131e" } },
  { id: "pieces-ivory", type: "pieces", nameKey: "shop.pieces-ivory", price: 100,
    vars: { "--pc-white": "#fff6dc", "--pc-black": "#231a33" } },
  { id: "pieces-teal", type: "pieces", nameKey: "shop.pieces-teal", price: 280,
    vars: { "--pc-white": "#c4f2f2", "--pc-black": "#2e1630" } },
  { id: "pieces-gold", type: "pieces", nameKey: "shop.pieces-gold", price: 480,
    vars: { "--pc-white": "#f7e3a3", "--pc-black": "#33210d" } }
];

const SHOP_ITEMS = [...BOARD_THEMES, ...PIECE_THEMES];
const DEFAULT_OWNED = ["board-classic", "pieces-classic"];