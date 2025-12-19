'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useRef } from 'react';

export type UsePersistentChatOptions = {
  storageKey?: string;
};

/**
 * A wrapper around useChat that adds localStorage persistence.
 * Automatically saves and restores conversation history.
 */
export function usePersistentChat(options: UsePersistentChatOptions = {}) {
  const { storageKey = 'gima-chat-history' } = options;
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [visionResponse, setVisionResponse] = useState<{id: string; text: string} | null>(null);
  const hasLoadedRef = useRef(false);

  const chat = useChat();
  const { messages, setMessages } = chat;

  // Load history on mount (only once)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const savedMessages = localStorage.getItem(storageKey);
    const savedVision = localStorage.getItem(`${storageKey}-vision`);
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Error loading chat history:', e);
        localStorage.removeItem(storageKey);
      }
    }
    
    if (savedVision) {
      try {
        setVisionResponse(JSON.parse(savedVision));
      } catch (e) {
        console.error('Error loading vision response:', e);
        localStorage.removeItem(`${storageKey}-vision`);
      }
    }
    
    setIsLoaded(true);
  }, [storageKey, setMessages]);

  // Save messages when they change (after initial load)
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) {
        console.warn('Could not save chat history:', e);
      }
    }
  }, [messages, isLoaded, storageKey]);

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

