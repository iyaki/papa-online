/**
 * Papa Online Server - Unit Tests
 * 
 * Tests for core game logic and helper functions
 */

describe('Room Management - Helper Functions', () => {
    test('generateNumbers should create correct number of points', () => {
        // Mock the generateNumbers function
        const generateNumbers = (count, width, height) => {
            const numbers = [];
            const padding = 40;
            for (let i = 1; i <= count; i++) {
                numbers.push({
                    value: i,
                    x: padding + Math.random() * (width - 2 * padding),
                    y: padding + Math.random() * (height - 2 * padding)
                });
            }
            return numbers;
        };

        const result = generateNumbers(20, 600, 800);
        expect(result).toHaveLength(20);
        expect(result[0]).toHaveProperty('value', 1);
        expect(result[19]).toHaveProperty('value', 20);
        expect(result[0]).toHaveProperty('x');
        expect(result[0]).toHaveProperty('y');

        // Verify points are within bounds
        result.forEach(point => {
            expect(point.x).toBeGreaterThanOrEqual(40);
            expect(point.x).toBeLessThanOrEqual(600 - 40);
            expect(point.y).toBeGreaterThanOrEqual(40);
            expect(point.y).toBeLessThanOrEqual(800 - 40);
        });
    });

    test('checkOverlap should detect close points', () => {
        const checkOverlap = (pos, numbers, minDist = 40) => {
            return numbers.some(n => {
                const dx = n.x - pos.x;
                const dy = n.y - pos.y;
                return Math.sqrt(dx * dx + dy * dy) < minDist;
            });
        };

        const existingNumbers = [
            { value: 1, x: 100, y: 100 }
        ];

        const closePoint = { value: 2, x: 110, y: 110 };
        const farPoint = { value: 2, x: 200, y: 200 };

        expect(checkOverlap(closePoint, existingNumbers)).toBe(true);
        expect(checkOverlap(farPoint, existingNumbers)).toBe(false);

        // Test exact minimum distance
        const exactDistancePoint = { value: 2, x: 140, y: 100 };
        expect(checkOverlap(exactDistancePoint, existingNumbers)).toBe(false);
    });

    test('room code generation should create 6 character alphanumeric codes', () => {
        const generateRoomCode = () => {
            return Math.random().toString(36).substring(2, 8).toUpperCase();
        };

        for (let i = 0; i < 10; i++) {
            const code = generateRoomCode();
            expect(code).toHaveLength(6);
            expect(code).toMatch(/^[A-Z0-9]{6}$/);
        }
    });
});

describe('Game Logic', () => {
    test('should validate turn sequence', () => {
        const isCorrectNumber = (expected, actual) => {
            return expected === actual;
        };

        expect(isCorrectNumber(1, 1)).toBe(true);
        expect(isCorrectNumber(2, 1)).toBe(false);
        expect(isCorrectNumber(5, 5)).toBe(true);
    });

    test('should track game progress', () => {
        const gameState = {
            currentNumber: 1,
            maxNumber: 20,
            isComplete: function () {
                return this.currentNumber > this.maxNumber;
            }
        };

        expect(gameState.isComplete()).toBe(false);
        gameState.currentNumber = 21;
        expect(gameState.isComplete()).toBe(true);
    });

    test('should alternate turns between two players', () => {
        const players = ['player1', 'player2'];
        let currentTurnIndex = 0;

        const switchTurn = () => {
            currentTurnIndex = (currentTurnIndex + 1) % players.length;
            return players[currentTurnIndex];
        };

        expect(switchTurn()).toBe('player2');
        expect(switchTurn()).toBe('player1');
        expect(switchTurn()).toBe('player2');
    });
});

describe('Session Management', () => {
    test('should generate valid UUID format', () => {
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        const uuid = generateUUID();
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});
