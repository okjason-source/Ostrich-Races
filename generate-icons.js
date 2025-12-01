#!/usr/bin/env node

/**
 * Icon Generator Script
 * Generates PWA icons from ostrich-bird-shape-running.png
 * 
 * Requires: node-canvas (npm install canvas)
 * Or use the browser-based generate-icons.html instead
 */

const fs = require('fs');
const path = require('path');

// Check if canvas is available
let Canvas, Image;
try {
    const canvasModule = require('canvas');
    Canvas = canvasModule.createCanvas;
    Image = canvasModule.Image;
} catch (error) {
    console.error('Error: canvas module not found.');
    console.error('Please install it with: npm install canvas');
    console.error('Or use the browser-based generate-icons.html instead.');
    process.exit(1);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputImagePath = path.join(__dirname, 'ostrich-bird-shape-running.png');
const outputDir = path.join(__dirname, 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Load and process image
fs.readFile(inputImagePath, (err, imageData) => {
    if (err) {
        console.error('Error reading image:', err.message);
        console.error('Make sure ostrich-bird-shape-running.png exists in the project root.');
        process.exit(1);
    }

    const img = new Image();
    img.onload = () => {
        console.log(`Loaded image: ${img.width}x${img.height}`);
        console.log('Generating icons...\n');

        sizes.forEach(size => {
            const canvas = Canvas(size, size);
            const ctx = canvas.getContext('2d');

            // Background gradient (opulent theme)
            const gradient = ctx.createLinearGradient(0, 0, size, size);
            gradient.addColorStop(0, '#FFD700'); // Gold
            gradient.addColorStop(0.3, '#FF00FF'); // Neon Pink
            gradient.addColorStop(0.6, '#00FFFF'); // Electric Blue
            gradient.addColorStop(1, '#FF1493'); // Hot Pink
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Calculate scaling to fit with padding
            const padding = size * 0.1;
            const maxWidth = size - (padding * 2);
            const maxHeight = size - (padding * 2);
            
            const scale = Math.min(
                maxWidth / img.width,
                maxHeight / img.height
            );
            
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (size - scaledWidth) / 2;
            const y = (size - scaledHeight) / 2;

            // Draw ostrich image
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

            // Optional: Add subtle border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = Math.max(1, size * 0.01);
            ctx.strokeRect(0, 0, size, size);

            // Save icon
            const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);
            console.log(`✓ Generated: icon-${size}x${size}.png`);
        });

        console.log(`\n✓ All icons generated in ${outputDir}/`);
    };

    img.onerror = (err) => {
        console.error('Error loading image:', err);
        process.exit(1);
    };

    img.src = imageData;
});

