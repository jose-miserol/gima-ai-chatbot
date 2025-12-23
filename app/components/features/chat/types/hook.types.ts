/**
 * Tipos de Parámetros de Hooks
 *
 * Definiciones de tipos para parámetros de hooks personalizados.
 * Incluye acciones de chat, atajos de teclado y notificaciones toast.
 */

/**
 * Parámetros para el hook useChatActions
 *
 * Define los callbacks requeridos para gestión de acciones de chat.
 *
 * @property regenerate - Función para regenerar la última respuesta del asistente
 * @property clearHistory - Función para borrar todo el historial de chat
 * @property setInput - Función para actualizar el valor del campo de input
 */
export interface UseChatActionsParams {
  regenerate: () => void;
  clearHistory: () => void;
  setInput: (value: string) => void;
}

/**
 * Parámetros para el hook useChatKeyboard
 *
 * Define los callbacks para manejo de atajos de teclado.
 *
 * @property onSubmit - Callback para enviar el mensaje actual (Ctrl+Enter)
 * @property onCancelVoice - Callback para cancelar grabación de voz (Esc)
 * @property onFocusInput - Callback para enfocar el textarea de input (/)
 * @property canSubmit - Si se permite el envío de mensajes
 * @property isListening - Si la grabación de voz está activa
 */
export interface UseChatKeyboardParams {
  onSubmit: () => void;
  onCancelVoice: () => void;
  onFocusInput: () => void;
  canSubmit: boolean;
  isListening: boolean;
}

/**
 * Interfaz de funciones de notificación toast
 *
 * Define la interfaz para métodos de notificación toast.
 *
 * @property success - Mostrar notificación toast de éxito
 * @property error - Mostrar notificación toast de error
 */
export interface ToastFunctions {
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
}
