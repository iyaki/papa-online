/**
 * Web Push - Integration Tests
 *
 * Verifies the optional Web Push layer: config endpoint, subscribe endpoint
 * and server-side push to absent players. See specs/pwa-push-notifications.md.
 * `web-push` is fully mocked: no network, no real VAPID keys.
 */

jest.mock('web-push');

// The main module under test must boot with push enabled (V2 hook tests).
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

const { io: Client } = require('socket.io-client');
const webpush = require('web-push');
const { server, io, rooms, playerSessions } = require('./server');

const FCM = 'https://fcm.googleapis.com/fcm/send/test-endpoint';

function connect(token) {
    const socket = Client(`http://localhost:${server.address().port}`, { auth: { token } });
    return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

function until(fn, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
            try {
                if (fn()) return resolve();
            } catch (err) {
                return reject(err);
            }
            if (Date.now() - start > timeout) return reject(new Error('until: timeout'));
            setTimeout(tick, 20);
        };
        tick();
    });
}

async function createRoom(socket) {
    const roomCode = new Promise((resolve) =>
        socket.once('room_created', ({ roomCode }) => resolve(roomCode)),
    );
    socket.emit('create_room', { username: 'Creador', pointCount: 5 });
    return roomCode;
}

describe('Web Push', () => {
    const openSockets = [];
    const sessionTokens = [];

    beforeAll((done) => {
        webpush.sendNotification.mockResolvedValue({});
        server.listen(() => done());
    });

    afterAll((done) => {
        io.close();
        server.close(done);
    });

    afterEach(() => {
        for (const socket of openSockets) socket.close();
        openSockets.length = 0;
        for (const token of sessionTokens) delete playerSessions[token];
        sessionTokens.length = 0;
        for (const key in rooms) delete rooms[key];
        webpush.sendNotification.mockReset();
        webpush.sendNotification.mockResolvedValue({});
    });

    function seedSession(token, extra = {}) {
        playerSessions[token] = { username: token, rooms: [], ...extra };
        sessionTokens.push(token);
    }

    // Fabricates a room whose creator is offline but subscribed.
    function seedRoomWithAbsentCreator(roomCode, creatorToken) {
        rooms[roomCode] = {
            players: [{ id: 'ghost-creator', username: 'Creador', token: creatorToken }],
            numbers: [],
            lines: [],
            currentNumber: 1,
            currentTurn: 'ghost-creator',
            lastActivity: Date.now(),
        };
        seedSession(creatorToken, { rooms: [roomCode], pushSubscription: { endpoint: FCM } });
    }

    describe('V1: GET /api/push/config', () => {
        test('returns null publicKey when VAPID env is absent', async () => {
            delete process.env.VAPID_PUBLIC_KEY;
            delete process.env.VAPID_PRIVATE_KEY;
            let fresh;
            jest.isolateModules(() => {
                fresh = require('./server');
            });
            await new Promise((resolve) => fresh.server.listen(() => resolve()));
            try {
                const res = await fetch(
                    `http://localhost:${fresh.server.address().port}/api/push/config`,
                );
                expect(res.status).toBe(200);
                expect(await res.json()).toEqual({ publicKey: null });
            } finally {
                fresh.io.close();
                await new Promise((resolve) => fresh.server.close(resolve));
            }
        });

        test('returns the VAPID public key and configures web-push when env is set', async () => {
            const res = await fetch(`http://localhost:${server.address().port}/api/push/config`);
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ publicKey: 'test-public-key' });
            expect(webpush.setVapidDetails).toHaveBeenCalledWith(
                'https://juego-papa.com',
                'test-public-key',
                'test-private-key',
            );
        });
    });

    describe('V2: push to absent players', () => {
        test('submit_move notifies the absent rival with the room URL', async () => {
            const socket = await connect('tok-push-mover');
            openSockets.push(socket);
            sessionTokens.push('tok-push-mover');
            const roomCode = await createRoom(socket);

            rooms[roomCode].players.push({
                id: 'ghost-rival',
                username: 'Ausente',
                token: 'tok-push-absent',
            });
            seedSession('tok-push-absent', {
                rooms: [roomCode],
                pushSubscription: { endpoint: FCM },
            });
            webpush.sendNotification.mockClear();

            socket.emit('submit_move', { roomCode, line: { x1: 0, y1: 0, x2: 1, y2: 1 } });

            await until(() => webpush.sendNotification.mock.calls.length === 1);
            const [subscription, payload] = webpush.sendNotification.mock.calls[0];
            expect(subscription).toEqual({ endpoint: FCM });
            const data = JSON.parse(payload);
            expect(data.title).toBe('🥔 ¡Es tu turno!');
            expect(data.url).toBe(`/?room=${roomCode}`);
        });

        test('submit_move sends no push when both players have live sockets', async () => {
            const socketA = await connect('tok-push-a');
            const socketB = await connect('tok-push-b');
            openSockets.push(socketA, socketB);
            const roomCode = await createRoom(socketA);

            rooms[roomCode].players.push({
                id: socketB.id,
                username: 'B',
                token: 'tok-push-b',
            });
            seedSession('tok-push-b', { rooms: [roomCode], pushSubscription: { endpoint: FCM } });
            webpush.sendNotification.mockClear();

            socketA.emit('submit_move', { roomCode, line: { x1: 0, y1: 0, x2: 1, y2: 1 } });
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(webpush.sendNotification).not.toHaveBeenCalled();
        });

        test('a 410 push error prunes the stored subscription', async () => {
            const socket = await connect('tok-push-mover2');
            openSockets.push(socket);
            sessionTokens.push('tok-push-mover2');
            const roomCode = await createRoom(socket);

            rooms[roomCode].players.push({
                id: 'ghost-rival',
                username: 'Ausente',
                token: 'tok-push-absent',
            });
            seedSession('tok-push-absent', {
                rooms: [roomCode],
                pushSubscription: { endpoint: FCM },
            });
            webpush.sendNotification.mockClear();
            webpush.sendNotification.mockRejectedValueOnce({ statusCode: 410 });

            socket.emit('submit_move', { roomCode, line: { x1: 0, y1: 0, x2: 1, y2: 1 } });

            await until(() => playerSessions['tok-push-absent'].pushSubscription === undefined);
        });

        test('join_room notifies the absent creator that the rival joined', async () => {
            seedRoomWithAbsentCreator('JOIN01', 'tok-ghost-creator');
            const joiner = await connect('tok-joiner');
            openSockets.push(joiner);
            sessionTokens.push('tok-joiner');
            webpush.sendNotification.mockClear();

            joiner.emit('join_room', { roomCode: 'JOIN01', username: 'Joiner' });

            await until(() => webpush.sendNotification.mock.calls.length === 1);
            const [, payload] = webpush.sendNotification.mock.calls[0];
            const data = JSON.parse(payload);
            expect(data.title).toBe('¡Tu rival se unió!');
            expect(data.body).toBe('Joiner ya está en la sala JOIN01.');
            expect(data.url).toBe('/?room=JOIN01');
        });
    });

    describe('V3: POST /api/push/subscribe', () => {
        function post(body) {
            return fetch(`http://localhost:${server.address().port}/api/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }

        test('stores the subscription and upserts on re-subscribe', async () => {
            seedSession('tok-sub');
            let res = await post({ token: 'tok-sub', subscription: { endpoint: FCM } });
            expect(res.status).toBe(204);
            expect(playerSessions['tok-sub'].pushSubscription).toEqual({ endpoint: FCM });

            res = await post({ token: 'tok-sub', subscription: { endpoint: 'https://fcm/v2' } });
            expect(res.status).toBe(204);
            expect(playerSessions['tok-sub'].pushSubscription).toEqual({
                endpoint: 'https://fcm/v2',
            });
        });

        test('creates a shell session for unknown tokens', async () => {
            sessionTokens.push('tok-sub-new');
            const res = await post({
                token: 'tok-sub-new',
                subscription: { endpoint: FCM },
            });
            expect(res.status).toBe(204);
            expect(playerSessions['tok-sub-new']).toMatchObject({
                rooms: [],
                pushSubscription: { endpoint: FCM },
            });
        });

        test.each([
            ['missing token', { subscription: { endpoint: FCM } }],
            ['empty token', { token: '', subscription: { endpoint: FCM } }],
            ['non-string token', { token: 42, subscription: { endpoint: FCM } }],
            ['missing subscription', { token: 'tok-bad' }],
            ['subscription without endpoint', { token: 'tok-bad', subscription: {} }],
            ['non-string endpoint', { token: 'tok-bad', subscription: { endpoint: 42 } }],
        ])('rejects %s with 400', async (_name, body) => {
            const res = await post(body);
            expect(res.status).toBe(400);
        });
    });
});
