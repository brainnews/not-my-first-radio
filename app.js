// Austin coordinates (approximately downtown)
const AUSTIN_COORDS = {
    latitude: 30.2672,
    longitude: -97.7431
};

// Radius in kilometers (approximately 50 miles)
const RADIUS_KM = 80;

// Theme handling
const themeSwitcher = document.querySelector('.theme-switcher');
const themeButtons = document.querySelectorAll('.theme-btn');
const STORAGE_KEY = 'radio-theme';

// Set initial theme from localStorage or system preference
function setInitialTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        });
    } else {
        // Default to system theme
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', 'system');
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === 'system');
        });
    }
}

// Handle theme switching
themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const theme = button.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn === button);
        });
    });
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (document.documentElement.getAttribute('data-theme') === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
});

// Initialize theme
setInitialTheme();

// Settings panel functionality
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettingsBtn = document.getElementById('close-settings');
const exportDataBtn = document.getElementById('export-data');
const importFileInput = document.getElementById('import-file');
const clearStationsBtn = document.getElementById('clear-stations');

// Open settings panel
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
    settingsOverlay.classList.remove('hidden');
    // Use setTimeout to ensure the transitions work properly
    setTimeout(() => {
        settingsPanel.classList.add('visible');
        settingsOverlay.classList.add('visible');
    }, 10);
});

// Close settings panel when clicking close button or overlay
function closeSettingsPanel() {
    settingsPanel.classList.remove('visible');
    settingsOverlay.classList.remove('visible');
    // Wait for transitions to complete before hiding
    setTimeout(() => {
        settingsPanel.classList.add('hidden');
        settingsOverlay.classList.add('hidden');
    }, 300);
}

closeSettingsBtn.addEventListener('click', closeSettingsPanel);
settingsOverlay.addEventListener('click', closeSettingsPanel);

// Handle data export
exportDataBtn.addEventListener('click', () => {
    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        showNotification('No stations to export.', 'warning');
        return;
    }

    try {
        const data = {
            stations: radioPlayer.stations,
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'radio-stations.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Stations exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting stations:', error);
        showNotification('Error exporting stations. Please try again.', 'error');
    }
});

// Handle data import
importFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate imported data
            if (!data || !data.stations || !Array.isArray(data.stations)) {
                showNotification('Invalid data format.', 'error');
                return;
            }
            
            if (data.stations.length === 0) {
                showNotification('No stations found in the imported file.', 'warning');
                return;
            }
            
            // Confirm overwrite or merge
            const importOption = await showConfirmationModal({
                title: 'Import Stations',
                message: `Found ${data.stations.length} stations in the imported file. Do you want to replace your current stations?`,
                confirmText: 'Replace',
                danger: true
            });
            
            if (importOption === null) return;
            
            if (importOption) {
                radioPlayer.stations = data.stations;
            } else {
                // Merge stations, avoiding duplicates
                const existingUrls = radioPlayer.stations.map(s => s.url);
                for (const station of data.stations) {
                    if (!existingUrls.includes(station.url)) {
                        radioPlayer.stations.push(station);
                        existingUrls.push(station.url);
                    }
                }
            }
            
            // Save and display the new stations
            radioPlayer.saveStations();
            radioPlayer.displayStations();
            
            showNotification(`Import successful! You now have ${radioPlayer.stations.length} stations.`, 'success');
        } catch (error) {
            console.error('Error importing stations:', error);
            showNotification('Error importing stations. The file may be invalid or corrupted.', 'error');
        }
        
        // Reset the file input
        event.target.value = '';
    };
    
    reader.readAsText(file);
});

// Handle clear all stations
clearStationsBtn.addEventListener('click', async () => {
    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        showNotification('No stations to clear.', 'warning');
        return;
    }
    
    const modal = document.querySelector('.confirmation-modal');
    const content = modal.querySelector('.confirmation-content');
    const header = content.querySelector('.confirmation-header h3');
    const body = content.querySelector('.confirmation-body');
    const cancelBtn = content.querySelector('.confirmation-btn.cancel');
    const confirmBtn = content.querySelector('.confirmation-btn.confirm');
    
    // Set modal content
    header.textContent = 'Clear All Stations';
    body.textContent = `Are you sure you want to remove all ${radioPlayer.stations.length} stations? This action cannot be undone.`;
    confirmBtn.textContent = 'Clear All';
    confirmBtn.className = 'confirmation-btn confirm danger';
    
    // Show modal
    modal.classList.add('visible');
    
    // Return a promise that resolves with the user's choice
    const confirmed = await new Promise((resolve) => {
        const handleChoice = (choice) => {
            modal.classList.remove('visible');
            resolve(choice);
            
            // Clean up event listeners
            cancelBtn.removeEventListener('click', cancelHandler);
            confirmBtn.removeEventListener('click', confirmHandler);
        };
        
        const cancelHandler = () => handleChoice(false);
        const confirmHandler = () => handleChoice(true);
        
        // Add event listeners
        cancelBtn.addEventListener('click', cancelHandler);
        confirmBtn.addEventListener('click', confirmHandler);
    });
    
    if (confirmed) {
        // If currently playing, stop playback
        if (radioPlayer.isPlaying) {
            radioPlayer.audio.pause();
            radioPlayer.isPlaying = false;
            radioPlayer.currentStation = null;
            radioPlayer.updateUI();
        }
        
        // Clear stations
        radioPlayer.stations = [];
        radioPlayer.saveStations();
        radioPlayer.displayStations();
        
        showNotification('All stations have been removed.', 'success');
        
        // Close settings panel
        closeSettingsPanel();
    }
});

