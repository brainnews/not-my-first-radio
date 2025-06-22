/**
 * Station management module for CRUD operations and display logic
 */

import { LocalStation, StationList, RadioStation } from '@/types/station';
import { eventManager } from '@/utils/events';
import { getStorageItem, setStorageItem, StorageKeys } from '@/utils/storage';
import { querySelector, createElement } from '@/utils/dom';
import { sharingService } from '@/services/sharing/SharingService';
import { getCountryIcon, getVotesIcon, getBitrateIcon, getStationPlaceholderIcon } from '@/utils/icons';

export interface StationManagerConfig {
  container?: HTMLElement;
  autoSave?: boolean;
  maxStations?: number;
}

/**
 * Manages user stations, shared lists, and station display
 */
export class StationManager {
  private stations: LocalStation[] = [];
  private sharedStations: StationList[] = [];
  private container: HTMLElement;
  private autoSave: boolean;
  private maxStations: number;
  private currentPlayingStation: LocalStation | null = null;
  private isCurrentlyPlaying: boolean = false;

  constructor(config: StationManagerConfig = {}) {
    this.container = config.container || querySelector('#stations');
    this.autoSave = config.autoSave ?? true;
    this.maxStations = config.maxStations || 1000;

    this.loadStations();
    this.loadSharedStations();
    this.setupEventListeners();
  }

  /**
   * Load stations from storage
   */
  private loadStations(): void {
    this.stations = getStorageItem(StorageKeys.STATIONS, []);
    this.migrateOldStations();
    eventManager.emit('stations:loaded', this.stations);
  }

  /**
   * Load shared station lists from storage
   */
  private loadSharedStations(): void {
    this.sharedStations = getStorageItem(StorageKeys.SHARED_STATIONS, []);
    eventManager.emit('shared-stations:loaded', this.sharedStations);
  }

