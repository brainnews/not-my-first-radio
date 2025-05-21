// Remove the p5 import since we're using the global p5 object from CDN
class AudioVisualizer {
    constructor(audioElement, stationInfo) {
        this.audioElement = audioElement;
        this.stationInfo = stationInfo;
        this.p5Instance = null;
        this.isActive = false;
        this.container = document.getElementById('audio-visualizer');
        this.originalVolume = audioElement.volume;
        this.proxyAudio = null;
        this.isLoading = true;
        this.currentStyle = 'classical';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 2000; // 2 seconds
        
        // Create a proxy URL for the audio stream
        const proxyUrl = new URL('https://visualizer-worker.miles-gilbert.workers.dev');
        proxyUrl.searchParams.set('url', audioElement.src);
        this.proxyAudioUrl = proxyUrl.toString();
        
        // Store the original source
        this.originalSrc = audioElement.src;
    }

    init() {
        // Show the container
        this.container.classList.remove('hidden');

        // Prevent scrolling
        document.body.style.overflow = 'hidden';

        // Mute the original audio
        this.audioElement.volume = 0;

        // Create p5 instance
        this.p5Instance = new p5((p) => {
            let fft;
            let particles = [];
            const numParticles = 100;
            let analyser;
            let source;
            let audioContext;
            const self = this;

            // Animation styles
            const styles = {
                classical: {
                    name: 'Classical',
                    description: 'Elegant flowing particles',
                    createParticles: () => {
                        particles = [];
                        for (let i = 0; i < numParticles; i++) {
                            particles.push(new ClassicalParticle(p));
                        }
                    }
                },
                dnb: {
                    name: 'Drum & Bass',
                    description: 'Retro 2000s style',
                    createParticles: () => {
                        particles = [];
                        for (let i = 0; i < numParticles; i++) {
                            particles.push(new DnBParticle(p));
                        }
                    }
                }
            };

            p.setup = () => {
                const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
                canvas.parent('audio-visualizer');
                p.colorMode(p.HSB, 360, 100, 100, 1);
                
                // Initialize FFT with lower smoothing for more responsiveness
                fft = new p5.FFT(0.9, 1024);
                
                // Get p5's audio context
                audioContext = p5.soundOut.audiocontext;
                
                // Create style selector
                createStyleSelector();
                
                // Initialize particles based on current style
                styles[self.currentStyle].createParticles();
                
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
                
                function createStyleSelector() {
                    const styleContainer = document.createElement('div');
                    styleContainer.className = 'style-selector';
                    styleContainer.style.cssText = `
                        position: fixed;
                        top: 60px;
                        right: 20px;
                        background: rgba(0, 0, 0, 0.7);
                        padding: 10px;
                        border-radius: 8px;
                        z-index: 1000;
                        pointer-events: auto;
                    `;

                    Object.entries(styles).forEach(([key, style]) => {
                        const button = document.createElement('button');
                        button.className = 'style-button';
                        button.textContent = style.name;
                        button.style.cssText = `
                            display: block;
                            width: 100%;
                            padding: 8px 12px;
                            margin: 4px 0;
                            background: ${key === self.currentStyle ? '#4a90e2' : '#2c3e50'};
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            transition: background 0.3s;
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 14px;
                        `;
                        button.onclick = () => {
                            self.currentStyle = key;
                            styles[key].createParticles();
                            // Update button styles
                            styleContainer.querySelectorAll('.style-button').forEach(btn => {
                                btn.style.background = '#2c3e50';
                            });
                            button.style.background = '#4a90e2';
                        };
                        styleContainer.appendChild(button);
                    });

                    document.body.appendChild(styleContainer);
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
                        
                        // Wait for the proxy audio to be ready
                        self.proxyAudio.addEventListener('canplay', () => {
                            try {
                                // Create media element source
                                source = audioContext.createMediaElementSource(self.proxyAudio);
                                // Connect the nodes
                                source.connect(analyser);
                                analyser.connect(audioContext.destination);
                                // Connect the FFT to the analyser
                                fft.setInput(analyser);
                                // Start playing
                                self.proxyAudio.play();
                                // Set loading to false when audio is ready
                                self.isLoading = false;
                                // Reset reconnect attempts on successful connection
                                self.reconnectAttempts = 0;
                            } catch (err) {
                                console.error('Error setting up audio nodes:', err);
                                handleAudioError();
                            }
                        });

                        self.proxyAudio.addEventListener('error', (err) => {
                            console.error('Error loading proxy audio:', err);
                            handleAudioError();
                        });

                        // Add ended event listener to detect when the stream ends
                        self.proxyAudio.addEventListener('ended', () => {
                            console.log('Audio stream ended, attempting to reconnect...');
                            handleAudioError();
                        });

                        function handleAudioError() {
                            if (self.reconnectAttempts < self.maxReconnectAttempts) {
                                self.reconnectAttempts++;
                                console.log(`Attempting to reconnect (${self.reconnectAttempts}/${self.maxReconnectAttempts})...`);
                                
                                // Clean up existing audio
                                if (self.proxyAudio) {
                                    self.proxyAudio.pause();
                                    if (self.proxyAudio.sourceNode) {
                                        self.proxyAudio.sourceNode.disconnect();
                                    }
                                }
                                
                                // Try to reconnect after delay
                                setTimeout(() => {
                                    if (self.isActive) { // Only reconnect if visualizer is still active
                                        setupAudio();
                                    }
                                }, self.reconnectDelay);
                            } else {
                                console.error('Max reconnection attempts reached');
                                // Restore original audio if reconnection fails
                                self.audioElement.volume = self.originalVolume;
                                self.close();
                            }
                        }
                    } catch (err) {
                        console.error('Error in setupAudio:', err);
                        self.isLoading = false;
                    }
                }
            };

            p.draw = () => {
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

                // Draw loading indicator if still loading
                if (self.isLoading) {
                    p.push();
                    p.fill(255);
                    p.noStroke();
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(14);
                    p.text('Preparing visuals...', 0, 0);
                    p.pop();
                }

                // Draw station info
                p.push();
                p.fill(255);
                p.noStroke();
                p.textSize(16);
                p.textAlign(p.LEFT, p.BOTTOM);
                p.text('Now playing: ' + this.stationInfo.name, -p.width/2 + 40, p.height/2 - 40);
                p.pop();
            };

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
                this.proxyAudio.removeEventListener('ended', null);
                
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
        const styleSelector = document.querySelector('.style-selector');
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

        // Restore scrolling
        document.body.style.overflow = '';

        this.isActive = false;
    }
}

// Base particle class
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
    }

    update(freq) {
        // To be implemented by subclasses
    }

    display() {
        // To be implemented by subclasses
    }
}