// Function to validate stream URL
function isValidStreamUrl(url) {
    // Check if URL is valid
    try {
        new URL(url);
    } catch (e) {
        return false;
    }

    // Check for supported stream formats and protocols
    const supportedFormats = [
        '.mp3',
        '.aac',
        '.m3u',
        '.m3u8',
        '.pls',
        '.xspf',
        'stream',
        'listen',
        'radio',
        'icecast',
        'shoutcast'
    ];

    // Check for unsupported formats or protocols
    const unsupportedFormats = [
        '.wma',
        '.wmv',
        '.asx',
        '.ram',
        '.rm',
        '.ra',
        '.qt',
        '.mov',
        '.avi',
        'rtsp://',
        'rtmp://',
        'mms://',
        'pnm://',
        '.asf',
        '.wax',
        '.wvx',
        '.wmx',
        '.wvx'
    ];

    const lowerUrl = url.toLowerCase();

    // Check for unsupported formats first
    if (unsupportedFormats.some(format => lowerUrl.includes(format))) {
        return false;
    }

    // Check for supported formats
    const hasSupportedFormat = supportedFormats.some(format => lowerUrl.includes(format));

    // Additional checks for common stream URL patterns
    const hasStreamPattern = /\/stream|\/listen|\/radio|\/live|\/broadcast/i.test(lowerUrl);
    const hasAudioExtension = /\.(mp3|aac|m3u|m3u8|pls|xspf)$/i.test(lowerUrl);
    const hasStreamPort = /:\d{4,5}\//.test(lowerUrl); // Common streaming ports

    // URL must have at least one of these characteristics to be considered valid
    return hasSupportedFormat || hasStreamPattern || hasAudioExtension || hasStreamPort;
}

// Add a function to test the stream before adding
async function testStream(url) {
    return new Promise((resolve) => {
        const audio = new Audio();
        let timeout = setTimeout(() => {
            audio.remove();
            resolve(false);
        }, 5000); // 5 second timeout

        audio.addEventListener('canplay', () => {
            clearTimeout(timeout);
            audio.remove();
            resolve(true);
        });

        audio.addEventListener('error', () => {
            clearTimeout(timeout);
            audio.remove();
            resolve(false);
        });

        audio.src = url;
    });
}

class RadioPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentStation = null;
        this.stations = this.loadStations();
        this.isPlaying = false;
        this.isEditMode = false;
        this.stationLists = this.loadStationLists();

        // DOM elements
        this.playPauseBtn = document.getElementById('play-pause');
        this.volumeSlider = document.getElementById('volume');
        this.stationName = document.getElementById('station-name');
        this.stationDetails = document.getElementById('station-details');
        this.stationsContainer = document.getElementById('stations');
        this.editBtn = document.getElementById('edit-stations');

        // Event listeners
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.audio.addEventListener('ended', () => this.handleStreamEnd());
        this.editBtn.addEventListener('click', () => this.toggleEditMode());

        // Add event listener for clear shared stations button
        document.getElementById('clear-shared-stations').addEventListener('click', async () => {
            if (!this.stationLists || this.stationLists.length === 0) {
                showNotification('No shared stations to clear.', 'warning');
                return;
            }
            
            const confirmed = await showConfirmationModal({
                title: 'Clear All Shared Stations',
                message: `Are you sure you want to remove all ${this.stationLists.length} shared station lists? This action cannot be undone.`,
                confirmText: 'Clear All',
                danger: true
            });
            
            if (confirmed) {
                // Clear all shared station lists
                this.stationLists = [];
                this.saveStationLists();
                this.displayStationLists();
                
                showNotification('All shared stations have been removed.', 'success');
            }
        });

        // Display initial stations and station lists
        this.displayStations();
        this.displayStationLists();
    }

    // Load stations from localStorage
    loadStations() {
        try {
            const savedStations = localStorage.getItem('radio-stations');
            if (savedStations) {
                const parsedStations = JSON.parse(savedStations);
                // Validate the parsed data
                if (Array.isArray(parsedStations) && parsedStations.every(station => 
                    station && typeof station === 'object' && 
                    station.name && station.url
                )) {
                    return parsedStations;
                }
            }
            return [];
        } catch (error) {
            console.error('Error loading stations from localStorage:', error);
            return [];
        }
    }

    // Save stations to localStorage
    saveStations() {
        console.log('Saving stations:', this.stations);
        try {
            localStorage.setItem('radio-stations', JSON.stringify(this.stations));
        } catch (error) {
            console.error('Error saving stations to localStorage:', error);
        }
    }

    // Display stations in the UI
    displayStations() {
        if (this.stations.length === 0) {
            this.stationsContainer.innerHTML = '<p class="no-stations">No stations added yet. Search for stations above to add them to your list.</p>';
            return;
        }

        this.stationsContainer.innerHTML = this.stations.map(station => `
            <div class="station-card" data-url="${station.url}">
                <div class="station-info">
                    <div class="station-favicon">
                        ${station.favicon ? 
                            `<img src="${station.favicon}" alt="${station.name} logo" onerror="this.outerHTML='<span class=\\'material-symbols-rounded\\'>radio</span>'">` : 
                            `<span class="material-symbols-rounded">radio</span>`
                        }
                    </div>
                    <div class="station-details">
                        <h3>${station.name}</h3>
                        <div class="station-meta">
                            ${station.bitrate ? `<span><span class="material-symbols-rounded">radio</span>${station.bitrate}kbps</span>` : ''}
                            ${station.countrycode ? `<span><span class="material-symbols-rounded">public</span>${station.countrycode}</span>` : ''}
                            ${station.votes ? `<span><span class="material-symbols-rounded">local_fire_department</span>${station.votes}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="station-controls">
                    ${this.currentStation && this.currentStation.url === station.url && this.isPlaying ? 
                        `<button class="stop-btn">
                            <span class="material-symbols-rounded">stop</span>
                        </button>` : 
                        `<button class="play-btn">
                            <span class="material-symbols-rounded">play_arrow</span>
                        </button>`
                    }
                    <button class="remove-btn">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        this.addStationEventListeners();
    }

    addStationEventListeners() {
        // Add event listeners to main stations
        const mainStationCards = this.stationsContainer.querySelectorAll('.station-card');
        mainStationCards.forEach(card => {
            const url = card.dataset.url;
            
            // Play or stop button
            const playControl = card.querySelector('.play-btn, .stop-btn');
            if (playControl) {
                playControl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const station = this.stations.find(s => s.url === url);
                    if (station) {
                        if (this.currentStation && this.currentStation.url === url && this.isPlaying) {
                            // If clicking the stop button of the currently playing station
                            this.audio.pause();
                            this.isPlaying = false;
                            this.currentStation = null;
                            this.updateUI();
                            this.displayStations();
                        } else {
                            // If clicking the play button
                            this.playStation(station);
                        }
                    }
                });
            }

            // Remove button
            const removeBtn = card.querySelector('.remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const station = this.stations.find(s => s.url === url);
                    if (!station) return;

                    const confirmed = await showConfirmationModal({
                        title: 'Remove Station',
                        message: `Are you sure you want to remove ${station.name} from your list?`,
                        confirmText: 'Remove',
                        danger: true
                    });

                    if (confirmed) {
                        this.removeStation(url);
                    }
                });
            }
        });

        // Add event listeners to list stations
        const listStationCards = document.querySelectorAll('.list-stations .station-card');
        listStationCards.forEach(card => {
            const playBtn = card.querySelector('.play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const stationName = card.querySelector('h3').textContent;
                    const station = this.stationLists.flatMap(list => list.stations)
                        .find(s => s.name === stationName);
                    if (station) {
                        this.playStation(station);
                    }
                });
            }
        });
    }

    playStation(station) {
        if (!station) {
            console.error('No station provided');
            return;
        }

        // Validate URL first
        if (!isValidStreamUrl(station.url)) {
            showNotification('This station\'s stream URL is not supported. Please try another station.', 'error');
            return;
        }

        // Ensure we have a valid URL
        const streamUrl = station.url;
        if (!streamUrl) {
            console.error('No stream URL found for station:', station.name);
            this.stationDetails.textContent = 'Error: No stream URL available';
            return;
        }

        this.currentStation = station;
        this.audio.src = streamUrl;
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                this.updateUI();
                this.displayStations(); // Refresh the stations list
            })
            .catch(error => {
                console.error('Error playing station:', error);
                if (error.name === 'NotSupportedError') {
                    this.stationDetails.textContent = 'Error: Stream format not supported';
                } else {
                    this.stationDetails.textContent = 'Error playing station. Please try another one.';
                }
            });
    }

    togglePlay() {
        if (!this.currentStation) {
            // If no station is selected, ensure audio is stopped
            this.audio.pause();
            this.isPlaying = false;
            this.updateUI();
            this.displayStations();
            return;
        }

        // Toggle the playing state first
        this.isPlaying = !this.isPlaying;

        if (this.isPlaying) {
            this.audio.play()
                .then(() => {
                    this.updateUI();
                    this.displayStations();
                })
                .catch(error => {
                    console.error('Error playing station:', error);
                    this.isPlaying = false; // Reset the state if play failed
                    this.stationDetails.textContent = 'Error playing station. Please try another one.';
                    this.updateUI();
                    this.displayStations();
                });
        } else {
            this.audio.pause();
            this.updateUI();
            this.displayStations();
        }
    }

    setVolume(value) {
        this.audio.volume = value / 100;
    }

    handleStreamEnd() {
        this.isPlaying = false;
        this.updateUI();
    }

    updateUI() {
        const currentFavicon = document.getElementById('current-favicon');
        const stationName = document.getElementById('station-name');
        const stationDetails = document.getElementById('station-details');
        const playPauseBtn = document.getElementById('play-pause');
        const playPauseIcon = playPauseBtn.querySelector('.material-symbols-rounded');
        
        if (this.currentStation) {
            // Update station name
            stationName.textContent = this.currentStation.name;
            
            // Update station details (bitrate, country, etc.)
            const details = [];
            if (this.currentStation.bitrate) {
                details.push(`${this.currentStation.bitrate}kbps`);
            }
            if (this.currentStation.countrycode) {
                details.push(this.currentStation.countrycode);
            }
            if (this.currentStation.tags) {
                details.push(this.currentStation.tags.split(',').slice(0, 2).join(', '));
            }
            stationDetails.textContent = details.join(' • ') || 'No details available';
            
            // Update favicon
            if (this.currentStation.favicon) {
                currentFavicon.src = this.currentStation.favicon;
                currentFavicon.style.display = 'block';
                currentFavicon.onerror = () => {
                    currentFavicon.style.display = 'none';
                };
            } else {
                currentFavicon.style.display = 'none';
            }
            
            // Update play/pause icon
            if (playPauseIcon) {
                playPauseIcon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
            }
        } else {
            // Reset UI when no station is selected
            stationName.textContent = 'Select a station';
            stationDetails.textContent = '';
            currentFavicon.style.display = 'none';
            if (playPauseIcon) {
                playPauseIcon.textContent = 'play_arrow';
            }
        }
    }

    // Add toggleEditMode method
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.editBtn.classList.toggle('active');
        this.stationsContainer.classList.toggle('edit-mode');
    }

    // Remove a station from the list
    removeStation(stationUrl) {
        try {
            // If the station being removed is currently playing, stop it
            if (this.currentStation && this.currentStation.url === stationUrl) {
                this.audio.pause();
                this.isPlaying = false;
                this.currentStation = null;
                this.updateUI();
            }

            // Remove the station
            this.stations = this.stations.filter(station => station.url !== stationUrl);
            
            // Save to localStorage
            this.saveStations();

            // Update the display
            this.displayStations();

            // Show success notification
            showNotification('Station removed successfully.', 'success');
        } catch (error) {
            console.error('Error removing station:', error);
            showNotification('Error removing station. Please try again.', 'error');
        }
    }

    // Load station lists from localStorage
    loadStationLists() {
        try {
            const savedLists = localStorage.getItem('radio-station-lists');
            return savedLists ? JSON.parse(savedLists) : [];
        } catch (error) {
            console.error('Error loading station lists:', error);
            return [];
        }
    }

    // Save station lists to localStorage
    saveStationLists() {
        try {
            localStorage.setItem('radio-station-lists', JSON.stringify(this.stationLists));
        } catch (error) {
            console.error('Error saving station lists:', error);
        }
    }

    // Display station lists in the UI
    displayStationLists() {
        const savedStationsSection = document.querySelector('.saved-stations');
        const listsContainer = document.createElement('div');
        listsContainer.className = 'station-lists';

        this.stationLists.forEach((list, index) => {
            const listElement = document.createElement('div');
            listElement.className = 'station-list';
            listElement.innerHTML = `
                <div class="list-header">
                    <h3>${list.name}</h3>
                </div>
                <div class="list-stations"></div>
            `;

            const stationsContainer = listElement.querySelector('.list-stations');
            list.stations.forEach(station => {
                const stationElement = document.createElement('div');
                stationElement.className = 'station-card';
                stationElement.innerHTML = `
                    <div class="station-info">
                        <div class="station-favicon">
                            ${station.favicon ? 
                                `<img src="${station.favicon}" alt="${station.name} logo" onerror="this.outerHTML='<span class=\\'material-symbols-rounded\\'>radio</span>'">` : 
                                `<span class="material-symbols-rounded">radio</span>`
                            }
                        </div>
                        <div class="station-details">
                            <h3>${station.name}</h3>
                            <div class="station-meta">
                                ${station.bitrate ? `<span><span class="material-symbols-rounded">radio</span>${station.bitrate}kbps</span>` : ''}
                                ${station.countrycode ? `<span><span class="material-symbols-rounded">public</span>${station.countrycode}</span>` : ''}
                                ${station.votes ? `<span><span class="material-symbols-rounded">local_fire_department</span>${station.votes}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="station-controls">
                        <button class="play-btn">
                            <span class="material-symbols-rounded">play_arrow</span>
                        </button>
                        <button class="remove-btn">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                `;

                // Add event listener for play button
                const playBtn = stationElement.querySelector('.play-btn');
                playBtn.addEventListener('click', () => {
                    this.playStation(station);
                });

                // Add event listener for remove button
                const removeBtn = stationElement.querySelector('.remove-btn');
                removeBtn.addEventListener('click', async () => {
                    const confirmed = await showConfirmationModal({
                        title: 'Remove Station',
                        message: `Are you sure you want to remove ${station.name} from this list?`,
                        confirmText: 'Remove',
                        danger: true
                    });

                    if (confirmed) {
                        // Remove the station from the list
                        list.stations = list.stations.filter(s => s.url !== station.url);
                        
                        // If this was the last station in the list, remove the entire list
                        if (list.stations.length === 0) {
                            this.stationLists = this.stationLists.filter(l => l.name !== list.name);
                        }
                        
                        // Save and update the display
                        this.saveStationLists();
                        this.displayStationLists();
                        
                        showNotification('Station removed successfully.', 'success');
                    }
                });

                stationsContainer.appendChild(stationElement);
            });

            listsContainer.appendChild(listElement);
        });

        // Remove existing lists container if it exists
        const existingLists = savedStationsSection.querySelector('.station-lists');
        if (existingLists) {
            existingLists.remove();
        }

        // Add the new lists container
        savedStationsSection.appendChild(listsContainer);
    }
}

// Initialize the radio player
const radioPlayer = new RadioPlayer();

// Set up play/pause button event listener
const playPauseBtn = document.getElementById('play-pause');
if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        console.log('Play/pause button clicked'); // Debug log
        radioPlayer.togglePlay();
    });
}

// Debug: Check localStorage on page load
window.addEventListener('load', () => {
    // Ensure stations are displayed after page load
    radioPlayer.displayStations();
});

// Username management
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username');
const STORAGE_KEY_USERNAME = 'radio-username';

// List of random usernames
const randomUsernames = [
    'Lunar Pond', 'Green Wombat', 'Cosmic Fox', 'Electric Panda', 'Mystic River',
    'Solar Bear', 'Ocean Wave', 'Mountain Peak', 'Desert Wind', 'Forest Sprite',
    'Starlight', 'Moonbeam', 'Thunder Cloud', 'Rainbow Bridge', 'Crystal Lake'
];

// Comprehensive list of offensive words and phrases
const offensiveWords = [
    // Common profanity
    'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'bastard', 'whore', 'slut',
    // Racial slurs
    'nigger', 'nigga', 'chink', 'spic', 'kike', 'gook', 'wetback', 'coon', 'jap', 'raghead',
    // Homophobic slurs
    'fag', 'faggot', 'dyke', 'queer', 'tranny', 'shemale', 'homo', 'lesbo',
    // Religious slurs
    'christ killer', 'jew', 'muzzie', 'towelhead', 'infidel',
    // Disability slurs
    'retard', 'retarded', 'cripple', 'spaz', 'retard', 'mongoloid',
    // Body shaming
    'fatso', 'lardass', 'ugly', 'pig', 'whale',
    // Sexual content
    'rape', 'rapist', 'pedo', 'pedophile', 'molest', 'molestor',
    // Violence
    'kill', 'murder', 'suicide', 'terrorist', 'bomb', 'shoot',
    // Common variations and misspellings
    'fuk', 'sh1t', 'b1tch', 'c0ck', 'p0rn', 'pr0n', 'f4g', 'n1gg3r',
    // Common offensive phrases
    'kill yourself', 'go die', 'eat shit', 'fuck off', 'suck dick',
    // Common offensive abbreviations
    'stfu', 'gtfo', 'kys', 'fml', 'wtf', 'omfg'
];

// Generate a random username
function generateRandomUsername() {
    const randomIndex = Math.floor(Math.random() * randomUsernames.length);
    return randomUsernames[randomIndex];
}

// Validate username
function validateUsername(username) {
    // Check length
    if (username.length < 3 || username.length > 20) {
        return 'Username must be between 3 and 20 characters';
    }

    // Check for offensive words
    const lowercaseUsername = username.toLowerCase();
    for (const word of offensiveWords) {
        if (lowercaseUsername.includes(word)) {
            return 'Username contains inappropriate language';
        }
    }

    // Check for valid characters
    if (!/^[a-zA-Z0-9\s]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and spaces';
    }

    return null;
}

// Save username
function saveUsername(username) {
    localStorage.setItem(STORAGE_KEY_USERNAME, username);
}

// Load username
function loadUsername() {
    const savedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
    if (savedUsername) {
        return savedUsername;
    }
    const newUsername = generateRandomUsername();
    saveUsername(newUsername);
    return newUsername;
}

// Initialize username
let currentUsername = loadUsername();
usernameInput.value = currentUsername;

// Handle username changes
saveUsernameBtn.addEventListener('click', () => {
    const newUsername = usernameInput.value.trim();
    const error = validateUsername(newUsername);
    
    if (error) {
        showNotification(error, 'error');
        return;
    }
    
    currentUsername = newUsername;
    saveUsername(currentUsername);
    showNotification('Username updated successfully!', 'success');
});

// QR Code functionality
const qrModal = document.getElementById('qr-modal');
const scannerModal = document.getElementById('scanner-modal');
const shareQrBtn = document.getElementById('share-qr');
const scanQrBtn = document.getElementById('scan-qr');
const closeQrBtn = document.getElementById('close-qr');
const closeScannerBtn = document.getElementById('close-scanner');
const qrCodeContainer = document.getElementById('qr-code');
const scannerContainer = document.getElementById('scanner-container');

// Load QR code libraries
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`Successfully loaded script: ${src}`);
            resolve();
        };
        script.onerror = (error) => {
            console.error(`Failed to load script: ${src}`, error);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}

// Initialize QR code functionality
let qrcodeReady = false;
let scannerReady = false;

// Try loading from multiple CDNs
const qrcodeUrls = [
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
];

const scannerUrls = [
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

async function loadLibraries() {
    let qrcodeLoaded = false;
    let scannerLoaded = false;

    // Try loading QR code library from multiple sources
    for (const url of qrcodeUrls) {
        try {
            await loadScript(url);
            qrcodeLoaded = true;
            console.log('QR code library loaded successfully');
            break;
        } catch (error) {
            console.warn(`Failed to load QR code library from ${url}, trying next source...`);
        }
    }

    // Try loading scanner library from multiple sources
    for (const url of scannerUrls) {
        try {
            await loadScript(url);
            scannerLoaded = true;
            console.log('Scanner library loaded successfully');
            break;
        } catch (error) {
            console.warn(`Failed to load scanner library from ${url}, trying next source...`);
        }
    }

    if (!qrcodeLoaded || !scannerLoaded) {
        throw new Error('Failed to load required QR code libraries. Please check your internet connection and try refreshing the page.');
    }

    qrcodeReady = true;
    scannerReady = true;
}

loadLibraries()
    .then(() => {
        console.log('All QR code libraries loaded successfully');
        
        // Remove any existing event listener first
        const newCloseQrBtn = document.getElementById('close-qr');
        const oldCloseQrBtn = closeQrBtn;
        if (oldCloseQrBtn) {
            oldCloseQrBtn.removeEventListener('click', () => {});
        }
        
        // Add new event listener
        newCloseQrBtn.addEventListener('click', () => {
            qrModal.classList.add('hidden');
            // Clear the QR code when closing
            qrCodeContainer.innerHTML = '';
        });
    })
    .catch(error => {
        console.error('Error loading QR code libraries:', error);
        alert('Error loading QR code functionality. Please check your internet connection and try refreshing the page.');
    });

// Handle QR code sharing
shareQrBtn.addEventListener('click', () => {
    if (!qrcodeReady) {
        showNotification('QR code functionality is still loading. Please try again in a moment.', 'warning');
        return;
    }

    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        showNotification('No stations to share.', 'warning');
        return;
    }

    try {
        // Only share UUIDs and username
        const data = {
            u: currentUsername, // username
            i: radioPlayer.stations.map(station => station.stationuuid).filter(uuid => uuid) // station uuids
        };
        
        const dataStr = JSON.stringify(data);
        
        // Clear any existing QR code
        qrCodeContainer.innerHTML = '';
        
        // Create new QR code
        new QRCode(qrCodeContainer, {
            text: dataStr,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.L
        });
        
        qrModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error preparing data for QR code:', error);
        showNotification('Error preparing data for QR code. Please try again.', 'error');
    }
});

// Function to show QR import options
function showQrImportOptions(options) {
    const modal = document.querySelector('.qr-import-modal');
    const content = modal.querySelector('.qr-import-content');
    const header = content.querySelector('.qr-import-header h3');
    const message = content.querySelector('.qr-import-message');
    const mergeBtn = content.querySelector('.qr-import-btn.merge');
    const newListBtn = content.querySelector('.qr-import-btn.new-list');
    const cancelBtn = content.querySelector('.qr-import-btn.cancel');
    
    // Set modal content
    header.textContent = options.title || 'Import Stations';
    message.textContent = options.message || '';
    
    // Show modal
    modal.classList.add('visible');
    
    // Return a promise that resolves with the user's choice
    return new Promise((resolve) => {
        const handleChoice = (choice) => {
            modal.classList.remove('visible');
            resolve(choice);
            
            // Clean up event listeners
            mergeBtn.removeEventListener('click', mergeHandler);
            newListBtn.removeEventListener('click', newListHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };
        
        const mergeHandler = () => handleChoice('1');
        const newListHandler = () => handleChoice('3');
        const cancelHandler = () => handleChoice(null);
        
        mergeBtn.addEventListener('click', mergeHandler);
        newListBtn.addEventListener('click', newListHandler);
        cancelBtn.addEventListener('click', cancelHandler);
    });
}

// Update the scan success handler to use the new modal
const onScanSuccess = async (decodedText, decodedResult) => {
    try {
        // Stop the scanner immediately after successful scan
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }

        const data = JSON.parse(decodedText);
        
        // Validate imported data
        if (!data || !data.i || !Array.isArray(data.i)) {
            showNotification('Invalid QR code format.', 'error');
            return;
        }
        
        if (data.i.length === 0) {
            showNotification('No stations found in the QR code.', 'warning');
            return;
        }

        // Show loading notification
        showNotification('Fetching station details...', 'success');

        // Fetch full station details for each UUID
        const stations = await Promise.all(data.i.map(async (uuid) => {
            try {
                const response = await fetch(`https://at1.api.radio-browser.info/json/stations/byuuid/${uuid}`);
                const apiStations = await response.json();
                
                if (apiStations && apiStations.length > 0) {
                    return apiStations[0];
                }
                
                // If not found in API, skip this station
                return null;
            } catch (error) {
                console.warn('Error fetching station details:', error);
                return null;
            }
        }));

        // Filter out any failed lookups
        const validStations = stations.filter(station => station !== null);
        
        if (validStations.length === 0) {
            showNotification('No valid stations found in the QR code.', 'error');
            return;
        }

        const sharedUsername = data.u || 'Unknown User';
        const listName = `${sharedUsername}'s Radio`;
        
        // Show import options using the new modal
        const importOption = await showQrImportOptions({
            title: 'Import Stations',
            message: `Found ${validStations.length} stations from ${sharedUsername}.`
        });

        if (importOption === null) return;

        switch (importOption) {
            case '1':
                // Merge stations, avoiding duplicates
                const existingUrls = radioPlayer.stations.map(s => s.url);
                for (const station of validStations) {
                    if (!existingUrls.includes(station.url)) {
                        radioPlayer.stations.push(station);
                        existingUrls.push(station.url);
                    }
                }
                break;
            
            case '3':
                // Add as separate list
                const newList = {
                    name: listName,
                    stations: validStations
                };
                
                // Add new list to the player's lists
                radioPlayer.stationLists.push(newList);
                
                // Save lists
                radioPlayer.saveStationLists();
                
                // Update UI to show the new list
                radioPlayer.displayStationLists();
                break;
        }
        
        // Save and display the new stations
        radioPlayer.saveStations();
        radioPlayer.displayStations();
        
        showNotification(`Import successful! You now have ${radioPlayer.stations.length} stations.`, 'success');
        
        // Close scanner modal
        scannerModal.classList.add('hidden');
    } catch (error) {
        console.error('Error parsing QR code data:', error);
        showNotification('Error parsing QR code data. The QR code may be invalid or corrupted.', 'error');
    }
};

