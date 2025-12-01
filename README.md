# Ostrich Races - Billionaire Mindset 💸💰

A high-energy, opulent ostrich racing game with betting mechanics. Experience the surreal luxury of the Billionaire Mindset theme!

## Features

- 💸 **8 Unique Ostriches**: Each with distinct colors, saddles, collars, and racing stats
- 💰 **Betting System**: Place wagers on your favorite ostriches with dynamic odds
- 👾 **16-bit Pixel Art Style**: Bright, clashing colors matching the opulent theme
- 📱 **Progressive Web App (PWA)**: Installable, works offline
- 💾 **Local Storage**: Your bankroll and stats are saved automatically
- 🏁 **Dynamic Racing**: Variable speeds, stamina, and random events

## Getting Started


## Project Structure

```
ostrich-races/
├── index.html          # Main HTML file
├── manifest.json       # PWA manifest
├── sw.js              # Service worker for offline support
├── css/
│   └── style.css      # Styling with opulent theme
├── js/
│   ├── main.js        # Entry point
│   ├── game.js        # Game state management
│   ├── race.js        # Race mechanics
│   ├── ostrich.js     # Ostrich class and management
│   ├── betting.js     # Betting system
│   ├── graphics.js    # WebGL/Canvas rendering
│   ├── storage.js     # LocalStorage management
│   └── utils.js       # Utility functions
└── icons/             # PWA icons (see icons/README.md)
```

## Game Mechanics

### Betting
- Select an ostrich and enter your bet amount
- Each ostrich has odds based on their stats (1:1 to 10:1)
- Place multiple bets on different ostriches
- Payout = Bet Amount × Odds (if your ostrich wins)

### Racing
- 8 ostriches race simultaneously
- Each ostrich has:
  - **Base Speed**: How fast they run
  - **Stamina**: Affects late-race performance
  - **Consistency**: Affects random variations
- Random events can affect race outcomes

### Bankroll
- Start with $1,000,000 (billionaire style!)
- Your bankroll is saved automatically
- Stats track your wins, losses, and achievements

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

## Development Notes

## License

This project is created for entertainment purposes.

## Credits

Inspired by the "Billionaire Mindset" theme - high-energy realism comedy with surreal luxury and giant ostriches!

