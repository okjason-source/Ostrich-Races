// Main entry point

let game;
let renderer;
let dayNightCycle;

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    renderer = new SpriteRenderer(canvas);
    renderer.resize();
    
    // Initialize day/night cycle
    dayNightCycle = new DayNightCycle(canvas);
    
    game = new Game();
    game.initialize(canvas, renderer);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial render
    game.race.render();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        renderer.resize();
        game.race.render();
    });
});

function setupEventListeners() {
    const betAmountInput = document.getElementById('bet-amount');
    
    // Sprite toggle button
    const spriteToggleBtn = document.getElementById('sprite-toggle');
    spriteToggleBtn.addEventListener('click', () => {
        const useImage = renderer.toggleSpriteType();
        console.log('Sprite type:', useImage ? 'Image' : 'Drawn');
        
        // Update button appearance based on mode
        if (useImage) {
            spriteToggleBtn.classList.remove('drawn-mode');
        } else {
            spriteToggleBtn.classList.add('drawn-mode');
        }
        
        game.race.render();
    });
    
    // Place bet button
    document.getElementById('place-bet-btn').addEventListener('click', () => {
        const amount = parseFloat(betAmountInput.value);
        const selected = game.bettingSystem.selectedOstrich;
        const betType = document.querySelector('input[name="bet-type"]:checked').value;
        
        if (!selected) {
            game.showNotification('Select an Ostrich!', 'Please select an ostrich first!', '💸', true);
            return;
        }
        
        if (game.placeBet(selected, amount, betType)) {
            // Keep default value visible
            betAmountInput.value = '1000000';
        }
    });
    
    // Bet amount input - ensure it defaults to 1000000 if cleared
    betAmountInput.addEventListener('blur', function() {
        if (!this.value || parseFloat(this.value) <= 0) {
            this.value = '1000000';
        }
    });
    
    // Also reset on focus if empty
    betAmountInput.addEventListener('focus', function() {
        if (!this.value) {
            this.value = '1000000';
        }
    });
    
    // Exotic bets toggle
    document.getElementById('exotic-toggle-btn').addEventListener('click', () => {
        const panel = document.getElementById('exotic-bets-panel');
        const icon = document.getElementById('exotic-toggle-icon');
        
        panel.classList.toggle('hidden');
        icon.classList.toggle('open');
    });
    
    // Place exotic bet button
    document.getElementById('place-exotic-btn').addEventListener('click', () => {
        game.placeExoticBet();
    });
    
    // Start race button
    document.getElementById('start-race-btn').addEventListener('click', () => {
        game.startRace();
    });
    
    // New race button
    document.getElementById('new-race-btn').addEventListener('click', () => {
        game.newRace();
    });
}

