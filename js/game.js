// Main game state management

class Game {
    constructor() {
        this.bankroll = StorageManager.loadBankroll();
        this.stats = StorageManager.loadStats();
        this.bettingSystem = new BettingSystem();
        this.exoticBettingSystem = new ExoticBettingSystem();
        this.ostrichManager = new OstrichManager();
        this.soundSystem = new SoundSystem();
        this.race = null;
        this.countdownInterval = null;
        
        // Cleanup tracking
        this.animationFrameId = null;
        this.isRaceActive = false;
    }

    initialize(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.race = new Race(this.ostrichManager, renderer, canvas, this.soundSystem);
        this.updateUI();
        this.renderOstrichCards();
        this.setupExoticBets();
    }

    cleanup() {
        // Clear any running countdown timer
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Cancel any running animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    updateBankroll(amount) {
        this.bankroll = Math.max(0, amount);
        
        // Check if player needs a B-M Tab (bailout)
        const minBet = 1000000;
        if (this.bankroll < minBet) {
            this.bankroll = minBet;
            this.stats = StorageManager.updateStats({
                bmTabs: this.stats.bmTabs + 1
            });
            
            // Show notification
            alert('💸 B-M Tab: Another million added to your account! 💸');
        }
        
        StorageManager.saveBankroll(this.bankroll);
        this.updateUI();
    }

    placeBet(ostrichNumber, amount, type = 'win') {
        if (amount > this.bankroll) {
            alert('Insufficient funds!');
            return false;
        }

        if (amount <= 0) {
            alert('Bet amount must be greater than 0!');
            return false;
        }

        this.bettingSystem.placeBet(ostrichNumber, amount, type);
        this.updateBankroll(this.bankroll - amount);
        this.updateBetsDisplay();
        this.updateStartButton();
        
        // Always reset to default bet amount
        document.getElementById('bet-amount').value = '1000000';
        
        return true;
    }

    clearBet(ostrichNumber, type) {
        const bet = this.bettingSystem.bets.find(b => b.ostrichNumber === ostrichNumber && b.type === type);
        if (bet) {
            this.updateBankroll(this.bankroll + bet.amount);
            this.bettingSystem.clearBet(ostrichNumber, type);
            this.updateBetsDisplay();
            this.updateStartButton();
        }
    }

    clearAllBets() {
        const total = this.bettingSystem.getTotalBetAmount();
        this.updateBankroll(this.bankroll + total);
        this.bettingSystem.clearAllBets();
        this.updateBetsDisplay();
        this.updateStartButton();
    }

    startRace() {
        if (!this.bettingSystem.hasBets() && !this.exoticBettingSystem.hasExoticBets()) {
            alert('Place at least one bet before starting the race!');
            return;
        }

        // Prevent multiple races from starting
        if (this.isRaceActive) {
            return;
        }
        
        // Clean up any existing timers
        this.cleanup();
        
        this.isRaceActive = true;
        this.race.startCountdown();
        this.startCountdown();
    }

    startCountdown() {
        let countdown = 3;
        const countdownEl = document.getElementById('race-timer');
        const statusEl = document.getElementById('race-status');
        
        statusEl.textContent = 'Get ready...';
        
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            countdownEl.textContent = countdown;
            countdown--;
            
            if (countdown < 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this.race.startRace();
                statusEl.textContent = 'Racing!';
                countdownEl.textContent = '';
                this.gameLoop();
            }
        }, 1000);
    }

    gameLoop() {
        const startTime = Date.now();
        let lastTime = startTime;
        
        const loop = () => {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            this.race.update(deltaTime);
            this.race.render();
            
            if (this.race.state === 'finished') {
                this.finishRace();
            } else if (this.race.state === 'racing') {
                this.animationFrameId = requestAnimationFrame(loop);
            }
        };
        
        this.animationFrameId = requestAnimationFrame(loop);
    }

    finishRace() {
        // Prevent multiple calls
        if (!this.isRaceActive) {
            return;
        }
        
        this.isRaceActive = false;
        this.cleanup();
        
        const winner = this.race.getWinner();
        if (!winner) return;
        
        // Get finishing order (ostrich numbers)
        const finishingOrder = [...this.ostrichManager.ostriches]
            .sort((a, b) => a.finishPosition - b.finishPosition)
            .map(o => o.number);
        
        // Create odds map
        const oddsMap = {};
        this.ostrichManager.ostriches.forEach(o => {
            oddsMap[o.number] = o.odds;
        });
        
        // Calculate regular payouts
        const payouts = this.bettingSystem.calculatePayouts(finishingOrder, oddsMap);
        
        // Calculate exotic payouts
        const exoticPayouts = this.exoticBettingSystem.calculateExoticPayouts(finishingOrder);
        
        // Combine winnings
        const totalWinnings = payouts.totalWinnings + exoticPayouts.totalWinnings;
        const combinedProfit = totalWinnings - (this.bettingSystem.getTotalBetAmount() + this.exoticBettingSystem.getTotalExoticBetAmount());
        
        this.updateBankroll(this.bankroll + totalWinnings);
        
        // Update stats
        const statsUpdates = {
            racesWatched: this.stats.racesWatched + 1
        };
        
        if (combinedProfit > 0) {
            statsUpdates.totalWins = this.stats.totalWins + 1;
            if (combinedProfit > this.stats.biggestWin) {
                statsUpdates.biggestWin = combinedProfit;
            }
        } else {
            statsUpdates.totalLosses = this.stats.totalLosses + 1;
            if (Math.abs(combinedProfit) > this.stats.biggestLoss) {
                statsUpdates.biggestLoss = Math.abs(combinedProfit);
            }
        }
        
        this.stats = StorageManager.updateStats(statsUpdates);
        
        this.showResults(winner, payouts, exoticPayouts, combinedProfit);
    }

    showResults(winner, payouts, exoticPayouts, combinedProfit) {
        const resultsPanel = document.getElementById('results-panel');
        const bettingPanel = document.getElementById('betting-panel');
        const raceArea = document.getElementById('race-area');
        
        bettingPanel.classList.add('hidden');
        raceArea.classList.add('hidden');
        resultsPanel.classList.remove('hidden');
        
        // Show finishing order
        const finishOrderEl = document.getElementById('finishing-order');
        finishOrderEl.innerHTML = '<h3>Results</h3>';
        
        const sorted = [...this.ostrichManager.ostriches].sort((a, b) => {
            if (a.finishPosition === null) return 1;
            if (b.finishPosition === null) return -1;
            return a.finishPosition - b.finishPosition;
        });
        
        sorted.forEach(ostrich => {
            const div = document.createElement('div');
            div.className = 'finish-item' + (ostrich.finishPosition === 1 ? ' first' : '');
            div.innerHTML = `
                <span><strong>#${ostrich.finishPosition}</strong> - ${ostrich.number}. ${ostrich.name}</span>
                <span>${ostrich.odds}:1</span>
            `;
            finishOrderEl.appendChild(div);
        });
        
        // Show payout info
        const payoutEl = document.getElementById('payout-info');
        const regularWin = payouts.totalWinnings;
        const exoticWin = exoticPayouts.totalWinnings;
        const totalWin = regularWin + exoticWin;
        
        if (combinedProfit > 0) {
            payoutEl.className = 'payout-win';
            let detailsHTML = `
                <div><strong>${winner.number}. ${winner.name}</strong></div>
            `;
            if (regularWin > 0) {
                detailsHTML += `<div>Regular Bets: <strong>${formatMoney(regularWin)}</strong></div>`;
            }
            if (exoticWin > 0) {
                detailsHTML += `<div>Exotic Bets: <strong>${formatMoney(exoticWin)}</strong></div>`;
            }
            detailsHTML += `<div>Total Profit: <strong>+${formatMoney(combinedProfit)}</strong></div>`;
            
            payoutEl.innerHTML = `
                <div class="payout-header">🎉 Winner! 🎉</div>
                <div class="payout-details">
                    ${detailsHTML}
                </div>
            `;
        } else {
            payoutEl.className = 'payout-loss';
            payoutEl.innerHTML = `
                <div class="payout-header">Better luck next time!</div>
                <div class="payout-details">
                    <div><strong>${winner.number}. ${winner.name}</strong> won</div>
                    <div>Loss: <strong>${formatMoney(Math.abs(combinedProfit))}</strong></div>
                </div>
            `;
        }
    }

    newRace() {
        // Clean up any running timers/animations
        this.cleanup();
        this.isRaceActive = false;
        
        // Reset everything
        this.ostrichManager.initializeOstriches();
        this.bettingSystem.clearAllBets();
        this.exoticBettingSystem.clearAllExoticBets();
        this.race.state = 'waiting';
        
        // Show panels
        const resultsPanel = document.getElementById('results-panel');
        const bettingPanel = document.getElementById('betting-panel');
        const raceArea = document.getElementById('race-area');
        
        resultsPanel.classList.add('hidden');
        bettingPanel.classList.remove('hidden');
        raceArea.classList.remove('hidden');
        
        // Reset bet amount to default
        document.getElementById('bet-amount').value = '1000000';
        document.getElementById('exotic-bet-amount').value = '1000000';
        
        // Reset race status text
        document.getElementById('race-status').textContent = 'Waiting for bets...';
        document.getElementById('race-timer').textContent = '';
        
        this.renderOstrichCards();
        this.updateUI();
        this.updateBetsDisplay();
        this.updateExoticBetsDisplay();
        this.race.render();
    }

    renderOstrichCards() {
        const listEl = document.getElementById('ostriches-list');
        listEl.innerHTML = '';
        
        this.ostrichManager.ostriches.forEach(ostrich => {
            const card = document.createElement('div');
            card.className = 'ostrich-card';
            card.dataset.number = ostrich.number;
            
            const bet = this.bettingSystem.bets.find(b => b.ostrichNumber === ostrich.number);
            if (bet) {
                card.classList.add('selected');
            }
            
            card.innerHTML = `
                <div class="ostrich-number-circle" style="background-color: ${ostrich.color};">
                    ${ostrich.number}
                </div>
                <div class="ostrich-info">
                    <div class="ostrich-name">${ostrich.name}</div>
                    <div class="ostrich-odds">${ostrich.odds}:1</div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                this.selectOstrich(ostrich.number);
            });
            
            listEl.appendChild(card);
        });
    }

    selectOstrich(number) {
        this.bettingSystem.selectedOstrich = number;
        
        // Update card selection
        document.querySelectorAll('.ostrich-card').forEach(card => {
            card.classList.remove('selected');
            if (parseInt(card.dataset.number) === number) {
                card.classList.add('selected');
            }
        });
    }

    updateUI() {
        const bankrollEl = document.getElementById('bankroll-amount');
        if (bankrollEl) {
            bankrollEl.textContent = formatMoney(this.bankroll);
        }
        
        const bmTabEl = document.getElementById('bm-tab-count');
        if (bmTabEl) {
            bmTabEl.textContent = this.stats.bmTabs;
        }
    }

    updateBetsDisplay() {
        const betsListEl = document.getElementById('bets-list');
        betsListEl.innerHTML = '';
        
        if (this.bettingSystem.bets.length === 0) {
            betsListEl.innerHTML = '<p style="color: #888;">No bets placed</p>';
            return;
        }
        
        this.bettingSystem.bets.forEach(bet => {
            const ostrich = this.ostrichManager.getByNumber(bet.ostrichNumber);
            const typeLabel = bet.type === 'win' ? 'Win' : bet.type === 'place' ? 'Place' : 'Show';
            const div = document.createElement('div');
            div.className = 'bet-item';
            div.innerHTML = `
                <span>${typeLabel}: ${bet.ostrichNumber}. ${ostrich.name} (${ostrich.odds}:1)</span>
                <span>${formatMoney(bet.amount)}</span>
                <button onclick="game.clearBet(${bet.ostrichNumber}, '${bet.type}')">×</button>
            `;
            betsListEl.appendChild(div);
        });
    }

    updateStartButton() {
        const startBtn = document.getElementById('start-race-btn');
        startBtn.disabled = !this.bettingSystem.hasBets() && !this.exoticBettingSystem.hasExoticBets();
    }

    setupExoticBets() {
        // Populate ostrich select dropdowns
        const selects = ['exotic-pos1', 'exotic-pos2', 'exotic-pos3', 'exotic-pos4'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            this.ostrichManager.ostriches.forEach(ostrich => {
                const option = document.createElement('option');
                option.value = ostrich.number;
                option.textContent = `${ostrich.number}. ${ostrich.name} (${ostrich.odds}:1)`;
                select.appendChild(option);
            });
        });

        // Update exotic type display
        document.querySelectorAll('input[name="exotic-type"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateExoticTypeDisplay(radio.value);
            });
        });

        // Initialize display
        this.updateExoticTypeDisplay('exacta');
    }

    updateExoticTypeDisplay(type) {
        const pos1 = document.getElementById('exotic-pos1');
        const pos2 = document.getElementById('exotic-pos2');
        const pos3 = document.getElementById('exotic-pos3');
        const pos4 = document.getElementById('exotic-pos4');

        // Reset all
        [pos1, pos2, pos3, pos4].forEach(select => {
            select.classList.add('hidden');
            select.value = '';
        });

        // Show based on type
        pos1.classList.remove('hidden');
        pos2.classList.remove('hidden');
        
        if (type === 'trifecta' || type === 'superfecta') {
            pos3.classList.remove('hidden');
        }
        if (type === 'superfecta') {
            pos4.classList.remove('hidden');
        }
    }

    placeExoticBet() {
        const type = document.querySelector('input[name="exotic-type"]:checked').value;
        const amount = parseFloat(document.getElementById('exotic-bet-amount').value);
        
        if (amount > this.bankroll) {
            alert('Insufficient funds!');
            return false;
        }

        if (amount <= 0) {
            alert('Bet amount must be greater than 0!');
            return false;
        }

        // Get picks based on type
        const picks = [];
        const numPicks = type === 'exacta' || type === 'quinella' ? 2 :
                        type === 'trifecta' ? 3 : 4;
        
        for (let i = 1; i <= numPicks; i++) {
            const pick = parseInt(document.getElementById(`exotic-pos${i}`).value);
            if (!pick) {
                alert(`Please select position ${i}!`);
                return false;
            }
            if (picks.includes(pick)) {
                alert('Cannot select the same ostrich twice!');
                return false;
            }
            picks.push(pick);
        }

        this.exoticBettingSystem.placeExoticBet(type, picks, amount);
        this.updateBankroll(this.bankroll - amount);
        this.updateExoticBetsDisplay();
        this.updateStartButton();
        
        // Reset
        document.getElementById('exotic-bet-amount').value = '1000000';
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`exotic-pos${i}`).value = '';
        }
        
        return true;
    }

    clearExoticBet(id) {
        const bet = this.exoticBettingSystem.exoticBets.find(b => b.id === id);
        if (bet) {
            this.updateBankroll(this.bankroll + bet.amount);
            this.exoticBettingSystem.clearExoticBet(id);
            this.updateExoticBetsDisplay();
            this.updateStartButton();
        }
    }

    updateExoticBetsDisplay() {
        const listEl = document.getElementById('exotic-bets-list');
        listEl.innerHTML = '';
        
        if (this.exoticBettingSystem.exoticBets.length === 0) {
            return;
        }
        
        this.exoticBettingSystem.exoticBets.forEach(bet => {
            const div = document.createElement('div');
            div.className = 'exotic-bet-item';
            
            const typeNames = {
                exacta: 'Exacta',
                trifecta: 'Trifecta',
                superfecta: 'Superfecta',
                quinella: 'Quinella'
            };
            
            const picksText = bet.picks.map(p => {
                const ostrich = this.ostrichManager.getByNumber(p);
                return `${p}. ${ostrich.name}`;
            }).join(' → ');
            
            div.innerHTML = `
                <div class="exotic-type">${typeNames[bet.type]}</div>
                <div class="exotic-picks">${picksText}</div>
                <div class="exotic-amount-display">${formatMoney(bet.amount)}</div>
                <button onclick="game.clearExoticBet(${bet.id})">Remove</button>
            `;
            listEl.appendChild(div);
        });
    }
}

