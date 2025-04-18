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
        alert('No stations to export.');
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
        
        alert('Stations exported successfully!');
    } catch (error) {
        console.error('Error exporting stations:', error);
        alert('Error exporting stations. Please try again.');
    }
});

// Handle data import
importFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate imported data
            if (!data || !data.stations || !Array.isArray(data.stations)) {
                throw new Error('Invalid data format');
            }
            
            if (data.stations.length === 0) {
                alert('No stations found in the imported file.');
                return;
            }
            
            // Confirm overwrite or merge
            const shouldOverwrite = confirm(
                `Found ${data.stations.length} stations in the imported file. ` +
                `Do you want to replace your current stations? ` +
                `Click OK to replace, Cancel to merge with existing stations.`
            );
            
            if (shouldOverwrite) {
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
            
            alert(`Import successful! You now have ${radioPlayer.stations.length} stations.`);
        } catch (error) {
            console.error('Error importing stations:', error);
            alert('Error importing stations. The file may be invalid or corrupted.');
        }
        
        // Reset the file input
        event.target.value = '';
    };
    
    reader.readAsText(file);
});

// Handle clear all stations
clearStationsBtn.addEventListener('click', () => {
    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        alert('No stations to clear.');
        return;
    }
    
    const confirmation = confirm(
        `Are you sure you want to remove all ${radioPlayer.stations.length} stations? ` +
        `This action cannot be undone.`
    );
    
    if (confirmation) {
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
        
        alert('All stations have been removed.');
        
        // Close settings panel
        closeSettingsPanel();
    }
});

class RadioPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentStation = null;
        this.stations = this.loadStations(); // Load stations from localStorage
        this.isPlaying = false;

        // DOM elements
        this.playPauseBtn = document.getElementById('play-pause');
        this.volumeSlider = document.getElementById('volume');
        this.stationName = document.getElementById('station-name');
        this.stationDetails = document.getElementById('station-details');
        this.stationsContainer = document.getElementById('stations');

        // Event listeners
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.audio.addEventListener('ended', () => this.handleStreamEnd());

        // Display initial stations
        this.displayStations();
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

    // Add a station to the list
    addStation(station) {
        try {
            // Check if station already exists
            const existingStation = this.stations.find(s => s.url === station.url);
            if (existingStation) {
                alert('This station is already in your list!');
                return;
            }

            // Create a new station object with all the properties we need
            const newStation = {
                name: station.name || 'Unknown Station',
                tags: station.tags || 'No tags available',
                url: station.url,
                bitrate: station.bitrate || 'N/A',
                countrycode: station.countrycode || 'Unknown',
                favicon: station.favicon || '',
                homepage: station.homepage || '',
                votes: station.votes || 0
            };

            console.log('Adding station:', newStation);
            
            // Add station to the list
            this.stations.push(newStation);

            // Save to localStorage
            this.saveStations();

            // Update the display
            this.displayStations();
            alert('Station added successfully!');
        } catch (error) {
            console.error('Error adding station:', error);
            alert('Error adding station. Please try again.');
        }
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
        } catch (error) {
            console.error('Error removing station:', error);
            alert('Error removing station. Please try again.');
        }
    }

    displayStations() {
        console.log('Displaying stations:', this.stations);
        if (!this.stationsContainer) {
            console.error('Stations container not found');
            return;
        }

        if (this.stations.length === 0) {
            this.stationsContainer.innerHTML = '<p class="no-stations">No stations added yet. Search for stations above to add them to your list.</p>';
            return;
        }

        this.stationsContainer.innerHTML = this.stations.map(station => `
            <div class="station-card" data-url="${station.url}">
                <div class="station-info">
                    ${station.favicon ? 
                        `<img src="${station.favicon}" alt="${station.name} logo" class="station-favicon">` : 
                        `<div class="station-favicon"></div>`
                    }
                    <div class="station-details">
                        <h3>${station.name}</h3>
                        <div class="station-meta">
                            ${station.bitrate ? `<span><span class="material-symbols-rounded">radio</span>${station.bitrate}kbps</span>` : ''}
                            ${station.countrycode ? `<span><span class="material-symbols-rounded">public</span>${station.countrycode}</span>` : ''}
                            ${station.votes ? `<span><span class="material-symbols-rounded">favorite</span>${station.votes}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="station-controls">
                    <button class="play-btn">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </button>
                    <button class="remove-btn">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            </div>
        `).join('');

        this.addStationEventListeners();
    }

    addStationEventListeners() {
        document.querySelectorAll('.station-card').forEach(card => {
            const url = card.dataset.url;
            
            // Play button
            card.querySelector('.play-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const station = this.stations.find(s => s.url === url);
                if (station) {
                    this.playStation(station);
                }
            });

            // Remove button
            card.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to remove this station?')) {
                    this.removeStation(url);
                }
            });
        });
    }

    playStation(station) {
        if (!station) {
            console.error('No station provided');
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
            })
            .catch(error => {
                console.error('Error playing station:', error);
                this.stationDetails.textContent = 'Error playing station. Please try another one.';
            });
    }

    togglePlay() {
        if (!this.currentStation) return;

        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    this.updateUI();
                })
                .catch(error => {
                    console.error('Error playing station:', error);
                    this.stationDetails.textContent = 'Error playing station. Please try another one.';
                });
        }
        this.isPlaying = !this.isPlaying;
        this.updateUI();
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
        
        if (this.currentStation) {
            this.stationName.textContent = this.currentStation.name;
            this.stationDetails.textContent = this.currentStation.tags || 'No tags available';
            const playPauseIcon = this.playPauseBtn.querySelector('.material-symbols-rounded');
            if (playPauseIcon) {
                playPauseIcon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
            }
            
            // Update favicon in player
            if (currentFavicon) {
                if (this.currentStation.favicon) {
                    currentFavicon.src = this.currentStation.favicon;
                    currentFavicon.style.display = 'block';
                } else {
                    currentFavicon.style.display = 'none';
                }
            }
        } else {
            // Reset UI when no station is selected
            this.stationName.textContent = 'Select a station';
            this.stationDetails.textContent = '';
            if (currentFavicon) {
                currentFavicon.style.display = 'none';
                currentFavicon.src = '';
            }
        }
    }
}

// Initialize the radio player
const radioPlayer = new RadioPlayer();

// Debug: Check localStorage on page load
window.addEventListener('load', () => {
    // Ensure stations are displayed after page load
    radioPlayer.displayStations();
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
function displaySearchResults(stations) {
    const searchResultsSection = document.getElementById('search-results');
    const resultsGrid = searchResultsSection.querySelector('.results-grid');
    const sectionTitle = searchResultsSection.querySelector('.section-title');
    
    // Update section title
    sectionTitle.textContent = `${stations.length} results for "${searchInput.value}"`;
    
    // Show the search results section
    searchResultsSection.classList.remove('hidden');
    
    // Return early if no results
    if (stations.length === 0) {
        resultsGrid.innerHTML = '<p class="no-results">No stations found. Try a different search term.</p>';
        return;
    }
    
    resultsGrid.innerHTML = stations.map(station => {
        const safeStation = {
            name: station.name || 'Unknown Station',
            tags: station.tags || 'No tags available',
            url: station.url,
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
                    ${station.favicon ? 
                        `<img src="${station.favicon}" alt="${station.name} logo" class="station-favicon">` : 
                        `<div class="station-favicon"></div>`
                    }
                    <div class="station-details">
                        <h3>${station.name}</h3>
                        <div class="station-meta">
                            ${station.bitrate ? `<span><span class="material-symbols-rounded">radio</span>${station.bitrate}kbps</span>` : ''}
                            ${station.countrycode ? `<span><span class="material-symbols-rounded">public</span>${station.countrycode}</span>` : ''}
                            ${station.votes ? `<span><span class="material-symbols-rounded">favorite</span>${station.votes}</span>` : ''}
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
        btn.addEventListener('click', () => {
            try {
                const stationJson = btn.dataset.station.replace(/&quot;/g, '"');
                const station = JSON.parse(stationJson);
                addStation(station);
            } catch (error) {
                console.error('Error parsing station data:', error);
                alert('Error adding station. Please try again.');
            }
        });
    });
}

// Preview a station
function previewStation(url) {
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

    previewAudio.play().catch(error => {
        console.error('Error playing preview:', error);
        alert('Error playing preview. The station might be unavailable.');
        // Reset all preview buttons on error
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
        });
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
function addStation(station) {
    radioPlayer.addStation(station);
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