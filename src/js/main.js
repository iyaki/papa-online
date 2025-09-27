// main.js: entry point
// Carga idioma y renderiza pantalla de inicio desde HTML plano
let lang = localStorage.getItem("lang") || "es";
let i18n = {};
let config = {};
let gameState = {};
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
  document.getElementById("label-lang").innerHTML = `${i18n.select_language}: <select id=\"lang-select\"><option value=\"es\">Español</option><option value=\"en\">English</option></select>`;
  document.getElementById("lang-select").value = lang;
  document.getElementById("lang-select").onchange = e => {
    localStorage.setItem("lang", e.target.value);
    location.reload();
  };

  // Jugadores
  document.getElementById("label-players").innerHTML = `${i18n.select_players}: <input type=\"number\" id=\"players\" min=\"2\" max=\"6\" value=\"2\">`;

  // Rango
  document.getElementById("label-range").innerHTML = `${i18n.select_range}: <input type=\"number\" id=\"range\" min=\"5\" max=\"30\" value=\"10\">`;

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
    setupGameState();
    renderGame();
  });
}

function setupGameState() {
  // Inicializa jugadores y estado
  gameState.players = Array.from({length: config.players}, (_, i) => ({id: i+1, active: true}));
  gameState.currentTurn = 0;
  gameState.lines = [];
  gameState.connected = [];
  gameState.disqualified = [];
  gameState.nextNumber = 1;
}

function renderGame() {
  // Mostrar info de turno
  updateTurnInfo();
  document.getElementById("restart-btn").textContent = i18n.restart;
  document.getElementById("restart-btn").onclick = () => location.reload();

  // Área de juego cuadrada y responsiva
  const area = document.getElementById("game-area");
  const size = Math.min(window.innerWidth, window.innerHeight * 0.7, 400);
  area.innerHTML = `<svg id='game-svg' width='${size}' height='${size}' style='background:#fffbe7;border:1px solid #b48a78;display:block;margin:auto;touch-action:none'></svg>`;

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
  gameState.positions = positions;
  drawNumbers(svg, positions, radius);
  setupDragInteraction(svg, positions, radius);
  renderPlayersList();
}

function updateTurnInfo() {
  // Busca el siguiente jugador activo
  let idx = gameState.currentTurn;
  while (!gameState.players[idx].active) {
    idx = (idx + 1) % gameState.players.length;
  }
  gameState.currentTurn = idx;
  document.getElementById("turn-info").textContent = i18n.player_turn.replace("{{player}}", gameState.players[idx].id);
}

function drawNumbers(svg, positions, radius) {
  svg.innerHTML = '';
  positions.forEach(p => {
    svg.innerHTML += `<circle class='num-circle' data-num='${p.num}' cx='${p.x}' cy='${p.y}' r='${radius}' fill='#fff' stroke='#b48a78' stroke-width='2'/><text x='${p.x}' y='${p.y + 6}' text-anchor='middle' font-size='18' font-family='inherit' fill='#333'>${p.num}</text>`;
  });
  // Dibuja líneas ya conectadas
  gameState.lines.forEach(line => {
    svg.innerHTML += `<line x1='${line.x1}' y1='${line.y1}' x2='${line.x2}' y2='${line.y2}' stroke='#b48a78' stroke-width='3'/>`;
  });
}

function setupDragInteraction(svg, positions, radius) {
  let dragging = false;
  let startNum = null;
  let startPt = null;
  let dragLine = null;

  svg.addEventListener('touchstart', e => {
    const pt = getTouchPoint(e, svg);
    const hit = hitTestCircle(pt, positions, radius);
    if (hit && hit.num === gameState.nextNumber) {
      dragging = true;
      startNum = hit.num;
      startPt = hit;
      dragLine = createSVGLine(svg, hit.x, hit.y, hit.x, hit.y);
    }
  });
  svg.addEventListener('touchmove', e => {
    if (!dragging || !dragLine) return;
    const pt = getTouchPoint(e, svg);
    dragLine.setAttribute('x2', pt.x);
    dragLine.setAttribute('y2', pt.y);
  });
  svg.addEventListener('touchend', e => {
    if (!dragging || !dragLine) return;
    const pt = getTouchPoint(e, svg);
    const hit = hitTestCircle(pt, positions, radius);
    if (hit && hit.num === gameState.nextNumber + 1) {
      // Validar reglas
      const valid = validateLine(startPt, hit, gameState.lines, positions, radius);
      if (valid) {
        // Añadir línea
        gameState.lines.push({x1: startPt.x, y1: startPt.y, x2: hit.x, y2: hit.y});
        gameState.nextNumber++;
        if (gameState.nextNumber === positions.length) {
          // Ganador
          showEndScreen(gameState.players[gameState.currentTurn].id);
        } else {
          nextTurn();
        }
      } else {
        // Descalificar jugador
        disqualifyCurrentPlayer();
      }
    } else {
      // Descalificar jugador
      disqualifyCurrentPlayer();
    }
    dragging = false;
    dragLine.remove();
    drawNumbers(svg, positions, radius);
  });
}

