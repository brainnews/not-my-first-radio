/**
 * Settings management module for user preferences and configuration
 */

import { AppSettings } from '@/types/app';
import { eventManager } from '@/utils/events';
import { getStorageItem, setStorageItem, StorageKeys, exportAllData, importAllData, clearAllStorage } from '@/utils/storage';
import { querySelector, createElement } from '@/utils/dom';

export interface SettingsManagerConfig {
  container?: HTMLElement;
  autoSave?: boolean;
}

/**
 * Manages application settings and user preferences
 */
export class SettingsManager {
  private settings: AppSettings;
  private container: HTMLElement | null;
  private autoSave: boolean;

  constructor(config: SettingsManagerConfig = {}) {
    this.container = config.container || null;
    this.autoSave = config.autoSave ?? true;

    this.loadSettings();
    this.setupEventListeners();
  }

  /**
   * Load settings from storage with defaults
   */
  private loadSettings(): void {
    this.settings = getStorageItem(StorageKeys.SETTINGS, {
      autoPlay: false,
      volume: 0.7,
      showVisualizer: true,
      compactView: false,
      darkMode: this.detectDarkModePreference(),
      notifications: true,
      achievementsEnabled: true
    });

    // Apply settings immediately
    this.applySettings();
    eventManager.emit('settings:loaded', this.settings);
  }

