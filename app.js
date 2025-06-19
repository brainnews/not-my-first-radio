import { initLogoAnimation } from './js/logoAnimation.js';
import AudioVisualizer from './js/audioVisualizer.js';
import AchievementSystem from './js/achievements.js';

// Initialize logo animation
initLogoAnimation();

// check if path is 127.0.0.1:5500 and set debug to true
const isLocalhost = window.location.hostname === '127.0.0.1' && window.location.port === '5500';
const debug = isLocalhost;

// detect user's theme and change the favicon accordingly
const favicon = document.querySelector('link[rel="shortcut icon"]');
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    favicon.href = './icons/favicon-dark.ico';
} else {
    favicon.href = './icons/favicon-light.ico';
}

// Settings panel functionality
const menuBtn = document.getElementById('menu-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettingsBtn = document.getElementById('close-settings');
const exportDataBtn = document.getElementById('export-data');
const importFileInput = document.getElementById('import-file');
const clearStationsBtn = document.getElementById('clear-stations');
const addManualStationBtn = document.getElementById('add-manual-station');
const resetAchievementsBtn = document.getElementById('reset-achievements');

// Alert banner functionality
const alertBanner = document.querySelector('.alert-banner');
const closeAlertBtn = document.getElementById('close-alert');

// Close alert banner
const handleCloseAlert = (e) => {
    e.preventDefault();
    alertBanner.classList.add('hidden');
    localStorage.setItem('alert-banner-closed', 'true');
};
closeAlertBtn.addEventListener('mousedown', handleCloseAlert);
closeAlertBtn.addEventListener('touchstart', handleCloseAlert);
closeAlertBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCloseAlert(e);
    }
});

// Check if alert banner should be shown
if (!localStorage.getItem('alert-banner-closed') || debug) {
    alertBanner.classList.remove('hidden');
}

// Open settings panel
const handleOpenSettings = (e) => {
    e.preventDefault();
    settingsPanel.classList.remove('hidden');
    settingsOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    // Use setTimeout to ensure the transitions work properly
    setTimeout(() => {
        settingsPanel.classList.add('visible');
        settingsOverlay.classList.add('visible');
    }, 10);
};
menuBtn.addEventListener('mousedown', handleOpenSettings);
menuBtn.addEventListener('touchstart', handleOpenSettings);
menuBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpenSettings(e);
    }
});

// Close settings panel when clicking close button or overlay
function closeSettingsPanel(e) {
    if (e) e.preventDefault();
    settingsPanel.classList.remove('visible');
    settingsOverlay.classList.remove('visible');
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    // Wait for transitions to complete before hiding
    setTimeout(() => {
        settingsPanel.classList.add('hidden');
        settingsOverlay.classList.add('hidden');
    }, 300);
}

closeSettingsBtn.addEventListener('mousedown', closeSettingsPanel);
closeSettingsBtn.addEventListener('touchstart', closeSettingsPanel);
closeSettingsBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeSettingsPanel(e);
    }
});

settingsOverlay.addEventListener('mousedown', closeSettingsPanel);
settingsOverlay.addEventListener('touchstart', closeSettingsPanel);

// Handle data export
const handleExportData = (e) => {
    e.preventDefault();
    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        showNotification('No stations to export.', 'warning');
        return;
    }

    try {
        const data = {
            stations: radioPlayer.stations,
            version: '1.0',
            username: currentUsername
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = currentUsername + '-radio.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Track export achievement
        if (window.achievementSystem) {
            window.achievementSystem.trackProgress('export', 1);
        }
        
        showNotification('Stations exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting stations:', error);
        showNotification('Error exporting stations. Please try again.', 'error');
    }
};
exportDataBtn.addEventListener('click', handleExportData);
exportDataBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleExportData(e);
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
            
            // Show import options using the QR import modal
            const importOption = await showQrImportOptions({
                title: 'Import Stations',
                message: `${data.username || 'Unknown User'} sent you ${data.stations.length} stations in the imported file.`
            });
            
            if (importOption === null) return;
            
            switch (importOption) {
                case '1':
                    // Merge stations, avoiding duplicates
                    const existingUrls = radioPlayer.stations.map(s => s.url);
                    for (const station of data.stations) {
                        if (!existingUrls.includes(station.url)) {
                            radioPlayer.stations.push(station);
                            existingUrls.push(station.url);
                        }
                    }
                    radioPlayer.saveStations();
                    radioPlayer.displayStations();
                    
                    // Track import achievement
                    if (window.achievementSystem) {
                        window.achievementSystem.trackProgress('import', 1, {
                            isSharedList: true
                        });
                    }
                    
                    showNotification('Stations merged successfully!', 'success');
                    break;
                
                case '3':
                    // Add as separate list
                    const listName = `${data.username || 'Unknown User'}'s Shared Stations`;
                    const newList = {
                        name: listName,
                        stations: data.stations
                    };
                    radioPlayer.stationLists.push(newList);
                    radioPlayer.saveStationLists();
                    radioPlayer.displayStationLists();
                    
                    // Track import achievement
                    if (window.achievementSystem) {
                        window.achievementSystem.trackProgress('import', 1, {
                            isSharedList: true
                        });
                    }
                    
                    showNotification('New station list added!', 'success');
                    break;
            }
        } catch (error) {
            console.error('Error importing stations:', error);
            showNotification('Error importing stations. Please try again.', 'error');
        }
    };
    
    reader.readAsText(file);
});

// Handle clear stations
const handleClearStations = async (e) => {
    e.preventDefault();
    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        showNotification('No stations to clear.', 'warning');
        return;
    }
    
    const confirmed = await showConfirmationModal({
        title: 'Clear All Stations',
        message: 'Are you sure you want to remove all stations? This action cannot be undone.',
        confirmText: 'Clear All',
        danger: true
    });
    
    if (confirmed) {
        radioPlayer.stations = [];
        radioPlayer.saveStations();
        radioPlayer.displayStations();
        showNotification('All stations have been removed.', 'success');
    }
};

// Handle reset achievements
const handleResetAchievements = async (e) => {
    e.preventDefault();
    
    if (!window.achievementSystem) {
        showNotification('Achievement system not available.', 'error');
        return;
    }
    
    const progress = window.achievementSystem.getUserProgress();
    if (progress.unlockedCount === 0 && progress.stats.stationsAdded === 0 && progress.stats.searchCount === 0) {
        showNotification('No achievement progress to reset.', 'warning');
        return;
    }
    
    const achievementText = progress.unlockedCount > 0 
        ? `${progress.unlockedCount} achievements and all progress` 
        : 'all achievement progress';
    
    const confirmed = await showConfirmationModal({
        title: 'Reset All Achievements',
        message: `Are you sure you want to reset ${achievementText}? This will permanently clear your achievement data and cannot be undone.`,
        confirmText: 'Reset Achievements',
        danger: true
    });
    
    if (confirmed) {
        window.achievementSystem.resetAchievements();
        showNotification('All achievements have been reset.', 'success');
        
        // If achievements modal is open, refresh it
        const achievementsModal = document.getElementById('achievements-modal');
        if (achievementsModal && !achievementsModal.classList.contains('hidden')) {
            showAchievementsModal();
        }
    }
};

clearStationsBtn.addEventListener('click', handleClearStations);
clearStationsBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClearStations(e);
    }
});

// Reset achievements button event listeners
if (resetAchievementsBtn) {
    resetAchievementsBtn.addEventListener('click', handleResetAchievements);
    resetAchievementsBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleResetAchievements(e);
        }
    });
}

// Handle empty state settings button
const emptyStateSettingsBtn = document.getElementById('empty-state-settings');
if (emptyStateSettingsBtn) {
    const handleEmptyStateSettings = (e) => {
        e.preventDefault();
        settingsPanel.classList.remove('hidden');
        settingsOverlay.classList.remove('hidden');
        setTimeout(() => {
            settingsPanel.classList.add('visible');
            settingsOverlay.classList.add('visible');
        }, 10);
    };
    emptyStateSettingsBtn.addEventListener('mousedown', handleEmptyStateSettings);
    emptyStateSettingsBtn.addEventListener('touchstart', handleEmptyStateSettings);
    emptyStateSettingsBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEmptyStateSettings(e);
        }
    });
}

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
        'shoutcast',
        'live',
        'broadcast',
        'audio',
        'media',
        'play',
        'player'
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
    const hasStreamPattern = /\/stream|\/listen|\/radio|\/live|\/broadcast|\/audio|\/media|\/play|\/player/i.test(lowerUrl);
    const hasAudioExtension = /\.(mp3|aac|m3u|m3u8|pls|xspf)$/i.test(lowerUrl);
    const hasStreamPort = /:\d{4,5}\//.test(lowerUrl); // Common streaming ports
    const hasAudioPattern = /audio|media|stream|broadcast/i.test(lowerUrl);

    // URL must have at least one of these characteristics to be considered valid
    return hasSupportedFormat || hasStreamPattern || hasAudioExtension || hasStreamPort || hasAudioPattern;
}

