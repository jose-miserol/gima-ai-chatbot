'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { compress, decompress } from 'lz-string';
import type { UIMessage } from 'ai';
import { logger } from '@/app/lib/logger';

// Límite de mensajes para prevenir crecimiento indefinido
const MAX_MESSAGES = 100;

export type UsePersistentChatOptions = {
  storageKey?: string;
  /**
   * Debounce delay in milliseconds for localStorage writes
   * @default 500
   */
  debounceMs?: number;
};

/**
 * Custom React hook that wraps `useChat` from AI SDK with localStorage persistence.
 *
 * Features:
 * - Automatic save/restore of conversation history
 * - Configurable debounce delay for write optimization
 * - LZ-string compression to maximize storage space
 * - Automatic cleanup when quota is exceeded
 * - Message limit (100 most recent) to prevent unbounded growth
 * - Support for vision response persistence
 * - Backward compatibility with non-compressed format
 *
 * @param options - Configuration options
 * @param options.storageKey - LocalStorage key prefix (default: 'gima-chat-history')
 * @param options.debounceMs - Debounce delay in ms for writes (default: 500)
 *
 * @returns Extended chat state and methods from AI SDK
 * @returns.isLoaded - Whether initial load from localStorage is complete
 * @returns.visionResponse - Currently stored vision analysis response
 * @returns.setVisionResponse - Function to update vision response
 * @returns.clearHistory - Function to clear all chat history and vision data
 * @returns...rest - All properties from AI SDK's useChat hook
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     messages,
 *     input,
 *     handleSubmit,
 *     handleInputChange,
 *     isLoaded,
 *     clearHistory
 *   } = usePersistentChat({
 *     storageKey: 'my-chat',
 *     debounceMs: 1000 // Save every 1 second
 *   });
 *
 *   if (!isLoaded) return <LoadingSpinner />;
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} />
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} />
 *         <button type="submit">Send</button>
 *       </form>
 *       <button onClick={clearHistory}>Clear History</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat | AI SDK useChat}
 */
export function usePersistentChat(options: UsePersistentChatOptions = {}) {
  const { storageKey = 'gima-chat-history', debounceMs = 500 } = options;
  const hasLoadedRef = useRef(false);

  // Lazy initialization for vision response
  const [visionResponse, setVisionResponse] = useState<{ id: string; text: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const savedVision = localStorage.getItem(`${storageKey}-vision`);
      return savedVision ? JSON.parse(savedVision) : null;
    } catch (e) {
      logger.error('Error loading vision response', e instanceof Error ? e : new Error(String(e)), {
        component: 'usePersistentChat',
        action: 'loadVisionResponse',
      });
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
      logger.error('Error loading chat history', e instanceof Error ? e : new Error(String(e)), {
        component: 'usePersistentChat',
        action: 'loadChatHistory',
      });
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
      logger.error('Error saving to localStorage', e instanceof Error ? e : new Error(String(e)), {
        component: 'usePersistentChat',
        action: 'saveMessages',
      });
      // If quota exceeded, try with fewer messages
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        try {
          const halfMessages = messagesToSave.slice(-Math.floor(MAX_MESSAGES / 2));
          const compressed = compress(JSON.stringify(halfMessages));
          localStorage.setItem(key, compressed);
          logger.warn(`Reduced chat history to ${halfMessages.length} messages due to quota`, {
            component: 'usePersistentChat',
            action: 'retryReducedSave',
          });
        } catch (retryError) {
          logger.error(
            'Failed to save even reduced history',
            retryError instanceof Error ? retryError : new Error(String(retryError)),
            { component: 'usePersistentChat', action: 'retryReducedSave' }
          );
        }
      }
    }
  }, debounceMs);

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
          logger.warn('Could not save vision response', {
            component: 'usePersistentChat',
            action: 'saveVisionResponse',
            error: String(e),
          });
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
