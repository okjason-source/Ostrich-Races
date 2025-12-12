// Race mechanics and simulation

class Race {
    constructor(ostrichManager, renderer, canvas, soundSystem, eventSystem = null, rng = null) {
        this.ostrichManager = ostrichManager;
        this.renderer = renderer;
        this.canvas = canvas;
        this.soundSystem = soundSystem;
        this.eventSystem = eventSystem;
        this.rng = rng; // Seeded RNG for multiplayer mode (null for offline mode)
        this.state = 'waiting'; // waiting, counting, racing, finished
        this.countdown = 0;
        this.raceTime = 0;
        this.raceLength = 10000; // milliseconds (10 seconds)
        this.startTime = null;
        this.winnerAnnounced = false;
        this.activeAnimations = new Map(); // Map<ostrichNumber, {type, startTime, duration, data}>
        this.currentLeader = null; // Track current leader for lead change announcements
        this.lastLeadChangeTime = 0; // Throttle lead change announcements
        this.leadChangeCooldown = 2000; // Minimum 2 seconds between lead change announcements
        this.recommendedOstriches = []; // Recommended ostriches for glow effect
    }
    
    // Set recommended ostriches for visual indicators
    setRecommendedOstriches(recommendedNumbers) {
        this.recommendedOstriches = recommendedNumbers || [];
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
        this.winnerTTSComplete = false;
        this.activeAnimations.clear();
        this.ostrichManager.resetAll();
        this.currentLeader = null;
        this.lastLeadChangeTime = 0;
        
        // Clear any during-race events from previous race
        if (this.eventSystem) {
            this.eventSystem.duringRaceEvents.clear();
        }
        
        // Play race start sound
        if (this.soundSystem) {
            this.soundSystem.playRaceStart();
        }
    }
    
    // Start race with synchronized timestamp (multiplayer)
    startRaceSynchronized(serverTimestamp) {
        this.state = 'racing';
        this.raceTime = 0;
        // Use server timestamp for synchronization
        this.startTime = serverTimestamp;
        this.winnerAnnounced = false;
        this.winnerTTSComplete = false;
        this.activeAnimations.clear();
        this.ostrichManager.resetAll();
        this.currentLeader = null;
        this.lastLeadChangeTime = 0;
        
        // Clear any during-race events from previous race
        if (this.eventSystem) {
            this.eventSystem.duringRaceEvents.clear();
        }
        
        // Play race start sound
        if (this.soundSystem) {
            this.soundSystem.playRaceStart();
        }
    }
    
    getTrackWidth() {
        const canvasRect = this.canvas.getBoundingClientRect();
        const ostrichWidth = 70;
        const startMargin = 50;
        const finishLineWidth = 20;
        const endMargin = 10;
        return canvasRect.width - startMargin - endMargin - ostrichWidth - finishLineWidth;
    }

