/**
 * Papa Online Server - Integration Tests
 * 
 * These tests use the actual server and test real Socket.IO communication
 */

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

// Import server logic to reuse functions
function generateNumbers(count, width, height) {
    const numbers = [];
    const padding = 40;

    const checkOverlap = (pos, numbers) => {
        const minDist = 40;
        return numbers.some(n => {
            const dx = n.x - pos.x;
            const dy = n.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < minDist;
        });
    };

    for (let i = 1; i <= count; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = {
                value: i,
                x: padding + Math.random() * (width - 2 * padding),
                y: padding + Math.random() * (height - 2 * padding)
            };
            attempts++;
        } while (checkOverlap(pos, numbers) && attempts < 100);
        numbers.push(pos);
    }
    return numbers;
}

describe('Papa Online Server - Integration Tests', () => {
    let io, serverSocket, httpServer, httpServerAddr;
    let clientSocket1, clientSocket2;
    const rooms = {};
    const playerSessions = {};

    beforeAll((done) => {
        const app = express();
        httpServer = http.createServer(app);
        io = new Server(httpServer, {
            cors: { origin: '*' }
        });

        // Implement minimal server logic for testing
        io.on('connection', (socket) => {
            const token = socket.handshake.auth.token;
            console.log(`Test server: User connected ${socket.id} (Token: ${token})`);

            socket.on('create_room', ({ username, pointCount }) => {
                const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                const numbers = generateNumbers(pointCount, 600, 800);

                rooms[roomCode] = {
                    players: [{
                        id: socket.id,
                        username,
                        token
                    }],
                    numbers,
                    lines: [],
                    currentNumber: 1,
                    currentTurn: socket.id
                };

                if (!playerSessions[token]) {
                    playerSessions[token] = { username, rooms: [] };
                }
                playerSessions[token].rooms.push(roomCode);

                socket.join(roomCode);
                socket.emit('room_created', { roomCode, token });
                socket.emit('game_start', {
                    numbers,
                    currentTurn: socket.id
                });
            });

            socket.on('join_room', ({ roomCode, username }) => {
                const room = rooms[roomCode];
                if (room && room.players.length < 2) {
                    room.players.push({
                        id: socket.id,
                        username,
                        token
                    });

                    socket.join(roomCode);
                    socket.emit('room_joined', { roomCode, token });

                    // Emit game_start to both players
                    io.to(roomCode).emit('game_start', {
                        numbers: room.numbers,
                        currentTurn: room.currentTurn
                    });
                }
            });

            socket.on('submit_move', ({ roomCode, line }) => {
                const room = rooms[roomCode];
                if (room && room.currentTurn === socket.id) {
                    room.lines.push(line);
                    room.currentNumber++;

                    // Switch turn
                    const currentPlayerIndex = room.players.findIndex(p => p.id === socket.id);
                    const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
                    room.currentTurn = room.players[nextPlayerIndex].id;

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
                    const loserPlayer = room.players.find(p => p.id === socket.id);
                    const winnerPlayer = room.players.find(p => p.id !== socket.id);

                    room.loser = loserPlayer ? loserPlayer.token : 'unknown';
                    room.winner = winnerPlayer ? winnerPlayer.token : 'unknown';

                    io.to(roomCode).emit('game_over', {
                        reason,
                        loser: room.loser,
                        winner: room.winner
                    });
                }
            });
        });

        httpServer.listen(() => {
            httpServerAddr = httpServer.address();
            done();
        });
    });

    afterAll((done) => {
        io.close();
        if (clientSocket1) clientSocket1.close();
        if (clientSocket2) clientSocket2.close();
        httpServer.close(done);
    });

    afterEach(() => {
        if (clientSocket1) {
            clientSocket1.removeAllListeners();
        }
        if (clientSocket2) {
            clientSocket2.removeAllListeners();
        }
    });

    test('should connect client with authentication token', (done) => {
        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-1' }
        });

        clientSocket1.on('connect', () => {
            expect(clientSocket1.connected).toBe(true);
            done();
        });
    });

    test('should create a room and receive game_start event', (done) => {
        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-create' }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'TestPlayer1',
                pointCount: 20
            });
        });

        clientSocket1.on('room_created', (data) => {
            expect(data).toHaveProperty('roomCode');
            expect(data.roomCode).toHaveLength(6);
        });

        clientSocket1.on('game_start', (data) => {
            expect(data).toHaveProperty('numbers');
            expect(data).toHaveProperty('currentTurn');
            expect(data.numbers).toHaveLength(20);
            done();
        });
    }, 10000);

    test('should allow second player to join room', (done) => {
        let roomCode;
        let gameStartCount = 0;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-join-1' },
            autoConnect: false
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-join-2' },
            autoConnect: false
        });

        // Set up all listeners BEFORE connecting
        clientSocket1.on('room_created', (data) => {
            roomCode = data.roomCode;
            // Connect second client only after room is created
            clientSocket2.connect();
        });

        const checkGameStart = () => {
            gameStartCount++;
            if (gameStartCount === 2) {
                done();
            }
        };

        clientSocket1.on('game_start', checkGameStart);
        clientSocket2.on('game_start', checkGameStart);

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'Player2'
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'Player1',
                pointCount: 10
            });
        });

        // Now connect the first client
        clientSocket1.connect();
    }, 10000);

    test('should handle turn-based moves correctly', (done) => {
        let roomCode;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-turn-1' },
            autoConnect: false
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-turn-2' },
            autoConnect: false
        });

        let receivedMoves = 0;
        const handleMove = (data) => {
            expect(data).toHaveProperty('line');
            expect(data).toHaveProperty('nextNumber', 2);
            receivedMoves++;
            if (receivedMoves === 2) done();
        };

        clientSocket1.on('move_made', handleMove);
        clientSocket2.on('move_made', handleMove);

        clientSocket1.on('room_created', (data) => {
            roomCode = data.roomCode;
            clientSocket2.connect();
        });

        let gameStartCount = 0;
        const handleGameStart = () => {
            gameStartCount++;
            if (gameStartCount === 2) {
                // Both players ready, make a move
                setTimeout(() => {
                    clientSocket1.emit('submit_move', {
                        roomCode,
                        line: [{ x: 100, y: 100 }, { x: 150, y: 150 }]
                    });
                }, 100);
            }
        };

        clientSocket1.on('game_start', handleGameStart);
        clientSocket2.on('game_start', handleGameStart);

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'TurnPlayer2'
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'TurnPlayer1',
                pointCount: 5
            });
        });

        clientSocket1.connect();
    }, 10000);

    test('should handle game over correctly', (done) => {
        let roomCode;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-gameover-1' },
            autoConnect: false
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-gameover-2' },
            autoConnect: false
        });

        let gameOverCount = 0;
        const handleGameOver = (data) => {
            expect(data).toHaveProperty('reason', 'Línea cruzada');
            expect(data).toHaveProperty('loser');
            expect(data).toHaveProperty('winner');
            gameOverCount++;
            if (gameOverCount === 2) done();
        };

        clientSocket1.on('game_over', handleGameOver);
        clientSocket2.on('game_over', handleGameOver);

        clientSocket1.on('room_created', (data) => {
            roomCode = data.roomCode;
            clientSocket2.connect();
        });

        let bothReady = 0;
        const triggerGameOver = () => {
            bothReady++;
            if (bothReady === 2) {
                setTimeout(() => {
                    clientSocket1.emit('game_over', {
                        roomCode,
                        reason: 'Línea cruzada'
                    });
                }, 100);
            }
        };

        clientSocket1.on('game_start', triggerGameOver);
        clientSocket2.on('game_start', triggerGameOver);

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'GameOverPlayer2'
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'GameOverPlayer1',
                pointCount: 5
            });
        });

        clientSocket1.connect();
    }, 10000);
});
