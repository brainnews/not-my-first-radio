/**
 * Main entry point for the Not My First Radio application
 */

import { App } from './App';

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Starting Not My First Radio...');
  
  try {
    // Create and initialize the application
    const app = new App({
      version: '2.0.0',
      debug: import.meta.env.DEV || false,
      autoInit: true
    });

    // Make app globally available for debugging
    if (import.meta.env.DEV) {
      (window as any).app = app;
      console.log('App instance available as window.app');
    }

    // Log successful initialization
    console.log('Not My First Radio initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Show user-friendly error message
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        text-align: center;
        padding: 2rem;
        background: #f5f5f5;
      ">
        <h1 style="color: #d32f2f; margin-bottom: 1rem;">
          ⚠️ Application Error
        </h1>
        <p style="color: #666; margin-bottom: 2rem; max-width: 500px;">
          Sorry, something went wrong while loading the application. 
          Please refresh the page to try again.
        </p>
        <button 
          onclick="window.location.reload()" 
          style="
            background: #1976d2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          "
        >
          Refresh Page
        </button>
      </div>
    `;
  }
});

// Handle app visibility changes for performance optimization
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('App hidden - pausing non-essential tasks');
  } else {
    console.log('App visible - resuming tasks');
  }
});

// Handle online/offline events
window.addEventListener('online', () => {
  console.log('Connection restored');
});

window.addEventListener('offline', () => {
  console.log('Connection lost');
});

// Performance monitoring in development
if (import.meta.env.DEV) {
  // Log performance metrics
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      console.log('Performance metrics:', {
        'DOM Content Loaded': Math.round(perfData.domContentLoadedEventEnd - perfData.navigationStart),
        'Load Complete': Math.round(perfData.loadEventEnd - perfData.navigationStart),
        'First Paint': Math.round(performance.getEntriesByType('paint')[0]?.startTime || 0),
      });
    }, 1000);
  });
}