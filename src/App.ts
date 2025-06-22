/**
 * Main application class that orchestrates all modules
 */

import { AppState } from '@/types/app';
import { LocalStation, StationList } from '@/types/station';
import { eventManager } from '@/utils/events';
import { querySelector } from '@/utils/dom';
import { migrateStorage } from '@/utils/storage';
import { generateShareQRCode } from '@/utils/qrcode';

// Import services
import { sharingService, ShareData } from '@/services/sharing/SharingService';
import { radioBrowserApi } from '@/services/api/radioBrowserApi';

// Import all modules
import { RadioPlayer } from '@/modules/player/RadioPlayer';
import { StationManager } from '@/modules/stations/StationManager';
import { SearchManager } from '@/modules/search/SearchManager';
import { NotificationManager } from '@/modules/notifications/NotificationManager';
import { ModalManager } from '@/modules/modals/ModalManager';
import { SettingsManager } from '@/modules/settings/SettingsManager';
import { UserManager } from '@/modules/user/UserManager';
import { AchievementManager } from '@/modules/achievements/AchievementManager';
import { AchievementNotification } from '@/modules/achievements/AchievementNotification';
import { AchievementModal } from '@/modules/achievements/AchievementModal';

export interface AppConfig {
  version?: string;
  debug?: boolean;
  autoInit?: boolean;
}

/**
 * Main application class that coordinates all modules
 */
export class App {
  private config: AppConfig;
  private state: AppState;
  private isInitialized = false;
  private isDestroyed = false;

  // Module instances
  private radioPlayer: RadioPlayer;
  private stationManager: StationManager;
  private searchManager: SearchManager;
  private notificationManager: NotificationManager;
  private modalManager: ModalManager;
  private settingsManager: SettingsManager;
  private userManager: UserManager;
  private achievementManager: AchievementManager;
  private achievementNotification: AchievementNotification;
  private achievementModal: AchievementModal;

  constructor(config: AppConfig = {}) {
    this.config = {
      version: '2.0.0',
      debug: false,
      autoInit: true,
      ...config
    };

    // Initialize state
    this.state = {
      currentStation: null,
      stations: [],
      sharedStations: [],
      isPlaying: false,
      volume: 0.7,
      username: '',
      searchResults: [],
      currentView: 'stations',
      settings: {
        autoPlay: false,
        volume: 0.7,
        showVisualizer: true,
        compactView: false,
        darkMode: false,
        notifications: true,
        achievementsEnabled: true
      }
    };

    // Set debug mode
    if (this.config.debug) {
      eventManager.setDebugMode(true);
      console.log('[App] Debug mode enabled');
    }

    // Auto-initialize if requested
    if (this.config.autoInit) {
      this.init();
    }
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      return;
    }

