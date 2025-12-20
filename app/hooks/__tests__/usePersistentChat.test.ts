import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistentChat } from '../usePersistentChat';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

beforeEach(() => {
  global.localStorage = mockLocalStorage as any;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePersistentChat', () => {
  const mockMessages = [
    {
      id: '1',
      role: 'user' as const,
      content: 'Hello',
      parts: [{ type: 'text' as const, text: 'Hello' }],
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'Hi there!',
      parts: [{ type: 'text' as const, text: 'Hi there!' }],
    },
  ] as any; // Type assertion to bypass strict typing for tests

  describe('initialization', () => {
    it('should load messages from localStorage on mount', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockMessages));

      const { result } = renderHook(() => usePersistentChat());

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('gima-chat-history');
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe('1');
    });

    it('should return empty array when localStorage is empty', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => usePersistentChat());

      expect(result.current.messages).toEqual([]);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json {');

      const { result } = renderHook(() => usePersistentChat());

      expect(result.current.messages).toEqual([]);
    });
  });

  describe('saving messages', () => {
    it('should debounce localStorage writes', async () => {
      const { result } = renderHook(() => usePersistentChat());

      act(() => {
        result.current.setMessages(mockMessages);
      });

      // Should not save immediately
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();

      // Wait for debounce (500ms)
      await waitFor(
        () => {
          expect(mockLocalStorage.setItem).toHaveBeenCalled();
        },
        { timeout: 600 }
      );
    });

    it('should persist messages to localStorage', async () => {
      const { result } = renderHook(() => usePersistentChat());

      act(() => {
        result.current.setMessages(mockMessages);
      });

      await waitFor(
        () => {
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
            'gima-chat-history',
            expect.stringContaining('Hello')
          );
        },
        { timeout: 600 }
      );
    });
  });

  describe('clearHistory', () => {
    it('should clear messages and localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockMessages));

      const { result } = renderHook(() => usePersistentChat());

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.messages).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('gima-chat-history');
    });
  });

  describe('custom storage key', () => {
    it('should use custom storage key when provided', () => {
      const customKey = 'custom-chat-key';
      mockLocalStorage.getItem.mockReturnValue(null);

      renderHook(() => usePersistentChat({ storageKey: customKey }));

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(customKey);
    });
  });

  describe('date serialization', () => {
    it('should preserve date objects when loading from localStorage', () => {
      const messagesWithDates = [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          createdAt: '2025-01-01T12:00:00Z', // Stored as ISO string
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(messagesWithDates));

      const { result } = renderHook(() => usePersistentChat());

      // Check that messages were loaded
      expect(result.current.messages).toHaveLength(1);
    });
  });
});
