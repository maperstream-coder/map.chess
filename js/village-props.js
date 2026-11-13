/* maper.chess — декор деревни: каталог предметов (редкость, бонусы) и их 3D-модели.
   Модели рисуются движком village-3d.js (VL3.registerProp). Каталог используют:
   • village-decor.js — склад, расстановка, базар;
      • village-war.js — бонусы к обороне/атаке.
   Бонусы (perk): inc — % к приросту казны, def — очки обороны, atk — % к силе отряда,
   cap — места в войске, safe — % защиты казны от грабежа. */
(function () {
  "use strict";
  const VL = window.VL3;
  if (!VL || !VL.registerProp) return;
  const H = VL.PROP_HELP, K = H.K, mixc = H.mixc, hex = H.hex;

  /* ---------- каталог ---------- */
  /* rar: 0 обычный, 1 необычный, 2 редкий, 3 эпический, 4 легендарный; shop — цена на базаре */
  const LIST = [
    { id: "dc-bush",    rar: 0, perk: ["inc", 1],  shop: 40,  kind: "dc-bush" },
    { id: "dc-oak",     rar: 0, perk: ["inc", 1],  shop: 45,  kind: "dc-oak" },
    { id: "dc-pine",    rar: 0, perk: ["def", 2],  shop: 40,  kind: "dc-pine" },
    { id: "dc-hay",     rar: 0, perk: ["inc", 1],  shop: 40,  kind: "dc-hay" },
    { id: "dc-bench",   rar: 0, perk: ["cap", 1],  shop: 50,  kind: "dc-bench" },
    { id: "dc-flowers", rar: 0, perk: ["inc", 1],  shop: 35,  kind: "flowers" },
    { id: "dc-lantern", rar: 0, perk: ["def", 2],  shop: 40,  kind: "lanterns" },
    { id: "dc-well",    rar: 1, perk: ["inc", 2],  shop: 95,  kind: "dc-well" },
    { id: "dc-cart",    rar: 1, perk: ["safe", 3], shop: 100, kind: "dc-cart" },
    { id: "dc-tent",    rar: 1, perk: ["cap", 2],  shop: 110, kind: "dc-tent" },
    { id: "dc-pond",    rar: 1, perk: ["inc", 2],  shop: 95,  kind: "dc-pond" },
    { id: "dc-brazier", rar: 1, perk: ["def", 4],  shop: 100, kind: "dc-brazier" },
    { id: "dc-fountain", rar: 2, perk: ["inc", 3], shop: 230, kind: "fountain" },
    { id: "dc-statue",  rar: 2, perk: ["atk", 3],  shop: 240, kind: "statue" },
    { id: "dc-sakura",  rar: 2, perk: ["inc", 3],  shop: 260,   kind: "dc-sakura" },
    { id: "dc-obelisk", rar: 2, perk: ["atk", 3],  shop: 270,   kind: "dc-obelisk" },
    { id: "dc-gazebo",  rar: 2, perk: ["cap", 3],  shop: 250, kind: "dc-gazebo" },
    { id: "dc-ballista", rar: 2, perk: ["def", 8], shop: 260, kind: "dc-ballista" },
    { id: "dc-fair",    rar: 3, perk: ["inc", 4],  shop: 520, kind: "fair" },
    { id: "dc-windmill", rar: 3, perk: ["inc", 5], shop: 560, kind: "windmill" },
    { id: "dc-crystal", rar: 3, perk: ["inc", 5],  shop: 600,   kind: "dc-crystal" },
    { id: "dc-qstatue", rar: 3, perk: ["atk", 5],  shop: 620,   kind: "dc-qstatue" },
    { id: "dc-goldtree", rar: 3, perk: ["safe", 6], shop: 640,  kind: "dc-goldtree" },
    { id: "dc-dragon",  rar: 4, perk: ["def", 15], shop: 1500,  kind: "dc-dragon" },
    { id: "dc-throne",  rar: 4, perk: ["inc", 10], shop: 1800,  kind: "dc-throne" }
  ];
  const BY_ID = {}; LIST.forEach(d => { BY_ID[d.id] = d; });
  const CAPS = { inc: 40, atk: 30, safe: 40 };      // потолки суммарных бонусов (в %)
  const RAR_PRICE_SELL = [10, 25, 60, 140, 400];     // обмен лишнего декора на монеты (дубликаты)

  /* ---------- модели ---------- */
  const P = (id, fn) => VL.registerProp(id, fn);
  const leafG = hex("#3f8a55");

  P("dc-bush", M => {
    M.tree(0.32, 0.34, 1.9, "bush");
    M.tree(0.68, 0.58, 2.3, "bush", { c: K.leaf3 });
    M.tree(0.3, 0.74, 1.5, "bush", { c: K.leaf2 });
  });
  P("dc-oak", M => { M.box(0.08, 0.08, 0, 0.84, 0.84, 0.02, K.grass, { bias: -100 }); M.tree(0.5, 0.5, 2.7, "oak"); });
  P("dc-pine", M => { M.box(0.08, 0.08, 0, 0.84, 0.84, 0.02, K.grass, { bias: -100 }); M.tree(0.5, 0.5, 2.5, "pine"); M.tree(0.22, 0.74, 1.1, "pine"); });
  P("dc-hay", M => {
    M.cyl(0.46, 0.5, 0, 0.27, 0.2, K.hay, { n: 10, noTop: true });
    M.dome(0.46, 0.5, 0.2, 0.27, mixc(K.hay, K.woodL, 0.2), { n: 10, rings: 4, squash: 0.85 });
    M.box(0.66, 0.1, 0, 0.26, 0.22, 0.17, mixc(K.hay, K.white, 0.1), { top: K.hay });
    M.box(0.12, 0.76, 0, 0.26, 0.2, 0.15, K.hay, { top: mixc(K.hay, K.white, 0.15) });
  });
  P("dc-bench", M => {
    M.box(0.1, 0.4, 0.12, 0.8, 0.22, 0.045, K.woodL);
    M.box(0.1, 0.58, 0.17, 0.8, 0.035, 0.17, K.wood);
    [0.16, 0.76].forEach(x => { M.box(x, 0.42, 0, 0.07, 0.04, 0.12, K.woodD); M.box(x, 0.56, 0, 0.07, 0.04, 0.12, K.woodD); });
    M.tree(0.14, 0.14, 0.9, "bush");
  });
  P("dc-well", M => {
    M.cyl(0.5, 0.5, 0, 0.27, 0.2, K.stone, { n: 12, top: K.stoneD });
    const w = M.cyl(0.5, 0.5, 0.19, 0.2, 0.012, K.water, { n: 12 }); w.water = true;
    [[0.26, 0.5], [0.74, 0.5]].forEach(([x, y]) => M.box(x - 0.03, y - 0.03, 0.2, 0.06, 0.06, 0.34, K.woodD));
    M.gable(0.2, 0.42, 0.52, 0.6, 0.16, 0.15, K.roofR, { axis: "x", gc: K.plaster });
    M.box(0.42, 0.485, 0.42, 0.16, 0.03, 0.03, K.woodL);
  });
  P("dc-cart", M => {
    M.box(0.14, 0.3, 0.12, 0.66, 0.4, 0.07, K.wood, { top: K.woodL });
    M.box(0.14, 0.3, 0.19, 0.66, 0.03, 0.1, K.woodD); M.box(0.14, 0.67, 0.19, 0.66, 0.03, 0.1, K.woodD);
    M.dome(0.47, 0.5, 0.19, 0.22, K.hay, { n: 8, rings: 3, squash: 0.6 });
    [[0.26, 0.26], [0.26, 0.7], [0.68, 0.26], [0.68, 0.7]].forEach(([x, y]) => M.box(x - 0.02, y - 0.015, 0.01, 0.04, 0.03, 0.2, K.woodD));
    M.box(0.8, 0.46, 0.14, 0.14, 0.04, 0.03, K.woodD);
    M.box(0.2, 0.18, 0, 0.22, 0.12, 0.08, K.red, { top: mixc(K.red, K.white, 0.2) });
  });
  P("dc-tent", M => {
    M.cone(0.5, 0.5, 0, 0.42, 0.55, K.white, { n: 6, rot: 0.2 });
    M.cone(0.5, 0.5, 0.0, 0.43, 0.55, K.red, { n: 3, rot: 0.2 });
    M.box(0.44, 0.88, 0, 0.12, 0.02, 0.22, K.dark);
    M.flag(0.5, 0.5, 0.52, 0.22, K.gold, { w: 0.15, fh: 0.09 });
    M.cyl(0.2, 0.86, 0, 0.012, 0.18, K.woodD, { n: 4 }); M.cyl(0.8, 0.86, 0, 0.012, 0.18, K.woodD, { n: 4 });
  });
  P("dc-pond", M => {
    M.box(0.04, 0.04, 0, 0.92, 0.92, 0.02, K.grass, { bias: -100 });
    const w = M.cyl(0.5, 0.5, 0.02, 0.36, 0.012, K.water, { n: 14, top: K.waterL }); w.water = true;
    M.cyl(0.5, 0.5, 0.0, 0.4, 0.025, K.stone, { n: 14, top: K.stoneD, noTop: true, bias: -50 });
    [[0.22, 0.28], [0.78, 0.68], [0.3, 0.8]].forEach(([x, y], i) => M.dome(x, y, 0.02, 0.05 + i * 0.01, K.stoneD, { n: 6, rings: 2, squash: 0.7 }));
    [[0.72, 0.28], [0.8, 0.36]].forEach(([x, y]) => M.cone(x, y, 0.02, 0.014, 0.2, K.leaf3, { n: 4 }));
    M.water.push({ x: 0.5, y: 0.5, z: 0.04, r: 0.16 });
    M.dome(0.4, 0.55, 0.03, 0.06, K.pink, { n: 6, rings: 2, squash: 0.5 });
  });
  P("dc-brazier", M => {
    M.cyl(0.5, 0.5, 0, 0.12, 0.05, K.stoneD, { n: 8 });
    M.cyl(0.5, 0.5, 0.05, 0.045, 0.2, K.dark, { n: 6 });
    M.cyl(0.5, 0.5, 0.25, 0.16, 0.07, K.black, { n: 10, r2: 0.2, top: K.dark });
    M.cone(0.5, 0.5, 0.3, 0.1, 0.25, hex("#ff8a2e"), { n: 6 });
    M.cone(0.5, 0.5, 0.31, 0.06, 0.2, hex("#ffd45a"), { n: 5 });
    M.lightAt(0.5, 0.5, 0.4, 0.55, [255, 150, 60]); M.smokeAt(0.5, 0.5, 0.52);
  });
  P("dc-sakura", M => {
    M.box(0.06, 0.06, 0, 0.88, 0.88, 0.02, K.grass, { bias: -100 });
    [[0.2, 0.7], [0.68, 0.74], [0.5, 0.24], [0.78, 0.42]].forEach(([x, y], i) => M.box(x, y, 0.02, 0.1, 0.07, 0.006, i % 2 ? K.pink : K.white, { bias: -60 }));
    M.cyl(0.5, 0.5, 0.02, 0.05, 0.3, K.woodD, { n: 6, r2: 0.035 });
    const pk = hex("#f6a3bd"), pk2 = hex("#ffd0de");
    M.dome(0.5, 0.5, 0.26, 0.3, pk, { n: 10, rings: 4, squash: 0.85 });
    M.dome(0.36, 0.44, 0.34, 0.18, pk2, { n: 8, rings: 3 });
    M.dome(0.64, 0.56, 0.36, 0.17, mixc(pk, K.white, 0.35), { n: 8, rings: 3 });
  });
  P("dc-obelisk", M => {
    M.box(0.24, 0.24, 0, 0.52, 0.52, 0.07, K.stoneD, { top: K.stone });
    M.box(0.3, 0.3, 0.07, 0.4, 0.4, 0.06, K.stone, { top: K.stoneL });
    M.cyl(0.5, 0.5, 0.13, 0.13, 0.62, K.marble, { n: 4, r2: 0.065, rot: Math.PI / 4, noTop: true });
    M.cone(0.5, 0.5, 0.75, 0.066, 0.13, K.gold, { n: 4, rot: Math.PI / 4, shine: true });
    M.lightAt(0.5, 0.5, 0.8, 0.35, [255, 220, 130]);
  });
  P("dc-gazebo", M => {
    M.cyl(0.5, 0.5, 0, 0.42, 0.05, K.stoneL, { n: 8, top: K.paving2 });
    [0, 1, 2, 3, 4, 5].forEach(i => { const a = i / 6 * Math.PI * 2 + 0.52; M.cyl(0.5 + Math.cos(a) * 0.32, 0.5 + Math.sin(a) * 0.32, 0.05, 0.022, 0.42, K.white, { n: 6 }); });
    M.cone(0.5, 0.5, 0.45, 0.42, 0.24, K.roofV, { n: 6, rot: 0.52 });
    M.cyl(0.5, 0.5, 0.69, 0.02, 0.1, K.gold, { n: 5 }); M.dome(0.5, 0.5, 0.79, 0.04, K.gold, { n: 6, rings: 2 });
    M.cyl(0.5, 0.5, 0.05, 0.1, 0.1, K.woodD, { n: 8, top: K.woodL });
  });
  P("dc-ballista", M => {
    M.cyl(0.5, 0.5, 0, 0.22, 0.05, K.woodD, { n: 8, top: K.wood });
    M.box(0.42, 0.42, 0.05, 0.16, 0.16, 0.14, K.wood);
    M.box(0.12, 0.46, 0.22, 0.76, 0.05, 0.05, K.woodD);
    M.box(0.12, 0.44, 0.21, 0.06, 0.09, 0.08, K.dark); M.box(0.82, 0.44, 0.21, 0.06, 0.09, 0.08, K.dark);
    M.box(0.47, 0.1, 0.2, 0.06, 0.62, 0.04, K.wood, { top: K.woodL });
    M.cone(0.5, 0.08, 0.215, 0.035, 0.1, K.stone, { n: 4 });
    M.box(0.4, 0.74, 0.17, 0.2, 0.05, 0.1, K.woodD);
  });
  P("dc-crystal", M => {
    M.cyl(0.5, 0.5, 0, 0.32, 0.04, K.stoneD, { n: 7, top: K.stone });
    const cs = [hex("#7fd7ff"), hex("#a79bff"), hex("#8fe8ff")];
    [[0.5, 0.5, 0.13, 0.62, 0], [0.3, 0.6, 0.08, 0.34, 1], [0.7, 0.42, 0.09, 0.4, 2], [0.62, 0.7, 0.06, 0.26, 0], [0.36, 0.34, 0.06, 0.28, 1]]
      .forEach(([x, y, r, h, k]) => M.cone(x, y, 0.04, r, h, cs[k], { n: 5, shine: true }));
    M.lightAt(0.5, 0.5, 0.35, 0.6, [130, 200, 255]);
  });
  P("dc-qstatue", M => {
    M.box(0.2, 0.2, 0, 0.6, 0.6, 0.1, K.stoneD, { top: K.stone });
    M.box(0.28, 0.28, 0.1, 0.44, 0.44, 0.09, K.stone, { top: K.stoneL });
    M.box(0.36, 0.36, 0.19, 0.28, 0.28, 0.07, K.marble);
    M.spriteAt("queen", 0.5, 0.5, 0.5, "gold", { stat: 1, z: 0.26 });
    M.lightAt(0.5, 0.5, 0.6, 0.4, [255, 220, 140]);
  });
  P("dc-goldtree", M => {
    M.box(0.06, 0.06, 0, 0.88, 0.88, 0.02, K.grass, { bias: -100 });
    M.cyl(0.5, 0.5, 0.02, 0.05, 0.3, K.woodD, { n: 6, r2: 0.035 });
    M.dome(0.5, 0.5, 0.26, 0.3, K.gold, { n: 10, rings: 4, squash: 0.85, shine: true });
    M.dome(0.36, 0.44, 0.34, 0.17, mixc(K.gold, K.white, 0.4), { n: 8, rings: 3 });
    M.dome(0.64, 0.56, 0.36, 0.16, K.goldD, { n: 8, rings: 3 });
    [[0.2, 0.7], [0.74, 0.76], [0.82, 0.3]].forEach(([x, y]) => M.cyl(x, y, 0.02, 0.025, 0.006, K.gold, { n: 6, bias: -60 }));
    M.lightAt(0.5, 0.5, 0.5, 0.6, [255, 215, 110]);
  });
  P("dc-dragon", M => {
    M.box(0.12, 0.12, 0, 0.76, 0.76, 0.08, K.stoneD, { top: K.stone });
    M.dome(0.5, 0.56, 0.08, 0.22, K.stoneD, { n: 10, rings: 4, squash: 0.8 });
    M.box(0.2, 0.24, 0.2, 0.05, 0.34, 0.3, K.stone); M.box(0.75, 0.24, 0.2, 0.05, 0.34, 0.3, K.stone);       // крылья
    M.box(0.12, 0.3, 0.38, 0.1, 0.22, 0.14, K.stoneL); M.box(0.78, 0.3, 0.38, 0.1, 0.22, 0.14, K.stoneL);
    M.cyl(0.5, 0.34, 0.15, 0.075, 0.38, K.stone, { n: 7, r2: 0.05, noTop: true });                           // шея
    M.box(0.4, 0.2, 0.5, 0.2, 0.2, 0.1, K.stoneL, { top: K.marble });                                           // голова
    M.cone(0.44, 0.26, 0.6, 0.025, 0.1, K.stoneD, { n: 4 }); M.cone(0.56, 0.26, 0.6, 0.025, 0.1, K.stoneD, { n: 4 });
    M.cone(0.5, 0.84, 0.1, 0.07, 0.32, K.stone, { n: 5 });                                                       // хвост
    M.box(0.44, 0.19, 0.56, 0.035, 0.02, 0.03, hex("#ff4d3a"), { top: hex("#ff7a5a") }); M.box(0.55, 0.19, 0.56, 0.035, 0.02, 0.03, hex("#ff4d3a"), { top: hex("#ff7a5a") });
    M.lightAt(0.5, 0.2, 0.55, 0.45, [255, 110, 70]); M.smokeAt(0.5, 0.16, 0.6);
  });
  P("dc-throne", M => {
    M.box(0.1, 0.12, 0, 0.8, 0.76, 0.05, K.stoneD, { top: K.stone });
    M.box(0.16, 0.18, 0.05, 0.68, 0.64, 0.05, K.red, { top: mixc(K.red, K.white, 0.18) });
    M.box(0.34, 0.34, 0.1, 0.32, 0.3, 0.12, K.gold, { top: K.goldD });
    M.box(0.34, 0.6, 0.1, 0.32, 0.07, 0.5, K.gold, { top: K.goldD });
    M.box(0.3, 0.34, 0.16, 0.05, 0.3, 0.14, K.goldD); M.box(0.65, 0.34, 0.16, 0.05, 0.3, 0.14, K.goldD);
    M.cone(0.4, 0.635, 0.6, 0.04, 0.1, K.gold, { n: 4 }); M.cone(0.5, 0.635, 0.6, 0.04, 0.14, K.gold, { n: 4 }); M.cone(0.6, 0.635, 0.6, 0.04, 0.1, K.gold, { n: 4 });
    M.flag(0.14, 0.2, 0.05, 0.5, K.violet, { w: 0.14, fh: 0.18, c2: K.white }); M.flag(0.86, 0.2, 0.05, 0.5, K.violet, { w: 0.14, fh: 0.18, c2: K.white });
    M.lightAt(0.5, 0.5, 0.5, 0.6, [255, 215, 120]);
  });

  /* старые модели (фонтан, фонари…) получают новые id предметов */
  LIST.forEach(d => { if (d.kind !== d.id) VL.aliasProp(d.id, d.kind); });

  /* ---------- API ---------- */
  window.VDECOR = { LIST, BY_ID, CAPS, SELL: RAR_PRICE_SELL, RAR_KEYS: ["common", "uncommon", "rare", "epic", "legend"], RAR_COL: ["#9c9ca6", "#72d6a3", "#b98bf5", "#e3bf7c", "#ff9ad5"] };

  /* ---------- тексты ---------- */
  const add = (en, ru) => { if (typeof I18N === "undefined") return; Object.assign(I18N.en, en); Object.assign(I18N.ru, ru); };
  const N = {
    "dc-bush": ["Hedge", "Живая изгородь", "A green edge for a bare corner.", "Зелёная кромка для пустого угла."],
    "dc-oak": ["Old oak", "Старый дуб", "Shade for the square and a bit of coin.", "Тень на площади и немного монет."],
    "dc-pine": ["Pine", "Ель", "A dark pair of pines keeps watch.", "Тёмная пара елей несёт дозор."],
    "dc-hay": ["Haystack", "Стог сена", "Warm and fragrant. Villagers love it.", "Тёплый и пахучий. Жители довольны."],
    "dc-bench": ["Bench", "Скамья", "A place for veterans to rest between marches.", "Здесь отдыхают ветераны между походами."],
    "dc-flowers": ["Flower bed", "Клумба", "Meadow patches in bloom.", "Цветущие грядки на пустой клетке."],
    "dc-lantern": ["Street lamp", "Фонарь", "Warm light after dusk — guards sleep less.", "Тёплый свет в сумерках: стража меньше спит."],
    "dc-well": ["Well", "Колодец", "Cool water, a steady flow of coins.", "Холодная вода и ровный ручеёк монет."],
    "dc-cart": ["Merchant cart", "Телега торговца", "Hides part of the treasury from raiders.", "Прячет часть казны от грабителей."],
    "dc-tent": ["Army tent", "Шатёр", "Room for more soldiers.", "Место для ещё нескольких солдат."],
    "dc-pond": ["Pond", "Пруд", "Frogs, reeds and a few lost coins.", "Лягушки, камыши и пара потерянных монет."],
    "dc-brazier": ["Brazier", "Жаровня", "Fire on the wall frightens the faint-hearted.", "Огонь на стене отпугивает робких."],
    "dc-fountain": ["Fountain", "Фонтан", "Living water; the square feels finished.", "Живая вода: площадь выглядит завершённой."],
    "dc-statue": ["Knight statue", "Статуя коня", "A golden knight inspires the attackers.", "Золотой конь вдохновляет атакующих."],
    "dc-sakura": ["Sakura", "Сакура", "Blossoms bring luck to the treasury.", "Цветы приносят удачу казне."],
    "dc-obelisk": ["Obelisk", "Обелиск", "A monument to victories. Troops hit harder.", "Памятник победам. Отряды бьют сильнее."],
    "dc-gazebo": ["Gazebo", "Беседка", "Officers plan campaigns here.", "Тут офицеры планируют походы."],
    "dc-ballista": ["Ballista", "Баллиста", "Sends bolts at anyone who comes close.", "Бьёт болтами по каждому, кто подошёл близко."],
    "dc-fair": ["Fair", "Ярмарка", "Stalls, balloons, a river of coins.", "Палатки, шары и река монет."],
    "dc-windmill": ["Windmill", "Мельница", "Grinds flour and the treasury grows.", "Мелет муку, а казна растёт."],
    "dc-crystal": ["Crystal", "Кристалл", "Humming with strange wealth.", "Гудит странным богатством."],
    "dc-qstatue": ["Queen statue", "Статуя ферзя", "Troops follow her gaze.", "Войска идут за её взглядом."],
    "dc-goldtree": ["Golden tree", "Золотое дерево", "Raiders cannot find the gold in its leaves.", "Грабители не найдут золота в его листве."],
    "dc-dragon": ["Stone dragon", "Каменный дракон", "A legend. Few dare to stand before the gate.", "Легенда. Мало кто решится подойти к воротам."],
    "dc-throne": ["Throne", "Трон", "The ruler sits and the coins come.", "Правитель садится, а монеты приходят."]
  };
  const en = {}, ru = {};
  Object.keys(N).forEach(k => { en["vd." + k] = N[k][0]; ru["vd." + k] = N[k][1]; en["vd." + k + ".d"] = N[k][2]; ru["vd." + k + ".d"] = N[k][3]; });
  Object.assign(en, {
    "vd.rar.common": "Common", "vd.rar.uncommon": "Uncommon", "vd.rar.rare": "Rare", "vd.rar.epic": "Epic", "vd.rar.legend": "Legendary",
    "vd.p.inc": "+{n}% to treasury income", "vd.p.def": "+{n} defense", "vd.p.atk": "+{n}% squad attack", "vd.p.cap": "+{n} army housing", "vd.p.safe": "−{n}% treasury lost to raids"
  });
  Object.assign(ru, {
    "vd.rar.common": "Обычный", "vd.rar.uncommon": "Необычный", "vd.rar.rare": "Редкий", "vd.rar.epic": "Эпический", "vd.rar.legend": "Легендарный",
    "vd.p.inc": "+{n}% к доходу казны", "vd.p.def": "+{n} к обороне", "vd.p.atk": "+{n}% к атаке отряда", "vd.p.cap": "+{n} мест в войске", "vd.p.safe": "−{n}% казны теряется при набеге"
  });
  add(en, ru);
})();
