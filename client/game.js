import { doPolylineIntersection } from './collision.js';

export class Game {
    constructor(canvas, username, roomCode, socket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.username = username;
        this.roomCode = roomCode;
        this.socket = socket;

        this.numbers = [];
        this.lines = []; // Array of arrays of points [{x,y}, {x,y}...]
        this.currentLine = null; // Array of points

        this.currentNumber = 1;
        this.isMyTurn = false;
        this.isGameOver = false;
        this.myPlayerId = socket.id;

        // Bind methods
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.resizeCanvas = this.resizeCanvas.bind(this);

        // Event Listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mouseup', this.handleMouseUp);
        window.addEventListener('resize', this.resizeCanvas);

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        });
        window.addEventListener('touchend', (e) => {
            this.handleMouseUp();
        });

        // Socket Listeners
        this.socket.on('move_made', ({ line, nextNumber, currentTurn }) => {
            this.lines.push(line);
            this.currentNumber = nextNumber;
            this.updateTurn(currentTurn);
            this.draw();
        });

        this.socket.on('game_over', ({ reason, loser }) => {
            const msg = loser === this.myPlayerId ? "¡Perdiste! " + reason : "¡Ganaste! El oponente perdió.";
            this.gameOver(msg);
        });

        this.resizeCanvas();
        this.draw(); // Draw empty or waiting state
    }

    startGame(numbers, currentTurn) {
        this.numbers = numbers;
        this.updateTurn(currentTurn);
        this.draw();
    }

    syncState(numbers, lines, currentNumber, currentTurn, isGameOver) {
        this.numbers = numbers;
        this.lines = lines;
        this.currentNumber = currentNumber;
        this.isGameOver = isGameOver;
        this.updateTurn(currentTurn);

        if (this.isGameOver) {
            document.getElementById('game-over-screen').classList.remove('hidden');
            document.getElementById('game-over-message').innerText = "Juego Terminado (Reconexión)";
        }

        this.draw();
    }

    updateTurn(currentTurnId) {
        this.isMyTurn = (currentTurnId === this.myPlayerId);
        const display = document.getElementById('current-player-display');
        display.innerText = this.isMyTurn ? "Tu Turno" : "Turno del Oponente";
        display.style.color = this.isMyTurn ? "#4caf50" : "#ff9800";

        document.getElementById('next-number-display').innerText = this.currentNumber;
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.draw();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        if (!this.isMyTurn || this.isGameOver || this.numbers.length === 0) return;

        const pos = this.getMousePos(e);

        const targetNum = this.numbers.find(n => n.value === this.currentNumber);
        if (targetNum && this.isNear(pos, targetNum)) {
            // Start a new path
            this.currentLine = [{ x: targetNum.x, y: targetNum.y }];
        }
    }

    handleMouseMove(e) {
        if (!this.currentLine || this.isGameOver) return;

        const pos = this.getMousePos(e);

        // Add point to path (throttle distance to avoid too many points)
        const lastPoint = this.currentLine[this.currentLine.length - 1];
        const dist = Math.sqrt(Math.pow(pos.x - lastPoint.x, 2) + Math.pow(pos.y - lastPoint.y, 2));

        if (dist > 5) { // Minimum distance between points
            this.currentLine.push(pos);

            // Check for collisions with the NEW segment
            if (this.checkCollisions(this.currentLine)) {
                this.socket.emit('game_over', { roomCode: this.roomCode, reason: "Cruzó una línea" });
                this.gameOver("¡Cruzaste una línea! Perdiste.");
            }

            this.draw();
        }
    }

    handleMouseUp(e) {
        if (!this.currentLine || this.isGameOver) return;

        const lastPoint = this.currentLine[this.currentLine.length - 1];
        const nextNum = this.numbers.find(n => n.value === this.currentNumber + 1);

        if (nextNum && this.isNear(lastPoint, nextNum)) {
            // Snap to center
            this.currentLine.push({ x: nextNum.x, y: nextNum.y });

            if (this.checkCollisions(this.currentLine)) {
                this.socket.emit('game_over', { roomCode: this.roomCode, reason: "Cruzó una línea" });
                this.gameOver("¡Cruzaste una línea! Perdiste.");
            } else {
                // Valid Move
                this.socket.emit('submit_move', { roomCode: this.roomCode, line: this.currentLine });
                this.currentLine = null;
                this.isMyTurn = false;
                this.draw();
            }
        } else {
            // Invalid move (didn't reach target), reset
            this.currentLine = null;
            this.draw();
        }
    }

    isNear(p1, p2) {
        const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        return dist < 20;
    }

    checkCollisions(path) {
        // Define Safe Zone around the starting number
        const startNum = this.numbers.find(n => n.value === this.currentNumber);
        const safeZone = startNum ? { x: startNum.x, y: startNum.y, radius: 15 } : null;

        // Check against all existing lines
        for (const existingPath of this.lines) {
            if (doPolylineIntersection(path, existingPath, safeZone)) {
                return true;
            }
        }

        // Check for self-intersection
        if (path.length > 3) {
            const lastIdx = path.length - 1;
            const p3 = path[lastIdx - 1];
            const p4 = path[lastIdx];
            for (let i = 0; i < lastIdx - 2; i++) {
                // Self-intersection usually happens far from start, but we can pass safeZone too just in case
                if (doPolylineIntersection([path[i], path[i + 1]], [p3, p4], safeZone)) {
                    return true;
                }
            }
        }

        // Check for Number Collisions (Rule 2)
        if (this.checkNumberCollisions(path)) {
            return true;
        }
        return false;
    }

    checkNumberCollisions(path) {
        // Check if the HEAD of the path touches any forbidden number
        const head = path[path.length - 1];

        // Allowed numbers: Current (Start) and Next (Target)
        // Actually, we shouldn't touch Start again after leaving it?
        // But simpler: Don't touch any number that isn't Start or Target.

        for (const num of this.numbers) {
            if (num.value === this.currentNumber || num.value === this.currentNumber + 1) {
                continue;
            }

            if (this.isNear(head, num)) {
                return true; // Crashed into a forbidden number
            }
        }
        return false;
    }

    gameOver(reason) {
        this.isGameOver = true;
        this.currentLine = null;
        this.draw();
        document.getElementById('game-over-message').innerText = reason;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    reset() {
        // Called by main.js to reset local state for a new game or lobby
        this.numbers = [];
        this.lines = [];
        this.currentLine = null;
        this.currentNumber = 1;
        this.isGameOver = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Lines (Paths)
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.lines.forEach(path => {
            this.ctx.strokeStyle = '#646cff';
            this.ctx.beginPath();
            if (path.length > 0) {
                this.ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    this.ctx.lineTo(path[i].x, path[i].y);
                }
            }
            this.ctx.stroke();
        });

        // Draw Current Line (Path)
        if (this.currentLine && this.currentLine.length > 0) {
            this.ctx.strokeStyle = '#ff4646';
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentLine[0].x, this.currentLine[0].y);
            for (let i = 1; i < this.currentLine.length; i++) {
                this.ctx.lineTo(this.currentLine[i].x, this.currentLine[i].y);
            }
            this.ctx.stroke();
        }

        // Draw Numbers
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.numbers.forEach(num => {
            if (num.value === this.currentNumber) {
                this.ctx.fillStyle = '#4caf50';
            } else if (num.value === this.currentNumber + 1) {
                this.ctx.fillStyle = '#ff9800';
            } else if (num.value < this.currentNumber) {
                this.ctx.fillStyle = '#888';
            } else {
                this.ctx.fillStyle = '#333';
            }

            this.ctx.beginPath();
            this.ctx.arc(num.x, num.y, 15, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(num.value, num.x, num.y);
        });
    }
}