// Add a function to test the stream before adding
async function testStream(url) {
    return new Promise((resolve) => {
        const audio = new Audio();
        let timeout = setTimeout(() => {
            audio.remove();
            resolve(true); // Changed to true to be more permissive
        }, 3000); // Reduced timeout from 5s to 3s

        audio.addEventListener('canplay', () => {
            clearTimeout(timeout);
            audio.remove();
            resolve(true);
        });

        audio.addEventListener('error', () => {
            clearTimeout(timeout);
            audio.remove();
            resolve(false); // Changed to true to be more permissive
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
        this.volume = 70; // Initialize volume to 100%
        this.visualizer = null;

        // DOM elements
        this.playPauseBtn = document.getElementById('play-pause');
        this.volumeSlider = document.getElementById('volume');
        this.stationName = document.getElementById('station-name');
        this.stationDetails = document.getElementById('station-details');
        this.stationsContainer = document.getElementById('stations');

        // Initialize player controls
        this.playerControls = document.querySelector('.player-controls');
        this.volumeControl = document.querySelector('.volume-control');
        
        // Event listeners
        this.audio.addEventListener('ended', () => this.handleStreamEnd());
        
        // Set up the play/pause button listener with click for proper audio playback
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => {
                this.togglePlay();
            });
        }

        // Add event listener for clear shared stations button
        const clearSharedStationsBtn = document.getElementById('clear-shared-stations');
        if (clearSharedStationsBtn) {
            const handleClearShared = async (e) => {
                e.preventDefault();
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
                    this.stationLists = [];
                    this.saveStationLists();
                    this.displayStationLists();
                    showNotification('All shared stations have been removed.', 'success');
                }
            };
            clearSharedStationsBtn.addEventListener('click', handleClearShared);
            clearSharedStationsBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClearShared(e);
                }
            });
        }

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
        try {
            localStorage.setItem('radio-stations', JSON.stringify(this.stations));
        } catch (error) {
            console.error('Error saving stations to localStorage:', error);
        }
    }

    // Display stations in the UI
    displayStations() {
        const savedStationsTitle = document.getElementById('saved-stations-title');
        if (this.stations.length === 0) {
            savedStationsTitle.classList.add('hidden');
            // First show the empty state with loading indicator
            this.stationsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-header">
                        <img src="./icons/icon128-transparent.png" alt="Not My First Radio" class="welcome-icon">
                        <p class="welcome">Not My First Radio is a lightweight, private, and local first radio player. Search over 30,000 stations above or start listening right away with a starter pack below. No account required.</p>
                    </div>
                    <div class="starter-packs-grid">
                        <div class="loading-indicator">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading starter packs...</div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary);">Have a .json file? Open <button class="settings-btn" id="empty-state-settings" style="display: inline; width: auto;"><span class="material-symbols-rounded">settings</span>Settings</button> to import your stations.</p>
                </div>
            `;

            // Add event listener to the settings button
            const emptyStateSettingsBtn = document.getElementById('empty-state-settings');
            if (emptyStateSettingsBtn) {
                emptyStateSettingsBtn.addEventListener('click', () => {
                    settingsPanel.classList.remove('hidden');
                    settingsOverlay.classList.remove('hidden');
                    setTimeout(() => {
                        settingsPanel.classList.add('visible');
                        settingsOverlay.classList.add('visible');
                    }, 10);
                });
            }

            // Load all starter packs
            const loadStarterPacks = async () => {
                const specificPacks = [
                    'austin.json',
                    'jungle-dnb.json'
                ];

                const packs = await Promise.all(specificPacks.map(async (filename) => {
                    try {
                        const response = await fetch(`https://files.notmyfirstradio.com/starter-packs/${filename}`);
                        const data = await response.json();
                        return {
                            filename,
                            data
                        };
                    } catch (error) {
                        console.error(`Error loading starter pack ${filename}:`, error);
                        return null;
                    }
                }));

                // Filter out failed loads and update UI
                const validPacks = packs.filter(pack => pack !== null);
                const starterPacksGrid = document.querySelector('.starter-packs-grid');
                
                if (validPacks.length === 0) {
                    starterPacksGrid.innerHTML = '<p class="no-stations">Error loading starter packs. Please try again later.</p>';
                    return;
                }

                starterPacksGrid.innerHTML = validPacks.map(pack => `
                    <div class="starter-pack-card" data-pack="${pack.filename.replace('.json', '')}">
                        <img src="${pack.data.thumbnail_path || 'https://place-hold.it/250x250'}" alt="${pack.data.username} Starter Pack" class="starter-pack-image">
                        <div class="starter-pack-card-content">
                            <p>${pack.data.description || 'A collection of radio stations'}</p>
                            <button class="add-starter-pack-btn" data-pack="${pack.filename.replace('.json', '')}">
                                <span class="material-symbols-rounded">add</span>
                            </button>
                        </div>
                    </div>
                `).join('');

                // Add event listeners to starter pack buttons
                const addStarterPackBtns = document.querySelectorAll('.add-starter-pack-btn');
                addStarterPackBtns.forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const packName = e.target.closest('.add-starter-pack-btn').dataset.pack;
                        try {
                            const response = await fetch(`starter-packs/${packName}.json`);
                            const data = await response.json();
                            
                            if (!data || !data.stations || !Array.isArray(data.stations)) {
                                showNotification('Invalid starter pack format.', 'error');
                                return;
                            }

                            // Add all stations from the pack
                            this.stations = data.stations;
                            this.saveStations();
                            this.displayStations();
                            showNotification('Starter pack added successfully!', 'success');
                        } catch (error) {
                            console.error('Error loading starter pack:', error);
                            showNotification('Failed to load starter pack.', 'error');
                        }
                    });
                });
            };

            // Start loading starter packs
            loadStarterPacks();
            return;
        } else {
            savedStationsTitle.classList.remove('hidden');
        }

        this.stationsContainer.innerHTML = this.stations.map(station => `
            <div class="station-card${this.currentStation && this.currentStation.url === station.url && this.isPlaying ? ' playing' : ''}" data-url="${station.url}">
                <div class="station-info">
                    <div class="station-favicon">
                        ${station.favicon ? 
                            `<img src="${station.favicon}" alt="${station.name} logo" onerror="this.outerHTML='<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 16 16\\' fill=\\'none\\' xmlns=\\'http://www.w3.org/2000/svg\\'><path d=\\'M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z\\' fill=\\'#D9D9D9\\'/><path d=\\'M13 13H10V12H12V10H13V13Z\\' fill=\\'#D9D9D9\\'/><path d=\\'M13 8H12V9H11V10H9V6H13V8Z\\' fill=\\'#1500FF\\'/><path d=\\'M4 8H5V10H7V11H6V12H3V7H4V8Z\\' fill=\\'#FF0000\\'/><path d=\\'M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z\\' fill=\\'#0DFF00\\'/></svg>'">` : 
                            `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z" fill="#D9D9D9"/><path d="M13 13H10V12H12V10H13V13Z" fill="#D9D9D9"/><path d="M13 8H12V9H11V10H9V6H13V8Z" fill="#1500FF"/><path d="M4 8H5V10H7V11H6V12H3V7H4V8Z" fill="#FF0000"/><path d="M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z" fill="#0DFF00"/></svg>`
                        }
                    </div>
                    <div class="station-details">
                        <div class="station-name-container">
                            <h3>${station.name}</h3>
                            <div class="now-playing-icon">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 14V15H1V14H3Z" fill="#00FFA2"/>
                                    <path d="M6 14V15H4V14H6Z" fill="#00FFA2"/>
                                    <path d="M9 14V15H7V14H9Z" fill="#00FFA2"/>
                                    <path d="M12 14V15H10V14H12Z" fill="#00FFA2"/>
                                    <path d="M15 14V15H13V14H15Z" fill="#00FFA2"/>
                                    <path d="M3 13V14H1V13H3Z" fill="#00FFA2"/>
                                    <path d="M6 13V14H4V13H6Z" fill="#00FFA2"/>
                                    <path d="M9 13V14H7V13H9Z" fill="#00FFA2"/>
                                    <path d="M12 13V14H10V13H12Z" fill="#00FFA2"/>
                                    <path d="M15 13V14H13V13H15Z" fill="#00FFA2"/>
                                    <path d="M6 12V13H4V12H6Z" fill="#00FFA2"/>
                                    <path d="M3 12V13H1V12H3Z" fill="#00FFA2"/>
                                    <path d="M9 12V13H7V12H9Z" fill="#00FFA2"/>
                                    <path d="M12 12V13H10V12H12Z" fill="#00FFA2"/>
                                    <path d="M15 12V13H13V12H15Z" fill="#00FFA2"/>
                                    <path d="M6 11V12H4V11H6Z" fill="#00FFA2"/>
                                    <path d="M3 11V12H1V11H3Z" fill="#00FFA2"/>
                                    <path d="M12 11V12H10V11H12Z" fill="#00FFA2"/>
                                    <path d="M9 11V12H7V11H9Z" fill="#00FFA2"/>
                                    <path d="M15 11V12H13V11H15Z" fill="#00FFA2"/>
                                    <path d="M3 10V11H1V10H3Z" fill="#00FFA2"/>
                                    <path d="M6 10V11H4V10H6Z" fill="#00FFA2"/>
                                    <path d="M9 10V11H7V10H9Z" fill="#00FFA2"/>
                                    <path d="M15 10V11H13V10H15Z" fill="#00FFA2"/>
                                    <path d="M12 10V11H10V10H12Z" fill="#00FFA2"/>
                                    <path d="M3 9V10H1V9H3Z" fill="#00FFA2"/>
                                    <path d="M6 9V10H4V9H6Z" fill="#00FFA2"/>
                                    <path d="M12 9V10H10V9H12Z" fill="#00FFA2"/>
                                    <path d="M9 9V10H7V9H9Z" fill="#00FFA2"/>
                                    <path d="M15 9V10H13V9H15Z" fill="#00FFA2"/>
                                    <path d="M6 8V9H4V8H6Z" fill="#00FFA2"/>
                                    <path d="M3 8V9H1V8H3Z" fill="#00FFA2"/>
                                    <path d="M12 8V9H10V8H12Z" fill="#00FFA2"/>
                                    <path d="M9 8V9H7V8H9Z" fill="#00FFA2"/>
                                    <path d="M15 8V9H13V8H15Z" fill="#00FFA2"/>
                                    <path d="M6 7V8H4V7H6Z" fill="#00FFA2"/>
                                    <path d="M3 7V8H1V7H3Z" fill="#00FFA2"/>
                                    <path d="M12 7V8H10V7H12Z" fill="#00FFA2"/>
                                    <path d="M9 7V8H7V7H9Z" fill="#00FFA2"/>
                                    <path d="M15 7V8H13V7H15Z" fill="#00FFA2"/>
                                    <path d="M3 6V7H1V6H3Z" fill="#00FFA2"/>
                                    <path d="M6 6V7H4V6H6Z" fill="#00FFA2"/>
                                    <path d="M9 6V7H7V6H9Z" fill="#00FFA2"/>
                                    <path d="M15 6V7H13V6H15Z" fill="#00FFA2"/>
                                    <path d="M12 6V7H10V6H12Z" fill="#00FFA2"/>
                                    <path d="M3 5V6H1V5H3Z" fill="#00FFA2"/>
                                    <path d="M6 5V6H4V5H6Z" fill="#00FFA2"/>
                                    <path d="M9 5V6H7V5H9Z" fill="#00FFA2"/>
                                    <path d="M12 5V6H10V5H12Z" fill="#00FFA2"/>
                                    <path d="M15 5V6H13V5H15Z" fill="#00FFA2"/>
                                    <path d="M6 4V5H4V4H6Z" fill="#00FFA2"/>
                                    <path d="M3 4V5H1V4H3Z" fill="#00FFA2"/>
                                    <path d="M9 4V5H7V4H9Z" fill="#00FFA2"/>
                                    <path d="M15 4V5H13V4H15Z" fill="#00FFA2"/>
                                    <path d="M12 4V5H10V4H12Z" fill="#00FFA2"/>
                                    <path d="M6 3V4H4V3H6Z" fill="#00FFA2"/>
                                    <path d="M3 3V4H1V3H3Z" fill="#00FFA2"/>
                                    <path d="M12 3V4H10V3H12Z" fill="#00FFA2"/>
                                    <path d="M9 3V4H7V3H9Z" fill="#00FFA2"/>
                                    <path d="M15 3V4H13V3H15Z" fill="#00FFA2"/>
                                    <path d="M6 2V3H4V2H6Z" fill="#00FFA2"/>
                                    <path d="M3 2V3H1V2H3Z" fill="#00FFA2"/>
                                    <path d="M12 2V3H10V2H12Z" fill="#00FFA2"/>
                                    <path d="M9 2V3H7V2H9Z" fill="#00FFA2"/>
                                    <path d="M15 2V3H13V2H15Z" fill="#00FFA2"/>
                                    <path d="M15 1V2H13V1H15Z" fill="#9E66F2"/>
                                    <path d="M12 1V2H10V1H12Z" fill="#9E66F2"/>
                                    <path d="M9 1V2H7V1H9Z" fill="#9E66F2"/>
                                    <path d="M6 1V2H4V1H6Z" fill="#9E66F2"/>
                                    <path d="M3 1V2H1V1H3Z" fill="#9E66F2"/>
                                </svg>
                            </div>
                        </div>
                        <div class="station-meta">
                            ${station.bitrate ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 9V10H3V9H5Z" fill="#47B5FF"/><path d="M6 11H2V8H6V11ZM5 9H3V10H5V9Z" fill="#477EFF"/><path d="M11 10V11H7V10H11V9ZM11 9H7V8H11V9Z" fill="#262626"/><path d="M14 14H13V7H14V6H15V13H14V14Z" fill="#D29A00"/><path d="M12 15H1V7H12V15ZM2 13H3V12H2V13ZM4 13H5V12H4V13ZM6 13H9V12H6V13ZM10 13H11V12H10V13ZM2 11H6V8H2V11ZM7 11H11V10H7V11ZM7 9H11V8H7V9Z" fill="#FFC933"/><path d="M3 13H2V12H3V13ZM5 13H4V12H5V13ZM7 13H6V12H7V13ZM9 13H8V12H9V13ZM11 13H10V12H11V13Z" fill="#6D6D6D"/><path d="M4 14H3V13H4V14ZM6 14H5V13H6V14ZM8 14H7V13H8V14ZM10 14H9V13H10V14Z" fill="#6D6D6D"/><path d="M13 4V5H14V6H1V5H2V4H13Z" fill="#FFE59E"/><path d="M14 7H13V14H14V15H13V16H1V15H12V7H1V15H0V6H14V7ZM15 14H14V13H15V14ZM8 13H7V12H8V13ZM16 13H15V5H16V13Z" fill="#FFC933"/><path d="M15 6H14V5H13V4H15V6ZM13 4H11V3H13V4ZM11 3H9V2H11V3ZM9 2H7V1H9V2ZM7 1H5V0H7V1Z" fill="#DCDCDC"/></svg>${station.bitrate}kbps</span>` : ''}
                            ${station.countrycode ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3H9V5H10V6H8V5H6V6H5V7H6V8H10V9H11V11H12V12H13V14H11V15H8V12H6V11H5V9H4V7H3V6H1V5H2V3H3V2H5V1H10V3Z" fill="#1C6800"/><path d="M1 6H3V7H4V9H5V11H6V12H8V15H11V16H5V15H3V14H2V13H1V11H0V5H1V6ZM13 15H11V14H13V15ZM11 1H13V2H14V3H15V5H16V11H15V13H14V14H13V12H12V11H11V9H10V8H6V7H5V6H6V5H8V6H10V5H9V3H10V1H5V0H11V1ZM2 5H1V3H2V5ZM3 3H2V2H3V3ZM5 2H3V1H5V2Z" fill="#477EFF"/></svg>${station.countrycode}</span>` : ''}
                            ${station.votes ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10H10V11H11V14H10V15H9V16H7V15H6V14H5V11H6V10H7V9H9V10Z" fill="#FFC933"/><path d="M5 16H4V15H5V16ZM12 16H11V15H12V16ZM4 15H3V14H4V15ZM13 15H12V14H13V15ZM7 1H8V3H9V4H12V3H13V4H14V5H15V7H16V11H15V13H14V14H13V11H12V9H11V8H9V7H6V8H5V9H4V10H3V14H2V13H1V11H0V7H1V5H2V4H3V3H4V2H5V1H6V0H7V1Z" fill="#FF5E00"/></svg>${station.votes}</span>` : ''}
                        </div>
                        ${station.note ? `<div class="station-note">${station.note}</div>` : ''}
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
                    <button class="more-btn" title="More actions">
                        <span class="material-symbols-rounded">more_vert</span>
                    </button>
                    <div class="station-menu-overlay hidden"></div>
                    <div class="station-menu hidden">
                        <div class="station-menu-info">
                            <div class="station-menu-favicon" style="display: ${station.favicon ? 'flex' : 'none'};">
                                <img src="${station.favicon}" alt="${station.name} logo">
                            </div>
                            <div class="station-menu-name">${station.name}</div>
                            <div class="station-menu-data">
                                <div class="station-menu-data-item" style="display: ${station.bitrate ? 'flex' : 'none'};"><span class="material-symbols-rounded">radio</span>${station.bitrate ? `${station.bitrate}kbps` : ''}</div>
                                <div class="station-menu-data-item" style="display: ${station.countrycode ? 'flex' : 'none'};"><span class="material-symbols-rounded">public</span>${station.countrycode ? `${station.countrycode}` : ''}</div>
                                <div class="station-menu-data-item" style="display: ${station.votes ? 'flex' : 'none'};"><span class="material-symbols-rounded">local_fire_department</span>${station.votes ? `${station.votes}` : ''}</div>
                            </div>
                        </div>
                        <button class="menu-share"><span class="material-symbols-rounded">share</span> Share</button>
                        <button class="menu-edit-note"><span class="material-symbols-rounded">edit</span> Edit Note</button>
                        <button class="menu-homepage"><span class="material-symbols-rounded">open_in_new</span> Visit Website</button>
                        <button class="menu-delete"><span class="material-symbols-rounded">delete</span> Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        this.addMainStationEventListeners();
    }

    addMainStationEventListeners() {
        // Add event listeners to main stations
        const mainStationCards = this.stationsContainer.querySelectorAll('.station-card');
        mainStationCards.forEach(card => {
            const url = card.dataset.url;
            
            const handleCardInteraction = (e) => {
                if (
                    e.target.closest('.remove-btn') ||
                    e.target.closest('.share-btn') ||
                    e.target.closest('.more-btn') ||
                    e.target.closest('.station-menu') ||
                    e.target.closest('.station-menu-overlay') ||
                    e.target.classList.contains('note-input') ||
                    e.target.closest('.note-input') ||
                    e.target.classList.contains('note-actions') ||
                    e.target.closest('.note-actions')
                ) return;
                
                const station = this.stations.find(s => s.url === url);
                if (station) {
                    if (this.currentStation && this.currentStation.url === url && this.isPlaying) {
                        this.audio.pause();
                        this.isPlaying = false;
                        this.currentStation = null;
                        this.updateUI();
                    } else {
                        this.playStation(station);
                    }
                }
            };

            card.addEventListener('click', handleCardInteraction);

            // Play or stop button
            const playControl = card.querySelector('.play-btn, .stop-btn');
            if (playControl) {
                const handlePlayControl = (e) => {
                    e.stopPropagation();
                    const station = this.stations.find(s => s.url === url);
                    if (station) {
                        if (this.currentStation && this.currentStation.url === url && this.isPlaying) {
                            this.audio.pause();
                            this.isPlaying = false;
                            this.currentStation = null;
                            this.updateUI();
                        } else {
                            this.playStation(station);
                        }
                    }
                };
                playControl.addEventListener('click', handlePlayControl);
            }

            // More menu logic
            const moreBtn = card.querySelector('.more-btn');
            const menu = card.querySelector('.station-menu');
            const overlay = card.querySelector('.station-menu-overlay');
            if (moreBtn && menu && overlay) {
                let touchStartY = 0;
                let touchStartX = 0;
                const TOUCH_THRESHOLD = 10; // pixels of movement allowed before considering it a scroll

                const handleMoreBtn = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    menu.classList.remove('hidden');
                    overlay.classList.remove('hidden');
                    // Add active class for mobile
                    if (window.innerWidth <= 768) {
                        menu.classList.add('active');
                    }
                };

                const closeMenu = () => {
                    menu.classList.add('hidden');
                    overlay.classList.add('hidden');
                    // Remove active class for mobile
                    if (window.innerWidth <= 768) {
                        menu.classList.remove('active');
                    }
                };

                moreBtn.addEventListener('click', handleMoreBtn);
                moreBtn.addEventListener('touchstart', (e) => {
                    touchStartY = e.touches[0].clientY;
                    touchStartX = e.touches[0].clientX;
                    handleMoreBtn(e);
                });
                moreBtn.addEventListener('touchmove', (e) => {
                    const touchY = e.touches[0].clientY;
                    const touchX = e.touches[0].clientX;
                    const deltaY = Math.abs(touchY - touchStartY);
                    const deltaX = Math.abs(touchX - touchStartX);
                    
                    // If movement exceeds threshold, close the menu
                    if (deltaY > TOUCH_THRESHOLD || deltaX > TOUCH_THRESHOLD) {
                        e.preventDefault();
                        closeMenu();
                    }
                });
                moreBtn.addEventListener('touchend', (e) => {
                    const touchY = e.changedTouches[0].clientY;
                    const touchX = e.changedTouches[0].clientX;
                    const deltaY = Math.abs(touchY - touchStartY);
                    const deltaX = Math.abs(touchX - touchStartX);
                    
                    // Only open menu if movement was minimal
                    if (deltaY <= TOUCH_THRESHOLD && deltaX <= TOUCH_THRESHOLD) {
                        handleMoreBtn(e);
                    }
                });

                // Add back the document click listener to close menu when clicking outside
                document.addEventListener('mousedown', (e) => {
                    if (!card.contains(e.target)) {
                        closeMenu();
                    }
                });
                document.addEventListener('touchstart', (e) => {
                    if (!card.contains(e.target)) {
                        closeMenu();
                    }
                });

                // Add overlay click handler to close menu
                overlay.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
                });

                // Menu item handlers
                const menuShare = menu.querySelector('.menu-share');
                const menuEditNote = menu.querySelector('.menu-edit-note');
                const menuDelete = menu.querySelector('.menu-delete');

                if (menuShare) {
                    const handleShare = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Add immediate visual feedback
                        menuShare.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            menuShare.style.transform = '';
                        }, 150);
                        
                        menu.classList.add('hidden');
                        overlay.classList.add('hidden');
                        const station = this.stations.find(s => s.url === url);
                        if (station) this.shareStation(station);
                    };
                    menuShare.addEventListener('click', handleShare);
                    menuShare.addEventListener('touchstart', (e) => {
                        e.preventDefault(); // Prevent scrolling
                        handleShare(e);
                    });
                    menuShare.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleShare(e);
                        }
                    });
                }

                if (menuEditNote) {
                    const handleEditNote = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        menu.classList.add('hidden');
                        overlay.classList.add('hidden');
                        this.showEditNoteUI(card, url);
                    };
                    menuEditNote.addEventListener('click', handleEditNote);
                    menuEditNote.addEventListener('touchstart', (e) => {
                        e.preventDefault(); // Prevent scrolling
                        handleEditNote(e);
                    });
                    menuEditNote.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleEditNote(e);
                        }
                    });
                }

                if (menuDelete) {
                    const handleDelete = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        menu.classList.add('hidden');
                        overlay.classList.add('hidden');
                        const station = this.stations.find(s => s.url === url);
                        if (station) await this.confirmAndRemoveStation(url, station.name);
                    };
                    menuDelete.addEventListener('mousedown', handleDelete);
                    menuDelete.addEventListener('touchstart', (e) => {
                        e.preventDefault(); // Prevent scrolling
                        handleDelete(e);
                    });
                    menuDelete.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleDelete(e);
                        }
                    });
                }

                // Add homepage button handler
                const menuHomepage = menu.querySelector('.menu-homepage');
                if (menuHomepage) {
                    const handleHomepage = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        menu.classList.add('hidden');
                        overlay.classList.add('hidden');
                        const station = this.stations.find(s => s.url === url);
                        if (station && station.homepage) {
                            window.open(station.homepage, '_blank');
                        }
                    };
                    menuHomepage.addEventListener('mousedown', handleHomepage);
                    menuHomepage.addEventListener('touchstart', (e) => {
                        e.preventDefault(); // Prevent scrolling
                        handleHomepage(e);
                    });
                    menuHomepage.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleHomepage(e);
                        }
                    });
                }
            }
        });
    }

    addSharedStationEventListeners() {
        // Add event listeners to shared/list stations
        const listStationCards = document.querySelectorAll('.list-stations .station-card');
        listStationCards.forEach(card => {
            const url = card.dataset.url;
            card.addEventListener('click', (e) => {
                if (
                    e.target.closest('.remove-btn') ||
                    e.target.closest('.share-btn') ||
                    e.target.closest('.more-btn') ||
                    e.target.closest('.station-menu') ||
                    e.target.closest('.station-menu-overlay') ||
                    e.target.classList.contains('note-input') ||
                    e.target.closest('.note-input') ||
                    e.target.classList.contains('note-actions') ||
                    e.target.closest('.note-actions')
                ) return;
                let foundStation = null;
                for (const list of this.stationLists) {
                    foundStation = list.stations.find(s => s.url === url);
                    if (foundStation) break;
                }
                if (foundStation) {
                    if (this.currentStation && this.currentStation.url === url && this.isPlaying) {
                        this.audio.pause();
                        this.isPlaying = false;
                        this.currentStation = null;
                        this.updateUI();
                    } else {
                        this.playStation(foundStation);
                    }
                }
            });
            // Play or stop button
            const playControl = card.querySelector('.play-btn, .stop-btn');
            if (playControl) {
                playControl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let foundStation = null;
                    for (const list of this.stationLists) {
                        foundStation = list.stations.find(s => s.url === url);
                        if (foundStation) break;
                    }
                    if (foundStation) {
                        if (this.currentStation && this.currentStation.url === url && this.isPlaying) {
                            this.audio.pause();
                            this.isPlaying = false;
                            this.currentStation = null;
                            this.updateUI();
                        } else {
                            this.playStation(foundStation);
                        }
                    }
                });
            }
            // More menu logic
            const moreBtn = card.querySelector('.more-btn');
            const menu = card.querySelector('.station-menu');
            const overlay = card.querySelector('.station-menu-overlay');
            if (moreBtn && menu && overlay) {
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.station-menu').forEach(m => m.classList.add('hidden'));
                    menu.classList.remove('hidden');
                    overlay.classList.remove('hidden');
                    if (window.innerWidth <= 768) {
                        menu.classList.add('active');
                    }
                });
            }
            const closeMenu = () => {
                menu.classList.add('hidden');
                overlay.classList.add('hidden');
                // Remove active class for mobile
                if (window.innerWidth <= 768) {
                    menu.classList.remove('active');
                }
            };
            document.addEventListener('click', (e) => {
                if (!card.contains(e.target)) closeMenu();
            });
            document.addEventListener('touchstart', (e) => {
                if (!card.contains(e.target)) closeMenu();
            });
            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
            });
            const sharedMenuShare = menu.querySelector('.menu-share');
            sharedMenuShare.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Add immediate visual feedback
                sharedMenuShare.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    sharedMenuShare.style.transform = '';
                }, 150);
                
                menu.classList.add('hidden');
                overlay.classList.add('hidden');
                const station = this.stations.find(s => s.url === url);
                if (station) this.shareStation(station);
            });
            const moveBtn = menu.querySelector('.menu-move');
            if (moveBtn) {
                moveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    menu.classList.add('hidden');
                    overlay.classList.add('hidden');
                    this.moveStationToUserList(url);
                });
            }
            menu.querySelector('.menu-homepage').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                menu.classList.add('hidden');
                overlay.classList.add('hidden');
                let foundStation = null;
                for (const list of this.stationLists) {
                    foundStation = list.stations.find(s => s.url === url);
                    if (foundStation) break;
                }
                if (foundStation && foundStation.homepage) {
                    window.open(foundStation.homepage, '_blank');
                }
            });
            menu.querySelector('.menu-delete').addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                menu.classList.add('hidden');
                overlay.classList.add('hidden');
                let foundStation = null;
                for (const list of this.stationLists) {
                    foundStation = list.stations.find(s => s.url === url);
                    if (foundStation) break;
                }
                if (foundStation) {
                    const confirmed = await showConfirmationModal({
                        title: 'Remove Station',
                        message: `Are you sure you want to remove ${foundStation.name} from this shared list?`,
                        confirmText: 'Remove',
                        danger: true
                    });
                    if (confirmed) {
                        this.removeStationFromSharedList(url);
                    }
                }
            });

            // Add touch event handlers to prevent default touch behavior
            const menuButtons = menu.querySelectorAll('button');
            menuButtons.forEach(button => {
                // Prevent default touch behavior
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                }, { passive: false });

                // Add touch end handler to trigger the click action
                button.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    button.click();
                }, { passive: false });
            });

            // Add touch event handler for the more button
            moreBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });

            moreBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                moreBtn.click();
            }, { passive: false });

            // Add touch event handler for the menu container
            menu.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });
        });
    }

    // Play a station
    playStation(station) {
        // Clean up old audio event listeners and state first
        if (this.audio) {
            this.audio.onerror = null;
            this.audio.onended = null;
            this.audio.pause();
            this.audio.src = '';
        }

        // Show player immediately and set loading state
        this.currentStation = station;
        this.isPlaying = false;
        document.querySelector('.player-bar').classList.add('active');
        document.querySelector('.player-bar').classList.add('loading');
        document.querySelector('.static').classList.remove('hidden');
        this.updateUI();

        // Try to use HTTPS if the URL is HTTP
        let streamUrl = station.url;
        if (streamUrl.startsWith('http://')) {
            streamUrl = streamUrl.replace('http://', 'https://');
        }

        this.audio = new Audio(streamUrl);
        this.audio.volume = this.volume / 100;

        // Track if we've shown an error for this station
        let hasShownError = false;

        // Add error handling for the audio element
        this.audio.onerror = (error) => {
            // Only process errors if this is still the current station
            if (this.currentStation !== station) return;

            // If HTTPS failed and we tried HTTPS, fall back to HTTP
            if (streamUrl.startsWith('https://') && station.url.startsWith('http://')) {
                this.audio.src = station.url;
                this.audio.play().catch(error => {
                    // Only process errors if this is still the current station
                    if (this.currentStation !== station) return;
                    
                    // Check if it's an AbortError
                    if (error && error.name === 'AbortError') {
                        // For AbortError, check if the audio is actually playing
                        if (this.audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                            this.isPlaying = true;
                            document.querySelector('.player-bar').classList.remove('loading');
                            document.querySelector('.static').classList.add('hidden');
                            this.updateUI();
                            return;
                        }
                        // If not playing yet, just return without showing error
                        return;
                    }
                    
                    if (!hasShownError) {
                        console.error('Error playing station:', error);
                        this.isPlaying = false;
                        this.currentStation = null;
                        document.querySelector('.player-bar').classList.remove('loading');
                        document.querySelector('.static').classList.add('hidden');
                        showNotification('Unable to play this station. It may be unavailable or use an unsupported format.', 'error');
                        this.updateUI();
                        hasShownError = true;
                    }
                });
                return;
            }

            // Only show notification if not an AbortError
            if (error && error.target && error.target.error && error.target.error.name === 'AbortError') {
                // For AbortError, check if the audio is actually playing
                if (this.audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                    this.isPlaying = true;
                    document.querySelector('.player-bar').classList.remove('loading');
                    document.querySelector('.static').classList.add('hidden');
                    this.updateUI();
                    return;
                }
                // If not playing yet, just return without showing error
                return;
            }

            if (!hasShownError) {
                console.error('Error playing station:', error);
                this.isPlaying = false;
                this.currentStation = null;
                document.querySelector('.player-bar').classList.remove('loading');
                document.querySelector('.static').classList.add('hidden');
                showNotification('Unable to play this station. It may be unavailable or use an unsupported format.', 'error');
                this.updateUI();
                hasShownError = true;
            }
        };

        // Add canplay event listener to handle successful loading
        this.audio.oncanplay = () => {
            if (this.currentStation === station) {
                this.isPlaying = true;
                document.querySelector('.player-bar').classList.remove('loading');
                document.querySelector('.static').classList.add('hidden');
                this.updateUI();
                
                // Track achievement for station play
                if (window.achievementSystem) {
                    window.achievementSystem.trackProgress('stationPlayed', 1, {
                        stationId: station.stationuuid || station.url
                    });
                }
                
                // Start listening time tracking
                this.startListeningTimeTracking();
            }
        };

        // Try to play the station
        const playPromise = this.audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // Only update if this is still the current station
                    if (this.currentStation === station) {
                        this.isPlaying = true;
                        document.querySelector('.player-bar').classList.remove('loading');
                        document.querySelector('.static').classList.add('hidden');
                        this.updateUI();
                    }
                })
                .catch(error => {
                    // Only process errors if this is still the current station
                    if (this.currentStation !== station) return;

                    // If HTTPS failed and we tried HTTPS, fall back to HTTP
                    if (streamUrl.startsWith('https://') && station.url.startsWith('http://')) {
                        this.audio.src = station.url;
                        this.audio.play().catch(error => {
                            // Only process errors if this is still the current station
                            if (this.currentStation !== station) return;
                            
                            // Check if it's an AbortError
                            if (error && error.name === 'AbortError') {
                                // For AbortError, check if the audio is actually playing
                                if (this.audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                                    this.isPlaying = true;
                                    document.querySelector('.player-bar').classList.remove('loading');
                                    document.querySelector('.static').classList.add('hidden');
                                    this.updateUI();
                                    return;
                                }
                                // If not playing yet, just return without showing error
                                return;
                            }
                            
                            if (!hasShownError) {
                                console.error('Error playing station:', error);
                                this.isPlaying = false;
                                this.currentStation = null;
                                document.querySelector('.player-bar').classList.remove('loading');
                                document.querySelector('.static').classList.add('hidden');
                                showNotification('Unable to play this station. It may be unavailable or use an unsupported format.', 'error');
                                this.updateUI();
                                hasShownError = true;
                            }
                        });
                        return;
                    }

                    // Check if it's an AbortError
                    if (error && error.name === 'AbortError') {
                        // For AbortError, check if the audio is actually playing
                        if (this.audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                            this.isPlaying = true;
                            document.querySelector('.player-bar').classList.remove('loading');
                            document.querySelector('.static').classList.add('hidden');
                            this.updateUI();
                            return;
                        }
                        // If not playing yet, just return without showing error
                        return;
                    }

                    if (!hasShownError) {
                        console.error('Error playing station:', error);
                        this.isPlaying = false;
                        this.currentStation = null;
                        document.querySelector('.player-bar').classList.remove('loading');
                        document.querySelector('.static').classList.add('hidden');
                        showNotification('Unable to play this station. It may be unavailable or use an unsupported format.', 'error');
                        this.updateUI();
                        hasShownError = true;
                    }
                });
        }
    }

    togglePlay() {
        if (!this.currentStation) return;

        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            this.stopListeningTimeTracking();
        } else {
            this.audio.play();
            this.isPlaying = true;
            this.startListeningTimeTracking();
        }

        // Update UI
        this.updateUI();
    }

    setVolume(value) {
        this.volume = parseInt(value, 10); // Store the volume value
        if (this.audio) {
            this.audio.volume = this.volume / 100;
        }
    }

    handleStreamEnd() {
        this.isPlaying = false;
        this.updateUI();
    }

    updateUI() {
        const playPauseBtn = document.getElementById('play-pause');
        const stationName = document.getElementById('station-name');
        const stationDetails = document.getElementById('station-details');
        const currentFaviconContainer = document.getElementById('current-favicon-container');
        
        // Always refresh the button reference to ensure we have the latest one
        this.playPauseBtn = document.getElementById('play-pause');
        const playPauseIcon = this.playPauseBtn ? this.playPauseBtn.querySelector('.material-symbols-rounded') : null;
        
        if (this.currentStation) {
            // Update <title> with station name
            document.title = `📡 ${this.currentStation.name} on NMFR`;
            
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
            if (currentFaviconContainer) {
                // Clear the container
                currentFaviconContainer.innerHTML = '';
                
                if (this.currentStation.favicon) {
                    // Create new image element
                    const img = document.createElement('img');
                    img.id = 'current-favicon';
                    img.className = 'current-favicon';
                    img.src = this.currentStation.favicon;
                    img.alt = `${this.currentStation.name} logo`;
                    img.onerror = () => {
                        // If favicon fails to load, show a default icon
                        currentFaviconContainer.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z" fill="#D9D9D9"/><path d="M13 13H10V12H12V10H13V13Z" fill="#D9D9D9"/><path d="M13 8H12V9H11V10H9V6H13V8Z" fill="#1500FF"/><path d="M4 8H5V10H7V11H6V12H3V7H4V8Z" fill="#FF0000"/><path d="M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z" fill="#0DFF00"/></svg>`;
                    };
                    currentFaviconContainer.appendChild(img);
                } else {
                    // No favicon available, show default icon
                    currentFaviconContainer.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z" fill="#D9D9D9"/><path d="M13 13H10V12H12V10H13V13Z" fill="#D9D9D9"/><path d="M13 8H12V9H11V10H9V6H13V8Z" fill="#1500FF"/><path d="M4 8H5V10H7V11H6V12H3V7H4V8Z" fill="#FF0000"/><path d="M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z" fill="#0DFF00"/></svg>`;
                }
            }
            
            // Update play/pause icon
            if (playPauseIcon) {
                if (document.querySelector('.player-bar').classList.contains('loading')) {
                    playPauseIcon.textContent = 'progress_activity';
                    playPauseIcon.classList.add('spinning');
                } else {
                    playPauseIcon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
                    playPauseIcon.classList.remove('spinning');
                }
            }
        } else {
            // Update <title> with station name
            document.title = `Not My First Radio`;
            // Reset UI when no station is selected
            stationName.textContent = 'Select a station';
            stationDetails.textContent = '';
            if (currentFaviconContainer) {
                currentFaviconContainer.innerHTML = '';
            }
            
            if (playPauseIcon) {
                playPauseIcon.textContent = 'play_arrow';
                playPauseIcon.classList.remove('spinning');
            }
        }
        
        // Update station cards to reflect current playing state
        this.displayStations();
        this.displayStationLists();

        // Add visualizer button if not already present
        if (!document.querySelector('.visualizer-btn') && debug) {
            const visualizerBtn = document.createElement('button');
            visualizerBtn.className = 'control-btn visualizer-btn';
            visualizerBtn.style.width = '32px';
            visualizerBtn.style.height = '32px';
            visualizerBtn.setAttribute('aria-label', 'Open visualizer');
            visualizerBtn.setAttribute('alt', 'Open visualizer');
            visualizerBtn.title = 'Open visualizer';
            visualizerBtn.innerHTML = '<img style="width: 100%; height: 100%;" src="icons/visualizer-icon.svg" alt="Visualizer">';
            visualizerBtn.onclick = () => this.toggleVisualizer();
            this.playerControls.insertBefore(visualizerBtn, this.volumeControl);
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
        
        // Remove existing lists container if it exists
        const existingLists = savedStationsSection.querySelector('.station-lists');
        if (existingLists) {
            existingLists.remove();
        }
        
        // If no station lists, return early
        if (!this.stationLists || this.stationLists.length === 0) {
            return;
        }
        
        const listsContainer = document.createElement('div');
        listsContainer.className = 'station-lists';

        this.stationLists.forEach((list, index) => {
            const listElement = document.createElement('div');
            listElement.className = 'station-list';
            listElement.innerHTML = `
                <div class="list-header">
                    <h2 class="section-title">${list.name || 'Shared Stations'}</h2>
                </div>
                <div class="list-stations"></div>
            `;

            const stationsContainer = listElement.querySelector('.list-stations');
            
            if (!list.stations || list.stations.length === 0) {
                stationsContainer.innerHTML = '<p class="no-stations">No stations in this list.</p>';
            } else {
                list.stations.forEach(station => {
                    // Check if this station is the currently playing one
                    const isCurrentlyPlaying = this.currentStation && 
                                             this.isPlaying && 
                                             this.currentStation.url === station.url;
                    
                    const stationElement = document.createElement('div');
                    stationElement.className = 'station-card' + (isCurrentlyPlaying ? ' playing' : '');
                    stationElement.dataset.url = station.url;
                    stationElement.innerHTML = `
                        <div class="station-info">
                            <div class="station-favicon">
                                ${station.favicon ? 
                                    `<img src="${station.favicon}" alt="${station.name} logo" onerror="this.outerHTML='<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 16 16\\' fill=\\'none\\' xmlns=\\'http://www.w3.org/2000/svg\\'><path d=\\'M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z\\' fill=\\'#D9D9D9\\'/><path d=\\'M13 13H10V12H12V10H13V13Z\\' fill=\\'#D9D9D9\\'/><path d=\\'M13 8H12V9H11V10H9V6H13V8Z\\' fill=\\'#1500FF\\'/><path d=\\'M4 8H5V10H7V11H6V12H3V7H4V8Z\\' fill=\\'#FF0000\\'/><path d=\\'M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z\\' fill=\\'#0DFF00\\'/></svg>'">` : 
                                    `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z" fill="#D9D9D9"/><path d="M13 13H10V12H12V10H13V13Z" fill="#D9D9D9"/><path d="M13 8H12V9H11V10H9V6H13V8Z" fill="#1500FF"/><path d="M4 8H5V10H7V11H6V12H3V7H4V8Z" fill="#FF0000"/><path d="M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z" fill="#0DFF00"/></svg>`
                                }
                            </div>
                            <div class="station-details">
                                <div class="station-name-container">
                                    <h3>${station.name}</h3>
                                    <div class="now-playing-icon">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M3 14V15H1V14H3Z" fill="#00FFA2"/>
                                            <path d="M6 14V15H4V14H6Z" fill="#00FFA2"/>
                                            <path d="M9 14V15H7V14H9Z" fill="#00FFA2"/>
                                            <path d="M12 14V15H10V14H12Z" fill="#00FFA2"/>
                                            <path d="M15 14V15H13V14H15Z" fill="#00FFA2"/>
                                            <path d="M3 13V14H1V13H3Z" fill="#00FFA2"/>
                                            <path d="M6 13V14H4V13H6Z" fill="#00FFA2"/>
                                            <path d="M9 13V14H7V13H9Z" fill="#00FFA2"/>
                                            <path d="M12 13V14H10V13H12Z" fill="#00FFA2"/>
                                            <path d="M15 13V14H13V13H15Z" fill="#00FFA2"/>
                                            <path d="M6 12V13H4V12H6Z" fill="#00FFA2"/>
                                            <path d="M3 12V13H1V12H3Z" fill="#00FFA2"/>
                                            <path d="M9 12V13H7V12H9Z" fill="#00FFA2"/>
                                            <path d="M12 12V13H10V12H12Z" fill="#00FFA2"/>
                                            <path d="M15 12V13H13V12H15Z" fill="#00FFA2"/>
                                            <path d="M6 11V12H4V11H6Z" fill="#00FFA2"/>
                                            <path d="M3 11V12H1V11H3Z" fill="#00FFA2"/>
                                            <path d="M12 11V12H10V11H12Z" fill="#00FFA2"/>
                                            <path d="M9 11V12H7V11H9Z" fill="#00FFA2"/>
                                            <path d="M15 11V12H13V11H15Z" fill="#00FFA2"/>
                                            <path d="M3 10V11H1V10H3Z" fill="#00FFA2"/>
                                            <path d="M6 10V11H4V10H6Z" fill="#00FFA2"/>
                                            <path d="M9 10V11H7V10H9Z" fill="#00FFA2"/>
                                            <path d="M15 10V11H13V10H15Z" fill="#00FFA2"/>
                                            <path d="M12 10V11H10V10H12Z" fill="#00FFA2"/>
                                            <path d="M3 9V10H1V9H3Z" fill="#00FFA2"/>
                                            <path d="M6 9V10H4V9H6Z" fill="#00FFA2"/>
                                            <path d="M12 9V10H10V9H12Z" fill="#00FFA2"/>
                                            <path d="M9 9V10H7V9H9Z" fill="#00FFA2"/>
                                            <path d="M15 9V10H13V9H15Z" fill="#00FFA2"/>
                                            <path d="M6 8V9H4V8H6Z" fill="#00FFA2"/>
                                            <path d="M3 8V9H1V8H3Z" fill="#00FFA2"/>
                                            <path d="M12 8V9H10V8H12Z" fill="#00FFA2"/>
                                            <path d="M9 8V9H7V8H9Z" fill="#00FFA2"/>
                                            <path d="M15 8V9H13V8H15Z" fill="#00FFA2"/>
                                            <path d="M6 7V8H4V7H6Z" fill="#00FFA2"/>
                                            <path d="M3 7V8H1V7H3Z" fill="#00FFA2"/>
                                            <path d="M12 7V8H10V7H12Z" fill="#00FFA2"/>
                                            <path d="M9 7V8H7V7H9Z" fill="#00FFA2"/>
                                            <path d="M15 7V8H13V7H15Z" fill="#00FFA2"/>
                                            <path d="M3 6V7H1V6H3Z" fill="#00FFA2"/>
                                            <path d="M6 6V7H4V6H6Z" fill="#00FFA2"/>
                                            <path d="M9 6V7H7V6H9Z" fill="#00FFA2"/>
                                            <path d="M15 6V7H13V6H15Z" fill="#00FFA2"/>
                                            <path d="M12 6V7H10V6H12Z" fill="#00FFA2"/>
                                            <path d="M3 5V6H1V5H3Z" fill="#00FFA2"/>
                                            <path d="M6 5V6H4V5H6Z" fill="#00FFA2"/>
                                            <path d="M9 5V6H7V5H9Z" fill="#00FFA2"/>
                                            <path d="M12 5V6H10V5H12Z" fill="#00FFA2"/>
                                            <path d="M15 5V6H13V5H15Z" fill="#00FFA2"/>
                                            <path d="M6 4V5H4V4H6Z" fill="#00FFA2"/>
                                            <path d="M3 4V5H1V4H3Z" fill="#00FFA2"/>
                                            <path d="M9 4V5H7V4H9Z" fill="#00FFA2"/>
                                            <path d="M15 4V5H13V4H15Z" fill="#00FFA2"/>
                                            <path d="M12 4V5H10V4H12Z" fill="#00FFA2"/>
                                            <path d="M6 3V4H4V3H6Z" fill="#00FFA2"/>
                                            <path d="M3 3V4H1V3H3Z" fill="#00FFA2"/>
                                            <path d="M12 3V4H10V3H12Z" fill="#00FFA2"/>
                                            <path d="M9 3V4H7V3H9Z" fill="#00FFA2"/>
                                            <path d="M15 3V4H13V3H15Z" fill="#00FFA2"/>
                                            <path d="M6 2V3H4V2H6Z" fill="#00FFA2"/>
                                            <path d="M3 2V3H1V2H3Z" fill="#00FFA2"/>
                                            <path d="M12 2V3H10V2H12Z" fill="#00FFA2"/>
                                            <path d="M9 2V3H7V2H9Z" fill="#00FFA2"/>
                                            <path d="M15 2V3H13V2H15Z" fill="#00FFA2"/>
                                            <path d="M15 1V2H13V1H15Z" fill="#9E66F2"/>
                                            <path d="M12 1V2H10V1H12Z" fill="#9E66F2"/>
                                            <path d="M9 1V2H7V1H9Z" fill="#9E66F2"/>
                                            <path d="M6 1V2H4V1H6Z" fill="#9E66F2"/>
                                            <path d="M3 1V2H1V1H3Z" fill="#9E66F2"/>
                                        </svg>
                                    </div>
                                </div>
                                <div class="station-meta">
                                    ${station.bitrate ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 9V10H3V9H5Z" fill="#47B5FF"/><path d="M6 11H2V8H6V11ZM5 9H3V10H5V9Z" fill="#477EFF"/><path d="M11 10V11H7V10H11V9ZM11 9H7V8H11V9Z" fill="#262626"/><path d="M14 14H13V7H14V6H15V13H14V14Z" fill="#D29A00"/><path d="M12 15H1V7H12V15ZM2 13H3V12H2V13ZM4 13H5V12H4V13ZM6 13H9V12H6V13ZM10 13H11V12H10V13ZM2 11H6V8H2V11ZM7 11H11V10H7V11ZM7 9H11V8H7V9Z" fill="#FFC933"/><path d="M3 13H2V12H3V13ZM5 13H4V12H5V13ZM7 13H6V12H7V13ZM9 13H8V12H9V13ZM11 13H10V12H11V13Z" fill="#6D6D6D"/><path d="M4 14H3V13H4V14ZM6 14H5V13H6V14ZM8 14H7V13H8V14ZM10 14H9V13H10V14Z" fill="#6D6D6D"/><path d="M13 4V5H14V6H1V5H2V4H13Z" fill="#FFE59E"/><path d="M14 7H13V14H14V15H13V16H1V15H12V7H1V15H0V6H14V7ZM15 14H14V13H15V14ZM8 13H7V12H8V13ZM16 13H15V5H16V13Z" fill="#FFC933"/><path d="M15 6H14V5H13V4H15V6ZM13 4H11V3H13V4ZM11 3H9V2H11V3ZM9 2H7V1H9V2ZM7 1H5V0H7V1Z" fill="#DCDCDC"/></svg>${station.bitrate}kbps</span>` : ''}
                                    ${station.countrycode ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3H9V5H10V6H8V5H6V6H5V7H6V8H10V9H11V11H12V12H13V14H11V15H8V12H6V11H5V9H4V7H3V6H1V5H2V3H3V2H5V1H10V3Z" fill="#1C6800"/><path d="M1 6H3V7H4V9H5V11H6V12H8V15H11V16H5V15H3V14H2V13H1V11H0V5H1V6ZM13 15H11V14H13V15ZM11 1H13V2H14V3H15V5H16V11H15V13H14V14H13V12H12V11H11V9H10V8H6V7H5V6H6V5H8V6H10V5H9V3H10V1H5V0H11V1ZM2 5H1V3H2V5ZM3 3H2V2H3V3ZM5 2H3V1H5V2Z" fill="#477EFF"/></svg>${station.countrycode}</span>` : ''}
                                    ${station.votes ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10H10V11H11V14H10V15H9V16H7V15H6V14H5V11H6V10H7V9H9V10Z" fill="#FFC933"/><path d="M5 16H4V15H5V16ZM12 16H11V15H12V16ZM4 15H3V14H4V15ZM13 15H12V14H13V15ZM7 1H8V3H9V4H12V3H13V4H14V5H15V7H16V11H15V13H14V14H13V11H12V9H11V8H9V7H6V8H5V9H4V10H3V14H2V13H1V11H0V7H1V5H2V4H3V3H4V2H5V1H6V0H7V1Z" fill="#FF5E00"/></svg>${station.votes}</span>` : ''}
                                </div>
                                ${station.note ? `<div class="station-note">${station.note}</div>` : ''}
                            </div>
                        </div>
                        <div class="station-controls">
                            ${isCurrentlyPlaying ? 
                                `<button class="stop-btn">
                                    <span class="material-symbols-rounded">stop</span>
                                </button>` : 
                                `<button class="play-btn">
                                    <span class="material-symbols-rounded">play_arrow</span>
                                </button>`
                            }
                            <button class="more-btn" title="More actions">
                                <span class="material-symbols-rounded">more_vert</span>
                            </button>
                            <div class="station-menu-overlay hidden"></div>
                            <div class="station-menu hidden">
                                <div class="station-menu-info">
                                    <div class="station-menu-name">${station.name}</div>
                                    <div class="station-menu-data">
                                        <div class="station-menu-data-item"><span class="material-symbols-rounded">radio</span>${station.bitrate ? `${station.bitrate}kbps` : ''}</div>
                                        <div class="station-menu-data-item"><span class="material-symbols-rounded">public</span>${station.countrycode ? `${station.countrycode}` : ''}</div>
                                        <div class="station-menu-data-item"><span class="material-symbols-rounded">local_fire_department</span>${station.votes ? `${station.votes}` : ''}</div>
                                    </div>
                                </div>
                                <button class="menu-share"><span class="material-symbols-rounded">share</span> Share</button>
                                <button class="menu-move"><span class="material-symbols-rounded">content_copy</span> Copy to your radio</button>
                                <button class="menu-homepage"><span class="material-symbols-rounded">open_in_new</span> Visit website</button>
                                <button class="menu-delete"><span class="material-symbols-rounded">delete</span> Delete</button>
                            </div>
                        </div>
                    </div>
                `;

                    stationsContainer.appendChild(stationElement);
                });
            }

            listsContainer.appendChild(listElement);
        });

        // Add the new lists container
        savedStationsSection.appendChild(listsContainer);
        this.addSharedStationEventListeners();
        
        // Add event listeners for list edit buttons
        document.querySelectorAll('.list-control-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const listIndex = btn.dataset.listIndex;
                const list = this.stationLists[listIndex];
                if (!list) return;
                
                const listElement = btn.closest('.station-list');
                const stationsContainer = listElement.querySelector('.list-stations');
                
                // Toggle edit mode for this list
                stationsContainer.classList.toggle('edit-mode');
                btn.classList.toggle('active');
            });
        });
    }

    moveStationToUserList(url) {
        // Find the station in the shared lists
        let foundStation = null;
        for (const list of this.stationLists) {
            foundStation = list.stations.find(s => s.url === url);
            if (foundStation) break;
        }
        if (!foundStation) {
            showNotification('Station not found in shared lists.', 'error');
            return;
        }
        // Check for duplicates in user's own list
        const exists = this.stations.some(s => s.url === foundStation.url);
        if (exists) {
            showNotification('Station already exists in your list.', 'warning');
            return;
        }
        // Create new station object with only required fields
        const stationData = {
            name: foundStation.name,
            url: foundStation.url,
            favicon: foundStation.favicon,
            homepage: foundStation.homepage,
            bitrate: foundStation.bitrate,
            countrycode: foundStation.countrycode,
            votes: foundStation.votes,
            note: foundStation.note,
            stationuuid: foundStation.stationuuid,
            tags: foundStation.tags
        };
        // Add to user's own list
        this.stations.push(stationData);
        this.saveStations();
        this.displayStations();
        showNotification('Station moved to your list!', 'success');
    }

    removeStationFromSharedList(url) {
        try {
            // Find which list contains the station
            let listIndex = -1;
            let stationIndex = -1;
            
            for (let i = 0; i < this.stationLists.length; i++) {
                const list = this.stationLists[i];
                const index = list.stations.findIndex(s => s.url === url);
                if (index !== -1) {
                    listIndex = i;
                    stationIndex = index;
                    break;
                }
            }

            if (listIndex === -1 || stationIndex === -1) {
                showNotification('Station not found in shared lists.', 'error');
                return;
            }

            // If the station being removed is currently playing, stop it
            if (this.currentStation && this.currentStation.url === url) {
                this.audio.pause();
                this.isPlaying = false;
                this.currentStation = null;
                this.updateUI();
            }

            // Remove the station from the shared list
            this.stationLists[listIndex].stations.splice(stationIndex, 1);

            // If the list is now empty, remove it
            if (this.stationLists[listIndex].stations.length === 0) {
                this.stationLists.splice(listIndex, 1);
            }

            // Save and update the display
            this.saveStationLists();
            this.displayStationLists();

            // Show success notification
            showNotification('Station removed from shared list.', 'success');
        } catch (error) {
            console.error('Error removing station from shared list:', error);
            showNotification('Error removing station. Please try again.', 'error');
        }
    }

    toggleVisualizer() {
        if (this.visualizer && this.visualizer.isActive) {
            this.visualizer.close();
        } else if (this.audio && this.currentStation) {
            this.visualizer = new AudioVisualizer(this.audio, {
                name: this.currentStation.name,
                details: this.currentStation.details
            });
            this.visualizer.init();
            
            // Track visualizer achievement
            if (window.achievementSystem) {
                window.achievementSystem.trackProgress('visualizerUsed', 1);
            }
        }
    }
    
    // Listening time tracking methods
    startListeningTimeTracking() {
        this.listeningStartTime = Date.now();
        
        // Clear any existing interval
        if (this.listeningTimeInterval) {
            clearInterval(this.listeningTimeInterval);
        }
        
        // Track listening time every 30 seconds
        this.listeningTimeInterval = setInterval(() => {
            if (this.isPlaying && this.listeningStartTime) {
                const currentTime = Date.now();
                const sessionTime = currentTime - this.listeningStartTime;
                
                if (window.achievementSystem) {
                    window.achievementSystem.trackProgress('listeningTime', sessionTime);
                }
                
                // Reset start time for next interval
                this.listeningStartTime = currentTime;
            }
        }, 30000); // Track every 30 seconds
    }
    
    stopListeningTimeTracking() {
        if (this.listeningTimeInterval) {
            clearInterval(this.listeningTimeInterval);
            this.listeningTimeInterval = null;
        }
        
        // Track final session time
        if (this.listeningStartTime) {
            const sessionTime = Date.now() - this.listeningStartTime;
            if (window.achievementSystem) {
                window.achievementSystem.trackProgress('listeningTime', sessionTime);
            }
            this.listeningStartTime = null;
        }
    }
}

// Initialize the radio player
const radioPlayer = new RadioPlayer();

// Initialize achievement tracking for existing data
document.addEventListener('DOMContentLoaded', () => {
    if (window.achievementSystem) {
        // Check existing username
        const savedUsername = localStorage.getItem('radio-username');
        if (savedUsername && savedUsername.trim()) {
            window.achievementSystem.trackProgress('usernameSet');
        }
        
        // Check existing stations for achievement tracking
        const savedStations = localStorage.getItem('radio-stations');
        if (savedStations) {
            try {
                const stations = JSON.parse(savedStations);
                if (Array.isArray(stations)) {
                    stations.forEach(station => {
                        window.achievementSystem.trackProgress('stationAdded', 1, {
                            countrycode: station.countrycode,
                            tags: station.tags,
                            bitrate: station.bitrate,
                            isManual: false
                        });
                    });
                }
            } catch (error) {
                console.error('Error processing existing stations for achievements:', error);
            }
        }
    }
});

// Debug: Check localStorage on page load
window.addEventListener('load', () => {
    // Ensure stations are displayed after page load
    radioPlayer.displayStations();
    
    // Check for shared station in URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    
    if (shareParam) {
        const importLoading = document.getElementById('import-loading-indicator');
        if (importLoading) importLoading.style.display = 'flex';
        try {
            const shareData = JSON.parse(decodeURIComponent(shareParam));
            
            // Validate shared data
            if (!shareData || !shareData.i || !Array.isArray(shareData.i) || shareData.i.length === 0) {
                if (importLoading) importLoading.style.display = 'none';
                showNotification('Invalid sharing link.', 'error');
                return;
            }
            
            // Show loading notification
            showNotification('Fetching shared stations...', 'success');
            
            // Fetch all station details in parallel
            Promise.all(shareData.i.map(async (identifier) => {
                try {
                    // If the identifier is an object, it's a manually added station
                    if (typeof identifier === 'object') {
                        return identifier;
                    }
                    // If the identifier is a URL, create a station object directly
                    if (identifier.startsWith('http')) {
                        return {
                            url: identifier,
                            name: identifier.split('/').pop() || 'Unknown Station',
                            favicon: '',
                            homepage: '',
                            bitrate: '',
                            countrycode: '',
                            votes: 0
                        };
                    }
                    // Otherwise, fetch from Radio Browser API
                    const stations = await fetchFromRadioBrowser(`stations/byuuid/${identifier}`);
                    return stations && stations.length > 0 ? stations[0] : null;
                } catch {
                    return null;
                }
            })).then(stationObjs => {
                if (importLoading) importLoading.style.display = 'none';
                const validStations = stationObjs.filter(Boolean);
                if (validStations.length === 0) {
                    showNotification('No valid stations found in the sharing link.', 'error');
                    return;
                }
                const sharedUsername = shareData.u || 'Unknown User';
                showQrImportOptions({
                    title: 'Import Shared Stations',
                    message: `Found ${validStations.length} stations shared by ${sharedUsername}.`
                }).then(importOption => {
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
                            radioPlayer.saveStations();
                            radioPlayer.displayStations();
                            showNotification('Stations added successfully!', 'success');
                            break;
                        case '3':
                            // Add as separate list
                            const newList = {
                                name: `${sharedUsername}'s Shared Stations`,
                                stations: validStations
                            };
                            radioPlayer.stationLists.push(newList);
                            radioPlayer.saveStationLists();
                            radioPlayer.displayStationLists();
                            showNotification('Stations added as a new list!', 'success');
                            break;
                    }
                }).catch(() => {
                    if (importLoading) importLoading.style.display = 'none';
                    showNotification('Error fetching shared stations.', 'error');
                });
            }).catch(() => {
                if (importLoading) importLoading.style.display = 'none';
                showNotification('Error fetching shared stations.', 'error');
            });
            
            // Remove the share parameter from URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } catch (error) {
            if (importLoading) importLoading.style.display = 'none';
            console.error('Error parsing shared data:', error);
            showNotification('Invalid sharing link.', 'error');
        }
    }
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
    
    // Track username achievement
    if (window.achievementSystem) {
        window.achievementSystem.trackProgress('usernameSet');
    }
    
    showNotification('Username updated successfully!', 'success');
});

