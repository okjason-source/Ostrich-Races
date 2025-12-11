# Ostrich Palace Races - Billionaire Mindset 💸💰

A high-energy, opulent ostrich racing game with betting mechanics. Experience the surreal luxury of the Billionaire Mindset theme at the Ostrich Palace!

## Features

- 💸 **16 Unique Ostriches**: A pool of 16 distinct ostriches, with 8 randomly selected for each race
- 🎨 **Permanent Visual Identity**: Each ostrich maintains consistent appearance (body, tail, head, legs, eyes) across all races
- 💰 **Betting System**: Place wagers on your favorite ostriches with dynamic odds (1:1 to 12:1)
- 🎯 **Exotic Betting**: Exacta, Trifecta, Superfecta, and Quinella bets with high payouts (8:1 to 200:1)
- 🤖 **AI-Powered Betting Bot**: Full Auto, Bot Mode, and Human Mode with optional LLM expert recommendations
- 🧠 **LLM Expert System**: Get AI-powered betting analysis from OpenAI (GPT), Grok, or Gemini
- 🌅 **Day/Night Cycle**: Real-time time-based racing conditions affecting ostrich performance
- ⚡ **Pre-Race Events**: Sick, Tired, Muddy, Energized, and Nervous conditions affecting race outcomes
- 🎬 **During-Race Events**: Trip, Spin Out, Burst of Speed, and Stumble with visual animations
- 🌐 **Multiplayer/Hosting**: Host rooms, join rooms, synchronized races with activity-based betting windows
- 🎮 **Host Controls**: Separate control panel for game masters with admin management
- 🔊 **Text-to-Speech**: Spoken announcements for bets, winners, and race events
- 👾 **Dual Sprite System**: Toggle between image-based and drawn pixel art ostriches
- 💎 **B-M Tab System**: Billionaire Mindset tab tracking for high-rollers
- ⏱️ **Live Countdown**: Real-time countdown timer for betting windows and race starts in hosted multiplayer races
- 📱 **Progressive Web App (PWA)**: Installable, works offline
- 💾 **Local Storage**: Your bankroll and stats are saved automatically
- 🏁 **Dynamic Racing**: Variable speeds, stamina, and random events with deterministic multiplayer simulation

## Getting Started

### Quick Start

1. **Install Python dependencies** (optional, for .env support):
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up your API keys** (for LLM expert rundown):
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Start the server**:
   ```bash
   python3 server.py
   ```

4. **Open your browser**:
   Navigate to `http://localhost:8080`

### Environment Variables

Create a `.env` file in the project root with your LLM API keys:

```env
LLM_PROVIDER=openai  # or 'grok' or 'gemini'
OPENAI_API_KEY=your-key-here
GROK_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
```

The Python server will automatically inject these into the page. The `.env` file is gitignored for security.

## Project Structure

```
ostrich-races/
├── index.html              # Main HTML file
├── host-controls.html      # Host controls panel for game masters
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline support
├── server.py               # Python server for .env support
├── host-server.js          # Node.js WebSocket server for multiplayer
├── config.js               # Configuration (API keys from .env)
├── css/
│   └── style.css          # Styling with opulent theme
├── js/
│   ├── main.js            # Entry point
│   ├── game.js            # Game state management
│   ├── race.js            # Race mechanics and simulation
│   ├── ostrich.js         # Ostrich class and management
│   ├── betting.js         # Regular betting system
│   ├── exotic-betting.js  # Exotic betting system
│   ├── betting-bot.js     # AI betting bot
│   ├── llm.js             # LLM expert system
│   ├── graphics.js        # Canvas rendering (image & drawn sprites)
│   ├── events.js          # Pre-race and during-race events
│   ├── day-night.js       # Day/night cycle system
│   ├── sound.js           # Sound effects and TTS
│   ├── storage.js         # LocalStorage management
│   ├── multiplayer-client.js  # Multiplayer client
│   ├── host-client.js     # Host client for game masters
│   └── utils.js           # Utility functions
└── icons/                 # PWA icons (see icons/README.md)
```

