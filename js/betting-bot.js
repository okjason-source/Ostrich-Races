// Betting Bot - Follows LLM recommendations and learns over time

class BettingBot {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.stats = {
            totalRaces: 0,
            totalBets: 0,
            totalWins: 0,
            totalLosses: 0,
            totalProfit: 0,
            betTypeStats: {
                win: { bets: 0, wins: 0, profit: 0 },
                place: { bets: 0, wins: 0, profit: 0 },
                show: { bets: 0, wins: 0, profit: 0 },
                exacta: { bets: 0, wins: 0, profit: 0 },
                trifecta: { bets: 0, wins: 0, profit: 0 },
                superfecta: { bets: 0, wins: 0, profit: 0 },
                quinella: { bets: 0, wins: 0, profit: 0 }
            },
            ostrichStats: {}, // Track performance per ostrich recommendation
            llmAccuracy: [] // Track if LLM recommendations won
        };
        
        this.loadStats();
        this.betAmount = 1000000; // Default bet amount per recommendation
        this.learningEnabled = true;
        this.fullAuto = false; // Full auto mode: automatically call LLM and start race
        this.placedBetsThisRace = false; // Track if bot placed bets in current race
        this.useLLM = false; // Set to false for conservative rule-based betting
        this.betsAnnouncementPromise = null; // Promise that resolves when bet announcement TTS finishes
        this.isStatsHidden = false; // Track if user manually hid stats
        
