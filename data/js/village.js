/* maper.chess — Ратуша v4: 3D-площадь, живые жители-фигурки, прокачка зданий, визиты в чужие деревни.
   Движок и модели — js/village-3d.js (window.VL3). Здесь: интерфейс, экономика и сохранение. Прогресс — state.village. */
(function () {
  "use strict";

  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nav.village": "Village",
    "vl.title": "Village",
    "vl.kicker": "Chess village",
    "vl.foundTitle": "Found your chess village",
    "vl.foundSub": "A living square on a chessboard. Place and upgrade buildings, watch chess-piece residents walk by the rules of the game, collect a daily tribute and invite friends to visit.",
    "vl.foundName": "Village name",
    "vl.foundPh": "e.g. Violet Hill",
    "vl.foundBtn": "Found village",
    "vl.needName": "Give the village a name first",
    "vl.founded": "The village is founded! Two residents are already on the square.",
    "vl.tab.land": "Square",
    "vl.tab.build": "Build",
    "vl.tab.folk": "Residents",
    "vl.tab.deco": "Decor",
    "vl.tab.army": "Army",
    "vl.tab.raid": "Raids",
    "vl.tab.quest": "Quests",
    "vl.tab.view": "View",
    "vl.rank": "Rank",
    "vl.prosperity": "Prosperity {n}",
    "vl.tax": "Village treasury",
    "vl.gold": "{a} of {b} 🪙",
    "vl.rate": "+{n} per hour · full in {t}",
    "vl.full": "Treasury is full! Collect before raiders come",
    "vl.goldWarn": "Raiders steal part of the uncollected treasury — collect often.",
    "vl.shield": "🛡 Shield: nobody can raid you for {t}",
    "vl.perk.prod": "+{n}% treasury income", "vl.perk.def": "+{n}% defense", "vl.perk.atk": "+{n}% attack", "vl.perk.store": "+{n}% treasury size", "vl.perk.loot": "+{n}% loot", "vl.perk.all": "+{n}% income, defense and attack",
    "vl.wheelOnly": "Wheel only", "vl.stars": "Stars {n} of 5", "vl.bonuses": "Decoration bonuses", "vl.noBonus": "None yet — buy and place decorations.", "vl.toWheel": "Spin the wheel",
    "vl.taxReady": "Tribute ready · +{n}",
    "vl.taxWait": "Collected today · next at midnight",
    "vl.taxMix": "Base {a} · buildings {b} · residents {c}",
    "vl.taxTap": "Tip: tap the coin above the hall",
    "vl.collect": "Collect",
    "vl.collected": "From the treasury: +{n} coins",
    "vl.rename": "Rename",
    "vl.renamed": "Village renamed",
    "vl.lv": "Lv. {n}",
    "vl.max": "Maxed",
    "vl.locked": "Locked",
    "vl.need": "Needs: {need}",
    "vl.upgrade": "Upgrade",
    "vl.build": "Build",
    "vl.buy": "Buy",
    "vl.use": "Use",
    "vl.using": "In use",
    "vl.owned": "Owned",
    "vl.noCoins": "Not enough coins — win games or solve puzzles.",
    "vl.built": "{name} is now level {n}",
    "vl.themeOn": "Theme applied: {name}",
    "vl.decoOn": "Decoration added: {name}",
    "vl.decoOff": "Decoration removed: {name}",
    "vl.decoRemove": "Remove",
    "vl.hint": "Town Hall is now a living 3D square — found a village, build, and watch your chess residents walk around.",
    "vl.homeTitle": "Your village",
    "vl.homeGo": "Open village",
    "vl.homeFound": "Found a village",
    "confirm.reset": "Reset all progress? Coins, XP, village, cleared levels, achievements and shop items will be lost.",
    "vl.place": "Place",
    "vl.placing": "Tap a free square",
    "vl.placeNow": "Place on the board",
    "vl.move": "Move",
    "vl.moved": "{name} moved",
    "vl.placed": "{name} stands on the square",
    "vl.tileBusy": "It does not fit there",
    "vl.pickFirst": "Choose a building, then a square",
    "vl.cancel": "Cancel",
    "vl.inspect": "On the square",
    "vl.emptyHint": "Empty square — open Build and choose a building.",
    "vl.cam": "Camera",
    "vl.cam.iso": "Isometric",
    "vl.cam.hero": "Low angle",
    "vl.cam.top": "Top-down",
    "vl.hud": "Interface",
    "vl.hud.full": "Full",
    "vl.hud.compact": "Compact",
    "vl.labels": "Names on buildings",
    "vl.labelsOn": "Shown",
    "vl.labelsOff": "Hidden",
    "vl.rot": "Turn",
    "vl.zoom": "Scale",
    "vl.viewHint": "Drag the square to turn it, pinch or use the wheel to zoom. Tap a resident to say hello.",
    "vl.uiSaved": "View saved",
    "vl.file": "{file}{rank}",
    "vl.size": "{w}×{h} squares",
    "vl.nextTax": "Next level: faster treasury",

    "vl.rank.hamlet": "Hamlet",
    "vl.rank.village": "Village",
    "vl.rank.town": "Town",
    "vl.rank.city": "City",
    "vl.rank.capital": "Capital",
    "vl.rank.kingdom": "Kingdom",

    "vl.b.hall": "Town Hall",
    "vl.b.hall.d": "The heart of the square. Every level adds floors, a clock tower, wings, a portico and finally a golden dome.",
    "vl.b.cottages": "Pawn cottages",
    "vl.b.cottages.d": "Little houses for the infantry. From one hut to a bustling hamlet with a well and fences.",
    "vl.b.stables": "Knight stables",
    "vl.b.stables.d": "A barn that grows into a stone stable with a paddock and horses.",
    "vl.b.chapel": "Bishop chapel",
    "vl.b.chapel.d": "A small chapel becomes a cathedral with twin spires and stained glass.",
    "vl.b.towers": "Rook towers",
    "vl.b.towers.d": "A wooden watchtower turns into a fortress gate with crenellated rooks.",
    "vl.b.academy": "Chess academy",
    "vl.b.academy.d": "A school with a chessboard roof, then columns, an observatory and a golden dome.",
    "vl.b.market": "Piece market",
    "vl.b.market.d": "One stall grows into a striped bazaar with banners and lanterns.",
    "vl.b.garden": "King’s garden",
    "vl.b.garden.d": "From a lone tree to topiary kings, a pond and a gold-crowned gate.",
    "vl.b.palace": "Queen’s palace",
    "vl.b.palace.d": "A marble palace with wings, a dome, towers, a portico and a crown of gold.",
    "vl.b.castle": "Royal castle",
    "vl.b.castle.d": "From a lonely keep to a walled fortress with a crowned donjon. Then it is a kingdom.",

    "vl.t.theme-dusk": "Graphite dusk",
    "vl.t.theme-dusk.d": "The native night of maper.chess — violet sky over a quiet board.",
    "vl.t.theme-dawn": "First light",
    "vl.t.theme-dawn.d": "Warm rose over the hills. Morning before the first move.",
    "vl.t.theme-forest": "Emerald file",
    "vl.t.theme-forest.d": "Deep greens, as if the board grew into a wood.",
    "vl.t.theme-winter": "Quiet slate",
    "vl.t.theme-winter.d": "Frost on the towers, snow in the air.",
    "vl.t.theme-royal": "Royal gold",
    "vl.t.theme-royal.d": "Gold tiles and a copper sunset — a hall for a queen.",
    "vl.t.theme-aurora": "Northern mate",
    "vl.t.theme-aurora.d": "An aurora over the castle. Rare, and a little theatrical.",

    "vl.d.deco-lanterns": "Square lanterns",
    "vl.d.deco-lanterns.d": "Warm lamps that glow when it gets dark.",
    "vl.d.deco-banners": "House banners",
    "vl.d.deco-banners.d": "Violet and gold flags in front of every building.",
    "vl.d.deco-fountain": "Center fountain",
    "vl.d.deco-fountain.d": "A fountain with living water. The square feels finished.",
    "vl.d.deco-statue": "Knight statue",
    "vl.d.deco-statue.d": "A golden knight on a stone pedestal.",
    "vl.d.deco-fair": "Evening fair",
    "vl.d.deco-fair.d": "Stalls, balloons and a little noise after sunset.",
    "vl.d.deco-flowers": "Flower beds",
    "vl.d.deco-flowers.d": "Meadow patches in bloom on empty squares.",
    "vl.d.deco-windmill": "Windmill",
    "vl.d.deco-windmill.d": "Slowly turning blades on the edge of the board.",

    "vl.folk.title": "Residents",
    "vl.folk.count": "{n} of {cap}",
    "vl.folk.sub": "Chess pieces walk the square by the rules: pawns step, knights jump, bishops slide on diagonals, rooks run straight. Each resident adds +1 coin to the daily tribute and sometimes finds a coin — tap the bubble.",
    "vl.folk.hire": "Hire · {n}",
    "vl.folk.add": "Add resident",
    "vl.folk.free": "Bring back (free)",
    "vl.folk.dismiss": "Send one away",
    "vl.folk.cap": "More room after Town Hall level {n}",
    "vl.folk.hired": "A new resident joined the square",
    "vl.folk.left": "A resident left the square",
    "vl.folk.skins": "Skins",
    "vl.folk.find": "Coins found today: {a} / {b}",
    "vl.folk.tap": "Tap a resident — they love attention.",
    "vl.skin.on": "Skin applied: {name}",
    "vl.find": "A resident found a coin: +{n}",
    "vl.sk.skin-classic": "Classic pawns",
    "vl.sk.skin-classic.d": "Ivory and graphite pawns. An honest start.",
    "vl.sk.skin-court": "Royal court",
    "vl.sk.skin-court.d": "Knights, bishops, rooks, a queen and a king join the pawns.",
    "vl.sk.skin-jade": "Jade guard",
    "vl.sk.skin-jade.d": "Green gemstone pieces — light jade against deep forest.",
    "vl.sk.skin-ruby": "Ruby & sapphire",
    "vl.sk.skin-ruby.d": "Two teams: crimson against royal blue.",
    "vl.sk.skin-frost": "Frost set",
    "vl.sk.skin-frost.d": "Ice-blue pieces that sparkle even in summer.",
    "vl.sk.skin-gold": "Golden court",
    "vl.sk.skin-gold.d": "Polished gold and bronze. Very expensive, very smug.",
    "vl.sk.skin-ghost": "Board spirits",
    "vl.sk.skin-ghost.d": "Glowing violet and mint ghosts that shine in the dark.",

    "vl.visit.btn": "Visit village",
    "vl.visit.own": "Open my village",
    "vl.visit.none": "{nick} has not founded a village yet",
    "vl.visit.title": "Village",
    "vl.visit.kicker": "Visiting",
    "vl.visit.mayor": "Mayor: {nick}",
    "vl.visit.back": "Back to profile",
    "vl.visit.close": "Close",
    "vl.visit.pop": "Residents",
    "vl.visit.hint": "Look around: turn the square, tap buildings and residents.",
    "vl.visit.noData": "Could not read this village",
    "vl.visit.welcome": "You are visiting {name}",
    "vl.visit.bld": "Buildings",

    "ach.village-found.name": "Founder",
    "ach.village-found.desc": "Found your chess village.",
    "ach.village-town.name": "Mayor",
    "ach.village-town.desc": "Reach Town rank in the village.",
    "ach.village-kingdom.name": "Sovereign",
    "ach.village-kingdom.desc": "Raise every village building at least once.",
    "ach.village-folk.name": "Crowd on the board",
    "ach.village-folk.desc": "Have 8 residents walking your square.",
    "ach.village-guest.name": "Guest",
    "ach.village-guest.desc": "Visit another player’s village."
  }, {
    "nav.village": "Деревня",
    "vl.title": "Деревня",
    "vl.kicker": "Шахматная деревня",
    "vl.foundTitle": "Оснуйте шахматную деревню",
    "vl.foundSub": "Живая площадь на шахматной доске. Ставьте и улучшайте здания, смотрите, как фигурки-жители ходят по правилам шахмат, собирайте дань и зовите друзей в гости.",
    "vl.foundName": "Название деревни",
    "vl.foundPh": "например, Фиолетовый холм",
    "vl.foundBtn": "Основать деревню",
    "vl.needName": "Сначала дайте деревне имя",
    "vl.founded": "Деревня основана! На площади уже гуляют двое жителей.",
    "vl.tab.land": "Площадь",
    "vl.tab.build": "Строить",
    "vl.tab.folk": "Жители",
    "vl.tab.deco": "Украшения",
    "vl.tab.army": "Войско",
    "vl.tab.raid": "Набеги",
    "vl.tab.quest": "Задания",
    "vl.tab.view": "Вид",
    "vl.rank": "Титул",
    "vl.prosperity": "Процветание {n}",
    "vl.tax": "Казна деревни",
    "vl.gold": "{a} из {b} 🪙",
    "vl.rate": "Прирост {n} в час · полная через {t}",
    "vl.full": "Казна полна! Соберите, пока не ограбили",
    "vl.goldWarn": "Грабители уносят часть несобранной казны — собирайте чаще.",
    "vl.shield": "🛡 Щит: деревню нельзя грабить ещё {t}",
    "vl.perk.prod": "+{n}% к приросту казны", "vl.perk.def": "+{n}% к обороне", "vl.perk.atk": "+{n}% к атаке", "vl.perk.store": "+{n}% к вместимости казны", "vl.perk.loot": "+{n}% к добыче", "vl.perk.all": "+{n}% к приросту, обороне и атаке",
    "vl.wheelOnly": "Только из рулетки", "vl.stars": "Звёзды {n} из 5", "vl.bonuses": "Бонусы украшений", "vl.noBonus": "Пока нет — купите и поставьте украшения.", "vl.toWheel": "Крутить рулетку",
    "vl.taxReady": "Дань готова · +{n}",
    "vl.taxWait": "Собрано сегодня · следующая в полночь",
    "vl.taxMix": "База {a} · здания {b} · жители {c}",
    "vl.taxTap": "Подсказка: нажмите на монету над ратушей",
    "vl.collect": "Собрать",
    "vl.collected": "Из казны: +{n} монет",
    "vl.rename": "Переименовать",
    "vl.renamed": "Деревня переименована",
    "vl.lv": "Ур. {n}",
    "vl.max": "Максимум",
    "vl.locked": "Закрыто",
    "vl.need": "Нужно: {need}",
    "vl.upgrade": "Улучшить",
    "vl.build": "Построить",
    "vl.buy": "Купить",
    "vl.use": "Надеть",
    "vl.using": "Используется",
    "vl.owned": "Куплено",
    "vl.noCoins": "Не хватает монет — выиграйте партии или решите задачи.",
    "vl.built": "{name} теперь {n} уровня",
    "vl.themeOn": "Тема: {name}",
    "vl.decoOn": "Украшение: {name}",
    "vl.decoOff": "Украшение снято: {name}",
    "vl.decoRemove": "Убрать",
    "vl.hint": "Новая Деревня: казна копится сама, обучайте войско, грабьте соседей и покупайте украшения за монеты!",
    "vl.homeTitle": "Ваша деревня",
    "vl.homeGo": "В деревню",
    "vl.homeFound": "Основать деревню",
    "confirm.reset": "Сбросить весь прогресс? Монеты, опыт, деревня, уровни, достижения и покупки пропадут.",
    "vl.place": "Поставить",
    "vl.placing": "Нажмите свободную клетку",
    "vl.placeNow": "Поставить на доску",
    "vl.move": "Перенести",
    "vl.moved": "{name} перенесено",
    "vl.placed": "{name} стоит на площади",
    "vl.tileBusy": "Здесь не помещается",
    "vl.pickFirst": "Выберите здание, затем клетку",
    "vl.cancel": "Отмена",
    "vl.inspect": "На площади",
    "vl.emptyHint": "Пустая клетка — откройте «Строить» и выберите здание.",
    "vl.cam": "Камера",
    "vl.cam.iso": "Изометрия",
    "vl.cam.hero": "Низкий ракурс",
    "vl.cam.top": "Сверху",
    "vl.hud": "Интерфейс",
    "vl.hud.full": "Полный",
    "vl.hud.compact": "Компактный",
    "vl.labels": "Подписи зданий",
    "vl.labelsOn": "Включены",
    "vl.labelsOff": "Скрыты",
    "vl.rot": "Поворот",
    "vl.zoom": "Масштаб",
    "vl.viewHint": "Крутите площадь пальцем или мышью, масштаб — щипком или колёсиком. Нажмите на жителя — он обрадуется.",
    "vl.uiSaved": "Вид сохранён",
    "vl.file": "{file}{rank}",
    "vl.size": "{w}×{h} клетки",
    "vl.nextTax": "Следующий уровень: казна растёт быстрее",

    "vl.rank.hamlet": "Хутор",
    "vl.rank.village": "Деревня",
    "vl.rank.town": "Городок",
    "vl.rank.city": "Город",
    "vl.rank.capital": "Столица",
    "vl.rank.kingdom": "Королевство",

    "vl.b.hall": "Ратуша",
    "vl.b.hall.d": "Сердце площади. С каждым уровнем растут этажи, появляются башня с часами, крылья, портик и наконец золотой купол.",
    "vl.b.cottages": "Домики пешек",
    "vl.b.cottages.d": "Маленькие дома для пехоты: от одной хижины до шумного хутора с колодцем и заборами.",
    "vl.b.stables": "Конюшня коней",
    "vl.b.stables.d": "Сарай, который вырастает в каменную конюшню с загоном и лошадьми.",
    "vl.b.chapel": "Капелла слона",
    "vl.b.chapel.d": "Часовня превращается в собор с двумя шпилями и витражами.",
    "vl.b.towers": "Башни ладей",
    "vl.b.towers.d": "Деревянная вышка становится крепостными воротами с зубчатыми ладьями.",
    "vl.b.academy": "Шахматная академия",
    "vl.b.academy.d": "Школа с шахматной крышей, затем колонны, обсерватория и золотой купол.",
    "vl.b.market": "Рынок фигур",
    "vl.b.market.d": "Одна палатка вырастает в полосатый базар с флагами и фонарями.",
    "vl.b.garden": "Сад короля",
    "vl.b.garden.d": "От одинокого дерева до фигурных королей из кустов, пруда и арки с золотом.",
    "vl.b.palace": "Дворец ферзя",
    "vl.b.palace.d": "Мраморный дворец с крыльями, куполом, башнями, портиком и золотой короной.",
    "vl.b.castle": "Королевский замок",
    "vl.b.castle.d": "От одинокого донжона до крепости со стенами и короной на башне. Тогда это королевство.",

    "vl.t.theme-dusk": "Графитовые сумерки",
    "vl.t.theme-dusk.d": "Родная ночь maper.chess — фиолетовое небо над тихой доской.",
    "vl.t.theme-dawn": "Первый свет",
    "vl.t.theme-dawn.d": "Тёплая роза над холмами. Утро до первого хода.",
    "vl.t.theme-forest": "Изумрудная вертикаль",
    "vl.t.theme-forest.d": "Глубокая зелень, будто доска выросла в лес.",
    "vl.t.theme-winter": "Тихий сланец",
    "vl.t.theme-winter.d": "Иней на башнях и снег в воздухе.",
    "vl.t.theme-royal": "Королевское золото",
    "vl.t.theme-royal.d": "Золотые клетки и медный закат — зал для ферзя.",
    "vl.t.theme-aurora": "Северное матование",
    "vl.t.theme-aurora.d": "Сияние над замком. Редкое и чуть театральное.",

    "vl.d.deco-lanterns": "Фонари площади",
    "vl.d.deco-lanterns.d": "Тёплые лампы, которые светятся в темноте.",
    "vl.d.deco-banners": "Хоругви дома",
    "vl.d.deco-banners.d": "Фиолетово-золотые флаги перед каждым зданием.",
    "vl.d.deco-fountain": "Фонтан в центре",
    "vl.d.deco-fountain.d": "Фонтан с живой водой. Площадь кажется законченной.",
    "vl.d.deco-statue": "Статуя коня",
    "vl.d.deco-statue.d": "Золотой конь на каменном постаменте.",
    "vl.d.deco-fair": "Вечерняя ярмарка",
    "vl.d.deco-fair.d": "Лотки, шарики и чуть шума после заката.",
    "vl.d.deco-flowers": "Клумбы",
    "vl.d.deco-flowers.d": "Цветущие лужайки на пустых клетках.",
    "vl.d.deco-windmill": "Мельница",
    "vl.d.deco-windmill.d": "Лопасти медленно крутятся на краю доски.",

    "vl.folk.title": "Жители",
    "vl.folk.count": "{n} из {cap}",
    "vl.folk.sub": "Фигурки гуляют по площади по шахматным правилам: пешки шагают, кони прыгают, слоны скользят по диагонали, ладьи бегут по прямой. Каждый житель ускоряет казну и иногда находит монетку — нажмите на пузырёк.",
    "vl.folk.hire": "Нанять · {n}",
    "vl.folk.add": "Добавить жителя",
    "vl.folk.free": "Вернуть (бесплатно)",
    "vl.folk.dismiss": "Отпустить одного",
    "vl.folk.cap": "Больше места после ратуши {n} уровня",
    "vl.folk.hired": "Новый житель пришёл на площадь",
    "vl.folk.left": "Житель ушёл с площади",
    "vl.folk.skins": "Облики",
    "vl.folk.find": "Находок сегодня: {a} из {b}",
    "vl.folk.tap": "Нажмите на жителя — он любит внимание.",
    "vl.skin.on": "Облик: {name}",
    "vl.find": "Житель нашёл монетку: +{n}",
    "vl.sk.skin-classic": "Классические пешки",
    "vl.sk.skin-classic.d": "Слоновая кость и графит. Честное начало.",
    "vl.sk.skin-court": "Королевский двор",
    "vl.sk.skin-court.d": "К пешкам присоединяются кони, слоны, ладьи, ферзь и король.",
    "vl.sk.skin-jade": "Нефритовая стража",
    "vl.sk.skin-jade.d": "Самоцветные фигуры: светлый нефрит против тёмного леса.",
    "vl.sk.skin-ruby": "Рубин и сапфир",
    "vl.sk.skin-ruby.d": "Две команды: алые против королевских синих.",
    "vl.sk.skin-frost": "Ледяной набор",
    "vl.sk.skin-frost.d": "Голубые ледяные фигуры, сверкающие даже летом.",
    "vl.sk.skin-gold": "Золотой двор",
    "vl.sk.skin-gold.d": "Полированное золото и бронза. Очень дорого, очень важно.",
    "vl.sk.skin-ghost": "Духи доски",
    "vl.sk.skin-ghost.d": "Светящиеся фиолетовые и мятные призраки, сияют в темноте.",

    "vl.visit.btn": "Посетить деревню",
    "vl.visit.own": "Открыть мою деревню",
    "vl.visit.none": "{nick} ещё не основал(а) деревню",
    "vl.visit.title": "Деревня",
    "vl.visit.kicker": "В гостях",
    "vl.visit.mayor": "Староста: {nick}",
    "vl.visit.back": "К профилю",
    "vl.visit.close": "Закрыть",
    "vl.visit.pop": "Жителей",
    "vl.visit.hint": "Осмотритесь: крутите площадь, нажимайте на здания и жителей.",
    "vl.visit.noData": "Не удалось прочитать эту деревню",
    "vl.visit.welcome": "Вы в гостях: {name}",
    "vl.visit.bld": "Здания",

    "ach.village-found.name": "Основатель",
    "ach.village-found.desc": "Оснуйте шахматную деревню.",
    "ach.village-town.name": "Староста",
    "ach.village-town.desc": "Доведите деревню до титула «Городок».",
    "ach.village-kingdom.name": "Государь",
    "ach.village-kingdom.desc": "Постройте каждое здание деревни хотя бы раз.",
    "ach.village-folk.name": "Толпа на доске",
    "ach.village-folk.desc": "Пусть по площади гуляют 8 жителей.",
    "ach.village-guest.name": "Гость",
    "ach.village-guest.desc": "Загляните в деревню другого игрока."
  });


  /* ---------- v6: шахматная деревня — позиция, мастерство, ранги ---------- */
  add({
    "vl.tab.pos": "Position",
    "vl.tab.land": "Square", "vl.tab.build": "Build", "vl.tab.army": "Army", "vl.tab.raid": "Sieges", "vl.tab.quest": "Quests", "vl.tab.folk": "Folk", "vl.tab.deco": "Decor",
    "vp.rankNext": "Next rank — {name}: {n} more building levels",
    "vp.rankTop": "The highest rank. Long live the king!",
    "vp.mastery": "Chess mastery",
    "vp.masteryVal": "{pts} points · +{p}% income and treasury",
    "vp.masterySub": "Wins, cleared levels and solved puzzles make the village richer. The better you play, the more it earns.",
    "vp.goGames": "Play a game", "vp.goDaily": "Daily challenge",
    "vp.pos.title": "Position of the realm",
    "vp.pos.sub": "Buildings stand on squares and behave like pieces. A building that is guarded by another piece pays more, a knight in the centre is worth more than on the edge.",
    "vp.pos.eval": "Evaluation",
    "vp.pos.tip": "Tap a building on the board to see the squares it controls. Rooks and queens work along lines, bishops on diagonals, knights jump, pawns guard diagonally forward.",
    "vp.pos.empty": "Build a few buildings to see the position.",
    "vp.pos.guard": "Guarded pieces", "vp.pos.guard.d": "A building guarded by another piece pays more tribute.",
    "vp.pos.center": "Centre control", "vp.pos.center.d": "Buildings on d4, e4, d5, e5 enlarge the treasury.",
    "vp.pos.fork": "Forks", "vp.pos.fork.d": "A piece that attacks three or more buildings makes the village stronger in raids.",
    "vp.pos.sel": "{name}: guards {a} · guarded by {b}",
    "vp.pos.none": "No active bonuses yet — rearrange the buildings.",
    "vp.p.k": "King", "vp.p.q": "Queen", "vp.p.r": "Rook", "vp.p.b": "Bishop", "vp.p.n": "Knight", "vp.p.p": "Pawn",
    "vp.role": "Moves like a {piece}",
    "vp.guardLine": "Guards {a} · guarded by {b}",
    "vp.cam": "Camera", "vp.labels": "Names",
    "vp.pick": "Show on the board",
    "vp.income": "Income per hour",
    "vl.hint": "The village is a chessboard: place buildings like pieces, win sieges by solving real mates and grow with every game you play."
  }, {
    "vl.tab.pos": "Позиция",
    "vl.tab.land": "Площадь", "vl.tab.build": "Стройка", "vl.tab.army": "Войско", "vl.tab.raid": "Осады", "vl.tab.quest": "Задания", "vl.tab.folk": "Жители", "vl.tab.deco": "Декор",
    "vp.rankNext": "Следующий ранг — {name}: ещё {n} ур. зданий",
    "vp.rankTop": "Высший ранг. Да здравствует король!",
    "vp.mastery": "Шахматное мастерство",
    "vp.masteryVal": "{pts} очков · +{p}% к доходу и казне",
    "vp.masterySub": "Победы, пройденные уровни и решённые задачи обогащают деревню. Чем лучше вы играете, тем больше она приносит.",
    "vp.goGames": "Сыграть партию", "vp.goDaily": "Ежедневная задача",
    "vp.pos.title": "Позиция королевства",
    "vp.pos.sub": "Здания стоят на клетках и ведут себя как фигуры. Здание под защитой другой фигуры платит больше, а конь в центре ценнее коня на краю.",
    "vp.pos.eval": "Оценка",
    "vp.pos.tip": "Нажмите на здание на доске — увидите клетки, которые оно контролирует. Ладьи и ферзи работают по линиям, слоны по диагоналям, кони прыгают, пешки защищают по диагонали вперёд.",
    "vp.pos.empty": "Постройте несколько зданий, чтобы увидеть позицию.",
    "vp.pos.guard": "Защищённые фигуры", "vp.pos.guard.d": "Здание под защитой другой фигуры платит больше дани.",
    "vp.pos.center": "Контроль центра", "vp.pos.center.d": "Здания на d4, e4, d5, e5 увеличивают казну.",
    "vp.pos.fork": "Вилки", "vp.pos.fork.d": "Фигура, атакующая три здания и больше, делает деревню сильнее в набегах.",
    "vp.pos.sel": "{name}: защищает {a} · под защитой {b}",
    "vp.pos.none": "Активных бонусов пока нет — переставьте здания.",
    "vp.p.k": "Король", "vp.p.q": "Ферзь", "vp.p.r": "Ладья", "vp.p.b": "Слон", "vp.p.n": "Конь", "vp.p.p": "Пешка",
    "vp.role": "Ходит как {piece}",
    "vp.guardLine": "Защищает {a} · под защитой {b}",
    "vp.cam": "Камера", "vp.labels": "Названия",
    "vp.pick": "Показать на доске",
    "vp.income": "Доход в час",
    "vl.hint": "Деревня — это шахматная доска: расставляйте здания как фигуры, берите осады, решая настоящие маты, и растите с каждой сыгранной партией."
  });

  /* ---------- ЭКОНОМИКА ----------
     Цена уровня = base · grow^(уровень−1), округлена до 5. Дань в день = 6 + 0,75·Σ(уровень·tax) + жители.
     Цель баланса: первое здание — пара задач, середина — несколько дней, финал — месяцы игры. */
  const BUILD = [
    { id: "hall",     max: 10, base: 30,  grow: 1.55, tax: 3, glyph: "♜", need: {} },
    { id: "cottages", max: 8,  base: 20,  grow: 1.5,  tax: 1, glyph: "♟", need: { hall: 1 } },
    { id: "garden",   max: 6,  base: 30,  grow: 1.5,  tax: 1, glyph: "♚", need: { hall: 1 } },
    { id: "stables",  max: 6,  base: 40,  grow: 1.55, tax: 2, glyph: "♞", need: { cottages: 1 } },
    { id: "academy",  max: 6,  base: 55,  grow: 1.58, tax: 2, glyph: "♝", need: { hall: 2 } },
    { id: "market",   max: 6,  base: 50,  grow: 1.55, tax: 2, glyph: "♟", need: { cottages: 2 } },
    { id: "chapel",   max: 6,  base: 65,  grow: 1.58, tax: 2, glyph: "♝", need: { hall: 2 } },
    { id: "towers",   max: 6,  base: 90,  grow: 1.6,  tax: 3, glyph: "♜", need: { hall: 3 } },
    { id: "palace",   max: 6,  base: 170, grow: 1.68, tax: 4, glyph: "♛", need: { hall: 5, towers: 1 } },
    { id: "castle",   max: 6,  base: 280, grow: 1.72, tax: 5, glyph: "♚", need: { hall: 6, palace: 1 } }
  ];
  const BMAP = Object.fromEntries(BUILD.map(b => [b.id, b]));
  const SEED = {
    hall: [3, 3], castle: [0, 0], palace: [6, 0], chapel: [2, 2], academy: [5, 2], towers: [7, 4],
    garden: [0, 5], cottages: [1, 6], stables: [6, 6], market: [4, 6]
  };
  const PLACE_ORDER = ["hall", "castle", "palace", "chapel", "academy", "towers", "market", "garden", "cottages", "stables"];
  const THEMES = [
    { id: "theme-dusk",   price: 0 },
    { id: "theme-dawn",   price: 90 },
    { id: "theme-forest", price: 110 },
    { id: "theme-winter", price: 130 },
    { id: "theme-royal",  price: 180 },
    { id: "theme-aurora", price: 220 }
  ];
  const DECOS = [
    { id: "deco-flowers",  price: 35 },
    { id: "deco-lanterns", price: 40 },
    { id: "deco-banners",  price: 55 },
    { id: "deco-fountain", price: 90 },
    { id: "deco-statue",   price: 120 },
    { id: "deco-fair",     price: 150 },
    { id: "deco-windmill", price: 210 }
  ];
  const FILES = "abcdefgh";
  const TAX_BASE = 6, TAX_K = 0.75, FOLK_MAX = 12;
  const footOf = id => (window.VL3 ? VL3.footOf(id) : [1, 1]);
  /* какой фигурой «ходит» здание — от этого зависят связи на доске */
  const PIECE = { hall: "k", garden: "k", castle: "r", towers: "r", palace: "q", chapel: "b", academy: "b", stables: "n", cottages: "p", market: "p" };
  const P_GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

  if (typeof ACHIEVEMENTS !== "undefined") {
    [
      ["village-found", "♜", 25, s => !!(s.village && s.village.founded)],
      ["village-town", "♜", 60, s => prosperity(ensure(s)) >= 10],
      ["village-kingdom", "♚", 150, s => BUILD.every(b => ((s.village && s.village.b) || {})[b.id] >= 1)],
      ["village-folk", "♟", 40, s => !!(s.village && s.village.folk && s.village.folk.n >= 8)],
      ["village-guest", "♞", 20, s => !!(s.flags && s.flags.villageGuest)]
    ].forEach(([id, icon, coins, test]) => {
      if (!ACHIEVEMENTS.some(a => a.id === id)) ACHIEVEMENTS.push({ id, icon, coins, test });
    });
  }

  let tab = "land", root = null, placing = null, selected = null;
  let scene = null, stageEl = null, foundScene = null, foundEl = null, shell = "";
  const thumbCache = {};

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sfx = (n) => { try { if (window.Sfx && Sfx[n]) Sfx[n](); } catch (e) {} };
  const toast = (k, v) => { try { UI._toast(t(k, v || {})); } catch (e) {} };
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  /* ---------- состояние ---------- */
  function ensure(state) {
    const v = state.village || (state.village = defaultVillage());
    if (!v.plot) v.plot = {};
    if (!v.ui) v.ui = defaultVillageUi();
    if (!v.folk) v.folk = { n: 0, max: 0, skin: "skin-classic" };
    if (!v.find) v.find = { d: null, n: 0 };
    if (!v.b) v.b = {};
    if (!v.owned) v.owned = ["theme-dusk"];
    if (!v.deco) v.deco = [];
    return v;
  }
  function st() { return UI.state ? ensure(UI.state) : defaultVillage(); }
  function persist() { saveState(UI.state); UI.renderTopbar(); }
  function save() { saveState(UI.state); }
  function today() { try { return typeof normToday === "function" ? normToday(UI.state) : dayKey(); } catch (e) { return dayKey(); } }
  function lv(id, v) { return Math.max(0, +(v || st()).b[id] || 0); }
  function prosperity(v) { v = v || st(); return BUILD.reduce((n, b) => n + (+v.b[b.id] || 0), 0); }
  const RANKS = [["hamlet", 0, "♟"], ["village", 3, "♞"], ["town", 10, "♝"], ["city", 20, "♜"], ["capital", 35, "♛"], ["kingdom", 55, "♚"]];
  function rankIdx(n) { let i = 0; RANKS.forEach((r, k) => { if (n >= r[1]) i = k; }); return i; }
  function rankKey(n) {
    if (n >= 55) return "kingdom";
    if (n >= 35) return "capital";
    if (n >= 20) return "city";
    if (n >= 10) return "town";
    if (n >= 3) return "village";
    return "hamlet";
  }
  function taxParts(v) {
    v = v || st();
    const raw = BUILD.reduce((n, b) => n + (+v.b[b.id] || 0) * b.tax, 0);
    const a = TAX_BASE, b = Math.floor(raw * TAX_K), c = (v.folk && v.folk.n) || 0;
    return { a, b, c, total: a + b + c };
  }
  function taxOf(v) { return taxParts(v).total; }

  /* ---------- v5: казна, украшения со звёздами, расширения ----------
     Казна копится сама (в час = дань/12 · бонусы), её размер ограничен. Несобранную казну могут ограбить другие игроки. */
  const DECO_RAR = { "deco-flowers": 0, "deco-lanterns": 0, "deco-banners": 1, "deco-fountain": 1, "deco-statue": 2, "deco-fair": 2, "deco-windmill": 3, "theme-royal": 3, "theme-aurora": 4 };
  const PERK = { "deco-flowers": ["prod", 4], "deco-lanterns": ["def", 5], "deco-banners": ["atk", 5], "deco-fountain": ["store", 10], "deco-statue": ["def", 7], "deco-fair": ["prod", 7], "deco-windmill": ["prod", 10], "theme-royal": ["loot", 6], "theme-aurora": ["all", 5] };
  const WHEEL_ONLY = {};   /* рулетки больше нет — все предметы покупаются за монеты */
  const DUP_COINS = [25, 50, 100, 200, 400];
  const EXT = { tabs: [], html: {}, act: {}, on: [], landTop: [], packW: null, tick: [] };
  function emit(k, n) { EXT.on.forEach(f => { try { f(k, n); } catch (e) { console.warn(e); } }); }
  function vx(s) {
    s = s || UI.state;
    if (!s) return { gold: 0, t: Date.now(), stars: {} };
    const x = (s.vx && typeof s.vx === "object" && !Array.isArray(s.vx)) ? s.vx : (s.vx = {});
    if (!Number.isFinite(+x.gold) || +x.gold < 0) x.gold = 0;
    if (!Number.isFinite(+x.t) || +x.t <= 0 || +x.t > Date.now() + 6e4) x.t = Date.now();
    if (!x.stars || typeof x.stars !== "object") x.stars = {};
    return x;
  }
  function owns(id, v) { v = v || st(); return v.owned.includes(id) || v.deco.includes(id); }
  function starOf(id, v) { v = v || st(); if (!owns(id, v)) return 0; return clamp(Math.floor(+vx().stars[id] || 1), 1, 5); }
  function perkPct(id, v) { const p = PERK[id]; return p ? p[1] * Math.max(1, starOf(id, v)) : 0; }
  /* ---------- позиция: здания как фигуры ---------- */
  const DIRS = { r: [[1, 0], [-1, 0], [0, 1], [0, -1]], b: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
  DIRS.q = DIRS.r.concat(DIRS.b);
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  let posCache = { sig: "", val: null };
  function cellsOf(id, v) {
    const p = parsePlot(v.plot[id]); if (!p) return [];
    const f = footOf(id), out = [];
    for (let i = 0; i < f[0]; i++) for (let j = 0; j < f[1]; j++) out.push([p[0] + i, p[1] + j]);
    return out;
  }
  function posInfo(v) {
    v = v || st();
    const sig = JSON.stringify([v.b, v.plot]);
    if (v === st() && posCache.sig === sig && posCache.val) return posCache.val;
    const occ = {}, ids = [];
    BUILD.forEach(b => { if (lv(b.id, v) < 1) return; const cs = cellsOf(b.id, v); if (!cs.length) return; ids.push(b.id); cs.forEach(c => { occ[c[0] + "," + c[1]] = b.id; }); });
    const att = {}, guards = {}, guardedBy = {};
    ids.forEach(id => { guards[id] = []; guardedBy[id] = []; });
    ids.forEach(id => {
      const set = new Set(), pc = PIECE[id] || "p", own = cellsOf(id, v);
      const ok = (c, r) => c >= 0 && r >= 0 && c < 8 && r < 8;
      own.forEach(([c0, r0]) => {
        if (pc === "n") KN.forEach(d => { const c = c0 + d[0], r = r0 + d[1]; if (ok(c, r)) set.add(c + "," + r); });
        else if (pc === "k") for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { if (!dc && !dr) continue; const c = c0 + dc, r = r0 + dr; if (ok(c, r)) set.add(c + "," + r); }
        else if (pc === "p") [-1, 1].forEach(dc => { const c = c0 + dc, r = r0 - 1; if (ok(c, r)) set.add(c + "," + r); });
        else DIRS[pc].forEach(d => {
          let c = c0 + d[0], r = r0 + d[1];
          while (ok(c, r)) {
            const o = occ[c + "," + r];
            if (o === id) { c += d[0]; r += d[1]; continue; }
            set.add(c + "," + r); if (o) break;
            c += d[0]; r += d[1];
          }
        });
      });
      own.forEach(([c, r]) => set.delete(c + "," + r));
      att[id] = set;
      set.forEach(k => { const o = occ[k]; if (o && o !== id && guards[id].indexOf(o) < 0) { guards[id].push(o); guardedBy[o].push(id); } });
    });
    let nGuard = 0, nCenter = 0, nFork = 0;
    ids.forEach(id => {
      if (guardedBy[id].length) nGuard++;
      if (cellsOf(id, v).some(([c, r]) => c >= 3 && c <= 4 && r >= 3 && r <= 4)) nCenter++;
      if (guards[id].length >= 3) nFork++;
    });
    const o = { occ, ids, att, guards, guardedBy, nGuard, nCenter, nFork,
      prod: Math.min(30, nGuard * 3), store: Math.min(15, nCenter * 5), def: Math.min(20, nFork * 5), atk: Math.min(16, nFork * 4) };
    o.eval = Math.round((nGuard * 0.3 + nCenter * 0.5 + nFork * 0.4) * 10) / 10;
    if (v === st()) posCache = { sig, val: o };
    return o;
  }
  /* мастерство: чем лучше игрок играет в шахматы, тем богаче деревня */
  function masteryPts(s) {
    s = s || UI.state; if (!s) return 0;
    return (s.completed || []).length * 3 + (s.completedPuzzles || []).length + ((s.stats && s.stats.wins) || 0);
  }
  function masteryPct(s) { return Math.min(30, Math.floor(masteryPts(s) / 8)); }

  function decoBonus(kind, v) {
    v = v || st(); let n = 0;
    const act = v.deco.slice(); if (v.theme) act.push(v.theme);
    act.forEach(id => { const p = PERK[id]; if (p && (p[0] === kind || (p[0] === "all" && kind !== "store" && kind !== "loot"))) n += perkPct(id, v); });
    return n / 100;
  }
  function bonus(kind, v) {
    const own = !v || v === (UI.state && UI.state.village);
    v = v || st();
    let n = decoBonus(kind, v) * 100;
    try {
      const P = posInfo(v);
      if (kind === "prod") n += P.prod; else if (kind === "store") n += P.store; else if (kind === "def") n += P.def; else if (kind === "atk") n += P.atk;
      if (own) { const m = masteryPct(); if (kind === "prod") n += m; else if (kind === "store") n += Math.floor(m / 2); }
    } catch (e) {}
    return n / 100;
  }
  function bonusOld(kind, v) {
    v = v || st(); let n = 0;
    const act = v.deco.slice(); if (v.theme) act.push(v.theme);
    act.forEach(id => { const p = PERK[id]; if (p && (p[0] === kind || (p[0] === "all" && kind !== "store" && kind !== "loot"))) n += perkPct(id, v); });
    return n / 100;
  }
  function rateOf(v) { v = v || st(); return Math.max(1, taxOf(v) / 12) * (1 + bonus("prod", v)); }
  function capOf(v) { v = v || st(); return Math.round(Math.max(40, taxOf(v)) * (1 + 0.1 * lv("hall", v)) * (1 + bonus("store", v))); }
  function tick() {
    const v = st(); if (!v.founded || !UI.state) return 0;
    const x = vx(), now = Date.now(), cap = capOf(v);
    if (!x.init) { x.init = 1; x.gold = Math.round(cap * 0.5); x.t = now; }
    x.gold = Math.min(cap, (+x.gold || 0) + rateOf(v) * Math.max(0, now - x.t) / 3.6e6);
    x.t = now;
    return x.gold;
  }
  function goldNow() { tick(); return Math.floor(vx().gold); }
  function fmtT(ms) {
    ms = Math.max(0, ms); const m = Math.ceil(ms / 6e4);
    if (m < 60) return m + (getLangSafe() === "ru" ? " мин" : " min");
    const h = Math.floor(m / 60), mm = m % 60;
    return h + (getLangSafe() === "ru" ? " ч" : "h") + (mm ? " " + mm + (getLangSafe() === "ru" ? " мин" : "m") : "");
  }
  function getLangSafe() { try { return typeof getLang === "function" ? getLang() : "ru"; } catch (e) { return "ru"; } }
  function itemName(id) { return id.indexOf("theme-") === 0 ? t("vl.t." + id) : t("vl.d." + id); }
  /* выдача украшения нужной редкости (награды). Новое — в коллекцию, повтор — +1 звезда, если всё на 5★ — монеты */
  function grantDeco(rar, state) {
    state = state || UI.state; if (!state) return null;
    const v = ensure(state), x = vx(state);
    rar = clamp(Math.floor(+rar || 0), 0, 4);
    let pool = Object.keys(DECO_RAR).filter(id => DECO_RAR[id] === rar);
    const notMax = pool.filter(id => !(v.owned.includes(id) && (+x.stars[id] || 1) >= 5));
    if (!notMax.length) { const c = DUP_COINS[rar]; state.coins += c; return { id: pool[0], star: 5, coins: c, rar }; }
    const fresh = notMax.filter(id => !v.owned.includes(id));
    const list = fresh.length && Math.random() < 0.7 ? fresh : notMax;
    const id = list[Math.floor(Math.random() * list.length)];
    if (!v.owned.includes(id)) { v.owned.push(id); x.stars[id] = 1; emit("deco", 1); return { id, star: 1, isNew: true, rar }; }
    x.stars[id] = Math.min(5, (+x.stars[id] || 1) + 1);
    emit("deco", 1);
    return { id, star: x.stars[id], rar };
  }
  function costOf(b, next) { return Math.max(5, Math.round(b.base * Math.pow(b.grow, Math.max(0, next - 1)) / 5) * 5); }
  function unlocked(b, v) { v = v || st(); const need = b.need || {}; return Object.keys(need).every(k => (+v.b[k] || 0) >= need[k]); }
  function needLabel(b) { return Object.keys(b.need || {}).map(k => `${t("vl.b." + k)} ${t("vl.lv", { n: b.need[k] })}`).join(" · "); }
  function taxReady() { const v = st(); if (!v.founded || !UI.state) return false; const g = tick(); return g >= Math.max(3, capOf(v) * 0.12); }
  function folkCap(v) { return Math.min(FOLK_MAX, 2 + lv("hall", v)); }
  function hireCost(n) { return 15 + 10 * n + n * n; }
  function findCap(v) { return 6 + Math.floor(((v || st()).folk.n || 0) / 2); }
  function findLeft(v) { v = v || st(); const used = v.find.d === today() ? v.find.n : 0; return Math.max(0, findCap(v) - used); }
  function findValue(v) { return 1 + Math.floor(lv("market", v) / 3); }
  function parsePlot(s) { const m = String(s || "").match(/^([0-7]),([0-7])$/); return m ? [+m[1], +m[2]] : null; }
  function squareName(c, r) { return t("vl.file", { file: FILES[c] || "a", rank: 8 - r }); }
  function skinDef(id) { return (window.VL3 && VL3.SKIN_BY_ID[id]) || (window.VL3 && VL3.SKINS[0]); }

  /* ---------- клетки и размеры зданий ---------- */
  function fitsAt(id, c, r, v, ignore) {
    v = v || st();
    const f = footOf(id);
    if (c < 0 || r < 0 || c + f[0] > 8 || r + f[1] > 8) return false;
    for (const b of BUILD) {
      if (b.id === id || b.id === ignore || lv(b.id, v) < 1) continue;
      const p = parsePlot(v.plot[b.id]); if (!p) continue;
      const g = footOf(b.id);
      if (c < p[0] + g[0] && c + f[0] > p[0] && r < p[1] + g[1] && r + f[1] > p[1]) return false;
    }
    return true;
  }
  /* приводим сохранённые координаты к новым размерам зданий (ратуша, дворец и замок теперь 2×2) */
  function normalizePlots(v) {
    const taken = {}; let changed = false;
    PLACE_ORDER.forEach(id => {
      if ((+v.b[id] || 0) < 1) return;
      const f = footOf(id); let p = parsePlot(v.plot[id]);
      const ok = (c, r) => { if (c < 0 || r < 0 || c + f[0] > 8 || r + f[1] > 8) return false; for (let i = 0; i < f[0]; i++) for (let j = 0; j < f[1]; j++) if (taken[(c + i) + "," + (r + j)]) return false; return true; };
      if (!p || !ok(p[0], p[1])) {
        const pref = SEED[id] || [3, 3]; let best = null, bd = 1e9;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (ok(c, r)) { const d = Math.abs(c - pref[0]) + Math.abs(r - pref[1]); if (d < bd) { bd = d; best = [c, r]; } }
        p = best || [0, 0]; v.plot[id] = p[0] + "," + p[1]; changed = true;
      }
      for (let i = 0; i < f[0]; i++) for (let j = 0; j < f[1]; j++) taken[(p[0] + i) + "," + (p[1] + j)] = id;
    });
    return changed;
  }
  function sceneData(v) {
    return { b: v.b, plot: v.plot, theme: v.theme, deco: v.deco, folk: { n: v.folk.n, skin: v.folk.skin } };
  }

  /* ---------- сборка/распаковка для публикации в рейтинге ---------- */
  function pack(state) {
    try {
      const v = ensure(state || UI.state);
      if (!v.founded) return null;
      const b = {}, p = {};
      BUILD.forEach(x => { const l = +v.b[x.id] || 0; if (l > 0) { b[x.id] = l; if (v.plot[x.id]) p[x.id] = v.plot[x.id]; } });
      const o = { v: 2, n: v.name, b, p, t: v.theme, d: v.deco, f: [v.folk.n, v.folk.skin], y: Math.round(+v.ui.yaw || 45) };
      if (state === UI.state || !state) { try { tick(); const x = vx(); o.w = { g: Math.floor(x.gold), t: Date.now(), r: Math.round(rateOf(v) * 10) / 10, c: capOf(v) }; if (EXT.packW) Object.assign(o.w, EXT.packW(v)); } catch (e) {} }
      return JSON.stringify(o);
    } catch (e) { return null; }
  }
  function unpack(raw) {
    try {
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!o || typeof o !== "object" || !o.b) return null;
      const b = {}, plot = {};
      BUILD.forEach(x => { const l = Math.max(0, Math.min(x.max, Math.floor(+o.b[x.id] || 0))); if (l > 0) { b[x.id] = l; const q = parsePlot(o.p && o.p[x.id]); if (q) plot[x.id] = q[0] + "," + q[1]; } });
      const v = defaultVillage();
      v.founded = true; v.name = String(o.n || "").replace(/[<>]/g, "").slice(0, 20); v.b = b; v.plot = plot;
      v.theme = THEMES.some(x => x.id === o.t) ? o.t : "theme-dusk";
      v.deco = (Array.isArray(o.d) ? o.d : []).filter(x => DECOS.some(y => y.id === x));
      const f = Array.isArray(o.f) ? o.f : [0, "skin-classic"];
      v.folk = { n: clamp(Math.floor(+f[0] || 0), 0, 24), max: 0, skin: /^skin-[a-z0-9-]{1,24}$/.test(f[1]) ? f[1] : "skin-classic" };
      v.ui.yaw = +o.y || 45;
      v._w = (o.w && typeof o.w === "object") ? o.w : null;
      normalizePlots(v);
      return v;
    } catch (e) { return null; }
  }

  /* ---------- превью зданий (кэш картинок) ---------- */
  function thumb(id, level, themeId) {
    if (!window.VL3) return "";
    const key = id + "|" + level + "|" + themeId;
    if (thumbCache[key]) return thumbCache[key];
    try {
      const cv = document.createElement("canvas"), S = 112;
      cv.width = S; cv.height = S;
      const big = footOf(id)[0] === 2;
      const sc = VL3.createScene(cv, { fixedCam: true, size: [S, S], dpr: 1 });
      sc.set({ b: { [id]: level }, plot: { [id]: "3,3" }, theme: themeId, deco: [], folk: { n: 0, skin: "skin-classic" } });
      sc.setCamera({ yaw: 45, zoom: big ? 2.9 : 4.6, mode: "iso", snap: true, fx: big ? 4 : 3.5, fy: big ? 4 : 3.5, nobg: true });
      sc.overlay({ labels: false }); sc.once(0);
      thumbCache[key] = cv.toDataURL("image/png");
    } catch (e) { thumbCache[key] = ""; }
    return thumbCache[key];
  }
  function skinThumbPaint() {
    if (!root || !window.VL3) return;
    root.querySelectorAll("canvas[data-skin]").forEach(cv => {
      const sk = VL3.SKIN_BY_ID[cv.dataset.skin]; if (!sk) return;
      const ctx = cv.getContext("2d"), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
      const kinds = []; sk.set.forEach(k => { if (kinds.indexOf(k) < 0) kinds.push(k); });
      const show = (sk.set.length === 1 ? ["pawn", "pawn", "pawn", "pawn"] : kinds.slice(0, 4));
      const n = show.length, gap = W / (n + 0.4);
      show.forEach((k, i) => { VL3.drawFigure(ctx, k, gap * (i + 0.7), H - 8, H * 0.78, sk.teams[i % 2], { face: 1, glow: sk.glow }); });
    });
  }

  /* ---------- действия ---------- */
  function celebrate() {
    const newly = checkAchievements(UI.state);
    persist();
    if (newly.length) toast("toast.achievementUnlocked", { name: t("ach." + newly[0].id + ".name") });
  }
  function nickOk(name) {
    if (typeof Nick !== "undefined" && Nick.validate) {
      const err = Nick.validate(name);
      if (err && err !== "taken") { toast(Nick.errKey ? Nick.errKey(err) : "vl.needName"); return false; }
    }
    return true;
  }
  function found() {
    const v = st();
    if (v.founded) return;
    const inp = $("vl-name");
    let name = (inp && inp.value || "").trim();
    if (name.length < 2) { toast("vl.needName"); return; }
    if (!nickOk(name)) return;
    name = name.slice(0, 20);
    v.founded = true; v.name = name; v.foundedAt = Date.now();
    v.b.hall = 1; v.plot.hall = "3,3";
    v.folk = { n: 2, max: 2, skin: "skin-classic" };
    if (!v.owned.includes("theme-dusk")) v.owned.push("theme-dusk");
    v.theme = v.theme || "theme-dusk";
    placing = null; selected = "hall"; tab = "land";
    sfx("win"); celebrate(); toast("vl.founded");
    shell = ""; render(); badge();
  }
  function rename() {
    const v = st();
    if (!v.founded) return;
    const next = prompt(t("vl.foundName"), v.name || "");
    if (next == null) return;
    const name = next.trim().slice(0, 20);
    if (name.length < 2) { toast("vl.needName"); return; }
    if (!nickOk(name)) return;
    v.name = name; persist(); toast("vl.renamed"); render();
  }
  function collect() {
    const v = st();
    if (!v.founded) return;
    const n = goldNow();
    if (n < 1) return;
    UI.state.coins += n; vx().gold -= n; v.lastTax = today();
    sfx("coin"); emit("collect", n); persist(); toast("vl.collected", { n });
    syncOverlay(); renderSide(); badge();
  }
  function collectFind(z) {
    const v = st();
    if (!v.founded || findLeft(v) <= 0) { if (scene) scene.dropBubble(z); return; }
    const n = findValue(v);
    if (v.find.d !== today()) { v.find.d = today(); v.find.n = 0; }
    v.find.n++; UI.state.coins += n;
    if (scene) scene.dropBubble(z);
    sfx("coin"); persist(); toast("vl.find", { n }); renderSide();
  }
  function upgrade(id) {
    const b = BMAP[id], v = st();
    if (!b || !v.founded || !unlocked(b, v)) return false;
    const cur = lv(id, v);
    if (cur >= b.max) return false;
    const price = costOf(b, cur + 1);
    if (UI.state.coins < price) { toast("vl.noCoins"); return false; }
    UI.state.coins -= price; v.b[id] = cur + 1;
    if (!parsePlot(v.plot[id]) || !fitsAt(id, parsePlot(v.plot[id])[0], parsePlot(v.plot[id])[1], v)) { normalizePlots(v); }
    selected = id; sfx("coin"); celebrate();
    toast("vl.built", { name: t("vl.b." + id), n: v.b[id] }); emit("build", 1);
    sync(); renderSide();
    return true;
  }
  function startPlace(id, moving) {
    const b = BMAP[id], v = st();
    if (!b || !v.founded || !unlocked(b, v)) return;
    if (lv(id, v) < 1 && UI.state.coins < costOf(b, 1)) { toast("vl.noCoins"); return; }
    placing = { id, moving: !!moving };
    tab = "land"; selected = id;
    toast("vl.placing");
    syncOverlay(); renderTabs(); renderSide();
    const host = $("vl-host"); if (host && host.scrollIntoView) { try { host.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} }
  }
  function dropOn(c, r) {
    const v = st();
    if (!placing) return;
    const id = placing.id, f = footOf(id);
    const cc = Math.min(c, 8 - f[0]), rr = Math.min(r, 8 - f[1]);
    if (!fitsAt(id, cc, rr, v)) { toast("vl.tileBusy"); sfx("err"); return; }
    const was = lv(id, v), old = v.plot[id];
    v.plot[id] = cc + "," + rr;
    if (was < 1) {
      placing = null; selected = id;
      if (!upgrade(id)) { if (old) v.plot[id] = old; else delete v.plot[id]; sync(); renderSide(); syncOverlay(); }
      else { syncOverlay(); }
      return;
    }
    persist();
    toast(placing.moving ? "vl.moved" : "vl.placed", { name: t("vl.b." + id) });
    placing = null; selected = id; sfx("move");
    sync(); renderSide();
  }
  function buyTheme(id) {
    const item = THEMES.find(x => x.id === id), v = st();
    if (!item || !v.founded) return;
    if (!v.owned.includes(id)) {
      if (WHEEL_ONLY[id]) { toast("vl.wheelOnly"); return; }
      if (UI.state.coins < item.price) { toast("vl.noCoins"); return; }
      tick(); UI.state.coins -= item.price; v.owned.push(id); vx().stars[id] = 1; sfx("coin");
    }
    tick(); v.theme = id; persist(); toast("vl.themeOn", { name: t("vl.t." + id) });
    sync(); renderSide();
  }
  function buyDeco(id) {
    const item = DECOS.find(x => x.id === id), v = st();
    if (!item || !v.founded) return;
    if (v.deco.includes(id)) {
      tick(); v.deco = v.deco.filter(x => x !== id); persist(); toast("vl.decoOff", { name: t("vl.d." + id) });
      sync(); renderSide(); return;
    }
    if (!v.owned.includes(id)) {
      if (WHEEL_ONLY[id]) { toast("vl.wheelOnly"); return; }
      if (UI.state.coins < item.price) { toast("vl.noCoins"); return; }
      UI.state.coins -= item.price; v.owned.push(id); vx().stars[id] = 1; sfx("coin");
    }
    tick(); v.deco.push(id); persist(); toast("vl.decoOn", { name: t("vl.d." + id) });
    sync(); renderSide();
  }
  function hire() {
    const v = st(), f = v.folk;
    if (!v.founded || f.n >= folkCap(v)) return;
    if (f.n >= f.max) {
      const price = hireCost(f.n);
      if (UI.state.coins < price) { toast("vl.noCoins"); return; }
      UI.state.coins -= price; sfx("coin");
    }
    f.n++; f.max = Math.max(f.max, f.n);
    celebrate(); toast("vl.folk.hired"); sync(); renderSide();
  }
  function dismiss() {
    const v = st(), f = v.folk;
    if (!v.founded || f.n <= 0) return;
    f.n--; persist(); toast("vl.folk.left"); sync(); renderSide();
  }
  function skinAct(id) {
    const v = st(), sk = skinDef(id);
    if (!v.founded || !sk) return;
    if (sk.price > 0 && !v.owned.includes(id)) {
      if (UI.state.coins < sk.price) { toast("vl.noCoins"); return; }
      UI.state.coins -= sk.price; v.owned.push(id); sfx("coin");
    }
    v.folk.skin = id; persist(); toast("vl.skin.on", { name: t("vl.sk." + id) });
    sync(); renderSide();
  }
  function setUi(patch) {
    const v = st();
    Object.assign(v.ui, patch);
    v.ui.zoom = clamp(+v.ui.zoom || 1, 0.7, 1.9);
    persist(); applyCam(); syncOverlay(); renderSide();
  }

  /* ---------- сцена ---------- */
  function applyCam(snap) {
    if (!scene) return;
    const ui = st().ui;
    scene.setCamera({ mode: ui.cam || "iso", yaw: +ui.yaw || 45, zoom: +ui.zoom || 1, snap: !!snap });
  }
  function ensureScene() {
    if (scene) return;
    stageEl = document.createElement("div");
    stageEl.className = "vl-stage";
    stageEl.innerHTML = `<canvas class="vl-canvas" id="vl-canvas"></canvas>
      <div class="vl-note" id="vl-note" hidden></div>
      <div class="vl-orbit">
        <button type="button" class="vl-tool" data-s="cam" aria-label="${esc(t("vp.cam"))}">◫</button>
        <button type="button" class="vl-tool vl-tool-t" data-s="lab" aria-label="${esc(t("vp.labels"))}">Aa</button>
        <button type="button" class="vl-tool" data-s="yaw-" aria-label="${esc(t("vl.rot"))}">⟲</button>
        <button type="button" class="vl-tool" data-s="yaw+" aria-label="${esc(t("vl.rot"))}">⟳</button>
        <button type="button" class="vl-tool" data-s="zoom-" aria-label="${esc(t("vl.zoom"))}">−</button>
        <button type="button" class="vl-tool" data-s="zoom+" aria-label="${esc(t("vl.zoom"))}">+</button>
      </div>
      <button type="button" class="vl-cancel" id="vl-cancel" hidden>${esc(t("vl.cancel"))}</button>`;
    scene = VL3.createScene(stageEl.querySelector("canvas"), {});
    scene.onPick = onPick;
    scene.onCamera = c => { const ui = st().ui; ui.yaw = c.yaw; ui.zoom = clamp(c.zoom, 0.7, 1.9); save(); };
    scene.labelFn = (id, level) => (st().ui.labels ? [t("vl.b." + id), t("vl.lv", { n: level })] : null);
    scene.coinOk = () => findLeft() > 0;
    stageEl.addEventListener("click", e => {
      const b = e.target.closest("[data-s]");
      if (b) {
        e.stopPropagation();
        const a = b.dataset.s;
        if (a === "cam") { const ord = ["iso", "hero", "top"], cur = st().ui.cam || "iso"; setUi({ cam: ord[(ord.indexOf(cur) + 1) % 3] }); toast("vl.cam." + st().ui.cam); }
        else if (a === "lab") setUi({ labels: !st().ui.labels });
        else if (a === "yaw-") scene.rotate(-22); else if (a === "yaw+") scene.rotate(22);
        else if (a === "zoom-") scene.zoomBy(-0.14); else if (a === "zoom+") scene.zoomBy(0.14);
        return;
      }
      if (e.target.closest("#vl-cancel")) { placing = null; syncOverlay(); renderTabs(); renderSide(); }
    });
    applyCam(true);
  }
  function onPick(h) {
    if (!h) return;
    if (h.type === "tax") return collect();
    if (h.type === "coin") return collectFind(h.z);
    if (h.type === "citizen") { scene.poke(h.z); sfx("move"); return; }
    if (h.type === "building") {
      if (placing) return;
      selected = h.id; if (tab !== "build") tab = "land";
      syncOverlay(); renderTabs(); renderSide(); return;
    }
    if (h.type === "tile") {
      if (placing) { if (!h.out) dropOn(h.c, h.r); return; }
      if (selected) { selected = null; syncOverlay(); renderSide(); }
    }
  }
  function sync() {
    if (!scene) return;
    const v = st();
    if (normalizePlots(v)) save();
    scene.set(sceneData(v));
    syncOverlay();
  }
  function syncOverlay() {
    if (!scene) return;
    const v = st(), note = $("vl-note"), cancel = $("vl-cancel");
    scene.overlay({ sel: selected && lv(selected, v) > 0 ? selected : null, placing: placing ? { id: placing.id } : null, taxReady: taxReady(), labels: !!v.ui.labels, coins: true, hover: placing ? undefined : null });
    if (note) { note.hidden = !placing; if (placing) note.textContent = t("vl.placing") + " · " + t("vl.b." + placing.id) + " (" + footOf(placing.id).join("×") + ")"; }
    if (cancel) { cancel.hidden = !placing; cancel.textContent = t("vl.cancel"); }
    stageEl && stageEl.classList.toggle("placing", !!placing);
  }

  /* ---------- панели ---------- */
  function nextTaxGain(b, cur) { return Math.floor(b.tax * TAX_K * (cur + 1)) - Math.floor(b.tax * TAX_K * cur); }
  function pips(cur, max) { let h = ""; for (let i = 1; i <= max; i++) h += `<i class="${i <= cur ? "on" : ""}"></i>`; return `<span class="vl-pips">${h}</span>`; }
  function roleLine(id) { const pc = PIECE[id]; return pc ? `<i class="vp-role"><b>${P_GLYPH[pc]}</b>${esc(t("vp.role", { piece: t("vp.p." + pc).toLowerCase() }))}</i>` : ""; }
  function inspectHtml(v) {
    const id = selected;
    if (!id || lv(id, v) < 1) return "";
    const b = BMAP[id], p = parsePlot(v.plot[id]), cur = lv(id, v), maxed = cur >= b.max;
    const price = maxed ? 0 : costOf(b, cur + 1), f = footOf(id), open = unlocked(b, v), P = posInfo(v);
    return `<div class="vl-inspect vr-panel">
      <div class="vl-inspect-top"><img class="vl-thumb" alt="" src="${thumb(id, cur, v.theme)}">
        <div><p class="vl-kicker">${t("vl.inspect")}${p ? " · " + squareName(p[0], p[1]) : ""}</p>
        <b>${esc(t("vl.b." + id))}</b>
        <small>${t("vl.lv", { n: cur })} / ${b.max} ${pips(cur, b.max)}</small></div></div>
      ${roleLine(id)}
      <small class="vl-desc">${esc(t("vl.b." + id + ".d"))}${maxed ? "" : " " + esc(t("vl.nextTax", { n: nextTaxGain(b, cur) }))}</small>
      <small class="vp-guardline">${esc(t("vp.guardLine", { a: (P.guards[id] || []).length, b: (P.guardedBy[id] || []).length }))}</small>
      <div class="vl-inspect-act">
        <button type="button" class="shop-btn" data-a="up" data-v="${id}" ${maxed || !open ? "disabled" : ""}>${maxed ? t("vl.max") : t("vl.upgrade") + " · " + t("shop.priceCoins", { n: price })}</button>
        <button type="button" class="vl-rename" data-a="move" data-v="${id}">${t("vl.move")}${f[0] > 1 ? " · " + f[0] + "×" + f[1] : ""}</button>
      </div></div>`;
  }
  function rankHtml(v) {
    const n = prosperity(v), ix = rankIdx(n), nx = RANKS[ix + 1];
    const lad = RANKS.map((r, k) => `<span class="vr-step ${k < ix ? "done" : ""} ${k === ix ? "cur" : ""}" title="${esc(t("vl.rank." + r[0]))}"><b>${r[2]}</b><small>${esc(t("vl.rank." + r[0]))}</small></span>`).join("");
    const from = RANKS[ix][1], pct = nx ? Math.round((n - from) / (nx[1] - from) * 100) : 100;
    return `<div class="vr-ladder">${lad}</div>
      <span class="vx-bar vr-bar"><i style="width:${pct}%"></i></span>
      <small class="vr-next">${nx ? esc(t("vp.rankNext", { name: t("vl.rank." + nx[0]), n: nx[1] - n })) : esc(t("vp.rankTop"))}</small>`;
  }
  function masteryHtml() {
    const pts = masteryPts(), pc = masteryPct();
    const pct = Math.min(100, Math.round(pc / 30 * 100));
    return `<div class="vr-mastery vr-panel">
      <div class="vr-m-head"><span class="vr-m-ic">♞</span><div><p class="vl-kicker">${t("vp.mastery")}</p><b>${esc(t("vp.masteryVal", { pts, p: pc }))}</b></div></div>
      <span class="vx-bar"><i style="width:${pct}%"></i></span>
      <small class="vl-dim">${t("vp.masterySub")}</small>
      <div class="vr-m-act"><button type="button" class="vl-rename" data-a="go" data-v="levels">♟ ${t("vp.goGames")}</button><button type="button" class="vl-rename" data-a="go" data-v="daily">♘ ${t("vp.goDaily")}</button></div>
    </div>`;
  }
  function landHtml(v) {
    const n = prosperity(v);
    return `
      <div class="vr-hero vr-panel">
        <div class="vl-hero-bar">
          <div>
            <p class="vl-kicker">${t("vl.kicker")}</p>
            <h3 class="vl-name">${esc(v.name || t("vl.title"))}</h3>
            <p class="vl-rank">${t("vl.rank." + rankKey(n))} · ${t("vl.prosperity", { n })} · ${esc(t("vl.folk.count", { n: v.folk.n, cap: folkCap(v) }))} ♟</p>
          </div>
          <button type="button" class="vl-rename" data-a="rename">${t("vl.rename")}</button>
        </div>
        ${rankHtml(v)}
      </div>
      ${goldHtml(v)}
      ${EXT.landTop.map(f => { try { return f(v) || ""; } catch (e) { return ""; } }).join("")}
      ${masteryHtml()}
      ${inspectHtml(v)}
      ${selected ? "" : `<p class="vl-found-sub vr-empty">${t("vl.emptyHint")}</p>`}`;
  }
  function goldHtml(v) {
    const g = goldNow(), cap = capOf(v), r = rateOf(v), full = g >= cap, pct = Math.round(g / cap * 100);
    const left = full ? 0 : (cap - g) / r * 3.6e6;
    return `<div class="vl-tax vx-gold ${taxReady() ? "ready" : ""} ${full ? "full" : ""}" id="vx-gold">
        <div class="vx-gold-t">
          <p class="vl-kicker">♛ ${t("vl.tax")}</p>
          <span class="vx-gold-n">${t("vl.gold", { a: g, b: cap })}</span>
          <span class="vx-bar"><i style="width:${pct}%"></i></span>
          <small>${full ? t("vl.full") : t("vl.rate", { n: Math.round(r * 10) / 10, t: fmtT(left) })}</small>
          <small class="vl-dim">${t("vl.goldWarn")}</small>
        </div>
        <button type="button" class="btn btn-primary" data-a="collect" ${g >= 1 ? "" : "disabled"}>${t("vl.collect")} · ${g}</button>
      </div>`;
  }
  function paintGold() {
    const el = $("vx-gold"); if (!el || tab !== "land") return;
    const v = st(); if (!v.founded) return;
    const tmp = document.createElement("div"); tmp.innerHTML = goldHtml(v);
    el.replaceWith(tmp.firstElementChild);
  }
  function buildHtml(v) {
    return `<div class="vl-list">${BUILD.map(b => {
      const cur = lv(b.id, v), open = unlocked(b, v), maxed = cur >= b.max, next = cur + 1;
      const price = maxed ? 0 : costOf(b, Math.max(1, next)), placed = !!parsePlot(v.plot[b.id]), f = footOf(b.id);
      const cta = !open ? t("vl.locked") : maxed ? t("vl.max") : cur ? t("vl.upgrade") : t("vl.build");
      const act = !open ? "" : (cur < 1)
        ? `<button type="button" class="vl-rename" data-a="place" data-v="${b.id}">${t("vl.placeNow")}</button>`
        : `<button type="button" class="vl-rename" data-a="move" data-v="${b.id}">${t("vl.move")}</button>`;
      return `<article class="vl-card vl-bcard ${open ? "" : "locked"} ${cur ? "on" : ""} ${selected === b.id ? "pick" : ""}">
        <img class="vl-thumb" alt="" src="${open ? thumb(b.id, Math.max(1, cur || 1), v.theme) : ""}" ${open ? "" : 'style="visibility:hidden"'}>
        <div class="vl-card-t">
          <b>${t("vl.b." + b.id)}${f[0] > 1 ? ` <em class="vl-sz">${f[0]}×${f[1]}</em>` : ""}</b>
          <small>${cur ? t("vl.lv", { n: cur }) + " / " + b.max + " " : ""}${cur ? pips(cur, b.max) : esc(t("vl.b." + b.id + ".d"))}</small>
          ${roleLine(b.id)}
          ${open ? "" : `<i class="vl-need">${t("vl.need", { need: needLabel(b) })}</i>`}
        </div>
        <div class="vl-card-act">
          <button type="button" class="shop-btn" data-a="${cur < 1 ? "place" : "up"}" data-v="${b.id}" ${!open || maxed ? "disabled" : ""}>
            ${cta}${!open || maxed ? "" : " · " + t("shop.priceCoins", { n: price })}
          </button>
          ${cur >= 1 ? act : ""}
        </div>
      </article>`;
    }).join("")}</div>`;
  }
  function folkHtml(v) {
    const f = v.folk, cap = folkCap(v), free = f.n < f.max, price = hireCost(f.n);
    const sk = VL3.SKINS.map(s => {
      const owned = s.price === 0 || v.owned.includes(s.id), on = f.skin === s.id;
      const cta = on ? t("vl.using") : owned ? t("vl.use") : t("vl.buy") + " · " + t("shop.priceCoins", { n: s.price });
      return `<article class="vl-card shop-like vl-skin ${on ? "on" : ""}">
        <canvas class="vl-skin-cv" width="220" height="72" data-skin="${s.id}"></canvas>
        <div class="vl-card-t"><b>${t("vl.sk." + s.id)}</b><small>${t("vl.sk." + s.id + ".d")}</small></div>
        <button type="button" class="shop-btn" data-a="skin" data-v="${s.id}" ${on ? "disabled" : ""}>${cta}</button>
      </article>`;
    }).join("");
    const addLabel = f.n >= cap ? t("vl.folk.cap", { n: Math.max(0, f.n - 1) }) : free ? t("vl.folk.free") : t("vl.folk.hire", { n: price });
    return `<div class="vl-folk">
      <div class="vl-folk-head">
        <div><p class="vl-kicker">${t("vl.folk.title")}</p><b class="vl-folk-n">${t("vl.folk.count", { n: f.n, cap })}</b></div>
        <div class="vl-folk-ctl">
          <button type="button" class="vl-tool" data-a="dismiss" ${f.n <= 0 ? "disabled" : ""} aria-label="${esc(t("vl.folk.dismiss"))}">−</button>
          <button type="button" class="vl-tool vl-plus" data-a="hire" ${f.n >= cap ? "disabled" : ""} aria-label="${esc(t("vl.folk.add"))}">+</button>
        </div>
      </div>
      <p class="vl-found-sub vl-folk-next">${f.n >= cap ? (cap >= FOLK_MAX ? t("vl.max") : t("vl.folk.cap", { n: lv("hall", v) + 1 })) : free ? t("vl.folk.free") : t("vl.folk.hire", { n: price })}</p>
      <p class="vl-found-sub">${t("vl.folk.sub")}</p>
      <p class="vl-dim vl-find">${t("vl.folk.find", { a: findCap(v) - findLeft(v), b: findCap(v) })}</p>
      <p class="vl-label">${t("vl.folk.skins")}</p>
      <div class="vl-grid">${sk}</div>
    </div>`;
  }
  function starsHtml(id, v) { const n = starOf(id, v); if (!n) return ""; let h = ""; for (let i = 1; i <= 5; i++) h += i <= n ? "★" : "☆"; return `<em class="vx-stars" title="${esc(t("vl.stars", { n }))}">${h}</em>`; }
  function perkHtml(id, v) { const p = PERK[id]; if (!p) return ""; return `<i class="vx-perk">${esc(t("vl.perk." + p[0], { n: p[1] * Math.max(1, starOf(id, v)) }))}</i>`; }
  function rarTag(id) { const r = DECO_RAR[id]; return r == null ? "" : `<span class="vx-rar r${r}"></span>`; }
  function decoHtml(v) {
    const kinds = ["prod", "def", "atk", "store", "loot"];
    const sums = kinds.map(k => [k, Math.round(decoBonus(k, v) * 100)]).filter(x => x[1] > 0);
    const head = `<div class="vx-bonus"><p class="vl-label">${t("vl.bonuses")}</p>${sums.length ? sums.map(x => `<span class="vl-chip">${esc(t("vl.perk." + x[0], { n: x[1] }))}</span>`).join("") : `<small class="vl-dim">${t("vl.noBonus")}</small>`}</div>`;
    const themeCards = THEMES.map(item => {
      const owned = v.owned.includes(item.id), on = v.theme === item.id;
      const cta = on ? t("vl.using") : owned ? t("vl.use") : WHEEL_ONLY[item.id] ? t("vl.wheelOnly") : t("vl.buy") + " · " + t("shop.priceCoins", { n: item.price });
      return `<article class="vl-card shop-like ${on ? "on" : ""}">
        <span class="swatch vl-swatch ${item.id}"></span>
        <div class="vl-card-t"><b>${rarTag(item.id)}${t("vl.t." + item.id)} ${starsHtml(item.id, v)}</b><small>${t("vl.t." + item.id + ".d")}</small>${perkHtml(item.id, v)}</div>
        <button type="button" class="shop-btn" data-a="theme" data-v="${item.id}" ${on || (!owned && WHEEL_ONLY[item.id]) ? "disabled" : ""}>${cta}</button>
      </article>`;
    }).join("");
    const decoCards = DECOS.map(item => {
      const on = v.deco.includes(item.id), owned = v.owned.includes(item.id) || on;
      const cta = on ? t("vl.using") : owned ? t("vl.use") : WHEEL_ONLY[item.id] ? t("vl.wheelOnly") : t("vl.buy") + " · " + t("shop.priceCoins", { n: item.price });
      return `<article class="vl-card shop-like ${on ? "on" : ""}">
        <span class="swatch vl-swatch ${item.id}"></span>
        <div class="vl-card-t"><b>${rarTag(item.id)}${t("vl.d." + item.id)} ${starsHtml(item.id, v)}</b><small>${t("vl.d." + item.id + ".d")}</small>${perkHtml(item.id, v)}</div>
        <button type="button" class="shop-btn" data-a="deco" data-v="${item.id}" ${!on && !owned && WHEEL_ONLY[item.id] ? "disabled" : ""}>${on ? t("vl.decoRemove") : cta}</button>
      </article>`;
    }).join("");
    return `${head}<div class="vl-grid">${decoCards}${themeCards}</div>`;
  }
  function posHtml(v) {
    const P = posInfo(v), sel = selected && lv(selected, v) > 0 ? selected : null, A = sel ? P.att[sel] : null;
    if (!P.ids.length) return `<div class="vp-pane"><p class="vl-found-sub">${t("vp.pos.empty")}</p></div>`;
    let cells = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const k = c + "," + r, id = P.occ[k], dark = (c + r) % 2 === 1;
      const hit = A && A.has(k), mine = sel && id === sel;
      const cls = `vp-sq ${dark ? "d" : "l"} ${mine ? "mine" : ""} ${hit && id ? "hit" : ""} ${hit && !id ? "dot" : ""} ${id ? "occ" : ""} ${id && !mine && sel && P.guardedBy[sel] && P.guardedBy[sel].indexOf(id) >= 0 ? "ally" : ""}`;
      const co = (c === 0 ? `<em class="vp-rk">${8 - r}</em>` : "") + (r === 7 ? `<em class="vp-fl">${FILES[c]}</em>` : "");
      const an = id ? parsePlot(v.plot[id]) : null, head = an && an[0] === c && an[1] === r;
      cells += id ? `<button type="button" class="${cls} ${head ? "" : "part"}" data-a="pick" data-v="${id}" aria-label="${esc(t("vl.b." + id))}">${head ? `<span class="vp-pc">${P_GLYPH[PIECE[id] || "p"]}</span>` : ""}${co}</button>` : `<div class="${cls}">${co}</div>`;
    }
    const ev = P.eval, evp = Math.min(100, Math.round(ev / 6 * 100));
    const rows = [["guard", P.nGuard, P.prod, "prod"], ["center", P.nCenter, P.store, "store"], ["fork", P.nFork, P.def, "def"]].map(x => `<article class="vl-card vp-bonus ${x[1] ? "on" : ""}">
        <span class="vl-glyph">${{ guard: "♜", center: "♔", fork: "♞" }[x[0]]}</span>
        <div class="vl-card-t"><b>${t("vp.pos." + x[0])} <em class="vg-n">×${x[1]}</em></b><small>${t("vp.pos." + x[0] + ".d")}</small>
          ${x[1] ? `<i class="vx-perk">${esc(t("vl.perk." + x[3], { n: x[2] }))}${x[0] === "fork" ? " · " + esc(t("vl.perk.atk", { n: P.atk })) : ""}</i>` : ""}</div>
      </article>`).join("");
    const selLine = sel ? `<p class="vp-selline"><b>${P_GLYPH[PIECE[sel] || "p"]}</b> ${esc(t("vp.pos.sel", { name: t("vl.b." + sel), a: P.guards[sel].length, b: P.guardedBy[sel].length }))}</p>` : `<p class="vl-found-sub">${t("vp.pos.tip")}</p>`;
    return `<div class="vp-pane">
      <div class="vr-panel vp-head"><div><p class="vl-kicker">${t("vp.pos.title")}</p><p class="vl-found-sub">${t("vp.pos.sub")}</p></div>
        <div class="vp-eval"><small>${t("vp.pos.eval")}</small><b>${ev >= 0 ? "+" : ""}${ev.toFixed(1)}</b></div></div>
      <span class="vx-bar vp-evbar"><i style="width:${evp}%"></i></span>
      <div class="vp-map">${cells}</div>
      ${selLine}
      <div class="vl-list">${rows}</div>
    </div>`;
  }
  const TAB_IC = { land: "♚", build: "♜", pos: "♞", army: "⚔", raid: "♛", quest: "♝", folk: "♟", deco: "✦" };
  function renderTabs() {
    const el = $("vl-tabs"); if (!el) return;
    if (tab === "view") tab = "land";
    el.innerHTML = ["land", "build", "pos"].concat(EXT.tabs, ["folk", "deco"]).map(k => `<button type="button" class="shop-tab vt-tab ${tab === k ? "active" : ""}" data-a="tab" data-v="${k}"><span class="vt-ic">${TAB_IC[k] || "♟"}</span><span class="vt-lb">${t("vl.tab." + k)}</span></button>`).join("");
  }
  function renderSide() {
    const el = $("vl-side"); if (!el) return;
    const v = st(), keep = el.scrollTop;
    let html;
    try { html = EXT.html[tab] ? EXT.html[tab](v) : tab === "build" ? buildHtml(v) : tab === "folk" ? folkHtml(v) : tab === "deco" ? decoHtml(v) : tab === "pos" ? posHtml(v) : landHtml(v); }
    catch (e) { console.error(e); html = landHtml(v); }
    el.innerHTML = html;
    el.scrollTop = keep;
    skinThumbPaint();
  }

  /* ---------- экран основания ---------- */
  const DEMO = {
    b: { hall: 4, castle: 3, palace: 2, cottages: 4, garden: 3, towers: 3, chapel: 3, market: 3, academy: 2, stables: 3 },
    plot: { hall: "3,3", castle: "0,0", palace: "6,0", chapel: "2,2", academy: "5,2", towers: "7,4", garden: "0,5", cottages: "1,6", stables: "6,6", market: "4,6" },
    theme: "theme-dusk", deco: ["deco-lanterns", "deco-banners", "deco-fountain"], folk: { n: 6, skin: "skin-court" }
  };
  function foundHtml() {
    const nick = (UI.state && UI.state.nick) || "";
    return `
      <div class="vl-found">
        <p class="vl-kicker">${t("vl.kicker")}</p>
        <h3 class="vl-found-title">${t("vl.foundTitle")}</h3>
        <p class="vl-found-sub">${t("vl.foundSub")}</p>
        <div class="vl-stage-card" id="vl-found-host"></div>
        <label class="vl-label" for="vl-name">${t("vl.foundName")}</label>
        <input class="vl-input" id="vl-name" maxlength="20" placeholder="${esc(t("vl.foundPh"))}" value="${esc(nick)}">
        <button type="button" class="btn btn-primary" data-a="found">${t("vl.foundBtn")}</button>
      </div>`;
  }
  function ensureFoundScene() {
    if (foundScene) return;
    foundEl = document.createElement("div");
    foundEl.className = "vl-stage vl-stage-found";
    foundEl.innerHTML = `<canvas class="vl-canvas"></canvas>`;
    foundScene = VL3.createScene(foundEl.querySelector("canvas"), {});
    foundScene.set(DEMO);
    foundScene.setCamera({ yaw: 40, zoom: 1, mode: "iso", snap: true });
    foundScene.overlay({ labels: false });
  }

  /* ---------- общий рендер ---------- */
  function render() {
    if (!root || !UI.state) return;
    if (!window.VL3) { root.innerHTML = `<h2 class="view-title">${t("vl.title")}</h2><p class="vl-found-sub">3D engine not loaded</p>`; return; }
    const v = st();
    if (normalizePlots(v)) save();
    if (!v.founded) {
      if (scene) scene.stop();
      ensureFoundScene();
      if (stageEl && stageEl.parentNode) stageEl.parentNode.removeChild(stageEl);
      if (shell !== "found") {
        root.innerHTML = `<h2 class="view-title">${t("vl.title")}</h2>${foundHtml()}`;
        $("vl-found-host").appendChild(foundEl);
        shell = "found";
      }
      foundScene.start();
      return;
    }
    if (foundScene) foundScene.stop();
    ensureScene();
    if (shell !== "main") {
      if (foundEl && foundEl.parentNode) foundEl.parentNode.removeChild(foundEl);
      root.innerHTML = `
        <h2 class="view-title">${t("vl.title")}</h2>
        <div class="shop-tabs vl-tabs" id="vl-tabs"></div>
        <div class="vl-desk">
          <div class="vl-stage-card" id="vl-host"></div>
          <div class="vl-side" id="vl-side"></div>
        </div>`;
      $("vl-host").appendChild(stageEl);
      shell = "main";
    }
    renderTabs(); renderSide(); sync(); applyCam();
    scene.start();
  }

  /* ---------- делегирование кликов ---------- */
  function onRootClick(e) {
    const el = e.target.closest("[data-a]");
    if (!el || el.disabled) return;
    const a = el.dataset.a, val = el.dataset.v;
    switch (a) {
      case "tab": tab = val; if (tab !== "land" && tab !== "build" && placing) { placing = null; syncOverlay(); } renderTabs(); renderSide(); emit("tab", tab); break;
      case "found": found(); break;
      case "rename": rename(); break;
      case "collect": collect(); break;
      case "up": upgrade(val); break;
      case "place": startPlace(val, false); break;
      case "move": startPlace(val, true); break;
      case "theme": buyTheme(val); break;
      case "deco": buyDeco(val); break;
      case "hire": hire(); break;
      case "dismiss": dismiss(); break;
      case "skin": skinAct(val); break;
      case "cam": setUi({ cam: val }); break;
      case "hud": setUi({ hud: val }); break;
      case "labels": setUi({ labels: !st().ui.labels }); break;
      case "go": UI.showView(val); break;
      case "pick": selected = val; syncOverlay(); renderSide(); break;
      default: if (EXT.act[a]) { try { EXT.act[a](val, el); } catch (err) { console.error(err); } }
    }
  }

  /* ---------- главная: карточка деревни ---------- */
  const SHOW_HOME_CARD = false;
  let homeSig = "";
  function paintHome() {
    const view = $("view-home");
    if (!view) return;
    let card = $("vl-home");
    if (!SHOW_HOME_CARD) { if (card) card.remove(); return; }     /* карточка на главной убрана — есть вкладка «Деревня» */
    if (!card) {
      card = document.createElement("button");
      card.type = "button"; card.id = "vl-home"; card.className = "vl-home";
      const after = $("streak-card");
      if (after && after.parentNode) after.parentNode.insertBefore(card, after.nextSibling); else view.appendChild(card);
      card.addEventListener("click", () => UI.showView("village"));
    }
    const v = st(), n = prosperity(v);
    const sig = JSON.stringify([v.founded, v.name, v.b, v.theme, v.deco, v.folk, taxReady(), UI.state && UI.state.lang]);
    if (sig === homeSig && card.firstChild) return;
    homeSig = sig;
    card.innerHTML = `<div class="vl-home-txt">${v.founded
      ? `<span class="vl-home-k">${t("vl.homeTitle")}</span><b>${esc(v.name)}</b><small>${t("vl.rank." + rankKey(n))} · ${t("vl.homeGo")}${taxReady() ? " · 🪙" : ""}</small>`
      : `<span class="vl-home-k">${t("vl.kicker")}</span><b>${t("vl.foundTitle")}</b><small>${t("vl.homeFound")}</small>`}</div>
      <canvas class="vl-home-cv" width="260" height="170"></canvas>`;
    const cv = card.querySelector("canvas");
    setTimeout(() => {
      try {
        if (!window.VL3 || !cv.isConnected || card.offsetParent === null) return;
        VL3.snapshot(cv, v.founded ? sceneData(v) : DEMO, { yaw: 40, zoom: 1.05, steps: 4 });
      } catch (e) { /* превью не критично */ }
    }, 60);
  }

  /* ---------- визит в чужую деревню ---------- */
  let vEl = null, vScene = null, vData = null, vUid = null;
  function closeVisit(back) {
    if (!vEl) return;
    vEl.classList.remove("open");
    if (vScene) vScene.stop();
    document.body.classList.remove("vl-visiting");
    if (back && vUid && window.PlayerProfile) PlayerProfile.open(vUid);
  }
  function visitInfo(id) {
    const box = $("vl-vi"); if (!box || !vData) return;
    if (!id) { box.innerHTML = `<p class="vl-dim">${t("vl.visit.hint")}</p>`; return; }
    const l = (+vData.b[id] || 0);
    box.innerHTML = `<div class="vl-inspect-top"><img class="vl-thumb" alt="" src="${thumb(id, Math.max(1, l), vData.theme)}">
      <div><b>${esc(t("vl.b." + id))}</b><small>${t("vl.lv", { n: l })} / ${BMAP[id].max} ${pips(l, BMAP[id].max)}</small></div></div>
      <small class="vl-desc">${esc(t("vl.b." + id + ".d"))}</small>`;
  }
  function visit(uid, d) {
    if (!window.VL3) return;
    const me = (typeof Cloud !== "undefined" && Cloud.user) ? Cloud.user.uid : null;
    if (me && uid === me) { UI.showView("village"); return true; }
    const nick = (d && d.nick) || "?";
    const data = d && d.vil ? unpack(d.vil) : null;
    if (!data) { toast("vl.visit.none", { nick }); return false; }
    vData = data; vUid = uid;
    if (!vEl) {
      vEl = document.createElement("div");
      vEl.className = "vl-visit"; vEl.id = "vl-visit";
      vEl.innerHTML = `<div class="vl-visit-card">
        <button type="button" class="vl-visit-x" data-vx="close" aria-label="close">✕</button>
        <div class="vl-visit-head"><p class="vl-kicker" id="vl-v-k"></p><h3 class="vl-visit-name" id="vl-v-name"></h3><p class="vl-rank" id="vl-v-sub"></p></div>
        <div class="vl-stage vl-visit-stage" id="vl-v-stage"><canvas class="vl-canvas"></canvas>
          <div class="vl-orbit">
            <button type="button" class="vl-tool" data-vs="yaw-">⟲</button><button type="button" class="vl-tool" data-vs="yaw+">⟳</button>
            <button type="button" class="vl-tool" data-vs="zoom-">−</button><button type="button" class="vl-tool" data-vs="zoom+">+</button>
          </div></div>
        <div class="vl-visit-info" id="vl-vi"></div>
        <div class="vl-visit-chips" id="vl-v-chips"></div>
        <button type="button" class="btn btn-ghost vl-visit-back" data-vx="back"></button>
      </div>`;
      document.body.appendChild(vEl);
      vEl.addEventListener("click", e => {
        const vx = e.target.closest("[data-vx]");
        if (vx) { closeVisit(vx.dataset.vx === "back"); return; }
        if (e.target === vEl) { closeVisit(false); return; }
        const b = e.target.closest("[data-vs]");
        if (b && vScene) { const a = b.dataset.vs; if (a === "yaw-") vScene.rotate(-22); else if (a === "yaw+") vScene.rotate(22); else if (a === "zoom-") vScene.zoomBy(-0.14); else vScene.zoomBy(0.14); }
      });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && vEl.classList.contains("open")) closeVisit(false); });
      vScene = VL3.createScene(vEl.querySelector("canvas"), { readonly: true });
      vScene.onPick = h => { if (h && h.type === "building") { visitInfo(h.id); vScene.overlay({ sel: h.id }); } else if (h && h.type === "citizen") { vScene.poke(h.z); } else { visitInfo(null); vScene.overlay({ sel: null }); } };
      vScene.labelFn = (id, level) => [t("vl.b." + id), t("vl.lv", { n: level })];
    }
    const n = BUILD.reduce((s, b) => s + (+data.b[b.id] || 0), 0);
    $("vl-v-k").textContent = t("vl.visit.kicker");
    $("vl-v-name").textContent = data.name || t("vl.visit.title");
    $("vl-v-sub").textContent = t("vl.visit.mayor", { nick }) + " · " + t("vl.rank." + rankKey(n)) + " · " + t("vl.prosperity", { n });
    vEl.querySelector(".vl-visit-back").textContent = t("vl.visit.back");
    $("vl-v-chips").innerHTML = BUILD.filter(b => data.b[b.id]).map(b => `<span class="vl-chip"><i>${b.glyph}</i>${esc(t("vl.b." + b.id))} <b>${data.b[b.id]}</b></span>`).join("")
      + `<span class="vl-chip"><i>♟</i>${t("vl.visit.pop")} <b>${data.folk.n}</b></span>`
      + `<span class="vl-chip"><i>♞</i>${t("vp.pos.eval")} <b>${(posInfo(data).eval >= 0 ? "+" : "") + posInfo(data).eval.toFixed(1)}</b></span>`;
    visitInfo(null);
    vEl.classList.add("open");
    document.body.classList.add("vl-visiting");
    vScene.set(sceneData(data));
    vScene.overlay({ sel: null, labels: true, coins: false });
    vScene.setCamera({ yaw: +data.ui.yaw || 45, zoom: 1, mode: "iso", snap: true });
    vScene.start();
    toast("vl.visit.welcome", { name: data.name || nick });
    const s = UI.state;
    if (s) { s.flags = s.flags || {}; if (!s.flags.villageGuest) { s.flags.villageGuest = 1; celebrate(); } }
    return true;
  }

  function badge() {
    const btn = document.querySelector('.nav-btn[data-view="village"]');
    let dot = taxReady();
    EXT.tick.forEach(f => { try { if (f()) dot = true; } catch (e) {} });
    if (btn) btn.classList.toggle("vl-dot", dot);
  }
  function hint() {
    const s = UI.state;
    if (!s || !s.flags || s.flags.villageHint5) return;
    s.flags.villageHint5 = 1; persist();
    setTimeout(() => toast("vl.hint"), 900);
  }

  function mount() {
    if ($("view-village")) return;
    const sec = document.createElement("section");
    sec.id = "view-village"; sec.className = "view";
    document.querySelector(".views").appendChild(sec);
    root = sec;
    root.addEventListener("click", onRootClick);
    root.addEventListener("keydown", e => { if (e.target && e.target.id === "vl-name" && e.key === "Enter") found(); });
    const nb = document.createElement("button");
    nb.type = "button"; nb.className = "nav-btn"; nb.dataset.view = "village";
    nb.innerHTML = `<span>♜</span><span data-i18n="nav.village">${t("nav.village")}</span>`;
    const daily = document.querySelector('.nav-btn[data-view="daily"]');
    if (daily) daily.after(nb); else document.querySelector(".bottom-nav").appendChild(nb);
  }
  mount();

  if (typeof UI !== "undefined") {
    const _sv = UI.showView;
    UI.showView = function (n) {
      const r = _sv.apply(this, arguments);
      if (n === "village") render();
      else { if (scene) scene.stop(); if (foundScene) foundScene.stop(); }
      badge();
      return r;
    };
    const _rh = UI.renderHome;
    if (_rh) UI.renderHome = function () { const r = _rh.apply(this, arguments); paintHome(); return r; };
    const _tr = UI.translate;
    if (_tr) UI.translate = function () {
      const r = _tr.apply(this, arguments);
      shell = ""; homeSig = "";
      if (stageEl) { stageEl.querySelectorAll("[aria-label]").forEach(() => { }); const c = $("vl-cancel"); if (c) c.textContent = t("vl.cancel"); }
      if (root && root.classList.contains("active")) render();
      paintHome(); badge();
      return r;
    };
  }

  document.addEventListener("DOMContentLoaded", () => { badge(); setTimeout(hint, 400); });
  setInterval(() => {
    try {
      if (!UI.state) return;
      const active = root && root.classList.contains("active");
      if (active && tab === "land") { paintGold(); syncOverlay(); }
      badge();
    } catch (e) {}
  }, 5000);
  /* когда облако подтянуло прогресс — перерисовываем */
  if (typeof Cloud !== "undefined" && Cloud._emit) {
    const _em = Cloud._emit;
    Cloud._emit = function (x) {
      _em.call(this, x);
      if (x && x.loaded) setTimeout(() => { shell = ""; homeSig = ""; if (scene) { thumbCache && 0; } if (root && root.classList.contains("active")) render(); paintHome(); badge(); }, 60);
    };
  }

  window.Village = {
    _scene: () => scene, render, collect, taxOf, prosperity, pack, unpack, visit, grantDeco, itemName,
    open: (tb) => { if (tb) tab = tb; UI.showView("village"); },
    ext: EXT,
    api: {
      st, vx, tick, goldNow, capOf, rateOf, bonus, lv, BUILD, BMAP, persist, save, toast, esc, sfx, t: (k, o) => t(k, o || {}), fmtT, emit, celebrate,
      renderSide: () => renderSide(), renderTabs: () => renderTabs(), badge: () => badge(), root: () => root, sceneData, rankKey, prosperity,
      posInfo, masteryPts, masteryPct, PIECE, P_GLYPH, decoBonus, rankIdx, RANKS, tab: () => tab, setTab: k => { tab = k; renderTabs(); renderSide(); }, today, itemName, DECO_RAR, starOf, PERK
    }
  };
})();