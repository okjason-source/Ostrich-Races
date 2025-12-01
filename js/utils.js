// Utility functions

function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Color utilities for bright, clashing colors
const THEME_COLORS = {
    gold: [255, 215, 0],
    neonPink: [255, 0, 255],
    electricBlue: [0, 255, 255],
    luxuryPurple: [138, 43, 226],
    neonGreen: [0, 255, 0],
    hotPink: [255, 20, 147],
    cyan: [0, 255, 255],
    orange: [255, 165, 0],
    magenta: [255, 0, 128],
    lime: [191, 255, 0]
};

function getThemeColor(name) {
    return THEME_COLORS[name] || THEME_COLORS.gold;
}

function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

