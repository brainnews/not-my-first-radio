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
        this.isReconnecting = false; // Track reconnection state
        
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

            .visualizer-controls {
                position: absolute;
                top: 50px;
                left: 20px;
                background: rgba(0, 0, 0, 0.7);
                padding: 15px;
                border-radius: 8px;
                color: white;
                z-index: 1000;
                min-width: 250px;
                backdrop-filter: blur(5px);
            }

            .visualizer-controls h3, .visualizer-controls h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.9);
            }

            .control-group {
                margin-bottom: 12px;
            }

            .control-group label {
                display: block;
                margin-bottom: 5px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
            }

            .control-group input[type="range"] {
                width: 100%;
                margin: 5px 0;
            }

            .control-group .value {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
                text-align: right;
            }

            .visualizer-controls-toggle {
                position: absolute;
                top: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                z-index: 1001;
                backdrop-filter: blur(5px);
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

        // Create controls toggle button
        const controlsToggle = document.createElement('button');
        controlsToggle.className = 'visualizer-controls-toggle';
        controlsToggle.innerHTML = '⚙️ Controls';
        this.container.appendChild(controlsToggle);

        // Create controls panel
        const controlsPanel = document.createElement('div');
        controlsPanel.className = 'visualizer-controls';
        controlsPanel.style.display = 'none';
        controlsPanel.innerHTML = `
            <div id="baroque-controls" class="style-controls">
                <h4>Baroque Flow Controls</h4>
                <div class="control-group">
                    <label>Particle Speed</label>
                    <input type="range" id="particle-speed" min="0.5" max="5" step="0.1" value="1">
                    <div class="value">1</div>
                </div>
                <div class="control-group">
                    <label>Particle Size</label>
                    <input type="range" id="particle-size" min="1" max="10" step="0.1" value="2">
                    <div class="value">2</div>
                </div>
                <div class="control-group">
                    <label>Flow Field Scale</label>
                    <input type="range" id="flow-scale" min="0.001" max="0.02" step="0.001" value="0.005">
                    <div class="value">0.005</div>
                </div>
                <div class="control-group">
                    <label style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">Trail Length <span style="font-size: 12px; color: #ff4444; margin-left: 4px;"><span class="material-symbols-rounded" style="font-size: 12px; transform: translateY(1px); ">warning</span> May cause lag</span></label>
                    <input type="range" id="trail-length" min="0" max="300" step="1" value="10">
                    <div class="value">10</div>
                </div>
            </div>
            <div id="perlin-controls" class="style-controls">
                <h4>Perlin Controls</h4>
                <div class="control-group">
                    <label>Noise Scale</label>
                    <input type="range" id="noise-scale" min="0.001" max="0.1" step="0.001" value="0.02">
                    <div class="value">0.02</div>
                </div>
                <div class="control-group">
                    <label>Noise Speed</label>
                    <input type="range" id="noise-speed" min="0" max="0.001" step="0.0001" value="0.0002">
                    <div class="value">0.0002</div>
                </div>
                <div class="control-group">
                    <label>Smoothness</label>
                    <input type="range" id="smoothness" min="0.01" max="0.5" step="0.01" value="0.1">
                    <div class="value">0.1</div>
                </div>
                <div class="control-group">
                    <label>Block Size</label>
                    <input type="range" id="block-size" min="4" max="32" step="2" value="16">
                    <div class="value">16</div>
                </div>
                <div class="control-group">
                    <label>Ripple Sensitivity</label>
                    <input type="range" id="ripple-sensitivity" min="20" max="100" step="1" value="50">
                    <div class="value">50</div>
                </div>
            </div>
        `;
        this.container.appendChild(controlsPanel);

        // Add controls toggle functionality
        controlsToggle.addEventListener('click', () => {
            controlsPanel.style.display = controlsPanel.style.display === 'none' ? 'block' : 'none';
        });

        // Add style selector event listener
        const styleSelect = document.getElementById('visualizer-style');
        styleSelect.addEventListener('change', (e) => {
            this.currentStyle = e.target.value;
            // Update visible controls based on selected style
            document.getElementById('baroque-controls').style.display = 
                this.currentStyle === 'baroque' ? 'block' : 'none';
            document.getElementById('perlin-controls').style.display = 
                this.currentStyle === 'perlin' ? 'block' : 'none';
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
            let blockSize = 16;
            let noiseZ = 0;
            let sourceNode = null;
            let lastNoiseValues = [];
            let interpolationFactor = 0.1;
            
            // Rain effect variables
            let ripples = [];
            let lastPercussionValue = 0;
            const maxRipples = 30;
            let percussionThreshold = 50;

            // Store control event listeners for cleanup
            const controlListeners = new Map();

            // Add control event listeners
            const controls = {
                // Baroque controls
                'particle-speed': (value) => { 
                    particles.forEach(particle => {
                        particle.maxSpeed = parseFloat(value);
                    });
                },
                'particle-size': (value) => {
                    particles.forEach(particle => {
                        particle.baseSize = parseFloat(value);
                    });
                },
                'flow-scale': (value) => {
                    particles.forEach(particle => {
                        particle.noiseScale = parseFloat(value);
                    });
                },
                'trail-length': (value) => {
                    const newLength = parseInt(value);
                    particles.forEach(particle => {
                        particle.trailLength = newLength;
                        // Trim trail if new length is shorter
                        while (particle.trail.length > newLength) {
                            particle.trail.pop();
                        }
                    });
                },
                // Perlin controls
                'noise-scale': (value) => { noiseScale = parseFloat(value); },
                'noise-speed': (value) => { noiseSpeed = parseFloat(value); },
                'smoothness': (value) => { interpolationFactor = parseFloat(value); },
                'block-size': (value) => { blockSize = parseInt(value); },
                'ripple-sensitivity': (value) => { percussionThreshold = parseInt(value); }
            };

            // Initialize controls with proper event listeners
            const initializeControls = () => {
                // Clean up existing listeners
                controlListeners.forEach((listener, input) => {
                    input.removeEventListener('input', listener);
                });
                controlListeners.clear();

                // Add new listeners
                Object.entries(controls).forEach(([id, callback]) => {
                    const input = document.getElementById(id);
                    if (input) {
                        const valueDisplay = input.nextElementSibling;
                        const listener = (e) => {
                            const value = e.target.value;
                            valueDisplay.textContent = value;
                            callback(value);
                        };
                        input.addEventListener('input', listener);
                        controlListeners.set(input, listener);
                    }
                });
            };

            // Initialize controls
            initializeControls();

            // Set initial control visibility
            document.getElementById('baroque-controls').style.display = 
                this.currentStyle === 'baroque' ? 'block' : 'none';
            document.getElementById('perlin-controls').style.display = 
                this.currentStyle === 'perlin' ? 'block' : 'none';
            
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
                            self.isReconnecting = false;
                            
                            // Attempt to reconnect if we haven't exceeded max attempts
                            if (reconnectAttempts < maxReconnectAttempts) {
                                reconnectAttempts++;
                                console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                                self.isReconnecting = true;
                                
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
                                self.isReconnecting = false;
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
                                self.isReconnecting = false;
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
                        self.isReconnecting = false;
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

                // Draw reconnection message if reconnecting
                if (self.isReconnecting) {
                    p.push();
                    p.fill(255);
                    p.noStroke();
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(14);
                    p.text('Reconnecting to stream...', p.width/2, p.height/2);
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
                }
                
                // Update and display ripples
                ripples = ripples.filter(ripple => {
                    let active = ripple.update();
                    if (active) {
                        ripple.display();
                    }
                    return active;
                });
                
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

        // Remove controls panel and toggle button
        const controlsPanel = document.querySelector('.visualizer-controls');
        const controlsToggle = document.querySelector('.visualizer-controls-toggle');
        if (controlsPanel) {
            controlsPanel.remove();
        }
        if (controlsToggle) {
            controlsToggle.remove();
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
        this.maxSpeed = 1;
        this.hue = p.random(360);
        this.size = p.random(2, 4);
        this.baseSize = this.size;
        this.noiseScale = 0.005;
        this.trailLength = 10;
        this.trail = [];
    }

    update(freq) {
        // Store current position in trail
        this.trail.unshift(this.pos.copy());
        
        // Limit trail length
        while (this.trail.length > this.trailLength) {
            this.trail.pop();
        }

        // Normalize frequency to 0-1 range
        let normalizedFreq = this.p.map(freq, 0, 255, 0, 1);
        
        // Create a more dynamic flow field based on frequency
        let angle = this.p.noise(
            this.pos.x * this.noiseScale, 
            this.pos.y * this.noiseScale, 
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
        
        // Draw trail
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const pos = this.trail[i];
            const alpha = this.p.map(i, 0, this.trail.length - 1, 0.7, 0);
            const size = this.p.map(i, 0, this.trail.length - 1, this.size, this.size * 0.5);
            this.p.fill(this.hue, 80, 100, alpha);
            this.p.ellipse(pos.x, pos.y, size, size);
        }
        
        // Draw current position
        this.p.fill(this.hue, 80, 100, 0.7);
        this.p.ellipse(this.pos.x, this.pos.y, this.size, this.size);
    }
}

export default AudioVisualizer; 