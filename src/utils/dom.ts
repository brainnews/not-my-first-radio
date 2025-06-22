/**
 * DOM utility functions
 */

/**
 * Safe query selector that throws descriptive errors
 */
export function querySelector<T extends Element>(
  selector: string,
  parent: Document | Element = document
): T {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Safe query selector that returns null instead of throwing
 */
export function querySelectorSafe<T extends Element>(
  selector: string,
  parent: Document | Element = document
): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Query all elements with type safety
 */
export function querySelectorAll<T extends Element>(
  selector: string,
  parent: Document | Element = document
): NodeListOf<T> {
  return parent.querySelectorAll<T>(selector);
}

/**
 * Create element with attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'dataset' && typeof value === 'object') {
      // Handle dataset separately
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = String(dataValue);
      });
    } else if (key in element) {
      // Set property directly
      (element as any)[key] = value;
    } else {
      // Set as attribute
      element.setAttribute(key, String(value));
    }
  });
  
  // Add children
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });
  
  return element;
}

/**
 * Add event listener with automatic cleanup
 */
export function addEventListenerWithCleanup<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  element.addEventListener(type, listener, options);
  return () => element.removeEventListener(type, listener, options);
}

/**
 * Toggle class with optional force parameter
 */
export function toggleClass(
  element: Element,
  className: string,
  force?: boolean
): boolean {
  return element.classList.toggle(className, force);
}

/**
 * Add multiple classes
 */
export function addClasses(element: Element, ...classNames: string[]): void {
  element.classList.add(...classNames);
}

/**
 * Remove multiple classes
 */
export function removeClasses(element: Element, ...classNames: string[]): void {
  element.classList.remove(...classNames);
}

/**
 * Check if element has class
 */
export function hasClass(element: Element, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Wait for element to appear in DOM
 */
export function waitForElement<T extends Element>(
  selector: string,
  timeout = 5000,
  parent: Document | Element = document
): Promise<T> {
  return new Promise((resolve, reject) => {
    const element = parent.querySelector<T>(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = parent.querySelector<T>(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(parent, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found within timeout: ${selector}`));
    }, timeout);
  });
}

/**
 * Debounce function for event handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for event handlers
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Animate element with CSS transitions
 */
export function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions = {}
): Animation {
  const defaultOptions: KeyframeAnimationOptions = {
    duration: 300,
    easing: 'ease-in-out',
    fill: 'forwards'
  };
  
  return element.animate(keyframes, { ...defaultOptions, ...options });
}

/**
 * Smooth scroll to element
 */
export function scrollToElement(
  element: Element,
  behavior: ScrollBehavior = 'smooth'
): void {
  element.scrollIntoView({ behavior, block: 'center' });
}

/**
 * Get element's position relative to viewport
 */
export function getElementPosition(element: Element): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}