// Random Events System - Pre-race and during-race events

// Pre-race event types
const PRE_RACE_EVENTS = {
    SICK: {
        name: 'Sick',
        icon: '⚠️',
        modifier: { speed: -0.20, stamina: -0.15 },
        probability: 0.05 // 5% chance
    },
    TIRED: {
        name: 'Tired',
        icon: '⚠️',
        modifier: { speed: -0.15, stamina: -0.10 },
        probability: 0.05 // 5% chance
    },
    MUDDY: {
        name: 'Muddy',
        icon: '⚠️',
        modifier: { speed: -0.10, consistency: -0.05 },
        probability: 0.06 // 6% chance
    },
    ENERGIZED: {
        name: 'Energized',
        icon: '⚠️',
        modifier: { speed: 0.10 },
        probability: 0.03 // 3% chance (rarer positive event)
    },
    NERVOUS: {
        name: 'Nervous',
        icon: '⚠️',
        modifier: { consistency: -0.05 },
        probability: 0.05 // 5% chance
    }
};

// During-race event types
const DURING_RACE_EVENTS = {
    TRIP: {
        name: 'Trip',
        speedMultiplier: 0.85, // Speed drops to 85% (less severe)
        duration: 200, // milliseconds (shorter)
        positionLoss: 0.003, // Lose 0.3% position (reduced from 1% to prevent stalling)
        canChain: true,
        chainProbability: 0.08, // Reduced chain probability (from 0.15)
        probability: 0.0003 // Reduced from 0.001 (0.03% chance per frame, much rarer)
    },
    SPIN_OUT: {
        name: 'Spin Out',
        speedMultiplier: 0.70, // Speed drops to 70% (less severe)
        duration: 400, // milliseconds (shorter)
        positionLoss: 0.005, // Lose 0.5% position (reduced from 2% to prevent stalling)
        canChain: true,
        chainProbability: 0.10, // Reduced chain probability (from 0.20)
        probability: 0.0002, // Reduced from 0.0005 (0.02% chance per frame, very rare)
        propelForwardChance: 0.15 // 15% chance to propel forward instead
    },
    BURST_OF_SPEED: {
        name: 'Burst of Speed',
        speedMultiplier: 1.05, // Speed boosts to 105% (very minimal boost)
        duration: 500, // milliseconds (shorter)
        positionGain: 0.005, // Gain 0.5% position (very minimal)
        canChain: false,
        chainProbability: 0,
        probability: 0.001 // 0.1% chance per frame (rare)
    },
    STUMBLE: {
        name: 'Stumble',
        speedMultiplier: 0.90, // Speed drops to 90% (less severe)
        duration: 200, // milliseconds (shorter)
        positionLoss: 0.002, // Lose 0.2% position (reduced from 0.5% to prevent stalling)
        canChain: true,
        chainProbability: 0.05, // Reduced chain probability (from 0.10)
        probability: 0.0005 // Reduced from 0.0015 (0.05% chance per frame, much rarer)
    }
};

class EventSystem {
    constructor(rng = null) {
        this.preRaceEvents = new Map(); // Map<ostrichNumber, event>
        this.duringRaceEvents = new Map(); // Map<ostrichNumber, {event, startTime, active}>
        this.rng = rng; // Seeded RNG for multiplayer mode (null for offline mode)
    }

    // Generate pre-race events for all ostriches
    generatePreRaceEvents(ostriches) {
        this.preRaceEvents.clear();
        
        ostriches.forEach(ostrich => {
            // Roll for each event type
            for (const [eventType, eventData] of Object.entries(PRE_RACE_EVENTS)) {
                // Use seeded RNG if available (multiplayer mode), otherwise use Math.random() (offline mode)
                const randomValue = this.rng ? this.rng.next() : Math.random();
                if (randomValue < eventData.probability) {
                    // Only one event per ostrich (first one that triggers)
                    if (!this.preRaceEvents.has(ostrich.number)) {
                        this.preRaceEvents.set(ostrich.number, {
                            type: eventType,
                            ...eventData
                        });
                        break;
                    }
                }
            }
        });
    }

    // Get pre-race event for an ostrich
    getPreRaceEvent(ostrichNumber) {
        return this.preRaceEvents.get(ostrichNumber) || null;
    }

    // Apply pre-race event modifiers to ostrich stats
    applyPreRaceModifiers(ostrich) {
        const event = this.getPreRaceEvent(ostrich.number);
        if (!event) return;

        // Apply modifiers to base stats
        if (event.modifier.speed) {
            ostrich.baseSpeed *= (1 + event.modifier.speed);
        }
        if (event.modifier.stamina) {
            ostrich.stamina *= (1 + event.modifier.stamina);
        }
        if (event.modifier.consistency) {
            ostrich.consistency *= (1 + event.modifier.consistency);
        }
    }

