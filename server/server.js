const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from client
app.use(express.static(path.join(__dirname, '../client')));

// Game State
const rooms = {};

function generateNumbers(count, width, height) {
    const numbers = [];
    const padding = 40;
    const w = width - 2 * padding;
    const h = height - 2 * padding;

    for (let i = 1; i <= count; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = {
                value: i,
                x: padding + Math.random() * w,
                y: padding + Math.random() * h
            };
            attempts++;
        } while (checkOverlap(pos, numbers) && attempts < 100);
        numbers.push(pos);
    }
    return numbers;
}

function checkOverlap(pos, numbers) {
    const minDist = 40;
    return numbers.some(n => {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) < minDist;
    });
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ username }) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = {
            id: roomCode,
            players: [{ id: socket.id, username }],
            numbers: [],
            lines: [],
            currentNumber: 1,
            currentTurnIndex: 0,
            gameStarted: false
        };
        socket.join(roomCode);
        socket.emit('room_created', { roomCode });
        console.log(`Room ${roomCode} created by ${username}`);
    });

    socket.on('join_room', ({ username, roomCode }) => {
        const room = rooms[roomCode];
        if (room && !room.gameStarted) {
            room.players.push({ id: socket.id, username });
            socket.join(roomCode);
            io.to(roomCode).emit('player_joined', { players: room.players });
            console.log(`${username} joined room ${roomCode}`);

            // Auto-start if 2 players (for simplicity now)
            if (room.players.length === 2) {
                room.gameStarted = true;
                // Generate numbers (assuming standard canvas size for now, sync later?)
                // We'll assume a fixed logical size or sync ratio. 
                // Let's use a fixed logical size 800x600 for generation.
                room.numbers = generateNumbers(20, 800, 600);
                io.to(roomCode).emit('game_start', {
                    numbers: room.numbers,
                    currentTurn: room.players[0].id
                });
            }
        } else {
            socket.emit('error', { message: 'Room not found or game started' });
        }
    });

    socket.on('submit_move', ({ roomCode, line }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Validate turn
        const player = room.players[room.currentTurnIndex];
        if (player.id !== socket.id) return;

        // Update state
        room.lines.push(line);
        room.currentNumber++;

        // Switch turn
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        const nextPlayerId = room.players[room.currentTurnIndex].id;

        io.to(roomCode).emit('move_made', {
            line,
            nextNumber: room.currentNumber,
            currentTurn: nextPlayerId
        });
    });

    socket.on('game_over', ({ roomCode, reason }) => {
        io.to(roomCode).emit('game_over', { reason, loser: socket.id });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle cleanup...
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

