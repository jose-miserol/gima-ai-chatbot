import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import '../setup.msw';

// --- CONFIGURATION ---

// Enforce fake timers globally for strict timing control
// Using 'modern' timers by default
vi.useFakeTimers();

// --- MOCKS ---

// Mock crypto.randomUUID for predictable snapshots
Object.defineProperty(global.crypto, 'randomUUID', {
  writable: true,
  value: vi.fn().mockReturnValue('12345678-1234-1234-1234-1234567890ab'),
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(),
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// --- LIFECYCLE HOOKS ---

beforeEach(() => {
  // Clear all mocks before each test to ensure isolation
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  // Clear timers after each test to prevent leakage
  vi.clearAllTimers();
});
