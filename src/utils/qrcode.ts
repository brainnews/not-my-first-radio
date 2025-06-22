/**
 * QR Code generation utilities
 */

import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generate QR code as data URL (base64 image)
 */
export async function generateQRCodeDataURL(
  text: string, 
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M' as const
  };

  const qrOptions = { ...defaultOptions, ...options };

  try {
    return await QRCode.toDataURL(text, qrOptions);
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('QR code generation failed');
  }
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  text: string, 
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M' as const
  };

  const qrOptions = { ...defaultOptions, ...options };

  try {
    return await QRCode.toString(text, {
      type: 'svg',
      ...qrOptions
    });
  } catch (error) {
    console.error('Failed to generate QR code SVG:', error);
    throw new Error('QR code SVG generation failed');
  }
}

/**
 * Generate QR code for sharing data
 */
export async function generateShareQRCode(
  shareUrl: string,
  isDarkMode = false
): Promise<string> {
  const options: QRCodeOptions = {
    width: 400,
    margin: 3,
    color: {
      dark: isDarkMode ? '#FFFFFF' : '#000000',
      light: isDarkMode ? '#2c2c2c' : '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  };

  return await generateQRCodeDataURL(shareUrl, options);
}