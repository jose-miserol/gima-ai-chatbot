import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { usePersistentChat } from '../use-persistent-chat';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePersistentChat', () => {
  describe('initialization', () => {
    it('should initialize with empty messages', () => {
      const { result } = renderHook(() => usePersistentChat());

      expect(result.current.messages).toEqual([]);
    });

    it('should initialize with null visionResponse', () => {
      const { result } = renderHook(() => usePersistentChat());

      expect(result.current.visionResponse).toBeNull();
    });
  });

  describe('clearHistory', () => {
    it('should clear messages and visionResponse', () => {
      const { result } = renderHook(() => usePersistentChat());

      // Set some state first
      act(() => {
        result.current.setVisionResponse({ id: 'v1', text: 'test vision' });
      });

      expect(result.current.visionResponse).toEqual({ id: 'v1', text: 'test vision' });

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.visionResponse).toBeNull();
    });
  });

  describe('visionResponse', () => {
    it('should update visionResponse state', () => {
      const { result } = renderHook(() => usePersistentChat());

      act(() => {
        result.current.setVisionResponse({ id: 'v1', text: 'test' });
      });

      expect(result.current.visionResponse).toEqual({ id: 'v1', text: 'test' });
    });

    it('should clear visionResponse when set to null', () => {
      const { result } = renderHook(() => usePersistentChat());

      act(() => {
        result.current.setVisionResponse({ id: 'v1', text: 'test' });
      });

      act(() => {
        result.current.setVisionResponse(null);
      });

      expect(result.current.visionResponse).toBeNull();
    });
  });

  describe('chat API surface', () => {
    it('should expose sendMessage method', () => {
      const { result } = renderHook(() => usePersistentChat());

      expect(result.current.sendMessage).toBeDefined();
    });

    it('should expose regenerate method', () => {
      const { result } = renderHook(() => usePersistentChat());

      expect(result.current.regenerate).toBeDefined();
    });

    it('should expose clearHistory method', () => {
      const { result } = renderHook(() => usePersistentChat());

      expect(typeof result.current.clearHistory).toBe('function');
    });
  });
});