// Classical style particle
class ClassicalParticle extends Particle {
    constructor(p) {
        super(p);
        // Initialize position in WEBGL coordinate system (centered)
        this.pos = p.createVector(
            p.random(-p.width/2, p.width/2),
            p.random(-p.height/2, p.height/2)
        );
        this.vel = p.createVector(0, 0);
        this.acc = p.createVector(0, 0);
        this.maxSpeed = 1.0; // Reduced to prevent flickering
        this.hue = p.random(360);
        this.size = p.random(2, 4);
        this.baseSize = this.size;
        this.rotation = p.random(p.TWO_PI);
        this.targetRotation = this.rotation;
        this.prevPos = this.pos.copy();
        this.smoothFactor = 0.25; // Balanced smoothness
        this.maxAcc = 0.5; // Limit maximum acceleration
    }

    update(freq) {
        // Store previous position for interpolation
        this.prevPos = this.pos.copy();
        
        // Normalize frequency to 0-1 range
        let normalizedFreq = this.p.map(freq, 0, 255, 0, 1);
        
        // Create a more dynamic flow field based on frequency
        let noiseScale = 0.003;
        let angle = this.p.noise(
            (this.pos.x + this.p.width/2) * noiseScale, 
            (this.pos.y + this.p.height/2) * noiseScale, 
            this.p.frameCount * 0.005
        ) * this.p.TWO_PI * 2;
        
        // Calculate target acceleration
        let targetAcc = this.p.createVector(this.p.cos(angle), this.p.sin(angle));
        
        // Scale acceleration based on frequency
        let freqScale = this.p.map(normalizedFreq, 0, 1, 0.3, 1.5); // Reduced range for stability
        targetAcc.mult(freqScale);
        
        // Limit maximum acceleration
        if (targetAcc.mag() > this.maxAcc) {
            targetAcc.normalize().mult(this.maxAcc);
        }
        
        // Smoothly interpolate acceleration
        this.acc.lerp(targetAcc, 0.15); // Reduced for smoother changes
        
        // Add subtle randomness based on frequency
        if (normalizedFreq > 0.5) {
            let randomAcc = this.p.createVector(
                this.p.random(-0.2, 0.2),
                this.p.random(-0.2, 0.2)
            );
            // Limit random acceleration
            if (randomAcc.mag() > this.maxAcc * 0.5) {
                randomAcc.normalize().mult(this.maxAcc * 0.5);
            }
            this.acc.add(randomAcc);
        }
        
        // Update velocity with smoothing
        this.vel.add(this.acc);
        
        // Limit velocity
        if (this.vel.mag() > this.maxSpeed) {
            this.vel.normalize().mult(this.maxSpeed);
        }
        
        // Smooth velocity changes
        this.vel.mult(0.97); // Increased damping for stability
        
        // Update position with bounds checking
        let newPos = this.pos.copy().add(this.vel);
        
        // Clamp position to prevent sudden jumps
        newPos.x = this.p.constrain(newPos.x, -this.p.width/2, this.p.width/2);
        newPos.y = this.p.constrain(newPos.y, -this.p.height/2, this.p.height/2);
        
        // Wrap around edges smoothly
        if (newPos.x < -this.p.width/2) newPos.x = this.p.width/2;
        if (newPos.x > this.p.width/2) newPos.x = -this.p.width/2;
        if (newPos.y < -this.p.height/2) newPos.y = this.p.height/2;
        if (newPos.y > this.p.height/2) newPos.y = -this.p.height/2;
        
        this.pos = newPos;

        // Update size based on frequency with smoothing
        let targetSize = this.p.map(normalizedFreq, 0, 1, this.baseSize, this.baseSize * 25); // Reduced max size
        this.size = this.p.lerp(this.size, targetSize, 0.15); // Reduced for smoother size changes
        
        // Smooth rotation based on movement
        this.targetRotation += this.vel.mag() * 0.006; // Reduced rotation speed
        this.rotation = this.p.lerp(this.rotation, this.targetRotation, 0.15); // Reduced for smoother rotation
    }