// QR Code functionality
const qrModal = document.getElementById('qr-modal');
const shareQrBtn = document.getElementById('share-qr');
const closeQrBtn = document.getElementById('close-qr');
const qrCodeContainer = document.getElementById('qr-code');

// Load QR code libraries
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
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

// Try loading from multiple CDNs
const qrcodeUrls = [
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
];

async function loadLibraries() {
    let qrcodeLoaded = false;

    // Try loading QR code library from multiple sources
    for (const url of qrcodeUrls) {
        try {
            await loadScript(url);
            qrcodeLoaded = true;
            break;
        } catch (error) {
            console.warn(`Failed to load QR code library from ${url}, trying next source...`);
        }
    }

    if (!qrcodeLoaded) {
        throw new Error('Failed to load required QR code libraries. Please check your internet connection and try refreshing the page.');
    }

    qrcodeReady = true;
}

loadLibraries()
    .then(() => {
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
shareQrBtn.addEventListener('click', async () => {
    if (!qrcodeReady) {
        showNotification('QR code functionality is still loading. Please try again in a moment.', 'warning');
        return;
    }

    if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
        showNotification('No stations to share.', 'warning');
        return;
    }

    try {
        // Create shareable URL
        const shareData = {
            u: currentUsername,
            i: radioPlayer.stations.map(station => station.stationuuid).filter(uuid => uuid)
        };
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(JSON.stringify(shareData))}`;

        try {
            // Call your shortener API
            const response = await fetch('https://s.notmyfirstradio.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ longUrl: shareUrl })
            });
            const data = await response.json();
            if (data.shortUrl) {
                // Clear any existing QR code
                qrCodeContainer.innerHTML = '';
                
                // Create new QR code with mobile-optimized settings
                new QRCode(qrCodeContainer, {
                    text: data.shortUrl,
                    width: 256,
                    height: 256,
                    colorDark: '#000000', // Pure black for better contrast
                    colorLight: '#ffffff', // Pure white for better contrast
                    correctLevel: QRCode.CorrectLevel.H, // Higher error correction for better scanning
                    quietZone: 15, // Add quiet zone around QR code
                    quietZoneColor: '#ffffff' // White quiet zone
                });
                
                // Add a white background container for better contrast
                qrCodeContainer.style.backgroundColor = '#ffffff';
                qrCodeContainer.style.padding = '15px';
                qrCodeContainer.style.borderRadius = '8px';
                
                // Track QR share achievement
                if (window.achievementSystem) {
                    window.achievementSystem.trackProgress('qrShare', 1);
                }
                
                qrModal.classList.remove('hidden');
            } else {
                throw new Error('No shortUrl in response');
            }
        } catch (err) {
            // Fallback to long URL if shortener fails
            // Clear any existing QR code
            qrCodeContainer.innerHTML = '';
            
            // Create new QR code with mobile-optimized settings
            new QRCode(qrCodeContainer, {
                text: shareUrl,
                width: 256,
                height: 256,
                colorDark: '#000000', // Pure black for better contrast
                colorLight: '#ffffff', // Pure white for better contrast
                correctLevel: QRCode.CorrectLevel.H, // Higher error correction for better scanning
                quietZone: 15, // Add quiet zone around QR code
                quietZoneColor: '#ffffff' // White quiet zone
            });
            
            // Add a white background container for better contrast
            qrCodeContainer.style.backgroundColor = '#ffffff';
            qrCodeContainer.style.padding = '15px';
            qrCodeContainer.style.borderRadius = '8px';
            
            qrModal.classList.remove('hidden');
        }
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
    
    // Add preview button if station is provided
    if (options.station) {
        const previewBtn = document.createElement('button');
        previewBtn.className = 'qr-import-btn preview';
        previewBtn.innerHTML = `
            <span class="material-symbols-rounded">play_arrow</span>
            Preview Station
        `;
        
        // Insert preview button before merge button
        mergeBtn.parentNode.insertBefore(previewBtn, mergeBtn);
        
        // Add preview functionality
        const handlePreview = (e) => {
            e.preventDefault(); // Prevent scrolling on mobile
            
            // Stop any currently playing preview
            if (previewAudio) {
                previewAudio.pause();
                previewAudio = null;
            }
            
            // Create new audio element for preview
            previewAudio = new Audio(options.station.url);
            previewAudio.volume = 0.5;
            
            // Update button state
            const icon = previewBtn.querySelector('.material-symbols-rounded');
            
            // Toggle play/pause
            if (icon.textContent === 'play_arrow') {
                // Play
                previewAudio.play()
                    .then(() => {
                        icon.textContent = 'pause';
                    })
                    .catch(error => {
                        console.error('Error playing preview:', error);
                        icon.textContent = 'play_arrow';
                        
                        if (error.name === 'NotSupportedError') {
                            showNotification('This station\'s stream is not supported.', 'error');
                        } else {
                            showNotification('Error playing preview. The station might be unavailable.', 'error');
                        }
                    });
            } else {
                // Pause
                previewAudio.pause();
                icon.textContent = 'play_arrow';
            }
            
            // Add event listener for when preview ends
            previewAudio.addEventListener('ended', () => {
                previewAudio = null;
                icon.textContent = 'play_arrow';
            });
            
            // Add event listener for when audio is paused
            previewAudio.addEventListener('pause', () => {
                icon.textContent = 'play_arrow';
            });
            
            // Add event listener for when audio is playing
            previewAudio.addEventListener('play', () => {
                icon.textContent = 'pause';
            });
        };

        // Add click and touch event listeners
        previewBtn.addEventListener('click', handlePreview);
        previewBtn.addEventListener('touchstart', handlePreview);
    }
    
    // Show modal
    modal.classList.add('visible');
    
    // Return a promise that resolves with the user's choice
    return new Promise((resolve) => {
        const handleChoice = (choice) => {
            // Stop any playing preview when closing
            if (previewAudio) {
                previewAudio.pause();
                previewAudio = null;
            }
            
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



// Search functionality
const searchInput = document.getElementById('search-input');
const clearInputBtn = document.getElementById('clear-input');
const searchResults = document.getElementById('search-results');
const clearResultsBtn = document.getElementById('clear-results');
const sortSelect = document.getElementById('sort-results');
let previewAudio = null;
let searchTimeout = null;
let currentSearchResults = []; // Store current search results for sorting
const SEARCH_DELAY = 500; // milliseconds delay for search after user stops typing
const SEARCH_LIMIT = 40000; // Limit the number of search results
const RESULTS_PER_PAGE = 10; // Number of results to show per page
let currentPage = 1; // Current page number

// Load saved sort preference
const savedSortPreference = localStorage.getItem('sortPreference') || 'default';
sortSelect.value = savedSortPreference;

// Add event listener for sort selection changes
sortSelect.addEventListener('change', () => {
    if (currentSearchResults.length > 0) {
        // Save the new preference
        localStorage.setItem('sortPreference', sortSelect.value);
        displaySortedResults(sortSelect.value);
    }
});

// Function to sort stations
function sortStations(stations, sortBy) {
    if (!stations) return [];
    
    // Create a copy of the array to avoid modifying the original
    const sortedStations = [...stations];
    
    switch (sortBy) {
        case 'bitrate':
            return sortedStations.sort((a, b) => {
                const bitrateA = parseInt(a.bitrate) || 0;
                const bitrateB = parseInt(b.bitrate) || 0;
                return bitrateB - bitrateA; // High to low
            });
        case 'votes':
            return sortedStations.sort((a, b) => {
                const votesA = parseInt(a.votes) || 0;
                const votesB = parseInt(b.votes) || 0;
                return votesB - votesA; // High to low
            });
        case 'countrycode':
            return sortedStations.sort((a, b) => {
                const hasCountryA = Boolean(a.countrycode);
                const hasCountryB = Boolean(b.countrycode);
                
                // If one has a country code and the other doesn't, put the one with country code first
                if (hasCountryA !== hasCountryB) {
                    return hasCountryB ? 1 : -1;
                }
                
                // If both have country codes or both don't, sort alphabetically
                const countryA = (a.countrycode || '').toLowerCase();
                const countryB = (b.countrycode || '').toLowerCase();
                return countryA.localeCompare(countryB);
            });
        case 'default':
            return sortedStations.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        case 'none':
            return sortedStations; // Return unsorted results
        default:
            return sortedStations;
    }
}

// Function to clear search results
function clearSearchResults() {
    const searchResultsSection = document.getElementById('search-results');
    searchResultsSection.classList.add('hidden');
    const resultsGrid = searchResultsSection.querySelector('.results-grid');
    resultsGrid.innerHTML = '';
    
    // If there's a preview playing, transition it to the main player
    if (previewAudio) {
        const currentUrl = previewAudio.src;
        const currentVolume = previewAudio.volume;
        
        // Find the station in the user's list
        const station = radioPlayer.stations.find(s => s.url === currentUrl);
        if (station) {
            // Stop the preview
            previewAudio.pause();
            previewAudio = null;
            
            // Start playing in the main player
            radioPlayer.playStation(station);
            radioPlayer.setVolume(currentVolume * 100); // Convert back to percentage
        } else {
            // If station not found in user's list, just stop the preview
            previewAudio.pause();
            previewAudio = null;
        }
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

// Common music genres and their variations
const GENRE_MAPPINGS = {
    'rock': ['rock', 'rock and roll', 'rock n roll', 'rock\'n\'roll', 'rock & roll'],
    'jazz': ['jazz', 'jazz music', 'jazz radio'],
    'classical': ['classical', 'classical music', 'orchestral', 'symphony'],
    'pop': ['pop', 'pop music', 'popular music'],
    'hip hop': ['hip hop', 'hiphop', 'rap', 'rap music'],
    'electronic': ['electronic', 'electronic music', 'edm', 'electronic dance music'],
    'country': ['country', 'country music', 'country and western'],
    'blues': ['blues', 'blues music'],
    'folk': ['folk', 'folk music', 'traditional folk'],
    'metal': ['metal', 'heavy metal', 'metal music'],
    'reggae': ['reggae', 'reggae music'],
    'rnb': ['rnb', 'r&b', 'rhythm and blues', 'rhythm & blues'],
    'soul': ['soul', 'soul music'],
    'indie': ['indie', 'indie music', 'independent music'],
    'punk': ['punk', 'punk rock', 'punk music'],
    'dance': ['dance', 'dance music', 'dance radio'],
    'latin': ['latin', 'latin music', 'latin radio'],
    'world': ['world', 'world music', 'international'],
    'ambient': ['ambient', 'ambient music'],
    'drum and bass': ['drum and bass', 'dnb', 'drum n bass', 'drum & bass'],
    'house': ['house', 'house music'],
    'techno': ['techno', 'techno music'],
    'trance': ['trance', 'trance music'],
    'disco': ['disco', 'disco music'],
    'funk': ['funk', 'funk music']
};

// Function to detect genres in a search query
function detectGenres(query) {
    const lowerQuery = query.toLowerCase();
    const detectedGenres = new Set();
    
    // First check for explicit genre: format
    const explicitGenreMatch = lowerQuery.match(/(?:genre|tag):([^,\s]+)/i);
    if (explicitGenreMatch) {
        detectedGenres.add(explicitGenreMatch[1]);
        return Array.from(detectedGenres);
    }
    
    // Then check for genre keywords
    for (const [genre, variations] of Object.entries(GENRE_MAPPINGS)) {
        if (variations.some(variation => lowerQuery.includes(variation))) {
            detectedGenres.add(genre);
        }
    }
    
    return Array.from(detectedGenres);
}

// Search for stations
async function searchStations(query) {
    if (!query.trim()) {
        clearSearchResults();
        return;
    }
    
    // Track search achievement
    if (window.achievementSystem) {
        window.achievementSystem.trackProgress('search', 1);
    }
    
    // Reset to first page when performing a new search
    currentPage = 1;
    
    try {
        // Parse the query to extract potential search parameters
        const searchParams = new URLSearchParams();
        
        // Check if query contains country code (e.g., "US", "GB", etc.)
        const countryMatch = query.match(/\b([A-Z]{2})\b/);
        if (countryMatch) {
            searchParams.append('countrycode', countryMatch[1]);
            query = query.replace(countryMatch[0], '').trim();
        }
        
        // Detect genres in the query
        const detectedGenres = detectGenres(query);
        if (detectedGenres.length > 0) {
            // Add each detected genre as a tag
            detectedGenres.forEach(genre => {
                searchParams.append('tag', genre);
            });
            // Remove genre-related terms from the query
            detectedGenres.forEach(genre => {
                const genreVariations = GENRE_MAPPINGS[genre];
                if (genreVariations) {
                    genreVariations.forEach(variation => {
                        query = query.replace(new RegExp(variation, 'gi'), '').trim();
                    });
                }
            });
        }
        
        // Add the remaining query as name search if it's not empty
        if (query) {
            searchParams.append('name', query);
        }
        
        // Add common parameters
        searchParams.append('limit', SEARCH_LIMIT);
        searchParams.append('order', 'votes'); // Sort by popularity by default
        searchParams.append('reverse', 'true'); // Most popular first
        
        const stations = await fetchFromRadioBrowser(`stations/search?${searchParams.toString()}`);
        displaySearchResults(stations);
    } catch (error) {
        console.error('Error searching stations:', error);
        const searchResultsSection = document.getElementById('search-results');
        const resultsGrid = searchResultsSection.querySelector('.results-grid');
        const sectionTitle = searchResultsSection.querySelector('.section-title');

        searchResultsSection.classList.remove('hidden');
        sectionTitle.textContent = 'Error';
        resultsGrid.innerHTML = `
            <div class="error-state">
                <span class="material-symbols-rounded error-icon">error_outline</span>
                <p class="error-message">Unable to search stations. Please check your internet connection and try again.</p>
                <button class="retry-btn" onclick="searchStations('${query}')">
                    <span class="material-symbols-rounded">refresh</span>
                    <span>Retry</span>
                </button>
            </div>
        `;
    }
}

// Update displaySearchResults to store results and handle sorting
async function displaySearchResults(stations) {
    const searchResultsSection = document.getElementById('search-results');
    const resultsGrid = searchResultsSection.querySelector('.results-grid');
    const sectionTitle = searchResultsSection.querySelector('.section-title');
    
    // Remove any existing loading indicators first
    const existingLoadingIndicator = searchResultsSection.querySelector('.loading-indicator');
    if (existingLoadingIndicator) {
        existingLoadingIndicator.remove();
    }
    
    // Show loading indicator
    searchResultsSection.classList.add('loading');
    searchResultsSection.classList.remove('hidden');
    // Hide the section title and clear button while loading
    sectionTitle.style.display = 'none';
    if (clearResultsBtn) clearResultsBtn.style.display = 'none';
    
    // Create loading indicator HTML
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text"></div>
    `;
    
    // Clear previous results and show loading indicator
    resultsGrid.innerHTML = '';
    searchResultsSection.appendChild(loadingIndicator);
    
    // First filter by URL format
    const formatValidStations = stations.filter(station => isValidStreamUrl(station.url));
    
    // Store all format-valid stations for future testing
    currentSearchResults = formatValidStations;
    
    // Calculate which stations we need to test for the current page
    const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    const currentPageStations = formatValidStations.slice(startIndex, endIndex);
    
    // Update loading text to show progress
    // loadingIndicator.querySelector('.loading-text').textContent = 
    //     ``;
    
    // Test only the streams for the current page
    const testPromises = currentPageStations.map(async (station) => {
        const isPlayable = await testStream(station.url);
        return isPlayable ? station : null;
    });

    const testResults = await Promise.all(testPromises);
    const supportedStations = testResults.filter(station => station !== null);
    
    // Remove loading indicator
    loadingIndicator.remove();
    searchResultsSection.classList.remove('loading');
    
    // Show the section title and clear button now that results are ready
    sectionTitle.style.display = '';
    if (clearResultsBtn) clearResultsBtn.style.display = '';
    
    // Update section title to show statistics
    const totalStations = stations.length;
    const formatValidCount = formatValidStations.length;
    const supportedCount = supportedStations.length;
    
    sectionTitle.textContent = `${totalStations} stations found for "${searchInput.value}"`;
    
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
    
    // Sort and display the results using the current sort selection
    const currentSort = sortSelect.value;
    displaySortedResults(currentSort);
}

// Function to display sorted results
function displaySortedResults(sortBy) {
    if (!currentSearchResults || currentSearchResults.length === 0) return;
    
    const resultsGrid = document.querySelector('.results-grid');
    const sortedStations = sortStations(currentSearchResults, sortBy);
    
    // Calculate pagination
    const totalPages = Math.ceil(sortedStations.length / RESULTS_PER_PAGE);
    const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    const currentPageStations = sortedStations.slice(startIndex, endIndex);
    
    // Test streams for the current page if they haven't been tested yet
    const testCurrentPage = async () => {
        // Check if we need to test any stations
        const untestedStations = currentPageStations.filter(station => !station.isPlayable);
        
        if (untestedStations.length > 0) {
            // Show loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text"></div>
            `;
            resultsGrid.innerHTML = '';
            resultsGrid.appendChild(loadingIndicator);
        }

        const testPromises = currentPageStations.map(async (station) => {
            // Only test if we haven't already confirmed it's playable
            if (!station.isPlayable) {
                const isPlayable = await testStream(station.url);
                station.isPlayable = isPlayable;
                return isPlayable ? station : null;
            }
            return station;
        });

        const testResults = await Promise.all(testPromises);
        const supportedStations = testResults.filter(station => station !== null);
        
        // Generate the HTML for the current page of results
        const resultsHTML = supportedStations.map(station => {
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
            const exists = radioPlayer.stations.some(s => s.url === station.url);
            
            return `
                <div class="search-result-card">
                    <div class="station-info">
                        <div class="station-favicon">
                            ${station.favicon ? 
                                `<img src="${station.favicon}" alt="${station.name} logo" onerror="this.outerHTML='<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 16 16\\' fill=\\'none\\' xmlns=\\'http://www.w3.org/2000/svg\\'><path d=\\'M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z\\' fill=\\'#D9D9D9\\'/><path d=\\'M13 13H10V12H12V10H13V13Z\\' fill=\\'#D9D9D9\\'/><path d=\\'M13 8H12V9H11V10H9V6H13V8Z\\' fill=\\'#1500FF\\'/><path d=\\'M4 8H5V10H7V11H6V12H3V7H4V8Z\\' fill=\\'#FF0000\\'/><path d=\\'M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z\\' fill=\\'#0DFF00\\'/></svg>'">` : 
                                `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16ZM14 3H13V2H14V3Z" fill="#D9D9D9"/><path d="M13 13H10V12H12V10H13V13Z" fill="#D9D9D9"/><path d="M13 8H12V9H11V10H9V6H13V8Z" fill="#1500FF"/><path d="M4 8H5V10H7V11H6V12H3V7H4V8Z" fill="#FF0000"/><path d="M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z" fill="#0DFF00"/></svg>`
                            }
                        </div>
                        <div class="station-details">
                            <h3>${station.name}</h3>
                            <div class="station-meta">
                                ${station.bitrate ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 9V10H3V9H5Z" fill="#47B5FF"/><path d="M6 11H2V8H6V11ZM5 9H3V10H5V9Z" fill="#477EFF"/><path d="M11 10V11H7V10H11V9ZM11 9H7V8H11V9Z" fill="#262626"/><path d="M14 14H13V7H14V6H15V13H14V14Z" fill="#D29A00"/><path d="M12 15H1V7H12V15ZM2 13H3V12H2V13ZM4 13H5V12H4V13ZM6 13H9V12H6V13ZM10 13H11V12H10V13ZM2 11H6V8H2V11ZM7 11H11V10H7V11ZM7 9H11V8H7V9Z" fill="#FFC933"/><path d="M3 13H2V12H3V13ZM5 13H4V12H5V13ZM7 13H6V12H7V13ZM9 13H8V12H9V13ZM11 13H10V12H11V13Z" fill="#6D6D6D"/><path d="M4 14H3V13H4V14ZM6 14H5V13H6V14ZM8 14H7V13H8V14ZM10 14H9V13H10V14Z" fill="#6D6D6D"/><path d="M13 4V5H14V6H1V5H2V4H13Z" fill="#FFE59E"/><path d="M14 7H13V14H14V15H13V16H1V15H12V7H1V15H0V6H14V7ZM15 14H14V13H15V14ZM8 13H7V12H8V13ZM16 13H15V5H16V13Z" fill="#FFC933"/><path d="M15 6H14V5H13V4H15V6ZM13 4H11V3H13V4ZM11 3H9V2H11V3ZM9 2H7V1H9V2ZM7 1H5V0H7V1Z" fill="#DCDCDC"/></svg>${station.bitrate}kbps</span>` : ''}
                                ${station.countrycode ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3H9V5H10V6H8V5H6V6H5V7H6V8H10V9H11V11H12V12H13V14H11V15H8V12H6V11H5V9H4V7H3V6H1V5H2V3H3V2H5V1H10V3Z" fill="#1C6800"/><path d="M1 6H3V7H4V9H5V11H6V12H8V15H11V16H5V15H3V14H2V13H1V11H0V5H1V6ZM13 15H11V14H13V15ZM11 1H13V2H14V3H15V5H16V11H15V13H14V14H13V12H12V11H11V9H10V8H6V7H5V6H6V5H8V6H10V5H9V3H10V1H5V0H11V1ZM2 5H1V3H2V5ZM3 3H2V2H3V3ZM5 2H3V1H5V2Z" fill="#477EFF"/></svg>${station.countrycode}</span>` : ''}
                                ${station.votes ? `<span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10H10V11H11V14H10V15H9V16H7V15H6V14H5V11H6V10H7V9H9V10Z" fill="#FFC933"/><path d="M5 16H4V15H5V16ZM12 16H11V15H12V16ZM4 15H3V14H4V15ZM13 15H12V14H13V15ZM7 1H8V3H9V4H12V3H13V4H14V5H15V7H16V11H15V13H14V14H13V11H12V9H11V8H9V7H6V8H5V9H4V10H3V14H2V13H1V11H0V7H1V5H2V4H3V3H4V2H5V1H6V0H7V1Z" fill="#FF5E00"/></svg>${station.votes}</span>` : ''}
                            </div>
                            ${station.note ? `<div class="station-note">${station.note}</div>` : ''}
                        </div>
                    </div>
                    <div class="station-controls">
                        <button class="preview-btn" data-url="${station.url}">
                            <span class="material-symbols-rounded">play_arrow</span>
                        </button>
                        <button class="add-btn ${exists ? 'success' : ''}" data-station="${safeStationJson}">
                            <span class="material-symbols-rounded">${exists ? 'check' : 'playlist_add'}</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Generate pagination controls
        const paginationHTML = `
            <div class="pagination-controls">
                <button class="pagination-btn" data-action="prev" ${currentPage === 1 ? 'disabled' : ''}>
                    <span class="material-symbols-rounded">chevron_left</span>
                </button>
                <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
                <button class="pagination-btn" data-action="next" ${currentPage === totalPages ? 'disabled' : ''}>
                    <span class="material-symbols-rounded">chevron_right</span>
                </button>
            </div>
        `;

        // Update the results grid with the current page and pagination controls
        resultsGrid.innerHTML = resultsHTML + paginationHTML;

        // Add event listeners for pagination buttons
        document.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.hasAttribute('disabled')) return;
                
                const action = btn.dataset.action;
                if (action === 'prev' && currentPage > 1) {
                    currentPage--;
                } else if (action === 'next' && currentPage < totalPages) {
                    currentPage++;
                }
                
                // Redisplay the results with the new page
                displaySortedResults(sortBy);
            });
        });

        // Add event listeners for preview and add buttons
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (radioPlayer.isPlaying && radioPlayer.currentStation && radioPlayer.currentStation.url === url) {
                    radioPlayer.togglePlay();
                    btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
                } else {
                    previewStation(url);
                }
            });
        });

        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const station = JSON.parse(btn.dataset.station.replace(/&quot;/g, '"'));
                const exists = radioPlayer.stations.some(s => s.url === station.url);
                
                if (exists) {
                    radioPlayer.removeStation(station.url);
                    btn.querySelector('.material-symbols-rounded').textContent = 'playlist_add';
                    btn.classList.remove('success');
                } else {
                    addStation(btn);
                }
            });
        });
    };
    
    testCurrentPage();
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
            btn.classList.remove('loading');
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
            btn.classList.remove('loading');
        });
    }

    // Create new audio element for preview
    previewAudio = new Audio(url);
    previewAudio.volume = 0.5;
    
    // Update only the clicked preview button to show loading state
    document.querySelectorAll('.preview-btn').forEach(btn => {
        if (btn.dataset.url === url) {
            btn.querySelector('.material-symbols-rounded').textContent = 'progress_activity';
            btn.classList.add('loading');
        }
    });

    previewAudio.play()
        .then(() => {
            // Track preview achievement
            if (window.achievementSystem) {
                window.achievementSystem.trackProgress('preview', 1);
            }
            
            // Update button to show stop icon when playing
            document.querySelectorAll('.preview-btn').forEach(btn => {
                if (btn.dataset.url === url) {
                    btn.querySelector('.material-symbols-rounded').textContent = 'pause';
                    btn.classList.remove('loading');
                }
            });
        })
        .catch(error => {
            console.error('Error playing preview:', error);
            // Reset the button state
            document.querySelectorAll('.preview-btn').forEach(btn => {
                if (btn.dataset.url === url) {
                    btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
                    btn.classList.remove('loading');
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
            btn.classList.remove('loading');
        });
    });
}

