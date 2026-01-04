import { Game } from './game.js';

console.log('Juego de la Papa Online - Initializing...');

// FAQ Logic
const faqBtn = document.getElementById('faq-btn');
const faqScreen = document.getElementById('faq-screen');
const closeFaqBtn = document.getElementById('close-faq-btn');

faqBtn.addEventListener('click', () => {
    console.log('FAQ Button Clicked');
    faqScreen.classList.remove('hidden');
});

closeFaqBtn.addEventListener('click', () => {
    console.log('Close FAQ Button Clicked');
    faqScreen.classList.add('hidden');
});

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const shareBtn = document.getElementById('share-btn');

// ... (existing code)

// Share Button Logic
shareBtn.addEventListener('click', async () => {
    const roomCode = roomCodeDisplay.innerText;
    if (!roomCode) return;

    const shareData = {
        title: 'Juego de la Papa Online',
        text: `¡Únete a mi partida! Código: ${roomCode}`,
        url: `${window.location.origin}/?room=${roomCode}`
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Error sharing:', err);
        }
    } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareData.url).then(() => {
            const originalText = shareBtn.innerText;
            shareBtn.innerText = "¡Copiado!";
            setTimeout(() => shareBtn.innerText = originalText, 2000);
        }).catch(err => {
            console.error('Error copying link:', err);
        });
    }
});



// Helper for UUID generation (fallback for non-secure contexts)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Session Management
let sessionToken = localStorage.getItem('session_token');
if (!sessionToken) {
    sessionToken = generateUUID();
    localStorage.setItem('session_token', sessionToken);
}

// Socket.io
const socket = io({
    auth: {
        token: sessionToken
    }
});

// Check for Room in URL (Auto-join / Pre-fill)
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');

if (roomFromUrl) {
    console.log('Room found in URL:', roomFromUrl);
    roomCodeInput.value = roomFromUrl;

    // Check if we have a username
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        // Auto-join
        console.log('Auto-joining room:', roomFromUrl);
        socket.emit('join_room', { roomCode: roomFromUrl, username: savedUsername });
    } else {
        // Focus username input
        usernameInput.focus();
        // Visual hint: Pulse the join button
        joinRoomBtn.classList.add('pulse-btn');
        // Optional: Show a message
        // alert(`Ingresa tu nombre para unirte a la sala ${roomFromUrl}`);
    }
}

// Remove pulse effect when button is clicked
joinRoomBtn.addEventListener('mousedown', () => {
    joinRoomBtn.classList.remove('pulse-btn');
});

// Request notification permission on page load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Helper to check if page is visible
function isPageVisible() {
    return !document.hidden;
}

// Helper to send notification
function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted' && !isPageVisible()) {
        const notification = new Notification(title, {
            body: body,
            icon: '/favicon.ico', // You can add a custom icon
            badge: '/favicon.ico',
            tag: 'turn-notification', // Replaces previous notification
            requireInteraction: false
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Focus window when notification is clicked
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

// Confetti animation for winners
function createConfetti() {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 3;

        for (let i = 0; i < particleCount; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.top = '-10px';
            confetti.style.opacity = '1';
            confetti.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
            confetti.style.transition = 'all ' + (2 + Math.random() * 2) + 's ease-out';
            confetti.style.zIndex = '10000';
            confetti.style.pointerEvents = 'none';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';

            document.body.appendChild(confetti);

            setTimeout(() => {
                confetti.style.top = window.innerHeight + 'px';
                confetti.style.opacity = '0';
                confetti.style.transform = 'rotate(' + (Math.random() * 720) + 'deg)';
            }, 50);

            setTimeout(() => {
                confetti.remove();
            }, 4000);
        }
    }, 50);
}

// Game Instance
let game;

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
});

socket.on('room_created', ({ roomCode }) => {
    console.log('Room created:', roomCode);
    enterGame(roomCode);
});

socket.on('room_joined', ({ roomCode }) => {
    console.log('Joined room:', roomCode);
    enterGame(roomCode);
});

