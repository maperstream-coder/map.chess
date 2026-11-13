/* maper.chess — nickname policy: format, forbidden words, junk filter, uniqueness.
   Load AFTER cloud.js, BEFORE profile.js and leaderboard.js.

   v3: проверка стала «умной»:
     • русский мат/оскорбления ловятся, даже если написаны латиницей («huy», «pizda», «suka», «lox»),
       «двойниками» (кириллица+латиница вперемешку), цифрами вместо букв (п1дор, 3бать), с повторами букв,
       с пробелами/точками/подчёркиваниями между буквами («х у й», «л.о.х»);
     • оскорбления бренда и «матери» (маперлох, Мать мапера, маперсосунок…) блокируются;
     • «ерунда» тоже не пропускается: ссылки, телефоны, «аааааа», «qwerty», ники без гласных и т.п.;
     • Nick.validate(s) -> null | "format" | "banned" | "junk"; Nick.errKey(code) -> ключ перевода;
       Nick.safe(s) -> ник или нейтральное «Игрок», если ник плохой (для показа чужих ников). */
const Nick = (function () {
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "nick.taken": "This nickname is already taken",
    "nick.banned": "This nickname contains forbidden words",
    "nick.junk": "Please choose a normal nickname (no links, random letters or repeated symbols)",
    "nick.player": "Player",
    "streak.blocked": "System time was changed — the streak day wasn't counted"
  }, {
    "nick.taken": "Этот никнейм уже занят",
    "nick.banned": "В никнейме есть запрещённые слова",
    "nick.junk": "Придумайте нормальный никнейм (без ссылок, случайных букв и повторяющихся символов)",
    "nick.player": "Игрок",
    "streak.blocked": "Время устройства изменено — день огонька не засчитан"
  });

  const NICK_RE = /^[\p{L}\p{N}_.\- ]{2,16}$/u;

  /* ---------- нормализация ---------- */
  const HOMO = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "м": "m", "т": "t", "к": "k", "н": "h", "в": "b" };
  const fold = s => s.toLowerCase().replace(/./g, c => HOMO[c] !== undefined ? HOMO[c] : c);
  const normalize = s => s.trim().replace(/\s+/g, " ");
  /* normKey ОСТАЁТСЯ прежним: по нему в Firestore проверяется уникальность ников (nickLower) */
  const normKey = s => normalize(fold(s));

  const prep = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, "").toLowerCase().replace(/ё/g, "е");

  /* leet: цифры и знаки вместо букв (два набора — у некоторых символов два прочтения) */
  const LEET_A = { "0": "о", "1": "и", "3": "е", "4": "а", "5": "с", "6": "б", "7": "т", "8": "в", "@": "а", "$": "с", "!": "и", "|": "и", "+": "т" };
  const LEET_B = { "0": "о", "1": "л", "3": "з", "4": "ч", "5": "с", "6": "б", "7": "т", "8": "в", "@": "а", "$": "с", "!": "и", "|": "л", "+": "т" };
  /* меняем только символ, за которым идёт буква («п1дор», «3бать»): хвостовые цифры («Anna1») остаются числами */
  const leet = (s, map) => s.replace(/[0-9@$!|+](?=\p{L})/gu, c => map[c] || c);

  /* латиница -> кириллица. 1) по внешнему сходству (p→р, n→п, u→и …) 2) по звучанию (huy→хуй, p→п) */
  const LOOK = { a: "а", b: "в", c: "с", d: "д", e: "е", f: "ф", g: "г", h: "н", i: "и", j: "й", k: "к", l: "л", m: "м", n: "п", o: "о", p: "р", q: "к", r: "г", s: "с", t: "т", u: "и", v: "в", w: "ш", x: "х", y: "у", z: "з" };
  const PHON = { a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "й", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "х", y: "и", z: "з" };
  const DIGR = [["shch", "ш"], ["sch", "ш"], ["sh", "ш"], ["ch", "ч"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"], ["ya", "я"], ["yu", "ю"], ["yo", "е"], ["ju", "ю"], ["ja", "я"], ["ye", "е"]];
  const toCyrLook = s => s.replace(/[a-z]/g, c => LOOK[c]);
  const toCyrPhon = (s, yU) => { DIGR.forEach(d => { s = s.split(d[0]).join(d[1]); }); return s.replace(/[a-z]/g, c => (yU && c === "y" ? "у" : PHON[c])); };

  /* приведение кириллицы к «скелету»: й→и, ы→и, э→е, щ→ш; ь/ъ оставляем (иначе «мать» превратится в «мат» → Матвей) */
  const skel = s => s.replace(/й/g, "и").replace(/ы/g, "и").replace(/э/g, "е").replace(/щ/g, "ш").replace(/ё/g, "е");
  const squash = s => s.replace(/(.)\1+/g, "$1");
  const normC = s => squash(skel(s));

  /* все «прочтения» ника в кириллице */
  function cyrForms(s) {
    const base = prep(s), out = new Set();
    [base, leet(base, LEET_A), leet(base, LEET_B)].forEach(b => {
      out.add(normC(toCyrLook(b)));
      out.add(normC(toCyrPhon(b)));
      out.add(normC(toCyrPhon(b, true)));
    });
    return [...out];
  }
  /* прочтение для английских слов: кириллические «двойники» -> латиница, leet -> буквы */
  const LEET_L = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t" };
  function latForms(s) {
    const b = fold(prep(s));
    return [squash(b), squash(b.replace(/[0-9@$!|+](?=\p{L})/gu, c => LEET_L[c] || c))];
  }

  /* ---------- СПИСКИ СЛОВ ---------- */
  /* RU — STRONG: ищем внутри слитной строки (ловит «х у й», «Васяхуесос»). Только длинные однозначные основы. */
  const RU_STRONG = [
    "пизд", "пезд", "пизж", "бляд", "блят", "блеат", "хуи", "хуе", "хуя", "хую",
    "ебан", "ебал", "ебат", "ебет", "ебош", "ебну", "ебуч", "ебиш", "еблан", "ебло", "заеб", "выеб", "поеб", "наеб", "доеб", "проеб", "разеб", "отеб", "уеб", "съеб",
    "пидор", "пидар", "пидр", "педик", "педераст", "педрил", "мудак", "мудил", "мудоз", "мудан", "гандон", "гондон", "залуп",
    "долбоеб", "долбаеб", "долбан", "дерьм", "шлюх", "шалав", "проститут", "сосун", "сосал", "сосат", "хуесос", "членосос", "лохуш", "лошар", "чмошн", "чмырь",
    "дебил", "дибил", "идиот", "кретин", "ублюд", "мразь", "мразот", "сволоч", "паскуд", "подонок", "выродок", "опущен", "зашкварен",
    "нацист", "фашист", "гитлер", "геббельс", "свастик", "холокост", "нацизм", "педофил", "насильник", "изнасил", "маньяк", "суицид", "самоубий", "наркоман", "героин", "кокаин", "мефедрон",
    "твоямам", "твоюмам", "твоеймам", "твоямат", "твоюмат", "твоеймат", "етвою", "ебтвою",
    "матьтвоя", "матьтвою", "матьтвое", "мамкатвоя", "мамкутвою",
    "порно", "минет", "мапер", "админ", "модератор", "саппорт", "техподдержк",
    "негритос", "ниггер", "нигга", "жидяр", "хохол", "кацап", "москал", "узкоглаз", "косоглаз", "пиндос", "чурка", "чурбан", "хачик"
  ].map(normC);
  /* RU — PREFIX: слово (часть ника между пробелами/_/./-) НАЧИНАЕТСЯ с основы */
  const RU_PREFIX = [
    "бля", "бляд", "пзд", "залуп", "мандав", "мудо", "хуй", "хули", "ссук", "сука", "сучк", "сучар", "сучон", "сукин", "курв", "шмар", "блуд",
    "срат", "срал", "срак", "говн", "какаш", "жоп", "писюн", "писюл", "писька", "дроч", "дрист", "дрищ", "перд",
    "сосу", "соси", "сосеш", "сосет", "сосут", "отсос", "мань", "елда", "елдак", "пенис", "вагин", "сиськ", "титьк", "трахн", "трахал", "трахат", "трахае", "секс", "оргазм", "эротик",
    "долб", "ушлеп", "придур", "дурак", "дурач", "дуроч", "дурынд", "дурень", "тупой", "тупиц", "тупор", "тупар", "урод", "мраз", "быдл", "гнид", "падл", "падаль", "тварь", "скотин", "лузер", "неудачник", "ничтожн",
    "чмо", "чмы", "лох", "петух", "петуш", "даун", "аутист", "гомик", "гомосек", "извращ", "убью", "убий", "убей",
    "мать", "матерь", "мамк", "мамаш", "мамен",
    "фашик", "нацик", "нацк", "фюрер", "рейх",
    "негр", "нигер", "хач", "чурк", "жид",
    "наркот", "нарик", "админ", "модер", "саппорт", "мапер", "мапчесс",
    "оскорбл", "ненавиж"
  ].map(normC);
  /* исключения для PREFIX (нормальные слова/фамилии, которые начинаются на «плохую» основу) */
  const RU_OK_PREFIX = ["лохмат", "лохнес", "жидк", "жидов", "петухов", "петушков", "матвеи", "матвей", "материал", "математ", "матрос", "матро", "матуш", "мания", "маньк", "менеджер", "негру", "жопа", "перди", "дурашк", "хулиган", "урожай", "урал", "урок", "урсул", "гнидин", "падло", "нигери", "падаль", "секстет", "сексто", "мамен", "рейхан", "хачатур", "хачапур", "соси"].map(normC);
  /* RU — EXACT: слово целиком */
  const RU_EXACT = ["лох", "лохи", "лоха", "лошок", "чмо", "хер", "херня", "херов", "нахер", "нахрен", "похер", "похрен", "нах", "пох", "нахуи", "бля", "еб", "ебать", "анал", "член", "сука", "суки", "сук", "тварь", "твари", "козел", "козлы", "гад", "гады", "скот", "урюк", "фак", "факю", "шит", "фуфло", "бомж", "гей", "лесбуха", "трансуха"].map(normC);
  /* RU — SUFFIX: слово ЗАКАНЧИВАЕТСЯ на основу («Васялох») */
  const RU_SUFFIX = ["лох", "лошара", "чмо", "сосун", "сосунок", "петух", "дебил", "дурак", "идиот", "урод", "кретин", "лузер", "тупица", "мразь", "гнида", "сука", "сучка"].map(normC);

  /* EN (после перевода «двойников» в латиницу) */
  const EN_STRONG = ["fuck", "fuk", "shit", "bitch", "niga", "niger", "cunt", "pussy", "asshole", "arsehole", "bastard", "whore", "slut", "faggot", "retard", "hitler", "nazi", "rapist", "porn", "penis", "vagina", "wank", "twat", "douche", "bollock", "terrorist", "maper", "mapchess"].map(squash);
  const EN_PREFIX = ["dick", "cock", "fag", "sex", "rape", "tits", "jizz", "suicide", "suck", "prick", "idiot", "moron", "stupid", "loser", "looser", "admin", "moder", "support", "staff", "owner", "isis", "fck", "fcuk", "kys", "cum", "anal", "nude", "naked"].map(squash);
  const EN_OK_PREFIX = ["cockpit", "cocker", "cocktail", "cockney", "sexton", "sextant", "killer", "killian", "killua", "kills", "killmonger", "supporter", "analyst", "analog", "analy", "cumber", "cumin", "sexual", "fagin", "fagan", "idiotic"].map(squash);
  /* «killer» разрешён намеренно: ник вроде KillerQueen — не оскорбление */

  const tokensOf = c => c.split(/[^a-zа-я]+/).filter(Boolean);

  function hitCyr(c) {
    const tokens = tokensOf(c), joined = tokens.join("");
    if (RU_STRONG.some(w => joined.includes(w))) return true;
    return tokens.some(tok => {
      if (RU_EXACT.includes(tok)) return true;
      if (RU_SUFFIX.some(w => tok.length > w.length && tok.endsWith(w))) return true;
      if (RU_OK_PREFIX.some(w => tok.startsWith(w))) return false;
      return RU_PREFIX.some(w => tok.startsWith(w));
    });
  }
  function hitLat(l) {
    const tokens = l.split(/[^a-z]+/).filter(Boolean), joined = tokens.join("");
    if (EN_STRONG.some(w => joined.includes(w))) return true;
    return tokens.some(tok => !EN_OK_PREFIX.some(w => tok.startsWith(w)) && EN_PREFIX.some(w => tok.startsWith(w)));
  }

  function isBanned(s) {
    s = String(s || "");
    if (!s.trim()) return false;
    if (latForms(s).some(hitLat)) return true;
    return cyrForms(s).some(hitCyr);
  }

  /* ---------- «ерунда»: ссылки, телефоны, мусор из клавиатуры ---------- */
  const VOW = /[aeiouyаеёиоуыэюя]/;
  const MASH = ["qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm", "йцук", "цуке", "укен", "кенг", "енгш", "нгшщ", "фыва", "ывап", "вапр", "апро", "прол", "ролд", "олдж", "ячсм", "чсми", "смит", "1234", "2345", "3456", "4567", "5678", "6789", "7890", "0987", "9876", "8765", "7654", "6543", "5432", "4321"];
  function isJunk(s) {
    const low = prep(s), letters = (low.match(/\p{L}/gu) || []);
    if (letters.length < 2) return true;                                   // одни цифры/знаки
    if (/(.)\1{3,}/u.test(low.replace(/[\s_.\-]/g, ""))) return true;       // «аааааа», «хахахаха» не ловим, а «ууууу» — да
    if (/https?:|www\.|\.(com|ru|net|org|io|me|su|ua|by|kz|gg|tv|xyz)\b|t\.me|vk\.com|discord|@/i.test(s)) return true;
    if (/\d{7,}/.test(s.replace(/[\s.\-_]/g, ""))) return true;            // телефон
    const flat = low.replace(/[\s_.\-]/g, "");
    if (MASH.some(w => flat.includes(w))) return true;                      // qwerty, asdf, йцукен, 12345…
    const words = low.split(/[\s_.\-]+/).map(w => w.replace(/[^\p{L}]/gu, "")).filter(Boolean);
    if (words.some(w => w.length >= 5 && !VOW.test(w))) return true;       // «ккккпп», «dfghjkl»
    if (new Set(flat).size === 1) return true;                              // все символы одинаковые
    return false;
  }

  function validate(s) {
    s = String(s == null ? "" : s);
    if (!NICK_RE.test(s)) return "format";
    if (isBanned(s)) return "banned";
    if (isJunk(s)) return "junk";
    return null;
  }
  const errKey = code => (code === "banned" ? "nick.banned" : code === "junk" ? "nick.junk" : "nick.bad");
  /* для показа ЧУЖИХ ников там, где нет фильтра (друзья, дуэли…): плохой ник заменяется нейтральным словом */
  const safe = s => { s = String(s == null ? "" : s); return s && !validate(s) ? s : (typeof t === "function" ? t("nick.player") : "Player"); };

  async function taken(s, selfUid) {
    if (typeof Cloud === "undefined" || !Cloud.enabled || !Cloud.user) return false;
    try {
      const snap = await Cloud._db.collection("leaderboard")
        .where("nickLower", "==", normKey(s)).limit(4).get();
      return snap.docs.some(d => d.id !== selfUid);
    } catch (e) { return false; }
  }

  return { NICK_RE, validate, isBanned, isJunk, errKey, safe, taken, normKey };
})();