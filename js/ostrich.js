// Ostrich class and management

const OSTRICH_COLORS = [
    // Original ostriches
    // bodyColor: '#654321' = brown, '#2C1810' = dark brown/black
    // neckColor: '#F5F5F5' = white, '#FFE4E1' = light pink, '#FF69B4' = hot pink, '#FF10F0' = neon pink
    // eyeStyle: 'dot', 'dash', 'sunglasses', 'dotdash'
    { name: 'Golden Emperor', color: '#FFD700', saddle: '#FFD700', collar: '#FFD700', bodyColor: '#2C1810', neckColor: '#F5F5F5', eyeStyle: 'dot' },
    { name: 'Diamond Sand', color: '#FF00FF', saddle: '#FF00FF', collar: '#FF00FF', bodyColor: '#654321', neckColor: '#FF10F0', eyeStyle: 'dash' },
    { name: 'Platinum Pressured', color: '#00FFFF', saddle: '#00FFFF', collar: '#00FFFF', bodyColor: '#2C1810', neckColor: '#FF69B4', eyeStyle: 'dotdash' },
    { name: 'Royal Fortune', color: '#8A2BE2', saddle: '#8A2BE2', collar: '#8A2BE2', bodyColor: '#654321', neckColor: '#F5F5F5', eyeStyle: 'dot' },
    { name: 'Tennis Chain', color: '#00FF00', saddle: '#00FF00', collar: '#00FF00', bodyColor: '#2C1810', neckColor: '#FFE4E1', eyeStyle: 'dash' },
    { name: 'Ruby Luxurious', color: '#FF1493', saddle: '#FF1493', collar: '#FF1493', bodyColor: '#654321', neckColor: '#FF10F0', eyeStyle: 'dotdash' },
    { name: 'Sapphire Elite', color: '#00CED1', saddle: '#00CED1', collar: '#00CED1', bodyColor: '#2C1810', neckColor: '#FF69B4', eyeStyle: 'dot' },
    { name: 'Classic Caviar', color: '#FFA500', saddle: '#FFA500', collar: '#FFA500', bodyColor: '#654321', neckColor: '#F5F5F5', eyeStyle: 'sunglasses' },
    // New ostriches
    { name: 'Crypto Gains', color: '#F7931A', saddle: '#F7931A', collar: '#F7931A', bodyColor: '#2C1810', neckColor: '#FFE4E1', eyeStyle: 'dash' },
    { name: 'Equity Drip', color: '#1E90FF', saddle: '#1E90FF', collar: '#1E90FF', bodyColor: '#654321', neckColor: '#FF10F0', eyeStyle: 'dotdash' },
    { name: 'Elite Circle', color: '#8A2BE2', saddle: '#8A2BE2', collar: '#8A2BE2', bodyColor: '#2C1810', neckColor: '#FF69B4', eyeStyle: 'dot' },
    { name: 'Maximum ROI', color: '#32CD32', saddle: '#32CD32', collar: '#32CD32', bodyColor: '#654321', neckColor: '#F5F5F5', eyeStyle: 'sunglasses' },
    { name: 'Hella Pricey', color: '#FFD700', saddle: '#FFD700', collar: '#FFD700', bodyColor: '#2C1810', neckColor: '#FFE4E1', eyeStyle: 'dash' },
    { name: 'Value Going Up', color: '#50C878', saddle: '#50C878', collar: '#50C878', bodyColor: '#654321', neckColor: '#FF10F0', eyeStyle: 'dotdash' },
    { name: 'Big Brain Energy', color: '#00BFFF', saddle: '#00BFFF', collar: '#00BFFF', bodyColor: '#2C1810', neckColor: '#FF69B4', eyeStyle: 'sunglasses' },
    { name: 'Gospel Feathers', color: '#E6E6FA', saddle: '#E6E6FA', collar: '#E6E6FA', bodyColor: '#654321', neckColor: '#F5F5F5', eyeStyle: 'dot' }
];

