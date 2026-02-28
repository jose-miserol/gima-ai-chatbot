'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { useState, useCallback, useEffect } from 'react';
import { env } from '@/app/config/env';

const CHAT_STORAGE_KEY = 'gima_chat_history';

/**
 * Custom React hook that wraps `useChat` from AI SDK.
 *
 * Implements optional localStorage persistence, controlled by
 * NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE environment variable.
 */
export function usePersistentChat() {
  const [visionResponse, setVisionResponse] = useState<{ id: string; text: string } | null>(null);

  // Intentar cargar mensajes iniciales de localStorage si la persistencia está habilitada
  const getInitialMessages = (): UIMessage[] => {
    if (typeof window === 'undefined' || !env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE) return [];
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as UIMessage[];
      }
    } catch (error) {
      console.error('Error loading chat history from localStorage', error);
    }
    return [];
  };

  const chat = useChat({
    api: '/api/chat',
    initialMessages: getInitialMessages(),
  } as any);

  const { messages, setMessages } = chat;

  // Sincronizar mensajes con localStorage
  useEffect(() => {
    if (!env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE) return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat history to localStorage', error);
    }
  }, [messages]);

  // Expose addToolOutput for client-side tool handling (e.g., crear_orden_trabajo)
  const addToolOutput = (chat as any).addToolOutput;

  // Clear all in-memory history (and localStorage if enabled)
  const clearHistory = useCallback(() => {
    setMessages([]);
    setVisionResponse(null);
    if (env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE) {
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch (error) {
        console.error('Error clearing chat history from localStorage', error);
      }
    }
  }, [setMessages]);

  return {
    ...chat,
    // AI SDK v5 usa sendMessage en lugar de append
    sendMessage: (chat as any).sendMessage ?? (chat as any).append,
    reload: (chat as any).reload,
    addToolOutput,
    visionResponse,
    setVisionResponse,
    clearHistory,
  };
}
