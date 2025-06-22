/**
 * User management module for username, achievements, and user data
 */

import { UserStats, Achievement } from '@/types/app';
import { eventManager } from '@/utils/events';
import { getStorageItem, setStorageItem, StorageKeys } from '@/utils/storage';

export interface UserManagerConfig {
  autoGenerateUsername?: boolean;
  maxUsernameLength?: number;
}

/**
 * Manages user data, username, and achievements
 */
export class UserManager {
  private username: string = '';
  private userStats: UserStats;
  private achievements: Achievement[] = [];
  private config: UserManagerConfig;

  // Offensive words filter
  private readonly offensiveWords = [
    'fuck', 'shit', 'bitch', 'damn', 'hell', 'ass', 'crap', 'piss',
    'bastard', 'slut', 'whore', 'fag', 'retard', 'nigger', 'nazi',
    'hitler', 'gay', 'lesbian', 'homo', 'queer', 'tranny'
  ];

  // Random username components
  private readonly adjectives = [
    'Happy', 'Peaceful', 'Cheerful', 'Bright', 'Calm', 'Cool', 'Swift',
    'Smart', 'Brave', 'Kind', 'Gentle', 'Wise', 'Strong', 'Quick',
    'Silent', 'Golden', 'Silver', 'Crystal', 'Magic', 'Electric',
    'Cosmic', 'Ocean', 'Mountain', 'Forest', 'Desert', 'Arctic',
    'Tropical', 'Urban', 'Classic', 'Modern', 'Vintage', 'Future'
  ];

  private readonly nouns = [
    'Listener', 'Explorer', 'Wanderer', 'Dreamer', 'Seeker', 'Hunter',
    'Player', 'Dancer', 'Singer', 'Artist', 'Creator', 'Builder',
    'Traveler', 'Rider', 'Pilot', 'Captain', 'Chief', 'Master',
    'Guardian', 'Warrior', 'Hero', 'Champion', 'Legend', 'Star',
    'Phoenix', 'Dragon', 'Eagle', 'Wolf', 'Lion', 'Tiger',
    'Bear', 'Shark', 'Falcon', 'Raven', 'Fox', 'Owl'
  ];

  constructor(config: UserManagerConfig = {}) {
    this.config = {
      autoGenerateUsername: true,
      maxUsernameLength: 20,
      ...config
    };

    this.loadUserData();
    this.loadAchievements();
    this.setupEventListeners();
  }

  /**
   * Load user data from storage
   */
  private loadUserData(): void {
    this.username = getStorageItem(StorageKeys.USERNAME, '');
    
    this.userStats = getStorageItem(StorageKeys.USER_STATS, {
      totalStationsAdded: 0,
      totalPlayTime: 0,
      stationsPlayed: 0,
      countriesExplored: 0,
      achievementsUnlocked: 0,
      dateJoined: new Date().toISOString()
    });

    // Generate username if needed
    if (!this.username && this.config.autoGenerateUsername) {
      this.username = this.generateRandomUsername();
      this.saveUsername();
    }

    eventManager.emit('user:loaded', {
      username: this.username,
      stats: this.userStats
    });
  }

  /**
   * Load achievements from storage
   */
  private loadAchievements(): void {
    const savedAchievements = getStorageItem(StorageKeys.ACHIEVEMENTS, []);
    this.achievements = this.initializeAchievements(savedAchievements);
    eventManager.emit('achievements:loaded', this.achievements);
  }

