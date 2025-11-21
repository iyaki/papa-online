import { Game } from './game.js';

console.log('Juego de la Papa Online - Initializing...');

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
        // Optional: Show a message
        alert(`Ingresa tu nombre para unirte a la sala ${roomFromUrl}`);
    }
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

socket.on('player_joined', ({ players }) => {
    console.log('Players updated:', players);
    // TODO: Update player list UI
});

socket.on('game_start', ({ numbers, currentTurn }) => {
    console.log('Game Starting!', numbers);
    if (game) {
        game.startGame(numbers, currentTurn);
    }
});

// Reconnection / Sync Event
socket.on('game_sync', ({ roomCode, numbers, lines, currentNumber, currentTurn, isGameOver }) => {
    console.log("Reconnected to game:", roomCode);

    // Restore UI
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.innerText = roomCode;

    const canvas = document.getElementById('game-canvas');
    const username = usernameInput.value.trim();

    // Initialize Game if not already
    if (!game) {
        game = new Game(canvas, username, roomCode, socket);
    } else {
        game.roomCode = roomCode; // Update game room code
        game.username = username; // Update username if new game
    }

    // Restore Game State
    game.syncState(numbers, lines, currentNumber, currentTurn, isGameOver);
});

socket.on('error', ({ message }) => {
    alert(message);
});

const surrenderBtn = document.getElementById('surrender-btn');

// UI Events
const restartBtn = document.getElementById('restart-btn');
restartBtn.addEventListener('click', () => {
    if (game && game.roomCode) {
        socket.emit('leave_room', { roomCode: game.roomCode });
    }
    // Fallback reload
    setTimeout(() => {
        window.location.reload();
    }, 100);
});

const exportBtn = document.getElementById('export-btn');

exportBtn.addEventListener('click', () => {
    if (game) {
        const dataUrl = game.exportToImage();
        const link = document.createElement('a');
        link.download = `juego-papa-${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
    }
});

surrenderBtn.addEventListener('click', () => {
    if (game && game.roomCode && !game.isGameOver) {
        if (confirm("¿Estás seguro de que quieres rendirte?")) {
            socket.emit('game_over', { roomCode: game.roomCode, reason: "El oponente se rindió" });
            // We don't need to call game.gameOver() locally immediately, 
            // the server will send 'game_over' event back to us (and opponent).
        }
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
    localStorage.setItem('username', username);
    socket.emit('create_room', { username });
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
            if (g.winner === sessionToken) {
                statusHtml = '<span style="color: #4caf50; font-weight: bold;">¡Ganaste!</span>';
            } else {
                statusHtml = '<span style="color: #f44336; font-weight: bold;">Perdiste</span>';
            }
        } else {
            statusHtml = g.isMyTurn ? '<span style="color: var(--accent-color); font-weight: bold;">¡Tu Turno!</span>' : 'Esperando...';
        }

        div.innerHTML = `
            <span>Sala: <b>${g.roomCode}</b> vs ${g.opponentName}</span>
            ${statusHtml}
        `;

        div.addEventListener('click', () => {
            enterGame(g.roomCode);
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
    game = null; // Clear current game instance to avoid conflicts? Or keep it? 
    // Better to clear it or pause it.
    socket.emit('get_my_games'); // Refresh list
});

function enterGame(roomCode) {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.innerText = roomCode;

    const canvas = document.getElementById('game-canvas');
    const username = usernameInput.value.trim();

    // Request full state for this game
    socket.emit('request_game_sync', { roomCode });

    // Initialize Game with Socket (Wait for sync to populate data)
    if (!game) {
        game = new Game(canvas, username, roomCode, socket);
    } else {
        game.roomCode = roomCode;
        game.username = username;
        game.socket = socket;
        game.lines = []; // Clear previous game data
        game.numbers = [];
        requestAnimationFrame(() => game.resizeCanvas());
    }

    setTimeout(() => {
        if (game) game.resizeCanvas();
    }, 100);
}
