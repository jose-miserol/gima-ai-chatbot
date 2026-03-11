/**
 * @file use-persistent-chat.ts
 * @module app/hooks/use-persistent-chat
 *
 * ============================================================
 * HOOK — CHAT CON PERSISTENCIA OPCIONAL EN LOCALSTORAGE
 * ============================================================
 *
 * QUÉ HACE ESTE HOOK:
 *   Envuelve el hook `useChat` del Vercel AI SDK v5 añadiendo:
 *   1. Persistencia opcional del historial en localStorage.
 *   2. Carga del historial previo al montar el componente.
 *   3. Un método `clearHistory()` que limpia tanto la memoria como localStorage.
 *   4. Estado de `visionResponse` para respuestas del módulo de visión.
 *   5. Compatibilidad con AI SDK v5 (sendMessage/reload renombrados).
 *
 * POR QUÉ WRAPPEAR useChat EN LUGAR DE USARLO DIRECTAMENTE:
 *   - La persistencia requiere efectos adicionales que no son parte del SDK.
 *   - Los nombres de las funciones cambiaron en AI SDK v5 (append → sendMessage,
 *     regenerate → reload). Este wrapper normaliza la API para que el resto
 *     de la aplicación use nombres consistentes independientemente de la versión.
 *   - Centraliza el manejo de `visionResponse` que es una extensión propia de GIMA.
 *
 * PERSISTENCIA (feature flag):
 *   Controlada por NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE en .env.
 *   DESACTIVADA por defecto porque los técnicos comparten estaciones de trabajo.
 *   Cuando está activada, los mensajes se guardan en localStorage bajo la
 *   clave `gima_chat_history` y se restauran en el próximo acceso.
 *
 * NOTA SOBRE LOCALSTORAGE EN NEXT.JS:
 *   `typeof window === 'undefined'` protege contra SSR: en el servidor no existe
 *   `window`, por lo que acceder a localStorage lanzaría un ReferenceError.
 *   Este check es necesario aunque el componente use 'use client'.
 *
 * VISION RESPONSE:
 *   Estado auxiliar para que el módulo de visión (analyzePartImage) pueda
 *   inyectar sus resultados en el chat sin pasar por el endpoint /api/chat.
 *   El componente de chat puede detectar este estado y renderizar los resultados
 *   como un mensaje especial de asistente.
 *
 * DÓNDE SE USA:
 *   - app/components/features/chat/ChatContainer.tsx (uso principal)
 * ============================================================
 */

'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { useState, useCallback, useEffect } from 'react';

// Variables de entorno validadas: usa env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE (boolean)
// para evitar comparaciones manuales de strings de process.env
import { env } from '@/app/config/env';

// Clave bajo la que se almacena el historial en localStorage.
// Usar una constante evita typos en múltiples puntos de acceso al storage.
const CHAT_STORAGE_KEY = 'gima_chat_history';

