// LocalStorage management for game state - optimized for minimal storage

const STORAGE_KEYS = {
    BANKROLL: 'br', // bankroll
    STATS: 'st' // stats
};

class StorageManager {
    static saveBankroll(amount) {
        try {
            // Store as number string (minimal)
            localStorage.setItem(STORAGE_KEYS.BANKROLL, amount.toString());
            return true;
        } catch (e) {
            console.error('Failed to save bankroll:', e);
            return false;
        }
    }

    static loadBankroll(defaultAmount = 1000000) {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.BANKROLL);
            return saved ? parseFloat(saved) : defaultAmount;
        } catch (e) {
            console.error('Failed to load bankroll:', e);
            return defaultAmount;
        }
    }

    static saveStats(stats) {
        try {
            // Use short property names to minimize storage
            const compact = {
                r: stats.racesWatched || 0, // racesWatched
                w: stats.totalWins || 0, // totalWins
                l: stats.totalLosses || 0, // totalLosses
                bw: stats.biggestWin || 0, // biggestWin
                bl: stats.biggestLoss || 0, // biggestLoss
                t: stats.bmTabs || 0 // bmTabs
            };
            localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(compact));
            return true;
        } catch (e) {
            console.error('Failed to save stats:', e);
            return false;
        }
    }

    static loadStats() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.STATS);
            if (saved) {
                const compact = JSON.parse(saved);
                // Expand short names back to full names
                return {
                    racesWatched: compact.r || 0,
                    totalWins: compact.w || 0,
                    totalLosses: compact.l || 0,
                    biggestWin: compact.bw || 0,
                    biggestLoss: compact.bl || 0,
                    bmTabs: compact.t || 0
                };
            }
            return {
                racesWatched: 0,
                totalWins: 0,
                totalLosses: 0,
                biggestWin: 0,
                biggestLoss: 0,
                bmTabs: 0
            };
        } catch (e) {
            console.error('Failed to load stats:', e);
            return {
                racesWatched: 0,
                totalWins: 0,
                totalLosses: 0,
                biggestWin: 0,
                biggestLoss: 0,
                bmTabs: 0
            };
        }
    }

    static updateStats(updates) {
        const stats = this.loadStats();
        Object.assign(stats, updates);
        this.saveStats(stats);
        return stats;
    }

    static clearAll() {
        try {
            localStorage.removeItem(STORAGE_KEYS.BANKROLL);
            localStorage.removeItem(STORAGE_KEYS.STATS);
            return true;
        } catch (e) {
            console.error('Failed to clear storage:', e);
            return false;
        }
    }
}

