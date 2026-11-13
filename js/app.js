/* maper.chess — entry point */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof Chess === "undefined") {
    document.body.innerHTML =
      '<p style="color:#fff;padding:24px;font-family:sans-serif">' +
      "Couldn't load the chess engine (chess.js) — check your internet connection and reload." +
      "</p>";
    return;
  }
  UI.init();
});
