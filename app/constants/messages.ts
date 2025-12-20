/**
 * Centralized message constants for the application
 * Extracted from inline strings to improve maintainability and i18n support
 */

export const VOICE_MESSAGES = {
  // General states
  LOCAL_MODE: '🎤 Modo local activo',

  // Gemini API errors
  QUOTA_EXCEEDED: '⚡ Cuota agotada · Modo local activo',
  API_NOT_CONFIGURED: '🔑 API sin configurar · Modo local activo',
  NO_CONNECTION: '📡 Sin conexión · Modo local activo',
  TIMEOUT: '⏱️ Tiempo agotado · Modo local activo',
  AUDIO_ERROR: '🔊 Error de audio · Modo local activo',
  SERVER_ERROR: '⚠️ Error de servidor · Modo local activo',
  MODEL_NOT_AVAILABLE: '🤖 Modelo no disponible · Modo local activo',

  // Native voice errors
  PERMISSION_DENIED: '🎤 Permiso de micrófono denegado',
  BROWSER_NOT_SUPPORTED: '🌐 Navegador sin soporte de voz · Usa Chrome o Edge',
  VOICE_ERROR_PREFIX: '⚠️ Error de voz:',

  // Processing states
  PROCESSING: 'Procesando transcripción...',
} as const;

export const ERROR_MESSAGES = {
  QUOTA_EXCEEDED_DESCRIPTION:
    'Has excedido el límite de solicitudes. Intenta nuevamente en unos segundos.',
  RATE_LIMIT: 'Too Many Requests',
  INVALID_REQUEST: 'Invalid request format',
  VALIDATION_ERROR: 'Validation error',
  PROCESSING_ERROR: 'Error al procesar la solicitud',
  UNKNOWN: 'Unknown error',
} as const;

/**
 * Maximum length for error message display
 */
export const MAX_ERROR_MESSAGE_LENGTH = 30;
