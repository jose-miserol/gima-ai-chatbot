'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { compress, decompress } from 'lz-string';
import type { UIMessage } from 'ai';

// Límite de mensajes para prevenir crecimiento indefinido
const MAX_MESSAGES = 100;

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
      const compressed = localStorage.getItem(storageKey);
      if (compressed) {
        // Try decompression first (new format)
        let parsed;
        try {
          const decompressed = decompress(compressed);
          parsed = decompressed ? JSON.parse(decompressed) : null;
        } catch {
          // Fallback to non-compressed format (backward compatibility)
          parsed = JSON.parse(compressed);
        }

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
  const debouncedSave = useDebouncedCallback((key: string, messagesToSave: UIMessage[]) => {
    try {
      // Keep only the most recent MAX_MESSAGES
      const recentMessages = messagesToSave.slice(-MAX_MESSAGES);
      const compressed = compress(JSON.stringify(recentMessages));
      localStorage.setItem(key, compressed);
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      // If quota exceeded, try with fewer messages
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        try {
          const halfMessages = messagesToSave.slice(-Math.floor(MAX_MESSAGES / 2));
          const compressed = compress(JSON.stringify(halfMessages));
          localStorage.setItem(key, compressed);
          console.warn(`Reduced chat history to ${halfMessages.length} messages due to quota`);
        } catch (retryError) {
          console.error('Failed to save even reduced history:', retryError);
        }
      }
    }
  }, 500);

  // Save messages when they change (debounced)
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      debouncedSave(storageKey, messages);
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
