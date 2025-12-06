// Race mechanics and simulation

class Race {
    constructor(ostrichManager, renderer, canvas, soundSystem) {
        this.ostrichManager = ostrichManager;
        this.renderer = renderer;
        this.canvas = canvas;
        this.soundSystem = soundSystem;
        this.state = 'waiting'; // waiting, counting, racing, finished
        this.countdown = 0;
        this.raceTime = 0;
        this.raceLength = 10000; // milliseconds (10 seconds)
        this.startTime = null;
        this.winnerAnnounced = false;
    }

    startCountdown() {
        this.state = 'counting';
        this.countdown = 3;
        this.ostrichManager.resetAll();
    }

    startRace() {
        this.state = 'racing';
        this.raceTime = 0;
        this.startTime = Date.now();
        this.winnerAnnounced = false;
        this.ostrichManager.resetAll();
        
        // Play race start sound
        if (this.soundSystem) {
            this.soundSystem.playRaceStart();
        }
    }

    update(deltaTime) {
        if (this.state === 'counting') {
            // Countdown logic handled separately
            return;
        }

        if (this.state === 'racing') {
            this.raceTime += deltaTime;
            
            // Update all ostriches and track finish times
            this.ostrichManager.ostriches.forEach(ostrich => {
                const wasFinished = ostrich.finished;
                ostrich.update(deltaTime, this.raceLength);
                
                // Record finish time when ostrich crosses finish line
                if (!wasFinished && ostrich.finished && !ostrich.finishTime) {
                    ostrich.finishTime = this.raceTime;
                    
                    // Announce the first winner
                    if (!this.winnerAnnounced) {
                        this.winnerAnnounced = true;
                        if (this.soundSystem) {
                            // Small delay to let the visual sink in
                            setTimeout(() => {
                                this.soundSystem.announceWinner(ostrich.number, ostrich.name);
                            }, 200);
                        }
                    }
                }
            });
            
            // Check if race is finished (all ostriches finished or time limit)
            const finished = this.ostrichManager.getFinishedOstriches();
            if (finished.length === 8 || this.raceTime >= this.raceLength) {
                this.finishRace();
            }
        }
    }

    finishRace() {
        this.state = 'finished';
        
        // Assign finish times for any ostriches that didn't finish
        this.ostrichManager.ostriches.forEach(ostrich => {
            if (!ostrich.finished || !ostrich.finishTime) {
                // Use position to determine order for those who didn't finish
                ostrich.finishTime = this.raceLength + (1 - ostrich.position) * 1000;
            }
        });
        
        this.ostrichManager.assignFinishPositions();
    }

    render() {
        this.renderer.clear();
        
        if (this.state === 'waiting') {
            const canvasRect = this.canvas.getBoundingClientRect();
            const centerX = canvasRect.width / 2;
            const centerY = canvasRect.height / 2;
            
            // Draw "OSTRICH RACES" in large text with shadow effect
            this.renderer.ctx.save();
            
            // Shadow/outline
            this.renderer.ctx.fillStyle = '#FF00FF';
            this.renderer.ctx.font = 'bold 48px Arial';
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.textBaseline = 'middle';
            this.renderer.ctx.fillText('OSTRICH RACES', centerX + 3, centerY - 20 + 3);
            
            // Main text
            this.renderer.ctx.fillStyle = '#FFD700';
            this.renderer.ctx.fillText('OSTRICH RACES', centerX, centerY - 20);
            
            // Secondary shadow for cyan
            this.renderer.ctx.fillStyle = '#00FFFF';
            this.renderer.ctx.fillText('OSTRICH RACES', centerX + 2, centerY - 20 + 2);
            
            this.renderer.ctx.restore();
            
            // Draw "Place your bets" in smaller text below
            this.renderer.drawText(
                'Place your bets',
                centerX,
                centerY + 30,
                24,
                '#00FFFF'
            );
            return;
        }

        if (this.state === 'counting') {
            const canvasRect = this.canvas.getBoundingClientRect();
            this.renderer.drawText(
                this.countdown.toString(),
                canvasRect.width / 2,
                canvasRect.height / 2,
                64,
                '#FFD700'
            );
            return;
        }

        if (this.state === 'racing' || this.state === 'finished') {
            this.renderRace();
        }
    }

