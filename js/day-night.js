// Day/Night cycle system that changes canvas background based on real time

class DayNightCycle {
    constructor(canvas) {
        this.canvas = canvas;
        this.updateBackground();
        
        // Update every minute
        this.intervalId = setInterval(() => {
            this.updateBackground();
        }, 60000);
    }
    
    getTimeBasedGradient() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeDecimal = hours + (minutes / 60); // 0-24 as decimal
        
        // Define gradients for different times of day
        // Night (0-5): Dark blue to purple with stars
        if (timeDecimal >= 0 && timeDecimal < 5) {
            return 'linear-gradient(to bottom, #0a1128 0%, #1a1a3e 40%, #2d1b4e 100%)';
        }
        // Dawn (5-7): Purple to orange
        else if (timeDecimal >= 5 && timeDecimal < 7) {
            return 'linear-gradient(to bottom, #2d1b4e 0%, #8b5a8d 30%, #ff8c42 70%, #ffd89b 100%)';
        }
        // Morning (7-10): Light blue, getting brighter
        else if (timeDecimal >= 7 && timeDecimal < 10) {
            return 'linear-gradient(to bottom, #87CEEB 0%, #b8e6f5 50%, #ffd89b 100%)';
        }
        // Day (10-16): Bright blue sky
        else if (timeDecimal >= 10 && timeDecimal < 16) {
            return 'linear-gradient(to bottom, #87CEEB 0%, #98D8C8 50%, #F7DC6F 100%)';
        }
        // Late Afternoon (16-18): Golden hour
        else if (timeDecimal >= 16 && timeDecimal < 18) {
            return 'linear-gradient(to bottom, #ff9a56 0%, #ff6b6b 40%, #ffd89b 70%, #F7DC6F 100%)';
        }
        // Dusk (18-20): Orange to purple
        else if (timeDecimal >= 18 && timeDecimal < 20) {
            return 'linear-gradient(to bottom, #ff6b6b 0%, #c06c84 40%, #6c5b7b 70%, #355c7d 100%)';
        }
        // Evening (20-24): Deep purple to dark
        else {
            return 'linear-gradient(to bottom, #1a1a3e 0%, #2d1b4e 50%, #0a1128 100%)';
        }
    }
    
    addStarsOverlay() {
        const now = new Date();
        const hours = now.getHours();
        
        // Show stars during night hours (20-7)
        if (hours >= 20 || hours < 7) {
            // Create a subtle star pattern using radial gradients, concentrated at the top
            // Stars positioned only in the top 10% of the canvas
            const stars = `
                radial-gradient(1px 1px at 15% 3%, white, transparent),
                radial-gradient(2px 2px at 45% 5%, white, transparent),
                radial-gradient(1px 1px at 75% 2%, white, transparent),
                radial-gradient(1px 1px at 25% 7%, white, transparent),
                radial-gradient(1px 1px at 85% 6%, white, transparent),
                radial-gradient(2px 2px at 55% 4%, white, transparent),
                radial-gradient(1px 1px at 65% 8%, white, transparent),
                radial-gradient(1px 1px at 35% 3%, white, transparent),
                radial-gradient(1px 1px at 92% 9%, white, transparent),
                radial-gradient(2px 2px at 10% 5%, white, transparent),
                radial-gradient(1px 1px at 50% 7%, white, transparent),
                radial-gradient(1px 1px at 80% 4%, white, transparent)
            `;
            return stars + ', ' + this.getTimeBasedGradient();
        }
        
        return this.getTimeBasedGradient();
    }
    
    updateBackground() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        console.log(`Day/Night Cycle - Current time: ${hours}:${minutes < 10 ? '0' : ''}${minutes}`);
        
        const gradient = this.addStarsOverlay();
        this.canvas.style.background = gradient;
        this.canvas.style.backgroundSize = '200% 200%, 100% 100%';
        
        console.log('Applied gradient:', gradient.substring(0, 100) + '...');
    }
    
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}

