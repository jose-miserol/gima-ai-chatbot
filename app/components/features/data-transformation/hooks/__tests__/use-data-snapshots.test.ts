import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSnapshots } from '../use-data-snapshots';

// Mock localStorage inline
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn(function (key: string) {
    return this.store[key] || null;
  }),
  setItem: vi.fn(function (key: string, value: string) {
    this.store[key] = value;
  }),
  removeItem: vi.fn(function (key: string) {
    delete this.store[key];
  }),
  clear: vi.fn(function () {
    this.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock logger
vi.mock('@/app/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

describe('useDataSnapshots', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should initialize with empty snapshots when localStorage is empty', () => {
    const { result } = renderHook(() => useDataSnapshots());
    expect(result.current.snapshots).toEqual([]);
  });

  it('should create a snapshot and store it', () => {
    const { result } = renderHook(() => useDataSnapshots());

    act(() => {
      result.current.createSnapshot('test data', 'My Snapshot');
    });

    expect(result.current.snapshots.length).toBe(1);
    expect(result.current.snapshots[0].name).toBe('My Snapshot');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should find snapshot by ID using restoreSnapshot', () => {
    const { result } = renderHook(() => useDataSnapshots());

    act(() => {
      result.current.createSnapshot('restore me', 'Restorable');
    });

    const id = result.current.snapshots[0].id;
    const found = result.current.restoreSnapshot(id);

    expect(found?.originalData).toBe('restore me');
  });

  it('should clear all snapshots', () => {
    const { result } = renderHook(() => useDataSnapshots());

    act(() => {
      result.current.createSnapshot('data', 'Name');
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.snapshots.length).toBe(0);
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });
});