// Update the addStation function to use the RadioPlayer's method
async function addStation(btn) {
    const station = JSON.parse(btn.dataset.station.replace(/&quot;/g, '"'));
    const exists = radioPlayer.stations.some(s => s.url === station.url);
    
    if (exists) {
        showNotification('Station already exists in your list.', 'warning');
        return;
    }

    // Store the current preview state
    const wasPreviewing = previewAudio && previewAudio.src === station.url;
    const previewVolume = previewAudio ? previewAudio.volume : 0.5;

    // Add the station
    radioPlayer.stations.push(station);
    radioPlayer.saveStations();
    radioPlayer.displayStations();
    
    // Track achievement
    if (window.achievementSystem) {
        window.achievementSystem.trackProgress('stationAdded', 1, {
            countrycode: station.countrycode,
            tags: station.tags,
            bitrate: station.bitrate,
            isManual: false
        });
    }

    // Update the button state
    btn.querySelector('.material-symbols-rounded').textContent = 'check';
    btn.classList.add('success');

    showNotification('Station added to your list!', 'success');

    // If the station was being previewed, keep it playing
    if (wasPreviewing) {
        // The preview will continue playing since we didn't stop it
        return;
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
    const closeBtn = notification.querySelector('.close-btn');
    const handleClose = (e) => {
        e.preventDefault();
        clearTimeout(timeout);
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    };
    
    closeBtn.addEventListener('mousedown', handleClose);
    closeBtn.addEventListener('touchstart', handleClose);
    closeBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClose(e);
        }
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

// Add these as prototype methods or standalone functions after the class
RadioPlayer.prototype.shareStation = async function(station) {
    // Find the menu share button - try both main stations and shared station lists
    let menuShareBtn = document.querySelector(`.station-card[data-url="${station.url}"] .menu-share`);
    if (!menuShareBtn) {
        // Try finding in shared station lists
        menuShareBtn = document.querySelector(`.shared-station-card[data-url="${station.url}"] .menu-share`);
    }
    let originalContent = '';
    
    if (menuShareBtn) {
        // Store original content
        originalContent = menuShareBtn.innerHTML;
        // Show loading state  
        menuShareBtn.innerHTML = '<span class="material-symbols-rounded loading">sync</span> Generating link...';
        menuShareBtn.disabled = true;
        menuShareBtn.style.opacity = '0.8';
        menuShareBtn.style.pointerEvents = 'none';
    }

    const shareData = {
        u: currentUsername,
        i: station.stationuuid ? [station.stationuuid] : [{
            url: station.url,
            name: station.name,
            favicon: station.favicon,
            homepage: station.homepage,
            bitrate: station.bitrate,
            countrycode: station.countrycode,
            note: station.note || ''
        }]
    };
    const longShareUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(JSON.stringify(shareData))}`;

    try {
        // Call your shortener API
        const response = await fetch('https://s.notmyfirstradio.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ longUrl: longShareUrl })
        });
        const data = await response.json();
        if (data.shortUrl) {
            await navigator.clipboard.writeText(data.shortUrl);
            showNotification('Short sharing link copied to clipboard!', 'success');
        } else {
            throw new Error('No shortUrl in response');
        }
    } catch (err) {
        // Fallback to long URL if shortener fails
        await navigator.clipboard.writeText(longShareUrl);
        showNotification('Failed to shorten link, copied full link instead.', 'warning');
    } finally {
        // Restore original button state
        if (menuShareBtn && originalContent) {
            menuShareBtn.innerHTML = originalContent;
            menuShareBtn.disabled = false;
            menuShareBtn.style.opacity = '';
            menuShareBtn.style.pointerEvents = '';
        }
    }
};

RadioPlayer.prototype.showEditNoteUI = function(card, url) {
    const station = this.stations.find(s => s.url === url);
    if (!station) return;
    let noteDiv = card.querySelector('.station-note');
    if (!noteDiv) {
        noteDiv = document.createElement('div');
        noteDiv.className = 'station-note';
        card.querySelector('.station-details').appendChild(noteDiv);
    }
    noteDiv.innerHTML = `<input maxlength="100" placeholder="Add a note..." class="note-input" type="text" value="${station.note ? station.note.replace(/"/g, '&quot;') : ''}">
        <div class="note-actions">
            <button class="cancel-note-btn">Cancel</button>
            <button class="save-note-btn">Save</button>
        </div>`;
    const input = noteDiv.querySelector('.note-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const oldNote = station.note || '';
            station.note = input.value.slice(0, 100);
            
            // Track note achievement if note was added/changed
            if (window.achievementSystem && input.value.trim() && input.value.trim() !== oldNote) {
                window.achievementSystem.trackProgress('noteAdded', 1);
            }
            
            this.saveStations();
            this.displayStations();
        }
    });
    noteDiv.querySelector('.save-note-btn').onclick = () => {
        const oldNote = station.note || '';
        station.note = input.value.slice(0, 100);
        
        // Track note achievement if note was added/changed
        if (window.achievementSystem && input.value.trim() && input.value.trim() !== oldNote) {
            window.achievementSystem.trackProgress('noteAdded', 1);
        }
        
        this.saveStations();
        this.displayStations();
    };
    noteDiv.querySelector('.cancel-note-btn').onclick = () => {
        this.displayStations();
    };
};

RadioPlayer.prototype.confirmAndRemoveStation = async function(url, name) {
    const confirmed = await showConfirmationModal({
        title: 'Remove Station',
        message: `Are you sure you want to remove ${name} from your list?`,
        confirmText: 'Remove',
        danger: true
    });
    if (confirmed) {
        this.removeStation(url);
    }
};

RadioPlayer.prototype.moveStationToUserList = function(url) {
    // Find the station in the shared lists
    let foundStation = null;
    for (const list of this.stationLists) {
        foundStation = list.stations.find(s => s.url === url);
        if (foundStation) break;
    }
    if (!foundStation) {
        showNotification('Station not found in shared lists.', 'error');
        return;
    }
    // Check for duplicates in user's own list
    const exists = this.stations.some(s => s.url === foundStation.url);
    if (exists) {
        showNotification('Station already exists in your list.', 'warning');
        return;
    }
    // Create new station object with only required fields
    const stationData = {
        name: foundStation.name,
        url: foundStation.url,
        favicon: foundStation.favicon,
        homepage: foundStation.homepage,
        bitrate: foundStation.bitrate,
        countrycode: foundStation.countrycode,
        votes: foundStation.votes,
        note: foundStation.note,
        stationuuid: foundStation.stationuuid,
        tags: foundStation.tags
    };
    // Add to user's own list
    this.stations.push(stationData);
    this.saveStations();
    this.displayStations();
    showNotification('Station moved to your list!', 'success');
};

const shareUrlBtn = document.getElementById('share-url');
if (shareUrlBtn) {
    shareUrlBtn.addEventListener('click', async () => {
        if (!radioPlayer || !radioPlayer.stations || radioPlayer.stations.length === 0) {
            showNotification('No stations to share.', 'warning');
            return;
        }
        const uuids = radioPlayer.stations.map(station => station.stationuuid).filter(Boolean);
        if (uuids.length === 0) {
            showNotification('No stations with UUIDs to share.', 'warning');
            return;
        }
        const shareData = {
            u: currentUsername,
            i: uuids,
            name: 'My Stations'
        };
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(JSON.stringify(shareData))}`;

        try {
            // Call your shortener API
            const response = await fetch('https://s.notmyfirstradio.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ longUrl: shareUrl })
            });
            const data = await response.json();
            if (data.shortUrl) {
                await navigator.clipboard.writeText(data.shortUrl);
                showNotification('Short sharing link copied to clipboard!', 'success');
            } else {
                throw new Error('No shortUrl in response');
            }
        } catch (err) {
            // Fallback to long URL if shortener fails
            await navigator.clipboard.writeText(shareUrl);
            showNotification('Failed to shorten link, copied full link instead.', 'warning');
        }
    });
}

