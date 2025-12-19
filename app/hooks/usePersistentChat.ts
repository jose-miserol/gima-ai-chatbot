'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export type UsePersistentChatOptions = {
  storageKey?: string;
};

/**
 * A wrapper around useChat that adds localStorage persistence.
 * Automatically saves and restores conversation history.
 */
export function usePersistentChat(options: UsePersistentChatOptions = {}) {
  const { storageKey = 'gima-chat-history' } = options;

  // Lazy initialization to avoid setState in useEffect
  const [visionResponse, setVisionResponse] = useState<{ id: string; text: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const savedVision = localStorage.getItem(`${storageKey}-vision`);
      return savedVision ? JSON.parse(savedVision) : null;
    } catch (e) {
      console.error('Error loading vision response:', e);
      return null;
    }
  });

  // Load initial messages from localStorage
  const initialMessages = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedMessages = localStorage.getItem(storageKey);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
      localStorage.removeItem(storageKey);
    }
    return [];
  }, [storageKey]);

  const chat = useChat({
    initialMessages,
  });

  const { messages, setMessages } = chat;

  // Loading is immediate since we use initialMessages
  const isLoaded = true;

  // Debounced save to reduce localStorage writes
  const debouncedSave = useDebouncedCallback((key: string, data: string) => {
    try {
      localStorage.setItem(key, data);
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, 500);

  // Save messages when they change (debounced)
  useEffect(() => {
    if (messages.length > 0) {
      debouncedSave(storageKey, JSON.stringify(messages));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, storageKey]);

  // Save vision response when it changes
  useEffect(() => {
    if (isLoaded) {
      if (visionResponse) {
        try {
          localStorage.setItem(`${storageKey}-vision`, JSON.stringify(visionResponse));
        } catch (e) {
          console.warn('Could not save vision response:', e);
        }
      } else {
        localStorage.removeItem(`${storageKey}-vision`);
      }
    }
  }, [visionResponse, isLoaded, storageKey]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setVisionResponse(null);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-vision`);
  }, [storageKey, setMessages]);

  return {
    ...chat,
    isLoaded,
    visionResponse,
    setVisionResponse,
    clearHistory,
  };
}