    update(deltaTime) {
        if (this.state === 'counting') {
            // Countdown logic handled separately
            return;
        }

        if (this.state === 'racing') {
            // Calculate race time from start time for synchronization (multiplayer)
            // If startTime is set (synchronized start), use it; otherwise use deltaTime accumulation (offline)
            if (this.startTime) {
                this.raceTime = Date.now() - this.startTime;
            } else {
                this.raceTime += deltaTime;
            }
            const currentTime = this.raceTime;
            
            // Check for during-race events and chain reactions
            if (this.eventSystem) {
                // Check for new events (no TTS for regular events)
                this.ostrichManager.ostriches.forEach(ostrich => {
                    if (!ostrich.finished) {
                        const newEvent = this.eventSystem.checkDuringRaceEvents(ostrich, currentTime);
                        if (newEvent) {
                            // Check for spin-out propel forward chance
                            if (newEvent.type === 'SPIN_OUT' && newEvent.propelForwardChance) {
                                // Use seeded RNG if available (multiplayer mode), otherwise use Math.random() (offline mode)
                                const randomValue = this.rng ? this.rng.next() : Math.random();
                                if (randomValue < newEvent.propelForwardChance) {
                                    newEvent.propelForward = true; // Mark as propelling forward
                                    newEvent.speedMultiplier = 1.01; // Extremely minimal speed boost (barely noticeable)
                                    newEvent.positionGain = 0.0005; // Minimal position gain (just a tiny step)
                                    newEvent.positionLoss = 0; // No position loss
                                }
                            }
                            
                            // Add animation (no TTS announcement for regular events)
                            this.activeAnimations.set(ostrich.number, {
                                type: newEvent.type,
                                startTime: currentTime,
                                duration: newEvent.duration,
                                data: newEvent
                            });
                        }
                    }
                });
                
                // Check for chain reactions
                const canvasRect = this.canvas.getBoundingClientRect();
                const chainEvents = this.eventSystem.checkChainReactions(
                    this.ostrichManager.ostriches,
                    canvasRect.width,
                    canvasRect.height,
                    this.getTrackWidth(),
                    40 // proximity threshold - must be close enough to touch (ostrich width is ~70px)
                );
                
                chainEvents.forEach(chainEvent => {
                    // Trigger chain event - get event data from eventSystem
                    const eventData = this.eventSystem.getEventData(chainEvent.eventType);
                    if (eventData) {
                        const chainEventObj = {
                            ...eventData,
                            type: chainEvent.eventType,
                            startTime: currentTime,
                            active: true
                        };
                        this.eventSystem.duringRaceEvents.set(chainEvent.ostrich.number, chainEventObj);
                        
                        // Add animation
                        this.activeAnimations.set(chainEvent.ostrich.number, {
                            type: chainEvent.eventType,
                            startTime: currentTime,
                            duration: eventData.duration,
                            data: chainEventObj
                        });
                        
                        // Get the original event that caused the chain reaction
                        const originalEvent = this.eventSystem.getDuringRaceEvent(chainEvent.triggeredBy);
                        const originalEventData = this.eventSystem.getEventData(originalEvent ? originalEvent.type : chainEvent.eventType);
                        
                        // Announce the original event that caused the chain reaction
                        if (this.soundSystem && originalEventData) {
                            this.soundSystem.announceEvent(chainEvent.triggeredBy, originalEventData.name);
                        }
                        
                        // Announce chain reaction
                        if (this.soundSystem) {
                            setTimeout(() => {
                                this.soundSystem.announceEvent(chainEvent.ostrich.number, 'Chain Reaction!');
                            }, 500); // Small delay after original event announcement
                        }
                    }
                });
            }
            
            // Update all ostriches and track finish times
            this.ostrichManager.ostriches.forEach(ostrich => {
                // Don't apply event effects if ostrich is very close to finishing (within 5% of finish line)
                // This ensures events can't block ostriches from finishing
                const isNearFinish = ostrich.position >= 0.95;
                
                // Apply active event effects (but don't prevent finishing)
                if (this.eventSystem && !isNearFinish) {
                    const activeEvent = this.eventSystem.getDuringRaceEvent(ostrich.number);
                    if (activeEvent) {
                        // Check for spin-out propel forward chance
                        if (activeEvent.type === 'SPIN_OUT' && activeEvent.propelForward) {
                            // Propel forward - minimal speed boost and position gain (just a few steps)
                            ostrich.currentSpeed *= 1.01; // Extremely minimal speed boost (barely noticeable)
                            ostrich.position = Math.min(1, ostrich.position + 0.0005); // Gain 0.05% position (just a tiny step)
                        } else {
                            // Normal event effects
                            let speedMultiplier = activeEvent.speedMultiplier;
                            let positionLoss = activeEvent.positionLoss;
                            let positionGain = activeEvent.positionGain;
                            
                            if (activeEvent.type === 'STUMBLE' || activeEvent.type === 'TRIP') {
                                // Both consistency and stamina affect event severity
                                // Consistency ranges from 0.4 to 1.0
                                // Stamina ranges from 0.5 to 1.0
                                // Higher consistency/stamina = less severe effects (recover better)
                                
                                // Map consistency (0.4-1.0) to effect multiplier (1.0-0.5)
                                // Higher consistency = lower effect multiplier = less severe
                                const consistencyFactor = 1.0 - ((ostrich.consistency - 0.4) / (1.0 - 0.4)) * 0.5;
                                // consistencyFactor ranges from 1.0 (at 0.4 consistency) to 0.5 (at 1.0 consistency)
                                
                                // Map stamina (0.5-1.0) to effect multiplier (1.0-0.5)
                                // Higher stamina = lower effect multiplier = less severe
                                const staminaFactor = 1.0 - ((ostrich.stamina - 0.5) / (1.0 - 0.5)) * 0.5;
                                // staminaFactor ranges from 1.0 (at 0.5 stamina) to 0.5 (at 1.0 stamina)
                                
                                // Combine both factors (average them for balanced effect)
                                const effectMultiplier = (consistencyFactor + staminaFactor) / 2;
                                // effectMultiplier ranges from 1.0 (low stats) to 0.5 (high stats)
                                
                                // For speed multiplier: higher consistency/stamina means less speed loss
                                // If speedMultiplier < 1.0 (speed reduction), make it less severe
                                if (speedMultiplier < 1.0) {
                                    // Interpolate between full effect and minimal effect based on stats
                                    // Example: 0.85 multiplier with high stats (effectMultiplier 0.5) becomes 0.925 (less severe)
                                    // Example: 0.85 multiplier with low stats (effectMultiplier 1.0) stays 0.85 (full effect)
                                    speedMultiplier = 1.0 - ((1.0 - speedMultiplier) * effectMultiplier);
                                }
                                
                                // For position loss: higher consistency/stamina means less position lost
                                if (positionLoss) {
                                    positionLoss = positionLoss * effectMultiplier;
                                }
                            }
                            
                            // Apply speed multiplier (temporary, won't prevent finishing)
                            ostrich.currentSpeed *= speedMultiplier;
                            
                            // Apply position change (but ensure they can still finish)
                            if (positionLoss && ostrich.position < 0.95) {
                                // Only apply position loss if not too close to finish (threshold at 0.95)
                                ostrich.position = Math.max(0, ostrich.position - positionLoss);
                            } else if (positionGain) {
                                ostrich.position = Math.min(1, ostrich.position + positionGain);
                            }
                        }
                    }
                }
                
                // Clear any active events for ostriches near finish to prevent interference
                if (isNearFinish && this.eventSystem) {
                    const activeEvent = this.eventSystem.getDuringRaceEvent(ostrich.number);
                    if (activeEvent) {
                        this.eventSystem.duringRaceEvents.delete(ostrich.number);
                    }
                }
                
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
                                // Store callback to notify when TTS finishes
                                this.winnerTTSComplete = false;
                                this.soundSystem.announceWinner(ostrich.number, ostrich.name, () => {
                                    console.log('Winner TTS callback fired');
                                    this.winnerTTSComplete = true;
                                    // Trigger a custom event to notify game.js
                                    if (typeof window !== 'undefined') {
                                        console.log('Dispatching winnerTTSComplete event');
                                        window.dispatchEvent(new CustomEvent('winnerTTSComplete'));
                                    }
                                });
                            }, 200);
                        } else {
                            // No sound system, mark as complete immediately
                            this.winnerTTSComplete = true;
                        }
                    }
                }
            });
            
            // Clean up expired animations
            this.activeAnimations.forEach((anim, ostrichNumber) => {
                if (currentTime - anim.startTime >= anim.duration) {
                    this.activeAnimations.delete(ostrichNumber);
                }
            });
            
            // Check for lead changes (only if race is still ongoing and no one has finished)
            if (!this.winnerAnnounced) {
                const unfinishedOstriches = this.ostrichManager.ostriches.filter(o => !o.finished);
                if (unfinishedOstriches.length > 0) {
                    // Find the current leader (ostrich with highest position)
                    const leader = unfinishedOstriches.reduce((prev, current) => 
                        (current.position > prev.position) ? current : prev
                    );
                    
                    // Check if leader has changed
                    if (this.currentLeader !== leader.number) {
                        const timeSinceLastChange = this.raceTime - this.lastLeadChangeTime;
                        
                        // Only announce if enough time has passed since last announcement
                        if (timeSinceLastChange >= this.leadChangeCooldown || this.currentLeader === null) {
                            this.currentLeader = leader.number;
                            this.lastLeadChangeTime = this.raceTime;
                            
                            // Announce lead change
                            if (this.soundSystem) {
                                this.soundSystem.announceLeadChange(leader.number, leader.name);
                            }
                        } else {
                            // Update leader silently if too soon for announcement
                            this.currentLeader = leader.number;
                        }
                    }
                }
            }
            
            // Check if race is finished (4 ostriches finished for superfecta, or time limit)
            const finished = this.ostrichManager.getFinishedOstriches();
            
            // Force-finish logic to ensure we get 4 finishers for superfecta and prevent freezing
            // If race time limit reached, force finish enough ostriches to reach 4 finishers
            if (this.raceTime >= this.raceLength) {
                // Race time limit reached - force finish enough to get to 4 finishers (guaranteed to prevent freeze)
                const unfinished = this.ostrichManager.ostriches.filter(o => !o.finished);
                // Sort by position (highest first) to assign finish times correctly
                unfinished.sort((a, b) => b.position - a.position);
                const needed = Math.max(0, 4 - finished.length);
                unfinished.slice(0, needed).forEach((ostrich, index) => {
                    // Set position to 1 and mark as finished
                    ostrich.position = 1;
                    ostrich.finished = true;
                    if (!ostrich.finishTime) {
                        // Assign finish times based on position (higher position = earlier finish)
                        // Use raceTime as base, add small increments for ordering
                        ostrich.finishTime = this.raceTime + index * 10;
                    }
                });
            } else if (finished.length === 3) {
                // 3 finished - force finish the 4th if very close (within 2% of finish line)
                this.ostrichManager.ostriches.forEach(ostrich => {
                    if (!ostrich.finished && ostrich.position >= 0.98) {
                        ostrich.position = 1;
                        ostrich.finished = true;
                        if (!ostrich.finishTime) {
                            ostrich.finishTime = this.raceTime;
                        }
                    }
                });
            } else if (this.raceTime >= this.raceLength * 0.95) {
                // At 95% of race time - aggressively force finish to get to 4 finishers (prevent freeze)
                const unfinished = this.ostrichManager.ostriches.filter(o => !o.finished);
                unfinished.sort((a, b) => b.position - a.position);
                const needed = Math.max(0, 4 - finished.length);
                unfinished.slice(0, needed).forEach((ostrich, index) => {
                    // Force finish even if not super close (within 10% of finish line)
                    if (ostrich.position >= 0.90) {
                        ostrich.position = 1;
                        ostrich.finished = true;
                        if (!ostrich.finishTime) {
                            ostrich.finishTime = this.raceTime + index * 10;
                        }
                    }
                });
            } else if (finished.length === 2 && this.raceTime >= this.raceLength * 0.9) {
                // If 2 finished and we're at 90% of race time, force finish those very close to get to 4
                const unfinished = this.ostrichManager.ostriches.filter(o => !o.finished);
                unfinished.sort((a, b) => b.position - a.position);
                const needed = 4 - finished.length;
                unfinished.slice(0, needed).forEach((ostrich, index) => {
                    if (ostrich.position >= 0.95) {
                        ostrich.position = 1;
                        ostrich.finished = true;
                        if (!ostrich.finishTime) {
                            ostrich.finishTime = this.raceTime + index * 10;
                        }
                    }
                });
            }
            
            const updatedFinished = this.ostrichManager.getFinishedOstriches();
            // Race finishes when 4 ostriches finish (for superfecta) OR race time limit is reached
            // The time limit is a hard guarantee that prevents freezing
            if (updatedFinished.length >= 4 || this.raceTime >= this.raceLength) {
                this.finishRace();
            }
        }
    }

    finishRace() {
        this.state = 'finished';
        
        // Clear all active animations
        this.activeAnimations.clear();
        
        // Clear all during-race events
        if (this.eventSystem) {
            this.eventSystem.duringRaceEvents.clear();
        }
        
        // Assign finish times for any ostriches that didn't finish
        this.ostrichManager.ostriches.forEach(ostrich => {
            if (!ostrich.finished || !ostrich.finishTime) {
                // Use position to determine order for those who didn't finish
                ostrich.finishTime = this.raceLength + (1 - ostrich.position) * 1000;
            }
        });
        
        this.ostrichManager.assignFinishPositions();
        
        // If winner was announced but TTS hasn't completed yet, ensure it's tracked
        // (The winner announcement happens in update() before finishRace() is called)
        if (this.winnerAnnounced && this.winnerTTSComplete === undefined) {
            // Winner was announced but TTS tracking wasn't set up, mark as complete
            // This handles edge cases where announcement happens but callback doesn't fire
            this.winnerTTSComplete = true;
        }
    }

    render() {
        this.renderer.clear();
        
        if (this.state === 'waiting') {
            const canvasRect = this.canvas.getBoundingClientRect();
            const centerX = canvasRect.width / 2;
            const centerY = canvasRect.height / 2;
            
            // Calculate responsive sizes based on canvas dimensions
            const isMobile = canvasRect.width < 768;
            const canvasHeight = canvasRect.height;
            const canvasWidth = canvasRect.width;
            
            // Scale font sizes and positions based on canvas size
            const tajFontSize = isMobile ? Math.min(120, canvasHeight * 0.3) : 120;
            const titleFontSize = isMobile ? Math.min(20, canvasWidth * 0.05) : 48;
            const subtitleFontSize = isMobile ? Math.min(14, canvasWidth * 0.035) : 24;
            const diamondSize = isMobile ? 4 : 8;
            const sparkleDistance = isMobile ? canvasWidth * 0.2 : 100;
            
            // Draw Taj Mahal emoji with golden glow and diamonds
            this.renderer.ctx.save();
            const tajX = centerX;
            const tajY = isMobile ? centerY - (canvasHeight * 0.15) : centerY - 100;
            
            // Draw golden glow behind emoji (multiple layers for effect)
            this.renderer.ctx.shadowBlur = isMobile ? 15 : 30;
            this.renderer.ctx.shadowColor = '#FFD700';
            this.renderer.ctx.font = `${tajFontSize}px Arial`;
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.textBaseline = 'middle';
            
            // Draw emoji with golden glow
            this.renderer.ctx.fillStyle = '#FFD700';
            this.renderer.ctx.fillText('🕌', tajX, tajY);
            
            // Add diamond sparkles around the Taj Mahal (scaled for mobile)
            const sparklePositions = [
                { x: tajX - sparkleDistance * 0.8, y: tajY - sparkleDistance * 0.6 }, // Top left
                { x: tajX + sparkleDistance * 0.8, y: tajY - sparkleDistance * 0.6 }, // Top right
                { x: tajX - sparkleDistance * 0.7, y: tajY + sparkleDistance * 0.4 }, // Bottom left
                { x: tajX + sparkleDistance * 0.7, y: tajY + sparkleDistance * 0.4 }, // Bottom right
                { x: tajX - sparkleDistance, y: tajY },     // Left
                { x: tajX + sparkleDistance, y: tajY },     // Right
            ];
            
            sparklePositions.forEach(pos => {
                // Only draw sparkles if they're within canvas bounds
                if (pos.x >= 0 && pos.x <= canvasWidth && pos.y >= 0 && pos.y <= canvasHeight) {
                    this.renderer.ctx.save();
                    this.renderer.ctx.translate(pos.x, pos.y);
                    this.renderer.ctx.rotate(Math.PI / 4); // Rotate 45 degrees for diamond shape
                    
                    // Diamond shape (rotated square)
                    this.renderer.ctx.fillStyle = '#00FFFF'; // Cyan for diamonds
                    this.renderer.ctx.strokeStyle = '#FFD700'; // Golden outline
                    this.renderer.ctx.lineWidth = isMobile ? 1 : 2;
                    this.renderer.ctx.shadowBlur = isMobile ? 8 : 15;
                    this.renderer.ctx.shadowColor = '#00FFFF';
                    
                    this.renderer.ctx.beginPath();
                    this.renderer.ctx.moveTo(0, -diamondSize);
                    this.renderer.ctx.lineTo(diamondSize, 0);
                    this.renderer.ctx.lineTo(0, diamondSize);
                    this.renderer.ctx.lineTo(-diamondSize, 0);
                    this.renderer.ctx.closePath();
                    this.renderer.ctx.fill();
                    this.renderer.ctx.stroke();
                    
                    this.renderer.ctx.restore();
                }
            });
            
            this.renderer.ctx.restore();
            
            // Draw "OSTRICH PALACE RACES" in large text with shadow effect
            this.renderer.ctx.save();
            
            // Calculate text position (below Taj Mahal, centered)
            const titleY = isMobile ? centerY + (canvasHeight * 0.05) : centerY - 20;
            const subtitleY = isMobile ? centerY + (canvasHeight * 0.15) : centerY + 30;
            
            // Shadow/outline
            this.renderer.ctx.shadowBlur = isMobile ? 5 : 10;
            this.renderer.ctx.shadowColor = '#FF00FF';
            this.renderer.ctx.font = `bold ${titleFontSize}px Arial`;
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.textBaseline = 'middle';
            
            // Check if text fits, if not, use smaller font
            const titleText = 'OSTRICH PALACE RACES';
            let finalTitleFontSize = titleFontSize;
            this.renderer.ctx.fillStyle = '#FF00FF';
            let textMetrics = this.renderer.ctx.measureText(titleText);
            if (textMetrics.width > canvasWidth * 0.9) {
                finalTitleFontSize = Math.max(12, (canvasWidth * 0.9) / (textMetrics.width / titleFontSize));
                this.renderer.ctx.font = `bold ${finalTitleFontSize}px Arial`;
                textMetrics = this.renderer.ctx.measureText(titleText);
            }
            
            this.renderer.ctx.fillText(titleText, centerX + (isMobile ? 1 : 3), titleY + (isMobile ? 1 : 3));
            
            // Main text
            this.renderer.ctx.shadowBlur = 0;
            this.renderer.ctx.fillStyle = '#FFD700';
            this.renderer.ctx.fillText(titleText, centerX, titleY);
            
            // Secondary shadow for cyan
            this.renderer.ctx.shadowBlur = isMobile ? 3 : 5;
            this.renderer.ctx.shadowColor = '#00FFFF';
            this.renderer.ctx.fillStyle = '#00FFFF';
            this.renderer.ctx.fillText(titleText, centerX + (isMobile ? 1 : 2), titleY + (isMobile ? 1 : 2));
            
            this.renderer.ctx.restore();
            
            // Draw "Place your bets" in smaller text below
            this.renderer.drawText(
                'Place your bets',
                centerX,
                subtitleY,
                subtitleFontSize,
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
        // Finish line should be where ostrich's front edge (right edge) crosses when position = 1
        // When position = 1, ostrich's left edge is at trackStartX + trackWidth
        // Ostrich's right edge (front) is at trackStartX + trackWidth + ostrichWidth
        const finishLineX = trackStartX + trackWidth + ostrichWidth;
        this.renderer.ctx.save();
        this.renderer.ctx.fillStyle = '#FFFFFF';
        const squareSize = 10;
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
            
            // Get active animation for this ostrich
            const animation = this.activeAnimations.get(ostrich.number);
            const animProgress = animation 
                ? Math.min(1, (this.raceTime - animation.startTime) / animation.duration)
                : 0;
            
            // Apply rotation for spin-out (smooth rotation)
            if (animation && animation.type === 'SPIN_OUT') {
                this.renderer.ctx.save();
                const centerX = x + width / 2;
                const centerY = y + height / 2;
                this.renderer.ctx.translate(centerX, centerY);
                // Smooth ease-out rotation (less than full 360 for smoother look)
                const smoothProgress = animProgress * animProgress;
                this.renderer.ctx.rotate(smoothProgress * Math.PI * 1.5); // 270° rotation, smoother
                this.renderer.ctx.translate(-centerX, -centerY);
            }
            
            // Draw continuous mud effects when running (based on animation frame)
            if (!ostrich.finished && ostrich.position > 0.05) {
                // Draw mud particles at feet when running
                this.drawMudParticles(x, y + height, ostrich.animationFrame);
            }
            
            // Draw dust cloud for trips/stumbles/spin-outs (more intense)
            if (animation && (animation.type === 'TRIP' || animation.type === 'STUMBLE' || animation.type === 'SPIN_OUT')) {
                this.drawDustCloud(x, y + height, animProgress);
            }
            
            // Draw glow aura and speed lines for burst of speed
            if (animation && animation.type === 'BURST_OF_SPEED') {
                this.drawBurstGlow(x, y, width, height, animProgress);
                this.drawSpeedLines(x, y, width, height, animProgress);
            }
            
            // Draw recommendation glow (golden aura for recommended ostriches)
            if (this.recommendedOstriches.includes(ostrich.number) && !ostrich.finished) {
                this.drawRecommendationGlow(x, y, width, height);
            }
            
            this.renderer.drawOstrich(
                x,
                y,
                width,
                height,
                ostrich.colorScheme,
                ostrich.number,
                ostrich.animationFrame,
                ostrich // Pass ostrich object for permanent visual features
            );
            
            // Reset transform if applied
            if (animation && animation.type === 'SPIN_OUT') {
                this.renderer.ctx.restore();
            }
            
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
        
        // Draw chain reaction connections
        if (this.eventSystem) {
            // Chain reaction lines disabled - user preference
            // this.drawChainReactions(trackStartX, trackWidth, laneHeight);
        }
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
    
    drawDustCloud(x, y, progress) {
        // Draw dust cloud particles at ostrich feet (smooth, subtle, minimal)
        this.renderer.ctx.save();
        const particleCount = 3; // Even fewer particles for cleaner look
        const fadeOut = 1 - progress;
        const smoothProgress = progress * progress; // Ease-out for smoother animation
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = 8 * smoothProgress; // Smaller, smoother movement
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance * 0.2 - 2 * smoothProgress; // Very subtle upward motion
            
            this.renderer.ctx.globalAlpha = fadeOut * 0.3; // More subtle
            this.renderer.ctx.fillStyle = '#8B7355'; // Brown/tan dust color
            this.renderer.ctx.beginPath();
            this.renderer.ctx.arc(px, py, 1.5 * (1 - smoothProgress * 0.3), 0, Math.PI * 2);
            this.renderer.ctx.fill();
        }
        this.renderer.ctx.restore();
    }
    
    drawSpeedLines(x, y, width, height, progress) {
        // Draw speed lines behind ostrich (smooth, subtle, minimal)
        this.renderer.ctx.save();
        const smoothProgress = progress * progress; // Ease-out for smoother animation
        this.renderer.ctx.globalAlpha = (progress < 0.5 ? smoothProgress * 2 : 1 - smoothProgress) * 0.3; // More subtle
        this.renderer.ctx.strokeStyle = '#FFD700';
        this.renderer.ctx.lineWidth = 1; // Thinner lines
        
        const lineCount = 2; // Even fewer lines for cleaner look
        for (let i = 0; i < lineCount; i++) {
            const offsetX = -6 - (i * 5);
            const startY = y + (height / lineCount) * i;
            const endY = startY + height / lineCount;
            
            this.renderer.ctx.beginPath();
            this.renderer.ctx.moveTo(x + offsetX, startY);
            this.renderer.ctx.lineTo(x + offsetX - 3, endY);
            this.renderer.ctx.stroke();
        }
        this.renderer.ctx.restore();
    }
    
    drawMudParticles(x, y, animationFrame) {
        // Draw continuous mud particles at ostrich feet when running
        this.renderer.ctx.save();
        const frameOffset = animationFrame % 20; // Cycle every 20 frames
        const particleCount = 4;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (frameOffset * 0.1);
            const distance = 5 + Math.sin(frameOffset * 0.3) * 3;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance * 0.3;
            
            // Mud color - brown/tan
            this.renderer.ctx.globalAlpha = 0.4;
            this.renderer.ctx.fillStyle = '#8B7355';
            this.renderer.ctx.beginPath();
            this.renderer.ctx.arc(px, py, 2, 0, Math.PI * 2);
            this.renderer.ctx.fill();
        }
        this.renderer.ctx.restore();
    }
    
    drawBurstGlow(x, y, width, height, progress) {
        // Draw golden glow aura around ostrich during burst of speed
        this.renderer.ctx.save();
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const maxRadius = Math.max(width, height) * 0.8;
        
        // Pulsing glow effect
        const pulse = 0.7 + Math.sin(progress * Math.PI * 4) * 0.3;
        const glowRadius = maxRadius * pulse;
        
        // Create radial gradient for glow
        const gradient = this.renderer.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, glowRadius
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)'); // Golden center
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.3)'); // Fading
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)'); // Transparent edge
        
        this.renderer.ctx.fillStyle = gradient;
        this.renderer.ctx.beginPath();
        this.renderer.ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        this.renderer.ctx.fill();
        this.renderer.ctx.restore();
    }
    
    drawRecommendationGlow(x, y, width, height) {
        // Draw golden glow aura around recommended ostriches
        this.renderer.ctx.save();
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const maxRadius = Math.max(width, height) * 0.6;
        
        // Subtle pulsing glow
        const time = Date.now() * 0.003; // Slow pulse
        const pulse = 0.8 + Math.sin(time) * 0.2;
        const glowRadius = maxRadius * pulse;
        
        // Create radial gradient for glow
        const gradient = this.renderer.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, glowRadius
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.4)'); // Golden center
        gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.2)'); // Fading
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)'); // Transparent edge
        
        this.renderer.ctx.fillStyle = gradient;
        this.renderer.ctx.beginPath();
        this.renderer.ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        this.renderer.ctx.fill();
        this.renderer.ctx.restore();
    }
    
    drawChainReactions(trackStartX, trackWidth, laneHeight) {
        // Draw visual connections between ostriches affected by chain reactions
        // Only connect ostriches that are actually close together (same logic as chain reaction system)
        const chainConnections = [];
        const proximityThreshold = 60; // Same threshold as chain reaction logic
        
        this.ostrichManager.ostriches.forEach((ostrich, index) => {
            const event = this.eventSystem.getDuringRaceEvent(ostrich.number);
            if (event && event.canChain) {
                // Find other ostriches that are actually close and affected
                this.ostrichManager.ostriches.forEach((other, otherIndex) => {
                    if (other.number === ostrich.number) return;
                    
                    const otherEvent = this.eventSystem.getDuringRaceEvent(other.number);
                    if (!otherEvent || !otherEvent.startTime) return;
                    
                    // Only show connections if events started close in time (chain reaction)
                    if (Math.abs(otherEvent.startTime - event.startTime) > 200) return;
                    
                    // Check lane proximity - only adjacent lanes (max 1 lane away)
                    const laneDiff = Math.abs(index - otherIndex);
                    if (laneDiff > 1) return; // Skip ostriches more than 1 lane away
                    
                    // Calculate actual distance between ostriches
                    const x1 = trackStartX + (ostrich.position * trackWidth);
                    const y1 = 30 + laneHeight * index + laneHeight / 2;
                    const x2 = trackStartX + (other.position * trackWidth);
                    const y2 = 30 + laneHeight * otherIndex + laneHeight / 2;
                    
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Adjust threshold based on lane difference (same as chain reaction logic)
                    let adjustedThreshold = proximityThreshold;
                    if (laneDiff === 0) {
                        // Same lane: can be closer (within ostrich width ~70px)
                        adjustedThreshold = 70;
                    } else if (laneDiff === 1) {
                        // Adjacent lane: must be very close (within half ostrich width)
                        adjustedThreshold = 40;
                    }
                    
                    // Only draw line if ostriches are actually close enough to touch
                    if (distance <= adjustedThreshold) {
                        chainConnections.push({ x1, y1, x2, y2 });
                    }
                });
            }
        });
        
        // Draw chain reaction lines
        if (chainConnections.length > 0) {
            this.renderer.ctx.save();
            this.renderer.ctx.strokeStyle = '#FFD700';
            this.renderer.ctx.lineWidth = 2;
            this.renderer.ctx.globalAlpha = 0.6;
            this.renderer.ctx.setLineDash([5, 5]);
            
            chainConnections.forEach(conn => {
                this.renderer.ctx.beginPath();
                this.renderer.ctx.moveTo(conn.x1, conn.y1);
                this.renderer.ctx.lineTo(conn.x2, conn.y2);
                this.renderer.ctx.stroke();
            });
            
            this.renderer.ctx.restore();
        }
    }
}

