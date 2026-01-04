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

function scheduleCleanup(roomCode) {
    if (!rooms[roomCode]) return; // Already deleted

    const cleanupDelay = 3 * 24 * 60 * 60 * 1000; // 3 days
    const timeSinceLastActivity = Date.now() - rooms[roomCode].lastActivity;

    if (timeSinceLastActivity >= cleanupDelay) {
        // Notify players before deletion
        if (rooms[roomCode].players) {
            rooms[roomCode].players.forEach(p => {
                io.to(p.id).emit('room_deleted', { roomCode });
                io.to(p.id).emit('my_games_update');
            });
        }

        delete rooms[roomCode];
        console.log(`Room ${roomCode} deleted (inactivity timeout)`);
    } else {
        // Check again when it would expire
        const nextCheck = cleanupDelay - timeSinceLastActivity;
        // Add a small buffer (e.g. 1000ms) to avoid tight loops if execution is fast
        setTimeout(() => scheduleCleanup(roomCode), nextCheck + 1000);
    }
}

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

                // Debug log
                // console.log(`Sending game ${code}: rematchRequestedBy=${r.rematchRequestedBy}`);

                return {
                    roomCode: code,
                    opponentName: opponent ? opponent.username : 'Esperando...',
                    isMyTurn: r.currentTurn === socket.id,
                    isGameOver: !!r.winner,
                    winner: r.winner,
                    loser: r.loser,
                    rematchRequestedBy: r.rematchRequestedBy
                };
            }).filter(g => g !== null);
            console.log(`Sending ${myGames.length} games to ${token}. Data:`, JSON.stringify(myGames.map(g => ({ code: g.roomCode, rematch: g.rematchRequestedBy }))));
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

    socket.on('create_room', ({ username, pointCount = 20 }) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Initialize game immediately with specified point count
        const numbers = generateNumbers(pointCount, 600, 800);

        rooms[roomCode] = {
            players: [{
                id: socket.id,
                username,
                token: token // Store token
            }],
            numbers: numbers,
            lines: [],
            currentNumber: 1,
            currentTurn: socket.id, // Creator starts first
            lastActivity: Date.now()
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

        // Emit game_start immediately so creator can draw
        // Emit game_start immediately so creator can draw
        socket.emit('game_start', {
            numbers: numbers,
            currentTurn: socket.id
        });

        console.log(`Room ${roomCode} created by ${username} with ${pointCount} points`);
        sendMyGames();

        // Start cleanup timer
        scheduleCleanup(roomCode);
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

                // Send current game state to joining player (game already started when room was created)
                if (room.players.length === 2) {
                    // If turn is null (creator made first move and is waiting), assign turn to joining player
                    if (room.currentTurn === null) {
                        room.currentTurn = socket.id;
                    }

                    // Always send full game state to ensure proper synchronization
                    socket.emit('game_sync', {
                        roomCode,
                        numbers: room.numbers,
                        lines: room.lines,
                        currentNumber: room.currentNumber,
                        currentTurn: room.currentTurn,
                        isGameOver: false,
                        winner: null,
                        loser: null,
                        players: room.players,
                        rematchRequestedBy: room.rematchRequestedBy
                    });

                    // Also notify the creator of the updated turn
                    const creator = room.players.find(p => p.id !== socket.id);
                    if (creator) {
                        io.to(creator.id).emit('move_made', {
                            line: null,
                            nextNumber: room.currentNumber,
                            currentTurn: room.currentTurn
                        });
                    }
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
                isGameOver: !!room.winner,
                winner: room.winner,
                loser: room.loser,
                players: room.players.map(p => ({ username: p.username, token: p.token })),
                rematchRequestedBy: room.rematchRequestedBy
            });
        }
    });

    socket.on('submit_move', ({ roomCode, line }) => {
        const room = rooms[roomCode];
        if (room && room.currentTurn === socket.id) {
            room.lines.push(line);
            room.currentNumber++;

            // Switch turn only if there are 2 players
            if (room.players.length === 2) {
                const nextPlayer = room.players.find(p => p.id !== socket.id);
                room.currentTurn = nextPlayer ? nextPlayer.id : socket.id;
            } else {
                // Set turn to null (waiting for opponent) after creator's first move
                room.currentTurn = null;
            }

            io.to(roomCode).emit('move_made', {
                line,
                nextNumber: room.currentNumber,
                currentTurn: room.currentTurn
            });

            room.lastActivity = Date.now();

            // Notify both players to update their game lists (turn changed)
            room.players.forEach(p => {
                // We need to find their socket... 
                // Ideally we would emit to specific socket IDs, but io.to(socketId) works.
                io.to(p.id).emit('my_games_update'); // Trigger client to fetch list
            });
        }
    });

    socket.on('game_over', ({ roomCode, reason, lastLine }) => {
        const room = rooms[roomCode];
        if (room) {
            // Save the losing line if provided
            if (lastLine) {
                room.lines.push(lastLine);
            }

            // Find loser (current socket)
            const loserPlayer = room.players.find(p => p.id === socket.id);
            room.loser = loserPlayer ? loserPlayer.token : 'unknown';

            // Find winner (the other player)
            const winnerPlayer = room.players.find(p => p.id !== socket.id);
            room.winner = winnerPlayer ? winnerPlayer.token : 'unknown';

            room.lastActivity = Date.now();

            console.log('Game Over Server:', {
                roomCode,
                loserSocket: socket.id,
                loserToken: room.loser,
                winnerToken: room.winner
            });

            io.to(roomCode).emit('game_over', { reason, loser: room.loser, winner: room.winner });

            // Notify for list update
            room.players.forEach(p => io.to(p.id).emit('my_games_update'));

            // Cleanup is handled by the centralized scheduleCleanup function started at creation
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

    socket.on('request_rematch', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            room.rematchRequestedBy = token; // Store who requested
            room.lastActivity = Date.now();

            console.log(`Rematch requested in room ${roomCode} by ${token}`);

            // Find opponent
            const opponent = room.players.find(p => p.id !== socket.id);
            if (opponent) {
                io.to(opponent.id).emit('rematch_requested');
            }

            // Update lists for both (to show status in lobby)
            room.players.forEach(p => io.to(p.id).emit('my_games_update'));
        }
    });

    socket.on('respond_rematch', ({ roomCode, accept }) => {
        const room = rooms[roomCode];
        if (room) {
            const opponent = room.players.find(p => p.id !== socket.id);
            room.lastActivity = Date.now();

            if (accept) {
                // Reset Game
                const pointCount = room.numbers.length; // Keep same difficulty
                room.numbers = generateNumbers(pointCount, 600, 800);
                room.lines = [];
                room.currentNumber = 1;
                room.winner = null;
                room.loser = null;
                room.rematchRequestedBy = null; // Clear request

                // Swap turns for fairness? Or just random? Let's swap.
                // If currentTurn was X, now it's Y.
                // But wait, currentTurn might be null or stuck.
                // Let's just set it to the player who ACCEPTED (socket.id) or the other one.
                // Let's set it to the player who ACCEPTED (socket.id) as requested.
                room.currentTurn = socket.id;

                // Emit Game Restart to BOTH
                io.to(roomCode).emit('game_restarted', {
                    numbers: room.numbers,
                    currentTurn: room.currentTurn
                });

                // Update lists for both (to clear status in lobby)
                room.players.forEach(p => io.to(p.id).emit('my_games_update'));

                console.log(`Rematch started in room ${roomCode}`);

            } else {
                room.rematchRequestedBy = null; // Clear request

                // Notify requester that it was rejected
                if (opponent) {
                    io.to(opponent.id).emit('rematch_rejected');
                }

                // Update lists for both (to clear status in lobby)
                room.players.forEach(p => io.to(p.id).emit('my_games_update'));
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});


if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = {
    server,
    io,
    rooms,
    generateNumbers,
    checkOverlap
};
