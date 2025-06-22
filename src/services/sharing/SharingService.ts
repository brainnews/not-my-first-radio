/**
 * Service for sharing stations with URL shortening functionality
 */

import { LocalStation } from '@/types/station';

export interface ShareData {
  u: string; // Username
  i: (string | ShareableStation)[]; // Array of station UUIDs or station objects
  name?: string; // Optional list name
}

export interface ShareableStation {
  url: string;
  name: string;
  favicon?: string;
  homepage?: string;
  bitrate?: number;
  countrycode?: string;
  note?: string;
}

export interface ShortenResponse {
  shortUrl?: string;
  error?: string;
}

/**
 * Service for creating shareable URLs with custom URL shortening
 */
export class SharingService {
  private static readonly SHORTENER_URL = 'https://s.notmyfirstradio.com';

  /**
   * Shorten a URL using the custom shortening service
   */
  async shortenUrl(longUrl: string): Promise<string> {
    try {
      const response = await fetch(SharingService.SHORTENER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longUrl })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ShortenResponse = await response.json();
      
      if (data.shortUrl) {
        return data.shortUrl;
      } else {
        throw new Error('No shortUrl in response');
      }
    } catch (error) {
      console.warn('URL shortening failed:', error);
      return longUrl; // Fallback to long URL
    }
  }

  /**
   * Create share data structure from stations
   */
  createShareData(username: string, stations: LocalStation[], listName?: string): ShareData {
    const shareData: ShareData = {
      u: username,
      i: stations.map(station => {
        // Use UUID if available (Radio Browser stations)
        if (station.stationuuid) {
          return station.stationuuid;
        }
        
        // Otherwise, include full station data (manually added stations)
        return {
          url: station.url,
          name: station.name,
          favicon: station.favicon,
          homepage: station.homepage,
          bitrate: station.bitrate,
          countrycode: station.countrycode || station.country,
          note: station.note || ''
        };
      })
    };

    if (listName) {
      shareData.name = listName;
    }

    return shareData;
  }

  /**
   * Create a shareable URL for stations
   */
  createShareUrl(shareData: ShareData): string {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareParam = encodeURIComponent(JSON.stringify(shareData));
    return `${baseUrl}?share=${shareParam}`;
  }

  /**
   * Share a single station
   */
  async shareStation(username: string, station: LocalStation): Promise<string> {
    const shareData = this.createShareData(username, [station]);
    const longUrl = this.createShareUrl(shareData);
    return await this.shortenUrl(longUrl);
  }

  /**
   * Share multiple stations
   */
  async shareStations(username: string, stations: LocalStation[], listName?: string): Promise<string> {
    const shareData = this.createShareData(username, stations, listName);
    const longUrl = this.createShareUrl(shareData);
    return await this.shortenUrl(longUrl);
  }

  /**
   * Parse shared data from URL parameters
   */
  parseSharedData(): ShareData | null {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shareParam = urlParams.get('share');
      
      if (!shareParam) {
        return null;
      }

      const shareData = JSON.parse(decodeURIComponent(shareParam)) as ShareData;
      
      // Validate required fields
      if (!shareData || !shareData.u || !shareData.i || !Array.isArray(shareData.i)) {
        console.warn('Invalid share data structure');
        return null;
      }

      return shareData;
    } catch (error) {
      console.error('Failed to parse shared data:', error);
      return null;
    }
  }

  /**
   * Clear share parameters from URL
   */
  clearShareParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, document.title, url.toString());
  }

  /**
   * Generate QR code URL for sharing
   */
  async generateQRCodeUrl(username: string, stations: LocalStation[], listName?: string): Promise<string> {
    const shareUrl = await this.shareStations(username, stations, listName);
    return shareUrl;
  }
}

// Export singleton instance
export const sharingService = new SharingService();