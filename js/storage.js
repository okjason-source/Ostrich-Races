// LocalStorage management for game state

const STORAGE_KEYS = {
    BANKROLL: 'ostrich_races_bankroll',
    STATS: 'ostrich_races_stats',
    SETTINGS: 'ostrich_races_settings'
};

class StorageManager {
    static saveBankroll(amount) {
        try {
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
            localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
            return true;
        } catch (e) {
            console.error('Failed to save stats:', e);
            return false;
        }
    }

    static loadStats() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.STATS);
            return saved ? JSON.parse(saved) : {
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
            localStorage.removeItem(STORAGE_KEYS.SETTINGS);
            return true;
        } catch (e) {
            console.error('Failed to clear storage:', e);
            return false;
        }
    }
}

