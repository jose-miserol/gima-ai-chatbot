/**
 * @file messages.ts
 * @module app/constants/messages
 *
 * ============================================================
 * CONSTANTES DE MENSAJES — TEXTOS DE UI Y ERRORES CENTRALIZADOS
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Centraliza todos los strings de mensajes visibles al usuario y los
 *   códigos de error de la API en objetos de constantes tipados.
 *   Cubre dos dominios: mensajes del módulo de voz y mensajes de error HTTP.
 *
 * POR QUÉ CENTRALIZAR MENSAJES:
 *   1. MANTENIMIENTO: Si un mensaje cambia (ej: texto de "sin conexión"),
 *      se actualiza en un solo lugar en lugar de buscar en todos los componentes.
 *   2. CONSISTENCIA: El mismo estado (ej: "cuota agotada") siempre muestra
 *      el mismo texto, sin variaciones por typos o reformulaciones.
 *   3. I18N PREPARADA: Si GIMA necesita soporte multiidioma en el futuro,
 *      estos objetos se convierten en las claves del sistema de traducción
 *      sin refactorizar los componentes.
 *   4. TIPADO: `as const` hace que TypeScript infiera los tipos literales
 *      de cada string, detectando usos incorrectos en compilación.
 *
 * POR QUÉ `as const`:
 *   Sin `as const`, TypeScript infiere `LOCAL_MODE: string`.
 *   Con `as const`, infiere `LOCAL_MODE: '🎤 Modo local activo'` (literal).
 *   Esto permite que el compilador detecte si algún componente usa un
 *   mensaje que no existe en el objeto.
 *
 * DÓNDE SE IMPORTAN:
 *   - VOICE_MESSAGES → Componentes de voz en app/components/features/voice/
 *   - ERROR_MESSAGES → app/api/chat/route.ts para respuestas HTTP de error
 *   - MAX_ERROR_MESSAGE_LENGTH → Componentes que truncan mensajes de error en UI
 * ============================================================
 */

// ============================================================
// MENSAJES DEL MÓDULO DE VOZ
// ============================================================

/**
 * VOICE_MESSAGES — Textos para todos los estados del sistema de voz de GIMA.
 *
 * QUÉ ES:
 *   Catálogo completo de mensajes que el componente de grabación de voz
 *   puede mostrar al usuario según el estado actual del sistema.
 *
 * CONVENCIÓN DE EMOJIS:
 *   Cada mensaje incluye un emoji que actúa como indicador visual rápido
 *   sin depender solo del texto (útil en interfaces pequeñas de tablet/móvil):
 *   - 🎤 → relacionado con micrófono/voz
 *   - ⚡ → límite de cuota (energía agotada)
 *   - 🔑 → problema de autenticación/configuración
 *   - 📡 → problema de conectividad
 *   - ⏱️ → timeout
 *   - 🔊 → error de audio/hardware
 *   - ⚠️ → error genérico
 *   - 🤖 → modelo de IA no disponible
 *   - 🌐 → problema de navegador/compatibilidad
 *
 * SUFIJO "· Modo local activo":
 *   Varios mensajes incluyen este sufijo para indicar que, aunque la IA
 *   de transcripción no está disponible, el sistema de reconocimiento de
 *   voz nativo del navegador (Web Speech API) está activo como fallback.
 *   Esto informa al usuario que la voz sigue funcionando, con menor calidad.
 *
 * GRUPOS DE MENSAJES:
 */