socket.on('player_joined', ({ username }) => {
    console.log('Player joined:', username);

    // Store opponent name for stats (the joining player is the opponent for room creator)
    if (game && username && username !== usernameInput.value.trim()) {
        game.opponentName = username;
        console.log('Opponent name set to:', game.opponentName);
    }
});

socket.on('game_start', ({ numbers, currentTurn }) => {
    console.log('Game Starting!', numbers);
    if (game) {
        game.startGame(numbers, currentTurn);
    }
});

// Listen for move_made to send notifications
socket.on('move_made', ({ line, nextNumber, currentTurn }) => {
    // Check if it's now my turn and send notification
    if (game && currentTurn === game.myPlayerId) {
        const opponentName = game.opponentName || 'Tu oponente';
        sendNotification('Papa Online - ¡Es tu turno!', `${opponentName} hizo su jugada. Ahora te toca a ti.`);
    }
});

// Reconnection / Sync Event
socket.on('game_sync', ({ roomCode, numbers, lines, currentNumber, currentTurn, isGameOver, winner, loser, players, rematchRequestedBy }) => {
    console.log("Reconnected to game:", roomCode);

    // Restore UI
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.innerText = roomCode;

    const canvas = document.getElementById('game-canvas');
    const username = usernameInput.value.trim();

    // Initialize Game if not already
    if (!game) {
        game = new Game(canvas, username, roomCode, socket, sessionToken);
    } else {
        game.roomCode = roomCode; // Update game room code
        game.username = username; // Update username if new game
    }

    // Restore Game State
    game.syncState(numbers, lines, currentNumber, currentTurn, isGameOver);

    // Store metadata for export
    game.winner = winner;
    game.loser = loser;

    if (players && players.length > 0) {
        const opponent = players.find(p => p.token !== sessionToken);
        game.opponentName = opponent ? opponent.username : 'Oponente';
    } else {
        game.opponentName = 'Oponente';
    }

    // Handle Rematch State
    if (isGameOver) {
        // Show Game Over Screen
        document.getElementById('game-over-screen').classList.remove('hidden');

        // Update message
        const message = document.getElementById('game-over-message');
        if (winner === sessionToken) {
            message.innerText = "¡GANASTE! 🏆";
            message.style.color = "#4caf50";
            createConfetti();
        } else {
            message.innerText = "Juego Terminado 🥔";
            message.style.color = "var(--accent-color)";
        }

        // Check Rematch Status
        const requestContainer = document.getElementById('rematch-request-container');
        const rematchBtn = document.getElementById('rematch-btn');
        const statusText = document.getElementById('rematch-status');

        // Reset UI first
        requestContainer.classList.add('hidden');
        rematchBtn.classList.remove('hidden');
        rematchBtn.disabled = false;
        rematchBtn.innerText = "🔄 Pedir Revancha";
        statusText.classList.add('hidden');

        if (rematchRequestedBy) {
            if (rematchRequestedBy === sessionToken) {
                // I requested it
                rematchBtn.disabled = true;
                rematchBtn.innerText = "Esperando respuesta...";
                statusText.innerText = "Esperando a que el oponente acepte...";
                statusText.classList.remove('hidden');
                statusText.style.color = "#666";
            } else {
                // Opponent requested it
                requestContainer.classList.remove('hidden');
                rematchBtn.classList.add('hidden');
            }
        }
    } else {
        document.getElementById('game-over-screen').classList.add('hidden');
    }

    // Update Local Stats
    if (isGameOver && winner) {
        const isWin = winner === sessionToken;
        updateStats(game.opponentName, isWin, roomCode);
    }
});

// Update stats when game ends in real-time
socket.on('game_over', ({ reason, loser, winner }) => {
    if (game && game.roomCode) {
        const isWin = winner === sessionToken;
        const opponentName = game.opponentName || 'Oponente';
        updateStats(opponentName, isWin, game.roomCode);
    }
});

socket.on('error', ({ message }) => {
    alert(message);
});

