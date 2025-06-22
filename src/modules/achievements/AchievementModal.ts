/**
 * Achievement modal component for viewing all achievements
 */

import { Achievement, UserStats } from '@/types/app';
import { AchievementCategory } from './AchievementManager';
import { createElement, querySelector } from '@/utils/dom';
import { eventManager } from '@/utils/events';
import { formatDuration } from '@/utils/format';

export interface AchievementModalConfig {
  closeOnOverlayClick?: boolean;
  showCategories?: boolean;
  showStats?: boolean;
}

/**
 * Modal for displaying achievements
 */
export class AchievementModal {
  private config: AchievementModalConfig;
  private modal: HTMLElement | null = null;
  private categories: AchievementCategory[] = [];
  private userStats: UserStats | null = null;
  private activeCategory: string = 'all';

  constructor(config: AchievementModalConfig = {}) {
    this.config = {
      closeOnOverlayClick: true,
      showCategories: true,
      showStats: true,
      ...config
    };

    this.setupEventListeners();
    this.injectStyles();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('achievements:show-modal', (achievementId?: string) => {
      this.show(achievementId);
    });

    eventManager.on('achievements:hide-modal', () => {
      this.hide();
    });

    eventManager.on('modal:close', () => {
      this.hide();
    });
  }

  /**
   * Inject modal styles
   */
  private injectStyles(): void {
    const styleId = 'achievement-modal-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      <style id="${styleId}">
        .achievement-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .achievement-modal.show {
          opacity: 1;
          visibility: visible;
        }

        .achievement-modal-container {
          background: var(--surface-color, #1a1a1a);
          border-radius: 16px;
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          overflow: hidden;
          transform: scale(0.9) translateY(20px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-color, #333);
        }

        .achievement-modal.show .achievement-modal-container {
          transform: scale(1) translateY(0);
        }

        .achievement-modal-header {
          padding: 24px;
          border-bottom: 1px solid var(--border-color, #333);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .achievement-modal-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-color, #ffffff);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .achievement-modal-close {
          background: none;
          border: none;
          color: var(--text-secondary, #999);
          cursor: pointer;
          font-size: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .achievement-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-color, #ffffff);
        }

        .achievement-modal-body {
          padding: 0;
          max-height: calc(90vh - 120px);
          overflow-y: auto;
        }

        .achievement-stats {
          padding: 24px;
          background: var(--surface-secondary, #2a2a2a);
          border-bottom: 1px solid var(--border-color, #333);
        }

        .achievement-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .achievement-stat {
          text-align: center;
          padding: 16px;
          background: var(--surface-color, #1a1a1a);
          border-radius: 12px;
          border: 1px solid var(--border-color, #333);
        }

        .achievement-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--accent-color, #4CAF50);
          margin-bottom: 4px;
        }

        .achievement-stat-label {
          font-size: 12px;
          color: var(--text-secondary, #999);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .achievement-progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 12px;
        }

        .achievement-progress-fill {
          height: 100%;
          background: var(--accent-color, #4CAF50);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .achievement-categories {
          padding: 24px 24px 0px !important;
        }

        .achievement-category-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .achievement-category-tab {
          background: none;
          border: 1px solid var(--border-color, #333);
          color: var(--text-secondary, #999);
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .achievement-category-tab:hover {
          border-color: var(--accent-color, #4CAF50);
          color: var(--text-color, #ffffff);
        }

        .achievement-category-tab.active {
          background: var(--accent-color, #4CAF50);
          border-color: var(--accent-color, #4CAF50);
          color: white;
        }

        .achievements-grid {
          padding: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .achievement-card {
          background: var(--surface-secondary, #2a2a2a);
          border: 1px solid var(--border-color, #333);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .achievement-card:hover {
          border-color: var(--accent-color, #4CAF50);
          transform: translateY(-2px);
        }

        .achievement-card.unlocked {
          border-color: var(--accent-color, #4CAF50);
          background: var(--surface-color, #1a1a1a);
        }

        .achievement-card.unlocked::before {
          content: '';
          position: absolute;
          top: 12px;
          right: 12px;
          width: 20px;
          height: 20px;
          background: var(--accent-color, #4CAF50);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .achievement-card.unlocked::after {
          content: '✓';
          position: absolute;
          top: 12px;
          right: 12px;
          width: 20px;
          height: 20px;
          color: white;
          font-size: 12px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .achievement-card {
          position: relative;
        }

        .achievement-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .achievement-card-icon {
          font-size: 32px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .achievement-card.unlocked .achievement-card-icon {
          background: var(--accent-color, #4CAF50);
        }

        .achievement-card-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-color, #ffffff);
          margin: 0;
        }

        .achievement-card-description {
          font-size: 14px;
          color: var(--text-secondary, #999);
          margin: 0 0 12px 0;
          line-height: 1.4;
        }

        .achievement-card-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }

        .achievement-card-progress-bar {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .achievement-card-progress-fill {
          height: 100%;
          background: var(--accent-color, #4CAF50);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .achievement-card-progress-text {
          font-size: 12px;
          color: var(--text-secondary, #999);
          white-space: nowrap;
        }

        .achievement-card.locked .achievement-card-icon,
        .achievement-card.locked .achievement-card-title,
        .achievement-card.locked .achievement-card-description {
          opacity: 0.5;
        }

        .achievement-unlock-date {
          font-size: 12px;
          color: var(--accent-color, #4CAF50);
          margin-top: 8px;
          font-style: italic;
        }

        .no-achievements {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-secondary, #999);
        }

        .no-achievements-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .achievement-modal-container {
            width: 95%;
            max-height: 95vh;
          }

          .achievements-grid {
            grid-template-columns: 1fr;
            padding: 16px;
          }

          .achievement-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .achievement-category-tabs {
            justify-content: center;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Show achievements modal
   */
  public show(highlightAchievementId?: string): void {
    // Get fresh data
    eventManager.emit('achievements:request-data', (data: {
      categories: AchievementCategory[];
      userStats: UserStats;
    }) => {
      this.categories = data.categories;
      this.userStats = data.userStats;
      this.render();
      
      if (highlightAchievementId) {
        this.highlightAchievement(highlightAchievementId);
      }
    });
  }

  /**
   * Hide achievements modal
   */
  public hide(): void {
    if (!this.modal) return;

    this.modal.classList.remove('show');
    
    setTimeout(() => {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
        this.modal = null;
      }
    }, 300);
  }

  /**
   * Render the modal
   */
  private render(): void {
    if (this.modal) {
      this.hide();
      return;
    }

    this.modal = this.createModalElement();
    document.body.appendChild(this.modal);

    // Trigger show animation
    requestAnimationFrame(() => {
      if (this.modal) {
        this.modal.classList.add('show');
      }
    });
  }

  /**
   * Create modal element
   */
  private createModalElement(): HTMLElement {
    const modal = createElement('div', {
      className: 'achievement-modal',
      onclick: (e: Event) => {
        if (this.config.closeOnOverlayClick && e.target === modal) {
          this.hide();
        }
      }
    });

    const container = createElement('div', { className: 'achievement-modal-container' });

    // Header
    const header = createElement('div', { className: 'achievement-modal-header' });
    const title = createElement('h2', { className: 'achievement-modal-title' }, ['🏆 Achievements']);
    const closeButton = createElement('button', {
      className: 'achievement-modal-close',
      onclick: () => this.hide()
    }, ['×']);

    header.appendChild(title);
    header.appendChild(closeButton);
    container.appendChild(header);

    // Body
    const body = createElement('div', { className: 'achievement-modal-body' });

    // Stats section
    if (this.config.showStats && this.userStats) {
      body.appendChild(this.createStatsSection());
    }

    // Categories section
    if (this.config.showCategories) {
      body.appendChild(this.createCategoriesSection());
    }

    // Achievements grid
    body.appendChild(this.createAchievementsGrid());

    container.appendChild(body);
    modal.appendChild(container);

    return modal;
  }

  /**
   * Create stats section
   */
  private createStatsSection(): HTMLElement {
    if (!this.userStats) {
      return createElement('div');
    }

    const section = createElement('div', { className: 'achievement-stats' });
    const grid = createElement('div', { className: 'achievement-stats-grid' });

    const stats = [
      {
        label: 'Achievements',
        value: `${this.userStats.achievementsUnlocked}/${this.getTotalAchievements()}`,
        progress: this.userStats.achievementsUnlocked / this.getTotalAchievements() * 100
      },
      {
        label: 'Listening Time',
        value: formatDuration(this.userStats.totalPlayTime)
      }
    ];

    stats.forEach(stat => {
      const statElement = createElement('div', { className: 'achievement-stat' });
      
      const value = createElement('div', { className: 'achievement-stat-value' });
      value.textContent = stat.value;
      statElement.appendChild(value);
      
      const label = createElement('div', { className: 'achievement-stat-label' });
      label.textContent = stat.label;
      statElement.appendChild(label);

      if (stat.progress !== undefined) {
        const progressBar = createElement('div', { className: 'achievement-progress-bar' });
        const progressFill = createElement('div', { className: 'achievement-progress-fill' });
        progressFill.style.width = `${stat.progress}%`;
        progressBar.appendChild(progressFill);
        statElement.appendChild(progressBar);
      }

      grid.appendChild(statElement);
    });

    section.appendChild(grid);
    return section;
  }

  /**
   * Create categories section
   */
  private createCategoriesSection(): HTMLElement {
    const section = createElement('div', { className: 'achievement-categories' });
    const tabs = createElement('div', { className: 'achievement-category-tabs' });

    // All categories tab
    const allTab = createElement('button', {
      className: `achievement-category-tab ${this.activeCategory === 'all' ? 'active' : ''}`,
      onclick: () => this.setActiveCategory('all')
    });
    allTab.innerHTML = '🏆 All';
    tabs.appendChild(allTab);

    // Individual category tabs
    this.categories.forEach(category => {
      const tab = createElement('button', {
        className: `achievement-category-tab ${this.activeCategory === category.id ? 'active' : ''}`,
        onclick: () => this.setActiveCategory(category.id)
      });
      tab.innerHTML = `${category.icon} ${category.name}`;
      tabs.appendChild(tab);
    });

    section.appendChild(tabs);
    return section;
  }

  /**
   * Create achievements grid
   */
  private createAchievementsGrid(): HTMLElement {
    const grid = createElement('div', { className: 'achievements-grid' });

    const achievements = this.getFilteredAchievements();

    if (achievements.length === 0) {
      const noAchievements = createElement('div', { className: 'no-achievements' });
      noAchievements.innerHTML = `
        <div class="no-achievements-icon">🏆</div>
        <p>No achievements found</p>
      `;
      grid.appendChild(noAchievements);
      return grid;
    }

    achievements.forEach(achievement => {
      const card = this.createAchievementCard(achievement);
      grid.appendChild(card);
    });

    return grid;
  }

  /**
   * Create achievement card
   */
  private createAchievementCard(achievement: Achievement): HTMLElement {
    const card = createElement('div', {
      className: `achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`,
      onclick: () => {
        // Show achievement details or close modal
      }
    });

    // Header
    const header = createElement('div', { className: 'achievement-card-header' });
    
    const icon = createElement('div', { className: 'achievement-card-icon' });
    icon.textContent = achievement.icon;
    header.appendChild(icon);

    const titleContainer = createElement('div');
    const title = createElement('h3', { className: 'achievement-card-title' });
    title.textContent = achievement.name;
    titleContainer.appendChild(title);
    header.appendChild(titleContainer);

    card.appendChild(header);

    // Description
    const description = createElement('p', { className: 'achievement-card-description' });
    description.textContent = achievement.description;
    card.appendChild(description);

    // Progress (if applicable)
    if (achievement.maxProgress && achievement.maxProgress > 1) {
      const progress = achievement.progress || 0;
      const progressContainer = createElement('div', { className: 'achievement-card-progress' });
      
      const progressBar = createElement('div', { className: 'achievement-card-progress-bar' });
      const progressFill = createElement('div', { className: 'achievement-card-progress-fill' });
      progressFill.style.width = `${(progress / achievement.maxProgress) * 100}%`;
      progressBar.appendChild(progressFill);
      progressContainer.appendChild(progressBar);

      const progressText = createElement('div', { className: 'achievement-card-progress-text' });
      progressText.textContent = `${progress}/${achievement.maxProgress}`;
      progressContainer.appendChild(progressText);

      card.appendChild(progressContainer);
    }

    // Unlock date
    if (achievement.unlocked && achievement.unlockedAt) {
      const unlockDate = createElement('div', { className: 'achievement-unlock-date' });
      const date = new Date(achievement.unlockedAt);
      unlockDate.textContent = `Unlocked on ${date.toLocaleDateString()}`;
      card.appendChild(unlockDate);
    }

    return card;
  }

  /**
   * Set active category filter
   */
  private setActiveCategory(categoryId: string): void {
    this.activeCategory = categoryId;
    this.refreshAchievementsGrid();
    this.updateCategoryTabs();
  }

  /**
   * Get filtered achievements based on active category
   */
  private getFilteredAchievements(): Achievement[] {
    if (this.activeCategory === 'all') {
      return this.categories.flatMap(category => category.achievements);
    }

    const category = this.categories.find(cat => cat.id === this.activeCategory);
    return category ? category.achievements : [];
  }

  /**
   * Refresh achievements grid
   */
  private refreshAchievementsGrid(): void {
    if (!this.modal) return;

    const existingGrid = this.modal.querySelector('.achievements-grid');
    if (existingGrid) {
      const newGrid = this.createAchievementsGrid();
      existingGrid.parentNode?.replaceChild(newGrid, existingGrid);
    }
  }

  /**
   * Update category tabs active state
   */
  private updateCategoryTabs(): void {
    if (!this.modal) return;

    const tabs = this.modal.querySelectorAll('.achievement-category-tab');
    tabs.forEach((tab, index) => {
      if (index === 0 && this.activeCategory === 'all') {
        tab.classList.add('active');
      } else if (index > 0 && this.categories[index - 1]?.id === this.activeCategory) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  /**
   * Highlight specific achievement
   */
  private highlightAchievement(achievementId: string): void {
    setTimeout(() => {
      if (!this.modal) return;

      const cards = this.modal.querySelectorAll('.achievement-card');
      cards.forEach(card => {
        // Find the card by checking achievement data
        // This would need achievement ID stored in card data
        card.classList.add('highlight');
        setTimeout(() => card.classList.remove('highlight'), 2000);
      });
    }, 300);
  }

  /**
   * Get total achievements count
   */
  private getTotalAchievements(): number {
    return this.categories.reduce((total, category) => total + category.achievements.length, 0);
  }

  /**
   * Destroy modal
   */
  public destroy(): void {
    this.hide();
    eventManager.removeAllListeners('achievements:show-modal');
    eventManager.removeAllListeners('achievements:hide-modal');
  }
}