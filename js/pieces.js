/* maper.chess — фигуры (SVG). Новый стиль: мягкие округлые силуэты,
   толстый контур, плоская подставка, лёгкая тень снизу и блик слева.
   Каждый набор — одна и та же читаемая геометрия, своя палитра.
   API не изменился: window.pieceSvg(color, type). Подключать после extras.js. */
(function () {
  /* Слои фигуры: [d, роль]
     роль: "body" — основная заливка с контуром
           "shade" — тень (без контура)
           "hl" — блик (без контура)
           "line" — деталь-линия цветом контура/деталей
           "dot" — точка/глаз цветом деталей */
  const BASE = [
    ["M10.5 40.5V37.6Q10.5 35 13.1 35H31.9Q34.5 35 34.5 37.6V40.5Z", "body"],
    ["M11.3 38.6H33.7V39.7H11.3Z", "shade"]
  ];

  const G = {
    p: [
      ["M14.2 35C14.2 28.6 17.6 25.6 19.6 22.3H18.2Q16.8 22.3 16.8 20.9Q16.8 19.5 18.2 19.5H19.7A5.3 5.3 0 1 1 25.3 19.5H26.8Q28.2 19.5 28.2 20.9Q28.2 22.3 26.8 22.3H25.4C27.4 25.6 30.8 28.6 30.8 35Z", "body"],
      ["M20 12.2A3 3 0 0 1 22.6 10.4", "hl"],
      ["M17.3 33.6C17.6 29.6 19.4 27.4 20.9 25", "hl"],
      ...BASE
    ],
    r: [
      ["M13.4 35L14.8 23H30.2L31.6 35Z", "body"],
      ["M12.6 23.2V11.4Q12.6 10.6 13.4 10.6H16.1Q16.9 10.6 16.9 11.4V13.6H19.9V11.4Q19.9 10.6 20.7 10.6H24.3Q25.1 10.6 25.1 11.4V13.6H28.1V11.4Q28.1 10.6 28.9 10.6H31.6Q32.4 10.6 32.4 11.4V23.2Z", "body"],
      ["M12.6 20.3H32.4", "line"],
      ["M14.4 18.6V13", "hl"],
      ["M16.6 33.5L17.4 25", "hl"],
      ...BASE
    ],
    n: [
      ["M13.8 35C13.8 29.8 16.4 27 18.8 24.6C17 24.1 15.3 24.6 13.9 25.7C12.3 27 10.1 26.6 9.6 24.8C9.2 23.3 9.9 22 11.1 20.8C13.5 18.3 15.4 15.6 16.4 12.8L15.4 8.8L18.7 10.9L20.4 7.8L22.4 11.1C28.6 11.7 32.4 16.9 32.4 24.4C32.4 28.6 31.4 31.4 31.2 35Z", "body"],
      ["M23.4 12.8C27.4 14.4 29.5 18.8 29.2 25.4", "line"],
      ["M18.8 24.6C20.4 23.4 21.6 21.6 22 19.6", "line"],
      ["M12.6 19.9C14.4 17.8 16 15.6 17 13.4", "hl"],
      ["M19.5 15.6m-1.15 0a1.15 1.15 0 1 0 2.3 0a1.15 1.15 0 1 0-2.3 0", "dot"],
      ["M11.9 23.3m-.6 0a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0", "dot"],
      ...BASE
    ],
    b: [
      ["M15.6 35C15.6 30.2 17.6 28.2 19 26.4C15.2 24.2 14.4 18.6 17.8 14.2C19.2 12.4 20.8 11.2 22.5 10.2C24.2 11.2 25.8 12.4 27.2 14.2C30.6 18.6 29.8 24.2 26 26.4C27.4 28.2 29.4 30.2 29.4 35Z", "body"],
      ["M17.6 24.6H27.4Q28.7 24.6 28.7 25.9Q28.7 27.2 27.4 27.2H17.6Q16.3 27.2 16.3 25.9Q16.3 24.6 17.6 24.6Z", "body"],
      ["M22.5 7.6m-2.3 0a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0", "body"],
      ["M25.4 14.6L22.2 20.4", "slit"],
      ["M17.6 21.4C16.8 19.2 17.2 16.8 18.8 14.9", "hl"],
      ["M18.4 33.6C18.6 31.2 19.6 29.6 20.6 28.4", "hl"],
      ...BASE
    ],
    q: [
      ["M13.6 33L10.6 17.8L16.2 24.2L17 14.2L21.2 22.6L22.5 12.8L23.8 22.6L28 14.2L28.8 24.2L34.4 17.8L31.4 33Z", "body"],
      ["M13.6 31.6H31.4Q32.8 31.6 32.8 33V35H12.2V33Q12.2 31.6 13.6 31.6Z", "body"],
      ...[[10.4, 16.2], [16.9, 12.4], [22.5, 10.6], [28.1, 12.4], [34.6, 16.2]].map(([x, y]) =>
        [`M${x} ${y}m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0`, "body"]),
      ["M14.8 29.4L13.4 22.4", "hl"],
      ...BASE
    ],
    k: [
      ["M22.5 4.6V11.4M19.4 7.7H25.6", "cross"],
      ["M14 33C10.6 29.4 8.6 25.6 9.5 22C10.6 17.4 16 16.4 19.2 19.4C20 17 21.1 14.9 22.5 12.8C23.9 14.9 25 17 25.8 19.4C29 16.4 34.4 17.4 35.5 22C36.4 25.6 34.4 29.4 31 33Z", "body"],
      ["M13.8 31.6H31.2Q32.6 31.6 32.6 33V35H12.4V33Q12.4 31.6 13.8 31.6Z", "body"],
      ["M22.5 20.2V29", "line"],
      ["M12 25.6C11.4 23.6 12.2 21.4 14.2 20.6", "hl"],
      ...BASE
    ]
  };

  /* Палитры: F — заливка, S — контур, SH — тень, HL — блик, D — детали (глаз, прорезь) */
  const SETS = {
    "pieces-classic": { sw: 1.6,
      w: { F: "#f7f7fa", S: "#2e2f38", SH: "#d3d5df", HL: "#ffffff", D: "#2e2f38" },
      b: { F: "#4b4c56", S: "#1c1d23", SH: "#33343c", HL: "#6c6d79", D: "#c9cad6" } },
    "pieces-ivory": { sw: 1.4,
      w: { F: "#fffaf0", S: "#3a3329", SH: "#e6dcc6", HL: "#ffffff", D: "#3a3329" },
      b: { F: "#2b2b35", S: "#121218", SH: "#1d1d25", HL: "#4a4a58", D: "#cfcfdc" } },
    "pieces-teal": { sw: 1.6,
      w: { F: "#eeeaff", S: "#2a1f5e", SH: "#cfc7f2", HL: "#ffffff", D: "#2a1f5e" },
      b: { F: "#2f2569", S: "#14102e", SH: "#211a4d", HL: "#4a3d94", D: "#35e0d0" } },
    "pieces-gold": { sw: 1.6,
      w: { F: "#ffd56e", S: "#6b4a00", SH: "#e6b540", HL: "#fff1c2", D: "#6b4a00" },
      b: { F: "#4f3478", S: "#1d1136", SH: "#3a2559", HL: "#6f4fa0", D: "#ffd166" } }
  };

  function layer(d, role, pal, sw) {
    switch (role) {
      case "body":
        return `<path d="${d}" fill="${pal.F}" stroke="${pal.S}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
      case "shade":
        return `<path d="${d}" fill="${pal.SH}"/>`;
      case "hl":
        return `<path d="${d}" fill="none" stroke="${pal.HL}" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`;
      case "line":
        return `<path d="${d}" fill="none" stroke="${pal.S}" stroke-width="${sw * .8}" stroke-linecap="round" stroke-linejoin="round"/>`;
      case "slit":
        return `<path d="${d}" fill="none" stroke="${pal.D}" stroke-width="1.9" stroke-linecap="round"/>`;
      case "dot":
        return `<path d="${d}" fill="${pal.D}"/>`;
      case "cross":
        return `<path d="${d}" fill="none" stroke="${pal.S}" stroke-width="${sw + 2.4}" stroke-linecap="round"/>` +
               `<path d="${d}" fill="none" stroke="${pal.F}" stroke-width="2" stroke-linecap="round"/>`;
    }
    return "";
  }

  function svgFor(id, color, type) {
    const s = SETS[id] || SETS["pieces-classic"];
    const pal = s[color] || s.w;
    const inner = (G[type] || G.p).map(([d, role]) => layer(d, role, pal, s.sw)).join("");
    return `<svg class="ps" viewBox="2 2 41 41" shape-rendering="geometricPrecision">${inner}</svg>`;
  }
  window.PIECE_SVG_BASE = svgFor;

  window.pieceSvg = (color, type) => {
    const id = UI.state && UI.state.equipped.pieces;
    return svgFor(SETS[id] ? id : "pieces-classic", color, type);
  };

  const _rs = UI.renderShop;
  UI.renderShop = function (type) {
    _rs.call(this, type);
    const tab = type || document.querySelector(".shop-tab.active")?.dataset.type;
    if (tab !== "pieces") return;
    const items = SHOP_ITEMS.filter(i => i.type === "pieces");
    document.querySelectorAll("#shop-grid .pc-swatch").forEach((el, i) => {
      if (items[i] && SETS[items[i].id]) el.innerHTML = svgFor(items[i].id, "w", "n") + svgFor(items[i].id, "b", "n");
    });
  };

  Object.assign(I18N.en, { "shop.pieces-gold": "Royal" });
  Object.assign(I18N.ru, { "shop.pieces-gold": "Королевский" });
})();
