// Main game state management

class Game {
    constructor() {
        this.bankroll = StorageManager.loadBankroll();
        this.stats = StorageManager.loadStats();
        this.bettingSystem = new BettingSystem();
        this.exoticBettingSystem = new ExoticBettingSystem();
        this.ostrichManager = new OstrichManager();
        this.soundSystem = new SoundSystem();
        // EventSystem will be recreated with RNG when in multiplayer mode
        this.eventSystem = new EventSystem(); // Default: no RNG (offline mode)
        // LLM Expert System - optional (only if llm.js is loaded)
        this.llmExpert = typeof LLMExpertSystem !== 'undefined' ? new LLMExpertSystem(this.soundSystem) : null;
        this.bettingBot = new BettingBot(this);
        this.betsAnnouncementInProgress = false;
        this.lastBetTime = 0;
        this.announceBetsTimeout = null;
        this.betsAnnouncementPromise = null;
        this.race = null;
        this.countdownInterval = null;
        
        // Cleanup tracking
        this.animationFrameId = null;
        this.isRaceActive = false;
        
        // B-M Tab tracking - only one per session, never on first bet
        this.bmTabGrantedThisSession = false;
        
        // Multiplayer mode tracking (for deterministic simulation)
        this.isMultiplayer = false; // Set to true when connected to multiplayer server
        this.seededRNG = null; // Seeded random number generator (only used in multiplayer mode)
        this.multiplayerClient = null; // Multiplayer client instance (Phase 3+)
        this.hostClient = null; // Host client instance (Phase 7+) - for game master to host rooms
        this.isHosting = false; // Whether this client is hosting a room
        this.isGameMaster = true; // Whether this client is the game master (can host rooms). Default true for now.
        this.isAdmin = false; // Whether this client is in admin mode (anyone can enable this)
        
        // Set up pre-race event checker for LLM (if available)
        if (this.llmExpert) {
            this.llmExpert.setPreRaceEventChecker((ostrichNumber) => {
                return this.eventSystem.getPreRaceEvent(ostrichNumber) !== null;
            });
            // Set callback to refresh UI when recommendations are parsed
            this.llmExpert.setOnRecommendationsParsed(() => {
                this.renderOstrichCards();
                // If bot is enabled, automatically place bets from LLM recommendations when available
                if (this.bettingBot && this.bettingBot.enabled) {
                    setTimeout(() => {
                        this.bettingBot.placeBetsFromLLM();
                    }, 500); // Small delay to ensure recommendations are fully parsed
                }
            });
        }
    }

    initialize(canvas, renderer, dayNightCycle = null) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.dayNightCycle = dayNightCycle; // Store reference to day/night cycle
        
        // Initialize ostriches with current time period
        // Use seeded RNG if in multiplayer mode, otherwise null (offline mode uses Math.random())
        const currentTimePeriod = this.dayNightCycle ? this.dayNightCycle.getCurrentTimePeriod() : null;
        this.ostrichManager.initializeOstriches(currentTimePeriod, this.seededRNG);
        
        // Generate pre-race events and apply modifiers
        this.eventSystem.generatePreRaceEvents(this.ostrichManager.ostriches);
        this.ostrichManager.ostriches.forEach(ostrich => {
            this.eventSystem.applyPreRaceModifiers(ostrich);
        });
        
        // Pass RNG to Race for deterministic simulation in multiplayer mode
        this.race = new Race(this.ostrichManager, renderer, canvas, this.soundSystem, this.eventSystem, this.seededRNG);
        this.updateUI();
        this.renderOstrichCards();
        this.setupExoticBets();
        
        // Set up LLM expert button (no auto-generate on load) - only if LLM is available
        if (this.llmExpert) {
            this.setupLLMButton();
        } else {
            // Hide LLM indicator if not available
            const llmIndicator = document.getElementById('llm-indicator');
            if (llmIndicator) {
                llmIndicator.classList.add('hidden');
            }
        }
        
