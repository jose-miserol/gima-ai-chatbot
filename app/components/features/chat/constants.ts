/**
 * Chat configuration constants
 * Centralized configuration for chat interface behavior
 */
export const CHAT_CONFIG = {
  /**
   * Minimum text length required before analyzing images
   * Prevents empty or very short prompts with images
   */
  MIN_TEXT_LENGTH_FOR_IMAGE: 10,

  /**
   * Maximum file size for uploads (in bytes)
   * Current limit: 5MB
   */
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  /**
   * Allowed image MIME types for upload
   */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,

  /**
   * Debounce delay for input changes (in milliseconds)
   */
  INPUT_DEBOUNCE_MS: 300,
} as const;

/**
 * User-facing messages and text constants
 * Centralized for easy i18n in the future
 */
export const CHAT_MESSAGES = {
  /**
   * Prefix for image analysis results
   */
  IMAGE_ANALYSIS_PREFIX: '📷 **Análisis de Imagen Subida por el Usuario**',

  /**
   * Confirmation dialog messages
   */
  CONFIRM_CLEAR_HISTORY: '¿Borrar todo el historial de conversación?',
  CONFIRM_DELETE_MESSAGE: '¿Eliminar este mensaje?',

  /**
   * Error messages
   */
  ERROR_ANALYZING_IMAGE: 'Error al analizar la imagen',
  ERROR_SENDING_MESSAGE: 'Error al enviar mensaje',
  ERROR_FILE_TOO_LARGE: 'El archivo es demasiado grande',
  ERROR_INVALID_FILE_TYPE: 'Tipo de archivo no permitido',

  /**
   * Status messages
   */
  STATUS_ANALYZING: 'Analizando imagen...',
  STATUS_SENDING: 'Enviando mensaje...',
  STATUS_TYPING: 'Escribiendo...',

  /**
   * Placeholder text
   */
  PLACEHOLDER_DEFAULT: 'Escribe un mensaje...',
  PLACEHOLDER_WITH_IMAGE: 'Describe la imagen o haz una pregunta...',
} as const;

/**
 * Keyboard shortcut configurations
 */
export const KEYBOARD_SHORTCUTS = {
  /**
   * Submit message
   */
  SUBMIT: 'Enter',
  SUBMIT_WITH_SHIFT: 'Shift+Enter',

  /**
   * Clear conversation history
   */
  CLEAR_HISTORY: 'Ctrl+K',
  CLEAR_HISTORY_MAC: 'Cmd+K',

  /**
   * Focus input
   */
  FOCUS_INPUT: '/',
} as const;

/**
 * Type exports for better TypeScript support
 */
export type ChatConfig = typeof CHAT_CONFIG;
export type ChatMessages = typeof CHAT_MESSAGES;
export type KeyboardShortcuts = typeof KEYBOARD_SHORTCUTS;