  /**
   * Initialize achievements with defaults
   */
  private initializeAchievements(savedAchievements: Achievement[]): Achievement[] {
    const defaultAchievements: Achievement[] = [
      {
        id: 'first_station',
        name: 'First Tune',
        description: 'Add your first radio station',
        icon: '🎵',
        unlocked: false
      },
      {
        id: 'five_stations',
        name: 'Growing Collection',
        description: 'Add 5 radio stations',
        icon: '📻',
        unlocked: false,
        progress: 0,
        maxProgress: 5
      },
      {
        id: 'twenty_stations',
        name: 'Radio Enthusiast',
        description: 'Add 20 radio stations',
        icon: '🔊',
        unlocked: false,
        progress: 0,
        maxProgress: 20
      },
      {
        id: 'fifty_stations',
        name: 'Station Collector',
        description: 'Add 50 radio stations',
        icon: '🎧',
        unlocked: false,
        progress: 0,
        maxProgress: 50
      },
      {
        id: 'world_explorer',
        name: 'World Explorer',
        description: 'Add stations from 10 different countries',
        icon: '🌍',
        unlocked: false,
        progress: 0,
        maxProgress: 10
      },
      {
        id: 'music_lover',
        name: 'Music Lover',
        description: 'Listen to stations for 10 hours total',
        icon: '❤️',
        unlocked: false,
        progress: 0,
        maxProgress: 36000 // 10 hours in seconds
      },
      {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Listen to radio between midnight and 6 AM',
        icon: '🦉',
        unlocked: false
      },
      {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Listen to radio between 5 AM and 7 AM',
        icon: '🐦',
        unlocked: false
      },
      {
        id: 'social_listener',
        name: 'Social Listener',
        description: 'Share a station list with someone',
        icon: '🤝',
        unlocked: false
      },
      {
        id: 'quality_hunter',
        name: 'Quality Hunter',
        description: 'Add a station with 320+ kbps bitrate',
        icon: '💎',
        unlocked: false
      }
    ];

    // Merge with saved achievements
    return defaultAchievements.map(defaultAchievement => {
      const saved = savedAchievements.find(a => a.id === defaultAchievement.id);
      return saved ? { ...defaultAchievement, ...saved } : defaultAchievement;
    });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('user:username-change', (newUsername: string) => {
      this.setUsername(newUsername);
    });

    eventManager.on('user:stats-update', (updates: Partial<UserStats>) => {
      this.updateStats(updates);
    });

    eventManager.on('achievements:check', (eventType: string, data?: any) => {
      this.checkAchievements(eventType, data);
    });

    eventManager.on('achievements:reset', () => {
      this.resetAchievements();
    });

    // Listen for station events to update achievements
    eventManager.on('station:added', () => {
      this.checkAchievements('station:added');
    });

    eventManager.on('station:play', () => {
      this.checkAchievements('station:play');
    });

    eventManager.on('shared-list:created', () => {
      this.checkAchievements('shared-list:created');
    });
  }

  /**
   * Get current username
   */
  getUsername(): string {
    return this.username;
  }

  /**
   * Set username with validation
   */
  setUsername(newUsername: string): boolean {
    const cleanedUsername = this.validateAndCleanUsername(newUsername);
    
    if (!cleanedUsername) {
      eventManager.emit('user:username-error', 'Invalid username');
      return false;
    }

    this.username = cleanedUsername;
    this.saveUsername();
    
    eventManager.emit('user:username-changed', this.username);
    return true;
  }

  /**
   * Validate and clean username
   */
  private validateAndCleanUsername(username: string): string | null {
    if (!username || username.trim().length === 0) {
      return null;
    }

    // Clean and trim
    let cleaned = username.trim().toLowerCase();
    
    // Check length
    if (cleaned.length > (this.config.maxUsernameLength || 20)) {
      return null;
    }

    // Check for offensive words
    if (this.containsOffensiveWords(cleaned)) {
      return null;
    }

    // Remove special characters except letters, numbers, and basic punctuation
    cleaned = cleaned.replace(/[^a-z0-9\s\-_]/g, '');
    
    if (cleaned.length < 2) {
      return null;
    }

    return cleaned;
  }