// Handle QR code scanning
let html5QrcodeScanner = null;
let currentCameraId = null;

scanQrBtn.addEventListener('click', () => {
    if (!scannerReady) {
        showNotification('QR scanner is still loading. Please try again in a moment.', 'warning');
        return;
    }

    scannerModal.classList.remove('hidden');
    
    if (!html5QrcodeScanner) {
        // Get available cameras
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length > 0) {
                // Start with the rear camera if available
                const rearCamera = devices.find(device => device.label.toLowerCase().includes('back'));
                const initialCameraId = rearCamera ? rearCamera.id : devices[0].id;
                currentCameraId = initialCameraId;

                // Initialize scanner with the selected camera
                html5QrcodeScanner = new Html5QrcodeScanner(
                    "scanner-container",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        videoConstraints: {
                            deviceId: initialCameraId
                        }
                    },
                    false
                );

                // Set up camera toggle button
                const toggleCameraBtn = document.getElementById('toggle-camera');
                if (devices.length > 1) {
                    toggleCameraBtn.style.display = 'flex';
                    toggleCameraBtn.addEventListener('click', () => {
                        const currentIndex = devices.findIndex(device => device.id === currentCameraId);
                        const nextIndex = (currentIndex + 1) % devices.length;
                        const nextCameraId = devices[nextIndex].id;
                        
                        // Stop current scanner
                        html5QrcodeScanner.clear();
                        
                        // Start new scanner with next camera
                        html5QrcodeScanner = new Html5QrcodeScanner(
                            "scanner-container",
                            { 
                                fps: 10, 
                                qrbox: { width: 250, height: 250 },
                                aspectRatio: 1.0,
                                videoConstraints: {
                                    deviceId: nextCameraId
                                }
                            },
                            false
                        );
                        
                        currentCameraId = nextCameraId;
                        html5QrcodeScanner.render(onScanSuccess);
                    });
                } else {
                    toggleCameraBtn.style.display = 'none';
                }

                html5QrcodeScanner.render(onScanSuccess);
            } else {
                showNotification('No cameras found. Please check your device permissions.', 'error');
            }
        }).catch(err => {
            console.error('Error getting cameras:', err);
            showNotification('Error accessing camera. Please check your device permissions.', 'error');
        });
    }
});

