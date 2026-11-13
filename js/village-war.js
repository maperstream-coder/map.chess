/* maper.chess — Войско и Походы.
   Игрок обучает фигуры (пешки, кони, слоны, ладьи, ферзи), отправляет их на разбойничьи лагеря и на деревни других игроков,
   а когда его самого грабят — получает хронику и может посмотреть бой. Сервера-судьи нет: бой детерминирован (village-sim.js),
   защитник сам пересчитывает его по сиду и применяет только то, что вышло у него, а правила Firestore ограничивают добычу и частоту.
   Коллекции: villages/{uid} (витрина деревни), users/{uid}/raidsIn/{id} (набеги на меня), raidLocks/{uid} (щит защитника),
   raidPairs/{a_d} (кулдаун пары). Подробно — в firestore.rules. */
(function () {
  "use strict";
  if (!window.Village || !window.VSIM) return;
  const A = Village.api, S = VSIM, UT = S.UT, U = S.UNITS, $ = id => document.getElementById(id);
  const esc = A.esc, toast = A.toast, sfx = A.sfx;
  const SHIELD_MS = 3 * 3600e3, PAIR_MS = 12 * 3600e3, MAX_SEND = 60, LOOT_MAX = 800;

  /* ---------- тексты ---------- */
  const add = (en, ru) => { Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  add({
    "vw.u.pawn": "Pawn", "vw.u.knight": "Knight", "vw.u.bishop": "Bishop", "vw.u.rook": "Rook", "vw.u.queen": "Queen",
    "vw.u.pawn.d": "Cheap and many. Falls first.", "vw.u.knight.d": "Leaps over the garrison, hits hard.", "vw.u.bishop.d": "Fires over the heads of defenders.",
    "vw.u.rook.d": "Slow, sturdy, breaks gates.", "vw.u.queen.d": "One queen is a small army.",
    "vw.army.title": "Army", "vw.army.pop": "Housing {a} / {b}", "vw.army.atk": "Attack {n}", "vw.army.def": "Defense {n}", "vw.army.home": "At home", "vw.army.train": "Train", "vw.army.need": "Needs: {name}",
    "vw.army.x1": "+1 · {n}", "vw.army.x5": "+5 · {n}", "vw.army.full": "No room — upgrade the Town Hall or Pawn cottages", "vw.army.queue": "In training", "vw.army.out": "On the march",
    "vw.army.speed": "Speed up · {n}", "vw.army.back": "returns in {t}", "vw.army.trained": "{name} ×{n} reported for duty", "vw.army.poor": "Not enough coins", "vw.army.garrison": "The garrison defends the village while at home.",
    "vw.army.stat": "ATK {a} · HP {h}", "vw.army.lvl": "building bonus +{n}%", "vw.army.empty": "No soldiers yet. Train pawns first.",
    "vw.war.title": "Raids", "vw.war.rep": "Renown", "vw.war.stats": "Raids {a} · Defended {b} · Loot {c}", "vw.war.camps": "Bandit camps", "vw.war.campsSub": "New camps every day. One strike per camp.",
    "vw.war.players": "Villages near your strength", "vw.war.search": "Find a rival by nickname", "vw.war.go": "Search", "vw.war.friends": "Friends", "vw.war.refresh": "Look again",
    "vw.war.empty": "Nobody is around yet. The camps are always open.", "vw.war.loading": "Scouting…", "vw.war.off": "Sign in to raid other players", "vw.war.err": "Could not load targets ({code})",
    "vw.war.nofound": "No such village", "vw.war.chron": "Chronicle", "vw.war.chronEmpty": "No one has raided you yet.", "vw.war.attack": "Attack", "vw.war.power": "Power {n}",
    "vw.war.loot": "Loot up to {n}", "vw.war.done": "Struck today", "vw.war.camp": "Camp", "vw.war.replay": "Watch", "vw.war.revenge": "Revenge", "vw.war.you": "Your village",
    "vw.war.lost": "Raided by {nick}: −{n} coins", "vw.war.held": "{nick} attacked and was repelled!", "vw.war.heldN": "Repelled {nick}", "vw.war.rob": "{nick} took {n}", "vw.war.stars": "{n}★",
    "vw.t.empty": "Nothing to take", "vw.sig.free": "Open to raids", "vw.sig.shield": "Protected for {t}", "vw.sig.pair": "You raided them recently ({t})",
    "vw.atk.title": "Prepare the raid", "vw.atk.squad": "Squad", "vw.atk.send": "Send {n}", "vw.atk.noArmy": "No soldiers at home", "vw.atk.pick": "Choose at least one soldier", "vw.atk.chance": "Chances", "vw.atk.chanceLine": "Gate: {a}% · Full break: {b}% · Clean sweep: {c}%",
    "vw.atk.exp": "Expected loot ≈ {n}", "vw.atk.pow": "Attack {a} against defense {b}", "vw.atk.rev": "Revenge: +15% attack", "vw.atk.decor": "Decor: +{n}% attack", "vw.atk.go": "Attack!", "vw.atk.gone": "Raid failed ({code})",
    "vw.atk.sending": "The squad marches…", "vw.atk.stale": "The target changed or is protected. Look around again.", "vw.atk.garrison": "Defenders: {n}", "vw.atk.wall": "Gate {n}", "vw.atk.tower": "Tower fire {n}",
    "vw.b.title": "Battle", "vw.b.round": "Round {n}", "vw.b.breach": "The gate falls!", "vw.b.held": "The gate holds", "vw.b.res0": "Repelled", "vw.b.res1": "Gate damaged", "vw.b.res2": "Gate broken", "vw.b.res3": "Complete rout",
    "vw.b.loot": "Loot: {n}", "vw.b.lost": "Losses: {n}", "vw.b.rep": "Renown {n}", "vw.b.skip": "Skip", "vw.b.close": "Close", "vw.b.mine": "Defending your village",
    "vw.n.raided": "Your village was raided", "vw.n.raidedT": "{nick}: −{n} coins"
  }, {
    "vw.u.pawn": "Пешка", "vw.u.knight": "Конь", "vw.u.bishop": "Слон", "vw.u.rook": "Ладья", "vw.u.queen": "Ферзь",
    "vw.u.pawn.d": "Дёшевы и многочисленны. Падают первыми.", "vw.u.knight.d": "Перепрыгивает гарнизон, бьёт сильно.", "vw.u.bishop.d": "Стреляет поверх голов защитников.",
    "vw.u.rook.d": "Медленная, прочная, ломает ворота.", "vw.u.queen.d": "Один ферзь — маленькая армия.",
    "vw.army.title": "Войско", "vw.army.pop": "Места {a} / {b}", "vw.army.atk": "Атака {n}", "vw.army.def": "Оборона {n}", "vw.army.home": "Дома", "vw.army.train": "Обучение", "vw.army.need": "Нужно: {name}",
    "vw.army.x1": "+1 · {n}", "vw.army.x5": "+5 · {n}", "vw.army.full": "Нет мест — улучшите ратушу или домики пешек", "vw.army.queue": "Обучаются", "vw.army.out": "В походе",
    "vw.army.speed": "Ускорить · {n}", "vw.army.back": "вернутся через {t}", "vw.army.trained": "{name} ×{n} — построены", "vw.army.poor": "Не хватает монет", "vw.army.garrison": "Пока солдаты дома, они защищают деревню.",
    "vw.army.stat": "АТК {a} · ЗДР {h}", "vw.army.lvl": "бонус здания +{n}%", "vw.army.empty": "Солдат пока нет. Начните с пешек.",
    "vw.war.title": "Походы", "vw.war.rep": "Слава", "vw.war.stats": "Набегов {a} · Отбито {b} · Добыча {c}", "vw.war.camps": "Разбойничьи лагеря", "vw.war.campsSub": "Каждый день новые. По лагерю — один удар.",
    "vw.war.players": "Деревни вашей силы", "vw.war.search": "Найти соперника по нику", "vw.war.go": "Найти", "vw.war.friends": "Друзья", "vw.war.refresh": "Осмотреться снова",
    "vw.war.empty": "Рядом пока никого. Лагеря всегда открыты.", "vw.war.loading": "Разведка…", "vw.war.off": "Войдите, чтобы нападать на игроков", "vw.war.err": "Не удалось загрузить цели ({code})",
    "vw.war.nofound": "Такой деревни нет", "vw.war.chron": "Хроника", "vw.war.chronEmpty": "На вас пока не нападали.", "vw.war.attack": "В бой", "vw.war.power": "Сила {n}",
    "vw.war.loot": "Добыча до {n}", "vw.war.done": "Уже штурмовали", "vw.war.camp": "Лагерь", "vw.war.replay": "Смотреть", "vw.war.revenge": "Месть", "vw.war.you": "Ваша деревня",
    "vw.war.lost": "Вас ограбил {nick}: −{n} монет", "vw.war.held": "{nick} напал, но был отбит!", "vw.war.heldN": "Отбит {nick}", "vw.war.rob": "{nick} унёс {n}", "vw.war.stars": "{n}★",
    "vw.t.empty": "Нечего брать", "vw.sig.free": "Открыта для набегов", "vw.sig.shield": "Под защитой ещё {t}", "vw.sig.pair": "Вы недавно её грабили ({t})",
    "vw.atk.title": "Подготовка набега", "vw.atk.squad": "Отряд", "vw.atk.send": "Отправить: {n}", "vw.atk.noArmy": "Дома нет солдат", "vw.atk.pick": "Выберите хотя бы одного солдата", "vw.atk.chance": "Шансы", "vw.atk.chanceLine": "Ворота: {a}% · Прорыв: {b}% · Разгром: {c}%",
    "vw.atk.exp": "Ожидаемая добыча ≈ {n}", "vw.atk.pow": "Атака {a} против обороны {b}", "vw.atk.rev": "Месть: +15% к атаке", "vw.atk.decor": "Декор: +{n}% к атаке", "vw.atk.go": "В атаку!", "vw.atk.gone": "Набег не удался ({code})",
    "vw.atk.sending": "Отряд выступает…", "vw.atk.stale": "Цель изменилась или под защитой. Осмотритесь снова.", "vw.atk.garrison": "Защитников: {n}", "vw.atk.wall": "Ворота {n}", "vw.atk.tower": "Огонь башен {n}",
    "vw.b.title": "Бой", "vw.b.round": "Раунд {n}", "vw.b.breach": "Ворота пали!", "vw.b.held": "Ворота выстояли", "vw.b.res0": "Отбиты", "vw.b.res1": "Ворота повреждены", "vw.b.res2": "Ворота разбиты", "vw.b.res3": "Полный разгром",
    "vw.b.loot": "Добыча: {n}", "vw.b.lost": "Потери: {n}", "vw.b.rep": "Слава {n}", "vw.b.skip": "Пропустить", "vw.b.close": "Закрыть", "vw.b.mine": "Оборона вашей деревни",
    "vw.n.raided": "Вашу деревню ограбили", "vw.n.raidedT": "{nick}: −{n} монет"
  });

  /* ---------- состояние войска ---------- */
  const v0 = () => A.st();
  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function armyTick() {
    const v = v0(); if (!v.founded) return false;
    const now = Date.now(); let ch = false; const a = v.army;
    a.q = a.q.filter(x => { if (x.end <= now) { a.u[x.t] = Math.min(999, a.u[x.t] + x.n); ch = true; return false; } return true; });
    a.out = a.out.filter(x => { if (x.back <= now) { UT.forEach(k => { a.u[k] = Math.min(999, a.u[k] + (x.u[k] || 0)); }); ch = true; return false; } return true; });
    if (ch) A.persist();
    return ch;
  }
  const trainMs = (v, k, n) => Math.round(U[k].sec * (1 + (n - 1) * 0.6) * 1000 * Math.max(0.5, 1 - 0.06 * A.lv("academy", v)));
  const muls = v => S.unitMuls(v);
  function atkPct(v, rev) { return Math.min(45, S.decorSum(v, "atk") + (rev ? 15 : 0)); }
  function train(k, n) {
    const v = v0(), u = U[k]; if (!u || A.lv(u.need, v) < 1) return;
    armyTick();
    if (v.army.q.length >= 6) return;
    if (S.popAll(v) + u.pop * n > S.housing(v)) { toast("vw.army.full"); return; }
    const cost = u.cost * n; if (UI.state.coins < cost) { toast("vw.army.poor"); return; }
    UI.state.coins -= cost; v.army.q.push({ t: k, n, end: Date.now() + trainMs(v, k, n) }); A.cum("train", n); sfx("coin"); A.persist(); A.renderSide();
  }
  function speedUp(i) {
    const v = v0(), q = v.army.q[i]; if (!q) return;
    const cost = Math.max(1, Math.ceil((q.end - Date.now()) / 60000)) * 2;
    if (UI.state.coins < cost) { toast("vw.army.poor"); return; }
    UI.state.coins -= cost; q.end = Date.now(); armyTick(); sfx("win"); A.persist(); A.renderSide();
    toast("vw.army.trained", { name: t("vw.u." + q.t), n: q.n });
  }

  /* ---------- витрина деревни в Firestore ---------- */
  const db = () => (typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user && Cloud._ready !== false) ? Cloud._db : null;
  const me = () => (typeof Cloud !== "undefined" && Cloud.user) ? Cloud.user.uid : null;
  const FV = () => firebase.firestore.FieldValue;
  function defSnap(v) { return S.defSnapshot(v, A.treNow(v)); }
  function showcase() {
    const v = v0(); if (!v.founded) return null;
    const d = defSnap(v), home = {}; UT.forEach(k => { home[k] = v.army.u[k]; });
    const tr = d.tr; const body = { wall: d.wall, dps: d.dps, g: d.g, gm: d.gm, safe: d.safe };
    return {
      nick: String(UI.state.nick || "").slice(0, 24), name: String(v.name || "").slice(0, 20), p: Math.round(A.prosperity(v)), rep: v.war.rep, tr,
      dp: S.defPower(d), apow: S.atkPower(home, muls(v), atkPct(v)), u: home, d: body, vil: A.pack(UI.state) || "", lang: UI.state.lang || "ru"
    };
  }
  let lastSig = "", lastPub = 0, pubTimer = null;
  async function publish(force) {
    const d = db(); if (!d) return; const body = showcase(); if (!body) return;
    const sig = JSON.stringify([body.nick, body.name, body.p, body.rep, Math.round(body.tr / 10), body.def, body.u, body.vil]);
    if (!force && sig === lastSig && Date.now() - lastPub < 5 * 60e3) return;
    body.at = FV().serverTimestamp();
    try { await d.collection("villages").doc(me()).set(body); lastSig = sig; lastPub = Date.now(); }
    catch (e) { console.warn("villages publish", e.code || e); }
  }
  function queuePublish() { clearTimeout(pubTimer); pubTimer = setTimeout(() => publish(false), 4000); }
  const _save = window.saveState;
  window.saveState = function (s) { _save(s); try { if (s && s.village && s.village.founded) queuePublish(); } catch (e) { } };

  /* ---------- цели ---------- */
  const hintOf = x => x;
  function npcTargets() {
    const v = v0(), day = A.today(), n = A.prosperity(v);
    const camps = S.npcCamps(n, S.hashStr(day + "|" + (UI.state.nick || v.name)));
    return camps.map(c => ({ kind: "npc", id: c.id, name: I18N_pick(c.name), nick: "", snap: c.d, power: c.power, vdata: c.v, done: !!v.war.last["npc:" + day + ":" + c.id], tier: c.tier }));
  }
  const I18N_pick = pair => (typeof getLang === "function" && getLang() === "ru") ? pair[0] : pair[1];
  function fromDoc(id, x) {
    const dd = x.d || {}; const snap = { wall: +dd.wall || 0, dps: +dd.dps || 0, g: dd.g || {}, gm: dd.gm || {}, safe: +dd.safe || 0, tr: Math.max(0, +x.tr || 0) };
    return { kind: "pl", id, uid: id, name: x.name || "", nick: x.nick || "", snap, power: +x.dp || S.defPower(snap), vil: x.vil, rep: +x.rep || 0, p: +x.p || 0 };
  }
  let near = { at: 0, list: null, err: null, loading: false, friends: null };
  async function loadNear(force) {
    const d = db(); if (!d) { near.list = []; return; }
    if (near.loading || (!force && near.list && Date.now() - near.at < 60e3)) return;
    near.loading = true; near.err = null;
    try {
      const v = v0(), p = Math.max(1, A.prosperity(v)), lo = Math.max(0, Math.floor(p * 0.5) - 2), hi = Math.ceil(p * 1.8) + 4;
      const snap = await d.collection("villages").where("p", ">=", lo).where("p", "<=", hi).limit(30).get();
      const list = []; snap.forEach(x => { if (x.id !== me()) list.push(fromDoc(x.id, x.data())); });
      list.sort((a, b) => Math.abs(a.p - p) - Math.abs(b.p - p));
      near.list = list.slice(0, 12); near.at = Date.now();
      const fr = await d.collection("users").doc(me()).collection("friends").get();
      const fl = []; await Promise.all(fr.docs.slice(0, 12).map(async f => { try { const s = await d.collection("villages").doc(f.id).get(); if (s.exists) fl.push(fromDoc(f.id, s.data())); } catch (e) { } }));
      near.friends = fl;
    } catch (e) { near.err = e.code || String(e); near.list = near.list || []; }
    near.loading = false; if (A.root() && A.root().classList.contains("active")) A.renderSide();
  }
  async function findByNick(nick) {
    const d = db(); if (!d) return null; const key = Nick.normKey(nick);
    const q = await d.collection("leaderboard").where("nickLower", "==", key).limit(1).get(); const doc = q.docs[0]; if (!doc || doc.id === me()) return null;
    const s = await d.collection("villages").doc(doc.id).get(); return s.exists ? fromDoc(doc.id, s.data()) : null;
  }
  /* щит защитника и кулдаун пары — читаем документы-замки, которые пишут сами набеги */
  async function locksFor(uid) {
    const d = db(); const out = { shield: 0, pair: 0 }; if (!d) return out;
    try { const a = await d.collection("raidLocks").doc(uid).get(); if (a.exists && a.data().last) out.shield = a.data().last.toMillis() + SHIELD_MS; } catch (e) { }
    try { const b = await d.collection("raidPairs").doc(me() + "_" + uid).get(); if (b.exists && b.data().last) out.pair = b.data().last.toMillis() + PAIR_MS; } catch (e) { }
    return out;
  }

  /* ---------- отправка набега ---------- */
  const rnd32 = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] || 1; } catch (e) { return (Math.random() * 4294967295) >>> 0 || 1; } };
  function applyAttackerResult(v, target, squad, res, rev) {
    const a = v.army, now = Date.now();
    UT.forEach(k => { a.u[k] = Math.max(0, a.u[k] - (squad[k] || 0)); });
    const surv = res.survivors, tot = UT.reduce((n, k) => n + (surv[k] || 0), 0);
    if (tot > 0) a.out.push({ back: now + S.MARCH_MS, u: Object.assign({}, surv) });
    UI.state.coins += res.loot; UI.state.xp = (UI.state.xp || 0) + res.stars * 10;
    const rp = S.repFor(res.stars); v.war.rep = Math.max(0, v.war.rep + rp); v.war.raids++; if (res.stars >= 2) v.war.wins++; v.war.loot += res.loot;
    v.war.log.push({ t: now, uid: target.uid || target.id, nick: target.kind === "npc" ? target.name : target.nick, stars: res.stars, loot: res.loot, rep: rp }); v.war.log = v.war.log.slice(-20);
    if (target.kind === "pl") { v.war.last[target.uid] = now; Object.keys(v.war.last).slice(0, Math.max(0, Object.keys(v.war.last).length - 60)).forEach(k => delete v.war.last[k]); }
    if (target.kind === "npc") v.war.last["npc:" + A.today() + ":" + target.id] = now;
    A.persist();
    return rp;
  }
  async function launch(target, squad) {
    const v = v0(); armyTick();
    UT.forEach(k => { squad[k] = Math.min(squad[k] || 0, v.army.u[k]); });
    const total = UT.reduce((n, k) => n + squad[k], 0); if (total < 1) { toast("vw.atk.pick"); return null; }
    const rev = !!(target.kind === "pl" && v.war.rev[target.uid] && Date.now() - v.war.rev[target.uid] < 24 * 3600e3);
    const A1 = { u: squad, m: muls(v), pct: atkPct(v, rev) }, seed = rnd32();
    const res = S.simulate(A1, target.snap, seed);
    if (target.kind === "pl") {
      const d = db(); if (!d) { toast("vw.war.off"); return null; }
      const rid = d.collection("users").doc(target.uid).collection("raidsIn").doc().id, ts = FV().serverTimestamp();
      const sq = {}, lost = {}, dk = {}; UT.forEach(k => { sq[k] = squad[k] || 0; lost[k] = res.lost[k] || 0; dk[k] = res.dk[k] || 0; });
      const doc = { a: me(), an: String(UI.state.nick || "").slice(0, 24), vn: String(target.name || "").slice(0, 20), seed, au: sq, am: A1.m, ap: A1.pct, rev,
        snap: { wall: target.snap.wall, dps: target.snap.dps, g: target.snap.g, gm: target.snap.gm, safe: target.snap.safe, tr: target.snap.tr },
        stars: res.stars, loot: res.loot, lost, dk, at: ts };
      await publish(true);                                   // правила сверяют отряд с опубликованным — отправим свежие данные
      const b = d.batch();
      b.set(d.collection("users").doc(target.uid).collection("raidsIn").doc(rid), doc);
      b.set(d.collection("raidLocks").doc(target.uid), { last: ts, by: me(), rid });
      b.set(d.collection("raidPairs").doc(me() + "_" + target.uid), { last: ts, rid, a: me(), d: target.uid });
      try { await b.commit(); } catch (e) { if (e.code === "permission-denied") { toast("vw.atk.stale"); near.at = 0; } else toast("vw.atk.gone", { code: e.code || "?" }); return { error: e.code || "err" }; }
      delete v.war.rev[target.uid];
    }
    const rp = applyAttackerResult(v, target, squad, res, rev);
    sfx(res.stars >= 2 ? "win" : "err");
    publish(true);
    return { res, rev, rep: rp, A: A1, seed };
  }

  /* ---------- приём набегов на меня ---------- */
  let inbox = { list: [], unsub: null, uid: null, first: true };
  function settleRaid(id, r) {
    const v = v0(); if (!v.founded || v.war.seen[id]) return null;
    /* защитник сам пересчитывает бой — верит только своему результату, а не заявленному */
    let res; try { res = S.simulate({ u: r.au || {}, m: r.am || {}, pct: Math.min(60, +r.ap || 0) }, r.snap, +r.seed || 1); } catch (e) { return null; }
    A.treNow(v);
    const take = Math.min(Math.floor(v.treasury.amt), res.loot, +r.loot || 0);
    v.treasury.amt -= take; v.war.lost += take;
    UT.forEach(k => { const n = Math.ceil((res.dk[k] || 0) * 0.5); v.army.u[k] = Math.max(0, v.army.u[k] - n); });
    const rp = S.repLossDef(res.stars); v.war.rep = Math.max(0, v.war.rep + rp);
    if (res.stars === 0) v.war.defended++;
    v.war.seen[id] = Date.now(); v.war.rev[r.a] = Date.now();
    const keys = Object.keys(v.war.seen); if (keys.length > 70) keys.sort((x, y) => v.war.seen[x] - v.war.seen[y]).slice(0, keys.length - 70).forEach(k => delete v.war.seen[k]);
    A.persist(); return { res, take };
  }
  function listenRaids() {
    const d = db(), uid = me(); if (!d || !uid || inbox.uid === uid) return;
    if (inbox.unsub) { try { inbox.unsub(); } catch (e) { } }
    inbox = { list: [], unsub: null, uid, first: true };
    inbox.unsub = d.collection("users").doc(uid).collection("raidsIn").orderBy("at", "desc").limit(20).onSnapshot(snap => {
      const fresh = [];
      inbox.list = snap.docs.map(x => ({ id: x.id, ...x.data() }));
      inbox.list.forEach(r => { if (!A.st().war.seen[r.id] && r.at) fresh.push(r); });
      fresh.reverse().forEach(r => {
        const out = settleRaid(r.id, r); if (!out) return;
        if (out.res.stars === 0) toast("vw.war.held", { nick: r.an || "?" });
        else { toast("vw.war.lost", { nick: r.an || "?", n: out.take }); sfx("err"); }
        if (typeof Notify !== "undefined" && Notify.push) { try { Notify.push({ id: "raid:" + r.id, icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 18L19 5M18 18L5 5"/><path d="M4 15.5l4.5 4.5M20 15.5L15.5 20"/><path d="M5 5h4M19 5h-4"/></svg>', title: t("vw.n.raided"), text: t("vw.n.raidedT", { nick: r.an || "?", n: out.take }), onTap: () => A.openTab("war") }); } catch (e) { } }
      });
      if (fresh.length) { publish(true); if (A.root() && A.root().classList.contains("active")) A.renderSide(); }
      else if (A.root() && A.root().classList.contains("active") && A.getTab && A.getTab() === "war") A.renderSide();
    }, e => console.warn("raidsIn", e.code || e));
  }
  setInterval(() => { try { const u = me(); if (u && u !== inbox.uid) listenRaids(); if (!u && inbox.uid) { if (inbox.unsub) inbox.unsub(); inbox = { list: [], unsub: null, uid: null, first: true }; } if (UI.state && v0().founded) { if (armyTick() && A.root() && A.root().classList.contains("active")) A.renderSide(); } } catch (e) { } }, 2000);

  window.VillageWarCore = { A, S, armyTick, train, speedUp, trainMs, muls, atkPct, launch, loadNear, findByNick, locksFor, npcTargets, publish, defSnap, fromDoc, get near() { return near; }, get inbox() { return inbox; }, fmtT, SHIELD_MS, PAIR_MS, db, me, queuePublish, showcase };
})();
