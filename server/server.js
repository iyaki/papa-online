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

// Store mapping of Token -> { roomCode, username }
// In a real app, this would be in a DB/Redis.
const playerSessions = {};

io.on('connection', (socket) => {
    const token = socket.handshake.auth.token;
    console.log(`User connected: ${socket.id} (Token: ${token})`);

    // Check for Reconnection
    if (token && playerSessions[token]) {
        const { roomCode, username } = playerSessions[token];
        const room = rooms[roomCode];

        if (room) {
            console.log(`Player ${username} reconnected to room ${roomCode}`);

            // Update player's socket ID in the room
            const player = room.players.find(p => p.token === token);
            if (player) {
                const oldSocketId = player.id;

                // If it was this player's turn, update the turn ID to the new socket ID
                if (room.currentTurn === oldSocketId) {
                    room.currentTurn = socket.id;
                }

                player.id = socket.id; // Update active socket ID
                socket.join(roomCode);

                // Send Sync Event
                socket.emit('game_sync', {
                    roomCode: roomCode,
                    numbers: room.numbers,
                    lines: room.lines,
                    currentNumber: room.currentNumber,
                    currentTurn: room.currentTurn,
                    isGameOver: false // TODO: Store game over state in room if needed
                });

                // Notify others? Not strictly necessary for async, but good for "Online" status.
            }
        }
    }

    socket.on('create_room', ({ username }) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = {
            players: [{
                id: socket.id,
                username,
                token: token // Store token
            }],
            numbers: [],
            lines: [],
            currentNumber: 1,
            currentTurn: null
        };

        // Save Session
        playerSessions[token] = { roomCode, username };

        socket.join(roomCode);
        socket.emit('room_created', { roomCode, token }); // Emit token back to client
        console.log(`Room ${roomCode} created by ${username}`);
    });

    socket.on('join_room', ({ roomCode, username }) => {
        const room = rooms[roomCode];
        if (room) {
            if (room.players.length < 2) {
                room.players.push({
                    id: socket.id,
                    username,
                    token: token // Store token
                });

                // Save Session
                playerSessions[token] = { roomCode, username };

                socket.join(roomCode);
                socket.emit('room_joined', { roomCode, token }); // Emit token back to client
                io.to(roomCode).emit('player_joined', { username }); // Notify others

                console.log(`${username} joined room ${roomCode}`);

                // Start Game if 2 players
                if (room.players.length === 2) {
                    room.numbers = generateNumbers(20, 800, 600); // Use fixed size for now
                    room.currentTurn = room.players[0].id; // First player starts
                    io.to(roomCode).emit('game_start', {
                        numbers: room.numbers,
                        currentTurn: room.currentTurn
                    });
                }
            } else {
                socket.emit('error', 'Room is full');
            }
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    socket.on('submit_move', ({ roomCode, line }) => {
        const room = rooms[roomCode];
        if (room && room.currentTurn === socket.id) {
            room.lines.push(line);
            room.currentNumber++;

            // Switch turn
            const nextPlayer = room.players.find(p => p.id !== socket.id);
            room.currentTurn = nextPlayer ? nextPlayer.id : null;

            io.to(roomCode).emit('move_made', {
                line,
                nextNumber: room.currentNumber,
                currentTurn: room.currentTurn
            });
        }
    });

    socket.on('game_over', ({ roomCode, reason }) => {
        const room = rooms[roomCode];
        if (room) {
            io.to(roomCode).emit('game_over', { reason, loser: socket.id });
        }
    });

    socket.on('leave_room', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            // Remove player from room
            room.players = room.players.filter(p => p.id !== socket.id);

            // Clear Session
            if (token && playerSessions[token]) {
                delete playerSessions[token];
            }

            socket.leave(roomCode);
            console.log(`Player ${socket.id} left room ${roomCode}`);

            // Notify others
            io.to(roomCode).emit('player_left', { playerId: socket.id });

            // If room is empty, delete it
            if (room.players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (empty)`);
            }

            socket.emit('left_room_success');
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // We DO NOT remove the player from the room or session to allow reconnection.
        // In a real app, we might have a timeout to clean up abandoned rooms.
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

