#!/usr/bin/env node

/**
 * Quick Icon Generator - Creates basic canvas-based icons
 * Run with: node create-placeholder-icons.js
 * 
 * This creates simple placeholder icons in the browser by generating an HTML file
 * that auto-downloads the icons when opened.
 */

const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate HTML that will create and auto-download icons
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Generating Icons...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 40px;
            background: #1a0033;
            color: #fff;
            text-align: center;
        }
        h1 { color: #FFD700; }
        .status { margin: 20px 0; font-size: 18px; }
        .progress { color: #00ff00; }
    </style>
</head>
<body>
    <h1>🐪 Generating PWA Icons...</h1>
    <div id="status" class="status">Loading...</div>
    <div id="progress" class="progress"></div>
    
    <script>
        const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
        let completed = 0;
        const statusEl = document.getElementById('status');
        const progressEl = document.getElementById('progress');

        async function generateIcons() {
            statusEl.textContent = 'Creating icon files...';
            
            for (const size of sizes) {
                await generateIcon(size);
                completed++;
                progressEl.textContent = \`Generated \${completed}/\${sizes.length} icons\`;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            statusEl.textContent = '✅ All icons generated!';
            progressEl.textContent = 'Icons saved to icons/ folder. You can close this window.';
            
            // Update manifest
            setTimeout(() => {
                statusEl.innerHTML += '<br><br>✅ Icons are ready. Close this window and refresh your app.';
            }, 1000);
        }

        function generateIcon(size) {
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                // Background gradient (opulent theme)
                const gradient = ctx.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#FFD700');
                gradient.addColorStop(0.3, '#FF00FF');
                gradient.addColorStop(0.6, '#00FFFF');
                gradient.addColorStop(1, '#FF1493');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);

                // Draw ostrich emoji
                ctx.fillStyle = '#000';
                ctx.font = \`bold \${size * 0.5}px Arial\`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🐪', size / 2, size / 2 - size * 0.05);

                // Add text
                ctx.font = \`bold \${size * 0.12}px Arial\`;
                ctx.fillStyle = '#FFF';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = size * 0.01;
                ctx.strokeText('RACES', size / 2, size / 2 + size * 0.3);
                ctx.fillText('RACES', size / 2, size / 2 + size * 0.3);

                // Border
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = Math.max(1, size * 0.01);
                ctx.strokeRect(0, 0, size, size);

                // Download
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`icon-\${size}x\${size}.png\`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve();
                });
            });
        }

        window.addEventListener('load', generateIcons);
    </script>
</body>
</html>`;

const outputFile = path.join(__dirname, 'auto-generate-icons.html');
fs.writeFileSync(outputFile, htmlContent);

console.log('\n✅ Created auto-generate-icons.html');
console.log('\nTo generate icons:');
console.log('1. Open auto-generate-icons.html in your browser');
console.log('2. Icons will automatically download');
console.log('3. Move downloaded icons to the icons/ folder');
console.log('\nOr manually open generate-icons.html for more control.\n');