  /**
   * Migrate old station format if needed
   */
  private migrateOldStations(): void {
    let needsMigration = false;

    this.stations = this.stations.map(station => {
      if (!station.id) {
        station.id = station.stationuuid || this.generateStationId();
        needsMigration = true;
      }
      if (!station.dateAdded) {
        station.dateAdded = new Date().toISOString();
        needsMigration = true;
      }
      if (station.playCount === undefined) {
        station.playCount = 0;
        needsMigration = true;
      }
      if (station.isFavorite === undefined) {
        station.isFavorite = false;
        needsMigration = true;
      }
      return station;
    });

    if (needsMigration && this.autoSave) {
      this.saveStations();
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('station:remove', (stationId: string) => {
      this.removeStation(stationId);
    });

    eventManager.on('station:update', (station: LocalStation) => {
      this.updateStation(station);
    });

    eventManager.on('stations:clear', () => {
      this.clearStations();
    });

    // Listen for player state changes to update UI
    eventManager.on('station:selected', (station: LocalStation) => {
      this.currentPlayingStation = station;
      this.updatePlayingStationUI();
    });

    eventManager.on('station:play', (station: LocalStation) => {
      this.currentPlayingStation = station;
      this.isCurrentlyPlaying = true;
      this.updatePlayingStationUI();
    });

    eventManager.on('station:pause', () => {
      this.isCurrentlyPlaying = false;
      this.updatePlayingStationUI();
    });

    eventManager.on('station:stop', () => {
      this.currentPlayingStation = null;
      this.isCurrentlyPlaying = false;
      this.updatePlayingStationUI();
    });

    eventManager.on('stations:import', (stations: LocalStation[]) => {
      this.importStations(stations);
    });

    eventManager.on('stations:display', () => {
      this.renderStations();
    });
  }

  /**
   * Generate unique station ID
   */
  private generateStationId(): string {
    return `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save stations to storage
   */
  private saveStations(): void {
    if (this.autoSave) {
      setStorageItem(StorageKeys.STATIONS, this.stations);
      eventManager.emit('stations:saved', this.stations);
    }
  }

  /**
   * Save shared stations to storage
   */
  private saveSharedStations(): void {
    if (this.autoSave) {
      setStorageItem(StorageKeys.SHARED_STATIONS, this.sharedStations);
      eventManager.emit('shared-stations:saved', this.sharedStations);
    }
  }

  /**
   * Add a new station
   */
  addStation(radioStation: RadioStation): LocalStation {
    // Check if station already exists
    const existingStation = this.stations.find(s => s.stationuuid === radioStation.stationuuid);
    if (existingStation) {
      throw new Error('Station already exists');
    }

    // Check station limit
    if (this.stations.length >= this.maxStations) {
      throw new Error(`Maximum number of stations (${this.maxStations}) reached`);
    }

    // Create local station
    const localStation: LocalStation = {
      ...radioStation,
      id: this.generateStationId(),
      dateAdded: new Date().toISOString(),
      playCount: 0,
      isFavorite: false
    };

    this.stations.unshift(localStation);
    this.saveStations();
    
    // Re-render the UI to show the new station immediately
    this.renderStations();
    
    eventManager.emit('station:added', localStation);
    return localStation;
  }

  /**
   * Remove a station
   */
  removeStation(stationId: string): boolean {
    const index = this.stations.findIndex(s => s.id === stationId);
    if (index === -1) {
      return false;
    }

    const removedStation = this.stations.splice(index, 1)[0];
    this.saveStations();
    
    // Re-render the UI to remove the station immediately
    this.renderStations();
    
    eventManager.emit('station:removed', removedStation);
    return true;
  }

  /**
   * Update station metadata
   */
  updateStation(updatedStation: Partial<LocalStation> & { id: string }): boolean {
    const index = this.stations.findIndex(s => s.id === updatedStation.id);
    if (index === -1) {
      return false;
    }

    this.stations[index] = { ...this.stations[index], ...updatedStation };
    this.saveStations();
    
    // Re-render the UI to show the updated station immediately
    this.renderStations();
    
    eventManager.emit('station:updated', this.stations[index]);
    return true;
  }

  /**
   * Get station by ID
   */
  getStation(stationId: string): LocalStation | null {
    return this.stations.find(s => s.id === stationId) || null;
  }

  /**
   * Get station by UUID
   */
  getStationByUuid(uuid: string): LocalStation | null {
    return this.stations.find(s => s.stationuuid === uuid) || null;
  }

  /**
   * Get all stations
   */
  getAllStations(): LocalStation[] {
    return [...this.stations];
  }

  /**
   * Get pinned stations
   */
  getPinnedStations(): LocalStation[] {
    return this.stations.filter(s => s.isFavorite);
  }

  /**
   * Get recently played stations
   */
  getRecentlyPlayed(limit = 10): LocalStation[] {
    return this.stations
      .filter(s => s.lastPlayed)
      .sort((a, b) => new Date(b.lastPlayed!).getTime() - new Date(a.lastPlayed!).getTime())
      .slice(0, limit);
  }

  /**
   * Get most played stations
   */
  getMostPlayed(limit = 10): LocalStation[] {
    return this.stations
      .filter(s => s.playCount > 0)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit);
  }

  /**
   * Search stations by name or country
   */
  searchStations(query: string): LocalStation[] {
    const lowercaseQuery = query.toLowerCase();
    return this.stations.filter(station =>
      station.name.toLowerCase().includes(lowercaseQuery) ||
      station.country?.toLowerCase().includes(lowercaseQuery) ||
      station.tags?.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Toggle pinned status
   */
  togglePin(stationId: string): boolean {
    const station = this.getStation(stationId);
    if (!station) {
      return false;
    }

    station.isFavorite = !station.isFavorite; // Using isFavorite field for pinning
    this.saveStations();
    
    // Re-render the UI to update the pinned status immediately
    this.renderStations();
    
    eventManager.emit('station:pin-toggled', station);
    return station.isFavorite;
  }

  /**
   * Update station note
   */
  updateStationNote(stationId: string, note: string): boolean {
    const station = this.getStation(stationId);
    if (!station) {
      return false;
    }

    station.note = note || undefined;
    this.saveStations();
    
    // Re-render the UI to show the updated note immediately
    this.renderStations();
    
    eventManager.emit('station:note-updated', station);
    return true;
  }

  /**
   * Clear all stations
   */
  clearStations(): void {
    this.stations = [];
    this.saveStations();
    
    // Re-render the UI to show empty state immediately
    this.renderStations();
    
    eventManager.emit('stations:cleared');
  }

  /**
   * Import stations from array
   */
  importStations(newStations: LocalStation[], mergeMode = false): number {
    let importedCount = 0;

    if (!mergeMode) {
      this.stations = [];
    }

    newStations.forEach(station => {
      try {
        // Ensure station has required fields
        if (!station.id) {
          station.id = this.generateStationId();
        }
        if (!station.dateAdded) {
          station.dateAdded = new Date().toISOString();
        }

        // Check for duplicates
        const exists = this.stations.some(s => s.stationuuid === station.stationuuid);
        if (!exists && this.stations.length < this.maxStations) {
          this.stations.push(station);
          importedCount++;
        }
      } catch (error) {
        console.warn('Failed to import station:', station.name, error);
      }
    });

    this.saveStations();
    
    // Re-render the UI to show imported stations immediately
    this.renderStations();
    
    eventManager.emit('stations:imported', { count: importedCount, total: newStations.length });
    
    return importedCount;
  }

  /**
   * Export stations to JSON
   */
  exportStations(): string {
    return JSON.stringify(this.stations, null, 2);
  }

  /**
   * Create a shared station list
   */
  createSharedList(name: string, stationIds: string[], description?: string): StationList {
    const stations = stationIds
      .map(id => this.getStation(id))
      .filter((station): station is LocalStation => station !== null);

    const sharedList: StationList = {
      id: this.generateStationId(),
      name,
      stations,
      createdBy: getStorageItem(StorageKeys.USERNAME, 'Anonymous'),
      createdAt: new Date().toISOString(),
      description,
      isPublic: true
    };

    this.sharedStations.push(sharedList);
    this.saveSharedStations();
    
    eventManager.emit('shared-list:created', sharedList);
    return sharedList;
  }

  /**
   * Get shared station lists
   */
  getSharedLists(): StationList[] {
    return [...this.sharedStations];
  }

  /**
   * Import shared station list
   */
  importSharedList(sharedList: StationList): number {
    return this.importStations(sharedList.stations, true);
  }

  /**
   * Render stations in the container
   */
  renderStations(): void {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';

    if (this.stations.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Show the saved stations title when there are stations
    const savedStationsTitle = document.getElementById('saved-stations-title');
    if (savedStationsTitle) {
      savedStationsTitle.classList.remove('hidden');
    }

    // Create sections
    const pinnedStations = this.getPinnedStations();
    const recentStations = this.getRecentlyPlayed(5);
    const allStations = this.stations;

    if (pinnedStations.length > 0) {
      this.renderStationSection('Pinned', pinnedStations);
    }

    if (recentStations.length > 0) {
      this.renderStationSection('Recently Played', recentStations);
    }

    this.renderStationSection('All Stations', allStations);
  }

  /**
   * Render empty state with welcome flow and starter packs
   */
  private renderEmptyState(): void {
    // First hide the saved stations title
    const savedStationsTitle = document.getElementById('saved-stations-title');
    if (savedStationsTitle) {
      savedStationsTitle.classList.add('hidden');
    }

    const emptyState = createElement('div', { className: 'empty-state' });
    
    // Empty state header with welcome message
    const emptyStateHeader = createElement('div', { className: 'empty-state-header' }, [
      createElement('img', {
        src: './icons/icon128-transparent.png',
        alt: 'Not My First Radio',
        className: 'welcome-icon'
      }),
      createElement('p', {
        className: 'welcome'
      }, ['Not My First Radio is a lightweight, private, and local first radio player. Search over 30,000 stations above or start listening right away with a starter pack below. No account required.'])
    ]);
    
    // Starter packs grid with loading indicator
    const starterPacksGrid = createElement('div', { className: 'starter-packs-grid' }, [
      createElement('div', { className: 'loading-indicator' }, [
        createElement('div', { className: 'loading-spinner' }),
        createElement('div', { className: 'loading-text' }, ['Loading starter packs...'])
      ])
    ]);
    
    // Settings import message
    const importMessage = createElement('p', {
      style: 'color: var(--text-secondary);'
    });
    
    const settingsBtn = createElement('button', {
      className: 'settings-btn',
      id: 'empty-state-settings',
      style: 'display: inline; width: auto;'
    }, [
      createElement('span', { className: 'material-symbols-rounded' }, ['settings']),
      'Settings'
    ]);
    
    importMessage.innerHTML = 'Have a .json file? Open ';
    importMessage.appendChild(settingsBtn);
    importMessage.appendChild(document.createTextNode(' to import your stations.'));

    emptyState.appendChild(emptyStateHeader);
    emptyState.appendChild(starterPacksGrid);
    emptyState.appendChild(importMessage);
    
    this.container.appendChild(emptyState);

    // Add event listener to the settings button
    settingsBtn.addEventListener('click', () => {
      eventManager.emit('settings:open');
    });

    // Load starter packs asynchronously
    this.loadStarterPacks(starterPacksGrid);
  }

  /**
   * Load and display starter packs
   */
  private async loadStarterPacks(starterPacksGrid: HTMLElement): Promise<void> {
    const specificPacks = [
      'austin.json',
      'jungle-dnb.json'
    ];

    try {
      const packs = await Promise.all(specificPacks.map(async (filename) => {
        try {
          const response = await fetch(`./starter-packs/${filename}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
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

      // Filter out failed loads
      const validPacks = packs.filter(pack => pack !== null);
      
      if (validPacks.length === 0) {
        starterPacksGrid.innerHTML = '<p class="no-stations">Error loading starter packs. Please try again later.</p>';
        return;
      }

      // Create starter pack cards
      const starterPackCards = validPacks.map(pack => this.createStarterPackCard(pack));
      
      // Clear loading indicator and add cards
      starterPacksGrid.innerHTML = '';
      starterPackCards.forEach(card => {
        starterPacksGrid.appendChild(card);
      });

    } catch (error) {
      console.error('Error loading starter packs:', error);
      starterPacksGrid.innerHTML = '<p class="no-stations">Error loading starter packs. Please try again later.</p>';
    }
  }