// Radio Browser API servers
const RADIO_BROWSER_SERVERS = [
    'de1',
    'de2',
    'at1'
];

async function fetchFromRadioBrowser(endpoint) {
    let lastError = null;
    
    for (const server of RADIO_BROWSER_SERVERS) {
        try {
            const response = await fetch(`https://${server}.api.radio-browser.info/json/${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            console.warn(`Failed to fetch from ${server} server:`, error);
            continue;
        }
    }
    
    throw lastError || new Error('All Radio Browser servers failed');
}

// Handle QR code upload
const qrUploadInput = document.getElementById('qr-upload');
qrUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Create an image element to load the QR code
        const img = new Image();
        img.src = URL.createObjectURL(file);

        img.onload = async () => {
            // Create a canvas to process the image
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);

            // Get the image data
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            // Use jsQR to decode the QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                try {
                    // Parse the QR code data as JSON
                    const shareData = JSON.parse(code.data);
                    
                    if (shareData.i && Array.isArray(shareData.i)) {
                        // Show loading notification
                        showNotification('Fetching station details...', 'success');

                        // Fetch full station information for each UUID
                        const stations = await Promise.all(shareData.i.map(async (uuid) => {
                            try {
                                const stationData = await fetchFromRadioBrowser(`stations/byuuid/${uuid}`);
                                if (stationData && stationData.length > 0) {
                                    return stationData[0];
                                }
                                return null;
                            } catch (error) {
                                console.warn(`Failed to fetch station with UUID ${uuid}:`, error);
                                return null;
                            }
                        }));

                        // Filter out any failed lookups
                        const validStations = stations.filter(station => station !== null);

                        if (validStations.length > 0) {
                            const sharedUsername = shareData.u || 'Unknown User';
                            const listName = `${sharedUsername}'s radio`;

                            // Show import options with the fetched stations
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
                                    radioPlayer.saveStations();
                                    radioPlayer.displayStations();
                                    showNotification('Stations merged successfully!', 'success');
                                    break;

                                case '3':
                                    // Add as separate list
                                    const newList = {
                                        name: listName,
                                        stations: validStations
                                    };
                                    radioPlayer.stationLists.push(newList);
                                    radioPlayer.saveStationLists();
                                    radioPlayer.displayStationLists();
                                    showNotification('New station list added!', 'success');
                                    break;
                            }
                        } else {
                            showNotification('No valid stations found in QR code', 'error');
                        }
                    } else {
                        showNotification('Invalid station data in QR code', 'error');
                    }
                } catch (error) {
                    showNotification('Invalid QR code data', 'error');
                }
            } else {
                showNotification('No QR code found in image', 'error');
            }

            // Clean up
            URL.revokeObjectURL(img.src);
        };

        img.onerror = () => {
            showNotification('Error loading image', 'error');
        };
    } catch (error) {
        showNotification('Error processing QR code', 'error');
    }
});

