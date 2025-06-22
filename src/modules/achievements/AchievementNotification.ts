/**
 * Achievement notification component for displaying achievement unlocks
 */

import { Achievement } from '@/types/app';
import { createElement, querySelector } from '@/utils/dom';
import { eventManager } from '@/utils/events';

export interface AchievementNotificationConfig {
  container?: HTMLElement;
  duration?: number;
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export interface NotificationData {
  type: 'achievement';
  title: string;
  message: string;
  description?: string;
  duration?: number;
  achievement?: Achievement;
}

/**
 * Handles achievement notification display
 */
export class AchievementNotification {
  private config: AchievementNotificationConfig;
  private container: HTMLElement;
  private activeNotifications: Set<HTMLElement> = new Set();

  constructor(config: AchievementNotificationConfig = {}) {
    this.config = {
      duration: 5000,
      maxVisible: 3,
      position: 'top-right',
      ...config
    };

    this.setupContainer();
    this.setupEventListeners();
    this.injectStyles();
  }

  /**
   * Set up notification container
   */
  private setupContainer(): void {
    if (this.config.container) {
      this.container = this.config.container;
    } else {
      // Try to find existing notification container
      let existingContainer = document.querySelector('.achievement-notification-container') as HTMLElement;
      
      if (existingContainer) {
        this.container = existingContainer;
      } else {
        // Create new container if it doesn't exist
        this.container = createElement('div', {
          className: `achievement-notification-container achievement-notifications-${this.config.position}`
        });
        document.body.appendChild(this.container);
      }
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('notification:achievement', (data: NotificationData) => {
      this.showNotification(data);
    });

    eventManager.on('achievement:unlocked', (achievement: Achievement) => {
      this.showAchievementNotification(achievement);
    });
  }

  /**
   * Inject notification styles
   */
  private injectStyles(): void {
    const styleId = 'achievement-notification-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      <style id="${styleId}">
        .achievement-notification-container {
          position: fixed;
          z-index: 10000;
          pointer-events: none;
          width: 320px;
        }
        
        .achievement-notifications-top-right {
          top: 20px;
          right: 20px;
        }
        
        .achievement-notifications-top-left {
          top: 20px;
          left: 20px;
        }
        
        .achievement-notifications-bottom-right {
          bottom: 20px;
          right: 20px;
        }
        
        .achievement-notifications-bottom-left {
          bottom: 20px;
          left: 20px;
        }

        .achievement-notification {
          background: var(--surface-color, #1a1a1a);
          border: 2px solid var(--accent-color, #4CAF50);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          pointer-events: auto;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(100%);
          opacity: 0;
          position: relative;
          overflow: hidden;
        }

        .achievement-notification.show {
          transform: translateX(0);
          opacity: 1;
        }

        .achievement-notification.hide {
          transform: translateX(100%);
          opacity: 0;
        }

        .achievement-notification::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--accent-color, #4CAF50);
          border-radius: 3px 3px 0 0;
        }

        .achievement-notification-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .achievement-notification-icon {
          font-size: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-color, #4CAF50);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .achievement-notification-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-color, #4CAF50);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .achievement-notification-message {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-color, #ffffff);
          margin: 0 0 4px 0;
          line-height: 1.3;
        }

        .achievement-notification-description {
          font-size: 13px;
          color: var(--text-secondary, #999999);
          margin: 0;
          line-height: 1.4;
        }

        .achievement-notification-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: var(--text-secondary, #999999);
          cursor: pointer;
          font-size: 16px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .achievement-notification-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-color, #ffffff);
        }

        .achievement-notification-progress {
          width: 100%;
          height: 2px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 1px;
          margin-top: 8px;
          overflow: hidden;
        }

        .achievement-notification-progress-bar {
          height: 100%;
          background: var(--accent-color, #4CAF50);
          border-radius: 1px;
          transition: width 0.3s ease;
        }

        @keyframes achievementPulse {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); 
          }
          50% { 
            box-shadow: 0 8px 32px rgba(76, 175, 80, 0.4), 0 0 0 4px rgba(76, 175, 80, 0.2); 
          }
        }

        .achievement-notification.pulse {
          animation: achievementPulse 2s ease-in-out;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .achievement-notification {
            background: var(--surface-color, #2a2a2a);
            border-color: var(--accent-color, #4CAF50);
          }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .achievement-notification-container {
            width: calc(100vw - 40px);
            left: 20px !important;
            right: 20px !important;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Show achievement notification
   */
  public showAchievementNotification(achievement: Achievement): void {
    const notificationData: NotificationData = {
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: `${achievement.icon} ${achievement.name}`,
      description: achievement.description,
      duration: this.config.duration,
      achievement
    };

    this.showNotification(notificationData);
  }

  /**
   * Show generic notification
   */
  public showNotification(data: NotificationData): void {
    // Remove oldest notification if at max capacity
    if (this.activeNotifications.size >= this.config.maxVisible!) {
      const oldest = Array.from(this.activeNotifications)[0];
      this.hideNotification(oldest);
    }

    const notification = this.createNotificationElement(data);
    this.container.appendChild(notification);
    this.activeNotifications.add(notification);

    // Trigger show animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
      if (data.type === 'achievement') {
        notification.classList.add('pulse');
      }
    });

    // Auto-hide after duration
    const duration = data.duration || this.config.duration!;
    setTimeout(() => {
      this.hideNotification(notification);
    }, duration);
  }

  /**
   * Create notification element
   */
  private createNotificationElement(data: NotificationData): HTMLElement {
    const notification = createElement('div', {
      className: `achievement-notification notification-${data.type}`,
      onclick: () => {
        if (data.achievement) {
          eventManager.emit('achievements:show-modal', data.achievement.id);
        }
        this.hideNotification(notification);
      }
    });

    // Header with icon and title
    const header = createElement('div', { className: 'achievement-notification-header' });

    const icon = createElement('div', { className: 'achievement-notification-icon' });
    icon.textContent = data.achievement?.icon || '🎉';
    header.appendChild(icon);

    const titleContainer = createElement('div');
    const title = createElement('div', { className: 'achievement-notification-title' });
    title.textContent = data.title;
    titleContainer.appendChild(title);
    header.appendChild(titleContainer);

    notification.appendChild(header);

    // Close button
    const closeButton = createElement('button', {
      className: 'achievement-notification-close',
      onclick: (e: Event) => {
        e.stopPropagation();
        this.hideNotification(notification);
      }
    });
    closeButton.innerHTML = '×';
    notification.appendChild(closeButton);

    // Message
    const message = createElement('div', { className: 'achievement-notification-message' });
    message.textContent = data.message;
    notification.appendChild(message);

    // Description
    if (data.description) {
      const description = createElement('div', { className: 'achievement-notification-description' });
      description.textContent = data.description;
      notification.appendChild(description);
    }

    // Progress bar for achievements with progress
    if (data.achievement && data.achievement.maxProgress && data.achievement.maxProgress > 1) {
      const progressContainer = createElement('div', { className: 'achievement-notification-progress' });
      const progressBar = createElement('div', { className: 'achievement-notification-progress-bar' });
      
      const progress = (data.achievement.progress || 0) / data.achievement.maxProgress * 100;
      progressBar.style.width = `${progress}%`;
      
      progressContainer.appendChild(progressBar);
      notification.appendChild(progressContainer);
    }

    return notification;
  }

  /**
   * Hide notification
   */
  private hideNotification(notification: HTMLElement): void {
    if (!this.activeNotifications.has(notification)) return;

    notification.classList.remove('show');
    notification.classList.add('hide');

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.activeNotifications.delete(notification);
    }, 300);
  }

  /**
   * Clear all notifications
   */
  public clearAll(): void {
    this.activeNotifications.forEach(notification => {
      this.hideNotification(notification);
    });
  }

  /**
   * Destroy notification system
   */
  public destroy(): void {
    this.clearAll();
    eventManager.removeAllListeners('notification:achievement');
    eventManager.removeAllListeners('achievement:unlocked');
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}