    display() {
        this.p.push();
        this.p.noStroke();
        this.p.fill(this.hue, 80, 100, 0.7);
        
        // Interpolate position for smoother movement
        let displayPos = this.p.createVector(
            this.p.lerp(this.prevPos.x, this.pos.x, this.smoothFactor),
            this.p.lerp(this.prevPos.y, this.pos.y, this.smoothFactor)
        );
        
        this.p.translate(displayPos.x, displayPos.y);
        this.p.rotateZ(this.rotation);
        
        // Draw a flat plane instead of a sphere
        this.p.plane(this.size, this.size);
        
        this.p.pop();
    }
}

// DnB style particle
class DnBParticle extends Particle {
    constructor(p) {
        super(p);
        this.p = p;
        this.type = p.random() < 0.2 ? 'planet' : 'star'; // 20% chance of being a planet
        this.pos = p.createVector(
            p.random(-p.width/2, p.width/2),
            p.random(-p.height/2, p.height/2),
            p.random(-1000, -100) // Start behind the camera
        );
        this.vel = p.createVector(0, 0, p.random(5, 15)); // Move towards camera
        this.rotationSpeed = p.random(-0.02, 0.02);
        this.rotation = p.createVector(
            p.random(p.TWO_PI),
            p.random(p.TWO_PI),
            p.random(p.TWO_PI)
        );
        
        if (this.type === 'planet') {
            this.size = p.random(30, 60);
            this.color = p.color(
                p.random(180, 220), // Blue-ish hue
                p.random(60, 80),   // Moderate saturation
                p.random(70, 90)    // High brightness
            );
            this.rings = p.random() < 0.3; // 30% chance of having rings
            this.ringSize = this.size * 1.5;
        } else {
            this.size = p.random(2, 4);
            this.color = p.color(
                p.random(200, 240), // Blue-white hue
                p.random(70, 90),   // High saturation
                p.random(80, 100)   // Very high brightness
            );
            this.sparkle = p.random(0.5, 1.5); // Sparkle intensity
        }
    }

    update(freq) {
        // Normalize frequency to 0-1 range
        let normalizedFreq = this.p.map(freq, 0, 255, 0, 1);
        
        // Update position
        this.pos.add(this.vel);
        
        // Update rotation
        this.rotation.x += this.rotationSpeed;
        this.rotation.y += this.rotationSpeed;
        this.rotation.z += this.rotationSpeed;
        
        // Speed up based on frequency
        this.vel.z = this.p.map(normalizedFreq, 0, 1, 5, 20);
        
        // Reset position if object moves past camera
        if (this.pos.z > 100) {
            this.pos.z = -1000;
            this.pos.x = this.p.random(-this.p.width/2, this.p.width/2);
            this.pos.y = this.p.random(-this.p.height/2, this.p.height/2);
        }
        
        // Update star sparkle
        if (this.type === 'star') {
            this.sparkle = this.p.map(normalizedFreq, 0, 1, 0.5, 2);
        }
    }

    display() {
        this.p.push();
        
        // Move to object position
        this.p.translate(this.pos.x, this.pos.y, this.pos.z);
        
        // Apply rotation
        this.p.rotateX(this.rotation.x);
        this.p.rotateY(this.rotation.y);
        this.p.rotateZ(this.rotation.z);
        
        if (this.type === 'planet') {
            // Draw planet
            this.p.noStroke();
            this.p.fill(this.color);
            this.p.sphere(this.size);
            
            // Draw rings if planet has them
            if (this.rings) {
                this.p.push();
                this.p.rotateX(this.p.PI/2);
                this.p.noFill();
                this.p.stroke(this.color);
                this.p.strokeWeight(2);
                this.p.ellipse(0, 0, this.ringSize, this.ringSize * 0.2);
                this.p.pop();
            }
            
            // Add glow effect
            this.p.push();
            this.p.noStroke();
            this.p.fill(this.p.hue(this.color), this.p.saturation(this.color), this.p.brightness(this.color), 0.2);
            this.p.sphere(this.size * 1.5);
            this.p.pop();
        } else {
            // Draw star
            this.p.noStroke();
            this.p.fill(this.color);
            this.p.sphere(this.size);
            
            // Add sparkle effect
            if (this.sparkle > 1) {
                this.p.push();
                this.p.noStroke();
                this.p.fill(this.p.hue(this.color), this.p.saturation(this.color), this.p.brightness(this.color), 0.3);
                this.p.sphere(this.size * this.sparkle);
                this.p.pop();
            }
        }
        
        this.p.pop();
    }
}

export default AudioVisualizer; 