socket.on('room_deleted', ({ roomCode }) => {
    console.log(`Room ${roomCode} was deleted by server.`);

    // If we are currently in this room, go back to lobby
    if (game && game.roomCode === roomCode) {
        alert('La sala ha expirado por inactividad.');
        gameScreen.classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        game = null;

        // Clear URL params
        const url = new URL(window.location);
        url.searchParams.delete('room');
        window.history.pushState({}, '', url);
    } else {
        // Just show a toast/notification if we are in lobby
        // Simple alert for now, or a custom toast if we had one. 
        // Since my_games_update will remove it from the list, maybe just a log is enough?
        // Let's use a non-intrusive notification if possible.
        // For now, let's rely on the list update visual cue, but log it.
        // Or if we want to be explicit:
        // sendNotification('Sala Expirada', `La sala ${roomCode} ha sido eliminada por inactividad.`);
    }

    socket.emit('get_my_games');
});

// Rematch Logic
socket.on('rematch_requested', () => {
    const requestContainer = document.getElementById('rematch-request-container');
    const rematchBtn = document.getElementById('rematch-btn');
    const statusText = document.getElementById('rematch-status');

    requestContainer.classList.remove('hidden');
    rematchBtn.classList.add('hidden'); // Hide "Ask for rematch" since opponent already asked
    statusText.classList.add('hidden');

    if (game) game.rematchRequestedBy = 'opponent'; // Mark as active
});

socket.on('rematch_rejected', () => {
    const statusText = document.getElementById('rematch-status');
    statusText.innerText = "El oponente rechazó la revancha.";
    statusText.classList.remove('hidden');
    statusText.style.color = "#f44336";

    // Re-enable button? Or just leave it.
    document.getElementById('rematch-btn').disabled = false;
    document.getElementById('rematch-btn').innerText = "Pedir Revancha";

    if (game) game.rematchRequestedBy = null;
});

socket.on('game_restarted', ({ numbers, currentTurn }) => {
    console.log('Game Restarted!', numbers);

    // Hide Game Over Screen
    document.getElementById('game-over-screen').classList.add('hidden');

    // Reset UI elements
    document.getElementById('rematch-request-container').classList.add('hidden');
    document.getElementById('rematch-status').classList.add('hidden');
    document.getElementById('rematch-btn').classList.remove('hidden');
    document.getElementById('rematch-btn').disabled = false;
    document.getElementById('rematch-btn').innerText = "🔄 Pedir Revancha";

    if (game) {
        // Reset local game state
        game.lines = [];
        game.numbers = [];
        game.winner = null;
        game.loser = null;
        game.rematchRequestedBy = null;
        game.startGame(numbers, currentTurn);
    }
});



// UI Events
const restartBtn = document.getElementById('restart-btn');
restartBtn.addEventListener('click', () => {
    // Always soft leave: Just go back to lobby, don't leave the room so it stays in "My Games"
    // This allows accepting rematches later from the lobby.

    gameScreen.classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    lobbyScreen.classList.remove('hidden');

    // Refresh list
    socket.emit('get_my_games');

    // Clear URL params
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);
});

const rematchBtn = document.getElementById('rematch-btn');
rematchBtn.addEventListener('click', () => {
    if (game && game.roomCode) {
        socket.emit('request_rematch', { roomCode: game.roomCode });
        rematchBtn.disabled = true;
        rematchBtn.innerText = "Esperando respuesta...";

        if (game) game.rematchRequestedBy = sessionToken; // I requested it

        const statusText = document.getElementById('rematch-status');
        statusText.innerText = "Esperando a que el oponente acepte...";
        statusText.classList.remove('hidden');
        statusText.style.color = "#666";
    }
});

document.getElementById('accept-rematch-btn').addEventListener('click', () => {
    if (game && game.roomCode) {
        socket.emit('respond_rematch', { roomCode: game.roomCode, accept: true });
    }
});

document.getElementById('reject-rematch-btn').addEventListener('click', () => {
    if (game && game.roomCode) {
        socket.emit('respond_rematch', { roomCode: game.roomCode, accept: false });
        document.getElementById('rematch-request-container').classList.add('hidden');
        document.getElementById('rematch-btn').classList.remove('hidden'); // Show request button again
        if (game) game.rematchRequestedBy = null;
    }
});

const exportBtn = document.getElementById('export-btn');

