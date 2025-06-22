/**
 * Type-safe event management system for decoupling components
 */

import { AppEvent, AppEventType } from '@/types/app';

type EventCallback<T = any> = (payload: T) => void;
type EventMap = Record<AppEventType, EventCallback[]>;

/**
 * Central event manager for application-wide communication
 */
class EventManager {
  private events: EventMap = {} as EventMap;
  private debugMode = false;

  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(eventType: AppEventType, callback: EventCallback<T>): () => void {
    if (!this.events[eventType]) {
      this.events[eventType] = [];
    }

    this.events[eventType].push(callback as EventCallback);

    if (this.debugMode) {
      console.log(`Event listener added: ${eventType}`);
    }

    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Subscribe to an event that will only fire once
   */
  once<T = any>(eventType: AppEventType, callback: EventCallback<T>): () => void {
    const wrappedCallback = (payload: T) => {
      callback(payload);
      this.off(eventType, wrappedCallback);
    };

    return this.on(eventType, wrappedCallback);
  }

  /**
   * Unsubscribe from an event
   */
  off<T = any>(eventType: AppEventType, callback: EventCallback<T>): void {
    if (!this.events[eventType]) {
      return;
    }

    const index = this.events[eventType].indexOf(callback as EventCallback);
    if (index > -1) {
      this.events[eventType].splice(index, 1);

      if (this.debugMode) {
        console.log(`Event listener removed: ${eventType}`);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T = any>(eventType: AppEventType, payload?: T): void {
    const event: AppEvent = {
      type: eventType,
      payload,
      timestamp: Date.now()
    };

    if (this.debugMode) {
      console.log(`Event emitted: ${eventType}`, payload);
    }

    if (!this.events[eventType]) {
      return;
    }

    // Create a copy of listeners to avoid issues if listeners are modified during iteration
    const listeners = [...this.events[eventType]];
    
    listeners.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: AppEventType): void {
    if (eventType) {
      delete this.events[eventType];
      if (this.debugMode) {
        console.log(`All listeners removed for: ${eventType}`);
      }
    } else {
      this.events = {} as EventMap;
      if (this.debugMode) {
        console.log('All event listeners removed');
      }
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(eventType: AppEventType): number {
    return this.events[eventType]?.length || 0;
  }

  /**
   * Get all event types that have listeners
   */
  eventTypes(): AppEventType[] {
    return Object.keys(this.events) as AppEventType[];
  }

  /**
   * Check if there are any listeners for an event type
   */
  hasListeners(eventType: AppEventType): boolean {
    return this.listenerCount(eventType) > 0;
  }
}

// Create singleton instance
export const eventManager = new EventManager();

/**
 * Convenience functions for common event patterns
 */

/**
 * Create a typed event emitter for a specific domain
 */
export function createEventEmitter<T extends Record<string, any>>() {
  return {
    on<K extends keyof T>(event: K, callback: (payload: T[K]) => void) {
      return eventManager.on(event as AppEventType, callback);
    },
    
    once<K extends keyof T>(event: K, callback: (payload: T[K]) => void) {
      return eventManager.once(event as AppEventType, callback);
    },
    
    emit<K extends keyof T>(event: K, payload: T[K]) {
      eventManager.emit(event as AppEventType, payload);
    },
    
    off<K extends keyof T>(event: K, callback: (payload: T[K]) => void) {
      eventManager.off(event as AppEventType, callback);
    }
  };
}

/**
 * Decorator for automatic event cleanup on component destruction
 */
export function withEventCleanup<T extends { destroy?: () => void }>(
  target: T,
  events: (() => void)[]
): T & { destroy: () => void } {
  const originalDestroy = target.destroy;

  return {
    ...target,
    destroy() {
      // Clean up all event listeners
      events.forEach(cleanup => cleanup());
      
      // Call original destroy if it exists
      if (originalDestroy) {
        originalDestroy.call(target);
      }
    }
  };
}

/**
 * Promise-based event waiting
 */
export function waitForEvent<T = any>(
  eventType: AppEventType,
  timeout?: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = eventManager.once(eventType, (payload: T) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(payload);
    });

    if (timeout) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Event ${eventType} timeout after ${timeout}ms`));
      }, timeout);
    }
  });
}

/**
 * Event aggregator for batching multiple events
 */
export class EventBatcher {
  private batch: AppEvent[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private delay: number;

  constructor(delay = 100) {
    this.delay = delay;
  }

  /**
   * Add event to batch
   */
  add(eventType: AppEventType, payload?: any): void {
    this.batch.push({
      type: eventType,
      payload,
      timestamp: Date.now()
    });

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  /**
   * Immediately flush all batched events
   */
  flush(): void {
    if (this.batch.length === 0) {
      return;
    }

    const events = [...this.batch];
    this.batch = [];

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    eventManager.emit('batch:flush', events);
  }

  /**
   * Get current batch size
   */
  size(): number {
    return this.batch.length;
  }
}