// Betting system

class BettingSystem {
    constructor() {
        this.bets = []; // Array of {ostrichNumber, amount, type}
        this.selectedOstrich = null;
    }

    placeBet(ostrichNumber, amount, type = 'win') {
        // Check if bet already exists for this ostrich and type
        const existingBet = this.bets.find(b => b.ostrichNumber === ostrichNumber && b.type === type);
        
        if (existingBet) {
            existingBet.amount += amount;
        } else {
            this.bets.push({
                ostrichNumber: ostrichNumber,
                amount: amount,
                type: type // 'win', 'place', or 'show'
            });
        }
        
        return true;
    }

    clearBet(ostrichNumber, type) {
        this.bets = this.bets.filter(b => !(b.ostrichNumber === ostrichNumber && b.type === type));
    }

    clearAllBets() {
        this.bets = [];
    }

    getTotalBetAmount() {
        return this.bets.reduce((sum, bet) => sum + bet.amount, 0);
    }

    calculatePayouts(finishingOrder, oddsMap) {
        const results = [];
        let totalWinnings = 0;
        let totalLosses = 0;

        this.bets.forEach(bet => {
            const ostrichPosition = finishingOrder.indexOf(bet.ostrichNumber) + 1;
            const baseOdds = oddsMap[bet.ostrichNumber];
            let won = false;
            let payout = 0;
            let multiplier = 0;

            switch (bet.type) {
                case 'win':
                    // Must finish 1st
                    won = ostrichPosition === 1;
                    multiplier = baseOdds;
                    break;
                case 'place':
                    // Must finish 1st or 2nd
                    won = ostrichPosition === 1 || ostrichPosition === 2;
                    multiplier = baseOdds * 0.4; // 40% of win odds
                    break;
                case 'show':
                    // Must finish 1st, 2nd, or 3rd
                    won = ostrichPosition >= 1 && ostrichPosition <= 3;
                    // Show pays 30% of win odds, but minimum 1.1:1 (10% profit) to ensure you always profit
                    multiplier = Math.max(baseOdds * 0.3, 1.1);
                    break;
            }

            if (won) {
                payout = bet.amount * multiplier;
                totalWinnings += payout;
            } else {
                totalLosses += bet.amount;
            }

            results.push({
                ostrichNumber: bet.ostrichNumber,
                amount: bet.amount,
                type: bet.type,
                won: won,
                payout: payout,
                profit: won ? (payout - bet.amount) : -bet.amount
            });
        });

        return {
            results: results,
            totalWinnings: totalWinnings,
            totalLosses: totalLosses,
            netProfit: totalWinnings - this.getTotalBetAmount()
        };
    }

    hasBets() {
        return this.bets.length > 0;
    }
}

