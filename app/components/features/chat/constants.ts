/**
 * Constantes de configuración del chat
 * Configuración centralizada para el comportamiento de la interfaz de chat
 */
export const CHAT_CONFIG = {
  /**
   * Longitud mínima de texto requerida antes de analizar imágenes
   * Evita prompts vacíos o muy cortos con imágenes
   */
  MIN_TEXT_LENGTH_FOR_IMAGE: 10,

  /**
   * Tamaño máximo de archivo para subidas (en bytes)
   * Límite actual: 5MB
   */
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  /**
   * Tipos MIME de imagen permitidos para subida
   */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,

  /**
   * Retardo de debounce para cambios de input (en milisegundos)
   */
  INPUT_DEBOUNCE_MS: 300,
} as const;

/**
 * Mensajes y textos visibles para el usuario
 * Centralizado para fácil i18n en el futuro
 */
export const CHAT_MESSAGES = {
  /**
   * Prefijo para resultados de análisis de imagen
   */
  IMAGE_ANALYSIS_PREFIX: '📷 **Análisis de Imagen Subida por el Usuario**',

  /**
   * Mensajes de diálogo de confirmación
   */
  CONFIRM_CLEAR_HISTORY: '¿Borrar todo el historial de conversación?',
  CONFIRM_DELETE_MESSAGE: '¿Eliminar este mensaje?',

  /**
   * Mensajes de error
   */
  ERROR_ANALYZING_IMAGE: 'Error al analizar la imagen',
  ERROR_SENDING_MESSAGE: 'Error al enviar mensaje',
  ERROR_FILE_TOO_LARGE: 'El archivo es demasiado grande',
  ERROR_INVALID_FILE_TYPE: 'Tipo de archivo no permitido',

  /**
   * Mensajes de estado
   */
  STATUS_ANALYZING: 'Analizando imagen...',
  STATUS_SENDING: 'Enviando mensaje...',
  STATUS_TYPING: 'Escribiendo...',

  /**
   * Texto placeholder
   */
  PLACEHOLDER_DEFAULT: 'Escribe un mensaje...',
  PLACEHOLDER_WITH_IMAGE: 'Describe la imagen o haz una pregunta...',
} as const;

/**
 * Configuraciones de atajos de teclado
 */
export const KEYBOARD_SHORTCUTS = {
  /**
   * Enviar mensaje
   */
  SUBMIT: 'Enter',
  SUBMIT_WITH_SHIFT: 'Shift+Enter',

  /**
   * Borrar historial de conversación
   */
  CLEAR_HISTORY: 'Ctrl+K',
  CLEAR_HISTORY_MAC: 'Cmd+K',

  /**
   * Enfocar input
   */
  FOCUS_INPUT: '/',
} as const;

/**
 * Exportación de tipos para mejor soporte TypeScript
 */
export type ChatConfig = typeof CHAT_CONFIG;
export type ChatMessages = typeof CHAT_MESSAGES;
export type KeyboardShortcuts = typeof KEYBOARD_SHORTCUTS;
