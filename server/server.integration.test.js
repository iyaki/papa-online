/**
 * Papa Online Server - Integration Tests
 *
 * These tests use the actual server and test real Socket.IO communication
 */

const { io: Client } = require('socket.io-client');
const { server, io, rooms } = require('./server');

describe('Papa Online Server - Integration Tests', () => {
    let clientSocket1, clientSocket2;
    let httpServerAddr;

    beforeAll((done) => {
        server.listen(() => {
            const port = server.address().port;
            console.log(`Test server running on port ${port}`);
            httpServerAddr = { port };
            done();
        });
    });

    afterAll((done) => {
        io.close();
        server.close(done);
    });

    afterEach(() => {
        if (clientSocket1) {
            clientSocket1.close();
        }
        if (clientSocket2) {
            clientSocket2.close();
        }
        // Cleanup rooms
        for (const key in rooms) {
            delete rooms[key];
        }
    });

    test('should connect client with authentication token', (done) => {
        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-1' },
        });

        clientSocket1.on('connect', () => {
            expect(clientSocket1.connected).toBe(true);
            done();
        });
    });

    test('should create a room and receive game_start event', (done) => {
        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-create' },
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'TestPlayer1',
                pointCount: 20,
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
        let readyCount = 0;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-join-1' },
            autoConnect: false,
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-join-2' },
            autoConnect: false,
        });

        const checkReady = () => {
            readyCount++;
            if (readyCount === 2) {
                done();
            }
        };

        // Player 1 gets game_start when creating
        clientSocket1.on('game_start', () => {
            checkReady();
        });

        // Player 2 gets game_sync when joining
        clientSocket2.on('game_sync', (data) => {
            expect(data).toHaveProperty('numbers');
            expect(data).toHaveProperty('currentTurn');
            checkReady();
        });

        clientSocket1.on('room_created', (data) => {
            roomCode = data.roomCode;
            // Connect second client only after room is created
            clientSocket2.connect();
        });

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'Player2',
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'Player1',
                pointCount: 10,
            });
        });

        // Now connect the first client
        clientSocket1.connect();
    }, 10000);

    test('should handle turn-based moves correctly', (done) => {
        let roomCode;
        let bothReady = false;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-turn-1' },
            autoConnect: false,
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-turn-2' },
            autoConnect: false,
        });

        let receivedMoves = 0;
        const handleMove = (data) => {
            // Ignore the initial move_made with null line sent when player 2 joins
            if (!data.line) return;

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

        // Player 1 gets game_start when creating
        clientSocket1.on('game_start', () => {
            if (bothReady) {
                // Both ready, make a move
                setTimeout(() => {
                    clientSocket1.emit('submit_move', {
                        roomCode,
                        line: [
                            { x: 100, y: 100 },
                            { x: 150, y: 150 },
                        ],
                    });
                }, 100);
            }
        });

        // Player 2 gets game_sync when joining
        clientSocket2.on('game_sync', () => {
            bothReady = true;
            // Trigger the move from player 1
            setTimeout(() => {
                clientSocket1.emit('submit_move', {
                    roomCode,
                    line: [
                        { x: 100, y: 100 },
                        { x: 150, y: 150 },
                    ],
                });
            }, 100);
        });

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'TurnPlayer2',
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'TurnPlayer1',
                pointCount: 5,
            });
        });

        clientSocket1.connect();
    }, 10000);

    test('should handle game over correctly', (done) => {
        let roomCode;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-gameover-1' },
            autoConnect: false,
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-gameover-2' },
            autoConnect: false,
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

        // Player 1 gets game_start
        clientSocket1.on('game_start', () => {
            // Wait for player 2 to be ready
        });

        // Player 2 gets game_sync, trigger game over
        clientSocket2.on('game_sync', () => {
            setTimeout(() => {
                clientSocket1.emit('game_over', {
                    roomCode,
                    reason: 'Línea cruzada',
                });
            }, 100);
        });

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'GameOverPlayer2',
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'GameOverPlayer1',
                pointCount: 5,
            });
        });

        clientSocket1.connect();
    }, 10000);

    test('should handle surrender (leave_room)', (done) => {
        let roomCode;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-surrender-1' },
            autoConnect: false,
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-surrender-2' },
            autoConnect: false,
        });

        clientSocket1.on('room_created', (data) => {
            roomCode = data.roomCode;
            clientSocket2.connect();
        });

        clientSocket2.on('player_left', (data) => {
            expect(data).toHaveProperty('playerId');
            done();
        });

        // Player 2 gets game_sync, then player 1 leaves
        clientSocket2.on('game_sync', () => {
            // Player 1 leaves
            clientSocket1.emit('leave_room', { roomCode });
        });

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'SurrenderPlayer2',
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'SurrenderPlayer1',
                pointCount: 5,
            });
        });

        clientSocket1.connect();
    }, 10000);

    test('should return my games list', (done) => {
        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-mygames' },
            autoConnect: false,
        });

        // Server pushes my_games_list on create_room AND on get_my_games;
        // resolve on the first non-empty list only (CI-timing dependent otherwise)
        let resolved = false;
        clientSocket1.on('my_games_list', (games) => {
            if (resolved || games.length === 0) return;
            resolved = true;
            expect(games[0]).toHaveProperty('roomCode');
            expect(games[0]).toHaveProperty('opponentName');
            done();
        });

        clientSocket1.on('room_created', () => {
            // Request games list
            clientSocket1.emit('get_my_games');
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'MyGamesPlayer',
                pointCount: 5,
            });
        });

        clientSocket1.connect();
    }, 10000);

    test('rematch > emits game_restarted with roomCode, regenerated numbers, and currentTurn set to the accepting player', (done) => {
        let roomCode;
        let originalNumbersLength = 0;

        clientSocket1 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-rematch-1' },
            autoConnect: false,
        });

        clientSocket2 = Client(`http://localhost:${httpServerAddr.port}`, {
            auth: { token: 'test-token-rematch-2' },
            autoConnect: false,
        });

        clientSocket1.on('game_start', (data) => {
            originalNumbersLength = data.numbers.length;
        });

        // Once the game is over, P1 requests a rematch
        clientSocket1.on('game_over', () => {
            clientSocket1.emit('request_rematch', { roomCode });
        });

        // P2 accepts
        clientSocket2.on('rematch_requested', () => {
            clientSocket2.emit('respond_rematch', { roomCode, accept: true });
        });

        let restartCount = 0;
        const handleRestart = (data) => {
            expect(data).toHaveProperty('roomCode', roomCode);
            expect(Array.isArray(data.numbers)).toBe(true);
            expect(data.numbers).toHaveLength(originalNumbersLength);
            expect(data).toHaveProperty('currentTurn', clientSocket2.id);
            restartCount++;
            if (restartCount === 2) done();
        };

        clientSocket1.on('game_restarted', handleRestart);
        clientSocket2.on('game_restarted', handleRestart);

        clientSocket1.on('room_created', (data) => {
            roomCode = data.roomCode;
            clientSocket2.connect();
        });

        // Player 2 gets game_sync, then trigger game over
        clientSocket2.on('game_sync', () => {
            setTimeout(() => {
                clientSocket1.emit('game_over', {
                    roomCode,
                    reason: 'Línea cruzada',
                });
            }, 100);
        });

        clientSocket2.on('connect', () => {
            if (roomCode) {
                clientSocket2.emit('join_room', {
                    roomCode,
                    username: 'RematchPlayer2',
                });
            }
        });

        clientSocket1.on('connect', () => {
            clientSocket1.emit('create_room', {
                username: 'RematchPlayer1',
                pointCount: 5,
            });
        });

        clientSocket1.connect();
    }, 10000);
});