  /**
   * Create a starter pack card element
   */
  private createStarterPackCard(pack: any): HTMLElement {
    const card = createElement('div', {
      className: 'starter-pack-card',
      dataset: { pack: pack.filename.replace('.json', '') }
    });

    // Starter pack image
    const img = createElement('img', {
      src: pack.data.thumbnail_path || 'https://place-hold.it/250x250',
      alt: `${pack.data.username || 'Starter'} Pack`,
      className: 'starter-pack-image'
    });

    // Starter pack content
    const content = createElement('div', { className: 'starter-pack-card-content' }, [
      createElement('p', {}, [pack.data.description || 'A collection of radio stations']),
      createElement('button', {
        className: 'add-starter-pack-btn',
        dataset: { pack: pack.filename.replace('.json', '') }
      }, [
        createElement('span', { className: 'material-symbols-rounded' }, ['add'])
      ])
    ]);

    card.appendChild(img);
    card.appendChild(content);

    // Add event listener to the add button
    const addBtn = content.querySelector('.add-starter-pack-btn') as HTMLButtonElement;
    addBtn.addEventListener('click', () => this.addStarterPack(pack.filename.replace('.json', '')));

    return card;
  }

  /**
   * Add a starter pack to the user's collection
   */
  private async addStarterPack(packName: string): Promise<void> {
    try {
      const response = await fetch(`./starter-packs/${packName}.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.stations || !Array.isArray(data.stations)) {
        eventManager.emit('notification:show', {
          type: 'error',
          message: 'Invalid starter pack format.',
          duration: 3000
        });
        return;
      }

      // Convert RadioStation format to LocalStation format
      const localStations: LocalStation[] = data.stations.map((station: any) => ({
        ...station,
        id: this.generateStationId(),
        dateAdded: new Date().toISOString(),
        playCount: 0,
        isFavorite: false
      }));

      // Import all stations from the pack
      const importedCount = this.importStations(localStations, false);
      
      eventManager.emit('notification:show', {
        type: 'success',
        message: `Starter pack added successfully! ${importedCount} stations imported.`,
        duration: 3000
      });

      // Track achievement for adding starter pack
      eventManager.emit('achievement:unlock', 'first_starter_pack');

    } catch (error) {
      console.error('Error loading starter pack:', error);
      eventManager.emit('notification:show', {
        type: 'error',
        message: 'Failed to load starter pack.',
        duration: 3000
      });
    }
  }

  /**
   * Render a section of stations
   */
  private renderStationSection(title: string, stations: LocalStation[]): void {
    if (stations.length === 0) return;

    const section = createElement('div', { className: 'station-section' });
    const sectionId = title.toLowerCase().replace(/\s+/g, '-');
    section.setAttribute('data-section-id', sectionId);
    
    // Create header with minimize button
    const headerContainer = createElement('div', { className: 'station-section-header' });
    const header = createElement('h3', { className: 'section-title' }, [title]);
    
    const minimizeBtn = createElement('button', { 
      className: 'minimize-btn',
      title: 'Minimize section'
    });
    minimizeBtn.innerHTML = '<span class="material-symbols-rounded">expand_less</span>';
    
    // Check if section is collapsed from localStorage
    const sectionStates = getStorageItem(StorageKeys.SECTION_STATES, {});
    const isCollapsed = sectionStates[sectionId] === true;
    
    if (isCollapsed) {
      section.classList.add('collapsed');
      minimizeBtn.innerHTML = '<span class="material-symbols-rounded">expand_more</span>';
      minimizeBtn.title = 'Expand section';
    }
    
    // Add click handler for entire header container
    headerContainer.addEventListener('click', () => {
      this.toggleSectionCollapse(sectionId, section, minimizeBtn);
    });
    
    // Make header container clickable
    headerContainer.style.cursor = 'pointer';
    
    headerContainer.appendChild(header);
    headerContainer.appendChild(minimizeBtn);
    section.appendChild(headerContainer);

    const grid = createElement('div', { className: 'stations-grid' });
    
    stations.forEach(station => {
      const stationCard = this.createStationCard(station);
      grid.appendChild(stationCard);
    });

    section.appendChild(grid);
    this.container.appendChild(section);
  }

  /**
   * Toggle section collapse state
   */
  private toggleSectionCollapse(sectionId: string, section: HTMLElement, button: HTMLButtonElement): void {
    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expand section
      section.classList.remove('collapsed');
      button.innerHTML = '<span class="material-symbols-rounded">expand_less</span>';
      button.title = 'Minimize section';
    } else {
      // Collapse section
      section.classList.add('collapsed');
      button.innerHTML = '<span class="material-symbols-rounded">expand_more</span>';
      button.title = 'Expand section';
    }
    
    // Save state to localStorage
    const sectionStates = getStorageItem(StorageKeys.SECTION_STATES, {});
    sectionStates[sectionId] = !isCollapsed;
    setStorageItem(StorageKeys.SECTION_STATES, sectionStates);
  }

  /**
   * Create a station card element
   */
  private createStationCard(station: LocalStation): HTMLElement {
    const isCurrentlyPlaying = this.isStationCurrentlyPlaying(station);
    const card = createElement('div', {
      className: `station-card ${isCurrentlyPlaying ? 'playing' : ''}`,
      dataset: { stationId: station.id }
    });

    // Station info section
    const stationInfo = createElement('div', { className: 'station-info' });

    // Station favicon
    const faviconContainer = createElement('div', { className: 'station-favicon' });
    
    if (station.favicon) {
      const favicon = createElement('img', {
        src: station.favicon,
        alt: 'Station logo'
      });
      
      favicon.addEventListener('error', () => {
        faviconContainer.innerHTML = getStationPlaceholderIcon({ size: 24 });
      });
      
      faviconContainer.appendChild(favicon);
    } else {
      faviconContainer.innerHTML = getStationPlaceholderIcon({ size: 24 });
    }

    stationInfo.appendChild(faviconContainer);

    // Station details
    const stationDetails = createElement('div', { className: 'station-details' });
    
    const stationNameContainer = createElement('div', { className: 'station-name-container' });
    const stationName = createElement('h3', {}, [station.customName || station.name]);
    stationNameContainer.appendChild(stationName);
    
    // Add animated equalizer for currently playing station
    if (isCurrentlyPlaying && this.isCurrentlyPlaying) {
      const equalizerIcon = createElement('div', { 
        className: 'now-playing-icon',
        title: 'Now playing'
      });
      equalizerIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 14V15H1V14H3Z M3 13V14H1V13H3Z M3 12V13H1V12H3Z M3 11V12H1V11H3Z M3 10V11H1V10H3Z M3 9V10H1V9H3Z M3 8V9H1V8H3Z M3 7V8H1V7H3Z M3 6V7H1V6H3Z M3 5V6H1V5H3Z M3 4V5H1V4H3Z M3 3V4H1V3H3Z M3 2V3H1V2H3Z" fill="#00FFA2"/>
          <path d="M6 14V15H4V14H6Z M6 13V14H4V13H6Z M6 12V13H4V12H6Z M6 11V12H4V11H6Z M6 10V11H4V10H6Z M6 9V10H4V9H6Z M6 8V9H4V8H6Z M6 7V8H4V7H6Z M6 6V7H4V6H6Z M6 5V6H4V5H6Z M6 4V5H4V4H6Z M6 3V4H4V3H6Z M6 2V3H4V2H6Z" fill="#00FFA2"/>
          <path d="M9 14V15H7V14H9Z M9 13V14H7V13H9Z M9 12V13H7V12H9Z M9 11V12H7V11H9Z M9 10V11H7V10H9Z M9 9V10H7V9H9Z M9 8V9H7V8H9Z M9 7V8H7V7H9Z M9 6V7H7V6H9Z M9 5V6H7V5H9Z M9 4V5H7V4H9Z M9 3V4H7V3H9Z M9 2V3H7V2H9Z" fill="#00FFA2"/>
          <path d="M12 14V15H10V14H12Z M12 13V14H10V13H12Z M12 12V13H10V12H12Z M12 11V12H10V11H12Z M12 10V11H10V10H12Z M12 9V10H10V9H12Z M12 8V9H10V8H12Z M12 7V8H10V7H12Z M12 6V7H10V6H12Z M12 5V6H10V5H12Z M12 4V5H10V4H12Z M12 3V4H10V3H12Z M12 2V3H10V2H12Z" fill="#00FFA2"/>
          <path d="M15 14V15H13V14H15Z M15 13V14H13V13H15Z M15 12V13H13V12H15Z M15 11V12H13V11H15Z M15 10V11H13V10H15Z M15 9V10H13V9H15Z M15 8V9H13V8H15Z M15 7V8H13V7H15Z M15 6V7H13V6H15Z M15 5V6H13V5H15Z M15 4V5H13V4H15Z M15 3V4H13V3H15Z M15 2V3H13V2H15Z" fill="#00FFA2"/>
          <path d="M3 1V2H1V1H3Z" fill="#9E66F2"/>
          <path d="M6 1V2H4V1H6Z" fill="#9E66F2"/>
          <path d="M9 1V2H7V1H9Z" fill="#9E66F2"/>
          <path d="M12 1V2H10V1H12Z" fill="#9E66F2"/>
          <path d="M15 1V2H13V1H15Z" fill="#9E66F2"/>
        </svg>
      `;
      stationNameContainer.appendChild(equalizerIcon);
    }
    
    // Add pin indicator for pinned stations
    if (station.isFavorite) {
      const pinIndicator = createElement('span', { 
        className: 'pin-indicator',
        title: 'Pinned to top'
      });
      pinIndicator.innerHTML = '<span class="material-symbols-rounded">push_pin</span>';
      stationNameContainer.appendChild(pinIndicator);
    }
    
    stationDetails.appendChild(stationNameContainer);

    // Station metadata
    const stationMeta = createElement('div', { className: 'station-meta' });
    
    if (station.bitrate && station.bitrate > 0) {
      const bitrateSpan = createElement('span', {});
      bitrateSpan.innerHTML = `${getBitrateIcon()} ${station.bitrate}kbps`;
      stationMeta.appendChild(bitrateSpan);
    }

    if (station.countrycode || station.country) {
      const countrySpan = createElement('span', {});
      countrySpan.innerHTML = `${getCountryIcon()} ${station.countrycode || station.country}`;
      stationMeta.appendChild(countrySpan);
    }

    if (station.votes && station.votes > 0) {
      const votesSpan = createElement('span', {});
      votesSpan.innerHTML = `${getVotesIcon()} ${station.votes}`;
      stationMeta.appendChild(votesSpan);
    }

    stationDetails.appendChild(stationMeta);

    // Add note if present (after metadata)
    if (station.note) {
      const noteDiv = createElement('div', { className: 'station-note' }, [station.note]);
      stationDetails.appendChild(noteDiv);
    }
    stationInfo.appendChild(stationDetails);
    card.appendChild(stationInfo);

    // Station controls
    const stationControls = createElement('div', { className: 'station-controls' });
    
    const playBtn = createElement('button', {
      className: 'play-btn',
      title: 'Play/pause station'
    });
    
    const playIcon = createElement('span', { className: 'material-symbols-rounded' }, ['play_arrow']);
    playBtn.appendChild(playIcon);
    
    // Update play button icon based on current state
    this.updatePlayButtonIcon(playBtn, station);
    
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click from also firing
      eventManager.emit('station:toggle-play', station);
    });