## Game Mechanics

### Betting

**Regular Bets:**
- Select an ostrich and enter your bet amount
- Each ostrich has odds based on their stats (1:1 to 12:1)
- Bet types: WIN, PLACE, SHOW
- Place multiple bets on different ostriches
- Payout = Bet Amount × Odds (if your ostrich wins)

**Exotic Bets:**
- **Exacta**: Pick 1st and 2nd in exact order (15:1 payout)
- **Trifecta**: Pick 1st, 2nd, and 3rd in exact order (50:1 payout)
- **Superfecta**: Pick 1st-4th in exact order (200:1 payout)
- **Quinella**: Pick top 2 in any order (8:1 payout)

### Racing
- 8 ostriches race simultaneously (randomly selected from a pool of 16)
- Each ostrich has:
  - **Base Speed**: How fast they run (0.5 to 1.3)
  - **Stamina**: Affects late-race performance (0.5 to 1.0)
  - **Consistency**: Affects random variations (0.4 to 1.0)
  - **Time Preference**: Each ostrich performs better at certain times of day
  - **Permanent Visual Features**: Body color, neck/leg color, eye style, and tail that remain consistent across races
- **Pre-Race Events**: Can affect performance before the race starts
  - Sick (-20% speed, -15% stamina)
  - Tired (-15% speed, -10% stamina)
  - Muddy (-10% speed, -5% consistency)
  - Energized (+10% speed)
  - Nervous (-5% consistency)
- **During-Race Events**: Dynamic events during the race
  - Trip: Speed drops to 85%
  - Spin Out: Speed drops to 70% (or propels forward 15% chance)
  - Burst of Speed: Speed boosts to 105%
  - Stumble: Speed drops to 90%
- Each ostrich maintains their unique identity regardless of race number assignment

### Day/Night Cycle
- Real-time time-based racing conditions
- 7 time periods: Night, Dawn, Morning, Day, Afternoon, Dusk, Evening
- Each ostrich has a preferred time period (+15% performance boost)
- Opposite time periods get -10% penalty
- Affects odds calculation and race performance

### Betting Bot & AI

**Player Modes:**
- **Human Mode**: Manual betting with full control
- **Bot Mode**: Automatic betting using conservative rule-based strategy
  - Analyzes odds, pre-race events, and time preferences
  - Bets on favorites (WIN/PLACE) when odds ≤8-1
  - Places exotic bets when conditions are right
  - Avoids ostriches with negative events
- **Full Auto Mode**: Automatically places bets and starts races (offline only)
  - Can use LLM recommendations or conservative strategy
  - Adapts to multiplayer logic when hosting

**LLM Expert System:**
- AI-powered betting analysis from OpenAI (GPT-4o-mini), Grok (Grok-3-mini), or Gemini (Gemini-1.5-flash)
- Analyzes odds, time preferences, pre-race events, and current bets
- Provides spoken recommendations via text-to-speech
- Bot can automatically follow LLM recommendations
- Professional betting analysis framework (Kelly Criterion, expected value)

### Multiplayer & Hosting

**Offline Mode:**
- Play anytime, anywhere, no server needed
- Full Auto mode available
- All features work independently

**Online/Hosting Mode:**
- **Game Master**: Can host rooms and use Full Auto mode
- **Players**: Join rooms to watch/bet on synchronized races
- **Activity-Based Betting Windows**: Dynamic timing (30s - 3min)
  - Minimum: 30 seconds (if all ready)
  - Maximum: 3 minutes (if active betting)
  - Starts when: All ready + 15s no bets, or max time reached
- **Deterministic Simulation**: Seeded RNG ensures all players see the same race results
- **Host Controls**: Separate control panel for game masters
- **Admin System**: Admin mode and management features
- **Synchronized Races**: All players see the exact same race, odds, and results

