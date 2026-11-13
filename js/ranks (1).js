/* maper.chess — ranks. A new rank every 10 levels, max level 300 (30 ranks), English titles only.
   Rank N unlocks at level 10*N: rank 1 at level 10, rank 2 at level 20 ... rank 30 at level 300.
   Levels 1-9 show the starter title "Novice" (it is not one of the 30 ranks).
   Badge design matches the site (dark shield, glow, gold/purple accents).
   Load AFTER ui.js. */
(function () {
  const MAX_LEVEL = 300;
  const T = [
    "Novice", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King",
    "Ace", "Adept", "Master", "Expert", "Veteran", "Champion",
    "Grandmaster", "Warlord", "Legend", "Mythic", "Titan", "Phantom",
    "Immortal", "Eternal", "Celestial", "Archon", "Sovereign", "Overlord",
    "Ascendant", "Transcendent", "Divine", "Primordial", "Omnipotent", "Infinite"
  ];
  const HUE = [0, 128, 145, 165, 190, 215, 230, 262, 280, 300, 322, 342, 358, 14, 28, 42,
               52, 175, 195, 250, 275, 300, 330, 350, 10, 30, 45, 160, 185, 265, 285];
  const hex = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l),
    f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
    return "#" + f(0) + f(8) + f(4); };
  const R = T.map((nm, i) => ({ min: i === 0 ? 1 : i * 10, c: i === 0 ? "#9aa0ad" : i === T.length - 1 ? "#ffe9a8" : hex(HUE[i], 88, 64) }));
  R.forEach((r, i) => { r.en = T[i]; r.ru = T[i]; }); /* English only, kept for compat */

  const idxOf = lv => { let k = 0; R.forEach((r, i) => { if (lv >= r.min) k = i; }); return k; };
  const lvOf = xp => playerLevelFromXp(xp).level;
  const name = i => R[i].en;

  const SW = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
  const GLYPH_BY = {
    Pawn: '<circle cx="0" cy="-2.7" r="2.3"/><path d="M-3.7 4.9C-3.7 2 -1.7 .7 0 .7S3.7 2 3.7 4.9z"/>',
    Knight: '<path d="M-3.6 5V3.6C-3.6 1 -1.2 .6 -.6 -1.2L-2.9 -.2-3.7 -1.5.4 -4.9C3.2 -4.2 4.1 -1.6 3.7 1.1V5z"/>',
    Bishop: '<path d="M0 -5.2C2.7 -3.2 3.1 -.6 1.7 1.1H2.5V2.4H-2.5V1.1H-1.7C-3.1 -.6 -2.7 -3.2 0 -5.2z"/><path d="M-3.5 3.5H3.5V5H-3.5z"/>',
    Rook: '<path d="M-3.7 5V3.5H-2.7V-.8L-3.7 -1.7V-5H-1.9V-3.6H-.9V-5H.9V-3.6H1.9V-5H3.7V-1.7L2.7 -.8V3.5H3.7V5z"/>',
    Queen: '<path d="M-4.7 -2.9L-2.5 1 -1.5 -3.9 0 .4 1.5 -3.9 2.5 1 4.7 -2.9 3.7 4.7H-3.7z"/>',
    King: '<path d="M-.8 -5.5H.8V-4.1H2.2V-2.7H.8V-1.5H-.8V-2.7H-2.2V-4.1H-.8z"/><path d="M-4.2 -.4H4.2L3.4 5H-3.4z"/>',
    Ace: '<path d="M0 -5.3C3 -2.2 4.6 -.4 4.6 1.4A4.6 4.6 0 0 1 -4.6 1.4C-4.6 -.4 -3 -2.2 0 -5.3z"/><path d="M-.1 2.2L-1.3 5H1.3L.1 2.2z"/>',
    Adept: '<path d="M0 -5.5L1.2 -1.2 5.5 0 1.2 1.2 0 5.5 -1.2 1.2 -5.5 0 -1.2 -1.2z" ' + SW + ' stroke-width="1.1"/>',
    Master: '<path d="M0 -5.5L1.5 -1.5 5.5 0 1.5 1.5 0 5.5 -1.5 1.5 -5.5 0 -1.5 -1.5z"/>',
    Expert: '<path d="M0 -5.5L4.5 0 0 5.5 -4.5 0z"/>',
    Champion: '<path d="M0 -5.5L1.2 -1.7L5.2 -1.7L2 .7L3.2 4.5L0 2.1L-3.2 4.5L-2 .7L-5.2 -1.7L-1.2 -1.7z"/>',
    Grandmaster: '<path d="M-4.8 3.6L-5.6 -2.8 -2.8 .6 0 -4.5 2.8 .6 5.6 -2.8 4.8 3.6zM-4.8 3.9H4.8V5H-4.8z"/>',
    Legend: '<circle cx="0" cy="0" r="2.5"/><path d="M0 -5.5V-4M0 4V5.5M-5.5 0H-4M4 0H5.5M-3.9 -3.9L-2.9 -2.9M2.9 2.9L3.9 3.9M-3.9 3.9L-2.9 2.9M2.9 -2.9L3.9 -3.9" ' + SW + ' stroke-width="1.2"/>',
    Mythic: '<path d="M2.5 -5.2A5.2 5.2 0 1 0 2.5 5.2A4 4 0 0 1 2.5 -5.2z"/>',
    Titan: '<path d="M0 -5.5L4.8 -2.75V2.75L0 5.5 -4.8 2.75V-2.75z"/>',
    Immortal: '<path d="M0 0C-1.3 -2.5 -4.7 -2.7 -4.7 0S-1.3 2.5 0 0 4.7 -2.7 4.7 0 1.3 2.5 0 0z" ' + SW + ' stroke-width="1.5"/>',
    Eternal: '<circle cx="0" cy="0" r="4.6" ' + SW + ' stroke-width="1.3"/><circle cx="0" cy="0" r="1.8"/>',
    Celestial: '<circle cx="0" cy="0" r="1.9"/><ellipse cx="0" cy="0" rx="5.1" ry="1.9" ' + SW + ' stroke-width="1.1" transform="rotate(-24)"/>',
    Sovereign: '<path d="M-4.8 3.6L-5.8 -3 -2.9 .8 0 -5 2.9 .8 5.8 -3 4.8 3.6zM-4.8 3.9H4.8V5H-4.8z"/><circle cx="0" cy="-5" r=".9"/><circle cx="-5.8" cy="-3" r=".9"/><circle cx="5.8" cy="-3" r=".9"/>',
    Transcendent: '<path d="M0 -1.2L-1.9 -1.2C-4.1 -1.2 -5.3 .4 -5.3 2.6L-2.6 1.1 -3.4 4.6 0 2.6 3.4 4.6 2.6 1.1 5.3 2.6C5.3 .4 4.1 -1.2 1.9 -1.2z"/>',
    Infinite: '<path d="M0 0C-1.3 -2.5 -4.7 -2.7 -4.7 0S-1.3 2.5 0 0 4.7 -2.7 4.7 0 1.3 2.5 0 0z" ' + SW + ' stroke-width="1.6"/><circle cx="0" cy="0" r="1"/>',
    Veteran: '<path d="M-4.5 -1L0 -5.2 4.5 -1V1L0 -3.1-4.5 1z"/><path d="M-4.5 2.8L0 -1.4 4.5 2.8V4.8L0 .6-4.5 4.8z"/>',
    Warlord: '<path d="M-4.4 -4.4L4.4 4.4M4.4 -4.4L-4.4 4.4" ' + SW + ' stroke-width="1.9"/><circle cx="0" cy="0" r="1.6"/>',
    Phantom: '<path d="M-4 5V-.5A4 4 0 0 1 4 -.5V5L2 3.4 0 5-2 3.4z"/>',
    Archon: '<path d="M-4.6 5V-.5A4.6 4.6 0 0 1 4.6 -.5V5H2.4V-.4A2.4 2.4 0 0 0 -2.4 -.4V5z"/>',
    Overlord: '<path d="M0 -5.5L5.2 4.6H-5.2z"/>',
    Ascendant: '<path d="M0 -5.5L4.8 0H1.8V5.2H-1.8V0H-4.8z"/>',
    Divine: '<path d="M-1 -5.5H1V-1H5.5V1H1V5.5H-1V1H-5.5V-1H-1z"/>',
    Primordial: '<path d="M0 0C0 -1.6 2.2 -1.6 2.2 0S0 3.4 -2.4 1.8 -3.8 -3 0 -4.2 5.2 -1.5 4.4 2.6" ' + SW + ' stroke-width="1.3"/>',
    Omnipotent: '<path d="M-5.5 0C-3 -3.8 3 -3.8 5.5 0 3 3.8 -3 3.8 -5.5 0z"/><circle cx="0" cy="0" r="1.6" fill="#14131e"/>'
  };
  GLYPH_BY.Novice = '<circle cx="0" cy="0" r="2.2"/>';
  const GLYPH = T.map(n => GLYPH_BY[n]);


  function badge(level, size, cls) {
    const i = idxOf(level), r = R[i], id = "rkg" + i, s = size || 22;
    const crown = i >= 15 ? `<path d="M10.5 7.5l1.3-4.3 2.4 2.3L16 2l1.8 3.5 2.4-2.3 1.3 4.3z" fill="${r.c}" stroke="#14131e" stroke-width=".8" stroke-linejoin="round"/>` : "";
    const wings = i >= 23 ? `<path d="M1.5 9c4.5 0 7.5 3.5 8.5 9-3.5 0-7-2.5-8.5-9z" fill="${r.c}" opacity=".85"/><path d="M30.5 9c-4.5 0-7.5 3.5-8.5 9 3.5 0 7-2.5 8.5-9z" fill="${r.c}" opacity=".85"/>` : "";
    const wings2 = i >= 27 ? `<path d="M3 17c3.5 0 6 2 7 5.5-3 0-5.5-1.5-7-5.5z" fill="${r.c}" opacity=".6"/><path d="M29 17c-3.5 0-6 2-7 5.5 3 0 5.5-1.5 7-5.5z" fill="${r.c}" opacity=".6"/>` : "";
    const top = i === R.length - 1, stop2 = top ? "#8a5cff" : r.c;
    return `<svg class="rk ${cls || ""}${top ? " rk-imm" : ""}" viewBox="0 0 32 32" width="${s}" height="${s}" style="--rk:${r.c}" role="img" aria-label="${name(i)}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.c}" stop-opacity=".95"/><stop offset="1" stop-color="${stop2}" stop-opacity=".28"/></linearGradient></defs>
      ${wings}${wings2}
      <path d="M16 5.5l9 3v8c0 6-4 9.2-9 11.2-5-2-9-5.2-9-11.2v-8z" fill="#17181d"/>
      <path d="M16 5.5l9 3v8c0 6-4 9.2-9 11.2-5-2-9-5.2-9-11.2v-8z" fill="url(#${id})" stroke="${r.c}" stroke-width="1.5" stroke-linejoin="round"/>
      ${crown}
      <g transform="translate(16 16.6) scale(.92)" fill="#fff" stroke="#14131e" stroke-width=".55" stroke-linejoin="round" paint-order="stroke">${GLYPH[i]}</g></svg>`;
  }
  const line = level => { const i = idxOf(level); return `<span class="rk-line" style="--rk:${R[i].c}">${name(i)}</span>`; };
  window.Ranks = { list: R, max: MAX_LEVEL, idx: idxOf, level: lvOf, name, badge, line,
    chip: xp => `<span class="rk-chip" title="${name(idxOf(lvOf(xp)))}">${badge(lvOf(xp), 16)}</span>` };

  const css = document.createElement("style");
  css.textContent = `.rk{display:inline-block;flex:none;vertical-align:middle;filter:drop-shadow(0 2px 5px color-mix(in srgb,var(--rk) 45%,transparent))}
  .rk-chip{display:inline-flex;margin-right:6px;vertical-align:middle}
  .rk-line{font-weight:800;letter-spacing:.02em;color:var(--rk);text-shadow:0 0 14px color-mix(in srgb,var(--rk) 55%,transparent)}
  .rk-corner{position:absolute;right:-8px;bottom:-6px}.pp-ava-wrap{position:relative;display:inline-block}
  .pp-ava-wrap .pp-ava{box-shadow:0 0 0 3px var(--rk,transparent)}
  .rk-imm{animation:rkImm 2.6s ease-in-out infinite}@keyframes rkImm{0%,100%{filter:drop-shadow(0 0 4px #ffe9a8)}50%{filter:drop-shadow(0 0 10px #8a5cff)}}
  .pill-rank{display:inline-flex;align-items:center;gap:6px}.pill-rank .rk-nm{display:none;font-weight:800;color:var(--rk)}
  @media (min-width:1024px){.pill-rank .rk-nm{display:inline}}
  .lb-nick .rk,.fr-info b .rk{margin-right:6px;position:relative;top:-1px}`;
  document.head.appendChild(css);

  const _tb = UI.renderTopbar;
  UI.renderTopbar = function () {
    _tb.apply(this, arguments);
    const el = document.getElementById("player-rank"); if (!el || !this.state) return;
    const lv = lvOf(this.state.xp), i = idxOf(lv), txt = el.textContent.replace(/\s*·.*$/, "").trim();
    const base = txt.match(/Lv\.\s*\d+/) ? txt.match(/Lv\.\s*\d+/)[0] : `Lv. ${lv}`;
    el.style.setProperty("--rk", R[i].c); el.style.borderColor = R[i].c + "66";
    el.innerHTML = `${badge(lv, 22)}<span>${base}</span><span class="rk-nm">${name(i)}</span>`;
    el.title = name(i);
  };

  const _sv = window.saveState;
  window.saveState = function (s) {
    _sv(s);
    if (typeof UI === "undefined" || s !== UI.state) return;
    const i = idxOf(lvOf(s.xp));
    if (s.rankSeen === undefined || i < s.rankSeen) { s.rankSeen = i; _sv(s); return; }   /* звания пересчитаны (каждые 10 ур.) — тихо подстраиваемся */
    if (i > s.rankSeen) {
      s.rankSeen = i; _sv(s);
      setTimeout(() => UI._toast("New rank: " + name(i)), 1800);
    }
  };
  const nav = document.querySelector(".bottom-nav");
  if (nav) new MutationObserver(() => {
    const a = nav.querySelector(".nav-btn.active");
    if (a && nav.scrollWidth > nav.clientWidth + 2) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: "smooth" });
  }).observe(nav, { attributes: true, subtree: true, attributeFilter: ["class"] });
  if (UI.state) UI.renderTopbar();
})();