    // Add hover effect for playing stations
    card.addEventListener('mouseenter', () => {
      if (this.isStationCurrentlyPlaying(station) && this.isCurrentlyPlaying) {
        playIcon.textContent = 'pause';
      }
    });

    card.addEventListener('mouseleave', () => {
      this.updatePlayButtonIcon(playBtn, station);
    });

    const moreBtn = createElement('button', {
      className: 'more-btn',
      title: 'More actions'
    });
    moreBtn.innerHTML = '<span class="material-symbols-rounded">more_vert</span>';

    stationControls.appendChild(playBtn);
    stationControls.appendChild(moreBtn);
    card.appendChild(stationControls);

    // Create menu overlay and dropdown
    const menuOverlay = createElement('div', { className: 'station-menu-overlay hidden' });
    const menu = createElement('div', { className: 'station-menu hidden' });

    // Station menu info section
    const menuInfo = createElement('div', { className: 'station-menu-info' });
    
    // Menu favicon
    const menuFavicon = createElement('div', { 
      className: 'station-menu-favicon',
      style: station.favicon ? 'display: flex;' : 'display: none;'
    });
    if (station.favicon) {
      const faviconImg = createElement('img', {
        src: station.favicon,
        alt: `${station.name} logo`
      });
      menuFavicon.appendChild(faviconImg);
    }
    menuInfo.appendChild(menuFavicon);