        // Initialize host client (Phase 7+) - for game master to host rooms (only if available)
        if (typeof HostClient !== 'undefined') {
            this.initializeHostClient();
            
            // Set up host toggle button
            this.setupHostToggle();
            
            // Set up admin mode toggle (anyone can become admin)
            this.setupAdminModeToggle();
            
            // Set up admin management (game master only)
            this.setupAdminManagement();
            
            // Set up host controls app communication
            this.setupHostControlsApp();
            
            // Update button visibility after initialization
            setTimeout(() => {
                this.updateHostControlsButtonVisibility();
            }, 200);
        } else {
            // Hide host controls button if host client is not available
            const hostBtn = document.getElementById('open-host-controls-btn');
            if (hostBtn) {
                hostBtn.style.display = 'none';
            }
        }
    }
    
    // Set up host controls app communication
    setupHostControlsApp() {
        this.hostControlsWindow = null;
        
        // Set up button to open host controls
        const openBtn = document.getElementById('open-host-controls-btn');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                this.openHostControls();
            });
            
            // Show button if user can host (game master always can)
            // Update visibility after a short delay to ensure isGameMaster is set
            setTimeout(() => {
                this.updateHostControlsButtonVisibility();
            }, 100);
        }
        
        // Listen for messages from host controls app
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type && e.data.type.startsWith('host-controls-')) {
                this.handleHostControlsMessage(e.data);
            }
        });
        
        // Listen for localStorage events (fallback)
        window.addEventListener('storage', (e) => {
            if (e.key === 'host-controls-command') {
                try {
                    const data = JSON.parse(e.newValue);
                    this.handleHostControlsMessage(data);
                } catch (err) {
                    console.error('Error parsing host controls command:', err);
                }
            }
        });
        
        // Poll localStorage as a more reliable fallback (storage events don't fire in same window)
        let lastCommandTimestamp = 0;
        setInterval(() => {
            try {
                const command = localStorage.getItem('host-controls-command');
                if (command) {
                    const data = JSON.parse(command);
                    // Only process if it's new (timestamp is newer than last processed)
                    if (data.timestamp && data.timestamp > lastCommandTimestamp) {
                        lastCommandTimestamp = data.timestamp;
                        this.handleHostControlsMessage(data);
                        // Clear the command after processing
                        localStorage.removeItem('host-controls-command');
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }, 300);
        
        // Send state updates periodically
        setInterval(() => {
            if (this.hostControlsWindow && !this.hostControlsWindow.closed) {
                this.sendHostControlsState();
            }
        }, 1000);
    }
    
    openHostControls() {
        if (this.hostControlsWindow && !this.hostControlsWindow.closed) {
            // Focus existing window
            this.hostControlsWindow.focus();
        } else {
            // Open new window
            const width = 550;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            this.hostControlsWindow = window.open(
                'host-controls.html',
                'hostControls',
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );
            
            // Send initial state when window loads
            if (this.hostControlsWindow) {
                this.hostControlsWindow.addEventListener('load', () => {
                    setTimeout(() => {
                        this.sendHostControlsState();
                    }, 500);
                });
            }
        }
    }
    
    handleHostControlsMessage(data) {
        switch (data.type) {
            case 'host-controls-ping':
                // Respond to ping
                if (this.hostControlsWindow && !this.hostControlsWindow.closed) {
                    this.hostControlsWindow.postMessage({
                        type: 'host-controls-ping-response'
                    }, '*');
                }
                break;
                
            case 'host-controls-request-state':
                this.sendHostControlsState();
                break;
                
            case 'host-controls-toggle-admin':
                this.toggleAdminMode();
                break;
                
            case 'host-controls-toggle-host':
                this.toggleHosting();
                // Force immediate state update
                setTimeout(() => {
                    this.sendHostControlsState();
                }, 200);
                break;
                
            case 'host-controls-remove-admin':
                if (data.playerId) {
                    this.removeAdmin(data.playerId);
                }
                break;
        }
    }
    
    sendHostControlsState() {
        if (!this.hostControlsWindow || this.hostControlsWindow.closed) {
            return;
        }
        
        const state = {
            isGameMaster: this.isGameMaster,
            isAdmin: this.isAdmin,
            canHost: this.canHost(),
            isHosting: this.isHosting,
            isConnected: this.hostClient ? this.hostClient.isConnected() : false,
            playerId: this.multiplayerClient ? this.multiplayerClient.playerId : null,
            roomId: this.hostClient ? this.hostClient.roomId : null,
            playerCount: this.hostClient ? this.hostClient.playerCount : 0,
            admins: this.hostClient ? Array.from(this.hostClient.admins || []) : []
        };
        
        // Send via postMessage
        try {
            this.hostControlsWindow.postMessage({
                type: 'host-controls-update',
                state: state
            }, '*');
        } catch (e) {
            console.error('Error sending state to host controls:', e);
        }
        
        // Also update localStorage as fallback
        try {
            localStorage.setItem('host-controls-state', JSON.stringify({
                type: 'host-controls-update',
                state: state,
                timestamp: Date.now()
            }));
        } catch (e) {
            // Ignore localStorage errors
        }
    }
    
    // Initialize host client (Phase 7+)
    initializeHostClient() {
        // Only initialize if HostClient class is available
        if (typeof HostClient !== 'undefined') {
            this.hostClient = new HostClient(this);
            
            // Restore hosting state if it was active before page refresh
            if (this.hostClient) {
                setTimeout(() => {
                    this.hostClient.restoreHostingState();
                }, 1000); // Small delay to ensure everything is initialized
            }
        } else {
            this.hostClient = null;
        }
    }
    
    // Set up admin mode toggle (anyone can enable admin mode)
    setupAdminModeToggle() {
        const adminToggle = document.getElementById('admin-mode-toggle');
        if (adminToggle) {
            adminToggle.addEventListener('click', () => {
                this.toggleAdminMode();
            });
            this.updateAdminModeUI();
        }
    }
    
    // Toggle admin mode on/off (but game master can't be disabled)
    toggleAdminMode() {
        // Game master is always admin, can't be disabled
        if (this.isGameMaster) {
            return; // Game master is always admin
        }
        
        this.isAdmin = !this.isAdmin;
        
        // If becoming admin and hosting, notify server
        if (this.isAdmin && this.hostClient && this.hostClient.isHosting) {
            // Notify server that this player is now an admin
            const playerId = this.multiplayerClient ? this.multiplayerClient.playerId : null;
            if (playerId && this.hostClient) {
                this.hostClient.designateAdmin(playerId);
            }
        }
        
        // If removing admin and hosting, notify server
        if (!this.isAdmin && this.hostClient && this.hostClient.isHosting) {
            const playerId = this.multiplayerClient ? this.multiplayerClient.playerId : null;
            if (playerId && this.hostClient) {
                this.hostClient.removeAdmin(playerId);
            }
        }
        
        this.updateAdminModeUI();
        this.setupHostToggle(); // Re-setup host toggle to show/hide based on admin status
        this.updateAdminManagement(); // Update admin list
    }
    
    // Update admin mode button UI
    updateAdminModeUI() {
        const adminToggle = document.getElementById('admin-mode-toggle');
        const adminStatus = document.getElementById('admin-status');
        
        if (adminToggle && adminStatus) {
            // Game master is always admin
            if (this.isGameMaster || this.isAdmin) {
                adminToggle.classList.add('admin-active');
                if (this.isGameMaster) {
                    adminStatus.textContent = '👑 Master';
                    adminToggle.title = 'Game Master (always admin)';
                } else {
                    adminStatus.textContent = '👑 Admin';
                    adminToggle.title = 'Click to disable Admin Mode';
                }
            } else {
                adminToggle.classList.remove('admin-active');
                adminStatus.textContent = '👤 Player';
                adminToggle.title = 'Click to enable Admin Mode (allows hosting)';
            }
        }
        
        // Update host controls button visibility
        this.updateHostControlsButtonVisibility();
    }
    
    // Update host controls button visibility
    updateHostControlsButtonVisibility() {
        const openBtn = document.getElementById('open-host-controls-btn');
        if (openBtn) {
            // Game master can always host, or if admin mode is enabled
            if (this.isGameMaster || this.canHost()) {
                openBtn.style.display = 'block';
            } else {
                openBtn.style.display = 'none';
            }
        }
    }
    
    // Set up admin management panel (game master only)
    setupAdminManagement() {
        // Admin management is now in the separate host controls app
        // Just update it when needed
        this.updateAdminManagement();
    }
    
    // Update admin management panel
    updateAdminManagement() {
        // Update host controls app if open
        this.sendHostControlsState();
    }
    
    // Remove admin (game master only)
    removeAdmin(playerId) {
        if (!this.isGameMaster) {
            console.warn('Only game master can remove admins');
            return;
        }
        
        if (this.hostClient) {
            this.hostClient.removeAdmin(playerId);
            this.updateAdminManagement();
            
            // If removing self (shouldn't happen, but just in case)
            const currentPlayerId = this.multiplayerClient ? this.multiplayerClient.playerId : null;
            if (playerId === currentPlayerId) {
                this.isAdmin = false;
                this.updateAdminModeUI();
                this.setupHostToggle();
            }
        }
    }
    
    // Set up host toggle button (only for game master and admins)
    setupHostToggle() {
        const hostToggle = document.getElementById('host-toggle');
        if (hostToggle) {
            // Show button for game master or anyone in admin mode
            if (this.canHost()) {
                hostToggle.style.display = 'block';
                // Only add event listener once
                if (!hostToggle.hasAttribute('data-listener-added')) {
                    hostToggle.addEventListener('click', () => {
                        this.toggleHosting();
                    });
                    hostToggle.setAttribute('data-listener-added', 'true');
                }
                this.updateHostToggleUI();
            } else {
                // Hide button for regular players
                hostToggle.style.display = 'none';
            }
        }
    }
    
    // Check if current client can host (game master or admin)
    canHost() {
        return this.isGameMaster || this.isAdmin;
    }
    
    // Toggle hosting on/off
    toggleHosting() {
        if (this.isHosting) {
            this.stopHosting();
        } else {
            this.startHosting();
        }
        this.updateHostToggleUI();
    }
    
    // Update host toggle button UI
    updateHostToggleUI() {
        const hostToggle = document.getElementById('host-toggle');
        const hostStatus = document.getElementById('host-status');
        
        // Only update if button is visible (game master/admin only)
        if (hostToggle && hostStatus && this.canHost()) {
            if (this.isHosting) {
                hostToggle.classList.add('hosting');
                hostStatus.textContent = '🟢 Hosting';
                hostToggle.title = 'Click to stop hosting room';
            } else {
                hostToggle.classList.remove('hosting');
                hostStatus.textContent = '🔴 Offline';
                hostToggle.title = 'Click to start hosting room';
            }
        }
    }
    
    // Set game master status (can be called to designate game master)
    // Note: Game master can never be removed once set
    setGameMaster(isMaster) {
        // If already game master, can't be removed
        if (this.isGameMaster && !isMaster) {
            console.warn('Game master status cannot be removed');
            return;
        }
        
        this.isGameMaster = isMaster;
        // Game master is always admin
        if (isMaster) {
            this.isAdmin = true;
        }
        this.setupHostToggle(); // Re-setup to show/hide button
        this.setupAdminManagement(); // Show/hide admin management
        this.updateAdminModeUI(); // Update admin button
    }
    
    // Start hosting (game master starts playing online)
    startHosting(roomId = null) {
        if (this.hostClient) {
            this.hostClient.startHosting(roomId);
            this.isHosting = true;
            this.isMultiplayer = true; // Hosting means multiplayer mode
            this.updateHostToggleUI();
            // Force immediate state update to host controls
            setTimeout(() => {
                this.sendHostControlsState();
            }, 100);
        }
    }
    
    // Stop hosting (game master goes offline)
    stopHosting() {
        if (this.hostClient) {
            this.hostClient.stopHosting();
            this.isHosting = false;
            // Don't set isMultiplayer = false here - might still be connected as client
            this.updateHostToggleUI();
        }
    }
    
    // Multiplayer mode methods (for Phase 3+)
    setMultiplayerMode(enabled, seed = null) {
        this.isMultiplayer = enabled;
        if (enabled && seed !== null) {
            this.seededRNG = new SeededRandom(seed);
            // Update EventSystem with RNG
            this.eventSystem.rng = this.seededRNG;
            // Update Race with RNG if it exists
            if (this.race) {
                this.race.rng = this.seededRNG;
            }
        } else {
            this.seededRNG = null;
            // Clear RNG from EventSystem and Race (use Math.random() for offline)
            this.eventSystem.rng = null;
            if (this.race) {
                this.race.rng = null;
            }
        }
    }
    
    // Get current seed (for multiplayer synchronization)
    getCurrentSeed() {
        return this.seededRNG ? this.seededRNG.seed : null;
    }
    
    // ===== Phase 3: Multiplayer Client =====
    
    // Initialize multiplayer client
    initializeMultiplayerClient() {
        // Multiplayer client will be created when connecting to server
        // This method sets up the client instance
        this.multiplayerClient = new MultiplayerClient(this);
        
        // Set up event handlers
        this.multiplayerClient.onRaceParameters = (raceParams) => {
            // Initialize race from server parameters
            if (this.initializeRaceFromParameters(raceParams)) {
                // Show ready button in multiplayer mode
                const readyBtn = document.getElementById('ready-btn');
                if (readyBtn) {
                    readyBtn.classList.remove('hidden');
                    readyBtn.style.display = 'inline-block';
                    readyBtn.disabled = false;
                    readyBtn.textContent = 'Ready';
                }
                
                // If bot is enabled, automatically place bets
                if (this.bettingBot && this.bettingBot.enabled) {
                    setTimeout(() => {
                        // If full auto, trigger autoRun; otherwise just place bets
                        if (this.bettingBot.fullAuto) {
                            this.bettingBot.autoRun();
                        } else {
                            this.bettingBot.placeBetsFromLLM();
                        }
                    }, 500); // Small delay to ensure race is fully initialized
                }
            } else {
                console.error('Failed to initialize race from server parameters');
            }
        };
        
        this.multiplayerClient.onConnected = () => {
            this.isMultiplayer = true;
            // Update bot UI to show mode labels
            if (this.bettingBot) {
                this.bettingBot.updateUI();
            }
        };
        
        this.multiplayerClient.onDisconnected = () => {
            this.isMultiplayer = false;
            this.setMultiplayerMode(false, null);
            // Update bot UI to show regular labels
            if (this.bettingBot) {
                this.bettingBot.updateUI();
            }
        };
        
        this.multiplayerClient.onError = (error) => {
            console.error('Multiplayer error:', error);
        };
    }
    
    // Connect to multiplayer server
    connectToMultiplayer(serverUrl, roomId = null, playerMode = 'human') {
        if (!this.multiplayerClient) {
            this.initializeMultiplayerClient();
        }
        
        this.multiplayerClient.connect(serverUrl, roomId);
        if (roomId) {
            this.multiplayerClient.joinRoom(roomId, playerMode);
            // Set initial player mode
            this.multiplayerClient.setPlayerMode(playerMode);
        }
    }
    
    // Set player mode (for multiplayer)
    setPlayerMode(mode) {
        if (this.isMultiplayer && this.multiplayerClient) {
            this.multiplayerClient.setPlayerMode(mode);
        } else {
            // Offline mode - just update bot state
            if (mode === 'bot') {
                this.bettingBot.enabled = true;
            } else {
                this.bettingBot.enabled = false;
            }
        }
    }
    
    // Disconnect from multiplayer server
    disconnectFromMultiplayer() {
        if (this.multiplayerClient) {
            this.multiplayerClient.disconnect();
            this.isMultiplayer = false;
            this.setMultiplayerMode(false, null);
        }
    }
    
    // ===== Phase 2: Race Parameter Serialization =====
    
    // Generate unique race ID
    generateRaceId() {
        return `race-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Serialize current race parameters for multiplayer transmission
    serializeRaceParameters() {
        if (!this.ostrichManager || !this.ostrichManager.ostriches || this.ostrichManager.ostriches.length === 0) {
            console.warn('Cannot serialize race parameters: no ostriches initialized');
            return null;
        }
        
        const currentTimePeriod = this.dayNightCycle ? this.dayNightCycle.getCurrentTimePeriod() : null;
        const seed = this.seededRNG ? this.seededRNG.seed : null;
        
        // Serialize ostriches
        const ostriches = this.ostrichManager.ostriches.map(ostrich => ({
            number: ostrich.number,
            name: ostrich.name,
            baseSpeed: ostrich.baseSpeed,
            stamina: ostrich.stamina,
            consistency: ostrich.consistency,
            preferredTime: ostrich.preferredTime,
            odds: ostrich.odds
        }));
        
        // Serialize pre-race events
        const preRaceEvents = {};
        if (this.eventSystem && this.eventSystem.preRaceEvents) {
            this.eventSystem.preRaceEvents.forEach((event, ostrichNumber) => {
                preRaceEvents[ostrichNumber] = {
                    type: event.type,
                    name: event.name,
                    icon: event.icon,
                    modifier: event.modifier
                };
            });
        }
        
        return {
            raceId: this.generateRaceId(),
            seed: seed,
            timestamp: Date.now(),
            ostriches: ostriches,
            preRaceEvents: preRaceEvents,
            timeOfDay: currentTimePeriod,
            bettingWindowStart: Date.now(), // Will be set by server in multiplayer
            minWindowDuration: 30000, // 30 seconds
            maxWindowDuration: 180000 // 3 minutes
        };
    }
    
    // Deserialize race parameters and initialize race state (for multiplayer)
    deserializeRaceParameters(raceParams) {
        if (!raceParams || !raceParams.ostriches || !raceParams.seed) {
            console.error('Invalid race parameters provided');
            return false;
        }
        
        // Set multiplayer mode with the provided seed
        this.setMultiplayerMode(true, raceParams.seed);
        
        // Recreate ostriches from serialized data
        const ostriches = raceParams.ostriches.map(ostrichData => {
            // Find the color scheme for this ostrich by name
            const colorScheme = OSTRICH_COLORS.find(cs => cs.name === ostrichData.name) || OSTRICH_COLORS[ostrichData.number - 1];
            
            // Create ostrich with serialized stats (bypass random generation)
            const ostrich = new Ostrich(
                ostrichData.number,
                colorScheme,
                raceParams.timeOfDay || null,
                this.seededRNG // Use seeded RNG for deterministic simulation
            );
            
            // Override with serialized stats (these are the authoritative values)
            ostrich.baseSpeed = ostrichData.baseSpeed;
            ostrich.stamina = ostrichData.stamina;
            ostrich.consistency = ostrichData.consistency;
            ostrich.preferredTime = ostrichData.preferredTime;
            ostrich.odds = ostrichData.odds;
            
            // Recalculate current speed from base speed
            ostrich.currentSpeed = ostrich.baseSpeed;
            
            return ostrich;
        });
        
        // Replace ostriches in manager
        this.ostrichManager.ostriches = ostriches;
        
        // Restore pre-race events
        if (this.eventSystem && raceParams.preRaceEvents) {
            this.eventSystem.preRaceEvents.clear();
            Object.entries(raceParams.preRaceEvents).forEach(([ostrichNumber, eventData]) => {
                this.eventSystem.preRaceEvents.set(parseInt(ostrichNumber), eventData);
            });
            
            // Apply pre-race modifiers to ostriches
            ostriches.forEach(ostrich => {
                this.eventSystem.applyPreRaceModifiers(ostrich);
            });
        }
        
        // Update UI
        this.renderOstrichCards();
        this.updateUI();
        this.updateExoticBetsDropdowns();
        
        return true;
    }
    
    // Initialize race from parameters (alternative method that creates a new race)
    initializeRaceFromParameters(raceParams) {
        if (!this.deserializeRaceParameters(raceParams)) {
            return false;
        }
        
        // Create race if it doesn't exist (needed for multiplayer initialization)
        if (!this.race && this.canvas && this.renderer) {
            this.race = new Race(
                this.ostrichManager,
                this.renderer,
                this.canvas,
                this.soundSystem,
                this.eventSystem,
                this.seededRNG
            );
        }
        
        // Reset race state
        if (this.race) {
            this.race.state = 'waiting';
            this.race.raceTime = 0;
            this.race.countdown = 0;
            this.race.winnerAnnounced = false;
            this.race.activeAnimations.clear();
            this.race.currentLeader = null;
            this.race.lastLeadChangeTime = 0;
            // Update RNG reference
            this.race.rng = this.seededRNG;
        }
        
        // Clear bets
        this.bettingSystem.clearAllBets();
        this.exoticBettingSystem.clearAllExoticBets();
        
        // Reset UI
        const resultsPanel = document.getElementById('results-panel');
        const bettingPanel = document.getElementById('betting-panel');
        const raceArea = document.getElementById('race-area');
        
        if (resultsPanel) resultsPanel.classList.add('hidden');
        if (bettingPanel) bettingPanel.classList.remove('hidden');
        if (raceArea) raceArea.classList.remove('hidden');
        
        // Update recommended ostriches for visual indicators
        if (this.race && this.llmExpert) {
            const recommendedOstriches = this.llmExpert.getRecommendedOstriches();
            this.race.setRecommendedOstriches(recommendedOstriches);
        }
        
        // Reset race status
        const statusEl = document.getElementById('race-status');
        if (statusEl) statusEl.textContent = 'Waiting for Bets...';
        
        const timerEl = document.getElementById('race-timer');
        if (timerEl) timerEl.textContent = '';
        
        // Update displays to reflect cleared bets
        this.updateBetsDisplay();
        this.updateExoticBetsDisplay();
        this.updateUI();
        
        return true;
    }
    
    // ===== Phase 4: Multiplayer Betting & Activity Updates =====
    
    // Update betting window status (from server)
    updateBettingWindow(data) {
        // Update UI with time remaining
        const statusEl = document.getElementById('race-status');
        const timerEl = document.getElementById('race-timer');
        
        if (statusEl && data.timeRemaining !== undefined) {
            const seconds = Math.ceil(data.timeRemaining / 1000);
            statusEl.textContent = 'Waiting for Bets...';
            if (timerEl) {
                timerEl.textContent = `${seconds}s`;
                timerEl.style.display = 'block';
                timerEl.classList.add('countdown-active');
                timerEl.classList.remove('countdown-race-start', 'countdown-urgent');
            }
        }
    }
    
    // Handle race starting soon (from server)
    handleRaceStarting(data) {
        // Show countdown from server
        const statusEl = document.getElementById('race-status');
        const timerEl = document.getElementById('race-timer');
        
        if (statusEl && timerEl && data.countdown !== undefined) {
            statusEl.textContent = 'Race starting in...';
            timerEl.textContent = data.countdown;
            timerEl.style.display = 'block';
            timerEl.classList.add('countdown-active', 'countdown-race-start');
            
            // Add urgent styling for last 3 seconds
            if (data.countdown <= 3) {
                timerEl.classList.add('countdown-urgent');
            } else {
                timerEl.classList.remove('countdown-urgent');
            }
        }
    }
    
    // Update betting activity (ready count, time remaining, etc.)
    updateBettingActivity(data) {
        // Update UI with activity information
        const statusEl = document.getElementById('race-status');
        const timerEl = document.getElementById('race-timer');
        
        if (statusEl) {
            let statusText = 'Waiting for Bets...';
            
            if (data.readyCount !== undefined && data.totalPlayers !== undefined) {
                statusText += ` (${data.readyCount}/${data.totalPlayers} ready)`;
            }
            
            if (data.timeRemaining !== undefined && timerEl) {
                const seconds = Math.ceil(data.timeRemaining / 1000);
                // Format as MM:SS for times over 60 seconds
                const formattedTime = seconds >= 60 
                    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                    : `${seconds}s`;
                timerEl.textContent = formattedTime;
                timerEl.style.display = 'block';
                timerEl.classList.add('countdown-active');
                timerEl.classList.remove('countdown-race-start', 'countdown-urgent');
                
                // Add urgent styling when under 30 seconds
                if (seconds <= 30) {
                    timerEl.classList.add('countdown-urgent');
                } else {
                    timerEl.classList.remove('countdown-urgent');
                }
            } else if (timerEl && this.isMultiplayer) {
                // In multiplayer, always show timer during betting window
                timerEl.style.display = 'block';
            }
            
            statusEl.textContent = statusText;
        }
    }
    
    // Mark player as ready (multiplayer)
    markReady() {
        if (this.isMultiplayer && this.multiplayerClient && this.multiplayerClient.currentRaceId) {
            this.multiplayerClient.markReady(this.multiplayerClient.currentRaceId);
            // Update UI to show ready status
            const readyBtn = document.getElementById('ready-btn');
            if (readyBtn) {
                readyBtn.disabled = true;
                readyBtn.textContent = '✓ Ready';
            }
        }
    }
    
    // Handle official race results from server (after validation)
    handleOfficialRaceResults(data) {
        // Server has validated all client results and broadcasted official results
        // This ensures all clients see the same results even if there was a desync
        
        if (!data || !data.winner || !data.order) {
            console.error('Invalid official race results:', data);
            return;
        }
        
        // Verify our local results match server results (desync detection)
        const localWinner = this.race.getWinner();
        const localFinishingOrder = [...this.ostrichManager.ostriches]
            .sort((a, b) => a.finishPosition - b.finishPosition)
            .map(o => o.number);
        
        const serverWinner = data.winner;
        const serverOrder = data.order;
        
        // Check if results match
        const resultsMatch = localWinner && localWinner.number === serverWinner &&
                            JSON.stringify(localFinishingOrder) === JSON.stringify(serverOrder);
        
        if (!resultsMatch) {
            console.warn('Desync detected! Local results differ from server results.');
            console.warn('Local:', { winner: localWinner?.number, order: localFinishingOrder });
            console.warn('Server:', { winner: serverWinner, order: serverOrder });
            
            // Use server results as authoritative (they've been validated)
            // Update local race state to match server
            // Note: This is a basic recovery - full recovery would require re-running simulation
            // For now, we'll just log the desync and use server results for payouts
        }
        
        // Use server results for payouts (they're authoritative)
        const officialFinishingOrder = serverOrder;
        
        // Create odds map
        const oddsMap = {};
        this.ostrichManager.ostriches.forEach(o => {
            oddsMap[o.number] = o.odds;
        });
        
        // Calculate payouts using official results
        const payouts = this.bettingSystem.calculatePayouts(officialFinishingOrder, oddsMap);
        const exoticPayouts = this.exoticBettingSystem.calculateExoticPayouts(officialFinishingOrder);
        
        // Calculate combined profit
        const regularProfit = payouts.totalPayout - this.bettingSystem.getTotalBetAmount();
        const exoticProfit = exoticPayouts.totalPayout - this.exoticBettingSystem.getTotalExoticBetAmount();
        const combinedProfit = regularProfit + exoticProfit;
        
        // Update bankroll
        this.updateBankroll(this.bankroll + combinedProfit);
        
        // Get winner for display
        const winner = this.ostrichManager.getByNumber(serverWinner);
        
        // Show results with official data
        if (winner) {
            this.showResults(winner, payouts, exoticPayouts, combinedProfit);
        }
        
        // Record results for betting bot
        if (this.bettingBot && this.bettingBot.enabled) {
            this.bettingBot.recordBetOutcomes(payouts, exoticPayouts);
        }
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

    checkAndGrantBMTab() {
        // Check if player needs a B-M Tab (bailout)
        // Rules: Never on the very first bet. All tabs are counted.
        const minBet = 1000000;
        const isFirstBet = this.stats.racesWatched === 0;
        const isAtZero = this.bankroll === 0;
        
        // If at 0, must grant (unless it's the first bet)
        // Otherwise, grant if below minBet (can get multiple tabs, all are counted)
        if ((isAtZero && !isFirstBet) || (this.bankroll < minBet && !isFirstBet)) {
            this.bankroll = minBet;
            this.bmTabGrantedThisSession = true; // Mark as granted for this race
            this.stats = StorageManager.updateStats({
                bmTabs: this.stats.bmTabs + 1
            });
            
            // Show themed notification
            this.showBMTabNotification();
            
            StorageManager.saveBankroll(this.bankroll);
            this.updateUI();
        }
    }

    updateBankroll(amount) {
        this.bankroll = Math.max(0, amount);
        StorageManager.saveBankroll(this.bankroll);
        this.updateUI();
    }

    placeBet(ostrichNumber, amount, type = 'win') {
        // Check and grant B-M Tab if needed BEFORE checking funds
        const hadTabBefore = this.bmTabGrantedThisSession;
        this.checkAndGrantBMTab();
        const justGotTab = !hadTabBefore && this.bmTabGrantedThisSession;
        
        // If you just got a tab, you can only bet $1 million for this race
        if (justGotTab && amount > 1000000) {
            this.showNotification('Tab Bet Limit!', 'With a B-M Tab, you can only bet $1,000,000 for this race.', '💰', true);
            return false;
        }
        
        if (amount > this.bankroll) {
            this.showNotification('Insufficient Funds!', 'You don\'t have enough money for this bet.', '💰', true);
            return false;
        }

        if (amount <= 0) {
            this.showNotification('Invalid Bet Amount!', 'Bet amount must be greater than 0!', '⚠️', true);
            return false;
        }

        this.bettingSystem.placeBet(ostrichNumber, amount, type);
        this.updateBankroll(this.bankroll - amount);
        this.updateBetsDisplay();
        this.updateStartButton();
        
        // Track when bet was placed
        this.lastBetTime = Date.now();
        
        // Send bet to server if in multiplayer mode
        if (this.isMultiplayer && this.multiplayerClient && this.multiplayerClient.currentRaceId) {
            this.multiplayerClient.placeBet(this.multiplayerClient.currentRaceId, {
                ostrichNumber: ostrichNumber,
                amount: amount,
                type: type
            });
        }
        
        // Always reset to default bet amount
        document.getElementById('bet-amount').value = '1000000';
        
        // Announce bets after a short delay (to batch multiple bets and allow consolidation)
        clearTimeout(this.announceBetsTimeout);
        // Increased delay to ensure bet consolidation completes before announcement
        this.announceBetsTimeout = setTimeout(() => {
            this.announceBets();
        }, 1000); // Increased from 500ms to 1000ms to allow consolidation to complete
        
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
            this.showNotification('No Bets Placed!', 'Place at least one bet before starting the race!','💸', true);
            return;
        }

        // Prevent multiple races from starting
        if (this.isRaceActive) {
            return;
        }
        
        // Wait for bet announcement to finish and give time to check exotics
        if (this.betsAnnouncementInProgress) {
            this.showNotification('Please Wait', 'Bets are being announced. Please wait...', '⏳', true);
            return;
        }
        
        // Ensure at least 3 seconds have passed since last bet (for checking exotics)
        const timeSinceLastBet = Date.now() - this.lastBetTime;
        if (timeSinceLastBet < 3000 && this.lastBetTime > 0) {
            const remainingTime = Math.ceil((3000 - timeSinceLastBet) / 1000);
            this.showNotification('Please Wait', `Review your bets. Race will be ready in ${remainingTime} second${remainingTime > 1 ? 's' : ''}...`, '⏳', true);
            return;
        }
        
        // Stop LLM TTS when race starts (this will also hide the indicator)
        // LLM should only speak between races, not during races
        // IMPORTANT: Only cancel LLM TTS, NOT winner announcements (those happen after race finishes)
        if (this.llmExpert) {
            this.llmExpert.stopSpeaking();
            // Ensure indicator is hidden
            this.llmExpert.hideIndicator();
        }
        
        // Clean up any existing timers
        this.cleanup();
        
        this.isRaceActive = true;
        // Clear countdown display when race starts
        const timerEl = document.getElementById('race-timer');
        if (timerEl) {
            timerEl.style.display = 'none';
            timerEl.classList.remove('countdown-active', 'countdown-race-start', 'countdown-urgent');
        }
        
        // Update recommended ostriches for visual indicators
        if (this.race && this.llmExpert) {
            const recommendedOstriches = this.llmExpert.getRecommendedOstriches();
            this.race.setRecommendedOstriches(recommendedOstriches);
        }
        
        this.race.startCountdown();
        this.startCountdown();
    }
    
    // Start race with synchronized timestamp (multiplayer)
    startRaceSynchronized(serverTimestamp) {
        // Prevent multiple races from starting
        if (this.isRaceActive) {
            return;
        }
        
        // Stop LLM TTS when race starts
        if (this.llmExpert) {
            this.llmExpert.stopSpeaking();
            this.llmExpert.hideIndicator();
        }
        
        // Clean up any existing timers
        this.cleanup();
        
        this.isRaceActive = true;
        
        // Start race directly (no countdown in multiplayer - server handles that)
        // Use server timestamp for synchronization
        this.race.startRaceSynchronized(serverTimestamp);
        this.gameLoop();
    }

    startCountdown() {
        const countdownEl = document.getElementById('race-timer');
        const statusEl = document.getElementById('race-status');
        
        if (!countdownEl || !statusEl) {
            console.error('Countdown elements not found');
            return;
        }
        
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Check if bot placed bets (only show "Check Your Tickets" for bot)
        const botPlacedBets = this.bettingBot && this.bettingBot.enabled && this.bettingBot.placedBetsThisRace;
        
        
        if (botPlacedBets) {
            // First phase: "Check Your Tickets" countdown (3 seconds) - only for bot
            statusEl.textContent = 'Check Your Tickets';
            let ticketsCountdown = 3;
            countdownEl.textContent = ticketsCountdown;
            countdownEl.style.display = 'block';
            
            this.countdownInterval = setInterval(() => {
                ticketsCountdown--;
                countdownEl.textContent = ticketsCountdown;
                
                if (ticketsCountdown <= 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    
                    // Second phase: "Get ready" countdown (3 seconds)
                    statusEl.textContent = 'Get ready...';
                    let readyCountdown = 3;
                    countdownEl.textContent = readyCountdown;
                    
                    this.countdownInterval = setInterval(() => {
                        readyCountdown--;
                        countdownEl.textContent = readyCountdown;
                        
                        if (readyCountdown <= 0) {
                            clearInterval(this.countdownInterval);
                            this.countdownInterval = null;
                            this.race.startRace();
                            statusEl.textContent = 'Racing!';
                            countdownEl.textContent = '';
                            this.gameLoop();
                        }
                    }, 1000);
                }
            }, 1000);
        } else {
            // Regular countdown for manual betting (no "Check Your Tickets")
            statusEl.textContent = 'Get ready...';
            let countdown = 3;
            countdownEl.textContent = countdown;
            countdownEl.style.display = 'block';
            
            this.countdownInterval = setInterval(() => {
                countdown--;
                countdownEl.textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    this.race.startRace();
                    statusEl.textContent = 'Racing!';
                    countdownEl.textContent = '';
                    this.gameLoop();
                }
            }, 1000);
        }
    }
    
    // Announce all bets placed for this race
    // Returns a promise that resolves when TTS finishes
    announceBets() {
        // TTS announcements work for all players (human and bot) in all modes
        // Note: Previously skipped in multiplayer/hosting, but now enabled for all
        
        // Prevent duplicate announcements
        if (this.betsAnnouncementInProgress && this.betsAnnouncementPromise) {
            // Already announcing, return the existing promise
            return this.betsAnnouncementPromise;
        }
        
        this.betsAnnouncementPromise = new Promise((resolve) => {
            if (!this.llmExpert || !this.soundSystem) {
                this.betsAnnouncementPromise = null;
                resolve();
                return;
            }
            
            const regularBets = this.bettingSystem.bets || [];
            const exoticBets = this.exoticBettingSystem.exoticBets || [];
            
            if (regularBets.length === 0 && exoticBets.length === 0) {
                this.betsAnnouncementPromise = null;
                resolve();
                return; // No bets to announce
            }
            
            const betParts = [];
            
            // Format regular bets
            regularBets.forEach(bet => {
                const ostrich = this.ostrichManager.ostriches.find(o => o.number === bet.ostrichNumber);
                const ostrichName = ostrich ? ostrich.name : `Ostrich ${bet.ostrichNumber}`;
                const betType = bet.type.toUpperCase();
                const amount = this.formatBetAmount(bet.amount);
                betParts.push(`${betType} on ${ostrichName} for ${amount}`);
            });
            
            // Format exotic bets
            exoticBets.forEach(bet => {
                const picks = bet.picks.map(num => {
                    const ostrich = this.ostrichManager.ostriches.find(o => o.number === num);
                    return ostrich ? ostrich.name : `Ostrich ${num}`;
                });
                
                const betType = bet.type.toUpperCase();
                const amount = this.formatBetAmount(bet.amount);
                
                // Format differently based on bet type
                let betText;
                if (bet.type === 'exacta') {
                    // Exacta: "EXACTA on [1st] then [2nd]"
                    betText = `${betType} on ${picks[0]} then ${picks[1]} for ${amount}`;
                } else if (bet.type === 'trifecta') {
                    // Trifecta: "TRIFECTA on [1st], [2nd], [3rd] in order"
                    betText = `${betType} on ${picks[0]}, ${picks[1]}, ${picks[2]} in order for ${amount}`;
                } else if (bet.type === 'superfecta') {
                    // Superfecta: "SUPERFECTA on [1st], [2nd], [3rd], [4th] in order"
                    betText = `${betType} on ${picks[0]}, ${picks[1]}, ${picks[2]}, ${picks[3]} in order for ${amount}`;
                } else if (bet.type === 'quinella') {
                    // Quinella: "QUINELLA on [pick1] and [pick2] (any order)"
                    betText = `${betType} on ${picks[0]} and ${picks[1]} for ${amount}`;
                } else {
                    // Fallback for unknown types
                    betText = `${betType} on ${picks.join(' and ')} for ${amount}`;
                }
                
                betParts.push(betText);
            });
            
            // Randomly choose ending phrase
            const endings = ["Don't get Flocked", "Billionaire Mindset"];
            const randomEnding = endings[Math.floor(Math.random() * endings.length)];
            const betsText = betParts.join(', ') + `. ${randomEnding}.`;
            
            // Track that we're announcing bets (prevents race from starting too soon)
            this.betsAnnouncementInProgress = true;
            this.lastBetTime = Date.now();
            
            // Track TTS completion using utterance callbacks
            let ttsCompleted = false;
            
            // Speak "Bag it up!" at faster speed, then the bets at normal speed
            const speechSynthesis = this.soundSystem.speechSynthesis;
            const voices = speechSynthesis.getVoices();
            
            // Find preferred voice (same logic as LLM expert)
            let preferredVoice = null;
            const configVoice = window.LLMConfig?.ttsVoice;
            if (configVoice && configVoice.trim() !== '') {
                preferredVoice = voices.find(voice => 
                    voice.name === configVoice || voice.name.toLowerCase() === configVoice.toLowerCase()
                );
            }
            if (!preferredVoice) {
                preferredVoice = voices.find(voice => 
                    (voice.name.includes('Enhanced') || voice.name.includes('Premium')) &&
                    voice.lang.startsWith('en')
                ) || voices.find(voice => 
                    voice.lang.startsWith('en-US') && 
                    !voice.name.toLowerCase().includes('compact') &&
                    !voice.name.toLowerCase().includes('novelty')
                ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
            }
            
            // First utterance: "Bag it up!" at faster speed
            const introUtterance = new SpeechSynthesisUtterance("Bag it up! ");
            introUtterance.rate = 1.6; // Faster speed (1.4x normal)
            introUtterance.pitch = 1.1;
            introUtterance.volume = 1.0;
            if (preferredVoice) {
                introUtterance.voice = preferredVoice;
            }
            
            // Second utterance: bets at normal speed
            const betsUtterance = new SpeechSynthesisUtterance(betsText);
            betsUtterance.rate = 1.0; // Normal speed
            betsUtterance.pitch = 1.0;
            betsUtterance.volume = 0.9;
            if (preferredVoice) {
                betsUtterance.voice = preferredVoice;
            }
            
            // Chain the utterances: speak bets after intro finishes
            introUtterance.onend = () => {
                speechSynthesis.speak(betsUtterance);
            };
            
            // Track completion when bets utterance finishes
            betsUtterance.onend = () => {
                ttsCompleted = true;
                setTimeout(() => {
                    this.betsAnnouncementInProgress = false;
                    // Wait additional 3 seconds for checking exotics
                    setTimeout(() => {
                        this.betsAnnouncementPromise = null;
                        resolve();
                    }, 3000);
                }, 300);
            };
            
            betsUtterance.onerror = () => {
                ttsCompleted = true;
                this.betsAnnouncementInProgress = false;
                resolve();
            };
            
            // Override to capture when TTS actually finishes
            const checkTTSCompletion = () => {
                // Check periodically if TTS has completed
                const checkInterval = setInterval(() => {
                    const isSpeaking = speechSynthesis.speaking || speechSynthesis.pending;
                    
                    if (!isSpeaking && !ttsCompleted) {
                        // TTS has stopped, wait a bit more to ensure it's really done
                        clearInterval(checkInterval);
                        ttsCompleted = true;
                        setTimeout(() => {
                            this.betsAnnouncementInProgress = false;
                            // Wait additional 3 seconds for checking exotics
                            setTimeout(() => {
                                this.betsAnnouncementPromise = null;
                                resolve();
                            }, 3000);
                        }, 300); // Increased delay to ensure TTS is fully done
                    }
                }, 100);
                
                // Safety timeout - resolve after 20 seconds even if TTS doesn't finish
                setTimeout(() => {
                    if (!ttsCompleted) {
                        clearInterval(checkInterval);
                        ttsCompleted = true;
                        this.betsAnnouncementInProgress = false;
                        resolve();
                    }
                }, 20000); // Increased timeout to allow longer announcements
            };
            
            // Start speaking the intro
            speechSynthesis.speak(introUtterance);
            
            // Start checking for TTS completion after a brief delay
            setTimeout(() => {
                checkTTSCompletion();
            }, 500);
            
            // Start checking for TTS completion after a brief delay
            setTimeout(() => {
                checkTTSCompletion();
            }, 500);
        });
    }
    
    // Format bet amount for speech (e.g., "1 million" instead of "$1,000,000")
    formatBetAmount(amount) {
        // Round to avoid floating point precision issues
        const roundedAmount = Math.round(amount);
        
        if (roundedAmount >= 1000000) {
            const millions = roundedAmount / 1000000;
            // Round to 1 decimal place to handle cases like 1.5 million, but show whole numbers cleanly
            const millionsRounded = Math.round(millions * 10) / 10;
            if (millionsRounded === 1) {
                return '1 million';
            } else if (millionsRounded === Math.floor(millionsRounded)) {
                // Whole number of millions
                return `${Math.floor(millionsRounded)} million`;
            } else {
                // Decimal millions (e.g., 1.5 million)
                return `${millionsRounded} million`;
            }
        } else if (roundedAmount >= 1000) {
            const thousands = roundedAmount / 1000;
            const thousandsRounded = Math.round(thousands * 10) / 10;
            if (thousandsRounded === Math.floor(thousandsRounded)) {
                return `${Math.floor(thousandsRounded)} thousand`;
            } else {
                return `${thousandsRounded} thousand`;
            }
        } else {
            return `${roundedAmount} dollars`;
        }
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
                // Stop the animation loop when race is finished
                return;
            } else if (this.race.state === 'racing') {
                this.animationFrameId = requestAnimationFrame(loop);
            } else {
                // For waiting/counting states, continue the loop but don't update race
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
        
        // Stop LLM TTS (but NOT winner announcement - let it finish)
        if (this.llmExpert) {
            this.llmExpert.stopSpeaking();
        }
        // DO NOT cancel speechSynthesis here - we want the winner announcement to finish
        
        // Clean up animations and events
        if (this.race) {
            this.race.activeAnimations.clear();
            if (this.eventSystem) {
                this.eventSystem.duringRaceEvents.clear();
            }
        }
        
        this.cleanup();
        
        const winner = this.race.getWinner();
        if (!winner) return;
        
        // Get finishing order (ostrich numbers)
        const finishingOrder = [...this.ostrichManager.ostriches]
            .sort((a, b) => a.finishPosition - b.finishPosition)
            .map(o => o.number);
        
        // In multiplayer mode, submit results to server for validation
        if (this.isMultiplayer && this.multiplayerClient && this.multiplayerClient.currentRaceId) {
            const winner = finishingOrder[0];
            this.multiplayerClient.submitRaceResult(
                this.multiplayerClient.currentRaceId,
                winner,
                finishingOrder
            );
        }
        
        // Create odds map
        const oddsMap = {};
        this.ostrichManager.ostriches.forEach(o => {
            oddsMap[o.number] = o.odds;
        });
        
        // Calculate regular payouts
        const payouts = this.bettingSystem.calculatePayouts(finishingOrder, oddsMap);
        
        // Calculate exotic payouts
        const exoticPayouts = this.exoticBettingSystem.calculateExoticPayouts(finishingOrder);
        
        // Record results for betting bot
        if (this.bettingBot && this.bettingBot.enabled) {
            this.bettingBot.recordRaceResults(finishingOrder, {
                results: payouts.results,
                exoticResults: exoticPayouts.results
            });
        }
        
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
        
        // Show results - don't wait for TTS to prevent freezing
        // TTS can continue in background if it's still playing
        const showResultsNow = () => {
            this.showResults(winner, payouts, exoticPayouts, combinedProfit);
            
            // If bot full auto is enabled, trigger next race after delay
            if (this.bettingBot && this.bettingBot.fullAuto && this.bettingBot.enabled) {
                setTimeout(() => {
                    this.bettingBot.onRaceFinished();
                }, 3000); // Wait 3 seconds after results show
            }
        };
        
        // Check if winner was announced and TTS is playing
        // If TTS is playing, wait a short time (max 3 seconds) for it to finish
        // Otherwise show results immediately
        let ttsCompleteHandler = null;
        let timeoutId = null;
        let checkInterval = null;
        
        // Check if TTS is actually speaking
        const isTTSSpeaking = () => {
            if (!this.soundSystem || !this.soundSystem.speechSynthesis) return false;
            return this.soundSystem.speechSynthesis.speaking || 
                   this.soundSystem.speechSynthesis.pending;
        };
        
        // If winner was announced and TTS is speaking, wait briefly for it
        if (this.race && this.race.winnerAnnounced && isTTSSpeaking()) {
            // TTS is playing - wait for it to complete (with short timeout)
            ttsCompleteHandler = () => {
                if (checkInterval) clearInterval(checkInterval);
                if (timeoutId) clearTimeout(timeoutId);
                window.removeEventListener('winnerTTSComplete', ttsCompleteHandler);
                // Small delay after TTS completes
                setTimeout(showResultsNow, 500);
            };
            window.addEventListener('winnerTTSComplete', ttsCompleteHandler);
            
            // Check periodically if TTS has stopped
            checkInterval = setInterval(() => {
                if (!isTTSSpeaking()) {
                    // TTS stopped - wait a moment then show results
                    clearInterval(checkInterval);
                    if (timeoutId) clearTimeout(timeoutId);
                    window.removeEventListener('winnerTTSComplete', ttsCompleteHandler);
                    setTimeout(showResultsNow, 500);
                }
            }, 100);
            
            // Short timeout - show results after 3 seconds max (prevents freezing)
            timeoutId = setTimeout(() => {
                if (checkInterval) clearInterval(checkInterval);
                window.removeEventListener('winnerTTSComplete', ttsCompleteHandler);
                showResultsNow();
            }, 3000); // Reduced from 15 seconds to 3 seconds
        } else {
            // No TTS playing or winner not announced - show results immediately
            showResultsNow();
        }
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
        
        // Show all bets
        const betsSummaryEl = document.getElementById('bets-summary');
        betsSummaryEl.innerHTML = '<h3>Your Bets</h3>';
        
        // Regular bets
        if (payouts && payouts.results && payouts.results.length > 0) {
            const regularBetsDiv = document.createElement('div');
            regularBetsDiv.className = 'bets-section';
            regularBetsDiv.innerHTML = '<h4>Regular Bets</h4>';
            
            payouts.results.forEach(result => {
                const betDiv = document.createElement('div');
                betDiv.className = `bet-result ${result.won ? 'bet-won' : 'bet-lost'}`;
                const ostrich = this.ostrichManager.ostriches.find(o => o.number === result.ostrichNumber);
                const ostrichName = ostrich ? ostrich.name : `Ostrich ${result.ostrichNumber}`;
                const position = sorted.find(o => o.number === result.ostrichNumber)?.finishPosition || 'DNF';
                
                betDiv.innerHTML = `
                    <div class="bet-info">
                        <span class="bet-type">${result.type.toUpperCase()}</span>
                        <span class="bet-ostrich">${result.ostrichNumber}. ${ostrichName}</span>
                        <span class="bet-position">Finished: #${position}</span>
                    </div>
                    <div class="bet-amount">
                        <span class="bet-wagered">Wagered: ${formatMoney(result.amount)}</span>
                        ${result.won 
                            ? `<span class="bet-payout">Payout: ${formatMoney(result.payout)}</span>
                               <span class="bet-profit">+${formatMoney(result.profit)}</span>`
                            : `<span class="bet-loss">Lost</span>`
                        }
                    </div>
                `;
                regularBetsDiv.appendChild(betDiv);
            });
            
            betsSummaryEl.appendChild(regularBetsDiv);
        }
        
        // Exotic bets
        if (exoticPayouts && exoticPayouts.results && exoticPayouts.results.length > 0) {
            const exoticBetsDiv = document.createElement('div');
            exoticBetsDiv.className = 'bets-section';
            exoticBetsDiv.innerHTML = '<h4>Exotic Bets</h4>';
            
            exoticPayouts.results.forEach(result => {
                const betDiv = document.createElement('div');
                betDiv.className = `bet-result ${result.won ? 'bet-won' : 'bet-lost'}`;
                const picks = result.bet.picks.map(num => {
                    const ostrich = this.ostrichManager.ostriches.find(o => o.number === num);
                    return ostrich ? `${num}. ${ostrich.name}` : `Ostrich ${num}`;
                }).join(' → ');
                
                betDiv.innerHTML = `
                    <div class="bet-info">
                        <span class="bet-type">${result.bet.type.toUpperCase()}</span>
                        <span class="bet-ostrich">${picks}</span>
                    </div>
                    <div class="bet-amount">
                        <span class="bet-wagered">Wagered: ${formatMoney(result.bet.amount)}</span>
                        ${result.won 
                            ? `<span class="bet-payout">Payout: ${formatMoney(result.payout)}</span>
                               <span class="bet-profit">+${formatMoney(result.profit)}</span>`
                            : `<span class="bet-loss">Lost</span>`
                        }
                    </div>
                `;
                exoticBetsDiv.appendChild(betDiv);
            });
            
            betsSummaryEl.appendChild(exoticBetsDiv);
        }
        
        // If no bets, show message
        if ((!payouts || !payouts.results || payouts.results.length === 0) && 
            (!exoticPayouts || !exoticPayouts.results || exoticPayouts.results.length === 0)) {
            betsSummaryEl.innerHTML += '<div class="no-bets">No bets placed this race.</div>';
        }
        
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
        // Auto-start hosting if enabled (but don't auto-start if user hasn't clicked the button)
        // Hosting should be manual via the toggle button
        // Removed auto-start - user controls hosting via button
        
        // Clean up any running timers/animations
        this.cleanup();
        this.isRaceActive = false;
        
        // Stop any ongoing TTS (but NOT winner announcements)
        if (this.llmExpert) {
            this.llmExpert.stopSpeaking();
        }
        // Use protected cancel to avoid canceling winner announcements
        if (this.soundSystem && this.soundSystem.cancelNonWinnerTTS) {
            this.soundSystem.cancelNonWinnerTTS();
        } else if (this.soundSystem && this.soundSystem.speechSynthesis) {
            // Fallback: only cancel if no winner announcement in progress
            if (!this.soundSystem.winnerUtterance) {
                this.soundSystem.speechSynthesis.cancel();
            }
        }
        
        // Clear race animations and events
        if (this.race) {
            this.race.activeAnimations.clear();
            if (this.eventSystem) {
                this.eventSystem.duringRaceEvents.clear();
                this.eventSystem.clearAll();
            }
        }
        
        // Get current time period for odds calculation
        const currentTimePeriod = this.dayNightCycle ? this.dayNightCycle.getCurrentTimePeriod() : null;
        
        // Reset everything with current time period
        // Use seeded RNG if in multiplayer mode, otherwise null (offline mode uses Math.random())
        this.ostrichManager.initializeOstriches(currentTimePeriod, this.seededRNG);
        
        // Update EventSystem RNG if in multiplayer mode (recreate if needed)
        if (this.isMultiplayer && this.seededRNG) {
            this.eventSystem.rng = this.seededRNG;
        } else {
            this.eventSystem.rng = null; // Offline mode
        }
        
        // Generate pre-race events and apply modifiers
        this.eventSystem.generatePreRaceEvents(this.ostrichManager.ostriches);
        this.ostrichManager.ostriches.forEach(ostrich => {
            this.eventSystem.applyPreRaceModifiers(ostrich);
        });
        
        // Reset B-M Tab for new race (can get a new tab if needed for this race)
        this.bmTabGrantedThisSession = false;
        
        // Reset bot's placed bets flag for new race
        if (this.bettingBot) {
            this.bettingBot.placedBetsThisRace = false;
        }
        
        this.bettingSystem.clearAllBets();
        this.exoticBettingSystem.clearAllExoticBets();
        
        // Immediately update displays to reflect cleared bets
        this.updateBetsDisplay();
        this.updateExoticBetsDisplay();
        
        // Update Race RNG if in multiplayer mode
        if (this.race) {
            this.race.rng = this.isMultiplayer ? this.seededRNG : null;
        }
        
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
        const statusEl = document.getElementById('race-status');
        const timerEl = document.getElementById('race-timer');
        if (statusEl) statusEl.textContent = 'Waiting for Bets...';
        if (timerEl) {
            // In multiplayer/hosting mode, keep timer visible (it will be updated by activity updates)
            if (!this.isMultiplayer) {
                timerEl.textContent = '';
                timerEl.style.display = 'none';
            }
        }
        
        // Clear LLM recommendations for new race
        if (this.llmExpert) {
            this.llmExpert.recommendedOstriches = [];
            this.llmExpert.recommendedExotics = {};
        }
        
        this.renderOstrichCards();
        
        // If hosting, generate and broadcast race parameters first
        if (this.isHosting && this.hostClient) {
            // Small delay to ensure race is fully initialized
            setTimeout(() => {
                this.hostClient.generateAndBroadcastRace();
                // After race params are broadcast, trigger bot if full auto is enabled
                // Reduced delay so bot can place bets and mark ready quickly
                if (this.bettingBot && this.bettingBot.enabled && this.bettingBot.fullAuto) {
                    setTimeout(() => {
                        this.bettingBot.autoRun();
                    }, 300); // Reduced from 1000ms - race params are processed quickly
                }
            }, 300); // Reduced from 500ms
        }
        
        // If bot is enabled (but not full auto), automatically place bets for review
        // Full auto will trigger itself when enabled (handled above for hosting, or here for offline)
        if (this.bettingBot && this.bettingBot.enabled) {
            if (this.bettingBot.fullAuto) {
                // In offline mode, trigger autoRun directly
                if (!this.isHosting) {
                    setTimeout(() => {
                        this.bettingBot.autoRun();
                    }, 500); // Small delay to ensure race is fully initialized
                }
                // In hosting mode, autoRun is triggered above when race params are broadcast
            } else {
                // Regular bot mode: just place bets for review
                setTimeout(() => {
                    this.bettingBot.placeBetsFromLLM();
                }, 500); // Small delay to ensure race is fully initialized
            }
        }
        
        this.updateExoticBetsDropdowns(); // Update odds in exotic bets dropdowns
        this.updateUI();
        this.updateBetsDisplay();
        this.updateExoticBetsDisplay();
        this.race.render();
        
        // Don't auto-generate LLM rundown - user clicks button to hear it
    }
    
    setupLLMButton() {
        const llmBtn = document.getElementById('llm-expert-btn');
        if (llmBtn) {
            llmBtn.addEventListener('click', () => {
                // Only generate if we're in waiting state
                if (this.race && this.race.state === 'waiting') {
                    this.generateExpertRundown();
                } else {
                    this.showNotification('Not Available', 'Expert rundown is only available while waiting for bets.', '💸', true);
                }
            });
        }
    }
    
    async generateExpertRundown() {
        // Only generate if LLM is available and we're in waiting state (between races)
        if (!this.llmExpert) {
            this.showNotification('Not Available', 'LLM Expert System is not available.', '💸', true);
            return;
        }
        if (this.race && this.race.state === 'waiting') {
            const currentTimePeriod = this.dayNightCycle ? this.dayNightCycle.getCurrentTimePeriod() : null;
            // Get current bets for LLM to consider
            const currentBets = this.bettingSystem.bets || [];
            const exoticBets = this.exoticBettingSystem.exoticBets || [];
            // Pass race state so LLM can check if race starts during generation
            await this.llmExpert.generateExpertRundown(this.ostrichManager.ostriches, currentTimePeriod, this.race.state, currentBets, exoticBets);
        }
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
            
            // Check for pre-race event
            const preRaceEvent = this.eventSystem.getPreRaceEvent(ostrich.number);
            const eventIndicator = preRaceEvent 
                ? `<div class="pre-race-event-indicator">${preRaceEvent.icon}${preRaceEvent.modifier.speed > 0 ? '+' : '-'}</div>`
                : '';
            
            // Check if this ostrich is recommended by LLM
            const recommendedOstriches = this.llmExpert ? this.llmExpert.getRecommendedOstriches() : [];
            const isRecommended = recommendedOstriches.includes(ostrich.number);
            const exoticTypes = isRecommended && this.llmExpert 
                ? this.llmExpert.getRecommendedExotics(ostrich.number) 
                : [];
            
            // Debug: Log all recommendations when rendering
            if (ostrich.number === 1) {
            }
            
            // Determine color based on exotic bet type
            let indicatorClass = 'billionaire-pick-indicator';
            let nameColor = ''; // Default color for name
            if (exoticTypes.length > 0) {
                // Color code by exotic type (prioritize highest payout)
                if (exoticTypes.includes('superfecta')) {
                    indicatorClass += ' exotic-superfecta';
                    nameColor = '#FF4500'; // Orange/Red
                } else if (exoticTypes.includes('trifecta')) {
                    indicatorClass += ' exotic-trifecta';
                    nameColor = '#FF00FF'; // Magenta/Pink
                } else if (exoticTypes.includes('exacta')) {
                    indicatorClass += ' exotic-exacta';
                    nameColor = '#00BFFF'; // Blue
                } else if (exoticTypes.includes('quinella')) {
                    indicatorClass += ' exotic-quinella';
                    nameColor = '#00FF00'; // Green
                }
            } else if (isRecommended) {
                // Regular WIN/PLACE/SHOW - Gold/Yellow
                nameColor = '#FFD700';
            }
            
            const billionaireIndicator = isRecommended 
                ? `<div class="${indicatorClass}">B</div>`
                : '';
            
            const nameStyle = nameColor ? `style="color: ${nameColor}; text-shadow: 0 0 8px ${nameColor}80;"` : '';
            
            card.innerHTML = `
                <div class="ostrich-number-circle" style="background-color: ${ostrich.color};">
                    ${ostrich.number}
                </div>
                <div class="ostrich-info">
                    <div class="ostrich-name" ${nameStyle}>${ostrich.name}</div>
                    <div class="ostrich-odds">${ostrich.odds}:1</div>
                </div>
                ${eventIndicator}
                ${billionaireIndicator}
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
        // Set up event listeners for exotic type changes
        document.querySelectorAll('input[name="exotic-type"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateExoticTypeDisplay(radio.value);
            });
        });

        // Initialize display
        this.updateExoticTypeDisplay('exacta');
        
        // Populate dropdowns with current ostriches
        this.updateExoticBetsDropdowns();
    }

    updateExoticBetsDropdowns() {
        // Update ostrich select dropdowns with current odds
        const selects = ['exotic-pos1', 'exotic-pos2', 'exotic-pos3', 'exotic-pos4'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Clear existing options (except the first empty one)
            const firstOption = select.options[0];
            select.innerHTML = '';
            if (firstOption && firstOption.value === '') {
                select.appendChild(firstOption);
            } else {
                // Add empty option if it doesn't exist
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = 'Select...';
                select.appendChild(emptyOption);
            }
            
            // Add current ostriches with their current odds
            this.ostrichManager.ostriches.forEach(ostrich => {
                const option = document.createElement('option');
                option.value = ostrich.number;
                option.textContent = `${ostrich.number}. ${ostrich.name} (${ostrich.odds}:1)`;
                select.appendChild(option);
            });
        });
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
        // Check and grant B-M Tab if needed BEFORE checking funds
        const hadTabBefore = this.bmTabGrantedThisSession;
        this.checkAndGrantBMTab();
        const justGotTab = !hadTabBefore && this.bmTabGrantedThisSession;
        
        const type = document.querySelector('input[name="exotic-type"]:checked').value;
        const amount = parseFloat(document.getElementById('exotic-bet-amount').value);
        
        // If you just got a tab, you must bet exactly $1 million for this race
        if (justGotTab && amount !== 1000000) {
            this.showNotification('Tab Bet Requirement!', 'With a B-M Tab, you must bet exactly $1,000,000 for this race.', '💰', true);
            return false;
        }
        
        if (amount > this.bankroll) {
            this.showNotification('Insufficient Funds!', 'You don\'t have enough money for this bet.', '💰', true);
            return false;
        }

        if (amount <= 0) {
            this.showNotification('Invalid Bet Amount!', 'Bet amount must be greater than 0!', '⚠️', true);
            return false;
        }

        // Get picks based on type
        const picks = [];
        const numPicks = type === 'exacta' || type === 'quinella' ? 2 :
                        type === 'trifecta' ? 3 : 4;
        
        for (let i = 1; i <= numPicks; i++) {
            const pick = parseInt(document.getElementById(`exotic-pos${i}`).value);
            if (!pick) {
                this.showNotification('Selection Required!', `Please select position ${i}!`, '💸', true);
                return false;
            }
            if (picks.includes(pick)) {
                this.showNotification('Invalid Selection!', 'Cannot select the same ostrich twice!', '⚠️', true);
                return false;
            }
            picks.push(pick);
        }

        this.exoticBettingSystem.placeExoticBet(type, picks, amount);
        this.updateBankroll(this.bankroll - amount);
        this.updateExoticBetsDisplay();
        this.updateStartButton();
        
        // Track when bet was placed
        this.lastBetTime = Date.now();
        
        // Send bet to server if in multiplayer mode
        if (this.isMultiplayer && this.multiplayerClient && this.multiplayerClient.currentRaceId) {
            this.multiplayerClient.placeBet(this.multiplayerClient.currentRaceId, {
                type: type,
                picks: picks,
                amount: amount
            });
        }
        
        // Reset
        document.getElementById('exotic-bet-amount').value = '1000000';
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`exotic-pos${i}`).value = '';
        }
        
        // Announce bets after a short delay (to batch multiple bets and allow consolidation)
        clearTimeout(this.announceBetsTimeout);
        // Increased delay to ensure bet consolidation completes before announcement
        this.announceBetsTimeout = setTimeout(() => {
            this.announceBets();
        }, 1000); // Increased from 500ms to 1000ms to allow consolidation to complete
        
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
        if (!listEl) {
            return; // Element doesn't exist, skip update
        }
        
        // Always clear the display first
        listEl.innerHTML = '';
        
        if (this.exoticBettingSystem.exoticBets.length === 0) {
            return; // No bets to display
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

    showBMTabNotification() {
        const messages = [
            { title: '💎 Billionaire Bailout!', message: 'Your credit line has been extended. The house always provides for high rollers!' },
            { title: '🏆 VIP Credit Activated!', message: 'A fresh million has been added to your account. Keep the action going!' },
            { title: '💰 Elite Status Confirmed!', message: 'Your Billionaire Mindset tab is open. Another million at your disposal!' },
            { title: '💸 High Roller Privilege!', message: 'The house extends you credit. A million dollars added to your account!' },
            { title: '👑 Opulent Overdraft!', message: 'Your billionaire status grants you another million. Play like you own the place!' }
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        this.showNotification(randomMessage.title, randomMessage.message, '💸');
    }

    showNotification(title, message, icon = '💸', isError = false, duration = 4000) {
        const notification = document.getElementById('themed-notification');
        if (!notification) return;
        
        const titleEl = notification.querySelector('.themed-notification-title');
        const messageEl = notification.querySelector('.themed-notification-message');
        const iconEl = notification.querySelector('.themed-notification-icon');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        iconEl.textContent = icon;
        
        // Add/remove error class
        if (isError) {
            notification.classList.add('error');
        } else {
            notification.classList.remove('error');
        }
        
        // Show notification
        notification.classList.remove('hidden');
        notification.classList.add('show');
        
        // Auto-hide after duration
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hidden');
        }, duration);
    }
}

