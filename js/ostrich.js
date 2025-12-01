// Ostrich class and management

const OSTRICH_COLORS = [
    { name: 'Golden Emperor', color: '#FFD700', saddle: '#FFD700', collar: '#FFD700' },
    { name: 'Diamond Dynasty', color: '#FF00FF', saddle: '#FF00FF', collar: '#FF00FF' },
    { name: 'Platinum Thunder', color: '#00FFFF', saddle: '#00FFFF', collar: '#00FFFF' },
    { name: 'Royal Fortune', color: '#8A2BE2', saddle: '#8A2BE2', collar: '#8A2BE2' },
    { name: 'Emerald Tycoon', color: '#00FF00', saddle: '#00FF00', collar: '#00FF00' },
    { name: 'Ruby Luxe', color: '#FF1493', saddle: '#FF1493', collar: '#FF1493' },
    { name: 'Sapphire Elite', color: '#00CED1', saddle: '#00CED1', collar: '#00CED1' },
    { name: 'Amber Sovereign', color: '#FFA500', saddle: '#FFA500', collar: '#FFA500' }
];

class Ostrich {
    constructor(number, colorScheme) {
        this.number = number;
        this.name = colorScheme.name;
        this.colorScheme = colorScheme; // Store the full color scheme object
        this.color = colorScheme.color;
        this.saddleColor = colorScheme.saddle;
        this.collarColor = colorScheme.collar;
        
        // Stats (affect race performance) - wider ranges for more variation
        this.baseSpeed = randomFloat(0.5, 1.3); // Wider range: 0.5 to 1.3 (was 0.8 to 1.2)
        this.stamina = randomFloat(0.5, 1.0);   // Wider range: 0.5 to 1.0 (was 0.7 to 1.0)
        this.consistency = randomFloat(0.4, 1.0); // Wider range: 0.4 to 1.0 (was 0.6 to 1.0)
        
        // Race state
        this.position = 0; // 0 to 1 (0 = start, 1 = finish)
        this.speed = 0;
        this.currentSpeed = this.baseSpeed;
        this.finished = false;
        this.finishTime = null;
        this.finishPosition = null;
        
        // Animation state
        this.animationFrame = 0;
        
        // Calculate odds based on stats with more dramatic spread
        // Weight speed more heavily as it's most important
        const weightedAvg = (this.baseSpeed * 0.5) + (this.stamina * 0.3) + (this.consistency * 0.2);
        
        // New formula for wider odds distribution (1:1 to 12:1)
        // Better stats = lower odds
        if (weightedAvg >= 1.1) {
            this.odds = 2; // Strong favorite
        } else if (weightedAvg >= 1.0) {
            this.odds = 3; // Favorite
        } else if (weightedAvg >= 0.9) {
            this.odds = 4; // Slight favorite
        } else if (weightedAvg >= 0.8) {
            this.odds = 5; // Middle pack
        } else if (weightedAvg >= 0.7) {
            this.odds = 6; // Middle pack
        } else if (weightedAvg >= 0.6) {
            this.odds = 8; // Longshot
        } else if (weightedAvg >= 0.5) {
            this.odds = 10; // Big longshot
        } else {
            this.odds = 12; // Extreme longshot
        }
    }

    update(deltaTime, raceLength) {
        if (this.finished) return;

        // Update animation frame for leg movement
        this.animationFrame += deltaTime * 0.01 * this.currentSpeed;

        // Apply random variations based on consistency (increased from 0.3 to 0.5)
        const variation = (Math.random() - 0.5) * (1 - this.consistency) * 0.5;
        this.currentSpeed = this.baseSpeed + variation;

        // Stamina affects speed over time (increased impact from 0.3 to 0.5)
        // This means low stamina ostriches slow down MORE in late race
        const staminaFactor = 1 - (this.position * (1 - this.stamina) * 0.5);
        this.currentSpeed *= staminaFactor;

        // Update position
        this.position += (this.currentSpeed * deltaTime) / raceLength;
        
        if (this.position >= 1) {
            this.position = 1;
            this.finished = true;
        }
    }

    reset() {
        this.position = 0;
        this.speed = 0;
        this.currentSpeed = this.baseSpeed;
        this.finished = false;
        this.finishTime = null;
        this.finishPosition = null;
        this.animationFrame = 0;
    }

    getDisplayX(canvasWidth, trackWidth) {
        const trackStartX = (canvasWidth - trackWidth) / 2;
        return trackStartX + (this.position * trackWidth);
    }

    getDisplayY(canvasHeight, laneIndex, totalLanes) {
        const laneHeight = canvasHeight / (totalLanes + 1);
        return laneHeight * (laneIndex + 1);
    }
}

class OstrichManager {
    constructor() {
        this.ostriches = [];
        this.initializeOstriches();
    }

    initializeOstriches() {
        this.ostriches = [];
        for (let i = 0; i < 8; i++) {
            const ostrich = new Ostrich(i + 1, OSTRICH_COLORS[i]);
            this.ostriches.push(ostrich);
        }
    }

    resetAll() {
        this.ostriches.forEach(ostrich => ostrich.reset());
    }

    updateAll(deltaTime, raceLength) {
        this.ostriches.forEach(ostrich => ostrich.update(deltaTime, raceLength));
    }

    getFinishedOstriches() {
        return this.ostriches.filter(o => o.finished);
    }

    assignFinishPositions() {
        // Sort ALL ostriches by their finish time
        const sorted = [...this.ostriches].sort((a, b) => {
            // Both have finish times, sort by time
            if (a.finishTime !== null && b.finishTime !== null) {
                return a.finishTime - b.finishTime;
            }
            // One without finish time goes last
            if (a.finishTime === null) return 1;
            if (b.finishTime === null) return -1;
            return 0;
        });
        
        // Assign positions to all ostriches
        sorted.forEach((ostrich, index) => {
            ostrich.finishPosition = index + 1;
        });
    }

    getByNumber(number) {
        return this.ostriches.find(o => o.number === number);
    }
}

