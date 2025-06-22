/**
 * Notification and toast message system
 */

import { Notification, NotificationType } from '@/types/app';
import { createElement, querySelector } from '@/utils/dom';
import { eventManager } from '@/utils/events';

export interface NotificationManagerConfig {
  container?: HTMLElement;
  maxNotifications?: number;
  defaultDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

/**
 * Manages toast notifications and alerts
 */
export class NotificationManager {
  private container: HTMLElement;
  private notifications: Map<string, HTMLElement> = new Map();
  private maxNotifications: number;
  private defaultDuration: number;
  private position: string;

  constructor(config: NotificationManagerConfig = {}) {
    this.maxNotifications = config.maxNotifications || 5;
    this.defaultDuration = config.defaultDuration || 2000;
    this.position = config.position || 'top-right';

    this.container = config.container || this.createContainer();
    this.setupEventListeners();
  }

  /**
   * Create notification container if it doesn't exist
   */
  private createContainer(): HTMLElement {
    let container = querySelector('.notification-container');
    
    if (!container) {
      container = createElement('div', {
        className: `notification-container notification-${this.position}`
      });
      document.body.appendChild(container);
    }

    return container;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('notification:show', (notification: Notification) => {
      this.show(notification);
    });

    eventManager.on('notification:hide', (notificationId: string) => {
      this.hide(notificationId);
    });

    eventManager.on('notification:clear-all', () => {
      this.clearAll();
    });
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Show a notification
   */
  show(notification: Partial<Notification>): string {
    const id = notification.id || this.generateId();
    const duration = notification.duration ?? this.defaultDuration;

    // Remove oldest notification if at max capacity
    if (this.notifications.size >= this.maxNotifications) {
      const oldestId = this.notifications.keys().next().value;
      this.hide(oldestId);
    }

    const notificationElement = this.createNotificationElement({
      id,
      type: notification.type || 'info',
      message: notification.message || '',
      duration,
      action: notification.action
    });

    this.container.appendChild(notificationElement);
    this.notifications.set(id, notificationElement);

    // Trigger animation
    requestAnimationFrame(() => {
      notificationElement.classList.add('notification-show');
    });

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, duration);
    }

    eventManager.emit('notification:shown', { id, type: notification.type });
    return id;
  }

  /**
   * Hide a notification
   */
  hide(notificationId: string): boolean {
    const element = this.notifications.get(notificationId);
    if (!element) {
      return false;
    }

    element.classList.add('notification-hide');
    
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.delete(notificationId);
    }, 300); // Animation duration

    eventManager.emit('notification:hidden', notificationId);
    return true;
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    Array.from(this.notifications.keys()).forEach(id => {
      this.hide(id);
    });
  }

  /**
   * Create notification element
   */
  private createNotificationElement(notification: Notification): HTMLElement {
    const element = createElement('div', {
      className: `notification notification-${notification.type}`,
      dataset: { notificationId: notification.id }
    });

    // Icon based on type
    const icon = this.getNotificationIcon(notification.type);
    const iconElement = createElement('span', { className: 'notification-icon' }, [icon]);
    element.appendChild(iconElement);

    // Message
    const messageElement = createElement('div', { className: 'notification-message' }, [notification.message]);
    element.appendChild(messageElement);

    // Action button if provided
    if (notification.action) {
      const actionButton = createElement('button', {
        className: 'notification-action',
        onclick: () => {
          notification.action!.callback();
          this.hide(notification.id);
        }
      }, [notification.action.label]);
      element.appendChild(actionButton);
    }

    // Close button
    const closeButton = createElement('button', {
      className: 'notification-close',
      onclick: () => this.hide(notification.id)
    }, ['×']);
    element.appendChild(closeButton);

    // Progress bar for timed notifications
    if (notification.duration && notification.duration > 0) {
      const progressBar = createElement('div', { className: 'notification-progress' });
      element.appendChild(progressBar);

      // Animate progress bar
      requestAnimationFrame(() => {
        progressBar.style.animationDuration = `${notification.duration}ms`;
        progressBar.classList.add('notification-progress-animate');
      });
    }

    return element;
  }

  /**
   * Get icon for notification type
   */
  private getNotificationIcon(type: NotificationType): string {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  /**
   * Convenience methods for different notification types
   */
  success(message: string, duration?: number, action?: Notification['action']): string {
    return this.show({ type: 'success', message, duration, action });
  }

  error(message: string, duration?: number, action?: Notification['action']): string {
    return this.show({ type: 'error', message, duration: duration ?? 0, action }); // Errors don't auto-hide
  }

  warning(message: string, duration?: number, action?: Notification['action']): string {
    return this.show({ type: 'warning', message, duration, action });
  }

  info(message: string, duration?: number, action?: Notification['action']): string {
    return this.show({ type: 'info', message, duration, action });
  }

  /**
   * Get notification count
   */
  getNotificationCount(): number {
    return this.notifications.size;
  }

  /**
   * Check if a notification exists
   */
  hasNotification(notificationId: string): boolean {
    return this.notifications.has(notificationId);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearAll();
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    eventManager.removeAllListeners('notification:show');
    eventManager.removeAllListeners('notification:hide');
    eventManager.removeAllListeners('notification:clear-all');
  }
}