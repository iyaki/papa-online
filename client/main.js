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

// Socket.io
const socket = io();

// Game Instance
let game;

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
});

socket.on('room_created', ({ roomCode }) => {
    console.log('Room created:', roomCode);
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

socket.on('error', ({ message }) => {
    alert(message);
});

// UI Events
const restartBtn = document.getElementById('restart-btn');
restartBtn.addEventListener('click', () => {
    // Simple reload to go back to lobby and clear state
    window.location.reload();
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