    // Menu station name
    const menuName = createElement('div', { className: 'station-menu-name' }, [station.name]);
    menuInfo.appendChild(menuName);

    // Menu station data
    const menuData = createElement('div', { className: 'station-menu-data' });
    
    if (station.bitrate && station.bitrate > 0) {
      const bitrateItem = createElement('div', { className: 'station-menu-data-item' });
      bitrateItem.innerHTML = `<span class="material-symbols-rounded">radio</span>${station.bitrate}kbps`;
      menuData.appendChild(bitrateItem);
    }
    
    if (station.countrycode || station.country) {
      const countryItem = createElement('div', { className: 'station-menu-data-item' });
      countryItem.innerHTML = `<span class="material-symbols-rounded">public</span>${station.countrycode || station.country}`;
      menuData.appendChild(countryItem);
    }
    
    if (station.votes && station.votes > 0) {
      const votesItem = createElement('div', { className: 'station-menu-data-item' });
      votesItem.innerHTML = `<span class="material-symbols-rounded">local_fire_department</span>${station.votes}`;
      menuData.appendChild(votesItem);
    }

    menuInfo.appendChild(menuData);
    menu.appendChild(menuInfo);

    // Menu actions
    const shareBtn = createElement('button', { className: 'menu-share' });
    shareBtn.innerHTML = '<span class="material-symbols-rounded">share</span> Share';
    shareBtn.addEventListener('click', (e) => this.handleMenuAction(e, menu, menuOverlay, 'share', station));

