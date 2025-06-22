/**
 * Search functionality module for discovering radio stations
 */

import { RadioStation, SearchParams, LocalStation } from '@/types/station';
import { radioBrowserApi, expandSearchTerms, GENRE_MAPPING } from '@/services/api/radioBrowserApi';
import { eventManager } from '@/utils/events';
import { querySelector, querySelectorSafe, createElement, debounce } from '@/utils/dom';
import { getStorageItem, StorageKeys } from '@/utils/storage';

export interface SearchManagerConfig {
  container?: HTMLElement;
  searchInput?: HTMLInputElement;
  resultsContainer?: HTMLElement;
  resultsPerPage?: number;
  autoSearch?: boolean;
  debounceDelay?: number;
}

interface SearchState {
  query: string;
  results: RadioStation[];
  currentPage: number;
  totalResults: number;
  isSearching: boolean;
  lastSearchTime: number;
  sortBy: 'default' | 'name' | 'votes' | 'bitrate' | 'country';
  sortOrder: 'asc' | 'desc';
  filters: SearchFilters;
}

interface SearchFilters {
  country?: string;
  language?: string;
  minBitrate?: number;
  codec?: string;
  hasHomepage?: boolean;
}

/**
 * Manages station search functionality and UI
 */
export class SearchManager {
  private container: HTMLElement;
  private searchInput: HTMLInputElement;
  private resultsContainer: HTMLElement;
  private state: SearchState;
  private resultsPerPage: number;
  private debouncedSearch: (query: string) => void;
  private previewAudio: HTMLAudioElement | null = null;
  private currentPreviewStation: RadioStation | null = null;

  constructor(config: SearchManagerConfig = {}) {
    this.container = config.container || querySelectorSafe('#search-results');
    this.searchInput = config.searchInput || querySelectorSafe('#search-input');
    this.resultsContainer = config.resultsContainer || querySelectorSafe('.results-grid');
    this.resultsPerPage = config.resultsPerPage || 20;

    if (!this.container) {
      console.error('SearchManager: container element not found');
      return;
    }
    if (!this.resultsContainer) {
      console.error('SearchManager: results container element not found');
      return;
    }

    this.state = {
      query: '',
      results: [],
      currentPage: 0,
      totalResults: 0,
      isSearching: false,
      lastSearchTime: 0,
      sortBy: 'default',
      sortOrder: 'desc',
      filters: {}
    };

    this.debouncedSearch = debounce(
      this.performSearch.bind(this),
      config.debounceDelay || 300
    );

    this.setupUI();
    this.setupEventListeners();
  }

  /**
   * Set up the search UI
   */
  private setupUI(): void {
    this.setupSearchInput();
    this.setupSortControls();
    this.createPreviewAudio();
  }

