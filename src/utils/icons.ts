/**
 * Efficient SVG icon system for station metadata
 */

// Global icon size configuration
export const DEFAULT_ICON_SIZE = 16;

export interface IconOptions {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Creates an optimized SVG icon element
 */
function createIcon(pathData: string, viewBox: string = "0 0 24 24", options: IconOptions = {}): string {
  const { size = DEFAULT_ICON_SIZE, color = "currentColor", className = "" } = options;
  
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg"${className ? ` class="${className}"` : ''}>
    <path d="${pathData}" fill="${color}"/>
  </svg>`;
}

/**
 * Country/location icon (pixel art globe style)
 */
export function getCountryIcon(options: IconOptions = {}): string {
  // Pixel art globe/earth icon with the exact design from the original project
  const { size = DEFAULT_ICON_SIZE } = options;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3H9V5H10V6H8V5H6V6H5V7H6V8H10V9H11V11H12V12H13V14H11V15H8V12H6V11H5V9H4V7H3V6H1V5H2V3H3V2H5V1H10V3Z" fill="#1C6800"/>
    <path d="M1 6H3V7H4V9H5V11H6V12H8V15H11V16H5V15H3V14H2V13H1V11H0V5H1V6Z" fill="#477EFF"/>
    <path d="M13 15H11V14H13V15Z" fill="#477EFF"/>
    <path d="M11 1H13V2H14V3H15V5H16V11H15V13H14V14H13V12H12V11H11V9H10V8H6V7H5V6H6V5H8V6H10V5H9V3H10V1H5V0H11V1Z" fill="#477EFF"/>
    <path d="M2 5H1V3H2V5Z" fill="#477EFF"/>
    <path d="M3 3H2V2H3V3Z" fill="#477EFF"/>
    <path d="M5 2H3V1H5V2Z" fill="#477EFF"/>
  </svg>`;
}

/**
 * Votes/popularity icon (pixel art flame style) 
 */
export function getVotesIcon(options: IconOptions = {}): string {
  // Pixel art flame icon using the provided efficient path notation
  const { size = DEFAULT_ICON_SIZE } = options;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 10H10V11H11V14H10V15H9V16H7V15H6V14H5V11H6V10H7V9H9V10Z" fill="#FFC933"/>
    <path d="M5 16H4V15H5V16Z" fill="#FF5E00"/>
    <path d="M12 16H11V15H12V16Z" fill="#FF5E00"/>
    <path d="M4 15H3V14H4V15Z" fill="#FF5E00"/>
    <path d="M13 15H12V14H13V15Z" fill="#FF5E00"/>
    <path d="M7 1H8V3H9V4H12V3H13V4H14V5H15V7H16V11H15V13H14V14H13V11H12V9H11V8H9V7H6V8H5V9H4V10H3V14H2V13H1V11H0V7H1V5H2V4H3V3H4V2H5V1H6V0H7V1Z" fill="#FF5E00"/>
  </svg>`;
}

/**
 * Bitrate icon (pixel art radio/device style)
 */
export function getBitrateIcon(options: IconOptions = {}): string {
  // Pixel art radio/device icon with the exact design from the original project
  const { size = DEFAULT_ICON_SIZE } = options;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 9V10H3V9H5Z" fill="#47B5FF"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M6 11H2V8H6V11ZM5 9H3V10H5V9Z" fill="#477EFF"/>
    <path d="M11 10V11H7V10H11Z" fill="#262626"/>
    <path d="M11 9H7V8H11V9Z" fill="#262626"/>
    <path d="M16 13H15V14H14V15H13V5H14V6H15V5H16V13Z" fill="#D29A00"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 15H1V7H12V15ZM2 13H3V12H2V13ZM4 13H5V12H4V13ZM6 13H9V12H6V13ZM10 13H11V12H10V13ZM2 11H6V8H2V11ZM7 11H11V10H7V11ZM7 9H11V8H7V9Z" fill="#FFC933"/>
    <path d="M13 16H1V15H12V7H1V15H0V6H13V16Z" fill="#FFC933"/>
    <path d="M8 13H7V12H8V13Z" fill="#FFC933"/>
    <path d="M3 13H2V12H3V13Z" fill="#6D6D6D"/>
    <path d="M5 13H4V12H5V13Z" fill="#6D6D6D"/>
    <path d="M7 13H6V12H7V13Z" fill="#6D6D6D"/>
    <path d="M9 13H8V12H9V13Z" fill="#6D6D6D"/>
    <path d="M11 13H10V12H11V13Z" fill="#6D6D6D"/>
    <path d="M4 14H3V13H4V14Z" fill="#6D6D6D"/>
    <path d="M6 14H5V13H6V14Z" fill="#6D6D6D"/>
    <path d="M8 14H7V13H8V14Z" fill="#6D6D6D"/>
    <path d="M10 14H9V13H10V14Z" fill="#6D6D6D"/>
    <path d="M13 4V6H1V5H2V4H13Z" fill="#FFE59E"/>
    <path d="M15 6H14V5H13V4H15V6Z" fill="#DCDCDC"/>
    <path d="M13 4H11V3H13V4Z" fill="#DCDCDC"/>
    <path d="M11 3H9V2H11V3Z" fill="#DCDCDC"/>
    <path d="M9 2H7V1H9V2Z" fill="#DCDCDC"/>
    <path d="M7 1H5V0H7V1Z" fill="#DCDCDC"/>
  </svg>`;
}

/**
 * Station placeholder favicon (pixel art browser/webpage style)
 */
export function getStationPlaceholderIcon(options: IconOptions = {}): string {
  // Pixel art browser/webpage icon for stations without their own favicon
  const { size = DEFAULT_ICON_SIZE } = options;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 16H9V15H15V5H11V1H1V15H3V16H0V0H12V1H13V2H12V4H14V3H15V4H16V16Z" fill="#D9D9D9"/>
    <path d="M14 3H13V2H14V3Z" fill="#D9D9D9"/>
    <path d="M13 13H10V12H12V10H13V13Z" fill="#D9D9D9"/>
    <path d="M13 8H12V9H11V10H9V6H13V8Z" fill="#1500FF"/>
    <path d="M4 8H5V10H7V11H6V12H3V7H4V8Z" fill="#FF0000"/>
    <path d="M7 4H8V6H7V7H5V6H4V4H5V3H7V4Z" fill="#0DFF00"/>
  </svg>`;
}

/**
 * Animated equalizer icon for when a station is playing
 */
export function getAnimatedEqualizerIcon(options: IconOptions = {}): string {
  const { size = DEFAULT_ICON_SIZE } = options;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eq-bar-1 { animation: equalizer-1 1.5s ease-in-out infinite; }
      .eq-bar-2 { animation: equalizer-2 1.2s ease-in-out infinite; }
      .eq-bar-3 { animation: equalizer-3 1.8s ease-in-out infinite; }
      .eq-bar-4 { animation: equalizer-4 1.4s ease-in-out infinite; }
      .eq-bar-5 { animation: equalizer-5 1.6s ease-in-out infinite; }
      
      @keyframes equalizer-1 {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-4px); }
      }
      @keyframes equalizer-2 {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      @keyframes equalizer-3 {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
      }
      @keyframes equalizer-4 {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-5px); }
      }
      @keyframes equalizer-5 {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-7px); }
      }
    </style>
    
    <!-- Bar 1 -->
    <g class="eq-bar-1">
      <!-- Green sections -->
      <path d="M3 14V15H1V14H3Z" fill="#00FFA2"/>
      <path d="M3 13V14H1V13H3Z" fill="#00FFA2"/>
      <path d="M3 12V13H1V12H3Z" fill="#00FFA2"/>
      <path d="M3 11V12H1V11H3Z" fill="#00FFA2"/>
      <path d="M3 10V11H1V10H3Z" fill="#00FFA2"/>
      <path d="M3 9V10H1V9H3Z" fill="#00FFA2"/>
      <path d="M3 8V9H1V8H3Z" fill="#00FFA2"/>
      <path d="M3 7V8H1V7H3Z" fill="#00FFA2"/>
      <path d="M3 6V7H1V6H3Z" fill="#00FFA2"/>
      <path d="M3 5V6H1V5H3Z" fill="#00FFA2"/>
      <path d="M3 4V5H1V4H3Z" fill="#00FFA2"/>
      <path d="M3 3V4H1V3H3Z" fill="#00FFA2"/>
      <path d="M3 2V3H1V2H3Z" fill="#00FFA2"/>
      <!-- Purple tip -->
      <path d="M3 1V2H1V1H3Z" fill="#9E66F2"/>
    </g>
    
    <!-- Bar 2 -->
    <g class="eq-bar-2">
      <!-- Green sections -->
      <path d="M6 14V15H4V14H6Z" fill="#00FFA2"/>
      <path d="M6 13V14H4V13H6Z" fill="#00FFA2"/>
      <path d="M6 12V13H4V12H6Z" fill="#00FFA2"/>
      <path d="M6 11V12H4V11H6Z" fill="#00FFA2"/>
      <path d="M6 10V11H4V10H6Z" fill="#00FFA2"/>
      <path d="M6 9V10H4V9H6Z" fill="#00FFA2"/>
      <path d="M6 8V9H4V8H6Z" fill="#00FFA2"/>
      <path d="M6 7V8H4V7H6Z" fill="#00FFA2"/>
      <path d="M6 6V7H4V6H6Z" fill="#00FFA2"/>
      <path d="M6 5V6H4V5H6Z" fill="#00FFA2"/>
      <path d="M6 4V5H4V4H6Z" fill="#00FFA2"/>
      <path d="M6 3V4H4V3H6Z" fill="#00FFA2"/>
      <path d="M6 2V3H4V2H6Z" fill="#00FFA2"/>
      <!-- Purple tip -->
      <path d="M6 1V2H4V1H6Z" fill="#9E66F2"/>
    </g>
    
    <!-- Bar 3 -->
    <g class="eq-bar-3">
      <!-- Green sections -->
      <path d="M9 14V15H7V14H9Z" fill="#00FFA2"/>
      <path d="M9 13V14H7V13H9Z" fill="#00FFA2"/>
      <path d="M9 12V13H7V12H9Z" fill="#00FFA2"/>
      <path d="M9 11V12H7V11H9Z" fill="#00FFA2"/>
      <path d="M9 10V11H7V10H9Z" fill="#00FFA2"/>
      <path d="M9 9V10H7V9H9Z" fill="#00FFA2"/>
      <path d="M9 8V9H7V8H9Z" fill="#00FFA2"/>
      <path d="M9 7V8H7V7H9Z" fill="#00FFA2"/>
      <path d="M9 6V7H7V6H9Z" fill="#00FFA2"/>
      <path d="M9 5V6H7V5H9Z" fill="#00FFA2"/>
      <path d="M9 4V5H7V4H9Z" fill="#00FFA2"/>
      <path d="M9 3V4H7V3H9Z" fill="#00FFA2"/>
      <path d="M9 2V3H7V2H9Z" fill="#00FFA2"/>
      <!-- Purple tip -->
      <path d="M9 1V2H7V1H9Z" fill="#9E66F2"/>
    </g>
    
    <!-- Bar 4 -->
    <g class="eq-bar-4">
      <!-- Green sections -->
      <path d="M12 14V15H10V14H12Z" fill="#00FFA2"/>
      <path d="M12 13V14H10V13H12Z" fill="#00FFA2"/>
      <path d="M12 12V13H10V12H12Z" fill="#00FFA2"/>
      <path d="M12 11V12H10V11H12Z" fill="#00FFA2"/>
      <path d="M12 10V11H10V10H12Z" fill="#00FFA2"/>
      <path d="M12 9V10H10V9H12Z" fill="#00FFA2"/>
      <path d="M12 8V9H10V8H12Z" fill="#00FFA2"/>
      <path d="M12 7V8H10V7H12Z" fill="#00FFA2"/>
      <path d="M12 6V7H10V6H12Z" fill="#00FFA2"/>
      <path d="M12 5V6H10V5H12Z" fill="#00FFA2"/>
      <path d="M12 4V5H10V4H12Z" fill="#00FFA2"/>
      <path d="M12 3V4H10V3H12Z" fill="#00FFA2"/>
      <path d="M12 2V3H10V2H12Z" fill="#00FFA2"/>
      <!-- Purple tip -->
      <path d="M12 1V2H10V1H12Z" fill="#9E66F2"/>
    </g>
    
    <!-- Bar 5 -->
    <g class="eq-bar-5">
      <!-- Green sections -->
      <path d="M15 14V15H13V14H15Z" fill="#00FFA2"/>
      <path d="M15 13V14H13V13H15Z" fill="#00FFA2"/>
      <path d="M15 12V13H13V12H15Z" fill="#00FFA2"/>
      <path d="M15 11V12H13V11H15Z" fill="#00FFA2"/>
      <path d="M15 10V11H13V10H15Z" fill="#00FFA2"/>
      <path d="M15 9V10H13V9H15Z" fill="#00FFA2"/>
      <path d="M15 8V9H13V8H15Z" fill="#00FFA2"/>
      <path d="M15 7V8H13V7H15Z" fill="#00FFA2"/>
      <path d="M15 6V7H13V6H15Z" fill="#00FFA2"/>
      <path d="M15 5V6H13V5H15Z" fill="#00FFA2"/>
      <path d="M15 4V5H13V4H15Z" fill="#00FFA2"/>
      <path d="M15 3V4H13V3H15Z" fill="#00FFA2"/>
      <path d="M15 2V3H13V2H15Z" fill="#00FFA2"/>
      <!-- Purple tip -->
      <path d="M15 1V2H13V1H15Z" fill="#9E66F2"/>
    </g>
  </svg>`;
}

/**
 * Generic metadata icon factory
 */
export function getMetadataIcon(type: 'country' | 'votes' | 'bitrate', options: IconOptions = {}): string {
  switch (type) {
    case 'country':
      return getCountryIcon(options);
    case 'votes':
      return getVotesIcon(options);
    case 'bitrate':
      return getBitrateIcon(options);
    default:
      return '';
  }
}

/**
 * Alternative: Use CSS classes for even better performance
 */
export function getIconWithClass(type: 'country' | 'votes' | 'bitrate', options: IconOptions = {}): string {
  const { size = DEFAULT_ICON_SIZE } = options;
  return `<span class="icon icon-${type}" style="width: ${size}px; height: ${size}px;"></span>`;
}