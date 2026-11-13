/* maper.chess — фигуры (SVG, классический шахматный силуэт).
   Каждый набор — та же читаемая геометрия, своя палитра. Load after extras.js. */
(function () {
  // геометрия: [d, заливка, обводка, доп.атрибуты]  (F=основной, S=контур)
  const G = {
    p: [["M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z","F","S",""]],
    r: [
      ["M9 39h27v-3H9v3z","F","S",""],
      ["M12 36v-4h21v4H12z","F","S",""],
      ["M11 36V24h5v5h4v-5h5v5h4v-5h5v12z","F","S",'stroke-linejoin="miter"']],
    n: [
      ["M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21","F","S",""],
      ["M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3","F","S",""],
      ["M11.5 30c3.5-1 18.5-1 22 0M12.5 33.5c4.5-1 17.5-1 21 0M13 36.5c5-1 14-1 19 0","F","S",""],
      ["M36 36c0-2.21-1.34-4.03-3.28-4.71.07-.15.11-.32.11-.49 0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5c0 .17.04.34.11.49C28.34 31.97 27 33.79 27 36h9z","F","S",""],
      ["M24.8 13.2a1.4 1.7 0 1 1-.1 3.4 1.4 1.7 0 1 1 .1-3.4z","S","none",""]],
    b: [
      ["M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z","F","S",""],
      ["M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z","S","S",'stroke-linejoin="miter"'],
      ["M18.5 24.5l4.5-8.5","S","none",'stroke-width="2"'],
      ["M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54.93 2.01-.66 1.34-2.17 2.06-3.58 1.73-1.32-.3-1.97-.97-3.06-1.61-1.36.65-2.66 1.24-4.29 1.24s-2.93-.59-4.29-1.24c-1.09.64-1.74 1.31-3.06 1.61-1.41.33-2.92-.39-3.58-1.73C7.35 36.54 9 36 9 36z","F","S",'stroke-linecap="butt"']],
    q: [
      ["M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z","F","S",'stroke-linecap="butt"'],
      ["M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z","F","S",""],
      ["M11 29.5c4.5-1 18.5-1 23 0M11.5 32.5c4.5-1 17-1 21 0M12 35.5c5-1 14-1 19 0","F","S",""],
      ...[["6","12"],["14","9.5"],["22.5","8"],["31","9.5"],["39","12"]].map(c =>
        [`M${+c[0]-1.9} ${c[1]}a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0z`,"S","none",""])
    ],
    k: [
      ["M22.5 11.63V6M20 8h5","none","S",'stroke-width="1.8"'],
      ["M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5","F","S",""],
      ["M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7z","F","S",""],
      ["M12.5 31c5.5-1 17.5-1 20 0M12.5 34c5.5-1 17.5-1 20 0M13 37c5.5-1 16.5-1 19 0","F","S",""]]
  };

  const SETS = {
    "pieces-classic": { sw: 1.5,  w: { F: "#f6f6f9", S: "#15151c" }, b: { F: "#3f3f4a", S: "#101017", D: "#e9e9f4" } },
    "pieces-ivory":   { sw: 1.15, w: { F: "#ffffff", S: "#2a2a33" }, b: { F: "#23232d", S: "#101018", D: "#c9c9d8" } },
    "pieces-teal":    { sw: 1.5,  w: { F: "#ece7ff", S: "#2a1f5e" }, b: { F: "#2a1f5e", S: "#14102e", D: "#35e0d0" } },
    "pieces-gold":    { sw: 1.5,  w: { F: "#ffd166", S: "#6b4a00" }, b: { F: "#4a3070", S: "#1d1136", D: "#ffd166" } }
  };

  function svgFor(id, color, type) {
    const s = SETS[id] || SETS["pieces-classic"];
    const pal = s[color];
    const inner = G[type].map(([d, f, st, ex]) => {
      const fill = f === "F" ? pal.F : f === "S" ? pal.S : "none";
      const stroke = st === "S" ? pal.S : st === "F" ? pal.F : "none";
      const det = pal.D && f === "D" ? pal.D : null;
      return `<path d="${d}" fill="${det || fill}" stroke="${st === 'D' && pal.D ? pal.D : stroke}" stroke-width="${s.sw}" stroke-linecap="round" stroke-linejoin="round" ${ex}/>`;
    }).join("");
    return `<svg class="ps" viewBox="-0.8 -0.8 46.6 46.6">${inner}</svg>`;
  }

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
      if (items[i]) el.innerHTML = svgFor(items[i].id, "w", "n") + svgFor(items[i].id, "b", "n");
    });
  };

  Object.assign(I18N.en, { "shop.pieces-gold": "Royal" });
  Object.assign(I18N.ru, { "shop.pieces-gold": "Королевский" });
})();