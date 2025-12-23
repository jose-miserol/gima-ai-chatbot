'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { compress, decompress } from 'lz-string';
import type { UIMessage } from 'ai';
import { MAX_STORED_MESSAGES } from '@/app/config/limits';
import { logger } from '@/app/lib/logger';

// Version del formato de storage para futuras migraciones
// TODO: Usar STORAGE_VERSION cuando guardemos datos con versionado
// const STORAGE_VERSION = 1;

export type UsePersistentChatOptions = {
  storageKey?: string;
  /**
   * Debounce delay in milliseconds for localStorage writes
   * @default 500
   */
  debounceMs?: number;
};

/**
 * Formato de datos guardados en localStorage
 */
interface StoredChatData {
  version: number;
  messages: UIMessage[];
}

/**
 * Carga mensajes desde localStorage con soporte para múltiples formatos
 * @param storageKey - Key de localStorage
 * @returns Array de mensajes o array vacío si falla
 */
function loadMessagesFromStorage(storageKey: string): UIMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const compressed = localStorage.getItem(storageKey);
    if (!compressed) return [];

    // Intentar descompresión (formato nuevo)
    let parsed: unknown;
    try {
      const decompressed = decompress(compressed);
      parsed = decompressed ? JSON.parse(decompressed) : null;
    } catch {
      // Fallback a formato no comprimido (backward compatibility)
      parsed = JSON.parse(compressed);
    }

    if (!parsed) return [];

    // Manejar formato con versión
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
      const storedData = parsed as StoredChatData;
      // En el futuro, aquí podríamos hacer migraciones entre versiones
      return Array.isArray(storedData.messages) ? storedData.messages : [];
    }

    // Formato legacy (sin versión) - array directo de mensajes
    if (Array.isArray(parsed)) {
      // Transformar a formato UIMessage si es necesario
      // IMPORTANTE: usar parts: [] en lugar de [{type: 'text'}] para evitar error de discriminador
      return parsed.map((msg) => ({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role,
        content: msg.content || '',
        parts: [], // Array vacío - compatible con AI SDK
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
      }));
    }

    return [];
  } catch (e) {
    logger.error('Error loading chat history', e instanceof Error ? e : new Error(String(e)), {
      component: 'usePersistentChat',
      action: 'loadMessagesFromStorage',
    });
    // Limpiar storage corrupto
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignorar errores al limpiar
    }
    return [];
  }
}

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
 * - Proper AI SDK v5 pattern with initialMessages
 *
 * @param options - Configuration options
 * @param options.storageKey - LocalStorage key prefix (default: 'gima-chat-history')
 * @param options.debounceMs - Debounce delay in ms for writes (default: 500)
 *
 * @returns Extended chat state and methods from AI SDK
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
 *     clearHistory
 *   } = usePersistentChat({
 *     storageKey: 'my-chat',
 *     debounceMs: 1000 // Save every 1 second
 *   });
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

  // ✅ CORRECTO: Lazy initialization de vision response
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

  // ✅ CORRECTO: Inicializar useChat primero
  const chat = useChat();
  const { messages, setMessages } = chat;

  // ✅ CORRECTO: Cargar mensajes una sola vez al montar
  // Usar useRef para evitar que se ejecute múltiples veces en desarrollo
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Solo cargar una vez
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Cargar mensajes iniciales desde storage
    const initialMessages = loadMessagesFromStorage(storageKey);
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar en mount

  // Debounced save to reduce localStorage writes
  const debouncedSave = useDebouncedCallback((key: string, messagesToSave: UIMessage[]) => {
    try {
      // Keep only the most recent MAX_STORED_MESSAGES
      const recentMessages = messagesToSave.slice(-MAX_STORED_MESSAGES);
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
          const halfMessages = messagesToSave.slice(-Math.floor(MAX_STORED_MESSAGES / 2));
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
    if (messages.length > 0) {
      debouncedSave(storageKey, messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, storageKey]);

  // Save vision response when it changes
  useEffect(() => {
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
  }, [visionResponse, storageKey]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setVisionResponse(null);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-vision`);
  }, [storageKey, setMessages]);

  return {
    ...chat,
    visionResponse,
    setVisionResponse,
    clearHistory,
  };
}
