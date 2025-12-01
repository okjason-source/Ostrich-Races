# Ostrich Races - Billionaire Mindset 🐪💰

A high-energy, opulent ostrich racing game with betting mechanics. Experience the surreal luxury of the Billionaire Mindset theme!

## Features

- 🐪 **8 Unique Ostriches**: Each with distinct colors, saddles, collars, and racing stats
- 💰 **Betting System**: Place wagers on your favorite ostriches with dynamic odds
- 🎨 **16-bit Pixel Art Style**: Bright, clashing colors matching the opulent theme
- 📱 **Progressive Web App (PWA)**: Installable, works offline
- 💾 **Local Storage**: Your bankroll and stats are saved automatically
- 🏁 **Dynamic Racing**: Variable speeds, stamina, and random events

## Getting Started

### Local Development

1. **Serve the files**: Since this is a PWA, you need to serve it over HTTP/HTTPS (not file://)

   Using Python 3:
   ```bash
   python3 -m http.server 8000
   ```

   Using Node.js (http-server):
   ```bash
   npx http-server -p 8000
   ```

   Using PHP:
   ```bash
   php -S localhost:8000
   ```

2. **Open in browser**: Navigate to `http://localhost:8000`

3. **Install as PWA**: 
   - Chrome/Edge: Look for the install icon in the address bar
   - Safari (iOS): Tap Share → Add to Home Screen

### Production Deployment

Deploy to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Any web server with HTTPS

**Important**: PWAs require HTTPS (except for localhost).

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

### Adding Icons

Icons are generated from `ostrich-bird-shape-running.png`:

**Browser Method (Recommended):**
1. Open `generate-icons.html` in your browser
2. Icons will auto-generate with opulent theme colors
3. Click "Download All Icons" and save to the `icons/` folder

**Command Line Method:**
```bash
npm install canvas  # Optional dependency
npm run generate-icons
```

See `icons/README.md` for more details.

### Customization

- **Colors**: Edit `THEME_COLORS` in `js/utils.js`
- **Ostrich Stats**: Modify `Ostrich` class in `js/ostrich.js`
- **Race Length**: Adjust `raceLength` in `js/race.js`
- **Starting Bankroll**: Change default in `js/storage.js`

## License

This project is created for entertainment purposes.

## Credits

Inspired by the "Billionaire Mindset" theme - high-energy realism comedy with surreal luxury and giant ostriches!

