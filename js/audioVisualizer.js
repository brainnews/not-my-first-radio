// Remove the p5 import since we're using the global p5 object from CDN
class AudioVisualizer {
    constructor(audioElement, stationInfo) {
        this.audioElement = audioElement;
        this.stationInfo = stationInfo;
        this.p5Instance = null;
        this.isActive = false;
        this.container = document.getElementById('audio-visualizer');
        this.originalVolume = audioElement.volume;
        this.proxyAudio = null; // Store reference to proxy audio
        this.isLoading = true; // Track loading state
        this.currentStyle = 'baroque'; // Default style
        
        // Create a proxy URL for the audio stream
        const proxyUrl = new URL('https://visualizer-worker.miles-gilbert.workers.dev');
        proxyUrl.searchParams.set('url', audioElement.src);
        this.proxyAudioUrl = proxyUrl.toString();
        
        // Store the original source
        this.originalSrc = audioElement.src;

        // Add visualizer styles
        this.addStyles();
    }

    addStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .visualizer-style-selector {
                position: absolute;
                top: 20px;
                right: 70px;
                z-index: 1000;
            }

            .visualizer-style-selector select {
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .visualizer-style-selector select:hover {
                background: rgba(0, 0, 0, 0.8);
                border-color: rgba(255, 255, 255, 0.5);
            }

            .visualizer-style-selector select:focus {
                outline: none;
                border-color: rgba(255, 255, 255, 0.7);
                box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
            }
        `;
        document.head.appendChild(styleElement);
    }

    init() {
        // Show the container
        this.container.classList.remove('hidden');

        // Mute the original audio
        this.audioElement.volume = 0;

        // Create style selector
        const styleSelector = document.createElement('div');
        styleSelector.className = 'visualizer-style-selector';
        styleSelector.innerHTML = `
            <select id="visualizer-style">
                <option value="baroque">Baroque Flow</option>
                <option value="perlin">Perlin</option>
            </select>
        `;
        this.container.appendChild(styleSelector);

        // Add style selector event listener
        document.getElementById('visualizer-style').addEventListener('change', (e) => {
            this.currentStyle = e.target.value;
        });

        // Create p5 instance
        this.p5Instance = new p5((p) => {
            let fft;
            let particles = [];
            const numParticles = 100;
            let analyser;
            let source;
            let audioContext;
            const self = this;
            let noiseScale = 0.02;
            let noiseSpeed = 0;
            let colorBurst = 0;
            let lastBassValue = 0;
            const blockSize = 16;
            let noiseZ = 0;
            let sourceNode = null;
            let lastNoiseValues = [];
            let interpolationFactor = 0.1;
            
            // Rain effect variables
            let ripples = [];
            let lastPercussionValue = 0;
            const maxRipples = 30;
            
            class Ripple {
                constructor(x, y) {
                    this.x = x;
                    this.y = y;
                    this.radius = 0;
                    this.maxRadius = p.random(100, 200);
                    this.speed = p.random(6, 20);
                    this.alpha = 255;
                }
                
                update() {
                    this.radius += this.speed;
                    this.alpha = p.map(this.radius, 0, this.maxRadius, 255, 0);
                    return this.radius < this.maxRadius;
                }
                
                display() {
                    // Calculate the grid-aligned bounds of the ripple
                    const startX = Math.floor((this.x - this.radius) / blockSize) * blockSize;
                    const startY = Math.floor((this.y - this.radius) / blockSize) * blockSize;
                    const endX = Math.ceil((this.x + this.radius) / blockSize) * blockSize;
                    const endY = Math.ceil((this.y + this.radius) / blockSize) * blockSize;
                    
                    // Draw pixelated ripple
                    for (let x = startX; x < endX; x += blockSize) {
                        for (let y = startY; y < endY; y += blockSize) {
                            // Calculate distance from center to block center
                            const blockCenterX = x + blockSize / 2;
                            const blockCenterY = y + blockSize / 2;
                            const distance = Math.sqrt(
                                Math.pow(blockCenterX - this.x, 2) + 
                                Math.pow(blockCenterY - this.y, 2)
                            );
                            
                            // Check if this block is part of the ripple
                            if (Math.abs(distance - this.radius) < blockSize) {
                                p.fill(255, this.alpha);
                                p.noStroke();
                                p.rect(x, y, blockSize, blockSize);
                            }
                        }
                    }
                }
            }
            
            function smoothstep(edge0, edge1, x) {
                x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
                return x * x * (3 - 2 * x);
            }

            function lerp(a, b, t) {
                return a + (b - a) * t;
            }

            p.setup = () => {
                const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent('audio-visualizer');
                p.colorMode(p.HSB, 360, 100, 100, 1);
                p.pixelDensity(1);
                
                // Initialize FFT with lower smoothing for more responsiveness
                fft = new p5.FFT(0.9, 1024);
                
                // Initialize rain effect arrays
                ripples = [];
                lastPercussionValue = 0;
                
                console.log('Visualizer initialized with rain effect');
                
                // Get p5's audio context
                audioContext = p5.soundOut.audiocontext;
                
                // Resume the audio context
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        setupAudio();
                    }).catch(err => {
                        console.error('Error resuming audio context:', err);
                    });
                } else {
                    setupAudio();
                }
                
                function setupAudio() {
                    try {
                        // Create analyser node
                        analyser = audioContext.createAnalyser();
                        analyser.fftSize = 2048;
                        
                        // Create a new audio element for the proxy
                        self.proxyAudio = new Audio(self.proxyAudioUrl);
                        self.proxyAudio.crossOrigin = "anonymous";
                        self.proxyAudio.volume = self.originalVolume;
                        
                        let reconnectAttempts = 0;
                        const maxReconnectAttempts = 3;
                        
                        function handleError(err) {
                            console.error('Error loading proxy audio:', err);
                            self.isLoading = false;
                            
                            // Attempt to reconnect if we haven't exceeded max attempts
                            if (reconnectAttempts < maxReconnectAttempts) {
                                reconnectAttempts++;
                                console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                                
                                // Clean up existing audio
                                if (self.proxyAudio) {
                                    self.proxyAudio.removeEventListener('canplay', null);
                                    self.proxyAudio.removeEventListener('error', null);
                                    self.proxyAudio.pause();
                                    if (self.proxyAudio.sourceNode) {
                                        self.proxyAudio.sourceNode.disconnect();
                                    }
                                }
                                
                                // Wait a moment before retrying
                                setTimeout(() => {
                                    setupAudio();
                                }, 1000);
                            } else {
                                console.error('Max reconnection attempts reached');
                                // Restore original audio
                                self.audioElement.volume = self.originalVolume;
                            }
                        }
                        
                        // Wait for the proxy audio to be ready
                        self.proxyAudio.addEventListener('canplay', () => {
                            try {
                                // Disconnect existing source if it exists
                                if (sourceNode) {
                                    sourceNode.disconnect();
                                }
                                
                                // Create media element source
                                sourceNode = audioContext.createMediaElementSource(self.proxyAudio);
                                // Connect the nodes
                                sourceNode.connect(analyser);
                                analyser.connect(audioContext.destination);
                                // Connect the FFT to the analyser
                                fft.setInput(analyser);
                                // Start playing
                                self.proxyAudio.play().catch(err => {
                                    console.error('Error playing audio:', err);
                                    handleError(err);
                                });
                                // Set loading to false when audio is ready
                                self.isLoading = false;
                                // Reset reconnect attempts on successful connection
                                reconnectAttempts = 0;
                            } catch (err) {
                                console.error('Error setting up audio nodes:', err);
                                handleError(err);
                            }
                        });

                        self.proxyAudio.addEventListener('error', handleError);
                    } catch (err) {
                        console.error('Error in setupAudio:', err);
                        self.isLoading = false;
                        // Restore original audio
                        self.audioElement.volume = self.originalVolume;
                    }
                }
                
                // Create particles
                for (let i = 0; i < numParticles; i++) {
                    particles.push(new Particle(p));
                }
            };

            p.draw = () => {
                if (self.currentStyle === 'baroque') {
                    drawBaroque();
                } else if (self.currentStyle === 'perlin') {
                    drawPerlin();
                }

                // Draw loading indicator if still loading
                if (self.isLoading) {
                    p.push();
                    p.fill(255);
                    p.noStroke();
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(14);
                    p.text('Preparing visuals...', p.width/2, p.height/2);
                    p.pop();
                }

                // Draw station info
                p.fill(255);
                p.noStroke();
                p.textSize(16);
                p.textAlign(p.LEFT, p.BOTTOM);
                p.text('Now playing: ' + this.stationInfo.name, 40, p.height - 40);
            };

            function drawBaroque() {
                p.background(0, 0, 0, 0.1);
                
                // Get frequency data
                let spectrum = fft.analyze();
                
                // Draw particles
                particles.forEach((particle, i) => {
                    // Map the frequency index to focus on more audible frequencies
                    let freqIndex = Math.floor(p.map(i, 0, numParticles, 0, spectrum.length * 0.5));
                    let freq = spectrum[freqIndex];
                    // Increase the frequency sensitivity
                    freq = p.map(freq, 0, 255, 0, 255 * 2);
                    particle.update(freq);
                    particle.display();
                });
            }

            function drawPerlin() {
                p.background(0); // Clear background each frame
                
                // Get frequency data
                let spectrum = fft.analyze();
                let bass = fft.getEnergy("bass");
                let mid = fft.getEnergy("mid");
                let treble = fft.getEnergy("treble");
                
                // Draw Perlin noise background first
                p.loadPixels();
                
                // Smoother speed changes
                let targetSpeed = (mid + treble) * 0.00002;
                noiseSpeed = lerp(noiseSpeed, targetSpeed, 0.05);
                noiseZ += noiseSpeed;
                
                // Smoother scale changes
                let targetScale = p.map(treble, 0, 255, 0.02, 0.04);
                noiseScale = lerp(noiseScale, targetScale, 0.05);
                
                // Check for bass hits
                if (bass > 200 && bass > lastBassValue + 20) {
                    colorBurst = 1;
                }
                lastBassValue = bass;
                
                // Calculate number of blocks that fit on screen
                const blocksX = Math.ceil(p.width / blockSize);
                const blocksY = Math.ceil(p.height / blockSize);
                
                // Initialize lastNoiseValues if needed
                if (lastNoiseValues.length !== blocksX * blocksY) {
                    lastNoiseValues = new Array(blocksX * blocksY).fill(0);
                }
                
                // Pre-calculate block colors for better performance
                const blockColors = new Array(blocksX * blocksY);
                
                // Generate noise values for each block
                for (let bx = 0; bx < blocksX; bx++) {
                    for (let by = 0; by < blocksY; by++) {
                        const index = bx + by * blocksX;
                        
                        // Sample noise at block center
                        let noiseVal = p.noise(
                            (bx + 0.5) * noiseScale,
                            (by + 0.5) * noiseScale,
                            noiseZ
                        );
                        
                        // Apply smoothstep for more organic transitions
                        noiseVal = smoothstep(0.4, 0.6, noiseVal);
                        
                        // Interpolate with previous frame
                        noiseVal = lerp(lastNoiseValues[index], noiseVal, interpolationFactor);
                        lastNoiseValues[index] = noiseVal;
                        
                        // Threshold with slight smoothing
                        noiseVal = noiseVal > 0.5 ? 1 : 0;
                        
                        let color;
                        if (colorBurst > 0) {
                            let hue = (noiseVal * 360 + noiseZ * 30) % 360;
                            color = p.color(hue, 80, noiseVal * 100);
                        } else {
                            let val = noiseVal * 255;
                            color = p.color(val, val, val);
                        }
                        
                        blockColors[index] = color;
                    }
                }
                
                // Fill blocks with pre-calculated colors
                for (let bx = 0; bx < blocksX; bx++) {
                    for (let by = 0; by < blocksY; by++) {
                        const color = blockColors[bx + by * blocksX];
                        const r = p.red(color);
                        const g = p.green(color);
                        const b = p.blue(color);
                        
                        // Fill the block with pixels
                        for (let x = bx * blockSize; x < (bx + 1) * blockSize && x < p.width; x++) {
                            for (let y = by * blockSize; y < (by + 1) * blockSize && y < p.height; y++) {
                                let index = (x + y * p.width) * 4;
                                p.pixels[index] = r;
                                p.pixels[index + 1] = g;
                                p.pixels[index + 2] = b;
                                p.pixels[index + 3] = 255;
                            }
                        }
                    }
                }
                
                p.updatePixels();
                
                // Detect percussion using raw spectrum data
                // Focus on high frequencies (indices 100-200) for hi-hats and snares
                let percussion = 0;
                for (let i = 100; i < 200; i++) {
                    percussion += spectrum[i];
                }
                percussion = percussion / 100; // Average the values
                
                // Lower threshold and make detection more sensitive
                let percussionThreshold = 50; // Lowered threshold
                let percussionHit = percussion > percussionThreshold && percussion > lastPercussionValue + 5;
                lastPercussionValue = percussion;
                
                // Create ripples on percussion hits
                if (percussionHit && ripples.length < maxRipples) {
                    let numRipples = p.floor(p.map(percussion, percussionThreshold, 255, 1, 3));
                    for (let i = 0; i < numRipples; i++) {
                        ripples.push(new Ripple(
                            p.random(p.width),
                            p.random(p.height)
                        ));
                    }
                    console.log(`Created ${numRipples} ripples. Total: ${ripples.length}`);
                }
                
                // Update and display ripples
                ripples = ripples.filter(ripple => {
                    let active = ripple.update();
                    if (active) {
                        ripple.display();
                    }
                    return active;
                });
                
                // Draw debug info
                p.push();
                p.fill(255);
                p.noStroke();
                p.textSize(16);
                p.textAlign(p.LEFT, p.TOP);
                p.text(`Percussion: ${Math.round(percussion)}`, 20, 20);
                p.text(`Ripples: ${ripples.length}`, 20, 50);
                p.text(`Style: ${self.currentStyle}`, 20, 80);
                p.pop();
                
                // Fade color burst
                if (colorBurst > 0) {
                    colorBurst = Math.max(0, colorBurst - 0.02);
                }
            }

            p.windowResized = () => {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };
        });

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'visualizer-close-btn';
        closeBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';
        closeBtn.onclick = () => this.close();
        document.body.appendChild(closeBtn);

        this.isActive = true;
    }

    close() {
        if (this.p5Instance) {
            // Stop and clean up the proxy audio
            if (this.proxyAudio) {
                // Remove event listeners first
                this.proxyAudio.removeEventListener('canplay', null);
                this.proxyAudio.removeEventListener('error', null);
                
                // Stop the audio
                this.proxyAudio.pause();
                
                // Disconnect from audio context
                if (this.proxyAudio.sourceNode) {
                    this.proxyAudio.sourceNode.disconnect();
                }
                
                // Clear the audio element
                this.proxyAudio = null;
            }
            
            // Remove the p5 instance
            this.p5Instance.remove();
            this.p5Instance = null;
        }
        
        // Remove style selector
        const styleSelector = document.querySelector('.visualizer-style-selector');
        if (styleSelector) {
            styleSelector.remove();
        }
        
        // Restore original audio volume
        this.audioElement.volume = this.originalVolume;
        
        // Hide the container
        this.container.classList.add('hidden');
        
        // Remove close button
        const closeBtn = document.querySelector('.visualizer-close-btn');
        if (closeBtn) {
            closeBtn.remove();
        }

        this.isActive = false;
    }
}

// Particle class for the visualizer
class Particle {
    constructor(p) {
        this.p = p;
        this.pos = p.createVector(p.random(p.width), p.random(p.height));
        this.vel = p.createVector(0, 0);
        this.acc = p.createVector(0, 0);
        this.maxSpeed = 1; // Increased max speed
        this.hue = p.random(360);
        this.size = p.random(2, 4);
        this.baseSize = this.size; // Store base size
    }

    update(freq) {
        // Normalize frequency to 0-1 range
        let normalizedFreq = this.p.map(freq, 0, 255, 0, 1);
        
        // Create a more dynamic flow field based on frequency
        let noiseScale = 0.005;
        let angle = this.p.noise(
            this.pos.x * noiseScale, 
            this.pos.y * noiseScale, 
            this.p.frameCount * 0.01
        ) * this.p.TWO_PI * 2;
        
        this.acc = this.p.createVector(this.p.cos(angle), this.p.sin(angle));
        
        // Scale acceleration based on frequency
        let freqScale = this.p.map(normalizedFreq, 0, 1, 0.5, 3);
        this.acc.mult(freqScale);
        
        // Add some randomness based on frequency
        if (normalizedFreq > 0.5) {
            this.acc.add(this.p.createVector(
                this.p.random(-0.5, 0.5),
                this.p.random(-0.5, 0.5)
            ));
        }
        
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);

        // Wrap around edges
        if (this.pos.x < 0) this.pos.x = this.p.width;
        if (this.pos.x > this.p.width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = this.p.height;
        if (this.pos.y > this.p.height) this.pos.y = 0;

        // Update size based on frequency with more dramatic scaling
        this.size = this.p.map(normalizedFreq, 0, 1, this.baseSize, this.baseSize * 30);
    }

    display() {
        this.p.noStroke();
        // Make particles more visible with higher opacity
        this.p.fill(this.hue, 80, 100, 0.7);
        this.p.ellipse(this.pos.x, this.pos.y, this.size, this.size);
    }
}

export default AudioVisualizer; 