export const VOICE_MESSAGES = {
  // -----------------------------------------------------------
  // ESTADO GENERAL
  // -----------------------------------------------------------

  /** Modo de fallback activo: se usa la Web Speech API nativa del navegador */
  LOCAL_MODE: '🎤 Modo local activo',

  // -----------------------------------------------------------
  // ERRORES DE LA API DE GEMINI (transcripción con IA)
  // -----------------------------------------------------------

  QUOTA_EXCEEDED: '⚡ Cuota agotada · Modo local activo',
  API_NOT_CONFIGURED: '🔑 API sin configurar · Modo local activo',
  NO_CONNECTION: '📡 Sin conexión · Modo local activo',
  TIMEOUT: '⏱️ Tiempo agotado · Modo local activo',
  AUDIO_ERROR: '🔊 Error de audio · Modo local activo',
  SERVER_ERROR: '⚠️ Error de servidor · Modo local activo',
  MODEL_NOT_AVAILABLE: '🤖 Modelo no disponible · Modo local activo',

  // -----------------------------------------------------------
  // ERRORES DE VOZ NATIVA (Web Speech API del navegador)
  // -----------------------------------------------------------

  PERMISSION_DENIED: '🎤 Permiso de micrófono denegado',
  BROWSER_NOT_SUPPORTED: '🌐 Navegador sin soporte de voz · Usa Chrome o Edge',
  VOICE_ERROR_PREFIX: '⚠️ Error de voz:',

  // -----------------------------------------------------------
  // ESTADOS DE PROCESAMIENTO
  // -----------------------------------------------------------

  PROCESSING: 'Procesando transcripción...',
} as const; // `as const` → tipos literales para cada string

// ============================================================
// MENSAJES DE ERROR DE API
// ============================================================

/**
 * ERROR_MESSAGES — Textos para respuestas de error del endpoint /api/chat.
 *
 * QUÉ ES:
 *   Mensajes que se incluyen en los cuerpos JSON de las respuestas HTTP
 *   de error del endpoint de chat (4xx y 5xx). Algunos son técnicos
 *   (para debugging), otros son legibles para el usuario.
 *
 * USOS POR MENSAJE:
 *
 *   QUOTA_EXCEEDED_DESCRIPTION → Body del error 429, visible al usuario final.
 *     Explica por qué no puede enviar más mensajes y qué debe hacer.
 *
 *   RATE_LIMIT → Campo `error` del JSON de respuesta 429.
 *     Es el código de error estándar HTTP ("Too Many Requests").
 *
 *   INVALID_REQUEST → Campo `error` del JSON de respuesta 400.
 *     Indica que el body de la request no cumple el schema esperado.
 *
 *   VALIDATION_ERROR → Usado internamente para clasificar errores de Zod.
 *
 *   PROCESSING_ERROR → Campo `error` del JSON de respuesta 500.
 *     Mensaje genérico cuando el error interno no tiene clasificación específica.
 *
 *   UNKNOWN → Fallback cuando error.message no está disponible.
 *     Evita retornar "undefined" o "[object Object]" en el campo de error.
 *
 * REFERENCIADOS EN: app/api/chat/route.ts
 */
export const ERROR_MESSAGES = {
  /** Descripción amigable para el usuario cuando se excede el rate limit */
  QUOTA_EXCEEDED_DESCRIPTION:
    'Has excedido el límite de solicitudes. Intenta nuevamente en unos segundos.',

  /** Código de error HTTP estándar para rate limiting (campo `error` en JSON 429) */
  RATE_LIMIT: 'Too Many Requests',

  /** Código de error para requests con formato o schema inválido (campo `error` en JSON 400) */
  INVALID_REQUEST: 'Invalid request format',

  /** Etiqueta interna para errores de validación de Zod */
  VALIDATION_ERROR: 'Validation error',

  /** Mensaje genérico para errores 500 sin causa específica identificada */
  PROCESSING_ERROR: 'Error al procesar la solicitud',

  /** Fallback cuando el error no tiene mensaje (ej: errores no-Error lanzados) */
  UNKNOWN: 'Unknown error',
} as const;

// ============================================================
// CONSTANTES DE FORMATO
// ============================================================

/**
 * MAX_ERROR_MESSAGE_LENGTH — Longitud máxima para mostrar mensajes de error en UI.
 *
 * QUÉ ES:
 *   Límite de caracteres para truncar mensajes de error en componentes de UI
 *   que tienen espacio limitado (ej: tooltips, notificaciones toast).
 *
 * POR QUÉ 30:
 *   Los mensajes de error técnicos pueden ser muy largos (stack traces, URLs).
 *   30 caracteres es suficiente para comunicar la causa principal sin
 *   desbordar el layout de la interfaz.
 *
 * CÓMO SE USA:
 *   ```typescript
 *   const displayError = error.message.length > MAX_ERROR_MESSAGE_LENGTH
 *     ? `${error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`
 *     : error.message;
 *   ```
 */
export const MAX_ERROR_MESSAGE_LENGTH = 30;