// Close scanner modal
closeScannerBtn.addEventListener('click', () => {
    scannerModal.classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
    }
});

// Search functionality
const searchInput = document.getElementById('search-input');
const clearInputBtn = document.getElementById('clear-input');
const searchResults = document.getElementById('search-results');
const clearResultsBtn = document.getElementById('clear-results');
let previewAudio = null;
let searchTimeout = null;
const SEARCH_DELAY = 500; // milliseconds delay for search after user stops typing

// Function to clear search results
function clearSearchResults() {
    const searchResultsSection = document.getElementById('search-results');
    searchResultsSection.classList.add('hidden');
    const resultsGrid = searchResultsSection.querySelector('.results-grid');
    resultsGrid.innerHTML = '';
    
    // Stop any preview that might be playing
    if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
    }
    
    // Also clear the search input
    searchInput.value = '';
    toggleClearInputButton();
}

// Function to clear search input
function clearSearchInput() {
    searchInput.value = '';
    // Focus the input after clearing
    searchInput.focus();
    // Hide the clear button when input is empty
    toggleClearInputButton();
    // Clear results when input is cleared
    clearSearchResults();
}

// Function to toggle clear input button visibility
function toggleClearInputButton() {
    if (searchInput.value.trim() === '') {
        clearInputBtn.style.display = 'none';
    } else {
        clearInputBtn.style.display = 'flex';
    }
}

