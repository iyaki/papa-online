// main.js: entry point
// Carga idioma y renderiza pantalla de inicio desde HTML plano
let lang = localStorage.getItem("lang") || "es";
let i18n = {};
let config = {};
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
    config.players = parseInt(document.getElementById("players").value, 10);
    config.range = parseInt(document.getElementById("range").value, 10);
    startGame();
  };
}

function startGame() {
  fetch("src/game.html").then(r => r.text()).then(gameHtml => {
    document.getElementById("app").innerHTML = gameHtml;
    renderGame();
  });
}

function renderGame() {
  // Mostrar info de turno (por ahora solo el primer jugador)
  document.getElementById("turn-info").textContent = i18n.player_turn.replace("{{player}}", 1);
  document.getElementById("restart-btn").textContent = i18n.restart;
  document.getElementById("restart-btn").onclick = () => location.reload();

  // Área de juego cuadrada y responsiva
  const wrapper = document.getElementById("game-area-wrapper");
  const area = document.getElementById("game-area");
  const size = Math.min(window.innerWidth, window.innerHeight * 0.7, 400);
  area.innerHTML = `<svg id='game-svg' width='${size}' height='${size}' style='background:#fffbe7;border:1px solid #b48a78;display:block;margin:auto'></svg>`;

  // Distribuir números aleatoriamente
  const svg = document.getElementById("game-svg");
  const n = config.range;
  const radius = 18;
  const margin = 30;
  let positions = [];
  let tries = 0;
  while (positions.length < n && tries < 1000) {
    const x = Math.random() * (size - 2 * margin) + margin;
    const y = Math.random() * (size - 2 * margin) + margin;
    if (positions.every(p => Math.hypot(p.x - x, p.y - y) > radius * 2.2)) {
      positions.push({ x, y });
    }
    tries++;
  }
  positions = positions.map((p, i) => ({ ...p, num: i + 1 }));
  positions.forEach(p => {
    svg.innerHTML += `<circle cx='${p.x}' cy='${p.y}' r='${radius}' fill='#fff' stroke='#b48a78' stroke-width='2'/><text x='${p.x}' y='${p.y + 6}' text-anchor='middle' font-size='18' font-family='inherit' fill='#333'>${p.num}</text>`;
  });
}
