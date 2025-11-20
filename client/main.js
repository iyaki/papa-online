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

// Session Management
let sessionToken = localStorage.getItem('session_token');
if (!sessionToken) {
    sessionToken = crypto.randomUUID();
    localStorage.setItem('session_token', sessionToken);
}

// Socket.io
const socket = io({
    auth: {
        token: sessionToken
    }
});

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

surrenderBtn.addEventListener('click', () => {
    if (game && game.roomCode && !game.isGameOver) {
        if (confirm("¿Estás seguro de que quieres rendirte?")) {
            socket.emit('game_over', { roomCode: game.roomCode, reason: "El oponente se rindió" });
            // We don't need to call game.gameOver() locally immediately, 
            // the server will send 'game_over' event back to us (and opponent).
        }
    }
});

createRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Por favor ingresa un nombre');
        return;
    }
    socket.emit('create_room', { username });
});

joinRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const roomCode = roomCodeInput.value.trim();
    if (!username || !roomCode) {
        alert('Ingresa nombre y código de sala');
        return;
    }
    socket.emit('join_room', { username, roomCode });
    enterGame(roomCode); // Optimistic entry, server will error if failed
});

function enterGame(roomCode) {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.innerText = roomCode;

    const canvas = document.getElementById('game-canvas');
    const username = usernameInput.value.trim();

    // Initialize Game with Socket
    game = new Game(canvas, username, roomCode, socket);
}