// Debounced search function to search as user types
function debouncedSearch() {
    // Clear any existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Set a new timeout to perform the search
    searchTimeout = setTimeout(() => {
        const query = searchInput.value.trim();
        searchStations(query);
    }, SEARCH_DELAY);
}

// Search for stations
async function searchStations(query) {
    if (!query.trim()) {
        clearSearchResults();
        return;
    }
    
    try {
        const response = await fetch(`https://at1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();
        displaySearchResults(data);
        console.log('Search results:', data);
    } catch (error) {
        console.error('Error searching stations:', error);
        const searchResultsSection = document.getElementById('search-results');
        const resultsGrid = searchResultsSection.querySelector('.results-grid');
        searchResultsSection.classList.remove('hidden');
        resultsGrid.innerHTML = '<p class="error-message">Error searching stations. Please try again.</p>';
    }
}

// Display search results
async function displaySearchResults(stations) {
    const searchResultsSection = document.getElementById('search-results');
    const resultsGrid = searchResultsSection.querySelector('.results-grid');
    const sectionTitle = searchResultsSection.querySelector('.section-title');
    
    // Show loading indicator
    searchResultsSection.classList.add('loading');
    searchResultsSection.classList.remove('hidden');
    
    // Create loading indicator HTML
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Checking stations...</div>
    `;
    
    // Clear previous results and show loading indicator
    resultsGrid.innerHTML = '';
    searchResultsSection.appendChild(loadingIndicator);
    
    // First filter by URL format
    const formatValidStations = stations.filter(station => isValidStreamUrl(station.url));
    
    // Update loading text to show progress
    loadingIndicator.querySelector('.loading-text').textContent = 
        `Checking ${formatValidStations.length} stations...`;
    
    // Then test each stream
    const testPromises = formatValidStations.map(async (station) => {
        const isPlayable = await testStream(station.url);
        return isPlayable ? station : null;
    });

    const testResults = await Promise.all(testPromises);
    const supportedStations = testResults.filter(station => station !== null);
    
    // Remove loading indicator
    loadingIndicator.remove();
    searchResultsSection.classList.remove('loading');
    
    // Update section title to show statistics
    const totalStations = stations.length;
    const formatValidCount = formatValidStations.length;
    const supportedCount = supportedStations.length;
    
    sectionTitle.textContent = `${supportedCount} playable stations found (${totalStations} total) for "${searchInput.value}"`;
    
    // Return early if no supported stations
    if (supportedStations.length === 0) {
        resultsGrid.innerHTML = `
            <p class="no-results">
                No playable stations found. Try a different search term.
                ${totalStations > 0 ? `
                    <br>
                    - ${totalStations - formatValidCount} stations had invalid formats
                    ${formatValidCount > 0 ? `<br>- ${formatValidCount - supportedCount} stations failed playback test` : ''}
                ` : ''}
            </p>
        `;
        return;
    }
    
    resultsGrid.innerHTML = supportedStations.map(station => {
        const safeStation = {
            name: station.name || 'Unknown Station',
            tags: station.tags || 'No tags available',
            url: station.url,
            stationuuid: station.stationuuid || '',
            bitrate: station.bitrate || 'Unknown',
            countrycode: station.countrycode || 'Unknown',
            favicon: station.favicon || '',
            homepage: station.homepage || '',
            votes: station.votes || 0
        };
        
        const safeStationJson = JSON.stringify(safeStation).replace(/"/g, '&quot;');
        
        return `
            <div class="search-result-card">
                <div class="station-info">
                    <div class="station-favicon">
                        ${station.favicon ? 
                            `<img src="${station.favicon}" alt="${station.name} logo" onerror="this.outerHTML='<span class=\\'material-symbols-rounded\\'>radio</span>'">` : 
                            `<span class="material-symbols-rounded">radio</span>`
                        }
                    </div>
                    <div class="station-details">
                        <h3>${station.name}</h3>
                        <div class="station-meta">
                            ${station.bitrate ? `<span><span class="material-symbols-rounded">radio</span>${station.bitrate}kbps</span>` : ''}
                            ${station.countrycode ? `<span><span class="material-symbols-rounded">public</span>${station.countrycode}</span>` : ''}
                            ${station.votes ? `<span><span class="material-symbols-rounded">local_fire_department</span>${station.votes}</span>` : ''}
                        </div>
                        ${station.tags ? `<div class="tags">${station.tags.split(',').slice(0, 3).map(tag => 
                            `<span class="tag">${tag.trim()}</span>`).join('')}</div>` : ''}
                    </div>
                </div>
                <div class="search-result-controls">
                    <button class="preview-btn" data-url="${station.url}">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </button>
                    <button class="add-btn" data-station="${safeStationJson}">
                        <span class="material-symbols-rounded">add</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            previewStation(url);
            
            // Update button state
            document.querySelectorAll('.preview-btn .material-symbols-rounded').forEach(icon => {
                icon.textContent = 'play_arrow';
            });
            const icon = btn.querySelector('.material-symbols-rounded');
            icon.textContent = icon.textContent === 'play_arrow' ? 'stop' : 'play_arrow';
        });
    });

    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addStation(btn);
        });
    });
}

// Preview a station
function previewStation(url) {
    // Validate URL first
    if (!isValidStreamUrl(url)) {
        showNotification('This station\'s stream URL is not supported. Please try another station.', 'error');
        return;
    }

    // Stop the main player if it's playing
    if (radioPlayer.isPlaying) {
        radioPlayer.togglePlay();
    }

    // If clicking the same preview that's currently playing, stop it
    if (previewAudio && previewAudio.src === url) {
        previewAudio.pause();
        previewAudio = null;
        // Reset all preview buttons to their default state
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
        });
        return;
    }

    // If a different preview is playing, stop it first
    if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
        // Reset all preview buttons to their default state
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
        });
    }

    // Create new audio element for preview
    previewAudio = new Audio(url);
    previewAudio.volume = 0.5;
    
    // Update only the clicked preview button
    document.querySelectorAll('.preview-btn').forEach(btn => {
        if (btn.dataset.url === url) {
            btn.querySelector('.material-symbols-rounded').textContent = 'stop';
        }
    });

    previewAudio.play()
        .then(() => {
            // Success - do nothing, button already updated
        })
        .catch(error => {
            console.error('Error playing preview:', error);
            // Reset the button state
            document.querySelectorAll('.preview-btn').forEach(btn => {
                if (btn.dataset.url === url) {
                    btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
                }
            });
            
            if (error.name === 'NotSupportedError') {
                showNotification('This station\'s stream is not supported. Please try another station.', 'error');
            } else {
                showNotification('Error playing preview. The station might be unavailable or the stream format is not supported.', 'error');
            }
        });

    // Add event listener for when preview ends
    previewAudio.addEventListener('ended', () => {
        previewAudio = null;
        // Reset all preview buttons when preview ends
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
        });
    });
}

// Update the addStation function to use the RadioPlayer's method
async function addStation(station) {
    try {
        const stationJson = station.dataset.station.replace(/&quot;/g, '"');
        const stationData = JSON.parse(stationJson);
        
        // Show success animation
        const addBtn = station.closest('.add-btn');
        if (addBtn) {
            const icon = addBtn.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.textContent = 'check';
                addBtn.classList.add('success');
                
                // Add the station to the player's list
                radioPlayer.stations.push(stationData);
                radioPlayer.saveStations();
                radioPlayer.displayStations();
                
                // Wait for animation to complete before clearing
                await new Promise(resolve => setTimeout(resolve, 500));
                clearSearchResults();
            }
        }
    } catch (error) {
        console.error('Error adding station:', error);
        showNotification('Error adding station. Please try again.', 'error');
    }
}

// Event listeners for search
searchInput.addEventListener('input', () => {
    toggleClearInputButton();
    debouncedSearch();
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        // Clear any pending debounced search
        if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
        }
        // Perform search immediately on Enter key
        searchStations(query);
    }
});

// Add event listener for clear input button
clearInputBtn.addEventListener('click', clearSearchInput);

// Add event listener for clear results button
clearResultsBtn.addEventListener('click', clearSearchResults);

// Initialize clear input button state
toggleClearInputButton();

// Update the player bar HTML structure
playerBar.innerHTML = `
    <div class="now-playing">
        <div class="station-info">
            <img id="current-favicon" src="" alt="" class="current-favicon" style="display: none;">
            <div class="current-details">
                <h3 id="station-name">Select a station</h3>
                <p id="station-details"></p>
            </div>
        </div>
        <div class="player-controls">
            <button id="play-pause" class="control-btn">
                <span class="material-symbols-rounded">play_arrow</span>
            </button>
        </div>
    </div>
`;

// Notification system
function showNotification(message, type = 'success', duration = 3000) {
    const container = document.querySelector('.notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const iconMap = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning'
    };
    
    notification.innerHTML = `
        <span class="material-symbols-rounded icon">${iconMap[type]}</span>
        <span class="message">${message}</span>
        <button class="close-btn">
            <span class="material-symbols-rounded">close</span>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    const timeout = setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, duration);
    
    // Manual close
    notification.querySelector('.close-btn').addEventListener('click', () => {
        clearTimeout(timeout);
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    });
}

// Confirmation modal system
function showConfirmationModal(options) {
    const modal = document.querySelector('.confirmation-modal');
    const content = modal.querySelector('.confirmation-content');
    const header = content.querySelector('.confirmation-header h3');
    const body = content.querySelector('.confirmation-body');
    const cancelBtn = content.querySelector('.confirmation-btn.cancel');
    const confirmBtn = content.querySelector('.confirmation-btn.confirm');
    
    // Set modal content
    header.textContent = options.title || 'Confirm Action';
    body.textContent = options.message || 'Are you sure you want to proceed?';
    confirmBtn.textContent = options.confirmText || 'Confirm';
    confirmBtn.className = `confirmation-btn confirm ${options.danger ? 'danger' : ''}`;
    
    // Show modal
    modal.classList.add('visible');
    
    // Return a promise that resolves with the user's choice
    return new Promise((resolve) => {
        const handleChoice = (choice) => {
            modal.classList.remove('visible');
            resolve(choice);
            
            // Clean up event listeners
            cancelBtn.removeEventListener('click', cancelHandler);
            confirmBtn.removeEventListener('click', confirmHandler);
        };
        
        const cancelHandler = () => handleChoice(false);
        const confirmHandler = () => handleChoice(true);
        
        cancelBtn.addEventListener('click', cancelHandler);
        confirmBtn.addEventListener('click', confirmHandler);
    });
}