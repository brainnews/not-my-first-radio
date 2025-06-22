import { LocalStation, StationList } from './station';

/**
 * Application state interface
 */
export interface AppState {
  currentStation: LocalStation | null;
  stations: LocalStation[];
  sharedStations: StationList[];
  isPlaying: boolean;
  volume: number;
  username: string;
  searchResults: LocalStation[];
  currentView: 'stations' | 'search' | 'settings';
  settings: AppSettings;
}

/**
 * Application settings
 */
export interface AppSettings {
  autoPlay: boolean;
  volume: number;
  showVisualizer: boolean;
  compactView: boolean;
  darkMode: boolean;
  notifications: boolean;
  achievementsEnabled: boolean;
}

/**
 * Audio player state
 */
export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  hasError: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
}

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

/**
 * Modal types
 */
export type ModalType = 
  | 'qr-code' 
  | 'add-station' 
  | 'settings' 
  | 'achievements' 
  | 'terms' 
  | 'confirmation';

/**
 * Modal state
 */
export interface ModalState {
  type: ModalType | null;
  isOpen: boolean;
  data?: any;
}

/**
 * Event types for the event system
 */
export type AppEventType = 
  | 'station:play'
  | 'station:pause'
  | 'station:stop'
  | 'station:add'
  | 'station:remove'
  | 'station:update'
  | 'user:login'
  | 'user:logout'
  | 'search:start'
  | 'search:complete'
  | 'settings:change'
  | 'notification:show'
  | 'modal:open'
  | 'modal:close';

/**
 * Event interface
 */
export interface AppEvent {
  type: AppEventType;
  payload?: any;
  timestamp: number;
}

/**
 * Achievement data
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

/**
 * User statistics
 */
export interface UserStats {
  totalStationsAdded: number;
  totalPlayTime: number;
  stationsPlayed: number;
  countriesExplored: number;
  achievementsUnlocked: number;
  dateJoined: string;
}