// Handle manual station addition
addManualStationBtn.addEventListener('click', async () => {
    const urlInput = document.getElementById('manual-station-url');
    const nameInput = document.getElementById('manual-station-name');
    const faviconInput = document.getElementById('manual-station-favicon');
    const homepageInput = document.getElementById('manual-station-homepage');
    const bitrateInput = document.getElementById('manual-station-bitrate');
    const countryInput = document.getElementById('manual-station-country');
    const addButton = document.getElementById('add-manual-station');
    const originalButtonText = addButton.innerHTML;

    // Validate required fields
    if (!urlInput.value || !nameInput.value) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }

    // Validate URL format
    if (!isValidStreamUrl(urlInput.value)) {
        showNotification('Please enter a valid stream URL.', 'error');
        return;
    }

    // Show loading state
    addButton.disabled = true;
    addButton.innerHTML = `
        <div class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid var(--bg-secondary); border-top-color: var(--accent-color);"></div>
        <span> Adding station...</span>
    `;

    // Test the stream URL
    try {
        const isValid = await testStream(urlInput.value);
        if (!isValid) {
            addButton.disabled = false;
            addButton.innerHTML = originalButtonText;
            showNotification('Could not connect to the stream. Please check the URL.', 'error');
            return;
        }
    } catch (error) {
        console.error('Error testing stream:', error);
        addButton.disabled = false;
        addButton.innerHTML = originalButtonText;
        showNotification('Error testing stream. Please try again.', 'error');
        return;
    }

    // Create station object
    const station = {
        name: nameInput.value,
        url: urlInput.value,
        favicon: faviconInput.value || '',
        homepage: homepageInput.value || '',
        bitrate: bitrateInput.value || '',
        countrycode: countryInput.value.toUpperCase() || '',
        votes: 0
    };

    // Add station to player
    radioPlayer.stations.push(station);
    radioPlayer.saveStations();
    radioPlayer.displayStations();
    
    // Track manual station achievement
    if (window.achievementSystem) {
        window.achievementSystem.trackProgress('stationAdded', 1, {
            countrycode: station.countrycode,
            tags: station.tags || '',
            bitrate: station.bitrate,
            isManual: true
        });
    }

    // Clear form
    urlInput.value = '';
    nameInput.value = '';
    faviconInput.value = '';
    homepageInput.value = '';
    bitrateInput.value = '';
    countryInput.value = '';

    // Reset button state
    addButton.disabled = false;
    addButton.innerHTML = originalButtonText;

    showNotification('Station added successfully!', 'success');
});