/**
 * Hook de chat con persistencia opcional y extensiones propias de GIMA.
 *
 * QUÉ EXPONE:
 *   Todo lo que expone `useChat` del Vercel AI SDK más:
 *   - `sendMessage`: alias de `append` (AI SDK v4) / `sendMessage` (v5)
 *   - `reload`: alias de `regenerate` (v5) / `reload` (v4)
 *   - `addToolOutput`: acceso al método interno del SDK para herramientas cliente
 *   - `visionResponse`: resultado del módulo de visión para inyectar en el chat
 *   - `setVisionResponse`: setter para actualizar visionResponse desde la UI
 *   - `clearHistory`: limpia mensajes en memoria y en localStorage si aplica
 *
 * @example
 * ```tsx
 * function ChatContainer() {
 *   const {
 *     messages,
 *     input,
 *     handleInputChange,
 *     handleSubmit,
 *     sendMessage,
 *     clearHistory,
 *     visionResponse,
 *     isLoading,
 *   } = usePersistentChat();
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} visionResponse={visionResponse} />
 *       <ChatInput
 *         input={input}
 *         onChange={handleInputChange}
 *         onSubmit={handleSubmit}
 *         onClear={clearHistory}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePersistentChat() {
  // Estado auxiliar para respuestas del módulo de visión (analyzePartImage).
  // Cuando un usuario analiza una imagen, el resultado se almacena aquí y
  // el componente de chat lo renderiza como mensaje del asistente.
  const [visionResponse, setVisionResponse] = useState<{ id: string; text: string } | null>(null);

  /**
   * Carga los mensajes iniciales desde localStorage si la persistencia está habilitada.
   *
   * POR QUÉ ES UNA FUNCIÓN Y NO UN useEffect:
   *   `useChat` acepta `initialMessages` como prop en la inicialización.
   *   Si se usara un useEffect para cargar y luego llamar a `setMessages`,
   *   se produciría un flash visual donde el chat aparece vacío y luego
   *   se llena. Cargar directamente en `initialMessages` evita ese flash.
   *
   * POR QUÉ EL GUARD `typeof window === 'undefined'`:
   *   Next.js puede ejecutar módulos cliente en el servidor durante SSR/SSG.
   *   localStorage no existe en Node.js → devolver array vacío en ese caso.
   */
  const getInitialMessages = (): UIMessage[] => {
    if (typeof window === 'undefined' || !env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE) return [];
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as UIMessage[];
      }
    } catch (error) {
      // JSON malformado o localStorage bloqueado por política del navegador
      console.error('Error loading chat history from localStorage', error);
    }
    return [];
  };

  // Inicializar useChat con los mensajes guardados (si existen y la feature está activa).
  // El `as any` en las opciones es necesario porque AI SDK v5 cambió algunas propiedades
  // de configuración que no tienen definiciones de tipos completamente actualizadas.
  const chat = useChat({
    api: '/api/chat', // Endpoint que procesa los mensajes con GROQ + herramientas GIMA
    initialMessages: getInitialMessages(), // Restaura historial previo si la persistencia está activa
  } as any);

  const { messages, setMessages } = chat;

  // ============================================================
  // EFECTO: Sincronizar mensajes con localStorage en cada cambio
  // ============================================================
  // Se ejecuta cada vez que `messages` cambia (nuevo mensaje enviado o recibido).
  // POR QUÉ NO DEBOUNCE: Los mensajes del chat son eventos discretos (no continuos
  // como un scroll), por lo que cada guardado es intencional y necesario.
  useEffect(() => {
    if (!env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE) return; // Feature flag apagada → no persistir
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      // localStorage puede fallar si está lleno (QuotaExceededError) o bloqueado
      console.error('Error saving chat history to localStorage', error);
    }
  }, [messages]);

  // Acceso al método interno del SDK para tool results del lado del cliente.
  // Se usa para cuando `crear_orden_trabajo` requiere confirmación del usuario
  // antes de enviar el resultado al stream del asistente.
  // El `as any` es necesario porque addToolOutput no está en los tipos públicos del SDK.
  const addToolOutput = (chat as any).addToolOutput;

  /**
   * Limpia todo el historial de chat en memoria y en localStorage.
   *
   * CUÁNDO LLAMARLO:
   *   - Botón "Limpiar conversación" en la UI.
   *   - Al cerrar sesión del sistema.
   *   - En tests para resetear el estado entre casos.
   *
   * POR QUÉ TAMBIÉN LIMPIAR visionResponse:
   *   Las respuestas de visión son parte de la sesión de chat actual.
   *   Al limpiar el historial, los resultados de análisis de imagen
   *   previos también deben desaparecer para tener una sesión limpia.
   */
  const clearHistory = useCallback(() => {
    setMessages([]); // Vaciar historial en memoria (AI SDK state)
    setVisionResponse(null); // Limpiar respuesta de visión si existe

    if (env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE) {
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY); // Eliminar historial persistido
      } catch (error) {
        console.error('Error clearing chat history from localStorage', error);
      }
    }
  }, [setMessages]);

  return {
    // Exponer todo lo que useChat provee (messages, input, handleInputChange, etc.)
    ...chat,

    // Normalización de API entre AI SDK v4 y v5.
    // v5 renombró `append` → `sendMessage` y `regenerate` → `reload`.
    // El operador ?? usa el nombre viejo como fallback para compatibilidad.
    sendMessage: (chat as any).sendMessage ?? (chat as any).append,
    reload: (chat as any).reload ?? (chat as any).regenerate,

    // Extensiones propias de GIMA
    addToolOutput,
    visionResponse,
    setVisionResponse,
    clearHistory,
  };
}
