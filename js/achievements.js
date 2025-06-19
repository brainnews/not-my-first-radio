// Achievement System for Not My First Radio
// Tracks user progress and unlocks achievements based on radio listening behavior

class AchievementSystem {
    constructor() {
        this.achievements = this.initializeAchievements();
        this.userData = this.loadUserData();
        this.notificationQueue = [];
        this.isShowingNotification = false;
    }

    // Initialize all achievement definitions
    initializeAchievements() {
        return {
            // Collection Achievements
            'first-station': {
                id: 'first-station',
                name: 'First Steps',
                description: 'Add your first radio station',
                icon: '📻',
                category: 'collection',
                condition: (stats) => stats.stationsAdded >= 1,
                tier: 1
            },
            'getting-started': {
                id: 'getting-started',  
                name: 'Getting Started',
                description: 'Save 5 radio stations',
                icon: '🎵',
                category: 'collection',
                condition: (stats) => stats.stationsAdded >= 5,
                tier: 1
            },
            'collector': {
                id: 'collector',
                name: 'Collector',
                description: 'Save 25 radio stations',
                icon: '📚',
                category: 'collection', 
                condition: (stats) => stats.stationsAdded >= 25,
                tier: 2
            },
            'curator': {
                id: 'curator',
                name: 'Curator',
                description: 'Save 50 radio stations',
                icon: '🏛️',
                category: 'collection',
                condition: (stats) => stats.stationsAdded >= 50,
                tier: 3
            },
            'archive-master': {
                id: 'archive-master',
                name: 'Archive Master',
                description: 'Save 100+ radio stations',
                icon: '🏆',
                category: 'collection',
                condition: (stats) => stats.stationsAdded >= 100,
                tier: 4
            },
            'country-explorer-5': {
                id: 'country-explorer-5',
                name: 'Country Explorer',
                description: 'Collect stations from 5 different countries',
                icon: '🌍',
                category: 'collection',
                condition: (stats) => stats.countriesCollected.size >= 5,
                tier: 1
            },
            'country-explorer-10': {
                id: 'country-explorer-10',
                name: 'World Traveler', 
                description: 'Collect stations from 10 different countries',
                icon: '🌎',
                category: 'collection',
                condition: (stats) => stats.countriesCollected.size >= 10,
                tier: 2
            },
            'country-explorer-25': {
                id: 'country-explorer-25',
                name: 'Global Navigator',
                description: 'Collect stations from 25 different countries',
                icon: '🌏',
                category: 'collection',
                condition: (stats) => stats.countriesCollected.size >= 25,
                tier: 3
            },
            'genre-connoisseur': {
                id: 'genre-connoisseur',
                name: 'Genre Connoisseur',
                description: 'Collect stations from 10+ different genres',
                icon: '🎼',
                category: 'collection',
                condition: (stats) => stats.genresCollected.size >= 10,
                tier: 2
            },
            'quality-seeker': {
                id: 'quality-seeker',
                name: 'Quality Seeker',
                description: 'Save 10 high-quality stations (320kbps+)',
                icon: '💎',
                category: 'collection',
                condition: (stats) => stats.highBitrateStations >= 10,
                tier: 2
            },

            // Discovery Achievements
            'search-pioneer': {
                id: 'search-pioneer',
                name: 'Search Pioneer',
                description: 'Perform your first search',
                icon: '🔍',
                category: 'discovery',
                condition: (stats) => stats.searchCount >= 1,
                tier: 1
            },
            'explorer-25': {
                id: 'explorer-25',
                name: 'Explorer',
                description: 'Search 25 times',
                icon: '🧭',
                category: 'discovery',
                condition: (stats) => stats.searchCount >= 25,
                tier: 2
            },
            'explorer-100': {
                id: 'explorer-100',
                name: 'Search Expert',
                description: 'Search 100 times',
                icon: '🎯',
                category: 'discovery',
                condition: (stats) => stats.searchCount >= 100,
                tier: 3
            },
            'preview-pro': {
                id: 'preview-pro',
                name: 'Preview Pro',
                description: 'Preview 25 stations before adding',
                icon: '👂',
                category: 'discovery',
                condition: (stats) => stats.previewCount >= 25,
                tier: 2
            },
            'starter-pack-user': {
                id: 'starter-pack-user',
                name: 'Starter Pack User',
                description: 'Import a starter pack',
                icon: '📦',
                category: 'discovery',
                condition: (stats) => stats.starterPacksImported >= 1,
                tier: 1
            },
            'manual-master': {
                id: 'manual-master',
                name: 'Manual Master',
                description: 'Manually add 5 stations',
                icon: '✍️',
                category: 'discovery',
                condition: (stats) => stats.manualStationsAdded >= 5,
                tier: 2
            },

            // Listening Achievements
            'first-listen': {
                id: 'first-listen',
                name: 'First Listen',
                description: 'Play your first station',
                icon: '▶️',
                category: 'listening',
                condition: (stats) => stats.stationsPlayed >= 1,
                tier: 1
            },
            'station-hopper-10': {
                id: 'station-hopper-10',
                name: 'Station Hopper',
                description: 'Play 10 different stations',
                icon: '🦘',
                category: 'listening',
                condition: (stats) => stats.uniqueStationsPlayed.length >= 10,
                tier: 1
            },
            'station-hopper-50': {
                id: 'station-hopper-50',
                name: 'Channel Surfer',
                description: 'Play 50 different stations',
                icon: '📺',
                category: 'listening',
                condition: (stats) => stats.uniqueStationsPlayed.length >= 50,
                tier: 2
            },
            'station-hopper-100': {
                id: 'station-hopper-100',
                name: 'Radio Wanderer',
                description: 'Play 100 different stations',
                icon: '🚶',
                category: 'listening',
                condition: (stats) => stats.uniqueStationsPlayed.length >= 100,
                tier: 3
            },
            'marathon-1h': {
                id: 'marathon-1h',
                name: 'Getting Into It',
                description: 'Listen for 1 hour total',
                icon: '⏰',
                category: 'listening',
                condition: (stats) => stats.totalListeningTime >= 3600000, // 1 hour in ms
                tier: 1
            },
            'marathon-10h': {
                id: 'marathon-10h',
                name: 'Marathon Listener',
                description: 'Listen for 10 hours total',
                icon: '🏃',
                category: 'listening',
                condition: (stats) => stats.totalListeningTime >= 36000000, // 10 hours in ms
                tier: 2
            },
            'marathon-50h': {
                id: 'marathon-50h',
                name: 'Radio Devotee',
                description: 'Listen for 50 hours total',
                icon: '🎧',
                category: 'listening',
                condition: (stats) => stats.totalListeningTime >= 180000000, // 50 hours in ms
                tier: 3
            },
            'marathon-100h': {
                id: 'marathon-100h',
                name: 'Airwave Legend',
                description: 'Listen for 100+ hours total',
                icon: '👑',
                category: 'listening',
                condition: (stats) => stats.totalListeningTime >= 360000000, // 100 hours in ms
                tier: 4
            },
            'night-owl': {
                id: 'night-owl',
                name: 'Night Owl',
                description: 'Listen between midnight-6am (10 times)',
                icon: '🦉',
                category: 'listening',
                condition: (stats) => this.countSessionsByTimeRange(stats.listeningSessions, 0, 6) >= 10,
                tier: 2
            },
            'early-bird': {
                id: 'early-bird',
                name: 'Early Bird',
                description: 'Listen between 5-9am (10 times)',
                icon: '🐦',
                category: 'listening',
                condition: (stats) => this.countSessionsByTimeRange(stats.listeningSessions, 5, 9) >= 10,
                tier: 2
            },

            // Social Achievements
            'sharer': {
                id: 'sharer',
                name: 'Sharer',
                description: 'Export or share your stations for the first time',
                icon: '🤝',
                category: 'social',
                condition: (stats) => stats.shareCount >= 1,
                tier: 1
            },
            'qr-master': {
                id: 'qr-master',
                name: 'QR Master',
                description: 'Share via QR code',
                icon: '📱',
                category: 'social',
                condition: (stats) => stats.qrShareCount >= 1,
                tier: 1
            },
            'importer': {
                id: 'importer',
                name: 'Importer',
                description: 'Import someone else\'s stations',
                icon: '📥',
                category: 'social',
                condition: (stats) => stats.importCount >= 1,
                tier: 1
            },
            'community-member': {
                id: 'community-member',
                name: 'Community Member',
                description: 'Import 5 different shared lists',
                icon: '👥',
                category: 'social',
                condition: (stats) => stats.sharedListsImported >= 5,
                tier: 2
            },
            'organizer': {
                id: 'organizer',
                name: 'Organizer',
                description: 'Add notes to 10 stations',
                icon: '📝',
                category: 'social',
                condition: (stats) => stats.notesAdded >= 10,
                tier: 2
            },

            // Technical Achievements
            'visualizer-fan': {
                id: 'visualizer-fan',
                name: 'Visualizer Fan',
                description: 'Use audio visualizer 25 times',
                icon: '🌈',
                category: 'technical',
                condition: (stats) => stats.visualizerUsed >= 25,
                tier: 2
            },
            'power-user': {
                id: 'power-user',
                name: 'Power User',
                description: 'Use all import/export methods',
                icon: '⚡',
                category: 'technical',
                condition: (stats) => stats.exportCount >= 1 && stats.importCount >= 1 && stats.qrShareCount >= 1,
                tier: 3
            },
            'customizer': {
                id: 'customizer',
                name: 'Customizer',
                description: 'Set a username and add station notes',
                icon: '🎨',
                category: 'technical',
                condition: (stats) => stats.usernameSet && stats.notesAdded >= 1,
                tier: 1
            }
        };
    }

