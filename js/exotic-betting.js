// Exotic betting system

class ExoticBettingSystem {
    constructor() {
        this.exoticBets = [];
    }

    placeExoticBet(type, picks, amount) {
        const bet = {
            type: type,
            picks: picks,
            amount: amount,
            id: Date.now()
        };
        
        this.exoticBets.push(bet);
        return bet;
    }

    clearExoticBet(id) {
        this.exoticBets = this.exoticBets.filter(bet => bet.id !== id);
    }

    clearAllExoticBets() {
        this.exoticBets = [];
    }

    getTotalExoticBetAmount() {
        return this.exoticBets.reduce((sum, bet) => sum + bet.amount, 0);
    }

    calculateExoticPayouts(finishingOrder) {
        const results = [];
        let totalWinnings = 0;
        let totalLosses = 0;

        this.exoticBets.forEach(bet => {
            const result = this.checkExoticBet(bet, finishingOrder);
            if (result.won) {
                totalWinnings += result.payout;
            } else {
                totalLosses += bet.amount;
            }
            results.push(result);
        });

        return {
            results: results,
            totalWinnings: totalWinnings,
            totalLosses: totalLosses,
            netProfit: totalWinnings - (totalWinnings > 0 ? 0 : this.getTotalExoticBetAmount())
        };
    }

    checkExoticBet(bet, finishingOrder) {
        let won = false;
        let payout = 0;
        let multiplier = 1;

        switch (bet.type) {
            case 'exacta':
                // Must pick 1st and 2nd in exact order
                won = bet.picks[0] === finishingOrder[0] && 
                      bet.picks[1] === finishingOrder[1];
                multiplier = 15; // 15:1 payout
                break;
            
            case 'trifecta':
                // Must pick 1st, 2nd, and 3rd in exact order
                won = bet.picks[0] === finishingOrder[0] && 
                      bet.picks[1] === finishingOrder[1] &&
                      bet.picks[2] === finishingOrder[2];
                multiplier = 50; // 50:1 payout
                break;
            
            case 'superfecta':
                // Must pick 1st-4th in exact order
                won = bet.picks[0] === finishingOrder[0] && 
                      bet.picks[1] === finishingOrder[1] &&
                      bet.picks[2] === finishingOrder[2] &&
                      bet.picks[3] === finishingOrder[3];
                multiplier = 200; // 200:1 payout
                break;
            
            case 'quinella':
                // Must pick top 2 in any order
                const top2 = finishingOrder.slice(0, 2);
                won = top2.includes(bet.picks[0]) && top2.includes(bet.picks[1]);
                multiplier = 8; // 8:1 payout
                break;
        }

        if (won) {
            payout = bet.amount * multiplier;
        }

        return {
            bet: bet,
            won: won,
            payout: payout,
            profit: won ? (payout - bet.amount) : -bet.amount
        };
    }

    hasExoticBets() {
        return this.exoticBets.length > 0;
    }
}

