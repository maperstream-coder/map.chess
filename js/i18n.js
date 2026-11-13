/* maper.chess — i18n
   Tiny dictionary-based translation layer. No frameworks: t(key, vars) looks up a string and
   fills in {placeholders}; translatePage() walks every [data-i18n] element in the static HTML
   and sets its text. Anything generated dynamically in ui.js calls t() directly. */

const I18N = {
  en: {
    "brand.eyebrow": "Free · No sign-up",
    "hero.title": "Learn chess by<br>playing, not reading.",
    "hero.sub": "Work through Novice, Club Player and Master levels, then sharpen your eye with Tactics — short forced-mate puzzles. Beat a level, bank XP and coins, unlock new boards.",
    "btn.startPlaying": "Start playing",
    "btn.visitShop": "Visit shop",
    "stat.solved": "Levels cleared",
    "stat.winrate": "Win rate",
    "stat.total": "Total progress",
    "continue.label": "Continue",
    "continue.allClearedTitle": "All levels cleared!",
    "continue.allClearedSub": "Replay anything from the Levels tab.",
    "continue.sub": "{tier} · Level {index} of 8",
    "tip.title": "How it works.",
    "tip.body": "Every game level is played against the maper.chess engine — win it to clear the level. Tactics levels are short puzzles: find the forced checkmate within the move limit.",
    "nav.home": "Home",
    "nav.levels": "Levels",
    "nav.achievements": "Awards",
    "nav.shop": "Shop",
    "view.levels.title": "Levels",
    "view.achievements.title": "Achievements",
    "view.shop.title": "Shop",
    "tier.beginner": "Novice",
    "tier.intermediate": "Club Player",
    "tier.pro": "Master",
    "tier.mate2": "Mate in 2",
    "tier.mate3": "Mate in 3",
    "level.tapToPlay": "Tap to play",
    "level.tapToSolve": "Tap to solve",
    "level.locked": "🔒 Locked",
    "level.solved": "✓ Solved",
    "level.mateBadge": "Mate in {n}",
    "game.yourMove": "Your move",
    "game.engineThinking": "Engine is thinking…",
    "game.youInCheck": "You're in check!",
    "game.engineInCheck": "Engine is in check.",
    "game.hint": "Hint: try {from} → {to}",
    "game.findMate": "White to move — find mate in {n}.",
    "game.movesLeft": "{n} move left|{n} moves left",
    "btn.hint": "💡 Hint",
    "btn.undo": "↺ Undo",
    "btn.resign": "⚑ Resign",
    "confirm.resign": "Resign this game?",
    "confirm.giveUp": "Give up on this puzzle?",
    "confirm.reset": "Reset all progress? Coins, XP, cleared levels, achievements and shop items will be lost.",
    "mode.games": "Games",
    "mode.tactics": "Tactics",
    "toast.progressReset": "Progress reset.",
    "toast.achievementUnlocked": "Achievement unlocked: {name}",
    "shop.tab.boards": "Boards",
    "shop.tab.pieces": "Piece sets",
    "shop.equipped": "Equipped",
    "shop.owned": "Owned",
    "shop.priceCoins": "{n} coins",
    "shop.btn.buy": "Buy",
    "shop.btn.equip": "Equip",
    "shop.notEnoughCoins": "Not enough coins yet — clear more levels!",
    "shop.board-classic": "Classic Violet",
    "shop.board-slate": "Quiet Slate",
    "shop.board-rose": "Rose Quartz",
    "shop.board-emerald": "Emerald Contrast",
    "shop.board-gold": "Golden Royal",
    "shop.board-teal": "Deep Teal",
    "shop.pieces-classic": "Classic",
    "shop.pieces-ivory": "Ivory & Onyx",
    "shop.pieces-teal": "Teal & Plum",
    "shop.pieces-gold": "Royal Gold",
    "modal.victoryTitle": "Victory!",
    "modal.checkmatedTitle": "Checkmated",
    "modal.drawTitle": "Draw",
    "modal.drawSub": "Nobody wins this one. Want a rematch?",
    "modal.lossSub": "The engine got there first. Try again?",
    "modal.winFirstClear": "{stars} · +{xp} XP · +{coins} coins",
    "modal.winReplay": "{stars} · Level already cleared — nice replay!",
    "modal.retry": "Play again",
    "modal.next": "Next level →",
    "puzzle.solvedTitle": "Puzzle solved!",
    "puzzle.solvedFirst": "Mate in {n}, nailed it · +{xp} XP · +{coins} coins",
    "puzzle.solvedReplay": "Mate in {n} — already solved, nice replay!",
    "puzzle.failedTitle": "Not quite",
    "puzzle.failedSub": "Out of moves — the mate got away. Try again?",
    "puzzle.next": "Next puzzle →",
    "ach.first-win.name": "First Blood",
    "ach.first-win.desc": "Win your first game.",
    "ach.novice-grad.name": "Novice Graduate",
    "ach.novice-grad.desc": "Clear every Novice level.",
    "ach.club-grad.name": "Club Champion",
    "ach.club-grad.desc": "Clear every Club Player level.",
    "ach.grandmaster.name": "Grandmaster",
    "ach.grandmaster.desc": "Clear every Master level.",
    "ach.flawless.name": "Flawless Victory",
    "ach.flawless.desc": "Win a game without using a hint.",
    "ach.quickmate.name": "Speed Demon",
    "ach.quickmate.desc": "Checkmate in under 20 of your moves.",
    "ach.persistent.name": "Persistent",
    "ach.persistent.desc": "Play 10 games, win or lose.",
    "ach.collector.name": "Collector",
    "ach.collector.desc": "Own 3 shop items.",
    "ach.century.name": "Century",
    "ach.century.desc": "Earn 500 total XP.",
    "ach.tactician.name": "Tactician",
    "ach.tactician.desc": "Solve 6 tactics puzzles.",
    "ach.full-house.name": "Full House",
    "ach.full-house.desc": "Complete every level and every puzzle.",
    "streak.days": "day streak",
    "streak.doneToday": "Today's flame is safe. Come back tomorrow!",
    "streak.todayLeft": "Play a game or solve a puzzle in the next {h}h {m}m to keep your flame.",
    "streak.start": "Play one game today to light your flame.",
    "streak.lost": "Your {n}-day streak ended. Light a new one today!",
    "streak.freezeUsed": "❄ Freeze used ({n}) — your streak is safe!",
    "streak.line": "🔥 Streak: {n} · +{coins} coins",
    "shop.tab.boost": "Streak",
    "shop.freeze.name": "Streak Freeze",
    "shop.freeze.desc": "Miss a day? A freeze is used automatically and keeps your flame alive. Holds up to {max}.",
    "shop.freeze.owned": "You have {n} of {max}",
    "shop.freeze.full": "Max reached",
    "toast.freezeBought": "Freeze bought ❄",
    "ach.streak-3.name": "Spark",
    "ach.streak-3.desc": "Keep a 3-day streak.",
    "ach.streak-7.name": "On Fire",
    "ach.streak-7.desc": "Keep a 7-day streak.",
    "ach.streak-30.name": "Eternal Flame",
    "ach.streak-30.desc": "Keep a 30-day streak.",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.resetProgress": "Reset progress",
    "aria.settings": "Settings"
  },

  ru: {
    "brand.eyebrow": "Бесплатно · Без регистрации",
    "hero.title": "Учи шахматы,<br>играя, а не читая.",
    "hero.sub": "Пройди уровни «Новичок», «Клубный игрок» и «Мастер», а затем оттачивай тактику — короткие форсированные задачи на мат. Проходи уровень, копи опыт и монеты, открывай новые доски.",
    "btn.startPlaying": "Начать игру",
    "btn.visitShop": "В магазин",
    "stat.solved": "Уровней пройдено",
    "stat.winrate": "Процент побед",
    "stat.total": "Общий прогресс",
    "continue.label": "Продолжить",
    "continue.allClearedTitle": "Все уровни пройдены!",
    "continue.allClearedSub": "Переиграйте что угодно во вкладке «Уровни».",
    "continue.sub": "{tier} · Уровень {index} из 8",
    "tip.title": "Как это работает.",
    "tip.body": "Каждый игровой уровень — это настоящая партия против движка maper.chess: выиграйте её, чтобы пройти уровень. Уровни «Тактика» — это короткие задачи: найдите форсированный мат, пока хватает ходов.",
    "nav.home": "Главная",
    "nav.levels": "Уровни",
    "nav.achievements": "Награды",
    "nav.shop": "Магазин",
    "view.levels.title": "Уровни",
    "view.achievements.title": "Достижения",
    "view.shop.title": "Магазин",
    "tier.beginner": "Новичок",
    "tier.intermediate": "Клубный игрок",
    "tier.pro": "Мастер",
    "tier.mate2": "Мат в 2 хода",
    "tier.mate3": "Мат в 3 хода",
    "level.tapToPlay": "Нажмите, чтобы играть",
    "level.tapToSolve": "Нажмите, чтобы решить",
    "level.locked": "🔒 Заблокировано",
    "level.solved": "✓ Решено",
    "level.mateBadge": "Мат в {n}",
    "game.yourMove": "Ваш ход",
    "game.engineThinking": "Движок думает…",
    "game.youInCheck": "Вам шах!",
    "game.engineInCheck": "Движку шах.",
    "game.hint": "Подсказка: попробуйте {from} → {to}",
    "game.findMate": "Ход белых — найдите мат в {n} хода.",
    "game.movesLeft": "Остался {n} ход|Осталось {n} хода(ов)",
    "btn.hint": "💡 Подсказка",
    "btn.undo": "↺ Отменить",
    "btn.resign": "⚑ Сдаться",
    "confirm.resign": "Сдать эту партию?",
    "confirm.giveUp": "Сдаться в этой задаче?",
    "confirm.reset": "Сбросить весь прогресс? Монеты, опыт, пройденные уровни, достижения и вещи из магазина будут потеряны.",
    "mode.games": "Игры",
    "mode.tactics": "Тактика",
    "toast.progressReset": "Прогресс сброшен.",
    "toast.achievementUnlocked": "Достижение открыто: {name}",
    "shop.tab.boards": "Доски",
    "shop.tab.pieces": "Фигуры",
    "shop.equipped": "Экипировано",
    "shop.owned": "Куплено",
    "shop.priceCoins": "{n} монет",
    "shop.btn.buy": "Купить",
    "shop.btn.equip": "Экипировать",
    "shop.notEnoughCoins": "Пока не хватает монет — пройдите ещё уровни!",
    "shop.board-classic": "Классика Violet",
    "shop.board-slate": "Тихий сланец",
    "shop.board-rose": "Розовый кварц",
    "shop.board-emerald": "Изумрудный контраст",
    "shop.board-gold": "Королевское золото",
    "shop.board-teal": "Глубокий бирюзовый",
    "shop.pieces-classic": "Классика",
    "shop.pieces-ivory": "Слоновая кость и оникс",
    "shop.pieces-teal": "Бирюза и слива",
    "shop.pieces-gold": "Королевское золото",
    "modal.victoryTitle": "Победа!",
    "modal.checkmatedTitle": "Мат",
    "modal.drawTitle": "Ничья",
    "modal.drawSub": "Тут никто не выиграл. Реванш?",
    "modal.lossSub": "Движок оказался быстрее. Попробуете ещё раз?",
    "modal.winFirstClear": "{stars} · +{xp} опыта · +{coins} монет",
    "modal.winReplay": "{stars} · Уровень уже пройден — приятного реванша!",
    "modal.retry": "Сыграть ещё раз",
    "modal.next": "Следующий уровень →",
    "puzzle.solvedTitle": "Задача решена!",
    "puzzle.solvedFirst": "Мат в {n} найден · +{xp} опыта · +{coins} монет",
    "puzzle.solvedReplay": "Мат в {n} — уже решено, приятного реванша!",
    "puzzle.failedTitle": "Почти",
    "puzzle.failedSub": "Ходы закончились — мат ускользнул. Попробуете ещё раз?",
    "puzzle.next": "Следующая задача →",
    "ach.first-win.name": "Первая кровь",
    "ach.first-win.desc": "Выиграйте свою первую партию.",
    "ach.novice-grad.name": "Выпускник «Новичка»",
    "ach.novice-grad.desc": "Пройдите все уровни «Новичок».",
    "ach.club-grad.name": "Клубный чемпион",
    "ach.club-grad.desc": "Пройдите все уровни «Клубный игрок».",
    "ach.grandmaster.name": "Гроссмейстер",
    "ach.grandmaster.desc": "Пройдите все уровни «Мастер».",
    "ach.flawless.name": "Безупречная победа",
    "ach.flawless.desc": "Выиграйте партию без единой подсказки.",
    "ach.quickmate.name": "Скоростной демон",
    "ach.quickmate.desc": "Поставьте мат менее чем за 20 своих ходов.",
    "ach.persistent.name": "Настойчивость",
    "ach.persistent.desc": "Сыграйте 10 партий, неважно с каким счётом.",
    "ach.collector.name": "Коллекционер",
    "ach.collector.desc": "Владейте 3 вещами из магазина.",
    "ach.century.name": "Сотня",
    "ach.century.desc": "Наберите 500 очков опыта.",
    "ach.tactician.name": "Тактик",
    "ach.tactician.desc": "Решите 6 тактических задач.",
    "ach.full-house.name": "Всё пройдено",
    "ach.full-house.desc": "Пройдите каждый уровень и каждую задачу.",
    "streak.days": "день подряд|дн. подряд",
    "streak.doneToday": "Огонёк на сегодня сохранён. Возвращайтесь завтра!",
    "streak.todayLeft": "Сыграйте партию или решите задачу в ближайшие {h} ч {m} мин, чтобы сохранить огонёк.",
    "streak.start": "Сыграйте одну партию сегодня, чтобы зажечь огонёк.",
    "streak.lost": "Серия в {n} дн. прервалась. Зажгите новую сегодня!",
    "streak.freezeUsed": "❄ Заморозка сработала ({n}) — огонёк сохранён!",
    "streak.line": "🔥 Огонёк: {n} · +{coins} монет",
    "shop.tab.boost": "Огонёк",
    "shop.freeze.name": "Заморозка огонька",
    "shop.freeze.desc": "Пропустили день? Заморозка сработает сама и сохранит огонёк. Максимум: {max}.",
    "shop.freeze.owned": "У вас {n} из {max}",
    "shop.freeze.full": "Максимум",
    "toast.freezeBought": "Заморозка куплена ❄",
    "ach.streak-3.name": "Искра",
    "ach.streak-3.desc": "Держите огонёк 3 дня подряд.",
    "ach.streak-7.name": "В огне",
    "ach.streak-7.desc": "Держите огонёк 7 дней подряд.",
    "ach.streak-30.name": "Вечный огонь",
    "ach.streak-30.desc": "Держите огонёк 30 дней подряд.",
    "settings.title": "Настройки",
    "settings.language": "Язык",
    "settings.resetProgress": "Сбросить прогресс",
    "aria.settings": "Настройки"
  }
};

