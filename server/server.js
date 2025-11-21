const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

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

    // Helper to send list of games
    const sendMyGames = () => {
        if (token && playerSessions[token]) {
            const myGames = playerSessions[token].rooms.map(code => {
                const r = rooms[code];
                if (!r) return null;
                const opponent = r.players.find(p => p.token !== token);
                return {
                    roomCode: code,
                    opponentName: opponent ? opponent.username : 'Esperando...',
                    isMyTurn: r.currentTurn === socket.id,
                    isGameOver: false // Simplified for now
                };
            }).filter(g => g !== null);
            socket.emit('my_games_list', myGames);
        }
    };

    // Check for Reconnection
    if (token && playerSessions[token]) {
        const { username, rooms: userRooms } = playerSessions[token];
        console.log(`Player ${username} reconnected. Rooms: ${userRooms.join(', ')}`);

        userRooms.forEach(roomCode => {
            const room = rooms[roomCode];
            if (room) {
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
                }
            }
        });

        sendMyGames();
    }

    socket.on('get_my_games', () => {
        sendMyGames();
    });

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

        // Save Session (Multi-room)
        if (!playerSessions[token]) {
            playerSessions[token] = { username, rooms: [] };
        }
        playerSessions[token].username = username; // Update username just in case
        if (!playerSessions[token].rooms.includes(roomCode)) {
            playerSessions[token].rooms.push(roomCode);
        }

        socket.join(roomCode);
        socket.emit('room_created', { roomCode, token });
        console.log(`Room ${roomCode} created by ${username}`);
        sendMyGames();
    });

    socket.on('join_room', ({ roomCode, username }) => {
        const room = rooms[roomCode];
        if (room) {
            // Check if already in room
            const existingPlayer = room.players.find(p => p.token === token);
            if (existingPlayer) {
                // Just rejoin/update
                existingPlayer.id = socket.id;
                socket.join(roomCode);
                socket.emit('room_joined', { roomCode, token });

                // Ensure session tracks it
                if (!playerSessions[token]) playerSessions[token] = { username, rooms: [] };
                if (!playerSessions[token].rooms.includes(roomCode)) playerSessions[token].rooms.push(roomCode);

                sendMyGames();

                // If game is running, send sync? Client will ask for it via enterGame -> maybe we need a specific 'get_game_state' event?
                // For now, existing logic relies on 'game_sync' being sent on connection. 
                // We should probably add a 'request_game_sync' event from client.
                return;
            }

            if (room.players.length < 2) {
                room.players.push({
                    id: socket.id,
                    username,
                    token: token
                });

                // Save Session
                if (!playerSessions[token]) {
                    playerSessions[token] = { username, rooms: [] };
                }
                playerSessions[token].username = username;
                if (!playerSessions[token].rooms.includes(roomCode)) {
                    playerSessions[token].rooms.push(roomCode);
                }

                socket.join(roomCode);
                socket.emit('room_joined', { roomCode, token });
                io.to(roomCode).emit('player_joined', { username });

                console.log(`${username} joined room ${roomCode}`);

                // Start Game if 2 players
                if (room.players.length === 2) {
                    room.numbers = generateNumbers(20, 800, 600);
                    room.currentTurn = room.players[0].id;
                    io.to(roomCode).emit('game_start', {
                        numbers: room.numbers,
                        currentTurn: room.currentTurn
                    });
                }
                sendMyGames();
            } else {
                socket.emit('error', 'Room is full');
            }
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    socket.on('request_game_sync', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            socket.emit('game_sync', {
                roomCode: roomCode,
                numbers: room.numbers,
                lines: room.lines,
                currentNumber: room.currentNumber,
                currentTurn: room.currentTurn,
                isGameOver: false
            });
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

            // Notify both players to update their game lists (turn changed)
            room.players.forEach(p => {
                // We need to find their socket... 
                // Ideally we would emit to specific socket IDs, but io.to(socketId) works.
                io.to(p.id).emit('my_games_update'); // Trigger client to fetch list
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
        // This is now "Surrender/Quit"
        const room = rooms[roomCode];
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);

            // Remove from session
            if (token && playerSessions[token]) {
                playerSessions[token].rooms = playerSessions[token].rooms.filter(r => r !== roomCode);
            }

            socket.leave(roomCode);
            console.log(`Player ${socket.id} left room ${roomCode}`);
            io.to(roomCode).emit('player_left', { playerId: socket.id });

            if (room.players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (empty)`);
            }

            socket.emit('left_room_success');
            sendMyGames();
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