    try {
      console.log(`[App] Initializing Not My First Radio v${this.config.version}`);

      // Migrate storage if needed
      migrateStorage();

      // Initialize modules in order of dependency
      await this.initializeModules();
      
      // Set up inter-module communication
      this.setupModuleIntegration();
      
      // Set up global event handlers
      this.setupGlobalEventHandlers();
      
      // Initial UI setup
      this.setupInitialUI();

      this.isInitialized = true;
      eventManager.emit('app:initialized', this.state);
      
      console.log('[App] Application initialized successfully');
      
      // Show welcome notification for new users
      if (!this.userManager.getUsername()) {
        this.notificationManager.info(
          'Welcome to Not My First Radio! Start by searching for stations to add to your collection.',
          7000
        );
      }

      // Check for shared stations in URL parameters
      await this.checkForSharedStations();

    } catch (error) {
      console.error('[App] Failed to initialize:', error);
      this.handleCriticalError(error as Error);
    }
  }

  /**
   * Initialize all modules
   */
  private async initializeModules(): Promise<void> {
    // Initialize core modules first
    this.userManager = new UserManager();
    this.settingsManager = new SettingsManager();
    this.notificationManager = new NotificationManager();
    this.modalManager = new ModalManager();

    // Initialize achievement system
    this.achievementManager = new AchievementManager({
      enableNotifications: true,
      notificationDuration: 5000
    });
    this.achievementNotification = new AchievementNotification();
    this.achievementModal = new AchievementModal();

    // Initialize player and station management
    this.radioPlayer = new RadioPlayer({
      volume: this.settingsManager.getSetting('volume'),
      autoPlay: this.settingsManager.getSetting('autoPlay')
    });

    this.stationManager = new StationManager({
      container: querySelector('#stations')
    });

    // Initialize search
    this.searchManager = new SearchManager({
      searchInput: querySelector('#search-input'),
      resultsContainer: querySelector('.results-grid')
    });

    console.log('[App] All modules initialized');
  }

  /**
   * Set up communication between modules
   */
  private setupModuleIntegration(): void {
    // Player ↔ Station Manager integration
    eventManager.on('station:play-request', (station: LocalStation) => {
      this.playStation(station);
    });

    eventManager.on('station:toggle-play', (station: LocalStation) => {
      this.toggleStationPlay(station);
    });

    eventManager.on('player:state-changed', (playerState) => {
      this.state.isPlaying = playerState.isPlaying;
      this.state.volume = playerState.volume;
      this.updatePlayerUI(playerState);
    });

    // Listen for player pause requests (e.g., from preview)
    eventManager.on('player:pause', () => {
      this.radioPlayer.pause();
    });

    // Listen for station selection to update UI immediately
    eventManager.on('station:selected', (station) => {
      this.state.currentStation = station;
      this.updatePlayerUI(this.radioPlayer.getState());
    });

    // Search ↔ Station Manager integration
    eventManager.on('station:add', (station) => {
      try {
        const addedStation = this.stationManager.addStation(station);
        this.notificationManager.success(`Added "${addedStation.name}" to your collection`);
        this.userManager.incrementStat('totalStationsAdded');
        
        // Track achievement progress
        this.achievementManager.trackProgress('stationAdded', this.userManager.getStats().totalStationsAdded, addedStation);
        eventManager.emit('achievements:check', 'station:added', addedStation);
      } catch (error) {
        this.notificationManager.error(`Failed to add station: ${(error as Error).message}`);
      }
    });

    // Settings integration
    eventManager.on('settings:changed', (data) => {
      this.state.settings = data.newSettings;
      this.radioPlayer.updateSettings(data.newSettings);
    });

    // User management integration
    eventManager.on('user:username-changed', (username) => {
      this.state.username = username;
    });

    // Modal integration for common actions
    eventManager.on('modal:add-station', () => {
      this.modalManager.showAddStation((stationData) => {
        eventManager.emit('station:add', stationData);
      });
    });

    // Achievement system integration
    eventManager.on('achievements:request-data', (callback) => {
      const categories = this.achievementManager.getCategories();
      const userStats = this.achievementManager.getUserStats();
      callback({ categories, userStats });
    });

    // Track various achievement events
    eventManager.on('station:play', (station) => {
      this.userManager.incrementStat('stationsPlayed');
      this.achievementManager.trackProgress('stationPlayed', 1, station);
    });

    eventManager.on('data:export', () => {
      this.achievementManager.trackProgress('export', 1);
    });

    eventManager.on('data:import', () => {
      this.achievementManager.trackProgress('import', 1);
    });

    eventManager.on('station:share', () => {
      this.achievementManager.trackProgress('qrShare', 1);
    });

    eventManager.on('search:completed', (data) => {
      this.achievementManager.trackProgress('search', 1);
      eventManager.emit('search:performed');
    });

    console.log('[App] Module integration set up');
  }

  /**
   * Set up global event handlers
   */
  private setupGlobalEventHandlers(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('[App] Uncaught error:', event.error);
      this.notificationManager.error('An unexpected error occurred');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[App] Unhandled promise rejection:', event.reason);
      this.notificationManager.error('An unexpected error occurred');
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      this.notificationManager.success('Connection restored');
    });

    window.addEventListener('offline', () => {
      this.notificationManager.warning('Connection lost - some features may not work');
    });

    // Handle visibility changes (page focus/blur)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        eventManager.emit('app:hidden');
      } else {
        eventManager.emit('app:visible');
      }
    });

    console.log('[App] Global event handlers set up');
  }

  /**
   * Set up initial UI state
   */
  private setupInitialUI(): void {
    // Initialize menu button
    const menuBtn = querySelector('#menu-btn');
    menuBtn.addEventListener('click', () => {
      this.toggleSettingsPanel();
    });

    // Initialize clear search button
    const clearBtn = querySelector('#clear-input');
    clearBtn.addEventListener('click', () => {
      this.searchManager.clearSearch();
    });

    // Initialize clear results button
    const clearResultsBtn = querySelector('#clear-results');
    clearResultsBtn.addEventListener('click', () => {
      this.searchManager.clearSearch();
    });

    // Initialize settings panel controls
    this.setupSettingsControls();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Display initial stations
    this.stationManager.renderStations();

    console.log('[App] Initial UI setup complete');
  }

  /**
   * Set up settings panel controls
   */
  private setupSettingsControls(): void {
    // Settings overlay click to close
    const overlay = querySelector('#settings-overlay');
    overlay.addEventListener('click', () => {
      const settingsPanel = querySelector('#settings-panel');
      if (!settingsPanel.classList.contains('hidden')) {
        this.closeSettingsPanel(settingsPanel, overlay);
      }
    });

    // Settings close button
    const closeBtn = querySelector('#close-settings');
    closeBtn.addEventListener('click', () => {
      const settingsPanel = querySelector('#settings-panel');
      const settingsOverlay = querySelector('#settings-overlay');
      this.closeSettingsPanel(settingsPanel, settingsOverlay);
    });

    // Prevent settings panel clicks from closing when clicking inside panel
    const settingsPanel = querySelector('#settings-panel');
    settingsPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Username save functionality - setup when settings panel opens
    // this.setupUsernameControls();

    // Settings panel action buttons - setup when settings panel opens  
    // this.setupSettingsActions();
  }

  /**
   * Populate settings content HTML
   */
  private populateSettingsContent(settingsContent: HTMLElement): void {
    settingsContent.innerHTML = `
      <div class="settings-section">
        <h3>Username</h3>
        <div class="username-section">
          <p class="username-hint">This name will be used when sharing your stations with other people.</p>
          <div class="username-input-wrapper">
            <input type="text" id="username-input" class="username-input">
            <button id="save-username" class="save-username-btn">Save</button>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Share & Export Stations</h3>
        <button id="share-url" class="settings-btn">
          <span class="material-symbols-rounded">link</span>
          Share with a link
        </button>
        <button id="share-qr" class="settings-btn">
          <span class="material-symbols-rounded">qr_code</span>
          Share with a QR code
        </button>
        <button id="export-data" class="settings-btn">
          <span class="material-symbols-rounded">download</span>
          Export as .json
        </button>
      </div>
      
      <div class="settings-section">
        <h3>Import Stations</h3>
        <div class="file-input-wrapper settings-btn">
          <input type="file" id="import-file" accept=".json" style="display: none;">
          <label for="import-file">
            <span class="material-symbols-rounded">upload</span>
            Import from a .json file
          </label>
        </div>
        <button id="open-add-station" class="settings-btn">
          <span class="material-symbols-rounded">add_circle</span>
          Add a station manually
        </button>
      </div>
      
      <div class="settings-section">
        <h3>Achievements</h3>
        <button id="open-achievements" class="settings-btn">
          <span class="material-symbols-rounded">emoji_events</span>
          View Your Achievements
        </button>
      </div>
      
      <div class="settings-section">
        <h3>Data Management</h3>
        <button id="clear-stations" class="settings-btn danger">
          <span class="material-symbols-rounded">delete_sweep</span>
          Clear saved stations
        </button>
        <button id="clear-shared-stations" class="settings-btn danger">
          <span class="material-symbols-rounded">delete_sweep</span>
          Clear shared stations
        </button>
        <button id="reset-achievements" class="settings-btn danger">
          <span class="material-symbols-rounded">restart_alt</span>
          Reset achievements
        </button>
      </div>
      
      <div class="settings-section">
        <h3>About</h3>
        <p>Not My First Radio is developed by <a href="https://www.milesgilbert.xyz" target="_blank">Miles Gilbert</a> as part of a series of non-algorithmically driven discovery apps. It is open source and available on <a href="https://github.com/brainnews/not-my-first-radio" target="_blank">GitHub</a>.</p>
        <button id="open-terms" class="settings-btn">
          <span class="material-symbols-rounded">description</span>
          Terms & Privacy Facts
        </button>
        <a href="https://milesgilbert.xyz/thinking/a-certification-for-algorithm-free-platforms/" target="_blank">
          <img src="./images/non-algo-badge.png" alt="Non-Algo Project verified badge" style="width: 100%; max-width: 200px; margin-top: 2rem;">
        </a>
      </div>
    `;
  }

  /**
   * Set up settings panel controls when panel is opened
   */
  private setupSettingsPanelControls(): void {
    // Only setup once
    if (this.settingsPanelSetup) return;
    this.settingsPanelSetup = true;

    this.setupUsernameControls();
    this.setupSettingsActions();
  }

  private settingsPanelSetup = false;

  /**
   * Set up username controls
   */
  private setupUsernameControls(): void {
    try {
      const usernameInput = querySelector('#username-input') as HTMLInputElement;
      const saveUsernameBtn = querySelector('#save-username');

      // Load current username
      const currentUsername = this.userManager.getUsername();
      if (currentUsername) {
        usernameInput.value = currentUsername;
      }

      // Save username on button click
      saveUsernameBtn.addEventListener('click', () => {
        const newUsername = usernameInput.value.trim();
        if (newUsername) {
          try {
            this.userManager.setUsername(newUsername);
            this.notificationManager.success(`Username saved as "${newUsername}"`);
          } catch (error) {
            this.notificationManager.error(`Failed to save username: ${(error as Error).message}`);
          }
        } else {
          this.notificationManager.error('Please enter a valid username');
        }
      });

      // Save username on Enter key
      usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveUsernameBtn.click();
        }
      });
    } catch (error) {
      console.warn('Failed to setup username controls:', error);
    }
  }

  /**
   * Set up settings panel action buttons
   */
  private setupSettingsActions(): void {
    try {
      // Share with link button
      const shareUrlBtn = querySelector('#share-url');
      shareUrlBtn.addEventListener('click', async () => {
        await this.shareStationsAsUrl();
      });

      // Share with QR code button
      const shareQrBtn = querySelector('#share-qr');
      shareQrBtn.addEventListener('click', async () => {
        await this.shareStationsAsQR();
      });

      // Export as JSON button
      const exportBtn = querySelector('#export-data');
      exportBtn.addEventListener('click', () => {
        this.exportStationsAsJSON();
      });

      // Import from JSON button
      const importBtn = querySelector('#import-file');
      importBtn.addEventListener('change', (e) => {
        this.handleStationImport(e as Event);
      });

      // Add station manually button
      const addStationBtn = querySelector('#open-add-station');
      addStationBtn.addEventListener('click', () => {
        this.modalManager.showAddStation((stationData) => {
          eventManager.emit('station:add', stationData);
        });
      });

      // Achievements button
      const achievementsBtn = querySelector('#open-achievements');
      achievementsBtn.addEventListener('click', () => {
        this.achievementModal.show();
      });

      // Data management buttons
      this.setupDataManagementButtons();
    } catch (error) {
      console.warn('Failed to setup settings actions:', error);
    }
  }

  /**
   * Set up data management buttons with confirmations
   */
  private setupDataManagementButtons(): void {
    try {
      const clearStationsBtn = querySelector('#clear-stations');
      const clearSharedBtn = querySelector('#clear-shared-stations');
      const resetAchievementsBtn = querySelector('#reset-achievements');

      clearStationsBtn.addEventListener('click', () => {
        this.modalManager.confirm(
          'Clear All Stations',
          'Are you sure you want to clear all saved stations? This cannot be undone.',
          () => {
            this.stationManager.clearStations();
            this.notificationManager.success('All stations cleared');
          }
        );
      });

      clearSharedBtn.addEventListener('click', () => {
        this.modalManager.confirm(
          'Clear Shared Stations',
          'Are you sure you want to clear all shared station lists? This cannot be undone.',
          () => {
            this.stationManager.clearSharedStations();
            this.notificationManager.success('All shared stations cleared');
          }
        );
      });

      resetAchievementsBtn.addEventListener('click', () => {
        this.modalManager.confirm(
          'Reset Achievements',
          'Are you sure you want to reset all achievements? This cannot be undone.',
          () => {
            this.userManager.resetAchievements();
            this.achievementManager.resetAllAchievements();
            this.notificationManager.success('All achievements reset');
          }
        );
      });
    } catch (error) {
      console.warn('Failed to setup data management buttons:', error);
    }
  }

  /**
   * Set button loading state
   */
  private setButtonLoading(buttonId: string, loading: boolean): void {
    try {
      const button = querySelector(buttonId) as HTMLButtonElement;
      
      if (loading) {
        // Store original HTML content if not already stored
        if (!button.getAttribute('data-original-html')) {
          button.setAttribute('data-original-html', button.innerHTML);
        }
        button.disabled = true;
        button.innerHTML = '<span class="material-symbols-rounded spinning">progress_activity</span> ' + (buttonId.includes('qr') ? 'Generating QR...' : 'Creating Link...');
        button.style.opacity = '0.7';
      } else {
        button.disabled = false;
        const originalHtml = button.getAttribute('data-original-html');
        if (originalHtml) {
          button.innerHTML = originalHtml;
        }
        button.style.opacity = '1';
      }
    } catch (error) {
      console.warn('[App] Failed to update button state:', error);
    }
  }

  /**
   * Share stations as URL
   */
  private async shareStationsAsUrl(): Promise<void> {
    this.setButtonLoading('#share-url', true);
    
    try {
      const stations = this.stationManager.getStations();
      if (stations.length === 0) {
        this.notificationManager.warning('No stations to share');
        return;
      }

      const username = this.userManager.getUsername();
      const shareData = await this.stationManager.shareStations(stations, username ? `${username}'s Stations` : 'My Stations', username);
      
      // Track sharing achievement
      eventManager.emit('station:share');
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData);
        this.notificationManager.success('Share link copied to clipboard');
      } else {
        this.notificationManager.info(`Share link: ${shareData}`);
      }
    } catch (error) {
      this.notificationManager.error('Failed to create share link');
    } finally {
      this.setButtonLoading('#share-url', false);
    }
  }

  /**
   * Share stations as QR code
   */
  private async shareStationsAsQR(): Promise<void> {
    this.setButtonLoading('#share-qr', true);
    
    try {
      const stations = this.stationManager.getStations();
      if (stations.length === 0) {
        this.notificationManager.warning('No stations to share');
        return;
      }

      const username = this.userManager.getUsername();
      const shareData = await this.stationManager.shareStations(stations, username ? `${username}'s Stations` : 'My Stations', username);
      
      // Track sharing achievement
      eventManager.emit('station:share');
      
      // Generate QR code
      const isDarkMode = this.settingsManager.getSetting('darkMode');
      const qrCodeDataUrl = await generateShareQRCode(shareData, isDarkMode);
      
      // Show QR code modal
      this.modalManager.showQRCode(
        'Share Your Stations',
        qrCodeDataUrl,
        'Scan this QR code with your phone\'s camera to import these stations.'
      );
      
    } catch (error) {
      console.error('QR code generation error:', error);
      this.notificationManager.error('Failed to create QR code');
    } finally {
      this.setButtonLoading('#share-qr', false);
    }
  }

  /**
   * Check for shared stations in URL parameters
   */
  private async checkForSharedStations(): Promise<void> {
    try {
      const shareData = sharingService.parseSharedData();
      if (!shareData) {
        return; // No shared data in URL
      }

      console.log('[App] Found shared station data in URL:', shareData);

      // Resolve station data from UUIDs and objects
      const stations = await this.resolveSharedStations(shareData.i);
      
      if (stations.length === 0) {
        this.notificationManager.warning('No valid stations found in shared link');
        sharingService.clearShareParams();
        return;
      }

      // Show import confirmation modal
      await this.showImportModal(shareData, stations);

    } catch (error) {
      console.error('[App] Failed to process shared stations:', error);
      this.notificationManager.error('Failed to process shared stations');
      sharingService.clearShareParams();
    }
  }

  /**
   * Resolve shared stations from mixed UUID/object array
   */
  private async resolveSharedStations(stationItems: (string | LocalStation)[]): Promise<LocalStation[]> {
    const resolvedStations: LocalStation[] = [];

    for (const item of stationItems) {
      try {
        if (typeof item === 'string') {
          // Item is a UUID, fetch from Radio Browser API
          const response = await radioBrowserApi.getStationByUuid(item);
          if (response.success && response.data) {
            resolvedStations.push(response.data);
          } else {
            console.warn('[App] Could not fetch station with UUID:', item);
          }
        } else {
          // Item is already a complete station object
          resolvedStations.push(item);
        }
      } catch (error) {
        console.error('[App] Failed to resolve station:', item, error);
      }
    }

    return resolvedStations;
  }

  /**
   * Show import confirmation modal for shared stations
   */
  private async showImportModal(shareData: ShareData, stations: LocalStation[]): Promise<void> {
    return new Promise((resolve) => {
      const username = shareData.u || 'Unknown User';
      const listName = shareData.name || `${username}'s Stations`;
      
      const content = `
        <div style="text-align: left;">
          <p><strong>From:</strong> ${username}</p>
          <p><strong>List:</strong> ${listName}</p>
          <p><strong>Stations:</strong> ${stations.length}</p>
          <div style="max-height: 200px; overflow-y: auto; margin: 10px 0; padding: 10px; background: var(--bg-secondary); border-radius: 4px;">
            ${stations.map(station => `
              <div style="margin: 5px 0; padding: 5px; border-bottom: 1px solid var(--border-color);">
                <strong>${station.name}</strong><br>
                <small style="color: var(--text-secondary);">${station.country || ''} ${station.tags ? '• ' + station.tags : ''}</small>
              </div>
            `).join('')}
          </div>
          <p>Would you like to import these stations?</p>
        </div>
      `;

      const modal = {
        type: 'confirmation' as const,
        title: 'Import Shared Stations',
        content: content,
        actions: [
          {
            label: 'Cancel',
            style: 'secondary' as const,
            action: async () => {
              // Clean up URL parameters
              sharingService.clearShareParams();
              resolve();
            }
          },
          {
            label: 'Import Stations',
            style: 'primary' as const,
            action: async () => {
              await this.importSharedStations(stations, listName);
              // Clean up URL parameters
              sharingService.clearShareParams();
              resolve();
            }
          }
        ],
        size: 'medium' as const,
        closable: true
      };

      this.modalManager.open(modal);
    });
  }

  /**
   * Import shared stations to the collection
   */
  private async importSharedStations(stations: LocalStation[], listName: string): Promise<void> {
    try {
      // Create a StationList object as expected by importSharedList
      const stationList = {
        id: `shared-${Date.now()}`,
        name: listName,
        stations: stations,
        createdBy: 'shared',
        createdAt: new Date().toISOString(),
        description: `Imported shared station list: ${listName}`,
        isPublic: false
      };

      const importedCount = this.stationManager.importSharedList(stationList);
      
      // Track achievement for importing stations
      eventManager.emit('station:import', { count: stations.length });
      
      // Show success notification
      this.notificationManager.success(
        `Successfully imported ${importedCount} stations from "${listName}"`
      );

      // Show additional info if some stations were skipped
      const skipped = stations.length - importedCount;
      if (skipped > 0) {
        this.notificationManager.info(
          `${skipped} stations were already in your collection`
        );
      }

    } catch (error) {
      console.error('[App] Failed to import shared stations:', error);
      this.notificationManager.error('Failed to import shared stations');
    }
  }

  /**
   * Export stations as JSON
   */
  private exportStationsAsJSON(): void {
    try {
      const data = this.settingsManager.exportSettings();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `nmfr-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Track export achievement
      eventManager.emit('data:export');
      
      this.notificationManager.success('Stations exported successfully');
    } catch (error) {
      this.notificationManager.error('Failed to export stations');
    }
  }

  /**
   * Handle station import from file
   */
  private handleStationImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = this.settingsManager.importSettings(content);
        
        if (success) {
          // Track import achievement
          eventManager.emit('data:import');
          
          this.notificationManager.success('Stations imported successfully');
          this.stationManager.renderStations(); // Refresh the UI
        } else {
          this.notificationManager.error('Failed to import stations - invalid file format');
        }
      } catch (error) {
        this.notificationManager.error('Failed to read import file');
      }
      
      // Clear the input so the same file can be selected again
      input.value = '';
    };
    
    reader.onerror = () => {
      this.notificationManager.error('Failed to read import file');
      input.value = '';
    };
    
    reader.readAsText(file);
  }

  /**
   * Set up global keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Don't handle shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.code) {
        case 'KeyS':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            querySelector('#search-input').focus();
          }
          break;
        case 'Escape':
          if (this.modalManager.isOpen()) {
            this.modalManager.close();
          }
          break;
        case 'KeyH':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.showHelp();
          }
          break;
      }
    });
  }

  /**
   * Play a station
   */
  private async playStation(station: LocalStation): Promise<void> {
    try {
      await this.radioPlayer.loadStation(station);
      await this.radioPlayer.play(); // Explicitly start playback
      this.state.currentStation = station;
      this.userManager.incrementStat('stationsPlayed');
      
      // Track achievements for playing
      eventManager.emit('station:play', station);
      eventManager.emit('achievements:check', 'station:play');
    } catch (error) {
      console.error('[App] Failed to play station:', error);
      this.notificationManager.error(`Failed to play "${station.name}"`);
    }
  }

  /**
   * Toggle play/pause for a station
   */
  private async toggleStationPlay(station: LocalStation): Promise<void> {
    try {
      // Check if this station is currently playing
      const currentStation = this.radioPlayer.getCurrentStation();
      const isPlaying = this.state.isPlaying;
      
      if (currentStation && 
          (currentStation.stationuuid === station.stationuuid || 
           (currentStation.url === station.url && currentStation.name === station.name))) {
        // Same station is loaded - toggle play/pause
        if (isPlaying) {
          this.radioPlayer.pause();
        } else {
          await this.radioPlayer.play();
        }
      } else {
        // Different station - load and play it
        await this.playStation(station);
      }
    } catch (error) {
      console.error('[App] Failed to toggle station playback:', error);
      this.notificationManager.error(`Failed to control "${station.name}"`);
    }
  }

  /**
   * Update player UI elements
   */
  private updatePlayerUI(playerState: any): void {
    const playerBar = querySelector('.player-bar');
    const stationName = querySelector('#station-name');
    const stationDetails = querySelector('#station-details');
    const playPauseBtn = querySelector('#play-pause');
    const nowPlaying = querySelector('.now-playing');

    if (this.state.currentStation) {
      // Show player bar
      playerBar.classList.add('active');
      
      // Update station info
      stationName.textContent = this.state.currentStation.name;
      
      // Build station details string
      const details = [];
      if (this.state.currentStation.bitrate && this.state.currentStation.bitrate > 0) {
        details.push(`${this.state.currentStation.bitrate}kbps`);
      }
      if (this.state.currentStation.countrycode || this.state.currentStation.country) {
        details.push(this.state.currentStation.countrycode || this.state.currentStation.country);
      }
      stationDetails.textContent = details.join(' • ');
      
      // Update favicon
      const favicon = querySelector('#current-favicon');
      if (this.state.currentStation.favicon) {
        favicon.src = this.state.currentStation.favicon;
        favicon.style.display = 'block';
      } else {
        favicon.style.display = 'none';
      }

      // Handle loading state
      if (playerState.isLoading) {
        nowPlaying.classList.add('loading');
        const staticDiv = querySelector('.static');
        staticDiv.classList.remove('hidden');
      } else {
        nowPlaying.classList.remove('loading');
        const staticDiv = querySelector('.static');
        staticDiv.classList.add('hidden');
      }
    } else {
      // Hide player bar when no station
      playerBar.classList.remove('active');
      stationName.textContent = 'Select a station';
      stationDetails.textContent = '';
    }

    // Update play/pause button
    const playIcon = playPauseBtn.querySelector('.material-symbols-rounded');
    if (playIcon) {
      if (playerState.isLoading) {
        playIcon.textContent = 'progress_activity';
        playIcon.classList.add('spinning');
      } else {
        playIcon.textContent = playerState.isPlaying ? 'pause' : 'play_arrow';
        playIcon.classList.remove('spinning');
      }
    }

    // Set up play/pause button click handler (only set once)
    if (!playPauseBtn.hasAttribute('data-handler-set')) {
      playPauseBtn.onclick = () => {
        this.radioPlayer.togglePlayPause();
      };
      playPauseBtn.setAttribute('data-handler-set', 'true');
    }
  }

  /**
   * Toggle settings panel with proper slide animation
   */
  private toggleSettingsPanel(): void {
    const settingsPanel = querySelector('#settings-panel');
    const overlay = querySelector('#settings-overlay');
    
    const isHidden = settingsPanel.classList.contains('hidden');
    
    if (isHidden) {
      this.openSettingsPanel(settingsPanel, overlay);
    } else {
      this.closeSettingsPanel(settingsPanel, overlay);
    }
  }

  /**
   * Open settings panel with slide animation
   */
  private openSettingsPanel(settingsPanel: HTMLElement, overlay: HTMLElement): void {
    // Remove hidden class first
    settingsPanel.classList.remove('hidden');
    overlay.classList.remove('hidden');
    
    // Ensure display is block (override hidden class)
    settingsPanel.style.display = 'block';
    overlay.style.display = 'block';
    
    // Force visibility of all content
    settingsPanel.style.visibility = 'visible';
    settingsPanel.style.opacity = '1';
    
    // Populate settings content if it's empty
    const settingsContent = settingsPanel.querySelector('.settings-content');
    if (settingsContent && settingsContent.children.length === 0) {
      this.populateSettingsContent(settingsContent as HTMLElement);
    }
    
    // Set up panel controls now that elements are visible
    this.setupSettingsPanelControls();
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    
    // Use setTimeout to ensure transitions work properly
    setTimeout(() => {
      settingsPanel.classList.add('visible');
      overlay.classList.add('visible');
    }, 10);
  }

  /**
   * Close settings panel with slide animation
   */
  private closeSettingsPanel(settingsPanel: HTMLElement, overlay: HTMLElement): void {
    // Remove visible class to trigger slide-out animation
    settingsPanel.classList.remove('visible');
    overlay.classList.remove('visible');
    
    // Restore body scrolling
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    
    // Wait for transition to complete before hiding
    setTimeout(() => {
      settingsPanel.classList.add('hidden');
      overlay.classList.add('hidden');
      // Reset all inline styles
      settingsPanel.style.cssText = '';
      overlay.style.cssText = '';
    }, 300);
  }

  /**
   * Show help modal
   */
  private showHelp(): void {
    const helpContent = `
      <h3>Keyboard Shortcuts</h3>
      <ul>
        <li><kbd>Space</kbd> - Play/Pause</li>
        <li><kbd>Ctrl/Cmd + S</kbd> - Focus search</li>
        <li><kbd>Ctrl/Cmd + H</kbd> - Show help</li>
        <li><kbd>Ctrl/Cmd + ↑/↓</kbd> - Volume control</li>
        <li><kbd>Ctrl/Cmd + M</kbd> - Mute/unmute</li>
        <li><kbd>Escape</kbd> - Close modals</li>
      </ul>
      <h3>Features</h3>
      <ul>
        <li>Search thousands of radio stations worldwide</li>
        <li>Save your favorite stations</li>
        <li>Share station lists with friends</li>
        <li>Track listening achievements</li>
        <li>No algorithms - discover music naturally</li>
      </ul>
    `;

    this.modalManager.open({
      type: 'terms',
      title: 'Help & Information',
      content: helpContent,
      size: 'medium'
    });
  }

  /**
   * Handle critical errors
   */
  private handleCriticalError(error: Error): void {
    console.error('[App] Critical error:', error);
    
    // Show error modal
    this.modalManager?.alert(
      'Application Error',
      'A critical error occurred. Please refresh the page to continue.',
      () => {
        window.location.reload();
      }
    );
  }

  /**
   * Get current application state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get module instances (for debugging)
   */
  getModules() {
    return {
      radioPlayer: this.radioPlayer,
      stationManager: this.stationManager,
      searchManager: this.searchManager,
      notificationManager: this.notificationManager,
      modalManager: this.modalManager,
      settingsManager: this.settingsManager,
      userManager: this.userManager,
      achievementManager: this.achievementManager,
      achievementNotification: this.achievementNotification,
      achievementModal: this.achievementModal
    };
  }

  /**
   * Destroy the application and clean up resources
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    console.log('[App] Destroying application');

    // Destroy all modules
    this.radioPlayer?.destroy();
    this.stationManager?.destroy();
    this.searchManager?.destroy();
    this.notificationManager?.destroy();
    this.modalManager?.destroy();
    this.settingsManager?.destroy();
    this.userManager?.destroy();
    this.achievementManager?.destroy();
    this.achievementNotification?.destroy();
    this.achievementModal?.destroy();

    // Clear all event listeners
    eventManager.removeAllListeners();

    this.isDestroyed = true;
    this.isInitialized = false;

    console.log('[App] Application destroyed');
  }
}