/**
 * Utility functions index for easy importing
 */

// DOM utilities
export {
  querySelector,
  querySelectorSafe,
  querySelectorAll,
  createElement,
  addEventListenerWithCleanup,
  toggleClass,
  addClasses,
  removeClasses,
  hasClass,
  waitForElement,
  debounce,
  throttle,
  animateElement,
  scrollToElement,
  getElementPosition
} from './dom';

// Storage utilities
export {
  StorageKeys,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearAllStorage,
  isStorageAvailable,
  getStorageUsage,
  exportAllData,
  importAllData,
  onStorageChange,
  migrateStorage
} from './storage';

// Event management
export {
  eventManager,
  createEventEmitter,
  withEventCleanup,
  waitForEvent,
  EventBatcher
} from './events';

// Common utility functions
export const utils = {
  /**
   * Generate a unique ID
   */
  generateId: (prefix = 'id'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Format duration in seconds to human readable format
   */
  formatDuration: (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
    }
  },

  /**
   * Format file size in bytes to human readable format
   */
  formatFileSize: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  },

  /**
   * Clamp a number between min and max values
   */
  clamp: (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Map a value from one range to another
   */
  mapRange: (
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number
  ): number => {
    return ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin) + toMin;
  },

  /**
   * Check if a value is a valid URL
   */
  isValidUrl: (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sanitize HTML string to prevent XSS
   */
  sanitizeHtml: (html: string): string => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  /**
   * Copy text to clipboard
   */
  copyToClipboard: async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  },

  /**
   * Get country flag emoji from country code
   */
  getCountryFlag: (countryCode: string): string => {
    if (!countryCode || countryCode.length !== 2) {
      return '🌍';
    }
    
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
  },

  /**
   * Parse and format bitrate display
   */
  formatBitrate: (bitrate: number | undefined): string => {
    if (!bitrate || bitrate <= 0) {
      return 'Unknown';
    }
    return `${bitrate} kbps`;
  },

  /**
   * Get relative time string (e.g., "2 hours ago")
   */
  getRelativeTime: (date: string | Date): string => {
    const now = new Date().getTime();
    const then = new Date(date).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  },

  /**
   * Validate and format station URL
   */
  validateStationUrl: (url: string): { isValid: boolean; formatted?: string; error?: string } => {
    if (!url || url.trim().length === 0) {
      return { isValid: false, error: 'URL is required' };
    }

    try {
      const urlObj = new URL(url.trim());
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
      }

      // Check for common streaming file extensions
      const streamingExtensions = ['.mp3', '.aac', '.ogg', '.m3u', '.m3u8', '.pls'];
      const hasStreamingExtension = streamingExtensions.some(ext => 
        urlObj.pathname.toLowerCase().includes(ext)
      );

      if (!hasStreamingExtension && !urlObj.pathname.includes('stream')) {
        console.warn('URL may not be a valid audio stream');
      }

      return { isValid: true, formatted: urlObj.toString() };
    } catch {
      return { isValid: false, error: 'Invalid URL format' };
    }
  },

  /**
   * Sleep for a specified number of milliseconds
   */
  sleep: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Retry an async operation with exponential backoff
   */
  retry: async <T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    baseDelay = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        await utils.sleep(delay);
      }
    }

    throw lastError!;
  }
};