  /**
   * Set up search input with autocomplete
   */
  private setupSearchInput(): void {
    if (!this.searchInput) return;

    this.searchInput.addEventListener('input', (event) => {
      const query = (event.target as HTMLInputElement).value.trim();
      this.state.query = query;
      
      if (query.length >= 2) {
        this.debouncedSearch(query);
      } else if (query.length === 0) {
        this.clearResults();
      }
    });

    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.performSearch(this.state.query);
      } else if (event.key === 'Escape') {
        this.clearSearch();
      }
    });
  }

  /**
   * Set up sort controls
   */
  private setupSortControls(): void {
    const sortSelect = querySelectorSafe('#sort-results', this.container);
    if (!sortSelect) {
      console.warn('SearchManager: sort select element not found');
      return;
    }

    sortSelect.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      this.updateSort(value as SearchState['sortBy']);
    });
  }

  /**
   * Create preview audio element
   */
  private createPreviewAudio(): void {
    this.previewAudio = new Audio();
    this.previewAudio.volume = 0.3;
    this.previewAudio.preload = 'none';

    this.previewAudio.addEventListener('ended', () => {
      this.stopPreview();
    });

    this.previewAudio.addEventListener('error', () => {
      console.warn('Preview failed for station:', this.currentPreviewStation?.name);
      this.stopPreview();
    });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('search:perform', (params: SearchParams) => {
      this.searchWithParams(params);
    });

    eventManager.on('search:clear', () => {
      this.clearSearch();
    });

    eventManager.on('search:load-more', () => {
      this.loadMore();
    });

    // Listen for station add/remove events to update button states
    eventManager.on('station:added', (station: LocalStation) => {
      this.updateStationButtonState(station, true);
    });

    eventManager.on('station:removed', (station: LocalStation) => {
      this.updateStationButtonState(station, false);
    });
  }


  /**
   * Update sort settings
   */
  private updateSort(sortBy: SearchState['sortBy']): void {
    this.state.sortBy = sortBy;
    this.sortResults();
    this.renderResults();
  }

  /**
   * Perform search with current query
   */
  private async performSearch(query: string): Promise<void> {
    if (!query || query.length < 2) return;

    this.state.isSearching = true;
    this.state.currentPage = 0;
    this.state.lastSearchTime = Date.now();

    eventManager.emit('search:started', { query });
    this.showLoadingState();

    try {
      const searchParams: SearchParams = {
        name: query,
        limit: this.resultsPerPage,
        offset: 0
      };

      // Expand search terms for better results
      const expandedTerms = expandSearchTerms(query);
      if (expandedTerms.length > 1) {
        // Search for the most relevant expanded term
        searchParams.tag = expandedTerms[1];
      }

      const response = await radioBrowserApi.searchStations(searchParams);

      if (response.success && response.data) {
        this.state.results = response.data;
        this.state.totalResults = response.data.length;
        this.sortResults();
        this.renderResults();
        
        eventManager.emit('search:completed', {
          query,
          results: this.state.results,
          totalResults: this.state.totalResults
        });
      } else {
        this.showErrorState(response.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showErrorState('Search failed. Please try again.');
    } finally {
      this.state.isSearching = false;
    }
  }

  /**
   * Search with specific parameters
   */
  async searchWithParams(params: SearchParams): Promise<void> {
    this.state.isSearching = true;
    this.state.currentPage = 0;

    try {
      const response = await radioBrowserApi.searchStations(params);
      
      if (response.success && response.data) {
        this.state.results = response.data;
        this.state.totalResults = response.data.length;
        this.renderResults();
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showErrorState('Search failed');
    } finally {
      this.state.isSearching = false;
    }
  }

  /**
   * Load more results (pagination)
   */
  private async loadMore(): Promise<void> {
    if (this.state.isSearching || !this.state.query) return;

    this.state.currentPage++;
    this.state.isSearching = true;

    try {
      const searchParams: SearchParams = {
        name: this.state.query,
        limit: this.resultsPerPage,
        offset: this.state.currentPage * this.resultsPerPage
      };

      const response = await radioBrowserApi.searchStations(searchParams);

      if (response.success && response.data) {
        this.state.results.push(...response.data);
        this.renderResults(true); // Append mode
      }
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      this.state.isSearching = false;
    }
  }

  /**
   * Sort search results
   */
  private sortResults(): void {
    if (this.state.sortBy === 'default') return;

    this.state.results.sort((a, b) => {
      let comparison = 0;

      switch (this.state.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'votes':
          comparison = (b.votes || 0) - (a.votes || 0);
          break;
        case 'bitrate':
          comparison = (b.bitrate || 0) - (a.bitrate || 0);
          break;
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '');
          break;
      }

      return this.state.sortOrder === 'desc' ? comparison : -comparison;
    });
  }

  /**
   * Render search results
   */
  private renderResults(append = false): void {
    if (!append) {
      this.resultsContainer.innerHTML = '';
    } else {
      // Remove existing load more button when appending new results
      const existingButton = querySelectorSafe('.load-more-button', this.resultsContainer);
      if (existingButton) {
        existingButton.remove();
      }
    }

    if (this.state.results.length === 0) {
      this.showEmptyState();
      return;
    }

    // Only append new results when in append mode
    const stationsToRender = append ? 
      this.state.results.slice((this.state.currentPage) * this.resultsPerPage) : 
      this.state.results;

    stationsToRender.forEach(station => {
      const stationCard = this.createSearchResultCard(station);
      this.resultsContainer.appendChild(stationCard);
    });

    // Show load more button if there might be more results
    if (this.state.results.length >= this.resultsPerPage) {
      this.showLoadMoreButton();
    }

    this.container.classList.remove('hidden');
  }

  /**
   * Create a search result card
   */
  private createSearchResultCard(station: RadioStation): HTMLElement {
    const card = createElement('div', {
      className: 'search-result-card',
      dataset: { stationUuid: station.stationuuid }
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
        faviconContainer.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
            <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" stroke="currentColor" stroke-width="2"/>
          </svg>
        `;
      });
      
      faviconContainer.appendChild(favicon);
    } else {
      faviconContainer.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;
    }

    stationInfo.appendChild(faviconContainer);

    // Station details
    const stationDetails = createElement('div', { className: 'station-details' });
    
    const stationName = createElement('h3', {}, [station.name]);
    stationDetails.appendChild(stationName);

    // Station metadata
    const stationMeta = createElement('div', { className: 'station-meta' });
    
    if (station.bitrate && station.bitrate > 0) {
      const bitrateSpan = createElement('span', {});
      bitrateSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="1" y="5" width="1" height="1" fill="#FFC933"/>
          <rect y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="1" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="2" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="3" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="3" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="5" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="5" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="6" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="6" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="7" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="7" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="9" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="9" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="11" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="11" y="4" width="1" height="1" fill="#FFC933"/>
          <rect y="7" width="1" height="1" fill="#FFC933"/>
          <rect y="8" width="1" height="1" fill="#FFC933"/>
          <rect y="9" width="1" height="1" fill="#FFC933"/>
          <rect y="10" width="1" height="1" fill="#FFC933"/>
          <rect y="11" width="1" height="1" fill="#FFC933"/>
          <rect y="12" width="1" height="1" fill="#FFC933"/>
          <rect y="13" width="1" height="1" fill="#FFC933"/>
          <rect y="14" width="1" height="1" fill="#FFC933"/>
          <rect x="1" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="2" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="2" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="2" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="3" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="6" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="5" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="9" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="5" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="4" y="9" width="1" height="1" fill="#FFC933"/>
          <rect x="3" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="3" y="9" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="5" y="9" width="1" height="1" fill="#FFC933"/>
          <rect x="3" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="9" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="7" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="2" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="2" y="9" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="7" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="5" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="6" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="7" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="9" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="11" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="15" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="14" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="13" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="11" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="9" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="7" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="11" y="3" width="1" height="1" fill="#FFC933"/>
          <rect x="9" y="2" width="1" height="1" fill="#FFC933"/>
          <rect x="7" y="1" width="1" height="1" fill="#FFC933"/>
          <rect x="5" width="1" height="1" fill="#FFC933"/>
          <rect x="13" y="14" width="1" height="1" fill="#FFC933"/>
          <rect x="13" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="13" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="12" y="3" width="1" height="1" fill="#FFC933"/>
          <rect x="10" y="2" width="1" height="1" fill="#FFC933"/>
          <rect x="8" y="1" width="1" height="1" fill="#FFC933"/>
          <rect x="6" width="1" height="1" fill="#FFC933"/>
          <rect x="14" y="4" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="12" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="6" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="5" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="7" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="8" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="9" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="10" width="1" height="1" fill="#FFC933"/>
          <rect x="15" y="11" width="1" height="1" fill="#FFC933"/>
          <rect x="14" y="13" width="1" height="1" fill="#FFC933"/>
          <rect x="14" y="5" width="1" height="1" fill="#FFC933"/>
        </svg>
        ${station.bitrate}kbps
      `;
      stationMeta.appendChild(bitrateSpan);
    }

    if (station.countrycode) {
      const countrySpan = createElement('span', {});
      countrySpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="15" width="1" height="1" fill="#477EFF"/>
          <rect x="9" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="6" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="7" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="11" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="11" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="12" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="12" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="10" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="7" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="6" width="1" height="1" fill="#477EFF"/>
          <rect x="2" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="2" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="2" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="11" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="13" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="9" y="15" width="1" height="1" fill="#477EFF"/>
          <rect x="8" width="1" height="1" fill="#477EFF"/>
          <rect x="8" y="15" width="1" height="1" fill="#477EFF"/>
          <rect x="7" width="1" height="1" fill="#477EFF"/>
          <rect x="7" y="15" width="1" height="1" fill="#477EFF"/>
          <rect x="6" width="1" height="1" fill="#477EFF"/>
          <rect x="6" y="15" width="1" height="1" fill="#477EFF"/>
          <rect x="5" width="1" height="1" fill="#477EFF"/>
          <rect x="5" y="15" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="11" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="4" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="11" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="12" y="1" width="1" height="1" fill="#477EFF"/>
          <rect x="13" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="3" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="2" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="12" y="14" width="1" height="1" fill="#477EFF"/>
          <rect x="1" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="2" y="2" width="1" height="1" fill="#477EFF"/>
          <rect x="14" y="3" width="1" height="1" fill="#477EFF"/>
          <rect x="1" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="14" y="12" width="1" height="1" fill="#477EFF"/>
          <rect x="13" y="13" width="1" height="1" fill="#477EFF"/>
          <rect x="1" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="14" y="4" width="1" height="1" fill="#477EFF"/>
          <rect x="1" y="11" width="1" height="1" fill="#477EFF"/>
          <rect x="14" y="11" width="1" height="1" fill="#477EFF"/>
          <rect y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="1" y="5" width="1" height="1" fill="#477EFF"/>
          <rect x="15" y="5" width="1" height="1" fill="#477EFF"/>
          <rect y="6" width="1" height="1" fill="#477EFF"/>
          <rect x="15" y="6" width="1" height="1" fill="#477EFF"/>
          <rect y="7" width="1" height="1" fill="#477EFF"/>
          <rect x="15" y="7" width="1" height="1" fill="#477EFF"/>
          <rect y="8" width="1" height="1" fill="#477EFF"/>
          <rect x="15" y="8" width="1" height="1" fill="#477EFF"/>
          <rect y="9" width="1" height="1" fill="#477EFF"/>
          <rect x="15" y="9" width="1" height="1" fill="#477EFF"/>
          <rect y="10" width="1" height="1" fill="#477EFF"/>
          <rect x="15" y="10" width="1" height="1" fill="#477EFF"/>
        </svg>
        ${station.countrycode}
      `;
      stationMeta.appendChild(countrySpan);
    }

    if (station.votes && station.votes > 0) {
      const votesSpan = createElement('span', {});
      votesSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="1" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="1" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="2" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect y="8" width="1" height="1" fill="#FF5E00"/>
          <rect y="7" width="1" height="1" fill="#FF5E00"/>
          <rect y="9" width="1" height="1" fill="#FF5E00"/>
          <rect y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="2" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="1" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="11" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="15" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="15" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="15" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="15" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="14" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="3" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="2" width="1" height="1" fill="#FF5E00"/>
          <rect x="11" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="2" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="2" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="6" width="1" height="1" fill="#FF5E00"/>
          <rect x="11" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="11" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="11" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="4" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="5" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="7" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="8" width="1" height="1" fill="#FF5E00"/>
          <rect x="13" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="12" y="14" width="1" height="1" fill="#FF5E00"/>
          <rect x="11" y="15" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="14" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="14" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="15" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="14" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="15" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="14" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="9" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="10" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="8" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="9" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="10" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="6" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="11" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="12" width="1" height="1" fill="#FF5E00"/>
          <rect x="5" y="13" width="1" height="1" fill="#FF5E00"/>
          <rect x="3" y="14" width="1" height="1" fill="#FF5E00"/>
          <rect x="4" y="15" width="1" height="1" fill="#FF5E00"/>
          <rect x="7" y="1" width="1" height="1" fill="#FF5E00"/>
        </svg>
        ${station.votes}
      `;
      stationMeta.appendChild(votesSpan);
    }

    stationDetails.appendChild(stationMeta);
    stationInfo.appendChild(stationDetails);
    card.appendChild(stationInfo);

    // Station controls
    const stationControls = createElement('div', { className: 'station-controls' });
    
    const previewBtn = createElement('button', {
      className: 'preview-btn',
      title: 'Preview station'
    });
    previewBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
    previewBtn.addEventListener('click', () => this.togglePreview(station));
    
    const addBtn = createElement('button', {
      className: 'add-btn',
      title: 'Add to collection'
    });
    
    // Check if station is already saved and set initial state
    const isStationSaved = this.isStationSaved(station);
    this.setAddButtonState(addBtn, isStationSaved);
    
    addBtn.addEventListener('click', () => {
      // Check current state and toggle
      if (this.isStationSaved(station)) {
        // Station is saved, remove it
        const savedStations: LocalStation[] = getStorageItem(StorageKeys.STATIONS, []);
        const savedStation = savedStations.find(saved => 
          saved.stationuuid === station.stationuuid || 
          (saved.url === station.url && saved.name === station.name)
        );
        if (savedStation) {
          eventManager.emit('station:remove', savedStation.id);
        }
      } else {
        // Station is not saved, add it
        eventManager.emit('station:add', station);
      }
    });

    stationControls.appendChild(previewBtn);
    stationControls.appendChild(addBtn);
    card.appendChild(stationControls);

    return card;
  }

  /**
   * Toggle station preview
   */
  private togglePreview(station: RadioStation): void {
    if (this.currentPreviewStation?.stationuuid === station.stationuuid) {
      this.stopPreview();
    } else {
      this.startPreview(station);
    }
  }

  /**
   * Start station preview
   */
  private startPreview(station: RadioStation): void {
    if (!this.previewAudio) return;

    this.stopPreview();
    
    // Pause the main player when starting a preview
    eventManager.emit('player:pause');
    
    this.currentPreviewStation = station;

    const streamUrl = station.url_resolved || station.url;
    this.previewAudio.src = streamUrl;
    this.previewAudio.play().catch(error => {
      console.warn('Preview failed:', error);
    });

    // Update UI to show preview state
    const card = querySelectorSafe(`[data-station-uuid="${station.stationuuid}"]`, this.resultsContainer);
    if (card) {
      card.classList.add('previewing');
      const previewBtn = querySelectorSafe('.preview-btn', card);
      if (previewBtn) {
        previewBtn.innerHTML = '<span class="material-symbols-rounded">pause</span>';
      }
    }
  }

  /**
   * Stop station preview
   */
  private stopPreview(): void {
    if (!this.previewAudio || !this.currentPreviewStation) return;

    this.previewAudio.pause();
    this.previewAudio.src = '';

    // Update UI to remove preview state
    const card = querySelectorSafe(`[data-station-uuid="${this.currentPreviewStation.stationuuid}"]`, this.resultsContainer);
    if (card) {
      card.classList.remove('previewing');
      const previewBtn = querySelectorSafe('.preview-btn', card);
      if (previewBtn) {
        previewBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
      }
    }

    this.currentPreviewStation = null;
  }

  /**
   * Transfer preview to persistent player
   */
  private transferPreviewToPersistentPlayer(): void {
    if (!this.currentPreviewStation || !this.previewAudio) return;
    
    // Only transfer if preview is currently playing
    if (this.previewAudio.paused) return;
    
    // Create a LocalStation from the RadioStation for the persistent player
    const localStation: LocalStation = {
      ...this.currentPreviewStation,
      id: this.currentPreviewStation.stationuuid || `preview-${Date.now()}`,
      dateAdded: new Date().toISOString(),
      playCount: 0,
      isFavorite: false
    };
    
    // Emit event to play this station in the persistent player
    eventManager.emit('station:play-request', localStation);
  }

  /**
   * Show loading state
   */
  private showLoadingState(): void {
    this.resultsContainer.innerHTML = `
      <div class="search-loading">
        <div class="loading-spinner"></div>
        <p>Searching for stations...</p>
      </div>
    `;
    this.container.classList.remove('hidden');
  }

  /**
   * Show error state
   */
  private showErrorState(message: string): void {
    this.resultsContainer.innerHTML = `
      <div class="search-error">
        <p>⚠️ ${message}</p>
        <button class="try-again-btn">Try Again</button>
      </div>
    `;
    
    // Add event listener for try again button
    const tryAgainBtn = querySelectorSafe('.try-again-btn', this.resultsContainer);
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', () => {
        this.searchInput?.focus();
      });
    }
  }

  /**
   * Show empty state
   */
  private showEmptyState(): void {
    this.resultsContainer.innerHTML = `
      <div class="search-empty">
        <p>No stations found for "${this.state.query}"</p>
        <p>Try a different search term.</p>
      </div>
    `;
  }

  /**
   * Show load more button
   */
  private showLoadMoreButton(): void {
    const existingButton = querySelectorSafe('.load-more-button', this.resultsContainer);
    if (existingButton) return;

    const loadMoreButton = createElement('button', {
      className: 'load-more-button'
    }, ['Load More Stations']);

    loadMoreButton.addEventListener('click', () => this.loadMore());
    this.resultsContainer.appendChild(loadMoreButton);
  }

  /**
   * Clear search results
   */
  private clearResults(): void {
    // Transfer preview to persistent player if one is active
    this.transferPreviewToPersistentPlayer();
    
    this.state.results = [];
    this.state.totalResults = 0;
    this.resultsContainer.innerHTML = '';
    this.container.classList.add('hidden');
    this.stopPreview();
  }

  /**
   * Clear search completely
   */
  clearSearch(): void {
    this.searchInput.value = '';
    this.state.query = '';
    this.clearResults();
    eventManager.emit('search:cleared');
  }

  /**
   * Get current search state
   */
  getState(): SearchState {
    return { ...this.state };
  }

  /**
   * Get search suggestions for query
   */
  getSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const lowercaseQuery = query.toLowerCase();

    // Add genre suggestions
    Object.keys(GENRE_MAPPING).forEach(genre => {
      if (genre.includes(lowercaseQuery)) {
        suggestions.push(genre);
      }
    });

    return suggestions.slice(0, 5);
  }

  /**
   * Check if a station is already saved
   */
  private isStationSaved(station: RadioStation): boolean {
    const savedStations: LocalStation[] = getStorageItem(StorageKeys.STATIONS, []);
    return savedStations.some(saved => 
      saved.stationuuid === station.stationuuid || 
      (saved.url === station.url && saved.name === station.name)
    );
  }

  /**
   * Set the add button state (add icon or checkmark)
   */
  private setAddButtonState(button: HTMLElement, isSaved: boolean): void {
    if (isSaved) {
      button.innerHTML = '<span class="material-symbols-rounded" style="color: #1fda8c;">check</span>';
      button.title = 'Remove from collection';
      button.classList.add('station-added');
    } else {
      button.innerHTML = '<span class="material-symbols-rounded">playlist_add</span>';
      button.title = 'Add to collection';
      button.classList.remove('station-added');
    }
  }

  /**
   * Update button state for a specific station in search results
   */
  private updateStationButtonState(station: LocalStation, isAdded: boolean): void {
    // Find the station card in current search results using stationuuid or URL+name
    let stationCard = null;
    
    if (station.stationuuid) {
      stationCard = querySelectorSafe(`[data-station-uuid="${station.stationuuid}"]`, this.resultsContainer);
    }
    
    // If not found by UUID, try to find by URL (for manually added stations)
    if (!stationCard) {
      const allCards = this.resultsContainer.querySelectorAll('.search-result-card');
      for (const card of allCards) {
        const cardStationUuid = card.getAttribute('data-station-uuid');
        const matchingResult = this.state.results.find(result => result.stationuuid === cardStationUuid);
        if (matchingResult && 
            (matchingResult.url === station.url && matchingResult.name === station.name)) {
          stationCard = card as HTMLElement;
          break;
        }
      }
    }
    
    if (!stationCard) return;

    const addBtn = querySelectorSafe('.add-btn', stationCard);
    if (!addBtn) return;

    this.setAddButtonState(addBtn, isAdded);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPreview();
    if (this.previewAudio) {
      this.previewAudio.src = '';
    }
    eventManager.removeAllListeners('search:perform');
    eventManager.removeAllListeners('search:clear');
    eventManager.removeAllListeners('search:load-more');
    eventManager.removeAllListeners('station:added');
    eventManager.removeAllListeners('station:removed');
  }
}