  /**
   * Detect user's dark mode preference
   */
  private detectDarkModePreference(): boolean {
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  /**
   * Save settings to storage
   */
  private saveSettings(): void {
    if (this.autoSave) {
      setStorageItem(StorageKeys.SETTINGS, this.settings);
      eventManager.emit('settings:saved', this.settings);
    }
  }

  /**
   * Apply settings to the application
   */
  private applySettings(): void {
    // Apply dark mode
    document.documentElement.classList.toggle('dark-mode', this.settings.darkMode);
    
    // Apply compact view
    document.documentElement.classList.toggle('compact-view', this.settings.compactView);
    
    // Apply other visual settings
    if (this.settings.showVisualizer) {
      document.documentElement.classList.add('show-visualizer');
    } else {
      document.documentElement.classList.remove('show-visualizer');
    }

    eventManager.emit('settings:applied', this.settings);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('settings:update', (updates: Partial<AppSettings>) => {
      this.updateSettings(updates);
    });

    eventManager.on('settings:reset', () => {
      this.resetToDefaults();
    });

    eventManager.on('settings:export', () => {
      this.exportSettings();
    });

    eventManager.on('settings:import', (data: string) => {
      this.importSettings(data);
    });

    // Listen for system dark mode changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!this.hasCustomDarkModeSet()) {
          this.updateSettings({ darkMode: e.matches });
        }
      });
    }
  }

  /**
   * Check if user has manually set dark mode
   */
  private hasCustomDarkModeSet(): boolean {
    const storedSettings = getStorageItem(StorageKeys.SETTINGS, null);
    return storedSettings && storedSettings.hasOwnProperty('darkMode');
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<AppSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...updates };
    
    this.saveSettings();
    this.applySettings();
    
    eventManager.emit('settings:changed', {
      oldSettings,
      newSettings: this.settings,
      changes: updates
    });
  }

  /**
   * Get current settings
   */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Set a specific setting
   */
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.updateSettings({ [key]: value } as Partial<AppSettings>);
  }

  /**
   * Toggle a boolean setting
   */
  toggleSetting(key: keyof AppSettings): boolean {
    const currentValue = this.settings[key];
    if (typeof currentValue === 'boolean') {
      const newValue = !currentValue;
      this.updateSettings({ [key]: newValue } as Partial<AppSettings>);
      return newValue;
    }
    return false;
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    const defaultSettings: AppSettings = {
      autoPlay: false,
      volume: 0.7,
      showVisualizer: true,
      compactView: false,
      darkMode: this.detectDarkModePreference(),
      notifications: true,
      achievementsEnabled: true
    };

    this.settings = defaultSettings;
    this.saveSettings();
    this.applySettings();
    
    eventManager.emit('settings:reset', this.settings);
  }

  /**
   * Export all application data
   */
  exportSettings(): string {
    const data = exportAllData();
    eventManager.emit('settings:exported', data);
    return data;
  }

  /**
   * Import application data
   */
  importSettings(jsonData: string): boolean {
    try {
      const success = importAllData(jsonData);
      if (success) {
        this.loadSettings(); // Reload settings after import
        eventManager.emit('settings:imported', this.settings);
      }
      return success;
    } catch (error) {
      console.error('Failed to import settings:', error);
      eventManager.emit('settings:import-error', error);
      return false;
    }
  }

  /**
   * Clear all application data
   */
  clearAllData(): boolean {
    try {
      const success = clearAllStorage();
      if (success) {
        this.resetToDefaults();
        eventManager.emit('settings:data-cleared');
      }
      return success;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }

  /**
   * Create settings panel UI
   */
  createSettingsPanel(): HTMLElement {
    const panel = createElement('div', { className: 'settings-panel' });

    // Settings sections
    const sections = [
      {
        title: 'Playback',
        settings: [
          {
            key: 'autoPlay' as keyof AppSettings,
            label: 'Auto-play stations',
            type: 'checkbox',
            description: 'Automatically start playing when selecting a station'
          },
          {
            key: 'volume' as keyof AppSettings,
            label: 'Default volume',
            type: 'range',
            min: 0,
            max: 1,
            step: 0.1,
            description: 'Default volume level for new sessions'
          }
        ]
      },
      {
        title: 'Appearance',
        settings: [
          {
            key: 'darkMode' as keyof AppSettings,
            label: 'Dark mode',
            type: 'checkbox',
            description: 'Use dark color scheme'
          },
          {
            key: 'compactView' as keyof AppSettings,
            label: 'Compact view',
            type: 'checkbox',
            description: 'Show more stations in less space'
          },
          {
            key: 'showVisualizer' as keyof AppSettings,
            label: 'Audio visualizer',
            type: 'checkbox',
            description: 'Show audio visualization while playing'
          }
        ]
      },
      {
        title: 'Features',
        settings: [
          {
            key: 'notifications' as keyof AppSettings,
            label: 'Notifications',
            type: 'checkbox',
            description: 'Show notification messages'
          },
          {
            key: 'achievementsEnabled' as keyof AppSettings,
            label: 'Achievements',
            type: 'checkbox',
            description: 'Track and unlock achievements'
          }
        ]
      }
    ];

    sections.forEach(section => {
      const sectionElement = this.createSettingsSection(section.title, section.settings);
      panel.appendChild(sectionElement);
    });

    // Data management section
    const dataSection = this.createDataManagementSection();
    panel.appendChild(dataSection);

    return panel;
  }

  /**
   * Create a settings section
   */
  private createSettingsSection(title: string, settings: any[]): HTMLElement {
    const section = createElement('div', { className: 'settings-section' });
    
    const titleElement = createElement('h3', { className: 'settings-section-title' }, [title]);
    section.appendChild(titleElement);

    settings.forEach(setting => {
      const settingElement = this.createSettingControl(setting);
      section.appendChild(settingElement);
    });

    return section;
  }

  /**
   * Create a setting control
   */
  private createSettingControl(setting: any): HTMLElement {
    const wrapper = createElement('div', { className: 'setting-control' });
    
    const label = createElement('label', { className: 'setting-label' });
    const labelText = createElement('span', { className: 'setting-label-text' }, [setting.label]);
    label.appendChild(labelText);

    let input: HTMLElement;

    switch (setting.type) {
      case 'checkbox':
        input = createElement('input', {
          type: 'checkbox',
          checked: this.settings[setting.key],
          onchange: (event: Event) => {
            const target = event.target as HTMLInputElement;
            this.setSetting(setting.key, target.checked);
          }
        });
        break;

      case 'range':
        input = createElement('input', {
          type: 'range',
          min: setting.min,
          max: setting.max,
          step: setting.step,
          value: this.settings[setting.key],
          oninput: (event: Event) => {
            const target = event.target as HTMLInputElement;
            this.setSetting(setting.key, parseFloat(target.value));
          }
        });
        break;

      default:
        input = createElement('input', {
          type: 'text',
          value: this.settings[setting.key],
          onchange: (event: Event) => {
            const target = event.target as HTMLInputElement;
            this.setSetting(setting.key, target.value);
          }
        });
    }

    label.appendChild(input);
    wrapper.appendChild(label);

    if (setting.description) {
      const description = createElement('p', { className: 'setting-description' }, [setting.description]);
      wrapper.appendChild(description);
    }

    return wrapper;
  }

  /**
   * Create data management section
   */
  private createDataManagementSection(): HTMLElement {
    const section = createElement('div', { className: 'settings-section' });
    
    const title = createElement('h3', { className: 'settings-section-title' }, ['Data Management']);
    section.appendChild(title);

    // Export button
    const exportButton = createElement('button', {
      className: 'settings-button',
      onclick: () => {
        const data = this.exportSettings();
        this.downloadAsFile(data, 'nmfr-backup.json');
      }
    }, ['Export All Data']);
    section.appendChild(exportButton);

    // Import button
    const importWrapper = createElement('div', { className: 'file-input-wrapper' });
    const importInput = createElement('input', {
      type: 'file',
      accept: '.json',
      style: 'display: none',
      onchange: (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            this.importSettings(content);
          };
          reader.readAsText(file);
        }
      }
    });

    const importButton = createElement('button', {
      className: 'settings-button',
      onclick: () => importInput.click()
    }, ['Import Data']);

    importWrapper.appendChild(importInput);
    importWrapper.appendChild(importButton);
    section.appendChild(importWrapper);

    // Clear data button
    const clearButton = createElement('button', {
      className: 'settings-button danger',
      onclick: () => {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
          this.clearAllData();
        }
      }
    }, ['Clear All Data']);
    section.appendChild(clearButton);

    return section;
  }

  /**
   * Download data as file
   */
  private downloadAsFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = createElement('a', {
      href: url,
      download: filename,
      style: 'display: none'
    });
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): { used: number; available: number; percentage: number } {
    try {
      let totalSize = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }
      
      const available = 5 * 1024 * 1024; // 5MB estimate
      const percentage = (totalSize / available) * 100;
      
      return {
        used: totalSize,
        available,
        percentage: Math.min(percentage, 100)
      };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    eventManager.removeAllListeners('settings:update');
    eventManager.removeAllListeners('settings:reset');
    eventManager.removeAllListeners('settings:export');
    eventManager.removeAllListeners('settings:import');
  }
}