    // Check and trigger during-race events
    checkDuringRaceEvents(ostrich, currentTime) {
        // Don't trigger events if ostrich is very close to finishing (within 5% of finish line)
        // This prevents events from blocking ostriches from finishing
        if (ostrich.position >= 0.95) {
            return null;
        }
        
        // Don't trigger if already has an active event
        if (this.duringRaceEvents.has(ostrich.number)) {
            const activeEvent = this.duringRaceEvents.get(ostrich.number);
            // Check if event has expired
            if (currentTime - activeEvent.startTime >= activeEvent.duration) {
                this.duringRaceEvents.delete(ostrich.number);
            }
            return null;
        }
        
        // Limit total active events - don't trigger if too many events are already active
        if (this.duringRaceEvents.size >= 1) {
            return null; // Max 1 event active at once for cleaner races
        }
        
        // Only check every 60 frames (roughly every 1000ms at 60fps) to reduce frequency further
        // Increased from 30 frames to 60 frames to make events less frequent
        if (Math.floor(currentTime / 16) % 60 !== 0) {
            return null;
        }

        // Roll for each event type
        for (const [eventType, eventData] of Object.entries(DURING_RACE_EVENTS)) {
            // Use seeded RNG if available (multiplayer mode), otherwise use Math.random() (offline mode)
            const randomValue = this.rng ? this.rng.next() : Math.random();
            if (randomValue < eventData.probability * 60) { // Adjust for frame skipping (60 frames)
                // Trigger event
                const event = {
                    type: eventType,
                    ...eventData,
                    startTime: currentTime,
                    active: true
                };
                this.duringRaceEvents.set(ostrich.number, event);
                return event;
            }
        }

        return null;
    }

    // Get active during-race event for an ostrich
    getDuringRaceEvent(ostrichNumber) {
        return this.duringRaceEvents.get(ostrichNumber) || null;
    }

    // Check for chain reactions (ostrich with event affects closest birds)
    checkChainReactions(ostriches, canvasWidth, canvasHeight, trackWidth, proximityThreshold = 60) {
        const chainEvents = [];

        // Find ostriches with active events
        const ostrichesWithEvents = ostriches.filter(o => 
            this.duringRaceEvents.has(o.number)
        );

        ostrichesWithEvents.forEach((ostrichWithEvent, eventIndex) => {
            const event = this.duringRaceEvents.get(ostrichWithEvent.number);
            
            // Only chain events can trigger chain reactions
            if (!event.canChain) return;

            // Calculate distances to all other ostriches
            const distances = [];
            ostriches.forEach((otherOstrich, otherIndex) => {
                // Skip self
                if (otherOstrich.number === ostrichWithEvent.number) return;
                
                // Skip if other ostrich already has an event
                if (this.duringRaceEvents.has(otherOstrich.number)) return;

                // Calculate distance (x and y coordinates)
                const x1 = ostrichWithEvent.getDisplayX(canvasWidth, trackWidth);
                const y1 = ostrichWithEvent.getDisplayY(canvasHeight, eventIndex, ostriches.length);
                const x2 = otherOstrich.getDisplayX(canvasWidth, trackWidth);
                const y2 = otherOstrich.getDisplayY(canvasHeight, otherIndex, ostriches.length);

                // Calculate Euclidean distance
                const dx = x2 - x1;
                const dy = y2 - y1;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Lane proximity - only affect adjacent lanes (max 1 lane away)
                const laneDiff = Math.abs(eventIndex - otherIndex);
                
                // Only allow chain reactions to adjacent lanes (same lane or 1 lane away)
                if (laneDiff > 1) {
                    return; // Skip ostriches more than 1 lane away
                }
                
                // Ostrich width is ~70px, so they need to be within touching distance
                // Same lane: can be closer (within ostrich width)
                // Adjacent lane: must be very close (within half ostrich width)
                let adjustedThreshold = proximityThreshold;
                if (laneDiff === 0) {
                    adjustedThreshold = 70; // Same lane - within ostrich width (touching)
                } else if (laneDiff === 1) {
                    adjustedThreshold = 35; // Adjacent lane - must be very close to touch
                }
                
                // Only consider ostriches within touching distance
                if (distance <= adjustedThreshold) {
                    distances.push({
                        ostrich: otherOstrich,
                        distance: distance,
                        laneDiff: laneDiff,
                        adjustedThreshold: adjustedThreshold
                    });
                }
            });
            
            // Sort by distance (closest first)
            distances.sort((a, b) => a.distance - b.distance);
            
            // Only affect the 1-2 closest ostriches
            const maxAffected = Math.min(2, distances.length);
            for (let i = 0; i < maxAffected; i++) {
                const closest = distances[i];
                // Roll for chain reaction (higher probability for closer ostriches)
                const distanceFactor = 1 - (closest.distance / closest.adjustedThreshold); // 0 to 1, closer = higher
                const adjustedProbability = event.chainProbability * (0.5 + distanceFactor * 0.5); // 50-100% of base probability
                
                // Use seeded RNG if available (multiplayer mode), otherwise use Math.random() (offline mode)
                const randomValue = this.rng ? this.rng.next() : Math.random();
                if (randomValue < adjustedProbability) {
                    // Trigger same event on closest ostrich
                    chainEvents.push({
                        ostrich: closest.ostrich,
                        eventType: event.type,
                        triggeredBy: ostrichWithEvent.number
                    });
                    // Only trigger one chain reaction per event (affect closest one)
                    break;
                }
            }
        });

        return chainEvents;
    }

    // Get event data by type
    getEventData(eventType) {
        return DURING_RACE_EVENTS[eventType] || null;
    }

    // Clear all events (for new race)
    clearAll() {
        this.preRaceEvents.clear();
        this.duringRaceEvents.clear();
    }
}