exportBtn.addEventListener('click', () => {
    if (game) {
        // Calculate Metadata
        const myName = usernameInput.value.trim() || 'Yo';
        const opponentName = game.opponentName || 'Oponente';

        let resultText = 'Juego Terminado';
        let resultColor = '#333';

        if (game.winner) {
            if (game.winner === sessionToken) {
                resultText = '¡GANASTE!';
                resultColor = '#27ae60'; // Green
            } else {
                resultText = 'PERDISTE';
                resultColor = '#c0392b'; // Red
            }
        }

        const footerUrl = window.location.href;

        // Prepare Player Objects
        const player1 = {
            name: myName,
            isWinner: game.winner ? (game.winner === sessionToken) : null
        };

        const player2 = {
            name: opponentName,
            isWinner: game.winner ? (game.winner !== sessionToken) : null
        };

        const dataUrl = game.exportToImage(player1, player2, resultText, resultColor, footerUrl);
        const link = document.createElement('a');
        link.download = `juego-papa-${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
    }
});



// Load Username
const savedUsername = localStorage.getItem('username');
if (savedUsername) {
    usernameInput.value = savedUsername;
}

createRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Por favor ingresa un nombre');
        return;
    }
    const pointCount = parseInt(document.getElementById('point-count-select').value);
    localStorage.setItem('username', username);
    socket.emit('create_room', { username, pointCount });
});

joinRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const roomCode = roomCodeInput.value.trim();
    if (!username || !roomCode) {
        alert('Ingresa nombre y código de sala');
        return;
    }
    localStorage.setItem('username', username);
    socket.emit('join_room', { username, roomCode });
    enterGame(roomCode); // Optimistic entry, server will error if failed

    // Clear input
    roomCodeInput.value = '';
});

const backToMenuBtn = document.getElementById('back-to-menu-btn');
const myGamesList = document.getElementById('my-games-list');

// Multi-game Events
socket.on('my_games_list', (games) => {
    myGamesList.innerHTML = '';
    if (games.length === 0) {
        myGamesList.innerHTML = '<p style="opacity: 0.6;">No tienes partidas activas.</p>';
        return;
    }

    // Sort games: 
    // 1. My Turn
    // 2. Rematch Requested (by me or opponent)
    // 3. Waiting for Opponent
    // 4. Game Over (Completed)
    games.sort((a, b) => {
        const scoreA = getGameSortScore(a);
        const scoreB = getGameSortScore(b);
        return scoreB - scoreA; // Descending order
    });

    games.forEach(g => {
        const div = document.createElement('div');
        div.className = 'game-item';
        div.style.cssText = `
            background: rgba(255,255,255,0.5); 
            padding: 10px; 
            border: 1px solid var(--text-color); 
            border-radius: 5px; 
            cursor: pointer; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
        `;

        let statusHtml = '';
        if (g.isGameOver) {
            if (g.rematchRequestedBy) {
                if (g.rematchRequestedBy === sessionToken) {
                    statusHtml = '<span style="color: #666; font-style: italic;">Esperando revancha...</span>';
                } else {
                    statusHtml = '<span style="color: var(--accent-color); font-weight: bold;">¡Revancha pedida!</span>';
                }
            } else {
                if (g.winner === sessionToken) {
                    statusHtml = '<span style="color: #4caf50; font-weight: bold;">¡Ganaste!</span>';
                } else {
                    statusHtml = '<span style="color: #f44336; font-weight: bold;">Perdiste</span>';
                }
            }
        } else {
            statusHtml = g.isMyTurn ? '<span style="color: var(--accent-color); font-weight: bold;">¡Tu Turno!</span>' : 'Esperando...';
        }

        div.innerHTML = `
            <span>Sala: <b>${g.roomCode}</b> vs ${g.opponentName}</span>
            ${statusHtml}
        `;

        div.addEventListener('click', () => {
            enterGame(g.roomCode, g.opponentName);
        });

        myGamesList.appendChild(div);
    });
});

socket.on('my_games_update', () => {
    socket.emit('get_my_games');
});

backToMenuBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');

    // Clear URL params to prevent auto-join on refresh
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);

    game = null; // Clear current game instance to avoid conflicts? Or keep it? 
    // Better to clear it or pause it.
    socket.emit('get_my_games'); // Refresh list
});

function enterGame(roomCode, opponentName = null) {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.innerText = roomCode;

    const canvas = document.getElementById('game-canvas');
    const username = usernameInput.value.trim();

    // Request full state for this game
    socket.emit('request_game_sync', { roomCode });

    // Initialize Game with Socket (Wait for sync to populate data)
    if (!game) {
        game = new Game(canvas, username, roomCode, socket, sessionToken);
    } else {
        game.roomCode = roomCode;
        game.username = username;
        game.socket = socket;

        // Only clear if it's a DIFFERENT room (or if we want to force reset)
        // If it's the same room, we might be reconnecting, so keep data until sync arrives
        if (game.roomCode !== roomCode) {
            game.lines = [];
            game.numbers = [];
        }
        requestAnimationFrame(() => game.resizeCanvas());
    }

    if (opponentName) {
        game.opponentName = opponentName;
    }

    setTimeout(() => {
        if (game) game.resizeCanvas();
    }, 100);
}

function getGameSortScore(g) {
    if (g.isGameOver) {
        if (g.rematchRequestedBy) {
            if (g.rematchRequestedBy !== sessionToken) return 3; // Opponent asked for rematch (High priority!)
            return 2; // I asked for rematch
        }
        return 0; // Just finished
    }
    if (g.isMyTurn) return 4; // My turn (Highest priority for active games)
    return 1; // Waiting for opponent
}


// --- Local Statistics ---

function loadStats() {
    const stored = localStorage.getItem('papa_online_stats');
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        totalWins: 0,
        totalLosses: 0,
        opponents: {}, // { "Name": { wins: 0, losses: 0 } }
        processedGames: [] // List of roomCodes
    };
}

function saveStats(stats) {
    localStorage.setItem('papa_online_stats', JSON.stringify(stats));
}

function updateStats(opponentName, isWin, roomCode) {
    const stats = loadStats();

    // Prevent double counting
    if (stats.processedGames.includes(roomCode)) {
        return;
    }

    stats.processedGames.push(roomCode);

    // Update Totals
    if (isWin) {
        stats.totalWins++;
    } else {
        stats.totalLosses++;
    }

    // Update Opponent Stats
    if (!opponentName) opponentName = "Desconocido";

    if (!stats.opponents[opponentName]) {
        stats.opponents[opponentName] = { wins: 0, losses: 0 };
    }

    if (isWin) {
        stats.opponents[opponentName].wins++;
    } else {
        stats.opponents[opponentName].losses++;
    }

    saveStats(stats);
    console.log("Stats updated:", stats);
}

function showStats() {
    const stats = loadStats();
    const statsScreen = document.getElementById('stats-screen');
    const list = document.getElementById('stats-list');

    document.getElementById('total-wins').innerText = stats.totalWins;
    document.getElementById('total-losses').innerText = stats.totalLosses;

    list.innerHTML = '';

    // Sort opponents by total games played
    const sortedOpponents = Object.entries(stats.opponents).sort((a, b) => {
        const totalA = a[1].wins + a[1].losses;
        const totalB = b[1].wins + b[1].losses;
        return totalB - totalA;
    });

    if (sortedOpponents.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Aún no hay estadísticas.</div>';
    } else {
        sortedOpponents.forEach(([name, data]) => {
            const item = document.createElement('div');
            item.className = 'stats-item';
            item.innerHTML = `
                <span class="stats-name">${name}</span>
                <span class="stats-score">
                    <span style="color: #4caf50;">${data.wins} 🏆</span> - 
                    <span style="color: #f44336;">${data.losses} 💔</span>
                </span>
            `;
            list.appendChild(item);
        });
    }

    lobbyScreen.classList.add('hidden');
    statsScreen.classList.remove('hidden');
}

document.getElementById('stats-btn').addEventListener('click', showStats);
document.getElementById('close-stats-btn').addEventListener('click', () => {
    document.getElementById('stats-screen').classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
});
