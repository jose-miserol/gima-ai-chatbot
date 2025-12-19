'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { UIMessage } from 'ai';

export type UsePersistentChatOptions = {
  storageKey?: string;
};

/**
 * A wrapper around useChat that adds localStorage persistence.
 * Automatically saves and restores conversation history.
 * Compatible with AI SDK v5 (uses setMessages instead of initialMessages)
 */
export function usePersistentChat(options: UsePersistentChatOptions = {}) {
  const { storageKey = 'gima-chat-history' } = options;
  const hasLoadedRef = useRef(false);

  // Lazy initialization for vision response
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

  // Initialize useChat without initialMessages (deprecated in v5)
  const chat = useChat();
  const { messages, setMessages } = chat;

  // Track if initial load is complete
  const [isLoaded, setIsLoaded] = useState(false);

  // Load messages from localStorage on mount (once)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (typeof window === 'undefined') {
      setIsLoaded(true);
      return;
    }

    try {
      const savedMessages = localStorage.getItem(storageKey);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Transform old format to new UIMessage format if needed
          const transformedMessages: UIMessage[] = parsed.map((msg) => ({
            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
            role: msg.role,
            content: msg.content || '',
            parts: msg.parts || [{ type: 'text', text: msg.content || '' }],
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          }));
          setMessages(transformedMessages);
        }
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
      localStorage.removeItem(storageKey);
    }

    setIsLoaded(true);
  }, [storageKey, setMessages]);

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
    if (isLoaded && messages.length > 0) {
      debouncedSave(storageKey, JSON.stringify(messages));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, storageKey, isLoaded]);

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