        // Load full auto state from localStorage
        this.loadFullAutoState();
    }
    
    // Load stats from storage
    loadStats() {
        const saved = localStorage.getItem('betting_bot_stats');
        if (saved) {
            try {
                this.stats = JSON.parse(saved);
            } catch (e) {
                console.warn('Failed to load bot stats:', e);
            }
        }
    }
    
    // Save stats to storage
    saveStats() {
        try {
            localStorage.setItem('betting_bot_stats', JSON.stringify(this.stats));
        } catch (e) {
            console.warn('Failed to save bot stats:', e);
        }
    }
    
    // Save full auto state to localStorage
    saveFullAutoState() {
        try {
            localStorage.setItem('betting_bot_fullauto', JSON.stringify({
                enabled: this.enabled,
                fullAuto: this.fullAuto,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save full auto state:', e);
        }
    }
    
    // Load full auto state from localStorage
    loadFullAutoState() {
        try {
            const saved = localStorage.getItem('betting_bot_fullauto');
            if (saved) {
                const state = JSON.parse(saved);
                // Only restore if saved within last 24 hours (to avoid stale state)
                const age = Date.now() - (state.timestamp || 0);
                if (age < 24 * 60 * 60 * 1000) {
                    // Restore state after a delay to ensure game is initialized
                    setTimeout(() => {
                        if (state.enabled) {
                            this.enabled = true;
                        }
                        if (state.fullAuto && state.enabled) {
                            this.fullAuto = true;
                            this.updateUI();
                            // Trigger auto run if full auto was enabled and race is ready
                            if (this.game && this.game.race && this.game.race.state === 'waiting') {
                                // Small additional delay to ensure everything is ready
                                setTimeout(() => {
                                    if (this.fullAuto && this.enabled) {
                                        this.autoRun();
                                    }
                                }, 500);
                            }
                        } else {
                            // Update UI even if not restoring full auto
                            this.updateUI();
                        }
                    }, 2000); // Wait 2 seconds for game to fully initialize
                } else {
                    // Clear stale state
                    this.clearFullAutoState();
                }
            }
        } catch (e) {
            console.warn('Failed to load full auto state:', e);
            this.clearFullAutoState();
        }
    }
    
    // Clear full auto state from localStorage
    clearFullAutoState() {
        try {
            localStorage.removeItem('betting_bot_fullauto');
        } catch (e) {
            console.warn('Failed to clear full auto state:', e);
        }
    }
    
    // Enable/disable the bot
    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.fullAuto = false; // Turn off full auto if bot is disabled
            // When bot is turned off, minimize stats box
            this.isStatsHidden = true;
            // Clear full auto state when bot is disabled
            this.clearFullAutoState();
        } else {
            // When bot is turned on, show stats by default
            this.isStatsHidden = false;
        }
        this.saveFullAutoState();
        this.updateUI();
        return this.enabled;
    }
    
    toggleStatsVisibility() {
        // Only allow toggling stats visibility when bot is enabled
        if (this.enabled) {
            this.isStatsHidden = !this.isStatsHidden;
            this.updateUI();
        }
    }
    
    
    // Place bets based on LLM recommendations OR conservative rule-based logic
    async placeBetsFromLLM() {
        if (!this.enabled) {
            return;
        }
        
        // Check if LLM recommendations are available (prioritize them if they exist)
        const recommendedOstriches = this.game.llmExpert ? this.game.llmExpert.getRecommendedOstriches() : [];
        
        if (recommendedOstriches.length > 0) {
            // LLM recommendations available - use them
            console.log('Bot: Placing bets based on LLM recommendations...');
            
            recommendedOstriches.forEach(ostrichNumber => {
                const exoticTypes = this.game.llmExpert ? this.game.llmExpert.getRecommendedExotics(ostrichNumber) : [];
                const ostrich = this.game.ostrichManager.ostriches.find(o => o.number === ostrichNumber);
                
                if (!ostrich) return;
                
                if (exoticTypes.length > 0) {
                    exoticTypes.forEach(exoticType => {
                        // For exotic bets, use other recommended ostriches as picks when available
                        this.placeExoticBetWithRecommendedPicks(ostrichNumber, exoticType, recommendedOstriches);
                    });
                } else {
                    this.placeRegularBet(ostrichNumber, 'win');
                }
            });
        } else {
            // No LLM recommendations - use conservative rule-based betting
            console.log('Bot: No LLM recommendations available, using conservative rule-based betting...');
            this.placeConservativeBets();
        }
        
        // Track that we placed bets for this race
        this.stats.totalRaces++;
        this.placedBetsThisRace = true;
        this.updateUI();
        
        // In multiplayer mode, auto-mark ready after placing bets
        // For full auto when hosting, mark ready immediately (host manages race starts)
        // For regular bot mode, mark ready after delay to allow review
        if (this.game.isMultiplayer && this.game.multiplayerClient) {
            // Mark ready immediately for full auto (don't wait for TTS - host needs to know we're ready)
            // For regular bot mode, wait a bit to allow review
            const delay = this.fullAuto ? 100 : 1000; // Much faster for full auto (100ms just to ensure bets are processed)
            setTimeout(() => {
                this.game.markReady();
            }, delay);
        }
        
        // Announce bets after placing them (game.announceBets will handle TTS and timing)
        // Store the promise so autoRun can wait for it
        // Note: announceBets is also called from placeBet/placeExoticBet, so we just need to wait for it
        // For full auto in hosting mode, we mark ready immediately and let TTS happen in background
        if (this.game && this.game.announceBets) {
            setTimeout(() => {
                // Get the promise (will return existing one if already announcing)
                this.betsAnnouncementPromise = this.game.announceBets();
            }, 1000); // Delay to ensure all bets are fully processed and batched
        }
    }
    
    // Conservative betting strategy: bet on favorites with safe bet types and appropriate exotics
    // Takes into account pre-race events (avoids negative events, favors positive events)
    placeConservativeBets() {
        const ostriches = [...this.game.ostrichManager.ostriches];
        const eventSystem = this.game.eventSystem;
        
        // Get pre-race events and calculate adjusted odds/rankings
        const ostrichData = ostriches.map(ostrich => {
            const preRaceEvent = eventSystem ? eventSystem.getPreRaceEvent(ostrich.number) : null;
            let eventModifier = 0; // Positive = better, negative = worse
            
            if (preRaceEvent) {
                // Calculate event impact on performance
                if (preRaceEvent.type === 'SICK') {
                    eventModifier = -0.35; // -20% speed, -15% stamina = very bad
                } else if (preRaceEvent.type === 'TIRED') {
                    eventModifier = -0.25; // -15% speed, -10% stamina = bad
                } else if (preRaceEvent.type === 'MUDDY') {
                    eventModifier = -0.15; // -10% speed, -5% consistency = somewhat bad
                } else if (preRaceEvent.type === 'NERVOUS') {
                    eventModifier = -0.05; // -5% consistency = slightly bad
                } else if (preRaceEvent.type === 'ENERGIZED') {
                    eventModifier = 0.10; // +10% speed = good
                }
            }
            
            // Adjust effective odds based on events (positive event = better odds, negative = worse)
            // Lower odds = better, so subtract eventModifier from odds
            const effectiveOdds = Math.max(0.1, ostrich.odds - (eventModifier * 10));
            
            return {
                ostrich,
                preRaceEvent,
                eventModifier,
                effectiveOdds
            };
        });
        
        // Sort by effective odds (accounting for events)
        ostrichData.sort((a, b) => a.effectiveOdds - b.effectiveOdds);
        
        // Filter out ostriches with severe negative events (SICK, TIRED)
        const viableOstriches = ostrichData.filter(data => {
            if (!data.preRaceEvent) return true; // No event = viable
            // Avoid SICK and TIRED ostriches (too risky)
            return data.preRaceEvent.type !== 'SICK' && data.preRaceEvent.type !== 'TIRED';
        });
        
        if (viableOstriches.length === 0) {
            console.log('Bot: No viable ostriches (all have severe negative events)');
            return;
        }
        
        // Strategy: Bet on top viable favorites, using PLACE for safety
        // Only bet if odds are reasonable (not too high risk)
        const maxOdds = 8; // Don't bet on anything over 8-1 odds
        
        let betsPlaced = 0;
        const maxBets = 2; // Limit to 2 regular bets per race
        
        // Place regular bets on viable favorites
        for (const data of viableOstriches) {
            if (betsPlaced >= maxBets) break;
            if (data.ostrich.odds > maxOdds) break; // Skip if odds too high
            
            // For the favorite (lowest effective odds), bet WIN
            // For 2nd favorite, bet PLACE for safety
            const betType = betsPlaced === 0 ? 'win' : 'place';
            
            const eventInfo = data.preRaceEvent 
                ? ` [${data.preRaceEvent.name}]` 
                : data.eventModifier > 0 ? ' [ENERGIZED]' : '';
            
            if (this.placeRegularBet(data.ostrich.number, betType)) {
                betsPlaced++;
                console.log(`Bot: Conservative bet - ${betType.toUpperCase()} on ${data.ostrich.name} (${data.ostrich.odds}-1 odds${eventInfo})`);
            }
        }
        
        // Consider exotic bets when appropriate (only on viable ostriches)
        const topViable = viableOstriches.slice(0, 4); // Get top 4 for superfecta/trifecta
        
        // Check for very strong favorites (trifecta/superfecta opportunities)
        if (topViable.length >= 4 && 
            topViable[0].ostrich.odds <= 2 && 
            topViable[1].ostrich.odds <= 3 && 
            topViable[2].ostrich.odds <= 4 &&
            topViable[3].ostrich.odds <= 6) {
            // Very strong top 4 - consider SUPERFECTA
            const favorite = topViable[0].ostrich;
            const second = topViable[1].ostrich;
            const third = topViable[2].ostrich;
            const fourth = topViable[3].ostrich;
            
            // Check for bad events
            const hasBadEvents = topViable.slice(0, 4).some(data => {
                const event = data.preRaceEvent;
                return event && (event.type === 'SICK' || event.type === 'TIRED');
            });
            
            if (!hasBadEvents) {
                if (this.placeExoticBetWithPicks('superfecta', [favorite.number, second.number, third.number, fourth.number])) {
                    console.log(`Bot: Conservative exotic - SUPERFECTA on ${favorite.name}, ${second.name}, ${third.name}, ${fourth.name}`);
                }
            }
        } else if (topViable.length >= 3 && 
                   topViable[0].ostrich.odds <= 2.5 && 
                   topViable[1].ostrich.odds <= 4 && 
                   topViable[2].ostrich.odds <= 5) {
            // Strong top 3 - consider TRIFECTA
            const favorite = topViable[0].ostrich;
            const second = topViable[1].ostrich;
            const third = topViable[2].ostrich;
            
            // Check for bad events
            const hasBadEvents = topViable.slice(0, 3).some(data => {
                const event = data.preRaceEvent;
                return event && (event.type === 'SICK' || event.type === 'TIRED');
            });
            
            if (!hasBadEvents) {
                if (this.placeExoticBetWithPicks('trifecta', [favorite.number, second.number, third.number])) {
                    console.log(`Bot: Conservative exotic - TRIFECTA on ${favorite.name}, ${second.name}, ${third.name}`);
                }
            }
        }
        
        // Check for exacta (strong favorite with clear 2nd)
        if (topViable.length >= 2 && topViable[0].ostrich.odds <= 4 && topViable[1].ostrich.odds <= 6) {
            const favorite = topViable[0].ostrich;
            const secondFavorite = topViable[1].ostrich;
            
            // Only place exotic if favorite doesn't have severe negative events
            const favoriteEvent = topViable[0].preRaceEvent;
            const secondEvent = topViable[1].preRaceEvent;
            const favoriteHasBadEvent = favoriteEvent && (favoriteEvent.type === 'SICK' || favoriteEvent.type === 'TIRED');
            const secondHasBadEvent = secondEvent && (secondEvent.type === 'SICK' || secondEvent.type === 'TIRED');
            
            if (!favoriteHasBadEvent && !secondHasBadEvent) {
                // Place EXACTA bet (favorite to win, 2nd to place) - more likely than quinella
                if (this.placeExoticBetWithPicks('exacta', [favorite.number, secondFavorite.number])) {
                    console.log(`Bot: Conservative exotic - EXACTA on ${favorite.name} then ${secondFavorite.name}`);
                }
            }
        }
        
        // Check for quinella (safer option when exacta conditions not met)
        if (topViable.length >= 2 && topViable[0].ostrich.odds <= 6 && topViable[1].ostrich.odds <= 7) {
            const favorite = topViable[0].ostrich;
            const secondFavorite = topViable[1].ostrich;
            
            // Only place exotic if neither has severe negative events
            const favoriteEvent = topViable[0].preRaceEvent;
            const secondEvent = topViable[1].preRaceEvent;
            const favoriteHasBadEvent = favoriteEvent && (favoriteEvent.type === 'SICK' || favoriteEvent.type === 'TIRED');
            const secondHasBadEvent = secondEvent && (secondEvent.type === 'SICK' || secondEvent.type === 'TIRED');
            
            if (!favoriteHasBadEvent && !secondHasBadEvent) {
                // Only place QUINELLA if we haven't already placed an exacta on these two
                const hasExacta = this.game.exoticBettingSystem.exoticBets.some(bet => 
                    bet.type === 'exacta' && 
                    bet.picks.length === 2 &&
                    bet.picks.includes(favorite.number) && 
                    bet.picks.includes(secondFavorite.number)
                );
                
                if (!hasExacta) {
                    // Place QUINELLA bet on top 2 viable favorites (safer, order doesn't matter)
                    if (this.placeExoticBetWithPicks('quinella', [favorite.number, secondFavorite.number])) {
                        console.log(`Bot: Conservative exotic - QUINELLA on ${favorite.name} and ${secondFavorite.name}`);
                    }
                }
            }
        }
        
        if (betsPlaced === 0) {
            console.log('Bot: No conservative bets placed (all odds too high or have negative events)');
        }
    }
    
    // Place exotic bet with specific picks (for conservative strategy)
    placeExoticBetWithPicks(exoticType, picks) {
        if (!this.enabled || picks.length < 2) return false;
        
        // Ensure no duplicate picks
        const uniquePicks = [...new Set(picks)];
        if (uniquePicks.length !== picks.length) return false;
        
        // Validate picks based on exotic type
        const numPicksRequired = exoticType === 'exacta' || exoticType === 'quinella' ? 2 :
                                exoticType === 'trifecta' ? 3 : 4;
        
        if (uniquePicks.length < numPicksRequired) {
            // Fill remaining picks with next favorites
            const ostriches = [...this.game.ostrichManager.ostriches].sort((a, b) => a.odds - b.odds);
            for (const ostrich of ostriches) {
                if (uniquePicks.length >= numPicksRequired) break;
                if (!uniquePicks.includes(ostrich.number)) {
                    uniquePicks.push(ostrich.number);
                }
            }
        }
        
        if (uniquePicks.length < numPicksRequired) return false;
        
        const finalPicks = uniquePicks.slice(0, numPicksRequired);
        
        // Check if this exact exotic bet already exists (same type and picks)
        const existingBet = this.game.exoticBettingSystem.exoticBets.find(bet => 
            bet.type === exoticType && 
            bet.picks.length === finalPicks.length &&
            bet.picks.every((pick, index) => pick === finalPicks[index])
        );
        
        if (existingBet) {
            // Consolidate: add to existing bet amount
            existingBet.amount += this.betAmount;
            this.game.updateBankroll(this.game.bankroll - this.betAmount);
            this.game.updateExoticBetsDisplay();
            this.game.updateStartButton();
            console.log(`Bot: Consolidated ${exoticType.toUpperCase()} bet on ${finalPicks.join('-')} - Total: $${existingBet.amount.toLocaleString()}`);
        } else {
            // Place new exotic bet
            this.game.exoticBettingSystem.placeExoticBet(exoticType, finalPicks, this.betAmount);
            this.game.updateBankroll(this.game.bankroll - this.betAmount);
            this.game.updateExoticBetsDisplay();
            this.game.updateStartButton();
            this.stats.totalBets++;
            this.stats.betTypeStats[exoticType].bets++;
            console.log(`Bot: Placed ${exoticType.toUpperCase()} bet on ${finalPicks.join('-')} for $${this.betAmount.toLocaleString()}`);
        }
        
        return true;
    }
    
    // Place a regular bet (WIN/PLACE/SHOW)
    placeRegularBet(ostrichNumber, betType = 'win') {
        if (!this.enabled) return false;
        
        const success = this.game.placeBet(ostrichNumber, this.betAmount, betType);
        
        if (success) {
            this.stats.totalBets++;
            this.stats.betTypeStats[betType].bets++;
            
            // Track ostrich stats
            if (!this.stats.ostrichStats[ostrichNumber]) {
                this.stats.ostrichStats[ostrichNumber] = {
                    bets: 0,
                    wins: 0,
                    profit: 0
                };
            }
            this.stats.ostrichStats[ostrichNumber].bets++;
            
            console.log(`Bot: Placed ${betType.toUpperCase()} bet on Ostrich ${ostrichNumber} for $${this.betAmount.toLocaleString()}`);
        }
        
        return success;
    }
    
    // Place an exotic bet with recommended picks (prioritizes other recommended ostriches)
    placeExoticBetWithRecommendedPicks(ostrichNumber, exoticType, recommendedOstriches = []) {
        if (!this.enabled) return false;
        
        const picks = [ostrichNumber];
        const numPicksRequired = exoticType === 'exacta' || exoticType === 'quinella' ? 2 :
                                exoticType === 'trifecta' ? 3 : 4;
        
        // Use other recommended ostriches first, then fall back to all ostriches
        const otherRecommended = recommendedOstriches.filter(n => n !== ostrichNumber);
        const allOtherOstriches = this.game.ostrichManager.ostriches
            .filter(o => o.number !== ostrichNumber)
            .map(o => o.number);
        
        // Prioritize recommended ostriches, then use all others
        const availablePicks = [...otherRecommended, ...allOtherOstriches.filter(n => !otherRecommended.includes(n))];
        
        // Fill remaining picks
        for (let i = picks.length; i < numPicksRequired && availablePicks.length > 0; i++) {
            // Remove already selected picks
            const remaining = availablePicks.filter(n => !picks.includes(n));
            if (remaining.length > 0) {
                picks.push(remaining[0]); // Use first available (prioritizes recommended)
            }
        }
        
        if (picks.length < numPicksRequired) {
            console.warn(`Bot: Cannot place ${exoticType} - not enough picks available`);
            return false;
        }
        
        const finalPicks = picks.slice(0, numPicksRequired);
        
        // Check if this exact exotic bet already exists (same type and picks)
        // For quinella, also check reverse order (quinella is order-independent)
        const existingBet = this.game.exoticBettingSystem.exoticBets.find(bet => {
            if (bet.type !== exoticType) return false;
            if (bet.picks.length !== finalPicks.length) return false;
            
            // For quinella, order doesn't matter - check both orders
            if (exoticType === 'quinella' && bet.picks.length === 2) {
                return (bet.picks[0] === finalPicks[0] && bet.picks[1] === finalPicks[1]) ||
                       (bet.picks[0] === finalPicks[1] && bet.picks[1] === finalPicks[0]);
            }
            
            // For other types, order matters - must match exactly
            return bet.picks.every((pick, index) => pick === finalPicks[index]);
        });
        
        if (existingBet) {
            // Consolidate: add to existing bet amount
            existingBet.amount += this.betAmount;
            this.game.updateBankroll(this.game.bankroll - this.betAmount);
            this.game.updateExoticBetsDisplay();
            this.game.updateStartButton();
            console.log(`Bot: Consolidated ${exoticType.toUpperCase()} bet on ${finalPicks.join('-')} - Total: $${existingBet.amount.toLocaleString()}`);
        } else {
            // Place new exotic bet
            this.game.exoticBettingSystem.placeExoticBet(exoticType, finalPicks, this.betAmount);
            this.game.updateBankroll(this.game.bankroll - this.betAmount);
            this.game.updateExoticBetsDisplay();
            this.game.updateStartButton();
            this.stats.totalBets++;
            this.stats.betTypeStats[exoticType].bets++;
            console.log(`Bot: Placed ${exoticType.toUpperCase()} bet on ${finalPicks.join('-')} for $${this.betAmount.toLocaleString()}`);
        }
        
        return true;
    }
    
    // Place an exotic bet (legacy method for conservative betting)
    placeExoticBet(ostrichNumber, exoticType) {
        // Use recommended picks if available, otherwise use all ostriches
        const recommendedOstriches = this.game.llmExpert ? this.game.llmExpert.getRecommendedOstriches() : [];
        return this.placeExoticBetWithRecommendedPicks(ostrichNumber, exoticType, recommendedOstriches);
    }
    
    // Record race results and learn
    recordRaceResults(finishingOrder, payouts) {
        if (!this.enabled) return;
        
        const recommendedOstriches = this.game.llmExpert ? 
            this.game.llmExpert.getRecommendedOstriches() : [];
        
        // Check if any recommended ostriches won
        const winner = finishingOrder[0];
        const llmRecommendedWinner = recommendedOstriches.includes(winner);
        
        // Track LLM accuracy
        this.stats.llmAccuracy.push({
            race: this.stats.totalRaces,
            recommendedWinner: llmRecommendedWinner,
            actualWinner: winner,
            recommendedOstriches: [...recommendedOstriches]
        });
        
        // Keep only last 100 races for accuracy tracking
        if (this.stats.llmAccuracy.length > 100) {
            this.stats.llmAccuracy.shift();
        }
        
        // Update bet type stats
        if (payouts && payouts.results) {
            payouts.results.forEach(result => {
                const betType = result.type;
                if (this.stats.betTypeStats[betType]) {
                    if (result.won) {
                        this.stats.betTypeStats[betType].wins++;
                        this.stats.totalWins++;
                    } else {
                        this.stats.totalLosses++;
                    }
                    this.stats.betTypeStats[betType].profit += result.profit;
                    this.stats.totalProfit += result.profit;
                }
            });
        }
        
        // Update exotic bet stats
        if (payouts && payouts.exoticResults) {
            payouts.exoticResults.forEach(result => {
                const betType = result.bet.type;
                if (this.stats.betTypeStats[betType]) {
                    if (result.won) {
                        this.stats.betTypeStats[betType].wins++;
                        this.stats.totalWins++;
                    } else {
                        this.stats.totalLosses++;
                    }
                    this.stats.betTypeStats[betType].profit += result.profit;
                    this.stats.totalProfit += result.profit;
                }
            });
        }
        
        // Update ostrich stats
        recommendedOstriches.forEach(ostrichNumber => {
            if (!this.stats.ostrichStats[ostrichNumber]) {
                this.stats.ostrichStats[ostrichNumber] = {
                    bets: 0,
                    wins: 0,
                    profit: 0
                };
            }
            
            const position = finishingOrder.indexOf(ostrichNumber) + 1;
            if (position <= 3) {
                this.stats.ostrichStats[ostrichNumber].wins++;
            }
        });
        
        this.saveStats();
        this.updateUI();
    }
    
    // Get LLM accuracy percentage
    getLLMAccuracy() {
        if (this.stats.llmAccuracy.length === 0) return 0;
        
        const correct = this.stats.llmAccuracy.filter(a => a.recommendedWinner).length;
        return (correct / this.stats.llmAccuracy.length) * 100;
    }
    
    // Get win rate for a bet type
    getWinRate(betType) {
        const stats = this.stats.betTypeStats[betType];
        if (!stats || stats.bets === 0) return 0;
        return (stats.wins / stats.bets) * 100;
    }
    
    // Get best performing bet type
    getBestBetType() {
        let best = null;
        let bestProfit = -Infinity;
        
        Object.keys(this.stats.betTypeStats).forEach(type => {
            const stats = this.stats.betTypeStats[type];
            if (stats.profit > bestProfit) {
                bestProfit = stats.profit;
                best = type;
            }
        });
        
        return best;
    }
    
    // Update UI display
    updateUI() {
        const botToggle = document.getElementById('bot-toggle');
        const botOptions = document.getElementById('bot-options');
        const botFullAutoCheckbox = document.getElementById('bot-fullauto-checkbox');
        const botStats = document.getElementById('bot-stats');
        
        if (botToggle) {
            // In multiplayer, show as mode selector
            if (this.game.isMultiplayer) {
                botToggle.textContent = this.enabled ? '🤖 Bot Mode' : '👤 Human Mode';
            } else {
                botToggle.textContent = this.enabled ? '🤖 Bot: ON' : '🤖 Bot: OFF';
            }
            botToggle.classList.toggle('bot-enabled', this.enabled);
        }
        
        // Show/hide options (full auto checkbox and hide button) based on bot state
        if (botOptions) {
            botOptions.style.display = this.enabled ? 'flex' : 'none';
        }
        
        // Show Full Auto checkbox for game master when hosting, hide for other players in multiplayer
        if (botFullAutoCheckbox) {
            botFullAutoCheckbox.checked = this.fullAuto;
            botFullAutoCheckbox.disabled = !this.enabled;
            const fullAutoLabel = botFullAutoCheckbox.closest('label');
            if (fullAutoLabel) {
                // Show Full Auto for game master when hosting, or when offline
                if (this.game.isMultiplayer && !this.game.isGameMaster) {
                    // Hide for other players in multiplayer
                    fullAutoLabel.style.display = 'none';
                } else {
                    // Show for game master (hosting) or offline mode
                    fullAutoLabel.style.display = '';
                }
            }
        }
        
        // Hide/show stats based on bot state and user preference
        const botHideBtn = document.getElementById('bot-hide-btn');
        if (botHideBtn) {
            botHideBtn.textContent = this.isStatsHidden ? '▲' : '▼';
        }
        
        if (botStats) {
            // If bot is off, always hide stats (minimize the box)
            // If bot is on, respect user's hide/show preference
            const shouldHide = !this.enabled || this.isStatsHidden;
            botStats.classList.toggle('hidden', shouldHide);
            
            // Only populate stats if bot is enabled and stats are visible
            if (this.enabled && !this.isStatsHidden) {
                const winRate = this.stats.totalBets > 0 
                    ? ((this.stats.totalWins / this.stats.totalBets) * 100).toFixed(1)
                    : 0;
                
                botStats.innerHTML = `
                    <div class="bot-stat-item">
                        <span class="bot-stat-label">Races:</span>
                        <span class="bot-stat-value">${this.stats.totalRaces}</span>
                    </div>
                    <div class="bot-stat-item">
                        <span class="bot-stat-label">Bets:</span>
                        <span class="bot-stat-value">${this.stats.totalBets}</span>
                    </div>
                    <div class="bot-stat-item">
                        <span class="bot-stat-label">Win Rate:</span>
                        <span class="bot-stat-value">${winRate}%</span>
                    </div>
                    <div class="bot-stat-item">
                        <span class="bot-stat-label">Profit:</span>
                        <span class="bot-stat-value ${this.stats.totalProfit >= 0 ? 'positive' : 'negative'}">
                            $${this.stats.totalProfit.toLocaleString()}
                        </span>
                    </div>
                `;
            }
        }
    }
    
    // Auto-trigger LLM and start race (called when full auto is enabled)
    async autoRun() {
        if (!this.fullAuto || !this.enabled) {
            return;
        }
        
        // Make sure we have a race in waiting state
        if (!this.game || !this.game.race || this.game.race.state !== 'waiting') {
            // If hosting, don't create new race - host client manages race generation
            if (this.game && this.game.isHosting && this.game.hostClient) {
                // Wait a bit and check again - race might be initializing
                // In hosting mode, race params are broadcast asynchronously, so we need to wait
                let attempts = 0;
                while (attempts < 10) { // Try for up to 2 seconds (10 * 200ms)
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (this.game && this.game.race && this.game.race.state === 'waiting') {
                        break; // Race is ready
                    }
                    attempts++;
                }
                if (!this.game || !this.game.race || this.game.race.state !== 'waiting') {
                    console.warn('Bot: Cannot auto run - race not in waiting state after waiting (hosting mode)');
                    return;
                }
            } else {
                // Offline mode: start a new race
                if (this.game && this.game.newRace) {
                    this.game.newRace();
                    // Wait for race to initialize
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.warn('Bot: Cannot auto run - no game or race available');
                    return;
                }
            }
        }
        
        if (this.useLLM && this.game && this.game.llmExpert) {
            console.log('Bot: Full auto mode - triggering LLM...');
            
            const currentTimePeriod = this.game.dayNightCycle ? this.game.dayNightCycle.getCurrentTimePeriod() : null;
            const currentBets = this.game.bettingSystem.bets || [];
            const exoticBets = this.game.exoticBettingSystem.exoticBets || [];
            
            // Call LLM (this will trigger placeBetsFromLLM via callback)
            await this.game.llmExpert.generateExpertRundown(
                this.game.ostrichManager.ostriches,
                currentTimePeriod,
                this.game.race ? this.game.race.state : 'waiting',
                currentBets,
                exoticBets
            );
            
            // Wait for bets to be placed (LLM callback triggers placeBetsFromLLM)
            await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced from 2000ms
        } else {
            // Conservative mode: place bets immediately without LLM
            console.log('Bot: Full auto mode - using conservative betting...');
            this.placeBetsFromLLM(); // This will use conservative logic
            // Wait for bets to be placed and promise to be set
            await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for promise to be set (1000ms delay in placeBetsFromLLM)
        }
        
        // In hosting mode, markReady() is called immediately after placing bets (in placeBetsFromLLM)
        // So we don't need to wait for TTS - the host will detect we're ready and start the race
        // TTS can happen in the background
        if (this.game.isHosting) {
            console.log('Bot: Full auto mode - bets placed and ready marked, waiting for host to start race...');
            // Don't wait for TTS in hosting mode - host needs to know we're ready ASAP
            return; // Exit early - host will manage race start
        }
        
        // For offline mode, wait for TTS before starting race
        console.log('Bot: Waiting for bet announcement TTS to complete...');
        
        // Wait for promise to be set if it hasn't been yet (with timeout)
        let attempts = 0;
        while (!this.betsAnnouncementPromise && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (this.betsAnnouncementPromise) {
            await this.betsAnnouncementPromise;
            this.betsAnnouncementPromise = null;
        } else {
            // Fallback: wait a reasonable amount of time if promise wasn't created
            console.warn('Bot: betsAnnouncementPromise not set, waiting fallback time...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer if promise wasn't set
        }
        
        console.log('Bot: Bet announcement complete...');
        
        // In offline mode, start the race automatically
        if (this.game && this.game.race && this.game.race.state === 'waiting') {
            if (!this.game.isMultiplayer || !this.game.isHosting) {
                // Offline mode: start race directly
                console.log('Bot: Full auto mode - starting race...');
                this.game.startRace();
            }
        }
    }
    
    // Called after race finishes - if full auto is still on, start next race
    async onRaceFinished() {
        if (!this.fullAuto || !this.enabled) {
            return;
        }
        
        console.log('Bot: Full auto mode - race finished, starting next race...');
        
        // Wait a bit for results to display, then start next race
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check again in case user toggled off during wait
        if (!this.fullAuto || !this.enabled) {
            return;
        }
        
        // Trigger next race automatically
        if (this.game && this.game.newRace) {
            this.game.newRace();
            
            // Wait for race to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check again in case user toggled off during wait
            if (!this.fullAuto || !this.enabled) {
                return;
            }
            
            // In hosting mode, autoRun is triggered by newRace() when race params are broadcast
            // But if it wasn't triggered (maybe timing issue), trigger it here as fallback
            // In offline mode, trigger autoRun directly
            if (!this.game.isHosting || !this.game.hostClient) {
                this.autoRun();
            } else {
                // Hosting mode: autoRun should have been called by newRace(), but trigger it here as fallback
                // Check if race is ready and autoRun hasn't been called yet
                // Wait a bit more for race params to be processed
                await new Promise(resolve => setTimeout(resolve, 500));
                if (this.game.race && this.game.race.state === 'waiting') {
                    console.log('Bot: Fallback - triggering autoRun in hosting mode');
                    this.autoRun();
                }
            }
        }
    }
    
    // Reset stats
    resetStats() {
        this.stats = {
            totalRaces: 0,
            totalBets: 0,
            totalWins: 0,
            totalLosses: 0,
            totalProfit: 0,
            betTypeStats: {
                win: { bets: 0, wins: 0, profit: 0 },
                place: { bets: 0, wins: 0, profit: 0 },
                show: { bets: 0, wins: 0, profit: 0 },
                exacta: { bets: 0, wins: 0, profit: 0 },
                trifecta: { bets: 0, wins: 0, profit: 0 },
                superfecta: { bets: 0, wins: 0, profit: 0 },
                quinella: { bets: 0, wins: 0, profit: 0 }
            },
            ostrichStats: {},
            llmAccuracy: []
        };
        this.saveStats();
        this.updateUI();
    }
}

