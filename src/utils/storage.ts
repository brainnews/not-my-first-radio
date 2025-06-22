/**
 * Local storage utility functions with type safety and error handling
 */

/**
 * Storage keys enum for consistency
 */
export enum StorageKeys {
  STATIONS = 'radioStations',
  USERNAME = 'radioUsername',
  SETTINGS = 'radioSettings',
  ACHIEVEMENTS = 'radioAchievements',
  SHARED_STATIONS = 'sharedStations',
  USER_STATS = 'userStats',
  LAST_PLAYED = 'lastPlayedStation',
  VOLUME = 'radioVolume',
  SECTION_STATES = 'sectionStates'
}

/**
 * Get item from localStorage with type safety
 */
export function getStorageItem<T>(key: StorageKeys, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to parse localStorage item '${key}':`, error);
    return defaultValue;
  }
}

/**
 * Set item in localStorage with error handling
 */
export function setStorageItem<T>(key: StorageKeys, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save to localStorage '${key}':`, error);
    return false;
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: StorageKeys): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove from localStorage '${key}':`, error);
    return false;
  }
}

/**
 * Clear all application data from localStorage
 */
export function clearAllStorage(): boolean {
  try {
    Object.values(StorageKeys).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
    return false;
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage information
 */
export function getStorageUsage(): {
  used: number;
  available: number;
  percentage: number;
} {
  try {
    let used = 0;
    Object.values(StorageKeys).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        used += item.length;
      }
    });

    // Rough estimate of localStorage limit (usually 5-10MB)
    const available = 5 * 1024 * 1024; // 5MB
    const percentage = (used / available) * 100;

    return { used, available, percentage };
  } catch {
    return { used: 0, available: 0, percentage: 0 };
  }
}

/**
 * Export all application data
 */
export function exportAllData(): string {
  const data: Record<string, any> = {};
  
  Object.values(StorageKeys).forEach(key => {
    const item = localStorage.getItem(key);
    if (item) {
      try {
        data[key] = JSON.parse(item);
      } catch {
        data[key] = item;
      }
    }
  });

  return JSON.stringify(data, null, 2);
}

/**
 * Import application data from JSON string
 */
export function importAllData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);
    
    Object.entries(data).forEach(([key, value]) => {
      if (Object.values(StorageKeys).includes(key as StorageKeys)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

/**
 * Storage event listener for cross-tab synchronization
 */
export function onStorageChange(
  key: StorageKeys,
  callback: (newValue: any, oldValue: any) => void
): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === key) {
      let newValue = null;
      let oldValue = null;
      
      try {
        if (event.newValue) newValue = JSON.parse(event.newValue);
        if (event.oldValue) oldValue = JSON.parse(event.oldValue);
      } catch {
        newValue = event.newValue;
        oldValue = event.oldValue;
      }
      
      callback(newValue, oldValue);
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/**
 * Migrate old storage format to new format
 */
export function migrateStorage(): void {
  // Migration logic for old versions - fix storage keys to match original version
  const oldStationsKey = 'radio-stations';
  const oldUsernameKey = 'radio-username';
  const oldStationListsKey = 'radio-station-lists';
  
  if (localStorage.getItem(oldStationsKey) && !localStorage.getItem(StorageKeys.STATIONS)) {
    localStorage.setItem(StorageKeys.STATIONS, localStorage.getItem(oldStationsKey)!);
    localStorage.removeItem(oldStationsKey);
  }
  
  if (localStorage.getItem(oldUsernameKey) && !localStorage.getItem(StorageKeys.USERNAME)) {
    localStorage.setItem(StorageKeys.USERNAME, localStorage.getItem(oldUsernameKey)!);
    localStorage.removeItem(oldUsernameKey);
  }
  
  // Migrate shared station lists
  if (localStorage.getItem(oldStationListsKey) && !localStorage.getItem(StorageKeys.SHARED_STATIONS)) {
    try {
      const oldLists = JSON.parse(localStorage.getItem(oldStationListsKey)!);
      // Convert old format to new format with required fields
      const migratedLists = oldLists.map((list: any) => ({
        ...list,
        id: list.id || `migrated-${Date.now()}-${Math.random()}`,
        createdAt: list.createdAt || new Date().toISOString(),
        isPublic: list.isPublic ?? false
      }));
      localStorage.setItem(StorageKeys.SHARED_STATIONS, JSON.stringify(migratedLists));
      localStorage.removeItem(oldStationListsKey);
    } catch (error) {
      console.warn('Failed to migrate station lists:', error);
    }
  }
}