// WebGL graphics system for pixel art rendering

class GraphicsSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.initWebGL();
    }

    initWebGL() {
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        // Set canvas size
        this.resizeCanvas();

        // Create shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `);

        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `
            precision mediump float;
            uniform sampler2D u_texture;
            varying vec2 v_texCoord;
            
            void main() {
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }
        `);

        this.program = this.createProgram(vertexShader, fragmentShader);
        this.gl.useProgram(this.program);

        // Set up viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.53, 0.81, 0.92, 1.0); // Sky blue background

        // Enable blending for transparency
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    clear() {
        if (this.gl) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
    }

    // Create a simple 2D rendering context for pixel art
    // For now, we'll use Canvas 2D API for easier pixel art rendering
    // WebGL can be enhanced later for more complex effects
    get2DContext() {
        return this.canvas.getContext('2d');
    }
}

// Pixel art sprite renderer using Canvas 2D
class SpriteRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false; // Pixel art style
        this.sprites = new Map();
        this.ostrichImage = null;
        this.imageLoaded = false;
        this.loadOstrichImage();
    }

    loadOstrichImage() {
        const img = new Image();
        img.onload = () => {
            this.ostrichImage = img;
            this.imageLoaded = true;
            console.log('Ostrich image loaded:', img.width, 'x', img.height);
        };
        img.onerror = () => {
            console.error('Failed to load ostrich image');
        };
        img.src = './ostrich-bird-shape-running.png';
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;
    }

    clear() {
        // Draw sky gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB'); // Sky blue
        gradient.addColorStop(0.5, '#98D8C8'); // Mint
        gradient.addColorStop(1, '#F7DC6F'); // Gold
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw animated ostrich from the side with leg animation
    drawOstrich(x, y, width, height, colorScheme, number, animationFrame = 0) {
        this.ctx.save();
        
        if (this.imageLoaded && this.ostrichImage) {
            // Use the actual ostrich image
            this.drawAnimatedOstrichFromImage(x, y, width, height, colorScheme, number, animationFrame);
        } else {
            // Fallback to simple drawing if image not loaded
            this.drawSimpleOstrich(x, y, width, height, colorScheme, number, animationFrame);
        }
        
        this.ctx.restore();
    }

    drawAnimatedOstrichFromImage(x, y, width, height, colorScheme, number, animationFrame) {
        const scale = width / this.ostrichImage.width;
        const scaledHeight = this.ostrichImage.height * scale;
        
        // Create a temporary canvas to colorize the ostrich
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.ostrichImage.width;
        tempCanvas.height = this.ostrichImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Flip horizontally to face right (running direction)
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        
        // Draw the ostrich image (flipped)
        tempCtx.drawImage(this.ostrichImage, 0, 0);
        
        // Reset transform for image data manipulation
        tempCtx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Get image data to colorize
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        // Parse the color scheme
        const bodyColor = this.hexToRgb(colorScheme.color);
        const saddleColor = this.hexToRgb(colorScheme.saddle);
        
        // Colorize: body gets the main color, keep legs darker
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                // Apply color tint to the ostrich
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const intensity = brightness / 255;
                
                // Body color with some variation
                data[i] = bodyColor.r * intensity;
                data[i + 1] = bodyColor.g * intensity;
                data[i + 2] = bodyColor.b * intensity;
            }
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        // Apply leg animation by shifting y position slightly
        const legOffset = Math.sin(animationFrame * 0.3) * 3;
        
        // Draw the colorized ostrich (already flipped)
        this.ctx.drawImage(tempCanvas, x, y + legOffset, width, scaledHeight);
        
        // Add saddle overlay
        const saddleY = y + scaledHeight * 0.4 + legOffset;
        const saddleHeight = scaledHeight * 0.15;
        this.ctx.fillStyle = colorScheme.saddle;
        this.ctx.fillRect(x + width * 0.25, saddleY, width * 0.4, saddleHeight);
        
        // Add collar
        const collarY = y + scaledHeight * 0.15 + legOffset;
        this.ctx.fillStyle = colorScheme.collar;
        this.ctx.fillRect(x + width * 0.15, collarY, width * 0.2, scaledHeight * 0.08);
        
        // Number badge on saddle
        const badgeSize = Math.min(width * 0.15, 20);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(x + width * 0.35, saddleY + 2, badgeSize, badgeSize);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = `bold ${badgeSize * 0.7}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(number, x + width * 0.35 + badgeSize / 2, saddleY + badgeSize / 2 + 2);
    }

    drawSimpleOstrich(x, y, width, height, colorScheme, number, animationFrame) {
        // Simple side-view ostrich with animated legs (facing right)
        const legOffset = Math.sin(animationFrame * 0.3) * 5;
        const legOffset2 = Math.sin(animationFrame * 0.3 + Math.PI) * 5;
        
        // Body (oval)
        this.ctx.fillStyle = colorScheme.color;
        this.ctx.beginPath();
        this.ctx.ellipse(x + width * 0.5, y + height * 0.5, width * 0.3, height * 0.2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Long neck (positioned for facing right)
        this.ctx.fillStyle = colorScheme.color;
        this.ctx.fillRect(x + width * 0.65, y + height * 0.1, width * 0.12, height * 0.45);
        
        // Head (at the front/right)
        this.ctx.beginPath();
        this.ctx.ellipse(x + width * 0.71, y + height * 0.08, width * 0.12, height * 0.1, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Beak (pointing right)
        this.ctx.fillStyle = '#FFA500';
        this.ctx.fillRect(x + width * 0.83, y + height * 0.08, width * 0.08, height * 0.03);
        
        // Long animated legs (front leg)
        this.ctx.fillStyle = colorScheme.color;
        this.ctx.save();
        this.ctx.translate(x + width * 0.55, y + height * 0.65);
        this.ctx.rotate(legOffset * 0.1);
        this.ctx.fillRect(-width * 0.04, 0, width * 0.08, height * 0.35);
        this.ctx.restore();
        
        // Long animated legs (back leg)
        this.ctx.save();
        this.ctx.translate(x + width * 0.40, y + height * 0.65);
        this.ctx.rotate(legOffset2 * 0.1);
        this.ctx.fillRect(-width * 0.04, 0, width * 0.08, height * 0.35);
        this.ctx.restore();
        
        // Saddle
        this.ctx.fillStyle = colorScheme.saddle;
        this.ctx.fillRect(x + width * 0.35, y + height * 0.42, width * 0.3, height * 0.12);
        
        // Collar
        this.ctx.fillStyle = colorScheme.collar;
        this.ctx.fillRect(x + width * 0.65, y + height * 0.3, width * 0.12, height * 0.08);
        
        // Number badge
        const badgeSize = Math.min(width * 0.15, 20);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(x + width * 0.45, y + height * 0.45, badgeSize, badgeSize);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = `bold ${badgeSize * 0.7}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(number, x + width * 0.45 + badgeSize / 2, y + height * 0.45 + badgeSize / 2);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 215, b: 0 }; // Default to gold
    }

    drawText(text, x, y, size, color = '#FFFFFF') {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.font = `${size}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }

    drawRect(x, y, width, height, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
    }
}


