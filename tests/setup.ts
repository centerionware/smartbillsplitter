// tests/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver for tests
// JSDOM, the test environment for Vitest, doesn't implement this browser API.
// We need to provide a basic mock to prevent 'IntersectionObserver is not defined' errors.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  
  constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) {
    this.root = options?.root || null;
    this.rootMargin = options?.rootMargin || '0px';
    this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0];
  }

  observe(target: Element): void {
    // This mock doesn't need to actually trigger the callback for current tests.
    // If future tests need to simulate intersection, logic can be added here.
  }
  
  unobserve(target: Element): void {
    // Method stub for cleanup.
  }
  
  disconnect(): void {
    // Method stub for cleanup.
  }
  
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);