### Bankroll
- Start with $1,000,000 (billionaire style!)
- Your bankroll is saved automatically in localStorage
- Stats track your wins, losses, and achievements
- **B-M Tab**: Billionaire Mindset tab tracking (one per session)
- Independent bankrolls in multiplayer (bet against the house, not each other)

### Hosted Race Countdown
In multiplayer hosted races, a live countdown timer keeps all players synchronized:

- **Betting Window Timer**: Shows time remaining (e.g., "45s") during the betting phase
  - Displays "Waiting for Bets..." with the countdown
  - Updates in real-time as players place bets and mark ready
  
- **Race Start Countdown**: 10-second countdown before the race begins
  - Shows "Race starting in..." with the countdown number
  - Turns red and pulses urgently in the final 3 seconds
  - All players see the same synchronized countdown from the host

- **Smart Timing**: The countdown automatically starts when:
  - All players are ready and no new bets for 15 seconds
  - Maximum betting window duration is reached (3 minutes)
  - No betting activity for 30 seconds (after minimum 30s window)

The countdown ensures fair, synchronized race starts for all players in the room!

### Graphics & Visuals

**Sprite System:**
- Toggle between image-based sprites and drawn pixel art
- Image sprites use `ostrich-bird-shape-running.png` with colorization
- Drawn sprites feature animated legs, permanent visual features, and detailed styling
- Preference saved in localStorage

**Visual Features:**
- Animated running cycles with leg movement
- Glow auras for burst of speed events
- Speed lines during speed bursts
- Recommendation glow for LLM-recommended ostriches
- Spin-out animations with rotation
- Mud effects and visual feedback for events
- Day/night cycle affects background gradient

**Ostrich Visual Identity:**
- Each ostrich has permanent body color (brown or dark brown/black)
- Permanent neck/leg color (white, light pink, hot pink, or neon pink)
- Permanent eye style (dot, dash, sunglasses, or dotdash)
- Tail, head, and body shape remain consistent
- Saddle and collar colors match the ostrich's theme

## Theme: Billionaire Mindset

The game captures the spirit of:
- **Surreal Luxury**: Opulent mansion landscape setting
- **Bright Colors**: Neon pinks, electric blues, gold accents
- **High Energy**: Fast-paced, exciting gameplay
- **Absurd Opulence**: Over-the-top luxury elements

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (iOS 11.3+)
- Opera

## Advanced Features

### Text-to-Speech (TTS)
- Spoken announcements for:
  - Bet placements and amounts
  - Exotic bet details
  - Race winners
  - Lead changes during races
  - Race events (trips, spin outs, etc.)
- Configurable voice settings
- Waits for announcements to complete before race starts (in Full Auto mode)

### Sound System
- Sound effects for race events
- Winner announcements
- Bet placement confirmations
- Race start countdown audio

### Statistics Tracking
- Total races watched
- Wins and losses
- Biggest win/loss amounts
- B-M Tab count
- Bot statistics (if using betting bot)
- All stats saved in localStorage

### Host Controls
- Separate control panel window for game masters
- Admin management features
- Room management
- Player tracking
- Race control options

## Deployment

### Local Development
1. Start Python server: `python3 server.py`
2. Open browser: `http://localhost:8080`
3. For multiplayer, start host server: `node host-server.js` (runs on port 8081)

### Production Deployment
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for comprehensive deployment options including:
- GitHub Pages (static frontend)
- Railway/Render (WebSocket server)
- Hybrid deployment strategies
- Web3 deployment options

## Development Notes

### Deterministic Simulation
- Multiplayer mode uses seeded RNG for synchronized races
- Offline mode uses Math.random() for single-player
- Same seed = same race results for all players

### Betting Model
- Players bet against the house (not each other)
- Independent bankrolls stored client-side
- Server calculates payouts but doesn't store bankrolls
- Parimutuel betting not implemented

## License

This project is created for entertainment purposes.

## Credits

Inspired by the "Billionaire Mindset" theme - high-energy realism comedy with surreal luxury and giant ostriches!

