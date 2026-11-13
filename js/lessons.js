/* maper.chess — «Обучение»: единый ПУТЬ из клеток (уроки + дебюты) с озвученным роботом MAPER.
   Чтобы продлить путь: добавь урок в LESSONS / дебют в OPENINGS и впиши его id в нужную главу CHAPTERS
   (всё, чего нет в главах, автоматически попадёт в конец пути).
   Никакого «текста для чтения»: MAPER ставит задачу на доске, ты делаешь ход,
   MAPER говорит «верно / неверно» и объясняет почему.
   Подключается ПОСЛЕ js/hints.js, ДО js/app.js. */
(function () {
  "use strict";
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({ "nav.lessons": "Learn", "lsn.title": "Learn chess", "lsn.tab.lessons": "Lessons", "lsn.tab.openings": "Openings" },
      { "nav.lessons": "Обучение", "lsn.title": "Обучение", "lsn.tab.lessons": "Уроки", "lsn.tab.openings": "Дебюты" });

  const $ = id => document.getElementById(id);
  const lang = () => (UI.state && UI.state.lang) || "en";
  const tr = (en, ru) => (lang() === "ru" ? ru : en);
  const B = (en, ru) => ({ en, ru });
  const L = o => (o ? (o[lang()] || o.en || "") : "");
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  /* ====================================================================
     ГОЛОС MAPER: робот читает свой текст вслух (Web Speech API).
     Что исправлено по сравнению с первой версией:
       • нормальная высота голоса (pitch 1.0 вместо 0.82 — оттого и «гудел»);
       • скорость по умолчанию 1.15× и три режима: 1.0 / 1.15 / 1.35;
       • умный выбор голоса: Natural / Neural / Online (Microsoft, Google, Яндекс, Apple Enhanced)
         выше, чем компактные «роботизированные»; голос можно переключить кнопкой;
       • новый ключ хранения mapchess_voice_v2, чтобы у всех сбросилась старая медленная скорость.
     ==================================================================== */
  const Voice = (function () {
    const SS = window.speechSynthesis, ok = !!(SS && window.SpeechSynthesisUtterance);
    const cfg = { on: true, rate: 1.15, voice: "" };
    try { Object.assign(cfg, JSON.parse(localStorage.getItem("mapchess_voice_v2") || "{}")); } catch (e) {}
    const save = () => { try { localStorage.setItem("mapchess_voice_v2", JSON.stringify(cfg)); } catch (e) {} };
    let voices = [], token = 0, speaking = false;
    const api = { ok, cfg, cb: null, get speaking() { return speaking; } };
    const state = v => { speaking = v; if (api.cb) api.cb(); };
    const loadV = () => { try { voices = SS.getVoices() || []; } catch (e) {} };
    if (ok) { loadV(); try { SS.addEventListener("voiceschanged", loadV); } catch (e) { SS.onvoiceschanged = loadV; } }

    const RU_SQ = { a: "а", b: "бэ", c: "цэ", d: "дэ", e: "е", f: "эф", g: "гэ", h: "аш" };
    const RU_PC = { K: "король", Q: "ферзь", R: "ладья", B: "слон", N: "конь" };
    const EN_PC = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight" };
    /* делаем текст «говорящим»: ходы (Nf7#, exd5, O-O) -> слова, эмодзи и стрелки убираем */
    function speakable(s, ru) {
      const fl = f => (ru ? RU_SQ[f] : f), names = ru ? RU_PC : EN_PC;
      return String(s)
        .replace(/MAPER/g, ru ? "Мэйпер" : "Maper")
        .replace(/O-O-O/g, ru ? "длинная рокировка" : "long castle")
        .replace(/O-O/g, ru ? "короткая рокировка" : "short castle")
        .replace(/\(([a-h])[–-]([a-h])\)/g, (m, a, b) => ru ? `(от ${fl(a)} до ${fl(b)})` : `(from ${a} to ${b})`)
        .replace(/\b(\d)[–-](\d)\b/g, ru ? "от $1 до $2" : "$1 to $2")
        .replace(/(^|\s)\d+\.(?:\.\.)?(?=[KQRBNa-h])/g, "$1")
        .replace(/\b([KQRBN])?([a-h])?(x)?([a-h])([1-8])(?:=([QRBN]))?([+#])?/g, (m, pc, ff, x, f, r, pr, ch) => {
          let o = pc ? names[pc] + " " : "";
          if (ff) o += fl(ff) + " ";
          if (x) o += ru ? "бьёт " : "takes ";
          o += fl(f) + " " + r;
          if (pr) o += (ru ? " превращение в " : " promotes to ") + names[pr];
          if (ch) o += ru ? (ch === "#" ? " мат" : " шах") : (ch === "#" ? " mate" : " check");
          return o;
        })
        .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ", ")
        .replace(/[«»"]/g, "").replace(/\s[—–-]\s/g, ", ").replace(/[·•]/g, ", ")
        .replace(/(,\s*){2,}/g, ", ").replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();
    }
    /* оценка голоса: нейросетевые («Natural», «Neural», «Online») звучат как человек, компактные — как робот */
    function score(v) {
      const n = (v.name || "") + " " + (v.voiceURI || "");
      let s = 0;
      if (/natural|neural|online|enhanced|premium/i.test(n)) s += 8;
      if (/microsoft/i.test(n)) s += 3;
      if (/svetlana|dmitry|katya|milena|yuri|pavel|irina|alena|aleksandr|yandex|google|samantha|aria|jenny|guy|daniel|alex/i.test(n)) s += 3;
      if (/compact|espeak|festival|mbrola|pico|novelty|whisper|bad news|bells|boing|bubbles|cellos|deranged|good news|hysterical|junior|organ|trinoids|zarvox/i.test(n)) s -= 12;
      if (v.localService === false) s += 1;
      return s;
    }
    function list(ru) {
      const code = ru ? "ru" : "en";
      return voices.filter(v => (v.lang || "").toLowerCase().replace("_", "-").indexOf(code) === 0).sort((a, b) => score(b) - score(a));
    }
    function pick(ru) {
      const l = list(ru);
      return l.find(v => v.voiceURI === cfg.voice || v.name === cfg.voice) || l[0] || null;
    }
    api.speakable = speakable;
    api.hasVoice = () => { if (ok && !voices.length) loadV(); return ok && voices.length > 0; };
    api.voiceInfo = () => { const v = pick(lang() === "ru"); return v ? v.name.replace(/^(Microsoft|Google)\s+/i, "").replace(/\s*-.*$/, "") : ""; };
    api.stop = function () { token++; if (ok) { try { SS.cancel(); } catch (e) {} } if (speaking) state(false); };
    api.say = function (text, force) {
      if (!ok || (!cfg.on && !force)) return;
      const ru = lang() === "ru", my = ++token;
      try { SS.cancel(); } catch (e) {}
      if (!voices.length) loadV();
      /* режем на предложения: Chrome обрывает слишком длинные фразы, а короткие читаются живее */
      const parts = (speakable(text, ru).match(/[^.!?…]+[.!?…]*/g) || []).map(x => x.trim()).filter(x => /[\wа-яё]/i.test(x));
      if (!parts.length) { state(false); return; }
      const v = pick(ru); state(true);
      /* Chrome иногда «залипает» после cancel() — короткая пауза перед новой речью решает это */
      setTimeout(() => {
        if (my !== token) return;
        parts.forEach((p, k) => {
          const u = new SpeechSynthesisUtterance(p);
          u.lang = v && v.lang ? v.lang : (ru ? "ru-RU" : "en-US"); if (v) u.voice = v;
          u.rate = cfg.rate; u.pitch = 1; u.volume = 1;
          u.onend = u.onerror = () => { if (my === token && k === parts.length - 1) state(false); };
          SS.speak(u);
        });
      }, 40);
    };
    api.toggle = () => { cfg.on = !cfg.on; save(); if (!cfg.on) api.stop(); return cfg.on; };
    api.cycle = () => { const R = [1.15, 1.35, 1]; const k = R.indexOf(cfg.rate); cfg.rate = R[(k + 1) % R.length]; save(); };
    /* переключение голоса по кругу (только лучшие 4 для текущего языка) */
    api.nextVoice = () => {
      const l = list(lang() === "ru").slice(0, 4); if (l.length < 2) return false;
      const cur = pick(lang() === "ru"), k = l.indexOf(cur);
      cfg.voice = l[(k + 1) % l.length].voiceURI || l[(k + 1) % l.length].name; save(); return true;
    };
    api.canSwitch = () => list(lang() === "ru").length > 1;
    /* iOS/Safari: «разбудить» синтез на первом касании */
    if (ok) document.addEventListener("pointerdown", function once() {
      document.removeEventListener("pointerdown", once, true);
      try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; SS.speak(u); } catch (e) {}
    }, true);
    document.addEventListener("visibilitychange", () => { if (document.hidden) api.stop(); });
    return api;
  })();

  /* ====================================================================
     ИКОНКИ: единый набор линейных иконок сайта (24×24, штрих 1.8, скруглённые концы).
     Никаких эмодзи — всё рисуется в цвет текста (currentColor).
     ==================================================================== */
  const SVG = (body, sz) => `<svg class="ic" viewBox="0 0 24 24" width="${sz || 24}" height="${sz || 24}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const IC = {
    board: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke-width="1.3" opacity=".55"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="currentColor" stroke="none" opacity=".9"/>',
    moves: '<path d="M7 20v-9a4 4 0 0 1 4-4h6"/><path d="M14 3.8L17.4 7 14 10.2"/><circle cx="7" cy="20" r="1.4" fill="currentColor" stroke="none"/>',
    check: '<path d="M12 3l7.5 3v5.4c0 4.7-3.2 8.2-7.5 9.6-4.3-1.4-7.5-4.9-7.5-9.6V6z"/><path d="M12 8.2v4.4M12 15.6v.4"/>',
    castle: '<path d="M5.5 20.5h13M7 20.5V9.5h10v11"/><path d="M6 9.5V5.5h2.3v2h2V5.5h3.4v2h2V5.5H18v4"/><path d="M10.3 20.5v-4.2a1.7 1.7 0 0 1 3.4 0v4.2"/>',
    pawns: '<circle cx="12" cy="7.2" r="3.2"/><path d="M9.6 12h4.8M8.6 20.5c.3-3.4 1.3-5.6 3.4-8.5 2.1 2.9 3.1 5.1 3.4 8.5zM7 20.5h10"/>',
    values: '<path d="M12 4v16M7 20h10M5 7.5h14"/><path d="M5 7.5l-3 6.2a3.2 3.2 0 0 0 6 0zM19 7.5l-3 6.2a3.2 3.2 0 0 0 6 0z"/>',
    tactics: '<path d="M12 21V8.5M5.5 4v4.2a6.5 6.5 0 0 0 13 0V4M12 8.5V3"/>',
    mates: '<path d="M12 2.8v4.4M9.8 5h4.4"/><path d="M7 20.5l1.4-8.2a3.7 3.7 0 0 1 7.2 0l1.4 8.2zM5.5 20.5h13"/>',
    mate1: '<path d="M12 2.8v4.4M9.8 5h4.4"/><path d="M7 20.5l1.4-8.2a3.7 3.7 0 0 1 7.2 0l1.4 8.2zM5.5 20.5h13"/><path d="M10 14.5h4"/>',
    forks: '<path d="M12 21V11M5.5 3v4.2a6.5 6.5 0 0 0 13 0V3"/><path d="M12 11V6" opacity=".4"/>',
    pins: '<path d="M12 3l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.4 7 18.2l1.2-5.6L4 8.8l5.6-.6z"/><path d="M12 18v3.5"/>',
    threats: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.2" stroke-width="2.2"/>',
    disc: '<rect x="3" y="9" width="6" height="6" rx="1.5"/><path d="M12 12h9M17.5 8.5L21 12l-3.5 3.5"/>',
    kpk: '<circle cx="12" cy="6.6" r="3"/><path d="M9.8 11.4h4.4M8.8 20c.3-3.2 1.2-5.2 3.2-8 2 2.8 2.9 4.8 3.2 8zM7 20.5h10"/><path d="M19 4v6M16.5 7h5" opacity=".6"/>',
    mate2: '<path d="M12 2.8v4.4M9.8 5h4.4"/><path d="M7 20.5l1.4-8.2a3.7 3.7 0 0 1 7.2 0l1.4 8.2zM5.5 20.5h13"/><path d="M10.2 13.6h3.6M12 11.8v3.6" stroke-width="1.4"/>',
    sac: '<path d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.9 4.9L12 14.4l-4.4 2.1.9-4.9L5 8.2l4.8-.6z"/><path d="M4 21h16"/>',
    mate3: '<path d="M12 2.8v4.4M9.8 5h4.4"/><path d="M7 20.5l1.4-8.2a3.7 3.7 0 0 1 7.2 0l1.4 8.2zM5.5 20.5h13"/><path d="M9.4 13h5.2M9.4 16h5.2" stroke-width="1.4"/>',
    opening: '<circle cx="5.6" cy="17.6" r="2"/><circle cx="12" cy="9.4" r="2"/><circle cx="18.4" cy="16.2" r="2"/><path d="M7 16l3.8-5M13.6 10.7l3.4 3.9" stroke-dasharray="1.2 3"/><path d="M12 5V2.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.6c3-1.7 5.4 1.7 8.4 0 1.5-.85 2.9-.9 3.6-.6v8c-.7-.3-2.1-.25-3.6.6-3 1.7-5.4-1.7-8.4 0"/>',
    bulb: '<path d="M9.2 17.5h5.6M10 20.5h4M12 3.2a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1.3h5v-1.3c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.2z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.6"/>',
    redo: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.2v4.2H8.7"/>',
    left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check2: '<path d="M5 12.5l4.6 4.6L19 7.5" stroke-width="2.4"/>',
    voice: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.6-3.6 3-5.6 6.5-5.6s5.9 2 6.5 5.6"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.8c.6-.9 1.5-1.3 2.5-1.3 1.4 0 2.5.7 2.5 1.8 0 2.5-5 1.4-5 4 0 1 1.1 1.8 2.5 1.8 1 0 1.9-.4 2.5-1.3" stroke-width="1.5"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="2.2"/><path d="M12 9v11.5M3.5 13.5h17"/><path d="M12 9C8.8 9 7.4 7.4 8 5.9s3.2-.9 4 3.1c.8-4 3.6-4.6 4-3.1s-.8 3.1-4 3.1"/>',
    ask: '<path d="M9 9.2a3.1 3.1 0 1 1 4.3 2.8c-.8.4-1.3 1-1.3 1.9"/><path d="M12 18.2v.1" stroke-width="2.4"/>',
    wdisc: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
    bdisc: '<circle cx="12" cy="12" r="6.2"/>'
  };
  /* значки для новых уроков — берём готовые */
  Object.assign(IC, { stale: IC.check, kqk: IC.mate1, krk: IC.mate1, passed: IC.pawns, rooks: IC.tactics, outpost: IC.target,
    ladder: IC.mates, batt: IC.mate2, smoth: IC.mate3, anas: IC.mate2, arab: IC.mate2, dbl: IC.check, epau: IC.mate3, boden: IC.sac, legal: IC.sac });
  const ico = (k, sz) => SVG(IC[k] || IC.board, sz);
  const lessonIcon = id => ico(IC[id] ? id : "board", 28);
  /* ★ как SVG: звёзды одного размера и цвета на всём сайте */
  const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.75 5.8 6.35.85-4.65 4.4 1.2 6.3L12 17.05 6.35 20.15l1.2-6.3L2.9 9.45l6.35-.85z"/></svg>';

  /* ====================================================================
     ДАННЫЕ: УРОКИ  (каждый шаг — задача на доске или вопрос от MAPER)
     move-шаг: fen, say, ok(mv,g), good, tip, wrong(mv,g)
     tap-шаг : tap:[клетки], say, good, wrong(sq), tip
     quiz    : quiz:{opts:[…], correct}, say, why, tip
     ==================================================================== */
  const M = (fen, say, ok, good, tip, wrong) => ({ fen, say, ok, good, tip, wrong });
  const T = (tap, say, good, wrong, tip) => ({ fen: START, tap, say, good, wrong, tip });
  const Q = (fen, hl, say, opts, correct, why, tip) => ({ fen, hl, say, quiz: { opts, correct }, why, tip });
  /* новые типы шагов */
  const Ms = (...sans) => m => sans.includes(m.san.replace(/[+#]/g, ""));                  /* ход из списка (SAN без + и #) */
  const TT = (fen, tap, say, good, wrong, tip) => ({ fen, tap, say, good, wrong, tip });  /* tap-шаг на своей позиции */
  const lineOk = (st, m, g) => { const e = st.line[S.li][0]; return e === "#" ? g.in_checkmate() : e.includes(m.san.replace(/[+#]/g, "")); };
  /* Ln: комбинация из нескольких ходов. line = [[допустимые ходы | "#", ответ соперника | null], ...]; "#" — любой ход, ставящий мат */
  const Ln = (fen, line, say, good, tip, wrong) => { const st = { fen, line, say, good, tip, wrong }; st.ok = (m, g) => lineOk(st, m, g); return st; };
  const isTo = (sq, piece) => m => m.to === sq && (!piece || m.piece === piece);
  const mateOk = (m, g) => g.in_checkmate();
  const staleWrong = (m, g) => g.in_stalemate()
    ? B("Stalemate! Black has no moves but is NOT in check — that's a draw. Find the move that gives CHECKMATE.",
        "Пат! У чёрных нет ходов, но шаха нет — это ничья. Найди ход, после которого будет МАТ.") : null;

  /* MN: «мат в N» с проверкой решателем: принимается ЛЮБОЙ ход, ведущий к форсированному мату; соперник защищается как может */
  const MN = (fen, n, say, tip) => {
    const st = { fen, mateN: n, say, tip, good: B("Checkmate! Forced from the first move.", "Мат! И он был форсированным с первого хода."),
      tipDefault: true, line: Array.from({ length: n }, () => [null, null]) };
    st.ok = (m, g) => {
      if (g.in_checkmate()) return true;
      if (!window.MateSolver || !game) return false;
      const left = n - (S && S.li ? S.li : 0);
      const sols = MateSolver.solutions(game.fen(), left) || [];
      return sols.some(x => x.from === m.from && x.to === m.to && (x.promotion || "") === (m.promotion || ""));
    };
    st.wrong = (m, g) => g.in_stalemate() ? B("Stalemate — that's a draw! Find the mating move.", "Пат — это ничья! Найди матующий ход.") : null;
    return st;
  };
  const LESSONS = [
    { id: "board", icon: "▦", t: B("Board & coordinates", "Доска и координаты"), d: B("Name any square in a second", "Называй любую клетку за секунду"),
      steps: [
        T(["e4"], B("Hi, I'm MAPER! Every square has a name: a letter (file) + a number (rank). Tap square e4.", "Привет, я MAPER! У каждой клетки есть имя: буква (вертикаль) + цифра (горизонталь). Нажми на клетку e4."),
          B("Yes! File e, rank 4 — the very centre of the board.", "Верно! Вертикаль e, горизонталь 4 — это самый центр доски."),
          sq => B(`That's ${sq}. Letters go left→right (a–h), numbers bottom→top (1–8).`, `Это ${sq}. Буквы идут слева направо (a–h), цифры — снизу вверх (1–8).`),
          B("Find the letter e at the bottom, then count 4 rows up.", "Найди внизу букву e и отсчитай 4 ряда вверх.")),
        T(["d1"], B("Where does White's queen start? Tap her square.", "Где в начале стоит белый ферзь? Нажми на его клетку."),
          B("Right, d1. Rule: the queen stands on her own colour — white queen on a light square.", "Верно, d1. Правило: ферзь стоит на своём цвете — белый ферзь на светлой клетке."),
          sq => B(`That's ${sq}. Look at the bottom row: rook, knight, bishop… then the queen.`, `Это ${sq}. Смотри на нижний ряд: ладья, конь, слон… и дальше ферзь.`),
          B("The queen is right next to the king.", "Ферзь стоит рядом с королём.")),
        Q(START, ["h1"], B("What colour is the bottom-right corner square (h1)?", "Какого цвета клетка в правом нижнем углу (h1)?"),
          [B("Light", "Светлая"), B("Dark", "Тёмная")], 0,
          B("Correct! Remember: «light square on the right». It helps to set the board up properly.", "Верно! Запомни: «светлая клетка — справа». Так всегда правильно ставят доску."),
          B("Look at the highlighted square.", "Посмотри на подсвеченную клетку.")),
        Q(START, [], B("How many pieces does each player have at the start?", "Сколько фигур у каждого игрока в начале партии?"),
          [B("8", "8"), B("16", "16"), B("32", "32")], 1,
          B("16: 8 pawns + 8 pieces (king, queen, 2 rooks, 2 bishops, 2 knights). 32 is both sides together.", "16: 8 пешек + 8 фигур (король, ферзь, 2 ладьи, 2 слона, 2 коня). 32 — это обе стороны вместе."),
          B("Count one side only.", "Считай только одну сторону."))
      ] },

    { id: "moves", icon: "♞", t: B("How the pieces move", "Как ходят фигуры"), d: B("Each piece — one practice move", "Каждая фигура — один тренировочный ход"),
      steps: [
        M("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", B("ROOK: straight lines, any distance. Move her from a1 all the way up to a8.", "ЛАДЬЯ ходит по прямым на любое расстояние. Подними её с a1 до самого a8."),
          isTo("a8", "r"), B("Exactly! The rook slides like a rail car. (And she gave check too!)", "Точно! Ладья скользит как по рельсам. (Кстати, это ещё и шах!)"),
          B("Click the rook, then the square at the top of the a-file.", "Нажми на ладью, затем на клетку в самом верху вертикали «a»."),
          m => m.piece !== "r" ? B("That's the king. I need the rook — the tower.", "Это король. Мне нужна ладья — фигура-башня.") : B("The rook goes in a straight line — up the a-file to a8.", "Ладья идёт по прямой — вверх по вертикали «a» до a8.")),
        M("4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", B("BISHOP: diagonals only. Send it from c1 to h6.", "СЛОН ходит только по диагоналям. Отправь его с c1 на h6."),
          isTo("h6", "b"), B("Great! A bishop never leaves its colour — this one lives on dark squares forever.", "Отлично! Слон всегда остаётся на клетках своего цвета — этот навсегда на тёмных."),
          B("From c1 go diagonally up-right: d2, e3, f4, g5, h6.", "С c1 по диагонали вправо-вверх: d2, e3, f4, g5, h6."),
          m => m.piece !== "b" ? B("Wrong piece — take the bishop.", "Не та фигура — нужен слон.") : B("A bishop can't go straight. Move diagonally: c1 → h6.", "Слон не ходит по прямой. Только по диагонали: c1 → h6.")),
        M("4k3/8/8/8/8/8/8/1N2K3 w - - 0 1", B("KNIGHT: an «L» — two squares one way, one square sideways. It jumps over pieces! Jump from b1 to c3.", "КОНЬ ходит буквой «Г»: две клетки в одну сторону и одна в бок. Он прыгает через фигуры! Прыгни с b1 на c3."),
          isTo("c3", "n"), B("Yes! Up 2 (b3), right 1 → c3. The knight is the only piece that jumps.", "Да! Вверх на 2 (b3), вправо на 1 → c3. Конь — единственная фигура, которая прыгает."),
          B("Two up, one to the right.", "Две клетки вверх и одна вправо."),
          m => m.piece !== "n" ? B("Take the knight (the horse).", "Нужен конь (лошадка).") : B("That's also an «L», but not the one I asked for. I need c3.", "Это тоже «Г», но я просил c3.")),
        M("4k3/8/8/8/8/8/8/3QK3 w - - 0 1", B("QUEEN: rook + bishop in one. Go diagonally from d1 to h5.", "ФЕРЗЬ — это ладья и слон в одном. Иди по диагонали с d1 на h5."),
          isTo("h5", "q"), B("Right! The queen is the strongest piece: any direction, any distance. Check again, by the way", "Верно! Ферзь — самая сильная фигура: любое направление, любое расстояние. И опять шах"),
          B("d1 → e2 → f3 → g4 → h5 is a diagonal.", "d1 → e2 → f3 → g4 → h5 — это диагональ."),
          m => m.piece !== "q" ? B("Take the queen.", "Нужен ферзь.") : B("Right piece! But h5 is on a diagonal from d1.", "Фигура верная! Но h5 — на диагонали от d1.")),
        M("4k3/8/8/8/8/8/8/4K3 w - - 0 1", B("KING: one square in any direction. Make any king move.", "КОРОЛЬ ходит на одну клетку в любую сторону. Сделай любой ход королём."),
          m => m.piece === "k", B("Yes. The king is slow but the most important piece: lose him and the game is over.", "Да. Король медленный, но самый важный: потеряешь его — партия проиграна."),
          B("Click the king and choose a highlighted neighbour square.", "Нажми на короля и выбери подсвеченную соседнюю клетку.")),
        M("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", B("PAWN: forward only. From its starting square it may go 2 squares. Push e2 → e4.", "ПЕШКА ходит только вперёд, а с исходной клетки может пойти на две. Сыграй e2 → e4."),
          isTo("e4", "p"), B("Perfect! Two squares only on the first move; after that — one at a time.", "Отлично! На две клетки — только первым ходом, потом по одной."),
          B("Click the pawn, pick the square 2 ahead.", "Нажми на пешку и выбери клетку через одну вперёд."),
          m => m.to === "e3" ? B("Legal, but I asked for the double step: e4!", "Ход верный, но я просил двойной шаг: e4!") : B("Pawns can't do that. Straight ahead: e4.", "Пешка так не ходит. Прямо вперёд: e4.")),
        M("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", B("Pawns MOVE straight but CAPTURE diagonally. Take the black pawn on d5!", "Пешка ХОДИТ прямо, а БЬЁТ по диагонали. Возьми чёрную пешку на d5!"),
          m => m.captured === "p" && m.to === "d5", B("Capture! exd5 — the pawn took diagonally and landed on the captured square.", "Взятие! exd5 — пешка ударила по диагонали и встала на место съеденной."),
          B("From e4 one square diagonally forward-left.", "С e4 на одну клетку по диагонали вперёд-влево."),
          m => m.to === "e5" ? B("Pawns can't capture straight ahead. Go diagonally: exd5.", "Прямо пешка не бьёт. Нужно по диагонали: exd5.") : null)
      ] },

    { id: "check", icon: "⚔", t: B("Check, mate, stalemate", "Шах, мат и пат"), d: B("Attack, defend, deliver mate", "Атакуй, защищайся, ставь мат"),
      steps: [
        M("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", B("CHECK = the king is attacked. Give the black king a check with your rook!", "ШАХ — это когда королю угрожают. Объяви чёрному королю шах ладьёй!"),
          (m, g) => g.in_check(), B("Check! Black MUST now answer it — that's the rule.", "Шах! Теперь чёрные ОБЯЗАНЫ на него ответить — таково правило."),
          B("Which line leads to the king on e8? Think of the 8th rank.", "По какой линии можно атаковать короля на e8? Подумай о восьмой горизонтали.")),
        M("7k/8/8/8/8/8/4q3/4K3 w - - 0 1", B("YOU are in check from the queen! Way #1: capture the attacker. Is it protected?", "Тебе ШАХ от ферзя! Способ №1: съесть нападающую фигуру. Она защищена?"),
          m => m.piece === "k" && m.captured === "q", B("Kxe2! The queen was unprotected. Capturing the attacker is the first thing to look for.", "Kxe2! Ферзь стоял без защиты. Съесть нападающего — первое, что надо проверять."),
          B("The queen is right next to your king.", "Ферзь стоит прямо рядом с твоим королём.")),
        M("4r1k1/8/8/8/8/3P4/3N4/4K3 w - - 0 1", B("Check from the rook! Way #2: BLOCK the line with another piece. Use the knight — and note it's protected by the d3 pawn.", "Шах ладьёй! Способ №2: ЗАКРЫТЬСЯ другой фигурой. Используй коня — и заметь, его защищает пешка d3."),
          m => m.piece === "n" && m.to === "e4", B("Ne4! The block is safe: if Rxe4, then dxe4 and you win a rook.", "Ne4! Закрылись надёжно: если Rxe4, то dxe4 — и ты выиграл ладью."),
          B("The knight must land on the e-file between the rook and the king.", "Конь должен встать на вертикаль «e» между ладьёй и королём."),
          m => m.piece === "k" ? B("The king can run, but I asked you to BLOCK with the knight.", "Король мог бы уйти, но я просил ЗАКРЫТЬСЯ конём.") : B("This doesn't stop the check. Block on the e-file.", "Так шах не снять. Закройся на вертикали «e».")),
        M("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", B("CHECKMATE = check with no defence. The black king is boxed in by his own pawns. Deliver mate in one!", "МАТ — шах, от которого нет защиты. Чёрного короля запирают его же пешки. Поставь мат в один ход!"),
          mateOk, B("Ra8#! The king can't escape, capture or block. The game is won.", "Ra8#! Королю некуда уйти, съесть и закрыться нечем. Партия выиграна."),
          B("The same rook as before, same 8th rank.", "Та же ладья и та же восьмая горизонталь."), staleWrong),
        M("7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", B("Careful: with an extra queen it's easy to STALEMATE. Mate the black king on h8 — not stalemate!", "Осторожно: с лишним ферзём легко поставить ПАТ. Поставь мат королю h8 — только не пат!"),
          mateOk, B("Qg7#! Your queen is protected by the king, so Black can't take her.", "Qg7#! Ферзя защищает король, поэтому чёрные не могут его съесть."),
          B("Put the queen next to the king — protected by your own king.", "Поставь ферзя рядом с чёрным королём — под защиту своего короля."), staleWrong)
      ] },

    { id: "castle", icon: "🏰", t: B("Castling", "Рокировка"), d: B("Hide the king, wake the rook", "Спрячь короля, включи ладью"),
      steps: [
        M("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", B("CASTLING: one move for two pieces. Move the KING two squares toward the h1 rook — short castling.", "РОКИРОВКА — один ход двумя фигурами. Передвинь КОРОЛЯ на две клетки к ладье h1 — короткая рокировка."),
          m => m.san === "O-O", B("O-O! The king hid on g1 and the rook jumped to f1, ready to fight.", "O-O! Король спрятался на g1, а ладья прыгнула на f1 и готова к бою."),
          B("Click the king and choose g1.", "Нажми на короля и выбери g1."),
          m => m.piece === "r" ? B("Start with the KING — the rook will jump by itself.", "Начинай с КОРОЛЯ — ладья перепрыгнет сама.") : B("Two squares toward the rook: e1 → g1.", "На две клетки к ладье: e1 → g1.")),
        M("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", B("Now LONG castling — toward the a1 rook (three squares of rook travel, king goes two).", "Теперь ДЛИННАЯ рокировка — в сторону ладьи a1 (король идёт на две клетки)."),
          m => m.san === "O-O-O", B("O-O-O! King on c1, rook on d1. Long castling takes one more tempo, but it's powerful.", "O-O-O! Король на c1, ладья на d1. Длинная рокировка чуть медленнее, зато сильная."),
          B("King e1 → c1.", "Король e1 → c1.")),
        M("4k3/8/8/8/8/5r2/8/R3K2R w KQ - 0 1", B("A black rook attacks f1. The king may NOT pass through an attacked square. Castle on the side where it's allowed!", "Чёрная ладья бьёт по f1. Король НЕ может проходить через битое поле. Рокируйся в ту сторону, где можно!"),
          m => m.san === "O-O-O", B("Right! Short castling is illegal (f1 is attacked), long castling is fine: d1 and c1 are safe.", "Верно! Короткая запрещена (f1 под боем), а длинная можно: d1 и c1 безопасны."),
          B("Check which squares the king would cross.", "Проверь, какие поля пересекает король."),
          m => B("Close. Remember: not through attacked squares. Try the other side.", "Почти. Помни: нельзя через битые поля. Попробуй другую сторону."))
      ] },

    { id: "pawns", icon: "♟", t: B("Pawn specials", "Особые ходы пешки"), d: B("En passant and promotion", "Взятие на проходе и превращение"),
      steps: [
        M("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", B("Black just played d7–d5, jumping past your pawn. You may capture it «in passing» — as if it moved only one square. Do it!", "Чёрные только что сыграли d7–d5, проскочив мимо твоей пешки. Её можно взять «на проходе» — как будто она шла на одну клетку. Бери!"),
          m => (m.flags || "").indexOf("e") >= 0, B("En passant! Your pawn lands on d6 and the d5 pawn disappears. Only possible right after the double step.", "Взятие на проходе! Пешка встала на d6, а пешка d5 исчезла. Это можно только сразу после двойного хода."),
          B("Capture diagonally — to the square the black pawn jumped over (d6).", "Бей по диагонали — на клетку, которую перепрыгнула чёрная пешка (d6)."),
          m => m.to === "e6" ? B("A normal step. En passant goes to d6, diagonally.", "Это обычный шаг. Взятие на проходе — на d6, по диагонали.") : null),
        M("8/P3k3/8/8/8/8/8/4K3 w - - 0 1", B("PROMOTION: a pawn that reaches the last rank becomes any piece. Run a7 → a8 and choose!", "ПРЕВРАЩЕНИЕ: пешка, дошедшая до последней горизонтали, становится любой фигурой. Иди a7 → a8 и выбирай!"),
          m => !!m.promotion, (m) => m.promotion === "q"
            ? B("A new QUEEN! The best choice almost every time.", "Новый ФЕРЗЬ! Почти всегда это лучший выбор.")
            : B("Allowed! But a queen is usually stronger — keep that in mind.", "Можно! Но ферзь обычно сильнее — запомни."),
          B("Just move the pawn forward to the last rank.", "Просто доведи пешку до последней горизонтали.")),
        Q(START, ["e2", "e4"], B("How many squares can a pawn move on its very first move?", "На сколько клеток может пойти пешка первым ходом?"),
          [B("Only 1", "Только на 1"), B("1 or 2", "На 1 или на 2"), B("Any number", "На сколько угодно")], 1,
          B("1 or 2 — but only from its starting square. Afterwards only 1.", "На 1 или на 2 — но только с исходной клетки. Потом только на 1."))
      ] },

    { id: "values", icon: "⚖", t: B("Piece values & trades", "Ценность фигур и размены"), d: B("Don't give away material", "Не отдавай материал даром"),
      steps: [
        Q(START, [], B("Pawn = 1, knight = bishop = 3, rook = 5. How many points is the queen worth?", "Пешка = 1, конь = слон = 3, ладья = 5. Сколько очков стоит ферзь?"),
          [B("7", "7"), B("9", "9"), B("12", "12")], 1,
          B("9! The king has no price — you can't trade him.", "9! У короля цены нет — его нельзя разменять.")),
        M("4k3/3p4/8/3n4/8/8/8/3RK3 w - - 0 1", B("Free material! Capture the black piece that nobody protects.", "Бесплатный материал! Забери чёрную фигуру, которую никто не защищает."),
          m => m.captured === "n", B("Rxd5! A free knight (+3). Always check: «is it protected?»", "Rxd5! Конь достался даром (+3). Всегда проверяй: «а он защищён?»"),
          B("Look along the d-file.", "Посмотри вдоль вертикали «d».")),
        Q("4k3/8/2p5/1n6/8/8/8/1R2K3 w - - 0 1", ["b5", "c6"], B("Is Rxb5 (rook takes knight) a good idea here?", "Хорошая ли идея Rxb5 (ладья берёт коня)?"),
          [B("Yes, a free knight", "Да, конь бесплатный"), B("No — the c6 pawn recaptures: rook (5) for a knight (3)", "Нет — пешка c6 побьёт ладью: ладья (5) за коня (3)"), B("Doesn't matter", "Без разницы")], 1,
          B("Right! The knight is protected by the pawn on c6. Trading a rook for a knight loses 2 points.", "Верно! Коня защищает пешка c6. Менять ладью на коня — минус 2 очка."),
          B("Who defends the knight on b5?", "Кто защищает коня на b5?"))
      ] },

    { id: "tactics", icon: "🎯", t: B("Fork, pin, skewer", "Вилка, связка, линейный удар"), d: B("Three ways to win material", "Три способа выиграть материал"),
      steps: [
        M("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", B("FORK: one piece attacks two targets at once. Find the knight jump that attacks the king AND the rook.", "ВИЛКА: одна фигура бьёт сразу две цели. Найди прыжок коня, который атакует короля И ладью."),
          isTo("c7", "n"), B("Nc7+! The king must move, and then the knight takes the rook on a8.", "Nc7+! Король обязан уйти, и конь возьмёт ладью a8."),
          B("From d5 the knight can go to c7 — count its «L».", "С d5 конь может прыгнуть на c7 — посчитай «Г»."),
          B("Not a fork. I need a square that hits both e8 and a8.", "Это не вилка. Нужна клетка, откуда бьют и e8, и a8.")),
        M("4k3/3n4/8/8/8/8/4B3/4K3 w - - 0 1", B("PIN: a piece can't move because a more valuable one stands behind it. Pin the knight d7 to the king with your bishop!", "СВЯЗКА: фигура не может ходить, потому что за ней стоит более ценная. Свяжи коня d7 с королём слоном!"),
          isTo("b5", "b"), B("Bb5! If the knight moves, the bishop gives check — so it's frozen.", "Bb5! Если конь пойдёт, слон даст шах — поэтому он «заморожен»."),
          B("The bishop, the knight d7 and the king e8 must stand on one diagonal.", "Слон, конь d7 и король e8 должны стоять на одной диагонали."),
          B("Not a pin. The diagonal b5–c6–d7–e8 is the one.", "Это не связка. Нужна диагональ b5–c6–d7–e8.")),
        M("3k3r/8/8/8/8/8/8/R3K3 w - - 0 1", B("SKEWER: attack a valuable piece so it must step aside — and take what stands behind it. Check the king so you also hit his rook.", "ЛИНЕЙНЫЙ УДАР: бьёшь ценную фигуру, она уходит — и ты берёшь ту, что стояла за ней. Дай шах так, чтобы заодно бить ладью."),
          isTo("a8", "r"), B("Ra8+! The king steps aside, and Rxh8 wins the rook.", "Ra8+! Король уйдёт, а Rxh8 выиграет ладью."),
          B("Both the king and the rook are on the 8th rank.", "И король, и ладья стоят на восьмой горизонтали."),
          B("The king and the rook must be on one line with your rook.", "Король и ладья должны быть на одной линии с твоей ладьёй."))
      ] },

    { id: "mates", icon: "♚", t: B("Mating patterns", "Матовые схемы"), d: B("Three classic mates", "Три классических мата"),
      steps: [
        M("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", B("BACK-RANK MATE: the king is locked behind his own pawns. Mate in one!", "МАТ НА ПОСЛЕДНЕЙ ГОРИЗОНТАЛИ: король заперт своими пешками. Мат в один ход!"),
          mateOk, B("Rd8#! Remember it for your own king: give it an escape square (h3-type luft).", "Rd8#! Запомни и для своего короля: оставляй ему «форточку» (ход пешки h3)."),
          B("Which rank is the king trapped on?", "На какой горизонтали заперт король?"), staleWrong),
        M("k7/8/1K6/8/8/8/8/6Q1 w - - 0 1", B("QUEEN + KING MATE: the king takes the escape squares, the queen delivers check. Beware of stalemate!", "МАТ ФЕРЗЁМ И КОРОЛЁМ: король забирает поля, ферзь даёт шах. Берегись пата!"),
          mateOk, B("Qg8#! The king b6 covers a7 and b7; the queen covers the whole 8th rank.", "Qg8#! Король b6 закрывает a7 и b7, а ферзь — всю восьмую горизонталь."),
          B("Give check along the 8th rank from far away.", "Дай шах по восьмой горизонтали издалека."), staleWrong),
        M("6rk/6pp/8/6N1/8/8/8/4K3 w - - 0 1", B("SMOTHERED MATE: the king is suffocated by his own pieces. Only a knight can finish this!", "УДУШЕННЫЙ МАТ: короля душат собственные фигуры. Поставить его может только конь!"),
          mateOk, B("Nf7#! The most beautiful mate: king and rook have no squares.", "Nf7#! Самый красивый мат: у короля и ладьи нет ни одного поля."),
          B("Which knight square attacks h8?", "С какой клетки конь бьёт по h8?"), staleWrong)
      ] },

    /* ============ НОВЫЕ УРОКИ: чем выше по тропе, тем сложнее ============ */
    { id: "mate1", lvl: 2, icon: "", t: B("Mate in one", "Мат в один ход"), d: B("Find the only mating move", "Найди единственный матующий ход"),
      steps: [
        M("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w - - 0 1",
          B("The f7 pawn is guarded only by the king. One move ends the game on the spot — deliver mate!", "Пешка f7 защищена только королём. Один ход заканчивает партию — поставь мат!"),
          mateOk, B("Qxf7#! The bishop on c4 protects the queen, so the king can't take her.", "Qxf7#! Слон c4 защищает ферзя, поэтому король его не съест."),
          B("Which pawn is attacked twice and defended once?", "Какая пешка атакована дважды, а защищена один раз?"), staleWrong),
        M("3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
          B("A capture can be mate too. The black king is shut in by his own pawns — take with check!", "Взятие тоже может быть матом. Чёрного короля запирают свои пешки — бери с шахом!"),
          mateOk, B("Rxd8#! Capture and checkmate in one move.", "Rxd8#! Взятие и мат одним ходом."),
          B("Look at the black rook on d8 — who protects it?", "Посмотри на чёрную ладью d8 — кто её защищает?"), staleWrong),
        M("7k/R7/8/8/8/8/8/1R4K1 w - - 0 1",
          B("Two rooks, one king: the «ladder». One rook already cuts off the 7th rank. Finish it!", "Две ладьи против короля — «лесенка». Одна ладья уже отрезала седьмую горизонталь. Заверши дело!"),
          mateOk, B("Rb8#! The a7 rook covers the 7th rank, the b8 rook gives mate on the 8th.", "Rb8#! Ладья a7 закрывает седьмую горизонталь, ладья b8 ставит мат на восьмой."),
          B("The king is stuck on the 8th rank — give check along it.", "Король заперт на восьмой горизонтали — дай шах по ней."), staleWrong),
        M("5rk1/5ppp/5Q2/8/3B4/8/8/6K1 w - - 0 1",
          B("Queen + bishop battery. The rook on f8 stops Qd8+. Which pawn can the queen take WITH mate?", "Батарея ферзь + слон. Ладья f8 не даёт сыграть Qd8+. Какую пешку ферзь может взять С МАТОМ?"),
          mateOk, B("Qxg7#! The bishop on d4 guards the queen, the rook on f8 blocks the king's escape.", "Qxg7#! Слон d4 защищает ферзя, а ладья f8 закрывает королю путь отхода."),
          B("The diagonal d4–g7 points right at the king.", "Диагональ d4–g7 смотрит прямо на короля."), staleWrong),
        M("8/4N1pk/8/8/8/8/6K1/R7 w - - 0 1",
          B("The knight takes away g8 and g6, the pawn blocks g7. Where does the rook mate?", "Конь отнимает поля g8 и g6, пешка закрывает g7. Куда поставить ладью с матом?"),
          mateOk, B("Rh1#! This is Anastasia's mate: the knight and the board edge do all the work.", "Rh1#! Это мат Анастасии: конь и край доски делают всю работу."),
          B("The rook must check along the h-file.", "Ладья должна дать шах по вертикали «h»."), staleWrong)
      ] },

    { id: "forks", lvl: 3, icon: "", t: B("Forks", "Вилки"), d: B("Attack two pieces at once", "Атакуй сразу две фигуры"),
      steps: [
        M("4k3/8/q7/1N6/8/8/8/4K3 w - - 0 1",
          B("The black queen is far from her king. Find the knight CHECK that wins her.", "Чёрный ферзь стоит далеко от своего короля. Найди ШАХ конём, который выигрывает ферзя."),
          Ms("Nc7"), B("Nc7+! The king must move, and then Nxa6 takes the queen.", "Nc7+! Король обязан уйти, и Nxa6 забирает ферзя."),
          B("From b5 the knight reaches c7 — it hits e8 and a6 at once.", "С b5 конь прыгает на c7 — оттуда он бьёт и e8, и a6.")),
        M("2r3k1/5ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1",
          B("The king g8 and the rook c8 stand on squares a knight can fork. Find the forking CHECK.", "Король g8 и ладья c8 стоят на клетках, которые бьёт один конь. Найди вилку с ШАХОМ."),
          Ms("Ne7"), B("Ne7+! After the king moves, Nxc8 wins a whole rook.", "Ne7+! Король отойдёт, и Nxc8 выиграет целую ладью."),
          B("Which square attacks both g8 and c8?", "С какой клетки конь бьёт и g8, и c8?")),
        M("r1bq1rk1/ppp2ppp/3b1n2/8/3PP3/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 1",
          B("Forks aren't only for knights! One pawn push attacks two black pieces. Find it.", "Вилки бывают не только у коней! Один ход пешки атакует сразу две чёрные фигуры. Найди его."),
          Ms("e5"), B("e5! The pawn hits the bishop and the knight. Even after Bxe5 dxe5 White is a piece up for a pawn.", "e5! Пешка бьёт и слона, и коня. Даже после Bxe5 dxe5 белые выигрывают фигуру за пешку."),
          B("Which pawn move attacks d6 and f6 at the same time?", "Какой ход пешки одновременно атакует d6 и f6?"))
      ] },

    { id: "pins", lvl: 3, icon: "", t: B("Hunting pinned pieces", "Охота на связанные фигуры"), d: B("Pins and skewers that win material", "Связки и линейные удары, выигрывающие материал"),
      steps: [
        Q("4k3/4n3/8/3P4/8/8/8/K3R3 w - - 0 1", ["e7", "e1"], B("The black knight on e7 stands between the rook e1 and the king. Can it move?", "Чёрный конь e7 стоит между ладьёй e1 и королём. Может ли он ходить?"),
          [B("Yes, knights jump", "Да, кони прыгают"), B("No — it would expose the king to check", "Нет — король окажется под шахом"), B("Only to capture", "Только со взятием")], 1,
          B("Right: it's pinned to the king, so it can't legally move at all. Now use that!", "Верно: он связан с королём и вообще не может ходить. Давай этим воспользуемся!"),
          B("Think about what the rook would attack if the knight left.", "Подумай, что атаковала бы ладья, если бы конь ушёл.")),
        M("4k3/4n3/8/3P4/8/8/8/K3R3 w - - 0 1",
          B("A pinned piece can't run away. Attack it with a PAWN and win it for nothing!", "Связанная фигура не может убежать. Атакуй её ПЕШКОЙ и выиграй даром!"),
          Ms("d6"), B("d6! The knight is pinned and attacked; the king can't recapture because the rook watches the e-file.", "d6! Конь связан и атакован, а король не может взять пешку — ладья держит вертикаль «e»."),
          B("Which pawn move attacks e7?", "Какой ход пешки атакует e7?")),
        M("7q/6k1/8/8/8/8/3B4/4K3 w - - 0 1",
          B("SKEWER: the queen stands behind the king on the same diagonal. Check the king so he must step aside — then take the queen.", "ЛИНЕЙНЫЙ УДАР: ферзь стоит за королём на одной диагонали. Дай королю шах, чтобы он отошёл, — и бери ферзя."),
          Ms("Bc3"), B("Bc3+! The king leaves the diagonal and Bxh8 wins the queen for a bishop.", "Bc3+! Король уйдёт с диагонали, а Bxh8 выиграет ферзя за слона."),
          B("Get onto the long diagonal a1–h8.", "Выйди на длинную диагональ a1–h8."))
      ] },

    { id: "threats", lvl: 3, icon: "", t: B("See the threat", "Увидь угрозу"), d: B("Stop the mate before it happens", "Останови мат до того, как он случится"),
      steps: [
        TT("2b3k1/5ppp/8/8/6r1/5q2/4NPPP/R5K1 w - - 0 1", ["g2"],
          B("Before you move, think about THEIR plan. On which square does Black threaten to deliver mate? Tap it.", "Прежде чем ходить, подумай о ПЛАНЕ соперника. На какой клетке чёрные грозят поставить мат? Нажми на неё."),
          B("Yes — Qxg2#! The rook on g4 supports the queen's capture.", "Да — Qxg2#! Ладья g4 поддерживает взятие ферзём."),
          sq => B(`Not ${sq}. Look where the queen and the rook both aim.`, `Не ${sq}. Посмотри, куда нацелены и ферзь, и ладья.`),
          B("The weak point is next to your king.", "Слабое место — рядом с вашим королём.")),
        M("2b3k1/5ppp/8/8/6r1/5q2/4NPPP/R5K1 w - - 0 1",
          B("Now stop it! Cut the rook off from the queen.", "Теперь останови угрозу! Отрежь ладью от ферзя."),
          Ms("Ng3"), B("Ng3! The knight blocks the g-file, so Qxg2 no longer comes with mate.", "Ng3! Конь закрыл вертикаль «g» — теперь Qxg2 уже не мат."),
          B("Which of your pieces can step onto g3, between the rook g4 and the pawn g2?", "Какая ваша фигура может встать на g3 — между ладьёй g4 и пешкой g2?")),
        TT("6k1/2rq1ppp/8/8/6R1/7N/3b1PPP/6K1 w - - 0 1", ["c1"],
          B("New position. Where does Black want to give mate this time?", "Новая позиция. Где чёрные хотят поставить мат на этот раз?"),
          B("Right — Rc1#. Your king has no flight squares: a back-rank mate.", "Верно — Rc1#. У вашего короля нет полей: мат на последней горизонтали."),
          sq => B(`Not ${sq}. Think about the first rank, where your king lives.`, `Не ${sq}. Подумай о первой горизонтали, где стоит ваш король.`),
          B("Which rank is your king trapped on?", "На какой горизонтали заперт ваш король?")),
        M("6k1/2rq1ppp/8/8/6R1/7N/3b1PPP/6K1 w - - 0 1",
          B("Give your king air! Which pawn move creates an escape square?", "Дай своему королю воздух! Какой ход пешки создаёт ему поле для отхода?"),
          Ms("f3"), B("f3! Now the king has f2, so Rc1+ is only a check, not mate. Make «luft» a habit.", "f3! Теперь у короля есть f2, и Rc1+ — просто шах, а не мат. Сделай «форточку» привычкой."),
          B("Pawns f2, g2, h2 box the king in. Move one of them — the right one.", "Пешки f2, g2, h2 запирают короля. Сдвинь одну из них — нужную."),
          m => (m.piece === "p" ? B("A pawn move, but not the one that helps. Look at which squares the king needs.", "Ход пешкой, но не тот, что помогает. Подумай, какие поля нужны королю.") : B("That doesn't solve the back-rank problem.", "Это не решает проблему последней горизонтали.")))
      ] },

    { id: "disc", lvl: 4, icon: "", t: B("Discovered attack", "Вскрытый удар"), d: B("Move one piece, attack with two", "Двинь одну фигуру — атакуй двумя"),
      steps: [
        TT("4k3/pp6/7q/4N3/8/8/3r4/K3R3 w - - 0 1", ["e5"],
          B("Your rook e1 looks at the black king, but your own knight is in the way. Tap the piece that opens the line when it moves.", "Ваша ладья e1 смотрит на чёрного короля, но мешает свой конь. Нажми на фигуру, которая откроет линию, когда сходит."),
          B("The knight e5! When it leaves, the rook gives check — and the knight gets a free move.", "Конь e5! Когда он уйдёт, ладья даст шах, а у коня появится «бесплатный» ход."),
          sq => B(`${sq} isn't the one blocking the e-file.`, `${sq} не мешает на вертикали «e».`),
          B("Which of your pieces stands on the e-file between rook and king?", "Какая ваша фигура стоит на вертикали «e» между ладьёй и королём?")),
        M("4k3/pp6/7q/4N3/8/8/3r4/K3R3 w - - 0 1",
          B("Use it: move the knight so it attacks the queen while the rook checks. Black can't answer both!", "Используй это: сходи конём так, чтобы он напал на ферзя, пока ладья даёт шах. Чёрные не справятся с обоими!"),
          Ms("Ng4"), B("Ng4+! A discovered check from the rook, and the knight hits the queen on h6.", "Ng4+! Вскрытый шах от ладьи, а конь бьёт ферзя h6."),
          B("Which knight square attacks h6?", "С какой клетки конь бьёт h6?")),
        M("4k3/pp6/3q4/1n2B3/2r5/8/8/K3R3 w - - 0 1",
          B("The same idea with a bishop. One move wins the queen — find it!", "Та же идея, но со слоном. Один ход выигрывает ферзя — найди его!"),
          Ms("Bxd6"), B("Bxd6+! The bishop takes the queen and the rook gives check at the same time.", "Bxd6+! Слон берёт ферзя, а ладья одновременно даёт шах."),
          B("Capture with the piece that stands in front of the rook.", "Бери той фигурой, что стоит перед ладьёй."))
      ] },

    { id: "kpk", lvl: 4, icon: "", t: B("King and pawn endgame", "Король и пешка"), d: B("The king leads, the pawn follows", "Король ведёт, пешка следует"),
      steps: [
        M("2k5/8/4K3/3P4/8/8/8/8 w - - 0 1",
          B("White wins ONLY with the right king move. The king must go in front of the pawn. Which move?", "Белые выигрывают ТОЛЬКО правильным ходом короля. Король должен стать перед пешкой. Какой ход?"),
          Ms("Kd6"), B("Kd6! The king takes the key square in front of the pawn; Black can't stop the plan.", "Kd6! Король занимает ключевое поле перед пешкой, и чёрные ничего не могут сделать."),
          B("Don't push the pawn. Put the king right in front of it.", "Не торопи пешку. Поставь короля прямо перед ней."),
          m => (m.piece === "p" ? B("Pushing the pawn lets the black king block it — a draw.", "Если толкнуть пешку, чёрный король заблокирует её — ничья.") : B("Not exactly. Only one king move wins here.", "Не совсем. Выигрывает только один ход короля."))),
        M("8/3k4/8/8/3KP3/8/8/8 w - - 0 1",
          B("Pawn on e4, the king beside it. Don't rush: move the KING first. Where?", "Пешка на e4, король рядом. Не спеши: сначала ходит КОРОЛЬ. Куда?"),
          Ms("Kd5"), B("Kd5! Now the king leads the pawn forward, keeping the opposition.", "Kd5! Теперь король ведёт пешку вперёд, сохраняя оппозицию."),
          B("Go up the board together with the pawn — but one step ahead of it.", "Идите вперёд вместе с пешкой — но на шаг впереди неё.")),
        M("8/2k5/8/3PK3/8/8/8/8 w - - 0 1",
          B("Pawn d5, black king on c7. If you push d6+, Black takes the opposition and holds the draw. Find the winning king move.", "Пешка d5, чёрный король c7. Если сыграть d6+, чёрные займут оппозицию и спасутся. Найди выигрывающий ход королём."),
          Ms("Ke6"), B("Ke6! The king reaches the key square e6, and the pawn will be escorted to the queen.", "Ke6! Король встал на ключевое поле e6, и пешку проведут в ферзи."),
          B("Step ahead of the pawn, to the 6th rank.", "Иди перед пешкой — на шестую горизонталь.")),
        Q("7k/8/7K/7P/8/8/8/8 w - - 0 1", ["h8", "h6", "h5"], B("White has king + rook pawn (h-file). The black king sits in the corner. Is it a win?", "У белых король и ладейная пешка (вертикаль h). Чёрный король сидит в углу. Это выигрыш?"),
          [B("Yes, just push the pawn", "Да, надо просто толкать пешку"), B("No — it's a draw", "Нет — это ничья"), B("Yes, but only with a queen", "Да, но только с ферзём")], 1,
          B("A draw! The king in the corner can't be dislodged — and White must watch out for stalemate. A rook pawn almost never wins alone.", "Ничья! Короля в углу не выгнать, а белым ещё надо опасаться пата. Ладейная пешка почти никогда не выигрывает одна."),
          B("Which squares does the black king need? Can White ever take them away?", "Какие поля нужны чёрному королю? Можно ли их отнять?"))
      ] },

    { id: "mate2", lvl: 4, icon: "", t: B("Mate in two", "Мат в два хода"), d: B("A forcing check, then the finishing blow", "Форсирующий шах, а затем решающий удар"),
      steps: [
        Ln("6k1/5ppp/4r3/2R5/8/8/2Q2PPP/6K1 w - - 0 1", [[["Rc8"], "Re8"], ["#", null]],
          B("MATE IN TWO: give a check that forces ONE reply, then finish. The 8th rank is the target.", "МАТ В ДВА ХОДА: дай шах, на который есть ЕДИНСТВЕННЫЙ ответ, и добей. Цель — восьмая горизонталь."),
          B("Rc8+ Re8 Rxe8#! Black had to block with the rook — and lost it with mate.", "Rc8+ Re8 Rxe8#! Чёрным пришлось закрыться ладьёй — её и взяли с матом."),
          B("Check on the 8th rank. Which black piece is able to block?", "Шах по восьмой горизонтали. Какая чёрная фигура может закрыться?")),
        Ln("6k1/5ppp/8/8/8/4rR2/2Q2PPP/6K1 w - - 0 1", [[["Qc8"], "Re8"], ["#", null]],
          B("Careful — the black rook e3 attacks your pieces. Ignore it: a forcing check is stronger.", "Осторожно — чёрная ладья e3 бьёт ваши фигуры. Не обращай внимания: шах сильнее."),
          B("Qc8+ Re8 Qxe8#! The queen checks, the rook blocks, the queen takes it with mate.", "Qc8+ Re8 Qxe8#! Ферзь даёт шах, ладья закрывается, ферзь берёт её с матом."),
          B("Which square on the 8th rank can the queen reach with check?", "На какую клетку восьмой горизонтали ферзь придёт с шахом?")),
        Ln("6k1/5ppp/2r5/R1Q5/8/8/5PPP/6K1 w - - 0 1", [[["Ra8"], "Rc8"], ["#", null]],
          B("Two white pieces against one black rook. The rook c6 is Black's only defender — make it block.", "Две белые фигуры против одной чёрной ладьи. Ладья c6 — единственный защитник, заставь её закрыться."),
          B("Ra8+ Rc8 Rxc8#! The blocking rook is taken with mate.", "Ra8+ Rc8 Rxc8#! Закрывшуюся ладью берут с матом."),
          B("Check with the rook on the 8th rank. The black rook will have to go to c8.", "Дай шах ладьёй по восьмой горизонтали. Чёрной ладье придётся встать на c8.")),
        Ln("1r4k1/3R1ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", [[["Rd8"], "Rxd8"], ["#", null]],
          B("Black's rook b8 guards the back rank. Sacrifice to drag it away!", "Ладья b8 охраняет последнюю горизонталь. Пожертвуй материал, чтобы оттянуть её!"),
          B("Rd8+! Rxd8 Qxd8# — the rook is deflected, and the queen mates.", "Rd8+! Rxd8 Qxd8# — ладья оттянута, и ферзь ставит мат."),
          B("Give up the rook with check — the queen is waiting behind it.", "Отдай ладью с шахом — за ней ждёт ферзь."))
      ] },

    { id: "sac", lvl: 5, icon: "", t: B("Sacrifice for mate", "Жертва ради мата"), d: B("Give the queen, win the game", "Отдай ферзя — выиграй партию"),
      steps: [
        Ln("6k1/3r1ppp/q4Q2/8/3R4/8/5PPP/6K1 w - - 0 1", [[["Qd8"], "Rxd8"], ["#", null]],
          B("Your queen is attacked by the black queen, but you have something better: a queen sacrifice that forces mate in two.", "Вашего ферзя атакует чёрный ферзь, но есть кое-что лучше: жертва ферзя с матом в два хода."),
          B("Qd8+! Rxd8 Rxd8# — the queen is given up, the rook mates.", "Qd8+! Rxd8 Rxd8# — ферзь отдан, ладья ставит мат."),
          B("A queen move to the 8th rank with check — the rook behind it does the rest.", "Ход ферзя на восьмую горизонталь с шахом — остальное сделает ладья.")),
        Ln("Rq4k1/5ppp/8/8/4Q3/1r6/5PPP/6K1 w - - 0 1", [[["Qe8"], "Qxe8"], ["#", null]],
          B("The black queen b8 blocks your own rook a8. Clear the way with a sacrifice!", "Чёрный ферзь b8 закрывает вашу ладью a8. Освободи ей путь жертвой!"),
          B("Qe8+! Qxe8 Rxe8# — Black's queen is pulled off the b8 square and the rook mates.", "Qe8+! Qxe8 Rxe8# — ферзя оттянули с b8, и ладья ставит мат."),
          B("Which queen move checks along the 8th rank and forces the capture?", "Каким ходом ферзь даёт шах по восьмой горизонтали и вынуждает взятие?")),
        Ln("6k1/5ppp/8/qr6/3Q4/8/5PPP/3R2K1 w - - 0 1", [[["Qd8"], "Qxd8"], ["#", null]],
          B("Queens and rooks are on the board, but the black king is weak. Look for a queen sacrifice with mate in two.", "На доске ферзи и ладьи, но чёрный король слаб. Ищи жертву ферзя с матом в два хода."),
          B("Qd8+! Qxd8 Rxd8# — queen sacrifice, rook mates. Material is irrelevant when you mate.", "Qd8+! Qxd8 Rxd8# — жертва ферзя, ладья ставит мат. Материал не важен, когда ставишь мат."),
          B("The rook on d1 and the queen on d4 share the same file.", "Ладья d1 и ферзь d4 стоят на одной вертикали."))
      ] },

    { id: "mate3", lvl: 5, icon: "", t: B("Mate in three", "Мат в три хода"), d: B("Calculate five moves ahead", "Просчитай на пять ходов вперёд"),
      steps: [
        Ln("6k1/5ppp/8/1r6/2R3b1/8/5PPP/Q5K1 w - - 0 1", [[["Qa8"], "Rb8"], [["Qxb8"], "Bc8"], ["#", null]],
          B("MATE IN THREE. Every move is a check: each reply of Black is forced. Calculate to the end!", "МАТ В ТРИ ХОДА. Каждый ход — шах, ответы чёрных вынужденные. Просчитай до конца!"),
          B("Qa8+ Rb8 Qxb8+ Bc8 Qxc8#! Check after check, until the king has nowhere to go.", "Qa8+ Rb8 Qxb8+ Bc8 Qxc8#! Шах за шахом — пока королю не останется ходов."),
          B("Start with the queen check on the 8th rank. Keep giving checks.", "Начни с шаха ферзём по восьмой горизонтали. И продолжай шаховать.")),
        Ln("6k1/3b1ppp/8/4Q3/2r5/8/5PPP/2R3K1 w - - 0 1", [[["Qb8"], "Bc8"], [["Qxc8"], "Rxc8"], ["#", null]],
          B("Black's bishop and rook guard the back rank. Break through with two queen checks and a sacrifice.", "Слон и ладья охраняют последнюю горизонталь. Пробей её двумя шахами ферзя и жертвой."),
          B("Qb8+ Bc8 Qxc8+ Rxc8 Rxc8#! The queen is sacrificed, and the rook mates.", "Qb8+ Bc8 Qxc8+ Rxc8 Rxc8#! Ферзь пожертвован, а ладья ставит мат."),
          B("Check on b8 first. Then take on c8.", "Сначала шах на b8. Потом бери на c8.")),
        Ln("6k1/2Q2ppp/4b3/3r2R1/8/8/5PPP/6K1 w - - 0 1", [[["Qb8"], "Bc8"], [["Qxc8"], "Rd8"], ["#", null]],
          B("The last problem of the chapter: queen and rook against a well-protected king. Find the mate in three!", "Последняя задача главы: ферзь и ладья против хорошо защищённого короля. Найди мат в три хода!"),
          B("Qb8+ Bc8 Qxc8+ Rd8 Qxd8#! Beautiful. You see the whole combination now.", "Qb8+ Bc8 Qxc8+ Rd8 Qxd8#! Красиво. Теперь ты видишь всю комбинацию."),
          B("Again the 8th rank: queen check, then take the bishop with check.", "Опять восьмая горизонталь: шах ферзём, затем возьми слона с шахом."))
      ] },

    /* ===== ГЛАВА 6 · ЭНДШПИЛЬ И СТРАТЕГИЯ ===== */
    { id: "stale", lvl: 3, icon: "", t: B("Stalemate", "Пат"), d: B("The draw you must avoid — and use", "Ничья, которую нужно избегать — и использовать"),
      steps: [
        Q("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", ["h8"], B("Black to move. The king on h8 isn't in check, but every square around it is covered. What is this?", "Ход чёрных. Король h8 не под шахом, но все клетки вокруг него простреливаются. Что это?"),
          [B("Checkmate", "Мат"), B("Stalemate — a draw", "Пат — ничья"), B("Black wins", "Чёрные выигрывают")], 1,
          B("Stalemate: the side to move has NO legal move and is NOT in check. It's a draw — even though White has a queen!", "Пат: у стороны, чья очередь ходить, нет ни одного хода, а шаха нет. Это ничья — хотя у белых ферзь!"),
          B("Is the king in check? Does it have any square to go to?", "Есть ли шах? Есть ли у короля хоть одна свободная клетка?")),
        M("k7/8/1K6/8/8/8/8/2Q5 w - - 0 1",
          B("Careful! Qc7?? would be stalemate. Find the move that gives real CHECKMATE.", "Осторожно! Qc7?? — это пат. Найди ход, который ставит настоящий МАТ."),
          mateOk, B("Qc8#! The king is in check and has no squares. Always count the enemy king's moves before you play.", "Qc8#! Король под шахом, и ему некуда идти. Всегда считай ходы вражеского короля перед своим ходом."),
          B("Give check along the 8th rank.", "Дай шах по восьмой горизонтали."), staleWrong),
        Q("8/8/8/8/8/6k1/5q2/7K w - - 0 1", ["h1"], B("Black is a queen up and just played Qf2??. White (to move) has only a king. What's the result?", "У чёрных лишний ферзь, и они сыграли Qf2??. У белых только король, и им ходить. Каков итог?"),
          [B("White is mated", "Белым мат"), B("Stalemate — a draw", "Пат — ничья"), B("Black wins on time", "Чёрные выиграют по времени")], 1,
          B("The king on h1 has no moves but isn't attacked — stalemate! When you're losing, always look for a stalemate trick.", "У короля h1 нет ходов, но шаха нет — пат! Если проигрываешь, всегда ищи ловушку с патом."),
          B("Is the white king attacked right now?", "Атакован ли сейчас белый король?"))
      ] },

    { id: "kqk", lvl: 3, icon: "", t: B("King & queen vs king", "Король и ферзь против короля"), d: B("The simplest win — if you avoid stalemate", "Самая простая победа — если не допустить пат"),
      steps: [
        M("7k/8/6K1/8/8/8/8/3Q4 w - - 0 1",
          B("King and queen against a bare king. The black king is in the corner and your king stands two squares away. Find the mate.", "Король и ферзь против одинокого короля. Чёрный король в углу, а ваш — в двух клетках от него. Найди мат."),
          mateOk, B("Qd8#! The queen takes the squares, the king guards them. King and queen always win.", "Qd8#! Ферзь отбирает клетки, король их стережёт. Король и ферзь выигрывают всегда."),
          B("Check along the 8th rank — g8, g7 and h7 are already taken away.", "Шах по восьмой горизонтали — клетки g8, g7 и h7 уже недоступны."), staleWrong),
        Q("8/8/8/3k4/8/4Q3/8/4K3 b - - 0 1", ["e3", "d5"], B("The queen on e3 stands a knight's move from the king on d5. Why is this the ideal hunting distance?", "Ферзь на e3 стоит на расстоянии хода коня от короля d5. Почему такая дистанция идеальна?"),
          [B("It cuts off many squares and the king can't capture the queen", "Она отрезает много клеток, и король не может съесть ферзя"), B("The queen is protected by a pawn", "Ферзя защищает пешка"), B("It gives check", "Это шах")], 0,
          B("A knight's-move distance builds a «net»: the king is boxed in, yet it can never take the queen.", "Дистанция хода коня — это «сеть»: король зажат, но не может съесть ферзя."),
          B("Think about which squares the queen controls from there.", "Подумай, какие клетки ферзь контролирует оттуда.")),
        M("8/8/8/8/8/1K6/2Q5/k7 w - - 0 1",
          B("Two kings, one queen — mate in one. There is more than one way.", "Два короля и ферзь — мат в один ход. Способов несколько."),
          mateOk, B("Mate! The king on b3 takes away a2 and b2, the queen does the rest. Kings help to mate too.", "Мат! Король b3 закрывает a2 и b2, остальное делает ферзь. Король тоже помогает ставить мат."),
          B("The black king sits on a1. Check it so that no square is left.", "Чёрный король на a1. Дай шах так, чтобы не осталось свободных клеток."), staleWrong)
      ] },

    { id: "krk", lvl: 3, icon: "", t: B("King & rook vs king", "Король и ладья против короля"), d: B("Drive the king to the edge, then mate", "Загони короля к краю и поставь мат"),
      steps: [
        M("k7/8/1K6/8/8/8/8/7R w - - 0 1",
          B("King and rook against a lone king. Your king already holds the key squares. Deliver the mate!", "Король и ладья против одинокого короля. Ваш король уже держит ключевые клетки. Ставь мат!"),
          mateOk, B("Rh8#! The king covers a7 and b7, the rook gives check on the last rank.", "Rh8#! Король закрывает a7 и b7, а ладья даёт шах по последней горизонтали."),
          B("Slide the rook to the 8th rank.", "Отправь ладью на восьмую горизонталь."), staleWrong),
        Q("8/8/8/4k3/8/8/8/R3K3 w - - 0 1", ["e5"], B("Why do we push the lone king towards the edge before mating?", "Зачем мы загоняем одинокого короля к краю перед матом?"),
          [B("Only at the edge can the rook give mate", "Только у края ладья может поставить мат"), B("The rules say so", "Так велят правила"), B("The king gets tired", "Король устаёт")], 0,
          B("In the centre a king has 8 squares, on the edge 5, in the corner 3. A rook can only mate when the king has nowhere to run.", "В центре у короля 8 клеток, у края 5, в углу 3. Ладья ставит мат, только когда королю некуда бежать."),
          B("Count the squares the king can step to.", "Посчитай, сколько клеток доступно королю.")),
        M("7k/8/6K1/8/8/8/8/R7 w - - 0 1",
          B("The kings stand opposite each other with a gap — the classic finish. Find the mate.", "Короли стоят друг напротив друга — классическая финальная схема. Найди мат."),
          mateOk, B("Ra8#! The king covers g7 and h7, the rook takes the whole last rank.", "Ra8#! Король закрывает g7 и h7, ладья простреливает всю последнюю горизонталь."),
          B("Rook to the last rank.", "Ладья — на последнюю горизонталь."), staleWrong)
      ] },

    { id: "passed", lvl: 3, icon: "", t: B("Passed pawns", "Проходные пешки"), d: B("The pawn nobody can stop by capture", "Пешка, которую нельзя остановить взятием"),
      steps: [
        TT("8/pp3k2/8/3P4/8/8/PP4K1/8 w - - 0 1", ["d5"],
          B("A PASSED pawn has no enemy pawns in front of it — neither on its own file nor on the neighbouring files. Tap White's passed pawn.", "ПРОХОДНАЯ пешка — это пешка, перед которой нет вражеских пешек ни на её вертикали, ни на соседних. Нажми на проходную пешку белых."),
          B("Yes, d5! Black has no pawns on the c, d or e files — no pawn can ever capture it.", "Да, d5! У чёрных нет пешек на вертикалях c, d и e — ни одна пешка её не съест."),
          sq => B(`Not ${sq}. Look for the pawn with no black pawns ahead on its own and neighbouring files.`, `Не ${sq}. Ищи пешку, перед которой нет чёрных пешек ни на её, ни на соседних вертикалях.`),
          B("Check the files next to the pawn.", "Проверь соседние вертикали.")),
        Q("8/8/P7/8/7p/8/1K6/6k1 w - - 0 1", ["a6", "h4"], B("A pawn race! White to move. Count the moves: who promotes first?", "Гонка пешек! Ход белых. Посчитай ходы: кто первым получит ферзя?"),
          [B("White (2 moves: a7, a8)", "Белые (2 хода: a7, a8)"), B("Black (3 moves: h3, h2, h1)", "Чёрные (3 хода: h3, h2, h1)"), B("Both at the same time", "Одновременно")], 0,
          B("White needs 2 moves, Black needs 3 — and White moves first. Always count the squares, don't guess.", "Белым нужно 2 хода, чёрным — 3, да ещё и ходят белые. Всегда считай клетки, а не гадай."),
          B("Count how many steps each pawn still needs.", "Посчитай, сколько шагов осталось каждой пешке.")),
        Q("4k3/8/8/3P4/8/8/8/4K3 w - - 0 1", ["d5"], B("What is the famous rule about passed pawns?", "Какое известное правило существует для проходных пешек?"),
          [B("Passed pawns must be pushed", "Проходные пешки надо двигать"), B("Never move a passed pawn", "Проходную пешку нельзя двигать"), B("Trade it off at once", "Её нужно сразу разменять")], 0,
          B("Every step brings it closer to a new queen, and the enemy king gets tied down stopping it.", "Каждый шаг приближает её к новому ферзю, а вражеский король вынужден её останавливать."),
          B("What does a pawn become on the last rank?", "Во что превращается пешка на последней горизонтали?"))
      ] },

    { id: "rooks", lvl: 4, icon: "", t: B("Rooks in action", "Ладьи в деле"), d: B("Open files and the 7th rank", "Открытые вертикали и седьмая горизонталь"),
      steps: [
        M("r4rk1/pp3ppp/8/8/8/8/PP3PPP/R4RK1 w - - 0 1",
          B("Rooks love OPEN files — files without pawns. Which files are open here? Put a rook on one.", "Ладьи любят ОТКРЫТЫЕ вертикали — те, где нет пешек. Какие вертикали открыты? Поставь ладью на одну из них."),
          m => m.piece === "r" && "cde".includes(m.to[0]), B("Yes! On an open file the rook attacks the enemy camp. Next idea: double the rooks.", "Да! На открытой вертикали ладья давит на лагерь соперника. Дальше — удвоить ладьи."),
          B("The c-, d- and e-files have no pawns at all.", "На вертикалях c, d и e вообще нет пешек.")),
        M("5rk1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1",
          B("A rook on the 7th rank is a monster: it attacks pawns and cuts the king off. Put it there!", "Ладья на седьмой горизонтали — настоящий монстр: она бьёт пешки и отрезает короля. Поставь её туда!"),
          Ms("Rd7"), B("Rd7! Now the rook hits b7 and f7. Black's pieces are tied up.", "Rd7! Теперь ладья нападает на b7 и f7. Фигуры чёрных связаны."),
          B("The d-file is open — go all the way up to the 7th rank.", "Вертикаль d открыта — поднимись до седьмой горизонтали.")),
        Q("6k1/8/8/8/3P4/8/3R4/6K1 w - - 0 1", ["d2", "d4"], B("Where should a rook stand in relation to its own passed pawn?", "Где ладье лучше стоять относительно своей проходной пешки?"),
          [B("Behind the pawn", "Позади пешки"), B("In front of the pawn", "Перед пешкой"), B("Anywhere — it doesn't matter", "Где угодно — неважно")], 0,
          B("Behind the pawn the rook supports it from afar, and its range grows with every step the pawn takes.", "Позади пешки ладья поддерживает её издалека, и её сила растёт с каждым шагом пешки."),
          B("Think about where the rook's lines stay open.", "Подумай, где линии ладьи остаются открытыми."))
      ] },

    { id: "outpost", lvl: 4, icon: "", t: B("Outposts", "Форпосты"), d: B("A knight that nobody can chase away", "Конь, которого никто не прогонит"),
      steps: [
        M("r1bq1rk1/pp3ppp/2n5/8/2P5/2N5/PP3PPP/R1BQ1RK1 w - - 0 1",
          B("An OUTPOST is a square deep in enemy territory that no enemy pawn can attack. d5 is one — Black has no c- or e-pawns. Put your knight there!", "ФОРПОСТ — это клетка на чужой территории, которую не может атаковать ни одна вражеская пешка. d5 — как раз такая: у чёрных нет c- и e-пешек. Поставь туда коня!"),
          Ms("Nd5"), B("Nd5! The knight is protected by the c4 pawn and no pawn can ever kick it out.", "Nd5! Коня защищает пешка c4, и ни одна пешка его не прогонит."),
          B("The knight on c3 jumps to d5.", "Конь с c3 прыгает на d5.")),
        Q("r1bqkb1r/pp3ppp/2n1pn2/8/3P4/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 1", ["d5", "e6"], B("Here White also wants a knight on d5. Is it a real outpost?", "Здесь белые тоже хотят поставить коня на d5. Это настоящий форпост?"),
          [B("Yes — nothing attacks it", "Да — его никто не атакует"), B("No — the e6 pawn controls d5", "Нет — пешка e6 контролирует d5"), B("Yes, because it's in the centre", "Да, потому что это центр")], 1,
          B("The e6 pawn attacks d5, so a knight there could simply be taken or chased away. A real outpost needs the enemy pawns to be unable to attack it.", "Пешка e6 бьёт d5, и коня там просто съедят или прогонят. У настоящего форпоста вражеские пешки не могут его атаковать."),
          B("Which black pawn looks at d5?", "Какая чёрная пешка смотрит на d5?")),
        Q("8/8/8/8/N7/8/8/K6k w - - 0 1", ["a4"], B("A knight on the edge attacks 4 squares at most; in the centre — 8. Where is it stronger?", "Конь у края бьёт не больше 4 клеток, в центре — 8. Где он сильнее?"),
          [B("In the centre", "В центре"), B("On the edge", "У края"), B("No difference", "Никакой разницы")], 0,
          B("«A knight on the rim is dim.» Centralise your knights — preferably on outposts.", "«Конь на краю — не в раю.» Ставь коней в центр — а лучше на форпосты."),
          B("Count the squares it controls.", "Посчитай клетки, которые он контролирует."))
      ] },

    /* ===== ГЛАВА 8 · МАТОВЫЕ СХЕМЫ ===== */
    { id: "ladder", lvl: 3, icon: "", t: B("Ladder mate", "Лесенка"), d: B("Two rooks climb rank by rank", "Две ладьи идут горизонталь за горизонталью"),
      steps: [
        M("7k/R7/1R6/8/8/8/8/K7 w - - 0 1",
          B("LADDER MATE: one rook cuts off a rank, the other gives check on the next. The rook on a7 already controls the 7th rank. Finish it!", "ЛЕСЕНКА: одна ладья отрезает горизонталь, другая ставит шах на следующей. Ладья a7 уже держит седьмую горизонталь. Добей!"),
          mateOk, B("Rb8#! One rook guards the 7th rank, the other mates on the 8th.", "Rb8#! Одна ладья держит седьмую горизонталь, другая ставит мат на восьмой."),
          B("Put the second rook on the 8th rank.", "Поставь вторую ладью на восьмую горизонталь.")),
        Ln("7k/8/8/8/8/8/R7/1R4K1 w - - 0 1", [[["Ra7", "Rb7"], "Kg8"], ["#", null]],
          B("Now build the ladder yourself: first cut the king off with one rook on the 7th rank.", "Теперь построй лесенку сам: сначала отрежь короля ладьёй на седьмой горизонтали."),
          B("Ra7! Kg8 Rb8# — a rook cuts off the 7th rank, the other one mates on the 8th.", "Ra7! Kg8 Rb8# — одна ладья отрезает седьмую горизонталь, другая ставит мат на восьмой."),
          B("Bring a rook to the 7th rank — the king can't cross it.", "Выведи ладью на седьмую горизонталь — король не сможет её пересечь.")),
        Q("7k/R7/1R6/8/8/8/8/K7 w - - 0 1", ["a7", "b6"], B("Why does the ladder mate work with two rooks?", "Почему лесенка работает именно с двумя ладьями?"),
          [B("Each rook covers a whole rank, so the king is squeezed", "Каждая ладья держит целую горизонталь, и король зажат"), B("Rooks move diagonally", "Ладьи ходят по диагонали"), B("The king can't move at all", "Король вообще не может ходить")], 0,
          B("A rook controls an entire rank. Two rooks on neighbouring ranks leave the king no way through.", "Ладья контролирует целую горизонталь. Две ладьи на соседних горизонталях не оставляют королю прохода."),
          B("What does one rook control on its rank?", "Что контролирует одна ладья на своей горизонтали?"))
      ] },

    { id: "batt", lvl: 4, icon: "", t: B("Queen & bishop battery", "Батарея ферзя и слона"), d: B("The classic mate on h7", "Классический мат на h7"),
      steps: [
        M("5rk1/5ppp/8/7Q/8/3B4/8/K7 w - - 0 1",
          B("The bishop on d3 aims at h7 and the queen supports it from h5 — a BATTERY. Take on h7 with mate!", "Слон d3 нацелен на h7, а ферзь h5 его поддерживает — это БАТАРЕЯ. Бери h7 с матом!"),
          Ms("Qxh7"), B("Qxh7#! The bishop protects the queen, so the king can't take it. The rook on f8 blocks his last square.", "Qxh7#! Слон защищает ферзя, поэтому король его не съест. Ладья f8 закрывает последнюю клетку."),
          B("The queen takes the pawn h7 — it is protected by the bishop.", "Ферзь берёт пешку h7 — её защищает слон.")),
        Q("5rk1/5ppp/8/7Q/8/3B4/8/K7 w - - 0 1", ["d3", "h7"], B("Why is the bishop so important for this mate?", "Почему слон так важен для этого мата?"),
          [B("It protects the queen on h7", "Он защищает ферзя на h7"), B("It gives check", "Он даёт шах"), B("It blocks the king's path", "Он перекрывает путь королю")], 0,
          B("If the queen were alone, the king would simply capture her. The bishop makes the capture on h7 impossible.", "Будь ферзь один, король бы его съел. Слон делает взятие на h7 невозможным."),
          B("Who recaptures if the king takes on h7?", "Кто бьёт в ответ, если король возьмёт на h7?")),
        Q("5rk1/5ppp/8/7Q/8/3B4/8/K7 b - - 0 1", ["g7", "f7"], B("How can Black defend against Qxh7# here?", "Как чёрным защититься от Qxh7# в этой позиции?"),
          [B("Give the king air or block the diagonal, e.g. …g6 / …Nf6", "Дать королю воздух или закрыть диагональ, например …g6 / …Nf6"), B("Do nothing", "Ничего не делать"), B("Move the rook away", "Убрать ладью")], 0,
          B("A flight square (luft) or a blocker on the diagonal ruins the mating pattern.", "Клетка для отхода (форточка) или блок на диагонали разрушают матовую схему."),
          B("What does the king need to survive a check?", "Что нужно королю, чтобы пережить шах?"))
      ] },

    { id: "smoth", lvl: 4, icon: "", t: B("Smothered mate", "Спёртый мат"), d: B("The king is suffocated by his own pieces", "Король задыхается среди собственных фигур"),
      steps: [
        M("6rk/6pp/8/4N3/8/8/8/K7 w - - 0 1",
          B("SMOTHERED MATE: the king is boxed in by his own rook and pawns. Only a knight can give check here without being captured. Find it!", "СПЁРТЫЙ МАТ: король зажат собственной ладьёй и пешками. Шах здесь может поставить только конь — его никто не съест. Найди ход!"),
          Ms("Nf7"), B("Nf7#! The king has no free square — his own pieces smother him.", "Nf7#! У короля нет свободных клеток — его душат свои же фигуры."),
          B("The knight must attack h8. Where can the knight on e5 go?", "Конь должен атаковать h8. Куда может пойти конь с e5?")),
        Ln("5r1k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1", [[["Qg8"], "Rxg8"], ["#", null]],
          B("Philidor's legacy: sacrifice the QUEEN to drag the rook into the corner, then smother the king with the knight.", "Наследие Филидора: пожертвуй ФЕРЗЯ, чтобы затащить ладью в угол, а затем задуши короля конём."),
          B("Qg8+! Rxg8 Nf7# — the queen is the bait, the knight delivers the smothered mate.", "Qg8+! Rxg8 Nf7# — ферзь стал приманкой, а конь поставил спёртый мат."),
          B("The queen has a free diagonal to g8, and the knight on h6 protects that square.", "У ферзя свободная диагональ до g8, а конь h6 защищает эту клетку.")),
        Q("6rk/6pp/8/4N3/8/8/8/K7 w - - 0 1", ["h8", "g8", "g7", "h7"], B("What do we call a mate where the king is blocked by his own pieces?", "Как называется мат, когда королю мешают его собственные фигуры?"),
          [B("Smothered mate", "Спёртый мат"), B("Back-rank mate", "Мат на последней горизонтали"), B("Fool's mate", "Детский мат")], 0,
          B("Exactly — and only a knight can mate like this, because it jumps over the blocking pieces.", "Верно — и такой мат ставит только конь, потому что он перепрыгивает через мешающие фигуры."),
          B("Whose pieces are suffocating the king?", "Чьи фигуры душат короля?"))
      ] },

    { id: "anas", lvl: 4, icon: "", t: B("Anastasia's mate", "Мат Анастасии"), d: B("A knight and a rook trap the king by the edge", "Конь и ладья запирают короля у края"),
      steps: [
        M("8/4N1pk/8/8/8/8/K7/R7 w - - 0 1",
          B("ANASTASIA'S MATE: the knight on e7 already covers g8 and g6, and the black pawn blocks g7. Bring the rook to the h-file!", "МАТ АНАСТАСИИ: конь e7 уже закрывает g8 и g6, а чёрная пешка блокирует g7. Выведи ладью на вертикаль h!"),
          Ms("Rh1"), B("Rh1#! The h-file is closed, g7 is blocked by his own pawn, the knight covers the rest.", "Rh1#! Вертикаль h закрыта, g7 блокирует своя пешка, остальное закрывает конь."),
          B("The rook goes along the first rank to h1.", "Ладья идёт по первой горизонтали на h1.")),
        Q("8/4N1pk/8/8/8/8/K7/7R b - - 0 1", ["g8", "g6", "g7"], B("Why can't the black king escape after Rh1+?", "Почему чёрный король не может уйти после Rh1+?"),
          [B("The knight covers g8 and g6, his own pawn blocks g7, the rook owns the h-file", "Конь закрывает g8 и g6, своя пешка блокирует g7, ладья держит вертикаль h"), B("It's stalemate", "Это пат"), B("The rook is protected", "Ладья защищена")], 0,
          B("Every flight square is taken — one of them by his own pawn. That's the Anastasia pattern.", "Все клетки отхода закрыты — одну из них занимает собственная пешка. Это и есть схема Анастасии."),
          B("Check each square next to the king.", "Проверь каждую клетку рядом с королём.")),
        Q("8/4N1pk/8/8/8/8/K7/R7 w - - 0 1", ["g7"], B("Which black piece unknowingly helps White to mate here?", "Какая чёрная фигура здесь невольно помогает белым поставить мат?"),
          [B("The pawn on g7", "Пешка g7"), B("Nobody", "Никто"), B("The king itself", "Сам король")], 0,
          B("The pawn on g7 takes away the king's own flight square. Pawns in front of the king can be a liability!", "Пешка g7 отнимает у короля клетку отхода. Пешки возле короля бывают ему же во вред!"),
          B("Look at the squares around the king h7.", "Посмотри на клетки вокруг короля h7."))
      ] },

    { id: "arab", lvl: 4, icon: "", t: B("Arabian mate", "Арабский мат"), d: B("Rook and knight against a king in the corner", "Ладья и конь против короля в углу"),
      steps: [
        M("7k/R7/5N2/8/8/8/8/K7 w - - 0 1",
          B("ARABIAN MATE: the knight guards h7 and g8, the rook finishes on h7 right next to the king.", "АРАБСКИЙ МАТ: конь защищает h7 и g8, а ладья ставит мат на h7 — прямо рядом с королём."),
          Ms("Rh7"), B("Rh7#! The rook is protected by the knight, so the king can't take it.", "Rh7#! Ладью защищает конь, поэтому король её не съест."),
          B("The rook slides along the 7th rank into the corner.", "Ладья скользит по седьмой горизонтали в угол.")),
        Q("7k/7R/5N2/8/8/8/8/K7 b - - 0 1", ["h7", "f6", "g8"], B("Who protects the rook on h7?", "Кто защищает ладью на h7?"),
          [B("The knight on f6", "Конь f6"), B("The white king", "Белый король"), B("Nobody", "Никто")], 0,
          B("If the rook were unprotected, the king would simply take it. The knight guards h7 AND g8 — that is the whole idea.", "Будь ладья без защиты, король бы её съел. Конь защищает и h7, И g8 — в этом вся идея."),
          B("Which piece attacks h7 from a knight's jump away?", "Какая фигура бьёт h7 прыжком коня?")),
        Q("7k/R7/5N2/8/8/8/8/K7 w - - 0 1", ["h8"], B("Arabian mate happens in the corner. Why are corners dangerous for a king?", "Арабский мат бывает в углу. Чем углы опасны для короля?"),
          [B("There are fewer escape squares", "Там меньше клеток для бегства"), B("There are more enemy pieces", "Там больше вражеских фигур"), B("No special reason", "Никакой особой причины")], 0,
          B("In the corner the king has just 3 neighbouring squares — easy to cover.", "В углу у короля всего 3 соседние клетки — их легко закрыть."),
          B("Count the squares next to h8.", "Посчитай клетки рядом с h8."))
      ] },

    { id: "dbl", lvl: 5, icon: "", t: B("Double check", "Двойной шах"), d: B("Two pieces give check at once", "Две фигуры дают шах одновременно"),
      steps: [
        M("3qkb2/3p1p2/8/8/4N3/8/8/4R1K1 w - - 0 1",
          B("DOUBLE CHECK: two pieces check at the same time — the king MUST move. If he can't, it's mate. Move the knight to uncover the rook AND attack the king.", "ДВОЙНОЙ ШАХ: две фигуры дают шах одновременно — королю ОБЯЗАТЕЛЬНО надо ходить. Если ходить некуда — мат. Сдвинь коня так, чтобы открыть ладью И напасть на короля."),
          Ms("Nd6", "Nf6"), B("Nd6# (or Nf6#)! The knight checks, the rook checks too — the king has no squares.", "Nd6# (или Nf6#)! Шах даёт и конь, и ладья — у короля нет клеток."),
          B("Jump to a square that attacks e8 and opens the e-file.", "Прыгни на клетку, с которой конь бьёт e8, и открой вертикаль e.")),
        Q("3qkb2/3p1p2/3N4/8/8/8/8/4R1K1 b - - 0 1", ["d6", "e1", "e8"], B("Why can't Black simply capture the knight on d6 or block the check?", "Почему чёрные не могут просто взять коня d6 или закрыться?"),
          [B("In a double check only the king may move", "При двойном шахе ходить может только король"), B("The knight is protected", "Коня защищают"), B("Black must move the queen", "Чёрные обязаны ходить ферзём")], 0,
          B("You can't capture or block two checkers at once — that's why a double check is so deadly.", "Нельзя одним ходом убрать два шаха — вот почему двойной шах так опасен."),
          B("How many checking pieces are there?", "Сколько фигур даёт шах?")),
        Q("3qkb2/3p1p2/8/8/4N3/8/8/4R1K1 w - - 0 1", ["e4", "e1"], B("Which is more powerful: a single check or a double check?", "Что сильнее: одиночный или двойной шах?"),
          [B("Double check — it can't be parried by capture or block", "Двойной шах — от него нельзя защититься взятием или перекрытием"), B("They are equal", "Они равны"), B("Single check", "Одиночный шах")], 0,
          B("Against a double check the king must always move. Look for discovered double checks in attacks.", "Против двойного шаха королю нужно обязательно уходить. Ищи двойные шахи при вскрытии в атаке."),
          B("Remember what a king must do when two pieces attack him.", "Вспомни, что должен делать король, когда его атакуют две фигуры."))
      ] },

    { id: "epau", lvl: 5, icon: "", t: B("Epaulette mate", "Мат «эполеты»"), d: B("The rooks trap their own king", "Ладьи запирают собственного короля"),
      steps: [
        M("3rkr2/8/8/8/8/8/Q7/K7 w - - 0 1",
          B("EPAULETTE MATE: the king's own rooks stand beside him like epaulettes on a uniform. Give check where he can't go anywhere.", "МАТ «ЭПОЛЕТЫ»: собственные ладьи стоят по бокам от короля, как эполеты на мундире. Дай шах так, чтобы королю некуда было идти."),
          Ms("Qe6"), B("Qe6#! The queen covers d7, e7 and f7, the rooks lock d8 and f8.", "Qe6#! Ферзь закрывает d7, e7 и f7, а ладьи запирают d8 и f8."),
          B("Bring the queen to e6 along the diagonal.", "Приведи ферзя на e6 по диагонали.")),
        Q("3rkr2/8/4Q3/8/8/8/8/K7 b - - 0 1", ["d8", "f8", "e6"], B("Why is the black king stuck?", "Почему чёрный король не может уйти?"),
          [B("His own rooks block d8 and f8; the queen covers d7, e7, f7", "Свои ладьи закрывают d8 и f8, а ферзь — d7, e7, f7"), B("It's stalemate", "Это пат"), B("The queen is protected", "Ферзь защищён")], 0,
          B("All five squares around the king are taken — three by the queen and two by his own rooks.", "Все пять клеток вокруг короля заняты: три — ферзём, две — собственными ладьями."),
          B("Check d8, f8, d7, e7 and f7 one by one.", "Проверь d8, f8, d7, e7 и f7 по очереди.")),
        Q("3rkr2/8/8/8/8/8/Q7/K7 b - - 0 1", ["e8"], B("How can Black avoid this pattern in advance?", "Как чёрным заранее избежать этой схемы?"),
          [B("Give the king a flight square or move a rook", "Дать королю клетку для отхода или сдвинуть ладью"), B("Put both rooks on d8 and f8", "Держать обе ладьи на d8 и f8"), B("Nothing helps", "Ничего не поможет")], 0,
          B("Don't let your own pieces shut the king in — keep an escape route.", "Не позволяй своим фигурам запирать короля — оставь ему путь к отступлению."),
          B("What does the king lack in this position?", "Чего не хватает королю в этой позиции?"))
      ] },

    { id: "boden", lvl: 5, icon: "", t: B("Boden's mate", "Мат Бодена"), d: B("Two bishops on crossing diagonals", "Два слона на пересекающихся диагоналях"),
      steps: [
        Ln("2kr3r/pp1n1ppp/2p5/8/Q4B2/8/PPP2PPP/R4BK1 w - - 0 1", [[["Qxc6"], "bxc6"], ["#", null]],
          B("BODEN'S MATE: Black castled long. Sacrifice the queen on c6 — the b7 pawn must take, and the bishops mate along crossing diagonals.", "МАТ БОДЕНА: у чёрных длинная рокировка. Пожертвуй ферзя на c6 — пешка b7 обязана взять, и слоны ставят мат по пересекающимся диагоналям."),
          B("Qxc6+! bxc6 Ba6# — the bishops cross: a6–c8 and f4–b8. The king has no flight.", "Qxc6+! bxc6 Ba6# — слоны скрещиваются: a6–c8 и f4–b8. Королю некуда идти."),
          B("Take on c6 with check — only the b7 pawn can recapture.", "Бери c6 с шахом — снять ферзя может только пешка b7.")),
        Q("2kr3r/p2n1ppp/2p5/8/5B2/8/PPP2PPP/R4BK1 w - - 0 1", ["f4", "f1", "c8"], B("Which bishop will deliver the mate, and which one covers b8 and c7?", "Какой слон поставит мат, а какой закроет b8 и c7?"),
          [B("Bf1–a6 mates, Bf4 covers b8 and c7", "Bf1–a6 ставит мат, Bf4 закрывает b8 и c7"), B("Bf4 mates, Bf1 covers b8", "Bf4 ставит мат, Bf1 закрывает b8"), B("Both bishops give check", "Оба слона дают шах")], 0,
          B("One bishop attacks the king, the other takes away the escape squares — a perfect team.", "Один слон атакует короля, второй забирает клетки отхода — идеальная команда."),
          B("Which diagonal leads from f1 to a6?", "Какая диагональ ведёт с f1 на a6?")),
        Q("2kr3r/pp1n1ppp/2p5/8/Q4B2/8/PPP2PPP/R4BK1 w - - 0 1", ["c8"], B("Boden's mate usually hits a king that has castled…", "Мат Бодена обычно настигает короля после рокировки…"),
          [B("Long (queenside)", "Длинной (на ферзевый фланг)"), B("Short (kingside)", "Короткой (на королевский фланг)"), B("Never", "Никогда")], 0,
          B("After long castling the king sits on c8 or c1, where two crossing bishops can trap it.", "После длинной рокировки король стоит на c8 или c1, где его могут запереть два скрещённых слона."),
          B("Where does the king stand after O-O-O?", "Где стоит король после O-O-O?"))
      ] },

    { id: "legal", lvl: 5, icon: "", t: B("Légal's mate", "Мат Легаля"), d: B("An old trap: give up the queen, mate with minor pieces", "Старинная ловушка: отдай ферзя — и поставь мат лёгкими фигурами"),
      steps: [
        Ln("rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 1", [[["Bxf7"], "Ke7"], ["#", null]],
          B("LÉGAL'S MATE: Black grabbed the queen on d1 — greedy! Ignore it and mate with the minor pieces.", "МАТ ЛЕГАЛЯ: чёрные взяли ферзя на d1 — жадность! Не обращай на это внимания и ставь мат лёгкими фигурами."),
          B("Bxf7+! Ke7 Nd5# — three minor pieces deliver mate while White is down a queen.", "Bxf7+! Ke7 Nd5# — три лёгкие фигуры ставят мат, хотя белые остались без ферзя."),
          B("Check with the bishop on f7 (the knight on e5 protects it), then a knight jumps to d5.", "Дай шах слоном на f7 (его защищает конь e5), а затем конь прыгает на d5.")),
        Q("rn1q1bnr/ppp1kB1p/3p2p1/3NN3/4P3/8/PPPP1PPP/R1BbK2R b KQ - 0 1", ["e7", "d5", "f7"], B("This is the final position. Why is the king mated?", "Это финальная позиция. Почему королю мат?"),
          [B("The bishop and the knights cover every escape square", "Слон и кони закрыли все клетки отхода"), B("The queen is on the board", "На доске есть ферзь"), B("It's stalemate", "Это пат")], 0,
          B("Nd5 gives check; Bf7 and Ne5 take away all the flight squares. No queen needed!", "Nd5 даёт шах, а Bf7 и Ne5 отнимают все клетки отхода. Ферзь не нужен!"),
          B("Count the squares around the king on e7.", "Посчитай клетки вокруг короля e7.")),
        Q("rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 1", ["d1"], B("What is the main lesson of Légal's mate?", "В чём главный урок мата Легаля?"),
          [B("Don't be greedy: check the opponent's threats before capturing", "Не будь жадным: проверь угрозы соперника, прежде чем брать"), B("Always take the queen", "Всегда бери ферзя"), B("Never move the knights", "Никогда не ходи конями")], 0,
          B("A free queen is often bait. A king in the centre can be mated faster than you can use your extra material.", "Бесплатный ферзь — часто приманка. Королю в центре мат ставят быстрее, чем успеваешь воспользоваться лишним материалом."),
          B("What was the black king doing in the middle of the board?", "Что делал чёрный король в центре доски?"))
      ] }

  ];
  /* уровень сложности 1–5: чем выше клетка на горе, тем сложнее задачи (и тем больше награда) */
  const OLD_LVL = { board: 1, moves: 1, check: 1, castle: 1, pawns: 1, values: 2, tactics: 2, mates: 2 };
  LESSONS.forEach(l => { if (!l.lvl) l.lvl = OLD_LVL[l.id] || 1; });

  /* ====================================================================
     ДАННЫЕ: ДЕБЮТЫ (8 полуходов, каждый с объяснением)
     ==================================================================== */
  const N = B;
  const OPENINGS = [
    { id: "italian", t: B("Italian Game", "Итальянская партия"), tag: B("Beginner-friendly", "Для новичков"), side: "w",
      idea: B("Quick development, an attack on f7, and a big pawn centre with c3 + d4.", "Быстрое развитие, атака на f7 и мощный центр c3 + d4."),
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6"],
      n: [N("Claim the centre and open lines for the queen and bishop.", "Занимаем центр и открываем линии ферзю и слону."),
          N("Black answers the same way — fights for the centre.", "Чёрные отвечают так же — борются за центр."),
          N("Develops with tempo: the knight attacks e5.", "Развитие с темпом: конь нападает на e5."),
          N("Defends e5 and develops a piece.", "Защищает e5 и развивает фигуру."),
          N("The bishop aims at f7 — Black's weakest point, guarded only by the king.", "Слон целится в f7 — самую слабую точку, её защищает только король."),
          N("Black copies: the bishop eyes f2.", "Чёрные копируют: слон смотрит на f2."),
          N("Prepares d4 to build a big pawn centre.", "Готовит d4 — мощный пешечный центр."),
          N("Counterattack: Black hits the e4 pawn.", "Контрудар: чёрные атакуют пешку e4.")] },
    { id: "ruy", t: B("Ruy Lopez (Spanish)", "Испанская партия"), tag: B("Classic", "Классика"), side: "w",
      idea: B("Pressure the knight that guards e5 — a long, strategic fight.", "Давление на коня, защищающего e5, — долгая стратегическая борьба."),
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"],
      n: [N("The most popular first move: centre + open lines.", "Самый популярный первый ход: центр + открытые линии."),
          N("The classical reply — Black claims the centre too.", "Классический ответ — чёрные тоже держат центр."),
          N("Attacks e5 right away.", "Сразу атакует e5."),
          N("Defends e5 and develops.", "Защищает e5 и развивается."),
          N("The Ruy Lopez! Pressure on the knight that protects e5 (not a real threat yet).", "Испанка! Давление на коня, который защищает e5 (пока без реальной угрозы)."),
          N("Black asks the bishop: retreat or trade?", "Чёрные спрашивают слона: отступишь или разменяешься?"),
          N("Retreat while keeping the pressure — no piece is lost.", "Отступаем, сохраняя давление, — фигура не теряется."),
          N("Black develops and attacks the e4 pawn.", "Чёрные развивают коня и атакуют пешку e4.")] },
    { id: "sicilian", t: B("Sicilian Defense", "Сицилианская защита"), tag: B("Fighting", "Острая игра"), side: "b",
      idea: B("Black fights for d4 from the wing and plays for a win, not for equality.", "Чёрные бьются за d4 с фланга и играют на победу, а не на равенство."),
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6"],
      n: [N("White takes the centre.", "Белые берут центр."),
          N("The Sicilian! An unbalanced game: Black fights for d4 with a flank pawn.", "Сицилианка! Неравная игра: чёрные борются за d4 фланговой пешкой."),
          N("Prepares d4 — the key central break.", "Готовит d4 — главный прорыв в центре."),
          N("Controls e5 and frees the c8 bishop.", "Контролирует e5 и открывает слона c8."),
          N("The break! White opens the centre.", "Прорыв! Белые вскрывают центр."),
          N("Black trades a wing pawn for a central one.", "Чёрные меняют фланговую пешку на центральную."),
          N("White recaptures with development: the d4 knight is strong.", "Белые берут с развитием: конь на d4 силён."),
          N("Hits e4 and develops — White must defend.", "Атакует e4 и развивается — белым надо защищаться.")] },
    { id: "french", t: B("French Defense", "Французская защита"), tag: B("Solid", "Надёжная"), side: "b",
      idea: B("A sturdy pawn chain; Black counterattacks the centre with ...d5 and ...c5.", "Крепкая цепь пешек; чёрные контратакуют центр ходами ...d5 и ...c5."),
      moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7"],
      n: [N("White takes the centre.", "Белые берут центр."),
          N("Solid, preparing ...d5 — though the c8 bishop gets shut in.", "Надёжно, готовит ...d5 — правда, слон c8 пока закрыт."),
          N("White builds the ideal pawn centre.", "Белые строят идеальный пешечный центр."),
          N("Black immediately challenges the centre.", "Чёрные сразу оспаривают центр."),
          N("Defends e4 and develops.", "Защищает e4 и развивает коня."),
          N("Adds pressure on e4.", "Добавляет давление на e4."),
          N("Attacks the knight that is pressing on e4.", "Атакует коня, который давит на e4."),
          N("Breaks the pin and prepares castling.", "Снимает связку и готовит рокировку.")] },
    { id: "qgd", t: B("Queen's Gambit Declined", "Отказанный ферзевый гамбит"), tag: B("Classic", "Классика"), side: "w",
      idea: B("White fights for the centre with the c-pawn; Black builds a solid fortress.", "Белые борются за центр c-пешкой; чёрные строят прочную крепость."),
      moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"],
      n: [N("Queen's pawn: control e5, solid and flexible.", "Ферзевая пешка: контроль e5, надёжно и гибко."),
          N("Black answers symmetrically.", "Чёрные отвечают симметрично."),
          N("The Queen's Gambit! The pawn attacks d5 (if ...dxc4, White regains it).", "Ферзевый гамбит! Пешка атакует d5 (после ...dxc4 пешку вернуть легко)."),
          N("Declines the pawn and keeps a solid chain.", "Отказ от пешки — надёжная цепь."),
          N("Adds pressure on d5 and develops.", "Давление на d5 и развитие."),
          N("Develops and defends d5.", "Развитие и защита d5."),
          N("Pins the knight f6 that defends d5.", "Связывает коня f6, защитника d5."),
          N("Breaks the pin and prepares castling.", "Снимает связку и готовит рокировку.")] },
    { id: "caro", t: B("Caro-Kann Defense", "Защита Каро-Канн"), tag: B("Solid", "Надёжная"), side: "b",
      idea: B("Prepare ...d5 with a pawn and get the bishop out BEFORE ...e6.", "Готовим ...d5 пешкой и выпускаем слона ДО хода ...e6."),
      moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"],
      n: [N("White takes space.", "Белые берут пространство."),
          N("The Caro-Kann: prepare ...d5 without locking the bishop.", "Каро-Канн: готовим ...d5, не запирая слона."),
          N("The classical centre.", "Классический центр."),
          N("The prepared strike at the centre.", "Подготовленный удар по центру."),
          N("Defends e4.", "Защищает e4."),
          N("Releases the tension with a safe trade.", "Снимает напряжение безопасным разменом."),
          N("White recaptures with a strong central knight.", "Белые берут сильным центральным конём."),
          N("The key idea: the bishop comes out before ...e6.", "Главная идея: слон выходит до хода ...e6.")] },
    { id: "london", t: B("London System", "Лондонская система"), tag: B("Beginner-friendly", "Для новичков"), side: "w",
      idea: B("The same safe setup against almost anything: d4, Nf3, Bf4, e3.", "Одна и та же надёжная схема почти против всего: d4, Nf3, Bf4, e3."),
      moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "c5"],
      n: [N("A solid start in the centre.", "Надёжное начало в центре."),
          N("The classical reply.", "Классический ответ."),
          N("Develops and keeps the plans flexible.", "Развитие без спешки с планами."),
          N("Black develops too.", "Чёрные тоже развиваются."),
          N("The London signature: the bishop comes out BEFORE e3.", "Визитная карточка Лондона: слон выходит ДО хода e3."),
          N("Solid, but the c8 bishop is locked for now.", "Надёжно, но слон c8 пока заперт."),
          N("Supports d4 and frees the f1 bishop.", "Поддерживает d4 и открывает слона f1."),
          N("Black strikes at d4 — the typical counter.", "Чёрные бьют по d4 — типичный контрудар.")] },
    { id: "kid", t: B("King's Indian Defense", "Староиндийская защита"), tag: B("Fighting", "Острая игра"), side: "b",
      idea: B("Let White build a centre — then attack it with ...e5 or ...c5.", "Позволить белым построить центр — а потом атаковать его ходами ...e5 или ...c5."),
      moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"],
      n: [N("White starts in the centre.", "Белые начинают с центра."),
          N("Flexible: controls e4 without committing a pawn.", "Гибко: контроль e4 без пешечных обязательств."),
          N("More space.", "Ещё больше пространства."),
          N("Prepares the bishop fianchetto.", "Готовит фианкетто слона."),
          N("Solid development.", "Надёжное развитие."),
          N("The bishop takes the long diagonal.", "Слон занимает длинную диагональ."),
          N("White builds a big centre — Black will attack it.", "Белые строят большой центр — чёрные будут его атаковать."),
          N("Prepares ...e5 or ...c5 to hit the centre.", "Готовит ...e5 или ...c5 для удара по центру.")] },
    { id: "scotch", lvl: 3, t: B("Scotch Game", "Шотландская партия"), tag: B("Open centre", "Открытый центр"), side: "w",
      idea: B("White opens the centre at once with d4: active pieces and simple plans.", "Белые сразу вскрывают центр ходом d4: активные фигуры и понятные планы."),
      moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6"],
      n: [N("Claim the centre and open lines for the queen and bishop.", "Занимаем центр и открываем линии ферзю и слону."),
          N("Black answers the same way.", "Чёрные отвечают тем же."),
          N("Develops the knight and attacks e5.", "Развиваем коня и атакуем e5."),
          N("Defends e5 and develops.", "Защищает e5 и развивает коня."),
          N("The Scotch! White strikes in the centre immediately.", "Шотландка! Белые сразу бьют по центру."),
          N("Black takes — otherwise White would take on e5 with an edge.", "Чёрные берут пешку — иначе белые сами возьмут на e5 с преимуществом."),
          N("The knight lands in the centre and presses on c6.", "Конь встаёт в центр и давит на c6."),
          N("Black develops and attacks the e4 pawn.", "Чёрные развиваются и атакуют пешку e4.")] },
    { id: "vienna", lvl: 3, t: B("Vienna Game", "Венская партия"), tag: B("Flexible attack", "Гибкая атака"), side: "w",
      idea: B("Develop the queenside knight first and prepare the f4 break.", "Сначала развиваем ферзевого коня и готовим прорыв f4."),
      moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4"],
      n: [N("Centre and open lines.", "Центр и открытые линии."),
          N("Black mirrors White.", "Чёрные зеркалят ход белых."),
          N("Supports e4 and keeps Nf3 in reserve.", "Поддерживает e4 и оставляет Nf3 про запас."),
          N("Black develops and attacks e4.", "Чёрные развиваются и атакуют e4."),
          N("f4! The Vienna Gambit: a flank pawn fights for the centre.", "f4! Венский гамбит: фланговая пешка борется за центр."),
          N("d5! Black counter-strikes in the centre.", "d5! Чёрные контратакуют в центре."),
          N("White takes a pawn and opens the f-file.", "Белые берут пешку и открывают вертикаль f."),
          N("Black wins the pawn back. The position is double-edged.", "Чёрные возвращают пешку. Позиция обоюдоострая.")] },
    { id: "kgambit", lvl: 4, t: B("King's Gambit", "Королевский гамбит"), tag: B("Romantic", "Романтика"), side: "w",
      idea: B("White gives a pawn to open the f-file and destroy Black's centre.", "Белые отдают пешку, чтобы открыть вертикаль f и разрушить центр чёрных."),
      moves: ["e4", "e5", "f4", "exf4", "Nf3", "g5", "Bc4", "g4"],
      n: [N("The first step: centre.", "Первый шаг: центр."),
          N("Black copies.", "Чёрные копируют."),
          N("f4! The King's Gambit: a pawn offered for open lines and quick attack.", "f4! Королевский гамбит: пешка в обмен на открытые линии и быструю атаку."),
          N("Black accepts the gift.", "Чёрные принимают дар."),
          N("Develops and prevents …Qh4+.", "Развитие и защита от …Qh4+."),
          N("Black defends the extra pawn with g5.", "Чёрные защищают лишнюю пешку ходом g5."),
          N("The bishop aims at the weak f7 square.", "Слон целится в слабую клетку f7."),
          N("Black attacks the knight — a sharp fight begins.", "Чёрные атакуют коня — начинается острая борьба.")] },
    { id: "qga", lvl: 3, t: B("Queen's Gambit Accepted", "Принятый ферзевый гамбит"), tag: B("Classical", "Классика"), side: "w",
      idea: B("White gives the c-pawn back for a lead in development and a strong centre.", "Белые временно отдают пешку c ради развития и сильного центра."),
      moves: ["d4", "d5", "c4", "dxc4", "Nf3", "Nf6", "e3", "e6"],
      n: [N("A central pawn that frees the c1 bishop.", "Центральная пешка, открывающая слона c1."),
          N("Black blocks the centre.", "Чёрные блокируют центр."),
          N("The Queen's Gambit: White hits d5.", "Ферзевый гамбит: белые бьют по d5."),
          N("Black accepts the pawn.", "Чёрные принимают пешку."),
          N("Develops and prepares to win the pawn back.", "Развитие и подготовка возврата пешки."),
          N("Black develops and watches e4.", "Чёрные развиваются и следят за e4."),
          N("Opens the bishop to recapture on c4.", "Открываем слона, чтобы вернуть пешку на c4."),
          N("Black solidifies and frees the f8 bishop.", "Чёрные укрепляются и открывают слона f8.")] },
    { id: "english", lvl: 4, t: B("English Opening", "Английское начало"), tag: B("Flank play", "Фланговая игра"), side: "w",
      idea: B("Control d5 from the flank and keep the position flexible.", "Контроль клетки d5 с фланга и гибкая позиция."),
      moves: ["c4", "e5", "Nc3", "Nf6", "Nf3", "Nc6", "g3", "d5"],
      n: [N("The English: control d5 without committing the centre pawns.", "Английское начало: контроль d5 без раннего хода центральных пешек."),
          N("Black takes space in the centre.", "Чёрные берут пространство в центре."),
          N("More control over d5 and e4.", "Больше контроля над d5 и e4."),
          N("Develops and eyes e4.", "Развитие и взгляд на e4."),
          N("Attacks the e5 pawn.", "Атакует пешку e5."),
          N("Defends e5.", "Защищает e5."),
          N("The bishop heads for the long diagonal.", "Слон готовится на длинную диагональ."),
          N("Black challenges c4 — a rich fight.", "Чёрные оспаривают c4 — богатая борьба.")] },
    { id: "petrov", lvl: 3, t: B("Petrov Defence", "Русская партия"), tag: B("Solid", "Надёжная"), side: "b",
      idea: B("Black counter-attacks instead of just defending e5 — very solid.", "Чёрные контратакуют, а не просто защищают e5, — очень надёжно."),
      moves: ["e4", "e5", "Nf3", "Nf6", "Nxe5", "d6", "Nf3", "Nxe4"],
      n: [N("White takes the centre.", "Белые занимают центр."),
          N("Black answers symmetrically.", "Чёрные отвечают симметрично."),
          N("Attacks e5.", "Атакует e5."),
          N("The Petrov: Black counter-attacks e4.", "Русская партия: чёрные контратакуют e4."),
          N("White takes e5 — but it's a trap to grab e4 at once.", "Белые берут e5 — но сразу хватать e4 опасно."),
          N("d6! First kick the knight away.", "d6! Сначала прогоняем коня."),
          N("The knight retreats.", "Конь отступает."),
          N("Now Black takes e4 safely — equal and solid.", "Теперь e4 можно брать безопасно — равенство и надёжность.")] },
    { id: "scandi", lvl: 3, t: B("Scandinavian Defence", "Скандинавская защита"), tag: B("Direct", "Прямолинейная"), side: "b",
      idea: B("Black hits e4 at once and gets an easy, active game.", "Чёрные сразу бьют по e4 и получают лёгкую активную игру."),
      moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6"],
      n: [N("White takes the centre.", "Белые занимают центр."),
          N("d5! Black attacks e4 immediately.", "d5! Чёрные сразу атакуют e4."),
          N("White takes the pawn.", "Белые берут пешку."),
          N("Black recaptures; the queen comes out early.", "Чёрные берут обратно; ферзь выходит рано."),
          N("Gains a tempo by attacking the queen.", "Выигрывает темп, атакуя ферзя."),
          N("The queen retreats to a safe diagonal.", "Ферзь отходит на безопасную диагональ."),
          N("White builds a big centre.", "Белые строят большой центр."),
          N("Black develops with a tempo on e4.", "Чёрные развиваются с угрозой e4.")] },
    { id: "pirc", lvl: 4, t: B("Pirc Defence", "Защита Пирца"), tag: B("Counter-attack", "Контратака"), side: "b",
      idea: B("Let White build a centre, then attack it from the flanks.", "Позволить белым построить центр, а затем атаковать его с флангов."),
      moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "Nf3", "Bg7"],
      n: [N("White takes the centre.", "Белые занимают центр."),
          N("The Pirc: Black waits and prepares to attack the centre later.", "Защита Пирца: чёрные ждут и готовятся атаковать центр позже."),
          N("White takes full centre.", "Белые берут полный центр."),
          N("Attacks e4.", "Атакует e4."),
          N("Defends e4.", "Защищает e4."),
          N("Prepares the fianchetto.", "Готовит фианкетто."),
          N("Natural development.", "Естественное развитие."),
          N("The bishop eyes the long diagonal and the centre.", "Слон смотрит на длинную диагональ и центр.")] },
    { id: "slav", lvl: 4, t: B("Slav Defence", "Славянская защита"), tag: B("Rock solid", "Крепкая"), side: "b",
      idea: B("Support d5 with a pawn and keep the c8 bishop free.", "Поддержать d5 пешкой и сохранить свободу слона c8."),
      moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4"],
      n: [N("White starts with the queen's pawn.", "Белые начинают ферзевой пешкой."),
          N("Black meets it in the centre.", "Чёрные отвечают в центре."),
          N("The Queen's Gambit.", "Ферзевый гамбит."),
          N("c6! The Slav: d5 is supported and the bishop stays free.", "c6! Славянская: d5 поддержан, а слон остаётся свободным."),
          N("Natural development.", "Естественное развитие."),
          N("Black develops too.", "Чёрные тоже развиваются."),
          N("More pressure on d5.", "Больше давления на d5."),
          N("Black takes c4; the bishop will come out to f5.", "Чёрные берут c4; слон выйдет на f5.")] },
    { id: "nimzo", lvl: 5, t: B("Nimzo-Indian Defence", "Защита Нимцовича"), tag: B("Strategic", "Стратегия"), side: "b",
      idea: B("Pin the c3 knight and fight for e4 with pieces, not pawns.", "Связать коня c3 и бороться за e4 фигурами, а не пешками."),
      moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O"],
      n: [N("White takes space.", "Белые берут пространство."),
          N("Black controls e4 and keeps options open.", "Чёрные контролируют e4 и сохраняют выбор."),
          N("More space in the centre.", "Больше места в центре."),
          N("Prepares Bb4 and opens the f8 bishop.", "Готовит Bb4 и открывает слона f8."),
          N("Develops and controls e4.", "Развитие и контроль e4."),
          N("The Nimzo-Indian: pins the knight and fights for e4.", "Защита Нимцовича: связка коня и борьба за e4."),
          N("Solid: ready for Bd3 and Ne2.", "Надёжно: готовится Bd3 и Ne2."),
          N("Black castles to safety — a deep strategic game.", "Чёрные рокируются — глубокая стратегическая партия.")] }
  ];

  /* ====================================================================
     ВИЗУАЛ: CSS + MAPER
     ==================================================================== */
  const css = document.createElement("style");
  css.textContent = `
  .lsn-sub{color:var(--ink-dim);font-size:14px;margin:0 0 14px}
  /* ---- MAPER ---- */
  .mp{display:flex;gap:14px;align-items:flex-start}
  .mp-av{width:76px;flex:none;filter:drop-shadow(0 8px 14px rgba(95, 47, 184,.45));animation:mpFloat 4s ease-in-out infinite}
  .mp-av svg{display:block;width:100%;height:auto}
  .mp .eg,.mp .mg{display:none}
  .mp[data-mood=idle] .e-n,.mp[data-mood=idle] .m-n,.mp[data-mood=talk] .e-n,.mp[data-mood=talk] .m-n{display:inline}
  .mp[data-mood=happy] .e-h,.mp[data-mood=happy] .m-h{display:inline}
  .mp[data-mood=sad] .e-s,.mp[data-mood=sad] .m-s{display:inline}
  .mp[data-mood=think] .e-t,.mp[data-mood=think] .m-n{display:inline}
  .mp .ant{animation:mpAnt 2s ease-in-out infinite}
  .mp.talk .m-n{animation:mpTalk .28s steps(2) infinite}
  .mp[data-mood=happy] .mp-av{animation:mpJump .6s ease 1,mpFloat 4s ease-in-out .6s infinite}
  .mp[data-mood=sad] .mp-av{animation:mpShake .45s ease 1,mpFloat 4s ease-in-out .5s infinite}
  .mp-bubble{position:relative;flex:1;min-height:64px;padding:12px 14px;border-radius:16px;font-size:14.5px;line-height:1.55;
    background:var(--panel-2);border:1px solid var(--line-2);color:var(--ink)}
  .mp-bubble::before{content:"";position:absolute;left:-7px;top:24px;width:12px;height:12px;background:var(--panel-2);
    border-left:1px solid var(--line-2);border-bottom:1px solid var(--line-2);transform:rotate(45deg)}
  .mp[data-mood=happy] .mp-bubble{border-color:rgba(114,214,163,.5);background:linear-gradient(180deg,rgba(114,214,163,.10),var(--panel-2))}
  .mp[data-mood=sad] .mp-bubble{border-color:rgba(238,129,149,.5);background:linear-gradient(180deg,rgba(238,129,149,.10),var(--panel-2))}
  @keyframes mpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes mpAnt{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes mpTalk{0%{transform:scaleY(1)}100%{transform:scaleY(1.9)}}
  @keyframes mpJump{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) rotate(-4deg)}70%{transform:translateY(0) rotate(3deg)}}
  @keyframes mpShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
  /* ---- главная ---- */
  .lsn-hero{padding:16px;border-radius:20px;margin:0 0 16px;border:1px solid var(--line-2);
    background:radial-gradient(120% 140% at 0% 0%,rgba(142, 85, 230,.22),transparent 60%),var(--panel)}
  .lsn-prog{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:12.5px;color:var(--ink-dim);font-weight:700}
  .lsn-prog i{flex:1;height:7px;border-radius:4px;background:var(--line-2);overflow:hidden;display:block}
  .lsn-prog i b{display:block;height:100%;background:linear-gradient(90deg,var(--violet),var(--violet-2));border-radius:4px;transition:width .5s}
  .lsn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
  .lc{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;padding:16px;border-radius:18px;cursor:pointer;color:var(--ink);font:inherit;
    border:1px solid var(--line-2);background:linear-gradient(180deg,var(--panel-2),var(--panel));transition:transform .15s,border-color .15s,box-shadow .15s}
  .lc:hover{transform:translateY(-3px);border-color:var(--violet-2);box-shadow:0 14px 30px -14px rgba(142, 85, 230,.55)}
  .lc-ic{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:24px;border-radius:14px;background:var(--tint);border:1px solid var(--tint-2)}
  .lc b{font-size:15.5px}.lc small{color:var(--ink-dim);font-size:12.5px;line-height:1.4}
  .lc-meta{display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:12px;color:var(--ink-faint);font-weight:700}
  .lc-stars{color:var(--gold);letter-spacing:2px}.lc-stars .off{color:var(--panel-3)}
  .lc-num{position:absolute;right:14px;top:12px;font:700 12px var(--font-ui);color:var(--ink-faint)}
  .lc.done{border-color:rgba(114,214,163,.35)}
  .lc-mini{display:grid;grid-template-columns:repeat(8,1fr);width:92px;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--line-2);flex:none}
  .lc-mini span{display:flex;align-items:center;justify-content:center}.lc-mini svg{width:100%;height:100%}
  .lc-op{flex-direction:row;gap:14px;align-items:center}
  .lc-op .lc-body{display:flex;flex-direction:column;gap:5px;min-width:0}
  .lc-tag{display:inline-block;align-self:flex-start;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:800;background:var(--tint);color:var(--violet-3);border:1px solid var(--tint-2)}
  .lc-mv{font:600 12px ui-monospace,Menlo,monospace;color:var(--ink-dim)}
  /* ---- страница ---- */
  .lp-top{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
  .lp-title{display:flex;align-items:center;gap:8px;font:600 21px var(--font-display)}
  .lp-dots{display:flex;gap:6px;margin:0 0 14px}
  .lp-dots i{flex:1;max-width:46px;height:6px;border-radius:3px;background:var(--line-2);transition:background .3s}
  .lp-dots i.on{background:var(--violet)}.lp-dots i.ok{background:var(--ok)}
  .lp-grid{display:grid;grid-template-columns:minmax(300px,460px) 1fr;gap:22px;align-items:start}
  @media(max-width:820px){.lp-grid{grid-template-columns:1fr}}
  .lp-bw{border-radius:16px;padding:6px;border:1px solid var(--line-2);background:var(--panel);transition:box-shadow .3s,border-color .3s}
  .lp-bw.good{border-color:var(--ok);box-shadow:0 0 30px -6px rgba(114,214,163,.5)}
  .lp-bw.bad{border-color:var(--danger);box-shadow:0 0 30px -6px rgba(238,129,149,.5)}
  .lp-board.board{max-width:100%;width:100%;margin:0}
  .sq-hint{box-shadow:inset 0 0 0 3px var(--gold),inset 0 0 18px rgba(227,191,124,.55)!important;animation:mpPulse 1s ease-in-out infinite}
  .sq-focus{box-shadow:inset 0 0 0 3px var(--violet-2),inset 0 0 14px rgba(185, 139, 245,.5)!important}
  .sq-good{box-shadow:inset 0 0 0 100px rgba(114,214,163,.38)!important}
  .sq-bad{box-shadow:inset 0 0 0 100px rgba(238,129,149,.45)!important}
  @keyframes mpPulse{50%{filter:brightness(1.25)}}
  .lp-right{display:flex;flex-direction:column;gap:12px;min-width:0}
  .lp-quiz{display:grid;gap:8px}
  .lp-opt{padding:12px 14px;border-radius:14px;text-align:left;font:700 14px var(--font-ui);color:var(--ink);cursor:pointer;
    background:var(--panel-2);border:1px solid var(--line-2);transition:transform .12s,border-color .15s,background .15s}
  .lp-opt:hover:not(:disabled){border-color:var(--violet-2);transform:translateX(3px)}
  .lp-opt.ok{background:rgba(114,214,163,.16);border-color:var(--ok)}
  .lp-opt.bad{background:rgba(238,129,149,.14);border-color:var(--danger);opacity:.75}
  .lp-chip{align-self:flex-start;padding:5px 12px;border-radius:99px;font-size:12.5px;font-weight:800}
  .lp-chip.ok{background:rgba(114,214,163,.16);color:var(--ok);border:1px solid rgba(114,214,163,.4)}
  .lp-chip.bad{background:rgba(238,129,149,.14);color:var(--danger);border:1px solid rgba(238,129,149,.4)}
  .lp-btns{display:flex;gap:8px;flex-wrap:wrap}
  .lp-btns .btn{padding:10px 16px;font-size:14px}
  .lp-moves{display:flex;flex-wrap:wrap;gap:6px}
  .lp-mv{padding:4px 10px;border-radius:9px;font:700 13px ui-monospace,Menlo,monospace;background:var(--panel-2);border:1px solid var(--line);color:var(--ink-dim);cursor:pointer}
  .lp-mv.on{background:var(--tint-2);border-color:var(--violet);color:var(--violet-3)}
  .lp-seg{display:flex;gap:6px;padding:4px;border-radius:14px;background:var(--panel);border:1px solid var(--line)}
  .lp-seg button{flex:1;padding:9px;border-radius:10px;border:0;background:transparent;color:var(--ink-dim);font:700 13.5px var(--font-ui);cursor:pointer}
  .lp-seg button.on{background:var(--tint-2);color:var(--violet-3)}
  .lp-bar{height:8px;border-radius:5px;background:var(--line-2);overflow:hidden}.lp-bar b{display:block;height:100%;background:linear-gradient(90deg,var(--violet),var(--ok));transition:width .4s}

  /* ---- голос + панель робота ---- */
  .mp-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
  .mp-bubble{flex:none!important}
  .mp-tools{display:flex;gap:6px}.mp-tools:empty{display:none}
  .mp-t{height:32px;min-width:34px;padding:0 9px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);color:var(--violet-3);font:800 12.5px var(--font-ui);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
  .mp-t svg{width:18px;height:18px;display:block}.mp-t.off{color:var(--ink-faint)}
  .mp-t.rate{min-width:46px}
  .lp-title .lp-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--tint);border:1px solid var(--tint-2);color:var(--violet-2)}
  .lp-title .lp-ic .ic{width:22px;height:22px}
  .lp-title .ic,.lp-top .ic,.lp-btns .ic,.lp-seg .ic,.mp-tools .ic{display:block;flex:none}
  .lp-top .btn,.lp-btns .btn,.lp-seg button{display:inline-flex;align-items:center;justify-content:center;gap:7px}
  .lp-btns .btn .ic,.lp-top .btn .ic,.lp-seg .ic{width:17px;height:17px}
  .lp-seg button{display:flex}

  /* ================= ПУТЬ: подъём в гору (старт внизу, вершина вверху) ================= */
  #view-lessons .lsn-hero{position:sticky;top:0;z-index:6;display:block;padding:10px 14px;margin:0 0 12px;border-radius:16px;border:1px solid var(--line-2);
    background:rgba(24,26,31,.88);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
  #view-lessons .lsn-prog{margin:0;display:flex;align-items:center;gap:10px}
  .lsn-prog .alt{display:inline-flex;align-items:center;gap:6px;color:var(--violet-3);font:800 12.5px var(--font-ui)}
  .lsn-prog .alt .ic{width:16px;height:16px}
  .lsn-prog .sc{display:inline-flex;align-items:center;gap:4px;color:var(--gold)}.lsn-prog .sc .ic{width:15px;height:15px}
  .pt{position:relative;max-width:440px;margin:4px auto 10px;isolation:isolate}
  .pt-mt{position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:-1}
  .pt-mt .m1{fill:url(#ptg);stroke:var(--line-2);stroke-width:1.2;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  .pt-mt .m2{fill:rgba(255,255,255,.07);stroke:none}
  .pt-svg{position:absolute;left:0;top:0;width:100%;overflow:visible;pointer-events:none;z-index:1}
  .pt-bg{fill:none;stroke:var(--line-3);stroke-width:3;stroke-dasharray:2 9;stroke-linecap:round;vector-effect:non-scaling-stroke}
  .pt-fg{fill:none;stroke:var(--violet-2);stroke-width:4.5;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 6px rgba(185, 139, 245,.7))}
  .pt-ch{position:absolute;left:0;right:0;height:50px;display:flex;align-items:center;justify-content:center;z-index:2}
  .pt-ch span{display:inline-flex;align-items:center;gap:8px;padding:7px 14px 7px 10px;border-radius:99px;font:800 13px var(--font-ui);background:var(--panel-2);border:1px solid var(--line-2);color:var(--ink);box-shadow:0 0 0 7px var(--bg)}
  .pt-ch .ic{width:17px;height:17px;color:var(--violet-2)}
  .pt-ch em{font-style:normal;font-weight:700;color:var(--ink-dim)}
  .pt-ch.full span{border-color:rgba(114,214,163,.5)}.pt-ch.full .ic{color:var(--ok)}
  .pn{position:absolute;z-index:2;width:72px;margin-left:-36px;padding:0;border:0;background:none;color:var(--ink);font:inherit;cursor:pointer;text-align:left;animation:pnIn .5s both;animation-delay:var(--d,0ms);-webkit-tap-highlight-color:transparent}
  .pn:focus-visible .pn-sq{outline:2px solid var(--violet-3);outline-offset:3px}
  .pn-sq{position:relative;display:grid;place-items:center;width:72px;height:72px;border-radius:22px;color:var(--violet-3);border:1.5px solid var(--line-3);
    background:conic-gradient(rgba(255,255,255,.05) 25%,transparent 0 50%,rgba(255,255,255,.05) 0 75%,transparent 0) 0 0/50% 50%,linear-gradient(160deg,var(--panel-3),var(--panel-2));
    box-shadow:0 6px 0 #08080b,0 14px 22px -10px rgba(0,0,0,.65);transition:transform .12s,box-shadow .12s}
  .pn-sq .ic{width:30px;height:30px}
  .pn:active .pn-sq{transform:translateY(4px);box-shadow:0 2px 0 #08080b}
  .pn.st-done .pn-sq{border-color:rgba(114,214,163,.6);color:var(--ok);
    background:conic-gradient(rgba(255,255,255,.04) 25%,transparent 0 50%,rgba(255,255,255,.04) 0 75%,transparent 0) 0 0/50% 50%,linear-gradient(160deg,rgba(114,214,163,.20),var(--panel-2))}
  .pn.st-cur .pn-sq{border-color:var(--violet-3);color:#fff;
    background:conic-gradient(rgba(255,255,255,.09) 25%,transparent 0 50%,rgba(255,255,255,.09) 0 75%,transparent 0) 0 0/50% 50%,linear-gradient(160deg,var(--violet),var(--violet-deep));animation:pnGlow 1.8s ease-in-out infinite}
  .pn.st-lock{cursor:not-allowed}.pn.st-lock .pn-sq{color:var(--ink-faint);border-color:var(--line);opacity:.8}
  .pn.st-lock .pn-sq .ic{width:26px;height:26px}
  .pn.st-fog{pointer-events:none}.pn.st-fog .pn-sq{background:transparent;border:1.5px dashed var(--line-2);color:var(--ink-faint);box-shadow:none}
  .pn-ok{position:absolute;right:-7px;bottom:-7px;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:var(--ok);color:#0c0a11;border:3px solid var(--bg)}
  .pn-ok .ic{width:12px;height:12px}
  .pn-side{position:absolute;left:-7px;top:-7px;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--panel-2);border:1px solid var(--line-3);color:var(--ink)}
  .pn-side .ic{width:12px;height:12px}
  .pn-gift{position:absolute;right:-9px;top:-9px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;color:#2a1f08;border:3px solid var(--bg);
    background:linear-gradient(145deg,#f3d595,var(--gold));animation:pnGift 2.4s ease-in-out infinite}
  .pn-gift .ic{width:14px;height:14px;stroke-width:2}
  .pn-gift.got{background:var(--panel-3);color:var(--ok);animation:none}
  .pn-stars{position:absolute;left:0;top:84px;width:72px;display:flex;justify-content:center;gap:2px}
  .pn-star{width:15px;height:15px;color:var(--gold)}.pn-star svg{display:block;width:100%;height:100%;fill:currentColor}.pn-star.off{color:var(--panel-3)}
  .pn-lb{position:absolute;top:6px;width:132px;font:800 14px/1.25 var(--font-ui)}
  .pn-t{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
  .pn-lb small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin-top:3px;font-weight:600;font-size:11.5px;line-height:1.25;color:var(--ink-dim)}
  .pn-dif{display:flex;gap:3px;margin-top:4px}.pn-dif i{width:11px;height:4px;border-radius:2px;background:var(--panel-3)}.pn-dif i.on{background:var(--violet-2)}.pn-dif.hi i.on{background:var(--gold)}
  .pn-lb small{-webkit-line-clamp:1!important}
  .lp-lvl{margin-left:auto;display:flex;align-items:center;gap:8px;font:700 12px var(--font-ui);color:var(--ink-dim)}.lp-lvl .pn-dif{margin:0}
  .pn-lb.r{left:88px}.pn-lb.l{right:88px;text-align:right}
  .pn.st-lock .pn-lb{color:var(--ink-faint)}
  .pn-tok{position:absolute;left:50%;top:-34px;width:38px;margin-left:-19px;pointer-events:none;filter:drop-shadow(0 6px 6px rgba(0,0,0,.55));animation:pnBob 1.1s ease-in-out infinite}
  .pn-tok svg{display:block;width:100%;height:auto}
  .pn-ping{position:absolute;left:0;top:0;width:72px;height:72px;border-radius:22px;border:2px solid var(--violet-2);pointer-events:none;animation:pnPing 1.8s ease-out infinite}
  .pn.pop .pn-sq{animation:pnPop .9s ease}.pn.shake .pn-sq{animation:mpShake .4s}
  .pt-sum{position:absolute;left:0;right:0;text-align:center;z-index:2}
  .pt-sum .flag{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 10px;border-radius:20px;color:var(--gold);border:1.5px solid rgba(227,191,124,.5);
    background:radial-gradient(circle at 50% 30%,rgba(227,191,124,.28),rgba(227,191,124,.06));box-shadow:0 0 34px -4px rgba(227,191,124,.45);animation:pnBob 2.6s ease-in-out infinite}
  .pt-sum .flag .ic{width:30px;height:30px}
  .pt-sum b{display:block;font:600 18px var(--font-display);color:var(--ink)}
  .pt-sum small{display:block;max-width:240px;margin:3px auto 0;font:600 12.5px/1.4 var(--font-ui);color:var(--ink-dim)}
  .pt-camp{max-width:440px;margin:0 auto 28px;padding:14px;border-radius:20px;border:1px solid var(--line-2);
    background:radial-gradient(120% 140% at 0% 100%,rgba(142, 85, 230,.22),transparent 60%),var(--panel)}
  .pt-jump{position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);z-index:30;display:none;align-items:center;gap:8px;padding:10px 14px;border-radius:99px;cursor:pointer;
    font:800 13px var(--font-ui);color:#fff;border:1px solid var(--violet-3);background:linear-gradient(160deg,var(--violet),var(--violet-deep));box-shadow:0 10px 26px -8px rgba(142, 85, 230,.8)}
  .pt-jump.show{display:inline-flex;animation:pnIn .3s both}.pt-jump .ic{width:18px;height:18px}
  /* ---- результат урока ---- */
  .lp-res{position:relative;overflow:hidden;text-align:center;padding:20px 16px 18px;border-radius:20px;border:1px solid var(--line-2);
    background:radial-gradient(90% 120% at 50% 0%,rgba(142, 85, 230,.28),transparent 70%),var(--panel)}
  .lp-res p{margin:6px 0;color:var(--ink-dim);font-size:13.5px}
  .rs-stars{display:flex;justify-content:center;gap:10px;margin:0 0 8px}
  .rs-st{width:56px;height:56px;opacity:0;animation:rsPop .65s cubic-bezier(.2,1.4,.4,1) forwards;animation-delay:calc(.25s + var(--i) * .35s)}
  .rs-st:nth-child(2){margin-top:-8px}
  .rs-st svg{display:block;width:100%;height:100%;overflow:visible;stroke-linejoin:round}
  .rs-st.on svg{fill:var(--gold);stroke:#b8923e;stroke-width:1;filter:drop-shadow(0 0 12px rgba(227,191,124,.75))}
  .rs-st.off svg{fill:var(--panel-3);stroke:var(--line-2);stroke-width:1}
  .rs-title{font:600 22px var(--font-display);color:var(--ink);opacity:0;animation:rsUp .45s ease forwards;animation-delay:1.1s}
  .lp-res p,.rs-gain,.rs-note{opacity:0;animation:rsUp .45s ease forwards;animation-delay:1.25s}
  .rs-gain{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px}
  .rs-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;font:800 15px var(--font-ui);color:var(--violet-3);background:var(--tint);border:1px solid var(--tint-2)}
  .rs-chip .ic{width:18px;height:18px}
  .rs-chip.gold{color:var(--gold);background:rgba(227,191,124,.12);border-color:rgba(227,191,124,.35)}
  .rs-chip b{font-variant-numeric:tabular-nums}
  @keyframes pnIn{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}
  @keyframes pnGlow{0%,100%{box-shadow:0 6px 0 #08080b,0 0 0 0 rgba(185, 139, 245,.55)}50%{box-shadow:0 6px 0 #08080b,0 0 28px 6px rgba(185, 139, 245,.55)}}
  @keyframes pnBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
  @keyframes pnPing{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(1.55)}}
  @keyframes pnPop{0%{transform:scale(1)}35%{transform:scale(1.24) rotate(-4deg);box-shadow:0 0 36px 10px rgba(114,214,163,.7)}100%{transform:scale(1)}}
  @keyframes pnGift{0%,100%{transform:rotate(0)}8%{transform:rotate(-14deg)}16%{transform:rotate(12deg)}24%{transform:rotate(-8deg)}32%{transform:rotate(0)}}
  @keyframes rsPop{0%{opacity:0;transform:scale(0) rotate(-50deg)}60%{opacity:1;transform:scale(1.35) rotate(10deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes rsUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){.pn,.pn *,.rs-st,.rs-title,.rs-gain,.lp-res p,.rs-note,.pt-sum .flag{animation:none!important;opacity:1!important;transform:none!important}}
  `;
  document.head.appendChild(css);

  const MAPER_SVG = `<svg viewBox="0 0 90 92" aria-hidden="true"><defs><linearGradient id="mpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b98bf5"/><stop offset="1" stop-color="#5f2fb8"/></linearGradient></defs>
    <line x1="45" y1="9" x2="45" y2="21" stroke="#b98bf5" stroke-width="3" stroke-linecap="round"/><circle class="ant" cx="45" cy="7" r="5" fill="#e3bf7c"/>
    <rect x="6" y="38" width="9" height="20" rx="4.5" fill="#5f2fb8"/><rect x="75" y="38" width="9" height="20" rx="4.5" fill="#5f2fb8"/>
    <rect x="13" y="20" width="64" height="56" rx="21" fill="url(#mpg)"/><rect x="20" y="28" width="50" height="36" rx="14" fill="#0c0a11"/>
    <g class="eg e-n"><circle cx="34" cy="43" r="5.2" fill="#dcc6ff"/><circle cx="56" cy="43" r="5.2" fill="#dcc6ff"/></g>
    <g class="eg e-h" fill="none" stroke="#72d6a3" stroke-width="3.6" stroke-linecap="round"><path d="M28 47Q34 37 40 47"/><path d="M50 47Q56 37 62 47"/></g>
    <g class="eg e-s" fill="none" stroke="#ee8195" stroke-width="3.6" stroke-linecap="round"><path d="M28 41Q34 49 40 41"/><path d="M50 41Q56 49 62 41"/><circle cx="58" cy="52" r="2.2" fill="#91d2f7" stroke="none"/></g>
    <g class="eg e-t"><circle cx="34" cy="44" r="3.4" fill="#dcc6ff"/><circle cx="56" cy="42" r="6" fill="#dcc6ff"/></g>
    <path class="mg m-n" d="M40 56Q45 59 50 56" fill="none" stroke="#dcc6ff" stroke-width="2.6" stroke-linecap="round"/>
    <path class="mg m-h" d="M37 54Q45 64 53 54Z" fill="#72d6a3" stroke="#72d6a3" stroke-width="2" stroke-linejoin="round"/>
    <path class="mg m-s" d="M39 59Q45 54 51 59" fill="none" stroke="#ee8195" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="27" y="77" width="36" height="12" rx="6" fill="#2b2636" stroke="#8e55e6" stroke-width="1.5"/><text x="45" y="86.5" text-anchor="middle" font-size="8.5" font-weight="800" fill="#dcc6ff" font-family="Onest,sans-serif">♞</text></svg>`;

  /* говорящий MAPER: печатает фразу, ОЗВУЧИВАЕТ её и меняет «настроение». say(text, mood, quiet) */
  let typeIv = null;
  const IC_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const IC_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  /* понятный текст в «облачке» робота: шахматная запись (Nf3+, exd5, Qxe7#, O-O) -> слова,
     клетки остаются как есть: «конём на f3 (шах)», «пешкой e бьёт на d5». Голос читает свою версию. */
  function readable(src) {
    const ru = ((UI.state && UI.state.lang) || "en") === "ru";
    const PC = ru ? { K: "королём", Q: "ферзём", R: "ладьёй", B: "слоном", N: "конём" }
                  : { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight" };
    const PR = ru ? { Q: "ферзя", R: "ладью", B: "слона", N: "коня" } : { Q: "queen", R: "rook", B: "bishop", N: "knight" };
    return String(src)
      .replace(/\bO-O-O([+#])?/g, (m, ch) => (ru ? "длинная рокировка" : "long castling") + chk(ch, ru))
      .replace(/\bO-O([+#])?/g, (m, ch) => (ru ? "короткая рокировка" : "short castling") + chk(ch, ru))
      .replace(/\b([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([QRBN]))?([+#])?(?![\w])/g, (m, pc, ff, fr, x, to, pr, ch) => {
        if (!pc && !x && !pr && !ch && !ff) return m;                 /* просто клетка «e4» — не трогаем */
        if (!pc && ff && !x) return m;                               /* «a1b2»-подобное — не похоже на ход */
        let o;
        if (pc) o = PC[pc] + (ff || fr ? " " + (ff || "") + (fr || "") : "");
        else o = ru ? "пешкой" + (ff ? " " + ff : "") : "pawn" + (ff ? " " + ff : "");
        o += x ? (ru ? " бьёт на " : " takes on ") : (ru ? " на " : " to ");
        o += to;
        if (pr) o += ru ? " с превращением в " + PR[pr] : " promoting to " + PR[pr];
        return o + chk(ch, ru);
      });
  }
  function chk(ch, ru) { return ch === "#" ? (ru ? " (мат)" : " (mate)") : ch === "+" ? (ru ? " (шах)" : " (check)") : ""; }
  function mkMaper(host) {
    host.innerHTML = `<div class="mp-av">${MAPER_SVG}</div><div class="mp-col"><div class="mp-bubble"></div><div class="mp-tools"></div></div>`;
    host.dataset.mood = "idle";
    const bub = host.querySelector(".mp-bubble"), tools = host.querySelector(".mp-tools");
    let typing = false, last = "";
    const sync = () => host.classList.toggle("talk", typing || Voice.speaking);
    Voice.cb = sync;
    if (Voice.ok) {
      tools.innerHTML = `<button type="button" class="mp-t mp-sp"></button><button type="button" class="mp-t mp-rp"></button><button type="button" class="mp-t mp-rt rate"></button><button type="button" class="mp-t mp-vc"></button>`;
      const sp = tools.querySelector(".mp-sp"), rp = tools.querySelector(".mp-rp"), rt = tools.querySelector(".mp-rt"), vc = tools.querySelector(".mp-vc");
      const paint = () => {
        sp.innerHTML = Voice.cfg.on ? IC_ON : IC_OFF; sp.classList.toggle("off", !Voice.cfg.on);
        sp.title = tr("Robot voice on/off", "Голос робота: вкл/выкл");
        rp.innerHTML = ico("redo", 17); rp.title = tr("Say it again", "Повторить");
        rt.textContent = Voice.cfg.rate + "×"; rt.title = tr("Speech speed", "Скорость речи");
        vc.innerHTML = ico("voice", 17); vc.title = tr("Change voice", "Сменить голос") + (Voice.voiceInfo() ? ": " + Voice.voiceInfo() : "");
      };
      sp.addEventListener("click", () => { Voice.toggle(); paint(); if (Voice.cfg.on && last) Voice.say(last); });
      rp.addEventListener("click", () => { if (last) Voice.say(last, true); });
      rt.addEventListener("click", () => { Voice.cycle(); paint(); if (last) Voice.say(last, true); });
      vc.addEventListener("click", () => {
        if (!Voice.nextVoice()) { if (UI._toast) UI._toast(tr("No other voices on this device. Install more voices in your system settings.", "Других голосов на этом устройстве нет. Установи дополнительные голоса в настройках системы.")); return; }
        paint(); if (last) Voice.say(last, true);
        if (UI._toast && Voice.voiceInfo()) UI._toast(tr("Voice: ", "Голос: ") + Voice.voiceInfo());
      });
      paint();
    }
    return (text, mood, quiet) => {
      clearInterval(typeIv); last = text;
      const shown = readable(text);
      host.dataset.mood = mood || "idle";
      bub.textContent = ""; typing = true;
      const speak = !quiet && Voice.ok && Voice.cfg.on && Voice.hasVoice();
      if (speak) Voice.say(text); else Voice.stop();
      sync();
      /* с голосом текст появляется чуть быстрее речи, без — почти мгновенно */
      const per = speak ? Math.min(45, Math.max(10, 1000 / (24 * Voice.cfg.rate))) : 8, step = speak ? 1 : 2;
      let i = 0;
      typeIv = setInterval(() => {
        i += step; bub.textContent = shown.slice(0, i);
        if (i >= shown.length) { clearInterval(typeIv); typing = false; sync(); }
      }, per);
    };
  }

  /* ====================================================================
     КАРКАС РАЗДЕЛА
     ==================================================================== */
  const sec = document.createElement("section");
  sec.id = "view-lessons"; sec.className = "view";
  sec.innerHTML = `
    <h2 class="view-title" data-i18n="lsn.title"></h2>
    <div id="lsn-home"></div>
    <div id="lsn-page" hidden></div>`;
  document.querySelector(".views").appendChild(sec);
  const nb = document.createElement("button");
  nb.className = "nav-btn"; nb.dataset.view = "lessons";
  nb.innerHTML = `<span>♝</span><span data-i18n="nav.lessons"></span>`;
  document.querySelector('.nav-btn[data-view="levels"]').after(nb);

  let S = null, O = null, timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  function stopAll() {
    timers.forEach(clearTimeout); timers = [];
    clearInterval(typeIv); Voice.stop();
    if (O && O.auto) { clearInterval(O.auto); O.auto = null; }
  }

  /* прогресс и награды */
  const prog = kind => { const s = UI.state; if (!s) return {}; if (!s[kind]) s[kind] = {}; return s[kind]; };
  const starsFor = mistakes => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);
  const starsRow = n => [1, 2, 3].map(i => `<span class="pn-star${i <= n ? "" : " off"}">${STAR_SVG}</span>`).join("");
  const sfx = (fn, ...a) => { try { if (typeof Sfx !== "undefined" && Sfx[fn]) Sfx[fn](...a); } catch (e) {} };
  /* Награда зависит от сложности и звёзд: 1★ = 50%, 2★ = 75%, 3★ = 100% базовой суммы.
     За улучшение результата доплачивается разница, так что набить монеты повторами нельзя. */
  const MULT = [0, 0.5, 0.75, 1];
  const LV_COINS = [0, 3, 6, 10, 16, 26], LV_XP = [0, 8, 14, 22, 32, 45];
  function reward(kind, id, stars, coins, xp) {
    const p = prog(kind), s = UI.state, old = p[id] || 0;
    p[id] = Math.max(old, stars);
    const dc = Math.max(0, Math.round(coins * MULT[p[id]]) - Math.round(coins * MULT[old]));
    const dx = Math.max(0, Math.round(xp * MULT[p[id]]) - Math.round(xp * MULT[old]));
    s.coins += dc; s.xp += dx;
    justDone = kind + id;
    saveState(s); UI.renderTopbar();
    return { first: !old, dc, dx };
  }

  /* ---------- экран результата: звёзды вылетают по одной, числа «набегают», салют ---------- */
  const resTitle = n => (n === 3 ? tr("Flawless!", "Безупречно!") : n === 2 ? tr("Great job!", "Отличная работа!") : tr("Completed!", "Пройдено!"));
  function resultHtml(stars, statsTxt, r) {
    const st = [1, 2, 3].map(i => `<span class="rs-st ${i <= stars ? "on" : "off"}" style="--i:${i - 1}">${STAR_SVG}</span>`).join("");
    const gain = (r.dc || r.dx)
      ? `<div class="rs-gain">${r.dc ? `<span class="rs-chip gold">${ico("coin", 18)}+<b data-to="${r.dc}">0</b></span>` : ""}${r.dx ? `<span class="rs-chip">${ico("star", 18)}+<b data-to="${r.dx}">0</b> XP</span>` : ""}</div>${stars < 3 ? `<p class="rs-note">${tr("Get 3 stars for the full reward!", "Пройди на 3 звезды — получишь полную награду!")}</p>` : ""}`
      : `<p class="rs-note">${tr("Already rewarded — no extra coins this time.", "Награда уже получена — монет больше не будет.")}</p>`;
    return `<div class="lp-res"><div class="rs-stars">${st}</div><div class="rs-title">${resTitle(stars)}</div><p>${statsTxt}</p>${gain}</div>`;
  }
  function countUp(el, to) {
    const t0 = performance.now(), dur = 800;
    (function tick(now) {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && el.isConnected) requestAnimationFrame(tick);
    })(t0);
  }
  function playResult(box, stars, first) {
    const cx = window.Celebrate;
    box.querySelectorAll(".rs-st.on").forEach((el, i) => later(() => sfx("star", i), 320 + i * 350));
    later(() => {
      const r = box.querySelector(".rs-stars"); if (!r) return;
      const b = r.getBoundingClientRect();
      if (cx && stars > 0) cx.burst(b.left + b.width / 2, b.top + b.height / 2, { n: 26 + stars * 24, power: 0.9 + stars * 0.2 });
    }, 320 + Math.max(1, stars) * 350);
    box.querySelectorAll("[data-to]").forEach((b, i) => later(() => countUp(b, +b.dataset.to), 1300 + i * 250));
  }

  function miniBoard(moves) {
    const g = new Chess(); moves.forEach(m => g.move(m));
    let h = "";
    g.board().forEach((row, r) => row.forEach((c, f) => {
      const dark = (r + f) % 2 === 1;
      const svg = c && window.pieceSvg ? window.pieceSvg(c.color, c.type) : "";
      h += `<span style="background:var(${dark ? "--sq-dark" : "--sq-light"})">${svg}</span>`;
    }));
    return `<div class="lc-mini">${h}</div>`;
  }

  /* ---------- главная: ПУТЬ из клеток ---------- */
  let greet = false, justDone = null;
  const CHAPTERS = [
    { t: B("Chapter 1 · The basics", "Глава 1 · Основы"), k: "l", ids: ["board", "moves", "check", "castle", "pawns"] },
    { t: B("Chapter 2 · Tactics", "Глава 2 · Тактика"), k: "l", ids: ["values", "tactics", "mates", "mate1", "forks", "pins", "threats"] },
    { t: B("Chapter 3 · Openings", "Глава 3 · Дебюты"), k: "o", ids: OPENINGS.map(o => o.id) },
    { t: B("Chapter 4 · Mastery", "Глава 4 · Мастерство"), k: "l", ids: ["disc", "kpk", "mate2"] },
    { t: B("Chapter 5 · The summit", "Глава 5 · Вершина"), k: "l", ids: ["sac", "mate3"] },
    { t: B("Chapter 6 · Endgames & strategy", "Глава 6 · Эндшпиль и стратегия"), k: "l", ids: ["stale", "kqk", "krk", "passed", "rooks", "outpost"] },
    { t: B("Chapter 7 · More openings", "Глава 7 · Новые дебюты"), k: "o", ids: ["scotch", "vienna", "qga", "petrov", "scandi", "english", "kgambit", "pirc", "slav", "nimzo"] },
    { t: B("Chapter 8 · Mating patterns", "Глава 8 · Матовые схемы"), k: "l", ids: ["ladder", "batt", "smoth", "anas", "arab", "dbl", "epau", "boden", "legal"] }
  ];
  /* НОВОЕ: дополнительные уроки и главы живут в js/lessons-more.js (подключается ДО этого файла) */
  if (typeof window.MAPER_MORE === "function") {
    try { window.MAPER_MORE({ B, M, T, Q, TT, Ln, Ms, MN, isTo, mateOk, staleWrong, START, LESSONS, OPENINGS, CHAPTERS, IC, tr, L, lang }); }
    catch (e) { console.error("MAPER_MORE failed", e); }
  }
  /* для rewards.js: сколько всего уроков и дебютов (награды и достижения считаются от этих чисел) */
  window.MaperPath = { lessons: LESSONS.length, openings: OPENINGS.length, ids: LESSONS.map(l => l.id) };
  const lvlOf = c => c.it.lvl || (c.k === "o" ? 3 : 1);
  const pips = n => `<span class="pn-dif${n >= 4 ? " hi" : ""}" title="${tr("Difficulty", "Сложность")} ${n}/5">${[1, 2, 3, 4, 5].map(i => `<i${i <= n ? ' class="on"' : ""}></i>`).join("")}</span>`;
  const kindOf = c => (c.k === "l" ? "lessons" : "openings");
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function buildPath() {
    const used = {}, out = [];
    const add = (t, cells) => { if (cells.length) { out.push({ ch: t }); cells.forEach(c => out.push(c)); } };
    CHAPTERS.forEach(ch => {
      const src = ch.k === "l" ? LESSONS : OPENINGS, cells = [];
      ch.ids.forEach(id => { const i = src.findIndex(x => x.id === id); if (i >= 0 && !used[ch.k + id]) { used[ch.k + id] = 1; cells.push({ k: ch.k, i, it: src[i] }); } });
      add(ch.t, cells);
    });
    const extra = [];
    LESSONS.forEach((it, i) => { if (!used["l" + it.id]) extra.push({ k: "l", i, it }); });
    OPENINGS.forEach((it, i) => { if (!used["o" + it.id]) extra.push({ k: "o", i, it }); });
    add(B("Further along", "Дальше по пути"), extra);
    return out;
  }
  const openCell = c => (c.k === "l" ? openLesson(c.i) : openOpening(c.i));
  function nextCell(k, id) {
    const cells = buildPath().filter(x => !x.ch), n = cells[cells.findIndex(c => c.k === k && c.it.id === id) + 1];
    return n ? { label: tr("Next square", "Следующая клетка") + ico("arrowR", 17), fn: () => openCell(n) } : null;
  }
  const toPath = () => ({ label: ico("flag", 17) + tr("Back to the path", "К пути"), fn: renderHome });

  /* какие награды «лежат» на каких клетках пути (данные приходят из rewards.js) */
  function giftMap(cells) {
    const R = window.MaperRewards, m = {};
    if (!R) return m;
    R.STEPS.forEach(stp => {
      let cnt = 0, idx = -1;
      cells.forEach((c, i) => {
        if (idx >= 0) return;
        if (stp.kind === "both" || (stp.kind === "lessons" ? c.k === "l" : c.k === "o")) { cnt++; if (cnt === stp.n) idx = i; }
      });
      if (idx >= 0) (m[idx] = m[idx] || []).push(stp);
    });
    return m;
  }

  function renderHome() {
    stopAll(); S = null; O = null;
    const home = $("lsn-home"); home.hidden = false; $("lsn-page").hidden = true;
    const path = buildPath(), cells = path.filter(x => !x.ch);
    const st = c => prog(kindOf(c))[c.it.id] || 0;
    const doneN = cells.filter(st).length, stars = cells.reduce((a, c) => a + st(c), 0);
    const cur = cells.findIndex(c => !st(c));
    const gifts = giftMap(cells), claimed = (UI.state && UI.state.rewardsClaimed) || [], ru = lang() === "ru";

    /* геометрия: СТАРТ ВНИЗУ, вершина вверху. d — расстояние от подножия; клетки идут змейкой,
       которая к вершине сужается, как тропа на горе */
    const ROW = 106, CHH = 62, TILE = 72, NF = 3, SUMMIT = 150, PAD = 24;
    const total = cells.length + NF;
    const X = i => 50 + (27 - 12 * Math.min(1, i / total)) * Math.sin(i * 1.1);
    let d = PAD, ci = 0, bn = null; const pts = [];
    path.forEach(p => {
      if (p.ch) { p.d = d; p.dn = 0; p.tot = 0; bn = p; d += CHH; return; }
      p.d = d; p.x = X(ci); p.ci = ci++; bn.tot++; if (st(p)) bn.dn++;
      pts.push([p.x, d]); d += ROW;
    });
    const fog = [];
    for (let f = 0; f < NF; f++) { const p = { d, x: X(ci), ci: ci++ }; fog.push(p); pts.push([p.x, d]); d += ROW; }
    const H = d + SUMMIT, topOf = dd => H - dd - TILE;
    const P = pts.map(p => [p[0], topOf(p[1]) + TILE / 2]);
    const curve = a => a.map((p, i) => { if (!i) return `M${p[0].toFixed(1)} ${p[1]}`; const m = ((a[i - 1][1] + p[1]) / 2).toFixed(1); return `C${a[i - 1][0].toFixed(1)} ${m} ${p[0].toFixed(1)} ${m} ${p[0].toFixed(1)} ${p[1]}`; }).join(" ");
    const tok = window.pieceSvg ? window.pieceSvg("w", "n") : "";

    /* силуэт горы (рисуется за тропой) */
    const hw = y => 12 + 36 * Math.pow(y / H, 0.9), jag = y => 2.6 * Math.sin(y / 31) + 1.8 * Math.sin(y / 13 + 1.7);
    const Lp = [], Rp = [];
    for (let y = 10; y < H; y += 26) { Lp.push(`${(50 - hw(y) + jag(y)).toFixed(1)},${y}`); Rp.push(`${(50 + hw(y) - jag(y * 1.3)).toFixed(1)},${y}`); }
    Lp.push(`${(50 - hw(H)).toFixed(1)},${H}`); Rp.push(`${(50 + hw(H)).toFixed(1)},${H}`);
    const w1 = hw(120), snow = `50,2 ${(50 + w1 - 3).toFixed(1)},120 ${(50 + w1 * .42).toFixed(1)},100 50,132 ${(50 - w1 * .42).toFixed(1)},100 ${(50 - w1 + 3).toFixed(1)},120`;
    const mt = `<defs><linearGradient id="ptg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98bf5" stop-opacity=".04"/><stop offset="1" stop-color="#8e55e6" stop-opacity=".17"/></linearGradient></defs>` +
      `<polygon class="m1" points="50,0 ${Rp.join(" ")} ${Lp.slice().reverse().join(" ")}"/><polygon class="m2" points="${snow}"/>`;

    let h = `<div class="pt" style="height:${H}px"><svg class="pt-mt" viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}px">${mt}</svg>` +
      `<svg class="pt-svg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}px"><path class="pt-bg" d="${curve(P)}"/><path class="pt-fg" d="${curve(P.slice(0, (cur < 0 ? cells.length : cur) + 1))}"/></svg>` +
      `<div class="pt-sum" style="top:14px"><span class="flag">${ico("flag", 30)}</span><b>${tr("The summit", "Вершина")}</b><small>${tr("MAPER Diploma and the grand reward are waiting up here", "Тут тебя ждут диплом MAPER и главная награда")}</small></div>`;
    path.forEach(p => {
      if (p.ch) { h += `<div class="pt-ch${p.dn === p.tot ? " full" : ""}" style="top:${H - p.d - 50}px"><span>${ico("flag", 17)}${L(p.ch)}<em>${p.dn}/${p.tot}</em></span></div>`; return; }
      const s = st(p), state = s ? "done" : p.ci === cur ? "cur" : "lock";
      const g = gifts[p.ci], gotAll = g && g.every(x => claimed.includes(x.id));
      const gtxt = g ? g.map(x => (ru ? x.ru : x.en)).join(", ") : "";
      const sideB = p.k === "o" ? `<span class="pn-side" title="${tr(p.it.side === "w" ? "You play White" : "You play Black", p.it.side === "w" ? "Играешь белыми" : "Играешь чёрными")}">${ico(p.it.side === "w" ? "wdisc" : "bdisc", 12)}</span>` : "";
      const glyph = state === "lock" ? ico("lock", 26) : ico(p.k === "l" ? (IC[p.it.id] ? p.it.id : "board") : "opening", 30);
      h += `<button type="button" class="pn st-${state}${kindOf(p) + p.it.id === justDone ? " pop" : ""}" data-ci="${p.ci}" style="left:${p.x.toFixed(1)}%;top:${topOf(p.d)}px;--d:${(cells.length - p.ci) * 40}ms" aria-label="${L(p.it.t)}">
        <span class="pn-sq">${glyph}</span>${sideB}
        ${g ? `<span class="pn-gift${gotAll ? " got" : ""}" title="${gtxt}">${ico(gotAll ? "check2" : "gift", 14)}</span>` : ""}
        ${state === "done" ? `<span class="pn-ok">${ico("check2", 12)}</span>` : ""}
        ${state === "cur" ? `<span class="pn-ping"></span><span class="pn-tok">${tok}</span>` : ""}
        ${s ? `<span class="pn-stars">${starsRow(s)}</span>` : ""}
        <span class="pn-lb ${p.x < 50 ? "r" : "l"}"><span class="pn-t">${L(p.it.t)}</span>${pips(lvlOf(p))}<small>${L(p.k === "l" ? p.it.d : p.it.tag)}</small></span></button>`;
    });
    fog.forEach((p, f) => { h += `<div class="pn st-fog" style="left:${p.x.toFixed(1)}%;top:${topOf(p.d)}px;opacity:${(.6 - (NF - 1 - f) * .15).toFixed(2)};--d:0ms"><span class="pn-sq">${ico("ask", 26)}</span></div>`; });
    h += `</div>`;

    const pct = Math.round(doneN / Math.max(1, cells.length) * 100);
    home.innerHTML = `<div class="lsn-hero"><div class="lsn-prog"><span class="alt">${ico("flag", 16)}${tr("Climb", "Подъём")}</span><i><b style="width:${pct}%"></b></i><span>${doneN}/${cells.length}</span><span class="sc">${ico("star", 15)}${stars}</span></div></div>${h}
      <div class="pt-camp"><div class="mp" id="lsn-mp"></div></div>`;

    const nm = cur >= 0 ? L(cells[cur].it.t) : "";
    mkMaper($("lsn-mp"))(!doneN
      ? tr("Hi, I'm MAPER! This is your climb: start at the bottom and go up, square by square. Tap the glowing one and let's go!",
           "Привет, я MAPER! Это твой путь в гору: начинай снизу и поднимайся клетка за клеткой. Нажми на светящуюся клетку, и поехали!")
      : cur >= 0
        ? tr(`Welcome back! Next square up: «${nm}». Shall we?`, `С возвращением! Следующая клетка вверх — «${nm}». Идём дальше?`)
        : tr("You've reached the top of everything I have so far! New squares are being built — come back soon. Meanwhile, beat your stars!",
             "Ты добрался до вершины всего, что у меня есть! Новые клетки уже строятся — заглядывай скоро. А пока можно улучшить звёзды!"),
      "idle", !greet || doneN > 0);
    greet = false;
    if (window.MaperTrainer && MaperTrainer.decorate) { try { MaperTrainer.decorate(home); } catch (e) { console.warn("trainer", e); } }

    home.querySelectorAll(".pn[data-ci]").forEach(b => b.addEventListener("click", () => {
      if (!b.classList.contains("st-lock")) return openCell(cells[+b.dataset.ci]);
      const msg = tr("This square is still locked — finish the glowing one first!", "Эта клетка пока закрыта — сначала пройди светящуюся!");
      b.classList.add("shake"); setTimeout(() => b.classList.remove("shake"), 420);
      if (UI._toast) UI._toast(msg);
      Voice.say(msg);
    }));

    /* камера: сразу к текущей клетке (путь начинается внизу), плавно — если вернулись из урока */
    const curEl = home.querySelector(".st-cur") || home.querySelector(".pop") || home.querySelector(".pt-sum");
    const smooth = !!justDone;
    setTimeout(() => { if (curEl && curEl.scrollIntoView) curEl.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" }); }, 60);
    if (curEl && "IntersectionObserver" in window) {
      const jb = document.createElement("button"); jb.type = "button"; jb.className = "pt-jump";
      jb.innerHTML = `${ico("target", 18)}<span>${tr("My square", "Моя клетка")}</span>`; home.appendChild(jb);
      jb.addEventListener("click", () => curEl.scrollIntoView({ block: "center", behavior: "smooth" }));
      new IntersectionObserver(es => jb.classList.toggle("show", !es[0].isIntersecting), { threshold: 0.4 }).observe(curEl);
    }
    /* салют над только что пройденной клеткой */
    if (justDone && window.Celebrate) {
      const pe = home.querySelector(".pop");
      if (pe) later(() => { const r = pe.getBoundingClientRect(); Celebrate.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 34, power: 0.8 }); sfx("sparkle"); }, 700);
    }
    justDone = null;
  }

  /* ====================================================================
     УРОК
     ==================================================================== */
  let board = null, game = null, say = null;
  function mountBoard(fen, side, onMove, locked) {
    const el = $("lp-board"); el.innerHTML = "";
    game = new Chess(fen);
    board = new BoardView(el, { playerColor: side, orientation: side, onMove });
    board.attach(game, null); board.setLocked(!!locked);
  }
  function mark(squares, cls) { (squares || []).forEach(s => board.squares[s] && board.squares[s].classList.add("sq-" + cls)); }
  function clearMarks() {
    if (!board) return;
    Object.values(board.squares).forEach(el => el.classList.remove("sq-hint", "sq-focus", "sq-good", "sq-bad"));
  }
  function glow(kind) {
    const w = $("lp-bw"); if (!w) return;
    w.classList.remove("good", "bad"); if (kind) { w.classList.add(kind); later(() => w.classList.remove(kind), 1400); }
  }
  function chip(kind, text) {
    const c = $("lp-chip"); if (!c) return;
    if (!kind) { c.hidden = true; return; }
    c.hidden = false; c.className = "lp-chip " + kind; c.textContent = text;
  }

  function lessonShell(title, icon, lvl) {
    const page = $("lsn-page"); page.hidden = false; $("lsn-home").hidden = true;
    page.innerHTML = `
      <div class="lp-top"><button class="btn btn-ghost" id="lp-back">${ico("left", 17)}${tr("Path", "К пути")}</button>
        <div class="lp-title"><span class="lp-ic">${icon || ""}</span><span></span></div></div>
      <div class="lp-dots" id="lp-dots"></div>
      <div class="lp-grid">
        <div><div class="lp-bw" id="lp-bw"><div class="board lp-board" id="lp-board"></div></div></div>
        <div class="lp-right" id="lp-right">
          <div class="mp" id="mp"></div>
          <div class="lp-quiz" id="lp-quiz"></div>
          <span class="lp-chip" id="lp-chip" hidden></span>
          <div class="lp-btns" id="lp-btns"></div>
        </div>
      </div>`;
    page.querySelector(".lp-title span:last-child").textContent = title;
    if (lvl) page.querySelector(".lp-top").insertAdjacentHTML("beforeend", `<div class="lp-lvl">${tr("Level", "Уровень")} ${lvl}${pips(lvl)}</div>`);
    $("lp-back").addEventListener("click", renderHome);
    say = mkMaper($("mp"));
  }
  function setBtns(...defs) {
    const box = $("lp-btns"); box.innerHTML = "";
    defs.forEach(d => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn " + (d.primary ? "btn-primary" : "btn-ghost"); b.innerHTML = d.label;
      b.addEventListener("click", d.fn); box.appendChild(b);
    });
  }

  function openLesson(i) {
    stopAll();
    const lsn = LESSONS[i];
    S = { i, lsn, k: 0, mistakes: 0, hints: 0, sm: 0, solved: false, hinted: {} };
    lessonShell(L(lsn.t), lessonIcon(lsn.id), lsn.lvl);
    runStep();
  }

  function paintDots() {
    $("lp-dots").innerHTML = S.lsn.steps.map((_, k) => `<i class="${k < S.k || (k === S.k && S.solved) ? "ok" : k === S.k ? "on" : ""}"></i>`).join("");
  }

  function solutionOf(st) {
    const f0 = st.line ? game.fen() : st.fen, base = new Chess(f0);
    for (const m of base.moves({ verbose: true })) {
      const g = new Chess(f0);
      const mv = g.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (mv && st.ok(mv, g)) return mv;
    }
    return null;
  }

  function runStep() {
    const st = S.lsn.steps[S.k];
    S.sm = 0; S.solved = false; S.li = 0;
    paintDots(); chip(null); $("lp-quiz").innerHTML = "";
    const side = (st.fen.split(" ")[1]) || "w";
    if (st.quiz || st.tap) {
      mountBoard(st.fen, null, () => {}, true);
      board.orientation !== side && board.setOrientation(side);
    } else {
      mountBoard(st.fen, side, (from, to) => onMove(st, from, to), false);
      if (!solutionOf(st)) console.warn("MAPER: у шага нет решения", S.lsn.id, S.k);
    }
    clearMarks();
    if (st.hl) mark(st.hl, "focus");
    say(L(st.say), "idle");
    const hintBtn = { label: ico("bulb", 17) + tr("Hint", "Подсказка"), fn: () => hint(st) };
    setBtns(hintBtn);

    if (st.quiz) {
      const box = $("lp-quiz");
      st.quiz.opts.forEach((o, idx) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "lp-opt"; b.textContent = L(o);
        b.addEventListener("click", () => {
          if (S.solved) return;
          if (idx === st.quiz.correct) {
            b.classList.add("ok"); solved(st, L(st.why));
            box.querySelectorAll("button").forEach(x => (x.disabled = true));
          } else {
            b.classList.add("bad"); b.disabled = true; S.mistakes++; S.sm++;
            glow("bad"); chip("bad", tr("Not quite", "Не то"));
            say(tr("Hmm, not that one. Think again — you can use a hint.", "Хм, не это. Подумай ещё — можно взять подсказку."), "sad");
          }
        });
        box.appendChild(b);
      });
    }
    if (st.tap) {
      const targets = st.tap;
      Object.keys(board.squares).forEach(sq => board.squares[sq].addEventListener("click", () => {
        if (S.solved) return;
        clearMarks();
        if (targets.includes(sq)) { mark([sq], "good"); solved(st, L(st.good)); }
        else {
          S.mistakes++; S.sm++; mark([sq], "bad"); glow("bad"); chip("bad", tr("Not quite", "Не то"));
          say(L(st.wrong(sq)), "sad");
          later(() => { if (!S.solved) clearMarks(); }, 900);
        }
      }));
    }
  }

  function hint(st) {
    if (S.solved) return;
    if (!S.hinted[S.k]) { S.hinted[S.k] = 1; S.hints++; }
    if (S.sm >= 1 || S.hinted[S.k] === 2) revealAnswer(st);
    else { S.hinted[S.k] = 2; say(L(st.tip) || tr("Look at the position carefully.", "Внимательно посмотри на позицию."), "think"); }
  }
  function revealAnswer(st) {
    clearMarks();
    if (st.tap) { mark(st.tap, "hint"); say(tr("The answer is highlighted — tap it.", "Ответ подсвечен — нажми на него."), "think"); return; }
    if (st.quiz) {
      const btns = $("lp-quiz").querySelectorAll("button");
      btns[st.quiz.correct] && btns[st.quiz.correct].classList.add("ok");
      say(tr("I marked the right answer. Tap it.", "Я отметил верный ответ. Нажми на него."), "think"); return;
    }
    const sol = solutionOf(st);
    if (sol) { mark([sol.from, sol.to], "hint"); say(tr("Gold squares show the move: from → to.", "Золотые клетки показывают ход: откуда → куда."), "think"); }
  }

  function onMove(st, from, to) {
    if (S.solved) return;
    const g = new Chess(game.fen());
    const p = g.get(from);
    const isPromo = p && p.type === "p" && (to[1] === "8" || to[1] === "1");
    const go = pr => { const mv = g.move({ from, to, promotion: pr }); if (mv) judge(st, mv, g); };
    if (isPromo && typeof choosePromotion === "function") { board.setLocked(true); choosePromotion(p.color, pr => { board.setLocked(false); go(pr); }); }
    else go(isPromo ? "q" : undefined);
  }

  function judge(st, mv, g) {
    board.attach(g, { from: mv.from, to: mv.to });
    if (st.ok(mv, g)) {
      if (st.line && S.li < st.line.length - 1 && !g.in_checkmate()) return advanceLine(st, mv, g);
      board.setLocked(true); clearMarks(); mark([mv.from, mv.to], "good");
      solved(st, typeof st.good === "function" ? L(st.good(mv, g)) : L(st.good));
    } else {
      S.mistakes++; S.sm++; board.setLocked(true); mark([mv.to], "bad"); glow("bad");
      chip("bad", tr("Wrong move", "Неверный ход"));
      const w = st.wrong && st.wrong(mv, g);
      say(w ? L(w) : tr("Not quite — that isn't what I asked for. Look again, or press Hint.", "Пока не то, что я просил. Посмотри ещё раз или нажми «Подсказку»."), "sad");
      later(() => {
        if (S.solved) return;
        clearMarks(); board.attach(game, null); board.clearSelection(); board.render(game); board.setLocked(false);
        if (S.sm >= 2) revealAnswer(st);
      }, 1600);
    }
  }

  /* многоходовая задача: правильный ход принят — соперник отвечает, и игрок продолжает */
  function advanceLine(st, mv, g) {
    let reply = st.line[S.li][1];
    if (st.mateN) { try { reply = chooseAiMove(new Chess(g.fen()), 3, 0); } catch (e) { reply = null; } }
    board.setLocked(true); clearMarks(); mark([mv.from, mv.to], "good");
    game = g; S.li++; S.sm = 0;
    chip("ok", tr("Correct!", "Верно!"));
    say(st.mateN ? tr(`Right! The opponent defends with ${reply}. Keep the mating net tight!`, `Верно! Соперник защищается ходом ${reply}. Держи матовую сеть!`) : tr(`Right! Black is forced to answer ${reply}. Keep going!`, `Верно! Чёрные вынуждены ответить ${reply}. Продолжай!`), "happy");
    later(() => {
      const rm = reply ? game.move(reply) : null;
      if (rm) board.attach(game, { from: rm.from, to: rm.to });
      clearMarks(); chip(null); board.clearSelection(); board.setLocked(false);
      say(tr("Your move again — finish the combination.", "Снова твой ход — доведи комбинацию до конца."), "think");
    }, 900);
  }

  function solved(st, msg) {
    S.solved = true; paintDots(); glow("good");
    chip("ok", tr("Correct!", "Верно!"));
    say(msg || tr("Correct!", "Верно!"), "happy");
    const last = S.k >= S.lsn.steps.length - 1;
    setBtns({ primary: true, label: last ? ico("check2", 17) + tr("Finish", "Завершить") : tr("Next", "Далее") + ico("arrowR", 17), fn: () => { if (last) finishLesson(); else { S.k++; runStep(); } } });
  }

  function finishLesson() {
    const lv = S.lsn.lvl || 1;
    /* на высоких уровнях подсказка засчитывается как ошибка целиком */
    const stars = starsFor(S.mistakes + (lv >= 4 ? S.hints : Math.floor(S.hints / 2)));
    const rw = reward("lessons", S.lsn.id, stars, LV_COINS[lv], LV_XP[lv]), first = rw.first;
    paintDots();
    $("lp-dots").querySelectorAll("i").forEach(x => (x.className = "ok"));
    $("lp-quiz").innerHTML = ""; chip(null);
    $("lp-quiz").innerHTML = resultHtml(stars, `${tr("Mistakes", "Ошибок")}: ${S.mistakes} · ${tr("hints", "подсказок")}: ${S.hints}`, rw);
    playResult($("lp-quiz"), stars, first);
    say(stars === 3 ? tr("Flawless! You're a natural. Ready for the next lesson?", "Безупречно! У тебя талант. Идём на следующий урок?")
      : stars === 2 ? tr("Nice work! A couple of slips — want to replay for 3 stars?", "Хорошая работа! Пара промахов — хочешь пройти ещё раз на 3 звезды?")
      : tr("You made it through! Replay it once more — it'll stick better.", "Ты справился! Пройди ещё раз — так лучше запомнится."), "happy");
    const idx = S.i, nx = nextCell("l", S.lsn.id);
    setBtns(
      nx ? Object.assign({ primary: true }, nx) : Object.assign({ primary: true }, toPath()),
      { label: tr("Replay", "Ещё раз"), fn: () => openLesson(idx) },
      toPath());
  }

  /* ====================================================================
     ДЕБЮТЫ: разбор + практика
     ==================================================================== */
  const norm = s => s.replace(/[+#]/g, "");
  const plyNo = k => (k % 2 === 0 ? `${k / 2 + 1}.` : `${(k - 1) / 2 + 1}...`);
  const noteOf = (op, k) => `${plyNo(k)}${op.moves[k]} — ${L(op.n[k])}`;
  function opFen(op, upto) { const g = new Chess(); for (let k = 0; k < upto; k++) g.move(op.moves[k]); return g; }

  function openOpening(i) {
    stopAll();
    const op = OPENINGS[i];
    O = { i, op, mode: "watch", step: 0, auto: null, color: op.side, P: null, free: false };
    lessonShell(L(op.t), ico("opening", 22), 3);
    $("lp-dots").remove();
    const right = $("lp-right");
    right.insertAdjacentHTML("afterbegin", `<div class="lp-seg" id="op-seg">
      <button data-m="watch">${ico("eye", 18)}${tr("Walkthrough", "Разбор")}</button><button data-m="practice">${ico("target", 18)}${tr("Practice", "Практика")}</button></div>`);
    right.insertAdjacentHTML("beforeend", `<div class="lp-moves" id="op-moves"></div><div class="lp-bar" id="op-bar" hidden><b></b></div>`);
    $("op-seg").querySelectorAll("button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.m)));
    setMode("watch");
  }

  function setMode(m) {
    stopAll(); O.mode = m; O.free = false;
    $("op-seg").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
    chip(null); $("lp-quiz").innerHTML = "";
    if (m === "watch") { O.step = 0; watchRender(); } else practiceMenu();
  }

  /* ---- разбор ---- */
  function chips(upto, clickable) {
    const box = $("op-moves"); box.innerHTML = "";
    O.op.moves.forEach((mv, k) => {
      if (upto != null && k >= upto) return;
      const s = document.createElement("span");
      s.className = "lp-mv" + (k === upto - 1 ? " on" : ""); s.textContent = (k % 2 === 0 ? `${k / 2 + 1}.` : "") + mv;
      if (clickable) s.addEventListener("click", () => { clearAuto(); O.step = k + 1; watchRender(); });
      box.appendChild(s);
    });
  }
  function clearAuto() { if (O.auto) { clearInterval(O.auto); O.auto = null; } }
  function watchRender() {
    const op = O.op, total = op.moves.length, g = opFen(op, O.step);
    mountBoard(g.fen(), "w", () => {}, true);
    board.orientation !== (op.side) && board.setOrientation(op.side);
    board.attach(g, O.step ? (() => { const h = g.history({ verbose: true }).pop(); return { from: h.from, to: h.to }; })() : null);
    chips(O.step, true);
    say(O.step === 0 ? `${L(op.t)}. ${L(op.idea)} ${tr("Press «Next» — I'll explain every move.", "Жми «Далее» — я объясню каждый ход.")}` : noteOf(op, O.step - 1), "idle");
    setBtns(
      { label: ico("left", 18), fn: () => { clearAuto(); if (O.step > 0) { O.step--; watchRender(); } } },
      { primary: true, label: tr("Next", "Далее") + ico("arrowR", 17), fn: () => { clearAuto(); if (O.step < total) { O.step++; watchRender(); } else practiceMenu(true); } },
      { label: O.auto ? ico("pause", 18) : ico("play", 16) + tr("Auto", "Авто"), fn: () => { if (O.auto) { clearAuto(); watchRender(); return; } O.auto = setInterval(() => { if (O.step < total) { O.step++; watchRender(); } else clearAuto(); }, 2600); watchRender(); } },
      { label: tr("Practice", "Практика") + ico("arrowR", 17), fn: () => setMode("practice") });
  }

  /* ---- практика ---- */
  function practiceMenu(fromWatch) {
    stopAll(); O.mode = "practice"; O.free = false;
    $("op-seg").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === "practice"));
    $("op-bar").hidden = true; $("op-moves").innerHTML = "";
    const g = new Chess();
    mountBoard(g.fen(), "w", () => {}, true);
    say(tr(`Now YOU play ${L(O.op.t)}. Choose your side — I'll move for the opponent and check every move you make.`,
           `Теперь ИГРАЕШЬ ТЫ: ${L(O.op.t)}. Выбери сторону — я хожу за соперника и проверяю каждый твой ход.`) +
        (fromWatch ? tr(" Great walkthrough!", " Отличный разбор!") : ""), "idle");
    setBtns(
      { primary: O.op.side === "w", label: ico("wdisc", 16) + tr("Play White", "Играть белыми"), fn: () => practiceStart("w") },
      { primary: O.op.side === "b", label: ico("bdisc", 16) + tr("Play Black", "Играть чёрными"), fn: () => practiceStart("b") });
  }

  function practiceStart(color) {
    stopAll(); const op = O.op;
    O.color = color; O.free = false;
    O.P = { ply: 0, mistakes: 0, sm: 0, busy: false, done: false };
    mountBoard(new Chess().fen(), color, practiceMove, false);
    chips(0, false); $("op-bar").hidden = false; barUpdate();
    chip(null);
    setBtns({ label: ico("bulb", 17) + tr("Hint", "Подсказка"), fn: practiceHint }, { label: ico("redo", 16) + tr("Restart", "Заново"), fn: () => practiceStart(color) });
    if (color === "b") { board.setLocked(true); O.P.busy = true; say(tr("White starts. Watch the first move…", "Начинают белые. Смотри на первый ход…"), "think"); later(oppMove, 900); }
    else say(tr("You're White — make the first move of the opening!", "Ты играешь белыми — сделай первый ход дебюта!"), "idle");
  }
  function barUpdate() { const b = $("op-bar").firstElementChild; if (b) b.style.width = Math.round(O.P.ply / O.op.moves.length * 100) + "%"; chips(O.P.ply, false); }
  function expectedMove() { const g = new Chess(game.fen()); return g.move(O.op.moves[O.P.ply]); }
  function practiceHint() {
    const P = O.P; if (!P || P.done || P.busy || O.free) return;
    const mv = expectedMove(); if (!mv) return;
    P.hint = true; clearMarks();
    mark(P.sm >= 1 ? [mv.from, mv.to] : [mv.from], "hint");
    say(P.sm >= 1 ? tr("Gold squares: the theory move.", "Золотые клетки — ход из теории.")
      : tr(`Think about the idea: ${L(O.op.idea)} The piece to move is highlighted.`, `Вспомни идею: ${L(O.op.idea)} Фигура для хода подсвечена.`), "think");
  }

  function practiceMove(from, to) {
    const P = O.P, op = O.op;
    if (O.free) return freeMove(from, to);
    if (!P || P.busy || P.done) return;
    const p = game.get(from), isPromo = p && p.type === "p" && (to[1] === "8" || to[1] === "1");
    const mv = game.move({ from, to, promotion: isPromo ? "q" : undefined });
    if (!mv) return;
    clearMarks();
    if (norm(mv.san) === norm(op.moves[P.ply])) {
      board.attach(game, { from, to }); mark([from, to], "good"); glow("good"); chip("ok", tr("Book move!", "Ход по теории!"));
      say(noteOf(op, P.ply), "happy"); P.sm = 0; P.ply++; barUpdate();
      P.busy = true; board.setLocked(true);
      if (P.ply >= op.moves.length) return later(finishOpening, 1200);
      later(oppMove, 1700);
    } else {
      P.mistakes++; P.sm++; P.busy = true; board.setLocked(true);
      board.attach(game, { from, to }); mark([to], "bad"); glow("bad"); chip("bad", tr("Not the theory move", "Не по теории"));
      const want = op.moves[P.ply];
      say(tr(`${mv.san} isn't the book move here. In this opening you play ${want}: ${L(op.n[P.ply])}`,
             `${mv.san} — не ход теории. В этом дебюте здесь играют ${want}: ${L(op.n[P.ply])}`), "sad");
      later(() => {
        game.undo(); board.attach(game, null); board.clearSelection(); board.render(game); clearMarks();
        P.busy = false; board.setLocked(false);
        if (P.sm >= 2) practiceHint();
      }, 2600);
    }
  }
  function oppMove() {
    const P = O.P, op = O.op; if (!P) return;
    const mv = game.move(op.moves[P.ply]); if (!mv) return;
    board.attach(game, { from: mv.from, to: mv.to }); chip(null);
    say(tr("Opponent: ", "Соперник: ") + noteOf(op, P.ply), "idle");
    P.ply++; barUpdate();
    if (P.ply >= op.moves.length) return later(finishOpening, 2200);
    P.busy = false; board.setLocked(false);
  }

  function finishOpening() {
    const P = O.P, op = O.op; P.done = true;
    const stars = starsFor(P.mistakes);
    const rw = reward("openings", op.id, stars, 12, 24), first = rw.first;
    $("lp-quiz").innerHTML = resultHtml(stars, `${tr("Mistakes", "Ошибок")}: ${P.mistakes}`, rw);
    playResult($("lp-quiz"), stars, first);
    chip(null);
    say(stars === 3 ? tr("Perfect line! You know it by heart. Want to play on against the computer from here?", "Идеально! Ты знаешь эту линию наизусть. Сыграем дальше против компьютера?")
      : tr("Line complete! Replay it for 3 stars, or play on against the computer.", "Линия пройдена! Повтори на 3 звезды или сыграй дальше против компьютера."), "happy");
    const nx = nextCell("o", op.id);
    setBtns(
      { primary: true, label: tr("Play on vs computer", "Играть дальше с компьютером"), fn: freePlay },
      { label: tr("Replay", "Ещё раз"), fn: () => { $("lp-quiz").innerHTML = ""; practiceStart(O.color); } },
      nx || toPath());
  }

  /* продолжение партии против компьютера из позиции дебюта */
  function freePlay() {
    O.free = true; $("lp-quiz").innerHTML = ""; chip(null); clearMarks();
    board.setLocked(false);
    say(tr("The theory is over — now it's a real game. Good luck!", "Теория закончилась — дальше настоящая партия. Удачи!"), "idle");
    setBtns({ label: ico("left", 17) + tr("Path", "К пути"), fn: renderHome });
    if (game.turn() !== O.color) aiReply();
  }
  function freeMove(from, to) {
    const p = game.get(from), isPromo = p && p.type === "p" && (to[1] === "8" || to[1] === "1");
    const mv = game.move({ from, to, promotion: isPromo ? "q" : undefined }); if (!mv) return;
    board.attach(game, { from, to }); clearMarks();
    if (game.game_over()) return freeEnd();
    aiReply();
  }
  function aiReply() {
    board.setLocked(true); say(tr("Computer is thinking…", "Компьютер думает…"), "think");
    later(() => {
      const san = chooseAiMove(game, 2, 0.1);
      if (san) { const m = game.move(san); board.attach(game, { from: m.from, to: m.to }); }
      board.setLocked(false);
      if (game.game_over()) freeEnd(); else say(tr("Your move.", "Твой ход."), "idle");
    }, 600);
  }
  function freeEnd() {
    board.setLocked(true);
    const win = game.in_checkmate() && game.turn() !== O.color;
    say(game.in_checkmate() ? (win ? tr("Checkmate — you win!!", "Мат — ты победил!!") : tr("Checkmate — you lost this one. Try again!", "Мат — в этот раз проиграл. Попробуй ещё!")) : tr("Draw.", "Ничья."), win ? "happy" : "sad");
  }

  /* публичный API для js/trainer.js (тренажёр использует тот же каркас, голос и награды) */
  window.MaperLsn = {
    shell: lessonShell, setBtns, mount: mountBoard, mark, clearMarks, glow, chip, later, stopAll, home: renderHome,
    resultHtml, playResult, ico, tr, L, lang, Voice, LESSONS, sfx, starsRow, STAR_SVG, B, $,
    get board() { return board; }, get game() { return game; }, set game(v) { game = v; }, get say() { return say; }
  };

  /* ---------- вкладки + интеграция ---------- */
  const _sv = UI.showView;
  UI.showView = function (n) { _sv.call(this, n); if (n === "lessons") { greet = true; renderHome(); } else stopAll(); };
  const _tr = UI.translate;
  UI.translate = function () { _tr.call(this); if ($("view-lessons").classList.contains("active") && !$("lsn-home").hidden) renderHome(); };
})();