// Add Station Modal
const addStationModal = document.getElementById('add-station-modal');
const openAddStationBtn = document.getElementById('open-add-station');
const closeAddStationBtn = document.getElementById('close-add-station');

openAddStationBtn.addEventListener('click', () => {
    addStationModal.classList.remove('hidden');
});

closeAddStationBtn.addEventListener('click', () => {
    addStationModal.classList.add('hidden');
});

settingsOverlay.addEventListener('click', () => {
    addStationModal.classList.add('hidden');
});

// Terms & Privacy Facts Modal
const termsModal = document.getElementById('terms-modal');
const openTermsBtn = document.getElementById('open-terms');
const closeTermsBtn = document.getElementById('close-terms');

if (openTermsBtn) {
    openTermsBtn.addEventListener('click', () => {
        termsModal.classList.remove('hidden');
    });
}

if (closeTermsBtn) {
    closeTermsBtn.addEventListener('click', () => {
        termsModal.classList.add('hidden');
    });
}

// Close terms modal when clicking outside
termsModal.addEventListener('click', (e) => {
    if (e.target === termsModal) {
        termsModal.classList.add('hidden');
    }
});

// Achievements Modal
const achievementsModal = document.getElementById('achievements-modal');
const openAchievementsBtn = document.getElementById('open-achievements');
const closeAchievementsBtn = document.getElementById('close-achievements');