    const pinBtn = createElement('button', { className: 'menu-pin' });
    const isPinned = station.isFavorite; // Using existing isFavorite field for pinning
    pinBtn.innerHTML = isPinned 
      ? '<span class="material-symbols-rounded">push_pin</span> Unpin from top'
      : '<span class="material-symbols-rounded">push_pin</span> Pin to top';
    pinBtn.addEventListener('click', (e) => this.handleMenuAction(e, menu, menuOverlay, 'pin', station));

    const editNoteBtn = createElement('button', { className: 'menu-edit-note' });
    editNoteBtn.innerHTML = '<span class="material-symbols-rounded">edit</span> Edit Note';
    editNoteBtn.addEventListener('click', (e) => this.handleMenuAction(e, menu, menuOverlay, 'edit-note', station, card));

    const homepageBtn = createElement('button', { className: 'menu-homepage' });
    homepageBtn.innerHTML = '<span class="material-symbols-rounded">open_in_new</span> Visit Website';
    homepageBtn.addEventListener('click', (e) => this.handleMenuAction(e, menu, menuOverlay, 'homepage', station));

    const deleteBtn = createElement('button', { className: 'menu-delete' });
    deleteBtn.innerHTML = '<span class="material-symbols-rounded">delete</span> Delete';
    deleteBtn.addEventListener('click', (e) => this.handleMenuAction(e, menu, menuOverlay, 'delete', station));

    menu.appendChild(shareBtn);
    menu.appendChild(pinBtn);
    menu.appendChild(editNoteBtn);
    menu.appendChild(homepageBtn);
    menu.appendChild(deleteBtn);

    card.appendChild(menuOverlay);
    card.appendChild(menu);

