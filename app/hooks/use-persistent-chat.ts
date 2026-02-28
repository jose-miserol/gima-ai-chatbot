'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useCallback } from 'react';

/**
 * Custom React hook that wraps `useChat` from AI SDK.
 *
 * Previously included localStorage persistence with LZ-string compression.
 * Persistence has been disabled — this hook now serves as a thin wrapper
 * providing a stable API surface for the chat feature.
 *
 * @returns Extended chat state and methods from AI SDK
 * @returns.visionResponse - Currently stored vision analysis response
 * @returns.setVisionResponse - Function to update vision response
 * @returns.clearHistory - Function to reset chat messages
 * @see {@link https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat | AI SDK useChat}
 */
export function usePersistentChat() {
  const [visionResponse, setVisionResponse] = useState<{ id: string; text: string } | null>(null);

  const chat = useChat({
    api: '/api/chat',
  } as any);

  const { setMessages } = chat;

  // Expose addToolOutput for client-side tool handling (e.g., crear_orden_trabajo)
  const addToolOutput = (chat as any).addToolOutput;

  // Clear all in-memory history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setVisionResponse(null);
  }, [setMessages]);

  return {
    ...chat,
    // AI SDK v5 usa sendMessage en lugar de append
    sendMessage: (chat as any).sendMessage ?? (chat as any).append,
    regenerate: (chat as any).reload,
    addToolOutput,
    visionResponse,
    setVisionResponse,
    clearHistory,
  };
}
