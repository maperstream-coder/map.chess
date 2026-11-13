/* maper.chess — два новых набора фигур для магазина:
   «Минимализм» (гладкие простые формы) и «Фэнтези-кристалл» (ледяные кристаллы и светящиеся грани).
   Подключать ПОСЛЕ pieces.js и ДО rewards.js. Ничего больше менять не нужно. */
(function () {
  const ID_MIN = "pieces-minimal", ID_CRY = "pieces-crystal";

  /* ---------- магазин: названия и цены ---------- */
  Object.assign(I18N.en, { "shop.pieces-minimal": "Minimal", "shop.pieces-crystal": "Crystal Fantasy" });
  Object.assign(I18N.ru, { "shop.pieces-minimal": "Минимализм", "shop.pieces-crystal": "Фэнтези-кристалл" });
  [
    { id: ID_MIN, type: "pieces", nameKey: "shop.pieces-minimal", price: 700,
      vars: { "--pc-white": "#f4f5f8", "--pc-black": "#2c303c" } },
    { id: ID_CRY, type: "pieces", nameKey: "shop.pieces-crystal", price: 1200,
      vars: { "--pc-white": "#eaf3ff", "--pc-black": "#262b3a" } }
  ].forEach(it => { if (!SHOP_ITEMS.some(x => x.id === it.id)) SHOP_ITEMS.push(it); });

  /* ---------- палитры ---------- */
  const PAL = {
    [ID_MIN]: {
      w: { F: "#f4f5f8", S: "#7c8296", SH: "#aeb4c8", HL: "#ffffff", sw: .9 },
      b: { F: "#353a4b", S: "#8089ab", SH: "#12151d", HL: "#8d97b8", sw: .9, eye: "#aab3d0" }
    },
    [ID_CRY]: {
      w: { F: "#f1f6fc", S: "#6f86ab", SH: "#b6c8e0", HL: "#ffffff", A: "#3ea8ff", AL: "#c2e9ff", sw: .9, eye: "#2a8ff0" },
      b: { F: "#2b3144", S: "#7f98c4", SH: "#10131d", HL: "#8fa3c9", A: "#34d0ff", AL: "#c6f6ff", sw: .9, eye: "#5fe0ff" }
    }
  };

  /* ---------- вспомогательные функции ---------- */
  const body = (d, p) => `<path d="${d}" fill="${p.F}" stroke="${p.S}" stroke-width="${p.sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const fill = (d, c, o) => `<path d="${d}" fill="${c}"${o != null ? ` opacity="${o}"` : ""}/>`;
  const line = (d, c, w, o) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o != null ? ` opacity="${o}"` : ""}/>`;
  const circ = (cx, cy, r, c, o) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"${o != null ? ` opacity="${o}"` : ""}/>`;
  /* светящийся кристалл: ореол + грань + светлый блик */
  const gem = (d, p, inner) => line(d, p.A, 2.6, .28) + `<path d="${d}" fill="${p.A}" stroke="${p.AL}" stroke-width=".5" stroke-linejoin="round"/>` + (inner ? fill(inner, p.AL, .75) : "");

  const PLINTH = "M10.5 40.5V38.2Q10.5 36.4 12.3 36.4H32.7Q34.5 36.4 34.5 38.2V40.5Z";
  const plinth = p => body(PLINTH, p) + fill("M11.5 37.3H33.5V38.2H11.5Z", p.HL, .35) + fill("M11 39.4H34V40.5H11Z", p.SH, .35);

  /* ---------- общие силуэты ---------- */
  const SIL = {
    pawnBody: "M18.4 22.4Q22.5 24.4 26.6 22.4C27.2 27.2 30.4 30.6 31.6 36.4H13.4C14.6 30.6 17.8 27.2 18.4 22.4Z",
    pawnCollar: "M16.4 19.8Q22.5 22.4 28.6 19.8L28.9 22.6Q22.5 25.2 16.1 22.6Z",
    rookBody: "M16.2 16.8H28.8L30.4 34H14.6Z",
    rookRing: "M12.6 33.6H32.4V36.4H12.6Z",
    knight: "M11.2 36.4C11.2 29.6 13.8 25.6 18.6 22.6C15.6 22.7 13.2 24 10.6 25.6L8.2 22.6C8.4 19.2 12 14 16 10.4L16.8 5L21.4 8C29.8 8.4 35.8 14.6 35.8 24.2C35.8 28.6 35.2 32.4 34.6 36.4Z",
    bishopHead: "M22.5 4.2C27.6 8.8 30.2 12.8 29.8 17.4C29.5 20 27.4 22.2 25.6 23.2H19.4C17.6 22.2 15.5 20 15.2 17.4C14.8 12.8 17.4 8.8 22.5 4.2Z",
    bishopCollar: "M16.6 23.2H28.4V26.2H16.6Z",
    bishopBody: "M19.4 26.2H25.6C25.6 30.4 28.8 32.6 31 36.4H14C16.2 32.6 19.4 30.4 19.4 26.2Z",
    queenBody: "M13.2 28.4H31.8C30.2 31.6 30.6 34 33 36.4H12C14.4 34 14.8 31.6 13.2 28.4Z",
    queenBand: "M13.4 27.6H31.6V30.4H13.4Z",
    kingHead: "M12.6 26.6C12.6 18 17.2 12.6 22.5 12.6C27.8 12.6 32.4 18 32.4 26.6Z",
    kingBand: "M13 25.8H32V29H13Z",
    kingBody: "M13.6 29H31.4C29.8 32 30.4 34.4 33 36.4H12C14.6 34.4 15.2 32 13.6 29Z"
  };

  /* ---------- «Минимализм» ---------- */
  const MIN = {
    p: p => plinth(p) + body(SIL.pawnBody, p) + body(SIL.pawnCollar, p) + circ(22.5, 12.2, 5.4, p.F) +
      `<circle cx="22.5" cy="12.2" r="5.4" fill="none" stroke="${p.S}" stroke-width="${p.sw}"/>` +
      fill("M19.6 22.8C19.2 27 17 30 15.8 34.6H18C19 31 21 28.2 21.4 23.4Z", p.HL, .5) +
      fill("M26 23.4C26.6 27.4 29 30 30 34.6H27.8C27 31.4 25.4 28.4 24.8 24Z", p.SH, .45) +
      `<ellipse cx="20.4" cy="10.4" rx="1.7" ry="2.5" fill="${p.HL}" opacity=".6" transform="rotate(25 20.4 10.4)"/>`,
    r: p => plinth(p) + body(SIL.rookBody, p) + body(SIL.rookRing, p) +
      body("M12.4 6.8H17.2V10H20.2V6.8H24.8V10H27.8V6.8H32.6V14.2L30 17H15L12.4 14.2Z", p) +
      fill("M17.4 17.6L16.4 33H19L19.6 17.6Z", p.HL, .45) + fill("M26 17.6L26.6 33H28.4L27.6 17.6Z", p.SH, .45) +
      fill("M13.2 7.4H16.6V9.4H13.2Z", p.HL, .5),
    n: p => plinth(p) + body(SIL.knight, p) +
      fill("M25 10C31 11.4 34.6 16.6 34.6 24C34.6 28 34.2 31.4 33.6 35.4H29.6C31.2 27 30 17 25 10Z", p.SH, .5) +
      fill("M17.6 7.4L20.4 9.4C17.4 11.4 14.2 15.4 11.6 20C11 17.6 13.6 13 16.2 10.4Z", p.HL, .45) +
      circ(17.6, 15.2, 1.15, p.eye) + circ(10.8, 23.2, .8, p.S, .8),
    b: p => plinth(p) + body(SIL.bishopBody, p) + body(SIL.bishopCollar, p) + body(SIL.bishopHead, p) +
      line("M22.5 8V14.6", p.S, 1.5) +
      fill("M19.6 9C17.6 12 17 15.4 18 19L19.6 20.6C18.6 16.4 18.6 12.6 20.8 8.2Z", p.HL, .5) +
      fill("M26.4 9.8C28.2 13 28.6 16.6 27.2 20.2L25.4 22.6C27 18.6 27 13.6 25 9Z", p.SH, .4),
    q: p => plinth(p) + body(SIL.queenBody, p) +
      body("M12.4 27.8L10.2 13.2L16.4 19.4L19 9.6L22.5 17.6L26 9.6L28.6 19.4L34.8 13.2L32.6 27.8Z", p) +
      body(SIL.queenBand, p) +
      [[10.2, 11.8], [19, 8.2], [22.5, 6.6], [26, 8.2], [34.8, 11.8]].map(c => circ(c[0], c[1], 1.7, p.F) + `<circle cx="${c[0]}" cy="${c[1]}" r="1.7" fill="none" stroke="${p.S}" stroke-width=".7"/>`).join("") +
      fill("M17.2 22L15 14.8L17.4 21.4Z", p.HL, .6) + fill("M27.6 26.6L31.4 16.2L32.2 26.6Z", p.SH, .4),
    k: p => plinth(p) + body(SIL.kingBody, p) + body(SIL.kingHead, p) + body(SIL.kingBand, p) +
      body("M21 1.8H24V4.6H27V7.6H24V12.6H21V7.6H18V4.6H21Z", p) +
      fill("M17.4 24C17.4 19 19.6 15.6 22 14.4C19.8 16.4 19 20 19.2 24Z", p.HL, .5) +
      fill("M28 24C28 19.6 26.4 16 24.4 14.4C27.6 16.4 30.4 20 31.2 25Z", p.SH, .4) +
      fill("M21.6 2.4H22.6V11.8H21.6Z", p.HL, .5)
  };

  /* ---------- «Фэнтези-кристалл» ---------- */
  const CRY = {
    p: p => plinth(p) + body(SIL.pawnBody, p) + body(SIL.pawnCollar, p) +
      fill("M19.6 22.8C19.2 27 17 30 15.8 34.6H18C19 31 21 28.2 21.4 23.4Z", p.HL, .45) +
      fill("M26 23.4C26.6 27.4 29 30 30 34.6H27.8C27 31.4 25.4 28.4 24.8 24Z", p.SH, .45) +
      gem("M22.5 27.2L25.4 31.6L22.5 35.4L19.6 31.6Z", p, "M22.5 28.8L24 31.6L22.5 33.6L21 31.6Z") +
      circ(22.5, 12.2, 6.2, p.A, .22) + circ(22.5, 12.2, 5.2, p.A) +
      `<circle cx="22.5" cy="12.2" r="5.2" fill="none" stroke="${p.S}" stroke-width=".7"/>` +
      circ(22.5, 12.8, 3.4, p.AL, .35) + circ(20.4, 10.2, 1.5, "#fff", .9),
    r: p => plinth(p) + body(SIL.rookBody, p) + body(SIL.rookRing, p) +
      body("M12.4 16.8L12 6.4L17 11.2L19.6 3.4L22.5 9.6L25.4 3.4L28 11.2L33 6.4L32.6 16.8Z", p) +
      fill("M17.4 17.6L16.4 33H19L19.6 17.6Z", p.HL, .45) + fill("M26 17.6L26.6 33H28.4L27.6 17.6Z", p.SH, .45) +
      gem("M22.5 9.6L25 13.2L22.5 16.6L20 13.2Z", p, "M22.5 11.2L23.6 13.2L22.5 15L21.4 13.2Z") +
      gem("M22.5 24.4L25.6 29.4L22.5 33.2L19.4 29.4Z", p, "M22.5 26.4L24 29.4L22.5 31.4L21 29.4Z"),
    n: p => plinth(p) + body(SIL.knight, p) +
      /* грива из кристальных зубцов */
      body("M21.4 8C29.8 8.4 35.8 14.6 35.8 24.2L32 21.2L33 26.4L29.4 22.6L30 28.2L26.4 23.2C26.6 17 24.6 11.6 21.4 8Z", p) +
      fill("M25 10C31 11.4 34.6 16.6 34.6 24L33.8 23.2C33.2 17.6 29.6 12.6 25 10Z", p.A, .55) +
      fill("M17.6 7.4L20.4 9.4C17.4 11.4 14.2 15.4 11.6 20C11 17.6 13.6 13 16.2 10.4Z", p.HL, .5) +
      fill("M31 29.6H34.6C34.4 32 34.2 34 33.8 36.4H29.6Z", p.SH, .4) +
      gem("M20.4 28.4L22.8 31.8L20.4 35.2L18 31.8Z", p) +
      circ(17.6, 15.2, 1.3, p.eye) + circ(17.6, 15.2, 2.3, p.A, .25) + circ(10.8, 23.2, .8, p.S, .8),
    b: p => plinth(p) + body(SIL.bishopBody, p) + body(SIL.bishopCollar, p) + body(SIL.bishopHead, p) +
      fill("M19.6 9C17.6 12 17 15.4 18 19L19.6 20.6C18.6 16.4 18.6 12.6 20.8 8.2Z", p.HL, .5) +
      fill("M26.4 9.8C28.2 13 28.6 16.6 27.2 20.2L25.4 22.6C27 18.6 27 13.6 25 9Z", p.SH, .4) +
      gem("M22.5 7.8L25.6 12.8L22.5 18.4L19.4 12.8Z", p, "M22.5 9.8L24 12.8L22.5 15.8L21 12.8Z") +
      gem("M22.5 27.4L24.8 31.2L22.5 34.4L20.2 31.2Z", p),
    q: p => plinth(p) + body(SIL.queenBody, p) +
      body("M12.4 27.8L10 14L15.6 18.6L17.4 8.6L22.5 15.6L27.6 8.6L29.4 18.6L35 14L32.6 27.8Z", p) +
      body(SIL.queenBand, p) +
      fill("M16.2 21L14.6 15.6L16.8 20.4Z", p.HL, .6) +
      gem("M22.5 3.6L25.2 9.4L22.5 16.2L19.8 9.4Z", p, "M22.5 6L23.8 9.4L22.5 13L21.2 9.4Z") +
      gem("M10 8.4L11.8 12.6L10 16L8.2 12.6Z", p) + gem("M35 8.4L36.8 12.6L35 16L33.2 12.6Z", p) +
      gem("M22.5 30.2L24.4 32.6L22.5 35L20.6 32.6Z", p),
    k: p => plinth(p) + body(SIL.kingBody, p) +
      body("M12.4 26.2L11.6 14.4L16.6 19.4L18.4 11L22.5 16.4L26.6 11L28.4 19.4L33.4 14.4L32.6 26.2Z", p) +
      body(SIL.kingBand, p) +
      fill("M17.2 24C17.2 20.6 17.6 18 18.6 16.2C18 19 18.2 21.6 19 24Z", p.HL, .55) +
      gem("M22.5 1.2L26 8.6L22.5 17.2L19 8.6Z", p, "M22.5 3.8L24.2 8.6L22.5 13.6L20.8 8.6Z") +
      gem("M14.2 8.2L16 12.2L14.2 16L12.4 12.2Z", p) + gem("M30.8 8.2L32.6 12.2L30.8 16L29 12.2Z", p) +
      gem("M22.5 30L24.6 32.6L22.5 35.2L20.4 32.6Z", p)
  };

  const DEFS = { [ID_MIN]: MIN, [ID_CRY]: CRY };

  function svgOf(id, color, type) {
    const pal = PAL[id][color === "w" ? "w" : "b"], f = DEFS[id][type];
    return `<svg class="ps" viewBox="0 0 45 45" aria-hidden="true">${f(pal)}</svg>`;
  }

  /* ---------- подключение к доске, урокам, дуэлям ---------- */
  const _ps = window.pieceSvg;
  window.pieceSvg = function (color, type) {
    const id = UI.state && UI.state.equipped && UI.state.equipped.pieces;
    if (DEFS[id] && DEFS[id][type]) return svgOf(id, color, type);
    return _ps ? _ps.apply(this, arguments) : "";
  };

  /* ---------- превью в магазине: конь белый + конь чёрный ---------- */
  const _rs = UI.renderShop;
  UI.renderShop = function () {
    _rs.apply(this, arguments);
    document.querySelectorAll("#shop-grid .shop-card").forEach(card => {
      const nm = card.querySelector(".shop-name");
      const sw = card.querySelector(".pc-swatch");
      if (!nm || !sw) return;
      [ID_MIN, ID_CRY].forEach(id => {
        const item = SHOP_ITEMS.find(x => x.id === id);
        if (item && nm.textContent === t(item.nameKey)) {
          sw.innerHTML = svgOf(id, "w", "n") + svgOf(id, "b", "n");
          sw.style.background = "linear-gradient(135deg, #5d6584, #2c3149)";
        }
      });
    });
  };
})();