    // Initialize user data structure
    initializeUserData() {
        return {
            stats: {
                stationsAdded: 0,
                stationsPlayed: 0,
                uniqueStationsPlayed: [],
                totalListeningTime: 0,
                searchCount: 0,
                previewCount: 0,
                shareCount: 0,
                exportCount: 0,
                importCount: 0,
                qrShareCount: 0,
                notesAdded: 0,
                visualizerUsed: 0,
                listeningSessions: [],
                countriesCollected: new Set(),
                genresCollected: new Set(),
                highBitrateStations: 0,
                manualStationsAdded: 0,
                starterPacksImported: 0,
                sharedListsImported: 0,
                usernameSet: false
            },
            unlocked: {},
            version: 1
        };
    }

    // Load user data from localStorage
    loadUserData() {
        try {
            const stored = localStorage.getItem('radio-achievements');
            if (stored) {
                const data = JSON.parse(stored);
                // Convert Sets back from arrays for JSON compatibility
                if (data.stats.countriesCollected && Array.isArray(data.stats.countriesCollected)) {
                    data.stats.countriesCollected = new Set(data.stats.countriesCollected);
                }
                if (data.stats.genresCollected && Array.isArray(data.stats.genresCollected)) {
                    data.stats.genresCollected = new Set(data.stats.genresCollected);
                }
                return { ...this.initializeUserData(), ...data };
            }
        } catch (error) {
            console.error('Error loading achievement data:', error);
        }
        return this.initializeUserData();
    }

