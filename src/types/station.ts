/**
 * Radio station interface based on Radio Browser API
 */
export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  language?: string;
  languagecodes?: string;
  votes?: number;
  lastchangetime?: string;
  lastchangetime_iso8601?: string;
  lastcheckok?: number;
  lastchecktime?: string;
  lastchecktime_iso8601?: string;
  lastcheckoktime?: string;
  lastcheckoktime_iso8601?: string;
  lastlocalchecktime?: string;
  clicktimestamp?: string;
  clicktimestamp_iso8601?: string;
  clickcount?: number;
  clicktrend?: number;
  ssl_error?: number;
  geo_lat?: number;
  geo_long?: number;
  has_extended_info?: boolean;
  bitrate?: number;
  codec?: string;
}

/**
 * Local station with additional metadata
 */
export interface LocalStation extends RadioStation {
  id: string;
  dateAdded: string;
  lastPlayed?: string;
  playCount: number;
  note?: string;
  isFavorite: boolean;
  customName?: string;
  volume?: number;
}

/**
 * Station list for sharing
 */
export interface StationList {
  id: string;
  name: string;
  stations: LocalStation[];
  createdBy: string;
  createdAt: string;
  description?: string;
  isPublic: boolean;
}

/**
 * Search parameters for Radio Browser API
 */
export interface SearchParams {
  name?: string;
  country?: string;
  state?: string;
  language?: string;
  tag?: string;
  codec?: string;
  bitrate?: number;
  order?: 'name' | 'votes' | 'clickcount' | 'bitrate' | 'country';
  reverse?: boolean;
  offset?: number;
  limit?: number;
}

/**
 * Genre mapping for search functionality
 */
export interface GenreMapping {
  [key: string]: string[];
}

/**
 * Station card display options
 */
export interface StationDisplayOptions {
  showFavicon: boolean;
  showCountry: boolean;
  showBitrate: boolean;
  showVotes: boolean;
  compactMode: boolean;
}