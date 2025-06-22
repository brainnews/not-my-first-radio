/**
 * Modal management system for overlays and dialogs
 */

import { ModalType, ModalState } from '@/types/app';
import { createElement, querySelector, addEventListenerWithCleanup } from '@/utils/dom';
import { eventManager } from '@/utils/events';

export interface ModalManagerConfig {
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  preventBodyScroll?: boolean;
}

interface ModalDefinition {
  type: ModalType;
  title: string;
  content: HTMLElement | string;
  actions?: ModalAction[];
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
}

interface ModalAction {
  label: string;
  action: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

/**
 * Manages modal dialogs and overlays
 */
export class ModalManager {
  private currentModal: HTMLElement | null = null;
  private modalState: ModalState;
  private config: ModalManagerConfig;
  private cleanupFunctions: (() => void)[] = [];
  private bodyScrollPosition: number = 0;

  constructor(config: ModalManagerConfig = {}) {
    this.config = {
      closeOnEscape: true,
      closeOnOverlayClick: true,
      preventBodyScroll: true,
      ...config
    };

    this.modalState = {
      type: null,
      isOpen: false,
      data: null
    };

    this.setupEventListeners();
    this.setupKeyboardHandlers();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventManager.on('modal:open', (modal: ModalDefinition) => {
      this.open(modal);
    });

    eventManager.on('modal:close', () => {
      this.close();
    });

    eventManager.on('modal:toggle', (modal: ModalDefinition) => {
      if (this.modalState.isOpen && this.modalState.type === modal.type) {
        this.close();
      } else {
        this.open(modal);
      }
    });
  }

  /**
   * Set up keyboard handlers
   */
  private setupKeyboardHandlers(): void {
    if (this.config.closeOnEscape) {
      const cleanup = addEventListenerWithCleanup(document, 'keydown', (event) => {
        if (event.key === 'Escape' && this.modalState.isOpen) {
          this.close();
        }
      });
      this.cleanupFunctions.push(cleanup);
    }
  }