    // Save user data to localStorage
    saveUserData() {
        try {
            // Convert Sets to arrays for JSON compatibility
            const dataToSave = {
                ...this.userData,
                stats: {
                    ...this.userData.stats,
                    countriesCollected: Array.from(this.userData.stats.countriesCollected),
                    genresCollected: Array.from(this.userData.stats.genresCollected)
                }
            };
            localStorage.setItem('radio-achievements', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Error saving achievement data:', error);
        }
    }

    // Helper function to count listening sessions by time range
    countSessionsByTimeRange(sessions, startHour, endHour) {
        return sessions.filter(timestamp => {
            const date = new Date(timestamp);
            const hour = date.getHours();
            return hour >= startHour && hour < endHour;
        }).length;
    }

    // Track progress for a specific metric
    trackProgress(metric, value = 1, metadata = {}) {
        const stats = this.userData.stats;
        
        switch (metric) {
            case 'stationAdded':
                stats.stationsAdded += value;
                // Track countries and genres
                if (metadata.countrycode && metadata.countrycode.trim()) {
                    stats.countriesCollected.add(metadata.countrycode.toUpperCase());
                }
                if (metadata.tags) {
                    const genres = metadata.tags.split(',').map(tag => tag.trim().toLowerCase());
                    genres.forEach(genre => {
                        if (genre) stats.genresCollected.add(genre);
                    });
                }
                if (metadata.bitrate && parseInt(metadata.bitrate) >= 320) {
                    stats.highBitrateStations += 1;
                }
                if (metadata.isManual) {
                    stats.manualStationsAdded += 1;
                }
                break;
                
            case 'stationPlayed':
                stats.stationsPlayed += value;
                if (metadata.stationId && !stats.uniqueStationsPlayed.includes(metadata.stationId)) {
                    stats.uniqueStationsPlayed.push(metadata.stationId);
                }
                // Track listening session start time
                stats.listeningSessions.push(Date.now());
                break;
                
            case 'listeningTime':
                stats.totalListeningTime += value; // value in milliseconds
                break;
                
            case 'search':
                stats.searchCount += value;
                break;
                
            case 'preview':
                stats.previewCount += value;
                break;
                
            case 'share':
                stats.shareCount += value;
                break;
                
            case 'export':
                stats.exportCount += value;
                break;
                
            case 'import':
                stats.importCount += value;
                if (metadata.isSharedList) {
                    stats.sharedListsImported += 1;
                }
                if (metadata.isStarterPack) {
                    stats.starterPacksImported += 1;
                }
                break;
                
            case 'qrShare':
                stats.qrShareCount += value;
                break;
                
            case 'noteAdded':
                stats.notesAdded += value;
                break;
                
            case 'visualizerUsed':
                stats.visualizerUsed += value;
                break;
                
            case 'usernameSet':
                stats.usernameSet = true;
                break;
                
            default:
                console.warn('Unknown achievement metric:', metric);
                return;
        }
        
        this.saveUserData();
        this.checkAchievements(metric);
    }

    // Check and unlock achievements
    checkAchievements(triggeredBy = null) {
        const stats = this.userData.stats;
        const newlyUnlocked = [];
        
        Object.values(this.achievements).forEach(achievement => {
            // Skip if already unlocked
            if (this.userData.unlocked[achievement.id]) return;
            
            // Check if achievement condition is met
            if (achievement.condition(stats)) {
                this.userData.unlocked[achievement.id] = {
                    unlockedAt: Date.now(),
                    seen: false,
                    triggeredBy: triggeredBy
                };
                newlyUnlocked.push(achievement);
            }
        });
        
        if (newlyUnlocked.length > 0) {
            this.saveUserData();
            // Queue notifications for newly unlocked achievements
            newlyUnlocked.forEach(achievement => {
                this.queueNotification(achievement);
            });
            this.processNotificationQueue();
        }
        
        return newlyUnlocked;
    }

    // Queue achievement notification
    queueNotification(achievement) {
        this.notificationQueue.push(achievement);
    }

    // Process notification queue
    processNotificationQueue() {
        if (this.isShowingNotification || this.notificationQueue.length === 0) return;
        
        const achievement = this.notificationQueue.shift();
        this.showAchievementNotification(achievement);
    }

    // Show achievement notification
    showAchievementNotification(achievement) {
        this.isShowingNotification = true;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-notification-content">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-details">
                    <div class="achievement-title">Achievement Unlocked!</div>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                </div>
                <button class="achievement-close" aria-label="Close notification">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Handle close button
        const closeBtn = notification.querySelector('.achievement-close');
        const handleClose = () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.isShowingNotification = false;
                // Process next notification in queue
                setTimeout(() => this.processNotificationQueue(), 500);
            }, 300);
        };
        
        closeBtn.addEventListener('click', handleClose);
        
        // Auto-close after 5 seconds
        setTimeout(handleClose, 5000);
        
        // Mark as seen
        if (this.userData.unlocked[achievement.id]) {
            this.userData.unlocked[achievement.id].seen = true;
            this.saveUserData();
        }
    }

    // Get user progress and statistics
    getUserProgress() {
        return {
            stats: { ...this.userData.stats },
            unlocked: { ...this.userData.unlocked },
            totalAchievements: Object.keys(this.achievements).length,
            unlockedCount: Object.keys(this.userData.unlocked).length,
            unlockedAchievements: Object.keys(this.userData.unlocked).map(id => ({
                ...this.achievements[id],
                ...this.userData.unlocked[id]
            }))
        };
    }

    // Get achievements by category
    getAchievementsByCategory() {
        const categories = {};
        Object.values(this.achievements).forEach(achievement => {
            if (!categories[achievement.category]) {
                categories[achievement.category] = [];
            }
            categories[achievement.category].push({
                ...achievement,
                unlocked: !!this.userData.unlocked[achievement.id],
                ...this.userData.unlocked[achievement.id]
            });
        });
        return categories;
    }

    // Get progress towards specific achievement
    getAchievementProgress(achievementId) {
        const achievement = this.achievements[achievementId];
        if (!achievement) return null;
        
        const stats = this.userData.stats;
        const isUnlocked = !!this.userData.unlocked[achievementId];
        
        // Calculate progress percentage (this is simplified - could be enhanced)
        let progress = 0;
        if (!isUnlocked) {
            // This would need more sophisticated logic for different achievement types
            // For now, just return whether it's unlocked or not
            progress = achievement.condition(stats) ? 100 : 0;
        } else {
            progress = 100;
        }
        
        return {
            achievement,
            progress,
            isUnlocked,
            unlockData: this.userData.unlocked[achievementId]
        };
    }

    // Reset all achievement data (for testing or user preference)
    resetAchievements() {
        this.userData = this.initializeUserData();
        this.saveUserData();
    }

    // Export achievements data
    exportAchievements() {
        return {
            achievements: this.userData,
            exportedAt: Date.now(),
            version: this.userData.version
        };
    }
}

// Create global instance
window.achievementSystem = new AchievementSystem();

export default AchievementSystem;