    // Menu button event handlers
    const handleMoreBtn = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.remove('hidden');
      menuOverlay.classList.remove('hidden');
      if (window.innerWidth <= 768) {
        menu.classList.add('active');
      }
    };

    moreBtn.addEventListener('click', handleMoreBtn);
    moreBtn.addEventListener('touchstart', handleMoreBtn);

    // Close menu handlers
    const closeMenu = () => {
      menu.classList.add('hidden');
      menuOverlay.classList.add('hidden');
      if (window.innerWidth <= 768) {
        menu.classList.remove('active');
      }
    };

    menuOverlay.addEventListener('click', closeMenu);

    // Close when clicking outside card
    document.addEventListener('click', (e) => {
      if (!card.contains(e.target as Node)) {
        closeMenu();
      }
    });

    // Make entire card clickable to play/pause station (except for buttons, menu, and input elements)
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons, menu elements, or input fields
      const target = e.target as HTMLElement;
      if (target.closest('button') || 
          target.closest('.station-menu') || 
          target.closest('.station-menu-overlay') ||
          target.closest('input') ||
          target.closest('.note-input') ||
          target.closest('.note-actions')) {
        return;
      }
      
      // Check if this station is currently playing and toggle accordingly
      eventManager.emit('station:toggle-play', station);
    });

    return card;
  }

  /**
   * Handle menu actions
   */
  private handleMenuAction(
    e: Event, 
    menu: HTMLElement, 
    overlay: HTMLElement, 
    action: string, 
    station: LocalStation, 
    card?: HTMLElement
  ): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Close menu
    menu.classList.add('hidden');
    overlay.classList.add('hidden');
    if (window.innerWidth <= 768) {
      menu.classList.remove('active');
    }

    switch (action) {
      case 'share':
        this.shareStation(station);
        break;
      case 'pin':
        this.togglePin(station.id);
        break;
      case 'edit-note':
        if (card) this.showEditNoteUI(card, station);
        break;
      case 'homepage':
        this.visitStationWebsite(station);
        break;
      case 'delete':
        this.confirmAndRemoveStation(station);
        break;
    }
  }

  /**
   * Share station functionality
   */
  private async shareStation(station: LocalStation): Promise<void> {
    try {
      const username = this.getCurrentUsername();
      
      // Generate shortened share URL
      const shareUrl = await sharingService.shareStation(username, station);

      // Always use clipboard instead of system share sheet
      const originalUrl = sharingService.createShareUrl(sharingService.createShareData(username, [station]));
      this.copyToClipboard(shareUrl, shareUrl !== originalUrl);
    } catch (error) {
      console.error('Share station error:', error);
      eventManager.emit('notification:show', {
        type: 'error',
        message: 'Failed to share station',
        duration: 3000
      });
    }
  }

  /**
   * Copy URL to clipboard with appropriate messaging
   */
  private async copyToClipboard(url: string, wasShortened: boolean): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      const message = wasShortened 
        ? 'Short sharing link copied to clipboard!'
        : 'Sharing link copied to clipboard!';
      eventManager.emit('notification:show', {
        type: 'success',
        message,
        duration: 3000
      });
    } catch (error) {
      console.error('Clipboard error:', error);
      eventManager.emit('notification:show', {
        type: 'error',
        message: 'Failed to copy link to clipboard',
        duration: 3000
      });
    }
  }

  /**
   * Get current username from storage (UserManager stores it there)
   */
  private getCurrentUsername(): string {
    return getStorageItem(StorageKeys.USERNAME, 'User');
  }

  /**
   * Show edit note UI
   */
  private showEditNoteUI(card: HTMLElement, station: LocalStation): void {
    let noteDiv = card.querySelector('.station-note') as HTMLElement;
    if (!noteDiv) {
      noteDiv = createElement('div', { className: 'station-note' });
      const stationDetails = card.querySelector('.station-details');
      if (stationDetails) {
        // Insert note after metadata (station-meta is the last child of metadata)
        stationDetails.appendChild(noteDiv);
      }
    }

    noteDiv.innerHTML = `
      <input maxlength="100" placeholder="Add a note..." class="note-input" type="text" value="${station.note || ''}">
      <div class="note-actions">
        <button class="cancel-note-btn">Cancel</button>
        <button class="save-note-btn">Save</button>
      </div>
    `;

    const input = noteDiv.querySelector('.note-input') as HTMLInputElement;
    const cancelBtn = noteDiv.querySelector('.cancel-note-btn') as HTMLButtonElement;
    const saveBtn = noteDiv.querySelector('.save-note-btn') as HTMLButtonElement;

    input.focus();

    const saveNote = () => {
      const newNote = input.value.trim();
      if (newNote !== station.note) {
        station.note = newNote || undefined;
        this.saveStations();
        eventManager.emit('station:updated', station);
      }
      
      if (newNote) {
        noteDiv.innerHTML = newNote;
        noteDiv.className = 'station-note';
      } else {
        noteDiv.remove();
      }
    };

    const cancelEdit = () => {
      if (station.note) {
        noteDiv.innerHTML = station.note;
        noteDiv.className = 'station-note';
      } else {
        noteDiv.remove();
      }
    };

    // Event listeners
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveNote();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    });

    saveBtn.addEventListener('click', saveNote);
    cancelBtn.addEventListener('click', cancelEdit);
  }

  /**
   * Visit station website
   */
  private visitStationWebsite(station: LocalStation): void {
    if (station.homepage) {
      window.open(station.homepage, '_blank', 'noopener,noreferrer');
    } else {
      eventManager.emit('notification:show', {
        type: 'warning',
        message: 'No website available for this station',
        duration: 3000
      });
    }
  }

  /**
   * Confirm and remove station
   */
  private confirmAndRemoveStation(station: LocalStation): void {
    eventManager.emit('modal:open', {
      type: 'confirm',
      title: 'Delete Station',
      content: `Are you sure you want to remove "${station.name}" from your collection?`,
      actions: [
        {
          label: 'Cancel',
          action: () => eventManager.emit('modal:close'),
          style: 'secondary'
        },
        {
          label: 'Delete',
          action: () => {
            this.removeStation(station.id);
            eventManager.emit('modal:close');
          },
          style: 'danger'
        }
      ],
      size: 'small',
      closable: true
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalStations: number;
    favoriteStations: number;
    countriesRepresented: number;
    totalPlayTime: number;
  } {
    const countries = new Set(this.stations.map(s => s.country).filter(Boolean));
    const totalPlayTime = this.stations.reduce((sum, s) => sum + (s.playCount || 0), 0);

    return {
      totalStations: this.stations.length,
      pinnedStations: this.getPinnedStations().length,
      countriesRepresented: countries.size,
      totalPlayTime
    };
  }

  /**
   * Check if a station is currently playing
   */
  private isStationCurrentlyPlaying(station: LocalStation): boolean {
    if (!this.currentPlayingStation) return false;
    
    return this.currentPlayingStation.stationuuid === station.stationuuid ||
           (this.currentPlayingStation.url === station.url && this.currentPlayingStation.name === station.name);
  }

  /**
   * Update play button icon based on station state
   */
  private updatePlayButtonIcon(playBtn: HTMLElement, station: LocalStation): void {
    const icon = playBtn.querySelector('.material-symbols-rounded');
    if (!icon) return;

    const isCurrentlyPlaying = this.isStationCurrentlyPlaying(station);
    
    if (isCurrentlyPlaying && this.isCurrentlyPlaying) {
      icon.textContent = 'pause';
    } else {
      icon.textContent = 'play_arrow';
    }
  }

  /**
   * Update UI for currently playing station
   */
  private updatePlayingStationUI(): void {
    // Update all station cards
    const allCards = this.container.querySelectorAll('.station-card');
    allCards.forEach((cardElement) => {
      const card = cardElement as HTMLElement;
      const stationId = card.dataset.stationId;
      const station = this.stations.find(s => s.id === stationId);
      
      if (station) {
        const isCurrentlyPlaying = this.isStationCurrentlyPlaying(station);
        const stationNameContainer = card.querySelector('.station-name-container');
        
        // Update card class
        if (isCurrentlyPlaying && this.isCurrentlyPlaying) {
          card.classList.add('playing');
          
          // Add equalizer icon if not present
          if (stationNameContainer && !stationNameContainer.querySelector('.now-playing-icon')) {
            const equalizerIcon = createElement('div', { 
              className: 'now-playing-icon',
              title: 'Now playing'
            });
            equalizerIcon.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 14V15H1V14H3Z M3 13V14H1V13H3Z M3 12V13H1V12H3Z M3 11V12H1V11H3Z M3 10V11H1V10H3Z M3 9V10H1V9H3Z M3 8V9H1V8H3Z M3 7V8H1V7H3Z M3 6V7H1V6H3Z M3 5V6H1V5H3Z M3 4V5H1V4H3Z M3 3V4H1V3H3Z M3 2V3H1V2H3Z" fill="#00FFA2"/>
                <path d="M6 14V15H4V14H6Z M6 13V14H4V13H6Z M6 12V13H4V12H6Z M6 11V12H4V11H6Z M6 10V11H4V10H6Z M6 9V10H4V9H6Z M6 8V9H4V8H6Z M6 7V8H4V7H6Z M6 6V7H4V6H6Z M6 5V6H4V5H6Z M6 4V5H4V4H6Z M6 3V4H4V3H6Z M6 2V3H4V2H6Z" fill="#00FFA2"/>
                <path d="M9 14V15H7V14H9Z M9 13V14H7V13H9Z M9 12V13H7V12H9Z M9 11V12H7V11H9Z M9 10V11H7V10H9Z M9 9V10H7V9H9Z M9 8V9H7V8H9Z M9 7V8H7V7H9Z M9 6V7H7V6H9Z M9 5V6H7V5H9Z M9 4V5H7V4H9Z M9 3V4H7V3H9Z M9 2V3H7V2H9Z" fill="#00FFA2"/>
                <path d="M12 14V15H10V14H12Z M12 13V14H10V13H12Z M12 12V13H10V12H12Z M12 11V12H10V11H12Z M12 10V11H10V10H12Z M12 9V10H10V9H12Z M12 8V9H10V8H12Z M12 7V8H10V7H12Z M12 6V7H10V6H12Z M12 5V6H10V5H12Z M12 4V5H10V4H12Z M12 3V4H10V3H12Z M12 2V3H10V2H12Z" fill="#00FFA2"/>
                <path d="M15 14V15H13V14H15Z M15 13V14H13V13H15Z M15 12V13H13V12H15Z M15 11V12H13V11H15Z M15 10V11H13V10H15Z M15 9V10H13V9H15Z M15 8V9H13V8H15Z M15 7V8H13V7H15Z M15 6V7H13V6H15Z M15 5V6H13V5H15Z M15 4V5H13V4H15Z M15 3V4H13V3H15Z M15 2V3H13V2H15Z" fill="#00FFA2"/>
                <path d="M3 1V2H1V1H3Z" fill="#9E66F2"/>
                <path d="M6 1V2H4V1H6Z" fill="#9E66F2"/>
                <path d="M9 1V2H7V1H9Z" fill="#9E66F2"/>
                <path d="M12 1V2H10V1H12Z" fill="#9E66F2"/>
                <path d="M15 1V2H13V1H15Z" fill="#9E66F2"/>
              </svg>
            `;
            // Insert before pin indicator if it exists
            const pinIndicator = stationNameContainer.querySelector('.pin-indicator');
            if (pinIndicator) {
              stationNameContainer.insertBefore(equalizerIcon, pinIndicator);
            } else {
              stationNameContainer.appendChild(equalizerIcon);
            }
          }
        } else {
          card.classList.remove('playing');
          
          // Remove equalizer icon if present
          const existingIcon = stationNameContainer?.querySelector('.now-playing-icon');
          if (existingIcon) {
            existingIcon.remove();
          }
        }
        
        // Update play button icon
        const playBtn = card.querySelector('.play-btn');
        if (playBtn) {
          this.updatePlayButtonIcon(playBtn as HTMLElement, station);
        }
      }
    });
  }

  /**
   * Get all stations (alias for getAllStations for consistency)
   */
  getStations(): LocalStation[] {
    return this.getAllStations();
  }

  /**
   * Share multiple stations as a collection
   */
  async shareStations(stations: LocalStation[], listName?: string, username?: string): Promise<any> {
    const effectiveUsername = username || this.getUsernameFromManager() || 'Anonymous';
    const defaultName = effectiveUsername ? `${effectiveUsername}'s Stations` : 'My Stations';
    return await sharingService.shareStations(effectiveUsername, stations, listName || defaultName);
  }

  /**
   * Clear shared station lists
   */
  clearSharedStations(): void {
    this.sharedStations = [];
    if (this.autoSave) {
      setStorageItem(StorageKeys.SHARED_STATIONS, this.sharedStations);
    }
    eventManager.emit('shared-stations:cleared');
  }

  /**
   * Get username from user manager for sharing
   */
  private getUsernameFromManager(): string {
    // Try to get username from local storage or default
    return getStorageItem(StorageKeys.USERNAME, '');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    eventManager.removeAllListeners('station:remove');
    eventManager.removeAllListeners('station:update');
    eventManager.removeAllListeners('stations:clear');
    eventManager.removeAllListeners('stations:import');
    eventManager.removeAllListeners('stations:display');
    eventManager.removeAllListeners('station:selected');
    eventManager.removeAllListeners('station:play');
    eventManager.removeAllListeners('station:pause');
    eventManager.removeAllListeners('station:stop');
  }
}