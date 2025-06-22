/**
 * Radio Browser API service with fallback servers and error handling
 */

import { RadioStation, SearchParams } from '@/types/station';

/**
 * Radio Browser API endpoints with fallback servers
 */
const API_SERVERS = [
  'https://at1.api.radio-browser.info',
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info'
];

/**
 * API response interfaces
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ServerInfo {
  name: string;
  ip: string;
  stats: {
    stations: number;
    stations_broken: number;
    tags: number;
    clicks_last_hour: number;
    clicks_last_day: number;
    languages: number;
    countries: number;
  };
}

/**
 * Radio Browser API client with automatic failover
 */
export class RadioBrowserApi {
  private currentServerIndex = 0;
  private readonly maxRetries = 3;
  private readonly timeout = 10000; // 10 seconds

  /**
   * Get the current API server URL
   */
  private getCurrentServer(): string {
    return API_SERVERS[this.currentServerIndex];
  }

  /**
   * Switch to the next available server
   */
  private switchToNextServer(): void {
    this.currentServerIndex = (this.currentServerIndex + 1) % API_SERVERS.length;
  }

  /**
   * Make API request with automatic retry and fallback
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const server = this.getCurrentServer();
        const url = new URL(`${server}${endpoint}`);
        
        // Add parameters to URL
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, value.toString());
          }
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'NotMyFirstRadio/2.0',
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };

      } catch (error) {
        lastError = error as Error;
        console.warn(`API request failed (attempt ${attempt + 1}):`, error);
        
        // Switch to next server for next attempt
        this.switchToNextServer();
      }
    }

    return {
      success: false,
      error: lastError?.message || 'All API servers failed'
    };
  }

  /**
   * Search for radio stations
   */
  async searchStations(params: SearchParams): Promise<ApiResponse<RadioStation[]>> {
    const searchParams: Record<string, any> = {
      hidebroken: true,
      ...params
    };

    return this.makeRequest<RadioStation[]>('/json/stations/search', searchParams);
  }

  /**
   * Get stations by name
   */
  async getStationsByName(name: string, limit = 20): Promise<ApiResponse<RadioStation[]>> {
    return this.searchStations({ name, limit });
  }

  /**
   * Get stations by country
   */
  async getStationsByCountry(country: string, limit = 20): Promise<ApiResponse<RadioStation[]>> {
    return this.searchStations({ country, limit });
  }

  /**
   * Get stations by tag/genre
   */
  async getStationsByTag(tag: string, limit = 20): Promise<ApiResponse<RadioStation[]>> {
    return this.searchStations({ tag, limit });
  }

  /**
   * Get popular stations
   */
  async getPopularStations(limit = 20): Promise<ApiResponse<RadioStation[]>> {
    return this.searchStations({ 
      order: 'votes', 
      reverse: true, 
      limit 
    });
  }

  /**
   * Get recently added stations
   */
  async getRecentStations(limit = 20): Promise<ApiResponse<RadioStation[]>> {
    return this.makeRequest<RadioStation[]>('/json/stations/lastchange', { limit });
  }

  /**
   * Get station by UUID
   */
  async getStationByUuid(uuid: string): Promise<ApiResponse<RadioStation>> {
    const response = await this.makeRequest<RadioStation[]>('/json/stations/byuuid', { uuids: uuid });
    
    if (response.success && response.data && response.data.length > 0) {
      return { success: true, data: response.data[0] };
    }
    
    return { success: false, error: 'Station not found' };
  }

  /**
   * Click a station (increment play count)
   */
  async clickStation(uuid: string): Promise<ApiResponse<{ ok: string; message: string }>> {
    return this.makeRequest('/json/url', { stationuuid: uuid });
  }

  /**
   * Get all countries
   */
  async getCountries(): Promise<ApiResponse<Array<{ name: string; stationcount: number }>>> {
    return this.makeRequest('/json/countries');
  }

  /**
   * Get all tags/genres
   */
  async getTags(): Promise<ApiResponse<Array<{ name: string; stationcount: number }>>> {
    return this.makeRequest('/json/tags');
  }

  /**
   * Get all languages
   */
  async getLanguages(): Promise<ApiResponse<Array<{ name: string; stationcount: number }>>> {
    return this.makeRequest('/json/languages');
  }

  /**
   * Get server statistics
   */
  async getServerStats(): Promise<ApiResponse<ServerInfo>> {
    return this.makeRequest('/json/stats');
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getServerStats();
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * Get current server status
   */
  getCurrentServerInfo(): { url: string; index: number; total: number } {
    return {
      url: this.getCurrentServer(),
      index: this.currentServerIndex,
      total: API_SERVERS.length
    };
  }

  /**
   * Manually set server index
   */
  setServerIndex(index: number): void {
    if (index >= 0 && index < API_SERVERS.length) {
      this.currentServerIndex = index;
    }
  }
}

// Create singleton instance
export const radioBrowserApi = new RadioBrowserApi();

/**
 * Genre mapping for enhanced search
 */
export const GENRE_MAPPING: Record<string, string[]> = {
  rock: ['rock', 'classic rock', 'hard rock', 'punk rock', 'alternative rock'],
  pop: ['pop', 'pop music', 'top 40', 'contemporary'],
  jazz: ['jazz', 'smooth jazz', 'bebop', 'fusion'],
  classical: ['classical', 'symphony', 'opera', 'baroque'],
  electronic: ['electronic', 'techno', 'house', 'trance', 'ambient'],
  hip_hop: ['hip hop', 'rap', 'hip-hop', 'urban'],
  country: ['country', 'bluegrass', 'folk', 'americana'],
  blues: ['blues', 'rhythm and blues', 'r&b'],
  reggae: ['reggae', 'ska', 'dub'],
  metal: ['metal', 'heavy metal', 'death metal', 'black metal'],
  indie: ['indie', 'independent', 'alternative'],
  dance: ['dance', 'club', 'disco', 'eurodance'],
  world: ['world music', 'ethnic', 'traditional'],
  news: ['news', 'talk', 'information'],
  sports: ['sports', 'football', 'basketball', 'soccer']
};

/**
 * Expand search terms using genre mapping
 */
export function expandSearchTerms(query: string): string[] {
  const terms = [query.toLowerCase()];
  
  Object.entries(GENRE_MAPPING).forEach(([genre, synonyms]) => {
    if (synonyms.some(synonym => query.toLowerCase().includes(synonym))) {
      terms.push(...synonyms);
    }
  });
  
  return [...new Set(terms)]; // Remove duplicates
}