const I18N_STATE = { lang: "en" };

function detectDefaultLang() {
  try {
    const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    return nav.startsWith("ru") ? "ru" : "en";
  } catch (e) {
    return "en";
  }
}

function setLang(lang) {
  I18N_STATE.lang = I18N[lang] ? lang : "en";
}

function getLang() {
  return I18N_STATE.lang;
}

// t("game.movesLeft", { n: 1 }) — a "one|other" pipe in the string picks a form by n===1.
function t(key, vars) {
  const dict = I18N[I18N_STATE.lang] || I18N.en;
  let str = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
  if (str.indexOf("|") !== -1 && vars && typeof vars.n === "number") {
    const parts = str.split("|");
    str = vars.n === 1 ? parts[0] : parts[1];
  }
  if (vars) {
    Object.keys(vars).forEach(k => {
      str = str.split(`{${k}}`).join(vars[k]);
    });
  }
  return str;
}

// Walks every element carrying data-i18n / data-i18n-html / data-i18n-title / data-i18n-aria
// and fills it in from the current dictionary. Called on init and whenever the language changes.
function translatePage(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  scope.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  scope.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  scope.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  document.documentElement.lang = I18N_STATE.lang;
}
Object.assign(I18N.en, {
  "nav.more": "More",
  "view.more.title": "More",
  "more.tradeSub": "Exchange coins, hints, freezes and skins",
  "more.friendsSub": "Requests, friends and profiles",
  "more.duelsSub": "Online games with friends"
});
Object.assign(I18N.ru, {
  "nav.more": "Ещё",
  "view.more.title": "Ещё",
  "more.tradeSub": "Обмен коинами, подсказками, морозилками и оформлениями",
  "more.friendsSub": "Заявки, друзья и профили",
  "more.duelsSub": "Онлайн-партии с друзьями"
});