if (openAchievementsBtn) {
    openAchievementsBtn.addEventListener('click', () => {
        showAchievementsModal();
    });
}

if (closeAchievementsBtn) {
    closeAchievementsBtn.addEventListener('click', () => {
        achievementsModal.classList.add('hidden');
    });
}

// Close achievements modal when clicking outside
achievementsModal.addEventListener('click', (e) => {
    if (e.target === achievementsModal) {
        achievementsModal.classList.add('hidden');
    }
});

// Show achievements modal with populated content
function showAchievementsModal() {
    if (!window.achievementSystem) {
        showNotification('Achievement system not available', 'error');
        return;
    }

    const progress = window.achievementSystem.getUserProgress();
    const achievementsByCategory = window.achievementSystem.getAchievementsByCategory();
    
    // Populate stats
    const statsContainer = document.getElementById('achievement-stats');
    const listeningHours = Math.floor(progress.stats.totalListeningTime / 3600000);
    const listeningMinutes = Math.floor((progress.stats.totalListeningTime % 3600000) / 60000);
    
    statsContainer.innerHTML = `
        <div class="achievement-stat">
            <span class="achievement-stat-value">${progress.unlockedCount}</span>
            <span class="achievement-stat-label">Achievements Unlocked</span>
        </div>
        <div class="achievement-stat">
            <span class="achievement-stat-value">${progress.stats.stationsAdded}</span>
            <span class="achievement-stat-label">Stations Collected</span>
        </div>
        <div class="achievement-stat">
            <span class="achievement-stat-value">${progress.stats.countriesCollected.size || Array.from(progress.stats.countriesCollected).length}</span>
            <span class="achievement-stat-label">Countries Explored</span>
        </div>
        <div class="achievement-stat">
            <span class="achievement-stat-value">${listeningHours}h ${listeningMinutes}m</span>
            <span class="achievement-stat-label">Total Listening Time</span>
        </div>
        <div class="achievement-stat">
            <span class="achievement-stat-value">${progress.stats.searchCount}</span>
            <span class="achievement-stat-label">Searches Performed</span>
        </div>
        <div class="achievement-stat">
            <span class="achievement-stat-value">${progress.stats.shareCount + progress.stats.qrShareCount}</span>
            <span class="achievement-stat-label">Times Shared</span>
        </div>
    `;
    
    // Populate categories
    const categoriesContainer = document.getElementById('achievements-categories');
    const categoryIcons = {
        collection: '📚',
        discovery: '🔍', 
        listening: '🎧',
        social: '🤝',
        technical: '⚡'
    };
    
    let categoriesHTML = '';
    
    Object.entries(achievementsByCategory).forEach(([categoryName, achievements]) => {
        const unlockedInCategory = achievements.filter(a => a.unlocked).length;
        const totalInCategory = achievements.length;
        
        categoriesHTML += `
            <div class="achievement-category-header">
                <span class="achievement-category-icon">${categoryIcons[categoryName] || '🏆'}</span>
                <span>${categoryName} (${unlockedInCategory}/${totalInCategory})</span>
            </div>
            <div class="achievements-grid">
        `;
        
        achievements.forEach(achievement => {
            const unlockDate = achievement.unlocked ? new Date(achievement.unlockedAt).toLocaleDateString() : '';
            const tierStars = '●'.repeat(achievement.tier);
            
            categoriesHTML += `
                <div class="achievement-card ${achievement.unlocked ? 'unlocked' : ''}">
                    <div class="achievement-card-tier">
                        ${tierStars.split('').map(() => '<div class="achievement-tier-star"></div>').join('')}
                    </div>
                    <div class="achievement-card-header">
                        <div class="achievement-card-icon">${achievement.icon}</div>
                        <div class="achievement-card-info">
                            <div class="achievement-card-name">${achievement.name}</div>
                            <div class="achievement-card-description">${achievement.description}</div>
                        </div>
                    </div>
                    ${achievement.unlocked ? 
                        `<div class="achievement-card-progress">Unlocked!</div>
                         <div class="achievement-unlock-date">Earned ${unlockDate}</div>` : 
                        `<div class="achievement-card-progress">Not yet unlocked</div>`
                    }
                </div>
            `;
        });
        
        categoriesHTML += '</div>';
    });
    
    categoriesContainer.innerHTML = categoriesHTML;
    
    // Show modal
    achievementsModal.classList.remove('hidden');
}