  /**
   * Check for offensive words
   */
  private containsOffensiveWords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.offensiveWords.some(word => lowerText.includes(word));
  }

  /**
   * Generate random username
   */
  generateRandomUsername(): string {
    const adjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
    const number = Math.floor(Math.random() * 100);
    
    return `${adjective}${noun}${number}`;
  }

  /**
   * Save username to storage
   */
  private saveUsername(): void {
    setStorageItem(StorageKeys.USERNAME, this.username);
  }

  /**
   * Get user statistics
   */
  getStats(): UserStats {
    return { ...this.userStats };
  }

  /**
   * Update user statistics
   */
  updateStats(updates: Partial<UserStats>): void {
    this.userStats = { ...this.userStats, ...updates };
    setStorageItem(StorageKeys.USER_STATS, this.userStats);
    eventManager.emit('user:stats-updated', this.userStats);
  }

  /**
   * Increment a stat by a value
   */
  incrementStat(stat: keyof UserStats, value: number = 1): void {
    if (typeof this.userStats[stat] === 'number') {
      this.updateStats({ [stat]: (this.userStats[stat] as number) + value } as Partial<UserStats>);
    }
  }

  /**
   * Get achievements
   */
  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements(): Achievement[] {
    return this.achievements.filter(a => a.unlocked);
  }

  /**
   * Check and unlock achievements
   */
  checkAchievements(eventType: string, data?: any): void {
    let newlyUnlocked: Achievement[] = [];

    switch (eventType) {
      case 'station:added':
        newlyUnlocked = this.checkStationAchievements();
        break;
      case 'station:play':
        newlyUnlocked = this.checkPlayingAchievements();
        break;
      case 'shared-list:created':
        newlyUnlocked = this.checkSharingAchievements();
        break;
    }

    if (newlyUnlocked.length > 0) {
      this.saveAchievements();
      eventManager.emit('achievements:unlocked', newlyUnlocked);
    }
  }

  /**
   * Check station-related achievements
   */
  private checkStationAchievements(): Achievement[] {
    const unlocked: Achievement[] = [];
    const stationCount = this.userStats.totalStationsAdded;

    // First station
    const firstStation = this.achievements.find(a => a.id === 'first_station');
    if (firstStation && !firstStation.unlocked && stationCount >= 1) {
      firstStation.unlocked = true;
      firstStation.unlockedAt = new Date().toISOString();
      unlocked.push(firstStation);
    }

    // Progress achievements
    const progressAchievements = ['five_stations', 'twenty_stations', 'fifty_stations'];
    progressAchievements.forEach(id => {
      const achievement = this.achievements.find(a => a.id === id);
      if (achievement && !achievement.unlocked && achievement.maxProgress) {
        achievement.progress = Math.min(stationCount, achievement.maxProgress);
        if (achievement.progress >= achievement.maxProgress) {
          achievement.unlocked = true;
          achievement.unlockedAt = new Date().toISOString();
          unlocked.push(achievement);
        }
      }
    });

    return unlocked;
  }

  /**
   * Check playing-related achievements
   */
  private checkPlayingAchievements(): Achievement[] {
    const unlocked: Achievement[] = [];
    const currentHour = new Date().getHours();

    // Night owl (midnight to 6 AM)
    const nightOwl = this.achievements.find(a => a.id === 'night_owl');
    if (nightOwl && !nightOwl.unlocked && (currentHour >= 0 && currentHour < 6)) {
      nightOwl.unlocked = true;
      nightOwl.unlockedAt = new Date().toISOString();
      unlocked.push(nightOwl);
    }

    // Early bird (5 AM to 7 AM)
    const earlyBird = this.achievements.find(a => a.id === 'early_bird');
    if (earlyBird && !earlyBird.unlocked && (currentHour >= 5 && currentHour < 7)) {
      earlyBird.unlocked = true;
      earlyBird.unlockedAt = new Date().toISOString();
      unlocked.push(earlyBird);
    }

    return unlocked;
  }

  /**
   * Check sharing-related achievements
   */
  private checkSharingAchievements(): Achievement[] {
    const unlocked: Achievement[] = [];

    // Social listener
    const socialListener = this.achievements.find(a => a.id === 'social_listener');
    if (socialListener && !socialListener.unlocked) {
      socialListener.unlocked = true;
      socialListener.unlockedAt = new Date().toISOString();
      unlocked.push(socialListener);
    }

    return unlocked;
  }

  /**
   * Unlock achievement manually
   */
  unlockAchievement(achievementId: string): boolean {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = new Date().toISOString();
      this.saveAchievements();
      eventManager.emit('achievements:unlocked', [achievement]);
      return true;
    }
    return false;
  }

  /**
   * Reset all achievements
   */
  resetAchievements(): void {
    this.achievements.forEach(achievement => {
      achievement.unlocked = false;
      achievement.unlockedAt = undefined;
      achievement.progress = 0;
    });
    
    this.saveAchievements();
    eventManager.emit('achievements:reset');
  }

  /**
   * Save achievements to storage
   */
  private saveAchievements(): void {
    setStorageItem(StorageKeys.ACHIEVEMENTS, this.achievements);
  }

  /**
   * Get achievement progress percentage
   */
  getAchievementProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.achievements.filter(a => a.unlocked).length;
    const total = this.achievements.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return { completed, total, percentage };
  }

  /**
   * Create user profile summary
   */
  createProfileSummary(): {
    username: string;
    memberSince: string;
    stats: UserStats;
    achievements: { completed: number; total: number };
    recentAchievements: Achievement[];
  } {
    const recentAchievements = this.achievements
      .filter(a => a.unlocked && a.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
      .slice(0, 3);

    const achievementProgress = this.getAchievementProgress();

    return {
      username: this.username,
      memberSince: this.userStats.dateJoined,
      stats: this.userStats,
      achievements: {
        completed: achievementProgress.completed,
        total: achievementProgress.total
      },
      recentAchievements
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    eventManager.removeAllListeners('user:username-change');
    eventManager.removeAllListeners('user:stats-update');
    eventManager.removeAllListeners('achievements:check');
    eventManager.removeAllListeners('achievements:reset');
    eventManager.removeAllListeners('station:added');
    eventManager.removeAllListeners('station:play');
    eventManager.removeAllListeners('shared-list:created');
  }
}