    renderRace() {
        const canvasRect = this.canvas.getBoundingClientRect();
        const ostrichWidth = 70;
        const startMargin = 50; // Space for position numbers
        const finishLineWidth = 20; // Width of finish line
        const endMargin = 10; // Small padding after finish line
        const trackWidth = canvasRect.width - startMargin - endMargin - ostrichWidth - finishLineWidth;
        const trackStartX = startMargin;
        
        // Draw track lanes
        this.renderer.drawRect(
            trackStartX,
            30,
            trackWidth + ostrichWidth + finishLineWidth + endMargin,
            canvasRect.height - 60,
            'rgba(139, 69, 19, 0.3)'
        );
        
        // Draw lane dividers
        const laneHeight = (canvasRect.height - 60) / 8;
        this.renderer.ctx.save();
        this.renderer.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.renderer.ctx.lineWidth = 1;
        this.renderer.ctx.setLineDash([5, 5]);
        for (let i = 1; i < 8; i++) {
            const y = 30 + laneHeight * i;
            this.renderer.ctx.beginPath();
            this.renderer.ctx.moveTo(trackStartX, y);
            this.renderer.ctx.lineTo(trackStartX + trackWidth + ostrichWidth + finishLineWidth, y);
            this.renderer.ctx.stroke();
        }
        this.renderer.ctx.restore();
        
        // Draw finish line (checkered pattern)
        const finishLineX = trackStartX + trackWidth + ostrichWidth;
        this.renderer.ctx.save();
        this.renderer.ctx.fillStyle = '#FFFFFF';
        const squareSize = 15;
        const numSquares = Math.ceil((canvasRect.height - 60) / squareSize);
        for (let i = 0; i < numSquares; i++) {
            const y = 30 + i * squareSize;
            if (i % 2 === 0) {
                this.renderer.ctx.fillRect(finishLineX, y, squareSize, squareSize);
            } else {
                this.renderer.ctx.fillRect(finishLineX + squareSize / 2, y, squareSize, squareSize);
            }
        }
        // Draw black squares
        this.renderer.ctx.fillStyle = '#000';
        for (let i = 0; i < numSquares; i++) {
            const y = 30 + i * squareSize;
            if (i % 2 === 0) {
                this.renderer.ctx.fillRect(finishLineX + squareSize / 2, y, squareSize, squareSize);
            } else {
                this.renderer.ctx.fillRect(finishLineX, y, squareSize, squareSize);
            }
        }
        this.renderer.ctx.restore();
        
        // Draw ostriches (side view with animated legs)
        this.ostrichManager.ostriches.forEach((ostrich, index) => {
            const x = trackStartX + (ostrich.position * trackWidth);
            const laneY = 30 + laneHeight * index;
            const y = laneY + (laneHeight - ostrichWidth) / 2; // Center in lane
            const width = ostrichWidth;
            const height = ostrichWidth;
            
            this.renderer.drawOstrich(
                x,
                y,
                width,
                height,
                ostrich.colorScheme,
                ostrich.number,
                ostrich.animationFrame
            );
            
            // Draw position number next to ostrich
            this.renderer.ctx.save();
            this.renderer.ctx.fillStyle = '#FFFFFF';
            this.renderer.ctx.strokeStyle = '#000';
            this.renderer.ctx.lineWidth = 2;
            this.renderer.ctx.font = 'bold 16px Arial';
            this.renderer.ctx.textAlign = 'right';
            this.renderer.ctx.textBaseline = 'middle';
            const text = `${ostrich.number}`;
            this.renderer.ctx.strokeText(text, trackStartX - 15, laneY + laneHeight / 2);
            this.renderer.ctx.fillText(text, trackStartX - 15, laneY + laneHeight / 2);
            this.renderer.ctx.restore();
        });
    }

    getWinner() {
        const finished = this.ostrichManager.getFinishedOstriches();
        if (finished.length === 0) return null;
        
        finished.sort((a, b) => {
            if (a.finishTime === null) return 1;
            if (b.finishTime === null) return -1;
            return a.finishTime - b.finishTime;
        });
        
        return finished[0];
    }
}