class Ostrich {
    constructor(number, colorScheme, currentTimePeriod = null, rng = null) {
        this.number = number;
        this.name = colorScheme.name;
        this.colorScheme = colorScheme; // Store the full color scheme object
        this.color = colorScheme.color;
        this.saddleColor = colorScheme.saddle;
        this.collarColor = colorScheme.collar;
        
        // Stats (affect race performance) - wider ranges for more variation
        // Use seeded RNG if provided (multiplayer mode), otherwise use Math.random() (offline mode)
        this.baseSpeed = randomFloat(0.5, 1.3, rng); // Wider range: 0.5 to 1.3 (was 0.8 to 1.2)
        this.stamina = randomFloat(0.5, 1.0, rng);   // Wider range: 0.5 to 1.0 (was 0.7 to 1.0)
        this.consistency = randomFloat(0.4, 1.0, rng); // Wider range: 0.4 to 1.0 (was 0.6 to 1.0)
        
        // Time preference - each ostrich has a preferred time of day
        const timePeriods = ['night', 'dawn', 'morning', 'day', 'afternoon', 'dusk', 'evening'];
        const timeIndex = rng ? rng.nextInt(0, timePeriods.length - 1) : Math.floor(Math.random() * timePeriods.length);
        this.preferredTime = timePeriods[timeIndex];
        
        // Store RNG reference for use in update() method
        this.rng = rng;
        
        // Race state
        this.position = 0; // 0 to 1 (0 = start, 1 = finish)
        this.speed = 0;
        this.currentSpeed = this.baseSpeed;
        this.finished = false;
        this.finishTime = null;
        this.finishPosition = null;
        
        // Animation state
        this.animationFrame = 0;
        
        // Calculate time modifier based on current time vs preferred time
        const timeModifier = this.calculateTimeModifier(currentTimePeriod);
        
        // Calculate odds based on stats with more dramatic spread
        // Weight speed more heavily as it's most important
        // Apply time modifier to weighted average (affects odds)
        let weightedAvg = (this.baseSpeed * 0.5) + (this.stamina * 0.3) + (this.consistency * 0.2);
        weightedAvg = weightedAvg * timeModifier; // Apply time of day effect
        
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

    calculateTimeModifier(currentTimePeriod) {
        if (!currentTimePeriod) {
            // If no time period provided, no modifier
            return 1.0;
        }
        
        // If current time matches preferred time, boost performance
        if (currentTimePeriod === this.preferredTime) {
            return 1.15; // 15% boost when racing at preferred time
        }
        
        // Check if it's an opposite time (night vs day, morning vs evening, etc.)
        const oppositePairs = [
            ['night', 'day'],
            ['dawn', 'dusk'],
            ['morning', 'evening'],
            ['afternoon', 'night']
        ];
        
        for (const [time1, time2] of oppositePairs) {
            if ((this.preferredTime === time1 && currentTimePeriod === time2) ||
                (this.preferredTime === time2 && currentTimePeriod === time1)) {
                return 0.90; // 10% penalty for opposite time
            }
        }
        
        // Adjacent times get a small penalty
        const timeOrder = ['night', 'dawn', 'morning', 'day', 'afternoon', 'dusk', 'evening'];
        const preferredIndex = timeOrder.indexOf(this.preferredTime);
        const currentIndex = timeOrder.indexOf(currentTimePeriod);
        const distance = Math.abs(preferredIndex - currentIndex);
        
        if (distance === 1) {
            return 0.95; // 5% penalty for adjacent time
        } else if (distance === 2) {
            return 0.98; // 2% penalty for two steps away
        }
        
        // Default: no modifier
        return 1.0;
    }

    update(deltaTime, raceLength) {
        if (this.finished) return;

        // Update animation frame for leg movement
        this.animationFrame += deltaTime * 0.01 * this.currentSpeed;

        // Apply random variations based on consistency (increased from 0.3 to 0.5)
        // Use seeded RNG if available (multiplayer mode), otherwise use Math.random() (offline mode)
        const randomValue = this.rng ? this.rng.next() : Math.random();
        const variation = (randomValue - 0.5) * (1 - this.consistency) * 0.5;
        this.currentSpeed = this.baseSpeed + variation;

        // Stamina affects speed over time (increased impact from 0.3 to 0.5)
        // This means low stamina ostriches slow down MORE in late race
        const staminaFactor = 1 - (this.position * (1 - this.stamina) * 0.5);
        this.currentSpeed *= staminaFactor;

        // Update position
        this.position += (this.currentSpeed * deltaTime) / raceLength;
        
        // Finish when position reaches or exceeds 1 (with tolerance for floating point precision)
        // Lowered threshold from 0.9999 to 0.999 to prevent stalling
        if (this.position >= 0.999) {
            this.position = 1;
            this.finished = true;
        }
    }

    reset() {
        // Explicitly reset to 0 to avoid floating point accumulation issues
        this.position = 0.0;
        this.speed = 0.0;
        this.currentSpeed = this.baseSpeed;
        this.finished = false;
        this.finishTime = null;
        this.finishPosition = null;
        this.animationFrame = 0.0;
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
        // Don't initialize here - wait for time period to be available
    }

    initializeOstriches(currentTimePeriod = null, rng = null) {
        this.ostriches = [];
        
        // Randomly select 8 ostriches from the full pool
        const availableOstriches = [...OSTRICH_COLORS];
        const selectedOstriches = [];
        
        // Use seeded RNG if provided (multiplayer), otherwise Math.random() (offline)
        for (let i = 0; i < 8; i++) {
            const randomIndex = rng 
                ? rng.nextInt(0, availableOstriches.length - 1)
                : Math.floor(Math.random() * availableOstriches.length);
            
            selectedOstriches.push(availableOstriches.splice(randomIndex, 1)[0]);
        }
        
        // Create ostrich instances with numbers 1-8
        for (let i = 0; i < 8; i++) {
            const ostrich = new Ostrich(i + 1, selectedOstriches[i], currentTimePeriod, rng);
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

