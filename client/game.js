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
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
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

        // Delay initial resize to ensure DOM layout is applied
        requestAnimationFrame(() => this.resizeCanvas());
    }

    startGame(numbers, currentTurn) {
        this.numbers = numbers;
        this.currentNumber = 1;
        this.lines = [];
        this.currentLine = null;
        this.isGameOver = false;
        this.gameStartTime = Date.now(); // Track start time
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

        // Remove both classes first
        display.classList.remove('my-turn', 'opponent-turn');

        // Add appropriate class for animation
        if (this.isMyTurn) {
            display.classList.add('my-turn');
        } else {
            display.classList.add('opponent-turn');
        }

        document.getElementById('next-number-display').innerText = this.currentNumber + 1;
    }

    resizeCanvas() {
        // Set fixed internal resolution to match server's game world (Portrait)
        this.canvas.width = 600;
        this.canvas.height = 800;
        this.draw();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
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
                this.socket.emit('game_over', { roomCode: this.roomCode, reason: "Cruzó una línea", lastLine: this.currentLine });
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
                this.socket.emit('game_over', { roomCode: this.roomCode, reason: "Cruzó una línea", lastLine: this.currentLine });
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

        const message = document.getElementById('game-over-message');
        message.innerText = reason;

        // Check if player won (reason contains "Ganaste")
        const isWinner = reason.includes('Ganaste');

        // Show confetti for winners
        if (isWinner && typeof createConfetti === 'function') {
            createConfetti();
        }

        // Add game stats below message
        const statsDiv = document.createElement('div');
        statsDiv.style.marginTop = '20px';
        statsDiv.style.fontSize = '1.2rem';
        statsDiv.style.color = '#666';
        statsDiv.innerHTML = `
            <div>🎯 Números conectados: ${this.currentNumber - 1}</div>
        `;

        // Insert after message if not already there
        if (!message.nextElementSibling || !message.nextElementSibling.classList.contains('game-stats')) {
            statsDiv.classList.add('game-stats');
            message.parentNode.insertBefore(statsDiv, message.nextSibling);
        }

        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    startGame(numbers, currentTurn) {
        this.numbers = numbers;
        this.currentNumber = 1;
        this.lines = [];
        this.currentLine = null;
        this.isGameOver = false;

        this.updateTurn(currentTurn);
        this.draw();
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

        // Request animation frame for continuous pulse animation
        if (!this.isGameOver && this.currentNumber <= this.numbers.length) {
            requestAnimationFrame(() => this.draw());
        }

        // Draw Lines (Paths)
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.lines.forEach(path => {
            this.ctx.strokeStyle = '#2c3e50'; // Dark ink color
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
            this.ctx.strokeStyle = '#d35400'; // Burnt orange for current stroke (pencil/marker?)
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentLine[0].x, this.currentLine[0].y);
            for (let i = 1; i < this.currentLine.length; i++) {
                this.ctx.lineTo(this.currentLine[i].x, this.currentLine[i].y);
            }
            this.ctx.stroke();
        }

        // Draw Numbers
        this.ctx.font = 'bold 24px "Patrick Hand", cursive';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.numbers.forEach(num => {
            // Draw circle background (paper cutout or drawn circle?)
            // Let's make it look like a drawn circle
            this.ctx.beginPath();
            this.ctx.arc(num.x, num.y, 18, 0, Math.PI * 2);

            if (num.value === this.currentNumber) {
                this.ctx.fillStyle = 'rgba(76, 175, 80, 0.2)'; // Light green highlight
                this.ctx.fill();
                this.ctx.strokeStyle = '#2c3e50';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else if (num.value === this.currentNumber + 1) {
                // Pulsing animation for next number
                const pulseSize = 2 + Math.sin(Date.now() / 300) * 2;
                this.ctx.fillStyle = 'rgba(255, 152, 0, 0.3)'; // Light orange highlight
                this.ctx.fill();
                this.ctx.strokeStyle = '#ff9800';
                this.ctx.lineWidth = pulseSize;
                this.ctx.stroke();

                // Outer glow ring
                this.ctx.beginPath();
                this.ctx.arc(num.x, num.y, 22 + pulseSize, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(255, 152, 0, 0.3)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            } else if (num.value < this.currentNumber) {
                // Completed numbers
                this.ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
                this.ctx.fill();
                this.ctx.strokeStyle = '#95a5a6'; // Faded ink
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            } else {
                // Future numbers
                this.ctx.strokeStyle = '#2c3e50';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }

            // Text
            if (num.value < this.currentNumber) {
                this.ctx.fillStyle = '#95a5a6';
            } else {
                this.ctx.fillStyle = '#2c3e50';
            }
            this.ctx.fillText(num.value, num.x, num.y + 2); // +2 for visual centering with this font
        });
    }

    exportToImage(playerText, resultText, resultColor, footerUrl) {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width;
        exportCanvas.height = this.canvas.height + 140; // Extra space for footer
        const ctx = exportCanvas.getContext('2d');

        // Background
        ctx.fillStyle = '#f0f0f0'; // Paper color
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw Grid (Simplified)
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let x = 0; x < exportCanvas.width; x += 20) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 20) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(exportCanvas.width, y); ctx.stroke();
        }

        // Draw Game Content
        // Ensure we draw the exact pixels from the game canvas
        ctx.drawImage(this.canvas, 0, 0);

        // Footer Area
        const footerY = this.canvas.height + 40;
        ctx.textAlign = 'center';

        // Player Names
        ctx.fillStyle = '#333';
        ctx.font = 'bold 28px "Gochi Hand", cursive, sans-serif';
        ctx.fillText(playerText || 'Juego de la Papa', exportCanvas.width / 2, footerY);

        // Result
        if (resultText) {
            ctx.fillStyle = resultColor || '#333';
            ctx.font = 'bold 36px "Gochi Hand", cursive, sans-serif';
            ctx.fillText(resultText, exportCanvas.width / 2, footerY + 40);
        }

        // URL
        if (footerUrl) {
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '14px sans-serif';
            ctx.fillText(footerUrl, exportCanvas.width / 2, exportCanvas.height - 15);
        }

        return exportCanvas.toDataURL('image/png');
    }
}

