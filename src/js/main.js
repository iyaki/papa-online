// main.js: entry point
// Carga idioma y renderiza pantalla de inicio desde HTML plano
let lang = localStorage.getItem("lang") || "es";
let i18n = {};
Promise.all([
  fetch(`src/i18n/${lang}.json`).then(r => r.json()),
  fetch("src/home.html").then(r => r.text())
]).then(([t, homeHtml]) => {
  i18n = t;
  document.getElementById("app").innerHTML = homeHtml;
  renderHome();
});

function renderHome() {
  document.getElementById("game-title").textContent = i18n.game_title;
  document.getElementById("instructions").textContent = i18n.instructions;

  // Idioma
  document.getElementById("label-lang").innerHTML = `${i18n.select_language}: <select id="lang-select"><option value="es">Español</option><option value="en">English</option></select>`;
  document.getElementById("lang-select").value = lang;
  document.getElementById("lang-select").onchange = e => {
    localStorage.setItem("lang", e.target.value);
    location.reload();
  };

  // Jugadores
  document.getElementById("label-players").innerHTML = `${i18n.select_players}: <input type="number" id="players" min="2" max="6" value="2">`;

  // Rango
  document.getElementById("label-range").innerHTML = `${i18n.select_range}: <input type="number" id="range" min="5" max="30" value="10">`;

  // Botón
  document.getElementById("start-btn").textContent = i18n.start_game;
  document.getElementById("start-btn").onclick = () => {
    // Aquí irá la lógica para iniciar el juego
    alert("Game start: WIP");
  };
}
