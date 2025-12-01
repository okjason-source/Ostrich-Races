// Audio and sound effects system

class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.speechSynthesis = window.speechSynthesis;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    // Create a starting gun/whistle sound
    playStartSound() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Create a sharp, high-pitched "bang" sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1200, now);
        oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }

    // Create a whistle sound (alternative)
    playWhistleSound() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Create a whistle sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(2000, now);
        oscillator.frequency.linearRampToValueAtTime(2500, now + 0.1);
        oscillator.frequency.linearRampToValueAtTime(2000, now + 0.2);

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.2);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.25);

        oscillator.start(now);
        oscillator.stop(now + 0.25);
    }

    // Text-to-speech announcement
    announceWinner(ostrichNumber, ostrichName) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(`${ostrichNumber} wins!`);
        utterance.rate = 1.1; // Slightly faster
        utterance.pitch = 1.2; // Slightly higher pitch for excitement
        utterance.volume = 0.8;

        // Try to use an energetic voice if available
        const voices = this.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('English') && (voice.name.includes('Female') || voice.name.includes('Male'))
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.speechSynthesis.speak(utterance);
    }

    // Race start sound - just the bang
    playRaceStart() {
        this.playStartSound();
    }
}

