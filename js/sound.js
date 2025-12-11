// Audio and sound effects system

class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.speechSynthesis = window.speechSynthesis;
        this.winnerUtterance = null; // Track winner announcement to protect it
        this.currentEventUtterance = null; // Track event announcements (can be interrupted)
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
    announceWinner(ostrichNumber, ostrichName, onComplete = null) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            if (onComplete) {
                setTimeout(() => onComplete(), 0);
            }
            return;
        }

        // Store reference to winner utterance so we can protect it from cancellation
        if (!this.winnerUtterance) {
            // Only cancel if there's something else speaking (not a winner announcement)
            if (this.speechSynthesis.speaking && this.speechSynthesis.pending) {
                this.speechSynthesis.cancel();
            }
        }

        // Ensure we have a valid name, fallback to "Ostrich [number]" if missing
        const displayName = ostrichName && ostrichName.trim() ? ostrichName.trim() : `Ostrich ${ostrichNumber}`;
        const announcementText = `${ostrichNumber} wins. ${displayName}`;
        console.log('Winner announcement text:', announcementText, '| Name provided:', ostrichName);
        const utterance = new SpeechSynthesisUtterance(announcementText);
        this.winnerUtterance = utterance; // Store reference to protect it
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.2; // Slightly higher pitch for excitement
        utterance.volume = 0.9; // Slightly louder

        // Try to use an energetic voice if available
        const voices = this.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('English') && (voice.name.includes('Female') || voice.name.includes('Male'))
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Call onComplete when TTS finishes
        let callbackFired = false;
        const fireCallback = () => {
            if (!callbackFired && onComplete) {
                callbackFired = true;
                console.log('Winner TTS callback fired');
                onComplete();
            }
        };

        if (onComplete) {
            utterance.onend = () => {
                console.log('Winner TTS ended - waiting 200ms before callback');
                this.winnerUtterance = null; // Clear reference when done
                // Small delay to ensure TTS is completely finished
                setTimeout(() => {
                    fireCallback();
                }, 200);
            };
            utterance.onerror = (error) => {
                console.log('Winner TTS error:', error);
                this.winnerUtterance = null; // Clear reference on error
                // Still call onComplete even if there's an error, but with delay
                setTimeout(() => {
                    fireCallback();
                }, 200);
            };
            
            // Safety timeout - fire callback after 15 seconds even if events don't fire
            // This gives plenty of time for the winner announcement to complete
            setTimeout(() => {
                console.log('[TTS] Safety timeout (15s) - firing callback');
                this.winnerUtterance = null; // Clear reference on timeout
                fireCallback();
            }, 15000);
        }

        console.log('Starting winner TTS:', `${ostrichNumber} wins. ${ostrichName}`);
        this.speechSynthesis.speak(utterance);
    }
    
    // Protected cancel - won't cancel winner announcements
    cancelNonWinnerTTS() {
        if (this.speechSynthesis && !this.winnerUtterance) {
            // Only cancel if there's no winner announcement in progress
            if (this.speechSynthesis.speaking || this.speechSynthesis.pending) {
                this.speechSynthesis.cancel();
            }
        }
    }

    // Race start sound - just the bang
    playRaceStart() {
        this.playStartSound();
    }
    
    // Announce lead changes during the race - PRIORITY: Can interrupt event announcements
    announceLeadChange(ostrichNumber, ostrichName) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Don't interrupt winner announcements - those are highest priority
        if (this.winnerUtterance && this.speechSynthesis.speaking) {
            return; // Skip if winner announcement is in progress
        }

        // Lead changes have priority over event announcements - cancel them if needed
        if (this.speechSynthesis.speaking && this.currentEventUtterance) {
            // Cancel event announcement to make room for lead change
            this.speechSynthesis.cancel();
            this.currentEventUtterance = null;
        }

        const utterance = new SpeechSynthesisUtterance(`${ostrichNumber} takes the lead!`);
        utterance.rate = 1.1; // Slightly faster for excitement
        utterance.pitch = 1.2; // Higher pitch for excitement
        utterance.volume = 0.8;

        // Try to use an energetic voice if available
        const voices = this.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('English') && (voice.name.includes('Female') || voice.name.includes('Male'))
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Clear event utterance reference when lead change starts
        utterance.onstart = () => {
            this.currentEventUtterance = null;
        };

        this.speechSynthesis.speak(utterance);
    }
    
    // Announce during-race events via TTS - LOW PRIORITY: Can be interrupted by lead changes
    announceEvent(ostrichNumber, eventName) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Don't interrupt winner announcements - those are highest priority
        if (this.winnerUtterance && this.speechSynthesis.speaking) {
            return; // Skip if winner announcement is in progress
        }

        // Event announcements are low priority - skip if already speaking (lead changes can interrupt)
        if (this.speechSynthesis.speaking) {
            return; // Skip if already speaking (lead change or other announcement)
        }

        const utterance = new SpeechSynthesisUtterance(`Ostrich ${ostrichNumber}: ${eventName}!`);
        utterance.rate = 1.2; // Fast and energetic
        utterance.pitch = 1.3; // Higher pitch for excitement
        utterance.volume = 0.8;

        // Try to use an energetic voice if available
        const voices = this.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('English') && (voice.name.includes('Female') || voice.name.includes('Male'))
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Track this as an event utterance (can be interrupted by lead changes)
        this.currentEventUtterance = utterance;
        utterance.onend = () => {
            if (this.currentEventUtterance === utterance) {
                this.currentEventUtterance = null;
            }
        };
        utterance.onerror = () => {
            if (this.currentEventUtterance === utterance) {
                this.currentEventUtterance = null;
            }
        };

        this.speechSynthesis.speak(utterance);
    }
}