  /**
   * Open a modal
   */
  open(modal: ModalDefinition): void {
    // Close existing modal first
    if (this.currentModal) {
      this.close();
    }

    // Update state
    this.modalState = {
      type: modal.type,
      isOpen: true,
      data: modal
    };

    // Prevent body scroll
    if (this.config.preventBodyScroll) {
      this.bodyScrollPosition = window.pageYOffset;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.bodyScrollPosition}px`;
      document.body.style.width = '100%';
    }

    // Create modal element
    this.currentModal = this.createModalElement(modal);
    document.body.appendChild(this.currentModal);

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.currentModal) {
        this.currentModal.classList.add('modal-show');
      }
    });

    // Focus management
    this.manageFocus();

    eventManager.emit('modal:opened', modal.type);
  }

  /**
   * Close the current modal
   */
  close(): void {
    if (!this.currentModal || !this.modalState.isOpen) {
      return;
    }

    const modalType = this.modalState.type;

    // Trigger close animation
    this.currentModal.classList.add('modal-hide');

    setTimeout(() => {
      if (this.currentModal && this.currentModal.parentNode) {
        this.currentModal.parentNode.removeChild(this.currentModal);
      }
      this.currentModal = null;

      // Restore body scroll
      if (this.config.preventBodyScroll) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, this.bodyScrollPosition);
      }

      // Update state
      this.modalState = {
        type: null,
        isOpen: false,
        data: null
      };

      eventManager.emit('modal:closed', modalType);
    }, 300); // Animation duration
  }

  /**
   * Create modal element
   */
  private createModalElement(modal: ModalDefinition): HTMLElement {
    // Modal overlay
    const overlay = createElement('div', {
      className: `modal modal-${modal.size || 'medium'}`,
      onclick: (event: Event) => {
        if (this.config.closeOnOverlayClick && event.target === overlay) {
          this.close();
        }
      }
    });

    // Modal container
    const container = createElement('div', { className: 'modal-container' });

    // Modal header
    const header = createElement('div', { className: 'modal-header' });
    const title = createElement('h2', { className: 'modal-title' }, [modal.title]);
    header.appendChild(title);

    if (modal.closable !== false) {
      const closeButton = createElement('button', {
        className: 'modal-close',
        onclick: () => this.close()
      }, ['×']);
      header.appendChild(closeButton);
    }

    container.appendChild(header);

    // Modal body
    const body = createElement('div', { className: 'modal-body' });
    if (typeof modal.content === 'string') {
      body.innerHTML = modal.content;
    } else {
      body.appendChild(modal.content);
    }
    container.appendChild(body);

    // Modal actions
    if (modal.actions && modal.actions.length > 0) {
      const actionsContainer = createElement('div', { className: 'modal-actions' });
      
      modal.actions.forEach(action => {
        const button = createElement('button', {
          className: `modal-action modal-action-${action.style || 'secondary'}`,
          disabled: action.disabled || false,
          onclick: async () => {
            try {
              await action.action();
              this.close();
            } catch (error) {
              console.error('Modal action error:', error);
            }
          }
        }, [action.label]);
        
        actionsContainer.appendChild(button);
      });

      container.appendChild(actionsContainer);
    }

    overlay.appendChild(container);
    return overlay;
  }

  /**
   * Manage focus for accessibility
   */
  private manageFocus(): void {
    if (!this.currentModal) return;

    // Find first focusable element
    const focusableElements = this.currentModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    // Trap focus within modal
    const cleanup = addEventListenerWithCleanup(this.currentModal, 'keydown', (event) => {
      if (event.key === 'Tab') {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    });

    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Convenience methods for common modal types
   */

  /**
   * Show confirmation dialog
   */
  confirm(
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void
  ): void {
    const content = createElement('p', {}, [message]);
    
    this.open({
      type: 'confirmation',
      title,
      content,
      size: 'small',
      actions: [
        {
          label: 'Cancel',
          action: onCancel || (() => {}),
          style: 'secondary'
        },
        {
          label: 'Confirm',
          action: onConfirm,
          style: 'primary'
        }
      ]
    });
  }

  /**
   * Show alert dialog
   */
  alert(title: string, message: string, onOk?: () => void): void {
    const content = createElement('p', {}, [message]);
    
    this.open({
      type: 'confirmation',
      title,
      content,
      size: 'small',
      actions: [
        {
          label: 'OK',
          action: onOk || (() => {}),
          style: 'primary'
        }
      ]
    });
  }

  /**
   * Show QR code modal
   */
  showQRCode(title: string, qrCodeDataUrl: string, instructions?: string): void {
    const content = createElement('div', { className: 'qr-modal-content' });
    
    const qrImage = createElement('img', {
      src: qrCodeDataUrl,
      alt: 'QR Code',
      className: 'qr-code-image'
    });
    content.appendChild(qrImage);

    if (instructions) {
      const instructionsElement = createElement('p', { className: 'qr-instructions' }, [instructions]);
      content.appendChild(instructionsElement);
    }

    this.open({
      type: 'qr-code',
      title,
      content,
      size: 'medium'
    });
  }

  /**
   * Show add station modal
   */
  showAddStation(onAdd: (stationData: any) => void): void {
    const content = this.createAddStationForm(onAdd);
    
    this.open({
      type: 'add-station',
      title: 'Add Station Manually',
      content,
      size: 'medium'
    });
  }

  /**
   * Create add station form
   */
  private createAddStationForm(onAdd: (stationData: any) => void): HTMLElement {
    const form = createElement('form', { className: 'add-station-form' });

    // Station URL field
    const urlGroup = createElement('div', { className: 'form-group' });
    const urlLabel = createElement('label', {}, ['Stream URL *']);
    const urlInput = createElement('input', {
      type: 'url',
      required: true,
      placeholder: 'https://example.com/stream.mp3'
    });
    urlGroup.appendChild(urlLabel);
    urlGroup.appendChild(urlInput);
    form.appendChild(urlGroup);

    // Station name field
    const nameGroup = createElement('div', { className: 'form-group' });
    const nameLabel = createElement('label', {}, ['Station Name *']);
    const nameInput = createElement('input', {
      type: 'text',
      required: true,
      placeholder: 'Enter station name'
    });
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);

    // Optional fields
    const optionalFields = [
      { name: 'favicon', label: 'Favicon URL', type: 'url', placeholder: 'https://example.com/favicon.ico' },
      { name: 'homepage', label: 'Homepage URL', type: 'url', placeholder: 'https://example.com' },
      { name: 'bitrate', label: 'Bitrate', type: 'number', placeholder: '128' },
      { name: 'country', label: 'Country Code', type: 'text', placeholder: 'US', maxLength: 2 }
    ];

    optionalFields.forEach(field => {
      const group = createElement('div', { className: 'form-group' });
      const label = createElement('label', {}, [field.label]);
      const input = createElement('input', {
        type: field.type,
        placeholder: field.placeholder,
        maxLength: field.maxLength
      });
      group.appendChild(label);
      group.appendChild(input);
      form.appendChild(group);
    });

    // Submit button
    const submitButton = createElement('button', {
      type: 'submit',
      className: 'form-submit'
    }, ['Add Station']);

    form.appendChild(submitButton);

    // Handle form submission
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const formData = new FormData(form);
      const stationData = {
        url: urlInput.value,
        name: nameInput.value,
        stationuuid: `manual_${Date.now()}`,
        // Add other fields from formData
      };

      onAdd(stationData);
    });

    return form;
  }

  /**
   * Get current modal state
   */
  getState(): ModalState {
    return { ...this.modalState };
  }

  /**
   * Check if a modal is currently open
   */
  isOpen(): boolean {
    return this.modalState.isOpen;
  }

  /**
   * Check if a specific modal type is open
   */
  isModalOpen(type: ModalType): boolean {
    return this.modalState.isOpen && this.modalState.type === type;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.close();
    
    // Clean up event listeners
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];

    eventManager.removeAllListeners('modal:open');
    eventManager.removeAllListeners('modal:close');
    eventManager.removeAllListeners('modal:toggle');
  }
}