function getTouchPoint(e, svg) {
  const rect = svg.getBoundingClientRect();
  const touch = e.touches[0] || e.changedTouches[0];
  return {
    x: (touch.clientX - rect.left) * (svg.width.baseVal.value / rect.width),
    y: (touch.clientY - rect.top) * (svg.height.baseVal.value / rect.height)
  };
}

function hitTestCircle(pt, positions, radius) {
  return positions.find(p => Math.hypot(p.x - pt.x, p.y - pt.y) < radius);
}

function createSVGLine(svg, x1, y1, x2, y2) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', '#b48a78');
  line.setAttribute('stroke-width', '3');
  svg.appendChild(line);
  return line;
}

function validateLine(start, end, lines, positions, radius) {
  // 1. No cruzar líneas existentes
  for (const l of lines) {
    if (doIntersect([start.x, start.y], [end.x, end.y], [l.x1, l.y1], [l.x2, l.y2])) return false;
  }
  // 2. No tocar otros números
  for (const p of positions) {
    if (p.num !== start.num && p.num !== end.num) {
      const dist = pointToSegmentDistance(p, start, end);
      if (dist < radius) return false;
    }
  }
  return true;
}

// Algoritmo de intersección de segmentos (GeeksforGeeks)
function onSegment(p, q, r) {
  return (q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
          q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]));
}
function orientation(p, q, r) {
  let val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (val === 0) return 0;
  return (val > 0) ? 1 : 2;
}
function doIntersect(p1, q1, p2, q2) {
  let o1 = orientation(p1, q1, p2);
  let o2 = orientation(p1, q1, q2);
  let o3 = orientation(p2, q2, p1);
  let o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}
// Distancia punto-segmento
function pointToSegmentDistance(P, A, B) {
  const APx = P.x - A.x, APy = P.y - A.y;
  const ABx = B.x - A.x, ABy = B.y - A.y;
  const ab2 = ABx*ABx + ABy*ABy;
  const ap_ab = APx*ABx + APy*ABy;
  let t = ab2 ? ap_ab / ab2 : -1;
  t = Math.max(0, Math.min(1, t));
  const closest = {x: A.x + ABx * t, y: A.y + ABy * t};
  const dx = P.x - closest.x, dy = P.y - closest.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function nextTurn() {
  let idx = gameState.currentTurn;
  do {
    idx = (idx + 1) % gameState.players.length;
  } while (!gameState.players[idx].active);
  gameState.currentTurn = idx;
  updateTurnInfo();
}

function disqualifyCurrentPlayer() {
  const idx = gameState.currentTurn;
  gameState.players[idx].active = false;
  // Feedback visual
  document.getElementById("turn-info").textContent = i18n.disqualified;
  setTimeout(() => {
    // Si solo queda uno activo, es el ganador
    if (gameState.players.filter(p => p.active).length === 1) {
      showEndScreen(gameState.players.find(p => p.active).id);
    } else {
      nextTurn();
    }
  }, 1200);
}

function renderPlayersList() {
  let html = '<div id="players-list" style="margin:8px 0 12px 0;">';
  gameState.players.forEach((p, i) => {
    html += `<span class="player-badge${p.active ? (i === gameState.currentTurn ? ' active' : '') : ' disqualified'}">${i18n.player_turn.replace("{{player}}", p.id)}</span> `;
  });
  html += '</div>';
  document.getElementById("game-header").insertAdjacentHTML('beforeend', html);
}

function showEndScreen(winnerId) {
  const disq = gameState.players.filter(p => !p.active).map(p => i18n.player_turn.replace("{{player}}", p.id));
  let html = `<div class="end-screen" style="margin-top:24px;text-align:center;">
    <h2>${i18n.winner} ${i18n.player_turn.replace("{{player}}", winnerId)}</h2>
    <p>${disq.length ? 'Descalificados: ' + disq.join(', ') : ''}</p>
    <button onclick="location.reload()">${i18n.restart}</button>
  </div>`;
  document.getElementById("app").innerHTML += html;
}
